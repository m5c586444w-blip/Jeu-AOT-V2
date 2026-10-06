import type { StyleProfile } from "../../data/artSchemas";
import { generateVillage, prop, terrainSpecFor } from "./envCountry";
import type { EnvBody } from "./envTown";
import type { GiantTree, Prop, Shaft, TitanPlacement } from "./envTypes";
import { add2, dist2, pointAt, scale2, v2 } from "./geom2";
import type { Vec2 } from "./geom2";
import { derive, int, range, seeded } from "./rng";
import type { Variant } from "./styles";
import { generateTerrain, heightAt } from "./terrain";
import type { TreeInst } from "./terrain";

/**
 * Nature (R1b.5) : forêt des Arbres Géants (E14) et territoire des Titans (E19). Calcul pur.
 * - Forêt géante : troncs de 74 à 86 m (≈ 80 m, partie B), contreforts racinaires, branches maîtresses (points d'ancrage au bout
 *   et à mi-longueur, plus deux sur chaque tronc), voûte dense, brume au sol, rayons de lumière dans les trouées ; sous-bois.
 *   Variantes : dense, clairière (grande trouée au centre), lisière (prairie au sud, mur de troncs au nord).
 * - Territoire : village abandonné envahi (ruines sans toit), murs effondrés, charrettes abandonnées, herbes hautes, Titans.
 */
export const GIANT_HEIGHT: [number, number] = [74, 86];

function giant(rand: () => number, x: number, y: number): GiantTree {
  const height = range(rand, GIANT_HEIGHT[0], GIANT_HEIGHT[1]);
  const branches: GiantTree["branches"] = [];
  const n = 5 + int(rand, 0, 4);
  for (let k = 0; k < n; k++) branches.push({ h: range(rand, 0.26, 0.74) * height, a: rand() * Math.PI * 2, len: range(rand, 10, 24) });
  return { x, y, height, radius: range(rand, 3.0, 4.6), lean: range(rand, -0.025, 0.025), r: rand() * Math.PI * 2, branches };
}

/** Points d'ancrage : bout et milieu de chaque branche maîtresse, deux hauteurs sur le tronc. */
export function giantAnchors(t: GiantTree, ground: number): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  for (const b of t.branches) {
    for (const f of [0.55, 1]) {
      const d = t.radius * 0.6 + b.len * f;
      out.push({ x: t.x + Math.cos(b.a) * d, y: t.y + Math.sin(b.a) * d, z: ground + b.h + b.len * f * 0.18 });
    }
  }
  for (const h of [18, 34]) out.push({ x: t.x + t.radius, y: t.y, z: ground + h });
  return out;
}

export function generateGiantForest(p: StyleProfile, variant: Variant | null, seed: number): EnvBody {
  const rand = seeded(derive(seed, 80));
  const size = 900;
  const kind = variant?.special ?? "dense";
  const lisiere = kind === "lisiere";
  const clearing = kind === "clairiere" ? { c: v2(0, 0), r: 120 } : null;
  const t = generateTerrain(seed, {
    ...terrainSpecFor(p, { size, n: 161, clear: clearing ? [clearing] : [], roadVia: [v2(0, 160)], farms: 0, roads: lisiere }),
    fields: lisiere ? 0.6 : 0,
    hedges: lisiere ? 0.4 : 0,
    forest: 0,
    trees: 0,
  });
  const edge = (x: number): number => 40 + 40 * Math.sin(x / 90);
  const spacing = kind === "dense" ? 30 : 36;
  const giants: GiantTree[] = [];
  for (let gy = -size / 2 + 20; gy < size / 2 - 20; gy += spacing) {
    for (let gx = -size / 2 + 20; gx < size / 2 - 20; gx += spacing) {
      const x = gx + range(rand, -spacing * 0.32, spacing * 0.32);
      const y = gy + range(rand, -spacing * 0.32, spacing * 0.32);
      if (clearing && dist2(v2(x, y), clearing.c) < clearing.r) continue;
      if (lisiere && y > edge(x)) continue;
      giants.push(giant(rand, x, y));
    }
  }
  // Sous-bois : jeunes arbres, buissons et fougères entre les géants (jamais dans un tronc).
  const trees: TreeInst[] = [];
  const near = (q: Vec2, r: number): boolean => giants.some((g) => dist2(q, g) < g.radius + r);
  for (let k = 0; k < 2600; k++) {
    const q = v2(range(rand, -0.49, 0.49) * size, range(rand, -0.49, 0.49) * size);
    if (near(q, 4)) continue;
    if (lisiere && q.y > edge(q.x) + 15 && rand() < 0.85) continue;
    trees.push({ x: q.x, y: q.y, s: range(rand, 0.6, 1.3), r: rand() * 6.28, kind: rand() < 0.62 ? "buisson" : rand() < 0.3 ? "conifere" : "feuillu" });
  }
  t.trees.push(...trees);
  // Rayons de lumière : dans les trouées de la voûte (loin des houppiers).
  const shafts: Shaft[] = [];
  for (let k = 0; k < 400 && shafts.length < 34; k++) {
    const q = v2(range(rand, -0.42, 0.42) * size, range(rand, -0.42, 0.42) * size);
    const dmin = Math.min(...giants.map((g) => dist2(q, g)));
    if (dmin < spacing * 0.42 || (lisiere && q.y > edge(q.x))) continue;
    shafts.push({ x: q.x, y: q.y, radius: range(rand, 2.5, 6), height: 78 });
  }
  const props: Prop[] = [];
  for (let k = 0; k < 140; k++) {
    const q = v2(range(rand, -0.47, 0.47) * size, range(rand, -0.47, 0.47) * size);
    if (near(q, 3)) continue;
    props.push(prop(t, rand() < 0.5 ? "souches" : "rochers", q, rand() * 6, range(rand, 0.7, 1.6), p.palette.pierre));
  }
  const ground = (q: Vec2): number => heightAt(t.heights, q.x, q.y);
  const anchors = giants.flatMap((g) => giantAnchors(g, ground(g)));
  // Vues : sous les premières branches (14 m), d'une trouée vers le fond de la forêt ; au pied d'un géant, vers sa voûte.
  // Les points de vue sont cherchés là où aucun tronc ni buisson ne masque l'objectif.
  const clearAround = (q: Vec2, rg: number, rt: number): boolean => !giants.some((g) => dist2(q, g) < g.radius + rg) && !t.trees.some((x) => dist2(q, x) < rt);
  const pick = (from: Vec2, rg: number, rt: number): Vec2 => {
    let best = from;
    let bd = Infinity;
    for (let k = 0; k < 400; k++) {
      const q = v2(from.x + range(rand, -60, 60), from.y + range(rand, -60, 60));
      if (!clearAround(q, rg, rt)) continue;
      const d = dist2(q, from);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  };
  const e1 = pick(lisiere ? v2(0, 260) : v2(-90, 150), 12, 5);
  const ref = giants.reduce((best, g) => (dist2(g, v2(20, 40)) < dist2(best, v2(20, 40)) ? g : best), giants[0] as GiantTree);
  const e2 = pick(v2(ref.x + 18, ref.y + 22), 6, 7);
  const views = {
    principale: { eye: [e1.x, ground(e1) + (lisiere ? 26 : 14), e1.y] as [number, number, number], target: lisiere ? ([0, 38, 0] as [number, number, number]) : ([e1.x + 160, ground(e1) + 30, e1.y - 230] as [number, number, number]), fov: 60 },
    // Au-dessus de la voûte, au ras des cimes : l'échelle des géants et la brume entre les houppiers.
    seconde: { eye: [e2.x - 120, ground(e2) + 104, e2.y + 140] as [number, number, number], target: [e2.x + 120, ground(e2) + 62, e2.y - 160] as [number, number, number], fov: 58 },
  };
  return {
    terrain: t,
    buildings: [],
    landmarks: [],
    props,
    paving: [],
    canals: [],
    stoneBridges: [],
    wall: null,
    giants,
    shafts,
    cave: null,
    titans: [],
    fires: [],
    views,
    radius: size / 2,
    anchors,
    mist: { density: kind === "dense" ? 0.75 : 0.5, top: 14 },
  };
}

/** Classes de Titans placés dans le territoire (de `data/art/titans.json`). */
const ROAMERS = ["classe_3", "classe_5", "classe_8", "classe_12", "classe_15", "classe_8", "classe_5", "classe_12"];

export function generateTerritory(p: StyleProfile, variant: Variant | null, seed: number): EnvBody {
  const rand = seeded(derive(seed, 81));
  const v = generateVillage(p, variant, seed, { ruin: 0.85, abandoned: true, radius: 130, chapel: true, suburb: false });
  const t = v.terrain;
  if (!t) throw new Error("territoire sans terrain");
  const props = [...v.props];
  // Murs effondrés, herbes hautes et broussailles autour des ruines ; charrettes abandonnées le long de la route.
  for (const b of v.buildings) {
    if (rand() < 0.5) props.push(prop(t, "murs_effondres", add2(v2(b.x, b.y), v2(range(rand, -10, 10), range(rand, -10, 10))), rand() * 6, range(rand, 0.8, 1.3), p.palette.pierre));
    for (let k = 0; k < 3; k++) props.push(prop(t, rand() < 0.6 ? "herbes_hautes" : "broussailles", add2(v2(b.x, b.y), v2(range(rand, -9, 9), range(rand, -9, 9))), rand() * 6, range(rand, 0.8, 1.6), p.palette.sol));
  }
  const road = t.roads[0];
  if (road) for (let k = 0; k < 6; k++) {
    const q = pointAt(road.path, range(rand, 50, road.path.length * 5));
    props.push(prop(t, "charrettes_abandonnees", add2(q.p, scale2(v2(-q.dir.y, q.dir.x), range(rand, -4, 4))), Math.atan2(q.dir.y, q.dir.x) + range(rand, -0.8, 0.8), 1, p.palette.bois));
  }
  for (let k = 0; k < 500; k++) {
    const q = v2(range(rand, -0.45, 0.45) * t.spec.size, range(rand, -0.45, 0.45) * t.spec.size);
    props.push(prop(t, "herbes_hautes", q, rand() * 6, range(rand, 0.8, 1.7), p.palette.sol));
  }
  // Titans : plus nombreux dans la variante « Titans nombreux ».
  const n = variant?.special === "titans_nombreux" ? 14 : 8;
  const titans: TitanPlacement[] = [];
  for (let k = 0; k < n; k++) {
    const a = range(rand, 0, Math.PI * 2);
    const r = range(rand, 40, 230);
    titans.push({ type: ROAMERS[k % ROAMERS.length] as string, variant: k % 5 === 4 ? "anormal" : null, x: Math.cos(a) * r, y: Math.sin(a) * r, angle: range(rand, 0, Math.PI * 2), pose: k % 6 === 5 ? "debout" : "marche", seed: derive(seed, 900 + k) });
  }
  const h = (q: Vec2): number => heightAt(t.heights, q.x, q.y);
  // Trois Titans entre la vue principale et le village : ils traversent le champ de la caméra.
  const eye = v2(-120, 150);
  const toward = v2(10, 10);
  for (const [k, f, side, type] of [
    [0, 0.42, 18, "classe_15"],
    [1, 0.55, -26, "classe_8"],
    [2, 0.68, 8, "classe_12"],
  ] as const) {
    const q = v2(eye.x + (toward.x - eye.x) * f + side, eye.y + (toward.y - eye.y) * f + side * 0.6);
    titans.push({ type, variant: k === 2 ? "anormal" : null, x: q.x, y: q.y, angle: Math.atan2(toward.x - q.x, toward.y - q.y) + side * 0.02, pose: k === 2 ? "course" : "marche", seed: derive(seed, 950 + k) });
  }
  return {
    ...v,
    props,
    titans,
    views: {
      principale: { eye: [-120, h(v2(-120, 150)) + 30, 150], target: [10, 6, 10], fov: 55 },
      seconde: { eye: [v.views.seconde.eye[0], v.views.seconde.eye[1] - 4, v.views.seconde.eye[2]], target: [0, 10, 120], fov: 60 },
    },
    radius: t.spec.size / 2,
  };
}
