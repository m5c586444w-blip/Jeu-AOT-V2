import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { stateHash } from "../../src/sim/core/canonical";
import { createInitialState, tickDay } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import type { World } from "../../src/sim/strategic/world";

/** P9.3 (CP9-07, CP9-08) : quatre difficultés appliquées à la construction du monde ; « normal » = monde des données. */
const run = (w: World, seed: number, days: number): GameState => {
  let s = createInitialState(seed, w);
  for (let d = 0; d < days; d++) s = tickDay(s, w);
  return s;
};

describe("difficultés (P9.3)", () => {
  const base = loadWorld("data", "scn_sandbox_850");
  const normal = loadWorld("data", "scn_sandbox_850", "normal");
  const recit = loadWorld("data", "scn_sandbox_850", "recit");
  const breche = loadWorld("data", "scn_sandbox_850", "breche");

  it("« normal » laisse le monde et l'état inchangés (même hash, pas de champ de difficulté)", () => {
    expect(normal.difficulty).toBeUndefined();
    expect(normal.scenario).toEqual(base.scenario);
    const a = createInitialState(5, base);
    const b = createInitialState(5, normal);
    expect(b.difficulty).toBeUndefined();
    expect(stateHash(b)).toBe(stateHash(a));
  });

  it("Récit et Brèche : production, densité de Titans, pertes, moral et stabilité de départ dans le sens attendu", () => {
    const pm = (w: World): number => w.scenario.production_mult.food ?? 1;
    expect(pm(recit)).toBeCloseTo(pm(base) * 1.25, 6);
    expect(pm(breche)).toBeCloseTo(pm(base) * 0.75, 6);
    const dens = (w: World): number => w.provinces.reduce((a, p) => a + p.titan_density, 0);
    expect(dens(recit)).toBeLessThan(dens(base));
    expect(dens(breche)).toBeGreaterThan(dens(base));
    for (const p of breche.provinces) expect(p.titan_density).toBeLessThanOrEqual(1);
    expect(recit.military?.exp.engagement.deaths_base).toBeLessThan(base.military?.exp.engagement.deaths_base ?? 0);
    expect(breche.scenario.morale).toBeLessThan(base.scenario.morale);
    expect(recit.scenario.stability).toBeGreaterThan(base.scenario.stability);
    const w854 = loadWorld("data", "scn_854", "rude");
    const b854 = loadWorld("data", "scn_854");
    expect(w854.nations?.balance.ai.personality["agressif"]?.attack).toBeCloseTo((b854.nations?.balance.ai.personality["agressif"]?.attack ?? 0) * 1.2, 6);
  });

  it("la difficulté est gardée dans l'état ; même graine et même difficulté = même hash ; Brèche plus dure que Récit", () => {
    const a = run(breche, 9, 90);
    const b = run(breche, 9, 90);
    expect(a.difficulty).toBe("breche");
    expect(stateHash(a)).toBe(stateHash(b));
    const easy = run(recit, 9, 90);
    expect(stateHash(easy)).not.toBe(stateHash(a));
    expect(easy.strategic?.stocks.food ?? 0).toBeGreaterThan(a.strategic?.stocks.food ?? 0);
  }, 120_000);
});
