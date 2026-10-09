import { fnv1a } from "../core/hash";
import { Rng } from "../core/rng";
import { gaussian } from "../military/random";
import type { World } from "../strategic/world";
import type { Battle } from "./battle";
import { killTroop } from "./troops";
import type { BatteryUnit, BattleSetup, SoldierUnit, TitanUnit } from "./types";

/**
 * Artillerie en bataille (PA.5) : batteries de Paradis au bord de déploiement des soldats, batteries ennemies au bord
 * opposé ; tir indirect avec dispersion croissante avec la distance, zone de danger (souffle), effets sur les Titans
 * (membres immobilisés, rarement tués par les pièces lourdes) et sur les soldats (éclats, tirs amis compris), contre-batterie.
 * Tirage propre (`artRng`) : une bataille sans canon garde exactement sa suite de tirages.
 */

const IMPACT_CAP = 40;

export function deployBatteries(world: World, setup: BattleSetup, width: number, height: number): { batteries: BatteryUnit[]; artRng: number } | null {
  const specs = setup.artillery ?? [];
  if (specs.length === 0 || !world.armies) return null;
  const rng = new Rng(fnv1a(`${setup.seed}:artillerie`));
  const allies = specs.filter((s) => s.side === "allie");
  const enemies = specs.filter((s) => s.side === "ennemi");
  const place = (list: typeof specs, y: number): BatteryUnit[] =>
    list.map((s, i) => ({ ...s, x: ((i + 0.5) / list.length) * width + (rng.next() - 0.5) * 10, y, alive: s.count, reload: 3 + rng.next() * 6, shots: 0, aim: null }));
  return { batteries: [...place(allies, height - 1.5), ...place(enemies, 1.5)], artRng: rng.serialize().state };
}

const d2 = (ax: number, ay: number, bx: number, by: number): number => (ax - bx) ** 2 + (ay - by) ** 2;

export interface ArtilleryHooks {
  kill(s: SoldierUnit): void;
  log(key: string, params: Record<string, string | number>): void;
  alive(s: SoldierUnit): boolean;
}

/** Les batteries ennemies encore en état de tirer empêchent la victoire (la bataille dure tant qu'elles bombardent). */
export function enemyBatteriesActive(bt: Battle): boolean {
  return (bt.state.batteries ?? []).some((b) => b.side === "ennemi" && b.alive > 0);
}

export function stepBatteries(bt: Battle, world: World, dt: number, h: ArtilleryHooks): void {
  const st = bt.state;
  const list = st.batteries;
  const aw = world.armies;
  if (!list || !aw || st.artRng === undefined) return;
  const rng = Rng.fromState({ seed: fnv1a(`${bt.setup.seed}:artillerie`), state: st.artRng });
  const stats = (st.stats.artillery ??= { shots: 0, titanHits: 0, soldierKills: 0, friendlyKills: 0, piecesSilenced: 0 });
  const t = st.tick / bt.world.balance.tick_hz;
  for (const bat of list) {
    if (bat.alive <= 0) continue;
    // R2+ : cessez-le-feu ordonné par le joueur.
    if (bat.hold) {
      bat.aim = null;
      bat.reload = Math.max(bat.reload - dt, 0);
      continue;
    }
    bat.reload -= dt;
    if (bat.reload > 0) continue;
    const piece = aw.pieces.get(bat.piece);
    const mun = aw.munitions.get(bat.munition);
    if (!piece || !mun) continue;
    const range2 = piece.range_m ** 2;
    const min2 = piece.min_range_m ** 2;
    let aim: { x: number; y: number } | null = null;
    if (bat.side === "allie" && bat.zone) {
      // R2+ : tir sur zone ordonné par le joueur (dans la portée de la pièce).
      const dz = d2(bat.zone.x, bat.zone.y, bat.x, bat.y);
      aim = dz <= range2 && dz >= min2 ? { x: bat.zone.x + (rng.next() - 0.5) * bat.zone.r, y: bat.zone.y + (rng.next() - 0.5) * bat.zone.r } : null;
    } else if (bat.side === "allie") {
      // Titans hostiles à portée, le plus proche des soldats d'abord ; sinon contre-batterie.
      const titan = st.titans.filter((x) => x.alive && !x.ally && d2(x.x, x.y, bat.x, bat.y) <= range2 && d2(x.x, x.y, bat.x, bat.y) >= min2).sort((a, b) => a.y - b.y || a.id - b.id).at(-1);
      const enemy = list.find((x) => x.side === "ennemi" && x.alive > 0 && d2(x.x, x.y, bat.x, bat.y) <= range2);
      // R2+ : sans Titan ni batterie, les fantassins ennemis les plus avancés.
      const foot = !titan && !enemy && st.troops ? st.troops.filter((x) => x.side === "ennemi" && x.mode !== "mort" && x.mode !== "fui" && d2(x.x, x.y, bat.x, bat.y) <= range2 && d2(x.x, x.y, bat.x, bat.y) >= min2).sort((a, b) => a.y - b.y || a.id - b.id).at(-1) : undefined;
      aim = titan ? { x: titan.x, y: titan.y } : enemy ? { x: enemy.x, y: enemy.y } : foot ? { x: foot.x, y: foot.y } : null;
    } else {
      const own = list.filter((x) => x.side === "allie" && x.alive > 0);
      const targets: { x: number; y: number }[] = st.soldiers.filter((s) => h.alive(s) && d2(s.x, s.y, bat.x, bat.y) >= min2);
      // R2+ : les fantassins de Paradis sont aussi des cibles.
      if (st.troops) for (const x of st.troops) if (x.side === "allie" && x.mode !== "mort" && x.mode !== "fui" && d2(x.x, x.y, bat.x, bat.y) >= min2) targets.push(x);
      if (own.length > 0 && rng.next() < 0.3) {
        const o = own[Math.floor(rng.next() * own.length)] as BatteryUnit;
        aim = { x: o.x, y: o.y };
      } else if (targets.length > 0) {
        const s = targets[Math.floor(rng.next() * targets.length)] as { x: number; y: number };
        aim = { x: s.x, y: s.y };
      }
    }
    if (!aim) {
      bat.reload = 2;
      bat.aim = null;
      continue;
    }
    const dist = Math.sqrt(d2(aim.x, aim.y, bat.x, bat.y));
    const sigma = piece.dispersion_m * (0.3 + (0.7 * dist) / piece.range_m);
    const ix = aim.x + gaussian(rng) * sigma;
    const iy = aim.y + gaussian(rng) * sigma;
    const r = piece.blast_m * mun.blast_mult;
    bat.aim = { x: aim.x, y: aim.y, r: r + sigma };
    bat.shots += 1;
    stats.shots += 1;
    bat.reload = 60 / piece.rate_per_min / Math.max(1, bat.alive);
    (st.impacts ??= []).push({ t: Math.round(t * 10) / 10, x: Math.round(ix * 10) / 10, y: Math.round(iy * 10) / 10, r: Math.round(r * 10) / 10, side: bat.side });
    if (st.impacts.length > IMPACT_CAP) st.impacts.splice(0, st.impacts.length - IMPACT_CAP);
    // Titans dans le souffle : membres immobilisés (régénération), chaînes : ralentissement ; pièces lourdes : rarement mortelles.
    for (const ti of st.titans) {
      if (!ti.alive || ti.ally) continue;
      if (d2(ti.x, ti.y, ix, iy) > (r + ti.height / 4) ** 2) continue;
      const dmg = piece.vs_titan * mun.vs_titan_mult;
      ti.legs = Math.max(ti.legs, dmg + mun.slow_s);
      if (rng.next() < 0.5) ti.armL = Math.max(ti.armL, dmg / 2);
      stats.titanHits += 1;
      if (ti.grabbing === null && rng.next() < Math.max(0, (dmg - 10) / 40)) killTitan(ti);
    }
    // Soldiers : éclats (y compris tirs amis près des Titans), stress dans la zone de danger.
    for (const s of st.soldiers) {
      if (!h.alive(s)) continue;
      const dd = d2(s.x, s.y, ix, iy) + s.z * s.z;
      if (dd <= (2 * r) ** 2) s.stress += piece.morale_hit;
      if (dd > r * r) continue;
      if (rng.next() < piece.vs_soldier * mun.vs_soldier_mult * (1 - Math.sqrt(dd) / r)) {
        h.kill(s);
        stats.soldierKills += 1;
        if (bat.side === "allie") stats.friendlyKills += 1;
      }
    }
    // R2+ : fantassins (des deux camps) dans le souffle.
    if (st.troops) for (const x of st.troops) {
      if (x.mode === "mort" || x.mode === "fui") continue;
      const dd = d2(x.x, x.y, ix, iy);
      if (dd > r * r) continue;
      if (rng.next() < piece.vs_soldier * mun.vs_soldier_mult * (1 - Math.sqrt(dd) / r)) killTroop(bt, x, "eclat");
    }
    // Contre-batterie : une pièce adverse dans le souffle peut être réduite au silence.
    for (const other of list) {
      if (other.side === bat.side || other.alive <= 0 || d2(other.x, other.y, ix, iy) > (r + 4) ** 2) continue;
      if (rng.next() < 0.5) {
        other.alive -= 1;
        stats.piecesSilenced += 1;
        if (other.alive === 0) h.log("battle.battery_silenced", { side: `battle.side.${other.side}` });
      }
    }
  }
  st.artRng = rng.serialize().state;
}

function killTitan(t: TitanUnit): void {
  t.alive = false;
}
