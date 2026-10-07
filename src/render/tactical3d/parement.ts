import { CanvasTexture, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from "three";
import type { Color, Texture } from "three";
import { seeded } from "./rng";
import { canvasMean } from "./photoTextures";
import type { Rand } from "./rng";

/**
 * Parement des murailles sans motif répété (R1e, consigne §3.1 et §6, point 3).
 * - Trois appareils dessinés au canevas, de tailles de tuile incommensurables : pierre de taille en assises réglées (A,
 *   6,4 × 4,8 m), moellons en assises basses (B, 4,6 × 3,3 m), gros blocs usés (C, 9,2 × 6,6 m) ; joints, éclats, teinte par
 *   bloc.
 * - Mélange par masques de bruit de basse fréquence (calculés dans le shader depuis la position en mètres sur le mur).
 * - Panneaux de 5 à 10 m (bords ondulés) : chacun décale les trois appareils (horizontalement au hasard, verticalement d'un
 *   nombre entier d'assises) et porte une teinte propre ; coulures depuis le couronnement, pied humide et moussu, éclats clairs.
 * - Le shader reçoit la position en mètres : `uv × uvToMeters` (mur des environnements) ou l'abscisse et l'attribut `wz`
 *   (altitude, murailles des lieux).
 */
export const PAREMENT_SIZES = { A: [6.4, 4.8], B: [4.6, 3.3], C: [9.2, 6.6] } as const;
const PX_PER_M = 80;

function canvas(wm: number, hm: number): [HTMLCanvasElement, CanvasRenderingContext2D, number, number] {
  const w = Math.round(wm * PX_PER_M);
  const h = Math.round(hm * PX_PER_M);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas 2D indisponible");
  return [c, g, w, h];
}

const rgb = (v: number, k: [number, number, number] = [1, 0.985, 0.95], a = 1): string => `rgba(${Math.round(v * k[0])},${Math.round(v * k[1])},${Math.round(v * k[2])},${a})`;

/** Assises de blocs : hauteur d'assise (m), longueurs (m), teinte et usure par bloc, joints creux. */
function courses(g: CanvasRenderingContext2D, r: Rand, w: number, h: number, courseM: [number, number], lenM: [number, number], joint: number, rough: number): void {
  g.fillStyle = rgb(150);
  g.fillRect(0, 0, w, h);
  let y = 0;
  while (y < h) {
    const ch = (courseM[0] + r() * (courseM[1] - courseM[0])) * PX_PER_M;
    let x = -r() * lenM[1] * PX_PER_M;
    while (x < w) {
      const bw = (lenM[0] + r() * (lenM[1] - lenM[0])) * PX_PER_M;
      const v = 188 + r() * 46;
      const warm: [number, number, number] = [1, 0.97 + r() * 0.03, 0.9 + r() * 0.07];
      g.fillStyle = rgb(v, warm);
      const j = joint * PX_PER_M;
      if (rough > 0) {
        g.beginPath();
        const pts = 7;
        for (let k = 0; k < pts; k++) {
          const t = (k / pts) * Math.PI * 2;
          const px = x + bw / 2 + Math.cos(t) * (bw / 2 - j) * (1 - rough * r() * 0.25);
          const py = y + ch / 2 + Math.sin(t) * (ch / 2 - j) * (1 - rough * r() * 0.25);
          if (k === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.fill();
      } else g.fillRect(x + j, y + j, bw - 2 * j, ch - 2 * j);
      // Usure du bloc : arête claire en haut, ombre en bas, taches.
      g.fillStyle = rgb(255, [1, 1, 1], 0.08);
      g.fillRect(x + j, y + j, bw - 2 * j, Math.max(1, ch * 0.08));
      g.fillStyle = rgb(0, [1, 1, 1], 0.12);
      g.fillRect(x + j, y + ch - j - Math.max(1, ch * 0.1), bw - 2 * j, Math.max(1, ch * 0.1));
      for (let k = 0; k < 6; k++) {
        g.fillStyle = rgb(r() < 0.5 ? 0 : 255, [1, 1, 1], 0.05 + r() * 0.07);
        g.beginPath();
        g.ellipse(x + r() * bw, y + r() * ch, 2 + r() * bw * 0.15, 2 + r() * ch * 0.15, r() * 3, 0, Math.PI * 2);
        g.fill();
      }
      x += bw;
    }
    y += ch;
  }
  // Grain de la pierre.
  for (let i = 0; i < (w * h) / 40; i++) {
    const v = r() < 0.5 ? 0 : 255;
    g.fillStyle = rgb(v, [1, 1, 1], 0.06 * r());
    g.fillRect(r() * w, r() * h, 1.5, 1.5);
  }
}

function tex(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export interface ParementTextures {
  A: Texture;
  B: Texture;
  C: Texture;
  /** Couleur moyenne linéaire de chaque appareil : les trois sont ramenés à celle de A (pas de taches claires ou sombres). */
  means?: { A: [number, number, number]; B: [number, number, number]; C: [number, number, number] };
}

export function parementTextures(seed: number): ParementTextures {
  const r = seeded(seed * 7 + 3);
  const [ca, ga, wa, ha] = canvas(...PAREMENT_SIZES.A);
  courses(ga, r, wa, ha, [1.2, 1.2], [1.6, 3.0], 0.035, 0);
  const [cb, gb, wb, hb] = canvas(...PAREMENT_SIZES.B);
  courses(gb, r, wb, hb, [0.5, 0.6], [0.5, 1.2], 0.05, 0.8);
  const [cc, gc, wc, hc] = canvas(...PAREMENT_SIZES.C);
  courses(gc, r, wc, hc, [2.2, 2.2], [2.4, 4.6], 0.06, 0.35);
  return { A: tex(ca), B: tex(cb), C: tex(cc), means: { A: canvasMean(ca), B: canvasMean(cb), C: canvasMean(cc) } };
}

export interface ParementOpts {
  /** Mètres par unité de coordonnée de texture (u, v) ; ignoré pour v si `heightAttr`. */
  uvToMeters: [number, number];
  /** Altitude lue dans l'attribut `wz` (murailles des lieux) ; les faces de dessus (`wn` = 1) gardent leurs coordonnées. */
  heightAttr: boolean;
  /** Hauteur du mur (m) : les coulures partent du couronnement. */
  height: number;
  tint: Color;
}

/**
 * Uniformes d'un parement, gardés dans `userData.parement` : après la première image, les photos de Poly Haven (pierre de
 * taille, pierre brute) remplacent les appareils A et C à leur taille réelle, avec un gain qui garde la teinte moyenne
 * procédurale (`photoTextures.applyPhotoTextures`).
 */
export interface ParementUniforms {
  parB: { value: Texture };
  parC: { value: Texture };
  parUv: { value: [number, number] };
  parH: { value: number };
  parSizeA: { value: [number, number] };
  parSizeC: { value: [number, number] };
  parGainA: { value: [number, number, number] };
  parGainB: { value: [number, number, number] };
  parGainC: { value: [number, number, number] };
  /** Moyenne visée (celle de l'appareil A procédural). */
  parTarget: [number, number, number];
}

export function parementMaterial(t: ParementTextures, o: ParementOpts): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ map: t.A, color: o.tint, roughness: 0.93, vertexColors: !o.heightAttr });
  const u: ParementUniforms = {
    parB: { value: t.B },
    parC: { value: t.C },
    parUv: { value: o.uvToMeters },
    parH: { value: o.height },
    parSizeA: { value: [PAREMENT_SIZES.A[0], PAREMENT_SIZES.A[1]] },
    parSizeC: { value: [PAREMENT_SIZES.C[0], PAREMENT_SIZES.C[1]] },
    parGainA: { value: [1, 1, 1] },
    parGainB: { value: [1, 1, 1] },
    parGainC: { value: [1, 1, 1] },
    parTarget: t.means?.A ?? [0.5, 0.5, 0.5],
  };
  if (t.means) {
    const g = (m: [number, number, number]): [number, number, number] => [0, 1, 2].map((i) => Math.min(4, Math.max(0.25, u.parTarget[i] as number) / Math.max(0.02, m[i] as number))) as [number, number, number];
    u.parGainB.value = g(t.means.B);
    u.parGainC.value = g(t.means.C);
  }
  (m.userData as { parement?: ParementUniforms }).parement = u;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace("#include <common>", `#include <common>\nuniform vec2 parUv;\nvarying vec2 vWallM;\n${o.heightAttr ? "attribute float wz;\nattribute float wn;" : ""}`)
      .replace("#include <uv_vertex>", `#include <uv_vertex>\n  vWallM = uv * parUv;\n${o.heightAttr ? "  if (wn < 0.5 || wn > 1.5) vWallM.y = wz;" : ""}`);
    s.fragmentShader = s.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D parB;
uniform sampler2D parC;
uniform float parH;
uniform vec2 parSizeA;
uniform vec2 parSizeC;
uniform vec3 parGainA;
uniform vec3 parGainB;
uniform vec3 parGainC;
varying vec2 vWallM;
float parHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float parNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(parHash(i), parHash(i + vec2(1.0, 0.0)), f.x), mix(parHash(i + vec2(0.0, 1.0)), parHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`,
      )
      .replace(
        "#include <map_fragment>",
        `vec2 pm = vWallM;
  // Panneaux de 5 à 10 m, bords ondulés.
  float cu = pm.x / 7.3 + 0.38 * parNoise(vec2(pm.y / 11.0, 3.7));
  vec2 cell = vec2(floor(cu), floor(pm.y / 6.1 + 0.3 * parNoise(vec2(pm.x / 9.0, 1.3))));
  float h1 = parHash(cell);
  float h2 = parHash(cell + 17.31);
  float h3 = parHash(cell + 41.7);
  vec2 oA = vec2(h1 * 31.0, floor(h2 * 4.0) * 1.2);
  vec2 oB = vec2(h2 * 23.0, floor(h3 * 6.0) * 0.55);
  vec2 oC = vec2(h3 * 47.0, floor(h1 * 3.0) * 2.2);
  vec3 sa = texture2D(map, (pm + oA) / parSizeA).rgb * parGainA;
  vec3 sb = texture2D(parB, (pm + oB) / vec2(${PAREMENT_SIZES.B[0].toFixed(2)}, ${PAREMENT_SIZES.B[1].toFixed(2)})).rgb * parGainB;
  vec3 sc = texture2D(parC, (pm + oC) / parSizeC).rgb * parGainC;
  float n1 = parNoise(pm / 15.0 + 2.3);
  float n2 = parNoise(pm / 9.5 + 8.1);
  float wa = smoothstep(0.35, 0.65, n1);
  float wb = (1.0 - wa) * smoothstep(0.3, 0.7, n2);
  vec3 stone = sa * wa + sb * wb + sc * (1.0 - wa - wb);
  // Teinte du panneau (pierre d'une autre carrière, réparations) : écart léger, pour ne pas dessiner de grandes plaques.
  stone *= mix(vec3(0.97, 0.965, 0.95), vec3(1.02, 1.015, 1.0), h1) * mix(0.985, 1.01, h3);
  // Coulures depuis le couronnement (R1e, CR1e-05) : bandes verticales étroites (0,55 m), chacune tirée seule (présence,
  // intensité, longueur de 12 à 48 m sous le couronnement), bords adoucis et légèrement sinueux. Aucune période : deux
  // bandes voisines sont indépendantes.
  float sxw = pm.x + 0.22 * (parNoise(vec2(pm.y / 6.0, pm.x / 23.0)) - 0.5);
  float lane = floor(sxw / 0.55);
  float lh = parHash(vec2(lane, 7.7));
  float lk = smoothstep(0.38, 0.98, lh) * (0.55 + 0.45 * parHash(vec2(lane, 3.1)));
  float lf = fract(sxw / 0.55);
  float edgeK = smoothstep(0.0, 0.3, lf) * smoothstep(1.0, 0.7, lf);
  float runL = 12.0 + 36.0 * parHash(vec2(lane, 11.3));
  float runK = smoothstep(parH - runL - 4.0, parH - runL, pm.y) * (0.75 + 0.25 * parNoise(vec2(lane, pm.y * 0.3)));
  stone *= 1.0 - 0.34 * lk * edgeK * runK;
  // Pied humide et moussu.
  float foot = 1.0 - smoothstep(0.4, 3.0 + 3.0 * parNoise(vec2(pm.x / 6.0, 2.0)), pm.y);
  stone = mix(stone, stone * vec3(0.6, 0.7, 0.48), foot * 0.8);
  // Éclats clairs (pierre fraîche).
  float spall = smoothstep(0.84, 0.92, parNoise(pm / 2.1 + 5.5));
  stone = mix(stone, stone * 1.2, spall * 0.55);
  diffuseColor.rgb *= stone;`,
      );
  };
  m.customProgramCacheKey = () => `parement-${o.heightAttr ? "wz" : "uv"}`;
  return m;
}
