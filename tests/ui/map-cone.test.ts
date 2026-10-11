import { describe, expect, it } from "vitest";
import { CONE_SPREAD, CONE_START, uncertaintyCone } from "../../src/ui/mapRoutes";

/** F-STR-08 (09 §1) : cône d'incertitude des expéditions, étroit au départ, plus large au loin. */
describe("cône d'incertitude des expéditions", () => {
  it("polygone autour du trajet : largeur de départ, croissance avec la distance ; vide sans trajet", () => {
    const poly = uncertaintyCone([
      [0, 0],
      [100, 0],
    ]);
    expect(poly).toHaveLength(4);
    // Bord gauche puis bord droit au retour : départ à ±CONE_START, arrivée à ±(CONE_START + 100 × CONE_SPREAD).
    expect(poly[0]?.[1]).toBeCloseTo(CONE_START, 6);
    expect(poly[1]?.[1]).toBeCloseTo(CONE_START + 100 * CONE_SPREAD, 6);
    expect(poly[2]?.[1]).toBeCloseTo(-(CONE_START + 100 * CONE_SPREAD), 6);
    expect(poly[3]?.[1]).toBeCloseTo(-CONE_START, 6);
    expect(uncertaintyCone([[5, 5]])).toEqual([]);
  });
});
