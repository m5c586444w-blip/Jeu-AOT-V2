import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MapData } from "../../src/data/map";
import type { Province } from "../../src/data/schemas";
import { TerrainSchema } from "../../src/data/terrain";
import { bearingOf } from "../../src/sim/strategic/geometry";
import { buildLabels, drawingMap } from "../../src/ui/mapModel";

/**
 * MAP.4 : noms des segments de mur écrits dans la bande de leur mur ; les autres noms gardent leur ancre.
 */
const json = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const terrain = TerrainSchema.parse(json("data/map/terrain/paradis.json"));
const map = drawingMap(json<MapData>("data/map/paradis.json"), terrain);
const provinces = json<Province[]>("data/provinces/paradis.json");
const labels = buildLabels(map, provinces, terrain);

/** Rayon de la ligne médiane d'un mur au relèvement donné (même échantillonnage que le rendu). */
const wallRadius = (line: readonly (readonly number[])[], bearing: number): number => {
  const p = line[Math.round(bearing / (360 / line.length)) % line.length] ?? [0, 0];
  return Math.hypot(p[0] ?? 0, p[1] ?? 0);
};

describe("MAP — noms de la carte", () => {
  it("chaque segment de mur (hors districts) a son nom sur la ligne médiane du mur le plus proche", () => {
    const segments = provinces.filter((p) => p.kind === "segment");
    const along = labels.filter((l) => l.alongWall);
    expect(along.length).toBeGreaterThan(0);
    for (const l of along) {
      expect(segments.some((p) => p.id === l.id), `${l.id} est un segment`).toBe(true);
      const r = Math.hypot(l.at[0], l.at[1]);
      const b = bearingOf(l.at);
      const gaps = terrain.walls.map((w) => Math.abs(wallRadius(w.line, b) - r));
      expect(Math.min(...gaps), `${l.id} sur la ligne médiane`).toBeLessThan(0.5);
    }
  });

  it("les autres noms restent à leur ancre de dessin, et aucun n'est dupliqué", () => {
    for (const l of labels.filter((x) => !x.alongWall)) {
      const a = map.provinces[l.id]?.anchor ?? [0, 0];
      if (l.style === "capitale") continue; // Mitras : nom posé au-dessus du palais.
      expect(l.at, l.id).toEqual(a);
    }
    expect(new Set(labels.map((l) => l.id)).size).toBe(labels.length);
  });
});
