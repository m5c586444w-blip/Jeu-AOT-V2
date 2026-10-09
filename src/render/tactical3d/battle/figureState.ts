import type { BattleState, SoldierUnit, TitanUnit, TroopUnit } from "../../../sim/tactical/types";

/**
 * États montrés des figures (R3, CR3-07) : lecture seule de l'état de la simulation, pas après pas, sans jamais le modifier.
 * La simulation ne garde pas d'historique : le directeur retient, par unité, la valeur du pas précédent (position, temps de
 * recharge d'une coupe ou d'une attaque, instant de la mort) pour reconnaître un mouvement, un coup qui part, une chute.
 * Module pur (aucun three.js, aucun DOM) : il sert à la vue 3D et aux tests.
 */
export type SoldierShown = "garde" | "marche" | "course" | "vol" | "accroche" | "chute" | "attaque" | "saisi" | "mort" | "absent";
export type TroopShown = "attente" | "marche" | "course" | "tir" | "mort" | "absent";
export type TitanShown = "debout" | "marche" | "course" | "attaque" | "saisie" | "chute" | "mort" | "rampe";

export interface Shown<S> {
  state: S;
  /** Secondes depuis l'entrée dans cet état (progression d'une chute, phase d'une animation). */
  since: number;
}

/** Pas de la simulation tactique (20 par seconde, `tactical.json` : `tick_hz`). */
export const TICK_S = 1 / 20;
/** Durée montrée d'une coupe (soldat), d'une attaque de Titan, d'un tir de fantassin (s). */
export const CUT_SHOWN_S = 0.4;
export const TITAN_ATTACK_SHOWN_S = 0.8;
export const TROOP_FIRE_SHOWN_S = 0.5;
/** Durée de l'effondrement d'un Titan abattu (s) : de debout à face contre terre. */
export const TITAN_FALL_S = 1.6;
/** Seuils de vitesse (m/s) : marche, course (soldat à pied, fantassin) ; chute libre (vitesse verticale). */
export const WALK_MS = 0.3;
export const RUN_MS = 3.0;
export const TROOP_RUN_MS = 2.6;
export const FALL_VZ = -4;
export const TITAN_MOVE_MS = 0.2;

interface Mem<S> {
  state: S;
  enter: number;
  tick: number;
  x: number;
  y: number;
  /** Soldat : temps de recharge de coupe ; Titan : temps de recharge d'attaque (pas précédent). */
  cd: number;
  /** Pas où le dernier coup est parti (−∞ : jamais). */
  hit: number;
  /** Titan : pas de la mort (−∞ : mort avant le premier pas vu). */
  death: number | null;
}

const fresh = <S>(state: S, tick: number, x: number, y: number, cd: number): Mem<S> => ({ state, enter: tick, tick, x, y, cd, hit: -Infinity, death: null });

/** Vitesse au sol (m/s) entre deux pas vus ; au premier pas, la vitesse de la simulation. */
function groundSpeed(m: Mem<unknown> | undefined, x: number, y: number, tick: number, vx = 0, vy = 0): number {
  if (!m || tick <= m.tick) return Math.hypot(vx, vy);
  return Math.hypot(x - m.x, y - m.y) / ((tick - m.tick) * TICK_S);
}

export function soldierShown(s: SoldierUnit, m: Mem<SoldierShown> | undefined, tick: number): SoldierShown {
  if (s.mode === "fui") return "absent";
  if (s.mode === "mort") return "mort";
  if (s.mode === "saisi") return "saisi";
  const hit = m && s.cutCooldown > m.cd + 1e-9 ? tick : (m?.hit ?? -Infinity);
  if ((tick - hit) * TICK_S < CUT_SHOWN_S) return "attaque";
  if (s.mode === "vol") return s.vz < FALL_VZ ? "chute" : "vol";
  if (s.mode === "crochet") return "vol";
  if (s.mode === "rail") return Math.hypot(s.vx, s.vy, s.vz) < 2 ? "accroche" : "vol";
  const v = groundSpeed(m, s.x, s.y, tick, s.vx, s.vy);
  return v > RUN_MS ? "course" : v > WALK_MS ? "marche" : "garde";
}

export function troopShown(t: TroopUnit, m: Mem<TroopShown> | undefined, tick: number): TroopShown {
  if (t.mode === "fui") return "absent";
  if (t.mode === "mort") return "mort";
  if (t.shot >= 0 && (tick - t.shot) * TICK_S < TROOP_FIRE_SHOWN_S) return "tir";
  const v = groundSpeed(m, t.x, t.y, tick);
  return v > TROOP_RUN_MS ? "course" : v > WALK_MS ? "marche" : "attente";
}

export function titanShown(t: TitanUnit, m: Mem<TitanShown> | undefined, tick: number): { state: TitanShown; death: number | null; hit: number } {
  let death = m?.death ?? null;
  if (!t.alive) {
    // Mort pendant un pas vu : la chute part de ce pas ; mort avant le premier pas vu : déjà à terre.
    if (death === null) death = m ? tick : -Infinity;
    return { state: (tick - death) * TICK_S < TITAN_FALL_S ? "chute" : "mort", death, hit: m?.hit ?? -Infinity };
  }
  death = null;
  const hit = m && t.attackCooldown > m.cd + 1e-9 ? tick : (m?.hit ?? -Infinity);
  if (t.grabbing !== null) return { state: "saisie", death, hit };
  if ((tick - hit) * TICK_S < TITAN_ATTACK_SHOWN_S) return { state: "attaque", death, hit };
  if (t.legs > 0) return { state: "rampe", death, hit };
  const v = groundSpeed(m, t.x, t.y, tick);
  return { state: v > TITAN_MOVE_MS ? (t.abnormal ? "course" : "marche") : "debout", death, hit };
}

/** Directeur des figures : à appeler à chaque pas de simulation (idempotent pour un même pas). */
export class FigureDirector {
  private readonly soldiers = new Map<number, Mem<SoldierShown>>();
  private readonly troops = new Map<number, Mem<TroopShown>>();
  private readonly titans = new Map<number, Mem<TitanShown>>();
  private tick = -1;

  update(st: BattleState): void {
    if (st.tick === this.tick) return;
    const tick = st.tick;
    st.soldiers.forEach((s, i) => {
      const m = this.soldiers.get(i);
      const state = soldierShown(s, m, tick);
      const cut = m && s.cutCooldown > m.cd + 1e-9;
      const next = m ?? fresh(state, tick, s.x, s.y, s.cutCooldown);
      if (cut) next.hit = tick;
      if (next.state !== state || !m) {
        next.state = state;
        next.enter = tick;
      }
      Object.assign(next, { tick, x: s.x, y: s.y, cd: s.cutCooldown });
      this.soldiers.set(i, next);
    });
    for (const t of st.troops ?? []) {
      const m = this.troops.get(t.id);
      const state = troopShown(t, m, tick);
      const next = m ?? fresh(state, tick, t.x, t.y, 0);
      if (next.state !== state || !m) {
        next.state = state;
        next.enter = tick;
      }
      Object.assign(next, { tick, x: t.x, y: t.y });
      this.troops.set(t.id, next);
    }
    for (const t of st.titans) {
      const m = this.titans.get(t.id);
      const r = titanShown(t, m, tick);
      const next = m ?? fresh(r.state, tick, t.x, t.y, t.attackCooldown);
      if (next.state !== r.state || !m) {
        next.state = r.state;
        // Une chute commence au coup ; « mort » prend la suite sans recommencer l'horloge de la chute.
        next.enter = r.state === "chute" || r.state === "mort" ? (Number.isFinite(r.death ?? NaN) ? (r.death as number) : tick) : tick;
      }
      Object.assign(next, { tick, x: t.x, y: t.y, cd: t.attackCooldown, hit: r.hit, death: r.death });
      this.titans.set(t.id, next);
    }
    this.tick = tick;
  }

  private shown<S>(m: Mem<S> | undefined, fallback: S): Shown<S> {
    return m ? { state: m.state, since: Math.max(0, (this.tick - m.enter) * TICK_S) } : { state: fallback, since: 0 };
  }

  soldier(i: number): Shown<SoldierShown> {
    return this.shown(this.soldiers.get(i), "garde");
  }

  troop(id: number): Shown<TroopShown> {
    return this.shown(this.troops.get(id), "attente");
  }

  titan(id: number): Shown<TitanShown> {
    return this.shown(this.titans.get(id), "debout");
  }
}

/** Pose du corps de base pour un état montré (R3 : `humanAnim`) ; `null` : rien à montrer. */
export const SOLDIER_POSE: Record<SoldierShown, string | null> = {
  garde: "sol",
  marche: "marche",
  course: "course",
  vol: "vol",
  accroche: "accroche",
  chute: "chute",
  attaque: "frappe",
  saisi: "chute",
  mort: "mort",
  absent: null,
};
export const TROOP_POSE: Record<TroopShown, string | null> = { attente: "attente", marche: "marche", course: "course", tir: "tir", mort: "mort", absent: null };
export const TITAN_POSE: Record<TitanShown, string> = { debout: "debout", marche: "marche", course: "course", attaque: "attaque", saisie: "saisie", chute: "effondre", mort: "abattu", rampe: "allonge" };
