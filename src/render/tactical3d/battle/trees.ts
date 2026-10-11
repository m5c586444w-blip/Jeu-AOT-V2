import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, Matrix4, Quaternion, Vector3 } from "three";

/**
 * Arbres de la bataille 3D (03 §2 : Forêt des Arbres Géants, troncs d'environ 80 m). Le fût garde le rayon de la simulation
 * au pied (emprise testée à ± 0,1 m) ; au-dessus, choix de rendu (A) : fût effilé à côtes d'écorce (sillons plus sombres),
 * contreforts racinaires, grosses branches maîtresses et houppier en plusieurs masses pour les arbres géants.
 */

/** Fût unitaire (hauteur 1, rayon 1 au pied, 0,6 au sommet), côtes d'écorce creusées vers l'intérieur (jamais au-delà de 1). */
export function trunkGeometry(): BufferGeometry {
  // 20 côtés (multiple de 4) : l'anneau du pied touche le rayon 1 sur les deux axes (emprise mesurée sur la boîte).
  const g = new CylinderGeometry(0.6, 1, 1, 20, 8).translate(0, 0.5, 0);
  const pos = g.getAttribute("position") as BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z);
    if (r > 1e-6) {
      const a = Math.atan2(v.z, v.x);
      // Sept côtes : creux de 8 % du rayon entre deux côtes, plus marqués au pied (évasement des racines).
      const groove = 0.5 + 0.5 * Math.cos(a * 7 + v.y * 1.3);
      // L'anneau du pied reste plein (rayon 1) : l'emprise au sol est celle de la simulation.
      const k = 1 - 0.08 * groove * (1 - 0.4 * v.y) * Math.min(1, v.y / 0.06);
      pos.setXYZ(i, v.x * k, v.y, v.z * k);
      const shade = 0.72 + 0.28 * (1 - groove);
      colors.set([shade, shade, shade], i * 3);
    } else colors.set([0.85, 0.85, 0.85], i * 3);
  }
  g.setAttribute("color", new BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Contrefort racinaire unitaire : lame triangulaire (x : de 0 à 1 vers l'extérieur ; y : 1 au fût, 0 au bout ; z : ± 0,5). */
export function buttressGeometry(): BufferGeometry {
  const p = [
    [0, 0, -0.5],
    [1, 0, -0.15],
    [0, 1, -0.3],
    [0, 0, 0.5],
    [1, 0, 0.15],
    [0, 1, 0.3],
  ] as const;
  const tri = [
    [0, 2, 1],
    [3, 4, 5],
    [0, 1, 4],
    [0, 4, 3],
    [1, 2, 5],
    [1, 5, 4],
    [2, 0, 3],
    [2, 3, 5],
  ];
  const out = new Float32Array(tri.length * 9);
  tri.forEach((t, i) => t.forEach((k, j) => out.set(p[k] as readonly number[], i * 9 + j * 3)));
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(out, 3));
  const colors = new Float32Array((out.length / 3) * 3).fill(0.8);
  g.setAttribute("color", new BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Branche unitaire : cône tronqué le long de +y (longueur 1, rayon 1 à la base). */
export function branchGeometry(): BufferGeometry {
  const g = new CylinderGeometry(0.35, 1, 1, 7, 1).translate(0, 0.5, 0);
  const colors = new Float32Array(g.getAttribute("position").count * 3).fill(0.78);
  g.setAttribute("color", new BufferAttribute(colors, 3));
  return g;
}

export interface TreeParts {
  /** Matrices (monde) des contreforts, des branches et des masses du houppier. */
  roots: Matrix4[];
  branches: Matrix4[];
  crowns: { m: Matrix4; color: Color }[];
}

const UP = new Vector3(0, 1, 0);

/**
 * Pièces d'un arbre au point (x, z) de rayon `r` et de hauteur `h` (m) ; `rand` : aléa du rendu (graine de la vue). Un arbre
 * ordinaire garde un seul houppier ; un arbre géant reçoit 6 contreforts, 5 à 7 branches maîtresses et 4 à 5 masses.
 */
export function treeParts(x: number, z: number, r: number, h: number, giant: boolean, rand: () => number): TreeParts {
  const out: TreeParts = { roots: [], branches: [], crowns: [] };
  const hue = (): Color => new Color().setHSL(0.24 + rand() * 0.06, 0.35 + rand() * 0.15, 0.22 + rand() * 0.1);
  if (!giant) {
    const crownR = Math.max(r * 4, 2.6);
    const trunkH = h * 0.62;
    out.crowns.push({ m: new Matrix4().compose(new Vector3(x, trunkH + crownR * 0.6, z), new Quaternion().setFromAxisAngle(UP, rand() * Math.PI), new Vector3(crownR, crownR * 0.95, crownR)), color: hue() });
    return out;
  }
  const turn = rand() * Math.PI * 2;
  // Contreforts : du bord du fût vers l'extérieur, jusqu'à 1,45 r ; hauteur au fût 9 % de l'arbre (8 m au plus).
  for (let i = 0; i < 6; i++) {
    const a = turn + (i / 6) * Math.PI * 2 + (rand() - 0.5) * 0.4;
    const q = new Quaternion().setFromAxisAngle(UP, -a);
    const along = new Vector3(Math.cos(a), 0, Math.sin(a));
    const at = new Vector3(x, 0, z).addScaledVector(along, r * 0.8);
    out.roots.push(new Matrix4().compose(at, q, new Vector3(r * (0.55 + rand() * 0.2), Math.min(8, h * 0.09) * (0.7 + rand() * 0.3), r * 0.4)));
  }
  // Branches maîtresses : du fût (55 à 80 % de la hauteur) vers l'extérieur et le haut.
  const crownR = Math.max(r * 2.4, 12);
  const nb = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < nb; i++) {
    const a = turn + (i / nb) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    const y = h * (0.55 + rand() * 0.25);
    const len = crownR * (0.8 + rand() * 0.4);
    const pitch = 0.75 + rand() * 0.35;
    const rad = r * (1 - 0.4 * (y / h)) * 0.95;
    // Le repère de la branche : +y local tourné vers l'extérieur (azimut a) et incliné de `pitch` depuis la verticale.
    const dir = new Vector3(Math.sin(pitch) * Math.cos(a), Math.cos(pitch), Math.sin(pitch) * Math.sin(a));
    const qq = new Quaternion().setFromUnitVectors(UP, dir);
    const base = new Vector3(x + Math.cos(a) * rad * 0.6, y, z + Math.sin(a) * rad * 0.6);
    const thick = r * (0.16 + rand() * 0.06);
    out.branches.push(new Matrix4().compose(base, qq, new Vector3(thick, len, thick)));
  }
  // Houppier : une masse au sommet et 3 à 4 autour, au bout des branches hautes, aplaties.
  const top = h * 0.88;
  out.crowns.push({ m: new Matrix4().compose(new Vector3(x, top + crownR * 0.25, z), new Quaternion().setFromAxisAngle(UP, rand() * Math.PI), new Vector3(crownR * 0.8, crownR * 0.5, crownR * 0.8)), color: hue() });
  const nc = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < nc; i++) {
    const a = turn + ((i + 0.5) / nc) * Math.PI * 2;
    const d = crownR * (0.55 + rand() * 0.25);
    const s = crownR * (0.5 + rand() * 0.2);
    out.crowns.push({ m: new Matrix4().compose(new Vector3(x + Math.cos(a) * d, h * (0.72 + rand() * 0.12), z + Math.sin(a) * d), new Quaternion().setFromAxisAngle(UP, rand() * Math.PI), new Vector3(s, s * 0.55, s)), color: hue() });
  }
  return out;
}
