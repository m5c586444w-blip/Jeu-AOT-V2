import type { StyleProfile } from "../../data/artSchemas";
import type { EnvBody } from "./envTown";
import type { Prop, TitanPlacement, WallGate, WallLayout, WallPath } from "./envTypes";
import type { Variant } from "./styles";
import { dist2, nearestOnPath, pathLength, pointAt, resample, v2 } from "./geom2";
import type { Vec2 } from "./geom2";
import { WALLS } from "./styles";
import { terrainSpecFor } from "./envCountry";
import { styleLandmark } from "./styling";
import { generateTerrain, heightAt } from "./terrain";

/**
 * Tracé des murs de R1b (R1b.4) : calcul pur. Hauteur 50 m (C), épaisseur et teinte « ? » (`data/art/murs.json`), porte massive,
 * chemin de ronde, canons sur rails espacés selon les données, brèches.
 * - Saillie de district : la ligne principale du mur (ouest → est, à y = 0, l'extérieur au sud) et un demi-cercle de rayon R
 *   qui avance vers le sud (porte extérieure à sa pointe, porte intérieure dans la ligne principale).
 * - Mur droit : un pan de mur avec une porte (E22, camps de réfugiés devant Rose).
 */
export function wallLayout(paths: WallPath[]): WallLayout {
  return {
    paths,
    height: WALLS.hauteur_m.valeur,
    thickness: WALLS.epaisseur_m.valeur,
    tint: WALLS.teinte.valeur,
    walkway: WALLS.chemin_de_ronde_m.valeur,
    parapet: WALLS.parapet_m.valeur,
    railLength: WALLS.rail_longueur_m.valeur,
    railGauge: WALLS.rail_ecartement_m.valeur,
    gateWidth: WALLS.porte_largeur_m.valeur,
    gateHeight: WALLS.porte_hauteur_m.valeur,
    block: WALLS.bloc_m.valeur,
  };
}

/** Canons tous les `canon_espacement_m`, à l'écart des portes et des brèches, dans la partie [s0, s1] du tracé. */
export function cannonsAlong(path: readonly Vec2[], gates: readonly WallGate[], breaches: readonly { s: number; width: number }[], s0 = 0, s1 = Infinity): number[] {
  const L = Math.min(pathLength(path), s1);
  const step = WALLS.canon_espacement_m.valeur;
  const out: number[] = [];
  for (let s = Math.max(s0, step / 2); s < L - 10; s += step) {
    if (gates.some((g) => Math.abs(g.s - s) < WALLS.porte_largeur_m.valeur + 14)) continue;
    if (breaches.some((b) => Math.abs(b.s - s) < b.width / 2 + 12)) continue;
    out.push(s);
  }
  return out;
}

export interface SalientOpts {
  radius: number;
  /** Demi-longueur visible de la ligne principale (m). */
  extent: number;
  outer: WallGate["state"];
  inner: WallGate["state"];
  breaches?: { s: number; width: number; face: boolean }[];
}

export function salient(o: SalientOpts): WallPath[] {
  const main = resample([v2(-o.extent, 0), v2(o.extent, 0)], 12);
  const arc: Vec2[] = [];
  for (let k = 0; k <= 72; k++) {
    const a = Math.PI - (k / 72) * Math.PI;
    arc.push(v2(Math.cos(a) * o.radius, Math.sin(a) * o.radius));
  }
  const arcLen = pathLength(arc);
  const innerGate: WallGate = { s: o.extent, kind: "interieure", state: o.inner };
  const outerGate: WallGate = { s: arcLen / 2, kind: "exterieure", state: o.outer };
  const mainBreaches: { s: number; width: number; face: boolean }[] = [];
  const arcBreaches = o.breaches ?? [];
  return [
    { path: main, out: 1, gates: [innerGate], cannons: cannonsAlong(main, [innerGate], mainBreaches), breaches: mainBreaches },
    { path: arc, out: 1, gates: [outerGate], cannons: cannonsAlong(arc, [outerGate], arcBreaches), breaches: arcBreaches },
  ];
}

/** Pan de mur droit d'ouest en est à l'ordonnée `y`, l'extérieur au sud (`out` = 1) ou au nord (−1). */
export function straightWall(extent: number, y: number, out: 1 | -1, gates: WallGate[], breaches: { s: number; width: number; face: boolean; floor?: number }[] = []): WallPath {
  const path = resample([v2(-extent, y), v2(extent, y)], 12);
  return { path, out, gates, cannons: cannonsAlong(path, gates, breaches), breaches };
}

/** Déplace des tracés de mur (une saillie vue depuis ses abords). */
export function translatePaths(paths: WallPath[], dx: number, dy: number): WallPath[] {
  return paths.map((w) => ({ ...w, path: w.path.map((q) => v2(q.x + dx, q.y + dy)) }));
}

/** Point du tracé à l'abscisse `s`, direction et normale extérieure. */
export function wallFrame(w: WallPath, s: number): { p: Vec2; dir: Vec2; out: Vec2 } {
  const { p, dir } = pointAt(w.path, s);
  return { p, dir, out: v2(-dir.y * w.out, dir.x * w.out) };
}

/** Distance horizontale d'un point à l'axe du mur le plus proche (m). */
export function distanceToWall(layout: WallLayout, p: Vec2): number {
  return Math.min(...layout.paths.map((w) => nearestOnPath(w.path, p).d));
}

/** Points d'ancrage d'ODM sur le parement extérieur et intérieur, tous les 40 m, à mi-hauteur et sous le chemin de ronde. */
export function wallAnchors(layout: WallLayout, groundAt: (p: Vec2) => number): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  for (const w of layout.paths) {
    const L = pathLength(w.path);
    for (let s = 20; s < L; s += 40) {
      const f = wallFrame(w, s);
      for (const side of [1, -1]) {
        const q = v2(f.p.x + f.out.x * side * (layout.thickness / 2), f.p.y + f.out.y * side * (layout.thickness / 2));
        const g = groundAt(f.p);
        out.push({ x: q.x, y: q.y, z: g + layout.height * 0.5 }, { x: q.x, y: q.y, z: g + layout.height - 3 });
      }
    }
  }
  return out;
}

export { dist2 };

/** Canons du chemin de ronde, posés sur les rails, la volée vers l'extérieur. */
export function wallCannons(layout: WallLayout, groundAt: (p: Vec2) => number, color: string): Prop[] {
  const out: Prop[] = [];
  for (const w of layout.paths) {
    for (const s of w.cannons) {
      const f = wallFrame(w, s);
      out.push({ kind: "canons", x: f.p.x, y: f.p.y, z: groundAt(f.p) + layout.height + 0.2, r: Math.atan2(f.out.y, f.out.x), s: 1, color });
    }
  }
  return out;
}

// ——— E22 : le mur seul ———

/** Un pan de mur droit avec sa porte ; variante endommagée : une brèche qui révèle l'intérieur (visage d'un Titan-Mur). */
export function generateWallEnv(p: StyleProfile, variant: Variant | null, seed: number): EnvBody {
  const size = 1600;
  const extent = size / 2 - 10;
  const clear = Array.from({ length: 28 }, (_, k) => ({ c: v2(-extent + (k * 2 * extent) / 27, 0), r: 50 }));
  const t = generateTerrain(seed, { ...terrainSpecFor(p, { size, clear, roadVia: [v2(0, -40), v2(0, 40)], farms: 2 }), axis: "ns" });
  const damaged = variant?.special === "mur_endommage";
  // Brèche haute (le haut du mur arraché) : le visage du Titan-Mur apparaît (Mur Sina, partie B).
  const breaches = damaged ? [{ s: extent + 150, width: WALLS.breche_largeur_m.valeur, face: true, floor: WALLS.hauteur_m.valeur - 22 }] : [];
  const gate: WallGate = { s: extent, kind: "porte", state: "fermee" };
  const wall = wallLayout([straightWall(extent, 0, 1, [gate], breaches)]);
  const ground = (q: Vec2): number => heightAt(t.heights, q.x, q.y);
  const props = wallCannons(wall, ground, p.palette.bois);
  // Corps de garde au pied de la porte, côté intérieur ; caisses et drapeaux au pied du mur.
  const landmarks = [styleLandmark({ kind: "corps_de_garde", x: 30, y: -24, angle: 0, w: 14, d: 9, h: 7 }, p, t.heights)];
  for (let k = 0; k < 6; k++) props.push({ kind: "caisses", x: -24 + k * 4.5, y: -14, z: ground(v2(-24 + k * 4.5, -14)), r: 0, s: 1, color: p.palette.bois });
  props.push({ kind: "drapeaux", x: -12, y: -12, z: ground(v2(-12, -12)), r: 0, s: 1.4, color: p.palette.toit_2 });
  const titans: TitanPlacement[] = damaged ? [{ type: "titan_mur", variant: null, x: extent + 150 - extent, y: 0, angle: Math.PI, pose: "buste", seed }] : [];
  const top = WALLS.hauteur_m.valeur;
  const focus = damaged ? 75 : 0;
  return {
    terrain: t,
    buildings: [],
    landmarks,
    props,
    paving: [],
    canals: [],
    stoneBridges: [],
    wall,
    giants: [],
    shafts: [],
    cave: null,
    titans,
    fires: [],
    views: {
      principale: { eye: [focus - 150, ground(v2(focus - 150, -175)) + 38, -175], target: [focus + 30, 27, 0], fov: 55 },
      // Variante endommagée : la brèche vue de près, côté intérieur ; sinon, le chemin de ronde et ses canons.
      seconde: damaged ? { eye: [150 - 45, ground(v2(105, -70)) + 38, -70], target: [150, 38, 0], fov: 55 } : { eye: [-90, top + 4.2, -2.5], target: [70, top + 1, 0.5], fov: 55 },
    },
    radius: size / 2,
    anchors: wallAnchors(wall, ground),
  };
}
