import type { StyleProfile } from "../../data/artSchemas";
import type { EnvData, Landmark, Paving, Prop, StyledBuilding, View } from "./envTypes";
import { add2, chaikin, dist2, lerp2, nearestOnPath, norm2, pointAt, resample, rot2, scale2, sub2, v2 } from "./geom2";
import type { Vec2 } from "./geom2";
import { derive, range, seeded } from "./rng";
import type { Rand } from "./rng";
import { styleBuilding, styleLandmark } from "./styling";
import type { Variant } from "./styles";
import { WALLS, groundHex } from "./styles";
import { salient, translatePaths, wallCannons, wallLayout } from "./envWall";
import { generateTerrain, heightAt, slopeAt } from "./terrain";
import type { Road, TerrainData, TerrainSpec } from "./terrain";
import { footprint, overlaps } from "./town";
import type { Building } from "./town";

/**
 * Campagne et villages (R1b.2) : terrain du profil, fermes à cour, village à plan organique le long de la route, chapelle,
 * moulin, enclos, potagers, accessoires du profil. Calcul pur.
 */
export const TERRAIN_SIZE = 1600;

export function terrainSpecFor(p: StyleProfile, o: { size?: number; n?: number; clear?: { c: Vec2; r: number }[]; roadVia?: Vec2[]; farms?: number; roads?: boolean }): TerrainSpec {
  const v = p.vegetation;
  return {
    size: o.size ?? TERRAIN_SIZE,
    n: o.n ?? 257,
    type: p.terrain.type,
    relief: p.terrain.relief_m,
    water: p.terrain.eau,
    fields: v.champs,
    hedges: v.haies,
    orchards: v.vergers,
    forest: v.foret,
    trees: v.arbres,
    overgrowth: v.envahissement,
    farms: o.farms ?? 0,
    clear: o.clear ?? [],
    roadVia: o.roadVia ?? [v2(0, 0)],
    roads: o.roads ?? true,
  };
}

const has = (p: StyleProfile, k: string): boolean => (p.accessoires as readonly string[]).includes(k);

/** Accessoire posé au sol. */
export function prop(t: TerrainData | null, kind: string, at: Vec2, r: number, s: number, color: string): Prop {
  return { kind, x: at.x, y: at.y, z: t ? heightAt(t.heights, at.x, at.y) : 0, r, s, color };
}

function box(x: number, y: number, angle: number, width: number, depth: number, floors: number, floorHeight: number): Building {
  return { id: 0, block: -1, x, y, angle, width, depth, floors, floorHeight, roof: "pignon", pitch: 0.7, ridgeAlongFront: true, wall: 0, roofColor: 1, tint: 1, chimneys: [], bays: Math.max(1, Math.round(width / 3)), sideBays: Math.max(1, Math.round(depth / 3)) };
}

/** Clôture rectangulaire (enclos) : piquets et lisses, posés comme accessoires. */
function fenceRect(out: Prop[], t: TerrainData, c: Vec2, angle: number, w: number, d: number, color: string): void {
  const u = v2(Math.cos(angle), Math.sin(angle));
  const n = v2(-u.y, u.x);
  const corners = [add2(c, add2(scale2(u, -w / 2), scale2(n, -d / 2))), add2(c, add2(scale2(u, w / 2), scale2(n, -d / 2))), add2(c, add2(scale2(u, w / 2), scale2(n, d / 2))), add2(c, add2(scale2(u, -w / 2), scale2(n, d / 2)))];
  for (let i = 0; i < 4; i++) {
    const a = corners[i] as Vec2;
    const b = corners[(i + 1) % 4] as Vec2;
    const L = dist2(a, b);
    const steps = Math.max(1, Math.round(L / 3));
    const dir = Math.atan2(b.y - a.y, b.x - a.x);
    for (let k = 0; k < steps; k++) {
      // Un portail laissé ouvert sur le premier côté.
      if (i === 0 && k === Math.floor(steps / 2)) continue;
      out.push(prop(t, "clotures", lerp2(a, b, (k + 0.5) / steps), dir, L / steps / 3, color));
    }
  }
}

/** Ferme à cour : logis au fond, grange et étable sur les côtés, cour de terre battue, puits, charrette, meules. */
function farmstead(p: StyleProfile, rand: Rand, t: TerrainData, site: { c: Vec2; angle: number }, ruin: number, out: { b: StyledBuilding[]; props: Prop[]; paving: Paving[] }): void {
  const a = site.angle;
  const u = v2(Math.cos(a), Math.sin(a));
  const n = v2(-u.y, u.x);
  const yardW = range(rand, 18, 24);
  const yardD = range(rand, 14, 18);
  const parts: { off: Vec2; ang: number; w: number; d: number; floors: number; fh: number }[] = [
    { off: scale2(n, -yardD / 2 - 4.5), ang: a, w: range(rand, 11, 14), d: range(rand, 7, 8.5), floors: 2, fh: 3 },
    { off: scale2(u, -yardW / 2 - 6), ang: a + Math.PI / 2, w: range(rand, 15, 19), d: range(rand, 9, 11), floors: 1, fh: range(rand, 4.6, 5.6) },
  ];
  if (rand() < 0.7) parts.push({ off: scale2(u, yardW / 2 + 4), ang: a - Math.PI / 2, w: range(rand, 10, 13), d: range(rand, 6, 7), floors: 1, fh: 3.2 });
  for (const q of parts) {
    const c = add2(site.c, q.off);
    const b = box(c.x, c.y, q.ang, q.w, q.d, q.floors, q.fh);
    const sb = styleBuilding(b, p, rand, { hf: t.heights, ruin });
    // Les granges restent basses : on garde la hauteur de grange même si le profil impose plus d'étages.
    out.b.push({ ...sb, floors: q.floors, floorHeight: q.fh });
  }
  const yard = [add2(site.c, add2(scale2(u, -yardW / 2), scale2(n, -yardD / 2))), add2(site.c, add2(scale2(u, yardW / 2), scale2(n, -yardD / 2))), add2(site.c, add2(scale2(u, yardW / 2), scale2(n, yardD / 2))), add2(site.c, add2(scale2(u, -yardW / 2), scale2(n, yardD / 2)))];
  out.paving.push({ poly: yard, kind: "terre", y: heightAt(t.heights, site.c.x, site.c.y) + 0.06, color: groundHex(p, "route") });
  if (has(p, "puits")) out.props.push(prop(t, "puits", add2(site.c, scale2(u, yardW * 0.25)), a, 1, p.palette.pierre));
  if (has(p, "charrettes") || has(p, "charrettes_abandonnees")) out.props.push(prop(t, has(p, "charrettes") ? "charrettes" : "charrettes_abandonnees", add2(site.c, add2(scale2(u, -yardW * 0.2), scale2(n, yardD * 0.2))), a + range(rand, -0.6, 0.6), 1, p.palette.bois));
  if (has(p, "meules_de_foin")) for (let k = 0; k < 3; k++) out.props.push(prop(t, "meules_de_foin", add2(site.c, add2(scale2(u, -yardW / 2 - 16 - k * 5), scale2(n, range(rand, -6, 6)))), rand() * 6, range(rand, 0.85, 1.15), p.palette.toit));
  if (has(p, "abreuvoirs")) out.props.push(prop(t, "abreuvoirs", add2(site.c, scale2(n, yardD * 0.3)), a, 1, p.palette.bois));
  if (has(p, "clotures") || has(p, "enclos")) fenceRect(out.props, t, add2(site.c, scale2(n, yardD / 2 + 22)), a, range(rand, 30, 45), range(rand, 22, 30), p.palette.bois);
  if (has(p, "bois_empile")) out.props.push(prop(t, "bois_empile", add2(site.c, add2(scale2(u, yardW / 2 + 2), scale2(n, -yardD / 2 + 2))), a, 1, p.palette.bois));
}

/** Moulin à vent sur la hauteur la plus proche (ou moulin à eau au bord de la rivière). */
function placeMill(p: StyleProfile, rand: Rand, t: TerrainData, near: Vec2, avoid: (c: Vec2, r: number) => boolean, ruin: number): Landmark | null {
  let best: Vec2 | null = null;
  let bestH = -Infinity;
  for (let k = 0; k < 120; k++) {
    const c = add2(near, v2(range(rand, -320, 320), range(rand, -320, 320)));
    if (Math.abs(c.x) > TERRAIN_SIZE / 2 - 60 || Math.abs(c.y) > TERRAIN_SIZE / 2 - 60) continue;
    if (avoid(c, 12) || slopeAt(t.heights, c.x, c.y) > 0.15) continue;
    if (t.rivers.some((r) => nearestOnPath(r.path, c).d < r.width / 2 + 20)) continue;
    const h = heightAt(t.heights, c.x, c.y) - dist2(c, near) * 0.01;
    if (h > bestH) {
      bestH = h;
      best = c;
    }
  }
  if (!best) return null;
  return styleLandmark({ kind: "moulin", x: best.x, y: best.y, angle: rand() * Math.PI * 2, w: 7, d: 7, h: 12 }, p, t.heights, ruin);
}

export interface CountryOpts {
  ruin: number;
  abandoned: boolean;
}

/** Campagne pure, fermes isolées, lisières : terrain du profil et fermes. */
export function generateCountryside(p: StyleProfile, variant: Variant | null, seed: number, o: CountryOpts): Omit<EnvData, "id" | "seed" | "profile" | "variant" | "generator" | "views" | "radius" | "anchors" | "mist"> & { views: EnvData["views"] } {
  const rand = seeded(derive(seed, 40));
  const farmsN = Math.max(3, Math.min(16, Math.round(p.densite * 180)));
  const t = generateTerrain(seed, terrainSpecFor(p, { farms: farmsN, roadVia: [v2(range(rand, -150, 150), range(rand, -150, 150))] }));
  const out = { b: [] as StyledBuilding[], props: [] as Prop[], paving: [] as Paving[] };
  for (const f of t.farms) farmstead(p, rand, t, f, o.ruin, out);
  const landmarks: Landmark[] = [];
  if (has(p, "moulins")) {
    const m = placeMill(p, rand, t, t.farms[0]?.c ?? v2(0, 0), (c, r) => out.b.some((b) => dist2(c, b) < r + 15), o.ruin);
    if (m) landmarks.push(m);
  }
  roadside(p, rand, t, out.props);
  return { terrain: t, buildings: out.b, landmarks, props: out.props, paving: out.paving, canals: [], stoneBridges: [], wall: null, giants: [], shafts: [], cave: null, titans: [], fires: [], views: countryViews(t, rand, t.farms[0]?.c ?? v2(0, 0)) };
}

/** Bornes le long de la route principale, ponts. */
function roadside(p: StyleProfile, rand: Rand, t: TerrainData, props: Prop[]): void {
  const main = t.roads[0];
  if (!main) return;
  if (has(p, "bornes")) {
    for (let s = 60; s < main.path.length * 6; s += 200) {
      const { p: q, dir } = pointAt(main.path, s);
      props.push(prop(t, "bornes", add2(q, scale2(v2(-dir.y, dir.x), main.width / 2 + 1.2)), Math.atan2(dir.y, dir.x), 1, p.palette.pierre));
    }
  }
  void rand;
}

/** Vues de contrôle : de haut au-dessus du patchwork ; plus bas, le long de la rivière ou de la route. */
function countryViews(t: TerrainData, rand: Rand, focus: Vec2): EnvData["views"] {
  const h = (x: number, y: number): number => heightAt(t.heights, x, y);
  const ang = range(rand, 0, Math.PI * 2);
  const eye = add2(focus, v2(Math.cos(ang) * 420, Math.sin(ang) * 420));
  const principale: View = { eye: [eye.x, h(eye.x, eye.y) + 120, eye.y], target: [focus.x - Math.cos(ang) * 150, h(focus.x, focus.y), focus.y - Math.sin(ang) * 150], fov: 55 };
  const br = t.bridges[0];
  let seconde: View;
  if (br) {
    const d = v2(Math.cos(br.angle), Math.sin(br.angle));
    const e = add2(br.at, add2(scale2(d, -90), scale2(v2(-d.y, d.x), 40)));
    seconde = { eye: [e.x, h(e.x, e.y) + 18, e.y], target: [br.at.x, br.deck, br.at.y], fov: 55 };
  } else {
    const road = t.roads[0];
    const q = road ? pointAt(road.path, 300) : { p: focus, dir: v2(1, 0) };
    const e = add2(q.p, scale2(q.dir, -80));
    seconde = { eye: [e.x, h(e.x, e.y) + 16, e.y], target: [q.p.x + q.dir.x * 60, h(q.p.x, q.p.y) + 2, q.p.y + q.dir.y * 60], fov: 55 };
  }
  return { principale, seconde };
}

// ——— Village à plan organique ———

function laneFrom(rand: Rand, t: TerrainData, from: Vec2, dir: Vec2, length: number): Road {
  const pts: Vec2[] = [from];
  let d = dir;
  let p = from;
  for (let s = 0; s < length; s += 20) {
    d = norm2(rot2(d, range(rand, -0.35, 0.35)));
    p = add2(p, scale2(d, 20));
    pts.push(p);
  }
  void t;
  return { path: resample(chaikin(pts, 2), 5), width: 3.5, kind: "chemin" };
}

export interface VillageOpts extends CountryOpts {
  /** Rayon du village (m). */
  radius: number;
  /** Chapelle ou église simple au bord de la place. */
  chapel: boolean;
  /** Bâtiments larges en bois (faubourgs : entrepôts, écuries, relais). */
  suburb: boolean;
  /** Abords d'un district (E26) : la saillie du mur à cette distance au sud, la route passe par sa porte intérieure. */
  wallDistance?: number;
}

export function generateVillage(p: StyleProfile, variant: Variant | null, seed: number, o: VillageOpts): Omit<EnvData, "id" | "seed" | "profile" | "variant" | "generator" | "radius" | "anchors" | "mist"> {
  const rand = seeded(derive(seed, 41));
  const center = v2(0, 0);
  const farmsN = Math.max(2, Math.round(p.densite * 20));
  const wd = o.wallDistance;
  const t = generateTerrain(seed, wd !== undefined ? { ...terrainSpecFor(p, { farms: farmsN, clear: [{ c: center, r: o.radius }, { c: v2(0, wd + 40), r: 120 }], roadVia: [center, v2(0, wd - 20)] }), axis: "ns" } : terrainSpecFor(p, { farms: farmsN, clear: [{ c: center, r: o.radius }], roadVia: [center] }));
  const main = t.roads[0] as Road;
  const lanes: Road[] = [];
  const at = nearestOnPath(main.path, center);
  const mainDir = pointAt(main.path, at.s).dir;
  const nLanes = 3 + Math.round(p.densite * 5);
  for (let k = 0; k < nLanes; k++) {
    const s = at.s + range(rand, -o.radius * 0.7, o.radius * 0.7);
    const q = pointAt(main.path, s);
    const side = k % 2 === 0 ? 1 : -1;
    const d = rot2(q.dir, side * range(rand, 1.1, 1.9));
    lanes.push(laneFrom(rand, t, q.p, d, range(rand, o.radius * 0.5, o.radius * 0.95)));
  }
  t.roads.push(...lanes);
  const buildings: StyledBuilding[] = [];
  const props: Prop[] = [];
  const paving: Paving[] = [];
  const landmarks: Landmark[] = [];
  const roads = [main, ...lanes];
  const clearOfRoads = (b: Building): boolean => footprint(b).every((c) => roads.every((r) => nearestOnPath(r.path, c).d > r.width / 2 + 1.2));
  const clearOfOthers = (b: Building, extra: Building[] = []): boolean => !buildings.some((o2) => overlaps(footprint(o2), footprint(b), -1.2)) && !extra.some((o2) => overlaps(footprint(o2), footprint(b), -1.2));
  // Place : un élargissement de la route au centre, un puits ; la chapelle au bord.
  const plazaR = 16 + p.densite * 20;
  paving.push({ poly: Array.from({ length: 18 }, (_, k) => add2(at.p, v2(Math.cos((k / 18) * Math.PI * 2) * plazaR * (1 + 0.15 * Math.sin(k * 1.7)), Math.sin((k / 18) * Math.PI * 2) * plazaR))), kind: o.suburb ? "terre" : "dalle", y: heightAt(t.heights, at.p.x, at.p.y) + 0.07, color: p.palette.pierre });
  if (has(p, "puits")) props.push(prop(t, "puits", add2(at.p, v2(3, 2)), 0, 1, p.palette.pierre));
  if (o.chapel) {
    const n = v2(-mainDir.y, mainDir.x);
    const c = add2(at.p, scale2(n, plazaR + 9));
    const ch = styleLandmark({ kind: "chapelle", x: c.x, y: c.y, angle: Math.atan2(mainDir.y, mainDir.x) + Math.PI, w: 9, d: 16, h: 8 }, p, t.heights, o.ruin > 0.5 ? o.ruin : 0);
    landmarks.push(ch);
  }
  const landmarkBoxes = (): Building[] => landmarks.map((l) => box(l.x, l.y, l.angle, l.w + 2, l.d + 2, 1, 3));
  // Maisons le long des routes, des deux côtés, façade sur la rue.
  for (const r of roads) {
    const len = r.path.length * 5;
    for (const side of [1, -1]) {
      let s = range(rand, 0, 6);
      while (s < len) {
        const q = pointAt(r.path, s);
        if (dist2(q.p, center) > o.radius) {
          s += 8;
          continue;
        }
        const w = o.suburb && rand() < 0.4 ? range(rand, 14, 22) : range(rand, 7, 12);
        const d = o.suburb ? range(rand, 8, 12) : range(rand, 6, 9);
        const setback = r.width / 2 + range(rand, 1.8, 6) + d / 2;
        const n = v2(-q.dir.y, q.dir.x);
        const c = add2(q.p, scale2(n, side * setback));
        const b = box(c.x, c.y, Math.atan2(q.dir.y, q.dir.x) + (side > 0 ? Math.PI : 0), w, d, 1 + (rand() < 0.45 ? 1 : 0), range(rand, 2.8, 3.2));
        // Densité : des trous dans la rue, plus nombreux en bordure du village.
        const edge = dist2(q.p, center) / o.radius;
        if (rand() < 0.06 + 0.45 * edge * edge * (1 - p.densite) || dist2(c, at.p) < plazaR + d) {
          s += w + range(rand, 4, 12);
          continue;
        }
        if (clearOfRoads(b) && clearOfOthers(b, landmarkBoxes()) && !t.rivers.some((rv) => nearestOnPath(rv.path, c).d < rv.width / 2 + 10)) {
          buildings.push({ ...styleBuilding(b, p, rand, { hf: t.heights, ruin: o.ruin }), id: buildings.length });
          // Jardin derrière la maison.
          if (has(p, "potagers") && rand() < 0.5) {
            const g = add2(c, scale2(n, side * (d / 2 + 6)));
            const gu = q.dir;
            paving.push({ poly: [add2(g, add2(scale2(gu, -w / 2), scale2(n, -4))), add2(g, add2(scale2(gu, w / 2), scale2(n, -4))), add2(g, add2(scale2(gu, w / 2), scale2(n, 4))), add2(g, add2(scale2(gu, -w / 2), scale2(n, 4)))], kind: "terre", y: heightAt(t.heights, g.x, g.y) + 0.05, color: groundHex(p, "potager", 0.4) });
          }
          s += w + range(rand, 1.2, 4.5);
        } else s += 3;
      }
    }
  }
  // Accessoires du village.
  if (has(p, "charrettes") || has(p, "charrettes_abandonnees")) for (let k = 0; k < 4; k++) {
    const r = roads[k % roads.length] as Road;
    const q = pointAt(r.path, range(rand, 10, r.path.length * 4));
    props.push(prop(t, has(p, "charrettes") ? "charrettes" : "charrettes_abandonnees", add2(q.p, scale2(v2(-q.dir.y, q.dir.x), r.width / 2 + 1.2)), Math.atan2(q.dir.y, q.dir.x) + range(rand, -0.3, 0.3), 1, p.palette.bois));
  }
  if (has(p, "tonneaux")) for (const b of buildings.slice(0, 12)) props.push(prop(t, "tonneaux", add2(b, rot2(v2(b.width / 2 + 0.8, b.depth / 2 + 0.6), b.angle)), 0, 1, p.palette.bois));
  if (has(p, "abreuvoirs")) props.push(prop(t, "abreuvoirs", add2(at.p, v2(-5, 3)), Math.atan2(mainDir.y, mainDir.x), 1, p.palette.bois));
  if (has(p, "ecuries")) for (const b of buildings.filter((x) => x.width > 13).slice(0, 4)) props.push(prop(t, "ecuries", add2(b, rot2(v2(0, -b.depth / 2 - 3), b.angle)), b.angle, 1, p.palette.bois));
  if (has(p, "roues")) for (const b of buildings.slice(3, 9)) props.push(prop(t, "roues", add2(b, rot2(v2(b.width / 2 + 0.5, 0), b.angle)), b.angle, 1, p.palette.bois));
  if (has(p, "bois_empile")) for (const b of buildings.slice(9, 15)) props.push(prop(t, "bois_empile", add2(b, rot2(v2(-b.width / 2 - 1, 0), b.angle)), b.angle + Math.PI / 2, 1, p.palette.bois));
  const out = { b: buildings, props, paving };
  for (const f of t.farms) farmstead(p, rand, t, f, o.ruin, out);
  if (has(p, "moulins")) {
    const m = placeMill(p, rand, t, center, (c, r) => buildings.some((b) => dist2(c, b) < r + 12) || dist2(c, center) < o.radius * 0.6, o.ruin);
    if (m) landmarks.push(m);
  }
  if (has(p, "enclos") || has(p, "clotures")) for (let k = 0; k < 3; k++) {
    const a = range(rand, 0, Math.PI * 2);
    const c = add2(center, v2(Math.cos(a) * o.radius * 0.95, Math.sin(a) * o.radius * 0.95));
    if (!t.rivers.some((rv) => nearestOnPath(rv.path, c).d < 40) && !roads.some((r) => nearestOnPath(r.path, c).d < 25) && !buildings.some((b) => dist2(c, b) < 30)) fenceRect(props, t, c, a, range(rand, 25, 40), range(rand, 18, 28), p.palette.bois);
  }
  if (has(p, "meules_de_foin")) for (const pc of t.parcels.filter((x) => x.crop === "ble" || x.crop === "orge").slice(0, 6)) {
    const c = lerp2(pc.poly[0] as Vec2, pc.poly[2 % pc.poly.length] as Vec2, 0.5);
    props.push(prop(t, "meules_de_foin", c, rand() * 6, range(rand, 0.9, 1.2), p.palette.toit));
  }
  roadside(p, rand, t, props);
  // Vues : au-dessus du village, vers la place ; dans la rue principale, vers la chapelle.
  const h = (x: number, y: number): number => heightAt(t.heights, x, y);
  const back = sub2(at.p, scale2(rot2(mainDir, 0.9), 190));
  const chapel = landmarks.find((l) => l.kind === "chapelle");
  const streetEye = pointAt(main.path, at.s - o.radius * 0.8);
  const views: EnvData["views"] = {
    principale: { eye: [back.x, h(back.x, back.y) + 62, back.y], target: [at.p.x + mainDir.x * 30, h(at.p.x, at.p.y), at.p.y + mainDir.y * 30], fov: 55 },
    seconde: { eye: [streetEye.p.x, h(streetEye.p.x, streetEye.p.y) + 12, streetEye.p.y], target: chapel ? [chapel.x, chapel.base + 6, chapel.y] : [at.p.x, h(at.p.x, at.p.y) + 4, at.p.y], fov: 58 },
  };
  void variant;
  let wall: EnvData["wall"] = null;
  if (wd !== undefined) {
    // La saillie du district, au sud : ligne principale du mur à `wd` m, porte intérieure sur la route.
    wall = wallLayout(translatePaths(salient({ radius: WALLS.saillie_rayon_m.valeur, extent: t.spec.size / 2 - 10, outer: "fermee", inner: "ouverte" }), 0, wd));
    props.push(...wallCannons(wall, (q) => heightAt(t.heights, q.x, q.y), p.palette.bois));
    views.principale = { eye: [back.x - 40, h(back.x, back.y) + 55, back.y - 140], target: [at.p.x, 18, at.p.y + wd * 0.6], fov: 55 };
  }
  return { terrain: t, buildings, landmarks, props, paving, canals: [], stoneBridges: [], wall, giants: [], shafts: [], cave: null, titans: [], fires: [], views };
}
