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
export function drawRoute(g: Graphics, points: readonly Point[], px: number, style: "plan" | "aller" | "retour" | "convoi"): void {
  if (points.length < 2) return;
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
