import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Place } from "../../src/data/placeSchema";
import { boatSpots, distanceToCanal, stallSpots } from "../../src/render/tactical3d/places/market";
import { layoutPlace } from "../../src/render/tactical3d/places/layout";
import { inside } from "../../src/render/tactical3d/places/geom";

/** Dette n° 12 : étals sur les places de marché, barques le long des quais ; rien dans une ville vide. */
describe("étals et barques des lieux (dette n° 12)", () => {
  const shig = JSON.parse(readFileSync("data/places/shiganshina.json", "utf8")) as Place;
  const layout = layoutPlace(shig, "845-avant");
  it("étals : seulement sur la place du marché, loin des bords, des arbres et des bâtiments repères ; aucun ville vide", () => {
    const stalls = stallSpots(shig, layout.trees, 1, 7);
    const market = shig.places_publiques.filter((q) => q.marche);
    console.log(`étals de Shiganshina : ${stalls.length} sur ${market.map((q) => q.id).join(", ")}`);
    expect(stalls.length).toBeGreaterThan(20);
    for (const s of stalls) {
      expect(market.some((q) => inside(q.polygone, [s.x, s.y]))).toBe(true);
      expect(layout.trees.every((t) => Math.hypot(t.x - s.x, t.y - s.y) >= 4)).toBe(true);
    }
    expect(stallSpots(shig, layout.trees, 0, 7)).toEqual([]);
    expect(stallSpots(shig, layout.trees, 1, 7)).toEqual(stalls);
  });
  it("barques : dans le canal, près d'un quai, loin des ponts ; aucune ville vide", () => {
    const boats = boatSpots(shig, 1, 7);
    console.log(`barques de Shiganshina : ${boats.length}`);
    expect(boats.length).toBeGreaterThan(5);
    const canal = shig.eau.voies[0];
    for (const b of boats) {
      const d = distanceToCanal(shig, [b.x, b.y]);
      expect(d).toBeLessThanOrEqual((canal?.largeur_m ?? 0) / 2 - 1);
      expect(d).toBeGreaterThan(3);
      for (const p of shig.eau.ponts) expect(Math.hypot(p.position[0] - b.x, p.position[1] - b.y)).toBeGreaterThan(p.longueur_m / 2 + 11);
    }
    expect(boatSpots(shig, 0, 7)).toEqual([]);
  });
});
