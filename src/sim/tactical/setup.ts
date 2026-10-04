import { fnv1a } from "../core/hash";
import { Rng } from "../core/rng";
import { clamp, gaussian } from "../military/random";
import type { World } from "../strategic/world";
import type { BattleSetup, SoldierSpec } from "./types";

/**
 * Escarmouche type (tests, `sim:tactical`, bataille d'essai) : `n` soldats en escouades de 6, attributs tirés
 * comme ceux du Corps (P3 : moyenne et écart de `roster`), contre des Titans d'un type donné.
 */
export function skirmishSetup(world: World, map: string, titans: { type: string; count: number }[], n: number, seed: number, night = false, wagon = false): BattleSetup {
  const r = world.military?.exp.roster;
  const mean = r?.attribute_mean ?? 55;
  const sd = r?.attribute_sd ?? 12;
  const rng = new Rng(fnv1a(`${seed}:escarmouche`));
  const attr = (): number => Math.round(clamp(mean + sd * gaussian(rng), 5, 95));
  const soldiers: SoldierSpec[] = Array.from({ length: n }, (_, i) => ({
    id: `s${i + 1}`,
    name: `${world.military?.names.given_m[i % (world.military?.names.given_m.length ?? 1)] ?? "Soldat"} ${world.military?.names.family[(i * 7) % (world.military?.names.family.length ?? 1)] ?? i + 1}`,
    squad: `esc_${String(Math.floor(i / 6) + 1).padStart(2, "0")}`,
    leader: i % 6 === 0,
    named: null,
    odm: attr(),
    melee: attr(),
    courage: attr(),
    reaction: attr(),
    ackerman: false,
    veteran: rng.int(0, 3),
  }));
  return { map, seed, night, soldiers, titans, wagon };
}
