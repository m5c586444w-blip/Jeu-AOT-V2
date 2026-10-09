import { Mesh, Points, SkinnedMesh, Vector3 } from "three";
import type { BufferAttribute, InterleavedBufferAttribute, Object3D } from "three";

/**
 * Silhouettes hors écran (R3, CR3-04 et CR3-05) : rendu logiciel en projection orthographique, sans WebGL. Chaque triangle
 * visible (peau articulée comprise, équipement, cape) est rempli dans un masque binaire, de face (x, y) et de profil (z, y).
 * Le cadre est donné dans le repère du parent de la figure (sa propre échelle compte) : demi-largeur et hauteur (m). Points
 * (vapeur) et objets cachés ignorés.
 */
export interface Mask {
  w: number;
  h: number;
  data: Uint8Array;
}

export interface Frame {
  /** Demi-largeur du cadre (m), centré sur x = 0 (face) ou z = 0 (profil). */
  half: number;
  /** Hauteur du cadre (m), du sol (y = 0) vers le haut. */
  top: number;
}

function visible(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** Rastérise les triangles visibles sous `root` ; `view` : « face » (axe x) ou « profil » (axe z). */
export function silhouette(root: Object3D, view: "face" | "profil", frame: Frame, w: number, h: number): Mask {
  root.updateMatrixWorld(true);
  const data = new Uint8Array(w * h);
  const v = new Vector3();
  // Repère du parent de la figure : sa propre transformation (échelle, rotation) compte.
  const inv = root.parent ? root.parent.matrixWorld.clone().invert() : root.matrixWorld.clone().identity();
  root.traverse((o) => {
    if (o instanceof Points || !(o instanceof Mesh) || !visible(o)) return;
    const g = o.geometry;
    const pos = g.getAttribute("position") as BufferAttribute | InterleavedBufferAttribute | undefined;
    if (!pos) return;
    if (o instanceof SkinnedMesh) o.skeleton.update();
    const n = pos.count;
    const px = new Float32Array(n);
    const py = new Float32Array(n);
    const toRoot = inv.clone().multiply(o.matrixWorld);
    for (let i = 0; i < n; i++) {
      if (o instanceof SkinnedMesh) o.getVertexPosition(i, v);
      else v.fromBufferAttribute(pos, i);
      v.applyMatrix4(toRoot);
      px[i] = (((view === "face" ? v.x : v.z) + frame.half) / (2 * frame.half)) * w;
      py[i] = (1 - v.y / frame.top) * h;
    }
    const idx = g.getIndex();
    const tri = idx ? idx.count / 3 : n / 3;
    const start = g.drawRange.start / 3;
    const end = Math.min(tri, start + (Number.isFinite(g.drawRange.count) ? g.drawRange.count / 3 : tri));
    for (let t = start; t < end; t++) {
      const a = idx ? idx.getX(t * 3) : t * 3;
      const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      fillTriangle(data, w, h, px[a] as number, py[a] as number, px[b] as number, py[b] as number, px[c] as number, py[c] as number);
    }
  });
  return { w, h, data };
}

/** Remplit les pixels dont le centre est dans le triangle (les deux sens de parcours). */
function fillTriangle(data: Uint8Array, w: number, h: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): void {
  const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
  const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
  if (x0 > x1 || y0 > y1) return;
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-9) return;
  const s = area > 0 ? 1 : -1;
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const e0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) * s;
      const e1 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) * s;
      const e2 = ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) * s;
      if (e0 >= 0 && e1 >= 0 && e2 >= 0) data[y * w + x] = 1;
    }
  }
}

/** Silhouette de face et de profil, mises bout à bout (un seul masque à comparer). */
export function silhouettePair(root: Object3D, frame: Frame, w = 96, h = 176): Mask {
  const a = silhouette(root, "face", frame, w, h);
  const b = silhouette(root, "profil", frame, w, h);
  const data = new Uint8Array(w * h * 2);
  data.set(a.data, 0);
  data.set(b.data, w * h);
  return { w, h: h * 2, data };
}

/** Recouvrement de deux silhouettes : intersection / union (1 : identiques, 0 : disjointes). */
export function overlap(a: Mask, b: Mask): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.data.length; i++) {
    const x = a.data[i] as number;
    const y = b.data[i] as number;
    inter += x & y;
    union += x | y;
  }
  return union === 0 ? 0 : inter / union;
}

/** Part des pixels allumés (contrôle : une silhouette vide n'est pas « distincte »). */
export function coverage(m: Mask): number {
  let n = 0;
  for (const x of m.data) n += x;
  return n / m.data.length;
}
