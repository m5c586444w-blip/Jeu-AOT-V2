import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { createInitialState } from "../../src/sim/core/state";
import { provinceProduction } from "../../src/sim/strategic/economy";
import { computeOverlay, isAvailable, OVERLAY_IDS } from "../../src/ui/overlays";

const world = loadWorld();
const state = createInitialState(42, world);
const fmt = (n: number): string => String(Math.round(n));
const label = (k: string): string => k;

describe("overlays (AC1-13, F-STR-02)", () => {
  it("10 déclarés, 6 alimentés, 4 fermés sans valeur", () => {
    expect(OVERLAY_IDS).toHaveLength(10);
    expect(OVERLAY_IDS.filter(isAvailable)).toEqual(["politique", "moral", "nourriture", "gaz", "titans", "population"]);
    for (const id of ["religion", "legitimite", "ravitaillement", "renseignement"] as const) expect(computeOverlay(id, world, state, fmt, label)).toBeNull();
  });
  it("valeurs = état de simulation (mêmes fonctions que le tick)", () => {
    const food = computeOverlay("nourriture", world, state, fmt, label);
    expect(food?.values.get("prov_trost")).toBe(provinceProduction(world, state.strategic ?? createInitialState(1, world).strategic ?? (() => { throw new Error(); })(), state.date, "prov_trost", "food").value);
    const pop = computeOverlay("population", world, state, fmt, label);
    expect(pop?.values.get("prov_mitras")).toBe(state.strategic?.provinces["prov_mitras"]?.population);
    const titans = computeOverlay("titans", world, state, fmt, label);
    expect(titans?.values.get("prov_vallee_oubliee")).toBe(0.9);
    const pol = computeOverlay("politique", world, state, fmt, label);
    expect(pol?.values.get("prov_plaines_meurtries")).toBe(0);
    expect(pol?.values.get("prov_trost")).toBe(1);
  });
  it("légendes à 5 échelons pour les échelles continues", () => {
    for (const id of ["moral", "nourriture", "gaz", "titans", "population"] as const) expect(computeOverlay(id, world, state, fmt, label)?.legend).toHaveLength(5);
  });
});
