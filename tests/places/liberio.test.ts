import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PlaceSchema } from "../../src/data/placeSchema";
import type { Place } from "../../src/data/placeSchema";
import { AUTHORS } from "../../src/tools/places/auteur";
import { checkPlace, placeIds, readPlace } from "../../src/tools/places/check";
import { simPopulations } from "../../src/tools/places/population";
import { analyserCouverture, RATTACHEMENTS_MONDE } from "../../src/tools/places/couverture";

/**
 * C18 tranche 1 (docs/phases/C18.md) : zone d'internement de Liberio (MA03, T23), quartier clos de la ville marleyenne. Établi [C] : la zone
 * existe, quartier clos, nation de début de XXe siècle d'inspiration européenne. La simulation n'a pas de population par province du monde :
 * effectif `?` déclaré. Noms créés A et consignés (Q35, creations.md), tous les bâtiments (centre et quatre coins) sur une parcelle et dans le
 * périmètre, aucune création présentée comme canon, aucun nom de personnage de l'œuvre.
 */
const provs = simPopulations();
const INTERDIT = new RegExp(
  `\\b(${[
    "eren", "jaeger", "yeager", "carla", "grisha", "zeke", "mikasa", "ackerman", "armin", "arlert", "levi", "erwin", "smith", "hange", "zoe", "zoë", "reiner", "braun", "bertholdt", "bertolt", "hoover", "annie", "leonhart", "pieck", "finger", "falco", "grice", "gabi",
    "sasha", "braus", "connie", "springer", "jean", "kirstein", "historia", "ymir", "krista", "lenz", "marco", "bodt", "hannes", "pixis", "dot", "nile", "dok", "mike", "zacharias", "nanaba", "gelgar", "petra", "ral", "oluo", "bozado", "eld", "jinn", "gunther", "schultz", "auruo",
    "bossard", "rico", "brzenska", "kitz", "weilman", "keith", "shadis", "dina", "fritz", "kruger", "marlowe", "floch", "forster", "kenny", "uri", "rod", "frieda", "reiss", "kuklo", "flegel", "ilse", "mina", "carolina", "franz", "hannah", "thomas", "wagner", "samuel", "tom", "daz", "nack", "mylius",
    "boris", "lynne", "moblit", "berner", "hitch", "dreyse", "marlo", "freckles", "yelena", "willy", "tybur", "galliard", "magath", "onyankopon", "azumabito", "kiyomi", "mitabi", "pastor", "nicolo", "nicolas", "sannes", "gross", "conny", "lara", "cuirassé", "colossal", "colosse", "bestial", "slava", "charrette", "mâchoire", "assaillant", "fondateur", "attaque",
  ].join("|")})(?![\\p{L}])`,
  "iu",
);
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
const lu = (id: string): Place => {
  const { place } = readPlace(id);
  if (!place) throw new Error(`${id} illisible`);
  return place;
};
function nomsCrees(id: string): string[] {
  const p = lu(id);
  return [
    p.nom, p.libelle,
    ...p.rues.map((s) => s.nom), ...p.batiments.map((b) => b.nom), ...p.places_publiques.map((s) => s.nom), ...p.vegetation.parcs.map((k) => k.nom), ...p.quartiers.map((k) => k.nom),
    ...p.eau.voies.map((v) => v.nom), ...p.vegetation.isoles.flatMap((i) => (i.nom ? [i.nom] : [])), ...p.etats.map((s) => s.nom), ...p.points_de_vue.map((v) => v.nom),
  ];
}


const ID = "liberio";
const coins = (b: Place["batiments"][number]): Pt[] => {
  const [w, h] = b.emprise_m;
  const a = (b.angle_deg * Math.PI) / 180;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [b.position[0] + ((sx as number) * w) / 2 * Math.cos(a) - ((sy as number) * h) / 2 * Math.sin(a), b.position[1] + ((sx as number) * w) / 2 * Math.sin(a) + ((sy as number) * h) / 2 * Math.cos(a)] as Pt);
};

describe("C18 tranche 1 — Liberio : plan d'auteur, géométrie", () => {
  const place = lu(ID);
  it("énuméré, plan d'auteur, fichier identique au plan (regénération sans écart)", () => {
    expect(placeIds()).toContain(ID);
    expect(AUTHORS[ID]).toBeDefined();
    expect(place).toEqual(PlaceSchema.parse(JSON.parse(JSON.stringify(AUTHORS[ID]?.()))));
  });
  it("tous les bâtiments : centre et quatre coins sur une parcelle (îlot, place ou parc), centre dans le périmètre", () => {
    const polys = [...place.ilots.map((i) => i.polygone), ...place.places_publiques.map((i) => i.polygone), ...place.vegetation.parcs.map((i) => i.polygone)] as Pt[][];
    const hors = place.batiments.filter((b) => !dedans(b.position as Pt, place.perimetre as Pt[]) || coins(b).some((p) => !polys.some((q) => dedans(p, q)))).map((b) => b.id);
    expect(hors).toEqual([]);
    expect(place.batiments.length).toBeGreaterThanOrEqual(8);
  });
  it("les bâtiments ne se chevauchent pas", () => {
    const bs = place.batiments;
    const clash: string[] = [];
    for (let i = 0; i < bs.length; i++)
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i] as Place["batiments"][number];
        const b = bs[j] as Place["batiments"][number];
        const dx = Math.abs(a.position[0] - b.position[0]);
        const dy = Math.abs(a.position[1] - b.position[1]);
        if (dx < (a.emprise_m[0] + b.emprise_m[0]) / 2 && dy < (a.emprise_m[1] + b.emprise_m[1]) / 2 && (coins(a).some((p) => dedans(p, coins(b))) || coins(b).some((p) => dedans(p, coins(a))))) clash.push(`${a.id}/${b.id}`);
      }
    expect(clash).toEqual([]);
  });
});

describe("C18 tranche 1 — Liberio : population, taille de ville, canon", () => {
  const place = lu(ID);
  it("quartier clos sans enceinte de schéma : canon C, population `?` sans province (le monde n'a pas de population de simulation), orientation non posée", () => {
    expect(place.canon).toBe("C");
    expect(place.niveau).toBe("N1");
    expect(place.enceinte).toBeNull();
    expect(place.portes).toEqual([]);
    expect(place.province).toBeNull();
    expect(place.population.province).toBeNull();
    expect(place.population.canon).toBe("?");
    expect(place.population.valeur).toBeGreaterThan(0);
    expect(place.orientation.canon).not.toBe("C");
    expect(place.densite.classe).toBe("coeur");
    expect(Object.keys(provs).some((k) => /liberio/.test(k))).toBe(false);
  });
  it("surface bâtie = population ÷ densité à ±25 % ; ≥ 8 arbres/ha bâti ; parcs ≥ 20 arbres/ha", () => {
    const rep = checkPlace(ID, { docs: false, provinces: provs });
    expect(rep.errors).toEqual([]);
    const z = rep.metrics?.zones[0];
    expect(z?.population).toBe(place.population.valeur);
    expect(Math.abs(z?.ecart ?? 1)).toBeLessThanOrEqual(0.25);
    expect(z?.arbres_par_ha_bati ?? 0).toBeGreaterThanOrEqual(8);
    expect(rep.metrics?.parcs.length).toBe(3);
    for (const k of rep.metrics?.parcs ?? []) expect(k.par_ha).toBeGreaterThanOrEqual(20);
  });
  it("clôture : deux postes de garde de portail, quatre miradors, une place de marché avec halle, états 845 et 854", () => {
    const ids = place.batiments.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(["poste-du-portail-nord", "poste-du-portail-sud", "halle-du-marche", "chapelle-du-quartier", "dispensaire", "ecole-communale"]));
    expect(place.batiments.filter((b) => /^mirador-/.test(b.id) && b.archetype === "tour").length).toBe(4);
    expect(place.places_publiques.some((p) => p.id === "place-du-marche" && p.marche)).toBe(true);
    expect(place.etats.map((s) => s.id)).toEqual(["845-ordinaire", "854-nuit-du-raid"]);
    expect(place.etat_defaut).toBe("845-ordinaire");
    expect(place.etats[1]?.habitants).toBeLessThan(1);
  });
  it("rattachée à MA03 (wprov_liberio_internement) : la couverture la compte, et un seul lieu y est rattaché", () => {
    expect(RATTACHEMENTS_MONDE["wprov_liberio_internement"]).toBe(ID);
    const l = analyserCouverture().find((x) => x.id === "wprov_liberio_internement");
    expect(l?.code).toBe("MA03");
    expect(l?.lieux).toEqual([ID]);
  });
});

describe("C18 tranche 1 — Liberio : étiquettes de canon, noms, consignation", () => {
  it("seuls le lieu, la source du fait et l'état 854 portent C ; aucun bâtiment, rue, place, parc, quartier ni voie d'eau n'est C", () => {
    const p = lu(ID);
    expect(p.sources.filter((s) => s.canon === "C").length).toBe(1);
    expect(p.sources.some((s) => s.canon === "A" && /création C18/.test(s.ref))).toBe(true);
    for (const b of p.batiments) expect(b.canon, b.id).not.toBe("C");
    for (const s of p.rues) expect(s.canon).toBe("A");
    for (const s of p.places_publiques) expect(s.canon).toBe("A");
    for (const k of p.vegetation.parcs) expect(k.canon).toBe("A");
    for (const k of p.quartiers) expect(k.canon).toBe("A");
    const e854 = p.etats.find((s) => s.id === "854-nuit-du-raid");
    expect(e854?.canon).toBe("C");
    expect(e854?.sources.some((s) => s.canon === "C")).toBe(true);
    expect(e854?.sources.some((s) => s.canon === "A")).toBe(true);
    expect(p.etats.find((s) => s.id === "845-ordinaire")?.canon).toBe("A");
  });
  it("cohérence avec l'époque (début XXe d'inspiration européenne) : aucun archétype d'après-guerre, noms sans anachronisme", () => {
    const p = lu(ID);
    for (const b of p.batiments) expect(["usine", "atelier", "entrepot", "tour", "caserne", "clinique", "ecole", "halle", "chapelle", "hotel_de_ville"]).toContain(b.archetype);
    for (const n of nomsCrees(ID)) expect(n, n).not.toMatch(/\b(radio|télévision|béton armé|autoroute|cinéma|gratte-ciel|aéroport|supermarché)\b/iu);
  });
  it("aucun nom de personnage ni de terme de l'œuvre dans les noms créés", () => {
    for (const n of nomsCrees(ID)) expect(n, n).not.toMatch(INTERDIT);
  });
  it("la liste d'exclusion détecte bien les noms de l'œuvre, y compris accentués (preuve de la liste)", () => {
    for (const n of ["Rue Zeke", "Place Reiner", "Hôtel Annie", "Chemin Pieck", "Rue Falco", "Rue Zoë", "Quai Cuirassé", "Rue Tybur", "Rue Gabi", "Fort Slava"]) expect(n).toMatch(INTERDIT);
    expect("Rue des Rémouleurs").not.toMatch(INTERDIT);
    expect("Zone d'internement de Liberio").not.toMatch(INTERDIT);
  });
  it("creations.md (ligne `liberio`) et questions-ouvertes.md (Q35) consignés ; tableaux contigus", () => {
    expect(readFileSync("docs/lore/creations.md", "utf8")).toContain("| liberio : ");
    const q = readFileSync("docs/lore/questions-ouvertes.md", "utf8");
    expect(q).toContain("| Q35 |");
    expect(q).toContain("data/places/liberio.json");
    for (const f of ["docs/lore/questions-ouvertes.md", "docs/lore/creations.md"]) {
      const lignes = readFileSync(f, "utf8").split("\n");
      const premier = lignes.findIndex((l) => l.startsWith("|---"));
      const dernier = lignes.map((l, i) => (l.startsWith("|") ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
      for (let i = premier; i <= dernier; i++) expect(lignes[i]?.startsWith("|"), `${f} ligne ${i + 1}`).toBe(true);
    }
  });
  it("lore.md (étiquettes [C] [A] [?]), inspirations.md, plan.svg ; pas de mur-coupe.svg", () => {
    const lore = readFileSync(`docs/places/${ID}/lore.md`, "utf8");
    for (const t of ["[C]", "[A]", "[?]"]) expect(lore).toContain(t);
    expect(readFileSync(`docs/places/${ID}/inspirations.md`, "utf8").length).toBeGreaterThan(100);
    expect(readFileSync(`docs/places/${ID}/plan.svg`, "utf8")).toContain("<svg");
    expect(() => readFileSync(`docs/places/${ID}/mur-coupe.svg`)).toThrow();
  });
});
