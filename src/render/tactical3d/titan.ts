import { BufferAttribute, BufferGeometry, Color, Group, MeshStandardMaterial, Points, PointsMaterial, TorusGeometry, Vector3 } from "three";
import type { Mesh, Object3D, Texture } from "three";
import { derive, range, seeded } from "./rng";
import type { Rand } from "./rng";
import { joint, lathe, limb, measureBox, part, unitSphere } from "./rig";

/**
 * Titans de l'essai 3D (R1.4) : deux anatomies opposées, articulées, expressions différentes, marque rouge de nuque.
 * - « petit » : 5 m (borne haute de `ttype_petit_errant`, `data/titan_types/purs.json`), trapu, grosse tête, ventre lourd,
 *   bras courts, voûté ; rictus figé, petits yeux vides.
 * - « grand » : 15 m (borne haute de `ttype_grand_errant`), filiforme, petite tête sur un long cou, bras qui descendent
 *   sous le genou, mèches de cheveux ; bouche béante, yeux exorbités.
 * Formes inventées pour le projet : aucun Titan de l'œuvre n'est reproduit (D-83). Pas de sang : un Titan abattu fume.
 * La marque rouge de la nuque est un repère de lisibilité du point faible (03 §4.2), pas un détail de l'œuvre.
 */
export type TitanPose = "marche" | "saisie" | "abattu" | "debout" | "course" | "allonge" | "buste" | "attaque" | "effondre";
/** Les trois poses de la planche de R1. */
export const TITAN_POSES: readonly TitanPose[] = ["marche", "saisie", "abattu"];
/** Toutes les poses (R1b) : debout (repos, pieds au sol), course (anormal), allongé (Titan qui ne tient pas debout), buste. */
export const ALL_TITAN_POSES: readonly TitanPose[] = ["marche", "saisie", "abattu", "debout", "course", "allonge", "buste"];

export interface TitanSpec {
  /** Identifiant (R1 : « petit », « grand » ; R1b : classes et Titans spéciaux de `data/art/titans.json`). */
  id: string;
  /** Sel de la graine locale (formes des mèches…). */
  salt: number;
  /** Hauteur debout (m). */
  height: number;
  /** Fractions de la hauteur : jambes (sol → bassin), torse (bassin → épaules), cou, tête. Somme = 1. */
  legs: number;
  torso: number;
  neck: number;
  head: number;
  /** Demi-largeur du crâne, en fraction de la hauteur de tête. */
  headW: number;
  /** Fractions de la hauteur : demi-carrure, demi-bassin, rayon de poitrine, de taille, de ventre. */
  shoulder: number;
  hip: number;
  chest: number;
  waist: number;
  belly: number;
  /** Profondeur du torse / largeur. */
  depth: number;
  upperArm: number;
  foreArm: number;
  hand: number;
  armR: number;
  thighR: number;
  neckR: number;
  /** Voussure du dos (rad). */
  hunch: number;
  skin: number;
  expression: "rictus" | "beant" | "neutre" | "creuse";
  hair: boolean;
  /** Amplitude de la foulée (rad). */
  stride: number;
  /** Cadence de marche (rad/s), balancement des bras (rad), écart des épaules au repos (rad), inclinaison de la tête (rad). */
  walkRate: number;
  armSwing: number;
  shoulderOut: number;
  headTilt: number;
  /** Vapeur permanente (chaleur du Colossal). */
  heat?: boolean;
  /** R3 : corps individuel (`data/art/figures_r3.json`), lu par le Titan sur corps de base ; ignoré par les figures de R1. */
  r3?: TitanR3;
}

/** R3 : corpulence, posture, démarche, dents, yeux et peau d'un Titan (choix de design A). */
export interface TitanR3 {
  variant: "a" | "b" | "c";
  macro?: { age?: number; weight?: number; muscle?: number };
  posture?: { lean?: number; drop?: number; armOut?: readonly [number, number]; kneeBend?: number; headRoll?: number };
  demarche?: { limp?: number; sway?: number; drag?: number; jerk?: number };
  /** Taille de chaque œil [gauche, droit] (1 : humaine). */
  eyes?: readonly [number, number];
  /** Peau : teinte mêlée à celle de la classe, marbrures (texture), couleur des dents. */
  skin: { id: "pale" | "rougeaude"; tint: number; mix: number; marbling: number; teeth: number };
}

export const TITAN_SMALL: TitanSpec = {
  id: "petit",
  salt: 11,
  height: 5,
  legs: 0.35,
  torso: 0.38,
  neck: 0.035,
  head: 0.235,
  headW: 0.58,
  shoulder: 0.15,
  hip: 0.085,
  chest: 0.15,
  waist: 0.14,
  belly: 0.13,
  depth: 0.82,
  upperArm: 0.16,
  foreArm: 0.14,
  hand: 0.075,
  armR: 0.042,
  thighR: 0.07,
  neckR: 0.07,
  hunch: 0.2,
  skin: 0xd7a68e,
  expression: "rictus",
  hair: false,
  stride: 0.36,
  walkRate: 2.3,
  armSwing: 0.3,
  shoulderOut: 0.1,
  headTilt: 0.12,
};

export const TITAN_LARGE: TitanSpec = {
  id: "grand",
  salt: 12,
  height: 15,
  legs: 0.5,
  torso: 0.29,
  neck: 0.085,
  head: 0.125,
  headW: 0.42,
  shoulder: 0.105,
  hip: 0.06,
  chest: 0.09,
  waist: 0.062,
  belly: 0,
  depth: 0.62,
  upperArm: 0.215,
  foreArm: 0.215,
  hand: 0.095,
  armR: 0.026,
  thighR: 0.046,
  neckR: 0.028,
  hunch: 0.1,
  skin: 0xc4a084,
  expression: "beant",
  hair: true,
  stride: 0.5,
  walkRate: 1.6,
  armSwing: 0.55,
  shoulderOut: 0.16,
  headTilt: -0.08,
};

export type JointName = "bassin" | "torse" | "poitrine" | "cou" | "tete" | "machoire" | "epauleG" | "coudeG" | "poignetG" | "epauleD" | "coudeD" | "poignetD" | "hancheG" | "genouG" | "chevilleG" | "hancheD" | "genouD" | "chevilleD";

export interface Titan {
  spec: TitanSpec;
  /** Placement dans le monde (position au sol, orientation y). */
  group: Group;
  /** Corps articulé (basculé quand le Titan est abattu). */
  body: Group;
  /** Articulations : groupes (R1) ou os du corps de base (R1c). */
  joints: Record<JointName, Object3D>;
  nape: Mesh;
  steam: Points;
  pose: TitanPose;
  /** Pose et temps d'animation (s) : la marche est un cycle, la saisie respire, l'abattu fume. */
  /** `clock` (s de bataille, R3) : fondu entre états sur le corps de base ; les figures de R1 l'ignorent. */
  setPose(p: TitanPose, t: number, clock?: number): void;
  dispose(): void;
}

export function buildTitan(spec: TitanSpec, seed: number, skinMap: Texture | null = null, calibrate = true): Titan {
  const H = spec.height;
  const rand = seeded(derive(seed, spec.salt));
  // Léger rayonnement chaud : imite la lumière qui traverse la peau, sans matériau coûteux.
  const skin = new MeshStandardMaterial({ color: spec.skin, map: skinMap, roughness: 0.58, metalness: 0, emissive: 0x2a120a, emissiveIntensity: 0.12 });
  const skinDark = new MeshStandardMaterial({ color: new Color(spec.skin).multiplyScalar(0.82), map: skinMap, roughness: 0.7 });
  const dark = new MeshStandardMaterial({ color: 0x1d1412, roughness: 0.45 });
  const ivory = new MeshStandardMaterial({ color: 0xe6dfcd, roughness: 0.35 });
  const hairMat = new MeshStandardMaterial({ color: 0x2a221c, roughness: 0.85 });
  const napeMat = new MeshStandardMaterial({ color: 0xb3261e, emissive: 0x7a0f0a, emissiveIntensity: 0.55, roughness: 0.5 });
  const materials = [skin, skinDark, dark, ivory, hairMat, napeMat];
  const S = unitSphere(20);

  const group = new Group();
  group.name = `titan-${spec.id}`;
  const body = new Group();
  body.name = "corps";
  group.add(body);

  const legLen = spec.legs * H;
  const thigh = 0.47 * legLen;
  const shin = 0.45 * legLen;
  const ankle = 0.08 * legLen;
  const T = spec.torso * H;
  const neckL = spec.neck * H;
  const hh = spec.head * H;
  const hw = spec.headW * hh;

  const j = {} as Record<JointName, Group>;
  j.bassin = joint("bassin", body, [0, legLen, 0]);
  j.torse = joint("torse", j.bassin);
  // Torse par révolution, aplati en profondeur.
  const torsoGeo = lathe(
    [
      [0, -0.07 * H],
      [spec.hip * H * 1.15, -0.045 * H],
      [spec.hip * H * 1.25, 0.02 * T],
      [spec.waist * H, 0.3 * T],
      [spec.chest * H * 0.98, 0.62 * T],
      [spec.chest * H, 0.8 * T],
      [spec.shoulder * H * 0.82, 0.93 * T],
      [spec.neckR * H * 1.7, 1.0 * T],
      [0, 1.03 * T],
    ],
    22,
  );
  j.torse.add(part(torsoGeo, skin, "torse", [0, 0, 0], [1, 1, spec.depth]));
  if (spec.belly > 0) j.torse.add(part(S, skin, "ventre", [0, 0.28 * T, spec.waist * H * 0.32], [spec.belly * H, spec.belly * H * 1.05, spec.belly * H * 0.95]));
  for (const s of [1, -1]) {
    j.torse.add(part(S, skin, "fessier", [s * spec.hip * H * 0.55, -0.01 * H, -spec.hip * H * 0.55], [spec.hip * H * 0.75, spec.hip * H * 0.8, spec.hip * H * 0.6]));
  }
  // Clavicules et trapèzes : la ligne d'épaule part du cou au lieu d'un cône.
  for (const s of [1, -1]) {
    j.torse.add(part(S, skin, "trapeze", [s * spec.shoulder * H * 0.45, 0.93 * T, -spec.chest * H * spec.depth * 0.15], [spec.shoulder * H * 0.55, spec.neckR * H * 0.9, spec.chest * H * spec.depth * 0.55], [0, 0, s * -0.32]));
    j.torse.add(part(S, skin, "clavicule", [s * spec.shoulder * H * 0.45, 0.92 * T, spec.chest * H * spec.depth * 0.5], [spec.shoulder * H * 0.5, spec.armR * H * 0.32, spec.armR * H * 0.32], [0, s * 0.25, s * -0.12]));
  }
  j.poitrine = joint("poitrine", j.torse, [0, 0.55 * T, 0]);
  j.cou = joint("cou", j.poitrine, [0, 0.42 * T, -0.01 * H]);
  j.cou.add(part(limb(neckL + 0.25 * hh, spec.neckR * H * 1.2, spec.neckR * H, 0, 0.5), skin, "cou", [0, neckL + 0.2 * hh, 0], [1, 1, 1]));
  // Marque de nuque : à l'arrière du cou, sous le crâne.
  const napeH = Math.max(neckL * 0.7, hh * 0.16);
  const nape = part(S, napeMat, "marque-nuque", [0, neckL * 0.55 + hh * 0.04, -spec.neckR * H * 0.92], [spec.neckR * H * 0.82, napeH * 0.55, spec.neckR * H * 0.32]);
  j.cou.add(nape);

  // Tête : crâne, mâchoire articulée, visage.
  j.tete = joint("tete", j.cou, [0, neckL, 0]);
  const cz = 0.04 * hh;
  j.tete.add(part(S, skin, "crane", [0, hh * 0.56, cz], [hw, hh * 0.47, hh * 0.5]));
  const faceZ = cz + hh * 0.46;
  for (const s of [1, -1]) j.tete.add(part(S, skin, "oreille", [s * hw * 0.97, hh * 0.52, cz - hh * 0.02], [hh * 0.04, hh * 0.13, hh * 0.08]));
  j.machoire = joint("machoire", j.tete, [0, hh * 0.3, cz + hh * 0.06]);
  j.machoire.add(part(S, skin, "machoire", [0, -hh * 0.06, hh * 0.14], [hw * 0.78, hh * 0.17, hh * 0.32]));
  if (spec.expression === "rictus") {
    // Petits yeux vides, haut placés et écartés ; sourcils hauts ; joues gonflées ; sourire trop large, dents serrées.
    for (const s of [1, -1]) {
      const ex = s * hw * 0.42;
      j.tete.add(part(S, ivory, "oeil", [ex, hh * 0.62, faceZ - hh * 0.05], [hh * 0.065, hh * 0.05, hh * 0.04]));
      j.tete.add(part(S, dark, "pupille", [ex + s * hh * 0.012, hh * 0.62, faceZ - hh * 0.015], [hh * 0.018, hh * 0.018, hh * 0.012]));
      j.tete.add(part(S, skinDark, "sourcil", [ex, hh * 0.73, faceZ - hh * 0.06], [hh * 0.09, hh * 0.018, hh * 0.03], [0, 0, s * 0.28]));
      j.tete.add(part(S, skin, "joue", [s * hw * 0.5, hh * 0.4, faceZ - hh * 0.13], [hh * 0.16, hh * 0.13, hh * 0.12]));
    }
    j.tete.add(part(S, skin, "nez", [0, hh * 0.5, faceZ + hh * 0.01], [hh * 0.06, hh * 0.06, hh * 0.06]));
    const arc = 2.5;
    const mouth = new TorusGeometry(hw * 0.62, hh * 0.036, 8, 32, arc);
    j.tete.add(part(mouth, dark, "bouche", [0, hh * 0.42, faceZ - hh * 0.11], [1, 0.75, 1], [0.15, 0, -Math.PI / 2 - arc / 2]));
    const teeth = new TorusGeometry(hw * 0.62, hh * 0.022, 6, 32, arc * 0.9);
    j.tete.add(part(teeth, ivory, "dents", [0, hh * 0.425, faceZ - hh * 0.09], [1, 0.62, 1], [0.15, 0, -Math.PI / 2 - (arc * 0.9) / 2]));
  } else if (spec.expression === "neutre" || spec.expression === "creuse") {
    // Neutre : regard fixe, bouche close en trait ; creuse (nocturne) : orbites sombres, sans pupilles.
    const hollow = spec.expression === "creuse";
    for (const s of [1, -1]) {
      const ex = s * hw * 0.4;
      j.tete.add(part(S, hollow ? dark : ivory, "oeil", [ex, hh * 0.6, faceZ - hh * 0.07], [hh * 0.075, hh * 0.05, hh * 0.05]));
      if (!hollow) j.tete.add(part(S, dark, "pupille", [ex, hh * 0.6, faceZ - hh * 0.025], [hh * 0.02, hh * 0.02, hh * 0.012]));
      j.tete.add(part(S, skinDark, "sourcil", [ex, hh * 0.7, faceZ - hh * 0.05], [hh * 0.1, hh * 0.02, hh * 0.035]));
    }
    j.tete.add(part(S, skin, "nez", [0, hh * 0.48, faceZ + hh * 0.01], [hh * 0.05, hh * 0.09, hh * 0.06], [0.25, 0, 0]));
    j.tete.add(part(S, dark, "bouche", [0, hh * 0.33, faceZ - hh * 0.1], [hw * 0.36, hh * 0.018, hh * 0.03]));
  } else {
    // Yeux exorbités, minuscules pupilles ; sourcils froncés ; long nez ; mâchoire pendante sur une bouche noire.
    for (const s of [1, -1]) {
      const ex = s * hw * 0.42;
      j.tete.add(part(S, ivory, "oeil", [ex, hh * 0.6, faceZ - hh * 0.07], [hh * 0.1, hh * 0.1, hh * 0.08]));
      j.tete.add(part(S, dark, "pupille", [ex, hh * 0.6, faceZ + hh * 0.005], [hh * 0.022, hh * 0.022, hh * 0.01]));
      j.tete.add(part(S, skinDark, "sourcil", [ex, hh * 0.72, faceZ - hh * 0.03], [hh * 0.11, hh * 0.025, hh * 0.04], [0, 0, -s * 0.35]));
    }
    j.tete.add(part(S, skin, "nez", [0, hh * 0.47, faceZ + hh * 0.02], [hh * 0.045, hh * 0.12, hh * 0.07], [0.3, 0, 0]));
    j.tete.add(part(S, dark, "gorge", [0, hh * 0.24, cz + hh * 0.26], [hw * 0.52, hh * 0.13, hh * 0.18]));
    for (let k = -3; k <= 3; k++) {
      j.tete.add(part(S, ivory, "dent", [k * hw * 0.11, hh * 0.3, faceZ - hh * 0.12 - Math.abs(k) * hh * 0.02], [hh * 0.03, hh * 0.04, hh * 0.02]));
      j.machoire.add(part(S, ivory, "dent", [k * hw * 0.1, hh * 0.04, hh * 0.38 - Math.abs(k) * hh * 0.02], [hh * 0.028, hh * 0.035, hh * 0.02]));
    }
  }
  if (spec.hair) {
    // Mèches raides tombant de la calotte, vers l'arrière et les côtés.
    for (let k = 0; k < 16; k++) {
      const az = range(rand, Math.PI * 0.35, Math.PI * 1.65);
      const el = range(rand, 0.25, 1.15);
      const r = 0.98;
      const x = Math.sin(az) * Math.cos(el) * hw * r;
      const z = cz + Math.cos(az) * Math.cos(el) * hh * 0.5 * r;
      const y = hh * 0.56 + Math.sin(el) * hh * 0.47 * r;
      const len = hh * range(rand, 0.45, 0.85);
      j.tete.add(part(limb(len, hh * 0.05, hh * 0.018, 0.1, 0.3, 8), hairMat, "meche", [x, y + hh * 0.03, z], [1, 1, 1], [Math.cos(az) * 0.35, 0, -Math.sin(az) * 0.35]));
    }
    j.tete.add(part(S, hairMat, "calotte", [0, hh * 0.66, cz - hh * 0.03], [hw * 1.02, hh * 0.38, hh * 0.5]));
  }

  // Bras.
  for (const [s, side] of [[1, "G"], [-1, "D"]] as const) {
    const sh = joint(`epaule${side}`, j.poitrine, [s * spec.shoulder * H, 0.36 * T, -0.01 * H]);
    sh.add(part(S, skin, "deltoide", [s * -spec.armR * H * 0.1, -spec.armR * H * 0.7, 0], [spec.armR * H * 1.25, spec.armR * H * 2.1, spec.armR * H * 1.15]));
    sh.add(part(limb(spec.upperArm * H, spec.armR * H, spec.armR * H * 0.72, 0.28, 0.35), skin, "bras"));
    const el = joint(`coude${side}`, sh, [0, -spec.upperArm * H, 0]);
    el.add(part(S, skin, "coude", [0, spec.armR * H * 0.2, -spec.armR * H * 0.2], [spec.armR * H * 0.72, spec.armR * H * 1.1, spec.armR * H * 0.7]));
    el.add(part(limb(spec.foreArm * H, spec.armR * H * 0.82, spec.armR * H * 0.56, 0.22, 0.25), skin, "avant-bras"));
    const wr = joint(`poignet${side}`, el, [0, -spec.foreArm * H, 0]);
    const hl = spec.hand * H;
    wr.add(part(S, skin, "paume", [0, -hl * 0.3, 0], [spec.armR * H * 0.95, hl * 0.33, spec.armR * H * 0.45]));
    for (let f = 0; f < 4; f++) {
      const fx = (f - 1.5) * spec.armR * H * 0.42;
      const finger = joint(`doigt${side}${f}`, wr, [fx, -hl * 0.58, 0]);
      finger.add(part(limb(hl * (0.42 - Math.abs(f - 1.5) * 0.05), spec.armR * H * 0.17, spec.armR * H * 0.13, 0, 0.5, 8), skin, "doigt"));
    }
    const thumb = joint(`pouce${side}`, wr, [s * -spec.armR * H * 0.2, -hl * 0.25, spec.armR * H * 0.35]);
    thumb.rotation.set(-0.6, 0, s * 0.5);
    thumb.add(part(limb(hl * 0.36, spec.armR * H * 0.19, spec.armR * H * 0.14, 0, 0.5, 8), skin, "pouce"));
    j[`epaule${side}`] = sh;
    j[`coude${side}`] = el;
    j[`poignet${side}`] = wr;
  }
  // Jambes.
  for (const [s, side] of [[1, "G"], [-1, "D"]] as const) {
    const hp = joint(`hanche${side}`, j.bassin, [s * spec.hip * H, -0.015 * H, 0]);
    hp.add(part(limb(thigh, spec.thighR * H, spec.thighR * H * 0.62, 0.16, 0.3), skin, "cuisse"));
    const kn = joint(`genou${side}`, hp, [0, -thigh, 0]);
    kn.add(part(S, skin, "rotule", [0, spec.thighR * H * 0.1, spec.thighR * H * 0.3], [spec.thighR * H * 0.42, spec.thighR * H * 0.5, spec.thighR * H * 0.3]));
    kn.add(part(limb(shin, spec.thighR * H * 0.64, spec.thighR * H * 0.38, 0.24, 0.28), skin, "jambe"));
    const an = joint(`cheville${side}`, kn, [0, -shin, 0]);
    an.add(part(S, skin, "pied", [0, -ankle * 0.5, ankle * 0.7], [spec.thighR * H * 0.62, ankle * 0.5, ankle * 1.7]));
    j[`hanche${side}`] = hp;
    j[`genou${side}`] = kn;
    j[`cheville${side}`] = an;
  }

  const vapour = titanSteam(H, rand);
  const steam = vapour.points;
  group.add(steam);

  const rest = new Map<Group, [number, number, number]>();
  for (const g of Object.values(j)) rest.set(g, [g.rotation.x, g.rotation.y, g.rotation.z]);
  const fingers: Group[] = [];
  body.traverse((o) => {
    if (o instanceof Group && o.name.startsWith("doigt")) fingers.push(o);
  });
  const feet: Mesh[] = [];
  body.traverse((o) => {
    if ((o as Mesh).isMesh && o.name === "pied") feet.push(o as Mesh);
  });
  const worldTmp = new Vector3();
  /** Altitude du sol sous le Titan : celle de son groupe dans le monde. */
  const groupY = (): number => group.getWorldPosition(worldTmp).y;

  const titan: Titan = {
    spec,
    group,
    body,
    joints: j,
    nape,
    steam,
    pose: "marche",
    setPose(pose, t) {
      titan.pose = pose;
      // R3 : attaque et effondrement n'existent que sur le corps de base ; la figure de R1 montre la saisie et le corps abattu.
      const p: TitanPose = pose === "attaque" ? "saisie" : pose === "effondre" ? "abattu" : pose;
      for (const [g, r] of rest) g.rotation.set(...r);
      body.rotation.set(0, 0, 0);
      body.position.set(0, 0, 0);
      j.bassin.position.y = legLen;
      for (const f of fingers) f.rotation.set(0, 0, 0);
      steam.visible = false;
      napeMat.emissiveIntensity = 0.55;
      j.torse.rotation.x = spec.hunch;
      j.cou.rotation.x = -spec.hunch * 0.6;
      for (const s of ["G", "D"] as const) j[`epaule${s}`].rotation.z = (s === "G" ? 1 : -1) * spec.shoulderOut;
      if (p === "marche" || p === "course") {
        const run = p === "course";
        const ph = t * spec.walkRate * (run ? 1.5 : 1);
        const a = spec.stride;
        const sn = Math.sin(ph);
        const cs = Math.cos(ph);
        j.hancheG.rotation.x = -a * sn;
        j.hancheD.rotation.x = a * sn;
        j.genouG.rotation.x = 0.08 + 0.85 * Math.max(0, cs) ** 1.5;
        j.genouD.rotation.x = 0.08 + 0.85 * Math.max(0, -cs) ** 1.5;
        j.chevilleG.rotation.x = -0.25 * Math.max(0, cs);
        j.chevilleD.rotation.x = -0.25 * Math.max(0, -cs);
        const arm = spec.armSwing * (run ? 1.4 : 1);
        j.epauleG.rotation.x = arm * sn;
        j.epauleD.rotation.x = -arm * sn;
        j.coudeG.rotation.x = -0.2 - 0.15 * Math.max(0, -sn);
        j.coudeD.rotation.x = -0.2 - 0.15 * Math.max(0, sn);
        j.bassin.position.y = legLen * (1 - 0.03 * Math.abs(sn));
        j.torse.rotation.z = 0.05 * sn;
        j.torse.rotation.y = 0.07 * sn;
        j.tete.rotation.z = -0.04 * sn + spec.headTilt;
        j.machoire.rotation.x = spec.expression === "beant" ? 0.42 + 0.06 * Math.sin(ph * 2) : 0;
        for (const f of fingers) f.rotation.x = -0.35;
        if (run) {
          // Course : buste penché, genoux plus hauts, bras pliés.
          j.torse.rotation.x = spec.hunch + 0.45;
          j.cou.rotation.x = -0.5;
          j.genouG.rotation.x += 0.35 * Math.max(0, cs);
          j.genouD.rotation.x += 0.35 * Math.max(0, -cs);
          j.coudeG.rotation.x = -0.9;
          j.coudeD.rotation.x = -0.9;
        }
      } else if (p === "debout" || p === "buste") {
        // Repos : jambes droites, bras pendants ; la tête suit son inclinaison (sentinelle : tête basse).
        j.cou.rotation.x = -spec.hunch * 0.6 + spec.headTilt * 0.6;
        j.tete.rotation.x = spec.headTilt;
        j.coudeG.rotation.x = -0.12;
        j.coudeD.rotation.x = -0.12;
        j.machoire.rotation.x = spec.expression === "beant" ? 0.35 : 0;
        for (const f of fingers) f.rotation.x = -0.4;
      } else if (p === "allonge") {
        // Allongé, à plat ventre, bras tendus vers l'avant comme pour ramper ; tête relevée.
        body.rotation.x = Math.PI / 2;
        j.torse.rotation.x = 0;
        j.cou.rotation.x = -0.55;
        j.tete.rotation.x = -0.35;
        j.epauleG.rotation.set(-2.6, 0, 0.25);
        j.epauleD.rotation.set(-2.9, 0, -0.2);
        j.coudeG.rotation.x = -0.35;
        j.coudeD.rotation.x = -0.15;
        j.hancheG.rotation.set(0.08, 0, 0.12);
        j.hancheD.rotation.set(0.02, 0, -0.1);
        j.genouG.rotation.x = 0.5;
        j.machoire.rotation.x = 0.5;
        for (const f of fingers) f.rotation.x = -0.9;
      } else if (p === "saisie") {
        const breath = 0.03 * Math.sin(t * 2);
        j.torse.rotation.x = spec.hunch + 0.42 + breath;
        j.hancheG.rotation.x = -0.5;
        j.hancheD.rotation.x = -0.3;
        j.genouG.rotation.x = 0.7;
        j.genouD.rotation.x = 0.45;
        j.chevilleG.rotation.x = -0.15;
        j.bassin.position.y = legLen * 0.9;
        // Bras droit tendu vers la proie, main ouverte ; bras gauche replié, poing serré.
        j.epauleD.rotation.set(-1.45 - breath, 0.15, -0.15);
        j.coudeD.rotation.x = -0.2;
        j.poignetD.rotation.x = -0.3;
        j.epauleG.rotation.set(-0.75, 0, 0.35);
        j.coudeG.rotation.x = -1.1;
        j.cou.rotation.x = -0.45;
        j.tete.rotation.x = -0.2;
        j.machoire.rotation.x = spec.expression === "beant" ? 0.75 : 0.06;
        for (const f of fingers) f.rotation.x = f.name.startsWith("doigtG") ? -1.5 : -0.15;
      } else {
        // Abattu : face contre terre, bras écartés, tête de côté ; la nuque tranchée s'éteint, le corps fume.
        // Face contre terre, le corps couché sur +z : les membres restent dans le plan du dos (rotations en z), donc au sol.
        body.rotation.x = Math.PI / 2;
        j.torse.rotation.x = 0.04;
        j.cou.rotation.set(0.1, 1.1, 0);
        j.epauleG.rotation.set(0.05, 0, 1.15);
        j.coudeG.rotation.set(0, 0, -0.5);
        j.epauleD.rotation.set(0.05, 0, -2.5);
        j.coudeD.rotation.set(0, 0, 0.35);
        j.hancheG.rotation.set(0.04, 0, 0.18);
        j.genouG.rotation.x = 0.12;
        j.hancheD.rotation.set(0.04, 0, -0.1);
        j.machoire.rotation.x = 0.25;
        napeMat.emissiveIntensity = 0.1;
        for (const f of fingers) f.rotation.x = -0.6;
        body.updateMatrixWorld(true);
        const box = measureBox(body);
        body.position.y = groupY() - box.min.y;
        vapour.fall(t, box.min.z - group.position.z, box.max.z - group.position.z);
      }
      // Au sol (R1b) : debout, en marche, en course, en buste, les pieds touchent le sol ; allongé, le point le plus bas du corps.
      body.updateMatrixWorld(true);
      if (p === "allonge") {
        const box = measureBox(body);
        body.position.y += groupY() - box.min.y;
      } else if (p !== "abattu" && p !== "saisie") {
        const low = Math.min(...feet.map((f) => measureBox(f).min.y));
        body.position.y += groupY() - low;
      }
      if (spec.heat && p !== "abattu") vapour.heat(t);
      body.updateMatrixWorld(true);
    },
    dispose() {
      body.traverse((o) => {
        const g = (o as Mesh).geometry as BufferGeometry | undefined;
        if (g && g !== S) g.dispose();
      });
      vapour.dispose();
      for (const m of materials) m.dispose();
    },
  };
  // Étalonnage (R1b) : la hauteur debout MESURÉE sur la géométrie (boîte englobante) est ramenée exactement à la hauteur de la
  // classe ; les proportions ne donnent qu'une approximation (voussure, cheveux, calotte).
  if (calibrate) {
    titan.setPose("debout", 0);
    const measured = measureBox(body).max.y - measureBox(body).min.y;
    if (measured > 0) body.scale.setScalar(spec.height / measured);
  }
  titan.setPose("marche", 0);
  return titan;
}

/**
 * Vapeur d'un Titan (R1, partagée par les Titans de R1c) : bouffées qui montent, s'élargissent et pâlissent. Un Titan abattu
 * se dissout en fumant (03 §5.2) ; le Colossal fume en permanence (chaleur).
 */
export interface TitanSteam {
  points: Points;
  /** Titan abattu : bouffées le long du corps couché, de `zMin` à `zMax` (repère du groupe). */
  fall(t: number, zMin: number, zMax: number): void;
  /** Chaleur : bouffées autour des épaules et de la tête. */
  heat(t: number): void;
  dispose(): void;
}

export function titanSteam(H: number, rand: Rand): TitanSteam {
  const N = 90;
  const sGeo = new BufferGeometry();
  const sPos = new Float32Array(N * 3);
  const sCol = new Float32Array(N * 4);
  const seeds = Array.from({ length: N }, () => [rand(), rand(), rand(), rand()] as const);
  sGeo.setAttribute("position", new BufferAttribute(sPos, 3));
  sGeo.setAttribute("color", new BufferAttribute(sCol, 4));
  const mat = new PointsMaterial({ size: H * 0.55, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false });
  const points = new Points(sGeo, mat);
  points.name = "vapeur";
  points.visible = false;
  points.frustumCulled = false;
  const done = (): void => {
    (sGeo.getAttribute("position") as BufferAttribute).needsUpdate = true;
    (sGeo.getAttribute("color") as BufferAttribute).needsUpdate = true;
  };
  return {
    points,
    fall(t, zMin, zMax) {
      points.visible = true;
      const span = Math.max(1, zMax - zMin);
      const rise = H * 0.9;
      for (let i = 0; i < N; i++) {
        const [a, b, c, d] = seeds[i] as readonly [number, number, number, number];
        const k = (t * (0.08 + 0.1 * c) + d) % 1;
        sPos[i * 3] = (a - 0.5) * H * 0.3 + Math.sin(t * 0.7 + d * 6) * k * H * 0.08;
        sPos[i * 3 + 1] = H * 0.06 + k * rise;
        sPos[i * 3 + 2] = zMin + b * span;
        const fade = (1 - k) * Math.min(1, k * 6);
        sCol[i * 4] = 0.93;
        sCol[i * 4 + 1] = 0.92;
        sCol[i * 4 + 2] = 0.9;
        sCol[i * 4 + 3] = 0.32 * fade;
      }
      done();
    },
    heat(t) {
      points.visible = true;
      for (let i = 0; i < N; i++) {
        const [a, b, c, d] = seeds[i] as readonly [number, number, number, number];
        const k = (t * (0.05 + 0.08 * c) + d) % 1;
        sPos[i * 3] = (a - 0.5) * H * 0.35;
        sPos[i * 3 + 1] = H * (0.7 + 0.5 * k);
        sPos[i * 3 + 2] = (b - 0.5) * H * 0.25;
        sCol[i * 4] = 0.95;
        sCol[i * 4 + 1] = 0.94;
        sCol[i * 4 + 2] = 0.92;
        sCol[i * 4 + 3] = 0.28 * (1 - k) * Math.min(1, k * 5);
      }
      done();
    },
    dispose() {
      sGeo.dispose();
      mat.dispose();
    },
  };
}

/** Texture de vapeur posée après coup (DOM requis). */
export function setSteamTexture(t: Titan, map: Texture): void {
  const m = t.steam.material as PointsMaterial;
  m.map = map;
  m.needsUpdate = true;
}
