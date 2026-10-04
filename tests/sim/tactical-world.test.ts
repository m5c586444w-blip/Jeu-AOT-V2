import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { anchorsNear, generateMap, groundAt } from "../../src/sim/tactical/map";

const tw = loadWorld("data", "scn_sandbox_850").tactical;
if (!tw) throw new Error("couche tactique absente");
const def = (id: string) => {
  const d = tw.maps.get(id);
  if (!d) throw new Error(id);
  return d;
};
const margin = tw.balance.battle.deploy_margin_m;

describe("cartes tactiques (AC4-02, 03 §2)", () => {
  it("même graine → même carte ; autre graine → autre carte", () => {
    expect(generateMap(def("tmap_ville"), 7, margin)).toEqual(generateMap(def("tmap_ville"), 7, margin));
    expect(generateMap(def("tmap_ville"), 8, margin).structures).not.toEqual(generateMap(def("tmap_ville"), 7, margin).structures);
  });

  it("ancrages : abondants en ville et en forêt, rares en plaine", () => {
    const n = (id: string): number => generateMap(def(id), 42, margin).anchors.length;
    expect(n("tmap_ville")).toBeGreaterThan(200);
    expect(n("tmap_foret")).toBeGreaterThan(100);
    expect(n("tmap_plaine")).toBeLessThan(60);
    expect(n("tmap_plaine")).toBeGreaterThan(0);
  });

  it("forêt : arbres géants de 70 à 90 m ; mur : 50 m ; index spatial = recherche exhaustive", () => {
    const f = generateMap(def("tmap_foret"), 42, margin);
    for (const s of f.structures.filter((x) => x.kind === "arbre_geant")) expect(s.h >= 70 && s.h <= 90).toBe(true);
    const w = generateMap(def("tmap_mur"), 42, margin);
    expect(w.structures.find((s) => s.kind === "mur")?.h).toBe(50);
    expect(groundAt(w, 100, 5)).toBe(50);
    const near = anchorsNear(f, 200, 150, 20, 50).map((a) => a.id).sort((a, b) => a - b);
    const brute = f.anchors.filter((a) => Math.hypot(a.x - 200, a.y - 150, a.z - 20) <= 50).map((a) => a.id);
    expect(near).toEqual(brute);
  });
});
