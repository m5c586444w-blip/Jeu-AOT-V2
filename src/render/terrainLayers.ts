import { Sprite, Texture } from "pixi.js";
import type { Graphics } from "pixi.js";
import type { TerrainData } from "../data/terrain";
import type { Point } from "../sim/strategic/geometry";
import { flat } from "./ink";
import { renderTerrain } from "./terrainRaster";
import type { TerrainImage } from "./terrainRaster";

/**
 * Couches de la carte réaliste (MAP.3) : image du terrain, côte et îlots, fleuves, routes et ponts, murs en relief,
 * villes par taille, brouillard en voile. Épaisseurs données en pixels écran et converties avec `px` (km par pixel).
 */
export const MAP_INK = 0x1f1d1a;
const RIVER = 0x46708a;
const ROAD = 0x6e5236;
const STONE_LIGHT = 0xcfc8b6;
const STONE_DARK = 0x6f6a5e;
const BRICK = 0x9a3d2b;
const TOWN_FILL = 0xf2ece0;
/** Couleur de la mer profonde, identique à celle de l'image du terrain (aucune couture au bord de l'image). */
const OPEN_SEA = 0x284458;

/** Taille de l'image du terrain : assez fine au zoom « région », assez petite pour la première image. */
export const TERRAIN_TEXTURE = 1280;

/** Image fine, calculée ensuite dans un worker (zooms « province », écrans 4K). */
export const TERRAIN_TEXTURE_FINE = 3072;

export function terrainTexture(img: TerrainImage): Texture {
  const size = img.size;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2D indisponible");
  ctx.putImageData(new ImageData(img.pixels, size, size), 0, 0);
  return Texture.from(canvas);
}

export function terrainSprite(t: TerrainData, size = TERRAIN_TEXTURE): Sprite {
  const sprite = new Sprite(terrainTexture(renderTerrain(t, size)));
  const [x0, y0, x1, y1] = t.bounds;
  sprite.position.set(x0, y0);
  sprite.width = x1 - x0;
  sprite.height = y1 - y0;
  return sprite;
}

/** Mer au-delà de l'emprise de l'image (la vue peut dépasser l'île). */
export function drawOpenSea(g: Graphics, bounds: readonly number[]): void {
  const [bx0, by0, bx1, by1] = bounds as [number, number, number, number];
  const pad = Math.max(bx1 - bx0, by1 - by0) * 1.5;
  g.rect(bx0 - pad, by0 - pad, bx1 - bx0 + 2 * pad, by1 - by0 + 2 * pad).fill({ color: OPEN_SEA });
}

/** Trait de côte net et îlots. */
export function drawCoast(g: Graphics, t: TerrainData, px: number): void {
  g.poly(flat(t.coast)).stroke({ width: 1.1 * px, color: MAP_INK, alpha: 0.55, join: "round" });
  for (const isl of t.islets) g.poly(flat(isl)).stroke({ width: 0.9 * px, color: MAP_INK, alpha: 0.45, join: "round" });
}

export function drawRivers(g: Graphics, t: TerrainData, px: number): void {
  for (const r of t.rivers) {
    const pts = r.points;
    g.moveTo(pts[0]?.[0] ?? 0, pts[0]?.[1] ?? 0);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]?.[0] ?? 0, pts[i]?.[1] ?? 0);
    g.stroke({ width: Math.max(0.9 * px, r.width * 0.9), color: RIVER, alpha: 0.95, cap: "round", join: "round" });
  }
}

/** Routes (trait plein) et chemins (tirets) ; ponts au croisement des fleuves. */
export function drawRoads(g: Graphics, t: TerrainData, px: number, showPaths: boolean, showBridges: boolean): void {
  for (const r of t.roads) {
    if (r.kind === "chemin" && !showPaths) continue;
    const pts = r.points;
    if (r.kind === "route") {
      g.moveTo(pts[0]?.[0] ?? 0, pts[0]?.[1] ?? 0);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]?.[0] ?? 0, pts[i]?.[1] ?? 0);
      g.stroke({ width: 1.4 * px, color: ROAD, alpha: 0.75, cap: "round", join: "round" });
    } else {
      const dash = 5 * px;
      const gap = 4 * px;
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1] as Point;
        const [x1, y1] = pts[i] as Point;
        const len = Math.hypot(x1 - x0, y1 - y0);
        for (let s = 0; s < len; s += dash + gap) {
          const a = s / len;
          const b = Math.min(1, (s + dash) / len);
          g.moveTo(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a).lineTo(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
        }
      }
      g.stroke({ width: 1 * px, color: ROAD, alpha: 0.55 });
    }
  }
  if (showBridges) for (const [x, y] of t.bridges) g.rect(x - 2.2 * px, y - 2.2 * px, 4.4 * px, 4.4 * px).fill({ color: TOWN_FILL }).stroke({ width: 0.9 * px, color: MAP_INK, alpha: 0.85 });
}

const offset = (line: readonly Point[], dr: number): Point[] =>
  line.map(([x, y]) => {
    const r = Math.hypot(x, y) || 1;
    return [(x * (r + dr)) / r, (y * (r + dr)) / r];
  });

export interface WallSegmentState {
  polygon: Point[];
  structure: number;
}

/**
 * Murs en relief : ombre portée vers le sud-est, bande de pierre, arêtes claire (nord-ouest) et sombre,
 * créneaux au zoom rapproché, segments abîmés teintés brique, portes.
 */
export function drawWalls(g: Graphics, t: TerrainData, segments: readonly WallSegmentState[], px: number, detailed: boolean): void {
  for (const w of t.walls) {
    const half = w.band_km / 2;
    const inner = offset(w.line, -half);
    const outer = offset(w.line, half);
    const shadow = Math.max(2.2 * px, 3);
    g.poly(flat(outer.map(([x, y]): Point => [x + shadow, y + shadow]))).fill({ color: 0x000000, alpha: 0.28 }).poly(flat(inner.map(([x, y]): Point => [x + shadow, y + shadow]))).cut();
    g.poly(flat(outer)).fill({ color: STONE_LIGHT }).poly(flat(inner)).cut();
    g.poly(flat(outer)).stroke({ width: 1.3 * px, color: STONE_DARK, alpha: 0.95 });
    g.poly(flat(inner)).stroke({ width: 1 * px, color: STONE_DARK, alpha: 0.85 });
    g.poly(flat(offset(w.line, 0))).stroke({ width: Math.min(w.band_km * 0.25, 1.4 * px), color: 0xffffff, alpha: 0.35 });
    if (detailed) {
      for (let i = 0; i < outer.length; i += 2) {
        const [x0, y0] = outer[i] as Point;
        const [x1, y1] = offset([w.line[i] as Point], half - Math.min(half * 0.6, 3 * px))[0] as Point;
        g.moveTo(x0, y0).lineTo(x1, y1);
      }
      g.stroke({ width: 0.7 * px, color: STONE_DARK, alpha: 0.6 });
    }
  }
  for (const s of segments) {
    if (s.structure >= 100) continue;
    g.poly(flat(s.polygon)).fill({ color: BRICK, alpha: 0.25 + (100 - s.structure) / 160 });
  }
  for (const gate of t.gates) {
    const [x, y] = gate.at;
    const r = Math.max(4.5 * px, 7);
    g.rect(x - r, y - r, 2 * r, 2 * r).fill({ color: STONE_LIGHT }).stroke({ width: 1.3 * px, color: MAP_INK, alpha: 0.95 });
    g.rect(x - r * 0.45, y - r * 0.45, r * 0.9, r * 0.9).fill({ color: MAP_INK, alpha: 0.85 });
  }
}

/** Villes : icônes dessinées par taille, de taille constante à l'écran. */
export function drawTowns(g: Graphics, t: TerrainData, px: number, minSize: number): void {
  const RANK = { hameau: 0, bourg: 1, fort: 1, ville: 2, district: 3, capitale: 4 } as const;
  for (const town of t.towns) {
    if (RANK[town.size] < minSize) continue;
    const [x, y] = town.at;
    const shadow = (r: number): void => void g.circle(x + 1.2 * px, y + 1.5 * px, r).fill({ color: 0x000000, alpha: 0.3 });
    switch (town.size) {
      case "capitale": {
        const r = 8 * px;
        shadow(r);
        g.circle(x, y, r).fill({ color: TOWN_FILL }).stroke({ width: 1.6 * px, color: MAP_INK });
        const star: number[] = [];
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          const rr = i % 2 === 0 ? r * 0.72 : r * 0.3;
          star.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        g.poly(star).fill({ color: BRICK });
        break;
      }
      case "district": {
        const r = 6.2 * px;
        shadow(r);
        g.rect(x - r, y - r, 2 * r, 2 * r).fill({ color: TOWN_FILL }).stroke({ width: 1.5 * px, color: MAP_INK });
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) g.rect(x + dx * r - 1.8 * px, y + dy * r - 1.8 * px, 3.6 * px, 3.6 * px).fill({ color: MAP_INK });
        g.circle(x, y, r * 0.35).fill({ color: MAP_INK });
        break;
      }
      case "ville":
        shadow(5 * px);
        g.circle(x, y, 5 * px).fill({ color: TOWN_FILL }).stroke({ width: 1.4 * px, color: MAP_INK });
        g.circle(x, y, 2.2 * px).fill({ color: MAP_INK });
        break;
      case "bourg":
        shadow(3.6 * px);
        g.circle(x, y, 3.6 * px).fill({ color: MAP_INK }).stroke({ width: 1.2 * px, color: TOWN_FILL });
        break;
      case "fort":
        g.poly([x, y - 5 * px, x + 5 * px, y, x, y + 5 * px, x - 5 * px, y]).fill({ color: TOWN_FILL }).stroke({ width: 1.4 * px, color: MAP_INK });
        g.rect(x - 1.6 * px, y - 1.6 * px, 3.2 * px, 3.2 * px).fill({ color: MAP_INK });
        break;
      default:
        g.circle(x, y, 2.2 * px).fill({ color: MAP_INK, alpha: 0.85 });
        break;
    }
  }
}

/** Brouillard de guerre (E-UX-3) : voile léger, sans mention ; l'inconnu est voilé et perd son détail. */
export function drawVeil(g: Graphics, polygon: readonly Point[], level: "inexplore" | "partielle"): void {
  g.poly(flat(polygon)).fill({ color: 0xdde3e6, alpha: level === "inexplore" ? 0.42 : 0.2 });
}

/** Rayon de la ligne médiane d'un mur au relèvement donné (étiquettes courbes). */
export function wallRadiusAt(t: TerrainData, wall: string, bearing: number): number {
  const w = t.walls.find((x) => x.wall === wall);
  if (!w) return 0;
  const i = Math.round((((bearing % 360) + 360) % 360) / (360 / w.line.length)) % w.line.length;
  const p = w.line[i] as Point;
  return Math.hypot(p[0], p[1]);
}
