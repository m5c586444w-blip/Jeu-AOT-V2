import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PlaceSchema } from "../../src/data/placeSchema";
import { AUTHORS } from "../../src/tools/places/auteur";
import { checkPlace, placeIds, readPlace } from "../../src/tools/places/check";
import { popOf, simPopulations } from "../../src/tools/places/population";
import { area } from "../../src/render/tactical3d/places/geom";

/**
 * Mur Rose, tranche 2 de C15 (docs/phases/C15.md) : Utopia et Krolva (districts en saillie), camp d'entraînement du Corps
 * d'entraînement et quartier général de la Garnison (lieux sans enceinte).
 * - population lue de la simulation (scn_sandbox_845) pour la province correspondante ; surface bâtie = population ÷ densité à ±25 % ;
 * - arbres : ≥ 8/ha bâti, ≥ 20/ha sur parcs et faubourgs ; noms créés : A, consignés dans `docs/lore/creations.md` ; questions Q16 à Q19 ;
 * - cohérence du quartier général avec le repère posé dans `data/places/trost.json`.
 * Les tests de `rose.test.ts` (Trost, Karanes) ne sont pas modifiés.
 */
const provs = simPopulations();
const INTERDIT = /\b(jaeger|yeager|ackerman|arlert|reiss|pixis|eren|mikasa|erwin|levi|hannes|keith|shadis)\b/i;
const DISTRICTS = [
  { id: "utopia", province: "prov_utopia", nom: "Utopia", orientation: "nord", q: "Q16", gate: "Porte d'Utopia", pop: 34783 },
  { id: "krolva", province: "prov_krolva", nom: "Krolva", orientation: "ouest", q: "Q17", gate: "Porte de Krolva", pop: 34783 },
] as const;
const AUTRES = [
  { id: "camp-entrainement", province: "prov_camp_entrainement", nom: "Camp d'entraînement", q: "Q18" },
  { id: "qg-garnison", province: "prov_trost", nom: "Quartier général de la Garnison", q: "Q19" },
] as const;

function nomsCrees(id: string): string[] {
  const { place } = readPlace(id);
  if (!place) throw new Error(`${id} illisible`);
  return [...place.rues.map((s) => s.nom), ...place.batiments.map((b) => b.nom), ...place.places_publiques.map((s) => s.nom), ...place.vegetation.parcs.map((k) => k.nom)];
}

describe("C15 tranche 2 — lieux énumérés et plans d'auteur", () => {
  it("les quatre lieux sont énumérés par placeIds et ont un plan d'auteur", () => {
    for (const r of [...DISTRICTS, ...AUTRES]) {
      expect(placeIds()).toContain(r.id);
      expect(AUTHORS[r.id]).toBeDefined();
    }
  });
  it("le fichier de données est identique au plan d'auteur (regénération sans écart)", () => {
    for (const r of [...DISTRICTS, ...AUTRES]) {
      const fromAuthor = PlaceSchema.parse(JSON.parse(JSON.stringify(AUTHORS[r.id]?.())));
      expect(readPlace(r.id).place, r.id).toEqual(fromAuthor);
    }
  });
});

describe("C15 tranche 2 — districts Utopia et Krolva", () => {
  for (const r of DISTRICTS) {
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
      it("population lue de la simulation (province entière, parts ≤ 1) ; surface bâtie, arbres et parcs", () => {
        const rep = checkPlace(r.id, { docs: false, provinces: provs });
        expect(rep.errors).toEqual([]);
        if (!place || !rep.metrics) throw new Error("lieu illisible");
        expect(provs[r.province]).toBe(r.pop);
        const pops = [place.population, ...place.zones.map((z) => z.population)];
        expect(pops.reduce((s, p) => s + p.part, 0)).toBeLessThanOrEqual(1 + 1e-9);
        expect(popOf(place.population, provs)).toBe(Math.round(r.pop * place.population.part));
        expect(rep.metrics.zones.map((z) => z.classe)).toEqual(["coeur", "faubourg"]);
        for (const z of rep.metrics.zones) {
          expect(z.population).toBeGreaterThan(2000);
          expect(Math.abs(z.ecart)).toBeLessThanOrEqual(0.25);
          expect(z.arbres_par_ha_bati).toBeGreaterThanOrEqual(8);
        }
        expect(rep.metrics.zones[1]?.arbres_ilots_par_ha ?? 0).toBeGreaterThanOrEqual(20);
        expect(rep.metrics.parcs.length).toBeGreaterThanOrEqual(3);
        for (const k of rep.metrics.parcs) expect(k.par_ha).toBeGreaterThanOrEqual(20);
      });
      it("deux portes (extérieure nommée, intérieure), aucune porte de rivière ; nom de la porte étiqueté A", () => {
        expect(place?.portes.map((g) => g.role)).toEqual(["exterieure", "interieure"]);
        expect(place?.portes[0]?.nom).toContain(r.gate);
        expect(place?.portes[0]?.canon).toBe("A");
      });
      it("deux états (845 ordinaire, 850 afflux), sans destruction", () => {
        expect(place?.etats.map((s) => s.id)).toEqual(["845-avant", "850-afflux-des-evacues"]);
        for (const s of place?.etats ?? []) expect(s.ruines).toEqual([]);
      });
    });
  }
  it("Utopia : place de la Foire, Bourse des grains, halle aux grains", () => {
    const { place } = readPlace("utopia");
    expect(place?.places_publiques.some((p) => p.id === "place-de-la-foire" && p.marche)).toBe(true);
    for (const id of ["bourse-des-grains", "halle-aux-grains"]) expect(place?.batiments.some((b) => b.id === id)).toBe(true);
  });
  it("Krolva : place des Corporations, grande forge ; pas de départ d'expédition (la base reste Karanes)", () => {
    const { place } = readPlace("krolva");
    expect(place?.places_publiques.some((p) => p.id === "place-des-corporations")).toBe(true);
    expect(place?.batiments.some((b) => b.id === "grande-forge")).toBe(true);
    expect(place?.places_publiques.some((p) => /d[ée]part|exp[ée]dition/i.test(p.nom))).toBe(false);
    expect(readFileSync("data/scenarios/sandbox_845.json", "utf8")).toContain('"expedition_base": "prov_karanes"');
  });
});

describe("C15 tranche 2 — lieux sans enceinte (camp, quartier général)", () => {
  for (const r of AUTRES) {
    describe(r.id, () => {
      const { place } = readPlace(r.id);
      it("schéma valide, canon C (existence), sans enceinte ni porte, province de la simulation", () => {
        expect(place).not.toBeNull();
        if (!place) return;
        expect(place.nom).toBe(r.nom);
        expect(place.canon).toBe("C");
        expect(place.niveau).toBe("N1");
        expect(place.enceinte).toBeNull();
        expect(place.portes).toEqual([]);
        expect(place.province).toBe(r.province);
        expect(place.population.province).toBe(r.province);
        expect(place.population.part).toBeLessThan(0.2);
        expect(place.zones).toEqual([]);
      });
      it("population lue de la simulation, surface bâtie = population ÷ densité à ±25 %, arbres, parcs", () => {
        const rep = checkPlace(r.id, { docs: false, provinces: provs });
        expect(rep.errors).toEqual([]);
        if (!place || !rep.metrics) throw new Error("lieu illisible");
        const z = rep.metrics.zones[0];
        expect(rep.metrics.zones.length).toBe(1);
        expect(z?.population).toBe(Math.round((provs[r.province] as number) * place.population.part));
        expect(Math.abs(z?.ecart ?? 1)).toBeLessThanOrEqual(0.25);
        expect(z?.arbres_par_ha_bati ?? 0).toBeGreaterThanOrEqual(8);
        expect(rep.metrics.parcs.length).toBeGreaterThanOrEqual(1);
        for (const k of rep.metrics.parcs) expect(k.par_ha).toBeGreaterThanOrEqual(20);
      });
      it("noms créés : A, consignés dans creations.md ; question ouverte listée ; aucun nom de l'œuvre", () => {
        if (!place) throw new Error("lieu illisible");
        for (const s of place.rues) expect(s.canon, `${r.id} rue ${s.id}`).toBe("A");
        for (const s of place.places_publiques) expect(s.canon).toBe("A");
        for (const b of place.batiments) expect(["A", "C"]).toContain(b.canon);
        expect(readFileSync("docs/lore/creations.md", "utf8")).toContain(`| ${r.id} : noms de rues`);
        const q = readFileSync("docs/lore/questions-ouvertes.md", "utf8");
        expect(q).toContain(`| ${r.q} |`);
        expect(q).toContain(`data/places/${r.id}.json`);
        for (const n of nomsCrees(r.id)) expect(n).not.toMatch(INTERDIT);
      });
      it("au moins six vues, deux états, états par défaut connus", () => {
        expect(place?.points_de_vue.length).toBeGreaterThanOrEqual(6);
        expect(place?.etats.length).toBe(2);
        expect(place?.etats.some((s) => s.id === place?.etat_defaut)).toBe(true);
      });
    });
  }
  it("camp : emplacement non établi (?), champ de manœuvre > 5 000 m², dortoirs, bois d'entraînement, densité « village »", () => {
    const { place } = readPlace("camp-entrainement");
    expect(place?.orientation.canon).toBe("?");
    expect(place?.densite.classe).toBe("village");
    const champ = place?.places_publiques.find((p) => p.id === "champ-de-manoeuvre");
    expect(champ).toBeDefined();
    expect(area(champ?.polygone ?? [])).toBeGreaterThan(5000);
    expect(place?.batiments.filter((b) => b.id.startsWith("dortoir-")).length).toBe(4);
    expect(place?.vegetation.parcs.some((k) => k.id === "bois-d-entrainement")).toBe(true);
    expect(place?.sources.some((s) => s.canon === "?")).toBe(true);
    expect(place?.etats.map((s) => s.id)).toEqual(["845-ordinaire", "850-apres-la-promotion"]);
  });
  it("quartier général : bâtiment principal identique au repère de trost.json, rue de l'Évacuation, cour d'honneur", () => {
    const qg = readPlace("qg-garnison").place;
    const trost = readPlace("trost").place;
    const a = qg?.batiments.find((b) => b.id === "quartier-general-garnison");
    const b = trost?.batiments.find((x) => x.id === "quartier-general-garnison");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    if (!a || !b) return;
    expect(a.canon).toBe("C");
    for (const k of ["archetype", "emprise_m", "hauteur_m", "etages", "toit", "couverture", "facade", "teinte"] as const) expect(a[k], k).toEqual(b[k]);
    expect(qg?.rues.some((s) => s.nom === "Rue de l'Évacuation")).toBe(true);
    expect(trost?.rues.some((s) => s.nom === "Rue de l'Évacuation")).toBe(true);
    expect(qg?.places_publiques.some((p) => p.id === "cour-d-honneur")).toBe(true);
    expect(qg?.etats.map((s) => s.id)).toEqual(["845-avant", "850-alerte"]);
  });
  it("dossiers docs/places : lore.md, inspirations.md, plan.svg pour les quatre lieux (pas de mur-coupe sans enceinte)", () => {
    for (const r of [...DISTRICTS, ...AUTRES]) {
      for (const f of ["lore.md", "inspirations.md", "plan.svg"]) expect(existsSync(`docs/places/${r.id}/${f}`), `${r.id}/${f}`).toBe(true);
    }
    for (const r of DISTRICTS) expect(existsSync(`docs/places/${r.id}/mur-coupe.svg`), r.id).toBe(true);
    for (const r of AUTRES) expect(existsSync(`docs/places/${r.id}/mur-coupe.svg`), r.id).toBe(false);
  });
});
