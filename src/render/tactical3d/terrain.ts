import { add2, area, centroid, chaikin, clipHalfPlane, dist2, dot2, insetConvex, insidePoly, len2, lerp2, nearestOnPath, norm2, pathCrossings, pathLength, pointAt, resample, scale2, sub2, v2, voronoiCells } from "./geom2";
import type { Vec2 } from "./geom2";
import { clamp, fbm, gradientNoise, lerp, ridged, smoothstep } from "./noise";
import type { Noise2 } from "./noise";
import { derive, range, seeded, weighted } from "./rng";
import type { Rand } from "./rng";

/**
 * Terrain des environnements (R1b.2) : calcul pur, testé dans `tests/render/tactical3d/terrain.test.ts`.
 * - Relief par bruit : plaine, collines, montagne (crêtes), côte (falaises et plage).
 * - Eau : rivière méandreuse au lit creusé et au niveau toujours descendant, lac, marais, mer.
 * - Routes de terre (principale et chemins vers les fermes), ponts aux croisements de la rivière.
 * - Champs en patchwork : cellules de Voronoï découpées en lanières, séparées de marges ; haies sur les bords de cellule.
 * - Vergers en rangs, forêts (masque de bruit), arbres isolés, sites de fermes.
 * Les densités viennent du profil de style (`data/art/styles.json`) par `TerrainSpec`.
 */
export type TerrainType = "plat" | "collines" | "riviere" | "canaux" | "montagne" | "cote" | "souterrain";
export type WaterKind = "aucune" | "riviere" | "lac" | "riviere_lac" | "canaux" | "marais" | "mer";
export type Crop = "ble" | "orge" | "jachere" | "labour" | "prairie" | "potager" | "verger";
export const CROPS: readonly Crop[] = ["ble", "orge", "jachere", "labour", "prairie", "potager", "verger"];
export type TreeKind = "feuillu" | "conifere" | "fruitier" | "mort" | "buisson";

export interface Zone {
  c: Vec2;
  r: number;
}

export interface TerrainSpec {
  /** Côté du carré de terrain (m), centré sur l'origine. */
  size: number;
  /** Sommets par côté de la grille d'altitude. */
  n: number;
  type: TerrainType;
  /** Amplitude du relief (m). */
  relief: number;
  water: WaterKind;
  /** Parts du profil (0–1). */
  fields: number;
  hedges: number;
  orchards: number;
  forest: number;
  trees: number;
  overgrowth: number;
  /** Fermes isolées à placer. */
  farms: number;
  /** Zones aplanies et laissées libres (village, ville, place) : ni champ, ni forêt. */
  clear: Zone[];
  /** Points par lesquels passe la route principale (centre du village, porte). */
  roadVia: Vec2[];
  /** Pas de route (forêt profonde, lieux sans chemin). */
  roads: boolean;
  /** Sens de la route principale : est–ouest (par défaut) ou nord–sud (districts : de porte en porte). */
  axis?: "ew" | "ns";
}

export interface Heightfield {
  size: number;
  n: number;
  cell: number;
  h: Float32Array;
}
export interface River {
  path: Vec2[];
  width: number;
  /** Niveau de l'eau à chaque point du tracé (m), jamais croissant. */
  level: number[];
}
export interface Lake {
  center: Vec2;
  radius: number;
  level: number;
  shape: Vec2[];
}
export interface Road {
  path: Vec2[];
  width: number;
  kind: "route" | "chemin";
}
export interface Bridge {
  at: Vec2;
  /** Direction du tablier (radians, sens de la route). */
  angle: number;
  length: number;
  width: number;
  deck: number;
}
export interface Parcel {
  id: number;
  poly: Vec2[];
  crop: Crop;
  /** Direction des sillons (radians). */
  furrow: number;
}
export interface Hedge {
  a: Vec2;
  b: Vec2;
}
export interface TreeInst {
  x: number;
  y: number;
  /** Échelle (1 = arbre moyen de l'essence). */
  s: number;
  r: number;
  kind: TreeKind;
}
export interface FarmSite {
  c: Vec2;
  angle: number;
}

export interface TerrainData {
  spec: TerrainSpec;
  heights: Heightfield;
  rivers: River[];
  lakes: Lake[];
  /** Niveau de la mer (côte) ou de l'eau du marais ; null sinon. */
  seaLevel: number | null;
  marshLevel: number | null;
  /** Trait de côte (côte seulement), d'ouest en est. */
  coast: Vec2[];
  roads: Road[];
  bridges: Bridge[];
  parcels: Parcel[];
  hedges: Hedge[];
  trees: TreeInst[];
  farms: FarmSite[];
}

// ——— Grille d'altitude ———

export function hfIndex(hf: Heightfield, i: number, j: number): number {
  return j * hf.n + i;
}

/** Altitude interpolée en (x, y), bornée au carré. */
export function heightAt(hf: Heightfield, x: number, y: number): number {
  const half = hf.size / 2;
  const fx = clamp((x + half) / hf.cell, 0, hf.n - 1.0001);
  const fy = clamp((y + half) / hf.cell, 0, hf.n - 1.0001);
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const h = hf.h;
  const a = h[hfIndex(hf, i, j)] as number;
  const b = h[hfIndex(hf, i + 1, j)] as number;
  const c = h[hfIndex(hf, i, j + 1)] as number;
  const d = h[hfIndex(hf, i + 1, j + 1)] as number;
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

/** Pente locale (m/m) par différences finies. */
export function slopeAt(hf: Heightfield, x: number, y: number): number {
  const e = hf.cell;
  const dx = (heightAt(hf, x + e, y) - heightAt(hf, x - e, y)) / (2 * e);
  const dy = (heightAt(hf, x, y + e) - heightAt(hf, x, y - e)) / (2 * e);
  return Math.hypot(dx, dy);
}

/** Boîte englobante d'une polyligne, élargie de `m` : écarte vite les sommets lointains. */
function pathBox(path: readonly Vec2[], m: number): (x: number, y: number) => boolean {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of path) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return (x, y) => x >= x0 - m && x <= x1 + m && y >= y0 - m && y <= y1 + m;
}

function forEachVertex(hf: Heightfield, f: (x: number, y: number, k: number) => void): void {
  const half = hf.size / 2;
  for (let j = 0; j < hf.n; j++) {
    for (let i = 0; i < hf.n; i++) f(-half + i * hf.cell, -half + j * hf.cell, j * hf.n + i);
  }
}

function baseRelief(spec: TerrainSpec, noise: Noise2, noise2: Noise2, x: number, y: number): number {
  const R = spec.relief;
  switch (spec.type) {
    case "montagne": {
      const ridge = ridged(noise, x / 420, y / 420, 5);
      // Une gorge sinueuse traverse le massif du nord au sud.
      const gx = 60 * fbm(noise2, 0.3, y / 380, 3);
      const gorge = 1 - smoothstep(10, 70, Math.abs(x - gx));
      return R * (0.95 * ridge + 0.15 * fbm(noise2, x / 160, y / 160, 3)) - R * 0.55 * gorge - R * 0.25;
    }
    case "plat":
    case "canaux":
      return R * (0.6 * fbm(noise, x / 650, y / 650, 4) + 0.15 * fbm(noise2, x / 150, y / 150, 2));
    default:
      return R * (0.55 * fbm(noise, x / 560, y / 560, 5) + 0.22 * fbm(noise2, x / 220, y / 220, 3));
  }
}

// ——— Eau ———

function riverPath(rand: Rand, noise: Noise2, spec: TerrainSpec): Vec2[] {
  const half = spec.size / 2;
  // Nord → sud, en méandres ; elle évite le cœur des zones dégagées (le village est au bord de l'eau, pas dedans).
  const x0 = range(rand, -0.25, 0.25) * spec.size;
  const amp = range(rand, 70, 140);
  const waves = range(rand, 1.4, 2.4);
  const phase = rand() * Math.PI * 2;
  const pts: Vec2[] = [];
  for (let k = 0; k <= 60; k++) {
    const t = k / 60;
    const y = -half - 20 + t * (spec.size + 40);
    let x = x0 + amp * Math.sin(phase + t * Math.PI * 2 * waves) + 60 * fbm(noise, 3.1, t * 4, 3);
    for (const z of spec.clear) {
      const dy = y - z.c.y;
      if (Math.abs(dy) < z.r * 1.2) {
        const dx = x - z.c.x;
        const need = z.r * 0.95;
        if (Math.abs(dx) < need) x = z.c.x + Math.sign(dx || 1) * lerp(need, Math.abs(dx), smoothstep(z.r * 0.6, z.r * 1.2, Math.abs(dy)));
      }
    }
    pts.push(v2(x, y));
  }
  return resample(chaikin(pts, 2), 8);
}

function carveRiver(hf: Heightfield, river: Omit<River, "level">): River {
  // Niveau : altitude du terrain le long du tracé, lissée puis rendue décroissante, 1,2 m sous le sol.
  const raw = river.path.map((p) => heightAt(hf, p.x, p.y));
  const smooth = raw.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = -6; k <= 6; k++) {
      const v = raw[i + k];
      if (v !== undefined) {
        s += v;
        n++;
      }
    }
    return s / n;
  });
  const level: number[] = [];
  smooth.forEach((v, i) => level.push(Math.min(v - 1.2, i > 0 ? (level[i - 1] as number) - 0.02 : v - 1.2)));
  const L = pathLength(river.path);
  const w = river.width / 2;
  const bank = 26;
  const inBox = pathBox(river.path, w + bank);
  forEachVertex(hf, (x, y, k) => {
    if (!inBox(x, y)) return;
    const near = nearestOnPath(river.path, v2(x, y));
    if (near.d > w + bank) return;
    const idx = Math.min(level.length - 1, Math.round((near.s / (L || 1)) * (level.length - 1)));
    const lv = level[idx] as number;
    const h = hf.h[k] as number;
    if (near.d < w) {
      hf.h[k] = lv - 0.4 - 2.2 * (1 - (near.d / w) ** 2);
    } else {
      // Berges : du bord de l'eau (0,5 m au-dessus) au terrain d'origine, sans jamais descendre sous l'eau.
      const t = smoothstep(w, w + bank, near.d);
      hf.h[k] = Math.max(lv + 0.35, lerp(lv + 0.5, Math.max(h, lv + 0.5), t));
    }
  });
  return { ...river, level };
}

function carveLake(hf: Heightfield, rand: Rand, center: Vec2, radius: number): Lake {
  const shape: Vec2[] = [];
  const lobes = range(rand, 0.12, 0.25);
  const ph = rand() * 6;
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    const r = radius * (1 + lobes * Math.sin(a * 3 + ph) + 0.08 * Math.sin(a * 7 + ph * 2));
    shape.push(add2(center, v2(Math.cos(a) * r, Math.sin(a) * r)));
  }
  let low = Infinity;
  for (const p of shape) low = Math.min(low, heightAt(hf, p.x, p.y));
  const level = low - 0.6;
  forEachVertex(hf, (x, y, k) => {
    const d = dist2(v2(x, y), center);
    const a = Math.atan2(y - center.y, x - center.x);
    const r = radius * (1 + lobes * Math.sin(a * 3 + ph) + 0.08 * Math.sin(a * 7 + ph * 2));
    const h = hf.h[k] as number;
    if (d < r) hf.h[k] = level - 0.5 - 3.5 * (1 - (d / r) ** 2);
    else if (d < r + 30) hf.h[k] = Math.max(level + 0.3, lerp(level + 0.45, Math.max(h, level + 0.45), smoothstep(r, r + 30, d)));
  });
  return { center, radius, level, shape };
}

// ——— Routes ———

function roadThrough(rand: Rand, noise: Noise2, spec: TerrainSpec): Vec2[] {
  if (spec.axis === "ns") {
    // Nord–sud par les points imposés (portes d'un district), sans détour : la route passe les portes.
    const half = spec.size / 2;
    const via = [...spec.roadVia].sort((a, b) => a.y - b.y);
    const pts = [v2((via[0]?.x ?? 0) + range(rand, -40, 40), -half - 30), ...via, v2((via[via.length - 1]?.x ?? 0) + range(rand, -60, 60), half + 30)];
    return resample(chaikin(pts, 3), 6);
  }
  const half = spec.size / 2;
  const via = [...spec.roadVia].sort((a, b) => a.x - b.x);
  const y0 = range(rand, -0.2, 0.2) * spec.size;
  const ctrl: Vec2[] = [v2(-half - 30, y0)];
  for (const p of via) ctrl.push(p);
  ctrl.push(v2(half + 30, (via[via.length - 1]?.y ?? y0) + range(rand, -0.25, 0.25) * spec.size));
  // Points intermédiaires déviés par le bruit : la route épouse le pays.
  const pts: Vec2[] = [];
  for (let i = 0; i + 1 < ctrl.length; i++) {
    const a = ctrl[i] as Vec2;
    const b = ctrl[i + 1] as Vec2;
    const steps = Math.max(2, Math.round(dist2(a, b) / 90));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const p = lerp2(a, b, t);
      const n = norm2(v2(-(b.y - a.y), b.x - a.x));
      const bend = k === 0 ? 0 : 35 * fbm(noise, p.x / 300 + 7, p.y / 300, 3) * Math.sin(Math.PI * t);
      pts.push(add2(p, scale2(n, bend)));
    }
  }
  pts.push(ctrl[ctrl.length - 1] as Vec2);
  return resample(chaikin(pts, 3), 6);
}

function flattenRoad(hf: Heightfield, road: Road): void {
  const L = pathLength(road.path);
  const samples = road.path.map((p) => heightAt(hf, p.x, p.y));
  const smooth = samples.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = -8; k <= 8; k++) {
      const v = samples[i + k];
      if (v !== undefined) {
        s += v;
        n++;
      }
    }
    return s / n;
  });
  const half = road.width / 2;
  const inBox = pathBox(road.path, half + 10);
  forEachVertex(hf, (x, y, k) => {
    if (!inBox(x, y)) return;
    const near = nearestOnPath(road.path, v2(x, y));
    if (near.d > half + 10) return;
    const idx = Math.min(smooth.length - 1, Math.round((near.s / (L || 1)) * (smooth.length - 1)));
    const target = smooth[idx] as number;
    const t = 1 - smoothstep(half, half + 10, near.d);
    hf.h[k] = lerp(hf.h[k] as number, target + 0.05, t);
  });
}

// ——— Génération ———

export function generateTerrain(seed: number, spec: TerrainSpec): TerrainData {
  const rand = seeded(derive(seed, 20));
  const noise = gradientNoise(derive(seed, 21));
  const noise2 = gradientNoise(derive(seed, 22));
  const n = spec.n;
  const hf: Heightfield = { size: spec.size, n, cell: spec.size / (n - 1), h: new Float32Array(n * n) };
  const half = spec.size / 2;

  // 1. Relief, côte, zones aplanies.
  const coast: Vec2[] = [];
  let seaLevel: number | null = null;
  const coastY = (x: number): number => half * 0.18 + 70 * fbm(noise2, x / 380, 2.7, 3);
  if (spec.type === "cote") {
    seaLevel = 0;
    for (let k = 0; k <= 64; k++) {
      const x = -half + (k / 64) * spec.size;
      coast.push(v2(x, coastY(x)));
    }
  }
  forEachVertex(hf, (x, y, k) => {
    let h = baseRelief(spec, noise, noise2, x, y);
    if (spec.type === "cote") {
      // Falaise à l'ouest, plage à l'est (mélange par le bruit) ; la mer au sud du trait de côte.
      const cliff = smoothstep(-0.15, 0.25, fbm(noise, x / 520 + 3, 1.3, 2));
      const land = spec.relief * (0.45 + 0.3 * fbm(noise, x / 300, y / 300, 3)) * cliff + 2.5 * (1 - cliff) + Math.max(0, h * 0.3);
      const dy = y - coastY(x);
      const edge = lerp(18, 4, cliff);
      if (dy < -edge) h = land;
      else if (dy < 0) h = lerp(land, cliff > 0.5 ? 1.2 : 1.6, smoothstep(-edge, 0, dy));
      else h = lerp(cliff > 0.5 ? 0.4 : 1.4, -9, smoothstep(0, cliff > 0.5 ? 25 : 90, dy));
    }
    for (const z of spec.clear) {
      const d = dist2(v2(x, y), z.c);
      if (d < z.r * 1.6) h = lerp(h, 0, 1 - smoothstep(z.r * 0.7, z.r * 1.6, d));
    }
    hf.h[k] = h;
  });

  // 2. Eau.
  const rivers: River[] = [];
  const lakes: Lake[] = [];
  let marshLevel: number | null = null;
  if (spec.water === "riviere" || spec.water === "riviere_lac" || spec.type === "montagne") {
    const path = riverPath(rand, noise, spec);
    rivers.push(carveRiver(hf, { path, width: spec.type === "montagne" ? 10 : range(rand, 14, 22) }));
  }
  if (spec.water === "lac" || spec.water === "riviere_lac") {
    // Le lac se pose loin de la rivière et des zones dégagées.
    let best: Vec2 = v2(half * 0.45, -half * 0.4);
    let bestScore = -Infinity;
    for (let k = 0; k < 40; k++) {
      const c = v2(range(rand, -0.38, 0.38) * spec.size, range(rand, -0.38, 0.38) * spec.size);
      const dr = rivers.length > 0 ? nearestOnPath((rivers[0] as River).path, c).d : 999;
      const dz = Math.min(999, ...spec.clear.map((z) => dist2(c, z.c) - z.r));
      const score = Math.min(dr - 150, dz - 140) - heightAt(hf, c.x, c.y) * 2;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    lakes.push(carveLake(hf, rand, best, range(rand, 70, 120)));
  }
  if (spec.water === "marais") {
    // Terrain bas et presque plat, mares dans les creux : l'eau affleure partout où le sol passe sous son niveau.
    forEachVertex(hf, (x, y, k) => {
      hf.h[k] = (hf.h[k] as number) * 0.25 + 1.1 * fbm(noise2, x / 70, y / 70, 3);
    });
    marshLevel = 0.05;
    const path = riverPath(rand, noise, spec);
    rivers.push(carveRiver(hf, { path, width: range(rand, 22, 30) }));
  }

  // 3. Routes et ponts.
  const roads: Road[] = [];
  const bridges: Bridge[] = [];
  const farms: FarmSite[] = [];
  const wet = (p: Vec2, margin: number): boolean =>
    rivers.some((r) => nearestOnPath(r.path, p).d < r.width / 2 + margin) ||
    lakes.some((l) => insidePoly(l.shape, p) || dist2(p, l.center) < l.radius * 1.3 + margin) ||
    (seaLevel !== null && heightAt(hf, p.x, p.y) < 1.5 + margin * 0.05) ||
    (marshLevel !== null && heightAt(hf, p.x, p.y) < marshLevel + 0.3);
  if (spec.roads) {
    const main: Road = { path: roadThrough(rand, noise, spec), width: 5, kind: "route" };
    roads.push(main);
    // Fermes : sites secs, en pente douce, loin des zones dégagées et les unes des autres.
    for (let tries = 0; farms.length < spec.farms && tries < spec.farms * 60; tries++) {
      const c = v2(range(rand, -0.42, 0.42) * spec.size, range(rand, -0.42, 0.42) * spec.size);
      if (wet(c, 40) || slopeAt(hf, c.x, c.y) > 0.12) continue;
      if (spec.clear.some((z) => dist2(c, z.c) < z.r + 60)) continue;
      if (farms.some((f) => dist2(f.c, c) < 150)) continue;
      const near = nearestOnPath(main.path, c);
      if (near.d < 40) continue;
      farms.push({ c, angle: Math.atan2(near.p.y - c.y, near.p.x - c.x) + range(rand, -0.3, 0.3) });
    }
    for (const f of farms) {
      const near = nearestOnPath(main.path, f.c);
      const mid = add2(lerp2(f.c, near.p, 0.5), scale2(norm2(v2(-(near.p.y - f.c.y), near.p.x - f.c.x)), range(rand, -25, 25)));
      roads.push({ path: resample(chaikin([near.p, mid, f.c], 2), 6), width: 3, kind: "chemin" });
    }
    for (const r of roads) flattenRoad(hf, r);
    for (const r of rivers) {
      for (const road of roads) {
        for (const x of pathCrossings(road.path, r.path)) {
          const a = road.path[x.i] as Vec2;
          const b = road.path[x.i + 1] as Vec2;
          const lv = r.level[Math.min(r.level.length - 1, x.j)] as number;
          bridges.push({ at: x.at, angle: Math.atan2(b.y - a.y, b.x - a.x), length: r.width + 14, width: road.width + 1.5, deck: lv + 2.6 });
        }
      }
    }
  }

  // 4. Champs en patchwork.
  const parcels: Parcel[] = [];
  const hedges: Hedge[] = [];
  const onRoad = (p: Vec2, margin: number): boolean => roads.some((r) => nearestOnPath(r.path, p).d < r.width / 2 + margin);
  const forestMask = (p: Vec2): number => fbm(noise2, p.x / 330 + 11, p.y / 330 - 4, 4) + 0.35 * fbm(noise, p.x / 90, p.y / 90, 2) * 0.3;
  // Seuil tel que la part de terrain boisé suive la part « forêt » du profil (le bruit est à peu près centré).
  const forestCut = spec.forest <= 0 ? Infinity : 0.42 - spec.forest * 0.95;
  const inForest = (p: Vec2): boolean => forestMask(p) > forestCut;
  const blocked = (p: Vec2, margin: number): boolean =>
    wet(p, margin) ||
    spec.clear.some((z) => dist2(p, z.c) < z.r + margin) ||
    farms.some((f) => dist2(p, f.c) < 30 + margin) ||
    (spec.type === "montagne" && slopeAt(hf, p.x, p.y) > 0.35);
  if (spec.fields > 0) {
    const sites: Vec2[] = [];
    const step = 165;
    for (let gy = -half; gy < half; gy += step) {
      for (let gx = -half; gx < half; gx += step) sites.push(v2(gx + range(rand, 0.15, 0.85) * step, gy + range(rand, 0.15, 0.85) * step));
    }
    const cells = voronoiCells(sites, half, step * 3);
    const cropWeights = [0.26, 0.17, 0.09, 0.14, 0.24, 0.04, 0];
    cells.forEach((cell) => {
      if (cell.length < 3) return;
      const c = centroid(cell);
      if (rand() > spec.fields * 0.98 + 0.02) return;
      // Cellule : bords en haies (sauf ceux qui touchent l'eau, la forêt ou une zone dégagée).
      for (let i = 0; i < cell.length; i++) {
        const a = cell[i] as Vec2;
        const b = cell[(i + 1) % cell.length] as Vec2;
        const m = lerp2(a, b, 0.5);
        if (Math.abs(m.x) > half - 5 || Math.abs(m.y) > half - 5) continue;
        if (rand() < spec.hedges && !blocked(m, 6) && !inForest(m) && !onRoad(m, 4)) hedges.push({ a, b });
      }
      // Lanières parallèles, d'une direction propre à la cellule.
      const ang = rand() * Math.PI;
      const nrm = v2(-Math.sin(ang), Math.cos(ang));
      const proj = cell.map((p) => dot2(nrm, p));
      const lo = Math.min(...proj);
      const hi = Math.max(...proj);
      let t = lo;
      while (t < hi - 8) {
        const w = Math.min(hi - t, range(rand, 26, 58));
        let strip = clipHalfPlane(cell, nrm, t);
        strip = clipHalfPlane(strip, scale2(nrm, -1), -(t + w));
        t += w;
        strip = insetConvex(strip, 2.2);
        if (strip.length < 3 || Math.abs(area(strip)) < 500) continue;
        const sc = centroid(strip);
        if (strip.some((p) => blocked(p, 4)) || blocked(sc, 10) || inForest(sc) || onRoad(sc, 6) || strip.some((p) => onRoad(p, 1.5))) continue;
        const nearVillage = spec.clear.some((z) => dist2(sc, z.c) < z.r + 160);
        const w2 = [...cropWeights];
        if (nearVillage) w2[5] = 0.3;
        w2[6] = spec.orchards * 0.35;
        const crop = CROPS[weighted(rand, w2)] as Crop;
        parcels.push({ id: parcels.length, poly: strip, crop, furrow: ang + Math.PI / 2 });
      }
      void c;
    });
  }

  // 5. Arbres : forêts, vergers en rangs, arbres de haie, arbres isolés.
  const trees: TreeInst[] = [];
  const treeRand = seeded(derive(seed, 23));
  const conifer = spec.type === "montagne" ? 0.75 : 0.18;
  if (spec.forest > 0) {
    const sp = 8.5;
    for (let gy = -half + 4; gy < half; gy += sp) {
      for (let gx = -half + 4; gx < half; gx += sp) {
        const p = v2(gx + range(treeRand, -3.4, 3.4), gy + range(treeRand, -3.4, 3.4));
        if (!inForest(p) || blocked(p, 3) || onRoad(p, 3)) continue;
        if (parcels.length > 0 && treeRand() < 0.02) continue;
        const edge = forestMask(p) - forestCut;
        // En lisière, les arbres s'éclaircissent.
        if (edge < 0.06 && treeRand() > edge / 0.06) continue;
        trees.push({ x: p.x, y: p.y, s: range(treeRand, 0.75, 1.3), r: treeRand() * Math.PI * 2, kind: treeRand() < conifer ? "conifere" : spec.overgrowth > 0.6 && treeRand() < 0.15 ? "mort" : "feuillu" });
      }
    }
  }
  for (const pc of parcels) {
    if (pc.crop !== "verger") continue;
    const d = v2(Math.cos(pc.furrow), Math.sin(pc.furrow));
    const nrm = v2(-d.y, d.x);
    const c = centroid(pc.poly);
    for (let a = -120; a <= 120; a += 7) {
      for (let b = -120; b <= 120; b += 7) {
        const p = add2(c, add2(scale2(d, a), scale2(nrm, b)));
        if (insidePoly(insetConvex(pc.poly, 3), p)) trees.push({ x: p.x, y: p.y, s: range(treeRand, 0.85, 1.1), r: treeRand() * 6.28, kind: "fruitier" });
      }
    }
  }
  for (const hd of hedges) {
    const L = dist2(hd.a, hd.b);
    for (let s = range(treeRand, 10, 40); s < L - 5; s += range(treeRand, 30, 90)) {
      if (treeRand() > 0.55) continue;
      const p = lerp2(hd.a, hd.b, s / L);
      trees.push({ x: p.x, y: p.y, s: range(treeRand, 0.9, 1.35), r: treeRand() * 6.28, kind: "feuillu" });
    }
  }
  const isolated = Math.round(spec.trees * 140);
  for (let k = 0; k < isolated; k++) {
    const p = v2(range(treeRand, -0.48, 0.48) * spec.size, range(treeRand, -0.48, 0.48) * spec.size);
    if (blocked(p, 4) || onRoad(p, 4) || parcels.some((pc) => insidePoly(pc.poly, p))) continue;
    trees.push({ x: p.x, y: p.y, s: range(treeRand, 0.8, 1.4), r: treeRand() * 6.28, kind: treeRand() < 0.25 ? "buisson" : treeRand() < conifer ? "conifere" : "feuillu" });
  }
  // Végétation envahissante (territoire des Titans) : buissons et broussailles partout où rien ne pousse.
  const brush = Math.round(spec.overgrowth * 1400);
  for (let k = 0; k < brush; k++) {
    const p = v2(range(treeRand, -0.48, 0.48) * spec.size, range(treeRand, -0.48, 0.48) * spec.size);
    if (wet(p, 2) || onRoad(p, 2)) continue;
    trees.push({ x: p.x, y: p.y, s: range(treeRand, 0.5, 1.2), r: treeRand() * 6.28, kind: "buisson" });
  }

  return { spec, heights: hf, rivers, lakes, seaLevel, marshLevel, coast, roads, bridges, parcels, hedges, trees, farms };
}

/** Mesures du terrain pour les tests et le rapport. */
export function terrainStats(t: TerrainData): Record<string, number> {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of t.heights.h) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const crops = new Set(t.parcels.map((p) => p.crop));
  return {
    relief: hi - lo,
    rivers: t.rivers.length,
    lakes: t.lakes.length,
    roads: t.roads.length,
    roadLength: t.roads.reduce((s, r) => s + pathLength(r.path), 0),
    bridges: t.bridges.length,
    parcels: t.parcels.length,
    cropKinds: crops.size,
    orchards: t.parcels.filter((p) => p.crop === "verger").length,
    hedges: t.hedges.length,
    hedgeLength: t.hedges.reduce((s, h) => s + dist2(h.a, h.b), 0),
    trees: t.trees.length,
    farms: t.farms.length,
    fieldArea: t.parcels.reduce((s, p) => s + Math.abs(area(p.poly)), 0),
  };
}

export { len2, pointAt, sub2 };
