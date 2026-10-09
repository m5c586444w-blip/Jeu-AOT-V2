import { Quaternion, Vector3 } from "three";
import type { Bone, SkinnedMesh } from "three";
import type { HumanBody } from "./humanBase";

/**
 * Animations de R1c, écrites par le projet sur le squelette CC0 de MakeHuman (aucune animation externe : MakeHuman ne
 * livre que des poses figées). Les os sont sans rotation au repos, bras en « A » : une pose s'écrit en rotations dans le
 * repère du monde, empilées os par os ; la rotation locale d'un os en découle (parent d'abord).
 * - Soldats : attente, marche, course, garde au sol, vol (balancé au bout du câble), accroche (pieds au mur), frappe.
 * - Titans : marche, course, debout, saisie, abattu (face contre terre), allongé (rampe), buste.
 * Les pieds se posent au sol (sauf en vol, à l'accroche, abattu, allongé) : le bassin est descendu ou monté d'autant.
 */
export type HumanPose =
  | "attente"
  | "marche"
  | "course"
  | "sol"
  | "vol"
  | "accroche"
  | "frappe"
  | "debout"
  | "saisie"
  | "abattu"
  | "allonge"
  | "buste"
  | "chute"
  | "mort"
  | "tir"
  | "attaque"
  | "effondre";
export const SOLDIER_ANIMS: readonly HumanPose[] = ["attente", "marche", "course", "sol", "vol", "accroche", "frappe"];
export const TITAN_ANIMS: readonly HumanPose[] = ["marche", "course", "debout", "saisie", "abattu", "allonge", "buste"];
/**
 * R3 (fichier 21 §8) : poses et états montrés en bataille. Soldats : chute (en l'air, membres battants), mort (couché sur le
 * dos), tir (fusil épaulé), attaque (coupe : « frappe »). Titans : attaque (fente, bras tendus, bouche ouverte), effondre
 * (chute du corps abattu : `t` = secondes depuis le coup, 1,6 s jusqu'au sol), mort (« abattu »).
 */
export const R3_SOLDIER_POSES: readonly HumanPose[] = ["attente", "marche", "course", "chute", "mort", "frappe", "tir"];
export const R3_TITAN_POSES: readonly HumanPose[] = ["debout", "marche", "course", "attaque", "effondre", "abattu"];
/** Durée de l'effondrement d'un Titan abattu (s). */
export const TITAN_FALL_S = 1.6;

/** Allure (radians, radians par seconde) ; les valeurs des Titans viennent de `data/art/titans.json`. */
export interface Gait {
  stride: number;
  walkRate: number;
  armSwing: number;
  shoulderOut: number;
  headTilt: number;
  hunch: number;
  /** Bouche ouverte (0–1) : mâchoire. */
  mouth: number;
  /**
   * R3, posture individuelle (rad) : inclinaison latérale du buste, épaule tombante (> 0 : la gauche, < 0 : la droite), bras
   * écartés [gauche, droite] en plus de `shoulderOut`, genoux fléchis au repos, tête penchée sur le côté.
   */
  lean?: number;
  drop?: number;
  armOut?: readonly [number, number];
  kneeBend?: number;
  headRoll?: number;
  /** R3, démarche non uniforme (0–1, sauf `sway` en rad) : boiterie de la jambe gauche, roulis, bras droit traînant, cadence heurtée. */
  limp?: number;
  sway?: number;
  drag?: number;
  jerk?: number;
}

export const SOLDIER_GAIT: Gait = { stride: 0.42, walkRate: 5.4, armSwing: 0.38, shoulderOut: 0.12, headTilt: 0, hunch: 0, mouth: 0 };

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const qa = (axis: Vector3, a: number): Quaternion => new Quaternion().setFromAxisAngle(axis.clone().normalize(), a);

/** Pose en construction : rotations « monde » par os ; la rotation monde d'un os est la sienne suivie de celle de son parent. */
class PoseBuilder {
  private readonly R = new Map<string, Quaternion>();
  constructor(private readonly body: HumanBody) {}

  /** Empile une rotation monde (axe dans le monde au repos du corps, avant la rotation de ses parents). */
  turn(bone: string, axis: Vector3, angle: number): this {
    if (angle === 0) return this;
    const q = qa(axis, angle);
    const r = this.R.get(bone);
    this.R.set(bone, r ? q.multiply(r) : q);
    return this;
  }

  /** Rotation monde courante d'un os (lui et ses parents). */
  world(bone: string): Quaternion {
    const b = this.body.bones[bone];
    const own = this.R.get(bone)?.clone() ?? new Quaternion();
    const parent = b?.parent && (b.parent as Bone).isBone ? this.world(b.parent.name) : new Quaternion();
    return own.multiply(parent);
  }

  /** Axe local d'un os (repère au repos), exprimé dans le monde après les rotations de ses parents et de lui-même. */
  axis(bone: string, local: Vector3): Vector3 {
    return local.clone().applyQuaternion(this.world(bone));
  }

  /** Rotation dans le repère de l'os parent : flexion d'une articulation autour de l'axe local (genou, coude). */
  bend(bone: string, local: Vector3, angle: number): this {
    const b = this.body.bones[bone];
    const parent = b?.parent && (b.parent as Bone).isBone ? b.parent.name : bone;
    return this.turn(bone, this.axis(parent, local), angle);
  }

  /**
   * Couche le corps : la pose déjà écrite (repère debout) est basculée d'un bloc par `q` autour de la racine. Les rotations des
   * os sont conjuguées par `q` (q·R·q⁻¹), celle de la racine reçoit `q` : la rotation monde finale de chaque os est q·W.
   */
  lay(q: Quaternion): void {
    for (const [b, r] of this.R) this.R.set(b, q.clone().multiply(r).multiply(q.clone().invert()));
    const root = this.R.get("Root");
    this.R.set("Root", root ? q.clone().multiply(root) : q.clone());
  }

  commit(): void {
    for (const b of this.body.skeleton.bones) {
      const parentWorld = b.parent && (b.parent as Bone).isBone ? this.world(b.parent.name) : new Quaternion();
      const own = this.R.get(b.name) ?? new Quaternion();
      // local = parent⁻¹ · R · parent : l'os tourne de R dans le monde, à partir de l'orientation de son parent.
      b.quaternion.copy(parentWorld.clone().invert().multiply(own).multiply(parentWorld));
    }
  }
}

/** Angle de la pose « A » au repos : rotation (autour de z) qui amène chaque bras le long du corps. */
function armDownAngle(body: HumanBody, side: "l" | "r"): number {
  const s = body.joints.get(`upperarm_${side}`);
  const e = body.joints.get(`lowerarm_${side}`);
  if (!s || !e) return 0;
  const d = e.clone().sub(s);
  // Bras gauche (+x) : tourner dans le sens horaire vu de face (angle négatif autour de z) ; bras droit, l'inverse.
  const a = Math.atan2(Math.abs(d.x), -d.y);
  return side === "l" ? -a : a;
}

/** Fléchisseurs : axe latéral x. Une rotation négative autour de x porte un membre pendant vers l'avant. */
function legs(p: PoseBuilder, side: "l" | "r", hip: number, knee: number, ankle: number, spread = 0): void {
  p.turn(`thigh_${side}`, X, -hip);
  if (spread) p.turn(`thigh_${side}`, Z, side === "l" ? spread : -spread);
  p.bend(`calf_${side}`, X, knee);
  p.bend(`foot_${side}`, X, -ankle);
}

/** Axe de flexion du coude dans le repère au repos : perpendiculaire au bras (pose « A ») et à l'avant. */
function elbowAxis(body: HumanBody, side: "l" | "r"): Vector3 {
  const s = body.joints.get(`upperarm_${side}`);
  const e = body.joints.get(`lowerarm_${side}`);
  if (!s || !e) return X.clone().negate();
  return e.clone().sub(s).normalize().cross(Z).normalize();
}

/** Flexion du coude au repos : la pose de repos de MakeHuman a les avant-bras portés vers l'avant (≈ 43°). */
function restElbow(body: HumanBody, side: "l" | "r"): number {
  const s = body.joints.get(`upperarm_${side}`);
  const e = body.joints.get(`lowerarm_${side}`);
  const w = body.joints.get(`hand_${side}`);
  if (!s || !e || !w) return 0;
  return e.clone().sub(s).angleTo(w.clone().sub(e));
}

/** Bras : en avant (rad), écarté (rad), flexion du coude (rad, 0 = bras tendu), torsion. */
function arm(p: PoseBuilder, body: HumanBody, side: "l" | "r", forward: number, out: number, elbow: number, twist = 0): void {
  const s = side === "l" ? 1 : -1;
  p.turn(`upperarm_${side}`, Z, armDownAngle(body, side) + s * out);
  if (twist) p.turn(`upperarm_${side}`, Y, s * twist);
  p.turn(`upperarm_${side}`, X, -forward);
  p.bend(`lowerarm_${side}`, elbowAxis(body, side), elbow - restElbow(body, side));
}

function fingers(p: PoseBuilder, body: HumanBody, side: "l" | "r", curl: number): void {
  const ax = elbowAxis(body, side);
  for (const f of ["index", "middle", "ring", "pinky"]) for (const k of ["01", "02", "03"]) p.bend(`${f}_${k}_${side}`, ax, curl * (k === "01" ? 0.7 : 1));
  for (const k of ["02", "03"]) p.bend(`thumb_${k}_${side}`, ax, curl * 0.4);
}

/** Pose une animation à l'instant `t` (s). `phase` décale le cycle d'un individu. */
export function poseHuman(body: HumanBody, pose: HumanPose, t: number, g: Gait, phase = 0): void {
  const p = new PoseBuilder(body);
  const root = body.bones["Root"];
  if (root) root.position.copy(body.joints.get("Root") ?? new Vector3());
  const w = Math.sin(t * 2.2 + phase);
  // Voussure (Titans) : pas pour un corps couché, qu'elle soulèverait du sol.
  const lying = pose === "abattu" || pose === "allonge" || pose === "mort";
  const hunch = lying ? 0 : g.hunch;
  p.turn("spine_01", X, hunch * 0.4).turn("spine_02", X, hunch * 0.35).turn("spine_03", X, hunch * 0.25);
  p.turn("neck_01", X, -hunch * 0.5);
  p.turn("jaw", X, 0.42 * g.mouth);
  // Posture individuelle (R3) : buste penché sur le côté, épaule tombante, tête de travers ; pas pour un corps couché.
  const [outL, outR] = g.armOut ?? [0, 0];
  if (!lying) {
    const lean = g.lean ?? 0;
    p.turn("spine_01", Z, lean * 0.45).turn("spine_02", Z, lean * 0.35).turn("neck_01", Z, -lean * 0.4);
    const drop = g.drop ?? 0;
    if (drop > 0) p.turn("clavicle_l", Z, -drop);
    else if (drop < 0) p.turn("clavicle_r", Z, -drop);
    p.turn("head", Z, g.headRoll ?? 0);
  }
  const kb = g.kneeBend ?? 0;
  let ground = true;
  if (pose === "attente" || pose === "debout" || pose === "buste") {
    // Repos : bras le long du corps, coudes souples, respiration ; la tête suit son inclinaison.
    arm(p, body, "l", 0.05, g.shoulderOut * 0.5 + outL, 0.35 + 0.02 * w);
    arm(p, body, "r", 0.05, g.shoulderOut * 0.5 + outR, 0.35 - 0.02 * w);
    fingers(p, body, "l", 0.35);
    fingers(p, body, "r", 0.35);
    p.turn("spine_03", X, 0.015 * w);
    p.turn("head", X, g.headTilt);
    legs(p, "l", kb * 0.5, 0.03 + kb, 0.01 + kb * 0.5);
    legs(p, "r", kb * 0.5, 0.03 + kb, 0.01 + kb * 0.5);
  } else if (pose === "marche" || pose === "course") {
    const run = pose === "course";
    // Cadence heurtée (R3) : la phase avance par à-coups (un demi-pas pressé, l'autre traîné).
    const ph0 = t * g.walkRate * (run ? 1.45 : 1) + phase;
    const ph = ph0 + (g.jerk ?? 0) * 0.55 * Math.sin(ph0);
    const a = g.stride * (run ? 1.5 : 1);
    const sn = Math.sin(ph);
    const cs = Math.cos(ph);
    // Boiterie (R3) : la jambe gauche fait un pas plus court, genou raide ; le bassin tombe quand elle porte.
    const limp = g.limp ?? 0;
    const aL = a * (1 - 0.6 * limp);
    // Jambe en appui tendue, jambe libre fléchie pendant le passage. Le pied en appui reste à plat (cheville = genou − hanche) :
    // un pied pointé soulèverait le corps ; le pied libre pointe un peu.
    const stepL = (0.1 + (run ? 1.3 : 0.9) * Math.max(0, cs) ** 1.4) * (1 - 0.5 * limp) + kb;
    const stepR = 0.1 + (run ? 1.3 : 0.9) * Math.max(0, -cs) ** 1.4 + kb;
    legs(p, "l", aL * sn + kb * 0.5, stepL, stepL - aL * sn + 0.25 * Math.max(0, cs));
    legs(p, "r", -a * sn + kb * 0.5, stepR, stepR + a * sn + 0.25 * Math.max(0, -cs));
    const swing = g.armSwing * (run ? 1.5 : 1);
    const drag = g.drag ?? 0;
    arm(p, body, "l", -swing * sn, g.shoulderOut + outL, run ? 1.9 : 0.45 + 0.25 * Math.max(0, -sn));
    // Bras droit traînant : il ne balance presque plus, pend écarté, coude tendu.
    arm(p, body, "r", swing * sn * (1 - 0.85 * drag), g.shoulderOut + outR + 0.15 * drag, (run ? 1.9 : 0.45 + 0.25 * Math.max(0, sn)) * (1 - 0.8 * drag) + 0.1 * drag);
    fingers(p, body, "l", run ? 0.9 : 0.4);
    fingers(p, body, "r", run ? 0.9 : 0.4 - 0.3 * drag);
    p.turn("pelvis", Y, 0.08 * sn).turn("spine_02", Y, -0.12 * sn).turn("pelvis", Z, 0.04 * sn + 0.12 * limp * Math.max(0, sn));
    // Roulis : le buste se balance d'un côté à l'autre ; avec la boiterie, il plonge vers la jambe faible.
    p.turn("spine_01", Z, (g.sway ?? 0) * sn - 0.1 * limp * Math.max(0, sn));
    if (run) p.turn("spine_01", X, 0.22).turn("neck_01", X, -0.15);
    p.turn("head", X, g.headTilt).turn("head", Z, -0.03 * sn);
  } else if (pose === "attaque") {
    // Titan qui attaque : fente vers l'avant, bras tendus bas pour saisir, mains ouvertes, bouche grande ouverte.
    const k = (Math.sin(t * 2.6 + phase) + 1) / 2;
    legs(p, "l", 0.65 + kb * 0.5, 0.75 + kb, 0.2);
    legs(p, "r", -0.25, 0.25 + kb, -0.1);
    p.turn("spine_01", X, 0.42 + 0.08 * k).turn("spine_02", X, 0.2);
    arm(p, body, "l", 1.15 + 0.25 * k, 0.3 + outL, 0.3);
    arm(p, body, "r", 1.3 + 0.2 * k, 0.25 + outR, 0.25);
    fingers(p, body, "l", 0.15 + 0.5 * k);
    fingers(p, body, "r", 0.1 + 0.6 * k);
    p.turn("neck_01", X, -0.55).turn("head", X, -0.2);
    p.turn("jaw", X, 0.45 + 0.15 * k - 0.42 * g.mouth);
  } else if (pose === "effondre") {
    // Titan abattu qui tombe : genoux qui cèdent, buste qui plonge, puis le corps bascule face contre terre (t : s depuis le coup).
    ground = false;
    const u = Math.max(0, Math.min(1, t / TITAN_FALL_S));
    const knees = Math.min(1, u * 1.8);
    legs(p, "l", 0.55 * knees, 1.25 * knees, 0.6 * knees);
    legs(p, "r", 0.45 * knees, 1.1 * knees, 0.55 * knees);
    p.turn("spine_01", X, 0.35 * knees);
    arm(p, body, "l", 0.4 * u, 0.4 * u, 0.3);
    arm(p, body, "r", 0.3 * u, 0.6 * u, 0.25);
    p.turn("neck_01", Y, 0.6 * u).turn("jaw", X, 0.3 * u);
    const tip = Math.max(0, Math.min(1, (u - 0.3) / 0.7));
    p.lay(qa(X, (Math.PI / 2) * tip * tip * (3 - 2 * tip)));
  } else if (pose === "chute") {
    // Soldat qui tombe (câble perdu, gaz vide) ou tenu par un Titan : membres battants, dos cambré, tête rejetée.
    ground = false;
    const f = Math.sin(t * 7 + phase);
    const f2 = Math.sin(t * 5.3 + phase * 1.7);
    legs(p, "l", 0.5 + 0.35 * f, 0.9 + 0.3 * f2, 0.2, 0.15);
    legs(p, "r", 0.15 - 0.3 * f, 0.5 - 0.25 * f2, 0.2, 0.2);
    p.turn("spine_01", X, -0.25).turn("spine_02", X, -0.1);
    arm(p, body, "l", 0.6 + 0.6 * f2, 1.25 + 0.2 * f, 0.6);
    arm(p, body, "r", 0.2 - 0.6 * f2, 1.4 - 0.2 * f, 0.5);
    fingers(p, body, "l", 0.3);
    fingers(p, body, "r", 0.3);
    p.turn("neck_01", X, 0.3).turn("head", X, 0.2);
  } else if (pose === "mort") {
    // Mort : couché sur le dos, bras en croix, jambes un peu écartées, tête tournée.
    ground = false;
    arm(p, body, "l", 0, 1.0, 0.4);
    arm(p, body, "r", 0, 1.3, 0.2);
    legs(p, "l", 0.08, 0.25, -0.9, 0.12);
    legs(p, "r", 0, 0.1, -0.9, 0.08);
    fingers(p, body, "l", 0.5);
    fingers(p, body, "r", 0.4);
    p.turn("neck_01", Y, 0.7);
    p.lay(qa(X, -Math.PI / 2));
  } else if (pose === "tir") {
    // Tireur debout, fusil épaulé : jambe gauche en avant, buste de trois quarts, main droite à la joue, gauche sous le canon.
    legs(p, "l", 0.25, 0.18, 0.05, 0.08);
    legs(p, "r", -0.18, 0.1, -0.08, 0.12);
    p.turn("spine_02", Y, -0.35).turn("spine_01", X, 0.06);
    arm(p, body, "r", 1.05, 0.55, 2.1);
    arm(p, body, "l", 1.35, -0.05, 0.55);
    fingers(p, body, "l", 0.9);
    fingers(p, body, "r", 1.0);
    p.turn("head", Y, 0.3).turn("head", X, 0.12).turn("head", Z, -0.12);
  } else if (pose === "sol") {
    // En garde : genoux souples, pied gauche devant, lames tirées vers l'avant.
    legs(p, "l", 0.3, 0.42, 0.12, 0.08);
    legs(p, "r", -0.2, 0.3, -0.05, 0.1);
    p.turn("spine_01", X, 0.1 + 0.01 * w).turn("spine_02", Y, 0.15);
    // Avant-bras vers l'avant, un peu sous l'horizontale : les lames prolongent les avant-bras.
    arm(p, body, "l", 0.55, 0.3, 1.5);
    arm(p, body, "r", 0.7, 0.25, 1.35);
    fingers(p, body, "l", 1.1);
    fingers(p, body, "r", 1.1);
    p.turn("head", Y, -0.12);
  } else if (pose === "frappe") {
    // Taille : buste vrillé, lames ramenées de l'épaule vers la hanche opposée (cycle).
    const k = (Math.sin(t * 3 + phase) + 1) / 2;
    legs(p, "l", 0.35, 0.5, 0.1, 0.1);
    legs(p, "r", -0.3, 0.35, -0.1, 0.12);
    p.turn("spine_02", Y, 0.6 - 1.1 * k).turn("spine_01", X, 0.18);
    arm(p, body, "l", 1.6 - 1.4 * k, 0.6 - 0.5 * k, 1.15);
    arm(p, body, "r", 1.4 - 1.1 * k, 0.9 - 0.8 * k, 1.25);
    fingers(p, body, "l", 1.1);
    fingers(p, body, "r", 1.1);
  } else if (pose === "vol") {
    // Balancé au bout du câble : corps penché vers l'avant, jambes jointes repliées, lames en arrière.
    ground = false;
    p.turn("pelvis", X, 0.35);
    legs(p, "l", 0.55 + 0.1 * w, 1.0, 0.25);
    legs(p, "r", 0.4 + 0.1 * w, 0.85, 0.25);
    arm(p, body, "l", -0.7, 0.4, 1.15);
    arm(p, body, "r", -0.7, 0.4, 1.15);
    fingers(p, body, "l", 1.1);
    fingers(p, body, "r", 1.1);
    p.turn("neck_01", X, -0.45).turn("head", X, -0.2);
  } else if (pose === "accroche") {
    // Pieds contre le mur (le groupe est tourné par la scène), genoux fléchis, prêt à s'élancer.
    ground = false;
    legs(p, "l", 0.9, 1.3, 0.2);
    legs(p, "r", 0.7, 1.0, 0.1);
    p.turn("spine_01", X, 0.45);
    arm(p, body, "l", 0.3, 0.6, 1.75);
    arm(p, body, "r", 1.3, 0.2, 1.05);
    fingers(p, body, "l", 1.1);
    fingers(p, body, "r", 1.1);
    p.turn("neck_01", X, -0.55);
  } else if (pose === "saisie") {
    // Penché vers la proie, bras droit tendu main ouverte, bras gauche replié poing serré.
    const br = 0.03 * Math.sin(t * 2);
    legs(p, "l", 0.5, 0.75, 0.15);
    legs(p, "r", 0.3, 0.5, 0.05);
    p.turn("spine_01", X, 0.35 + br).turn("spine_02", X, 0.12);
    arm(p, body, "r", 1.5 + br, 0.15, 0.3);
    arm(p, body, "l", 0.75, 0.35, 1.95);
    fingers(p, body, "r", 0.15);
    fingers(p, body, "l", 1.5);
    p.turn("neck_01", X, -0.45).turn("head", X, -0.15);
    p.turn("jaw", X, 0.35 * g.mouth + 0.06);
  } else if (pose === "abattu") {
    // Face contre terre : pose écrite debout puis basculée ; membres écartés dans le plan du dos (au sol), tête de côté.
    ground = false;
    // Bras dans le plan des épaules : la main, tombante au repos, touche le sol ; inclinés vers le sol, ils soulèveraient le
    // corps.
    arm(p, body, "l", 0, 1.1, 0.1);
    arm(p, body, "r", 0, 2.5, 0.1);
    // Pieds tendus dans le prolongement des jambes : couché sur le ventre, le corps ne repose pas sur la pointe des pieds.
    legs(p, "l", 0.05, 0.15, -1.2, 0.18);
    legs(p, "r", -0.02, 0.05, -1.2, 0.1);
    p.turn("neck_01", Y, 1.0);
    p.turn("jaw", X, 0.25);
    p.lay(qa(X, Math.PI / 2));
  } else {
    // Allongé (Titan de Rod Reiss) : à plat ventre, bras tendus vers l'avant pour ramper, tête relevée.
    ground = false;
    // Au-dessus de la tête (π), dans le plan des épaules ; le bras gauche, relevé, tend vers l'avant.
    arm(p, body, "l", Math.PI + 0.2, 0.3, 0.3);
    arm(p, body, "r", Math.PI, 0.2, 0.1);
    legs(p, "l", -0.08, 0.5, -1.1, 0.12);
    legs(p, "r", -0.02, 0, -1.2, 0.1);
    p.turn("neck_01", X, -0.55).turn("head", X, -0.35);
    p.turn("jaw", X, 0.5);
    p.lay(qa(X, Math.PI / 2));
  }
  p.commit();
  body.group.updateMatrixWorld(true);
  if (ground) groundFeet(body);
  else if (pose === "abattu" || pose === "allonge" || pose === "mort" || pose === "effondre") groundLowest(body);
}

/** Pose courante des os (rotations, position de la racine) : départ d'un fondu. */
export interface PoseSnapshot {
  q: Quaternion[];
  root: Vector3;
}

export function snapshotPose(body: HumanBody): PoseSnapshot {
  return { q: body.skeleton.bones.map((b) => b.quaternion.clone()), root: body.bones["Root"]?.position.clone() ?? new Vector3() };
}

/** Fondu : chaque os part de la pose saisie et rejoint la pose écrite (k de 0 à 1). */
export function blendPose(body: HumanBody, from: PoseSnapshot, k: number): void {
  body.skeleton.bones.forEach((b, i) => {
    const q0 = from.q[i];
    if (q0) b.quaternion.copy(q0.clone().slerp(b.quaternion, k));
  });
  const root = body.bones["Root"];
  if (root) root.position.lerpVectors(from.root, root.position.clone(), k);
  body.group.updateMatrixWorld(true);
}

/**
 * Fondu entre états (R3) : quand la pose change, la pose affichée est saisie, puis la nouvelle s'installe en `dur` secondes
 * d'horloge de bataille. Sans horloge (planches, mesures), la pose est posée d'un coup.
 */
export class PoseFader {
  private last: HumanPose | null = null;
  private from: PoseSnapshot | null = null;
  private start = 0;
  constructor(
    private readonly body: HumanBody,
    private readonly dur = 0.3,
  ) {}

  /** Avant d'écrire la pose. */
  begin(p: HumanPose, clock: number | undefined): void {
    if (clock === undefined) this.from = null;
    else if (this.last !== null && p !== this.last) {
      this.from = snapshotPose(this.body);
      this.start = clock;
    }
    this.last = p;
  }

  /** Après l'avoir écrite : mélange avec la pose saisie tant que le fondu dure. Renvoie la part de la nouvelle pose. */
  end(clock: number | undefined): number {
    if (!this.from || clock === undefined) return 1;
    const k = (clock - this.start) / this.dur;
    if (k >= 1 || k < 0) {
      this.from = null;
      return 1;
    }
    const s = k * k * (3 - 2 * k);
    blendPose(this.body, this.from, s);
    return s;
  }
}

/** Points de semelle : les sommets les plus bas de chaque pied au repos (talon, plante, orteils), échantillonnés une fois. */
const soleCache = new WeakMap<HumanBody, number[]>();
function soleSamples(body: HumanBody): number[] {
  let s = soleCache.get(body);
  if (s) return s;
  const m = body.meshes.get("peau_pieds");
  const out: number[] = [];
  if (m) {
    const p = m.geometry.getAttribute("position");
    const ids = Array.from({ length: p.count }, (_, i) => i);
    for (const side of [1, -1]) {
      const own = ids.filter((i) => Math.sign(p.getX(i)) === side).sort((a, b) => p.getY(a) - p.getY(b));
      // Les plus bas, répartis du talon aux orteils.
      const low = own.slice(0, 160).sort((a, b) => p.getZ(a) - p.getZ(b));
      for (let k = 0; k < 12 && low.length > 0; k++) out.push(low[Math.floor((k / 11) * (low.length - 1))] as number);
    }
  }
  s = out;
  soleCache.set(body, s);
  return s;
}

/** Pieds au sol : le point de semelle le plus bas (après la pose, peau comprise) est posé à y = 0. */
export function groundFeet(body: HumanBody): void {
  const root = body.bones["Root"];
  const m = body.meshes.get("peau_pieds");
  if (!root || !m) return;
  body.skeleton.update();
  const v = new Vector3();
  let low = Infinity;
  const toGroup = body.group.matrixWorld.clone().invert().multiply(m.matrixWorld);
  for (const i of soleSamples(body)) low = Math.min(low, m.getVertexPosition(i, v).applyMatrix4(toGroup).y);
  if (!Number.isFinite(low)) return;
  root.position.y -= low;
  body.group.updateMatrixWorld(true);
}

/** Échantillon de la peau (un sommet sur 12 par région), pour poser un corps couché. */
const skinCache = new WeakMap<HumanBody, [SkinnedMesh, number[]][]>();
function skinSamples(body: HumanBody): [SkinnedMesh, number[]][] {
  let s = skinCache.get(body);
  if (s) return s;
  s = [];
  for (const m of body.meshes.values()) {
    if (!m.name.startsWith("peau_")) continue;
    const n = m.geometry.getAttribute("position").count;
    s.push([m, Array.from({ length: Math.ceil(n / 12) }, (_, k) => k * 12)]);
  }
  skinCache.set(body, s);
  return s;
}

/** Corps couché : son point de peau le plus bas (échantillonné) au sol. */
function groundLowest(body: HumanBody): void {
  const root = body.bones["Root"];
  if (!root) return;
  body.skeleton.update();
  const inv = body.group.matrixWorld.clone().invert();
  const v = new Vector3();
  let low = Infinity;
  for (const [m, ids] of skinSamples(body)) {
    const toGroup = inv.clone().multiply(m.matrixWorld);
    for (const i of ids) low = Math.min(low, m.getVertexPosition(i, v).applyMatrix4(toGroup).y);
  }
  if (!Number.isFinite(low)) return;
  root.position.y -= low;
  body.group.updateMatrixWorld(true);
}
