import { readFileSync } from "node:fs";
import { TideBalanceSchema } from "../../../src/data/balance";
import type { TideBalance } from "../../../src/data/balance";
import { createGrid } from "../../../src/sim/tide";
import type { Conditions, GridSpec, Pile, TideGrid } from "../../../src/sim/tide";

export const tb = TideBalanceSchema.parse(JSON.parse(readFileSync("data/balance/tide.json", "utf8")));

/** Copie de l'équilibrage avec une section modifiée (prouve qu'un paramètre a un effet). */
export function tweak<K extends keyof TideBalance>(key: K, patch: Partial<TideBalance[K]>): TideBalance {
  return { ...tb, [key]: { ...(tb[key] as object), ...(patch as object) } };
}

export const NOON: Conditions = { visibility: 1, hour: 12, season: "ete" };
export const NIGHT_WINTER: Conditions = { visibility: 1, hour: 2, season: "hiver" };

export const pile = (id: string, faction: string, x: number, y: number, o: Partial<Pile> = {}): Pile => ({
  id, faction, x, y,
  troops: { fusil: 100 }, ammo: { fusil: 5000 }, gas: 0, morale: 1, suppression: 0, cover: 0, anchors: 0,
  noise: 0.3, smoke: 0, scouts: 0, intel: 0, concealment: 0, wounded: 0, dead: 0, evacuated: 0, routed: false, ...o,
});

/** Grille 9×9 ouverte, capacité de repeuplement partout, densité donnée. */
export function openGrid(density = 0, extra: Partial<GridSpec> = {}, b: TideBalance = tb): TideGrid {
  return createGrid({ w: 9, h: 9, density: new Array<number>(81).fill(density), capacity: 4, ...extra }, b);
}

const need = <T>(v: T | undefined, what: string): T => {
  if (v === undefined) throw new Error(`données absentes : ${what}`);
  return v;
};
export const weapon = (id: string): TideBalance["weapons"][string] => need(tb.weapons[id], `arme ${id}`);
export const sizeCls = (id: string): TideBalance["focus"]["size_classes"][string] => need(tb.focus.size_classes[id], `classe ${id}`);
export const spikeOf = (id: string): number => need(tb.attention.spikes[id], `pic ${id}`);
