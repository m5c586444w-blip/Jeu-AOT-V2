import type { StyleProfile } from "../../data/artSchemas";
import { prop, terrainSpecFor } from "./envCountry";
import type { EnvBody } from "./envTown";
import { layoutOptions } from "./envTown";
import type { CaveData, Landmark, Paving, Prop, Shaft, StyledBuilding, TitanPlacement, View } from "./envTypes";
import { salient, translatePaths, wallAnchors, wallCannons, wallLayout, straightWall } from "./envWall";
import { add2, dist2, lerp2, nearestOnPath, pointAt, rot2, scale2, v2 } from "./geom2";
import type { Vec2 } from "./geom2";
import { derive, int, range, seeded } from "./rng";
import type { Rand } from "./rng";
import { styleBuilding, styleLandmark } from "./styling";
import type { Variant } from "./styles";
import { WALLS, groundHex } from "./styles";
import { clipRoads, generateTerrain, heightAt, slopeAt } from "./terrain";
import type { TerrainData } from "./terrain";
import { generateTown } from "./town";
import type { Building } from "./town";

/**
 * Lot 2 de R1b : les générateurs des environnements restants, calcul pur. Chacun lit son profil de style (densité, couvertures,
 * matières, palette, accessoires, terrain, végétation, visibilité du mur) et ne décide d'aucune teinte.
 * - souterrain (E08) : ville serrée sous une voûte de roche, lanternes, cordes, puits de jour ;
 * - ville (E10) : ville agricole, remparts légers (palissade), moulins, champs autour ;
 * - forêt (E15), montagne (E16), eaux (E17), côte (E18) ;
 * - château (E20, ruines en 850), usine (E21, et cavernes de glace), crypte (E23) ;
 * - camp (E24 militaire, E25 réfugiés devant une porte de Rose), glacis (E29, devant la porte extérieure de Shiganshina).
 */
const has = (p: StyleProfile, k: string): boolean => (p.accessoires as readonly string[]).includes(k);
const H = (t: TerrainData, q: Vec2): number => heightAt(t.heights, q.x, q.y);
const view = (eye: [number, number, number], target: [number, number, number], fov = 56): View => ({ eye, target, fov });

function bodyOf(t: TerrainData | null, rest: Partial<EnvBody> & Pick<EnvBody, "views">): EnvBody {
  return { terrain: t, buildings: [], landmarks: [], props: [], paving: [], canals: [], stoneBridges: [], wall: null, giants: [], shafts: [], cave: null, titans: [], fires: [], ...rest };
}

function box(x: number, y: number, angle: number, width: number, depth: number, floors: number, floorHeight: number): Building {
  return { id: 0, block: -1, x, y, angle, width, depth, floors, floorHeight, roof: "pignon", pitch: 0.7, ridgeAlongFront: true, wall: 0, roofColor: 1, tint: 1, chimneys: [], bays: Math.max(1, Math.round(width / 3)), sideBays: Math.max(1, Math.round(depth / 3)) };
}

/** Aplanit le terrain à `base` dans un disque de rayon `r0`, raccord progressif jusqu'à `r1`. */
function flatten(t: TerrainData, c: Vec2, r0: number, r1: number, base: number): void {
  const hf = t.heights;
  const half = hf.size / 2;
  for (let j = 0; j < hf.n; j++)
    for (let i = 0; i < hf.n; i++) {
      const d = dist2(v2(-half + i * hf.cell, -half + j * hf.cell), c);
      const k = j * hf.n + i;
      if (d < r0) hf.h[k] = base;
      else if (d < r1) hf.h[k] = (hf.h[k] as number) + (base - (hf.h[k] as number)) * (1 - (d - r0) / (r1 - r0));
    }
}

/** Semis de points dans un disque, à distance minimale (rejets). */
function scatter(rand: Rand, n: number, c: Vec2, r: number, minGap: number, ok: (q: Vec2) => boolean = () => true): Vec2[] {
  const out: Vec2[] = [];
  for (let k = 0; k < n * 30 && out.length < n; k++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * r;
    const q = add2(c, v2(Math.cos(a) * d, Math.sin(a) * d));
    if (!ok(q) || out.some((o) => dist2(o, q) < minGap)) continue;
    out.push(q);
  }
  return out;
}

// ——— E08 : ville souterraine ———

export function generateUnderground(p: StyleProfile, variant: Variant | null, seed: number): EnvBody {
  const rand = seeded(derive(seed, 100));
  const R = 230;
  const t = generateTerrain(seed, { ...terrainSpecFor(p, { size: 700, n: 129, clear: [{ c: v2(0, 0), r: R * 0.7 }], roads: false }), fields: 0, hedges: 0, forest: 0, trees: 0 });
  const lo = layoutOptions(p);
  const town = generateTown(seed, { ...lo, cols: 8, rows: 8, keep: (c) => Math.hypot(c.x, c.y) < R - 34, plazaAt: v2(10, 20), lots: { width: [5, 9], depth: [6, 10], floors: p.batiments.etages as [number, number], floorHeight: p.batiments.hauteur_etage_m as [number, number] }, fill: 0.5 + 0.5 * p.densite });
  const buildings = town.buildings.map((b, i) => ({ ...styleBuilding(b, p, rand, { hf: t.heights, ruin: 0 }), id: i }));
  const props: Prop[] = [];
  const paving: Paving[] = [];
  for (const blk of town.blocks) if (!blk.outside) paving.push({ poly: [...blk.inner], kind: "terre", y: 0.1, color: groundHex(p, "boue", 0.5) });
  // Ruelles de terre battue, lanternes à profusion, cordes tendues, étals de contrebande sur la place.
  paving.push({ poly: Array.from({ length: 32 }, (_, k) => v2(Math.cos((k / 32) * Math.PI * 2) * (R - 30), Math.sin((k / 32) * Math.PI * 2) * (R - 30))), kind: "terre", y: 0.04, color: groundHex(p, "boue", 0.6) });
  for (const b of buildings) {
    const u = v2(Math.cos(b.angle), Math.sin(b.angle));
    const n = v2(-u.y, u.x);
    if (rand() < 0.55) props.push(prop(t, "lanternes", add2(v2(b.x, b.y), add2(scale2(n, -(b.depth / 2 + 0.8)), scale2(u, range(rand, -b.width / 3, b.width / 3)))), b.angle - Math.PI / 2, 1, p.palette.bois));
    if (has(p, "cordes") && rand() < 0.2) props.push(prop(t, "cordes", add2(v2(b.x, b.y), scale2(n, -(b.depth / 2 + 1.5))), 0, 1, p.palette.bois));
    if (has(p, "caisses") && rand() < 0.15) props.push(prop(t, "caisses", add2(v2(b.x, b.y), scale2(n, -(b.depth / 2 + 1))), b.angle, 1, p.palette.bois));
    if (has(p, "tonneaux") && rand() < 0.12) props.push(prop(t, "tonneaux", add2(v2(b.x, b.y), scale2(n, -(b.depth / 2 + 0.9))), 0, 1, p.palette.bois));
  }
  for (const c of town.plaza.centers) for (let k = 0; k < 8; k++) props.push(prop(t, "etals", add2(c, v2(Math.cos(k * 0.8) * 12, Math.sin(k * 0.8) * 9)), k * 0.8 + 1.57, 1, p.palette.bois));
  // Grand escalier taillé vers la surface, au bord de la caverne.
  for (let k = 0; k < 6; k++) props.push(prop(t, "escaliers", v2(-R + 40 + k * 2.8, 40), 0, 1.6, p.palette.pierre));
  const openings = [v2(-60, -50), v2(80, 30), v2(10, 120)];
  const shafts: Shaft[] = openings.map((o) => ({ x: o.x, y: o.y, radius: 9, height: 70 }));
  const cave: CaveData = { radius: R, height: 78, openings, kind: "ville" };
  void variant;
  return bodyOf(t, {
    buildings,
    props,
    paving,
    shafts,
    cave,
    radius: R,
    views: { principale: view([-R * 0.55, 42, R * 0.55], [40, 4, -30], 60), seconde: view([town.plaza.centers[0]?.x ?? 0, 3.2, (town.plaza.centers[0]?.y ?? 0) + 26], [town.plaza.centers[0]?.x ?? 0, 6, -60], 62) },
  });
}

// ——— E10 : ville agricole ———

export function generateFarmTown(p: StyleProfile, variant: Variant | null, seed: number, ruin: number): EnvBody {
  const rand = seeded(derive(seed, 101));
  const R = 150;
  const t = generateTerrain(seed, terrainSpecFor(p, { farms: 5, clear: [{ c: v2(0, 0), r: R + 30 }], roadVia: [v2(0, 0)] }));
  clipRoads(t, (q) => Math.hypot(q.x, q.y) < R - 10);
  const lo = layoutOptions(p);
  const town = generateTown(seed, { ...lo, cols: 6, rows: 6, keep: (c) => Math.hypot(c.x, c.y) < R - 18, lots: { width: [7, 12], depth: [7, 11], floors: p.batiments.etages as [number, number], floorHeight: p.batiments.hauteur_etage_m as [number, number] }, fill: 0.35 + 0.6 * p.densite });
  const buildings = town.buildings.map((b, i) => ({ ...styleBuilding(b, p, rand, { hf: t.heights, ruin }), id: i }));
  const landmarks: Landmark[] = [];
  const paving: Paving[] = [];
  const props: Prop[] = [];
  for (const blk of town.blocks) if (!blk.outside) paving.push({ poly: [...blk.inner], kind: blk.plaza ? "dalle" : "terre", y: 0.1, color: blk.plaza ? p.palette.pierre : groundHex(p, "route") });
  paving.push({ poly: Array.from({ length: 36 }, (_, k) => v2(Math.cos((k / 36) * Math.PI * 2) * (R - 4), Math.sin((k / 36) * Math.PI * 2) * (R - 4))), kind: "terre", y: 0.05, color: groundHex(p, "route") });
  const [pa, pb] = town.plaza.centers;
  if (pa) landmarks.push(styleLandmark({ kind: "eglise", x: pa.x + 24, y: pa.y, angle: Math.PI / 2, w: 12, d: 26, h: 10 }, p, t.heights));
  if (pb && has(p, "etals")) for (let k = 0; k < 8; k++) props.push(prop(t, "etals", add2(pb, v2(Math.cos(k * 0.78) * 12, Math.sin(k * 0.78) * 9)), k * 0.78 + 1.57, 1, p.palette.bois));
  if (pb && has(p, "puits")) props.push(prop(t, "puits", pb, 0, 1, p.palette.pierre));
  buildings.splice(0, buildings.length, ...buildings.filter((b) => !landmarks.some((l) => dist2(b, l) < 22)));
  // Remparts légers : une palissade autour de la ville, ouverte sur la route.
  if (has(p, "palissade")) {
    const road = t.roads[0];
    for (let k = 0; k < 130; k++) {
      const a = (k / 130) * Math.PI * 2;
      const q = v2(Math.cos(a) * (R + 6), Math.sin(a) * (R + 6));
      if (road && t.roads.some((r) => nearestOnPath(r.path, q).d < 8)) continue;
      props.push(prop(t, "palissade", q, a + Math.PI / 2, 1, p.palette.bois));
    }
  }
  // Moulins sur les hauteurs proches.
  for (let k = 0; k < 2; k++) {
    let best = v2(R + 80, 0);
    let bh = -Infinity;
    for (let j = 0; j < 80; j++) {
      const a = rand() * Math.PI * 2;
      const q = v2(Math.cos(a) * range(rand, R + 50, R + 220), Math.sin(a) * range(rand, R + 50, R + 220));
      if (t.rivers.some((r) => nearestOnPath(r.path, q).d < 30) || slopeAt(t.heights, q.x, q.y) > 0.15 || landmarks.some((l) => dist2(l, q) < 80)) continue;
      if (H(t, q) > bh) {
        bh = H(t, q);
        best = q;
      }
    }
    landmarks.push(styleLandmark({ kind: "moulin", x: best.x, y: best.y, angle: rand() * 6, w: 7, d: 7, h: 12 }, p, t.heights, ruin));
  }
  if (has(p, "charrettes")) for (let k = 0; k < 6; k++) {
    const b = buildings[int(rand, 0, buildings.length - 1)];
    if (b) props.push(prop(t, "charrettes", add2(v2(b.x, b.y), rot2(v2(0, -b.depth / 2 - 2.5), b.angle)), b.angle, 1, p.palette.bois));
  }
  if (has(p, "meules_de_foin")) for (const pc of t.parcels.filter((x) => x.crop === "ble").slice(0, 8)) props.push(prop(t, "meules_de_foin", lerp2(pc.poly[0] as Vec2, pc.poly[2 % pc.poly.length] as Vec2, 0.5), 0, 1, p.palette.toit_2));
  return bodyOf(t, {
    buildings,
    landmarks,
    props,
    paving,
    views: { principale: view([-R - 120, H(t, v2(-R - 120, R + 110)) + 75, R + 110], [10, 4, -10]), seconde: view([0, 9, R * 0.75], [pa?.x ?? 0, 6, pa?.y ?? 0], 58) },
  });
}

// ——— E15 : bois et forêts ordinaires ———

export function generateForest(p: StyleProfile, variant: Variant | null, seed: number): EnvBody {
  const rand = seeded(derive(seed, 102));
  const dead = variant?.special === "foret_morte";
  const t = generateTerrain(seed, { ...terrainSpecFor(p, { size: 1200, n: 193, clear: [{ c: v2(40, -30), r: 55 }], roadVia: [v2(0, 0)] }), overgrowth: dead ? 0.9 : p.vegetation.envahissement });
  // Le chemin devient un sentier.
  for (const r of t.roads) r.width = 2.6;
  // Futaie : le masque de forêt du terrain laisse des clairières ; on serre le couvert hors du sentier et de la clairière.
  for (let gy = -560; gy < 560; gy += 8)
    for (let gx = -560; gx < 560; gx += 8) {
      const q = v2(gx + range(rand, -3, 3), gy + range(rand, -3, 3));
      if (dist2(q, v2(40, -30)) < 50 || t.roads.some((r) => nearestOnPath(r.path, q).d < 5)) continue;
      t.trees.push({ x: q.x, y: q.y, s: range(rand, 0.8, 1.35), r: rand() * 6.28, kind: rand() < 0.68 ? "feuillu" : rand() < 0.8 ? "conifere" : "buisson" });
    }
  if (dead) for (const tr of t.trees) if (tr.kind === "feuillu" && rand() < 0.7) tr.kind = "mort";
  const props: Prop[] = [];
  for (let k = 0; k < 260; k++) {
    const q = v2(range(rand, -0.45, 0.45) * 1200, range(rand, -0.45, 0.45) * 1200);
    props.push(prop(t, rand() < 0.45 ? "souches" : rand() < 0.5 ? "rochers" : "broussailles", q, rand() * 6, range(rand, 0.7, 1.4), p.palette.pierre));
  }
  const road = t.roads[0];
  const q = road ? pointAt(road.path, road.path.length * 2.5) : { p: v2(0, 0), dir: v2(1, 0) };
  return bodyOf(t, {
    props,
    views: { principale: view([-140, H(t, v2(-140, 160)) + 46, 160], [40, H(t, v2(40, -30)) + 6, -30], 56), seconde: view([q.p.x - q.dir.x * 12, H(t, q.p) + 2, q.p.y - q.dir.y * 12], [q.p.x + q.dir.x * 40, H(t, q.p) + 5, q.p.y + q.dir.y * 40], 62) },
    mist: { density: dead ? 0.35 : 0.15, top: 8 },
  });
}

// ——— E16 : montagnes, plateaux, gorges ———

export function generateMountains(p: StyleProfile, variant: Variant | null, seed: number): EnvBody {
  const rand = seeded(derive(seed, 103));
  const t = generateTerrain(seed, { ...terrainSpecFor(p, { size: 1600, n: 257, roads: false }), fields: 0, hedges: 0 });
  const props: Prop[] = [];
  for (let k = 0; k < 900; k++) {
    const q = v2(range(rand, -0.47, 0.47) * 1600, range(rand, -0.47, 0.47) * 1600);
    const s = slopeAt(t.heights, q.x, q.y);
    // Sur une pente, le pied est enfoncé de la dénivelée sous l'emprise (pas de rocher en surplomb).
    const sink = (pr: Prop): Prop => ({ ...pr, z: pr.z - Math.min(6, s * pr.s * 1.6) });
    if (s > 0.55 && rand() < 0.8) props.push(sink(prop(t, "eboulis", q, rand() * 6, range(rand, 1.5, 3.5), p.palette.pierre)));
    else if (s > 0.3 && rand() < 0.35) props.push(sink(prop(t, "rochers", q, rand() * 6, range(rand, 1.5, 4), p.palette.pierre)));
  }
  const river = t.rivers[0];
  const mid = river ? pointAt(river.path, river.path.length * 4) : { p: v2(0, 0), dir: v2(0, 1) };
  // Vue principale : du haut d'un versant, vers la gorge ; seconde : au fond de la gorge, le long du torrent.
  let crest = v2(-300, -200);
  let ch = -Infinity;
  for (let k = 0; k < 200; k++) {
    const q = v2(range(rand, -500, 500), range(rand, -500, 500));
    if (dist2(q, mid.p) < 250 || dist2(q, mid.p) > 550) continue;
    if (H(t, q) > ch) {
      ch = H(t, q);
      crest = q;
    }
  }
  void variant;
  return bodyOf(t, {
    props,
    views: {
      principale: view([crest.x, H(t, crest) + 30, crest.y], [mid.p.x, H(t, mid.p) + 10, mid.p.y], 58),
      seconde: view([mid.p.x - mid.dir.x * 60, H(t, mid.p) + 6, mid.p.y - mid.dir.y * 60], [mid.p.x + mid.dir.x * 120, H(t, mid.p) + 30, mid.p.y + mid.dir.y * 120], 62),
    },
    mist: { density: 0.25, top: 30 },
  });
}

// ——— E17 : rivières, lacs, marais ———

export function generateWaters(p: StyleProfile, variant: Variant | null, seed: number): EnvBody {
  const rand = seeded(derive(seed, 104));
  const t = generateTerrain(seed, terrainSpecFor(p, { size: 1400, n: 225, roadVia: [v2(0, 0)] }));
  const props: Prop[] = [];
  const river = t.rivers[0];
  // Roselières : le long des berges et dans les creux du marais.
  for (let k = 0; k < 2600; k++) {
    const q = v2(range(rand, -0.47, 0.47) * 1400, range(rand, -0.47, 0.47) * 1400);
    const h = H(t, q);
    const nearRiver = river ? nearestOnPath(river.path, q).d - river.width / 2 : 99;
    if ((t.marshLevel !== null && h < t.marshLevel + 0.45 && h > t.marshLevel - 0.6) || (nearRiver > -1 && nearRiver < 6)) props.push(prop(t, "roseaux", q, rand() * 6, range(rand, 0.8, 1.5), p.palette.toit));
  }
  // Gué : le chemin traverse la rivière sans pont (pierres de gué) ; pontons et barques au bord de l'eau.
  const bridges = t.bridges.splice(0);
  for (const br of bridges) {
    for (let k = -3; k <= 3; k++) props.push(prop(t, "rochers", add2(br.at, scale2(v2(Math.cos(br.angle), Math.sin(br.angle)), k * 3.5)), rand() * 6, 0.55, p.palette.pierre));
  }
  if (river) for (let k = 0; k < 4; k++) {
    const q = pointAt(river.path, 760 + k * 45);
    const n = v2(-q.dir.y, q.dir.x);
    const at = add2(q.p, scale2(n, river.width / 2 + 2));
    props.push(prop(t, "pontons", at, Math.atan2(-n.y, -n.x), 1, p.palette.bois));
    if (has(p, "barques")) {
      // Barque à flot : posée sur le niveau de l'eau, pas sur le lit.
      const at = add2(q.p, scale2(n, river.width / 2 - 3));
      const lvl = river.level[nearestOnPath(river.path, at).i] ?? 0;
      props.push({ ...prop(t, "barques", at, Math.atan2(q.dir.y, q.dir.x), 1, p.palette.bois), z: lvl - 0.25 });
    }
  }
  // Vues : au-dessus du marais, vers la rivière ; sur la berge, à hauteur d'homme, le long de l'eau vers les pontons.
  const water = t.marshLevel ?? 0;
  const mid = river ? pointAt(river.path, 700) : { p: v2(0, 0), dir: v2(1, 0) };
  const nrm = v2(-mid.dir.y, mid.dir.x);
  // R1c (correctif proposé en fin de R1b) : vue principale basse, le long de la rivière, l'eau et les roseaux dans le tiers bas.
  const e1 = add2(mid.p, add2(scale2(nrm, 70), scale2(mid.dir, -150)));
  const bank = add2(mid.p, scale2(nrm, (river?.width ?? 20) / 2 + 9));
  const e2 = add2(bank, scale2(mid.dir, -40));
  void variant;
  return bodyOf(t, {
    props,
    views: {
      principale: view([e1.x, Math.max(H(t, e1), water) + 16, e1.y], [mid.p.x + mid.dir.x * 80 - nrm.x * 10, water + 1, mid.p.y + mid.dir.y * 80 - nrm.y * 10], 58),
      seconde: view([e2.x, Math.max(H(t, e2), water) + 2.4, e2.y], [bank.x + mid.dir.x * 90 - nrm.x * 25, water + 1.5, bank.y + mid.dir.y * 90 - nrm.y * 25], 62),
    },
    mist: { density: 0.6, top: 7 },
  });
}

// ——— E18 : côte et plage ———

export function generateCoast(p: StyleProfile, variant: Variant | null, seed: number): EnvBody {
  const rand = seeded(derive(seed, 105));
  const t = generateTerrain(seed, terrainSpecFor(p, { size: 1600, n: 257, roadVia: [v2(-300, -200)] }));
  const props: Prop[] = [];
  // Rochers au pied des falaises, pontons sur la plage.
  for (let k = 1; k < t.coast.length - 1; k++) {
    const c = t.coast[k] as Vec2;
    const cliff = H(t, v2(c.x, c.y - 30)) > 12;
    if (cliff) for (let j = 0; j < 3; j++) props.push(prop(t, "rochers", v2(c.x + range(rand, -12, 12), c.y + range(rand, 2, 18)), rand() * 6, range(rand, 1.5, 3.5), p.palette.pierre));
  }
  const beach = t.coast.filter((c) => H(t, v2(c.x, c.y - 30)) < 6);
  const bc = beach[Math.floor(beach.length / 2)] ?? t.coast[Math.floor(t.coast.length / 2)] ?? v2(0, 200);
  // Pontons : du sable vers le large (le large est au sud, +y), le tablier au-dessus de la mer.
  const sea = t.seaLevel ?? 0;
  /** Ordonnée de la ligne d'eau à l'abscisse x (au sud du point de plage). */
  const waterline = (x: number): number => {
    let y = bc.y;
    while (y < bc.y + 160 && H(t, v2(x, y)) > sea + 0.2) y += 2;
    return y;
  };
  if (has(p, "pontons"))
    for (let k = 0; k < 3; k++) {
      // Le ponton chevauche la ligne d'eau : la moitié sur le sable, la moitié au-dessus de la mer.
      const x = bc.x - 30 + k * 30;
      props.push({ ...prop(t, "pontons", v2(x, waterline(x) + 2), Math.PI / 2, 1.4, p.palette.bois), z: sea - 0.3 });
    }
  const high = t.coast.reduce((best, c) => (H(t, v2(c.x, c.y - 40)) > H(t, v2(best.x, best.y - 40)) ? c : best), t.coast[0] ?? v2(0, 200));
  void variant;
  return bodyOf(t, {
    props,
    views: {
      principale: view([high.x, H(t, v2(high.x, high.y - 40)) + 18, high.y - 40], [high.x + (bc.x > high.x ? 320 : -320), 0, bc.y + 260], 58),
      // Sur le sable, près de la ligne d'eau, le long de la plage : écume, pontons, le large à droite.
      seconde: view([bc.x - 70, Math.max(H(t, v2(bc.x - 70, waterline(bc.x - 70) - 8)), sea) + 2.2, waterline(bc.x - 70) - 8], [bc.x + 10, sea + 1.2, waterline(bc.x + 10) + 18], 62),
    },
  });
}

// ——— E20 : château d'Utgard ———

export function generateCastle(p: StyleProfile, variant: Variant | null, seed: number, ruin: number): EnvBody {
  const rand = seeded(derive(seed, 106));
  const t = generateTerrain(seed, { ...terrainSpecFor(p, { size: 1400, n: 225, roadVia: [v2(0, 60)] }), fields: 0, hedges: 0 });
  // Le château sur le point le plus haut près du centre ; la plate-forme est aplanie autour.
  let site = v2(0, 0);
  let sh = -Infinity;
  for (let k = 0; k < 300; k++) {
    const q = v2(range(rand, -250, 250), range(rand, -250, 250));
    if (H(t, q) > sh && !t.rivers.some((r) => nearestOnPath(r.path, q).d < 80)) {
      sh = H(t, q);
      site = q;
    }
  }
  const base = H(t, site);
  flatten(t, site, 75, 110, base);
  t.trees.splice(0, t.trees.length, ...t.trees.filter((tr) => dist2(tr, site) > 70));
  const destroyed = variant?.special === "chateau_detruit";
  const r = destroyed ? Math.max(ruin, 0.75) : 0.35;
  const landmarks: Landmark[] = [styleLandmark({ kind: "chateau", x: site.x, y: site.y, angle: 0.3, w: 70, d: 56, h: 13 }, p, t.heights, r), styleLandmark({ kind: "donjon", x: site.x + 14, y: site.y - 10, angle: 0.3, w: 14, d: 14, h: destroyed ? 14 : 34 }, p, t.heights, destroyed ? 0.8 : 0)];
  const props: Prop[] = [];
  for (let k = 0; k < (destroyed ? 40 : 12); k++) props.push(prop(t, "gravats", add2(site, v2(range(rand, -40, 40), range(rand, -34, 34))), rand() * 6, range(rand, 1, 2.2), p.palette.pierre));
  for (let k = 0; k < 160; k++) props.push(prop(t, rand() < 0.5 ? "herbes_hautes" : "broussailles", add2(site, v2(range(rand, -60, 60), range(rand, -55, 55))), rand() * 6, range(rand, 0.8, 1.5), p.palette.sol));
  if (has(p, "lanternes") && !destroyed) props.push(prop(t, "lanternes", add2(site, v2(-8, 30)), 0, 1, p.palette.bois));
  return bodyOf(t, {
    landmarks,
    props,
    fires: destroyed ? [{ x: site.x + 18, y: site.y - 16, z: base + 2, size: 2.5 }] : [],
    // R1c (correctif proposé en fin de R1b) : vue principale plus proche et plus basse, le château et son donjon au centre.
    views: { principale: view([site.x - 95, Math.max(H(t, v2(site.x - 95, site.y + 80)), base - 6) + 20, site.y + 80], [site.x + 6, base + 16, site.y - 4], 50), seconde: view([site.x - 20, base + 2.2, site.y + 18], [site.x + 16, base + 18, site.y - 12], 64) },
  });
}

// ——— E21 : ville-usine (et cavernes de glace) ———

export function generateFactory(p: StyleProfile, variant: Variant | null, seed: number): EnvBody {
  const rand = seeded(derive(seed, 107));
  if (variant?.special === "cavernes") {
    // Cavernes de glace : anciennes caldeiras sous la ville, roche sombre, lueurs (cristaux).
    const t = generateTerrain(seed, { ...terrainSpecFor(p, { size: 600, n: 129, roads: false }), relief: 14, fields: 0, hedges: 0, forest: 0, trees: 0 });
    const props: Prop[] = [];
    for (const q of scatter(rand, 70, v2(0, 0), 170, 6)) props.push(prop(t, "lueurs", q, rand() * 6, range(rand, 0.7, 2), p.palette.toit_2));
    for (const q of scatter(rand, 120, v2(0, 0), 190, 4)) props.push(prop(t, "rochers", q, rand() * 6, range(rand, 1, 3), p.palette.pierre));
    return bodyOf(t, { props, cave: { radius: 200, height: 46, openings: [], kind: "glace" }, radius: 200, views: { principale: view([-120, 16, 110], [30, 6, -20], 62), seconde: view([10, 3, 40], [-30, 10, -40], 66) } });
  }
  const t = generateTerrain(seed, terrainSpecFor(p, { size: 1400, n: 225, clear: [{ c: v2(0, 0), r: 230 }], roadVia: [v2(0, 0)], farms: 0 }));
  clipRoads(t, (q) => Math.abs(q.x) < 200 && Math.abs(q.y) < 200);
  const lo = layoutOptions(p);
  const town = generateTown(seed, { ...lo, cols: 6, rows: 6, lots: { width: [8, 14], depth: [9, 14], floors: p.batiments.etages as [number, number], floorHeight: p.batiments.hauteur_etage_m as [number, number] }, fill: 0.4 + 0.5 * p.densite });
  const buildings: StyledBuilding[] = town.buildings.map((b, i) => ({ ...styleBuilding(b, p, rand, { hf: t.heights, ruin: 0 }), id: i }));
  const landmarks: Landmark[] = [];
  const props: Prop[] = [];
  const used = new Set<number>();
  for (const at of [v2(-60, -50), v2(70, -20), v2(-20, 80)]) {
    const blk = town.blocks.filter((b) => !b.plaza && !used.has(b.id)).reduce((best, b) => (dist2(b.inner[0] as Vec2, at) < dist2(best.inner[0] as Vec2, at) ? b : best));
    used.add(blk.id);
    const c = blk.inner.reduce((s, q) => add2(s, scale2(q, 0.25)), v2(0, 0));
    buildings.splice(0, buildings.length, ...buildings.filter((b) => b.block !== blk.id));
    landmarks.push(styleLandmark({ kind: "usine", x: c.x, y: c.y, angle: blk.turn, w: 42, d: 26, h: 10 }, p, t.heights));
    if (has(p, "cheminees_usine")) props.push(prop(t, "cheminees_usine", add2(c, v2(16, 9)), 0, 1, p.palette.facade));
  }
  const paving: Paving[] = [];
  for (const blk of town.blocks) paving.push({ poly: [...blk.inner], kind: "terre", y: 0.1, color: groundHex(p, "boue", 0.5) });
  const tb = town.bounds;
  // Voie ferrée le long du bord sud de la ville, de bout en bout.
  if (has(p, "rails")) for (let x = tb.minX - 40; x < tb.maxX + 40; x += 9) props.push(prop(t, "rails", v2(x, tb.maxY + 14), 0, 1, p.palette.bois));
  paving.push({ poly: [v2(tb.minX - 6, tb.minY - 6), v2(tb.maxX + 6, tb.minY - 6), v2(tb.maxX + 6, tb.maxY + 6), v2(tb.minX - 6, tb.maxY + 6)], kind: "pave", y: 0.05, color: p.palette.pierre });
  if (has(p, "lanternes")) for (const blk of town.blocks) props.push(prop(t, "lanternes", blk.inner[0] as Vec2, 0, 1, p.palette.bois));
  return bodyOf(t, {
    buildings,
    landmarks,
    props,
    paving,
    views: { principale: view([(landmarks[0]?.x ?? 0) - 110, 46, (landmarks[0]?.y ?? 0) + 120], [landmarks[0]?.x ?? 0, 8, landmarks[0]?.y ?? 0], 55), seconde: view([0, 8, tb.maxY + 4], [-40, 12, -60], 58) },
  });
}

// ——— E23 : chapelle souterraine Reiss ———

export function generateCrypt(p: StyleProfile, variant: Variant | null, seed: number): EnvBody {
  const rand = seeded(derive(seed, 108));
  const props: Prop[] = [];
  // Nef de 70 × 28 m : deux rangées de colonnes, bougies au pied des colonnes et sur l'autel, escalier à l'entrée.
  for (let k = -3; k <= 3; k++) {
    for (const s of [-1, 1]) {
      props.push({ kind: "colonnes", x: s * 8, y: k * 9, z: 0, r: 0, s: 1.2, color: p.palette.pierre });
      if (rand() < 0.7) props.push({ kind: "bougies", x: s * 8 + range(rand, -1.6, 1.6), y: k * 9 + 1.8, z: 0, r: rand() * 6, s: 1, color: p.palette.bois });
    }
  }
  for (let k = 0; k < 5; k++) props.push({ kind: "bougies", x: -4 + k * 2, y: -31, z: 1.2, r: 0, s: 1, color: p.palette.bois });
  props.push({ kind: "escaliers", x: 0, y: 34, z: 0, r: Math.PI / 2, s: 2, color: p.palette.pierre });
  const landmarks: Landmark[] = [styleLandmark({ kind: "autel", x: 0, y: -33, angle: 0, w: 6, d: 2.5, h: 1.3 }, p, null)];
  void variant;
  return bodyOf(null, {
    props,
    landmarks,
    cave: { radius: 40, height: 12, openings: [], kind: "crypte" },
    radius: 60,
    views: { principale: view([0, 3.5, 30], [0, 3, -30], 60), seconde: view([5, 1.8, -24], [-1, 1.4, -32], 62) },
  });
}

// ——— E24 et E25 : camps ———

export function generateCamp(p: StyleProfile, variant: Variant | null, seed: number): EnvBody {
  const rand = seeded(derive(seed, 109));
  const refugees = p.id === "E25";
  const wd = p.mur_visible.visible ? (p.mur_visible.distance_m ?? 160) : null;
  const wallAt = wd ?? 0;
  const t = generateTerrain(seed, { ...terrainSpecFor(p, { size: 1400, n: 225, clear: [{ c: v2(0, 0), r: 220 }], roadVia: wd !== null ? [v2(0, 0), v2(0, -wd + 30)] : [v2(0, 0)], farms: 0 }), axis: wd !== null ? "ns" : "ew" });
  const props: Prop[] = [];
  const buildings: StyledBuilding[] = [];
  const landmarks: Landmark[] = [];
  const paving: Paving[] = [];
  const road = t.roads[0];
  const nearRoad = (q: Vec2, m: number): boolean => t.roads.some((r) => nearestOnPath(r.path, q).d < r.width / 2 + m);
  if (refugees) {
    // Tentes et baraques serrées, sans plan ; files de charrettes sur la route, devant la porte de Rose.
    for (const q of scatter(rand, 480, v2(0, 10), 230, 5.2, (x) => !nearRoad(x, 3) && x.y > -wallAt + 25)) {
      if (rand() < 0.75) props.push(prop(t, "tentes", q, rand() * 6, range(rand, 0.8, 1.15), p.palette.toit));
      else buildings.push({ ...styleBuilding(box(q.x, q.y, rand() * 6, range(rand, 4, 6), range(rand, 3, 4.5), 1, 2.4), p, rand, { hf: t.heights, ruin: 0 }), id: buildings.length });
    }
    for (const q of scatter(rand, 30, v2(0, 20), 190, 25)) props.push(prop(t, "feux_de_camp", q, 0, 1, p.palette.bois));
    for (const q of scatter(rand, 20, v2(0, 20), 190, 12)) props.push(prop(t, "cordes_a_linge", q, rand() * 3, 1, p.palette.bois));
    // File de charrettes sur la route, depuis la porte vers le sud, en deux colonnes.
    if (road) {
      const s0 = nearestOnPath(road.path, v2(0, -wallAt)).s;
      const away = pointAt(road.path, s0 + 50).p.y > pointAt(road.path, s0).p.y ? 1 : -1;
      for (let k = 0; k < 44; k++) {
        const q = pointAt(road.path, s0 + away * (16 + k * 7));
        if (q.p.y < -wallAt + 12) continue;
        props.push(prop(t, "charrettes", add2(q.p, scale2(v2(-q.dir.y, q.dir.x), (k % 2 ? 1 : -1) * 1.6)), Math.atan2(q.dir.y, q.dir.x), 1, p.palette.bois));
      }
    }
  } else {
    // Camp militaire : rangées de tentes au cordeau, place d'armes, dépôts, palissade carrée, QG dans un château ancien.
    // Variante « fort avancé » : l'enceinte est une muraille de pierre à tours d'angle, porte à l'ouest.
    const S = 170;
    const fort = variant?.special === "fort";
    if (fort) {
      flatten(t, v2(0, 0), 250, 300, H(t, v2(0, 0)));
      clipRoads(t, (q) => q.x > S - 12 && Math.abs(q.y) < S + 40);
      t.trees.splice(0, t.trees.length, ...t.trees.filter((x) => Math.max(Math.abs(x.x), Math.abs(x.y)) > S + 14));
      landmarks.push(styleLandmark({ kind: "chateau", x: 0, y: 0, angle: Math.PI / 2, w: 2 * S, d: 2 * S, h: 9, material: "pierre_brute" }, p, t.heights));
    }
    for (let i = -9; i <= 9; i++) for (let j = 1; j <= 7; j++) if (i !== 0) props.push(prop(t, "tentes", v2(i * 8, 18 + j * 10), 0, 1.3, p.palette.toit));
    paving.push({ poly: [v2(-80, -70), v2(80, -70), v2(80, 5), v2(-80, 5)], kind: "terre", y: 0.08, color: groundHex(p, "route") });
    for (const x of [-50, -20, 10, 40]) props.push(prop(t, "rateliers", v2(x, -76), 0, 1, p.palette.bois));
    props.push(prop(t, "drapeaux", v2(0, -30), 0, 1.6, p.palette.toit_2));
    for (const q of [v2(-110, 60), v2(-110, 100), v2(110, 60)]) buildings.push({ ...styleBuilding(box(q.x, q.y, 0, 24, 10, 1, 4), p, rand, { hf: t.heights, ruin: 0 }), id: buildings.length });
    if (has(p, "palissade") && !fort) for (let k = 0; k < 4 * 56; k++) {
      const side = Math.floor(k / 56);
      const f = (k % 56) / 56;
      const q = side === 0 ? v2(-S + 2 * S * f, -S) : side === 1 ? v2(S, -S + 2 * S * f) : side === 2 ? v2(S - 2 * S * f, S) : v2(-S, S - 2 * S * f);
      if (nearRoad(q, 5)) continue;
      props.push(prop(t, "palissade", q, side % 2 === 0 ? 0 : Math.PI / 2, 1, p.palette.bois));
    }
    landmarks.push(styleLandmark({ kind: "donjon", x: 0, y: -125, angle: 0, w: 18, d: 18, h: 24 }, p, t.heights));
    landmarks.push(styleLandmark({ kind: "caserne", x: -80, y: -125, angle: 0, w: 50, d: 40, h: 7 }, p, t.heights));
    for (const q of scatter(rand, 8, v2(0, 60), 90, 25)) props.push(prop(t, "feux_de_camp", q, 0, 1, p.palette.bois));
    if (has(p, "abreuvoirs")) props.push(prop(t, "abreuvoirs", v2(60, -40), 0, 1, p.palette.bois));
  }
  let wall = null;
  if (wd !== null) {
    wall = wallLayout([straightWall(t.spec.size / 2 - 10, -wd, -1, [{ s: t.spec.size / 2 - 10, kind: "porte", state: "fermee" }])]);
    props.push(...wallCannons(wall, (q) => H(t, q), p.palette.bois));
  }
  void variant;
  return bodyOf(t, {
    buildings,
    landmarks,
    props,
    paving,
    wall,
    anchors: wall ? wallAnchors(wall, (q) => H(t, q)) : [],
    views: refugees
      ? { principale: view([-150, 46, 200], [0, 14, -wallAt + 20], 56), seconde: view([14, 3, 60], [0, 12, -wallAt], 60) }
      : { principale: view([-200, 60, 200], [0, 4, 0], 55), seconde: view([4, 2.4, 104], [2, 6, -110], 60) },
  });
}

// ——— E29 : glacis extérieur de Shiganshina ———

export function generateGlacis(p: StyleProfile, variant: Variant | null, seed: number): EnvBody {
  const rand = seeded(derive(seed, 110));
  const d = p.mur_visible.distance_m ?? 400;
  const R = WALLS.saillie_rayon_m.valeur;
  // La saillie au nord : sa porte extérieure (la pointe du demi-cercle) à `d` m du point de vue, la route y mène.
  const t = generateTerrain(seed, { ...terrainSpecFor(p, { size: 1600, n: 225, clear: [{ c: v2(0, -d), r: 260 }], roadVia: [v2(0, -d + R * 0.1), v2(0, 200)], farms: 0 }), axis: "ns" });
  clipRoads(t, (q) => q.y < -d + 6);
  // Le demi-cercle de la saillie bombe vers le sud (vers le point de vue) ; le mur principal le prolonge au nord, R m derrière.
  const wall = wallLayout(translatePaths(salient({ radius: R, extent: 790, outer: "fermee", inner: "ouverte" }), 0, -d - R));
  const props: Prop[] = [...wallCannons(wall, (q) => H(t, q), p.palette.bois)];
  const road = t.roads[0];
  if (road) for (let s = 30; s < road.path.length * 6; s += 120) {
    const q = pointAt(road.path, s);
    props.push(prop(t, "bornes", add2(q.p, scale2(v2(-q.dir.y, q.dir.x), road.width / 2 + 1.5)), 0, 1, p.palette.pierre));
  }
  // Ruines lointaines au sud (les villages abandonnés, vers le territoire des Titans).
  for (let k = 0; k < 24; k++) props.push(prop(t, "murs_effondres", v2(range(rand, -400, 400), range(rand, 520, 760)), rand() * 6, range(rand, 1, 1.8), p.palette.pierre));
  const titans: TitanPlacement[] = [];
  if (variant?.special === "titans_nombreux") {
    for (let k = 0; k < 16; k++) titans.push({ type: (["classe_5", "classe_8", "classe_12", "classe_15", "classe_3"] as const)[k % 5] as string, variant: k % 7 === 3 ? "anormal" : null, x: range(rand, -260, 260), y: range(rand, -d + 60, 160), angle: Math.PI + range(rand, -0.5, 0.5), pose: k % 7 === 3 ? "course" : "marche", seed: derive(seed, 1200 + k) });
  }
  return bodyOf(t, {
    props,
    wall,
    titans,
    anchors: wallAnchors(wall, (q) => H(t, q)),
    views: { principale: view([-90, H(t, v2(-90, 120)) + 22, 120], [0, 30, -d - 40], 55), seconde: view([6, 2, -d + 90], [0, 22, -d - 10], 62) },
  });
}

