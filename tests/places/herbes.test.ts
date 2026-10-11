import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Place } from "../../src/data/placeSchema";
import { MAX_WEEDS, weedSpots } from "../../src/render/tactical3d/places/weeds";
import { ABANDON_TINT } from "../../src/render/tactical3d/places/ground3d";
import { inside, polylineDist } from "../../src/render/tactical3d/places/geom";

/** Dette n° 9 : herbes des rues abandonnées (Shiganshina en 850 : `abandon` 0,85) ; aucune dans une ville entretenue. */
describe("herbes des rues abandonnées (dette n° 9)", () => {
  const shig = JSON.parse(readFileSync("data/places/shiganshina.json", "utf8")) as Place;
  const sample = { ...shig, rues: shig.rues.slice(0, 12), places_publiques: shig.places_publiques.slice(0, 2) };
  it("aucune touffe sans abandon ; sinon sur une chaussée ou une place, plus nombreuses à mesure que l'abandon avance", () => {
    expect(weedSpots(shig, 0, 5)).toEqual([]);
    const half = weedSpots(sample, 0.4, 5);
    const full = weedSpots(sample, 0.85, 5);
    expect(full.length).toBeGreaterThan(half.length * 1.8);
    for (const w of full) {
      const onStreet = sample.rues.some((r) => polylineDist([w.x, w.y], r.trace) <= r.largeur_m / 2);
      const onSquare = sample.places_publiques.some((q) => inside(q.polygone, [w.x, w.y]));
      expect(onStreet || onSquare).toBe(true);
    }
    expect(weedSpots(shig, 0.85, 5).length).toBeLessThanOrEqual(MAX_WEEDS);
    expect(weedSpots(sample, 0.85, 5)).toEqual(full);
  });
  it("l'état 850-reprise de Shiganshina est abandonné, les états de 845 non ; la teinte d'herbe des chaussées reste modérée", () => {
    const ab = Object.fromEntries(shig.etats.map((e) => [e.id, e.abandon]));
    expect(ab["850-reprise"]).toBeGreaterThan(0.5);
    expect([ab["845-avant"], ab["845-breche"]]).toEqual([0, 0]);
    expect(ABANDON_TINT).toBeLessThanOrEqual(0.5);
  });
});
