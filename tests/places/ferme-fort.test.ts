import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PlaceSchema } from "../../src/data/placeSchema";
import type { Place } from "../../src/data/placeSchema";
import { AUTHORS } from "../../src/tools/places/auteur";
import { checkPlace, placeIds, readPlace } from "../../src/tools/places/check";
import { simPopulations } from "../../src/tools/places/population";

/**
 * C17 tranche 2 (docs/phases/C17.md) : ferme de campagne (plaines intérieures de Maria) et Fort du Front (Fort Avancé de Maria, R15 de
 * l'atlas 06). Aucun fait de ces lieux n'est établi [C] (R03, R07 et R15 sont `A` dans l'atlas) : les deux lieux et tous leurs éléments sont
 * `A`. Population lue de la simulation (parts déclarées), noms créés A et consignés (Q33, Q34, creations.md), tous les bâtiments (centre et
 * quatre coins) sur une parcelle et dans le périmètre, aucun nom de personnage de l'œuvre (liste étendue, bornes tolérant les accents).
 */
const provs = simPopulations();
const IDS = ["ferme-campagne", "fort-du-front"] as const;
const INTERDIT = new RegExp(
  `(?<![\\p{L}])(${[
    "eren", "jaeger", "yeager", "carla", "grisha", "zeke", "mikasa", "ackerman", "armin", "arlert", "levi", "erwin", "smith", "hange", "zoe", "zoë", "reiner", "braun", "bertholdt", "bertolt", "hoover", "annie", "leonhart", "pieck", "finger", "falco", "grice", "gabi",
    "sasha", "braus", "connie", "springer", "jean", "kirstein", "historia", "ymir", "krista", "lenz", "marco", "bodt", "hannes", "pixis", "dot", "nile", "dok", "mike", "zacharias", "nanaba", "gelgar", "petra", "ral", "oluo", "bozado", "eld", "jinn", "gunther", "schultz", "auruo",
    "bossard", "rico", "brzenska", "kitz", "weilman", "keith", "shadis", "dina", "fritz", "kruger", "marlowe", "floch", "forster", "kenny", "uri", "rod", "frieda", "reiss", "kuklo", "flegel", "ilse", "mina", "carolina", "franz", "hannah", "thomas", "wagner", "samuel", "tom", "daz", "nack", "mylius",
    "boris", "lynne", "moblit", "berner", "hitch", "dreyse", "marlo", "freckles", "yelena", "willy", "tybur", "galliard", "magath", "onyankopon", "azumabito", "kiyomi", "mitabi", "pastor", "nicolo", "nicolas", "sannes", "gross", "conny", "lara", "cuirassé", "colossal", "colosse", "bestial", "charrette", "mâchoire", "assaillant", "fondateur", "attaque",
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
const coins = (b: Place["batiments"][number]): Pt[] => {
  const [w, h] = b.emprise_m;
  const a = (b.angle_deg * Math.PI) / 180;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [b.position[0] + (((sx as number) * w) / 2) * Math.cos(a) - (((sy as number) * h) / 2) * Math.sin(a), b.position[1] + (((sx as number) * w) / 2) * Math.sin(a) + (((sy as number) * h) / 2) * Math.cos(a)] as Pt);
};
function nomsCrees(id: string): string[] {
  const p = lu(id);
  return [
    p.nom, p.libelle,
    ...p.rues.map((s) => s.nom), ...p.batiments.map((b) => b.nom), ...p.places_publiques.map((s) => s.nom), ...p.vegetation.parcs.map((k) => k.nom), ...p.quartiers.map((k) => k.nom),
    ...p.eau.voies.map((v) => v.nom), ...p.vegetation.isoles.flatMap((i) => (i.nom ? [i.nom] : [])), ...p.etats.map((s) => s.nom), ...p.points_de_vue.map((v) => v.nom),
  ];
}

describe("C17 tranche 2 — énumération, plans d'auteur, géométrie", () => {
  it("les deux lieux sont énumérés, ont un plan d'auteur et un fichier identique au plan (regénération sans écart)", () => {
    for (const id of IDS) {
      expect(placeIds()).toContain(id);
      expect(AUTHORS[id]).toBeDefined();
      expect(readPlace(id).place, id).toEqual(PlaceSchema.parse(JSON.parse(JSON.stringify(AUTHORS[id]?.()))));
    }
  });
  it("tous les bâtiments : centre et quatre coins sur une parcelle (îlot, place ou parc) ET dans le périmètre", () => {
    for (const id of IDS) {
      const place = lu(id);
      const polys = [...place.ilots.map((i) => i.polygone), ...place.places_publiques.map((i) => i.polygone), ...place.vegetation.parcs.map((i) => i.polygone)] as Pt[][];
      const hors: string[] = [];
      for (const b of place.batiments) {
        const pts: Pt[] = [b.position as Pt, ...coins(b)];
        if (pts.some((p) => !dedans(p, place.perimetre as Pt[])) || pts.some((p) => !polys.some((q) => dedans(p, q)))) hors.push(b.id);
      }
      expect(hors, id).toEqual([]);
    }
  });
  it("les rues restent dans le périmètre (extrémités) et les bâtiments ne se chevauchent pas", () => {
    for (const id of IDS) {
      const place = lu(id);
      const xs = (place.perimetre as Pt[]).map((q) => q[0]);
      const ys = (place.perimetre as Pt[]).map((q) => q[1]);
      const hors = place.rues.filter((r) => r.trace.some(([x, y]) => x < Math.min(...xs) - 0.5 || x > Math.max(...xs) + 0.5 || y < Math.min(...ys) - 0.5 || y > Math.max(...ys) + 0.5));
      expect(hors.map((r) => r.id), id).toEqual([]);
      const bs = place.batiments;
      const clash: string[] = [];
      for (let i = 0; i < bs.length; i++)
        for (let j = i + 1; j < bs.length; j++) {
          const a = bs[i] as Place["batiments"][number];
          const b = bs[j] as Place["batiments"][number];
          const ca = coins(a);
          const cb = coins(b);
          const croise = ca.some((p) => dedans(p, cb)) || cb.some((p) => dedans(p, ca)) || dedans(a.position as Pt, cb) || dedans(b.position as Pt, ca);
          if (croise) clash.push(`${a.id}/${b.id}`);
        }
      expect(clash, id).toEqual([]);
    }
  });
  it("aucune maison générée ne recouvre un bâtiment repère (ni l'inverse) : marge de lecture de la mise en place", () => {
    for (const id of IDS) expect(checkPlace(id, { docs: false, provinces: provs }).errors, id).toEqual([]);
  });
});

describe("C17 tranche 2 — ferme de campagne", () => {
  const place = lu("ferme-campagne");
  it("petit lieu N1, province agricole de la simulation, part déclarée A, surface = population ÷ densité ±25 %, ≥ 8 arbres/ha bâti", () => {
    expect(place.niveau).toBe("N1");
    expect(place.province).toBe("prov_plaines_interieures_maria_sud");
    expect(place.population.province).toBe("prov_plaines_interieures_maria_sud");
    expect(place.population.canon).toBe("A");
    expect(place.population.part).toBeLessThan(0.01);
    expect(place.densite.classe).toBe("ferme");
    const rep = checkPlace("ferme-campagne", { docs: false, provinces: provs });
    const z = rep.metrics?.zones[0];
    expect(z?.population).toBe(Math.round((provs["prov_plaines_interieures_maria_sud"] ?? 0) * place.population.part));
    expect(z?.population ?? 0).toBeGreaterThanOrEqual(10);
    expect(z?.population ?? 0).toBeLessThanOrEqual(40);
    expect(Math.abs(z?.ecart ?? 1)).toBeLessThanOrEqual(0.25);
    expect(z?.arbres_par_ha_bati ?? 0).toBeGreaterThanOrEqual(8);
    for (const k of rep.metrics?.parcs ?? []) expect(k.par_ha).toBeGreaterThanOrEqual(20);
  });
  it("corps de ferme, grange, étable, champs, verger, mare ; deux états (845 ordinaire, 845 évacuée) tous A", () => {
    for (const id of ["corps-de-ferme", "grange", "etable", "fournil", "pigeonnier"]) expect(place.batiments.some((b) => b.id === id), id).toBe(true);
    expect(place.batiments.find((b) => b.id === "corps-de-ferme")?.archetype).toBe("ferme");
    expect(place.batiments.find((b) => b.id === "grange")?.archetype).toBe("grange");
    expect(place.vegetation.parcs.filter((k) => /^Champs /.test(k.nom)).length).toBeGreaterThanOrEqual(3);
    expect(place.vegetation.parcs.some((k) => /^Verger/.test(k.nom))).toBe(true);
    expect(place.eau.voies.some((v) => /^Mare/.test(v.nom))).toBe(true);
    expect(place.etats.map((s) => s.id)).toEqual(["845-ordinaire", "845-evacuee"]);
    expect(place.etat_defaut).toBe("845-ordinaire");
    expect(place.etats.every((s) => s.canon === "A")).toBe(true);
    expect(place.etats[1]?.habitants).toBe(0);
    expect(place.etats[1]?.abandon ?? 0).toBeGreaterThan(0.3);
  });
});

describe("C17 tranche 2 — Fort du Front (Fort Avancé de Maria, R15)", () => {
  const place = lu("fort-du-front");
  it("province R15 de la simulation, garnison = part déclarée A, densité village, surface = population ÷ densité ±25 %", () => {
    expect(place.province).toBe("prov_fort_avance_maria");
    expect(place.population.province).toBe("prov_fort_avance_maria");
    expect(place.population.canon).toBe("A");
    expect(place.population.part).toBeLessThan(0.1);
    expect(place.orientation.canon).toBe("?");
    expect(place.enceinte).toBeNull();
    const rep = checkPlace("fort-du-front", { docs: false, provinces: provs });
    const z = rep.metrics?.zones[0];
    expect(z?.population).toBe(Math.round((provs["prov_fort_avance_maria"] ?? 0) * place.population.part));
    expect(Math.abs(z?.ecart ?? 1)).toBeLessThanOrEqual(0.25);
    expect(z?.arbres_par_ha_bati ?? 0).toBeGreaterThanOrEqual(8);
  });
  it("donjon-caserne, dépôt de gaz avancé, écuries, quatre tours d'angle et quatre bastions (remparts non modélisables : bâtiments)", () => {
    const arche = (id: string): string | undefined => place.batiments.find((b) => b.id === id)?.archetype;
    expect(arche("donjon-caserne")).toBe("donjon");
    expect(arche("depot-de-gaz-avance")).toBe("entrepot");
    expect(arche("ecuries-du-fort")).toBe("ecurie");
    expect(place.batiments.filter((b) => b.archetype === "tour").length).toBe(4);
    expect(place.batiments.filter((b) => b.archetype === "fort").length).toBe(4);
    expect(place.etats.map((s) => s.id)).toEqual(["845-ordinaire", "845-evacue"]);
    expect(place.etats.every((s) => s.canon === "A")).toBe(true);
  });
});

describe("C17 tranche 2 — étiquettes de canon, noms et consignation", () => {
  it("aucun élément n'est étiqueté C : ni lieu, ni bâtiment, rue, place, parc, quartier, eau, état, source", () => {
    for (const id of IDS) {
      const p = lu(id);
      expect(p.canon, id).toBe("A");
      expect(p.sources.some((s) => s.canon === "A" && /création C17/.test(s.ref)), id).toBe(true);
      expect(p.sources.filter((s) => s.canon === "C"), id).toEqual([]);
      for (const b of p.batiments) expect(b.canon, `${id}/${b.id}`).not.toBe("C");
      for (const s of p.rues) expect(s.canon).toBe("A");
      for (const s of p.places_publiques) expect(s.canon).toBe("A");
      for (const k of p.vegetation.parcs) expect(k.canon).toBe("A");
      for (const k of p.quartiers) expect(k.canon).toBe("A");
      for (const v of p.eau.voies) expect(v.canon).toBe("A");
    }
  });
  it("aucun nom de personnage de l'œuvre dans les noms créés (rues, bâtiments, places, parcs, quartiers, eau, arbres, états, vues)", () => {
    for (const id of IDS) for (const n of nomsCrees(id)) expect(n, `${id} : ${n}`).not.toMatch(INTERDIT);
  });
  it("la liste d'exclusion détecte bien les noms de l'œuvre, y compris accentués (preuve de la liste)", () => {
    for (const n of ["Rue Zeke", "Place Reiner", "Hôtel Annie", "Auberge Hange", "Chemin Pieck", "Rue Falco", "Pont Levi", "Rue Mikasa", "Quai Erwin", "Rue Historia", "Rue Zoë", "Quai Cuirassé", "Rue de la Charrette"]) expect(n).toMatch(INTERDIT);
    expect("Remise aux chariots").not.toMatch(INTERDIT);
    expect("Rue des Meuniers").not.toMatch(INTERDIT);
  });
  it("creations.md (une ligne par lieu) et questions-ouvertes.md (Q33, Q34) : consignés, tableaux contigus", () => {
    const c = readFileSync("docs/lore/creations.md", "utf8");
    for (const id of IDS) expect(c, id).toContain(`| ${id} : `);
    const q = readFileSync("docs/lore/questions-ouvertes.md", "utf8");
    IDS.forEach((id, k) => {
      expect(q).toContain(`| Q${33 + k} |`);
      expect(q).toContain(`data/places/${id}.json`);
    });
    for (const f of ["docs/lore/questions-ouvertes.md", "docs/lore/creations.md"]) {
      const lignes = readFileSync(f, "utf8").split("\n");
      const premier = lignes.findIndex((l) => l.startsWith("|---"));
      const dernier = lignes.map((l, i) => (l.startsWith("|") ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
      for (let i = premier; i <= dernier; i++) expect(lignes[i]?.startsWith("|"), `${f} ligne ${i + 1}`).toBe(true);
    }
  });
  it("lore.md (contient les étiquettes), inspirations.md, plan.svg ; pas de mur-coupe.svg (aucune enceinte)", () => {
    for (const id of IDS) {
      for (const f of ["lore.md", "inspirations.md", "plan.svg"]) expect(existsSync(`docs/places/${id}/${f}`), `${id}/${f}`).toBe(true);
      expect(existsSync(`docs/places/${id}/mur-coupe.svg`)).toBe(false);
      expect(readFileSync(`docs/places/${id}/lore.md`, "utf8")).toMatch(/\[A\]/);
    }
  });
});
