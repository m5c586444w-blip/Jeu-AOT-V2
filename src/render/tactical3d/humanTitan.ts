import { Color, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { Material, Object3D, Texture } from "three";
import { buildHumanBody } from "./humanBase";
import type { HumanBody, HumanTemplate, Macro, Proportions } from "./humanBase";
import { poseHuman } from "./humanAnim";
import type { Gait } from "./humanAnim";
import { buildHairCap, paintHair } from "./humanSoldier";
import { unitSphere } from "./rig";
import { derive, range, seeded } from "./rng";
import { MATERIALS } from "./styles";
import { TITAN_LARGE, titanSteam } from "./titan";
import type { JointName, Titan, TitanSpec } from "./titan";

/**
 * Titans de R1c : le corps de base MakeHuman (CC0) déformé par les paramètres de R1b (`data/art/titans.json`).
 * - Longueurs (fractions de la hauteur) : jambes (sol → hanches), torse (hanches → ligne d'épaules), cou (épaules → menton),
 *   tête (menton → sommet du crâne), bras, avant-bras, main ; résolues par chaîne d'os puis vérifiées sur le corps façonné.
 * - Largeurs : carrure, bassin, profondeur du torse, largeur du crâne ; épaisseurs des bras, des jambes, du cou.
 * - Corpulence (rapport taille / poitrine) et ventre : cibles de corpulence et « ventre » de MakeHuman.
 * - Expressions par cibles de visage et mâchoire : rictus (coins de la bouche tirés, lèvres rétractées, yeux plissés),
 *   béant (bouche ouverte, yeux exorbités), neutre (regard fixe), creuse (orbites sombres, nocturne).
 * Aucun Titan de l'œuvre n'est reproduit (D-83) ; la marque rouge de nuque reste un repère de lisibilité (03 §4.2).
 */
export const TITAN_BONES: Record<JointName, string> = {
  bassin: "pelvis",
  torse: "spine_01",
  poitrine: "spine_03",
  cou: "neck_01",
  tete: "head",
  machoire: "jaw",
  epauleG: "upperarm_l",
  coudeG: "lowerarm_l",
  poignetG: "hand_l",
  epauleD: "upperarm_r",
  coudeD: "lowerarm_r",
  poignetD: "hand_r",
  hancheG: "thigh_l",
  genouG: "calf_l",
  chevilleG: "foot_l",
  hancheD: "thigh_r",
  genouD: "calf_r",
  chevilleD: "foot_r",
};

/** Mesures au repos d'un corps, en fractions de sa hauteur (mêmes définitions que les paramètres de R1b). */
export interface TitanMeasures {
  legs: number;
  torso: number;
  neck: number;
  head: number;
  upperArm: number;
  foreArm: number;
  hand: number;
  shoulder: number;
  hip: number;
  headW: number;
  depth: number;
  armR: number;
  thighR: number;
  neckR: number;
  /** Ordonnées utiles (fractions) : hanches, épaules, base du cou, articulation de la tête, menton, cheville. */
  y: { hip: number; shoulder: number; neck: number; head: number; chin: number; ankle: number };
}

/** Poids cumulé d'un ensemble d'os sur un sommet. */
function boneWeight(m: HumanBody["meshes"] extends Map<string, infer M> ? M : never, i: number, set: Set<number>): number {
  const si = m.geometry.getAttribute("skinIndex");
  const sw = m.geometry.getAttribute("skinWeight");
  let w = 0;
  for (let k = 0; k < 4; k++) if (set.has(si.getComponent(i, k))) w += sw.getComponent(i, k);
  return w;
}

export function titanMeasures(body: HumanBody): TitanMeasures {
  const H = body.height;
  const J = (n: string): Vector3 => body.joints.get(n) ?? new Vector3();
  const idx = (names: string[]): Set<number> => new Set(names.map((n) => body.skeleton.bones.findIndex((b) => b.name === n)));
  const hip = (J("thigh_l").y + J("thigh_r").y) / 2;
  const sh = (J("upperarm_l").y + J("upperarm_r").y) / 2;
  const head = body.meshes.get("peau_tete");
  const headSet = idx(["head", "jaw"]);
  let chin = J("head").y;
  let headHalf = 0;
  if (head) {
    const p = head.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      if (boneWeight(head, i, headSet) < 0.9) continue;
      headHalf = Math.max(headHalf, Math.abs(p.getX(i)));
      if (p.getZ(i) > J("head").z) chin = Math.min(chin, p.getY(i));
    }
  }
  const hands = body.meshes.get("peau_mains");
  let hand = 0;
  if (hands) {
    const p = hands.geometry.getAttribute("position");
    const w = J("hand_l");
    for (let i = 0; i < p.count; i++) if (p.getX(i) > 0) hand = Math.max(hand, Math.hypot(p.getX(i) - w.x, p.getY(i) - w.y, p.getZ(i) - w.z));
  }
  // Rayon moyen des sommets portés (≥ 90 %) par un os, autour du segment qui va à l'articulation suivante.
  const radius = (bone: string, next: string, min = 0.9): number => {
    const set = idx([bone]);
    const A = J(bone);
    const d = J(next).clone().sub(A);
    let s = 0;
    let n = 0;
    const v = new Vector3();
    for (const m of body.meshes.values()) {
      if (!m.name.startsWith("peau_")) continue;
      const p = m.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        if (boneWeight(m, i, set) < min) continue;
        v.set(p.getX(i), p.getY(i), p.getZ(i)).sub(A);
        const u = v.dot(d) / d.lengthSq();
        if (u < 0.2 || u > 0.8) continue;
        s += v.addScaledVector(d, -u).length();
        n++;
      }
    }
    return n > 0 ? s / n : 0;
  };
  const torso = body.meshes.get("peau_torse");
  let depth = 0.62;
  if (torso) {
    const p = torso.geometry.getAttribute("position");
    const set = idx(["spine_01", "spine_02", "spine_03"]);
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < p.count; i++) {
      if (boneWeight(torso, i, set) < 0.9) continue;
      x0 = Math.min(x0, p.getX(i));
      x1 = Math.max(x1, p.getX(i));
      z0 = Math.min(z0, p.getZ(i));
      z1 = Math.max(z1, p.getZ(i));
    }
    if (x1 > x0) depth = (z1 - z0) / (x1 - x0);
  }
  const headH = H - chin;
  return {
    legs: hip / H,
    torso: (sh - hip) / H,
    neck: (chin - sh) / H,
    head: headH / H,
    upperArm: J("upperarm_l").distanceTo(J("lowerarm_l")) / H,
    foreArm: J("lowerarm_l").distanceTo(J("hand_l")) / H,
    hand: hand / H,
    shoulder: J("upperarm_l").x / H,
    hip: J("thigh_l").x / H,
    headW: headHalf / headH,
    depth,
    armR: radius("upperarm_l", "lowerarm_l") / H,
    thighR: radius("thigh_l", "calf_l") / H,
    // Le cou partage ses sommets avec la tête et le torse : seuil de poids plus bas.
    neckR: radius("neck_01", "head", 0.5) / H,
    y: { hip: hip / H, shoulder: sh / H, neck: J("neck_01").y / H, head: J("head").y / H, chin: chin / H, ankle: J("foot_l").y / H },
  };
}

type Target = Pick<TitanSpec, "legs" | "torso" | "neck" | "head" | "upperArm" | "foreArm" | "hand" | "shoulder" | "hip" | "headW" | "depth" | "armR" | "thighR" | "neckR">;
const KEYS = ["legs", "torso", "neck", "head", "upperArm", "foreArm", "hand", "shoulder", "hip", "headW", "depth", "armR", "thighR", "neckR"] as const;

/**
 * Facteurs de proportion qui amènent le corps de base (mesures `b`) aux fractions `T`. Le torse garde sa longueur : la
 * hauteur relative `S` du corps s'en déduit, puis chaque segment (jambes, cou, tête, bras) est mis à `T × S`.
 */
function solve(b: TitanMeasures, T: Target): Proportions {
  const S = b.torso / T.torso;
  const y = b.y;
  const kHead = (T.head * S) / b.head;
  // Cou : du menton (qui monte avec la tête et le cou) à la ligne d'épaules.
  const neck0 = y.chin - y.shoulder;
  const kNeck = Math.max(0.25, 1 + (T.neck * S - neck0 - (kHead - 1) * (y.chin - y.head)) / (y.head - y.neck));
  // Le pied suit la longueur de la jambe (comme en R1) : la hauteur de cheville aussi.
  const kFeet = (T.legs * S) / b.legs;
  const kLegs = Math.max(0.2, (T.legs * S - y.ankle * kFeet) / (y.hip - y.ankle));
  const kArm = (T.upperArm * S) / b.upperArm;
  const kFore = (T.foreArm * S) / (b.foreArm * kArm);
  return {
    head: kHead,
    neck: kNeck,
    legs: kLegs,
    feet: kFeet,
    arms: kArm,
    forearm: kFore,
    hands: (T.hand * S) / b.hand,
    shoulders: (T.shoulder * S) / b.shoulder,
    hips: (T.hip * S) / b.hip,
    depth: T.depth / b.depth,
    headWidth: T.headW / b.headW,
    armGirth: (T.armR * S) / (b.armR * kArm),
    legGirth: (T.thighR * S) / b.thighR,
    neckGirth: (T.neckR * S) / b.neckR,
  };
}

/** Corpulence, musculature, ventre et visage d'un Titan (cibles de MakeHuman). */
export function titanMacro(spec: TitanSpec): { macro: Macro; details: Record<string, number> } {
  const weight = Math.max(0, Math.min(1, (spec.waist / spec.chest - 0.65) / 0.35));
  const muscle = spec.heat ? 0.85 : 0.3;
  const details: Record<string, number> = {};
  if (spec.belly > 0) details["stomach_pregnant_incr"] = Math.min(1.2, (spec.belly / 0.14) * 0.9);
  if (spec.expression === "rictus") {
    Object.assign(details, { mouth_corner_puller: 1.4, mouth_retraction: 0.8, eye_left_closure: 0.3, eye_right_closure: 0.3, eyebrows_left_inner_up: 0.6, eyebrows_right_inner_up: 0.6 });
  } else if (spec.expression === "beant") {
    Object.assign(details, { mouth_open: 1, eye_left_opened_up: 1.3, eye_right_opened_up: 1.3 });
  } else if (spec.expression === "neutre") {
    Object.assign(details, { eye_left_opened_up: 0.5, eye_right_opened_up: 0.5, mouth_depression: 0.4 });
  } else {
    Object.assign(details, { eye_left_closure: 0.25, eye_right_closure: 0.25, mouth_depression: 0.6 });
  }
  return { macro: { gender: 0.9, age: 0.55, muscle, weight }, details };
}

/**
 * Mesures visées. Les têtes de R1 étaient des sphères plus larges qu'un crâne : la largeur de tête se lit par rapport au
 * grand Titan de R1 (`TITAN_LARGE`, le plus proche d'un humain), dont la tête garde la largeur humaine.
 */
export const HEAD_WIDTH_REF = TITAN_LARGE.headW;
export function titanGoal(spec: TitanSpec, base: TitanMeasures): Target {
  const goal = Object.fromEntries(KEYS.map((k) => [k, spec[k]])) as Target;
  goal.headW = (base.headW * spec.headW) / HEAD_WIDTH_REF;
  return goal;
}

/** Facteurs résolus, par gabarit et par identifiant de Titan (le corps de base mesuré une fois par corpulence). */
const solved = new WeakMap<HumanTemplate, Map<string, Proportions>>();

export function titanProportions(t: HumanTemplate, spec: TitanSpec): Proportions {
  let cache = solved.get(t);
  if (!cache) {
    cache = new Map();
    solved.set(t, cache);
  }
  const hit = cache.get(spec.id);
  if (hit) return hit;
  const { macro, details } = titanMacro(spec);
  const base = buildHumanBody(t, { macro, details, height: 1 }, undefined, (p) => p.startsWith("peau_"));
  const b = titanMeasures(base);
  base.dispose();
  const goal = titanGoal(spec, b);
  // Cible effective corrigée par l'écart mesuré (les segments ne sont pas tout à fait indépendants) : deux passes.
  const T: Target = { ...goal };
  let pr = solve(b, T);
  for (let it = 0; it < 2; it++) {
    const body = buildHumanBody(t, { macro, details, proportions: pr, height: 1 }, undefined, (p) => p.startsWith("peau_"));
    const m = titanMeasures(body);
    body.dispose();
    let worst = 0;
    for (const k of KEYS) {
      const want = goal[k];
      if (want <= 0 || m[k] <= 0) continue;
      worst = Math.max(worst, Math.abs(m[k] / want - 1));
      T[k] *= want / m[k];
    }
    if (worst < 0.02) break;
    pr = solve(b, T);
  }
  cache.set(spec.id, pr);
  return pr;
}

/** Allure de R1b, et bouche ouverte pour l'expression béante. */
export function titanGait(spec: TitanSpec): Gait {
  return { stride: spec.stride, walkRate: spec.walkRate, armSwing: spec.armSwing, shoulderOut: spec.shoulderOut, headTilt: spec.headTilt, hunch: spec.hunch, mouth: spec.expression === "beant" ? 1 : 0 };
}

/** Titan de R1c : l'interface des Titans de R1, plus le corps de base qui le porte (mesures, tests). */
export interface HumanTitan extends Titan {
  human: HumanBody;
}

export function buildHumanTitan(t: HumanTemplate, spec: TitanSpec, seed: number, opts: { skinMap?: Texture | null; eyeMap?: Texture | null } = {}): HumanTitan {
  const H = spec.height;
  const rand = seeded(derive(seed, spec.salt));
  const { macro, details } = titanMacro(spec);
  // Variation individuelle : surtout masculins (pas de sexe visible), âge, un peu de corpulence.
  const indiv: Macro = { gender: range(rand, 0.65, 1), age: range(rand, 0.5, 0.75), muscle: macro.muscle, weight: Math.max(0, Math.min(1, macro.weight + range(rand, -0.08, 0.08))) };
  const skin = new MeshStandardMaterial({ color: new Color(spec.skin).multiplyScalar(range(rand, 0.94, 1.04)), map: opts.skinMap ?? null, roughness: 0.58, metalness: 0, emissive: new Color(MATERIALS.physiques.braise), emissiveIntensity: 0.025 });
  // Tête en couleurs de sommet seulement si des cheveux y sont peints (sans attribut de couleur, la tête serait noire).
  const head = skin.clone();
  head.vertexColors = spec.hair;
  const hollow = spec.expression === "creuse";
  const eyes = new MeshStandardMaterial({ map: hollow ? null : (opts.eyeMap ?? null), color: hollow ? new Color(MATERIALS.physiques.suie) : new Color(1, 1, 1), roughness: hollow ? 0.9 : 0.12 });
  const teeth = new MeshStandardMaterial({ color: new Color(MATERIALS.physiques.cire), roughness: 0.35 });
  const tongue = new MeshStandardMaterial({ color: new Color(MATERIALS.accents[1] ?? MATERIALS.physiques.braise).multiplyScalar(0.7), roughness: 0.5 });
  const hairMat = new MeshStandardMaterial({ color: new Color(MATERIALS.physiques.ecorce).multiplyScalar(0.6), roughness: 0.85 });
  const napeMat = new MeshStandardMaterial({ color: new Color(MATERIALS.accents[1] ?? MATERIALS.physiques.braise).multiplyScalar(1.3), emissive: new Color(MATERIALS.accents[1] ?? MATERIALS.physiques.braise), emissiveIntensity: 0.55, roughness: 0.5 });
  const materials: Material[] = [skin, head, eyes, teeth, tongue, hairMat, napeMat];
  const REGION: Record<string, Material> = { peau_tete: head, yeux: eyes, dents: teeth, langue: tongue };
  const body = buildHumanBody(t, { macro: indiv, details, proportions: titanProportions(t, spec), height: H }, (p) => REGION[p] ?? skin, (p) => p !== "pantalon");
  body.group.name = "corps";
  const group = new Group();
  group.name = `titan-${spec.id}`;
  group.add(body.group);

  // Cheveux : peints sur le crâne et coque, à l'échelle de la tête (et non de la hauteur).
  const m = titanMeasures(body);
  const headScale = (m.head * H) / (0.13 * 1.7);
  let hair: Mesh | null = null;
  if (spec.hair) {
    paintHair(body, hairMat, skin, headScale);
    hair = buildHairCap(body, hairMat, 0.012 * headScale, 0.008, 0, headScale);
    if (hair) body.group.add(hair);
  }

  // Marque de nuque : à l'arrière du cou, sous l'occiput, portée par l'os du cou.
  const N = body.joints.get("neck_01") ?? new Vector3();
  const Hd = body.joints.get("head") ?? new Vector3();
  const neckR = m.neckR * H;
  let back = N.z - neckR;
  const set = new Set([body.skeleton.bones.findIndex((b) => b.name === "neck_01")]);
  for (const mesh of body.meshes.values()) {
    if (!mesh.name.startsWith("peau_")) continue;
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < N.y + 0.3 * (Hd.y - N.y) || y > Hd.y || Math.abs(p.getX(i)) > neckR * 0.4) continue;
      if (boneWeight(mesh, i, set) > 0.5) back = Math.min(back, p.getZ(i));
    }
  }
  // Sphère unité partagée (rig.ts) : jamais libérée ici.
  const nape = new Mesh(unitSphere(16), napeMat);
  nape.name = "marque-nuque";
  const napeH = Math.max(0.5 * (Hd.y - N.y), 0.05 * m.head * H);
  // À plat contre la peau, entre la base du crâne et la ligne d'épaules : invisible de face.
  nape.scale.set(neckR * 0.45, napeH * 0.5, neckR * 0.16);
  nape.position.set(0, N.y + 0.45 * (Hd.y - N.y), back + neckR * 0.1).sub(N);
  body.bones["neck_01"]?.add(nape);

  const vapour = titanSteam(H, rand);
  group.add(vapour.points);
  const gait = titanGait(spec);
  const phase = rand() * 6;
  const joints = Object.fromEntries(Object.entries(TITAN_BONES).map(([k, b]) => [k, body.bones[b] as Object3D])) as Record<JointName, Object3D>;
  const tmp = new Vector3();
  const inv = body.group.matrixWorld.clone();

  const titan: HumanTitan = {
    human: body,
    spec,
    group,
    body: body.group,
    joints,
    nape,
    steam: vapour.points,
    pose: "marche",
    setPose(p, time) {
      titan.pose = p;
      vapour.points.visible = false;
      napeMat.emissiveIntensity = p === "abattu" ? 0.1 : 0.55;
      poseHuman(body, p, time, gait, phase);
      if (p === "abattu") {
        // Étendue du corps couché, par ses articulations (repère du groupe).
        let z0 = Infinity;
        let z1 = -Infinity;
        inv.copy(group.matrixWorld).invert();
        for (const b of body.skeleton.bones) {
          b.getWorldPosition(tmp).applyMatrix4(inv);
          z0 = Math.min(z0, tmp.z);
          z1 = Math.max(z1, tmp.z);
        }
        vapour.fall(time, z0, z1);
      } else if (spec.heat) vapour.heat(time);
      group.updateMatrixWorld(true);
      // Matrices d'os à jour : les mesures sur la peau (boîtes englobantes) suivent la pose.
      body.skeleton.update();
    },
    dispose() {
      body.dispose();
      hair?.geometry.dispose();
      vapour.dispose();
      for (const mt of materials) mt.dispose();
    },
  };
  titan.setPose("marche", 0);
  return titan;
}
