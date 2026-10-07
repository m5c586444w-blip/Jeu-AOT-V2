import { Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from "three";
import type { BufferGeometry, Material, Texture } from "three";
import type { RoofMaterial, WallMaterial } from "../../data/artSchemas";
import type { EnvData } from "./envTypes";
import { addBuilding, addLandmark, emptyBuilders } from "./meshBuildings";
import type { BuildingBuilders } from "./meshBuildings";
import { buildProps, phys } from "./meshProps";
import { buildTerrainMeshes, waterColor } from "./meshTerrain";
import { buildHedges, buildVegetation } from "./meshVegetation";
import { buildWallMeshes } from "./meshWall";
import { buildGiantForest, buildSpray } from "./meshNature";
import { buildCave } from "./meshCave";
import { normalOf } from "./texturesEnv";
import { tagPhoto } from "./photoTextures";
import type { Matiere } from "./photoTextures";
import { applyLite } from "./lite";
import { buildTitan, setSteamTexture } from "./titan";
import type { Titan, TitanSpec } from "./titan";
import { titanSpec } from "./titanGallery";
import { heightAt } from "./terrain";
import type { VegetationMeshes } from "./meshVegetation";
import { QUALITY } from "./quality";
import type { Quality } from "./quality";
import { MATERIALS } from "./styles";
import type { FaceBuilder } from "./townMesh";

/**
 * Assemblage d'un environnement de R1b (navigateur et tests) : terrain, eau, routes, pavages, bâtiments et repères fusionnés
 * par matière, accessoires et végétation instanciés (niveaux de détail), lumières de nuit. `textures` est fourni par le
 * navigateur (`texturesEnv.ts`) ; sans lui (tests sous Node), les teintes passent par les sommets.
 */
export interface EnvTextures {
  facade(m: WallMaterial): { upper: Texture; upperLit: Texture; ground: Texture; groundLit: Texture; plain: Texture };
  roof(c: RoofMaterial): Texture;
  ground(): Texture | null;
  cobble(): Texture;
  wallStone(): Texture;
  mist(): Texture;
  skin(): Texture;
  puff(): Texture;
  /** R1c : grappe de feuilles des cartes de houppier ; détail du sol répété ; rides de l'eau. */
  leaves(): Texture;
  groundDetail(): { albedo: Texture; normal: Texture };
  waterNormal(): Texture;
}

export interface EnvKit {
  quality: Quality;
  textures: EnvTextures | null;
  /** Fabrique de Titans (R1c : corps de base) ; par défaut, les figures de R1. */
  titan?: (spec: TitanSpec, seed: number, skin: Texture | null) => Titan;
}

export interface EnvScene {
  group: Group;
  titans: Titan[];
  windowMaterials: MeshStandardMaterial[];
  lanternMaterial: MeshStandardMaterial;
  lamps: Vector3[];
  vegetation: VegetationMeshes | null;
  /** Comptes de construction (instances, faces) pour les tests et les mesures. */
  counts: Record<string, number>;
  /** R1c : animations de la scène (rides de l'eau), au temps de la scène (s). */
  animate(t: number): void;
  dispose(): void;
}

/** Lampes : têtes lumineuses posées au sommet des lampadaires, lanternes et bougies (matériau des lanternes, allumé la nuit) ; x, y, z, rayon. */
const GLOW_AT: Record<string, [number, number, number, number]> = { lampadaires: [0, 4.45, 0, 0.24], lanternes: [0.45, 2.85, 0, 0.24], bougies: [0, 1.2, 0, 0.07] };

/** Fenêtres éteintes : lieux abandonnés, ruinés ou sans habitants (territoire, ruines, variantes « abandonné »). */
export function lightsOff(env: EnvData): boolean {
  return env.generator === "territoire" || env.variant?.etat === "abandonne" || env.variant?.etat === "ruines_incendies";
}

/** Le Titan n° `i` de l'environnement, fabriqué, texturé, placé (pieds au sol, relief compris) et posé. */
export function makeEnvTitan(env: EnvData, i: number, make: NonNullable<EnvKit["titan"]>, tx: EnvTextures | null): Titan {
  const tp = env.titans[i];
  if (!tp) throw new Error(`${env.id} : pas de Titan n° ${i}`);
  const t = make(titanSpec(tp.type, tp.variant), tp.seed, tx?.skin() ?? null);
  const puff = tx?.puff();
  if (puff) setSteamTexture(t, puff);
  const hf = env.terrain?.heights ?? null;
  t.group.position.set(tp.x, tp.pose === "buste" ? 0 : hf ? heightAt(hf, tp.x, tp.y) : 0, tp.y);
  t.group.rotation.y = tp.angle;
  t.group.updateMatrixWorld(true);
  t.setPose(tp.pose, 0.6);
  return t;
}

export function buildEnvironmentMeshes(env: EnvData, kit: EnvKit): EnvScene {
  const q = QUALITY[kit.quality];
  const tx = kit.textures;
  // R1d : qualité basse allégée — ni cartes de feuilles (forêts, haies, voûte), ni relief (normales), ni détail du sol.
  const lite = kit.quality === "bas";
  const leaves = lite ? null : (tx?.leaves() ?? null);
  const textured = tx !== null;
  const group = new Group();
  group.name = `environnement-${env.id}`;
  const materials: Material[] = [];
  const disposers: (() => void)[] = [];
  const animators: ((t: number) => void)[] = [];
  const counts: Record<string, number> = {};
  const p = env.profile;

  // Terrain, eau, routes, pavages, ponts.
  if (env.terrain) {
    const t = buildTerrainMeshes(env.terrain, env.paving, env.canals, env.stoneBridges, {
      groundMap: tx?.ground() ?? null,
      sol: p.palette.sol,
      water: waterColor(env.generator === "eaux" ? p.palette.toit_2 : env.generator === "cote" ? p.palette.toit : p.palette.sol),
      bridgeColor: p.palette.pierre,
      roadColor: `#${new Color(MATERIALS.sols.route.base).lerp(new Color(p.palette.sol), 0.25).getHexString()}`,
      paveMap: tx?.cobble() ?? null,
      detail: lite ? null : (tx?.groundDetail() ?? null),
      waterNormal: lite ? null : (tx?.waterNormal() ?? null),
      paveNormal: tx && !lite ? normalOf(tx.cobble(), 2.5) : null,
    });
    animators.push((time) => t.animate(time));
    group.add(t.group);
    disposers.push(() => t.dispose());
    counts["groundTriangles"] = (t.ground.geometry.index?.count ?? 0) / 3;
  }

  // Bâtiments et repères.
  const out: BuildingBuilders = emptyBuilders();
  for (const b of env.buildings) addBuilding(out, b, textured, env.seed);
  for (const l of env.landmarks) addLandmark(out, l, textured, env.seed);
  counts["buildings"] = env.buildings.length;
  counts["landmarks"] = env.landmarks.length;
  const windowMaterials: MeshStandardMaterial[] = [];
  const add = (fb: FaceBuilder, mat: MeshStandardMaterial, name: string, shadow = true): void => {
    if (fb.pos.length === 0) return;
    const m = new Mesh(fb.build(), mat);
    m.name = name;
    m.castShadow = shadow;
    m.receiveShadow = true;
    group.add(m);
    materials.push(mat);
  };
  const usedWalls = new Set<WallMaterial>([...out.ground.keys(), ...out.upper.keys(), ...out.plain.keys()]);
  for (const m of [...usedWalls].sort()) {
    const set = tx?.facade(m) ?? null;
    const mk = (map: Texture | null, lit: Texture | null): MeshStandardMaterial => new MeshStandardMaterial({ map, normalMap: normalOf(map, 1.6), emissiveMap: lit, emissive: lit ? new Color(1, 1, 1) : new Color(0, 0, 0), emissiveIntensity: 0, vertexColors: true, roughness: 0.9 });
    const up = mk(set?.upper ?? null, set?.upperLit ?? null);
    const gr = mk(set?.ground ?? null, set?.groundLit ?? null);
    if (set) windowMaterials.push(up, gr);
    const fbU = out.upper.get(m);
    const fbG = out.ground.get(m);
    const fbP = out.plain.get(m);
    if (fbU) add(fbU, up, `facades-etages-${m}`);
    if (fbG) add(fbG, gr, `facades-rdc-${m}`);
    if (fbP) add(fbP, new MeshStandardMaterial({ map: set?.plain ?? null, normalMap: normalOf(set?.plain ?? null, 1.6), vertexColors: true, roughness: 0.92 }), `murs-aveugles-${m}`);
  }
  // R1d : tuiles et ardoise passent aux textures de Poly Haven après la première image (`photoTextures.ts`, 3,2 m par unité).
  const roofPhoto = (c: RoofMaterial): Matiere | null => (c === "tuiles_rouges" ? "tuiles" : c === "ardoise" ? "ardoise" : null);
  for (const [c, fb] of [...out.roofs.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const map = tx?.roof(c) ?? null;
    const ph = roofPhoto(c);
    add(fb, new MeshStandardMaterial({ map: ph ? tagPhoto(map, ph, 3.2) : map, normalMap: normalOf(map, 2.4), vertexColors: true, roughness: c === "ardoise" ? 0.6 : 0.85, side: DoubleSide }), `toits-${c}`);
  }
  add(out.stone, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: DoubleSide }), "pierre");
  add(out.wood, new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), "bois");
  add(out.dark, new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: phys("braise"), emissiveIntensity: 0 }), "baies", false);

  // Murs (seulement si le profil les montre : la règle de visibilité est appliquée par le générateur).
  if (env.wall) {
    const hf = env.terrain?.heights ?? null;
    const wm = buildWallMeshes(env.wall, (q) => (hf ? heightAt(hf, q.x, q.y) : 0), tx?.wallStone() ?? null, env.seed);
    for (const m of wm.meshes) group.add(m);
    disposers.push(() => wm.dispose());
    counts["wallPaths"] = env.wall.paths.length;
    counts["cannons"] = env.wall.paths.reduce((s, w) => s + w.cannons.length, 0);
  }

  // Forêt des Arbres Géants : troncs, voûte, rayons de lumière, brume.
  if (env.giants.length > 0) {
    const hf = env.terrain?.heights ?? null;
    const nat = buildGiantForest(
      env.giants,
      (x, y) => (hf ? heightAt(hf, x, y) : 0),
      env.shafts,
      { bark: p.palette.bois, moss: p.palette.sol, canopy: [p.palette.toit, p.palette.toit_2], light: p.palette.facade },
      { near: q.lodNear * 0.9, far: q.lodFar, shadows: q.shadows },
      tx?.mist() ?? null,
      env.mist,
      env.terrain?.spec.size ?? 900,
      leaves,
    );
    group.add(nat.group);
    disposers.push(() => nat.dispose());
    for (const [k, v] of Object.entries(nat.counts)) counts[k] = v;
  }

  // Embruns sur la côte.
  if (env.terrain && env.terrain.seaLevel !== null && (p.accessoires as readonly string[]).includes("embruns")) {
    const sp = buildSpray(env.terrain, MATERIALS.physiques.lumiere, env.seed);
    group.add(sp.group);
    disposers.push(() => sp.dispose());
    counts["spray"] = sp.count;
  }

  // Lieux souterrains : voûte de roche (puits de jour, stalactites) ou crypte voûtée.
  if (env.cave) {
    const hf = env.terrain?.heights ?? null;
    const cv = buildCave(
      env.cave,
      (x, y) => (hf ? heightAt(hf, x, y) : 0),
      env.giants.length > 0 ? [] : env.shafts,
      { rock: p.palette.pierre, dark: p.palette.toit, light: MATERIALS.physiques.lumiere, floor: p.palette.sol, ice: MATERIALS.physiques.cristal },
      tx?.wallStone() ?? null,
      env.seed,
      q.shadows,
    );
    group.add(cv.group);
    disposers.push(() => cv.dispose());
    for (const [k, v] of Object.entries(cv.counts)) counts[k] = v;
  }

  // Titans posés (classes, variantes, Titan-Mur dans une brèche), pieds au sol (relief compris).
  const titans: Titan[] = [];
  env.titans.forEach((_, i) => {
    const t = makeEnvTitan(env, i, kit.titan ?? buildTitan, tx);
    group.add(t.group);
    titans.push(t);
  });
  counts["titans"] = titans.length;
  disposers.push(() => {
    for (const t of titans) t.dispose();
  });

  // Accessoires.
  const props = buildProps(env.props, Infinity);
  for (const m of props.meshes) group.add(m);
  disposers.push(() => props.dispose());
  counts["props"] = props.meshes.reduce((s, m) => s + m.count, 0);
  counts["propKinds"] = props.meshes.length;
  const lanternMaterial = new MeshStandardMaterial({ color: phys("fer"), emissive: phys("flamme"), emissiveIntensity: 0, roughness: 0.5 });
  materials.push(lanternMaterial);
  const lamps: Vector3[] = [];
  const glowSpots = env.props.filter((x) => GLOW_AT[x.kind]);
  if (glowSpots.length > 0) {
    const geo = new SphereGeometry(0.24, 8, 6);
    const im = new InstancedMesh(geo, lanternMaterial, glowSpots.length);
    im.name = "lanternes-allumees";
    const m = new Matrix4();
    glowSpots.forEach((x, i) => {
      const off = GLOW_AT[x.kind] as [number, number, number, number];
      const c = Math.cos(-x.r + Math.PI / 2);
      const s = Math.sin(-x.r + Math.PI / 2);
      const pos = new Vector3(x.x + off[0] * c * x.s + off[2] * s * x.s, x.z + off[1] * x.s, x.y - off[0] * s * x.s + off[2] * c * x.s);
      const k = off[3] / 0.24;
      im.setMatrixAt(i, m.makeScale(k, k, k).setPosition(pos.x, pos.y, pos.z));
      lamps.push(pos);
    });
    im.computeBoundingSphere();
    group.add(im);
    disposers.push(() => {
      geo.dispose();
      im.dispose();
    });
  }

  // Végétation (niveaux de détail, densité par qualité) et haies.
  let vegetation: VegetationMeshes | null = null;
  if (env.terrain) {
    const nature = env.generator === "foret" || env.generator === "foret_geante";
    vegetation = buildVegetation(
      env.terrain.trees,
      env.terrain.heights,
      { leaf: nature ? [p.palette.toit, p.palette.toit_2] : [MATERIALS.physiques.feuillage, MATERIALS.physiques.feuillage_clair], conifer: MATERIALS.physiques.conifere, bush: nature ? p.palette.toit_2 : MATERIALS.physiques.feuillage },
      { near: q.lodNear, far: q.lodFar, density: q.vegetation, shadows: q.shadows },
      leaves,
    );
    group.add(vegetation.group);
    disposers.push(() => vegetation?.dispose());
    for (const [k, v] of Object.entries(vegetation.counts)) counts[`arbres-${k}`] = v;
    const hedges = buildHedges(env.terrain.hedges, env.terrain.heights, MATERIALS.physiques.feuillage, q.shadows, leaves);
    if (hedges) {
      group.add(hedges);
      counts["hedgePieces"] = hedges.count;
      // Les cartes de feuillage sont un maillage enfant des haies.
      disposers.push(() =>
        hedges.traverse((o) => {
          if (o instanceof InstancedMesh) {
            o.dispose();
            (o.material as Material).dispose();
          }
        }),
      );
    }
  }

  if (lite) applyLite(group, true);

  return {
    group,
    titans,
    windowMaterials: lightsOff(env) ? [] : windowMaterials,
    lanternMaterial,
    lamps,
    vegetation,
    counts,
    animate(time) {
      for (const a of animators) a(time);
    },
    dispose() {
      group.traverse((o) => {
        if (o instanceof Mesh && !(o instanceof InstancedMesh)) (o.geometry as BufferGeometry).dispose();
      });
      for (const m of materials) m.dispose();
      for (const d of disposers) d();
    },
  };
}
