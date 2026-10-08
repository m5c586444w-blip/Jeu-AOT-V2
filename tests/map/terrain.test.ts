import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BIOME, TerrainSchema, decodeGrid } from "../../src/data/terrain";
import { renderTerrain } from "../../src/render/terrainRaster";
import { fnv1a } from "../../src/sim/core/hash";
import { pointInPolygon, polygonArea } from "../../src/sim/strategic/geometry";
import type { Point } from "../../src/sim/strategic/geometry";
import { generateTerrain, neighborDiff } from "../../src/tools/terrain/generate";
import type { ProvinceDef } from "../../src/tools/terrain/generate";
import type { Layout } from "../../src/tools/terrain/layout";

/**
 * MAP : carte réaliste figée (data/map/terrain/paradis.json).
 * CMAP-04 voisinage du dessin = voisinage des données ; CMAP-05 aucune province illisible ; CMAP-06 terrain reproductible.
 */
const json = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const raw = json<{ hash: string }>("data/map/terrain/paradis.json");
const terrain = TerrainSchema.parse(raw);
const map = json<{ neighbors: Record<string, string[]> }>("data/map/paradis.json");
const provinces = json<ProvinceDef[]>("data/provinces/paradis.json");
const kindOf = new Map(provinces.map((p) => [p.id, (p as { kind?: string }).kind]));

/** Aires minimales (km²) : à la vue d'ensemble en 1366×768 (~0,5 px/km), 2 500 km² font une tache d'environ 25 px de côté. */
const MIN_AREA_PROVINCE = 2500;
/** Segments de mur : bandes étroites, sélectionnées au zoom « province ». */
const MIN_AREA_SEGMENT = 1000;

describe("MAP — terrain figé", () => {
  it("le fichier respecte son schéma, porte version, graine et empreinte", () => {
    expect(terrain.version).toBe(1);
    expect(terrain.seed).toBe("paradis-v1");
    const { hash, ...body } = raw as { hash: string } & Record<string, unknown>;
    expect((fnv1a(JSON.stringify(body)) >>> 0).toString(16).padStart(8, "0")).toBe(hash);
  });

  it("chaque province des données a un polygone, une ancre et un emplacement de pion à l'intérieur (MAP.2, MAP.6)", () => {
    const ids = provinces.map((p) => p.id).sort();
    expect(Object.keys(terrain.provinces).sort()).toEqual(ids);
    for (const [id, p] of Object.entries(terrain.provinces)) {
      expect(pointInPolygon(p.anchor as Point, p.polygon as Point[]), `ancre de ${id}`).toBe(true);
      expect(pointInPolygon(p.pawn as Point, p.polygon as Point[]), `pion de ${id}`).toBe(true);
    }
  });

  it("CMAP-04 : le voisinage dessiné est exactement celui des données (aucune connexion inventée ni perdue)", () => {
    expect(neighborDiff(terrain.neighbors, map.neighbors)).toEqual([]);
  });

  it("CMAP-05 : aucune province illisible (aire minimale)", () => {
    const small = Object.entries(terrain.provinces)
      .map(([id, p]) => ({ id, area: Math.abs(polygonArea(p.polygon as Point[])), min: kindOf.get(id) === "segment" ? MIN_AREA_SEGMENT : MIN_AREA_PROVINCE }))
      .filter((r) => r.area < r.min);
    expect(small).toEqual([]);
  });

  it("chaque ville est dans sa province, chaque porte sur un segment de mur", () => {
    for (const town of terrain.towns) {
      const p = terrain.provinces[town.province];
      expect(p && pointInPolygon(town.at as Point, p.polygon as Point[]), `ville de ${town.province}`).toBe(true);
    }
    for (const gate of terrain.gates) expect(kindOf.get(gate.province)).toBe("segment");
  });

  it("les fleuves descendent : leur source est plus haute que leur embouchure", () => {
    const n = terrain.grid.n;
    const height = decodeGrid(terrain.height);
    const [x0, y0, x1] = terrain.bounds as [number, number, number, number];
    const cell = (x1 - x0) / n;
    const h = ([x, y]: Point): number => height[Math.min(n - 1, Math.max(0, Math.floor((y - y0) / cell))) * n + Math.min(n - 1, Math.max(0, Math.floor((x - x0) / cell)))] ?? 0;
    for (const r of terrain.rivers) expect(h(r.points[0] as Point)).toBeGreaterThanOrEqual(h(r.points[r.points.length - 1] as Point));
  });

  it("la forêt des Arbres Géants, des lacs, des marais et des falaises existent (MAP.1)", () => {
    const biome = decodeGrid(terrain.biome);
    const count = (b: number): number => biome.reduce((s, v) => s + (v === b ? 1 : 0), 0);
    for (const b of [BIOME.arbres_geants, BIOME.lac, BIOME.marais, BIOME.falaise, BIOME.foret, BIOME.montagne]) expect(count(b)).toBeGreaterThan(20);
    expect(terrain.islets.length).toBeGreaterThan(0);
  });

  it("l'image du relief se calcule sans DOM et montre terre et mer", () => {
    const img = renderTerrain(terrain, 96);
    expect(img.pixels.length).toBe(96 * 96 * 4);
    const corner = [img.pixels[0], img.pixels[1], img.pixels[2]];
    const o = (48 * 96 + 48) * 4;
    const center = [img.pixels[o], img.pixels[o + 1], img.pixels[o + 2]];
    expect(corner).not.toEqual(center);
    expect((corner[2] ?? 0) > (corner[0] ?? 0)).toBe(true);
  });

  it("CMAP-06 : la génération est déterministe et reproduit l'empreinte du fichier figé", { timeout: 120_000 }, () => {
    const layout = json<Layout>("data/map/paradis.layout.json");
    const body = generateTerrain(layout, provinces, map.neighbors);
    expect((fnv1a(JSON.stringify(body)) >>> 0).toString(16).padStart(8, "0")).toBe(raw.hash);
  });
});
