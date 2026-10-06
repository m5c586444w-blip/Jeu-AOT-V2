import { Color, ConeGeometry, CylinderGeometry, Group, IcosahedronGeometry, InstancedMesh, LOD, Matrix4, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from "three";
import type { BufferGeometry } from "three";
import type { Hedge, TreeInst, TreeKind } from "./terrain";
import { heightAt } from "./terrain";
import type { Heightfield } from "./terrain";
import { phys } from "./meshProps";
import { FaceBuilder } from "./townMesh";

/**
 * Végétation instanciée de R1b (R1b.2, qualité « haute ») :
 * - une géométrie par essence et par niveau de détail (proche : tronc et plusieurs houppiers ; loin : un seul volume) ;
 * - le terrain est découpé en tuiles de `TILE` m : chaque tuile est un `LOD` three.js à trois niveaux (proche, loin, rien) ;
 * - la qualité règle les distances de bascule et la part d'arbres gardés (tirage fixe par arbre, pas d'aléa à l'image).
 */
export const TILE = 400;
export const TREE_KINDS: readonly TreeKind[] = ["feuillu", "conifere", "fruitier", "mort", "buisson"];

export interface VegetationQuality {
  /** Distance de bascule du détail proche au détail lointain, puis à rien (m). */
  near: number;
  far: number;
  /** Part des arbres gardés (0–1). */
  density: number;
  shadows: boolean;
}

const m4 = (x: number, y: number, z: number, s: [number, number, number] = [1, 1, 1], ry = 0): Matrix4 => new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), ry), new Vector3(...s));

/** Le tronc est assombri : l'instance multiplie tout l'arbre par la teinte du feuillage. */
const TRUNK = (): Color => phys("ecorce").multiplyScalar(1.9);
const LEAF = new Color(1, 1, 1);

function treeGeometry(kind: TreeKind, near: boolean): BufferGeometry {
  const fb = new FaceBuilder();
  const trunk = TRUNK();
  switch (kind) {
    case "feuillu":
      fb.geometry(new CylinderGeometry(0.22, 0.38, 5.5, near ? 7 : 4), m4(0, 2.75, 0), trunk);
      if (near) {
        for (const [x, y, z, s] of [
          [0, 7.4, 0, 3.4],
          [1.6, 6.4, 0.8, 2.4],
          [-1.4, 6.6, -0.6, 2.5],
          [0.3, 8.8, -0.9, 2.2],
        ] as const)
          fb.geometry(new IcosahedronGeometry(1, 1), m4(x, y, z, [s, s * 0.9, s]), LEAF.clone().multiplyScalar(0.92 + 0.08 * Math.sin(x + z)));
      } else fb.geometry(new IcosahedronGeometry(1, 0), m4(0, 7.4, 0, [3.6, 3.2, 3.6]), LEAF);
      break;
    case "conifere":
      fb.geometry(new CylinderGeometry(0.18, 0.3, 4, near ? 6 : 4), m4(0, 2, 0), trunk);
      if (near) for (const [y, r, h] of [
        [4.5, 3, 5],
        [7.4, 2.3, 4.4],
        [10, 1.5, 3.8],
      ] as const)
        fb.geometry(new ConeGeometry(r, h, 8), m4(0, y, 0), LEAF);
      else fb.geometry(new ConeGeometry(2.8, 10.5, 5), m4(0, 6.8, 0), LEAF);
      break;
    case "fruitier":
      fb.geometry(new CylinderGeometry(0.14, 0.22, 2.2, near ? 6 : 4), m4(0, 1.1, 0), trunk);
      if (near) {
        fb.geometry(new IcosahedronGeometry(1, 1), m4(0, 3.2, 0, [2, 1.6, 2]), LEAF);
        fb.geometry(new IcosahedronGeometry(1, 1), m4(0.6, 3.8, 0.4, [1.3, 1.1, 1.3]), LEAF.clone().multiplyScalar(0.94));
      } else fb.geometry(new IcosahedronGeometry(1, 0), m4(0, 3.3, 0, [2.1, 1.8, 2.1]), LEAF);
      break;
    case "mort":
      fb.geometry(new CylinderGeometry(0.16, 0.34, 7, near ? 6 : 4), m4(0, 3.5, 0), trunk);
      if (near) for (const [a, h] of [
        [0.5, 4.5],
        [2.6, 5.5],
        [4.4, 6.3],
      ] as const) {
        const m = new Matrix4().makeTranslation(0, h, 0).multiply(new Matrix4().makeRotationY(a)).multiply(new Matrix4().makeRotationZ(0.9)).multiply(new Matrix4().makeTranslation(0, 1.4, 0));
        fb.geometry(new CylinderGeometry(0.05, 0.12, 2.8, 4), m, trunk);
      }
      break;
    case "buisson":
      if (near) {
        fb.geometry(new IcosahedronGeometry(1, 1), m4(0, 0.7, 0, [1.4, 0.9, 1.3]), LEAF);
        fb.geometry(new IcosahedronGeometry(1, 0), m4(0.8, 0.55, 0.4, [0.9, 0.7, 0.9]), LEAF.clone().multiplyScalar(0.9));
      } else fb.geometry(new IcosahedronGeometry(1, 0), m4(0, 0.7, 0, [1.5, 0.9, 1.4]), LEAF);
      break;
  }
  return fb.build();
}

const GEO = new Map<string, BufferGeometry>();
export function treeGeo(kind: TreeKind, near: boolean): BufferGeometry {
  const key = `${kind}-${near ? "proche" : "loin"}`;
  let g = GEO.get(key);
  if (!g) {
    g = treeGeometry(kind, near);
    GEO.set(key, g);
  }
  return g;
}

/** Tirage fixe d'un arbre (pour la densité de qualité) : même arbre gardé d'une image à l'autre et d'une graine à l'autre. */
export function keepTree(t: TreeInst, density: number): boolean {
  if (density >= 1) return true;
  const h = Math.sin(t.x * 12.9898 + t.y * 78.233) * 43758.5453;
  return h - Math.floor(h) < density;
}

export interface Foliage {
  /** Teintes du feuillage (deux, mêlées par arbre), des conifères, des buissons. */
  leaf: [string, string];
  conifer: string;
  bush: string;
}

export interface VegetationMeshes {
  group: Group;
  /** Instances réellement créées (après la densité), par essence. */
  counts: Record<TreeKind, number>;
  lods: LOD[];
  material: MeshStandardMaterial;
  dispose(): void;
}

function tint(kind: TreeKind, f: Foliage, k: number): Color {
  const c = kind === "conifere" ? new Color(f.conifer) : kind === "buisson" ? new Color(f.bush) : kind === "mort" ? phys("herbe_seche").multiplyScalar(0.55) : new Color(f.leaf[0]).lerp(new Color(f.leaf[1]), k);
  return c.multiplyScalar(0.85 + 0.3 * ((k * 7.31) % 1));
}

export function buildVegetation(trees: readonly TreeInst[], hf: Heightfield | null, f: Foliage, q: VegetationQuality): VegetationMeshes {
  const group = new Group();
  group.name = "vegetation";
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  const counts: Record<TreeKind, number> = { feuillu: 0, conifere: 0, fruitier: 0, mort: 0, buisson: 0 };
  const tiles = new Map<string, TreeInst[]>();
  for (const t of trees) {
    if (!keepTree(t, q.density)) continue;
    const key = `${Math.floor(t.x / TILE)},${Math.floor(t.y / TILE)}`;
    const l = tiles.get(key) ?? [];
    l.push(t);
    tiles.set(key, l);
  }
  const lods: LOD[] = [];
  const m = new Matrix4();
  const quat = new Quaternion();
  const up = new Vector3(0, 1, 0);
  for (const [key, list] of [...tiles.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const [ti, tj] = key.split(",").map(Number) as [number, number];
    const cx = (ti + 0.5) * TILE;
    const cz = (tj + 0.5) * TILE;
    const lod = new LOD();
    lod.name = `tuile-${key}`;
    lod.position.set(cx, 0, cz);
    for (const near of [true, false]) {
      const level = new Group();
      for (const kind of TREE_KINDS) {
        const ofKind = list.filter((t) => t.kind === kind);
        if (ofKind.length === 0) continue;
        const im = new InstancedMesh(treeGeo(kind, near), material, ofKind.length);
        im.name = `arbres-${kind}-${near ? "proche" : "loin"}`;
        im.castShadow = near && q.shadows && kind !== "buisson";
        im.receiveShadow = near;
        ofKind.forEach((t, i) => {
          const y = hf ? heightAt(hf, t.x, t.y) - 0.2 : 0;
          im.setMatrixAt(i, m.compose(new Vector3(t.x - cx, y, t.y - cz), quat.setFromAxisAngle(up, t.r), new Vector3(t.s, t.s * (0.9 + ((t.r * 3.1) % 0.25)), t.s)));
          im.setColorAt(i, tint(kind, f, (t.r * 0.159) % 1));
        });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        level.add(im);
        if (near) counts[kind] += ofKind.length;
      }
      lod.addLevel(level, near ? 0 : q.near);
    }
    lod.addLevel(new Object3D(), q.far);
    lods.push(lod);
    group.add(lod);
  }
  return {
    group,
    counts,
    lods,
    material,
    dispose() {
      material.dispose();
      group.traverse((o) => {
        if (o instanceof InstancedMesh) o.dispose();
      });
    },
  };
}

/** Haies : un tronçon de haie bosselé, instancié le long des segments, étiré à la longueur de chaque morceau. */
let HEDGE_GEO: BufferGeometry | null = null;
function hedgeGeo(): BufferGeometry {
  if (HEDGE_GEO) return HEDGE_GEO;
  const fb = new FaceBuilder();
  for (let k = 0; k < 4; k++) fb.geometry(new IcosahedronGeometry(1, 0), m4(-0.375 + k * 0.25, 0.8, 0, [0.2, 0.85 + (k % 2) * 0.15, 0.75]), LEAF.clone().multiplyScalar(0.9 + (k % 2) * 0.1));
  HEDGE_GEO = fb.build();
  return HEDGE_GEO;
}

export function buildHedges(hedges: readonly Hedge[], hf: Heightfield | null, color: string, shadows: boolean): InstancedMesh | null {
  const pieces: { x: number; y: number; a: number; L: number }[] = [];
  for (const h of hedges) {
    const L = Math.hypot(h.b.x - h.a.x, h.b.y - h.a.y);
    const n = Math.max(1, Math.ceil(L / 6));
    const a = Math.atan2(h.b.y - h.a.y, h.b.x - h.a.x);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      pieces.push({ x: h.a.x + (h.b.x - h.a.x) * t, y: h.a.y + (h.b.y - h.a.y) * t, a, L: L / n });
    }
  }
  if (pieces.length === 0) return null;
  const im = new InstancedMesh(hedgeGeo(), new MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), pieces.length);
  im.name = "haies";
  im.castShadow = shadows;
  im.receiveShadow = true;
  const m = new Matrix4();
  const quat = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const base = new Color(color);
  pieces.forEach((p, i) => {
    const y = hf ? heightAt(hf, p.x, p.y) - 0.15 : 0;
    const k = Math.sin(p.x * 0.37 + p.y * 0.21);
    im.setMatrixAt(i, m.compose(new Vector3(p.x, y, p.y), quat.setFromAxisAngle(up, -p.a), new Vector3(p.L * 1.02, 1.5 + 0.35 * k, 1.3)));
    im.setColorAt(i, base.clone().multiplyScalar(0.9 + 0.15 * k));
  });
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}
