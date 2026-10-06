import { gunzipSync } from "node:zlib";

/**
 * Construction du corps de base de R1c à partir des données CC0 de MakeHuman (outil Node, jamais empaqueté).
 * - Lecture : maillage OBJ (hm08), cibles `.target(.gz)` (décalages épars par sommet), squelette MPFB2 et poids, fichier
 *   d'ajustement de proxy `.mhclo` (yeux).
 * - Corps macro : réimplémentation des règles de pondération de MakeHuman (sexe, âge, musculature, corpulence, origines),
 *   d'après leur description publique ; aucune ligne du code AGPL de MakeHuman n'est reprise.
 * Unités MakeHuman : décimètres, y vers le haut, le personnage regarde vers +z.
 */
export type V3 = [number, number, number];

export interface ObjFace {
  group: string;
  v: number[];
  t: number[];
}

export interface ObjData {
  /** Positions (x, y, z), à plat. */
  pos: Float64Array;
  uv: Float64Array;
  faces: ObjFace[];
}

export function parseObj(text: string): ObjData {
  const pos: number[] = [];
  const uv: number[] = [];
  const faces: ObjFace[] = [];
  let group = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("v ")) {
      const p = line.trim().split(/\s+/);
      pos.push(Number(p[1]), Number(p[2]), Number(p[3]));
    } else if (line.startsWith("vt ")) {
      const p = line.trim().split(/\s+/);
      uv.push(Number(p[1]), Number(p[2]));
    } else if (line.startsWith("g ")) group = line.trim().slice(2).trim();
    else if (line.startsWith("f ")) {
      const parts = line.trim().split(/\s+/).slice(1);
      faces.push({ group, v: parts.map((s) => Number(s.split("/")[0]) - 1), t: parts.map((s) => Number(s.split("/")[1] ?? "0") - 1) });
    }
  }
  return { pos: Float64Array.from(pos), uv: Float64Array.from(uv), faces };
}

/** Cible MakeHuman : indices de sommets et décalages (dm). */
export interface Target {
  idx: Int32Array;
  d: Float64Array;
}

export function parseTarget(buf: Buffer, gz: boolean): Target {
  const text = (gz ? gunzipSync(buf) : buf).toString("utf8");
  const idx: number[] = [];
  const d: number[] = [];
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const p = s.split(/\s+/);
    idx.push(Number(p[0]));
    d.push(Number(p[1]), Number(p[2]), Number(p[3]));
  }
  return { idx: Int32Array.from(idx), d: Float64Array.from(d) };
}

/** Ajoute `w × cible` aux positions. */
export function applyTarget(pos: Float64Array, t: Target, w: number): void {
  if (w === 0) return;
  for (let k = 0; k < t.idx.length; k++) {
    const i = t.idx[k] as number;
    pos[i * 3] = (pos[i * 3] as number) + w * (t.d[k * 3] as number);
    pos[i * 3 + 1] = (pos[i * 3 + 1] as number) + w * (t.d[k * 3 + 1] as number);
    pos[i * 3 + 2] = (pos[i * 3 + 2] as number) + w * (t.d[k * 3 + 2] as number);
  }
}

export const GENDERS = ["female", "male"] as const;
export const AGES = ["young", "old"] as const;
export const LEVELS = ["min", "average", "max"] as const;
export const RACES = ["african", "asian", "caucasian"] as const;

/** Paramètres macro, de 0 à 1 comme les curseurs de MakeHuman (0,5 : valeur moyenne ; âge 0,5 = 25 ans, 1 = 90 ans). */
export interface Macro {
  gender: number;
  age: number;
  muscle: number;
  weight: number;
}
export const DEFAULT_MACRO: Macro = { gender: 0.5, age: 0.5, muscle: 0.5, weight: 0.5 };

/** Poids des trois niveaux (min, moyen, max) d'un curseur. */
export function levelWeights(v: number): [number, number, number] {
  if (v < 0.5) return [(0.5 - v) / 0.5, 1 - (0.5 - v) / 0.5, 0];
  return [0, 1 - (v - 0.5) / 0.5, (v - 0.5) / 0.5];
}

/** Poids des âges jeune et vieux (le corps de base n'utilise pas les cibles enfant et bébé : âge ≥ 0,5). */
export function ageWeights(a: number): [number, number] {
  const v = Math.max(0.5, Math.min(1, a));
  return [(1 - v) / 0.5, (v - 0.5) / 0.5];
}

/** Liste pondérée des cibles macro pour des paramètres donnés (origines à parts égales). */
export function macroTargets(m: Macro): { name: string; w: number }[] {
  const out: { name: string; w: number }[] = [];
  const gw = [1 - m.gender, m.gender];
  const aw = ageWeights(m.age);
  const mw = levelWeights(m.muscle);
  const ww = levelWeights(m.weight);
  GENDERS.forEach((g, gi) => {
    AGES.forEach((a, ai) => {
      const base = (gw[gi] as number) * (aw[ai] as number);
      if (base === 0) return;
      for (const r of RACES) out.push({ name: `macrodetails/${r}-${g}-${a}`, w: base / 3 });
      LEVELS.forEach((ml, mi) => {
        LEVELS.forEach((wl, wi) => {
          const w = base * (mw[mi] as number) * (ww[wi] as number);
          if (w > 0) out.push({ name: `macrodetails/universal-${g}-${a}-${ml}muscle-${wl}weight`, w });
        });
      });
    });
  });
  return out;
}

export function bodyPositions(base: Float64Array, targets: ReadonlyMap<string, Target>, m: Macro): Float64Array {
  const pos = Float64Array.from(base);
  for (const { name, w } of macroTargets(m)) {
    const t = targets.get(name);
    if (!t) throw new Error(`cible manquante : ${name}`);
    applyTarget(pos, t, w);
  }
  return pos;
}

export function meanOf(pos: Float64Array, idx: readonly number[]): V3 {
  const s: V3 = [0, 0, 0];
  for (const i of idx) {
    s[0] += pos[i * 3] as number;
    s[1] += pos[i * 3 + 1] as number;
    s[2] += pos[i * 3 + 2] as number;
  }
  return [s[0] / idx.length, s[1] / idx.length, s[2] / idx.length];
}

/** Sommets de chaque groupe « joint-* » du maillage (petits cubes d'aide qui suivent les cibles). */
export function jointGroups(obj: ObjData): Map<string, number[]> {
  const m = new Map<string, Set<number>>();
  for (const f of obj.faces) {
    if (!f.group.startsWith("joint-")) continue;
    const s = m.get(f.group) ?? new Set<number>();
    for (const v of f.v) s.add(v);
    m.set(f.group, s);
  }
  return new Map([...m.entries()].map(([k, s]) => [k, [...s].sort((a, b) => a - b)] as const));
}

/** Ajustement d'un proxy (`.mhclo`) : chaque sommet = combinaison de trois sommets du corps + décalage mis à l'échelle. */
export interface Mhclo {
  refs: Int32Array;
  weights: Float64Array;
  offsets: Float64Array;
  scale: { x: [number, number, number]; y: [number, number, number]; z: [number, number, number] };
}

export function parseMhclo(text: string): Mhclo {
  const refs: number[] = [];
  const weights: number[] = [];
  const offsets: number[] = [];
  const scale = { x: [0, 0, 1] as [number, number, number], y: [0, 0, 1] as [number, number, number], z: [0, 0, 1] as [number, number, number] };
  let inVerts = false;
  for (const line of text.split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const p = s.split(/\s+/);
    if (p[0] === "x_scale" || p[0] === "y_scale" || p[0] === "z_scale") {
      scale[(p[0] as string)[0] as "x" | "y" | "z"] = [Number(p[1]), Number(p[2]), Number(p[3])];
      continue;
    }
    if (p[0] === "verts") {
      inVerts = true;
      continue;
    }
    if (!inVerts) continue;
    if (p.length >= 9 && /^\d+$/.test(p[0] as string)) {
      refs.push(Number(p[0]), Number(p[1]), Number(p[2]));
      weights.push(Number(p[3]), Number(p[4]), Number(p[5]));
      offsets.push(Number(p[6]), Number(p[7]), Number(p[8]));
    } else if (p.length === 1 && /^\d+$/.test(p[0] as string)) {
      // Sommet attaché à un seul sommet du corps.
      refs.push(Number(p[0]), Number(p[0]), Number(p[0]));
      weights.push(1, 0, 0);
      offsets.push(0, 0, 0);
    } else inVerts = false;
  }
  return { refs: Int32Array.from(refs), weights: Float64Array.from(weights), offsets: Float64Array.from(offsets), scale };
}

export function fitProxy(c: Mhclo, pos: Float64Array): Float64Array {
  const axis = (s: [number, number, number], k: number): number => Math.abs((pos[s[0] * 3 + k] as number) - (pos[s[1] * 3 + k] as number)) / s[2];
  const sx = axis(c.scale.x, 0);
  const sy = axis(c.scale.y, 1);
  const sz = axis(c.scale.z, 2);
  const n = c.refs.length / 3;
  const out = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      let v = 0;
      for (let j = 0; j < 3; j++) v += (c.weights[i * 3 + j] as number) * (pos[(c.refs[i * 3 + j] as number) * 3 + k] as number);
      out[i * 3 + k] = v + (c.offsets[i * 3 + k] as number) * (k === 0 ? sx : k === 1 ? sy : sz);
    }
  }
  return out;
}
