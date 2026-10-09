import { Box3, BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion, RepeatWrapping, SphereGeometry, Vector3 } from "three";
import type { Material, Object3D, Texture } from "three";
import type { Structure, TacticalWorldMap } from "../../../sim/tactical/map";
import { derive, range, seeded } from "../rng";

/**
 * Décor de la bataille 3D (R2+), DÉRIVÉ de la carte de la simulation (jamais l'inverse) : chaque structure (bâtiment,
 * arbre, arbre géant, rocher, mur) devient une géométrie de même emprise au sol ; chaque ancrage est un crochet visible.
 * Repère : x de la carte → X, y de la carte → Z (vers le sud), hauteur → Y.
 * Instanciation : une instance par structure dans un maillage par genre (peu d'appels de dessin, quelle que soit la ville).
 */

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
  materials: { ground: MeshStandardMaterial; wall: MeshStandardMaterial; roof: MeshStandardMaterial; stone: MeshStandardMaterial };
  dispose(): void;
}

/** Prisme de toit à deux pans : base 1 × 1 (centrée), faîtage le long de X, hauteur 1, posé sur y = 0. */
function roofGeometry(): BufferGeometry {
  const p = [
    // pan sud et pan nord
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0,
    0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, 0, 0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0,
    // pignons
    -0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, 0,
  ];
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(p), 3));
  g.computeVertexNormals();
  return g;
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
export function buildBattleWorld(m: TacticalWorldMap, seed: number, opts: { groundTex?: Texture | null; tile?: number; night?: boolean } = {}): BattleWorld {
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

  const wallMat = new MeshStandardMaterial({ color: 0xb8ab90, roughness: 0.9, vertexColors: false });
  const roofMat = new MeshStandardMaterial({ color: 0x8a4b36, roughness: 0.8, side: DoubleSide });
  const stoneMat = new MeshStandardMaterial({ color: 0x9a968a, roughness: 0.95 });
  const barkMat = new MeshStandardMaterial({ color: 0x4e3b2a, roughness: 1 });
  const leafMat = new MeshStandardMaterial({ color: terrain === "foret" ? 0x3b5a2c : 0x4a6b33, roughness: 0.9, flatShading: true });
  const rockMat = new MeshStandardMaterial({ color: 0x7d7a72, roughness: 1, flatShading: true });
  const footprints: Footprint[] = [];
  const by = (k: Structure["kind"]): Structure[] => m.structures.filter((s) => s.kind === k);

  // Bâtiments : murs (boîte exacte) et toit à deux pans dans l'emprise (pas de débord : l'emprise rendue = celle de la simulation).
  const houses = by("batiment");
  if (houses.length > 0) {
    const box = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const walls = new InstancedMesh(box, wallMat, houses.length);
    const roofs = new InstancedMesh(roofGeometry(), roofMat, houses.length);
    walls.name = "batiments";
    roofs.name = "toits";
    houses.forEach((s, i) => {
      const roofH = Math.min(s.w, s.d) * range(rand, 0.28, 0.42);
      const wallH = Math.max(2.5, s.h - roofH);
      place(walls, i, s.x + s.w / 2, 0, s.y + s.d / 2, s.w, wallH, s.d);
      // Faîtage le long du grand côté.
      if (s.w >= s.d) place(roofs, i, s.x + s.w / 2, wallH, s.y + s.d / 2, s.w, roofH, s.d);
      else place(roofs, i, s.x + s.w / 2, wallH, s.y + s.d / 2, s.d, roofH, s.w, Math.PI / 2);
      const c = new Color().setHSL(0.09 + rand() * 0.04, 0.18 + rand() * 0.1, 0.62 + rand() * 0.12);
      walls.setColorAt(i, c);
      roofs.setColorAt(i, new Color().setHSL(0.03 + rand() * 0.03, 0.35 + rand() * 0.15, 0.32 + rand() * 0.1));
      footprints.push({ id: s.id, kind: s.kind, x0: s.x, x1: s.x + s.w, y0: s.y, y1: s.y + s.d, r: 0, h: s.h });
    });
    for (const x of [walls, roofs]) {
      x.castShadow = true;
      x.receiveShadow = true;
      x.instanceMatrix.needsUpdate = true;
      group.add(x);
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
  const mats: Material[] = [groundMat, edgeMat, wallMat, roofMat, stoneMat, barkMat, leafMat, rockMat, anchorMat];
  return {
    group,
    footprints,
    anchors,
    ground,
    materials: { ground: groundMat, wall: wallMat, roof: roofMat, stone: stoneMat },
    dispose(): void {
      group.traverse((o) => {
        const g = (o as Mesh).geometry as BufferGeometry | undefined;
        g?.dispose();
      });
      for (const x of mats) x.dispose();
    },
  };
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
