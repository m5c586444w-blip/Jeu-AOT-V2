import type { GasBalance } from "../../data/balance";
import type { BattleCost, BattleCostInput, DrawResult, GasStock } from "./types";

/** Coût stratégique (spec 26 §4) : chaque bataille ponctionne le stock de gaz et de lames. Pures, sans mutation des arguments. */

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Coût attendu d'une bataille : gaz = soldats × réserve × part brûlée ; la part brûlée croît quand l'ancrage manque
 * (plaine : on pousse au sol, forêt : on glisse). Lames = soldats engagés + coupes attendues.
 */
export function expectedBattleCost(i: BattleCostInput, b: GasBalance): BattleCost {
  const c = b.cost;
  const deficit = clamp((b.anchor.density_ref_per_ha - i.densityPerHa) / b.anchor.density_ref_per_ha, 0, 1);
  const burn = clamp(c.burn_fraction_base + c.burn_fraction_density_k * deficit, 0, c.burn_fraction_max);
  return { gas: Math.max(0, i.soldiers) * c.tank_per_soldier * burn, steel: Math.max(0, i.soldiers) * c.steel_per_soldier_engaged + Math.max(0, i.expectedCuts) * c.steel_per_cut };
}

/** Réserve minimale intouchable d'un dépôt (aucun dépôt ne doit être vidé sans issue : spec 26 §14). */
export function usableStock(stock: GasStock, capacityGas: number, b: GasBalance): GasStock {
  const floor = (capacityGas * b.reserve.depot_min_pct) / 100;
  return { gas: Math.max(0, stock.gas - floor), steel: stock.steel };
}

export function canAfford(stock: GasStock, cost: BattleCost): boolean {
  return stock.gas >= cost.gas && stock.steel >= cost.steel;
}

/** Ponction du stock : retire ce qui existe, signale le manque. Jamais de stock négatif. Monotone en `cost`. */
export function drawFromStock(stock: GasStock, cost: BattleCost): DrawResult {
  const g = Math.min(stock.gas, cost.gas);
  const s = Math.min(stock.steel, cost.steel);
  return { stock: { gas: stock.gas - g, steel: stock.steel - s }, drawn: { gas: g, steel: s }, shortfall: { gas: cost.gas - g, steel: cost.steel - s } };
}

/**
 * Règlement de fin de bataille : le gaz non consommé revient au stock (conservation tactique ↔ stratégique), au rendement de
 * reconditionnement près. `engaged` = ce qui avait été sorti du stock ; `consumed` = ce qui a réellement brûlé.
 */
export function settleBattle(stock: GasStock, engaged: BattleCost, consumed: BattleCost, b: GasBalance): GasStock {
  const back = (e: number, c: number): number => Math.max(0, e - Math.min(e, c));
  return { gas: stock.gas + back(engaged.gas, consumed.gas) * b.cost.refill_efficiency, steel: stock.steel + back(engaged.steel, consumed.steel) };
}

/** Lances de foudre (spec 26 §4) : disponibles après la fin de 850 [C], doctrine à rechercher côté appelant. */
export function lancesAvailable(year: number, b: GasBalance): boolean {
  return year >= b.lances.start_year;
}

/**
 * Valeur militaire d'un soldat (0–1) selon la doctrine : en ODM seul elle suit la compétence ; avec lances, les recrues remontent
 * au plancher `recruit_floor` (redistribution de la valeur) et l'élite perd son monopole.
 */
export function soldierValue(odmSkill: number, withLances: boolean, b: GasBalance): number {
  const skill = clamp(odmSkill, 0, 100) / 100;
  return withLances ? b.lances.recruit_floor + (1 - b.lances.recruit_floor) * skill * 0.5 : skill;
}
