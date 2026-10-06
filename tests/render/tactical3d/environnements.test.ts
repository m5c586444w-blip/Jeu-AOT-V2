import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCESSORIES } from "../../../src/data/artSchemas";
import { generateEnvironment, envStats, supportedGenerators } from "../../../src/render/tactical3d/environment";
import { buildEnvironmentMeshes } from "../../../src/render/tactical3d/envMesh";
import { generateDistrict } from "../../../src/render/tactical3d/envTown";
import { GIANT_HEIGHT } from "../../../src/render/tactical3d/envNature";
import { ACCESSORY_RENDER, PROP_DEFS } from "../../../src/render/tactical3d/meshProps";
import { lodLevels, meshNames, sceneDigest } from "../../../src/render/tactical3d/rig";
import { LOTS, PROFILES, profile, styleDistance } from "../../../src/render/tactical3d/styles";
import { heightAt } from "../../../src/render/tactical3d/terrain";

/**
 * Environnements (R1b, CR1b-05, 09, 10, 14) : même graine = même environnement (données et géométrie), autre graine = autre ;
 * éléments attendus présents ; niveaux de détail et instanciation ; le générateur lit le profil (aucun style codé en dur).
 * `R1B_LOG=1` écrit `docs/reports/R1b-environnements.log`.
 */
const log: string[] = [];
const available = new Set(supportedGenerators());
const lot1 = LOTS[1].filter((id) => available.has(profile(id).generateur));
const lot2 = LOTS[2].filter((id) => available.has(profile(id).generateur));

describe("même graine = même environnement (R1b)", () => {
  it(`lot 1 (${lot1.length} environnements) : données identiques et empreinte de géométrie identique ; autre graine, autre environnement`, () => {
    expect(lot1).toHaveLength(9);
    for (const id of lot1) {
      const a = generateEnvironment(id, 850);
      const b = generateEnvironment(id, 850);
      expect(JSON.stringify(b), id).toBe(JSON.stringify(a));
      const ma = buildEnvironmentMeshes(a, { quality: "bas", textures: null });
      const mb = buildEnvironmentMeshes(b, { quality: "bas", textures: null });
      const da = sceneDigest(ma.group);
      const db = sceneDigest(mb.group);
      expect(db.hash, id).toBe(da.hash);
      const c = generateEnvironment(id, 851);
      const mc = buildEnvironmentMeshes(c, { quality: "bas", textures: null });
      const dc = sceneDigest(mc.group);
      expect(dc.hash, `${id} : graine 851`).not.toBe(da.hash);
      log.push(`${id} : empreinte ${da.hash} (graine 850, deux fois) ; ${dc.hash} (graine 851) ; ${da.meshes} maillages, ${da.vertices} sommets, ${da.instances} instances ; ${JSON.stringify(envStats(a))}`);
      for (const m of [ma, mb, mc]) m.dispose();
    }
  });
});

describe("même graine = même environnement, lot 2 (R1b)", () => {
  it("tous les générateurs sont disponibles : les 19 environnements du lot 2 et leurs variantes se construisent", () => {
    expect(lot2).toHaveLength(19);
    expect(new Set(supportedGenerators())).toEqual(new Set(PROFILES.map((p) => p.generateur)));
  });

  it("lot 2 : données identiques et empreinte de géométrie identique ; autre graine, autre environnement", { timeout: 240000 }, () => {
    for (const id of lot2) {
      const a = generateEnvironment(id, 850);
      const b = generateEnvironment(id, 850);
      expect(JSON.stringify(b), id).toBe(JSON.stringify(a));
      const ma = buildEnvironmentMeshes(a, { quality: "bas", textures: null });
      const mb = buildEnvironmentMeshes(b, { quality: "bas", textures: null });
      const da = sceneDigest(ma.group);
      expect(sceneDigest(mb.group).hash, id).toBe(da.hash);
      const c = generateEnvironment(id, 851);
      const mc = buildEnvironmentMeshes(c, { quality: "bas", textures: null });
      const dc = sceneDigest(mc.group);
      expect(dc.hash, `${id} : graine 851`).not.toBe(da.hash);
      log.push(`${id} : empreinte ${da.hash} (graine 850, deux fois) ; ${dc.hash} (graine 851) ; ${da.meshes} maillages, ${da.vertices} sommets, ${da.instances} instances ; ${JSON.stringify(envStats(a))}`);
      for (const m of [ma, mb, mc]) m.dispose();
      for (const v of profile(id).variantes) {
        const x = generateEnvironment(id, 850, v.id);
        expect(JSON.stringify(generateEnvironment(id, 850, v.id)), `${id}/${v.id}`).toBe(JSON.stringify(x));
      }
    }
  });
});

describe("contenu des environnements du lot 2", () => {
  const kinds = (e: ReturnType<typeof generateEnvironment>, k: string): number => e.props.filter((p) => p.kind === k).length;

  it("souterrains : ville sous une voûte percée de puits de jour, lanternes ; crypte voûtée à colonnes, bougies et autel ; cavernes de glace à lueurs", () => {
    const city = generateEnvironment("E08", 850);
    expect(city.cave?.kind).toBe("ville");
    expect(city.cave?.openings.length).toBeGreaterThanOrEqual(3);
    expect(city.shafts.length).toBe(city.cave?.openings.length);
    expect(city.buildings.length).toBeGreaterThan(150);
    expect(city.buildings.every((b) => Math.hypot(b.x, b.y) < (city.cave?.radius ?? 0))).toBe(true);
    expect(kinds(city, "lanternes")).toBeGreaterThan(100);
    const m = buildEnvironmentMeshes(city, { quality: "moyen", textures: null });
    expect(meshNames(m.group)).toEqual(expect.arrayContaining(["voute-roche", "rayons-lumiere", "lanternes-allumees"]));
    expect(m.counts["stalactites"]).toBeGreaterThan(50);
    m.dispose();
    const crypt = generateEnvironment("E23", 850);
    expect(crypt.terrain).toBeNull();
    expect(crypt.cave?.kind).toBe("crypte");
    expect(kinds(crypt, "colonnes")).toBe(14);
    expect(kinds(crypt, "bougies")).toBeGreaterThan(8);
    expect(crypt.landmarks.map((l) => l.kind)).toEqual(["autel"]);
    const mc = buildEnvironmentMeshes(crypt, { quality: "moyen", textures: null });
    expect(meshNames(mc.group)).toEqual(expect.arrayContaining(["crypte-voute", "crypte-dallage", "lanternes-allumees"]));
    mc.dispose();
    const ice = generateEnvironment("E21", 850, "cavernes");
    expect(ice.cave?.kind).toBe("glace");
    expect(kinds(ice, "lueurs")).toBeGreaterThan(40);
    expect(ice.buildings).toHaveLength(0);
    log.push(`E08 : ${city.buildings.length} maisons sous une voûte de ${city.cave?.radius} m, ${city.cave?.openings.length} puits, ${kinds(city, "lanternes")} lanternes ; E23 : nef ${kinds(crypt, "colonnes")} colonnes, ${kinds(crypt, "bougies")} bougies, autel ; E21 cavernes : ${kinds(ice, "lueurs")} lueurs`);
  });

  it("château d'Utgard : enceinte, tours, donjon ; détruit en 850 (ruine, feu) ; ville-usine : halles à sheds, cheminées, voie ferrée continue", () => {
    const c = generateEnvironment("E20", 850);
    expect(c.landmarks.map((l) => l.kind)).toEqual(["chateau", "donjon"]);
    const d = generateEnvironment("E20", 850, "ruines_850");
    expect(d.landmarks.every((l) => l.ruin > 0.6)).toBe(true);
    expect(d.fires.length).toBeGreaterThan(0);
    const f = generateEnvironment("E21", 850);
    expect(f.landmarks.filter((l) => l.kind === "usine")).toHaveLength(3);
    expect(kinds(f, "cheminees_usine")).toBe(3);
    const rails = f.props.filter((p) => p.kind === "rails").sort((a, b) => a.x - b.x);
    expect(rails.length).toBeGreaterThan(20);
    for (let i = 1; i < rails.length; i++) {
      expect((rails[i] as { x: number }).x - (rails[i - 1] as { x: number }).x).toBeCloseTo(9, 5);
      expect((rails[i] as { r: number }).r).toBe(0);
    }
  });

  it("ville agricole : palissade, église, deux moulins ; camps : tentes au cordeau ou serrées sans plan, fort avancé de pierre, mur de Rose et sa porte", () => {
    const v = generateEnvironment("E10", 850);
    expect(kinds(v, "palissade")).toBeGreaterThan(80);
    expect(v.landmarks.filter((l) => l.kind === "moulin")).toHaveLength(2);
    expect(v.landmarks.map((l) => l.kind)).toContain("eglise");
    const mil = generateEnvironment("E24", 850);
    expect(kinds(mil, "tentes")).toBeGreaterThan(100);
    expect(kinds(mil, "palissade")).toBeGreaterThan(100);
    const fort = generateEnvironment("E24", 850, "fort_avance");
    expect(fort.landmarks.map((l) => l.kind)).toContain("chateau");
    expect(kinds(fort, "palissade")).toBe(0);
    const ref = generateEnvironment("E25", 850);
    expect(kinds(ref, "tentes")).toBeGreaterThan(200);
    expect(kinds(ref, "charrettes")).toBeGreaterThan(20);
    expect(ref.wall?.paths[0]?.gates.map((g) => g.kind)).toEqual(["porte"]);
    log.push(`E10 : ${kinds(v, "palissade")} pans de palissade, ${v.buildings.length} maisons ; E24 : ${kinds(mil, "tentes")} tentes ; E25 : ${kinds(ref, "tentes")} tentes, ${ref.buildings.length} baraques, ${kinds(ref, "charrettes")} charrettes`);
  });

  it("nature : forêt dense (forêt morte en variante), montagne de plus de 100 m de relief, marais à roseaux et barques à flot, côte à pontons et embruns", () => {
    const fo = generateEnvironment("E15", 850);
    expect(fo.terrain?.trees.length).toBeGreaterThan(25000);
    expect(generateEnvironment("E15", 850, "foret_morte").terrain?.trees.filter((t) => t.kind === "mort").length).toBeGreaterThan(3000);
    const mo = generateEnvironment("E16", 850);
    const h = mo.terrain?.heights.h ?? new Float32Array(1);
    expect(Math.max(...h) - Math.min(...h)).toBeGreaterThan(100);
    expect(kinds(mo, "eboulis")).toBeGreaterThan(20);
    const wa = generateEnvironment("E17", 850);
    expect(wa.terrain?.marshLevel).not.toBeNull();
    expect(kinds(wa, "roseaux")).toBeGreaterThan(300);
    const river = wa.terrain?.rivers[0];
    for (const b of wa.props.filter((p) => p.kind === "barques")) {
      const lvl = river?.level[0] ?? 0;
      expect(b.z).toBeGreaterThan(lvl - 3);
      expect(b.z).toBeGreaterThan(heightAt(wa.terrain?.heights ?? { size: 1, n: 1, cell: 1, h: new Float32Array(1) }, b.x, b.y));
    }
    const co = generateEnvironment("E18", 850);
    const pont = co.props.filter((p) => p.kind === "pontons");
    expect(pont.length).toBe(3);
    for (const p of pont) expect(p.z).toBeCloseTo((co.terrain?.seaLevel ?? 0) - 0.3, 6);
    const mc = buildEnvironmentMeshes(co, { quality: "bas", textures: null });
    expect(meshNames(mc.group)).toContain("ecume");
    expect(mc.counts["spray"]).toBeGreaterThan(1000);
    mc.dispose();
  });

  it("fermes de Maria : une lisière d'Arbres Géants (≈ 80 m) borde les champs, sans champ ni ferme sous les géants", () => {
    const e = generateEnvironment("E28", 850);
    expect(e.giants.length).toBeGreaterThan(150);
    for (const g of e.giants) {
      expect(g.height).toBeGreaterThanOrEqual(GIANT_HEIGHT[0]);
      expect(g.height).toBeLessThanOrEqual(GIANT_HEIGHT[1]);
    }
    const edge = Math.max(...e.giants.map((g) => g.y));
    for (const b of e.buildings) expect(b.y).toBeGreaterThan(Math.min(...e.giants.map((g) => g.y)) + 60);
    expect(e.terrain?.parcels.length).toBeGreaterThan(20);
    expect(e.anchors.length).toBeGreaterThan(e.giants.length * 10);
    log.push(`E28 : lisière de ${e.giants.length} géants jusqu'à y = ${edge.toFixed(0)} m, ${e.terrain?.parcels.length} parcelles, ${e.buildings.length} bâtiments de ferme`);
  });

  it("glacis de Shiganshina : la saillie bombe vers le point de vue, sa porte extérieure à la distance du profil ; Titans nombreux en 845", () => {
    const e = generateEnvironment("E29", 850);
    const d = profile("E29").mur_visible.distance_m ?? 0;
    const arc = e.wall?.paths.find((w) => w.gates.some((g) => g.kind === "exterieure"));
    expect(arc).toBeDefined();
    const tip = (arc?.path ?? []).reduce((best, q) => (q.y > best.y ? q : best), { x: 0, y: -Infinity });
    expect(Math.abs(tip.x)).toBeLessThan(20);
    expect(-tip.y).toBeCloseTo(d, -1);
    expect(e.views.principale.eye[2]).toBeGreaterThan(tip.y);
    expect(generateEnvironment("E29", 850, "845").titans.length).toBeGreaterThan(10);
  });
});

describe("contenu des environnements du lot 1", () => {
  it("forêt des Arbres Géants : troncs de ≈ 80 m (± 10 %), voûte, points d'ancrage abondants, rayons de lumière, brume ; trois variantes", () => {
    const e = generateEnvironment("E14", 850);
    expect(e.giants.length).toBeGreaterThan(300);
    for (const g of e.giants) {
      expect(g.height).toBeGreaterThanOrEqual(72);
      expect(g.height).toBeLessThanOrEqual(88);
    }
    expect(GIANT_HEIGHT[0] + GIANT_HEIGHT[1]).toBe(160);
    expect(e.anchors.length).toBeGreaterThan(e.giants.length * 10);
    expect(e.shafts.length).toBeGreaterThan(15);
    expect(e.mist.density).toBeGreaterThan(0);
    const m = buildEnvironmentMeshes(e, { quality: "moyen", textures: null });
    const names = meshNames(m.group);
    for (const n of ["troncs-proches", "voute-proche", "rayons-lumiere", "brume-0"]) expect(names, n).toContain(n);
    expect(m.counts["crowns"]).toBeGreaterThan(e.giants.length * 5);
    const clearing = generateEnvironment("E14", 850, "clairiere");
    expect(clearing.giants.every((g) => Math.hypot(g.x, g.y) >= 120)).toBe(true);
    const edge = generateEnvironment("E14", 850, "lisiere");
    expect(edge.giants.length).toBeLessThan(e.giants.length * 0.75);
    expect(edge.terrain?.parcels.length).toBeGreaterThan(10);
    log.push(`E14 : ${e.giants.length} géants (${Math.min(...e.giants.map((g) => g.height)).toFixed(1)}–${Math.max(...e.giants.map((g) => g.height)).toFixed(1)} m), ${e.anchors.length} points d'ancrage, ${e.shafts.length} rayons, ${m.counts["crowns"]} masses de voûte ; clairière ${clearing.giants.length} géants, lisière ${edge.giants.length} géants et ${edge.terrain?.parcels.length} parcelles`);
    m.dispose();
  });

  it("territoire des Titans : ruines sans toit, charrettes abandonnées, végétation envahissante, Titans nombreux", () => {
    const e = generateEnvironment("E19", 850);
    const ruins = e.buildings.filter((b) => b.ruin > 0.55);
    expect(ruins.length / e.buildings.length).toBeGreaterThan(0.6);
    expect(ruins.every((b) => b.cover === "aucun")).toBe(true);
    expect(e.props.filter((p) => p.kind === "charrettes_abandonnees").length).toBeGreaterThanOrEqual(4);
    expect(e.props.filter((p) => p.kind === "herbes_hautes" || p.kind === "broussailles").length).toBeGreaterThan(300);
    expect(e.terrain?.trees.filter((t) => t.kind === "buisson").length).toBeGreaterThan(300);
    expect(e.titans.length).toBeGreaterThanOrEqual(8);
    expect(generateEnvironment("E19", 850, "titans").titans.length).toBeGreaterThan(e.titans.length);
    log.push(`E19 : ${ruins.length}/${e.buildings.length} ruines sans toit, ${e.props.filter((p) => p.kind === "charrettes_abandonnees").length} charrettes, ${e.titans.length} Titans (variante « Titans nombreux » : ${generateEnvironment("E19", 850, "titans").titans.length})`);
  });

  it("villes : repères du profil (église, marché, casernes, grand édifice, cathédrale, palais), canaux et ponts, rues de largeurs différentes", () => {
    const kinds = (id: string): string[] => generateEnvironment(id, 850).landmarks.map((l) => l.kind);
    expect(kinds("E01")).toContain("eglise");
    expect(kinds("E02")).toEqual(expect.arrayContaining(["eglise", "caserne", "halle", "edifice"]));
    expect(kinds("E05")).toContain("edifice");
    expect(kinds("E06")).toEqual(expect.arrayContaining(["cathedrale", "palais"]));
    expect(generateEnvironment("E05", 850).canals.length).toBe(1);
    expect(generateEnvironment("E06", 850).canals.length).toBe(2);
    expect(generateEnvironment("E06", 850).stoneBridges.length).toBeGreaterThan(10);
    expect(generateEnvironment("E01", 850).canals).toHaveLength(0);
  });

  it("qualité haute : végétation instanciée en tuiles à trois niveaux de détail ; plus d'instances en haute qu'en basse", () => {
    const e = generateEnvironment("E13", 850);
    const hi = buildEnvironmentMeshes(e, { quality: "haut", textures: null });
    const lo = buildEnvironmentMeshes(e, { quality: "bas", textures: null });
    const lods = lodLevels(hi.group);
    expect(lods.length).toBeGreaterThan(8);
    for (const l of lods) {
      expect(l.levels).toBe(3);
      expect(l.distances[1]).toBe(520);
      expect(l.distances[2]).toBe(2400);
    }
    const hiTrees = Object.entries(hi.counts).filter(([k]) => k.startsWith("arbres-")).reduce((s, [, v]) => s + v, 0);
    const loTrees = Object.entries(lo.counts).filter(([k]) => k.startsWith("arbres-")).reduce((s, [, v]) => s + v, 0);
    expect(hiTrees).toBe(e.terrain?.trees.length);
    expect(loTrees).toBeLessThan(hiTrees * 0.45);
    log.push(`E13 : ${lods.length} tuiles LOD (3 niveaux : 0 / 520 / 2400 m en haute) ; arbres instanciés : haute ${hiTrees}, basse ${loTrees}`);
    hi.dispose();
    lo.dispose();
  });
});

describe("le générateur lit le profil (aucun style codé en dur)", () => {
  it("changer la teinte du toit, la part des couvertures ou la densité change la ville produite", () => {
    const p = profile("E01");
    const base = generateDistrict(p, null, 850, 0);
    const recolored = generateDistrict({ ...p, palette: { ...p.palette, toit: "#204080" } }, null, 850, 0);
    expect(base.buildings.filter((b) => b.cover === "tuiles_rouges").every((b) => b.roofHex === p.palette.toit)).toBe(true);
    expect(recolored.buildings.filter((b) => b.cover === "tuiles_rouges").every((b) => b.roofHex === "#204080")).toBe(true);
    const slate = generateDistrict({ ...p, toits: { ardoise: 1 } }, null, 850, 0);
    expect(slate.buildings.every((b) => b.cover === "ardoise")).toBe(true);
    const sparse = generateDistrict({ ...p, densite: 0.2 }, null, 850, 0);
    expect(sparse.buildings.length).toBeLessThan(base.buildings.length * 0.85);
    // Parts réalisées contre parts déclarées : écart de variation totale < 0,15 pour les toits et les matériaux.
    const share = (xs: string[]): Record<string, number> => xs.reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 / xs.length }), {});
    const real = { palette: p.palette, toits: share(base.buildings.map((b) => b.cover)), materiaux: share(base.buildings.map((b) => b.material)), densite: p.densite };
    const d = styleDistance(real, p);
    expect(d.toits).toBeLessThan(0.15);
    expect(d.materiaux).toBeLessThan(0.15);
  });

  it("aucune teinte écrite dans les fichiers de génération et de maillage de R1b (toutes viennent de data/art)", () => {
    const files = ["styling.ts", "terrain.ts", "envCountry.ts", "envTown.ts", "envWall.ts", "envNature.ts", "environment.ts", "envMesh.ts", "meshBuildings.ts", "meshProps.ts", "meshTerrain.ts", "meshVegetation.ts", "meshWall.ts", "meshNature.ts", "texturesEnv.ts", "titanGallery.ts", "envMore.ts", "meshCave.ts", "humanBase.ts", "humanViewer.ts"];
    const present = new Set(readdirSync("src/render/tactical3d"));
    for (const f of files) {
      expect(present.has(f), f).toBe(true);
      const src = readFileSync(`src/render/tactical3d/${f}`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      const hex = src.match(/(#[0-9a-fA-F]{6}\b|0x[0-9a-fA-F]{6}\b)/g) ?? [];
      expect(hex, f).toEqual([]);
    }
  });

  it("chaque accessoire des profils a son rendu (objet instancié ou élément de scène)", () => {
    for (const k of ACCESSORIES) {
      const r = ACCESSORY_RENDER[k];
      expect(r, k).toBeDefined();
      if (r === "prop") expect(PROP_DEFS[k], k).toBeDefined();
    }
    for (const p of PROFILES) for (const a of p.accessoires) expect(ACCESSORY_RENDER[a], `${p.id} : ${a}`).toBeDefined();
    if (process.env["R1B_LOG"] === "1") writeFileSync("docs/reports/R1b-environnements.log", `${log.join("\n")}\n`);
  });
});
