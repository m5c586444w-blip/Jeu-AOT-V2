import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PlaceSchema } from "../../src/data/placeSchema";
import { AUTHORS } from "../../src/tools/places/auteur";
import { checkPlace, placeIds, readPlace } from "../../src/tools/places/check";
import { popOf, simPopulations } from "../../src/tools/places/population";

/**
 * Mur Sina, C16 tranche 1 (docs/phases/C16.md) : Stohess, Orvud, Ehrmich, Yarckel (districts en saillie, orientations établies C) et Mitras
 * (capitale, sans enceinte propre).
 * - population lue de la simulation (scn_sandbox_845), jamais en dur ; surface bâtie = population ÷ densité à ±25 % ;
 * - arbres : ≥ 8/ha bâti, ≥ 20/ha sur parcs et faubourgs ; noms créés : A, consignés dans `docs/lore/creations.md` ; questions Q20 à Q25 ;
 * - cohérence avec les faits canon : orientations (nord Orvud, est Stohess, sud Ehrmich, ouest Yarckel), deux portes, pas de porte de rivière.
 * Le test « bâtiments dans l'enceinte » de `rose-enceinte.test.ts` couvre aussi ces cinq lieux.
 */
const provs = simPopulations();
const INTERDIT = /\b(jaeger|yeager|ackerman|arlert|reiss|pixis|eren|mikasa|erwin|levi|hannes|keith|shadis|zackly|kenny|dok|nile|rod)\b/i;
const DISTRICTS = [
  { id: "stohess", province: "prov_stohess", nom: "Stohess", orientation: "est", q: "Q21", gate: "Porte de Stohess", pop: 60870, etats: ["845-avant", "850-combat-de-stohess"] },
  { id: "orvud", province: "prov_orvud", nom: "Orvud", orientation: "nord", q: "Q22", gate: "Porte d'Orvud", pop: 34783, etats: ["845-avant", "850-orvud-ravage"] },
  { id: "ehrmich", province: "prov_ehrmich", nom: "Ehrmich", orientation: "sud", q: "Q23", gate: "Porte d'Ehrmich", pop: 34783, etats: ["845-avant", "850-afflux-des-evacues"] },
  { id: "yarckel", province: "prov_yarckel", nom: "Yarckel", orientation: "ouest", q: "Q24", gate: "Porte de Yarckel", pop: 34783, etats: ["845-avant", "850-afflux-des-evacues"] },
] as const;
const TOUS = [...DISTRICTS.map((d) => d.id), "mitras"] as const;

function nomsCrees(id: string): string[] {
  const { place } = readPlace(id);
  if (!place) throw new Error(`${id} illisible`);
  return [...place.rues.map((s) => s.nom), ...place.batiments.map((b) => b.nom), ...place.places_publiques.map((s) => s.nom), ...place.vegetation.parcs.map((k) => k.nom), ...place.quartiers.map((k) => k.nom)];
}

describe("C16 tranche 1 — lieux énumérés et plans d'auteur", () => {
  it("les cinq lieux sont énumérés par placeIds et ont un plan d'auteur", () => {
    for (const id of TOUS) {
      expect(placeIds()).toContain(id);
      expect(AUTHORS[id]).toBeDefined();
    }
  });
  it("le fichier de données est identique au plan d'auteur (regénération sans écart)", () => {
    for (const id of TOUS) {
      const fromAuthor = PlaceSchema.parse(JSON.parse(JSON.stringify(AUTHORS[id]?.())));
      expect(readPlace(id).place, id).toEqual(fromAuthor);
    }
  });
});

describe("C16 tranche 1 — districts du mur Sina", () => {
  for (const r of DISTRICTS) {
    describe(r.id, () => {
      const { place } = readPlace(r.id);
      it("schéma valide, mur Sina, canon C, orientation établie, province de la simulation", () => {
        expect(place).not.toBeNull();
        if (!place) return;
        expect(place.nom).toBe(r.nom);
        expect(place.canon).toBe("C");
        expect(place.enceinte?.mur).toBe("sina");
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
        expect(place?.portes.some((g) => /rivi[eè]re/i.test(g.nom))).toBe(false);
      });
      it("deux états (845 ordinaire, 850), identifiants attendus", () => {
        expect(place?.etats.map((s) => s.id)).toEqual(r.etats);
        expect(place?.etats.some((s) => s.id === place?.etat_defaut)).toBe(true);
      });
      it("noms créés : A, consignés dans creations.md ; question ouverte listée ; aucun nom de personnage de l'œuvre", () => {
        if (!place) throw new Error("lieu illisible");
        for (const s of place.rues) expect(s.canon, `${r.id} rue ${s.id}`).toBe("A");
        for (const s of place.places_publiques) expect(s.canon).toBe("A");
        for (const k of place.vegetation.parcs) expect(k.canon).toBe("A");
        for (const b of place.batiments) expect(["A", "C", "?"]).toContain(b.canon);
        expect(readFileSync("docs/lore/creations.md", "utf8")).toContain(`| ${r.id} : noms de rues`);
        const q = readFileSync("docs/lore/questions-ouvertes.md", "utf8");
        expect(q).toContain(`| ${r.q} |`);
        expect(q).toContain(`data/places/${r.id}.json`);
        for (const n of nomsCrees(r.id)) expect(n).not.toMatch(INTERDIT);
      });
      it("au moins six vues et plus de huit bâtiments repères", () => {
        expect(place?.points_de_vue.length).toBeGreaterThanOrEqual(6);
        expect(place?.batiments.length).toBeGreaterThan(8);
      });
    });
  }
  it("Stohess : Brigade militaire, prison de surface en « ? », grand canal avec quais et ponts, place du Commerce", () => {
    const { place } = readPlace("stohess");
    expect(place?.batiments.some((b) => b.id === "hotel-de-la-brigade" && b.canon === "A")).toBe(true);
    expect(place?.batiments.find((b) => b.id === "prison-de-la-brigade")?.canon).toBe("?");
    expect(place?.eau.voies.map((v) => [v.type, v.quais])).toEqual([["canal", true]]);
    expect(place?.eau.ponts.length).toBeGreaterThanOrEqual(4);
    expect(place?.rues.some((s) => s.nom === "Quai du Grand Canal" && s.type === "quai")).toBe(true);
    expect(place?.places_publiques.some((p) => p.id === "place-du-commerce" && p.marche)).toBe(true);
    expect(readFileSync("data/scenarios/sandbox_845.json", "utf8")).toMatch(/"prov_stohess": \{ "org": "military_police"/);
  });
  it("Orvud : l'état 850 est un ravage C (ruines étendues, incendies, abandon), le mur et les portes ne sont pas touchés", () => {
    const { place } = readPlace("orvud");
    const e = place?.etats.find((s) => s.id === "850-orvud-ravage");
    expect(e?.canon).toBe("C");
    expect(e?.ruines.length).toBeGreaterThanOrEqual(1);
    expect(e?.incendies.length).toBeGreaterThanOrEqual(3);
    expect(e?.abandon ?? 0).toBeGreaterThan(0.3);
    expect(e?.portes).toEqual({});
  });
  it("Ehrmich : pas de « quartier des nobles » (point d'intérêt de Mitras), théâtre ; Yarckel : halle des métiers, ressource artisanat", () => {
    const eh = readPlace("ehrmich").place;
    expect(eh?.quartiers.some((q) => /nobles/i.test(q.nom))).toBe(false);
    expect(eh?.batiments.some((b) => b.id === "theatre-d-ehrmich")).toBe(true);
    const ya = readPlace("yarckel").place;
    expect(ya?.batiments.some((b) => b.id === "halle-des-metiers")).toBe(true);
  });
});

describe("C16 tranche 1 — Mitras (capitale)", () => {
  const { place } = readPlace("mitras");
  it("schéma valide, canon C, centre, sans enceinte ni porte, province de la simulation (population entière)", () => {
    expect(place).not.toBeNull();
    if (!place) return;
    expect(place.nom).toBe("Mitras");
    expect(place.canon).toBe("C");
    expect(place.orientation).toEqual({ valeur: "centre", canon: "C" });
    expect(place.enceinte).toBeNull();
    expect(place.portes).toEqual([]);
    expect(place.province).toBe("prov_mitras");
    expect(place.population.province).toBe("prov_mitras");
    expect(place.population.part).toBe(1);
    expect(place.zones).toEqual([]);
  });
  it("taille réaliste : surface bâtie = population de prov_mitras ÷ densité à ±25 %, arbres et parcs", () => {
    const rep = checkPlace("mitras", { docs: false, provinces: provs });
    expect(rep.errors).toEqual([]);
    if (!place || !rep.metrics) throw new Error("lieu illisible");
    const z = rep.metrics.zones[0];
    expect(rep.metrics.zones.length).toBe(1);
    expect(provs["prov_mitras"]).toBe(95652);
    expect(z?.population).toBe(Math.round((provs["prov_mitras"] as number) * place.population.part));
    expect(Math.abs(z?.ecart ?? 1)).toBeLessThanOrEqual(0.25);
    expect(z?.arbres_par_ha_bati ?? 0).toBeGreaterThanOrEqual(8);
    expect(rep.metrics.parcs.length).toBeGreaterThanOrEqual(3);
    for (const k of rep.metrics.parcs) expect(k.par_ha).toBeGreaterThanOrEqual(20);
  });
  it("bâtiments repères : château royal, cathédrale, Cabinet, tribunal militaire ; Grande Avenue ; cour d'honneur et jardins", () => {
    for (const id of ["chateau-royal", "cathedrale", "hotel-du-cabinet", "tribunal-militaire", "hotel-de-la-police-militaire"]) expect(place?.batiments.some((b) => b.id === id && b.canon === "A"), id).toBe(true);
    expect(place?.batiments.find((b) => b.id === "chateau-royal")?.archetype).toBe("chateau");
    expect(place?.batiments.find((b) => b.id === "cathedrale")?.archetype).toBe("cathedrale");
    expect(place?.rues.some((s) => s.nom === "Grande Avenue" && s.type === "principale")).toBe(true);
    expect(place?.places_publiques.some((p) => p.id === "cour-d-honneur")).toBe(true);
    expect(place?.vegetation.parcs.some((k) => k.id === "jardins-du-chateau")).toBe(true);
    expect(place?.quartiers.some((q) => q.id === "quartier-des-nobles")).toBe(true);
  });
  it("noms créés : A, consignés dans creations.md ; Q25 listée ; aucun nom de personnage de l'œuvre ; états 845 et 850 (coup d'État)", () => {
    if (!place) throw new Error("lieu illisible");
    for (const s of place.rues) expect(s.canon, `rue ${s.id}`).toBe("A");
    expect(readFileSync("docs/lore/creations.md", "utf8")).toContain("| mitras : noms de rues");
    const q = readFileSync("docs/lore/questions-ouvertes.md", "utf8");
    expect(q).toContain("| Q25 |");
    expect(q).toContain("data/places/mitras.json");
    for (const n of nomsCrees("mitras")) expect(n).not.toMatch(INTERDIT);
    expect(place.etats.map((s) => s.id)).toEqual(["845-avant", "850-coup-d-etat"]);
  });
});

describe("C16 tranche 1 — documents et tableaux Markdown", () => {
  it("lore.md, inspirations.md, plan.svg pour les cinq lieux ; mur-coupe.svg seulement pour les districts", () => {
    for (const id of TOUS) for (const f of ["lore.md", "inspirations.md", "plan.svg"]) expect(existsSync(`docs/places/${id}/${f}`), `${id}/${f}`).toBe(true);
    for (const r of DISTRICTS) expect(existsSync(`docs/places/${r.id}/mur-coupe.svg`), r.id).toBe(true);
    expect(existsSync("docs/places/mitras/mur-coupe.svg")).toBe(false);
  });
  it("questions-ouvertes.md et creations.md : tableaux contigus (aucune ligne vide entre deux lignes de tableau)", () => {
    for (const f of ["docs/lore/questions-ouvertes.md", "docs/lore/creations.md"]) {
      const lignes = readFileSync(f, "utf8").split("\n");
      const premier = lignes.findIndex((l) => l.startsWith("|---"));
      const dernier = lignes.map((l, i) => (l.startsWith("|") ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
      expect(premier, f).toBeGreaterThan(0);
      for (let i = premier; i <= dernier; i++) expect(lignes[i]?.startsWith("|"), `${f} ligne ${i + 1}`).toBe(true);
    }
  });
});
