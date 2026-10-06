import { GraphicsContext } from "pixi.js";
import { BRICK, INK, OCHRE, PAPER, STONE, VERDIGRIS } from "../palette";
import { BODY_BOLT, TRANSFORM_HALO_M } from "./framing";

/**
 * Figures de la scène tactique, dessinées par code (04 §4, §8 : vectoriel d'abord, aucun asset de l'œuvre).
 * Coordonnées déjà projetées (mètres) ; pour un soldat, `k` = unité de la figure (≈ 1/2,85 de sa hauteur).
 */

/** 10 silhouettes de Titans : proportions variées et dérangeantes (tête, épaules, ventre, bras, voussure). */
const SILHOUETTES = [
  { head: 0.16, shoulders: 0.3, belly: 0.22, arm: 0.42, hunch: 0.0, legs: 0.42 },
  { head: 0.2, shoulders: 0.26, belly: 0.28, arm: 0.36, hunch: 0.08, legs: 0.38 },
  { head: 0.13, shoulders: 0.34, belly: 0.2, arm: 0.48, hunch: 0.04, legs: 0.46 },
  { head: 0.22, shoulders: 0.24, belly: 0.3, arm: 0.32, hunch: 0.12, legs: 0.34 },
  { head: 0.15, shoulders: 0.36, belly: 0.24, arm: 0.5, hunch: 0.02, legs: 0.44 },
  { head: 0.12, shoulders: 0.4, belly: 0.26, arm: 0.46, hunch: 0.06, legs: 0.48 },
  { head: 0.18, shoulders: 0.32, belly: 0.34, arm: 0.4, hunch: 0.1, legs: 0.4 },
  { head: 0.14, shoulders: 0.28, belly: 0.18, arm: 0.54, hunch: -0.04, legs: 0.5 },
  { head: 0.24, shoulders: 0.22, belly: 0.2, arm: 0.6, hunch: 0.16, legs: 0.36 },
  { head: 0.11, shoulders: 0.38, belly: 0.3, arm: 0.44, hunch: 0.0, legs: 0.52 },
] as const;

const FLESH = 0xc89a7c;
const FLESH_DARK = 0x9c6f56;

export function drawTitan(g: GraphicsContext, sx: number, sy: number, heightPx: number, silhouette: number, facing: number, alive: boolean, crawl: boolean, cut: { armL: boolean; armR: boolean; legs: boolean }): void {
  const p = SILHOUETTES[silhouette % SILHOUETTES.length] ?? SILHOUETTES[0];
  const h = crawl ? heightPx * 0.45 : heightPx;
  const color = alive ? FLESH : STONE;
  const dir = facing >= 0 ? 1 : -1;
  const lw = Math.max(0.3, heightPx / 30);
  // Ombre au sol.
  g.ellipse(sx, sy, h * 0.28, h * 0.06).fill({ color: INK, alpha: 0.18 });
  if (!alive) {
    // Corps abattu, couché, qui se dissout en vapeur (04 §4).
    g.ellipse(sx, sy - h * 0.05, h * 0.42, h * 0.08).fill({ color, alpha: 0.7 }).stroke({ width: lw, color: INK, alpha: 0.5 });
    for (let k = 0; k < 4; k++) g.circle(sx - h * 0.3 + k * h * 0.2, sy - h * (0.15 + 0.05 * k), h * 0.07).fill({ color: PAPER, alpha: 0.35 });
    return;
  }
  const legH = h * p.legs;
  // Jambes coupées : moignons, le corps s'affaisse au sol.
  const legLen = cut.legs ? legH * 0.35 : legH;
  const torsoH = h * (1 - p.legs - p.head);
  const hipY = sy - legLen;
  const shoulderY = hipY - torsoH;
  const hunch = p.hunch * h * dir;
  // Jambes.
  g.moveTo(sx - h * 0.07, hipY).lineTo(sx - h * 0.09, hipY + legLen).moveTo(sx + h * 0.07, hipY).lineTo(sx + h * 0.09, hipY + legLen).stroke({ width: h * 0.08, color: FLESH_DARK, cap: "round" });
  // Torse et ventre.
  g.poly([sx - h * p.shoulders * 0.5 + hunch, shoulderY, sx + h * p.shoulders * 0.5 + hunch, shoulderY, sx + h * p.belly * 0.5, hipY, sx - h * p.belly * 0.5, hipY]).fill({ color }).stroke({ width: lw, color: INK, alpha: 0.85 });
  g.ellipse(sx, hipY - torsoH * 0.25, h * p.belly * 0.45, torsoH * 0.28).fill({ color, alpha: 0.9 });
  // Bras pendants, trop longs.
  for (const [side, isCut] of [[-1, cut.armL], [1, cut.armR]] as const) {
    const ax = sx + side * h * p.shoulders * 0.5 + hunch;
    const len = isCut ? h * p.arm * 0.3 : h * p.arm;
    g.moveTo(ax, shoulderY + h * 0.02).lineTo(ax + side * h * 0.06, shoulderY + len).stroke({ width: h * 0.055, color: FLESH_DARK, cap: "round" });
  }
  // Tête : sourire figé, yeux vides.
  const hx = sx + hunch * 1.4;
  const hy = shoulderY - h * p.head * 0.55;
  g.ellipse(hx, hy, h * p.head * 0.42, h * p.head * 0.55).fill({ color }).stroke({ width: lw, color: INK, alpha: 0.9 });
  g.moveTo(hx - h * p.head * 0.25, hy + h * p.head * 0.18).lineTo(hx + h * p.head * 0.25, hy + h * p.head * 0.18).stroke({ width: lw, color: INK });
  g.circle(hx - h * p.head * 0.13, hy - h * p.head * 0.08, Math.max(1, h * 0.012)).circle(hx + h * p.head * 0.13, hy - h * p.head * 0.08, Math.max(1, h * 0.012)).fill({ color: INK });
  // Nuque : repère de coupe (brique).
  g.rect(hx - dir * h * p.head * 0.35 - h * 0.025, shoulderY - h * 0.03, h * 0.05, h * 0.03).fill({ color: BRICK, alpha: 0.85 });
}

/** 8 types de soldats : éclaireur, tueur, soutien, cavalier, médecin, chef, officier nommé, Ackerman. */
export type SoldierLook = "eclaireur" | "tueur" | "soutien" | "cavalier" | "medecin" | "chef" | "officier" | "ackerman";

export function drawSoldier(g: GraphicsContext, sx: number, sy: number, k: number, look: SoldierLook, onGround: boolean, selected: boolean, wounded: boolean): void {
  const s = k;
  if (selected) g.circle(sx, sy - s, s * 1.9).stroke({ width: s * 0.3, color: OCHRE });
  if (onGround && look === "cavalier") {
    g.ellipse(sx, sy - s * 0.5, s * 1.2, s * 0.45).fill({ color: 0x6b4a2f }).stroke({ width: s * 0.2, color: INK });
  }
  // Cape (vert-de-gris) et corps.
  g.poly([sx, sy - s * 2.2, sx + s * 0.8, sy - s * 0.2, sx - s * 0.8, sy - s * 0.2]).fill({ color: VERDIGRIS }).stroke({ width: s * 0.2, color: INK });
  g.circle(sx, sy - s * 2.4, s * 0.45).fill({ color: PAPER }).stroke({ width: s * 0.2, color: INK });
  switch (look) {
    case "tueur":
      g.moveTo(sx - s, sy - s * 1.2).lineTo(sx - s * 1.8, sy - s * 0.4).moveTo(sx + s, sy - s * 1.2).lineTo(sx + s * 1.8, sy - s * 0.4).stroke({ width: s * 0.25, color: STONE });
      break;
    case "eclaireur":
      g.moveTo(sx, sy - s * 2.8).lineTo(sx, sy - s * 4).stroke({ width: s * 0.2, color: INK }).poly([sx, sy - s * 4, sx + s, sy - s * 3.7, sx, sy - s * 3.4]).fill({ color: OCHRE });
      break;
    case "soutien":
      g.rect(sx + s * 0.6, sy - s * 1.6, s * 0.8, s * 0.9).fill({ color: OCHRE }).stroke({ width: s * 0.15, color: INK });
      break;
    case "medecin":
      g.rect(sx - s * 0.5, sy - s * 1.6, s, s * 0.35).fill({ color: PAPER }).stroke({ width: s * 0.15, color: BRICK });
      break;
    case "chef":
      g.moveTo(sx, sy - s * 2.85).lineTo(sx + s * 0.6, sy - s * 3.6).stroke({ width: s * 0.3, color: BRICK });
      break;
    case "officier":
      g.circle(sx, sy - s * 2.4, s * 0.7).stroke({ width: s * 0.25, color: OCHRE });
      break;
    case "ackerman":
      g.circle(sx, sy - s * 2.4, s * 0.7).stroke({ width: s * 0.35, color: INK }).circle(sx, sy - s * 2.4, s * 0.95).stroke({ width: s * 0.15, color: OCHRE });
      break;
    default:
      break;
  }
  if (wounded) g.circle(sx - s * 0.5, sy - s * 1.2, s * 0.25).fill({ color: BRICK });
}

/** Fusée de signal (03 §7) : traînée et bouffée colorée. */
export function drawFlare(g: GraphicsContext, sx: number, sy: number, k: number, color: "rouge" | "noir" | "vert", age: number): void {
  const c = color === "rouge" ? BRICK : color === "vert" ? VERDIGRIS : INK;
  const rise = Math.min(1, age / 2) * 60 * k;
  const a = Math.max(0, 1 - age / 8);
  g.moveTo(sx, sy).lineTo(sx, sy - rise).stroke({ width: 1.5, color: c, alpha: a * 0.6 });
  g.circle(sx, sy - rise, 6 + age * 3).fill({ color: c, alpha: a * 0.55 });
}

/** Halo de transformation (P6) au pied d'un porteur, en mètres du monde ; `pulse` dans [0, 6). */
function drawTransformHalo(g: GraphicsContext, x: number, y: number, pulse: number): void {
  g.circle(x, y - 6, Math.min(TRANSFORM_HALO_M, 9 + pulse)).fill({ color: 0xfff1b8, alpha: 0.55 });
}
/** Zigzag de transformation : il tombe du ciel (1,4 × la hauteur dessinée du Titan à venir, `h`) jusqu'aux pieds. */
function drawTransformBolt(g: GraphicsContext, x: number, y: number, h: number): void {
  const b = h * BODY_BOLT;
  g.moveTo(x, y - b).lineTo(x - 3, y - b * 0.65).lineTo(x + 2, y - b * 0.55).lineTo(x - 2, y - 6).stroke({ width: 1.4, color: 0xc58a2b });
}
/** Éclair de transformation (P6) au pied d'un porteur : halo qui pulse et zigzag à l'échelle du Titan à venir. */
export function drawTransformFlash(g: GraphicsContext, x: number, y: number, pulse: number, h: number): void {
  drawTransformHalo(g, x, y, pulse);
  drawTransformBolt(g, x, y, h);
}

/** Halo autour d'un corps qui surgit (R0.2f) : `h` est la hauteur dessinée du Titan, `fade` va de 1 à 0. */
function drawBodyHalo(g: GraphicsContext, bx: number, by: number, h: number, fade: number): void {
  g.circle(bx, by - h * 0.5, h * (0.45 + 0.2 * (1 - fade))).fill({ color: 0xfff1b8, alpha: 0.4 * fade });
}
/** Éclair prolongé : du ciel (1,4 × la hauteur dessinée) jusqu'au corps. */
function drawBodyBolt(g: GraphicsContext, bx: number, by: number, h: number, fade: number): void {
  g.moveTo(bx + h * 0.1, by - h * BODY_BOLT).lineTo(bx - h * 0.08, by - h * 0.9).lineTo(bx + h * 0.06, by - h * 0.75).lineTo(bx - h * 0.04, by - h * 0.2).stroke({ width: 2, color: 0xc58a2b, alpha: fade });
}
/** Éclair prolongé autour d'un corps qui surgit (R0.2f). */
export function drawBodyFlash(g: GraphicsContext, bx: number, by: number, h: number, fade: number): void {
  drawBodyHalo(g, bx, by, h, fade);
  drawBodyBolt(g, bx, by, h, fade);
}

export interface DrawnBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Bornes réelles d'un tracé (Pixi, épaisseur des traits comprise) : ce que la scène dessine, pas un point estimé. */
function boundsOf(draw: (g: GraphicsContext) => void): DrawnBox {
  const g = new GraphicsContext();
  draw(g);
  const b = g.bounds;
  const out = { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
  g.destroy();
  return out;
}

/** Bornes d'une figure de Titan vivant, debout, dessinée à la hauteur 100, pieds en (0, 0) : tête comprise. */
export function titanFigureBounds(silhouette: number, facing: number): DrawnBox {
  return boundsOf((g) => drawTitan(g, 0, 0, 100, silhouette, facing, true, false, { armL: false, armR: false, legs: false }));
}

/** Bornes des éclairs d'un porteur aux pieds (x, y), corps de hauteur dessinée `h` : halos (au plus large) et zigzags. */
export function shifterFlashBounds(x: number, y: number, h: number): { halos: DrawnBox[]; bolts: DrawnBox[] } {
  return {
    halos: [boundsOf((g) => drawTransformHalo(g, x, y, 6)), boundsOf((g) => drawBodyHalo(g, x, y, h, 0))],
    bolts: [boundsOf((g) => drawTransformBolt(g, x, y, h)), boundsOf((g) => drawBodyBolt(g, x, y, h, 1))],
  };
}
