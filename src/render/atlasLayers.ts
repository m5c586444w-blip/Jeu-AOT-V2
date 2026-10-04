import type { Graphics } from "pixi.js";
import { pointInPolygon, polar } from "../sim/strategic/geometry";
import type { Point } from "../sim/strategic/geometry";
import { bbox, flat, jitterPath, rngFor } from "./ink";
import { BRICK, INK, OCHRE, PAPER, PAPER_DARK, SEA, STONE, VERDIGRIS } from "./palette";

/**
 * Couches dessinées de la carte d'atlas (04 §3). Les épaisseurs de trait sont données en pixels écran
 * et converties avec `px` (km par pixel) : les couches de trait sont redessinées quand le zoom change de palier.
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

/** Mer : lavis gris-vert et lignes de houle gravées (sous la terre, qui les recouvre). */
export function drawSea(g: Graphics, bounds: readonly number[], px: number): void {
  // La mer déborde largement de l'emprise pour couvrir la vue quel que soit le cadrage.
  const [bx0, by0, bx1, by1] = bounds as [number, number, number, number];
  const pad = Math.max(bx1 - bx0, by1 - by0) * 1.5;
  const [x0, y0, x1, y1] = [bx0 - pad, by0 - pad, bx1 + pad, by1 + pad];
  g.rect(x0, y0, x1 - x0, y1 - y0).fill({ color: SEA, alpha: 0.55 });
  const rng = rngFor("houle");
  for (let y = y0 + 8; y < y1; y += 13) {
    let x = x0 + rng.next() * 20;
    while (x < x1) {
      const len = 18 + rng.next() * 40;
      const wave: Point[] = [];
      for (let t = 0; t <= len; t += 3) wave.push([x + t, y + Math.sin((x + t) / 6) * 1.2]);
      g.poly(flat(wave), false).stroke({ width: 0.8 * px, color: INK, alpha: 0.22 });
      x += len + 10 + rng.next() * 30;
    }
  }
}

/** Côte : terre papier, trait de côte appuyé et lignes d'eau concentriques (gravure). */
export function drawLand(g: Graphics, coast: readonly Point[], px: number): void {
  const inked = jitterPath(coast, 2.2, 6, "cote");
  g.poly(flat(inked)).fill({ color: PAPER, alpha: 1 });
  [6, 12, 19, 27].forEach((off, i) => {
    const ring = inked.map(([x, y]): Point => {
      const r = Math.hypot(x, y);
      return [(x * (r + off)) / r, (y * (r + off)) / r];
    });
    g.poly(flat(ring)).stroke({ width: 0.9 * px, color: INK, alpha: 0.28 - i * 0.05 });
  });
  g.poly(flat(inked)).stroke({ width: 2.2 * px, color: INK, alpha: 0.9 });
}

/** Lavis d'aquarelle : remplissage dilué + bord plus sombre (pigment qui s'accumule). */
export function drawWash(g: Graphics, shape: ProvinceShape, color: number, alpha: number, px: number): void {
  const edge = jitterPath(shape.polygon, 1.2, 5, `lavis:${shape.id}`);
  g.poly(flat(edge)).fill({ color, alpha });
  g.poly(flat(edge)).stroke({ width: 5 * px, color, alpha: alpha * 0.55, alignment: 1 });
}

/** Frontière à l'encre irrégulière ; chaque province trace son propre bord (doublé, comme à la main). */
export function drawBorder(g: Graphics, shape: ProvinceShape, px: number, width = 1, alpha = 0.55, color = INK): void {
  const edge = jitterPath(shape.polygon, 0.9, 4, `bord:${shape.id}`);
  g.poly(flat(edge)).stroke({ width: width * px, color, alpha, join: "round" });
}

function samples(shape: ProvinceShape, spacing: number, key: string): Point[] {
  const [x0, y0, x1, y1] = bbox(shape.polygon);
  const rng = rngFor(key);
  const pts: Point[] = [];
  for (let y = y0; y < y1; y += spacing) {
    for (let x = x0; x < x1; x += spacing) {
      const p: Point = [x + (rng.next() - 0.5) * spacing * 0.7, y + (rng.next() - 0.5) * spacing * 0.7];
      if (pointInPolygon(p, shape.polygon)) pts.push(p);
    }
  }
  return pts;
}

/** Symboles de terrain : hachures de relief, arbres, roseaux, ruines, champs, lac, rivière. */
export function drawTerrain(g: Graphics, shape: ProvinceShape, px: number): void {
  const w = 0.9 * px;
  switch (shape.terrain) {
    case "montagne":
    case "collines":
    case "plateau": {
      const size = shape.terrain === "montagne" ? 6 : 4;
      for (const [x, y] of samples(shape, shape.terrain === "montagne" ? 11 : 13, `relief:${shape.id}`)) {
        g.moveTo(x - size, y + size * 0.6).lineTo(x, y - size * 0.7).lineTo(x + size, y + size * 0.6).stroke({ width: w, color: INK, alpha: 0.6 });
        for (let k = 1; k <= 3; k++) g.moveTo(x + k * size * 0.25, y - size * 0.7 + k * size * 0.32).lineTo(x + k * size * 0.25 + size * 0.2, y + size * 0.6).stroke({ width: w * 0.7, color: INK, alpha: 0.4 });
      }
      break;
    }
    case "foret":
      for (const [x, y] of samples(shape, 8, `foret:${shape.id}`)) {
        g.circle(x, y - 1.6, 2.4).fill({ color: VERDIGRIS, alpha: 0.35 }).stroke({ width: w * 0.8, color: INK, alpha: 0.55 });
        g.moveTo(x, y + 0.8).lineTo(x, y + 3).stroke({ width: w * 0.8, color: INK, alpha: 0.55 });
      }
      break;
    case "marais":
      for (const [x, y] of samples(shape, 10, `marais:${shape.id}`)) {
        g.moveTo(x - 4, y).lineTo(x + 4, y).stroke({ width: w, color: INK, alpha: 0.45 });
        for (const dx of [-2, 0, 2]) g.moveTo(x + dx, y).lineTo(x + dx * 1.4, y - 3).stroke({ width: w * 0.7, color: INK, alpha: 0.45 });
      }
      break;
    case "ruines":
      for (const [x, y] of samples(shape, 16, `ruines:${shape.id}`)) {
        g.moveTo(x - 3, y + 2).lineTo(x - 3, y - 2).lineTo(x + 1, y - 2).stroke({ width: w, color: INK, alpha: 0.5 });
        g.moveTo(x + 3, y - 0.5).lineTo(x + 3, y + 2).lineTo(x - 0.5, y + 2).stroke({ width: w, color: INK, alpha: 0.5 });
      }
      break;
    case "lac": {
      const [cx, cy] = shape.anchor;
      const lake = jitterPath(Array.from({ length: 24 }, (_, i): Point => [cx + Math.cos((i / 24) * Math.PI * 2) * 13, cy + Math.sin((i / 24) * Math.PI * 2) * 7]), 1, 3, `lac:${shape.id}`);
      g.poly(flat(lake)).fill({ color: SEA, alpha: 0.9 }).stroke({ width: 1.2 * px, color: INK, alpha: 0.8 });
      for (const k of [0.75, 0.5]) g.ellipse(cx, cy, 13 * k, 7 * k).stroke({ width: w * 0.7, color: INK, alpha: 0.3 });
      break;
    }
    case "fleuve": {
      const [ax, ay] = shape.anchor;
      const r = Math.hypot(ax, ay);
      const b = (Math.atan2(ax, -ay) * 180) / Math.PI;
      const river: Point[] = [];
      for (let k = -60; k <= 80; k += 5) river.push(polar(r + k, b + Math.sin(k / 14) * 4));
      g.poly(flat(jitterPath(river, 1.4, 4, `riviere:${shape.id}`, false)), false).stroke({ width: 2.2 * px, color: 0x5b6b6a, alpha: 0.8 });
      break;
    }
    case "plaine":
    case "rural":
      if (shape.keyResource === "nourriture") {
        for (const [x, y] of samples(shape, 12, `champs:${shape.id}`)) {
          for (let k = 0; k < 3; k++) g.moveTo(x - 3, y + k * 1.6).lineTo(x + 3, y + k * 1.6 - 0.8).stroke({ width: w * 0.6, color: OCHRE, alpha: 0.75 });
        }
      } else {
        for (const [x, y] of samples(shape, 14, `herbe:${shape.id}`)) g.circle(x, y, 0.5).fill({ color: INK, alpha: 0.35 });
      }
      break;
    case "urbain":
    case "souterrain":
    case "militaire":
    case "fort": {
      const [cx, cy] = shape.anchor;
      const rng = rngFor(`ville:${shape.id}`);
      const n = shape.terrain === "urbain" ? 9 : 4;
      for (let i = 0; i < n; i++) {
        const x = cx + (rng.next() - 0.5) * 16;
        const y = cy + 6 + (rng.next() - 0.5) * 8;
        g.rect(x, y, 2.2 + rng.next() * 1.6, 1.8 + rng.next() * 1.2).fill({ color: INK, alpha: 0.55 });
      }
      if (shape.terrain === "fort") g.rect(cx - 4, cy + 4, 8, 6).stroke({ width: w * 1.3, color: INK, alpha: 0.7 });
      break;
    }
    default:
      break;
  }
}

export interface WallRing {
  wall: string;
  r_inner: number;
  r_outer: number;
}

/**
 * Murs : bande de pierre hachurée, double filet d'encre, joints de segments, portes ;
 * l'état structurel de chaque segment est visible (fissures, teinte brique, brèche).
 */
export function drawWall(g: Graphics, ring: WallRing, segments: { from: number; to: number; structure: number }[], gates: number[], px: number): void {
  const { r_inner: ri, r_outer: ro } = ring;
  g.circle(0, 0, ro).fill({ color: STONE, alpha: 0.95 }).circle(0, 0, ri).cut();
  for (let b = 0; b < 360; b += 1.5) {
    const [x0, y0] = polar(ri, b);
    const [x1, y1] = polar(ro, b + 0.6);
    g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 0.6 * px, color: INK, alpha: 0.35 });
  }
  const outline = (r: number, key: string): Point[] => jitterPath(Array.from({ length: 180 }, (_, i): Point => polar(r, i * 2)), 0.5, 4, key);
  g.poly(flat(outline(ro, `mur-ext:${ring.wall}`))).stroke({ width: 1.6 * px, color: INK, alpha: 0.95 });
  g.poly(flat(outline(ri, `mur-int:${ring.wall}`))).stroke({ width: 1.2 * px, color: INK, alpha: 0.85 });
  g.poly(flat(outline(ro + 3, `mur-ext2:${ring.wall}`))).stroke({ width: 0.7 * px, color: INK, alpha: 0.5 });
  for (const s of segments) {
    const [a0, a1] = [polar(ri - 2, s.from), polar(ro + 2, s.from)];
    g.moveTo(a0[0], a0[1]).lineTo(a1[0], a1[1]).stroke({ width: 1.4 * px, color: INK, alpha: 0.8 });
    if (s.structure < 100) {
      const rng = rngFor(`fissure:${ring.wall}:${s.from}`);
      const cracks = Math.ceil((100 - s.structure) / 15);
      for (let c = 0; c < cracks; c++) {
        const b = s.from + (s.to - s.from) * rng.next();
        const zig: Point[] = [polar(ri, b), polar((ri + ro) / 2, b + 0.4), polar(ro, b - 0.2)];
        g.poly(flat(zig), false).stroke({ width: 1.1 * px, color: BRICK, alpha: 0.9 });
      }
      const tint: Point[] = [];
      for (let b = s.from; b <= s.to; b += 1) tint.push(polar(ro, b));
      for (let b = s.to; b >= s.from; b -= 1) tint.push(polar(ri, b));
      g.poly(flat(tint)).fill({ color: BRICK, alpha: (100 - s.structure) / 250 });
    }
  }
  for (const bearing of gates) {
    const span = 1.6;
    const gate: Point[] = [polar(ri - 1, bearing - span), polar(ro + 1, bearing - span), polar(ro + 1, bearing + span), polar(ri - 1, bearing + span)];
    g.poly(flat(gate)).fill({ color: PAPER, alpha: 1 }).stroke({ width: 1.3 * px, color: INK, alpha: 0.95 });
    const [mx, my] = polar((ri + ro) / 2, bearing);
    g.circle(mx, my, (ro - ri) * 0.22).stroke({ width: 1 * px, color: INK, alpha: 0.9 });
  }
}

/** Brouillard « papier froissé » sur les terres inexplorées (F-STR-06). */
export function drawFog(g: Graphics, shape: ProvinceShape, level: "inexplore" | "partielle", px: number): void {
  const alpha = level === "inexplore" ? 0.8 : 0.38;
  const edge = jitterPath(shape.polygon, 1.5, 6, `brume:${shape.id}`);
  g.poly(flat(edge)).fill({ color: PAPER_DARK, alpha });
  const rng = rngFor(`plis:${shape.id}`);
  const [x0, y0, x1, y1] = bbox(shape.polygon);
  for (let k = 0; k < (level === "inexplore" ? 6 : 3); k++) {
    const a: Point = [x0 + rng.next() * (x1 - x0), y0 + rng.next() * (y1 - y0)];
    const b: Point = [a[0] + (rng.next() - 0.5) * 120, a[1] + (rng.next() - 0.5) * 120];
    if (pointInPolygon(a, shape.polygon) && pointInPolygon(b, shape.polygon)) {
      g.moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: 1.2 * px, color: 0xffffff, alpha: 0.35 });
      g.moveTo(a[0] + 0.8, a[1] + 0.8).lineTo(b[0] + 0.8, b[1] + 0.8).stroke({ width: 0.8 * px, color: INK, alpha: 0.12 });
    }
  }
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
