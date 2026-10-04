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
  it("10 déclarés, tous ouverts (P5) ; sans couche de renseignement (845), religion, légitimité et renseignement restent vides", () => {
    expect(OVERLAY_IDS).toHaveLength(10);
    // Depuis P5, les 10 calques sont ouverts (religion, légitimité, renseignement : D-57).
    expect(OVERLAY_IDS.filter(isAvailable)).toEqual([...OVERLAY_IDS]);
    for (const id of ["religion", "legitimite", "renseignement"] as const) expect(computeOverlay(id, world, state, fmt, label)).toBeNull();
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

describe("calques de P5 (AC5-06, AC5-10)", () => {
  const w850 = loadWorld("data", "scn_sandbox_850");
  const s850 = createInitialState(42, w850);
  it("Titans : brouillard — Maria jamais observée reste inconnue, le territoire tenu est connu", () => {
    const titans = computeOverlay("titans", w850, s850, fmt, label);
    expect(titans?.values.has("prov_maria_est")).toBe(false);
    expect(titans?.values.has("prov_karanes")).toBe(true);
    expect(titans?.legend.at(-1)?.label).toBe("overlay.unknown");
  });
  it("renseignement (âge), religion (Culte), légitimité perçue : valeurs pour le territoire tenu", () => {
    expect(computeOverlay("renseignement", w850, s850, fmt, label)?.values.get("prov_karanes")).toBe(0);
    expect(computeOverlay("religion", w850, s850, fmt, label)?.values.get("prov_mitras")).toBe(70);
    const legit = computeOverlay("legitimite", w850, s850, fmt, label);
    expect(legit?.values.size).toBeGreaterThan(10);
  });
});
