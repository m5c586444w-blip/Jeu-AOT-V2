import type { Graphics } from "pixi.js";
import type { Point } from "../sim/strategic/geometry";
import { BRICK, INK, OCHRE, PAPER, VERDIGRIS } from "./palette";

/**
 * Pions et tracés militaires de la carte (04 §3, P3). Les épaisseurs de trait sont données en pixels écran
 * et converties avec `px` (km par pixel) : les couches de trait sont redessinées quand le zoom change de palier.
 * Le terrain, les murs et les villes sont dans terrainLayers.ts (MAP).
 */
export interface ProvinceShape {
  id: string;
  polygon: Point[];
  anchor: Point;
  terrain: string;
  kind: string;
  region: string;
  keyResource: string;
}

/** Pion de garnison : jeton papier, ombre portée de papier, marque gravée selon l'organisation (dessins originaux). */
export function drawPawn(g: Graphics, at: Point, org: string, px: number): void {
  const r = 7 * px;
  const [x, y] = at;
  g.ellipse(x + 1.6 * px, y + 2 * px, r, r * 0.9).fill({ color: INK, alpha: 0.22 });
  g.circle(x, y, r).fill({ color: PAPER, alpha: 1 }).stroke({ width: 1.3 * px, color: INK, alpha: 0.95 });
  g.circle(x, y, r * 0.78).stroke({ width: 0.6 * px, color: INK, alpha: 0.6 });
  const s = r * 0.45;
  switch (org) {
    case "garrison":
      g.rect(x - s, y - s * 0.4, s * 2, s * 1.1).stroke({ width: 1 * px, color: INK });
      for (const dx of [-s, -s / 3, s / 3]) g.rect(x + dx, y - s * 0.8, s * 0.55, s * 0.4).fill({ color: INK });
      break;
    case "military_police":
      g.poly([x, y - s, x + s, y, x, y + s, x - s, y]).stroke({ width: 1 * px, color: INK }).circle(x, y, s * 0.25).fill({ color: INK });
      break;
    case "survey_corps":
      g.moveTo(x - s, y + s * 0.5).lineTo(x - s * 0.3, y - s * 0.5).lineTo(x, y + s * 0.2).lineTo(x + s * 0.3, y - s * 0.5).lineTo(x + s, y + s * 0.5).stroke({ width: 1.1 * px, color: VERDIGRIS });
      break;
    default:
      g.moveTo(x - s, y).lineTo(x + s, y).moveTo(x, y - s).lineTo(x, y + s).stroke({ width: 1.1 * px, color: INK });
      break;
  }
}

/** Itinéraire tracé à l'encre (P3) : tirets pour un plan, trait plein pour une expédition en route. */
export function drawRoute(g: Graphics, points: readonly Point[], px: number, style: "plan" | "aller" | "retour" | "convoi" | "armee" | "armee_retraite"): void {
  if (points.length < 2) return;
  if (style === "armee" || style === "armee_retraite") {
    // Trajet d'armée (PA.8) : trait épais cerné d'encre, lisible sur le vert des campagnes ; chevrons de marche aux étapes.
    const c = style === "armee" ? PAPER : BRICK;
    const line = (): void => {
      g.moveTo(points[0]?.[0] ?? 0, points[0]?.[1] ?? 0);
      for (const p of points.slice(1)) g.lineTo(p[0], p[1]);
    };
    line();
    g.stroke({ width: 5.2 * px, color: INK, alpha: 0.85, cap: "round", join: "round" });
    line();
    g.stroke({ width: 2.8 * px, color: c, alpha: 0.95, cap: "round", join: "round" });
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1] as Point;
      const [x1, y1] = points[i] as Point;
      const a = Math.atan2(y1 - y0, x1 - x0);
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const s = 6 * px;
      g.poly([mx + Math.cos(a) * s, my + Math.sin(a) * s, mx + Math.cos(a + 2.5) * s, my + Math.sin(a + 2.5) * s, mx + Math.cos(a - 2.5) * s, my + Math.sin(a - 2.5) * s]).fill({ color: INK });
    }
    const end = points.at(-1) as Point;
    g.circle(end[0], end[1], 4.5 * px).fill({ color: c }).stroke({ width: 1.4 * px, color: INK });
    return;
  }
  const color = style === "plan" ? INK : style === "convoi" ? OCHRE : style === "retour" ? BRICK : VERDIGRIS;
  const width = (style === "plan" ? 2 : 2.6) * px;
  if (style === "plan" || style === "convoi") {
    // Tirets réguliers le long de la polyligne (trait de compas sur la carte d'état-major).
    const dash = 9 * px;
    const gap = 6 * px;
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1] as Point;
      const [x1, y1] = points[i] as Point;
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let t = 0; t < len; t += dash + gap) {
        const a = t / len;
        const b = Math.min(1, (t + dash) / len);
        g.moveTo(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a).lineTo(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
      }
    }
    g.stroke({ width, color, alpha: 0.9, cap: "round" });
  } else {
    g.moveTo(points[0]?.[0] ?? 0, points[0]?.[1] ?? 0);
    for (const p of points.slice(1)) g.lineTo(p[0], p[1]);
    g.stroke({ width, color, alpha: 0.85, cap: "round", join: "round" });
  }
  for (const p of points) g.circle(p[0], p[1], 2.2 * px).fill({ color, alpha: 0.9 });
}

/** Fanion d'expédition (vert-de-gris) ou chariot de convoi (ocre), posé sur sa position. */
export function drawExpeditionMarker(g: Graphics, at: Point, px: number, kind: "expedition" | "convoi"): void {
  const [x, y] = at;
  const color = kind === "expedition" ? VERDIGRIS : OCHRE;
  g.ellipse(x + 1.5 * px, y + 2 * px, 7 * px, 3 * px).fill({ color: INK, alpha: 0.2 });
  if (kind === "expedition") {
    g.moveTo(x, y).lineTo(x, y - 18 * px).stroke({ width: 1.4 * px, color: INK });
    g.poly([x, y - 18 * px, x + 12 * px, y - 14 * px, x, y - 10 * px]).fill({ color, alpha: 0.95 }).stroke({ width: 1 * px, color: INK });
  } else {
    g.rect(x - 6 * px, y - 7 * px, 12 * px, 6 * px).fill({ color, alpha: 0.95 }).stroke({ width: 1 * px, color: INK });
    g.circle(x - 3.5 * px, y, 1.8 * px).circle(x + 3.5 * px, y, 1.8 * px).stroke({ width: 1 * px, color: INK });
  }
}

/** Dépôt avancé : caisse cerclée, et son rayon de ravitaillement en pointillé fin. */
export function drawDepot(g: Graphics, at: Point, radius: number, px: number): void {
  const [x, y] = at;
  g.circle(x, y, radius).stroke({ width: 1 * px, color: OCHRE, alpha: 0.7 });
  g.rect(x - 5 * px, y - 5 * px, 10 * px, 10 * px).fill({ color: PAPER, alpha: 1 }).stroke({ width: 1.2 * px, color: INK });
  g.moveTo(x - 5 * px, y - 5 * px).lineTo(x + 5 * px, y + 5 * px).moveTo(x + 5 * px, y - 5 * px).lineTo(x - 5 * px, y + 5 * px).stroke({ width: 0.8 * px, color: INK, alpha: 0.8 });
}

/** Teintes de camp des étendards d'armée (PA.8) : Paradis vert-de-gris, Marley brique, autres nations encre et ocre. */
const SIDE_COLOR: Record<string, number> = { paradis: VERDIGRIS, marley: BRICK, allies: OCHRE, hizuru: 0x9b6a3c, autre: INK };

/** Marque gravée d'un étendard (dessins originaux, formes abstraites : créneaux, losange, chevrons, étoile, croix, disque). */
function insigniaMark(g: Graphics, x: number, y: number, s: number, insignia: string, px: number): void {
  const w = 1.1 * px;
  switch (insignia) {
    case "garnison":
      g.rect(x - s, y - s * 0.2, s * 2, s * 0.9).stroke({ width: w, color: PAPER });
      for (const dx of [-s, -s / 3, s / 3]) g.rect(x + dx, y - s * 0.6, s * 0.55, s * 0.4).fill({ color: PAPER });
      break;
    case "brigade":
      g.poly([x, y - s, x + s * 0.8, y, x, y + s, x - s * 0.8, y]).stroke({ width: w, color: PAPER }).circle(x, y, s * 0.25).fill({ color: PAPER });
      break;
    case "corps":
      g.moveTo(x - s, y + s * 0.5).lineTo(x - s * 0.3, y - s * 0.5).lineTo(x, y + s * 0.2).lineTo(x + s * 0.3, y - s * 0.5).lineTo(x + s, y + s * 0.5).stroke({ width: w, color: PAPER });
      break;
    case "marley": {
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? s : s * 0.42;
        pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.poly(pts).fill({ color: PAPER });
      break;
    }
    case "allies":
      g.moveTo(x - s, y).lineTo(x + s, y).moveTo(x, y - s).lineTo(x, y + s).stroke({ width: w * 1.3, color: PAPER });
      break;
    default:
      g.circle(x, y, s * 0.7).fill({ color: PAPER });
      break;
  }
}

export interface ArmyBanner {
  at: Point;
  side: string;
  insignia: string;
  /** 0–1. */
  morale: number;
  /** 0–1. */
  supply: number;
  selected: boolean;
  marching: boolean;
}

/**
 * Étendard d'armée sur la carte (PA.8, à la manière d'une carte de campagne) : hampe, drapeau aux couleurs du camp
 * avec sa marque, socle ; sous le socle, deux jauges (moral, vivres). L'effectif est écrit par la carte (texte).
 */
export function drawArmyBanner(g: Graphics, b: ArmyBanner, px: number): void {
  const [x, y] = b.at;
  const color = SIDE_COLOR[b.side] ?? INK;
  const h = 30 * px;
  const fw = 20 * px;
  const fh = 15 * px;
  g.ellipse(x + 2 * px, y + 2 * px, 11 * px, 4 * px).fill({ color: INK, alpha: 0.25 });
  if (b.selected) g.circle(x, y - h / 2, 22 * px).fill({ color: 0xffffff, alpha: 0.18 }).stroke({ width: 2.4 * px, color: OCHRE, alpha: 0.95 });
  // Socle et hampe.
  g.rect(x - 9 * px, y - 3 * px, 18 * px, 5 * px).fill({ color: PAPER }).stroke({ width: 1 * px, color: INK });
  g.moveTo(x - 7 * px, y - 3 * px).lineTo(x - 7 * px, y - h).stroke({ width: 1.6 * px, color: INK });
  // Drapeau (pointe flottante si l'armée marche).
  const fx = x - 7 * px;
  const fy = y - h;
  const tip = b.marching ? 6 * px : 0;
  g.poly([fx, fy, fx + fw + tip, fy + 2 * px, fx + fw, fy + fh / 2, fx + fw + tip, fy + fh - 2 * px, fx, fy + fh]).fill({ color, alpha: 0.96 }).stroke({ width: 1.1 * px, color: INK });
  insigniaMark(g, fx + fw / 2, fy + fh / 2, 5 * px, b.insignia, px);
  // Jauges : moral (encre) et vivres (ocre), sur fond papier.
  const bw = 22 * px;
  const bh = 3 * px;
  for (const [i, v, c] of [[0, b.morale, b.morale < 0.3 ? BRICK : INK], [1, b.supply, b.supply < 0.2 ? BRICK : OCHRE]] as const) {
    const by = y + 4 * px + i * (bh + 1.5 * px);
    g.rect(x - bw / 2, by, bw, bh).fill({ color: PAPER }).stroke({ width: 0.7 * px, color: INK });
    g.rect(x - bw / 2, by, bw * Math.max(0, Math.min(1, v)), bh).fill({ color: c });
  }
}

/** Flotte en mer (PA.8) : coque et mâture schématiques, aux couleurs du camp. */
export function drawFleet(g: Graphics, at: Point, side: string, px: number, selected: boolean): void {
  const [x, y] = at;
  const color = SIDE_COLOR[side] ?? INK;
  if (selected) g.circle(x, y - 6 * px, 20 * px).stroke({ width: 2.4 * px, color: OCHRE, alpha: 0.95 });
  g.ellipse(x, y + 3 * px, 16 * px, 3 * px).fill({ color: INK, alpha: 0.18 });
  g.poly([x - 15 * px, y - 4 * px, x + 15 * px, y - 4 * px, x + 10 * px, y + 3 * px, x - 11 * px, y + 3 * px]).fill({ color }).stroke({ width: 1.1 * px, color: INK });
  g.rect(x - 5 * px, y - 11 * px, 9 * px, 7 * px).fill({ color: PAPER }).stroke({ width: 0.9 * px, color: INK });
  g.moveTo(x - 1 * px, y - 11 * px).lineTo(x - 1 * px, y - 18 * px).moveTo(x + 6 * px, y - 4 * px).lineTo(x + 6 * px, y - 14 * px).stroke({ width: 1.2 * px, color: INK });
  g.circle(x + 2 * px, y - 21 * px, 2.5 * px).fill({ color: STONE_SMOKE, alpha: 0.6 });
}

const STONE_SMOKE = 0x8a8577;

/** Rencontre en attente (PA.8) : deux lames croisées dans un cercle brique. */
export function drawClash(g: Graphics, at: Point, px: number): void {
  const [x, y] = at;
  const r = 11 * px;
  g.circle(x, y, r).fill({ color: PAPER }).stroke({ width: 2 * px, color: BRICK });
  g.moveTo(x - r * 0.6, y - r * 0.6).lineTo(x + r * 0.6, y + r * 0.6).moveTo(x + r * 0.6, y - r * 0.6).lineTo(x - r * 0.6, y + r * 0.6).stroke({ width: 2 * px, color: INK });
}
