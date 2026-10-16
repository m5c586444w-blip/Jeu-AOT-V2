import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyserCouverture, enMarkdown, manquantes, poiParCode, RATTACHEMENTS_MONDE, REGIONS, totaux } from "../../src/tools/places/couverture";
import { frozenIds, placeIds } from "../../src/tools/places/check";

/** C18 (cadrage) : cohérence de l'outil de couverture — pas de l'exhaustivité (les lieux manquants sont l'objet des tranches de C18). */
const lignes = analyserCouverture();
const atlas = JSON.parse(readFileSync("data/provinces/paradis.json", "utf8")) as { id: string }[];
const monde = JSON.parse(readFileSync("data/world_provinces/world.json", "utf8")) as { id: string }[];

describe("C18 — outil de couverture", () => {
  it("liste toutes les provinces de l'atlas et du monde, une fois chacune", () => {
    expect(lignes.length).toBe(atlas.length + monde.length);
    expect(new Set(lignes.map((l) => l.id)).size).toBe(lignes.length);
    for (const p of [...atlas, ...monde]) expect(lignes.some((l) => l.id === p.id), p.id).toBe(true);
    expect(atlas.length).toBe(74);
    expect(monde.length).toBe(61);
  });
  it("les totaux par région somment au total général et couvertes + manquantes = total", () => {
    const { parRegion, general } = totaux(lignes);
    expect(parRegion.map((t) => t.region)).toEqual([...REGIONS]);
    expect(parRegion.reduce((a, t) => a + t.total, 0)).toBe(general.total);
    expect(parRegion.reduce((a, t) => a + t.couvertes, 0)).toBe(general.couvertes);
    for (const t of [...parRegion, general]) expect(t.couvertes + t.manquantes).toBe(t.total);
    expect(general.total + general.sansObjet).toBe(lignes.length);
    expect(manquantes(lignes).length).toBe(general.manquantes);
  });
  it("les lieux cités existent, et chaque lieu fait couvre au moins une province ou un segment (hors îlots non rattachés connus)", () => {
    const existants = new Set([...placeIds(), ...frozenIds()]);
    for (const l of lignes) for (const id of l.lieux) expect(existants.has(id) || id.startsWith("_murs"), `${l.id} → ${id}`).toBe(true);
    const cites = new Set(lignes.flatMap((l) => l.lieux));
    const sansProvince = [...existants].filter((id) => !cites.has(id));
    // les trois districts de Maria portent le mur (segments), sans province `prov_…` propre
    expect(sansProvince.sort()).toEqual(["maria-district-2", "maria-district-3", "maria-district-4"]);
  });
  it("les rattachements du monde visent des provinces du monde et des lieux faits", () => {
    const existants = new Set(placeIds());
    for (const [prov, lieu] of Object.entries(RATTACHEMENTS_MONDE)) {
      expect(monde.some((m) => m.id === prov), prov).toBe(true);
      expect(existants.has(lieu), lieu).toBe(true);
    }
  });
  it("segments de mur couverts par _murs.json (22), provinces de Paradis lues dans la simulation, POI comptés", () => {
    const seg = lignes.filter((l) => l.nature === "segment");
    expect(seg.length).toBe(22);
    expect(seg.every((l) => l.lieux.length > 0)).toBe(true);
    expect(lignes.filter((l) => l.region === "Paradis (murs et anneaux)" || l.region === "Hors-murs").every((l) => l.population !== null)).toBe(true);
    const poi = poiParCode();
    expect(Object.values(poi).reduce((a, b) => a + b, 0)).toBe(17);
    expect(lignes.find((l) => l.code === "R01")?.poi).toBe(1);
  });
  it("le rapport Markdown contient les totaux et la ligne de chaque province ; le fichier du dépôt existe", () => {
    const md = enMarkdown(lignes);
    for (const l of lignes) expect(md).toContain(`| ${l.id} |`);
    expect(md).toContain(`**${totaux(lignes).general.total}**`);
    expect(existsSync("docs/reports/C18-couverture.md")).toBe(true);
  });
});
