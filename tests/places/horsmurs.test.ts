import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PlaceSchema } from "../../src/data/placeSchema";
import type { Place } from "../../src/data/placeSchema";
import { AUTHORS } from "../../src/tools/places/auteur";
import { checkPlace, placeIds, readPlace } from "../../src/tools/places/check";
import { simPopulations } from "../../src/tools/places/population";

/**
 * C17 tranche 1 (docs/phases/C17.md) : lieux hors des murs de l'intérieur de Rose — Jinae (ville), Ragako (village, détruit en 850),
 * Dauper (village de chasse), château d'Utgard (abandonné, détruit en 850), forêt des Arbres Géants. Population lue de la simulation
 * (`?` déclarée quand la province est peuplée à 0), noms créés A et consignés (Q28 à Q32), tous les bâtiments (centre et quatre
 * coins) sur une parcelle, aucune création présentée comme canon, aucun nom de personnage de l'œuvre.
 */
const provs = simPopulations();
const IDS = ["jinae", "ragako", "dauper", "chateau-utgard", "foret-arbres-geants"] as const;
const INTERDIT = new RegExp(
  `\\b(${[
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
function nomsCrees(id: string): string[] {
  const p = lu(id);
  return [
    p.nom, p.libelle,
    ...p.rues.map((s) => s.nom), ...p.batiments.map((b) => b.nom), ...p.places_publiques.map((s) => s.nom), ...p.vegetation.parcs.map((k) => k.nom), ...p.quartiers.map((k) => k.nom),
    ...p.eau.voies.map((v) => v.nom), ...p.vegetation.isoles.flatMap((i) => (i.nom ? [i.nom] : [])), ...p.etats.map((s) => s.nom), ...p.points_de_vue.map((v) => v.nom),
  ];
}

describe("C17 tranche 1 — énumération, plans d'auteur, géométrie", () => {
  it("les cinq lieux sont énumérés, ont un plan d'auteur et un fichier identique au plan (regénération sans écart)", () => {
    for (const id of IDS) {
      expect(placeIds()).toContain(id);
      expect(AUTHORS[id]).toBeDefined();
      expect(readPlace(id).place, id).toEqual(PlaceSchema.parse(JSON.parse(JSON.stringify(AUTHORS[id]?.()))));
    }
  });
  it("tous les bâtiments : centre et quatre coins sur une parcelle (îlot, place ou parc), centre dans le périmètre", () => {
    for (const id of IDS) {
      const place = lu(id);
      const polys = [...place.ilots.map((i) => i.polygone), ...place.places_publiques.map((i) => i.polygone), ...place.vegetation.parcs.map((i) => i.polygone)] as Pt[][];
      const hors: string[] = [];
      for (const b of place.batiments) {
        const [w, h] = b.emprise_m;
        const [cx, cy] = b.position;
        const a = (b.angle_deg * Math.PI) / 180;
        const pts: Pt[] = [[cx, cy]];
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) pts.push([cx + ((sx * w) / 2) * Math.cos(a) - ((sy * h) / 2) * Math.sin(a), cy + ((sx * w) / 2) * Math.sin(a) + ((sy * h) / 2) * Math.cos(a)]);
        if (!dedans([cx, cy], place.perimetre as Pt[]) || pts.some((p) => !polys.some((q) => dedans(p, q)))) hors.push(b.id);
      }
      expect(hors, id).toEqual([]);
      expect(place.batiments.length, id).toBeGreaterThanOrEqual(8);
    }
  });
  it("les bâtiments ne se chevauchent pas (rectangles alignés ou tournés, marge nulle)", () => {
    const coins = (b: Place["batiments"][number]): Pt[] => {
      const [w, h] = b.emprise_m;
      const a = (b.angle_deg * Math.PI) / 180;
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [b.position[0] + ((sx as number) * w) / 2 * Math.cos(a) - ((sy as number) * h) / 2 * Math.sin(a), b.position[1] + ((sx as number) * w) / 2 * Math.sin(a) + ((sy as number) * h) / 2 * Math.cos(a)] as Pt);
    };
    for (const id of IDS) {
      const bs = lu(id).batiments;
      const pb = bs.map((b) => [b.id, coins(b)] as const);
      const clash: string[] = [];
      for (let i = 0; i < pb.length; i++)
        for (let j = i + 1; j < pb.length; j++) {
          const [ia, a] = pb[i] as readonly [string, Pt[]];
          const [ib, b] = pb[j] as readonly [string, Pt[]];
          const dx = Math.abs((bs[i] as Place["batiments"][number]).position[0] - (bs[j] as Place["batiments"][number]).position[0]);
          const dy = Math.abs((bs[i] as Place["batiments"][number]).position[1] - (bs[j] as Place["batiments"][number]).position[1]);
          const [wi, hi] = (bs[i] as Place["batiments"][number]).emprise_m;
          const [wj, hj] = (bs[j] as Place["batiments"][number]).emprise_m;
          if (dx < (wi + wj) / 2 && dy < (hi + hj) / 2 && (a.some((p) => dedans(p, b)) || b.some((p) => dedans(p, a)))) clash.push(`${ia}/${ib}`);
        }
      expect(clash, id).toEqual([]);
    }
  });
});

describe("C17 tranche 1 — Jinae", () => {
  const place = lu("jinae");
  it("ville du sud de l'intérieur de Rose : canon C, province de la simulation, sans enceinte, orientation sud", () => {
    expect(place.nom).toBe("Jinae");
    expect(place.canon).toBe("C");
    expect(place.province).toBe("prov_jinae");
    expect(place.population.province).toBe("prov_jinae");
    expect(place.population.part).toBeLessThanOrEqual(1);
    expect(place.orientation).toEqual({ valeur: "sud", canon: "C" });
    expect(place.enceinte).toBeNull();
    expect(place.portes).toEqual([]);
    expect(place.style).toBe("E10");
    expect(place.niveau).toBe("N1");
  });
  it("surface bâtie = population ÷ densité à ±25 %, arbres, parcs", () => {
    const rep = checkPlace("jinae", { docs: false, provinces: provs });
    expect(rep.errors).toEqual([]);
    const z = rep.metrics?.zones[0];
    expect(z?.population).toBe(provs["prov_jinae"]);
    expect(Math.abs(z?.ecart ?? 1)).toBeLessThanOrEqual(0.25);
    expect(z?.arbres_par_ha_bati ?? 0).toBeGreaterThanOrEqual(8);
    expect(z?.arbres_ilots_par_ha ?? 0).toBeGreaterThanOrEqual(20);
    expect(rep.metrics?.parcs.length).toBe(3);
    for (const k of rep.metrics?.parcs ?? []) expect(k.par_ha).toBeGreaterThanOrEqual(20);
  });
  it("ville de marché : place du Marché, halle aux grains, greniers, moulins, église, hôtel de ville, états 845 et 850 (évacuation)", () => {
    expect(place.places_publiques.some((p) => p.id === "place-du-marche" && p.marche)).toBe(true);
    for (const [id, arch] of [["halle-aux-grains", "halle"], ["grenier-communal", "grenier"], ["moulin-de-la-butte", "moulin"], ["eglise", "eglise"], ["hotel-de-ville", "hotel_de_ville"]] as const) expect(place.batiments.find((b) => b.id === id)?.archetype, id).toBe(arch);
    expect(place.etats.map((s) => s.id)).toEqual(["845-ordinaire", "850-evacuation"]);
    expect(place.etats[1]?.habitants).toBeLessThan(1);
    expect(place.etats[1]?.ruines).toEqual([]);
  });
});

describe("C17 tranche 1 — Ragako", () => {
  const place = lu("ragako");
  it("village du sud de l'intérieur de Rose : canon C, part de la province, densité village, surface = population ÷ densité", () => {
    expect(place.province).toBe("prov_ragako");
    expect(place.population.province).toBe("prov_ragako");
    expect(place.population.part).toBeGreaterThan(0);
    expect(place.population.part).toBeLessThan(1);
    expect(place.population.canon).toBe("A");
    expect(place.densite.classe).toBe("village");
    expect(place.orientation).toEqual({ valeur: "sud", canon: "C" });
    const rep = checkPlace("ragako", { docs: false, provinces: provs });
    expect(rep.errors).toEqual([]);
    const z = rep.metrics?.zones[0];
    expect(z?.population).toBe(Math.round((provs["prov_ragako"] ?? 0) * place.population.part));
    expect(Math.abs(z?.ecart ?? 1)).toBeLessThanOrEqual(0.25);
    expect(z?.arbres_par_ha_bati ?? 0).toBeGreaterThanOrEqual(8);
    expect(rep.metrics?.parcs.length).toBeGreaterThanOrEqual(5);
    for (const k of rep.metrics?.parcs ?? []) expect(k.par_ha).toBeGreaterThanOrEqual(20);
  });
  it("état 845 intact par défaut, état 850 détruit (canon : « détruit en 850 ») : ruines presque totales, incendies, plus d'habitants, aucun secret", () => {
    expect(place.etat_defaut).toBe("845-intact");
    expect(place.etats.map((s) => s.id)).toEqual(["845-intact", "850-detruit"]);
    const a = place.etats[0];
    const b = place.etats[1];
    expect(a?.ruines).toEqual([]);
    expect(a?.habitants).toBe(1);
    expect(b?.canon).toBe("C");
    expect(b?.habitants).toBe(0);
    expect(Math.max(...(b?.ruines ?? []).map((r) => r.part))).toBeGreaterThanOrEqual(0.9);
    expect((b?.incendies ?? []).length).toBeGreaterThanOrEqual(4);
    expect(b?.ciel).toBe("enfume");
    expect(place.batiments.some((x) => x.id === "eglise")).toBe(true);
    expect(place.eau.voies.some((v) => v.canon === "A")).toBe(true);
  });
});

describe("C17 tranche 1 — Dauper", () => {
  const place = lu("dauper");
  it("petit village de chasse : canon C, aucun lieu N2 préexistant (plan d'auteur), surface = population ÷ densité", () => {
    expect(existsSync("data/places/generated/dauper.json")).toBe(false);
    expect(place.province).toBe("prov_dauper");
    expect(place.population.part).toBeLessThan(1);
    expect(place.densite.classe).toBe("village");
    expect(place.orientation).toEqual({ valeur: "sud", canon: "C" });
    const rep = checkPlace("dauper", { docs: false, provinces: provs });
    expect(rep.errors).toEqual([]);
    const z = rep.metrics?.zones[0];
    expect(Math.abs(z?.ecart ?? 1)).toBeLessThanOrEqual(0.25);
    expect(z?.arbres_par_ha_bati ?? 0).toBeGreaterThanOrEqual(8);
    for (const k of rep.metrics?.parcs ?? []) expect(k.par_ha).toBeGreaterThanOrEqual(20);
  });
  it("village de chasse (ressource clé : chasse) : pavillon, chenil, fumoir, étal des peaux, bois ; plus petit que Ragako en population", () => {
    for (const id of ["pavillon-de-chasse", "chenil", "fumoir-et-sechoir", "etal-des-peaux", "poste-du-garde-chasse"]) expect(place.batiments.some((b) => b.id === id), id).toBe(true);
    expect(place.vegetation.parcs.filter((k) => /^Bois /.test(k.nom)).length).toBe(4);
    expect((place.population.valeur ?? 0) + Math.round((provs["prov_dauper"] ?? 0) * place.population.part)).toBeLessThan(Math.round((provs["prov_ragako"] ?? 0) * lu("ragako").population.part));
    expect(place.etats.every((s) => s.ruines.length === 0)).toBe(true);
  });
});

describe("C17 tranche 1 — château d'Utgard", () => {
  const place = lu("chateau-utgard");
  it("province peuplée à 0 : effectif `?` déclaré, densité « ferme », surface = effectif ÷ densité à ±25 %", () => {
    expect(place.province).toBe("prov_utgard");
    expect(provs["prov_utgard"]).toBe(0);
    expect(place.population.province).toBeNull();
    expect(place.population.canon).toBe("?");
    expect(place.population.valeur ?? 0).toBeGreaterThan(0);
    expect(place.densite.classe).toBe("ferme");
    expect(place.orientation).toEqual({ valeur: "aucune", canon: "?" });
    expect(place.enceinte).toBeNull();
    const rep = checkPlace("chateau-utgard", { docs: false, provinces: provs });
    expect(rep.errors).toEqual([]);
    const z = rep.metrics?.zones[0];
    expect(Math.abs(z?.ecart ?? 1)).toBeLessThanOrEqual(0.25);
    expect(z?.arbres_par_ha_bati ?? 0).toBeGreaterThanOrEqual(8);
    for (const k of rep.metrics?.parcs ?? []) expect(k.par_ha).toBeGreaterThanOrEqual(20);
  });
  it("château : donjon, tours, châtelet, cour, douves ; abandonné en 845 (C), détruit en 850 (C, étendue A), habitants nuls", () => {
    for (const [id, arch] of [["donjon", "donjon"], ["logis-seigneurial", "chateau"], ["chatelet-d-entree", "tour"], ["chapelle-du-chateau", "chapelle"]] as const) expect(place.batiments.find((b) => b.id === id)?.archetype, id).toBe(arch);
    expect(place.batiments.filter((b) => b.archetype === "tour").length).toBeGreaterThanOrEqual(4);
    expect(place.places_publiques.some((p) => p.id === "cour-d-honneur")).toBe(true);
    expect(place.eau.voies.some((v) => v.id === "douves" && v.canon === "A")).toBe(true);
    expect(place.etats.map((s) => s.id)).toEqual(["845-abandonne", "850-detruit"]);
    const [a, b] = place.etats;
    expect(a?.canon).toBe("C");
    expect(a?.abandon ?? 0).toBeGreaterThanOrEqual(0.4);
    expect(a?.ruines).toEqual([]);
    expect(b?.canon).toBe("C");
    expect(b?.habitants).toBe(0);
    expect(Math.max(...(b?.ruines ?? []).map((r) => r.part))).toBeGreaterThanOrEqual(0.9);
    expect((b?.incendies ?? []).length).toBeGreaterThanOrEqual(4);
    expect(b?.sources.some((s) => s.canon === "C" && /850/.test(s.ref))).toBe(true);
  });
});

describe("C17 tranche 1 — forêt des Arbres Géants", () => {
  const place = lu("foret-arbres-geants");
  it("province peuplée à 0 : effectif `?` déclaré ; zone bâtie = poste forestier seul, surface = effectif ÷ densité à ±25 %", () => {
    expect(place.province).toBe("prov_foret_arbres_geants");
    expect(provs["prov_foret_arbres_geants"]).toBe(0);
    expect(place.population.province).toBeNull();
    expect(place.population.canon).toBe("?");
    expect(place.orientation).toEqual({ valeur: "aucune", canon: "?" });
    expect(place.style).toBe("E14");
    const rep = checkPlace("foret-arbres-geants", { docs: false, provinces: provs });
    expect(rep.errors).toEqual([]);
    const z = rep.metrics?.zones[0];
    expect(Math.abs(z?.ecart ?? 1)).toBeLessThanOrEqual(0.25);
    expect(z?.arbres_par_ha_bati ?? 0).toBeGreaterThanOrEqual(8);
  });
  it("grande forêt d'arbres de ~80 m : essence `geant` (hauteurs 70 à 90 m), futaies d'au moins 300 ha, corridor et clairière", () => {
    const futaies = place.vegetation.parcs.filter((k) => /^Futaie/.test(k.nom));
    expect(futaies.length).toBe(4);
    for (const k of futaies) expect(k.essences.filter((e) => e === "geant").length).toBeGreaterThanOrEqual(3);
    const rep = checkPlace("foret-arbres-geants", { docs: false, provinces: provs });
    const ha = (rep.metrics?.parcs ?? []).filter((k) => /^futaie/.test(k.id)).reduce((s, k) => s + k.ha, 0);
    expect(ha).toBeGreaterThanOrEqual(300);
    for (const k of rep.metrics?.parcs ?? []) expect(k.par_ha).toBeGreaterThanOrEqual(20);
    const geants = (rep.layout?.trees ?? []).filter((t) => t.sp === "geant");
    expect(geants.length).toBeGreaterThan(1000);
    expect(Math.min(...geants.map((t) => t.h))).toBeGreaterThanOrEqual(70);
    expect(Math.max(...geants.map((t) => t.h))).toBeLessThanOrEqual(90);
    expect(place.points_de_vue.some((v) => v.id === "corridor")).toBe(true);
    expect(place.points_de_vue.some((v) => v.id === "clairiere")).toBe(true);
    expect(place.places_publiques.some((p) => p.id === "clairiere")).toBe(true);
    expect(place.rues.some((s) => s.id === "layon-du-corridor")).toBe(true);
  });
});

describe("C17 tranche 1 — étiquettes de canon, noms et consignation", () => {
  it("les lieux sont C (fait établi) ; aucune création de chantier n'est étiquetée C (bâtiments, rues, places, parcs, quartiers, eau)", () => {
    for (const id of IDS) {
      const p = lu(id);
      expect(p.canon, id).toBe("C");
      expect(p.sources.some((s) => s.canon === "A" && /création C17/.test(s.ref)), id).toBe(true);
      for (const b of p.batiments) expect(b.canon, `${id}/${b.id}`).not.toBe("C");
      for (const s of p.rues) expect(s.canon).toBe("A");
      for (const s of p.places_publiques) expect(s.canon).toBe("A");
      for (const k of p.vegetation.parcs) expect(k.canon).toBe("A");
      for (const k of p.quartiers) expect(k.canon).toBe("A");
      for (const v of p.eau.voies) expect(v.canon).toBe("A");
    }
  });
  it("aucun nom de personnage de l'œuvre dans les noms créés ; les lieux de l'œuvre gardent leur nom de fait", () => {
    for (const id of IDS) for (const n of nomsCrees(id)) expect(n, `${id} : ${n}`).not.toMatch(INTERDIT);
    expect(lu("jinae").nom).toBe("Jinae");
    expect(lu("chateau-utgard").nom).toBe("Château d'Utgard");
  });
  it("la liste d'exclusion détecte bien les noms de l'œuvre (preuve de la liste)", () => {
    for (const n of ["Rue Zeke", "Place Reiner", "Hôtel Annie", "Auberge Hange", "Chemin Pieck", "Rue Falco", "Pont Levi", "Rue Mikasa", "Quai Erwin", "Rue Historia"]) expect(n).toMatch(INTERDIT);
    expect("Rue des Meuniers").not.toMatch(INTERDIT);
  });
  it("creations.md (une ligne par lieu) et questions-ouvertes.md (Q28 à Q32) : consignés, tableaux contigus", () => {
    const c = readFileSync("docs/lore/creations.md", "utf8");
    for (const id of IDS) expect(c, id).toContain(`| ${id} : noms de `);
    const q = readFileSync("docs/lore/questions-ouvertes.md", "utf8");
    IDS.forEach((id, k) => {
      expect(q).toContain(`| Q${28 + k} |`);
      expect(q).toContain(`data/places/${id}.json`);
    });
    for (const f of ["docs/lore/questions-ouvertes.md", "docs/lore/creations.md"]) {
      const lignes = readFileSync(f, "utf8").split("\n");
      const premier = lignes.findIndex((l) => l.startsWith("|---"));
      const dernier = lignes.map((l, i) => (l.startsWith("|") ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
      for (let i = premier; i <= dernier; i++) expect(lignes[i]?.startsWith("|"), `${f} ligne ${i + 1}`).toBe(true);
    }
  });
  it("lore.md, inspirations.md, plan.svg ; pas de mur-coupe.svg (aucune enceinte) ; lore.md à jour (aucune mention « non posé »)", () => {
    for (const id of IDS) {
      for (const f of ["lore.md", "inspirations.md", "plan.svg"]) expect(existsSync(`docs/places/${id}/${f}`), `${id}/${f}`).toBe(true);
      expect(existsSync(`docs/places/${id}/mur-coupe.svg`)).toBe(false);
      expect(readFileSync(`docs/places/${id}/lore.md`, "utf8")).toMatch(/\[C\]/);
    }
  });
});
