import type { RoofCover, Species } from "../../../data/placeSchema";
import type { HouseInst, PlaceLayout, TreeInst2 } from "./layout";
import { hashStr } from "./geom";

/**
 * Instances d'un lieu (R1e, consigne §2.3) : chaque maison est décomposée en pièces d'archétype (rez-de-chaussée, étages, toit
 * d'une forme, pignons, cheminées, lucarnes, gravats), chaque arbre en instance de son essence. Calcul pur (sans three.js) :
 * - matrices 4 × 4 (colonnes) : translation, rotation autour de la verticale, échelle (largeur, hauteur, profondeur) ;
 * - teinte sRGB (0–1) et quatre valeurs d'information (variante, étages, boutique, ruine) lues par le shader des façades ;
 * - rangées par lot (`kind|matière`) puis par tronçon de 64 m : le rendu copie les tronçons visibles dans un `InstancedMesh`
 *   par lot. L'empreinte de rendu (CR1e-09) est calculée ici : même plan → mêmes lots → même empreinte.
 * Repère : plan (x, y) → monde (x, altitude, y) ; rotation `ry` = −angle du plan.
 */
export type PartKind = "rdc" | "etages" | "toit" | "pignon" | "cheminee" | "lucarne" | "lucarne_toit" | "gravats" | "arbre";
export const ROOF_GEOS = ["pignon_x", "pignon_z", "croupe", "croupe_z", "demi_croupe", "mansarde", "plat", "appentis", "pavillon"] as const;
export type RoofGeo = (typeof ROOF_GEOS)[number];
export const GABLE_GEOS = ["gable_x", "gable_z", "gable_demi", "gable_mansarde", "gable_appentis"] as const;
export type GableGeo = (typeof GABLE_GEOS)[number];

export interface Batch {
  key: string;
  kind: PartKind;
  /** Géométrie (forme de toit, de pignon, essence et niveau de détail…) et matière (façade, couverture). */
  geo: string;
  mat: string;
  /** Pièce de détail (cheminées, lucarnes) : seulement dans les tronçons proches. */
  nearOnly: boolean;
  chunks: Map<number, { m: number[]; c: number[]; i: number[] }>;
  count: number;
}

export type Batches = Map<string, Batch>;

/** Débord de toit (m) : en bas de pente et sur les pignons. */
export const EAVE = 0.45;
export const VERGE = 0.3;

const srgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Teintes des couvertures (sRGB), parcourues par maison : la texture est en niveaux de gris. */
export const ROOF_TINTS: Record<RoofCover, string[]> = {
  tuile_plate: ["#9b4f34", "#8a4630", "#a65a3a", "#7d4130", "#b0653f", "#93503a", "#6f3c2c"],
  tuile_canal: ["#b46a43", "#a65f3c", "#c07a4f", "#9a5638", "#b9714a"],
  ardoise: ["#5b636b", "#525a62", "#646b70", "#4d545b", "#5f666d"],
  bardeau: ["#7a6650", "#6e5c48", "#857058", "#665543"],
  chaume: ["#9a8a5e", "#8d7e55", "#a39366", "#857650"],
  cuivre: ["#5f8f7d", "#6a9a86", "#567f70"],
  terrasse: ["#6d6a63", "#77736b", "#625f59"],
};

function mat4(x: number, y: number, z: number, ry: number, sx: number, sy: number, sz: number): number[] {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  // Colonnes de T · Ry · S.
  return [c * sx, 0, -s * sx, 0, 0, sy, 0, 0, s * sz, 0, c * sz, 0, x, y, z, 1];
}

export function emptyBatches(): Batches {
  return new Map();
}

function push(B: Batches, kind: PartKind, geo: string, mat: string, nearOnly: boolean, chunk: number, m: number[], c: readonly number[], info: readonly number[]): void {
  const key = `${kind}|${geo}|${mat}`;
  let b = B.get(key);
  if (!b) {
    b = { key, kind, geo, mat, nearOnly, chunks: new Map(), count: 0 };
    B.set(key, b);
  }
  let ch = b.chunks.get(chunk);
  if (!ch) {
    ch = { m: [], c: [], i: [] };
    b.chunks.set(chunk, ch);
  }
  ch.m.push(...m);
  ch.c.push(...c);
  ch.i.push(...info);
  b.count++;
}

const frac = (x: number): number => x - Math.floor(x);

/** Forme de toit → géométrie (repère de la maison : x le long de la façade, z vers l'intérieur de l'îlot). */
function roofGeo(h: HouseInst): { roof: RoofGeo; gable: GableGeo | null; alongX: boolean; span: number; rise: number } {
  const tp = Math.tan((h.pitch * Math.PI) / 180);
  switch (h.roof) {
    case "pignon":
      return { roof: "pignon_x", gable: "gable_x", alongX: true, span: h.d, rise: (h.d / 2) * tp };
    case "pignon_rue":
      return { roof: "pignon_z", gable: "gable_z", alongX: false, span: h.w, rise: (h.w / 2) * tp };
    case "croupe":
    case "pavillon": {
      const alongX = h.w >= h.d;
      const span = alongX ? h.d : h.w;
      return { roof: h.roof === "pavillon" ? "pavillon" : "croupe", gable: null, alongX, span, rise: (span / 2) * tp };
    }
    case "demi_croupe":
      return { roof: "demi_croupe", gable: "gable_demi", alongX: true, span: h.d, rise: (h.d / 2) * tp };
    case "mansarde":
      return { roof: "mansarde", gable: "gable_mansarde", alongX: true, span: h.d, rise: h.d * 0.42 };
    case "appentis":
      return { roof: "appentis", gable: "gable_appentis", alongX: true, span: h.d, rise: h.d * tp };
    case "plat":
      return { roof: "plat", gable: null, alongX: true, span: h.d, rise: 0.6 };
  }
}

/** Pièces d'une maison courante. */
export function addHouse(B: Batches, h: HouseInst): void {
  const ry = -h.a;
  const variant = hashStr(h.id) % 4;
  const ruin = h.ruin;
  const floors = ruin > 0 ? Math.max(1, Math.round(h.floors * (1 - 0.75 * ruin))) : h.floors;
  const H = floors * h.fh;
  const tint = srgb(h.tint);
  const soot = ruin > 0 ? 0.55 : 1;
  const ct = [tint[0] * soot, tint[1] * soot, tint[2] * soot];
  // Rez-de-chaussée et étages : boîtes unité mises à l'échelle (le shader recale les fenêtres sur la taille réelle).
  push(B, "rdc", "boite", h.facade, false, h.chunk, mat4(h.x, 0, h.y, ry, h.w, h.fh, h.d), ct, [variant, 1, h.shop ? 1 : 0, ruin]);
  if (floors > 1) push(B, "etages", "boite", h.facade, false, h.chunk, mat4(h.x, h.fh, h.y, ry, h.w, H - h.fh, h.d), ct, [variant, floors - 1, 0, ruin]);
  if (ruin > 0.3) {
    // Ruine : pas de toit, gravats au pied (tas mis à l'échelle de l'emprise).
    push(B, "gravats", "tas", "gravats", false, h.chunk, mat4(h.x, 0, h.y, ry, h.w * 1.15, 1.2 + 2.2 * ruin, h.d * 1.15), [0.55, 0.5, 0.45], [variant, 0, 0, ruin]);
    return;
  }
  const g = roofGeo(h);
  const tp = Math.tan((h.pitch * Math.PI) / 180);
  const drop = g.roof === "plat" ? 0 : EAVE * (g.roof === "mansarde" ? 2.5 : tp);
  const tints = ROOF_TINTS[h.cover];
  const rt = srgb(tints[hashStr(`${h.id}t`) % tints.length] as string);
  const shade = 0.9 + 0.2 * frac(hashStr(h.id) / 997);
  const rc = [rt[0] * shade, rt[1] * shade, rt[2] * shade];
  const sx = g.alongX ? h.w + 2 * VERGE : h.w + 2 * EAVE;
  const sz = g.alongX ? h.d + 2 * EAVE : h.d + 2 * VERGE;
  if (g.roof === "plat") {
    push(B, "toit", "plat", h.cover, false, h.chunk, mat4(h.x, H, h.y, ry, h.w, g.rise, h.d), rc, [0, 0, 0, 0]);
  } else {
    const geo = g.roof === "croupe" && !g.alongX ? "croupe_z" : g.roof;
    push(B, "toit", geo, h.cover, false, h.chunk, mat4(h.x, H - drop, h.y, ry, sx, g.rise + drop, sz), rc, [0, 0, 0, 0]);
  }
  if (g.gable) push(B, "pignon", g.gable, h.facade, false, h.chunk, mat4(h.x, H, h.y, ry, h.w, g.rise, h.d), ct, [variant, 0, 0, 0]);
  // Cheminées (une ou deux, près du faîtage), lucarnes (pente sur rue d'un toit raide et assez profond).
  const n = 1 + (hashStr(`${h.id}c`) % 2);
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const local = (u: number, v: number): [number, number] => [h.x + u * c + v * s, h.y - u * s + v * c];
  for (let k = 0; k < n; k++) {
    const off = (k === 0 ? -0.22 : 0.27) * (g.alongX ? h.w : h.d);
    const [u, v] = g.alongX ? [off, h.d * 0.08] : [h.w * 0.08, off];
    const [px, pz] = local(u, v);
    const top = H + g.rise * (g.roof === "plat" ? 1 : 0.86) + 1.1;
    push(B, "cheminee", "cheminee", "brique", true, h.chunk, mat4(px, H + g.rise * 0.4, pz, ry, 0.75, top - (H + g.rise * 0.4), 0.95), [0.62, 0.38, 0.3], [0, 0, 0, 0]);
  }
  if (g.alongX && (g.roof === "pignon_x" || g.roof === "mansarde" || g.roof === "demi_croupe") && h.pitch >= 42 && h.d >= 9 && h.w >= 5.5) {
    const nd = h.w >= 11 ? 2 : 1;
    for (let k = 0; k < nd; k++) {
      const u = nd === 1 ? 0 : (k === 0 ? -0.25 : 0.25) * h.w;
      const v = -h.d * 0.18;
      const [px, pz] = local(u, v);
      const y = H + (g.roof === "mansarde" ? g.rise * 0.2 : g.rise * 0.28);
      push(B, "lucarne", "lucarne", h.facade, true, h.chunk, mat4(px, y, pz, ry, 1.4, 1.9, 2.2), ct, [variant, 0, 0, 0]);
      push(B, "lucarne_toit", "lucarne_toit", h.cover, true, h.chunk, mat4(px, y, pz, ry, 1.4, 1.9, 2.2), rc, [0, 0, 0, 0]);
    }
  }
}

/**
 * Essence → forme : largeur relative du houppier (`aspect`, le peuplier d'Italie est étroit) et hauteur de la géométrie de
 * référence (m) : l'instance est mise à l'échelle hauteur / `ref`.
 */
export const TREE_FORM: Record<Species, { aspect: number; ref: number }> = {
  tilleul: { aspect: 1, ref: 10.8 },
  marronnier: { aspect: 1.08, ref: 10.8 },
  chene: { aspect: 1.2, ref: 10.8 },
  erable: { aspect: 0.95, ref: 10.8 },
  peuplier: { aspect: 0.38, ref: 10.8 },
  bouleau: { aspect: 0.7, ref: 10.8 },
  pin: { aspect: 1, ref: 12 },
  saule: { aspect: 1.25, ref: 10.8 },
  fruitier: { aspect: 1, ref: 5.6 },
  geant: { aspect: 1, ref: 10.8 },
};

export function addTree(B: Batches, t: TreeInst2, tint: readonly number[]): void {
  const f = TREE_FORM[t.sp];
  const k = t.h / f.ref;
  push(B, "arbre", t.sp, t.sp, false, t.chunk, mat4(t.x, -0.15, t.y, t.rot, k * f.aspect, k, k * f.aspect), tint, [0, 0, 0, 0]);
}

/** Teinte de feuillage d'une essence (sRGB), nuancée par arbre. */
export const SPECIES_TINT: Record<Species, string> = {
  tilleul: "#7e9a4c",
  marronnier: "#5f7f3c",
  chene: "#62773a",
  erable: "#7a9444",
  peuplier: "#6f8f45",
  bouleau: "#94aa58",
  pin: "#3f5a35",
  saule: "#8aa45a",
  fruitier: "#7c9a4a",
  geant: "#4e6a36",
};

export function placeBatches(L: PlaceLayout): Batches {
  const B = emptyBatches();
  for (const h of L.houses) addHouse(B, h);
  for (const t of L.trees) {
    const base = srgb(SPECIES_TINT[t.sp]);
    const k = 0.86 + 0.28 * frac(t.rot * 0.37);
    addTree(B, t, [base[0] * k, base[1] * k, base[2] * k]);
  }
  return B;
}

/** Empreinte de rendu (FNV-1a sur les lots triés, valeurs arrondies au millième). */
export function batchesHash(B: Batches): string {
  let h = 0x811c9dc5;
  const mix = (v: number): void => {
    h ^= v | 0;
    h = Math.imul(h, 0x01000193);
  };
  for (const key of [...B.keys()].sort()) {
    const b = B.get(key) as Batch;
    for (let i = 0; i < key.length; i++) mix(key.charCodeAt(i));
    for (const ck of [...b.chunks.keys()].sort((x, y) => x - y)) {
      mix(ck);
      const ch = b.chunks.get(ck) as Batch["chunks"] extends Map<number, infer V> ? V : never;
      for (const arr of [ch.m, ch.c, ch.i]) for (const v of arr) mix(Math.round(v * 1000));
    }
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function batchCounts(B: Batches): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of B.values()) out[b.kind] = (out[b.kind] ?? 0) + b.count;
  return out;
}
