import { Box3, BoxGeometry, BufferAttribute, Color, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion, RepeatWrapping, SphereGeometry, Vector3 } from "three";
import type { BufferGeometry, Material, Object3D, Texture } from "three";
import type { Structure, TacticalWorldMap } from "../../../sim/tactical/map";
import { derive, range, seeded } from "../rng";
import { addBuilding, emptyBuilders } from "../meshBuildings";
import type { BuildingBuilders } from "../meshBuildings";
import type { StyledBuilding } from "../envTypes";
import { facadeColor, profile as styleProfile, roofColor } from "../styles";
import type { RoofMaterial, StyleProfile, WallMaterial } from "../styles";
import { pickWeighted, roofShape } from "../styling";
import type { FaceBuilder } from "../townMesh";

/**
 * Décor de la bataille 3D (R2+), DÉRIVÉ de la carte de la simulation (jamais l'inverse) : chaque structure (bâtiment,
 * arbre, arbre géant, rocher, mur) devient une géométrie de même emprise au sol ; chaque ancrage est un crochet visible.
 * Repère : x de la carte → X, y de la carte → Z (vers le sud), hauteur → Y.
 * Instanciation : une instance par structure dans un maillage par genre (peu d'appels de dessin, quelle que soit la ville).
 * Dette n° 74 : les bâtiments sont habillés par les générateurs des environnements (R1b–R1d) selon un profil de style
 * (`data/art/styles.json`) : matière et teinte des façades, fenêtres par étage, couverture et forme du toit, cheminées ; murs
 * à l'emprise et à la hauteur exactes de la simulation (les crochets des façades y restent posés). Faces fusionnées par matière.
 */

/** Textures des façades et des toits (navigateur) ; absentes sous Node, les teintes passent par les sommets. */
export interface BattleDecorTextures {
  facade(m: WallMaterial): { upper: Texture; upperLit: Texture; ground: Texture; groundLit: Texture; plain: Texture };
  roof(c: RoofMaterial): Texture;
  normal(t: Texture | null, strength: number): Texture | null;
}

/**
 * Profil de style du décor selon la carte (A) : ville et mur → district planifié du mur Rose (E02) ; plaine → village
 * agricole (E11) ; forêt → bois et forêts ordinaires (E15) ; repli sur E02 si le profil n'a ni matières ni toits.
 */
export function battleProfile(m: Pick<TacticalWorldMap, "terrain">): StyleProfile {
  const id = m.terrain === "plaine" ? "E11" : m.terrain === "foret" ? "E15" : "E02";
  const p = styleProfile(id);
  const has = (w: Partial<Record<string, number>>): boolean => Object.entries(w).some(([k, v]) => (v ?? 0) > 0 && k !== "aucun" && k !== "toile");
  return has(p.materiaux) && has(p.toits) ? p : styleProfile("E02");
}

const LEGACY: Record<WallMaterial, 0 | 1 | 2> = { colombage: 0, enduit: 0, bois: 0, pierre_taillee: 1, pierre_brute: 1, brique: 2 };

export interface Footprint {
  id: number;
  kind: Structure["kind"];
  /** Emprise au sol rendue (m) : boîte [x0, x1] × [y0, y1] ou cercle (cx, cy, r). */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  r: number;
  h: number;
}

export interface BattleWorld {
  group: Group;
  /** Emprises au sol des structures rendues (contrôle d'emprise, ± 0,1 m). */
  footprints: Footprint[];
  /** Maillage des crochets (une instance par ancrage de la simulation). */
  anchors: InstancedMesh;
  ground: Mesh;
  materials: { ground: MeshStandardMaterial; stone: MeshStandardMaterial };
  /** Matériaux des fenêtres (carte d'émission : allumées la nuit). */
  windows: MeshStandardMaterial[];
  /** Profil de style des bâtiments. */
  profile: StyleProfile;
  /** Volumes des bâtiments rendus (toit compris), dans l'ordre des bâtiments de la carte : tests de ligne de vue. */
  houses: HouseBox[];
  /**
   * Dette n° 75 (15 C-06, 18 R4.4) : bâtiments (indices de `houses`, 8 au plus) rendus translucides parce qu'ils cachent
   * une unité choisie : trame de pixels (deux sur trois écartés), sans tri de transparence.
   */
  setOccluders(indices: readonly number[]): void;
  /** Bâtiments translucides en ce moment (indices de `houses`). */
  occluders(): number[];
  dispose(): void;
}

export interface HouseBox {
  id: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Faîtage (m). */
  top: number;
}

export const MAX_OCCLUDERS = 8;

/** Rend translucide (trame de pixels) les fragments des bâtiments listés dans `uCaches` (indice + 1 ; −1 : vide). */
function patchOcclusion(mat: MeshStandardMaterial, caches: { value: Float32Array }): void {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms["uCaches"] = caches;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float batiment;\nvarying float vBatiment;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBatiment = batiment;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying float vBatiment;\nuniform float uCaches[${MAX_OCCLUDERS}];`)
      .replace(
        "void main() {",
        `void main() {\n  for (int i = 0; i < ${MAX_OCCLUDERS}; i++) {\n    if (vBatiment > 0.5 && abs(vBatiment - uCaches[i]) < 0.5) {\n      vec2 q = floor(gl_FragCoord.xy);\n      if (mod(q.x + 2.0 * q.y, 3.0) > 0.5) discard;\n    }\n  }`,
      );
  };
  mat.customProgramCacheKey = (): string => "occlusion-batiments";
}

const M = new Matrix4();
const Q = new Quaternion();
const S = new Vector3();
const P = new Vector3();
const UP = new Vector3(0, 1, 0);

function place(mesh: InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY = 0): void {
  Q.setFromAxisAngle(UP, rotY);
  M.compose(P.set(x, y, z), Q, S.set(sx, sy, sz));
  mesh.setMatrixAt(i, M);
}

/** Construit le décor d'une carte. `ground` : texture de sol facultative (photo), répétée tous les `tile` m. */
export function buildBattleWorld(m: TacticalWorldMap, seed: number, opts: { groundTex?: Texture | null; tile?: number; night?: boolean; profile?: StyleProfile; textures?: BattleDecorTextures | null } = {}): BattleWorld {
  const rand = seeded(derive(seed, 2041));
  const group = new Group();
  group.name = "decor-bataille";
  const terrain = m.terrain;
  const groundColor = terrain === "foret" ? 0x5d6a3e : terrain === "ville" ? 0x6f6a58 : terrain === "mur" ? 0x6c6a55 : 0x6f7a45;
  const groundMat = new MeshStandardMaterial({ color: groundColor, roughness: 0.95, metalness: 0 });
  if (opts.groundTex) {
    const t = opts.groundTex;
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.repeat.set(m.width / (opts.tile ?? 4), m.height / (opts.tile ?? 4));
    groundMat.map = t;
  }
  // Sol : la carte, et une marge de campagne autour (le regard ne tombe pas dans le vide).
  const margin = 400;
  const ground = new Mesh(new PlaneGeometry(m.width + 2 * margin, m.height + 2 * margin, 1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(m.width / 2, 0, m.height / 2);
  ground.receiveShadow = true;
  ground.name = "sol";
  group.add(ground);
  // Bord de la zone de combat : un liseré discret (les deux bords de déploiement restent lisibles).
  const edgeMat = new MeshStandardMaterial({ color: 0x3d3a30, roughness: 1, transparent: true, opacity: 0.35 });
  for (const [x, z, w, d] of [[m.width / 2, 0, m.width, 0.6], [m.width / 2, m.height, m.width, 0.6], [0, m.height / 2, 0.6, m.height], [m.width, m.height / 2, 0.6, m.height]] as const) {
    const e = new Mesh(new PlaneGeometry(w, d), edgeMat);
    e.rotation.x = -Math.PI / 2;
    e.position.set(x, 0.03, z);
    group.add(e);
  }

  const stoneMat = new MeshStandardMaterial({ color: 0x9a968a, roughness: 0.95 });
  const barkMat = new MeshStandardMaterial({ color: 0x4e3b2a, roughness: 1 });
  const leafMat = new MeshStandardMaterial({ color: terrain === "foret" ? 0x3b5a2c : 0x4a6b33, roughness: 0.9, flatShading: true });
  const rockMat = new MeshStandardMaterial({ color: 0x7d7a72, roughness: 1, flatShading: true });
  const footprints: Footprint[] = [];
  const by = (k: Structure["kind"]): Structure[] => m.structures.filter((s) => s.kind === k);
  const decorMats: Material[] = [];
  const windows: MeshStandardMaterial[] = [];
  const style = opts.profile ?? battleProfile(m);
  const tx = opts.textures ?? null;
  const caches = { value: new Float32Array(MAX_OCCLUDERS).fill(-1) };
  const houseMeshes: Mesh[] = [];
  const houseBoxes: HouseBox[] = [];

  // Bâtiments (dette n° 74) : maisons du profil de style, murs à l'emprise et à la hauteur de la simulation ; toit au-dessus
  // (débord d'avant-toit de 0,45 m). L'emprise retenue est mesurée sur les sommets des façades rendues.
  const houses = by("batiment");
  if (houses.length > 0) {
    const out: BuildingBuilders = emptyBuilders();
    const textured = tx !== null;
    for (const s of houses) {
      const material = pickWeighted<WallMaterial>(rand, style.materiaux);
      const cover = pickWeighted<RoofMaterial>(rand, style.toits, ["aucun", "toile"]);
      const shape = roofShape(rand, cover);
      const floors = Math.max(1, Math.round(s.h / 3.2));
      const b: StyledBuilding = {
        id: s.id,
        block: 0,
        x: s.x + s.w / 2,
        y: s.y + s.d / 2,
        angle: 0,
        width: s.w,
        depth: s.d,
        floors,
        floorHeight: s.h / floors,
        roof: shape.roof,
        pitch: shape.pitch,
        ridgeAlongFront: s.w >= s.d,
        wall: LEGACY[material],
        roofColor: 0,
        tint: range(rand, 0.84, 1),
        chimneys: rand() < 0.7 ? [{ u: range(rand, -0.3, 0.3) * s.w, v: range(rand, -0.15, 0.15) * s.d, height: range(rand, 0.8, 1.6) }] : [],
        bays: Math.max(1, Math.round(s.w / 3.2)),
        sideBays: Math.max(1, Math.round(s.d / 3.2)),
        material,
        cover,
        wallHex: facadeColor(style, material),
        roofHex: roofColor(style, cover),
        trimHex: style.palette.bois,
        stoneHex: style.palette.pierre,
        ruin: 0,
        base: 0,
        plinth: 0,
      };
      const facades = (): FaceBuilder[] => [out.ground.get(material), out.upper.get(material)].filter((f): f is FaceBuilder => f !== undefined);
      const before = new Map(facades().map((f) => [f, f.pos.length]));
      addBuilding(out, b, textured, seed);
      const box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, h: 0 };
      for (const f of facades()) {
        for (let i = before.get(f) ?? 0; i < f.pos.length; i += 3) {
          const x = f.pos[i] as number;
          const y = f.pos[i + 1] as number;
          const z = f.pos[i + 2] as number;
          box.x0 = Math.min(box.x0, x);
          box.x1 = Math.max(box.x1, x);
          box.y0 = Math.min(box.y0, z);
          box.y1 = Math.max(box.y1, z);
          box.h = Math.max(box.h, y);
        }
      }
      footprints.push({ id: s.id, kind: s.kind, x0: box.x0, x1: box.x1, y0: box.y0, y1: box.y1, r: 0, h: box.h });
    }
    const add = (fb: FaceBuilder | undefined, mat: MeshStandardMaterial, name: string): void => {
      decorMats.push(mat);
      patchOcclusion(mat, caches);
      if (!fb || fb.pos.length === 0) return;
      const mesh = new Mesh(fb.build(), mat);
      mesh.name = name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      houseMeshes.push(mesh);
    };
    const walls = new Set<WallMaterial>([...out.ground.keys(), ...out.upper.keys(), ...out.plain.keys()]);
    for (const wm of [...walls].sort()) {
      const set = tx?.facade(wm) ?? null;
      const mk = (map: Texture | null, lit: Texture | null): MeshStandardMaterial =>
        new MeshStandardMaterial({ map, normalMap: tx?.normal(map, 1.6) ?? null, emissiveMap: lit, emissive: lit ? new Color(1, 1, 1) : new Color(0, 0, 0), emissiveIntensity: lit && opts.night ? 0.85 : 0, vertexColors: true, roughness: 0.9 });
      const up = mk(set?.upper ?? null, set?.upperLit ?? null);
      const gr = mk(set?.ground ?? null, set?.groundLit ?? null);
      if (set) windows.push(up, gr);
      add(out.upper.get(wm), up, `facades-etages-${wm}`);
      add(out.ground.get(wm), gr, `facades-rdc-${wm}`);
      add(out.plain.get(wm), new MeshStandardMaterial({ map: set?.plain ?? null, normalMap: tx?.normal(set?.plain ?? null, 1.6) ?? null, vertexColors: true, roughness: 0.92 }), `murs-aveugles-${wm}`);
    }
    for (const [c, fb] of [...out.roofs.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
      const map = tx?.roof(c) ?? null;
      add(fb, new MeshStandardMaterial({ map, normalMap: tx?.normal(map, 2.4) ?? null, vertexColors: true, roughness: c === "ardoise" ? 0.6 : 0.85, side: DoubleSide }), `toits-${c}`);
    }
    add(out.stone, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: DoubleSide }), "cheminees");
    add(out.wood, new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), "bois");
  }
  // Chaque sommet du décor bâti porte l'indice de sa maison (+ 1) : emprise élargie de 0,7 m (avant-toits), grille de 8 m.
  if (houses.length > 0) {
    const fps = footprints.filter((f) => f.kind === "batiment");
    const cell = 8;
    const grid = new Map<string, number[]>();
    fps.forEach((f, i) => {
      houseBoxes.push({ id: f.id, x0: f.x0, x1: f.x1, y0: f.y0, y1: f.y1, top: f.h });
      for (let gx = Math.floor((f.x0 - 0.7) / cell); gx <= Math.floor((f.x1 + 0.7) / cell); gx++)
        for (let gy = Math.floor((f.y0 - 0.7) / cell); gy <= Math.floor((f.y1 + 0.7) / cell); gy++) grid.set(`${gx},${gy}`, [...(grid.get(`${gx},${gy}`) ?? []), i]);
    });
    for (const mesh of houseMeshes) {
      const pos = mesh.geometry.getAttribute("position");
      const ids = new Float32Array(pos.count);
      for (let v = 0; v < pos.count; v++) {
        const x = pos.getX(v);
        const z = pos.getZ(v);
        for (const i of grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? []) {
          const f = fps[i] as Footprint;
          if (x >= f.x0 - 0.7 && x <= f.x1 + 0.7 && z >= f.y0 - 0.7 && z <= f.y1 + 0.7) {
            ids[v] = i + 1;
            const hb = houseBoxes[i] as HouseBox;
            hb.top = Math.max(hb.top, pos.getY(v));
            break;
          }
        }
      }
      mesh.geometry.setAttribute("batiment", new BufferAttribute(ids, 1));
    }
  }
  // Mur (et autres boîtes de maçonnerie) : parement de pierre.
  for (const s of by("mur")) {
    const wall = new Mesh(new BoxGeometry(s.w, s.h, s.d).translate(s.x + s.w / 2, s.h / 2, s.y + s.d / 2), stoneMat);
    wall.name = "mur";
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    footprints.push({ id: s.id, kind: s.kind, x0: s.x, x1: s.x + s.w, y0: s.y, y1: s.y + s.d, r: 0, h: s.h });
  }
  // Rochers : boîte exacte (arêtes adoucies par l'ombrage plat).
  const rocks = by("rocher");
  if (rocks.length > 0) {
    const rm = new InstancedMesh(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), rockMat, rocks.length);
    rm.name = "rochers";
    rocks.forEach((s, i) => {
      place(rm, i, s.x + s.w / 2, 0, s.y + s.d / 2, s.w, s.h, s.d);
      footprints.push({ id: s.id, kind: s.kind, x0: s.x, x1: s.x + s.w, y0: s.y, y1: s.y + s.d, r: 0, h: s.h });
    });
    rm.castShadow = true;
    rm.receiveShadow = true;
    rm.instanceMatrix.needsUpdate = true;
    group.add(rm);
  }
  // Arbres et arbres géants : fût de même rayon que la simulation, houppier au-dessus.
  const trees = [...by("arbre"), ...by("arbre_geant")];
  if (trees.length > 0) {
    const trunk = new InstancedMesh(new CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0), barkMat, trees.length);
    const crown = new InstancedMesh(new IcosahedronGeometry(1, 1), leafMat, trees.length);
    trunk.name = "futs";
    crown.name = "houppiers";
    trees.forEach((s, i) => {
      const giant = s.kind === "arbre_geant";
      const crownR = giant ? Math.max(s.r * 2.4, 12) : Math.max(s.r * 4, 2.6);
      const trunkH = giant ? s.h * 0.85 : s.h * 0.62;
      place(trunk, i, s.x, 0, s.y, s.r, trunkH, s.r);
      place(crown, i, s.x, trunkH + crownR * (giant ? 0.35 : 0.6), s.y, crownR, crownR * (giant ? 0.55 : 0.95), crownR, rand() * Math.PI);
      crown.setColorAt(i, new Color().setHSL(0.24 + rand() * 0.06, 0.35 + rand() * 0.15, 0.22 + rand() * 0.1));
      footprints.push({ id: s.id, kind: s.kind, x0: s.x - s.r, x1: s.x + s.r, y0: s.y - s.r, y1: s.y + s.r, r: s.r, h: s.h });
    });
    for (const x of [trunk, crown]) {
      x.castShadow = true;
      x.receiveShadow = true;
      x.instanceMatrix.needsUpdate = true;
      group.add(x);
    }
  }
  // Ancrages : crochets de fer, un par ancrage de la simulation (0,24 m, visibles de près).
  const anchorMat = new MeshStandardMaterial({ color: 0x55504a, roughness: 0.45, metalness: 0.6 });
  const anchors = new InstancedMesh(new SphereGeometry(0.12, 6, 4), anchorMat, Math.max(1, m.anchors.length));
  anchors.name = "ancrages";
  anchors.count = m.anchors.length;
  m.anchors.forEach((a, i) => place(anchors, i, a.x, a.z, a.y, 1, 1, 1));
  anchors.instanceMatrix.needsUpdate = true;
  group.add(anchors);
  const mats: Material[] = [groundMat, edgeMat, stoneMat, barkMat, leafMat, rockMat, anchorMat, ...decorMats];
  return {
    group,
    footprints,
    anchors,
    ground,
    materials: { ground: groundMat, stone: stoneMat },
    windows,
    profile: style,
    houses: houseBoxes,
    setOccluders(indices: readonly number[]): void {
      caches.value.fill(-1);
      indices.slice(0, MAX_OCCLUDERS).forEach((i, k) => (caches.value[k] = i + 1));
    },
    occluders(): number[] {
      return [...caches.value].filter((v) => v > 0).map((v) => v - 1);
    },
    dispose(): void {
      group.traverse((o) => {
        const g = (o as Mesh).geometry as BufferGeometry | undefined;
        g?.dispose();
      });
      for (const x of mats) x.dispose();
    },
  };
}

/**
 * Bâtiments qui cachent des unités à la caméra (dette n° 75) : segment caméra → poitrine de chaque unité (repère de la scène :
 * x, hauteur, y de la carte), contre le volume de chaque maison (toit compris) ; les plus proches de la caméra d'abord,
 * `MAX_OCCLUDERS` au plus. Fonction pure (tests).
 */
export function occludersFor(houses: readonly HouseBox[], cam: { x: number; y: number; z: number }, targets: readonly { x: number; y: number; z: number }[]): number[] {
  const hits = new Map<number, number>();
  for (const t of targets) {
    const d = [t.x - cam.x, t.y - cam.y, t.z - cam.z];
    houses.forEach((h, i) => {
      let t0 = 0;
      let t1 = 0.97;
      const lo = [h.x0, 0, h.y0];
      const hi = [h.x1, h.top, h.y1];
      const o = [cam.x, cam.y, cam.z];
      for (let a = 0; a < 3; a++) {
        const da = d[a] as number;
        const oa = o[a] as number;
        if (Math.abs(da) < 1e-9) {
          if (oa < (lo[a] as number) || oa > (hi[a] as number)) return;
          continue;
        }
        let u = ((lo[a] as number) - oa) / da;
        let v = ((hi[a] as number) - oa) / da;
        if (u > v) [u, v] = [v, u];
        t0 = Math.max(t0, u);
        t1 = Math.min(t1, v);
        if (t0 > t1) return;
      }
      hits.set(i, Math.min(hits.get(i) ?? Infinity, t0));
    });
  }
  return [...hits.entries()].sort((a, b) => a[1] - b[1] || a[0] - b[0]).slice(0, MAX_OCCLUDERS).map(([i]) => i);
}

/** Emprise rendue d'une instance (boîte englobante de sa matrice sur la géométrie unité) : contrôle d'emprise. */
export function instanceFootprint(mesh: InstancedMesh, i: number): { x0: number; x1: number; y0: number; y1: number } {
  const m = new Matrix4();
  mesh.getMatrixAt(i, m);
  const geo = mesh.geometry;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (!bb) return { x0: 0, x1: 0, y0: 0, y1: 0 };
  const box = bb.clone().applyMatrix4(m);
  return { x0: box.min.x, x1: box.max.x, y0: box.min.z, y1: box.max.z };
}

/** Pièce du décor par nom (« batiments », « toits », « mur », « rochers », « futs », « houppiers », « ancrages »). */
export function partsNamed(w: BattleWorld, name: string): Object3D[] {
  return w.group.children.filter((o) => o.name === name);
}

/** Boîte englobante d'une pièce entière (mur) : emprise au sol et hauteur. */
export function objectBox(o: Object3D): { x0: number; x1: number; y0: number; y1: number; h: number } {
  const b = new Box3().setFromObject(o);
  return { x0: b.min.x, x1: b.max.x, y0: b.min.z, y1: b.max.z, h: b.max.y };
}

/** Position rendue d'un ancrage (repère de la carte : x, y au sol, z hauteur). */
export function anchorAt(w: BattleWorld, i: number): { x: number; y: number; z: number } {
  const m = new Matrix4();
  w.anchors.getMatrixAt(i, m);
  const p = new Vector3().setFromMatrixPosition(m);
  return { x: p.x, y: p.z, z: p.y };
}
