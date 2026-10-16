import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Revue C15 (défaut 1, 4) : chaque bâtiment du mur Rose a son centre dans le périmètre bâti du lieu. */
type Pt = [number, number];
const dedans = ([x, y]: Pt, poly: Pt[]): boolean => {
  let c = false;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i] as Pt;
    const [x2, y2] = poly[(i + 1) % poly.length] as Pt;
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
};

describe("C15 : bâtiments dans l'enceinte", () => {
  for (const id of ["trost", "karanes", "utopia", "krolva", "camp-entrainement", "qg-garnison", "stohess", "orvud", "ehrmich", "yarckel", "mitras", "ville-souterraine", "chapelle-reiss", "jinae", "ragako", "dauper", "chateau-utgard", "foret-arbres-geants", "ferme-campagne", "fort-du-front"]) {
    it(`${id} : aucun bâtiment hors du périmètre`, () => {
      const d = JSON.parse(readFileSync(`data/places/${id}.json`, "utf8")) as { perimetre: Pt[]; batiments: { id: string; position: Pt }[] };
      expect(d.perimetre.length).toBeGreaterThanOrEqual(4);
      expect(d.batiments.length).toBeGreaterThan(5);
      expect(d.batiments.filter((b) => !dedans(b.position, d.perimetre)).map((b) => b.id)).toEqual([]);
    });
  }
});
