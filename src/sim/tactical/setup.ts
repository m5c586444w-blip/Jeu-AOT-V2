import { fnv1a } from "../core/hash";
import { Rng } from "../core/rng";
import { clamp, gaussian } from "../military/random";
import type { World } from "../strategic/world";
import type { BatterySpec, BattleSetup, ShifterSpec, SoldierSpec, TroopKind, TroopSpec } from "./types";

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

/** R2+ : effectif d'une section d'infanterie [A] (une compagnie se divise en sections d'une trentaine d'hommes). */
export const SECTION_SIZE = 30;

export interface CompanyOptions {
  map: string;
  seed: number;
  /** Soldats à équipement tridimensionnel de Paradis (escouades de 6). */
  soldiers: number;
  /** Fantassins de Paradis et ennemis, par arme. */
  allied?: { kind: TroopKind; count: number; faction?: string }[];
  enemy?: { kind: TroopKind; count: number; faction?: string }[];
  titans?: { type: string; count: number }[];
  artillery?: BatterySpec[];
  shifters?: ShifterSpec[];
  night?: boolean;
  thunderSpears?: boolean;
  timeLimit?: number;
}

/** Sections d'une arme : découpe en sections d'au plus `SECTION_SIZE` hommes. */
export function sectionsOf(side: "allie" | "ennemi", list: readonly { kind: TroopKind; count: number; faction?: string }[], faction: string): TroopSpec[] {
  const out: TroopSpec[] = [];
  for (const g of list) {
    let left = Math.max(0, Math.round(g.count));
    const n = Math.ceil(left / SECTION_SIZE);
    for (let i = 0; i < n; i++) {
      const count = Math.ceil(left / (n - i));
      left -= count;
      out.push({ id: `sec_${side === "allie" ? "a" : "e"}${String(out.length + 1).padStart(2, "0")}`, side, kind: g.kind, count, faction: g.faction ?? faction });
    }
  }
  return out;
}

/**
 * Bataille de compagnies (R2+) : 100 à 400 unités (soldats, fantassins des deux camps, canons, Titans, porteurs).
 * Les soldats sont ceux de `skirmishSetup` (même tirage) ; les fantassins viennent en sections.
 */
export function companySetup(world: World, o: CompanyOptions): BattleSetup {
  const base = skirmishSetup(world, o.map, o.titans ?? [], o.soldiers, o.seed, o.night ?? false, false);
  const troops = [...sectionsOf("allie", o.allied ?? [], "fac_paradis"), ...sectionsOf("ennemi", o.enemy ?? [], "fac_marley")];
  return {
    ...base,
    ...(o.shifters && o.shifters.length > 0 ? { shifters: o.shifters } : {}),
    ...(o.thunderSpears ? { thunderSpears: true } : {}),
    ...(o.artillery && o.artillery.length > 0 ? { artillery: o.artillery } : {}),
    ...(troops.length > 0 ? { troops } : {}),
    timeLimit: o.timeLimit ?? world.tactical?.balance.rt?.time_limit_s ?? 600,
  };
}

/** Nombre d'unités en scène (soldats, fantassins, Titans, pièces, porteurs). */
export function unitCount(s: BattleSetup): number {
  return s.soldiers.length + (s.troops ?? []).reduce((n, t) => n + t.count, 0) + s.titans.reduce((n, t) => n + t.count, 0) + (s.artillery ?? []).reduce((n, b) => n + b.count, 0) + (s.shifters ?? []).length;
}
