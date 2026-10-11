import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Place } from "../../src/data/placeSchema";
import { inhabitantSpots, MAX_INHABITANTS } from "../../src/render/tactical3d/places/inhabitants";
import { inside, polylineDist } from "../../src/render/tactical3d/places/geom";

/** Dette n° 6 : habitants des lieux, selon la part présente de l'état (rues et places ; aucun dans une ville évacuée). */
describe("habitants des lieux (dette n° 6)", () => {
  const ids = ["shiganshina", "maria-district-2", "maria-district-3", "maria-district-4"];
  const places = ids.map((id) => JSON.parse(readFileSync(`data/places/${id}.json`, "utf8")) as Place);
  it("aucun habitant pour une part nulle ; sinon, tous sur une chaussée ou une place, au plus 2 500", () => {
    for (const p of places) {
      expect(inhabitantSpots(p, 0, 7), p.id).toEqual([]);
      const spots = inhabitantSpots(p, 1, 7);
      expect(spots.length, p.id).toBeGreaterThan(300);
      expect(spots.length, p.id).toBeLessThanOrEqual(MAX_INHABITANTS);
      for (const s of spots) {
        const onStreet = p.rues.some((r) => polylineDist([s.x, s.y], r.trace) <= r.largeur_m / 2 + 1e-6);
        const onSquare = p.places_publiques.some((q) => inside(q.polygone, [s.x, s.y]));
        expect(onStreet || onSquare, `${p.id} (${s.x.toFixed(1)}, ${s.y.toFixed(1)})`).toBe(true);
      }
      // Même graine, mêmes places (rendu déterministe).
      expect(inhabitantSpots(p, 1, 7)).toEqual(spots);
    }
  });
  it("le nombre suit la part présente ; les états évacués de Shiganshina sont vides", () => {
    const shig = places[0] as Place;
    const full = inhabitantSpots({ ...shig, rues: shig.rues.slice(0, 20), places_publiques: shig.places_publiques.slice(0, 2) }, 1, 3).length;
    const half = inhabitantSpots({ ...shig, rues: shig.rues.slice(0, 20), places_publiques: shig.places_publiques.slice(0, 2) }, 0.5, 3).length;
    expect(half / full).toBeGreaterThan(0.4);
    expect(half / full).toBeLessThan(0.6);
    const byState = Object.fromEntries(shig.etats.map((e) => [e.id, inhabitantSpots(shig, e.habitants, 7).length]));
    console.log(`habitants de Shiganshina par état : ${JSON.stringify(byState)}`);
    for (const e of shig.etats) if (e.habitants === 0) expect(byState[e.id], e.id).toBe(0);
    expect(Math.max(...Object.values(byState))).toBeGreaterThan(0);
  });
});
