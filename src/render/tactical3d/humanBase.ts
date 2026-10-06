import { Bone, BufferAttribute, BufferGeometry, Group, Matrix4, MeshStandardMaterial, Skeleton, SkinnedMesh, Vector3 } from "three";
import type { Material } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Corps de base de R1c : le corps humain CC0 de MakeHuman (`docs/art/assets/derives/humain.glb`, produit par
 * `npm run assets:build`), chargé à la demande par `GLTFLoader`, puis façonné par personnage :
 * - cibles de forme cuites sur le processeur (macro : sexe, âge, musculature, corpulence ; détail : ventre, cou, bras, jambes,
 *   torse, épaules, hanches, expressions), normales recalculées sans couture ;
 * - articulations recalées du même déplacement que la peau (déplacements par cible stockés dans le `.glb`) ;
 * - proportions (Titans) : déformations au repos par chaîne d'os (tête, cou, bras, mains, torse, jambes), appliquées aux sommets
 *   selon leurs poids et aux articulations ;
 * - hauteur finale exacte, pieds au sol (y = 0), regard vers +z.
 * Os au repos sans rotation : une rotation d'os s'exprime dans les axes du monde au repos.
 */
export const HUMAN_URL = "assets3d/derives/humain.glb";
export const EYE_TEXTURE_URL = "assets3d/makehuman/eyes/brown_eye.png";

export interface HumanTemplate {
  prims: { name: string; geometry: BufferGeometry }[];
  morphNames: string[];
  bones: { name: string; parent: number; rest: Vector3 }[];
  boneIndex: Map<string, number>;
  /** Déplacement des articulations (m) par cible. */
  morphJoints: Map<string, Map<number, Vector3>>;
  regions: string[];
}

interface GltfExtras {
  r1c?: { os: string[]; regions: string[]; cibles: { nom: string; articulations: Record<string, number[]> }[] };
}

export function templateFromGltf(gltf: GLTF): HumanTemplate {
  const extras = (gltf.scene.userData as GltfExtras).r1c;
  if (!extras) throw new Error("humain.glb : extras r1c absents");
  const prims: HumanTemplate["prims"] = [];
  let skeleton: Skeleton | null = null;
  gltf.scene.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    prims.push({ name: (m.material as Material).name, geometry: m.geometry });
    skeleton ??= m.skeleton;
  });
  if (!skeleton) throw new Error("humain.glb : aucun maillage articulé");
  const sk = skeleton as Skeleton;
  gltf.scene.updateMatrixWorld(true);
  const boneIndex = new Map(extras.os.map((n, i) => [n, i] as const));
  const bones = extras.os.map((name) => {
    const b = sk.bones.find((x) => x.name === name);
    if (!b) throw new Error(`os absent : ${name}`);
    return { name, parent: b.parent && (b.parent as Bone).isBone ? (boneIndex.get(b.parent.name) ?? -1) : -1, rest: b.getWorldPosition(new Vector3()) };
  });
  const morphJoints = new Map<string, Map<number, Vector3>>();
  for (const c of extras.cibles) morphJoints.set(c.nom, new Map(Object.entries(c.articulations).map(([b, d]) => [boneIndex.get(b) ?? -1, new Vector3(d[0], d[1], d[2])] as const)));
  const first = prims[0]?.geometry;
  const morphNames = Object.keys((gltf.scene.getObjectByProperty("isSkinnedMesh", true) as SkinnedMesh | undefined)?.morphTargetDictionary ?? {});
  if (!first || morphNames.length === 0) throw new Error("humain.glb : cibles absentes");
  return { prims, morphNames, bones, boneIndex, morphJoints, regions: extras.regions };
}

/** Gabarit depuis le contenu d'un `.glb` (tests sous Node, outils). */
export async function templateFromBuffer(buf: ArrayBuffer): Promise<HumanTemplate> {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  return templateFromGltf(await new GLTFLoader().parseAsync(buf, ""));
}

let templatePromise: Promise<HumanTemplate> | null = null;
/** Chargement unique (navigateur) : `GLTFLoader` est importé à la demande, dans le morceau 3D. */
export function loadHumanTemplate(url = HUMAN_URL): Promise<HumanTemplate> {
  templatePromise ??= import("three/examples/jsm/loaders/GLTFLoader.js").then(async ({ GLTFLoader }) => templateFromGltf(await new GLTFLoader().loadAsync(url)));
  return templatePromise;
}

// ——— Paramètres de forme ———

export interface Macro {
  /** 0 femme, 1 homme. */
  gender: number;
  /** 0,5 = 25 ans, 1 = 90 ans. */
  age: number;
  muscle: number;
  weight: number;
}

/** Proportions au repos (facteurs ; 1 = inchangé). */
export interface Proportions {
  head?: number;
  neck?: number;
  arms?: number;
  hands?: number;
  torso?: number;
  legs?: number;
}

export interface HumanShape {
  macro: Macro;
  /** Cibles de détail (nom de cible → influence ; extrapolation permise jusqu'à ±2). */
  details?: Record<string, number>;
  proportions?: Proportions;
  /** Lissage au repos d'une région (bottes : orteils fondus) ; les sommets partagés avec une autre région restent fixes. */
  smooth?: { region: string; iterations: number; inflate: number }[];
  /** Hauteur debout finale (m). */
  height: number;
}

function levels(v: number): [number, number, number] {
  if (v < 0.5) return [(0.5 - v) / 0.5, 1 - (0.5 - v) / 0.5, 0];
  return [0, 1 - (v - 0.5) / 0.5, (v - 0.5) / 0.5];
}

/** Influences des cibles macro (règles de pondération de MakeHuman, linéarisées sans perte : voir `assets-build.ts`). */
export function macroInfluences(m: Macro): Record<string, number> {
  const out: Record<string, number> = { homme: Math.max(0, 2 * m.gender - 1), femme: Math.max(0, 1 - 2 * m.gender) };
  const [mMin, , mMax] = levels(m.muscle);
  const [wMin, , wMax] = levels(m.weight);
  const old = Math.max(0, Math.min(1, (m.age - 0.5) / 0.5));
  for (const [k, g] of [
    ["h", m.gender],
    ["f", 1 - m.gender],
  ] as const) {
    out[`muscle_plus_${k}`] = g * mMax;
    out[`muscle_moins_${k}`] = g * mMin;
    out[`poids_plus_${k}`] = g * wMax;
    out[`poids_moins_${k}`] = g * wMin;
    out[`mp_pp_${k}`] = g * mMax * wMax;
    out[`mp_pm_${k}`] = g * mMax * wMin;
    out[`mm_pp_${k}`] = g * mMin * wMax;
    out[`mm_pm_${k}`] = g * mMin * wMin;
    out[`vieux_${k}`] = g * old;
  }
  return out;
}

// ——— Chaînes d'os (déformations au repos) ———

type Chain = "tete" | "cou" | "torse" | "bassin" | "brasG" | "brasD" | "mainG" | "mainD" | "jambeG" | "jambeD" | "piedG" | "piedD";
const CHAIN_OF: [RegExp, Chain][] = [
  [/^(head|jaw|eye_l|eye_r)$/, "tete"],
  [/^neck_01$/, "cou"],
  [/^(spine_0[123]|clavicle_[lr])$/, "torse"],
  [/^(pelvis|Root)$/, "bassin"],
  [/^(upperarm|lowerarm)_l$/, "brasG"],
  [/^(upperarm|lowerarm)_r$/, "brasD"],
  [/^(hand|thumb_0\d|index_0\d|middle_0\d|ring_0\d|pinky_0\d)_l$/, "mainG"],
  [/^(hand|thumb_0\d|index_0\d|middle_0\d|ring_0\d|pinky_0\d)_r$/, "mainD"],
  [/^(thigh|calf)_l$/, "jambeG"],
  [/^(thigh|calf)_r$/, "jambeD"],
  [/^(foot|ball)_l$/, "piedG"],
  [/^(foot|ball)_r$/, "piedD"],
];
export const chainOfBone = (name: string): Chain => CHAIN_OF.find(([re]) => re.test(name))?.[1] ?? "torse";

export interface HumanBody {
  group: Group;
  skeleton: Skeleton;
  bones: Record<string, Bone>;
  meshes: Map<string, SkinnedMesh>;
  /** Hauteur debout au repos (m) et facteur d'échelle appliqué au corps façonné. */
  height: number;
  scale: number;
  /** Articulations au repos (m, repère du corps). */
  joints: Map<string, Vector3>;
  dispose(): void;
}

/** Façonne un corps : cibles cuites, articulations recalées, proportions, hauteur, pieds au sol. */
const plain = new MeshStandardMaterial();
export function buildHumanBody(t: HumanTemplate, shape: HumanShape, material: (prim: string) => Material = () => plain, keep: (prim: string) => boolean = () => true): HumanBody {
  const infl = new Map<number, number>();
  const set = (name: string, w: number): void => {
    const k = t.morphNames.indexOf(name);
    if (k >= 0 && w !== 0) infl.set(k, (infl.get(k) ?? 0) + w);
  };
  for (const [n, w] of Object.entries(macroInfluences(shape.macro))) set(n, w);
  for (const [n, w] of Object.entries(shape.details ?? {})) set(n, w);

  // Articulations : repos + déplacements des cibles.
  const joints = t.bones.map((b) => b.rest.clone());
  for (const [k, w] of infl) {
    const d = t.morphJoints.get(t.morphNames[k] as string);
    if (d) for (const [bi, v] of d) if (bi >= 0) (joints[bi] as Vector3).addScaledVector(v, w);
  }

  // Positions cuites, par primitive.
  const prims = t.prims.filter((p) => keep(p.name));
  const pos = prims.map((p) => {
    const base = p.geometry.getAttribute("position").array as Float32Array;
    const out = Float32Array.from(base);
    const morph = p.geometry.morphAttributes["position"] ?? [];
    for (const [k, w] of infl) {
      const a = morph[k]?.array as Float32Array | undefined;
      if (!a) continue;
      for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) + w * (a[i] as number);
    }
    return out;
  });
  const chainW = prims.map((p) => chainWeights(p.geometry, t));

  // Proportions : déformations successives des sommets (selon leurs poids) et des articulations (selon leur chaîne).
  const pr = shape.proportions ?? {};
  const J = (n: string): Vector3 => joints[t.boneIndex.get(n) ?? 0] as Vector3;
  const jointChain = t.bones.map((b) => chainOfBone(b.name));
  const deform = (chains: Chain[], fn: (p: Vector3) => Vector3, jointsToo: (bone: string, chain: Chain) => boolean): void => {
    const v = new Vector3();
    pos.forEach((arr, pi) => {
      const cw = chainW[pi] as Map<Chain, Float32Array>;
      const ws = chains.map((c) => cw.get(c));
      for (let i = 0; i < arr.length / 3; i++) {
        let w = 0;
        for (const a of ws) w += a ? (a[i] as number) : 0;
        if (w <= 0) continue;
        v.set(arr[i * 3] as number, arr[i * 3 + 1] as number, arr[i * 3 + 2] as number);
        const q = fn(v.clone());
        arr[i * 3] = (arr[i * 3] as number) + w * (q.x - v.x);
        arr[i * 3 + 1] = (arr[i * 3 + 1] as number) + w * (q.y - v.y);
        arr[i * 3 + 2] = (arr[i * 3 + 2] as number) + w * (q.z - v.z);
      }
    });
    t.bones.forEach((b, i) => {
      if (jointsToo(b.name, jointChain[i] as Chain)) (joints[i] as Vector3).copy(fn((joints[i] as Vector3).clone()));
    });
  };
  for (const side of ["l", "r"] as const) {
    const S = side === "l" ? "G" : "D";
    const kHand = pr.hands ?? 1;
    const kArm = pr.arms ?? 1;
    if (kHand !== 1) {
      const W = J(`hand_${side}`).clone();
      deform([`main${S}` as Chain], (p) => p.sub(W).multiplyScalar(kHand).add(W), (b, c) => c === `main${S}` && b !== `hand_${side}`);
    }
    if (kArm !== 1) {
      const Sh = J(`upperarm_${side}`).clone();
      const W = J(`hand_${side}`).clone();
      const W2 = W.clone().sub(Sh).multiplyScalar(kArm).add(Sh);
      deform([`bras${S}` as Chain], (p) => p.sub(Sh).multiplyScalar(kArm).add(Sh), (b) => b === `lowerarm_${side}`);
      deform([`main${S}` as Chain], (p) => p.add(W2.clone().sub(W)), (_b, c) => c === `main${S}`);
    }
  }
  if ((pr.head ?? 1) !== 1) {
    const C = J("head").clone();
    const k = pr.head ?? 1;
    deform(["tete"], (p) => p.sub(C).multiplyScalar(k).add(C), (b, c) => c === "tete" && b !== "head");
  }
  if ((pr.neck ?? 1) !== 1) {
    const N0 = J("neck_01").clone();
    const N1 = J("head").clone();
    const d = N1.clone().sub(N0);
    const len = d.length();
    const u = d.clone().normalize();
    const shift = d.clone().multiplyScalar((pr.neck ?? 1) - 1);
    deform(["cou"], (p) => p.addScaledVector(shift, Math.max(0, Math.min(1, p.clone().sub(N0).dot(u) / len))), () => false);
    deform(["tete"], (p) => p.add(shift), (_b, c) => c === "tete");
  }
  if ((pr.torso ?? 1) !== 1) {
    const hipY = (J("thigh_l").y + J("thigh_r").y) / 2;
    const k = pr.torso ?? 1;
    const top = J("neck_01").y;
    const shift = (top - hipY) * (k - 1);
    deform(["torse"], (p) => p.setY(hipY + (p.y - hipY) * k), (_b, c) => c === "torse");
    deform(["tete", "cou", "brasG", "brasD", "mainG", "mainD"], (p) => p.setY(p.y + shift), (_b, c) => ["tete", "cou", "brasG", "brasD", "mainG", "mainD"].includes(c));
  }
  if ((pr.legs ?? 1) !== 1) {
    const k = pr.legs ?? 1;
    for (const side of ["l", "r"] as const) {
      const S = side === "l" ? "G" : "D";
      const hip = J(`thigh_${side}`).clone();
      const ankle = J(`foot_${side}`).clone();
      const shift = (ankle.y - hip.y) * (k - 1);
      deform([`jambe${S}` as Chain], (p) => p.setY(hip.y + (p.y - hip.y) * k), (b) => b === `calf_${side}`);
      deform([`pied${S}` as Chain], (p) => p.setY(p.y + shift), (_b, c) => c === `pied${S}`);
    }
  }
  for (const s of shape.smooth ?? []) smoothRegion(prims, pos, s.iterations, s.inflate, s.region);

  // Hauteur et sol (cuits dans la géométrie : aucun nœud mis à l'échelle).
  let minY = Infinity;
  let maxY = -Infinity;
  prims.forEach((p, pi) => {
    if (!p.name.startsWith("peau_")) return;
    const a = pos[pi] as Float32Array;
    for (let i = 1; i < a.length; i += 3) {
      minY = Math.min(minY, a[i] as number);
      maxY = Math.max(maxY, a[i] as number);
    }
  });
  const scale = shape.height / (maxY - minY);
  for (const a of pos) for (let i = 0; i < a.length; i += 3) {
    a[i] = (a[i] as number) * scale;
    a[i + 1] = ((a[i + 1] as number) - minY) * scale;
    a[i + 2] = (a[i + 2] as number) * scale;
  }
  for (const j of joints) j.set(j.x * scale, (j.y - minY) * scale, j.z * scale);

  // Os, squelette, maillages.
  const group = new Group();
  group.name = "humain";
  const boneObjs = t.bones.map((b) => {
    const o = new Bone();
    o.name = b.name;
    return o;
  });
  t.bones.forEach((b, i) => {
    const o = boneObjs[i] as Bone;
    const pw = b.parent >= 0 ? (joints[b.parent] as Vector3) : new Vector3();
    o.position.copy(joints[i] as Vector3).sub(pw);
    if (b.parent >= 0) (boneObjs[b.parent] as Bone).add(o);
    else group.add(o);
  });
  group.updateMatrixWorld(true);
  const skeleton = new Skeleton(boneObjs);
  const normals = smoothNormals(prims, pos);
  const meshes = new Map<string, SkinnedMesh>();
  prims.forEach((p, pi) => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos[pi] as Float32Array, 3));
    g.setAttribute("normal", new BufferAttribute(normals[pi] as Float32Array, 3));
    for (const k of ["uv", "skinIndex", "skinWeight", "_orig"]) {
      const a = p.geometry.getAttribute(k);
      if (a) g.setAttribute(k, a);
    }
    g.setIndex(p.geometry.getIndex());
    g.computeBoundingSphere();
    const m = new SkinnedMesh(g, material(p.name));
    m.name = p.name;
    m.castShadow = true;
    m.receiveShadow = true;
    // La boîte au repos ne suit pas les poses : pas d'élimination hors champ.
    m.frustumCulled = false;
    group.add(m);
    m.bind(skeleton, new Matrix4());
    meshes.set(p.name, m);
  });
  const bones: Record<string, Bone> = {};
  for (const b of boneObjs) bones[b.name] = b;
  return {
    group,
    skeleton,
    bones,
    meshes,
    height: shape.height,
    scale,
    joints: new Map(t.bones.map((b, i) => [b.name, (joints[i] as Vector3).clone()] as const)),
    dispose() {
      for (const m of meshes.values()) m.geometry.dispose();
      skeleton.dispose();
    },
  };
}

/** Poids de chaque chaîne d'os, par sommet d'une primitive. */
function chainWeights(g: BufferGeometry, t: HumanTemplate): Map<Chain, Float32Array> {
  const si = g.getAttribute("skinIndex");
  const sw = g.getAttribute("skinWeight");
  const n = si.count;
  const out = new Map<Chain, Float32Array>();
  const chainOfIdx = t.bones.map((b) => chainOfBone(b.name));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k);
      if (w <= 0) continue;
      const c = chainOfIdx[si.getComponent(i, k)] as Chain;
      let a = out.get(c);
      if (!a) {
        a = new Float32Array(n);
        out.set(c, a);
      }
      a[i] = (a[i] as number) + w;
    }
  }
  return out;
}

/** Normales lissées par sommet d'origine, sur toutes les primitives de la même famille (corps ou yeux). */
function smoothNormals(prims: HumanTemplate["prims"], pos: Float32Array[]): Float32Array[] {
  const acc = new Map<number, [number, number, number]>();
  prims.forEach((p, pi) => {
    const a = pos[pi] as Float32Array;
    const idx = p.geometry.getIndex()?.array ?? [];
    const orig = p.geometry.getAttribute("_orig").array as Float32Array;
    for (let k = 0; k < idx.length; k += 3) {
      const i0 = idx[k] as number;
      const i1 = idx[k + 1] as number;
      const i2 = idx[k + 2] as number;
      const ax = a[i0 * 3] as number;
      const ay = a[i0 * 3 + 1] as number;
      const az = a[i0 * 3 + 2] as number;
      const e1x = (a[i1 * 3] as number) - ax;
      const e1y = (a[i1 * 3 + 1] as number) - ay;
      const e1z = (a[i1 * 3 + 2] as number) - az;
      const e2x = (a[i2 * 3] as number) - ax;
      const e2y = (a[i2 * 3 + 1] as number) - ay;
      const e2z = (a[i2 * 3 + 2] as number) - az;
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      for (const i of [i0, i1, i2]) {
        const o = orig[i] as number;
        const s = acc.get(o);
        if (s) {
          s[0] += nx;
          s[1] += ny;
          s[2] += nz;
        } else acc.set(o, [nx, ny, nz]);
      }
    }
  });
  return prims.map((p) => {
    const orig = p.geometry.getAttribute("_orig").array as Float32Array;
    const out = new Float32Array(orig.length * 3);
    for (let i = 0; i < orig.length; i++) {
      const s = acc.get(orig[i] as number) ?? [0, 1, 0];
      const l = Math.hypot(s[0], s[1], s[2]) || 1;
      out[i * 3] = s[0] / l;
      out[i * 3 + 1] = s[1] / l;
      out[i * 3 + 2] = s[2] / l;
    }
    return out;
  });
}

/** Lissage laplacien d'une région (sommets de la primitive `peau_<région>`), puis gonflement le long des normales. */
function smoothRegion(prims: HumanTemplate["prims"], pos: Float32Array[], iterations: number, inflate: number, region: string): void {
  const pi = prims.findIndex((p) => p.name === `peau_${region}`);
  if (pi < 0) return;
  const p = prims[pi] as HumanTemplate["prims"][number];
  const a = pos[pi] as Float32Array;
  const idx = p.geometry.getIndex()?.array ?? [];
  const orig = p.geometry.getAttribute("_orig").array as Float32Array;
  const n = orig.length;
  // Voisins par sommet d'origine (les coutures d'UV partagent la même position).
  const neigh = new Map<number, Set<number>>();
  const members = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const o = orig[i] as number;
    const l = members.get(o) ?? [];
    l.push(i);
    members.set(o, l);
  }
  for (let k = 0; k < idx.length; k += 3) {
    for (let e = 0; e < 3; e++) {
      const x = orig[idx[k + e] as number] as number;
      const y = orig[idx[k + ((e + 1) % 3)] as number] as number;
      (neigh.get(x) ?? neigh.set(x, new Set()).get(x))?.add(y);
      (neigh.get(y) ?? neigh.set(y, new Set()).get(y))?.add(x);
    }
  }
  // Bord de la région : sommets d'origine présents dans une autre primitive de peau ; ils ne bougent pas (pas de fente).
  const border = new Set<number>();
  prims.forEach((q, qi) => {
    if (qi === pi || !q.name.startsWith("peau_")) return;
    for (const o of q.geometry.getAttribute("_orig").array as Float32Array) if (members.has(o)) border.add(o);
  });
  const first = (o: number): number => (members.get(o) as number[])[0] as number;
  for (let it = 0; it < iterations; it++) {
    const next = new Map<number, [number, number, number]>();
    for (const [o, ns] of neigh) {
      if (border.has(o)) continue;
      let x = 0;
      let y = 0;
      let z = 0;
      for (const q of ns) {
        const i = first(q);
        x += a[i * 3] as number;
        y += a[i * 3 + 1] as number;
        z += a[i * 3 + 2] as number;
      }
      const i = first(o);
      const c = ns.size;
      next.set(o, [((a[i * 3] as number) + x / c) / 2, ((a[i * 3 + 1] as number) + y / c) / 2, ((a[i * 3 + 2] as number) + z / c) / 2]);
    }
    for (const [o, v] of next) for (const i of members.get(o) ?? []) a.set(v, i * 3);
  }
  if (inflate !== 0) {
    const nor = smoothNormals([p], [a])[0] as Float32Array;
    for (let i = 0; i < n; i++) {
      if (border.has(orig[i] as number)) continue;
      for (let k = 0; k < 3; k++) a[i * 3 + k] = (a[i * 3 + k] as number) + inflate * (nor[i * 3 + k] as number);
    }
  }
}

/** Positions des sommets après poses (processeur), pour les mesures : hauteur, pieds au sol. */
export function skinnedBounds(body: HumanBody, prefix = "peau_"): { min: Vector3; max: Vector3 } {
  body.group.updateMatrixWorld(true);
  body.skeleton.update();
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  const v = new Vector3();
  for (const m of body.meshes.values()) {
    if (!m.name.startsWith(prefix)) continue;
    const n = m.geometry.getAttribute("position").count;
    for (let i = 0; i < n; i++) {
      m.getVertexPosition(i, v);
      v.applyMatrix4(m.matrixWorld);
      min.min(v);
      max.max(v);
    }
  }
  return { min, max };
}

/** Rotation d'un os (axe dans le repère de son parent au repos, qui est celui du monde : os sans rotation au repos). */
export function setBoneRotation(body: HumanBody, bone: string, axis: [number, number, number], angle: number): void {
  body.bones[bone]?.quaternion.setFromAxisAngle(new Vector3(...axis).normalize(), angle);
}

/** Ordonnées des sommets d'une primitive après poses (processeur). */
export function skinnedY(body: HumanBody, prim: string): number[] {
  const m = body.meshes.get(prim);
  if (!m) return [];
  body.group.updateMatrixWorld(true);
  body.skeleton.update();
  const v = new Vector3();
  const out: number[] = [];
  for (let i = 0; i < m.geometry.getAttribute("position").count; i++) out.push(m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld).y);
  return out;
}

/** Distance entre deux articulations au repos. */
export function jointDistance(body: HumanBody, a: string, b: string): number {
  const p = body.joints.get(a);
  const q = body.joints.get(b);
  return p && q ? p.distanceTo(q) : 0;
}

