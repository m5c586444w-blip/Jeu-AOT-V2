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

/**
 * Environnements (R1b, CR1b-05, 09, 10, 14) : même graine = même environnement (données et géométrie), autre graine = autre ;
 * éléments attendus présents ; niveaux de détail et instanciation ; le générateur lit le profil (aucun style codé en dur).
 * `R1B_LOG=1` écrit `docs/reports/R1b-environnements.log`.
 */
const log: string[] = [];
const available = new Set(supportedGenerators());
const lot1 = LOTS[1].filter((id) => available.has(profile(id).generateur));

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
    const files = ["styling.ts", "terrain.ts", "envCountry.ts", "envTown.ts", "envWall.ts", "envNature.ts", "environment.ts", "envMesh.ts", "meshBuildings.ts", "meshProps.ts", "meshTerrain.ts", "meshVegetation.ts", "meshWall.ts", "meshNature.ts", "texturesEnv.ts", "titanGallery.ts"];
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
