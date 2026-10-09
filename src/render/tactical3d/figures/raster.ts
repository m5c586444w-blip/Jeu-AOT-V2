import { Color, Vector3 } from "three";
import type { BufferGeometry, Mesh, MeshStandardMaterial, Object3D, SkinnedMesh } from "three";
import type { HumanBody } from "../humanBase";

/**
 * Rendu hors écran de silhouettes (R3, CR3-04), sans WebGL : les triangles posés (peau articulée calculée au processeur) sont
 * tramés dans une grille de face (x, y) et de profil (z, y), ramenés à la même hauteur et centrés. Chaque case garde l'étiquette
 * du triangle qui la couvre (teinte, pour les tenues) ; le recouvrement est l'intersection sur l'union. Outil de contrôle
 * (tests de R3) : aucune scène ne l'importe.
 */
export interface Tris {
  pos: number[];
  label: number[];
}

export function trisOfBody(body: HumanBody, prefix = "peau_", out: Tris = { pos: [], label: [] }, label = 1): Tris {
  body.group.updateMatrixWorld(true);
  body.skeleton.update();
  for (const m of body.meshes.values()) if (m.name.startsWith(prefix)) trisOfMesh(m, out, label, true);
  return out;
}

export function trisOfMesh(m: Mesh | SkinnedMesh, out: Tris, label: number, skinned = false): Tris {
  const g = m.geometry;
  const p = g.getAttribute("position");
  const v = new Vector3();
  const pts: number[] = [];
  for (let i = 0; i < p.count; i++) {
    if (skinned) (m as SkinnedMesh).getVertexPosition(i, v);
    else v.fromBufferAttribute(p, i);
    v.applyMatrix4(m.matrixWorld);
    pts.push(v.x, v.y, v.z);
  }
  const idx = g.index ? Array.from(g.index.array) : Array.from({ length: p.count }, (_, i) => i);
  for (const i of idx) out.pos.push(pts[i * 3] as number, pts[i * 3 + 1] as number, pts[i * 3 + 2] as number);
  for (let t = 0; t < idx.length / 3; t++) out.label.push(label);
  return out;
}

/** Triangles d'une géométrie à couleurs de sommet : étiquette = teinte quantifiée (même tenue = mêmes étiquettes). */
export function trisOfColored(g: BufferGeometry): Tris {
  const p = g.getAttribute("position");
  const c = g.getAttribute("color");
  const out: Tris = { pos: [], label: [] };
  const idx = g.index ? Array.from(g.index.array) : Array.from({ length: p.count }, (_, i) => i);
  for (let k = 0; k < idx.length; k += 3) {
    const i0 = idx[k] as number;
    for (const i of [i0, idx[k + 1] as number, idx[k + 2] as number]) out.pos.push(p.getX(i), p.getY(i), p.getZ(i));
    const q = (x: number): number => Math.round(x * 15);
    out.label.push(c ? 1 + q(c.getX(i0)) * 256 + q(c.getY(i0)) * 16 + q(c.getZ(i0)) : 1);
  }
  return out;
}

export const labelOf = (c: Color): number => 1 + Math.round(c.r * 15) * 256 + Math.round(c.g * 15) * 16 + Math.round(c.b * 15);

/** Grille de face puis de profil (N × N chacune), ramenée à la hauteur de la figure. */
export function silhouette(t: Tris, N = 128): Int32Array {
  let y0 = Infinity;
  let y1 = -Infinity;
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < t.pos.length; i += 3) {
    const x = t.pos[i] as number;
    const y = t.pos[i + 1] as number;
    const z = t.pos[i + 2] as number;
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  const s = (N - 1) / Math.max(1e-6, y1 - y0);
  const grid = new Int32Array(2 * N * N);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  for (let view = 0; view < 2; view++) {
    for (let k = 0; k < t.label.length; k++) {
      const P: [number, number][] = [];
      for (let j = 0; j < 3; j++) {
        const b = (k * 3 + j) * 3;
        const h = view === 0 ? (t.pos[b] as number) - cx : (t.pos[b + 2] as number) - cz;
        P.push([N / 2 + h * s, (y1 - (t.pos[b + 1] as number)) * s]);
      }
      const [a, b, c] = P as [[number, number], [number, number], [number, number]];
      const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
      const maxX = Math.min(N - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
      const maxY = Math.min(N - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-9) continue;
      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          const x = px + 0.5;
          const y = py + 0.5;
          const w0 = ((b[0] - x) * (c[1] - y) - (b[1] - y) * (c[0] - x)) / area;
          const w1 = ((c[0] - x) * (a[1] - y) - (c[1] - y) * (a[0] - x)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 >= 0 && w1 >= 0 && w2 >= 0) grid[view * N * N + py * N + px] = t.label[k] as number;
        }
      }
    }
  }
  return grid;
}

/** Recouvrement de deux silhouettes : intersection / union (cases couvertes ; `sameLabel` : même étiquette exigée). */
export function overlap(a: Int32Array, b: Int32Array, sameLabel = false): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    const p = (a[i] as number) > 0;
    const q = (b[i] as number) > 0;
    if (p || q) union++;
    if (p && q && (!sameLabel || a[i] === b[i])) inter++;
  }
  return union > 0 ? inter / union : 0;
}

/** Triangles visibles d'une figure complète (peau articulée et pièces rigides), étiquetés par la teinte de leur matériau. */
export function trisOfFigure(root: Object3D, skeletonUpdate: () => void): Tris {
  root.updateMatrixWorld(true);
  skeletonUpdate();
  const out: Tris = { pos: [], label: [] };
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return;
    const mat = m.material as MeshStandardMaterial;
    trisOfMesh(m, out, labelOf(mat.color ?? new Color(1, 1, 1)), (m as SkinnedMesh).isSkinnedMesh === true);
  });
  return out;
}
