import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { createInitialState } from "../../src/sim/core/state";
import { provinceProduction } from "../../src/sim/strategic/economy";
import { computeOverlay, isAvailable, OVERLAY_IDS } from "../../src/ui/overlays";
import { BRICK, mix, OVERLAY_ALPHA, OVERLAY_VEIL, PAPER_DARK, STONE, VEIL } from "../../src/render/palette";
import { deltaE76, rgbToLab } from "../../src/render/tactical3d/styles";

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
  it("légendes à 5 échelons pour les échelles continues (plus les cases « hors du territoire » et « inconnu », dette n° 13)", () => {
    for (const id of ["moral", "nourriture", "gaz", "titans", "population"] as const) {
      const lg = computeOverlay(id, world, state, fmt, label)?.legend ?? [];
      expect(lg.slice(5).every((x) => x.label === "overlay.outside" || x.label === "overlay.unknown"), id).toBe(true);
      expect(lg.length - lg.slice(5).length, id).toBe(5);
    }
  });
  it("dette n° 13 : chaque province a une teinte de la légende (nourriture, gaz, Titans) ; seuils ronds", () => {
    const w850 = loadWorld("data", "scn_sandbox_850");
    const s850 = createInitialState(42, w850);
    const provinces = w850.provinces.filter((p) => p.kind !== "segment");
    for (const id of ["nourriture", "gaz", "titans"] as const) {
      const o = computeOverlay(id, w850, s850, fmt, label);
      const bare = provinces.filter((p) => !o?.colors.has(p.id)).map((p) => p.id);
      expect(bare, id).toEqual([]);
      const legendColors = new Set(o?.legend.map((x) => x.color));
      // Les teintes des provinces sont prises sur l'échelle continue ou sur une case nommée de la légende.
      expect(legendColors.size, id).toBeGreaterThanOrEqual(5);
    }
    const top = computeOverlay("nourriture", w850, s850, (n) => String(n), label)?.legend[4]?.label ?? "";
    expect(Number(top) / 10 ** Math.floor(Math.log10(Number(top)))).toSatisfy((m: number) => [1, 2, 2.5, 5, 10].includes(m));
  });
});

describe("dette n° 14 : teintes du calque politique sous le brouillard", () => {
  const lab = (c: number): [number, number, number] => rgbToLab((c >> 16) & 255, (c >> 8) & 255, c & 255);
  // Aplat posé sur le papier de la carte, puis voile d'une province inexplorée (opacité multipliée par celle de la couche).
  const shown = (tint: number, veil: number): number => mix(mix(PAPER_DARK, tint, OVERLAY_ALPHA), VEIL.color, VEIL.inexplore * veil);
  it("« aux Titans » sous le brouillard reste plus proche de « aux Titans » que de « perdue »", () => {
    const fogged = (veil: number): { titans: number; lost: number } => ({
      titans: deltaE76(lab(shown(BRICK, veil)), lab(shown(BRICK, 0))),
      lost: deltaE76(lab(shown(BRICK, veil)), lab(shown(STONE, 0))),
    });
    // Avant (voile entier) : la brique voilée tirait vers le gris « perdue ».
    expect(fogged(1).titans).toBeGreaterThan(fogged(1).lost);
    const now = fogged(OVERLAY_VEIL);
    console.log(`brouillard sous calque : ΔE aux Titans ${now.titans.toFixed(1)}, ΔE perdue ${now.lost.toFixed(1)}`);
    expect(now.titans).toBeLessThan(10);
    expect(now.lost).toBeGreaterThan(2 * now.titans);
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
