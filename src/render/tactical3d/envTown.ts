import type { StyleProfile } from "../../data/artSchemas";
import { prop, terrainSpecFor } from "./envCountry";
import type { Canal, EnvData, Fire, Landmark, LandmarkKind, Paving, Prop, StyledBuilding, View, WallGate, WallLayout } from "./envTypes";
import { salient, wallAnchors, wallCannons, wallLayout } from "./envWall";
import { add2, centroid, dist2, lerp2, nearestOnPath, norm2, scale2, sub2, v2 } from "./geom2";
import type { Vec2 } from "./geom2";
import { derive, range, seeded } from "./rng";
import type { Rand } from "./rng";
import { styleBuilding, styleLandmark } from "./styling";
import type { Variant } from "./styles";
import { WALLS, groundHex } from "./styles";
import { clipRoads, generateTerrain, heightAt } from "./terrain";
import type { Bridge, TerrainData } from "./terrain";
import { generateTown, insideConvex } from "./town";
import type { Block, Town, TownOptions } from "./town";

/**
 * Villes par profil (R1b.3) : districts adossés à un mur (saillie, deux portes) et capitale. Le profil décide de tout :
 * disposition (organique, planifiée, quadrillée), largeur des rues, étages, matières, couvertures, densité, repères (église,
 * marché, casernes, grand édifice, cathédrale, palais), canaux et ponts, accessoires. Calcul pur.
 */
export type EnvBody = Omit<EnvData, "id" | "seed" | "profile" | "variant" | "generator" | "radius" | "anchors" | "mist"> & Partial<Pick<EnvData, "radius" | "anchors" | "mist">>;

const has = (p: StyleProfile, k: string): boolean => (p.accessoires as readonly string[]).includes(k);
const hasMark = (p: StyleProfile, k: string): boolean => p.batiments.reperes.includes(k);

/** Options du treillis selon la disposition du profil. */
export function layoutOptions(p: StyleProfile): Pick<TownOptions, "jitter" | "swirl" | "blockTurnDeg" | "blockMin" | "blockMax" | "streetMin" | "streetMax"> {
  const [s0, s1] = p.rues_m;
  switch (p.disposition) {
    case "quadrillee":
      return { jitter: 0, swirl: 0, blockTurnDeg: 0, blockMin: 50, blockMax: 58, streetMin: s0, streetMax: s1 };
    case "planifiee":
      return { jitter: 4, swirl: 0.0012, blockTurnDeg: 5, blockMin: 42, blockMax: 54, streetMin: s0, streetMax: s1 };
    default:
      return { jitter: 11, swirl: 0.004, blockTurnDeg: 18, blockMin: 30, blockMax: 44, streetMin: s0, streetMax: s1 };
  }
}

const blockCenter = (b: Block): Vec2 => centroid(b.inner);

/** Angle d'un repère dont la façade (+v) regarde `toward`. */
const facing = (from: Vec2, toward: Vec2): number => {
  const d = norm2(sub2(toward, from));
  return Math.atan2(-d.x, d.y);
};

interface TownBuild {
  p: StyleProfile;
  rand: Rand;
  t: TerrainData;
  town: Town;
  ruin: number;
  buildings: StyledBuilding[];
  landmarks: Landmark[];
  props: Prop[];
  paving: Paving[];
  canals: Canal[];
  bridges: Bridge[];
  fires: Fire[];
  /** Îlots déjà pris par un repère. */
  used: Set<number>;
}

function nearestBlock(b: TownBuild, at: Vec2, free = true): Block | null {
  let best: Block | null = null;
  let d = Infinity;
  for (const blk of b.town.blocks) {
    if (blk.outside || blk.plaza || (free && b.used.has(blk.id))) continue;
    const dd = dist2(blockCenter(blk), at);
    if (dd < d) {
      d = dd;
      best = blk;
    }
  }
  return best;
}

/** Remplace les maisons d'un îlot par un repère à sa taille, façade vers `toward`. */
function landmarkInBlock(b: TownBuild, blk: Block, kind: LandmarkKind, size: { w: number; d: number; h: number }, toward: Vec2): Landmark {
  b.used.add(blk.id);
  const c = blockCenter(blk);
  const xs = blk.inner.map((q) => q.x);
  const ys = blk.inner.map((q) => q.y);
  const span = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const w = Math.min(size.w, span * 0.82);
  const d = Math.min(size.d, span * 0.86);
  b.buildings = b.buildings.filter((x) => x.block !== blk.id);
  const l = styleLandmark({ kind, x: c.x, y: c.y, angle: facing(c, toward), w, d, h: size.h }, b.p, b.t.heights, b.ruin > 0.5 ? b.ruin : 0);
  b.landmarks.push(l);
  return l;
}

/** Accessoires de rue : réverbères aux coins d'îlots, lanternes, charrettes, tonneaux, linge, bancs. */
function streetProps(b: TownBuild): void {
  const p = b.p;
  const t = b.t;
  const rand = b.rand;
  for (const blk of b.town.blocks) {
    if (blk.outside) continue;
    const c = blockCenter(blk);
    blk.inner.forEach((q, i) => {
      if ((blk.id + i) % 2) return;
      const d = norm2(sub2(q, c));
      const at = add2(q, scale2(d, 1.3));
      if (has(p, "lampadaires")) b.props.push(prop(t, "lampadaires", at, 0, 1, p.palette.bois));
      else if (has(p, "lanternes")) b.props.push(prop(t, "lanternes", at, Math.atan2(d.y, d.x), 1, p.palette.bois));
    });
  }
  const pick = (n: number, kind: string, color: string, off: number): void => {
    for (let k = 0; k < n && b.buildings.length > 0; k++) {
      const h = b.buildings[Math.floor(rand() * b.buildings.length)] as StyledBuilding;
      const u = v2(Math.cos(h.angle), Math.sin(h.angle));
      const nrm = v2(-u.y, u.x);
      // Devant la façade (−v), dans la rue.
      const at = add2(v2(h.x, h.y), add2(scale2(nrm, -(h.depth / 2 + off)), scale2(u, range(rand, -h.width / 3, h.width / 3))));
      b.props.push(prop(t, kind, at, h.angle + range(rand, -0.2, 0.2), 1, color));
    }
  };
  const n = b.buildings.length;
  if (has(p, "charrettes")) pick(Math.round(n / 40), "charrettes", p.palette.bois, 2.2);
  if (has(p, "tonneaux")) pick(Math.round(n / 25), "tonneaux", p.palette.bois, 0.8);
  if (has(p, "caisses")) pick(Math.round(n / 30), "caisses", p.palette.bois, 0.8);
  if (has(p, "cordes_a_linge")) pick(Math.round(n / 50), "cordes_a_linge", p.palette.bois, 1.2);
  if (has(p, "bancs")) pick(Math.round(n / 45), "bancs", p.palette.bois, 1.2);
}

/** Place : fontaine, puits, étals, statue. */
function plazaProps(b: TownBuild): void {
  const p = b.p;
  const [a, s] = b.town.plaza.centers;
  if (a && has(p, "fontaines")) b.props.push(prop(b.t, "fontaines", a, 0, 1, p.palette.pierre));
  else if (a && has(p, "puits")) b.props.push(prop(b.t, "puits", a, 0, 1, p.palette.pierre));
  if (s && has(p, "etals")) {
    for (let k = 0; k < 10; k++) {
      const ang = (k / 10) * Math.PI * 2;
      const at = add2(s, v2(Math.cos(ang) * 14, Math.sin(ang) * 11));
      b.props.push(prop(b.t, "etals", at, ang + Math.PI / 2, 1, p.palette.bois));
    }
  }
  if (s && has(p, "statues")) b.props.push(prop(b.t, "statues", s, 0, 1, p.palette.pierre));
}

/** Ruines et incendies : gravats au pied des maisons arasées, feux sur une part d'entre elles. */
function ruinsAndFires(b: TownBuild, burning: boolean): void {
  for (const h of b.buildings) {
    if (h.ruin <= 0.55) continue;
    b.props.push(prop(b.t, "gravats", v2(h.x, h.y), h.angle, Math.max(0.8, h.width / 8), h.stoneHex));
    if (burning && b.rand() < 0.22) b.fires.push({ x: h.x, y: h.y, z: h.base + h.floors * h.floorHeight * 0.5, size: Math.max(3, h.width * 0.5) });
  }
}

/**
 * Pavés, rue par rue : un ruban par tronçon bordé d'au moins un îlot bâti (prolongé d'une demi-largeur pour couvrir les
 * carrefours), deux quais le long d'une rue à canal, les cours d'îlots et les places plus claires.
 */
function townPaving(b: TownBuild, canalStreets: ReadonlySet<number>, canalWidth: number): void {
  const p = b.p;
  const town = b.town;
  town.streets.forEach((st, idx) => {
    const sides = town.blocks.filter((blk) => blk.sides.includes(idx));
    if (!sides.some((blk) => !blk.outside)) return;
    const u = norm2(sub2(st.b, st.a));
    const n = v2(-u.y, u.x);
    const ext = st.width / 2;
    const a = sub2(st.a, scale2(u, ext));
    const c = add2(st.b, scale2(u, ext));
    const strip = (o0: number, o1: number): Vec2[] => [add2(a, scale2(n, o0)), add2(c, scale2(n, o0)), add2(c, scale2(n, o1)), add2(a, scale2(n, o1))];
    if (canalStreets.has(idx)) {
      b.paving.push({ poly: strip(-st.width / 2 - 1, -canalWidth / 2), kind: "pave", y: 0.06, color: p.palette.pierre });
      b.paving.push({ poly: strip(canalWidth / 2, st.width / 2 + 1), kind: "pave", y: 0.06, color: p.palette.pierre });
    } else b.paving.push({ poly: strip(-st.width / 2 - 1, st.width / 2 + 1), kind: "pave", y: 0.06, color: p.palette.pierre });
  });
  for (const blk of town.blocks) {
    if (blk.outside) continue;
    b.paving.push({ poly: [...blk.inner], kind: "dalle", y: 0.13, color: blk.plaza ? p.palette.facade : p.palette.pierre });
  }
}

/** Creuse le lit des canaux dans le terrain (les murs de quai et l'eau sont dessinés par le maillage). */
function carveCanals(t: TerrainData, canals: readonly Canal[]): void {
  const hf = t.heights;
  const half = hf.size / 2;
  for (let j = 0; j < hf.n; j++) {
    for (let i = 0; i < hf.n; i++) {
      const q = v2(-half + i * hf.cell, -half + j * hf.cell);
      for (const c of canals) {
        if (nearestOnPath(c.path, q).d < c.width / 2 + hf.cell * 0.75) hf.h[j * hf.n + i] = c.level - 1.2;
      }
    }
  }
}

/** Canal le long d'une rue horizontale `j` : lit d'eau, ponts de pierre aux croisements des rues verticales. */
const CANAL_WIDTH = 12;

function canalAlong(b: TownBuild, j: number, inside: (q: Vec2) => boolean, streets: Set<number>): void {
  const g = b.town.grid;
  const pts: Vec2[] = [];
  for (let i = 0; i <= g.cols; i++) {
    const q = (g.pts[i] as Vec2[])[j] as Vec2;
    if (inside(q)) {
      pts.push(q);
      if (i < g.cols && inside((g.pts[i + 1] as Vec2[])[j] as Vec2)) streets.add((g.h[j] as number[])[i] as number);
    }
  }
  if (pts.length < 2) return;
  const width = CANAL_WIDTH;
  b.canals.push({ path: pts, width, level: -2.4, quay: 0.05 });
  for (let k = 0; k < pts.length; k++) {
    const q = pts[k] as Vec2;
    const prev = pts[Math.max(0, k - 1)] as Vec2;
    const next = pts[Math.min(pts.length - 1, k + 1)] as Vec2;
    const along = norm2(sub2(next, prev));
    // Le pont suit la rue verticale : perpendiculaire au canal.
    b.bridges.push({ at: q, angle: Math.atan2(along.x, -along.y), length: width + 6, width: 9, deck: 0.35 });
  }
}

/**
 * Voie d'eau d'un district (R1c, Shiganshina : portes de rivière et barques d'évacuation, épisode 2 et carte du district, C ;
 * tracé A) : la rivière arrive de l'extérieur, franchit la saillie par une porte d'eau, traverse la ville à l'est de la rue
 * principale, ressort par une porte d'eau de la ligne principale, près de la porte intérieure, vers l'intérieur du mur.
 * Les maisons sur son lit sont retirées ; ponts aux croisements des rues ; barques et pontons côté porte intérieure.
 */
export const WATER_ROUTE = { arcAngle: Math.PI * 0.3, mainX: 0.36, width: 16, level: -2.4 };

function waterRoute(b: TownBuild, R: number, size: number): Canal {
  const a = WATER_ROUTE.arcAngle;
  const radial = v2(Math.cos(a), Math.sin(a));
  const gateArc = scale2(radial, R);
  const gateMain = v2(R * WATER_ROUTE.mainX, 0);
  // Courbe douce entre les deux portes, tirée vers l'est (jamais sur la rue principale, x = 0).
  const ctrl = v2(R * 0.62, R * 0.38);
  const inside: Vec2[] = [];
  for (let k = 0; k <= 16; k++) {
    const u = k / 16;
    const q0 = lerp2(gateArc, ctrl, u);
    const q1 = lerp2(ctrl, gateMain, u);
    inside.push(lerp2(q0, q1, u));
  }
  const path = [add2(gateArc, scale2(radial, 220)), add2(gateArc, scale2(radial, 40)), ...inside, v2(gateMain.x, -40), v2(gateMain.x, -size / 2 + 20)];
  const canal: Canal = { path, width: WATER_ROUTE.width, level: WATER_ROUTE.level, quay: 0.05 };
  const clear = WATER_ROUTE.width / 2 + 3;
  b.buildings = b.buildings.filter((h) => nearestOnPath(path, v2(h.x, h.y)).d > clear + Math.max(h.width, h.depth) / 2);
  b.landmarks = b.landmarks.filter((l) => nearestOnPath(path, v2(l.x, l.y)).d > clear + Math.max(l.w, l.d) / 2);
  // Ponts : là où le lit coupe une rue du treillis (segments de rue gardés).
  const g = b.town.grid;
  const segs: [Vec2, Vec2][] = [];
  for (let i = 0; i <= g.cols; i++) for (let j = 0; j < g.rows; j++) segs.push([(g.pts[i] as Vec2[])[j] as Vec2, (g.pts[i] as Vec2[])[j + 1] as Vec2]);
  for (let j = 0; j <= g.rows; j++) for (let i = 0; i < g.cols; i++) segs.push([(g.pts[i] as Vec2[])[j] as Vec2, (g.pts[i + 1] as Vec2[])[j] as Vec2]);
  for (let k = 0; k + 1 < inside.length; k++) {
    const p0 = inside[k] as Vec2;
    const p1 = inside[k + 1] as Vec2;
    for (const [s0, s1] of segs) {
      const x = segmentHit(p0, p1, s0, s1);
      if (!x || x.y < 30 || dist2(x, v2(0, 0)) > R - 30) continue;
      const along = norm2(sub2(p1, p0));
      b.bridges.push({ at: x, angle: Math.atan2(along.x, -along.y), length: WATER_ROUTE.width + 6, width: 9, deck: 0.35 });
    }
  }
  // Barques d'évacuation amarrées et pontons, sur le dernier tronçon avant la porte d'eau intérieure.
  const lastLeg = inside.slice(-7);
  for (let k = 0; k + 1 < lastLeg.length; k++) {
    const q = lerp2(lastLeg[k] as Vec2, lastLeg[k + 1] as Vec2, 0.5);
    if (q.y < 18) continue;
    const dir = norm2(sub2(lastLeg[k + 1] as Vec2, lastLeg[k] as Vec2));
    const n = v2(-dir.y, dir.x);
    const side = k % 2 ? 1 : -1;
    const ang = Math.atan2(dir.y, dir.x);
    b.props.push({ ...prop(b.t, "barques", add2(q, scale2(n, side * (WATER_ROUTE.width / 2 - 3))), ang, 1.15, b.p.palette.bois), z: WATER_ROUTE.level - 0.25 });
    b.props.push({ ...prop(b.t, "barques", add2(q, add2(scale2(n, side * (WATER_ROUTE.width / 2 - 5.5)), scale2(dir, 6))), ang, 1.15, b.p.palette.bois), z: WATER_ROUTE.level - 0.25 });
    b.props.push({ ...prop(b.t, "pontons", add2(q, scale2(n, side * (WATER_ROUTE.width / 2 + 1))), Math.atan2(-n.y * side, -n.x * side), 1, b.p.palette.bois), z: WATER_ROUTE.level + 0.6 });
  }
  return canal;
}

/** Intersection de deux segments (null s'ils ne se coupent pas). */
function segmentHit(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
  const r = sub2(b, a);
  const s = sub2(d, c);
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const ac = sub2(c, a);
  const t = (ac.x * s.y - ac.y * s.x) / den;
  const u = (ac.x * r.y - ac.y * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? add2(a, scale2(r, t)) : null;
}

/** District adossé à un mur : saillie, porte extérieure à la pointe, porte intérieure dans la ligne principale. */
export function generateDistrict(p: StyleProfile, variant: Variant | null, seed: number, ruin: number): EnvBody {
  const rand = seeded(derive(seed, 60));
  const R = WALLS.saillie_rayon_m.valeur;
  const size = 1800;
  const lo = layoutOptions(p);
  const avg = (lo.blockMin + lo.blockMax) / 2 + lo.streetMax * 0.6;
  const half = Math.ceil(R / avg);
  const cols = half * 2;
  const rows = half + 1;
  const canalRow = hasMark(p, "canaux") ? Math.max(2, Math.round(rows * 0.68)) : -1;
  const mainCol = half;
  const keep = (c: Vec2): boolean => c.y > 24 && dist2(c, v2(0, 0)) < R - 26;
  const t = generateTerrain(seed, { ...terrainSpecFor(p, { size, clear: [{ c: v2(0, R * 0.45), r: R * 1.3 }], roadVia: [v2(0, -60), v2(0, R + 60)], farms: 0 }), axis: "ns" });
  // La route de terre s'arrête aux portes : dans la saillie, les rues sont pavées.
  clipRoads(t, (q) => q.y > -6 && dist2(q, v2(0, 0)) < R + 6);
  const town = generateTown(seed, {
    ...lo,
    cols,
    rows,
    center: v2(0, (rows * avg) / 2 - avg * 0.35),
    keep,
    plazaAt: v2(0, R * 0.42),
    // Rue principale droite de la porte intérieure à la porte extérieure (Trost : « larges rues principales qui mènent à la
    // porte », C ; tracé droit A).
    straightCol: { i: mainCol, x: 0 },
    lots: { width: [7, p.densite > 0.85 ? 12 : 13.5], depth: [9, 15], floors: p.batiments.etages as [number, number], floorHeight: p.batiments.hauteur_etage_m as [number, number] },
    fill: 0.5 + 0.5 * p.densite,
    streetWidth: (vertical, line) => (vertical && line === mainCol ? Math.max(12, p.rues_m[1]) : !vertical && line === canalRow ? 22 : null),
  });
  const b: TownBuild = { p, rand, t, town, ruin, buildings: [], landmarks: [], props: [], paving: [], canals: [], bridges: [], fires: [], used: new Set() };
  b.buildings = town.buildings.map((h) => styleBuilding(h, p, rand, { hf: t.heights, ruin }));
  const plaza = town.plaza.center;
  // Repères du profil.
  if (hasMark(p, "eglise_clocher") || hasMark(p, "grande_eglise")) {
    const big = hasMark(p, "grande_eglise");
    const blk = nearestBlock(b, add2(plaza, v2(avg, 0)));
    if (blk) landmarkInBlock(b, blk, "eglise", big ? { w: 20, d: 44, h: 16 } : { w: 14, d: 32, h: 12 }, plaza);
  }
  if (hasMark(p, "edifice_central")) {
    const blk = nearestBlock(b, add2(plaza, v2(-avg, 0)));
    if (blk) landmarkInBlock(b, blk, "edifice", { w: 60, d: 46, h: 20 }, plaza);
  }
  if (hasMark(p, "casernes_pierre") || hasMark(p, "cour_rassemblement")) {
    const blk = nearestBlock(b, v2(R * 0.3, R * 0.72));
    if (blk) landmarkInBlock(b, blk, "caserne", { w: 60, d: 60, h: 10 }, v2(0, R));
  }
  if (hasMark(p, "qg_garnison")) {
    const blk = nearestBlock(b, v2(-R * 0.3, R * 0.3));
    if (blk) landmarkInBlock(b, blk, "edifice", { w: 40, d: 34, h: 15 }, plaza);
  }
  if (hasMark(p, "ecuries")) {
    const blk = nearestBlock(b, v2(-R * 0.35, R * 0.7));
    if (blk) landmarkInBlock(b, blk, "ecurie", { w: 50, d: 50, h: 5 }, v2(0, R));
  }
  if (hasMark(p, "poste_garnison")) {
    // R1c : poste de la Garnison près de la porte extérieure (carte de Shiganshina : casernes, C ; position A).
    const blk = nearestBlock(b, v2(-R * 0.22, R * 0.78));
    if (blk) landmarkInBlock(b, blk, "caserne", { w: 34, d: 26, h: 9 }, v2(0, R));
  }
  if (hasMark(p, "marche") && town.plaza.centers[1]) {
    const s = town.plaza.centers[1] as Vec2;
    b.landmarks.push(styleLandmark({ kind: "halle", x: s.x, y: s.y, angle: 0, w: 22, d: 30, h: 7 }, p, t.heights, ruin > 0.5 ? ruin : 0));
  }
  if (hasMark(p, "acces_souterrain") && town.plaza.centers[1]) b.props.push(prop(t, "escaliers", add2(town.plaza.centers[1] as Vec2, v2(18, 6)), 0, 1, p.palette.pierre));
  const canalStreets = new Set<number>();
  if (canalRow > 0) canalAlong(b, canalRow, (q) => keep(q) && q.y > 40, canalStreets);
  const water = hasMark(p, "voie_eau_evacuation");
  if (water) b.canals.push(waterRoute(b, R, size));
  carveCanals(t, b.canals);
  townPaving(b, canalStreets, CANAL_WIDTH);
  // Chemin de ronde au sol : une bande de terre battue le long du pied de la saillie.
  for (let k = 0; k < 48; k++) {
    const a0 = Math.PI - (k / 48) * Math.PI;
    const a1 = Math.PI - ((k + 1) / 48) * Math.PI;
    const ring = (a: number, r: number): Vec2 => v2(Math.cos(a) * r, Math.max(2, Math.sin(a) * r));
    b.paving.push({ poly: [ring(a0, R - 34), ring(a1, R - 34), ring(a1, R - 5), ring(a0, R - 5)], kind: "terre", y: 0.05, color: groundHex(p, "route") });
  }
  // Rue principale de porte à porte (R1c) : droite, pavée jusqu'aux deux portes, au-delà des derniers carrefours du treillis ;
  // les maisons dont l'emprise (îlots tournés de la disposition organique) mord sur la chaussée sont retirées.
  const colPts = (town.grid.pts[mainCol] as Vec2[]).filter((q) => keep(q));
  const avenue = Math.max(12, p.rues_m[1]) / 2 + 1;
  b.buildings = b.buildings.filter((h) => {
    const u = v2(Math.cos(h.angle), Math.sin(h.angle));
    const n = v2(-u.y, u.x);
    const xs = [-1, 1].flatMap((a) => [-1, 1].map((c) => h.x + (u.x * a * h.width) / 2 + (n.x * c * h.depth) / 2));
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    return h.y > R + 10 || hi < -avenue || lo > avenue;
  });
  if (colPts.length > 0) {
    const ys = colPts.map((q) => q.y);
    const strip = (y0: number, y1: number): Vec2[] => [v2(-avenue, y0), v2(avenue, y0), v2(avenue, y1), v2(-avenue, y1)];
    b.paving.push({ poly: strip(1, Math.min(...ys)), kind: "pave", y: 0.06, color: p.palette.pierre });
    b.paving.push({ poly: strip(Math.max(...ys), R - 1), kind: "pave", y: 0.06, color: p.palette.pierre });
  }
  plazaProps(b);
  streetProps(b);
  // État : brèche, porte scellée, passage creusé, ruines et incendies.
  const special = variant?.special ?? "";
  const outer: WallGate["state"] = special === "breche_porte_exterieure" ? "breche" : special === "porte_scellee" ? "scellee" : special === "passage_creuse" ? "passage" : special === "rocher_porte" ? "rocher" : "fermee";
  const wall: WallLayout = wallLayout(salient({ radius: R, extent: size / 2 - 10, outer, inner: "ouverte", ...(water ? { water: { arcAngle: WATER_ROUTE.arcAngle, mainX: R * WATER_ROUTE.mainX } } : {}) }));
  b.props.push(...wallCannons(wall, (q) => heightAt(t.heights, q.x, q.y), p.palette.bois));
  ruinsAndFires(b, variant?.etat === "ravage" || variant?.etat === "ruines_incendies");
  if (outer === "breche") for (let k = 0; k < 14; k++) b.props.push(prop(t, "gravats", v2(range(rand, -14, 14), R - range(rand, 6, 40)), rand() * 6, range(rand, 1.2, 2.6), p.palette.pierre));
  const h = (q: Vec2): number => heightAt(t.heights, q.x, q.y);
  // Vue seconde : au-dessus de la rue principale (le tronçon du treillis le plus proche de 0,55 R), vers la porte extérieure.
  const g = town.grid;
  const col = g.pts[mainCol] as Vec2[];
  let streetPt = col[0] as Vec2;
  for (let j = 0; j + 1 < col.length; j++) {
    const m = lerp2(col[j] as Vec2, col[j + 1] as Vec2, 0.5);
    if (Math.abs(m.y - R * 0.55) < Math.abs(streetPt.y - R * 0.55)) streetPt = m;
  }
  // Vue principale composée sur les repères du profil : le canal et le grand édifice ; le marché et les casernes vus depuis
  // la porte extérieure ; sinon, les toits et le clocher vers la porte.
  // Vue « canal » : les canaux d'un profil (Stohess) ; la voie d'eau de Shiganshina garde la vue des toits vers la porte.
  const canal = canalRow > 0 ? b.canals[0] : undefined;
  const marketView = hasMark(p, "casernes_pierre") || hasMark(p, "cour_rassemblement");
  let principale: View = { eye: [-R * 0.48, 95, R * 0.1], target: [R * 0.12, 6, R * 0.78], fov: 55 };
  if (canal && canal.path.length > 1) {
    const a = canal.path[0] as Vec2;
    const z = canal.path[canal.path.length - 1] as Vec2;
    // Dans l'axe du canal, en retrait vers le centre de la ville (jamais hors de la saillie), vers le grand édifice.
    const d = norm2(sub2(z, a));
    const e = add2(add2(a, scale2(d, 30)), v2(0, -45));
    const tg = lerp2(a, z, 0.7);
    principale = { eye: [e.x, 58, e.y], target: [tg.x, 2, tg.y - 30], fov: 55 };
  } else if (marketView) {
    principale = { eye: [R * 0.42, 70, R * 0.98], target: [-R * 0.1, 8, R * 0.3], fov: 55 };
  } else if (hasMark(p, "fontaines")) {
    // R1c (correctif proposé en fin de R1b, E07) : vue composée sur les repères du profil : la place, sa fontaine et l'église,
    // de près, au lieu de la vue d'ensemble des toits commune aux districts.
    principale = { eye: [plaza.x + R * 0.3, 34, plaza.y - R * 0.16], target: [plaza.x - avg * 0.5, 7, plaza.y + avg * 0.35], fov: 55 };
  }
  const views: EnvData["views"] = {
    principale,
    seconde: { eye: [streetPt.x, h(streetPt) + 13, streetPt.y], target: [0, 22, R], fov: 52 },
  };
  return {
    terrain: t,
    buildings: b.buildings.map((x, i) => ({ ...x, id: i })),
    landmarks: b.landmarks,
    props: b.props,
    paving: b.paving,
    canals: b.canals,
    stoneBridges: b.bridges,
    wall,
    giants: [],
    shafts: [],
    cave: null,
    titans: [],
    fires: b.fires,
    views,
    radius: size / 2,
    anchors: wallAnchors(wall, h),
  };
}

/** Capitale (Mitras) : pas de mur ; grande avenue jusqu'au palais, cathédrale sur sa place, canaux et ponts, jardins. */
export function generateCapital(p: StyleProfile, variant: Variant | null, seed: number, ruin: number): EnvBody {
  const rand = seeded(derive(seed, 61));
  const size = 1800;
  const lo = layoutOptions(p);
  const cols = 12;
  const rows = 9;
  const avenue = cols / 2;
  const canalRows = [2, 6];
  const avg = (lo.blockMin + lo.blockMax) / 2 + lo.streetMax * 0.6;
  const H = rows * avg;
  const t = generateTerrain(seed, { ...terrainSpecFor(p, { size, clear: [{ c: v2(0, 0), r: Math.max(cols, rows) * avg * 0.62 }], roadVia: [v2(0, -H / 2 - 160), v2(0, H / 2 + 40)], farms: 0 }), axis: "ns" });
  const town = generateTown(seed, {
    ...lo,
    cols,
    rows,
    plazaAt: v2(avg * 1.5, 0),
    lots: { width: [12, 20], depth: [11, 17], floors: p.batiments.etages as [number, number], floorHeight: p.batiments.hauteur_etage_m as [number, number] },
    fill: 0.45 + 0.5 * p.densite,
    streetWidth: (vertical, line) => (vertical && line === avenue ? 36 : !vertical && canalRows.includes(line) ? 24 : null),
  });
  const b: TownBuild = { p, rand, t, town, ruin, buildings: [], landmarks: [], props: [], paving: [], canals: [], bridges: [], fires: [], used: new Set() };
  b.buildings = town.buildings.map((x) => styleBuilding(x, p, rand, { hf: t.heights, ruin }));
  const tb = town.bounds;
  clipRoads(t, (q) => q.x > tb.minX - 10 && q.x < tb.maxX + 10 && q.y > tb.minY - 160 && q.y < tb.maxY + 10);
  const [pa, pb] = town.plaza.centers;
  if (pa && pb) {
    // Cathédrale gothique sur la place : nef nord–sud, façade (et parvis) vers le sud.
    const c = lerp2(pa, pb, 0.3);
    b.landmarks.push(styleLandmark({ kind: "cathedrale", x: c.x, y: c.y, angle: facing(c, pb), w: 34, d: 74, h: 28 }, p, t.heights, ruin > 0.5 ? ruin : 0));
  }
  // Palais au nord de l'avenue, sur une esplanade, jardins à la française devant.
  const g = town.grid;
  const top = (g.pts[avenue] as Vec2[])[0] as Vec2;
  const palace = v2(top.x, top.y - 95);
  b.landmarks.push(styleLandmark({ kind: "palais", x: palace.x, y: palace.y, angle: 0, w: 130, d: 80, h: 18 }, p, t.heights, ruin > 0.5 ? ruin : 0));
  b.paving.push({ poly: [v2(palace.x - 95, palace.y - 50), v2(palace.x + 95, palace.y - 50), v2(palace.x + 95, top.y - 4), v2(palace.x - 95, top.y - 4)], kind: "dalle", y: 0.1, color: p.palette.facade });
  if (has(p, "jardins")) {
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const cx = palace.x + s * (28 + k * 20);
        const cy = top.y - 26;
        b.paving.push({ poly: [v2(cx - 8, cy - 14), v2(cx + 8, cy - 14), v2(cx + 8, cy + 14), v2(cx - 8, cy + 14)], kind: "terre", y: 0.16, color: groundHex(p, "potager", 0.5) });
        for (const dz of [-10, 0, 10]) b.props.push(prop(t, "broussailles", v2(cx, cy + dz), 0, 0.8, p.palette.sol));
      }
    }
  }
  // Avenue : arbres d'alignement et réverbères des deux côtés, statues sur l'axe.
  for (let j = 0; j < rows; j++) {
    const a = (g.pts[avenue] as Vec2[])[j] as Vec2;
    const c = (g.pts[avenue] as Vec2[])[j + 1] as Vec2;
    const L = dist2(a, c);
    const u = norm2(sub2(c, a));
    const n = v2(-u.y, u.x);
    for (let s = 6; s < L - 6; s += 12) {
      const q = lerp2(a, c, s / L);
      for (const side of [-1, 1]) {
        if (has(p, "arbres_alignement")) b.props.push(prop(t, "arbres_alignement", add2(q, scale2(n, side * 13)), 0, 1, p.palette.sol));
        if (has(p, "lampadaires") && Math.round(s / 12) % 2 === 0) b.props.push(prop(t, "lampadaires", add2(q, scale2(n, side * 16.5)), 0, 1, p.palette.bois));
      }
    }
    if (has(p, "statues") && j % 3 === 1) b.props.push(prop(t, "statues", lerp2(a, c, 0.5), Math.atan2(u.y, u.x), 1, p.palette.pierre));
  }
  const canalStreets = new Set<number>();
  for (const r of canalRows) canalAlong(b, r, () => true, canalStreets);
  carveCanals(t, b.canals);
  townPaving(b, canalStreets, CANAL_WIDTH);
  plazaProps(b);
  streetProps(b);
  ruinsAndFires(b, variant?.etat === "ruines_incendies");
  const bottom = (g.pts[avenue] as Vec2[])[rows] as Vec2;
  const canalA = (g.pts[2] as Vec2[])[canalRows[1] as number] as Vec2;
  const canalB = (g.pts[8] as Vec2[])[canalRows[1] as number] as Vec2;
  const cu = norm2(sub2(canalB, canalA));
  const views: EnvData["views"] = {
    principale: { eye: [bottom.x + 70, 105, bottom.y + 90], target: [palace.x, 8, (palace.y + bottom.y) / 2 - 60], fov: 55 },
    seconde: { eye: [canalA.x - cu.x * 10, 9, canalA.y - cu.y * 10], target: [canalB.x, 3, canalB.y], fov: 55 },
  };
  void insideConvex;
  return {
    terrain: t,
    buildings: b.buildings.map((x, i) => ({ ...x, id: i })),
    landmarks: b.landmarks,
    props: b.props,
    paving: b.paving,
    canals: b.canals,
    stoneBridges: b.bridges,
    wall: null,
    giants: [],
    shafts: [],
    cave: null,
    titans: [],
    fires: b.fires,
    views,
    radius: size / 2,
  };
}
