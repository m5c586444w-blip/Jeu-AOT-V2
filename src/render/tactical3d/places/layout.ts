import type { Block, Building, Facade, Gabarit, Place, PlaceState, RoofCover, RoofForm, Species, Street } from "../../../data/placeSchema";
import type { P2, Poly2 } from "./geom";
import { wallFrameAt } from "./walls";
import { add, area, bbox, ccw, centroid, convexOverlap, cross, cycle, dist, dot, halton, hashStr, inset, inside, left, mul, polylineDist, polylineLength, rectPoly, sub, unit, along } from "./geom";

/**
 * Mise en place d'un lieu N1 (R1e) : du plan d'auteur aux instances (maisons, arbres), de façon déterministe.
 * - Maisons courantes : le long de chaque rive d'îlot, parcelles de largeurs données par le gabarit (suite parcourue en boucle),
 *   profondeur du gabarit bornée par la largeur de l'îlot ; les angles sont attribués à une seule rive (pas de recouvrement).
 *   Étages, toits, couvertures, façades et teintes suivent les suites du gabarit, avec des décalages différents : aucune
 *   répétition courte, aucun tirage.
 * - Cours : arbres semés (suite de Halton) dans l'îlot rétréci, au taux du gabarit ; parcelles laissées vides : jardins.
 * - Arbres d'alignement, de parc, de verger, isolés : positions du plan.
 * - Tronçons de 64 m : chaque instance porte son tronçon (culling, déchargement).
 */
export const CHUNK = 64;
export const chunkOf = (x: number, y: number): number => (Math.floor(x / CHUNK) + 1024) * 2048 + (Math.floor(y / CHUNK) + 1024);
export const chunkXY = (k: number): [number, number] => [(Math.floor(k / 2048) - 1024) * CHUNK, ((k % 2048) - 1024) * CHUNK];

export interface HouseInst {
  /** Îlot et rang dans l'îlot : identifiant stable (`ilot:k`), pour les deltas et l'état. */
  id: string;
  x: number;
  y: number;
  /** Direction de la façade sur rue (rad, sur le plan) ; la rue est du côté −n, n = normale gauche de la façade. */
  a: number;
  w: number;
  d: number;
  floors: number;
  fh: number;
  roof: RoofForm;
  pitch: number;
  cover: RoofCover;
  facade: Facade;
  tint: string;
  shop: boolean;
  corner: boolean;
  chunk: number;
  /** Ruine (0 intacte, 1 rasée), selon l'état. */
  ruin: number;
}

export type TreeSource = "rue" | "cour" | "jardin" | "parc" | "verger" | "isole" | "campagne";
export interface TreeInst2 {
  x: number;
  y: number;
  sp: Species;
  h: number;
  rot: number;
  src: TreeSource;
  chunk: number;
}

export interface BlockLayout {
  block: Block;
  houses: HouseInst[];
  /** Cour (îlot rétréci) ; null si l'îlot est trop étroit. */
  court: [number, number][] | null;
  /** Jardins des parcelles laissées vides (rectangles). */
  gardens: [number, number][][];
}

export interface PlaceLayout {
  place: Place;
  state: PlaceState;
  blocks: BlockLayout[];
  houses: HouseInst[];
  trees: TreeInst2[];
  landmarks: (Building & { chunk: number; ruin: number })[];
  chunks: number[];
}

/** Profondeur utile d'une rive : moitié de l'étendue de l'îlot perpendiculairement à la rive, bornée par le gabarit. */
function edgeDepth(P: Poly2, i: number, D: number): number {
  const a = P[i] as P2;
  const b = P[(i + 1) % P.length] as P2;
  const n = left(unit(sub(b, a)));
  let w = 0;
  for (const v of P) w = Math.max(w, dot(sub(v, a), n));
  if (w >= 2 * D + 4) return D;
  // Îlot étroit : deux rangs dos à dos (ou un seul rang pour un îlot très mince).
  return Math.max(3.5, Math.min(D, w < 12 ? w - 1 : w / 2 - 0.5));
}

/** Angle intérieur (rad) au sommet `i` d'un polygone dont l'intérieur est à gauche. */
function interiorAngle(P: Poly2, i: number): number {
  const p = P[(i - 1 + P.length) % P.length] as P2;
  const a = P[i] as P2;
  const b = P[(i + 1) % P.length] as P2;
  const u = unit(sub(p, a));
  const v = unit(sub(b, a));
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v))));
}

const PHI = 0.6180339887;
const frac = (x: number): number => x - Math.floor(x);

export function layoutBlock(block: Block, gab: Gabarit, isFront?: (p: P2, out: P2) => boolean): BlockLayout {
  const P = ccw(block.polygone);
  const n = P.length;
  const h = hashStr(block.id);
  const D0 = gab.profondeur_m;
  const depth = P.map((_, i) => edgeDepth(P, i, D0));
  const theta = P.map((_, i) => interiorAngle(P, i));
  const houses: HouseInst[] = [];
  const gardens: [number, number][][] = [];
  const polys: [number, number][][] = [];
  if (block.fonction === "jardin" || block.densite_bati <= 0) {
    return { block, houses, court: P.map((p) => [p[0], p[1]]), gardens };
  }
  let k = 0;
  let sinceGap = 0;
  // Décalages propres à l'îlot : deux îlots du même gabarit ne commencent pas leurs suites au même endroit.
  const off = (salt: number): number => (h >>> (salt * 3)) % 97;
  for (let i = 0; i < n; i++) {
    const a = P[i] as P2;
    const b = P[(i + 1) % n] as P2;
    const L = dist(a, b);
    const t = unit(sub(b, a));
    const nIn = left(t);
    const D = depth[i] as number;
    const Dprev = depth[(i - 1 + n) % n] as number;
    const Dnext = depth[(i + 1) % n] as number;
    const ta = theta[i] as number;
    const tb = theta[(i + 1) % n] as number;
    // Début : à un angle aigu, le fond de la première maison touche la rive précédente.
    const start = ta < Math.PI / 2 - 1e-3 ? D / Math.tan(ta) + 0.2 : 0;
    // Fin : la dernière maison s'arrête avant la bande de la rive suivante (qui possède l'angle).
    const c1 = (Dnext + Math.max(0, D * Math.cos(tb))) / Math.max(0.05, Math.sin(tb));
    const c2 = tb > Math.PI / 2 + 1e-3 ? D * Math.tan(Math.PI - tb) : Infinity;
    const end = L - Math.min(c1, c2) - 0.1;
    if (end - start < 3) continue;
    // Une rive tournée vers l'intérieur d'un grand espace (pas sur rue) peut rester sans boutiques.
    let s = start;
    let first = true;
    while (s < end - 2.5) {
      let w = cycle(gab.parcelles_m, k + off(1));
      if (first && ta > Math.PI / 3 && ta < (2 * Math.PI) / 3) w = Math.max(w, Dprev + 0.5);
      if (end - (s + w) < 3) w = end - s;
      w = Math.min(w, end - s);
      const kk = k;
      k++;
      // Passage vers la cour (porte cochère, ruelle) : une parcelle de 3 m laissée libre.
      if (gab.passage_m > 0 && sinceGap >= gab.passage_m && !first && end - s > 12) {
        sinceGap = 0;
        s += 3;
        continue;
      }
      sinceGap += w;
      const dk = D + cycle([0, -0.8, 0.6, -0.4, 0.9, 0.2], kk + off(2));
      const dd = Math.max(3.5, Math.min(D + 1, dk));
      const c = add(add(a, mul(t, s + w / 2)), mul(nIn, dd / 2));
      const keep = block.densite_bati >= 1 || frac(kk * PHI + (h % 1000) / 1000) < block.densite_bati;
      const poly = rectPoly(c, t, w / 2, dd / 2);
      if (!keep) {
        gardens.push(poly);
      } else if (!polys.some((q) => convexOverlap(q, poly, 0.05))) {
        polys.push(poly);
        const roofSeq = cycle(gab.toits, kk + off(3));
        const corner = first && ta < (2 * Math.PI) / 3;
        const roof: RoofForm = corner && (roofSeq === "pignon" || roofSeq === "pignon_rue") ? "croupe" : roofSeq;
        const [p0, p1] = gab.pente_deg;
        const out = mul(nIn, -1);
        houses.push({
          id: `${block.id}:${kk}`,
          x: c[0],
          y: c[1],
          a: Math.atan2(t[1], t[0]),
          w,
          d: dd,
          floors: cycle(gab.etages, kk + off(4)),
          fh: gab.hauteur_etage_m,
          roof,
          pitch: p0 + (p1 - p0) * frac(kk * 0.7548776662 + off(5) * 0.13),
          cover: cycle(gab.couvertures, kk + off(6)),
          facade: cycle(gab.facades, kk + off(7)),
          tint: cycle(gab.teintes, kk * 3 + off(8)),
          shop: gab.boutiques && (isFront ? isFront(add(a, mul(t, s + w / 2)), out) : true),
          corner,
          chunk: chunkOf(c[0], c[1]),
          ruin: 0,
        });
      }
      first = false;
      s += w;
    }
  }
  const dmax = Math.max(...depth);
  const court = inset(P, dmax + 1);
  return { block, houses, court: court.length >= 3 && area(court) >= 25 ? court : null, gardens };
}

/** Semis déterministe dans un polygone : points de Halton dans la boîte englobante, gardés à `gap` m les uns des autres. */
export function sow(poly: Poly2, count: number, salt: number, gap = 3, margin = 0): [number, number][] {
  if (count <= 0) return [];
  const zone = margin > 0 ? inset(poly, margin) : [...poly];
  if (zone.length < 3) return [];
  const bb = bbox(zone);
  const out: [number, number][] = [];
  const tries = count * 12 + 20;
  for (let i = 1; i <= tries && out.length < count; i++) {
    const p: [number, number] = [bb.minX + (bb.maxX - bb.minX) * halton(i + salt, 2), bb.minY + (bb.maxY - bb.minY) * halton(i + salt, 3)];
    if (!inside(zone, p)) continue;
    if (out.some((q) => dist(p, q) < gap)) continue;
    out.push(p);
  }
  return out;
}

/** Hauteur adulte d'une essence (m), de la plus basse à la plus haute de la fourchette (selon `k` ∈ [0, 1]). */
export const SPECIES_HEIGHT: Record<Species, [number, number]> = {
  tilleul: [14, 22],
  marronnier: [14, 20],
  chene: [16, 26],
  erable: [12, 20],
  peuplier: [20, 30],
  bouleau: [12, 18],
  pin: [15, 25],
  saule: [8, 14],
  fruitier: [5, 8],
  geant: [70, 90],
};
const treeH = (sp: Species, k: number): number => {
  const [a, b] = SPECIES_HEIGHT[sp];
  return a + (b - a) * k;
};

/** Grille de recherche (cases de `cell` m) pour les tests de voisinage. */
class Grid<T> {
  private readonly m = new Map<number, T[]>();
  constructor(private readonly cell: number) {}
  private key(x: number, y: number): number {
    return (Math.floor(x / this.cell) + 4096) * 8192 + Math.floor(y / this.cell) + 4096;
  }
  add(x: number, y: number, v: T): void {
    const k = this.key(x, y);
    const l = this.m.get(k);
    if (l) l.push(v);
    else this.m.set(k, [v]);
  }
  near(x: number, y: number): T[] {
    const out: T[] = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const v of this.m.get(this.key(x + i * this.cell, y + j * this.cell)) ?? []) out.push(v);
    return out;
  }
}

/** Appartenance d'une maison à une ruine d'état : tirage fixe par maison (son identifiant), au taux de la zone. */
function ruinOf(state: PlaceState, id: string, p: P2): number {
  for (const r of state.ruines) {
    if (!inside(r.polygone, p)) continue;
    const u = (hashStr(`${state.id}|${id}`) % 10000) / 10000;
    if (u < r.part) return 0.45 + 0.55 * frac(u * 7.77);
  }
  return 0;
}

export function stateOf(place: Place, stateId?: string | null): PlaceState {
  const s = place.etats.find((e) => e.id === (stateId ?? place.etat_defaut)) ?? place.etats.find((e) => e.id === place.etat_defaut) ?? place.etats[0];
  if (!s) throw new Error(`lieu ${place.id} : aucun état`);
  return s;
}

export function layoutPlace(place: Place, stateId?: string | null): PlaceLayout {
  const state = stateOf(place, stateId);
  const streets = place.rues;
  const streetGrid = new Grid<Street>(48);
  for (const r of streets) {
    for (let i = 0; i < r.trace.length; i++) {
      const p = r.trace[i] as P2;
      streetGrid.add(p[0], p[1], r);
      const q = r.trace[i + 1];
      if (q) {
        const L = dist(p, q);
        for (let s = 24; s < L; s += 24) {
          const m = add(p, mul(unit(sub(q, p)), s));
          streetGrid.add(m[0], m[1], r);
        }
      }
    }
  }
  // Boutiques : seulement sur une rive bordée par une rue (pas sur un jardin ou un mur).
  const isFront = (p: P2, out: P2): boolean => {
    const probe = add(p, mul(out, 4));
    return streetGrid.near(probe[0], probe[1]).some((r) => polylineDist(probe, r.trace) < r.largeur_m / 2 + 3);
  };
  const blocks = place.ilots.map((b) => {
    const g = place.gabarits[b.gabarit];
    if (!g) throw new Error(`lieu ${place.id} : gabarit inconnu ${b.gabarit}`);
    return layoutBlock(b, g, isFront);
  });
  // Les bâtiments repères prennent la place des maisons courantes qu'ils recouvrent (emprise élargie de 2 m).
  const marks = place.batiments.map((b) => {
    const a = (b.angle_deg * Math.PI) / 180;
    return rectPoly(b.position, [Math.cos(a), Math.sin(a)], b.emprise_m[0] / 2 + 2, b.emprise_m[1] / 2 + 2);
  });
  const free = (hh: HouseInst): boolean => {
    const poly = rectPoly([hh.x, hh.y], [Math.cos(hh.a), Math.sin(hh.a)], hh.w / 2, hh.d / 2);
    return !marks.some((m) => convexOverlap(m, poly, 0.05));
  };
  for (const bl of blocks) bl.houses = bl.houses.filter(free);
  const houses = blocks.flatMap((b) => b.houses);
  for (const hh of houses) hh.ruin = ruinOf(state, hh.id, [hh.x, hh.y]);
  const houseGrid = new Grid<HouseInst>(32);
  for (const hh of houses) houseGrid.add(hh.x, hh.y, hh);

  const trees: TreeInst2[] = [];
  const treeGrid = new Grid<TreeInst2>(16);
  const tooClose = (p: P2, gap: number): boolean => treeGrid.near(p[0], p[1]).some((t) => dist(p, [t.x, t.y]) < gap);
  const inHouse = (p: P2, margin: number): boolean =>
    houseGrid.near(p[0], p[1]).some((hh) => {
      const u: P2 = [Math.cos(hh.a), Math.sin(hh.a)];
      const r = sub(p, [hh.x, hh.y]);
      return Math.abs(dot(r, u)) < hh.w / 2 + margin && Math.abs(cross(u, r)) < hh.d / 2 + margin;
    });
  const push = (p: P2, sp: Species, src: TreeSource, salt: number, gap = 3.5): void => {
    if (tooClose(p, gap)) return;
    const k = frac(salt * PHI + p[0] * 0.013 + p[1] * 0.007);
    const t: TreeInst2 = { x: p[0], y: p[1], sp, h: treeH(sp, k), rot: frac(salt * 0.7548776662) * Math.PI * 2, src, chunk: chunkOf(p[0], p[1]) };
    trees.push(t);
    treeGrid.add(p[0], p[1], t);
  };

  // Arbres isolés et de parcs (placés par l'auteur), puis alignements, vergers, cours, jardins.
  place.vegetation.isoles.forEach((t, i) => {
    const k = frac(i * PHI);
    const tr: TreeInst2 = { x: t.position[0], y: t.position[1], sp: t.essence, h: t.hauteur_m, rot: k * Math.PI * 2, src: "isole", chunk: chunkOf(t.position[0], t.position[1]) };
    trees.push(tr);
    treeGrid.add(tr.x, tr.y, tr);
  });
  for (const park of place.vegetation.parcs) {
    const count = Math.round((area(park.polygone) / 10000) * park.arbres_par_ha);
    sow(park.polygone, count, hashStr(park.id) % 500, 4, 1.5).forEach((p, i) => push(p, cycle(park.essences, i * 3 + (i >> 2)), "parc", i, 3.5));
  }
  // Abords des portes dégagés : aucun arbre d'alignement à moins de 45 m d'une porte (vues des portes, passage des convois).
  const gateSpots: P2[] = place.enceinte
    ? place.portes.flatMap((g) => {
        const tr = place.enceinte?.traces.find((x) => x.id === g.trace);
        return tr ? [wallFrameAt(tr, g.s_m).p] : [];
      })
    : [];
  const nearGate = (q: P2): boolean => gateSpots.some((gp) => dist(q, gp) < 45);
  for (const al of place.vegetation.alignements) {
    const r = streets.find((x) => x.id === al.rue);
    if (!r) continue;
    const L = polylineLength(r.trace);
    const off = r.largeur_m / 2 - 1.6;
    if (off < 1.5) continue;
    let i = 0;
    for (let s = al.intervalle_m / 2; s < L; s += al.intervalle_m, i++) {
      const { p, d } = along(r.trace, s);
      const sides = al.cotes === "deux" ? [-1, 1] : al.cotes === "gauche" ? [-1] : [1];
      for (const side of sides) {
        const q = add(p, mul(left(d), side * off));
        // Pas d'arbre dans un carrefour ni contre une façade.
        if (streetGrid.near(q[0], q[1]).some((o) => o !== r && polylineDist(q, o.trace) < o.largeur_m / 2 + 2)) continue;
        if (inHouse(q, 1.2) || nearGate(q)) continue;
        push(q, al.essence, "rue", i * 2 + (side > 0 ? 1 : 0), 4);
      }
    }
  }
  place.vegetation.vergers.forEach((v, vi) => {
    const P = ccw(v.polygone);
    // Rangs parallèles à la plus longue rive.
    let best = 0;
    for (let i = 0; i < P.length; i++) if (dist(P[i] as P2, P[(i + 1) % P.length] as P2) > dist(P[best] as P2, P[(best + 1) % P.length] as P2)) best = i;
    const t = unit(sub(P[(best + 1) % P.length] as P2, P[best] as P2));
    const nn = left(t);
    const o = P[best] as P2;
    const bb = bbox(P.map((p) => [dot(sub(p, o), t), dot(sub(p, o), nn)] as [number, number]));
    const e = v.espacement_m;
    let i = 0;
    for (let a = bb.minX + e / 2; a < bb.maxX; a += e) {
      for (let b = bb.minY + e / 2; b < bb.maxY; b += e) {
        const p = add(add(o, mul(t, a)), mul(nn, b));
        if (inside(P, p)) push(p, "fruitier", "verger", vi * 1000 + i++, e * 0.6);
      }
    }
  });
  const courtSpecies = place.vegetation.essences_cours;
  blocks.forEach((bl, bi) => {
    const g = place.gabarits[bl.block.gabarit] as Gabarit;
    const garden = bl.block.fonction === "jardin" || g.cour.type === "jardin";
    if (bl.court && g.cour.arbres_par_ha > 0) {
      const a = area(bl.court);
      const count = Math.max(a > 60 ? 1 : 0, Math.round((a / 10000) * g.cour.arbres_par_ha));
      sow(bl.court, count, (hashStr(bl.block.id) % 997) + bi, 4.5, 1.5).forEach((p, i) => {
        if (!inHouse(p, 1)) push(p, garden && i % 3 !== 0 ? "fruitier" : cycle(courtSpecies, i + bi), garden ? "jardin" : "cour", bi * 31 + i, 4);
      });
    }
    bl.gardens.forEach((gp, gi) => {
      const c = centroid(gp);
      if (!inHouse(c, 0.5)) push(c, gi % 2 ? "fruitier" : cycle(courtSpecies, gi + bi), "jardin", bi * 17 + gi, 4);
    });
    // Abandon (état du lieu) : végétation spontanée dans les îlots — bouleaux, saules et frênes de friche, 60 par ha à
    // l'abandon complet.
    if (state.abandon > 0) {
      const n = Math.round((area(bl.block.polygone) / 10000) * 60 * state.abandon);
      sow(bl.block.polygone, n, (hashStr(bl.block.id) % 991) + 7, 4, 2).forEach((p, i) => {
        if (!inHouse(p, 0.8)) push(p, i % 3 === 0 ? "saule" : "bouleau", "jardin", bi * 53 + i + 7, 3.5);
      });
    }
  });

  const landmarks = place.batiments.map((b) => ({ ...b, chunk: chunkOf(b.position[0], b.position[1]), ruin: ruinOf(state, b.id, b.position) }));
  // Pas d'arbre dans l'emprise d'un bâtiment repère.
  const lmPolys = landmarks.map((b) => {
    const a = (b.angle_deg * Math.PI) / 180;
    return rectPoly(b.position, [Math.cos(a), Math.sin(a)], b.emprise_m[0] / 2 + 1, b.emprise_m[1] / 2 + 1);
  });
  const keptTrees = trees.filter((t) => !lmPolys.some((p) => inside(p, [t.x, t.y])));
  const chunks = [...new Set([...houses.map((x) => x.chunk), ...keptTrees.map((x) => x.chunk), ...landmarks.map((x) => x.chunk)])].sort((a, b) => a - b);
  return { place, state, blocks, houses, trees: keptTrees, landmarks, chunks };
}

// ——— Mesures (CR1e-03, CR1e-04 ; définitions de docs/phases/R1e.md §2) ———

export interface ZoneMetrics {
  zone: string;
  classe: string;
  population: number;
  densite: number;
  /** Surface bâtie attendue (population ÷ densité) et mesurée (îlots + rues), en ha ; écart relatif. */
  cible_ha: number;
  batie_ha: number;
  ecart: number;
  ilots_ha: number;
  rues_ha: number;
  /** Arbres dans la zone (hors parcs) par hectare bâti. */
  arbres: number;
  arbres_par_ha_bati: number;
  /** Arbres des îlots (cours, jardins) par hectare d'îlot. */
  arbres_ilots_par_ha: number;
}

export interface PlaceMetrics {
  zones: ZoneMetrics[];
  parcs: { id: string; ha: number; arbres: number; par_ha: number }[];
  maisons: number;
  arbres: number;
  places_exclues_ha: number;
}

/** Mesures d'un lieu ; `populations` : population de chaque zone (`principal` et ids de `zones[]`), lue dans la simulation. */
export function placeMetrics(L: PlaceLayout, populations: Record<string, number>): PlaceMetrics {
  const place = L.place;
  const zoneDefs = [
    { id: "principal", classe: place.densite.classe, densite: place.densite.valeur, polygone: place.perimetre },
    ...place.zones.map((z) => ({ id: z.id, classe: z.densite.classe, densite: z.densite.valeur, polygone: z.polygone })),
  ];
  const zoneOf = (p: P2): string | null => {
    // Les zones annexes priment (elles peuvent être dans le périmètre d'emprise).
    for (const z of zoneDefs.slice(1)) if (inside(z.polygone, p)) return z.id;
    return inside(place.perimetre, p) ? "principal" : null;
  };
  const blockZone = (b: Block): string | null => b.zone ?? zoneOf(centroid(b.polygone));
  const parks = place.vegetation.parcs;
  const inPark = (p: P2): boolean => parks.some((k) => inside(k.polygone, p));
  const bigSquares = place.places_publiques.filter((s) => area(s.polygone) > 5000);
  const zones = zoneDefs.map((z) => {
    const blocks = place.ilots.filter((b) => blockZone(b) === z.id);
    const ilots = blocks.reduce((s, b) => s + area(b.polygone), 0);
    let rues = 0;
    for (const r of place.rues) {
      for (let i = 1; i < r.trace.length; i++) {
        const a = r.trace[i - 1] as P2;
        const b = r.trace[i] as P2;
        const m: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (zoneOf(m) === z.id && !bigSquares.some((s) => inside(s.polygone, m))) rues += dist(a, b) * r.largeur_m;
      }
    }
    const small = place.places_publiques.filter((s) => area(s.polygone) <= 5000 && zoneOf(centroid(s.polygone)) === z.id).reduce((s, q) => s + area(q.polygone), 0);
    const batie = (ilots + rues + small) / 10000;
    const pop = populations[z.id] ?? 0;
    const cible = pop / z.densite;
    const trees = L.trees.filter((t) => zoneOf([t.x, t.y]) === z.id && !inPark([t.x, t.y]));
    const blockTrees = L.trees.filter((t) => (t.src === "cour" || t.src === "jardin") && zoneOf([t.x, t.y]) === z.id);
    return {
      zone: z.id,
      classe: z.classe,
      population: pop,
      densite: z.densite,
      cible_ha: cible,
      batie_ha: batie,
      ecart: cible > 0 ? (batie - cible) / cible : 0,
      ilots_ha: ilots / 10000,
      rues_ha: (rues + small) / 10000,
      arbres: trees.length,
      arbres_par_ha_bati: batie > 0 ? trees.length / batie : 0,
      arbres_ilots_par_ha: ilots > 0 ? blockTrees.length / (ilots / 10000) : 0,
    };
  });
  const parcs = parks.map((k) => {
    const ha = area(k.polygone) / 10000;
    const n = L.trees.filter((t) => inside(k.polygone, [t.x, t.y])).length;
    return { id: k.id, ha, arbres: n, par_ha: ha > 0 ? n / ha : 0 };
  });
  return { zones, parcs, maisons: L.houses.length, arbres: L.trees.length, places_exclues_ha: bigSquares.reduce((s, q) => s + area(q.polygone), 0) / 10000 };
}

/** Longueur totale de rue par type (m), pour les rapports. */
export function streetLengths(place: Place): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of place.rues) out[r.type] = (out[r.type] ?? 0) + polylineLength(r.trace);
  return out;
}


