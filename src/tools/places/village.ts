import type { Archetype, Culture, Facade, FrozenPlan, RoofCover, RoofForm, Species } from "../../data/placeSchema";
import { seeded } from "../../render/tactical3d/rng";
import type { Rand } from "../../render/tactical3d/rng";
import { Q_H, Q_POS, frozenHash } from "../../render/tactical3d/places/frozen";

/**
 * Générateur de village N2 (R1e, consigne §4) — lancé une fois par lieu, puis le plan est figé dans
 * `data/places/generated/<id>.json` et n'est plus regénéré (sauf `npm run places:regenerer -- <id>`).
 * Parti [A] : un village-rue sur une route qui serpente, une route secondaire qui la croise, un pré communal avec la chapelle
 * et le puits au croisement ; maisons alignées sur la rue (façade parallèle), jardins et fruitiers derrière, fermes et
 * granges en bout de village ; tout autour, une couronne de champs en lanières (blé, orge, jachère, labour, prairie),
 * vergers et haies. Population : celle de la simulation × part ; un foyer de 4,6 personnes par maison [A].
 */
export const VILLAGE_VERSION = 1;

export interface VillageSpec {
  id: string;
  nom: string;
  libelle: string;
  canon: FrozenPlan["canon"];
  province: string | null;
  style: string;
  graine: number;
  population: number;
}

const ARCH: Archetype[] = ["maison", "ferme", "grange", "chapelle"];
const ROOFS: RoofForm[] = ["pignon", "demi_croupe", "croupe", "appentis"];
const COVERS: RoofCover[] = ["chaume", "tuile_plate", "bardeau", "ardoise", "tuile_canal"];
const FACADES_V: Facade[] = ["colombage", "enduit", "bois", "pierre_brute"];
const TINTS = ["#D8CCB4", "#CDBF9F", "#E2D6BF", "#C7B898", "#D9C9AA", "#E6DAC2", "#CBB994", "#DCCFB2"];
const SPECIES_V: Species[] = ["fruitier", "tilleul", "chene", "peuplier", "saule", "bouleau", "erable"];
const CULT: Culture[] = ["ble", "orge", "jachere", "labour", "prairie", "ble", "orge", "prairie"];

type P = [number, number];
const q = (v: number): number => Math.round(v * Q_POS);

/** Polyligne lisse de la route : points d'appui décalés au hasard, puis échantillonnée tous les 4 m. */
function road(r: Rand, from: P, to: P, wiggle: number): P[] {
  const n = 5;
  const ctrl: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const nx = -(to[1] - from[1]);
    const ny = to[0] - from[0];
    const L = Math.hypot(nx, ny);
    const off = i === 0 || i === n ? 0 : (r() - 0.5) * 2 * wiggle;
    ctrl.push([from[0] + (to[0] - from[0]) * t + (nx / L) * off, from[1] + (to[1] - from[1]) * t + (ny / L) * off]);
  }
  // Catmull-Rom.
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[Math.max(0, i - 1)] as P;
    const p1 = ctrl[i] as P;
    const p2 = ctrl[i + 1] as P;
    const p3 = ctrl[Math.min(n, i + 2)] as P;
    const seg = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 4));
    for (let k = 0; k < seg; k++) {
      const t = k / seg;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number): number => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[n] as P);
  return out;
}

interface Slot {
  x: number;
  y: number;
  /** Direction de la rue (rad). */
  a: number;
  /** Côté (+1 gauche, −1 droite). */
  side: number;
  dist: number;
}

/** Emplacements le long d'une route, des deux côtés, tous les `step` m (pas variable). */
function slots(r: Rand, line: P[], centre: P): Slot[] {
  const out: Slot[] = [];
  let acc = 0;
  let next = 8 + r() * 8;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as P;
    const b = line[i] as P;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (acc + L >= next) {
      const t = (next - acc) / L;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (const side of [1, -1]) out.push({ x, y, a: ang, side, dist: Math.hypot(x - centre[0], y - centre[1]) });
      next += 13 + r() * 12;
    }
    acc += L;
  }
  return out;
}

export function generateVillage(spec: VillageSpec): FrozenPlan {
  const r = seeded(spec.graine);
  const houses = Math.max(12, Math.round(spec.population / 4.6));
  const span = 260 + Math.sqrt(houses) * 34;
  const main = road(r, [-span, (r() - 0.5) * 80], [span, (r() - 0.5) * 80], 45);
  const cross = road(r, [(r() - 0.5) * 40, -span * 0.7], [(r() - 0.5) * 40, span * 0.7], 30);
  // Croisement : point de la route principale le plus proche de la route secondaire.
  let centre: P = [0, 0];
  let best = Infinity;
  for (const p of main)
    for (const c of cross) {
      const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
      if (d < best) {
        best = d;
        centre = [p[0], p[1]];
      }
    }
  const b: number[][] = [];
  const t: number[][] = [];
  const addTree = (x: number, y: number, sp: Species, h: number): void => {
    t.push([q(x), q(y), SPECIES_V.indexOf(sp), Math.round(h * Q_H)]);
  };
  const addB = (x: number, y: number, a: number, w: number, d: number, h: number, arch: Archetype, roof: number, cover: number, facade: number, tint: number): void => {
    b.push([q(x), q(y), Math.round((a * 180) / Math.PI), q(w), q(d), Math.round(h * Q_H), ARCH.indexOf(arch), roof, cover, facade, tint]);
  };
  // Chapelle et pré communal au croisement (rien n'y est bâti dans un rayon de 30 m).
  const ca = Math.atan2((main[main.length - 1] as P)[1] - (main[0] as P)[1], (main[main.length - 1] as P)[0] - (main[0] as P)[0]);
  addB(centre[0] + Math.cos(ca + Math.PI / 2) * 24, centre[1] + Math.sin(ca + Math.PI / 2) * 24, ca, 9, 18, 7.5, "chapelle", 0, 3, 3, 1);
  for (let k = 0; k < 4; k++) addTree(centre[0] + Math.cos(ca + k * 1.57 + 0.4) * 17, centre[1] + Math.sin(ca + k * 1.57 + 0.4) * 17, k % 2 ? "tilleul" : "chene", 14 + r() * 8);
  // Maisons : emplacements les plus proches du centre d'abord.
  const all = [...slots(r, main, centre), ...slots(r, cross, centre)].filter((s) => s.dist > 30).sort((x, y) => x.dist - y.dist);
  const taken: { x: number; y: number; rad: number }[] = [];
  let n = 0;
  for (const s of all) {
    if (n >= houses) break;
    const farm = s.dist > span * 0.55 && r() < 0.45;
    const w = farm ? 13 + r() * 6 : 7 + r() * 4;
    const d = farm ? 9 + r() * 3 : 7 + r() * 3;
    const setback = 3 + r() * 4;
    const nx = -Math.sin(s.a) * s.side;
    const ny = Math.cos(s.a) * s.side;
    const x = s.x + nx * (setback + d / 2 + 3);
    const y = s.y + ny * (setback + d / 2 + 3);
    const rad = Math.hypot(w, d) / 2 + 2;
    if (taken.some((o) => Math.hypot(o.x - x, o.y - y) < o.rad + rad)) continue;
    // La route passe-t-elle trop près (autre route) ?
    if ([...main, ...cross].some((p) => Math.hypot(p[0] - x, p[1] - y) < d / 2 + 3.5)) continue;
    taken.push({ x, y, rad });
    const floors = farm ? 1 : r() < 0.55 ? 1 : 2;
    const h = floors * (2.9 + r() * 0.5);
    // Façade sur rue : l'angle de la maison suit la rue ; la rue est du côté −n (convention des lieux).
    const a = s.side > 0 ? s.a : s.a + Math.PI;
    addB(x, y, a, w, d, h, farm ? "ferme" : "maison", Math.floor(r() * 3), farm ? (r() < 0.6 ? 0 : 2) : Math.floor(r() * 5), Math.floor(r() * 4), Math.floor(r() * TINTS.length));
    n++;
    // Grange derrière une ferme ; jardin et fruitiers derrière une maison.
    const bx = x + nx * (d / 2 + 12);
    const by = y + ny * (d / 2 + 12);
    if (farm) {
      if (!taken.some((o) => Math.hypot(o.x - bx, o.y - by) < o.rad + 10)) {
        taken.push({ x: bx, y: by, rad: 11 });
        addB(bx, by, a, 16 + r() * 6, 10 + r() * 3, 5 + r() * 2, "grange", 0, r() < 0.5 ? 0 : 2, 2, Math.floor(r() * TINTS.length));
      }
    } else {
      const k = 1 + Math.floor(r() * 2);
      for (let i = 0; i < k; i++) addTree(bx + (r() - 0.5) * 10, by + (r() - 0.5) * 8, "fruitier", 5 + r() * 3);
    }
  }
  // Arbres d'alignement par endroits le long de la route principale ; grands arbres isolés.
  main.forEach((p, i) => {
    if (i % 6 === 0 && Math.abs(p[0] - centre[0]) > span * 0.45) addTree(p[0], p[1] + 7, "peuplier", 18 + r() * 6);
  });
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2;
    const rr = span * (0.4 + r() * 0.5);
    addTree(centre[0] + Math.cos(a) * rr, centre[1] + Math.sin(a) * rr, r() < 0.5 ? "chene" : "tilleul", 16 + r() * 8);
  }
  // Couronne de champs en lanières (16 secteurs × 2 couronnes), vergers, haies d'arbres en limite de champs.
  const R0 = span * 0.62;
  const R1 = span * 1.05;
  const R2 = span * 1.45;
  const champs: FrozenPlan["champs"] = [];
  for (let k = 0; k < 16; k++) {
    const a0 = (k / 16) * Math.PI * 2 + 0.02;
    const a1 = ((k + 1) / 16) * Math.PI * 2 - 0.02;
    for (const [ra, rb] of [[R0, R1], [R1 + 6, R2]] as const) {
      const cult = (CULT[Math.floor(r() * CULT.length)] ?? "ble") as Culture;
      const poly: [number, number][] = [];
      for (let s = 0; s <= 4; s++) poly.push([q(centre[0] + Math.cos(a0 + ((a1 - a0) * s) / 4) * ra), q(centre[1] + Math.sin(a0 + ((a1 - a0) * s) / 4) * ra)]);
      for (let s = 4; s >= 0; s--) poly.push([q(centre[0] + Math.cos(a0 + ((a1 - a0) * s) / 4) * rb), q(centre[1] + Math.sin(a0 + ((a1 - a0) * s) / 4) * rb)]);
      const verger = ra === R0 && k % 5 === 2;
      champs.push({ polygone: poly, culture: verger ? "verger" : cult });
      if (verger) {
        for (let i = 0; i < 40; i++) {
          const aa = a0 + (a1 - a0) * (0.1 + 0.8 * r());
          const rr = ra + (rb - ra) * (0.1 + 0.8 * r());
          addTree(centre[0] + Math.cos(aa) * rr, centre[1] + Math.sin(aa) * rr, "fruitier", 4.5 + r() * 2);
        }
      }
    }
    // Haie : arbres sur la limite du secteur.
    for (let i = 0; i < 6; i++) {
      const rr = R0 + (R2 - R0) * (i / 6);
      if (r() < 0.6) addTree(centre[0] + Math.cos(a0) * rr, centre[1] + Math.sin(a0) * rr, r() < 0.5 ? "chene" : "erable", 11 + r() * 6);
    }
  }
  const rues: FrozenPlan["rues"] = [
    { trace: main.filter((_, i) => i % 3 === 0 || i === main.length - 1).map(([x, y]) => [q(x), q(y)] as [number, number]), largeur: 7, revetement: "terre" },
    { trace: cross.filter((_, i) => i % 3 === 0 || i === cross.length - 1).map(([x, y]) => [q(x), q(y)] as [number, number]), largeur: 5, revetement: "terre" },
  ];
  const plan: FrozenPlan = {
    id: spec.id,
    nom: spec.nom,
    libelle: spec.libelle,
    canon: spec.canon,
    niveau: "N2",
    generateur: { nom: "village", version: VILLAGE_VERSION, graine: spec.graine },
    province: spec.province,
    style: spec.style,
    population: spec.population,
    capacite: n * 6,
    etendue_m: Math.round(2 * R2 + 300),
    archetypes: ARCH,
    toits: ROOFS,
    couvertures: COVERS,
    facades: FACADES_V,
    teintes: TINTS,
    essences: SPECIES_V,
    rues,
    b,
    t,
    champs,
    empreinte: "",
  };
  plan.empreinte = frozenHash(plan);
  return plan;
}
