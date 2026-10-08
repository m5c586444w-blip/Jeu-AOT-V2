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
/**
 * Zigzag de transformation : il tombe de BODY_BOLT × la hauteur dessinée du Titan à venir (`h`) jusqu'aux pieds, à droite de la
 * figure du porteur (R1e §6, point 8 : il ne barre plus le visage).
 */
function drawTransformBolt(g: GraphicsContext, x: number, y: number, h: number): void {
  const b = h * BODY_BOLT;
  const dx = Math.max(4, h * 0.22);
  g.moveTo(x + dx, y - b).lineTo(x + dx - 3, y - b * 0.65).lineTo(x + dx + 2, y - b * 0.55).lineTo(x + 2, y - 6).stroke({ width: 1.4, color: 0xc58a2b });
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
/** Éclair prolongé : de BODY_BOLT × la hauteur dessinée jusqu'au corps, sur son flanc droit (pas sur le visage). */
function drawBodyBolt(g: GraphicsContext, bx: number, by: number, h: number, fade: number): void {
  g.moveTo(bx + h * 0.3, by - h * BODY_BOLT).lineTo(bx + h * 0.2, by - h * 0.9).lineTo(bx + h * 0.32, by - h * 0.75).lineTo(bx + h * 0.24, by - h * 0.2).stroke({ width: 2, color: 0xc58a2b, alpha: fade });
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

/** Modèle de pièce d'artillerie (PA.5) : deux modèles simples par camp, dessinés par code. */
export type GunModel = "canon_paradis" | "mortier_paradis" | "canon_marley" | "obusier_marley";

export function gunModel(piece: string): GunModel {
  if (piece.startsWith("art_marley")) return piece.includes("obusier") || piece.includes("lourde") ? "obusier_marley" : "canon_marley";
  return piece.includes("mortier") ? "mortier_paradis" : "canon_paradis";
}

const WOOD = 0x6b4a2f;
const STEEL = 0x5a5f66;
const KHAKI = 0x7a6f4a;

/**
 * Pièce d'artillerie vue de trois quarts, en mètres projetés (`s` ≈ 1 m, taille minimale imposée par la scène) :
 * affût de bois et fût noir pour Paradis (canon, mortier trapu) ; acier, bouclier et roues cerclées pour Marley
 * (canon long, obusier levé). Une pièce réduite au silence est renversée et grisée.
 */
export function drawGun(g: GraphicsContext, sx: number, sy: number, s: number, model: GunModel, facing: number, silenced: boolean): void {
  const f = facing >= 0 ? 1 : -1;
  const marley = model === "canon_marley" || model === "obusier_marley";
  const body = silenced ? STONE : marley ? STEEL : WOOD;
  const barrel = silenced ? STONE : marley ? STEEL : INK;
  const wheelR = marley ? 0.55 * s : 0.75 * s;
  if (silenced) {
    g.poly([sx - 1.4 * s, sy, sx + 1.4 * s, sy - 0.2 * s, sx + 1.2 * s, sy - 0.6 * s, sx - 1.2 * s, sy - 0.4 * s]).fill({ color: body, alpha: 0.8 }).stroke({ width: 0.12 * s, color: INK });
    g.circle(sx + 0.6 * s * f, sy - 0.5 * s, wheelR).stroke({ width: 0.14 * s, color: INK, alpha: 0.7 });
    return;
  }
  // Ombre au sol.
  g.ellipse(sx, sy, 1.7 * s, 0.35 * s).fill({ color: INK, alpha: 0.18 });
  // Affût (flèche traînante vers l'arrière).
  g.poly([sx - 1.6 * s * f, sy - 0.1 * s, sx + 0.3 * s * f, sy - wheelR - 0.1 * s, sx + 0.6 * s * f, sy - wheelR + 0.25 * s, sx - 1.5 * s * f, sy + 0.1 * s]).fill({ color: body }).stroke({ width: 0.1 * s, color: INK });
  // Fût : long et peu levé (canons), court et levé (mortier, obusier).
  const angle = model === "mortier_paradis" ? 0.9 : model === "obusier_marley" ? 0.55 : 0.18;
  const len = model === "mortier_paradis" ? 1.1 * s : model === "obusier_marley" ? 1.8 * s : model === "canon_marley" ? 2.6 * s : 2.2 * s;
  const width = model === "mortier_paradis" ? 0.55 * s : 0.3 * s;
  const bx = sx + 0.2 * s * f;
  const by = sy - wheelR - 0.1 * s;
  const ex = bx + Math.cos(angle) * len * f;
  const ey = by - Math.sin(angle) * len;
  g.moveTo(bx, by).lineTo(ex, ey).stroke({ width, color: barrel, cap: "round" });
  if (!marley) g.circle(bx - 0.15 * s * f, by + 0.05 * s, width * 0.7).fill({ color: barrel });
  // Bouclier de Marley.
  if (marley) g.rect(bx + 0.15 * s * f - (f < 0 ? 0.25 * s : 0), by - 0.95 * s, 0.25 * s, 1.1 * s).fill({ color: KHAKI }).stroke({ width: 0.08 * s, color: INK });
  // Roues (rayons pour Paradis, bandage plein pour Marley).
  const wx = sx + 0.25 * s * f;
  const wy = sy - wheelR;
  g.circle(wx, wy, wheelR).stroke({ width: (marley ? 0.22 : 0.14) * s, color: INK });
  if (!marley) for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    g.moveTo(wx - Math.cos(a) * wheelR, wy - Math.sin(a) * wheelR).lineTo(wx + Math.cos(a) * wheelR, wy + Math.sin(a) * wheelR).stroke({ width: 0.06 * s, color: INK });
  }
  g.circle(wx, wy, 0.12 * s).fill({ color: marley ? STEEL : OCHRE });
}

/** Impact d'obus : souffle qui s'élargit puis fumée qui retombe (`age` en secondes, `r` = rayon du souffle en mètres). */
export function drawImpact(g: GraphicsContext, x: number, y: number, r: number, tilt: number, age: number, enemy: boolean): void {
  if (age < 0 || age > 3) return;
  const a = Math.max(0, 1 - age / 3);
  if (age < 0.5) g.ellipse(x, y, r * (0.4 + age * 1.2), r * tilt * (0.4 + age * 1.2)).fill({ color: 0xf2c76b, alpha: 0.75 * (1 - age * 2) });
  g.ellipse(x, y, r * (0.6 + age * 0.3), r * tilt * (0.6 + age * 0.3)).stroke({ width: Math.max(0.3, r * 0.06), color: enemy ? BRICK : OCHRE, alpha: a * 0.8 });
  for (let i = 0; i < 3; i++) g.circle(x + (i - 1) * r * 0.35, y - r * (0.3 + age * 0.5) - i * r * 0.1, r * (0.25 + age * 0.15)).fill({ color: STONE, alpha: a * 0.45 });
}

/** Zone de danger d'une batterie : ellipse au sol (souffle + dispersion), hachurée légère, rouge pour le feu ennemi. */
export function drawDangerZone(g: GraphicsContext, x: number, y: number, r: number, tilt: number, enemy: boolean): void {
  const c = enemy ? BRICK : OCHRE;
  g.ellipse(x, y, r, r * tilt).fill({ color: c, alpha: 0.1 }).stroke({ width: Math.max(0.4, r * 0.03), color: c, alpha: 0.55 });
  g.moveTo(x - r * 0.25, y).lineTo(x + r * 0.25, y).moveTo(x, y - r * tilt * 0.25).lineTo(x, y + r * tilt * 0.25).stroke({ width: Math.max(0.3, r * 0.02), color: c, alpha: 0.6 });
}
