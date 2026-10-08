import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { replayFactors } from "../../src/sim/core/explain";
import { createInitialState, tickDay } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { planDay, provinceProduction, withArmyDraws } from "../../src/sim/strategic/economy";
import { RESOURCE_IDS } from "../../src/sim/strategic/resources";

const world = loadWorld();

function strat(s: GameState) {
  if (!s.strategic) throw new Error("pas d'état stratégique");
  return s.strategic;
}

function at(days: number): GameState {
  let s = createInitialState(42, world);
  for (let i = 0; i < days; i++) s = tickDay(s, world);
  return s;
}

describe("« pourquoi ? » cohérent avec le calcul (AC1-04)", () => {
  it.each([0, 45, 200])("jour %i : chaque production provinciale = rejeu de ses facteurs", (days) => {
    const s = at(days);
    for (const p of world.provinces) {
      for (const r of RESOURCE_IDS) {
        const x = provinceProduction(world, strat(s), s.date, p.id, r);
        expect(replayFactors(x.factors)).toBeCloseTo(x.value, 9);
      }
    }
  });
  it("les armées du départ prélèvent dans les stocks (consigné pour le « pourquoi ? »)", () => {
    let s = createInitialState(42, world);
    s = tickDay(s, world);
    expect(Object.values(s.armies?.drawn ?? {}).some((v) => v > 0)).toBe(true);
  });
  it.each([0, 45, 200])("jour %i : production nationale = Σ provinces + transformations ; le tick applique exactement la variation expliquée", (days) => {
    const s = at(days);
    const next = tickDay(s, world);
    // Le « pourquoi ? » inclut le ravitaillement des armées (ligne de l'explication, D-129) : aucune compensation à part.
    const plan = withArmyDraws(planDay(world, strat(s), s.date), next.armies?.drawn);
    for (const r of RESOURCE_IDS) {
      const day = plan.resources[r];
      const sumProvinces = world.provinces.reduce((acc, p) => acc + provinceProduction(world, strat(s), s.date, p.id, r).value, 0);
      const conversions = day.production.factors.filter((f) => f.key === "why.conversion_output").reduce((a, f) => a + f.value, 0);
      expect(day.production.value).toBeCloseTo(sumProvinces + conversions, 6);
      for (const x of [day.production, day.consumption, day.losses, day.capacity, day.net]) expect(replayFactors(x.factors)).toBeCloseTo(x.value, 6);
      const drawn = next.armies?.drawn?.[r] ?? 0;
      if (drawn > 0) expect(day.net.factors.some((f) => f.key === "why.army_supply" || f.key === "why.army_upkeep")).toBe(true);
      // Variation réelle (hors flux mensuels du 1er) = variation nette expliquée, moins le trop-plein, plus la rupture.
      if (next.date.day % 30 !== 1 || (r !== "gold" && r !== "manpower")) {
        const real = strat(next).stocks[r] - strat(s).stocks[r];
        expect(real).toBeCloseTo(day.net.value - day.overflow + day.shortfall, 6);
      }
    }
  });
});
