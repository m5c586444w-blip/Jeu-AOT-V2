// npm run assets:build — corps de base de R1c (docs/art/assets/derives/humain.glb) à partir des sources CC0 de MakeHuman
// (docs/art/assets/makehuman/). Sortie déterministe : mêmes sources, même fichier à l'octet.
// - Maillage hm08 converti en mètres, pieds au sol, regard vers +z ; corps découpé en régions (tête, torse, bassin, bras,
//   mains, cuisses, jambes, pieds) d'après l'os dominant, plus le collant (pantalon), les dents, la langue et les yeux ajustés.
// - Squelette « game_engine » de MPFB2 (53 os, noms UE4) plus mâchoire et deux yeux (articulations du squelette par défaut) ;
//   os au repos sans rotation, positionnés aux centres des cubes d'articulation du corps par défaut.
// - Poids « game_engine », mâchoire reportée depuis les poids par défaut ; quatre os au plus par sommet.
// - Cibles de forme éparses, relatives au corps par défaut (sexe 0,5, 25 ans, musculature et corpulence moyennes) : macro
//   (homme, femme ; musculature, corpulence et leurs croisements, par sexe ; âge) et détail (ventre, cou, bras, jambes, torse,
//   épaules, hanches, expressions). Chaque cible porte le déplacement des articulations qu'elle produit (extras).
// - R1d : aucun détail anatomique. Le groupe « helper-genital » n'est pas repris ; les zones des mamelons et de l'entrejambe
//   sont lissées dans le corps de référence et dans chaque cible, avec le même opérateur linéaire : tout mélange reste lisse.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { ManifestSchema, writeAttributions } from "./assetsCheck";
import type { ManifestEntry } from "./assetsCheck";
import { MH_AUTHOR, MAKEHUMAN_COMMIT, MPFB2_COMMIT, DETAIL_TARGETS, ZONE_TARGETS, sourceFiles } from "./assetsSources";
import { cotangentWeights, fairHeights } from "../render/tactical3d/fairing";
import { ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, GlbWriter } from "./glbWriter";
import { DEFAULT_MACRO, GENDERS, applyTarget, bodyPositions, fitProxy, jointGroups, meanOf, parseMhclo, parseObj, parseTarget } from "./humanBuild";
import type { LEVELS, Target, V3 } from "./humanBuild";

const SRC = "docs/art/assets/makehuman";
const OUT = "docs/art/assets/derives/humain.glb";
const read = (f: string): Buffer => readFileSync(`${SRC}/${f}`);

const obj = parseObj(read("base.obj").toString("utf8"));
const N = obj.pos.length / 3;
const targets = new Map<string, Target>();
for (const s of sourceFiles()) {
  if (!s.fichier.includes("/cibles/")) continue;
  const name = s.fichier.replace("makehuman/cibles/", "").replace(/\.target\.gz$/, "");
  targets.set(name, parseTarget(read(s.fichier.replace("makehuman/", "")), true));
}

// ——— Corps de référence et cibles de forme (décimètres) ———
const D = bodyPositions(obj.pos, targets, DEFAULT_MACRO);
const diff = (a: Float64Array, b: Float64Array): Float64Array => a.map((v, i) => v - (b[i] as number));
const fromTargets = (...parts: [string, number][]): Float64Array => {
  const out = new Float64Array(N * 3);
  for (const [name, w] of parts) {
    const t = targets.get(name);
    if (!t) throw new Error(`cible manquante : ${name}`);
    applyTarget(out, t, w);
  }
  return out;
};
const U = (g: (typeof GENDERS)[number], m: (typeof LEVELS)[number], w: (typeof LEVELS)[number]): string => `macrodetails/universal-${g}-young-${m}muscle-${w}weight`;
const morphs: { name: string; delta: Float64Array }[] = [];
morphs.push({ name: "homme", delta: diff(bodyPositions(obj.pos, targets, { ...DEFAULT_MACRO, gender: 1 }), D) });
morphs.push({ name: "femme", delta: diff(bodyPositions(obj.pos, targets, { ...DEFAULT_MACRO, gender: 0 }), D) });
for (const g of GENDERS) {
  const k = g === "male" ? "h" : "f";
  morphs.push({ name: `muscle_plus_${k}`, delta: fromTargets([U(g, "max", "average"), 1]) });
  morphs.push({ name: `muscle_moins_${k}`, delta: fromTargets([U(g, "min", "average"), 1]) });
  morphs.push({ name: `poids_plus_${k}`, delta: fromTargets([U(g, "average", "max"), 1]) });
  morphs.push({ name: `poids_moins_${k}`, delta: fromTargets([U(g, "average", "min"), 1]) });
  // Croisements : le coin (musculature, corpulence) moins la somme des deux arêtes (correction bilinéaire exacte).
  for (const [m, w, n] of [
    ["max", "max", "mp_pp"],
    ["max", "min", "mp_pm"],
    ["min", "max", "mm_pp"],
    ["min", "min", "mm_pm"],
  ] as const)
    morphs.push({ name: `${n}_${k}`, delta: fromTargets([U(g, m, w), 1], [U(g, m, "average"), -1], [U(g, "average", w), -1]) });
  const gv = g === "male" ? 1 : 0;
  morphs.push({ name: `vieux_${k}`, delta: diff(bodyPositions(obj.pos, targets, { ...DEFAULT_MACRO, gender: gv, age: 1 }), bodyPositions(obj.pos, targets, { ...DEFAULT_MACRO, gender: gv })) });
}
for (const d of DETAIL_TARGETS) morphs.push({ name: (d.split("/").pop() as string).replace(/-/g, "_"), delta: fromTargets([d, 1]) });

// ——— R1d : zones lissées (aucun détail anatomique) ———
// Deux zones, écrites dans les extras (`zonesLissees`, sommets d'origine) :
// - Entrejambe : sommets du corps à moins de ENTREJAMBE_DM de l'aide génitale de MakeHuman (maillage non repris), élargis de
//   deux couronnes ; « carénée » ici à bord fixe (plaque mince le long de la normale, `fair`) dans le corps de référence et dans
//   chaque cible, avec le même opérateur linéaire : le corps façonné par n'importe quel mélange de cibles reste caréné.
// - Mamelons : sommets des cibles officielles « nipple-size » et « nipple-point », élargis de MAMELON_COURONNES couronnes ;
//   rabattus sur le corps façonné (`humanBase.flattenZones`) : une plaque mince faite ici prolonge la pointe du sein ou creuse
//   le torse masculin (mesuré en R1d.3).
const ENTREJAMBE_DM = 0.45;
const MAMELON_COURONNES = 1;
const FAIR_ITER = 2000;
const FAIR_PASSES = 6;
const neighbours = new Map<number, Set<number>>();
for (const f of obj.faces) {
  if (f.group !== "body") continue;
  for (let k = 0; k < f.v.length; k++) {
    const a = f.v[k] as number;
    const b = f.v[(k + 1) % f.v.length] as number;
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as const) {
      const s = neighbours.get(x) ?? new Set<number>();
      s.add(y);
      neighbours.set(x, s);
    }
  }
}
/** Faces du corps triangulées en éventail ; poids cotangents d'une géométrie (positions en décimètres). */
const bodyTris = obj.faces.filter((f) => f.group === "body").flatMap((f) => f.v.slice(1, -1).map((_, k) => [f.v[0] as number, f.v[k + 1] as number, f.v[k + 2] as number] as const));
const cotOf = (X: Float64Array): ReturnType<typeof cotangentWeights> => cotangentWeights(bodyTris, (v) => [X[v * 3] as number, X[v * 3 + 1] as number, X[v * 3 + 2] as number]);
const grow = (zone: Set<number>, rings: number): Set<number> => {
  const out = new Set(zone);
  for (let r = 0; r < rings; r++) for (const v of [...out]) for (const n of neighbours.get(v) ?? []) out.add(n);
  return out;
};
// Aréole et mamelon : sommets des cibles « nipple-size » et « nipple-point ».
const nipple = new Set<number>();
for (const z of ZONE_TARGETS) for (const v of targets.get(z)?.idx ?? []) nipple.add(v);
const genital = new Set<number>();
for (const f of obj.faces) if (f.group === "helper-genital") for (const v of f.v) genital.add(v);
const crotch = new Set<number>();
for (const v of neighbours.keys()) {
  for (const g of genital) {
    if (Math.hypot((D[v * 3] as number) - (D[g * 3] as number), (D[v * 3 + 1] as number) - (D[g * 3 + 1] as number), (D[v * 3 + 2] as number) - (D[g * 3 + 2] as number)) < ENTREJAMBE_DM) {
      crotch.add(v);
      break;
    }
  }
}
const ZONES: [string, number[]][] = [
  ["mamelons", [...grow(nipple, MAMELON_COURONNES)].sort((a, b) => a - b)],
  ["entrejambe", [...grow(crotch, 2)].sort((a, b) => a - b)],
];
/** Normales unitaires d'une géométrie (somme des normales de faces). */
const normalsOf = (X: Float64Array): ((v: number) => V3) => {
  const acc = new Float64Array(N * 3);
  for (const [a, b, c] of bodyTris) {
    const e1 = [0, 1, 2].map((q) => (X[b * 3 + q] as number) - (X[a * 3 + q] as number));
    const e2 = [0, 1, 2].map((q) => (X[c * 3 + q] as number) - (X[a * 3 + q] as number));
    const n = [(e1[1] as number) * (e2[2] as number) - (e1[2] as number) * (e2[1] as number), (e1[2] as number) * (e2[0] as number) - (e1[0] as number) * (e2[2] as number), (e1[0] as number) * (e2[1] as number) - (e1[1] as number) * (e2[0] as number)];
    for (const v of [a, b, c]) for (let q = 0; q < 3; q++) acc[v * 3 + q] = (acc[v * 3 + q] as number) + (n[q] as number);
  }
  return (v) => {
    const n: V3 = [acc[v * 3] as number, acc[v * 3 + 1] as number, acc[v * 3 + 2] as number];
    const l = Math.hypot(...n) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  };
};
/** Carénage d'une zone (`fairHeights`) appliqué à un tableau de positions ou de décalages. */
const fair = (arr: Float64Array, zone: readonly number[], cotW: ReturnType<typeof cotangentWeights>, normal: (v: number) => V3): void => {
  const h = fairHeights((v, c) => arr[v * 3 + c] as number, zone, cotW, normal, FAIR_ITER);
  zone.forEach((v, k) => {
    const n = normal(v);
    for (let c = 0; c < 3; c++) arr[v * 3 + c] = (arr[v * 3 + c] as number) + (h[k] as number) * (n[c] as number);
  });
};
/**
 * Entrejambe : l'opérateur (poids cotangents, normales) dépend de la géométrie carénée ; il est recalculé sur le corps de
 * référence caréné jusqu'au point fixe (FAIR_PASSES passes), puis appliqué à chaque cible. Le contrôle (`humanBase.zoneRelief`)
 * recalcule ce même opérateur sur le corps de référence du `.glb` et y trouve une surface déjà carénée.
 */
const crotchZone = ZONES.find(([n]) => n === "entrejambe")?.[1] ?? [];
let op = { cotW: cotOf(D), normal: normalsOf(D) };
for (let pass = 0; pass < FAIR_PASSES; pass++) {
  fair(D, crotchZone, op.cotW, op.normal);
  op = { cotW: cotOf(D), normal: normalsOf(D) };
}
for (const m of morphs) fair(m.delta, crotchZone, op.cotW, op.normal);

// ——— Repère : mètres, sol à y = 0 ———
const groups = jointGroups(obj);
const ground = meanOf(D, groups.get("joint-ground") ?? []);
const M = (x: number, y: number, z: number): V3 => [x / 10, (y - ground[1]) / 10, z / 10];

// ——— Squelette ———
interface RigBone {
  head: { cube_name?: string; strategy: string };
  parent: string;
}
const rig = JSON.parse(read("rig.game_engine.json").toString("utf8")) as Record<string, RigBone>;
const mhskel = JSON.parse(read("default.mhskel").toString("utf8")) as { joints: Record<string, number[]> };
const boneNames = Object.keys(rig).sort((a, b) => (a === "Root" ? -1 : b === "Root" ? 1 : a.localeCompare(b)));
const extra: Record<string, { parent: string; joint: number[] }> = {
  jaw: { parent: "head", joint: mhskel.joints["jaw____head"] ?? [] },
  eye_l: { parent: "head", joint: mhskel.joints["eye.L____head"] ?? [] },
  eye_r: { parent: "head", joint: mhskel.joints["eye.R____head"] ?? [] },
};
const bones = [...boneNames, ...Object.keys(extra)];
const parentOf = (b: string): string => extra[b]?.parent ?? rig[b]?.parent ?? "";
const jointVerts = (b: string): number[] => {
  const e = extra[b];
  if (e) return e.joint;
  const cube = rig[b]?.head.cube_name ?? "";
  const v = groups.get(cube);
  if (!v || v.length === 0) throw new Error(`articulation introuvable : ${b} (${cube})`);
  return v;
};
const headOf = (pos: Float64Array, b: string): V3 => meanOf(pos, jointVerts(b));
const restWorld = new Map(bones.map((b) => [b, M(...headOf(D, b))] as const));

// ——— Poids ———
const ge = JSON.parse(read("weights.game_engine.json").toString("utf8")) as { weights: Record<string, [number, number][]> };
const dw = JSON.parse(read("default_weights.mhw").toString("utf8")) as { weights: Record<string, [number, number][]> };
const perVertex: Map<number, number>[] = Array.from({ length: N }, () => new Map());
for (const [b, list] of Object.entries(ge.weights)) {
  const bi = bones.indexOf(b);
  if (bi < 0) continue;
  for (const [v, w] of list) perVertex[v]?.set(bi, (perVertex[v]?.get(bi) ?? 0) + w);
}
const jawW = new Float64Array(N);
for (const [b, list] of Object.entries(dw.weights)) if (b === "jaw" || b.startsWith("tongue")) for (const [v, w] of list) jawW[v] = Math.min(1, (jawW[v] as number) + w);
const jawIdx = bones.indexOf("jaw");
for (let v = 0; v < N; v++) {
  const j = jawW[v] as number;
  if (j <= 0) continue;
  const m = perVertex[v] as Map<number, number>;
  for (const [k, w] of m) m.set(k, w * (1 - j));
  m.set(jawIdx, (m.get(jawIdx) ?? 0) + j);
}
function top4(m: Map<number, number>): { j: number[]; w: number[] } {
  const list = [...m.entries()].filter(([, w]) => w > 1e-4).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4);
  const s = list.reduce((acc, [, w]) => acc + w, 0) || 1;
  const j = list.map(([k]) => k);
  const w = list.map(([, x]) => x / s);
  while (j.length < 4) {
    j.push(0);
    w.push(0);
  }
  return { j, w };
}
const skinOf = perVertex.map(top4);

// ——— Régions du corps ———
const REGION_OF: [RegExp, string][] = [
  [/^(head|neck_01|jaw|eye_l|eye_r)$/, "tete"],
  [/^(spine_0[123]|clavicle_[lr])$/, "torse"],
  [/^(pelvis|Root)$/, "bassin"],
  [/^(upperarm|lowerarm)_[lr]$/, "bras"],
  [/^(hand|thumb|index|middle|ring|pinky)/, "mains"],
  [/^thigh_[lr]$/, "cuisses"],
  [/^calf_[lr]$/, "jambes"],
  [/^(foot|ball)_[lr]$/, "pieds"],
];
const REGIONS = ["tete", "torse", "bassin", "bras", "mains", "cuisses", "jambes", "pieds"];
const regionOfBone = (b: string): string => REGION_OF.find(([re]) => re.test(b))?.[1] ?? "torse";
const vertexRegion = (v: number): string => regionOfBone(bones[skinOf[v]?.j[0] ?? 0] as string);

// ——— Yeux (proxy ajusté) ———
const eyesObj = parseObj(read("eyes/high-poly.obj").toString("utf8"));
const mhclo = parseMhclo(read("eyes/high-poly.mhclo").toString("utf8"));
const eyesD = fitProxy(mhclo, D);
const eyeDeltas = morphs.map((m) => diff(fitProxy(mhclo, D.map((v, i) => v + (m.delta[i] as number))), eyesD));

// ——— Primitives ———
interface Prim {
  name: string;
  faces: { v: number[]; t: number[] }[];
  /** Positions (dm), UV et décalages de cibles de la famille de sommets (corps ou yeux). */
  pos: Float64Array;
  uv: Float64Array;
  deltas: Float64Array[];
  skin: (v: number) => { j: number[]; w: number[] };
  orig: (v: number) => number;
}
const bodyFamily = { pos: D, uv: obj.uv, deltas: morphs.map((m) => m.delta), skin: (v: number) => skinOf[v] as { j: number[]; w: number[] }, orig: (v: number) => v };
const prims: Prim[] = [];
const byRegion = new Map<string, { v: number[]; t: number[] }[]>(REGIONS.map((r) => [r, []]));
for (const f of obj.faces) {
  if (f.group !== "body") continue;
  const votes = new Map<string, number>();
  for (const v of f.v) votes.set(vertexRegion(v), (votes.get(vertexRegion(v)) ?? 0) + 1);
  const best = [...votes.entries()].sort((a, b) => b[1] - a[1] || REGIONS.indexOf(a[0]) - REGIONS.indexOf(b[0]))[0]?.[0] ?? "torse";
  byRegion.get(best)?.push(f);
}
for (const r of REGIONS) prims.push({ name: `peau_${r}`, faces: byRegion.get(r) ?? [], ...bodyFamily });
const groupFaces = (...gs: string[]): { v: number[]; t: number[] }[] => obj.faces.filter((f) => gs.includes(f.group));
prims.push({ name: "pantalon", faces: groupFaces("helper-tights"), ...bodyFamily });
prims.push({ name: "dents", faces: groupFaces("helper-upper-teeth", "helper-lower-teeth"), ...bodyFamily });
prims.push({ name: "langue", faces: groupFaces("helper-tongue"), ...bodyFamily });
const eyeL = bones.indexOf("eye_l");
const eyeR = bones.indexOf("eye_r");
prims.push({
  name: "yeux",
  faces: eyesObj.faces.map((f) => ({ v: f.v, t: f.t })),
  pos: eyesD,
  uv: eyesObj.uv,
  deltas: eyeDeltas,
  // Œil gauche du personnage du côté +x (regard vers +z).
  skin: (v: number) => ({ j: [(eyesD[v * 3] as number) > 0 ? eyeL : eyeR, 0, 0, 0], w: [1, 0, 0, 0] }),
  orig: (v: number) => 100000 + v,
});

// ——— Écriture ———
const glb = new GlbWriter("Murs et Sang, npm run assets:build (R1c)");
const j = glb.json;
const boneNode = new Map<string, number>();
for (const b of bones) {
  const p = parentOf(b);
  const w = restWorld.get(b) as V3;
  const pw = p ? (restWorld.get(p) as V3) : ([0, 0, 0] as V3);
  j.nodes.push({ name: b, translation: [w[0] - pw[0], w[1] - pw[1], w[2] - pw[2]] });
  boneNode.set(b, j.nodes.length - 1);
}
for (const b of bones) {
  const kids = bones.filter((c) => parentOf(c) === b).map((c) => boneNode.get(c) as number);
  if (kids.length) (j.nodes[boneNode.get(b) as number] as Record<string, unknown>)["children"] = kids;
}
const ibm = new Float32Array(bones.length * 16);
bones.forEach((b, i) => {
  const w = restWorld.get(b) as V3;
  ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -w[0], -w[1], -w[2], 1], i * 16);
});
j.skins.push({ name: "squelette", joints: bones.map((b) => boneNode.get(b) as number), inverseBindMatrices: glb.accessor(ibm, "MAT4"), skeleton: boneNode.get("Root") });

const primitives: Record<string, unknown>[] = [];
const stats: string[] = [];
for (const p of prims) {
  const key = new Map<string, number>();
  const src: [number, number][] = [];
  const tri: number[] = [];
  for (const f of p.faces) {
    const ids = f.v.map((v, k) => {
      const t = f.t[k] as number;
      const id = `${v}/${t}`;
      let n = key.get(id);
      if (n === undefined) {
        n = src.length;
        key.set(id, n);
        src.push([v, t]);
      }
      return n;
    });
    for (let k = 1; k + 1 < ids.length; k++) tri.push(ids[0] as number, ids[k] as number, ids[k + 1] as number);
  }
  const n = src.length;
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const joints = new Uint8Array(n * 4);
  const weights = new Float32Array(n * 4);
  const orig = new Float32Array(n);
  src.forEach(([v, t], i) => {
    pos.set(M(p.pos[v * 3] as number, p.pos[v * 3 + 1] as number, p.pos[v * 3 + 2] as number), i * 3);
    uv.set([p.uv[t * 2] as number, 1 - (p.uv[t * 2 + 1] as number)], i * 2);
    const s = p.skin(v);
    joints.set(s.j, i * 4);
    weights.set(s.w, i * 4);
    orig[i] = p.orig(v);
  });
  // Normales lissées par sommet d'origine (pas de couture aux raccords d'UV).
  const acc = new Map<number, V3>();
  for (let k = 0; k < tri.length; k += 3) {
    const [a, b, c] = [tri[k] as number, tri[k + 1] as number, tri[k + 2] as number];
    const pa = [pos[a * 3] as number, pos[a * 3 + 1] as number, pos[a * 3 + 2] as number];
    const e1 = [(pos[b * 3] as number) - (pa[0] as number), (pos[b * 3 + 1] as number) - (pa[1] as number), (pos[b * 3 + 2] as number) - (pa[2] as number)];
    const e2 = [(pos[c * 3] as number) - (pa[0] as number), (pos[c * 3 + 1] as number) - (pa[1] as number), (pos[c * 3 + 2] as number) - (pa[2] as number)];
    const nx = (e1[1] as number) * (e2[2] as number) - (e1[2] as number) * (e2[1] as number);
    const ny = (e1[2] as number) * (e2[0] as number) - (e1[0] as number) * (e2[2] as number);
    const nz = (e1[0] as number) * (e2[1] as number) - (e1[1] as number) * (e2[0] as number);
    for (const x of [a, b, c]) {
      const o = orig[x] as number;
      const s = acc.get(o) ?? [0, 0, 0];
      acc.set(o, [s[0] + nx, s[1] + ny, s[2] + nz]);
    }
  }
  const nor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const s = acc.get(orig[i] as number) ?? [0, 1, 0];
    const l = Math.hypot(...s) || 1;
    nor.set([s[0] / l, s[1] / l, s[2] / l], i * 3);
  }
  const attributes = {
    POSITION: glb.accessor(pos, "VEC3", { target: ARRAY_BUFFER, bounds: true }),
    NORMAL: glb.accessor(nor, "VEC3", { target: ARRAY_BUFFER }),
    TEXCOORD_0: glb.accessor(uv, "VEC2", { target: ARRAY_BUFFER }),
    JOINTS_0: glb.accessor(joints, "VEC4", { target: ARRAY_BUFFER }),
    WEIGHTS_0: glb.accessor(weights, "VEC4", { target: ARRAY_BUFFER }),
    _ORIG: glb.accessor(orig, "SCALAR", { target: ARRAY_BUFFER }),
  };
  let moved = 0;
  const tgts = p.deltas.map((d) => {
    const idx: number[] = [];
    const val: number[] = [];
    src.forEach(([v], i) => {
      const dx = (d[v * 3] as number) / 10;
      const dy = (d[v * 3 + 1] as number) / 10;
      const dz = (d[v * 3 + 2] as number) / 10;
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 1e-6) {
        idx.push(i);
        val.push(dx, dy, dz);
      }
    });
    moved += idx.length;
    return { POSITION: glb.sparseVec3(n, Uint32Array.from(idx), Float32Array.from(val)) };
  });
  const indices = n < 65536 ? Uint16Array.from(tri) : Uint32Array.from(tri);
  j.materials.push({ name: p.name, pbrMetallicRoughness: { baseColorFactor: [0.8, 0.62, 0.52, 1], metallicFactor: 0, roughnessFactor: 0.6 } });
  primitives.push({ attributes, indices: glb.accessor(indices, "SCALAR", { target: ELEMENT_ARRAY_BUFFER }), material: j.materials.length - 1, targets: tgts });
  stats.push(`${p.name} : ${n} sommets, ${tri.length / 3} triangles, ${moved} décalages de cibles`);
}
j.meshes.push({ name: "humain", primitives, extras: { targetNames: morphs.map((m) => m.name) } });
j.nodes.push({ name: "corps", mesh: 0, skin: 0 });
const meshNode = j.nodes.length - 1;
// Déplacement des articulations par cible (m), pour recaler le squelette quand une cible s'applique.
const morphJoints = morphs.map((m) => {
  const out: Record<string, number[]> = {};
  for (const b of bones) {
    const d = meanOf(m.delta, jointVerts(b)).map((x) => x / 10);
    if (Math.abs(d[0] as number) + Math.abs(d[1] as number) + Math.abs(d[2] as number) > 1e-6) out[b] = d.map((x) => Math.round(x * 1e6) / 1e6);
  }
  return { nom: m.name, articulations: out };
});
j.scenes.push({
  name: "humain",
  nodes: [boneNode.get("Root") as number, meshNode],
  extras: {
    r1c: {
      source: `MakeHuman hm08, CC0 (makehumancommunity/makehuman ${MAKEHUMAN_COMMIT.slice(0, 7)}, mpfb2 ${MPFB2_COMMIT.slice(0, 7)})`,
      unites: "m",
      regard: "+z",
      macroDefaut: DEFAULT_MACRO,
      regions: REGIONS,
      // R1d : sommets d'origine (attribut _ORIG) des zones lissées, pour le contrôle.
      zonesLissees: Object.fromEntries(ZONES),
      os: bones,
      cibles: morphJoints,
    },
  },
});
const out = glb.finish();
const sha = createHash("sha256").update(out).digest("hex");
// `--verifier` : reconstruit en mémoire et compare au fichier du dépôt, sans rien écrire (déterminisme, test).
if (process.argv.includes("--verifier")) {
  const onDisk = createHash("sha256").update(readFileSync(OUT)).digest("hex");
  console.log(`${OUT} : reconstruit ${sha}, dépôt ${onDisk} : ${sha === onDisk ? "identiques" : "DIFFÉRENTS"}`);
  process.exit(sha === onDisk ? 0 : 1);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(stats.join("\n"));
console.log(`${OUT} : ${out.length} octets, ${bones.length} os, ${morphs.length} cibles, sha256 ${sha}`);

// ——— Manifeste ———
const manifestPath = "docs/art/assets/manifest.json";
const manifest = ManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
const used = sourceFiles().map((s) => s.fichier);
const prev = manifest.fichiers.find((e) => e.fichier === "derives/humain.glb");
const entry: ManifestEntry = {
  fichier: "derives/humain.glb",
  nom: "Corps de base humain (dérivé de MakeHuman)",
  url: `https://github.com/makehumancommunity/makehuman/tree/${MAKEHUMAN_COMMIT}/makehuman/data`,
  licence: "CC0-1.0",
  date: prev && prev.sha256 === sha ? prev.date : new Date().toISOString().slice(0, 10),
  auteur: MH_AUTHOR,
  sha256: sha,
  usage: "derive",
  derive_de: used,
  execution: true,
  note: "Produit par npm run assets:build (src/tools/assets-build.ts) ; aucune modification manuelle.",
};
const eyeTex = manifest.fichiers.find((e) => e.fichier === "makehuman/eyes/brown_eye.png");
if (eyeTex) eyeTex.execution = true;
manifest.fichiers = [...manifest.fichiers.filter((e) => e.fichier !== entry.fichier), entry].sort((a, b) => a.fichier.localeCompare(b.fichier));
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
writeAttributions("docs/ASSETS_LICENSES.md", manifest);
