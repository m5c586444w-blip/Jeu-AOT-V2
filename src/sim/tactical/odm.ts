import type { TacticalBalance } from "../../data/balance";
import type { TacticalWorldMap } from "./map";
import { anchorsNear, groundAt } from "./map";
import type { SoldierUnit, TitanUnit } from "./types";

/** Manœuvre tridimensionnelle (03 §4.1, F-CMB-01, F-CMB-15) : fonctions pures sur une unité, appelées à chaque pas. */

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** Point de la nuque d'un Titan (cible de coupe). Un rampant porte la nuque bas [A]. */
export function napeOf(t: TitanUnit, b: TacticalBalance): Point3 {
  const ratio = t.behavior === "rampant" ? 0.35 : b.titans.nape_height_ratio;
  return { x: t.x - Math.cos(t.heading) * 0.8, y: t.y - Math.sin(t.heading) * 0.8, z: t.height * ratio };
}

/** Point d'ancrage sur le corps d'un Titan (épaule) [A] : les crochets se plantent dans la chair. */
export function titanAnchorPoint(t: TitanUnit): Point3 {
  return { x: t.x, y: t.y, z: t.height * 0.8 };
}

export function anchorPoint(s: SoldierUnit, titans: readonly TitanUnit[]): Point3 | null {
  if (!s.anchor) return null;
  if (s.anchor.kind === "fixe") return { x: s.anchor.x, y: s.anchor.y, z: s.anchor.z };
  const t = titans[s.anchor.titan];
  return t?.alive ? titanAnchorPoint(t) : null;
}

/**
 * Choisit un ancrage pour se rapprocher de `goal` : parmi les ancrages fixes à portée et le corps du Titan visé
 * (s'il est à portée), celui qui laisse le moins de distance jusqu'au but. Null si rien n'est à portée (pas d'ODM sans ancrage).
 */
export function pickAnchor(s: SoldierUnit, m: TacticalWorldMap, b: TacticalBalance, goal: Point3, titan: TitanUnit | null): SoldierUnit["anchor"] {
  const range = b.odm.hook_range_m;
  // Passe d'attaque : Titan à portée → crochet dans son corps (épaule), puis coupe de nuque.
  if (titan?.alive) {
    const p = titanAnchorPoint(titan);
    const self = Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z);
    if (self <= range && self > 3) return { kind: "titan", titan: titan.id };
  }
  // Sinon, déplacement d'ancrage en ancrage vers le but (ville, forêt, mur).
  let best: SoldierUnit["anchor"] = null;
  let bestScore = Infinity;
  for (const a of anchorsNear(m, s.x, s.y, s.z, range)) {
    const self = Math.hypot(a.x - s.x, a.y - s.y, a.z - s.z);
    if (self < 4) continue;
    const score = Math.hypot(a.x - goal.x, a.y - goal.y, a.z - goal.z) + self * 0.15;
    if (score < bestScore) {
      bestScore = score;
      best = { kind: "fixe", id: a.id, x: a.x, y: a.y, z: a.z };
    }
  }
  // Un ancrage n'est utile que s'il rapproche du but.
  const here = Math.hypot(s.x - goal.x, s.y - goal.y, s.z - goal.z);
  return best && best.kind === "fixe" && Math.hypot(best.x - goal.x, best.y - goal.y, best.z - goal.z) < here - 2 ? best : null;
}

/** Délai de tir du crochet (0,15–0,3 s selon la compétence ; plus long en panique). */
export function hookDelay(s: SoldierUnit, b: TacticalBalance, panic: boolean): number {
  const [lo, hi] = b.odm.hook_delay_s;
  const k = Math.max(0, Math.min(1, (s.odm - 20) / 75));
  return (hi - (hi - lo) * k) * (panic ? b.odm.panic_hook_delay_mult : 1) * (s.ackerman ? 0.6 : 1);
}

/** Débit de gaz en poussée (1–2,5 u/s) : un bon manieur économise. */
export function thrustRate(s: SoldierUnit, b: TacticalBalance, panic: boolean, wasteMult: number): number {
  const [lo, hi] = b.odm.gas_thrust_per_s;
  const k = Math.max(0, Math.min(1, (s.odm - 20) / 75));
  return (hi - (hi - lo) * k) * (panic ? wasteMult : 1);
}

/**
 * Un pas d'ODM : rail vers l'ancrage (accélération + gaz), ou vol balistique (gravité, traînée), atterrissage.
 * Renvoie la hauteur de chute subie à l'atterrissage (0 si atterrissage contrôlé) et le gaz consommé.
 */
export function stepOdm(s: SoldierUnit, m: TacticalWorldMap, b: TacticalBalance, titans: readonly TitanUnit[], dt: number, panic: boolean, wasteMult: number): { fall: number; gas: number } {
  let gasUsed = 0;
  if (s.mode === "rail") {
    const p = anchorPoint(s, titans);
    // Sous la moitié de la réserve, on lâche le rail pour garder de quoi freiner la descente.
    if (!p || s.gas <= b.soldiers.gas_reserve / 2) {
      s.mode = "vol";
      s.anchor = null;
    } else {
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const dz = p.z - s.z;
      const d = Math.hypot(dx, dy, dz);
      if (d <= b.odm.release_dist_m) {
        // Lâcher : la vitesse acquise est conservée (arc balistique, 03 §4.1).
        s.mode = "vol";
        s.anchor = null;
      } else {
        const acc = b.odm.rail_accel * (s.ackerman ? 1.3 : 1);
        s.vx += (dx / d) * acc * dt;
        s.vy += (dy / d) * acc * dt;
        s.vz += (dz / d) * acc * dt;
        const rate = thrustRate(s, b, panic, wasteMult);
        gasUsed = Math.min(s.gas, rate * dt);
        s.gas -= gasUsed;
      }
    }
  }
  if (s.mode === "rail" || s.mode === "vol") {
    if (s.mode === "vol") s.vz -= b.odm.gravity * dt;
    const drag = 1 - b.odm.drag * dt;
    s.vx *= drag;
    s.vy *= drag;
    s.vz *= drag;
    const v = Math.hypot(s.vx, s.vy, s.vz);
    const max = b.odm.max_speed * (s.ackerman ? 1.25 : 1);
    if (v > max) {
      s.vx *= max / v;
      s.vy *= max / v;
      s.vz *= max / v;
    }
    s.x = Math.max(0, Math.min(m.width, s.x + s.vx * dt));
    s.y = Math.max(0, Math.min(m.height, s.y + s.vy * dt));
    s.z += s.vz * dt;
    s.apex = Math.max(s.apex, s.z);
    const ground = groundAt(m, s.x, s.y);
    if (s.z <= ground) {
      const fall = s.apex - ground;
      s.z = ground;
      s.vx = 0;
      s.vy = 0;
      s.vz = 0;
      s.mode = "sol";
      s.anchor = null;
      s.apex = ground;
      // Avec du gaz, la descente est freinée : seule une chute sans gaz blesse (03 §4.1 : perte de contrôle si gaz = 0).
      if (s.gas > 0) {
        const brake = Math.min(s.gas, Math.max(0, fall - b.odm.safe_fall_m) * 0.05);
        s.gas -= brake;
        gasUsed += brake;
        return { fall: 0, gas: gasUsed };
      }
      return { fall, gas: gasUsed };
    }
  }
  return { fall: 0, gas: gasUsed };
}
