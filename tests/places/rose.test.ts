import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUTHORS } from "../../src/tools/places/auteur";
import { checkPlace, placeIds, readPlace } from "../../src/tools/places/check";
import { popOf, simPopulations } from "../../src/tools/places/population";

/**
 * Mur Rose, tranche 1 de C15 : Trost et Karanes (docs/phases/C15.md).
 * - population lue de la simulation (scn_sandbox_845) pour la province correspondante ; surface bâtie = population ÷ densité à ±25 % ;
 * - arbres : ≥ 8/ha bâti, ≥ 20/ha sur parcs et faubourgs (CR1e-03, CR1e-04, déjà contrôlés par `maria.test.ts` pour tout lieu, repris ici) ;
 * - noms créés : étiquetés A, consignés dans `docs/lore/creations.md` ; questions ouvertes Q14 et Q15 ;
 * - faits canon : mur Rose, orientation, portes, état de brèche de 850 à Trost, aucune porte de rivière.
 */
const ROSE = [
  { id: "trost", province: "prov_trost", nom: "Trost", orientation: "sud", q: "Q14", gate: "Porte sud de Trost" },
  { id: "karanes", province: "prov_karanes", nom: "Karanes", orientation: "est", q: "Q15", gate: "Porte de Karanes" },
] as const;
const provs = simPopulations();

describe("C15 tranche 1 — Trost et Karanes", () => {
  it("les deux lieux sont énumérés par placeIds et ont un plan d'auteur", () => {
    for (const r of ROSE) {
      expect(placeIds()).toContain(r.id);
      expect(AUTHORS[r.id]).toBeDefined();
    }
  });
  for (const r of ROSE) {
    describe(r.id, () => {
      const { place } = readPlace(r.id);
      it("schéma valide, mur Rose, canon C, orientation établie, province de la simulation", () => {
        expect(place).not.toBeNull();
        if (!place) return;
        expect(place.nom).toBe(r.nom);
        expect(place.canon).toBe("C");
        expect(place.enceinte?.mur).toBe("rose");
        expect(place.orientation).toEqual({ valeur: r.orientation, canon: "C" });
        expect(place.province).toBe(r.province);
        expect(place.population.province).toBe(r.province);
      });
      it("population lue de la simulation (parts ≤ 1, somme ≤ 1) et surface bâtie à ±25 %", () => {
        const rep = checkPlace(r.id, { docs: false, provinces: provs });
        expect(rep.errors).toEqual([]);
        if (!place || !rep.metrics) throw new Error("lieu illisible");
        const pops = [place.population, ...place.zones.map((z) => z.population)];
        expect(pops.reduce((s, p) => s + p.part, 0)).toBeLessThanOrEqual(1 + 1e-9);
        expect(popOf(place.population, provs)).toBe(Math.round((provs[r.province] as number) * place.population.part));
        for (const z of rep.metrics.zones) {
          expect(z.population).toBeGreaterThan(4000);
          expect(Math.abs(z.ecart)).toBeLessThanOrEqual(0.25);
          expect(z.arbres_par_ha_bati).toBeGreaterThanOrEqual(8);
        }
        const fb = rep.metrics.zones.find((z) => z.classe === "faubourg");
        expect(fb?.arbres_ilots_par_ha ?? 99).toBeGreaterThanOrEqual(20);
        expect(rep.metrics.parcs.length).toBeGreaterThanOrEqual(3);
        for (const k of rep.metrics.parcs) expect(k.par_ha).toBeGreaterThanOrEqual(20);
      });
      it("deux portes (extérieure nommée d'après l'atlas, intérieure), aucune porte de rivière", () => {
        expect(place?.portes.map((g) => g.role)).toEqual(["exterieure", "interieure"]);
        expect(place?.portes[0]?.nom).toContain(r.gate);
        expect(place?.portes[0]?.canon).toBe("C");
      });
      it("noms créés : A, consignés dans creations.md ; question ouverte listée", () => {
        if (!place) throw new Error("lieu illisible");
        for (const s of place.rues) expect(s.canon, `${r.id} rue ${s.id}`).toBe("A");
        for (const s of place.places_publiques) expect(s.canon).toBe("A");
        for (const b of place.batiments) expect(["A", "C"]).toContain(b.canon);
        const creations = readFileSync("docs/lore/creations.md", "utf8");
        expect(creations).toContain(`| ${r.id} : noms de rues`);
        const q = readFileSync("docs/lore/questions-ouvertes.md", "utf8");
        expect(q).toContain(`| ${r.q} |`);
        expect(q).toContain(`data/places/${r.id}.json`);
      });
      it("dossier docs/places : lore.md, inspirations.md, plan.svg, mur-coupe.svg", () => {
        for (const f of ["lore.md", "inspirations.md", "plan.svg", "mur-coupe.svg"]) expect(existsSync(`docs/places/${r.id}/${f}`), f).toBe(true);
      });
      it("aucun nom canon connu de l'œuvre n'est utilisé pour une rue ou un bâtiment inventé", () => {
        if (!place) throw new Error("lieu illisible");
        const interdit = /\b(jaeger|yeager|ackerman|arlert|reiss|pixis|eren|mikasa|erwin|levi)\b/i;
        for (const n of [...place.rues.map((s) => s.nom), ...place.batiments.map((b) => b.nom), ...place.places_publiques.map((s) => s.nom)]) expect(n).not.toMatch(interdit);
      });
    });
  }
  it("Trost : quartier général et entrepôt de gaz, rue de l'Évacuation, états 845 / 850 brèche / 850 bouchée", () => {
    const { place } = readPlace("trost");
    expect(place?.batiments.some((b) => b.id === "quartier-general-garnison" && b.canon === "C")).toBe(true);
    expect(place?.batiments.some((b) => b.id === "entrepot-de-gaz")).toBe(true);
    expect(place?.rues.some((s) => s.nom === "Rue de l'Évacuation")).toBe(true);
    expect(place?.etats.map((s) => s.id)).toEqual(["845-avant", "850-breche", "850-bouchee"]);
    expect(place?.etats[1]?.portes["exterieure"]).toBe("brisee_845");
    expect(place?.etats[2]?.portes["exterieure"]).toBe("bouchee");
    expect(place?.etats[2]?.rochers.some((x) => x.rayon_m >= 10)).toBe(true);
  });
  it("Karanes : départ des expéditions (place des Départs, dépôt), états 845 et 850", () => {
    const { place } = readPlace("karanes");
    expect(place?.places_publiques.some((p) => p.id === "place-des-departs")).toBe(true);
    expect(place?.batiments.some((b) => b.id === "depot-des-expeditions")).toBe(true);
    expect(place?.etats.map((s) => s.id)).toEqual(["845-avant", "850-depart-expedition"]);
  });
});
