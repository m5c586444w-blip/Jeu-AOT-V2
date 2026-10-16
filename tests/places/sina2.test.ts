import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PlaceSchema } from "../../src/data/placeSchema";
import { AUTHORS } from "../../src/tools/places/auteur";
import { checkPlace, placeIds, readPlace } from "../../src/tools/places/check";
import { simPopulations } from "../../src/tools/places/population";

/**
 * C16 tranche 2 (docs/phases/C16.md) : ville souterraine (sous Mitras, province distincte, population lue de la simulation) et chapelle
 * Reiss (petit lieu isolé, effectif `?` car la province n'a pas de population de simulation) ; noms créés A, consignés, Q26 et Q27 ;
 * tous les bâtiments (centre et quatre coins) sur une parcelle (îlot, place ou parc) ; aucune contradiction d'un fait C.
 */
const provs = simPopulations();
const INTERDIT = /\b(jaeger|yeager|ackerman|arlert|pixis|eren|mikasa|erwin|levi|hannes|keith|shadis|zackly|kenny|dok|nile|rod|frieda|grisha|historia|ymir|fritz)\b/i;
const IDS = ["ville-souterraine", "chapelle-reiss"] as const;
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
function nomsCrees(id: string): string[] {
  const { place } = readPlace(id);
  if (!place) throw new Error(`${id} illisible`);
  return [...place.rues.map((s) => s.nom), ...place.batiments.filter((b) => b.canon !== "C").map((b) => b.nom), ...place.places_publiques.map((s) => s.nom), ...place.vegetation.parcs.map((k) => k.nom), ...place.quartiers.map((k) => k.nom)];
}

describe("C16 tranche 2 — énumération et plans d'auteur", () => {
  it("les deux lieux sont énumérés et ont un plan d'auteur ; le fichier est identique au plan (regénération sans écart)", () => {
    for (const id of IDS) {
      expect(placeIds()).toContain(id);
      expect(AUTHORS[id]).toBeDefined();
      expect(readPlace(id).place, id).toEqual(PlaceSchema.parse(JSON.parse(JSON.stringify(AUTHORS[id]?.()))));
    }
  });
  it("tous les bâtiments : centre et quatre coins sur une parcelle (îlot, place ou parc), centre dans le périmètre", () => {
    for (const id of IDS) {
      const { place } = readPlace(id);
      if (!place) throw new Error(`${id} illisible`);
      const polys = [...place.ilots.map((i) => i.polygone), ...place.places_publiques.map((i) => i.polygone), ...place.vegetation.parcs.map((i) => i.polygone)] as Pt[][];
      const hors: string[] = [];
      for (const b of place.batiments) {
        const [w, h] = b.emprise_m;
        const [cx, cy] = b.position;
        const a = (b.angle_deg * Math.PI) / 180;
        const pts: Pt[] = [[cx, cy]];
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) pts.push([cx + (sx * w) / 2 * Math.cos(a) - (sy * h) / 2 * Math.sin(a), cy + (sx * w) / 2 * Math.sin(a) + (sy * h) / 2 * Math.cos(a)]);
        if (!dedans([cx, cy], place.perimetre as Pt[]) || pts.some((p) => !polys.some((q) => dedans(p, q)))) hors.push(b.id);
      }
      expect(hors, id).toEqual([]);
    }
  });
});

describe("C16 tranche 2 — ville souterraine", () => {
  const { place } = readPlace("ville-souterraine");
  it("schéma valide, canon C, sous Mitras (centre), sans enceinte ni porte, province de la simulation (population entière)", () => {
    expect(place?.nom).toBe("Ville souterraine");
    expect(place?.canon).toBe("C");
    expect(place?.orientation).toEqual({ valeur: "centre", canon: "C" });
    expect(place?.enceinte).toBeNull();
    expect(place?.portes).toEqual([]);
    expect(place?.province).toBe("prov_ville_souterraine");
    expect(place?.population.province).toBe("prov_ville_souterraine");
    expect(place?.population.part).toBe(1);
    expect(place?.population.province).not.toBe("prov_mitras");
    expect(place?.style).toBe("E08");
  });
  it("taille réaliste : surface bâtie = population ÷ densité à ±25 %, densité de ville dense, arbres et jardins", () => {
    const rep = checkPlace("ville-souterraine", { docs: false, provinces: provs });
    expect(rep.errors).toEqual([]);
    const z = rep.metrics?.zones[0];
    expect(provs["prov_ville_souterraine"]).toBe(34783);
    expect(z?.population).toBe(34783);
    expect(place?.densite.classe).toBe("coeur");
    expect(place?.densite.valeur).toBeGreaterThanOrEqual(230);
    expect(Math.abs(z?.ecart ?? 1)).toBeLessThanOrEqual(0.25);
    expect(z?.arbres_par_ha_bati ?? 0).toBeGreaterThanOrEqual(8);
    expect(rep.metrics?.parcs.length).toBe(3);
    for (const k of rep.metrics?.parcs ?? []) expect(k.par_ha).toBeGreaterThanOrEqual(20);
  });
  it("accès par escaliers et puits, marché noir, aucune voie d'eau de surface, ciel voilé (brumeux, enfumé), états 845 et 850 sans destruction", () => {
    for (const id of ["grand-escalier", "escalier-du-sud", "puits-escalier-de-l-ouest", "puits-escalier-de-l-est"]) expect(place?.batiments.find((b) => b.id === id)?.archetype, id).toBe("tour");
    expect(place?.batiments.some((b) => b.id === "halle-du-marche-noir" && b.reperes_canon.some((r) => r.includes("poi_marche_noir")))).toBe(true);
    expect(place?.places_publiques.some((p) => p.id === "place-du-marche-noir" && p.marche)).toBe(true);
    expect(place?.eau.voies).toEqual([]);
    expect(place?.etats.map((s) => s.id)).toEqual(["845-ordinaire", "850-coup-d-etat"]);
    expect(place?.etats.map((s) => s.ciel)).toEqual(["brumeux", "enfume"]);
    for (const s of place?.etats ?? []) {
      expect(s.ruines).toEqual([]);
      expect(s.incendies).toEqual([]);
    }
    expect(place?.vegetation.parcs.every((k) => /Puits de lumière/.test(k.nom))).toBe(true);
  });
  it("plus petite que Mitras (lieu situé dessous) ; noms créés A, consignés (Q26), aucun nom de personnage de l'œuvre", () => {
    const mitras = readPlace("mitras").place;
    expect((place?.etendue_m ?? 0) <= (mitras?.etendue_m ?? 0) + 1e-9).toBe(true);
    for (const s of place?.rues ?? []) expect(s.canon).toBe("A");
    for (const s of place?.places_publiques ?? []) expect(s.canon).toBe("A");
    expect(readFileSync("docs/lore/creations.md", "utf8")).toContain("| ville-souterraine : noms de galeries");
    const q = readFileSync("docs/lore/questions-ouvertes.md", "utf8");
    expect(q).toContain("| Q26 |");
    expect(q).toContain("data/places/ville-souterraine.json");
    for (const n of nomsCrees("ville-souterraine")) expect(n).not.toMatch(INTERDIT);
  });
});

describe("C16 tranche 2 — chapelle Reiss", () => {
  const { place } = readPlace("chapelle-reiss");
  it("schéma valide, canon C, province sans population de simulation : effectif `?` très faible, densité « ferme »", () => {
    expect(place?.nom).toBe("Chapelle Reiss");
    expect(place?.canon).toBe("C");
    expect(place?.province).toBe("prov_domaine_reiss");
    expect(provs["prov_domaine_reiss"]).toBe(0);
    expect(place?.population.province).toBeNull();
    expect(place?.population.canon).toBe("?");
    expect(place?.population.valeur ?? 0).toBeGreaterThan(0);
    expect(place?.population.valeur ?? 999).toBeLessThanOrEqual(60);
    expect(place?.densite.classe).toBe("ferme");
    expect(place?.enceinte).toBeNull();
    expect(place?.portes).toEqual([]);
    expect(place?.orientation).toEqual({ valeur: "aucune", canon: "?" });
    expect(place?.style).toBe("E23");
  });
  it("surface bâtie = effectif ÷ densité à ±25 %, arbres, bois", () => {
    const rep = checkPlace("chapelle-reiss", { docs: false, provinces: provs });
    expect(rep.errors).toEqual([]);
    const z = rep.metrics?.zones[0];
    expect(Math.abs(z?.ecart ?? 1)).toBeLessThanOrEqual(0.25);
    expect(z?.arbres_par_ha_bati ?? 0).toBeGreaterThanOrEqual(8);
    expect(rep.metrics?.parcs.length).toBeGreaterThanOrEqual(5);
    for (const k of rep.metrics?.parcs ?? []) expect(k.par_ha).toBeGreaterThanOrEqual(20);
  });
  it("chapelle de surface (création A : le canon décrit une chapelle souterraine, crypte non modélisée), dépendances, jardin clos, allée ; lieu isolé : aucune ville, une seule rue (l'allée), le reste en sentiers", () => {
    const ch = place?.batiments.find((b) => b.id === "chapelle");
    expect(ch?.archetype).toBe("chapelle");
    expect(ch?.canon).toBe("A");
    for (const id of ["logis-du-chapelain", "grange-du-domaine", "ecurie-du-domaine", "loge-du-gardien"]) expect(place?.batiments.some((b) => b.id === id && b.canon === "A"), id).toBe(true);
    expect(place?.vegetation.parcs.some((k) => k.id === "jardin-clos")).toBe(true);
    expect(place?.rues.some((s) => s.nom === "Allée du Domaine")).toBe(true);
    expect(place?.rues.filter((s) => s.type === "rue").every((s) => s.nom === "Allée du Domaine")).toBe(true);
    expect(place?.batiments.length).toBeLessThanOrEqual(12);
    expect(place?.etats.map((s) => s.id)).toEqual(["845-ordinaire", "850-domaine-retire"]);
  });
  it("noms créés A, consignés (Q27), aucun nom de personnage de l'œuvre ; ce lieu ne montre aucun secret", () => {
    for (const s of place?.rues ?? []) expect(s.canon).toBe("A");
    expect(readFileSync("docs/lore/creations.md", "utf8")).toContain("| chapelle-reiss : noms de chemins");
    const q = readFileSync("docs/lore/questions-ouvertes.md", "utf8");
    expect(q).toContain("| Q27 |");
    expect(q).toContain("data/places/chapelle-reiss.json");
    for (const n of nomsCrees("chapelle-reiss")) expect(n).not.toMatch(INTERDIT);
  });
});

describe("C16 tranche 2 — documents et tableaux Markdown", () => {
  it("lore.md, inspirations.md et plan.svg ; pas de mur-coupe.svg (aucune enceinte)", () => {
    for (const id of IDS) {
      for (const f of ["lore.md", "inspirations.md", "plan.svg"]) expect(existsSync(`docs/places/${id}/${f}`), `${id}/${f}`).toBe(true);
      expect(existsSync(`docs/places/${id}/mur-coupe.svg`)).toBe(false);
    }
  });
  it("questions-ouvertes.md et creations.md : tableaux contigus (aucune ligne vide entre deux lignes de tableau)", () => {
    for (const f of ["docs/lore/questions-ouvertes.md", "docs/lore/creations.md"]) {
      const lignes = readFileSync(f, "utf8").split("\n");
      const premier = lignes.findIndex((l) => l.startsWith("|---"));
      const dernier = lignes.map((l, i) => (l.startsWith("|") ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
      for (let i = premier; i <= dernier; i++) expect(lignes[i]?.startsWith("|"), `${f} ligne ${i + 1}`).toBe(true);
    }
  });
});
