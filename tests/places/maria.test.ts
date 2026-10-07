import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUTHORS } from "../../src/tools/places/auteur";
import { checkPlace, placeIds } from "../../src/tools/places/check";

/**
 * Mur Maria (R1e.4–R1e.5) : CR1e-02 à CR1e-04 et CR1e-08 sur les lieux N1 écrits (`data/places/*.json`).
 * - chaque lieu passe la validation (schéma, renvois, population ÷ densité = surface bâtie à ±25 %, arbres) ; les captures sont
 *   contrôlées par `npm run places:valider` (dossiers docs), pas ici ;
 * - quatre districts du mur Maria : Shiganshina [C] et trois districts dont le nom n'est pas établi (`?`, Q1) ;
 * - portes de rivière seulement à Shiganshina (règle de R1c) ;
 * - chaque fichier est à jour de son plan d'auteur (pas de retouche à la main du JSON).
 */
const ids = placeIds();
const DISTRICTS = ["maria-district-2", "maria-district-3", "maria-district-4"];

describe("Lieux N1 : validation et métriques (CR1e-02 à CR1e-04)", () => {
  for (const id of ids) {
    it(`${id} : schéma, renvois, population ÷ densité, arbres`, () => {
      const r = checkPlace(id, { docs: false });
      for (const z of r.metrics?.zones ?? []) console.log(`${id} / ${z.zone} : bâti ${z.batie_ha.toFixed(1)} ha, cible ${z.cible_ha.toFixed(1)} ha (écart ${(z.ecart * 100).toFixed(1)} %), ${z.arbres_par_ha_bati.toFixed(1)} arbres/ha bâti`);
      expect(r.errors).toEqual([]);
    });
    it(`${id} : fichier identique au plan d'auteur`, () => {
      const author = AUTHORS[id];
      expect(author, `plan d'auteur de ${id}`).toBeDefined();
      if (!author) return;
      expect(JSON.parse(readFileSync(`data/places/${id}.json`, "utf8"))).toEqual(JSON.parse(JSON.stringify(author())));
    });
  }
});

describe("Mur Maria : quatre districts (CR1e-08)", () => {
  const places = ids.map((id) => JSON.parse(readFileSync(`data/places/${id}.json`, "utf8")) as { id: string; nom: string; libelle: string; canon: string; enceinte: { mur: string } | null; orientation: { canon: string }; population: { canon: string }; portes: { role: string }[] });
  const maria = places.filter((p) => p.enceinte?.mur === "maria");
  it("Shiganshina et trois autres districts sur le mur Maria", () => {
    expect(maria.map((p) => p.id).sort()).toEqual(["maria-district-2", "maria-district-3", "maria-district-4", "shiganshina"]);
    expect(maria.find((p) => p.id === "shiganshina")?.canon).toBe("C");
  });
  it("noms non établis : canon ?, libellé « nom non établi », orientation et population ?, listés dans questions-ouvertes.md", () => {
    const q = readFileSync("docs/lore/questions-ouvertes.md", "utf8");
    for (const id of DISTRICTS) {
      const p = maria.find((x) => x.id === id);
      expect(p, id).toBeDefined();
      if (!p) continue;
      expect(p.canon).toBe("?");
      expect(p.nom).toBe(id);
      expect(p.libelle).toBe("District du mur Maria (nom non établi)");
      expect(p.orientation.canon).toBe("?");
      expect(p.population.canon).toBe("?");
      expect(q).toContain(id.replace(/-\d$/, "-*"));
    }
  });
  it("portes de rivière seulement à Shiganshina", () => {
    for (const p of places) if (p.id !== "shiganshina") expect(p.portes.filter((g) => g.role === "riviere"), p.id).toEqual([]);
  });
});
