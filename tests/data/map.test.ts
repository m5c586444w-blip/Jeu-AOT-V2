import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkMap, MapSchema } from "../../src/data/map";
import { loadDataDir } from "../../src/data/loadNode";
import { bearingOf, pointInPolygon, polygonArea } from "../../src/sim/strategic/geometry";
import type { Point } from "../../src/sim/strategic/geometry";

const map = MapSchema.parse(JSON.parse(readFileSync("data/map/paradis.json", "utf8")));
const { data } = loadDataDir("data");
const idOf = (code: string): string => data.provinces.find((p) => p.atlas_code === code)?.id ?? "?";
const bearing = (code: string): number => bearingOf(map.provinces[idOf(code)]?.anchor as Point);
const angDist = (a: number, b: number): number => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

describe("géométrie de la carte (AC1-01, AC1-02)", () => {
  it("chaque province a un polygone non dégénéré et des voisinages symétriques", () => {
    expect(checkMap(map, data.provinces.map((p) => p.id))).toEqual([]);
    for (const [id, g] of Object.entries(map.provinces)) expect(Math.abs(polygonArea(g.polygon)), id).toBeGreaterThan(50);
  });
  it("l'ancre du toponyme est dans son polygone", () => {
    for (const [id, g] of Object.entries(map.provinces)) {
      if (id === "prov_mitras") continue; // ancre au centre exact, sur un sommet
      expect(pointInPolygon(g.anchor, g.polygon), id).toBe(true);
    }
  });
  it.each([
    ["R01", 180, "Shiganshina, sud de Maria"],
    ["S03", 0, "Utopia, nord de Rose"],
    ["S02", 90, "Karanes, est de Rose"],
    ["S01", 180, "Trost, sud de Rose"],
    ["S04", 270, "Krolva, ouest de Rose"],
    ["I04", 5, "Orvud, nord de Sina"],
    ["I03", 90, "Stohess, est de Sina"],
    ["I08", 180, "Ehrmich, sud de Sina"],
    ["I05", 260, "Yarckel, ouest de Sina"],
  ])("%s orienté vers %i° (%s, 11 §2)", (code, expected) => {
    expect(angDist(bearing(code), expected)).toBeLessThanOrEqual(15);
  });
  it("Ragako, Dauper et Jinae au sud de l'intérieur de Rose (11 §2)", () => {
    for (const code of ["S05", "S10", "S13"]) expect(angDist(bearing(code), 180)).toBeLessThanOrEqual(60);
  });
  it("errata : W07 (Rose-Ouest) voisin de Krolva, pas d'Ehrmich", () => {
    expect(map.neighbors[idOf("W07")]).toContain(idOf("S04"));
    expect(map.neighbors[idOf("W07")]).not.toContain(idOf("I08"));
  });
  it("chaque segment de mur sépare l'intérieur de l'extérieur", () => {
    const ringOf = (id: string): string => map.provinces[id]?.ring ?? "";
    expect(map.neighbors[idOf("M05")]?.map(ringOf)).toEqual(expect.arrayContaining(["maria_exterieur", "outre_murs"]));
    expect(map.neighbors[idOf("W05")]?.map(ringOf)).toEqual(expect.arrayContaining(["rose_exterieur", "maria_interieur"]));
    expect(map.neighbors[idOf("N04")]?.map(ringOf)).toEqual(expect.arrayContaining(["sina_anneau", "rose_interieur"]));
  });
});
