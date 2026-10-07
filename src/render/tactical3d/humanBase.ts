import { Bone, BufferAttribute, BufferGeometry, Group, Matrix4, MeshStandardMaterial, SRGBColorSpace, Skeleton, SkinnedMesh, TextureLoader, Vector3 } from "three";
import type { Material, Texture } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { cotangentWeights, fairHeights } from "./fairing";
import type { V3 } from "./fairing";

/**
 * Corps de base de R1c : le corps humain CC0 de MakeHuman (`docs/art/assets/derives/humain.glb`, produit par
 * `npm run assets:build`), chargé à la demande par `GLTFLoader`, puis façonné par personnage :
 * - cibles de forme cuites sur le processeur (macro : sexe, âge, musculature, corpulence ; détail : ventre, cou, bras, jambes,
 *   torse, épaules, hanches, expressions), normales recalculées sans couture ;
 * - articulations recalées du même déplacement que la peau (déplacements par cible stockés dans le `.glb`) ;
 * - proportions (Titans) : déformations au repos par chaîne d'os (tête, cou, bras, avant-bras, mains, torse, jambes, pieds),
 *   largeurs (carrure, bassin, profondeur, crâne) et épaisseurs (bras, jambes, cou), appliquées aux sommets selon leurs poids et
 *   aux articulations ;
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
  /**
   * R1d (aucun détail anatomique) : sommets d'origine des zones lissées. « mamelons » est rabattu sur le corps façonné
   * (`flattenZones`, contrôle `zoneRelief`) ; « entrejambe » est caréné dans le `.glb` (contrôle `fairRelief`). Les normales des
   * deux sont adoucies (`blurZoneNormals`).
   */
  zones: Record<string, number[]>;
  smoothZones: Set<number>;
}

interface GltfExtras {
  r1c?: { os: string[]; regions: string[]; cibles: { nom: string; articulations: Record<string, number[]> }[]; zonesLissees?: Record<string, number[]> };
}

export function templateFromGltf(gltf: GLTF): HumanTemplate {
  const extras = (gltf.scene.userData as GltfExtras).r1c;
  if (!extras) throw new Error("humain.glb : extras r1c absents");
  const prims: HumanTemplate["prims"] = [];
  let skeleton: Skeleton | null = null;
  gltf.scene.traverse((o) => {
    const m = o as SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const name = (m.material as Material).name;
    if (name === "yeux") dropCornea(m.geometry);
    prims.push({ name, geometry: m.geometry });
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
  const zones = extras.zonesLissees ?? {};
  const smoothZones = new Set(Object.values(zones).flat());
  return { prims, morphNames, bones, boneIndex, morphJoints, regions: extras.regions, zones, smoothZones };
}

/**
 * Cornée des yeux de MakeHuman : une coque autour de l'œil, transparente dans MakeHuman, dont les coordonnées de texture
 * tombent dans le disque bleuté du coin de l'atlas (u, v > 0,85). Opaque, elle masquerait l'iris : ses triangles sont retirés
 * (l'œil garde un matériau brillant).
 */
function dropCornea(g: BufferGeometry): void {
  const idx = g.getIndex();
  const uv = g.getAttribute("uv");
  if (!idx || !uv) return;
  const keep: number[] = [];
  for (let k = 0; k < idx.count; k += 3) {
    let u = 0;
    let v = 0;
    for (let e = 0; e < 3; e++) {
      u += uv.getX(idx.getX(k + e)) / 3;
      v += uv.getY(idx.getX(k + e)) / 3;
    }
    if (u > 0.85 && v > 0.85) continue;
    keep.push(idx.getX(k), idx.getX(k + 1), idx.getX(k + 2));
  }
  g.setIndex(keep);
}

/** Texture des yeux (atlas de MakeHuman, CC0) ; coordonnées à la convention glTF (pas de retournement vertical). */
export async function loadEyeTexture(url = EYE_TEXTURE_URL): Promise<Texture> {
  const tex = await new TextureLoader().loadAsync(url);
  tex.flipY = false;
  tex.colorSpace = SRGBColorSpace;
  return tex;
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
  /** Bras entier (épaule → poignet), puis avant-bras seul (coude → poignet), en plus. */
  arms?: number;
  forearm?: number;
  hands?: number;
  torso?: number;
  legs?: number;
  /** Pieds (autour de la cheville ; R1c, Titans : la taille du pied suit la longueur de la jambe). */
  feet?: number;
  /** Largeurs (R1c, Titans) : carrure (le torse s'élargit, les bras s'écartent), bassin (les jambes s'écartent), profondeur
   *  du torse et du bassin, largeur du crâne. */
  shoulders?: number;
  hips?: number;
  depth?: number;
  headWidth?: number;
  /** Épaisseurs (R1c, Titans) : rayon des bras, des jambes, du cou autour de l'axe de leurs os. */
  armGirth?: number;
  legGirth?: number;
  neckGirth?: number;
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
  // R1d : aucun détail anatomique — sein arrondi (cible officielle « breast-point-decr ») d'autant plus que le corps est féminin ;
  // la pointe du mamelon est carénée dans le .glb.
  out["breast_point_decr"] = 1.5 * (1 - m.gender);
  return out;
}

// ——— Chaînes d'os (déformations au repos) ———

type Chain = "tete" | "cou" | "torse" | "bassin" | "brasG" | "brasD" | "avantBrasG" | "avantBrasD" | "mainG" | "mainD" | "jambeG" | "jambeD" | "piedG" | "piedD";
const CHAIN_OF: [RegExp, Chain][] = [
  [/^(head|jaw|eye_l|eye_r)$/, "tete"],
  [/^neck_01$/, "cou"],
  [/^(spine_0[123]|clavicle_[lr])$/, "torse"],
  [/^(pelvis|Root)$/, "bassin"],
  [/^upperarm_l$/, "brasG"],
  [/^upperarm_r$/, "brasD"],
  [/^lowerarm_l$/, "avantBrasG"],
  [/^lowerarm_r$/, "avantBrasD"],
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
      deform([`bras${S}` as Chain, `avantBras${S}` as Chain], (p) => p.sub(Sh).multiplyScalar(kArm).add(Sh), (b) => b === `lowerarm_${side}`);
      deform([`main${S}` as Chain], (p) => p.add(W2.clone().sub(W)), (_b, c) => c === `main${S}`);
    }
    const kFore = pr.forearm ?? 1;
    if (kFore !== 1) {
      const E = J(`lowerarm_${side}`).clone();
      const W = J(`hand_${side}`).clone();
      const W2 = W.clone().sub(E).multiplyScalar(kFore).add(E);
      deform([`avantBras${S}` as Chain], (p) => p.sub(E).multiplyScalar(kFore).add(E), () => false);
      deform([`main${S}` as Chain], (p) => p.add(W2.clone().sub(W)), (_b, c) => c === `main${S}`);
    }
  }
  if ((pr.head ?? 1) !== 1) {
    const C = J("head").clone();
    const k = pr.head ?? 1;
    deform(["tete"], (p) => p.sub(C).multiplyScalar(k).add(C), (b, c) => c === "tete" && b !== "head");
  }
  if ((pr.headWidth ?? 1) !== 1) {
    const k = pr.headWidth ?? 1;
    deform(["tete"], (p) => p.setX(p.x * k), (_b, c) => c === "tete");
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
    const above: Chain[] = ["tete", "cou", "brasG", "brasD", "avantBrasG", "avantBrasD", "mainG", "mainD"];
    deform(above, (p) => p.setY(p.y + shift), (_b, c) => above.includes(c));
  }
  if ((pr.feet ?? 1) !== 1) {
    const k = pr.feet ?? 1;
    for (const side of ["l", "r"] as const) {
      const S = side === "l" ? "G" : "D";
      const A = J(`foot_${side}`).clone();
      deform([`pied${S}` as Chain], (p) => p.sub(A).multiplyScalar(k).add(A), (b, c) => c === `pied${S}` && b !== `foot_${side}`);
    }
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
  // Largeurs : le torse (ou le bassin) s'élargit autour de l'axe du corps, les membres qui s'y attachent s'écartent d'autant.
  const widen = (k: number | undefined, core: Chain, joint: string, limbs: (S: "G" | "D") => Chain[]): void => {
    if ((k ?? 1) === 1 || k === undefined) return;
    deform([core], (p) => p.setX(p.x * k), (_b, c) => c === core);
    for (const side of ["l", "r"] as const) {
      const S = side === "l" ? "G" : "D";
      const dx = J(`${joint}_${side}`).x * (k - 1);
      const chains = limbs(S);
      deform(chains, (p) => p.setX(p.x + dx), (_b, c) => chains.includes(c));
    }
  };
  widen(pr.shoulders, "torse", "upperarm", (S) => [`bras${S}` as Chain, `avantBras${S}` as Chain, `main${S}` as Chain]);
  widen(pr.hips, "bassin", "thigh", (S) => [`jambe${S}` as Chain, `pied${S}` as Chain]);
  if ((pr.depth ?? 1) !== 1) {
    const k = pr.depth ?? 1;
    const z0 = (J("spine_01").z + J("spine_02").z + J("spine_03").z) / 3;
    deform(["torse", "bassin"], (p) => p.setZ(z0 + (p.z - z0) * k), () => false);
  }
  // Épaisseurs : chaque sommet s'écarte de l'axe de ses os (segment articulation → articulation suivante), selon ses poids.
  const girth = (k: number | undefined, segs: [string, string][]): void => {
    if (k === undefined || k === 1) return;
    const seg = new Map<number, [Vector3, Vector3]>();
    for (const [a, b] of segs) seg.set(t.boneIndex.get(a) ?? -1, [J(a).clone(), J(b).clone()]);
    const v = new Vector3();
    const d = new Vector3();
    prims.forEach((p, pi) => {
      const arr = pos[pi] as Float32Array;
      const si = p.geometry.getAttribute("skinIndex");
      const sw = p.geometry.getAttribute("skinWeight");
      for (let i = 0; i < si.count; i++) {
        let dx = 0;
        let dy = 0;
        let dz = 0;
        for (let c = 0; c < 4; c++) {
          const s2 = seg.get(si.getComponent(i, c));
          const w = sw.getComponent(i, c);
          if (!s2 || w <= 0) continue;
          const [A, B] = s2;
          v.set(arr[i * 3] as number, arr[i * 3 + 1] as number, arr[i * 3 + 2] as number);
          d.copy(B).sub(A);
          const u = Math.max(0, Math.min(1, v.clone().sub(A).dot(d) / Math.max(1e-9, d.lengthSq())));
          const off = v.sub(A.clone().addScaledVector(d, u));
          dx += w * (k - 1) * off.x;
          dy += w * (k - 1) * off.y;
          dz += w * (k - 1) * off.z;
        }
        arr[i * 3] = (arr[i * 3] as number) + dx;
        arr[i * 3 + 1] = (arr[i * 3 + 1] as number) + dy;
        arr[i * 3 + 2] = (arr[i * 3 + 2] as number) + dz;
      }
    });
  };
  girth(pr.armGirth, [
    ["upperarm_l", "lowerarm_l"],
    ["lowerarm_l", "hand_l"],
    ["upperarm_r", "lowerarm_r"],
    ["lowerarm_r", "hand_r"],
  ]);
  girth(pr.legGirth, [
    ["thigh_l", "calf_l"],
    ["calf_l", "foot_l"],
    ["thigh_r", "calf_r"],
    ["calf_r", "foot_r"],
  ]);
  girth(pr.neckGirth, [["neck_01", "head"]]);
  for (const s of shape.smooth ?? []) smoothRegion(prims, pos, s.iterations, s.inflate, s.region);
  flattenZones(t, prims, pos);

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
  blurZoneNormals(t.smoothZones, prims, normals);
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

/**
 * R1d : dans les zones carénées, normales moyennées sur le voisinage (quelques passes) : les facettes très fines de l'ancien
 * mamelon gardaient un point d'ombre. Pas au-delà : sur le sein, des normales moyennées effacent son modelé. Seul l'ombrage
 * change ; les copies d'un même sommet (coutures) restent identiques.
 */
function blurZoneNormals(zone: ReadonlySet<number>, prims: HumanTemplate["prims"], normals: Float32Array[]): void {
  if (zone.size === 0) return;
  const PASSES = 4;
  const sum = new Map<number, Vector3>();
  const nbrs = new Map<number, Set<number>>();
  const copies = new Map<number, [number, number][]>();
  prims.forEach((p, pi) => {
    const o = p.geometry.getAttribute("_orig");
    const idx = p.geometry.getIndex();
    if (!o || !idx || !p.name.startsWith("peau_")) return;
    const og = (i: number): number => Math.round(o.getX(i));
    for (let i = 0; i < o.count; i++) {
      const v = og(i);
      const l = copies.get(v) ?? [];
      l.push([pi, i]);
      copies.set(v, l);
    }
    for (let k = 0; k < idx.count; k += 3) {
      const tri = [og(idx.getX(k)), og(idx.getX(k + 1)), og(idx.getX(k + 2))];
      for (const a of tri) {
        if (!zone.has(a)) continue;
        const s = nbrs.get(a) ?? new Set<number>();
        for (const b of tri) if (b !== a) s.add(b);
        nbrs.set(a, s);
      }
    }
  });
  const normalOf = (v: number): Vector3 => {
    const c = sum.get(v);
    if (c) return c;
    const [pi, i] = copies.get(v)?.[0] ?? [0, 0];
    const a = normals[pi] as Float32Array;
    return new Vector3(a[i * 3] as number, a[i * 3 + 1] as number, a[i * 3 + 2] as number);
  };
  for (let pass = 0; pass < PASSES; pass++) {
    const next = new Map<number, Vector3>();
    for (const [v, ns] of nbrs) {
      const acc = normalOf(v).clone();
      for (const n of ns) acc.add(normalOf(n));
      next.set(v, acc.normalize());
    }
    for (const [v, n] of next) sum.set(v, n);
  }
  for (const [v, n] of sum) {
    for (const [pi, i] of copies.get(v) ?? []) (normals[pi] as Float32Array).set([n.x, n.y, n.z], i * 3);
  }
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

/** Peau soudée par sommet d'origine (`_orig`) : position, normale (somme des normales de faces), voisins, copies, triangles. */
interface SkinGraph {
  P: Map<number, Vector3>;
  N: Map<number, Vector3>;
  adj: Map<number, Set<number>>;
  copies: Map<number, [number, number][]>;
  tris: [number, number, number][];
}
function skinGraph(parts: { name: string; geometry: BufferGeometry; pos: ArrayLike<number> }[]): SkinGraph {
  const g: SkinGraph = { P: new Map(), N: new Map(), adj: new Map(), copies: new Map(), tris: [] };
  parts.forEach((p, pi) => {
    if (!p.name.startsWith("peau_")) return;
    const o = p.geometry.getAttribute("_orig");
    const idx = p.geometry.getIndex();
    if (!o || !idx) return;
    const og = (i: number): number => Math.round(o.getX(i));
    for (let i = 0; i < o.count; i++) {
      const v = og(i);
      const l = g.copies.get(v) ?? [];
      l.push([pi, i]);
      g.copies.set(v, l);
      if (!g.P.has(v)) g.P.set(v, new Vector3(p.pos[i * 3] as number, p.pos[i * 3 + 1] as number, p.pos[i * 3 + 2] as number));
    }
    const e1 = new Vector3();
    const e2 = new Vector3();
    for (let k = 0; k < idx.count; k += 3) {
      const tri: [number, number, number] = [og(idx.getX(k)), og(idx.getX(k + 1)), og(idx.getX(k + 2))];
      g.tris.push(tri);
      const [a, b, c] = tri.map((v) => g.P.get(v) as Vector3) as [Vector3, Vector3, Vector3];
      const fn = e1.subVectors(b, a).cross(e2.subVectors(c, a)).clone();
      for (const x of tri) {
        (g.N.get(x) ?? g.N.set(x, new Vector3()).get(x))?.add(fn);
        for (const y of tri) if (x !== y) (g.adj.get(x) ?? g.adj.set(x, new Set()).get(x))?.add(y);
      }
    }
  });
  for (const n of g.N.values()) n.normalize();
  return g;
}

/** Couronnes successives autour d'un morceau de zone (la première touche la zone). */
function zoneRings(part: readonly number[], g: SkinGraph, rings: number): number[][] {
  const seen = new Set(part);
  let ring = [...part];
  const out: number[][] = [];
  for (let r = 0; r < rings; r++) {
    const next: number[] = [];
    for (const v of ring) {
      for (const n of g.adj.get(v) ?? []) {
        if (seen.has(n)) continue;
        seen.add(n);
        next.push(n);
      }
    }
    out.push(next);
    ring = next;
  }
  return out;
}

/** Quadrique h = a·u² + b·uv + c·v² + d·u + e·v + f d'un pourtour, dans le repère (u, w, n) de sa normale moyenne. */
interface ZoneFit {
  c: Vector3;
  u: Vector3;
  w: Vector3;
  n: Vector3;
  q: number[];
}
function fitQuadric(annulus: readonly number[], g: SkinGraph): ZoneFit | null {
  if (annulus.length < 12) return null;
  const c = new Vector3();
  const n = new Vector3();
  for (const v of annulus) {
    c.add(g.P.get(v) as Vector3);
    n.add(g.N.get(v) as Vector3);
  }
  c.multiplyScalar(1 / annulus.length);
  n.normalize();
  const u = Math.abs(n.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  u.sub(n.clone().multiplyScalar(u.dot(n))).normalize();
  const fit: ZoneFit = { c, u, w: n.clone().cross(u), n, q: [] };
  const A = Array.from({ length: 6 }, () => new Array<number>(7).fill(0));
  for (const v of annulus) {
    const [x, y, h] = zoneLocal(fit, g.P.get(v) as Vector3);
    const row = [x * x, x * y, y * y, x, y, 1];
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) (A[i] as number[])[j] = ((A[i] as number[])[j] as number) + (row[i] as number) * (row[j] as number);
      (A[i] as number[])[6] = ((A[i] as number[])[6] as number) + (row[i] as number) * h;
    }
  }
  for (let i = 0; i < 6; i++) {
    let piv = i;
    for (let k = i + 1; k < 6; k++) if (Math.abs((A[k] as number[])[i] as number) > Math.abs((A[piv] as number[])[i] as number)) piv = k;
    [A[i], A[piv]] = [A[piv] as number[], A[i] as number[]];
    const d = (A[i] as number[])[i] as number;
    if (Math.abs(d) < 1e-18) return null;
    for (let k = 0; k < 6; k++) {
      if (k === i) continue;
      const f = ((A[k] as number[])[i] as number) / d;
      for (let j = i; j < 7; j++) (A[k] as number[])[j] = ((A[k] as number[])[j] as number) - f * ((A[i] as number[])[j] as number);
    }
  }
  fit.q = A.map((r, i) => (r[6] as number) / (r[i] as number));
  return fit;
}
const zoneLocal = (f: ZoneFit, p: Vector3): [number, number, number] => {
  const d = p.clone().sub(f.c);
  return [d.dot(f.u), d.dot(f.w), d.dot(f.n)];
};
const zoneHeight = (f: ZoneFit, x: number, y: number): number => {
  const q = f.q as [number, number, number, number, number, number];
  return q[0] * x * x + q[1] * x * y + q[2] * y * y + q[3] * x + q[4] * y + q[5];
};

/**
 * Surface lissée d'un morceau de zone, en hauteurs le long de la normale de son pourtour : la quadrique ajustée sur la 3ᵉ à la
 * 5ᵉ couronne (la forme du sein), plus l'écart de la peau à cette quadrique sur la 1ʳᵉ couronne, prolongé dans la zone par
 * interpolation harmonique — la surface rejoint la peau sans marche ni pli. `cur` : hauteur actuelle de chaque sommet.
 */
function smoothedZone(part: readonly number[], g: SkinGraph): { fit: ZoneFit; target: Map<number, number>; cur: Map<number, number> } | null {
  const rings = zoneRings(part, g, 5);
  const fit = fitQuadric(rings.slice(2).flat(), g);
  if (!fit) return null;
  const cur = new Map<number, number>();
  const resid = new Map<number, number>();
  for (const v of [...part, ...(rings[0] ?? [])]) {
    const [x, y, h] = zoneLocal(fit, g.P.get(v) as Vector3);
    cur.set(v, h);
    resid.set(v, part.includes(v) ? 0 : h - zoneHeight(fit, x, y));
  }
  for (let it = 0; it < 2000; it++) {
    let moved = 0;
    for (const v of part) {
      let sum = 0;
      let k = 0;
      for (const n of g.adj.get(v) ?? []) {
        const r = resid.get(n);
        if (r === undefined) continue;
        sum += r;
        k++;
      }
      const r = k > 0 ? sum / k : 0;
      moved = Math.max(moved, Math.abs(r - (resid.get(v) as number)));
      resid.set(v, r);
    }
    if (moved < 1e-9) break;
  }
  const target = new Map<number, number>();
  for (const v of part) {
    const [x, y] = zoneLocal(fit, g.P.get(v) as Vector3);
    target.set(v, zoneHeight(fit, x, y) + (resid.get(v) as number));
  }
  return { fit, target, cur };
}

/**
 * R1d : aucun détail anatomique — chaque aréole et sa couronne (zone « mamelons ») sont rabattues, le long de la normale de
 * leur pourtour, sur leur surface lissée (`smoothedZone`) : le sein garde sa forme, sans mamelon ni aréole.
 */
function flattenZones(t: HumanTemplate, prims: HumanTemplate["prims"], pos: Float32Array[]): void {
  const zone = t.zones["mamelons"];
  if (!zone || zone.length === 0) return;
  const g = skinGraph(prims.map((p, pi) => ({ name: p.name, geometry: p.geometry, pos: pos[pi] as Float32Array })));
  for (const part of zoneParts(zone, g)) {
    const s = smoothedZone(part, g);
    if (!s) continue;
    for (const v of part) {
      const q = (g.P.get(v) as Vector3).clone().addScaledVector(s.fit.n, (s.target.get(v) as number) - (s.cur.get(v) as number));
      for (const [pi, i] of g.copies.get(v) ?? []) (pos[pi] as Float32Array).set([q.x, q.y, q.z], i * 3);
    }
  }
}

/**
 * R1d (contrôle) : relief des mamelons par rapport à leur surface lissée (`smoothedZone`, recalculée sur le corps façonné, au
 * repos) : `up`, plus grande saillie d'un sommet au-dessus d'elle ; `down`, plus grand creux (m). Un mamelon ressort de
 * plusieurs millimètres ; une zone rabattue, de presque rien.
 */
export function zoneRelief(body: HumanBody, zone: Iterable<number>): { up: number; down: number } {
  const g = skinGraph([...body.meshes].map(([name, m]) => ({ name, geometry: m.geometry, pos: m.geometry.getAttribute("position").array })));
  let up = 0;
  let down = 0;
  for (const part of zoneParts([...zone].filter((v) => g.P.has(v)), g)) {
    const s = smoothedZone(part, g);
    if (!s) continue;
    for (const v of part) {
      const d = (s.cur.get(v) as number) - (s.target.get(v) as number);
      up = Math.max(up, d);
      down = Math.max(down, -d);
    }
  }
  return { up, down };
}

/**
 * R1d (contrôle) : relief de l'entrejambe par rapport à sa surface carénée — le même opérateur que la construction
 * (`assets:build`, `fairing.ts`) : plaque mince du pourtour, poids cotangents et normales du corps de référence caréné.
 * `up` : plus grande saillie au-dessus de cette surface ; `down` : plus grand creux (m, corps façonné au repos).
 */
export function fairRelief(t: HumanTemplate, body: HumanBody, zone: Iterable<number>): { up: number; down: number } {
  const ref = skinGraph(t.prims.map((p) => ({ name: p.name, geometry: p.geometry, pos: p.geometry.getAttribute("position").array })));
  const cur = skinGraph([...body.meshes].map(([name, m]) => ({ name, geometry: m.geometry, pos: m.geometry.getAttribute("position").array })));
  const z = [...zone].filter((v) => ref.P.has(v) && cur.P.has(v));
  const P = (g: SkinGraph) => (v: number): V3 => (g.P.get(v) as Vector3).toArray() as V3;
  const h = fairHeights((v, c) => P(cur)(v)[c] as number, z, cotangentWeights(ref.tris, P(ref)), (v) => (ref.N.get(v) as Vector3).toArray() as V3);
  let up = 0;
  let down = 0;
  for (const x of h) {
    up = Math.max(up, -x);
    down = Math.max(down, x);
  }
  return { up, down };
}

/** Morceaux connexes d'une zone dans la peau. */
function zoneParts(zone: Iterable<number>, g: SkinGraph): number[][] {
  const left = new Set(zone);
  const parts: number[][] = [];
  for (const start of [...left]) {
    if (!left.delete(start)) continue;
    const part = [start];
    for (let i = 0; i < part.length; i++) for (const n of g.adj.get(part[i] as number) ?? []) if (left.delete(n)) part.push(n);
    parts.push(part);
  }
  return parts;
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

