import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Matrix4, Quaternion, Vector3 } from "three";
import type { BufferGeometry, MeshStandardMaterial } from "three";
import { FaceBuilder } from "../townMesh";
import { LimbMarks } from "../crowdWalk";
import { unitSphere } from "../rig";
import { outfit } from "../figuresR3";

/**
 * Cavaliers de la bataille 3D (fichier 18, R3.6 : « Cavalier : cheval animé (marche, galop) » ; 03 §2 : chevaux en plaine).
 * Les sections de fantassins de type « cavalier » de la simulation montent un cheval : foule instanciée d'un cheval (pattes
 * animées dans le shader, pivot propre à chaque patte, allures marche et galop) et d'un cavalier assis. Proportions, robes et
 * allures : choix de rendu (A). Le cheval regarde vers +z.
 */

/** Garrot à 1,6 m ; pivots des pattes (épaule et hanche) ; selle. */
export const HORSE = { withers: 1.6, legPivotY: 1.12, frontZ: 0.72, rearZ: -0.74, saddleY: 1.62 } as const;

/** Robes (A) : bai, alezan, noir, gris, isabelle. */
export const COATS = [0x6b4226, 0x8a4b2a, 0x2c2622, 0x9a948a, 0xa08560] as const;

const at = (x: number, y: number, z: number, s: [number, number, number] = [1, 1, 1], rx = 0, rz = 0): Matrix4 =>
  new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rx).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rz)), new Vector3(...s));

/** Cheval : robe en blanc (teinte d'instance = robe), crins et sabots sombres ; pattes marquées (avant : ±2, arrière : ±1). */
export function horseGeometry(): BufferGeometry {
  const fb = new FaceBuilder();
  const S = unitSphere(10);
  const coat = new Color(1, 1, 1);
  const muzzle = new Color(0.55, 0.52, 0.5);
  const dark = new Color(0.13, 0.12, 0.11);
  // Tronc : ventre, poitrail, croupe ; encolure, tête, oreilles ; crinière, queue.
  fb.geometry(S, at(0, 1.24, 0.02, [0.31, 0.36, 0.92]), coat);
  fb.geometry(S, at(0, 1.3, 0.72, [0.29, 0.36, 0.38]), coat);
  fb.geometry(S, at(0, 1.32, -0.7, [0.33, 0.37, 0.42]), coat);
  fb.geometry(new CylinderGeometry(0.15, 0.25, 0.85, 8), at(0, 1.78, 1.12, [1, 1, 0.8], 0.62), coat);
  // Tête inclinée à 45° sous l'horizontale, attachée au bout de l'encolure (nuque), bout du nez en bas et en avant.
  fb.geometry(new CylinderGeometry(0.075, 0.13, 0.58, 8), at(0, 1.92, 1.57, [1, 1, 1.15], 2.35), coat);
  fb.geometry(S, at(0, 1.74, 1.76, [0.085, 0.08, 0.1]), muzzle);
  for (const s of [1, -1]) fb.geometry(new ConeGeometry(0.035, 0.13, 5), at(s * 0.06, 2.22, 1.33, [1, 1, 1], -0.25), coat);
  // Crinière le long du bord supérieur de l'encolure ; queue attachée sous la croupe, crins vers le bas et l'arrière.
  fb.geometry(new BoxGeometry(0.05, 0.12, 0.82), at(0, 1.92, 0.98, [1, 1, 1], -0.95), dark);
  // Le haut de la queue reste sous le contour de la croupe (pas de pointe au-dessus du dos).
  fb.geometry(new ConeGeometry(0.12, 0.8, 7), at(0, 0.98, -1.13, [1, 1, 0.75], 0.12), dark);
  const marks = new LimbMarks();
  for (const s of [1, -1] as const) {
    for (const [z, code, thick] of [
      [HORSE.frontZ, s === 1 ? 2 : -2, 0.075],
      [HORSE.rearZ, s, 0.095],
    ] as const) {
      marks.mark(fb, code, () => {
        const x = s * 0.17;
        // Avant-bras ou jambe (gros muscle), canon fin, boulet, sabot.
        fb.geometry(new CylinderGeometry(thick, thick * 0.75, 0.5, 6), at(x, HORSE.legPivotY - 0.27, z), coat);
        fb.geometry(new CylinderGeometry(0.042, 0.04, 0.5, 6), at(x, 0.4, z + 0.01), coat);
        fb.geometry(new CylinderGeometry(0.05, 0.05, 0.08, 6), at(x, 0.14, z + 0.015), coat);
        fb.geometry(new CylinderGeometry(0.055, 0.065, 0.1, 6), at(x, 0.05, z + 0.02), dark);
      });
    }
  }
  return marks.apply(fb.build());
}

/**
 * Cavalier assis (foule), en selle : cuisses vers l'avant, jambes le long des flancs, bottes aux étriers ; selle et tapis.
 * `paradis` : uniforme commun (veste brun clair, pantalon clair, couleur d'instance blanche) ; sinon : tenue claire teintée
 * par la couleur du camp, casque sombre (même règle que les fantassins).
 */
export function riderGeometry(style: "paradis" | "marley"): BufferGeometry {
  const fb = new FaceBuilder();
  const S = unitSphere(8);
  const o = outfit("garnison");
  const jacket = new Color(style === "paradis" ? o.veste : 0xeeeeee);
  const trousers = new Color(style === "paradis" ? o.pantalon : 0xeeeeee);
  const boots = new Color(style === "paradis" ? o.bottes : 0x3a352e);
  const leather = new Color(0x4b3322);
  const dark = new Color(0x3a352e);
  const skin = new Color(0xd9b49a);
  const y0 = HORSE.saddleY;
  fb.geometry(new BoxGeometry(0.4, 0.06, 0.56), at(0, y0 - 0.03, -0.05), leather);
  fb.geometry(new BoxGeometry(0.72, 0.03, 0.78), at(0, y0 - 0.07, -0.05), new Color(0x5a4a3a));
  // Cuisses à 35° sous l'horizontale (hanche en arrière et en haut, genou en avant), jambes le long des flancs, pied à
  // l'étrier un peu en arrière du genou.
  for (const s of [1, -1]) {
    fb.geometry(new CylinderGeometry(0.075, 0.065, 0.42, 6), at(s * 0.22, y0 - 0.02, 0.15, [1, 1, 1], 2.18), trousers);
    fb.geometry(new CylinderGeometry(0.06, 0.05, 0.48, 6), at(s * 0.31, y0 - 0.37, 0.27, [1, 1, 1], 0.2, -s * 0.12), boots);
  }
  const T = 0.54;
  fb.geometry(new CylinderGeometry(0.16, 0.14, T, 8), at(0, y0 + 0.08 + T / 2, 0, [1, 1, 0.72], -0.08), jacket);
  for (const s of [1, -1]) fb.geometry(new CylinderGeometry(0.05, 0.04, 0.5, 6), at(s * 0.2, y0 + 0.36, 0.18, [1, 1, 1], -1.0), jacket);
  fb.geometry(S, at(0, y0 + 0.08 + T + 0.21, 0.04, [0.095, 0.117, 0.11]), skin);
  if (style === "paradis") fb.geometry(S, at(0, y0 + 0.08 + T + 0.25, 0.02, [0.1, 0.09, 0.115]), new Color(0x3b2c20));
  else fb.geometry(S, at(0, y0 + 0.08 + T + 0.27, 0.03, [0.13, 0.075, 0.14]), dark);
  // Fusil à l'épaule, en travers du dos.
  fb.geometry(new BoxGeometry(0.035, 1.0, 0.035), at(-0.05, y0 + 0.4, -0.16, [1, 1, 1], 0.1, 0.9), dark);
  return fb.build();
}

/** Allure montrée selon l'état d'une figure (directeur) : amplitude (rad) et cadence (rad/s) ; arrêt sinon. */
export function gaitParams(state: string): { amp: number; rate: number } {
  if (state === "course") return { amp: 0.62, rate: 9.5 };
  if (state === "marche") return { amp: 0.32, rate: 5.2 };
  return { amp: 0, rate: 0 };
}

/**
 * Allures du cheval dans le shader : chaque patte pivote autour de son épaule ou de sa hanche (y, z propres) ; décalages de
 * phase d'un galop rassemblé (bipède postérieur, puis antérieur) ; le tronc monte et descend deux fois par foulée au galop.
 * Attributs : `aLimb` (±1 arrière, ±2 avant), `aWalk` (phase, amplitude, cadence) comme la foule de soldats.
 */
export function patchHorse(mat: MeshStandardMaterial, time: { value: number }): void {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms["uWalkTime"] = time;
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float aLimb;
attribute vec3 aWalk;
uniform float uWalkTime;
vec3 horseLimb(vec3 p) {
  if (aWalk.y <= 0.0) return p;
  float ph = uWalkTime * aWalk.z + aWalk.x;
  float bob = 0.06 * aWalk.y * sin(2.0 * ph);
  float limb = abs(aLimb);
  if (limb < 0.5) return vec3(p.x, p.y + bob, p.z);
  float side = sign(aLimb);
  float off = (limb < 1.5 ? 0.0 : 1.7) + (side > 0.0 ? 0.0 : 0.55);
  float a = sin(ph + off) * aWalk.y;
  float pz = limb < 1.5 ? ${HORSE.rearZ.toFixed(4)} : ${HORSE.frontZ.toFixed(4)};
  vec2 q = vec2(p.y - ${HORSE.legPivotY.toFixed(4)}, p.z - pz);
  float c = cos(a);
  float s = sin(a);
  return vec3(p.x, ${HORSE.legPivotY.toFixed(4)} + q.x * c - q.y * s + bob, pz + q.x * s + q.y * c);
}`,
      )
      .replace("#include <begin_vertex>", "vec3 transformed = horseLimb(vec3(position));");
  };
  mat.customProgramCacheKey = () => "cheval";
}
