import { describe, expect, it } from "vitest";
import { applyCommand } from "../../src/sim/core/commands";
import { dayEconomyMods } from "../../src/sim/core/state";
import { NO_MODS, planDay, withArmyDraws } from "../../src/sim/strategic/economy";
import { start, strat, world850NoEvents } from "./politics-helpers";

/**
 * Dette n° 38 : la barre supérieure, l'écran « Économie » et le dossier de province calculent le plan du jour avec les mêmes
 * modificateurs (lois, décrets, missions) que la simulation (`dayEconomyMods`, partagé avec `tickDay`).
 */
describe("plan du jour affiché = variation réelle (dette n° 38)", () => {
  const w = world850NoEvents;
  for (const [law, r] of [
    ["law_soutien_forges", "steel"],
    ["law_controle_ville_souterraine", "gold"],
  ] as const) {
    it(`${law} : stock prévu de « ${r} » = stock du lendemain ; sans les modificateurs, l'écart réapparaît`, () => {
      const s = applyCommand(start(), { type: "EnactLaw", law }, undefined, w);
      const st = strat(s);
      const shown = withArmyDraws(planDay(w, st, s.date, dayEconomyMods(s, w)), s.armies?.drawn).resources[r].next;
      const old = withArmyDraws(planDay(w, st, s.date, NO_MODS), s.armies?.drawn).resources[r].next;
      const real = strat(applyCommand(s, { type: "AdvanceDays", n: 1 }, undefined, w)).stocks[r];
      expect(shown).toBeCloseTo(real, 6);
      expect(Math.abs(old - real)).toBeGreaterThan(0.5);
    });
  }
});
