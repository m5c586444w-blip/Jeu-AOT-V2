import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { placeIds } from "../../src/tools/places/check";

/**
 * Couverture du mur Maria (C17, tranche 2) : le schéma de lieu ne modélise que des districts en saillie à deux portes sur le mur ; le mur
 * Maria est couvert par ses quatre districts (Shiganshina [C] au sud ; Quinta au nord, « District est » et « District ouest », `?`, Q1,
 * fichier 24 §3), chacun avec son tronçon de mur continu (ouest, centre, est) et ses portes ; l'atlas 06 §1.2 découpe le mur en huit
 * segments `A` (M01 à M08), dont quatre (nord-est, sud-est, sud-ouest, nord-ouest) n'ont pas de district : simple mur courant, sans lieu.
 * Les « tronçons de 64 m » du rendu sont des lots de dessin (`instances.ts`), pas des données de lieu : rien à compléter ici.
 */
type Pt = [number, number];
interface Trace { id: string; type: string; points?: Pt[]; canon: string }
interface Lieu {
  id: string;
  nom: string;
  canon: string;
  orientation: { valeur: string; canon: string };
  enceinte: { mur: string; traces: Trace[] } | null;
  portes: { id: string; role: string; canon: string; trace: string; s_m: number; passage: { largeur_m: number; hauteur_m: number } }[];
}
const lu = (id: string): Lieu => JSON.parse(readFileSync(`data/places/${id}.json`, "utf8")) as Lieu;
const DISTRICTS = placeIds().map(lu).filter((p) => p.enceinte?.mur === "maria");
const ATLAS: [string, string, string | null][] = [
  ["M01", "prov_maria_nord", "nord"], ["M02", "prov_maria_nord_est", null], ["M03", "prov_maria_est", "est"], ["M04", "prov_maria_sud_est", null],
  ["M05", "prov_maria_sud", "sud"], ["M06", "prov_maria_sud_ouest", null], ["M07", "prov_maria_ouest", "ouest"], ["M08", "prov_maria_nord_ouest", null],
];

describe("Mur Maria complet : quatre districts, huit segments d'atlas", () => {
  it("exactement quatre districts sur le mur Maria, un par point cardinal, Shiganshina seul établi [C]", () => {
    expect(DISTRICTS.map((d) => d.id).sort()).toEqual(["maria-district-2", "maria-district-3", "maria-district-4", "shiganshina"]);
    expect(DISTRICTS.map((d) => d.orientation.valeur).sort()).toEqual(["est", "nord", "ouest", "sud"]);
    for (const d of DISTRICTS) expect(d.canon === "C", d.id).toBe(d.id === "shiganshina");
    expect(DISTRICTS.find((d) => d.id === "shiganshina")?.orientation).toEqual({ valeur: "sud", canon: "C" });
    for (const d of DISTRICTS.filter((x) => x.id !== "shiganshina")) expect(d.orientation.canon, d.id).toBe("?");
  });
  it("chaque district a ses deux portes principales (extérieure sur la saillie, intérieure dans le mur) ; Shiganshina : portes [C]", () => {
    for (const d of DISTRICTS) {
      const roles = d.portes.filter((g) => g.role !== "riviere").map((g) => g.role).sort();
      expect(roles, d.id).toEqual(["exterieure", "interieure"]);
      for (const g of d.portes) {
        const t = d.enceinte?.traces.find((x) => x.id === g.trace);
        expect(t, `${d.id}/${g.id}`).toBeDefined();
        if (g.role !== "riviere") expect(g.passage.hauteur_m, `${d.id}/${g.id}`).toBeGreaterThan(g.passage.largeur_m);
      }
      expect(d.portes.find((g) => g.role === "exterieure")?.trace, d.id).toBe("saillie");
    }
    const s = DISTRICTS.find((d) => d.id === "shiganshina");
    for (const g of s?.portes.filter((x) => x.role !== "riviere") ?? []) expect(g.canon, g.id).toBe("C");
    for (const d of DISTRICTS.filter((x) => x.id !== "shiganshina")) for (const g of d.portes) expect(g.canon, `${d.id}/${g.id}`).toBe("A");
  });
  it("le tronçon de mur de chaque district est continu : ouest, centre, est se raccordent bout à bout sur l'axe", () => {
    for (const d of DISTRICTS) {
      const pts = (suffixe: string): Pt[] => (d.enceinte?.traces.find((t) => t.id.endsWith(suffixe))?.points ?? []) as Pt[];
      const ouest = pts("-ouest");
      const centre = pts("-centre");
      const est = pts("-est");
      expect(ouest.length, d.id).toBe(2);
      expect(centre.length, d.id).toBe(2);
      expect(est.length, d.id).toBe(2);
      expect(ouest[1], d.id).toEqual(centre[0]);
      expect(centre[1], d.id).toEqual(est[0]);
      expect((est[1] as Pt)[0] - (ouest[0] as Pt)[0], d.id).toBeGreaterThan(2500);
      expect(new Set([ouest, centre, est].flatMap((l) => l.map((p) => p[1]))), d.id).toEqual(new Set([0]));
    }
  });
  it("mur Maria : hauteur 50 m [C] dans _murs.json, utilisée par les quatre districts", () => {
    const m = JSON.parse(readFileSync("data/places/_murs.json", "utf8")) as { anneaux: { maria: { hauteur_m: { valeur: number; canon: string } } } };
    expect(m.anneaux.maria.hauteur_m).toMatchObject({ valeur: 50, canon: "C" });
    expect(DISTRICTS.length).toBe(4);
  });
  it("atlas 06 §1.2 : huit segments M01 à M08 existent dans les données ; les quatre cardinaux ont leur district, les quatre autres sont du mur courant sans lieu", () => {
    const provs = JSON.parse(readFileSync("data/provinces/paradis.json", "utf8")) as { id: string; atlas_code: string; region: string; wall?: string }[];
    for (const [code, id, ori] of ATLAS) {
      const p = provs.find((x) => x.id === id);
      expect(p?.atlas_code, id).toBe(code);
      expect(p?.region, id).toBe("mur_maria");
      expect(DISTRICTS.some((d) => d.orientation.valeur === ori), `${code} ${ori}`).toBe(ori !== null);
    }
    expect(provs.filter((x) => x.region === "mur_maria").length).toBe(8);
  });
  it("noms des districts non établis listés dans questions-ouvertes.md (Q1) et districts sans nom connu en `?`", () => {
    const q = readFileSync("docs/lore/questions-ouvertes.md", "utf8");
    for (const d of DISTRICTS.filter((x) => x.id !== "shiganshina")) {
      expect(q, d.id).toContain(d.id);
      expect(d.canon, d.id).toBe("?");
    }
    expect(q).toContain("| Q1 |");
  });
});
