import { describe, expect, it } from "vitest";
import { terrainSpecFor } from "../../../src/render/tactical3d/envCountry";
import { area, centroid, insidePoly, nearestOnPath } from "../../../src/render/tactical3d/geom2";
import { profile } from "../../../src/render/tactical3d/styles";
import { generateTerrain, heightAt, slopeAt, terrainStats } from "../../../src/render/tactical3d/terrain";

/**
 * Terrain (R1b.2, CR1b-10) : relief par bruit, rivière au lit creusé et au niveau décroissant, lac, routes de terre en pente
 * douce, ponts, champs en patchwork hors de l'eau, haies, vergers en rangs, forêts, fermes. Densités tirées du profil E13.
 */
const spec = terrainSpecFor(profile("E13"), { farms: 7, roadVia: [{ x: 0, y: 0 }] });
const t = generateTerrain(850, spec);
const st = terrainStats(t);

describe("terrain par bruit (R1b.2)", () => {
  it("relief de collines : amplitude du profil (32 m), ni plat ni démesuré", () => {
    expect(spec.relief).toBe(32);
    expect(st["relief"]).toBeGreaterThan(0.5 * spec.relief);
    expect(st["relief"]).toBeLessThan(2 * spec.relief);
  });

  it("rivière : lit creusé sous le niveau de l'eau, niveau jamais croissant, berges au-dessus de l'eau", () => {
    expect(t.rivers).toHaveLength(1);
    const r = t.rivers[0];
    if (!r) return;
    for (let i = 1; i < r.level.length; i++) expect(r.level[i] as number).toBeLessThanOrEqual((r.level[i - 1] as number) + 1e-9);
    for (let i = 5; i < r.path.length - 5; i += 7) {
      const p = r.path[i];
      if (!p) continue;
      expect(heightAt(t.heights, p.x, p.y)).toBeLessThan((r.level[i] as number) - 0.5);
    }
  });

  it("lac : fond sous l'eau, loin de la rivière", () => {
    expect(t.lakes).toHaveLength(1);
    const l = t.lakes[0];
    if (!l) return;
    expect(heightAt(t.heights, l.center.x, l.center.y)).toBeLessThan(l.level);
    expect(nearestOnPath(t.rivers[0]?.path ?? [], l.center).d).toBeGreaterThan(l.radius);
  });

  it("routes de terre : une route principale et un chemin par ferme, pente douce (< 15 %), un pont sur la rivière", () => {
    expect(t.roads.filter((r) => r.kind === "route")).toHaveLength(1);
    expect(t.roads.filter((r) => r.kind === "chemin")).toHaveLength(t.farms.length);
    const main = t.roads[0];
    if (!main) return;
    const slopes = main.path.slice(4, -4).map((p) => slopeAt(t.heights, p.x, p.y));
    expect(slopes.filter((s) => s > 0.15).length / slopes.length).toBeLessThan(0.05);
    expect(t.bridges.length).toBeGreaterThanOrEqual(1);
  });

  it("champs en patchwork : beaucoup de parcelles, 5 cultures ou plus, aucune dans l'eau ni sur une route", () => {
    expect(st["parcels"]).toBeGreaterThan(150);
    expect(st["cropKinds"]).toBeGreaterThanOrEqual(5);
    const r = t.rivers[0];
    for (const p of t.parcels) {
      const c = centroid(p.poly);
      if (r) expect(nearestOnPath(r.path, c).d).toBeGreaterThan(r.width / 2);
      for (const l of t.lakes) expect(insidePoly(l.shape, c)).toBe(false);
      expect(Math.abs(area(p.poly))).toBeGreaterThan(400);
    }
    // Les parcelles sont des lanières : orientations variées d'une cellule à l'autre.
    expect(new Set(t.parcels.map((p) => Math.round((p.furrow % Math.PI) * 4))).size).toBeGreaterThan(6);
  });

  it("haies, vergers en rangs, forêts et arbres isolés, fermes", () => {
    expect(st["hedges"]).toBeGreaterThan(100);
    expect(st["orchards"]).toBeGreaterThan(5);
    const fruit = t.trees.filter((x) => x.kind === "fruitier");
    expect(fruit.length).toBeGreaterThan(300);
    expect(t.trees.filter((x) => x.kind === "feuillu" || x.kind === "conifere").length).toBeGreaterThan(2000);
    expect(t.farms).toHaveLength(7);
  });

  it("même graine = même terrain ; autre graine = autre terrain", () => {
    const again = generateTerrain(850, spec);
    expect(again.heights.h).toEqual(t.heights.h);
    expect(JSON.stringify(again.parcels)).toBe(JSON.stringify(t.parcels));
    const other = generateTerrain(851, spec);
    expect(other.heights.h[1000]).not.toBe(t.heights.h[1000]);
  });
});
