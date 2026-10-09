import { BoxGeometry, Color, CylinderGeometry, Matrix4, Quaternion, SphereGeometry, Vector3 } from "three";
import type { BufferGeometry } from "three";
import { FaceBuilder } from "../townMesh";
import { outfit } from "./catalog";
import type { GearRole, OutfitId } from "./catalog";

/**
 * Foule de R3 : une figure rigide par tenue, par équipement et par pose (une géométrie à couleurs de sommet, instanciée : un appel
 * de dessin pour toutes les unités d'un même lot). La marche est montrée en deux temps (pas gauche, pas droit) alternés par
 * instance ; tir, vol, coupe et mort ont leur propre figure. Silhouettes et teintes des tenues de `data/art/figures.json`.
 */
export type CrowdPose = "attente" | "pasA" | "pasB" | "tir" | "vol" | "coupe" | "mort";
export const CROWD_POSES: readonly CrowdPose[] = ["attente", "pasA", "pasB", "tir", "vol", "coupe", "mort"];

interface Angles {
  hipL: number;
  kneeL: number;
  hipR: number;
  kneeR: number;
  shL: number;
  elL: number;
  outL: number;
  shR: number;
  elR: number;
  outR: number;
  lean: number;
}

const POSES: Record<CrowdPose, Angles> = {
  attente: { hipL: 0, kneeL: 0.05, hipR: 0, kneeR: 0.05, shL: 0.05, elL: 0.2, outL: 0.12, shR: 0.05, elR: 0.2, outR: 0.12, lean: 0 },
  pasA: { hipL: 0.42, kneeL: 0.25, hipR: -0.32, kneeR: 0.45, shL: -0.35, elL: 0.35, outL: 0.1, shR: 0.4, elR: 0.45, outR: 0.1, lean: 0.06 },
  pasB: { hipL: -0.32, kneeL: 0.45, hipR: 0.42, kneeR: 0.25, shL: 0.4, elL: 0.45, outL: 0.1, shR: -0.35, elR: 0.35, outR: 0.1, lean: 0.06 },
  tir: { hipL: 0.25, kneeL: 0.2, hipR: -0.2, kneeR: 0.12, shL: 1.35, elL: 0.35, outL: 0.05, shR: 0.95, elR: 1.9, outR: 0.55, lean: 0.05 },
  vol: { hipL: 0.9, kneeL: 1.2, hipR: 0.6, kneeR: 1.0, shL: -0.6, elL: 0.9, outL: 0.45, shR: -0.6, elR: 0.9, outR: 0.45, lean: 0.35 },
  coupe: { hipL: 0.45, kneeL: 0.55, hipR: -0.35, kneeR: 0.35, shL: 1.6, elL: 0.4, outL: 0.7, shR: 1.2, elR: 0.3, outR: 0.9, lean: 0.25 },
  mort: { hipL: 0.15, kneeL: 0.3, hipR: -0.05, kneeR: 0.05, shL: 0, elL: 0.2, outL: 1.2, shR: 0, elR: 0.4, outR: 0.7, lean: 0 },
};

const UP = new Vector3(0, 1, 0);
/** Cylindre de `a` à `b` (rayons en a et b). */
function seg(fb: FaceBuilder, a: Vector3, b: Vector3, r0: number, r1: number, c: Color, root: Matrix4, sides = 6): void {
  const d = b.clone().sub(a);
  const len = d.length();
  if (len < 1e-4) return;
  const q = new Quaternion().setFromUnitVectors(UP, d.normalize());
  const m = new Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new Vector3(1, 1, 1));
  fb.geometry(new CylinderGeometry(r1, r0, len, sides), root.clone().multiply(m), c);
}
function blob(fb: FaceBuilder, p: Vector3, s: [number, number, number], c: Color, root: Matrix4, g: BufferGeometry = new SphereGeometry(1, 8, 6)): void {
  fb.geometry(g, root.clone().multiply(new Matrix4().compose(p, new Quaternion(), new Vector3(...s))), c);
}

/** Géométrie d'une figure de foule (1,80 m, regard vers +z, pieds au sol ; couchée sur le dos pour « mort »). */
export function crowdFigure(id: OutfitId, gearRole: GearRole, pose: CrowdPose): BufferGeometry {
  const o = outfit(id);
  const A = POSES[pose];
  const fb = new FaceBuilder();
  const jacket = new Color(o.veste);
  const trousers = new Color(o.pantalon);
  const boots = new Color(0x2a221b);
  const skin = new Color(0xd6b096);
  const leather = new Color(0x5e4430);
  const steel = new Color(0xa9b0b3);
  const accent = new Color(o.cape ?? o.manteau ?? o.echarpe ?? o.veste);
  const hat = new Color(o.couvre_chef_teinte ?? 0x2a2a2a);
  const root = pose === "mort" ? new Matrix4().makeTranslation(0, 0.16, 0.85).multiply(new Matrix4().makeRotationX(-Math.PI / 2)) : new Matrix4();
  const hipY = 0.88;
  const pelvis = new Vector3(0, hipY + 0.04, 0);
  const chest = new Vector3(0, hipY + 0.04 + 0.52 * Math.cos(A.lean), 0.52 * Math.sin(A.lean));
  // Jambes : cuisse, jambe (botte), pied.
  const feet: Vector3[] = [];
  const legPts = (s: number, hip: number, knee: number): Vector3[] => {
    const h = new Vector3(s * 0.095, hipY, 0);
    const k = h.clone().add(new Vector3(0, -Math.cos(hip), Math.sin(hip)).multiplyScalar(0.43));
    const a = k.clone().add(new Vector3(0, -Math.cos(hip - knee), Math.sin(hip - knee)).multiplyScalar(0.42));
    return [h, k, a];
  };
  for (const [s, hip, knee] of [[1, A.hipL, A.kneeL], [-1, A.hipR, A.kneeR]] as const) {
    const [h, k, a] = legPts(s, hip, knee) as [Vector3, Vector3, Vector3];
    seg(fb, h, k, 0.085, 0.065, trousers, root);
    const bootTop = k.clone().lerp(a, id === "marley_infanterie" ? 0.1 : 0.45);
    seg(fb, k, bootTop, 0.062, 0.058, id === "marley_infanterie" ? new Color(0x5a5440) : trousers, root);
    seg(fb, bootTop, a, 0.058, 0.05, boots, root);
    blob(fb, a.clone().add(new Vector3(0, -0.03, 0.07)), [0.055, 0.045, 0.13], boots, root);
    feet.push(a);
  }
  // Bassin et torse (veste), ceinture.
  blob(fb, pelvis, [0.17, 0.11, 0.12], trousers, root);
  seg(fb, pelvis, chest, 0.165, 0.19, jacket, root, 8);
  blob(fb, chest.clone().add(new Vector3(0, -0.02, 0)), [0.2, 0.08, 0.12], jacket, root);
  blob(fb, pelvis.clone().add(new Vector3(0, 0.05, 0)), [0.175, 0.03, 0.125], leather, root);
  // Bras et mains.
  const hands: Vector3[] = [];
  for (const [s, sh, el, out] of [[1, A.shL, A.elL, A.outL], [-1, A.shR, A.elR, A.outR]] as const) {
    const S = chest.clone().add(new Vector3(s * 0.2, -0.04, 0));
    const d1 = new Vector3(s * Math.sin(out), -Math.cos(sh) * Math.cos(out), Math.sin(sh) * Math.cos(out));
    const E = S.clone().addScaledVector(d1, 0.3);
    const a2 = sh + el;
    const d2 = new Vector3(s * Math.sin(out) * 0.6, -Math.cos(a2) * Math.cos(out * 0.6), Math.sin(a2) * Math.cos(out * 0.6)).normalize();
    const W = E.clone().addScaledVector(d2, 0.27);
    seg(fb, S, E, 0.055, 0.048, jacket, root);
    seg(fb, E, W, 0.046, 0.04, jacket, root);
    blob(fb, W.clone().addScaledVector(d2, 0.05), [0.045, 0.05, 0.045], skin, root);
    hands.push(W.clone().addScaledVector(d2, 0.06));
  }
  // Cou, tête, cheveux ou couvre-chef.
  const up = new Vector3(0, Math.cos(A.lean), Math.sin(A.lean));
  const neck = chest.clone().addScaledVector(up, 0.06);
  const head = chest.clone().addScaledVector(up, 0.2);
  seg(fb, chest, neck, 0.05, 0.05, skin, root);
  blob(fb, head, [0.095, 0.115, 0.105], skin, root);
  if (o.couvre_chef === "aucun") blob(fb, head.clone().add(new Vector3(0, 0.035, -0.01)), [0.1, 0.09, 0.105], new Color(0x2e2419), root);
  else if (o.couvre_chef === "casque") {
    blob(fb, head.clone().add(new Vector3(0, 0.05, 0)), [0.125, 0.085, 0.135], hat, root);
    fb.geometry(new CylinderGeometry(0.16, 0.16, 0.012, 12), root.clone().multiply(new Matrix4().makeTranslation(head.x, head.y + 0.02, head.z)), hat);
  } else {
    const kepi = o.couvre_chef === "kepi";
    const h = kepi ? 0.12 : 0.07;
    fb.geometry(new CylinderGeometry(kepi ? 0.09 : 0.125, 0.1, h, 10), root.clone().multiply(new Matrix4().makeTranslation(head.x, head.y + 0.07 + h / 2, head.z)), hat);
    fb.geometry(new BoxGeometry(0.15, 0.012, 0.08), root.clone().multiply(new Matrix4().makeTranslation(head.x, head.y + 0.07, head.z + 0.1)), new Color(0x1a1612));
  }
  // Tenue : cape (dos), manteau long (taille → genoux), écharpe (cou).
  if (o.cape) {
    const top = chest.clone().add(new Vector3(0, -0.02, -0.12));
    const swing = pose === "vol" ? 0.9 : pose === "pasA" || pose === "pasB" ? 0.25 : pose === "coupe" ? 0.45 : 0.08;
    const bottom = top.clone().add(new Vector3(0, -Math.cos(swing + A.lean) * 0.75, -Math.sin(swing + A.lean) * 0.75));
    const q = new Quaternion().setFromUnitVectors(UP, top.clone().sub(bottom).normalize());
    fb.geometry(new BoxGeometry(0.46, 0.75, 0.025), root.clone().multiply(new Matrix4().compose(top.clone().add(bottom).multiplyScalar(0.5), q, new Vector3(1, 1, 1))), accent);
  }
  if (o.manteau) fb.geometry(new CylinderGeometry(0.19, 0.27, 0.6, 12, 1, true), root.clone().multiply(new Matrix4().makeTranslation(0, hipY - 0.22, 0.0)), accent);
  if (o.echarpe) blob(fb, neck.clone().add(new Vector3(0, -0.02, 0.02)), [0.11, 0.04, 0.1], accent, root);
  // Équipement.
  if (gearRole === "odm") {
    for (const s of [1, -1]) {
      fb.geometry(new CylinderGeometry(0.055, 0.055, 0.3, 8), root.clone().multiply(new Matrix4().compose(pelvis.clone().add(new Vector3(s * 0.09, 0.08, -0.17)), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2 - s * 0.3), new Vector3(1, 1, 1))), steel);
      blob(fb, new Vector3(s * 0.2, hipY + 0.02, 0.02), [0.05, 0.06, 0.1], steel, root);
      blob(fb, new Vector3(s * 0.15, hipY - 0.2, -0.02), [0.04, 0.2, 0.07], leather, root);
    }
    if (pose === "coupe" || pose === "vol" || pose === "attente") {
      for (const [k, h] of hands.entries()) {
        const s = k === 0 ? 1 : -1;
        const dir = pose === "attente" ? new Vector3(s * 0.15, 0.2, 1).normalize() : new Vector3(s * 0.3, pose === "vol" ? -0.6 : 0.5, pose === "vol" ? -0.6 : 0.9).normalize();
        seg(fb, h, h.clone().addScaledVector(dir, 0.8), 0.012, 0.008, steel, root, 4);
      }
    }
  } else if (gearRole === "fusil") {
    blob(fb, chest.clone().add(new Vector3(0, -0.18, -0.19)), [0.15, 0.17, 0.08], leather, root, new BoxGeometry(2, 2, 2));
    const [hl, hr] = hands as [Vector3, Vector3];
    const a = pose === "tir" ? hr.clone() : chest.clone().add(new Vector3(0.12, -0.45, -0.17));
    const dir = pose === "tir" ? hl.clone().sub(hr).normalize() : new Vector3(-0.35, 1, -0.05).normalize();
    seg(fb, a.clone().addScaledVector(dir, -0.25), a.clone().addScaledVector(dir, 0.95), 0.028, 0.014, new Color(0x3b2c1f), root, 5);
  } else {
    blob(fb, new Vector3(-0.2, hipY - 0.02, 0.04), [0.04, 0.07, 0.05], leather, root);
    seg(fb, chest.clone().add(new Vector3(0.17, 0.0, 0.1)), pelvis.clone().add(new Vector3(-0.15, 0.06, 0.12)), 0.02, 0.02, leather, root, 4);
  }
  const g = fb.build();
  // Au sol : le point le plus bas à y = 0 (pied d'appui, ou dos d'un homme tombé) ; en vol, le repère reste aux pieds.
  g.computeBoundingBox();
  if (pose !== "vol" && g.boundingBox) g.translate(0, -g.boundingBox.min.y, 0);
  void feet;
  return g;
}

/** Pose de foule pour un état montré (la marche alterne deux temps ; `t` en s, décalé par unité). */
export function crowdPoseOf(show: string, t: number): CrowdPose {
  switch (show) {
    case "marche":
    case "course":
      return Math.floor(t * (show === "course" ? 3.4 : 2.2)) % 2 === 0 ? "pasA" : "pasB";
    case "tir":
      return "tir";
    case "coupe":
      return "coupe";
    case "vol":
    case "accroche":
    case "chute":
    case "saisi":
      return "vol";
    case "mort":
      return "mort";
    default:
      return "attente";
  }
}
