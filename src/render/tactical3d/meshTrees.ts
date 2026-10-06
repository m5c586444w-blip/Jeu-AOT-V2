import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, IcosahedronGeometry, Matrix4, PlaneGeometry, Quaternion, Vector3 } from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { TreeKind } from "./terrain";

/**
 * Arbres de R1c (rendu réaliste), procéduraux, sans image externe :
 * - houppier en massifs (sphères bosselées par un bruit fixe), normales « sphériques » (tirées du centre du houppier) pour une
 *   lumière douce de volume, assombri vers l'intérieur et le dessous (occlusion cuite dans la couleur) ;
 * - tronc conique et branches maîtresses qui montent dans le houppier ;
 * - au niveau proche, cartes de feuillage (quads) à la surface des massifs, que la texture de feuilles découpe (test alpha) ;
 * - conifères en étages de branches retombantes, à contour dentelé ; arbre mort en fourches ; buisson bas.
 * Chaque géométrie porte position, normale, couleur, coordonnées de texture ; l'instance la teinte (feuillage).
 */
export interface TreeParts {
  /** Tronc et branches (teinte d'écorce, non teintés par l'instance) ; `null` sans bois (buisson). */
  wood: BufferGeometry | null;
  /** Massifs du houppier (teintés par l'instance). */
  solid: BufferGeometry;
  /** Cartes de feuillage (niveau proche) ; `null` sans feuillage. */
  cards: BufferGeometry | null;
}

/** Bruit de valeur 3D à graine fixe (aucun aléa à l'exécution). */
function hash(x: number, y: number, z: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function noise(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const f = (t: number): number => t * t * (3 - 2 * t);
  const u = f(x - xi);
  const v = f(y - yi);
  const w = f(z - zi);
  const l = (a: number, b: number, t: number): number => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number): number => hash(xi + dx, yi + dy, zi + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}

const BARK = new Color(0.5, 0.42, 0.34);
const LEAF = new Color(1, 1, 1);

/** Ajoute couleur et coordonnées de texture uniformes, garde position et normale, sans index (fusion homogène). */
function finish(g: BufferGeometry, color: (p: Vector3, n: Vector3) => Color): BufferGeometry {
  const x = g.index ? g.toNonIndexed() : g;
  const pos = x.getAttribute("position");
  const nor = x.getAttribute("normal");
  const col = new Float32Array(pos.count * 3);
  const p = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    const c = color(p.fromBufferAttribute(pos, i), n.fromBufferAttribute(nor, i));
    col.set([c.r, c.g, c.b], i * 3);
  }
  const out = new BufferGeometry();
  out.setAttribute("position", pos);
  out.setAttribute("normal", nor);
  out.setAttribute("color", new BufferAttribute(col, 3));
  out.setAttribute("uv", x.getAttribute("uv") ?? new BufferAttribute(new Float32Array(pos.count * 2), 2));
  return out;
}

/** Segment de bois : cylindre effilé de `a` à `b`. */
function limb(a: Vector3, b: Vector3, r0: number, r1: number, seg: number): BufferGeometry {
  const d = b.clone().sub(a);
  const g = new CylinderGeometry(r1, r0, d.length(), seg, 1, true);
  g.applyMatrix4(new Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()), new Vector3(1, 1, 1)));
  return finish(g, () => BARK);
}

interface Lump {
  c: Vector3;
  r: Vector3;
}

/**
 * Massif de feuillage : sphère bosselée ; normale mêlée à la direction depuis le centre du houppier `crown` (volume doux) ;
 * teinte assombrie vers le bas et vers l'intérieur.
 */
function lump(l: Lump, crown: Vector3, crownR: number, detail: number, salt: number): BufferGeometry {
  // Sommets fusionnés avant le calcul des normales : sinon chaque face garde la sienne (facettes).
  const g = mergeVertices(new IcosahedronGeometry(1, detail).deleteAttribute("normal").deleteAttribute("uv"));
  const pos = g.getAttribute("position");
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 0.78 + 0.42 * noise(v.x * 2.1 + salt, v.y * 2.1, v.z * 2.1);
    v.multiplyScalar(k).multiply(l.r).add(l.c);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const nor = g.getAttribute("normal");
  const s = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    s.fromBufferAttribute(pos, i).sub(crown).normalize();
    v.fromBufferAttribute(nor, i).lerp(s, 0.7).normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  // Le massif est l'intérieur du houppier, vu entre les cartes : plus sombre que les feuilles de surface.
  return finish(g, (p) => shadeLeaf(p, crown, crownR).multiplyScalar(0.62));
}

function shadeLeaf(p: Vector3, crown: Vector3, crownR: number): Color {
  const out = Math.min(1, p.distanceTo(crown) / crownR);
  const up = Math.max(0, Math.min(1, 0.5 + (p.y - crown.y) / (2 * crownR)));
  return LEAF.clone().multiplyScalar(0.36 + 0.3 * out + 0.22 * up);
}

/** Cartes de feuillage posées à la surface des massifs, face à l'extérieur, tournées au hasard (fixe). */
function cards(lumps: Lump[], crown: Vector3, crownR: number, perLump: number, size: number, salt: number): BufferGeometry {
  const list: BufferGeometry[] = [];
  let k = 0;
  for (const l of lumps) {
    for (let i = 0; i < perLump; i++, k++) {
      const a = hash(k, salt, 1) * Math.PI * 2;
      const e = Math.asin(hash(k, salt, 2) * 1.6 - 0.6);
      const dir = new Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a));
      const at = l.c.clone().add(dir.clone().multiply(l.r).multiplyScalar(0.85 + 0.25 * hash(k, salt, 3)));
      const s = size * (0.75 + 0.5 * hash(k, salt, 4));
      const g = new PlaneGeometry(s, s);
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), dir).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), hash(k, salt, 5) * Math.PI * 2));
      g.applyMatrix4(new Matrix4().compose(at, q, new Vector3(1, 1, 1)));
      // Normales du volume (depuis le centre du houppier) : la carte s'éclaire comme le massif qu'elle habille.
      const nor = g.getAttribute("normal");
      const p = new Vector3();
      const pos = g.getAttribute("position");
      for (let j = 0; j < pos.count; j++) {
        p.fromBufferAttribute(pos, j).sub(crown).normalize();
        nor.setXYZ(j, p.x, p.y, p.z);
      }
      list.push(finish(g, (pp) => shadeLeaf(pp, crown, crownR)));
    }
  }
  return merge(list);
}

function merge(list: BufferGeometry[]): BufferGeometry {
  const m = mergeGeometries(list);
  if (!m) throw new Error("arbre : fusion impossible");
  for (const g of list) g.dispose();
  return m;
}

/** Houppier en massifs autour d'un centre, branches maîtresses du haut du tronc vers chaque massif. */
function broadleaf(near: boolean, o: { trunkH: number; trunkR: number; crownY: number; crownR: number; lumps: number; flat: number; salt: number }): TreeParts {
  const wood: BufferGeometry[] = [];
  const parts: BufferGeometry[] = [];
  const top = new Vector3(0, o.trunkH, 0);
  wood.push(limb(new Vector3(0, -0.3, 0), top, o.trunkR, o.trunkR * 0.62, near ? 8 : 5));
  const crown = new Vector3(0, o.crownY, 0);
  const lumps: Lump[] = [{ c: crown.clone(), r: new Vector3(o.crownR * 0.72, o.crownR * 0.62 * o.flat, o.crownR * 0.72) }];
  const n = near ? o.lumps : Math.min(3, o.lumps);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(i, o.salt, 7) * 0.8;
    const rr = o.crownR * (0.45 + 0.2 * hash(i, o.salt, 8));
    const y = o.crownY + o.crownR * (hash(i, o.salt, 9) - 0.35) * 0.7 * o.flat;
    const s = o.crownR * (0.42 + 0.18 * hash(i, o.salt, 10));
    lumps.push({ c: new Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr), r: new Vector3(s, s * 0.85 * o.flat, s) });
  }
  if (near)
    for (const l of lumps.slice(1)) {
      const b = l.c.clone().multiplyScalar(0.7).setY(l.c.y - 0.25 * l.r.y);
      wood.push(limb(top.clone().setY(o.trunkH * 0.9), b, o.trunkR * 0.45, o.trunkR * 0.15, 5));
    }
  for (const [i, l] of lumps.entries()) parts.push(lump(l, crown, o.crownR, near ? 1 : 0, o.salt + i * 3.7));
  return { wood: merge(wood), solid: merge(parts), cards: near ? cards(lumps, crown, o.crownR, 20, o.crownR * 0.72, o.salt) : null };
}

function conifer(near: boolean): TreeParts {
  const wood = limb(new Vector3(0, -0.3, 0), new Vector3(0, 11.5, 0), 0.3, 0.06, near ? 7 : 4);
  const parts: BufferGeometry[] = [];
  const tiers = near ? 7 : 3;
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1);
    const y0 = 2.2 + k * 8.4;
    const r = 3.1 * (1 - k * 0.82);
    const h = (near ? 2.3 : 4) * (1 - k * 0.35);
    // Étage de branches retombantes : un cône à contour dentelé (pointes et creux alternés), bord abaissé.
    const seg = near ? 14 : 7;
    const pos: number[] = [];
    const ring = (rad: number, y: number, jag: boolean): Vector3[] =>
      Array.from({ length: seg }, (_, i) => {
        const a = (i / seg) * Math.PI * 2 + t * 0.7;
        const rj = rad * (jag ? (i % 2 ? 0.68 : 1) * (0.9 + 0.2 * hash(i, t, 3)) : 1);
        return new Vector3(Math.cos(a) * rj, y - (jag ? 0.35 * (i % 2 ? 0 : 1) : 0), Math.sin(a) * rj);
      });
    const apex = new Vector3(0, y0 + h, 0);
    const rim = ring(r, y0, true);
    const under = new Vector3(0, y0 + h * 0.25, 0);
    for (let i = 0; i < seg; i++) {
      const a = rim[i] as Vector3;
      const b = rim[(i + 1) % seg] as Vector3;
      pos.push(apex.x, apex.y, apex.z, b.x, b.y, b.z, a.x, a.y, a.z);
      pos.push(under.x, under.y, under.z, a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.computeVertexNormals();
    // Normale de volume : vers l'extérieur du fût et vers le haut.
    const nor = g.getAttribute("normal");
    const pp = g.getAttribute("position");
    const v = new Vector3();
    for (let i = 0; i < pp.count; i++) {
      v.fromBufferAttribute(pp, i).setY(0).normalize().multiplyScalar(0.8).setY(0.6).normalize();
      nor.setXYZ(i, v.x, v.y, v.z);
    }
    parts.push(finish(g, (p) => LEAF.clone().multiplyScalar(0.45 + 0.4 * Math.min(1, Math.hypot(p.x, p.z) / Math.max(0.5, r)) + 0.15 * k)));
  }
  return { wood, solid: merge(parts), cards: null };
}

function dead(near: boolean): TreeParts {
  const parts: BufferGeometry[] = [limb(new Vector3(0, -0.3, 0), new Vector3(0.2, 7.2, 0), 0.36, 0.12, near ? 7 : 4)];
  if (near) {
    // Fourches : trois branches maîtresses, chacune refendue en deux.
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + 0.4;
      const base = new Vector3(0.1, 3.8 + i * 1.1, 0);
      const tip = base.clone().add(new Vector3(Math.cos(a) * 2.4, 2 + i * 0.4, Math.sin(a) * 2.4));
      parts.push(limb(base, tip, 0.14, 0.07, 5));
      for (const s of [-0.5, 0.6]) parts.push(limb(tip, tip.clone().add(new Vector3(Math.cos(a + s) * 1.3, 1.1, Math.sin(a + s) * 1.3)), 0.07, 0.02, 4));
    }
  }
  // Arbre mort : tout est bois ; un reste de mousse sombre (teinte de l'instance) au pied.
  const moss = lump({ c: new Vector3(0, 0.15, 0), r: new Vector3(0.6, 0.25, 0.6) }, new Vector3(0, 0.3, 0), 0.6, 0, 21);
  return { wood: merge(parts), solid: moss, cards: null };
}

function bush(near: boolean): TreeParts {
  const crown = new Vector3(0, 0.75, 0);
  const lumps: Lump[] = [
    { c: crown.clone(), r: new Vector3(1.3, 0.85, 1.2) },
    { c: new Vector3(0.8, 0.55, 0.4), r: new Vector3(0.85, 0.65, 0.85) },
    { c: new Vector3(-0.7, 0.5, -0.3), r: new Vector3(0.8, 0.6, 0.8) },
  ];
  const used = near ? lumps : lumps.slice(0, 1);
  const parts = used.map((l, i) => lump(l, crown, 1.4, near ? 1 : 0, 11 + i));
  return { wood: null, solid: merge(parts), cards: near ? cards(used, crown, 1.4, 12, 0.95, 5) : null };
}

/** Géométries d'une essence à un niveau de détail (mêmes dimensions que les arbres de R1b : l'instance les met à l'échelle). */
/** Massif unité (rayon 1, au centre), lisse et assombri vers le bas : voûte des Arbres Géants (instanciée, mise à l'échelle). */
export function unitLump(detail: number, salt: number): BufferGeometry {
  return lump({ c: new Vector3(0, 0, 0), r: new Vector3(1, 1, 1) }, new Vector3(0, -0.2, 0), 1.1, detail, salt);
}

/** Cartes de feuillage d'un massif unité. */
export function unitLumpCards(perLump: number, size: number, salt: number): BufferGeometry {
  return cards([{ c: new Vector3(0, 0, 0), r: new Vector3(1, 1, 1) }], new Vector3(0, -0.2, 0), 1.1, perLump, size, salt);
}

/** Cartes de feuillage le long d'un tronçon de haie (longueur 1, centré, comme le tronçon instancié). */
export function hedgeCards(): BufferGeometry {
  const lumps: Lump[] = [0, 1, 2, 3].map((k) => ({ c: new Vector3(-0.375 + k * 0.25, 0.8, 0), r: new Vector3(0.2, 0.9, 0.75) }));
  return cards(lumps, new Vector3(0, 0.7, 0), 0.9, 10, 0.55, 9);
}

export function realisticTree(kind: TreeKind, near: boolean): TreeParts {
  switch (kind) {
    case "feuillu":
      return broadleaf(near, { trunkH: 5.6, trunkR: 0.36, crownY: 7.6, crownR: 3.6, lumps: 6, flat: 0.9, salt: 1.3 });
    case "fruitier":
      return broadleaf(near, { trunkH: 2.3, trunkR: 0.2, crownY: 3.4, crownR: 2.1, lumps: 4, flat: 0.8, salt: 4.1 });
    case "conifere":
      return conifer(near);
    case "mort":
      return dead(near);
    case "buisson":
      return bush(near);
  }
}
