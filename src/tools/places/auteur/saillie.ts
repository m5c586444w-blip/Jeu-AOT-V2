import type { Block, Building, Gabarit, Gate, Place, Species, Street } from "../../../data/placeSchema";
import type { P2 } from "../../../render/tactical3d/places/geom";
import { area, centroid, clipHalf, dot } from "../../../render/tactical3d/places/geom";
import { outsideStrip, polar, pt, r1, ringLine, roundPoly } from "./kit";

/**
 * District en saillie (R1e.5, puis LC-B et LC-C) — outil des plans d'auteur : un district bâti dans un demi-cercle qui sort
 * du mur (forme des districts établie [C] pour Shiganshina et Trost ; rayon déduit de la population, Q4), porte intérieure
 * dans le mur (x = 0, y = 0), porte extérieure au sommet de la saillie (x = 0, y = R), axe principal entre les deux.
 * Le tracé des îlots est un damier d'auteur (lignes données une à une, largeurs propres, rotation éventuelle : un damier
 * oblique est recoupé par l'axe principal en îlots triangulaires), découpé par le cercle du rempart ; places et parcs sont
 * des cellules réclamées (plusieurs cellules du même identifiant sont fusionnées et les rues entre elles disparaissent).
 * Tout ce que l'outil produit est [A] sauf ce que la fiche du district déclare autrement.
 * Repère du plan : mètres, x vers l'est, y vers le sud (vers l'extérieur de la saillie), comme Shiganshina.
 */
export const MUR_Y = 25;

export interface Quarter {
  id: string;
  nom: string;
  gabarit: string;
  fonction: Block["fonction"];
  densite: number;
}
export const quarter = (id: string, nom: string, gabarit: string, fonction: Block["fonction"], densite = 1): Quarter => ({ id, nom, gabarit, fonction, densite });

export type Claim =
  | { kind: "place"; id: string; nom: string; revetement: Street["revetement"]; fontaine: boolean; marche: boolean }
  | { kind: "parc"; id: string; nom: string; essences: Species[]; arbres_par_ha: number }
  | { kind: "ilot"; fonction?: Block["fonction"]; gabarit?: string; quartier?: string; densite?: number }
  | { kind: "vide" };

export interface Ctx {
  R: number;
  rampart: number;
  /** Point du damier (s, t) en coordonnées du plan. */
  at(s: number, t: number): [number, number];
  /** Centre de la cellule (i, j) du damier (rectangle entre ses rues). */
  cell(i: number, j: number): [number, number];
  /** Angle des rives du damier (degrés) : angle des bâtiments alignés sur les rues. */
  rot: number;
  /** Abscisse curviligne d'un angle de la saillie (0 = est, 90 = porte extérieure). */
  sArc(deg: number): number;
}

export interface SaillieSpec {
  id: string;
  nom: string;
  libelle: string;
  canon: Place["canon"];
  sources: Place["sources"];
  province: string | null;
  style: string;
  mur: "maria" | "rose" | "sina";
  population: Place["population"];
  densite: Place["densite"];
  orientation: Place["orientation"];
  R: number;
  grid: {
    rot: number;
    /** Lignes parallèles à l'axe t (s constant) et à l'axe s (t constant), avec leur largeur. */
    s: readonly (readonly [number, number])[];
    t: readonly (readonly [number, number])[];
  };
  main: { nom: string; largeur_m: number };
  names: { s: readonly string[]; t: readonly string[]; lanes: readonly string[]; placettes: readonly string[] };
  gabarits: Record<string, Gabarit>;
  quarters: Record<string, Quarter>;
  /** Identifiant du quartier d'une cellule (centre `c`). */
  quarterAt(c: P2, i: number, j: number, ctx: Ctx): string;
  claims: Record<string, Claim>;
  /** Cellules (hors réclamations) changées en placettes : une liste d'indices « i,j ». */
  placettes: readonly string[];
  faubourg: {
    nom: string;
    population: Place["population"];
    densite: Place["densite"];
    xs: readonly number[];
    ys: readonly number[];
    gabarit: string;
    quarter: Quarter;
    names: readonly string[];
  } | null;
  batiments(ctx: Ctx): Building[];
  vegetation(ctx: Ctx, parcs: Place["vegetation"]["parcs"]): Place["vegetation"];
  eau(ctx: Ctx): Place["eau"];
  extraStreets?(ctx: Ctx): Street[];
  points_de_vue(ctx: Ctx): Place["points_de_vue"];
  etats(ctx: Ctx): Place["etats"];
  portes?(ctx: Ctx, base: (o: Partial<Gate> & Pick<Gate, "id" | "nom" | "role" | "trace" | "s_m">) => Gate): Gate[];
  canons_m?: number;
  etendue_m?: number;
}

/** Coupe le segment a → b à la région de la saillie (y ≥ ymin, |p| ≤ rr) ; null s'il n'en reste presque rien. */
function clipSeg(a: P2, b: P2, ymin: number, rr: number): [[number, number], [number, number]] | null {
  const d: P2 = [b[0] - a[0], b[1] - a[1]];
  let u0 = 0;
  let u1 = 1;
  if (Math.abs(d[1]) < 1e-9) {
    if (a[1] < ymin) return null;
  } else {
    const u = (ymin - a[1]) / d[1];
    if (d[1] > 0) u0 = Math.max(u0, u);
    else u1 = Math.min(u1, u);
  }
  const A = dot(d, d);
  const B = 2 * dot(a, d);
  const C = dot(a, a) - rr * rr;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return null;
  const sq = Math.sqrt(disc);
  u0 = Math.max(u0, (-B - sq) / (2 * A));
  u1 = Math.min(u1, (-B + sq) / (2 * A));
  if (u1 - u0 < 1e-6 || (u1 - u0) * Math.sqrt(A) < 6) return null;
  return [pt(a[0] + d[0] * u0, a[1] + d[1] * u0), pt(a[0] + d[0] * u1, a[1] + d[1] * u1)];
}

/** Disque (polygone convexe à 96 côtés) : découpe d'une cellule par le rempart. */
function clipDisc(poly: [number, number][], rr: number): [number, number][] {
  let out = poly;
  for (let k = 0; k < 96 && out.length >= 3; k++) {
    const a = (k / 96) * Math.PI * 2;
    const n: P2 = [-Math.cos(a), -Math.sin(a)];
    out = clipHalf(out, n, -rr * Math.cos(Math.PI / 96));
  }
  return out;
}

export function buildSaillie(spec: SaillieSpec): Place {
  const R = spec.R;
  const RAMPART = R - 25;
  const RR = RAMPART - 5 - 1.2;
  const yCut = MUR_Y + 5 + 1.2;
  const th = (spec.grid.rot * Math.PI) / 180;
  const S: P2 = [Math.cos(th), Math.sin(th)];
  const T: P2 = [-Math.sin(th), Math.cos(th)];
  const at = (s: number, t: number): [number, number] => [S[0] * s + T[0] * t, S[1] * s + T[1] * t];
  const sl = spec.grid.s;
  const tl = spec.grid.t;
  const ctx: Ctx = {
    R,
    rampart: RAMPART,
    at: (s, t) => pt(...at(s, t)),
    cell: (i, j) => {
      const s = (((sl[i] as readonly [number, number])[0] + (sl[i + 1] as readonly [number, number])[0]) / 2);
      const t = (((tl[j] as readonly [number, number])[0] + (tl[j + 1] as readonly [number, number])[0]) / 2);
      return pt(...at(s, t));
    },
    rot: spec.grid.rot,
    sArc: (deg) => r1((R * deg * Math.PI) / 180),
  };
  const mainOnGrid = spec.grid.rot === 0 && sl.some(([s]) => Math.abs(s) < 0.5);
  const claimOf = (i: number, j: number): Claim | undefined => spec.claims[`${i},${j}`];
  const mergedId = (i: number, j: number): string | null => {
    const c = claimOf(i, j);
    return c && (c.kind === "place" || c.kind === "parc") ? c.id : null;
  };

  // ——— Rues du damier : segment par segment (rien entre deux cellules d'une même place ou d'un même parc) ———
  const rues: Street[] = [];
  let lane = 0;
  const lineStreets = (axis: "s" | "t"): void => {
    const lines = axis === "s" ? sl : tl;
    const cross = axis === "s" ? tl : sl;
    const names = axis === "s" ? spec.names.s : spec.names.t;
    let named = 0;
    lines.forEach(([v, w], k) => {
      if (axis === "s" && mainOnGrid && Math.abs(v) < 0.5) return;
      if (axis === "t" && spec.grid.rot === 0 && Math.abs(v - MUR_Y) < 1) return;
      const segs: [[number, number], [number, number]][] = [];
      for (let j = 0; j + 1 < cross.length; j++) {
        const m0 = axis === "s" ? mergedId(k - 1, j) : mergedId(j, k - 1);
        const m1 = axis === "s" ? mergedId(k, j) : mergedId(j, k);
        if (m0 !== null && m0 === m1) continue;
        const c0 = (cross[j] as readonly [number, number])[0];
        const c1 = (cross[j + 1] as readonly [number, number])[0];
        const a = axis === "s" ? at(v, c0) : at(c0, v);
        const b = axis === "s" ? at(v, c1) : at(c1, v);
        const seg = clipSeg(a, b, MUR_Y, RAMPART);
        if (seg) segs.push(seg);
      }
      // Fusion des segments contigus en polylignes.
      const polys: [number, number][][] = [];
      for (const [a, b] of segs) {
        const last = polys[polys.length - 1];
        const end = last?.[last.length - 1];
        if (last && end && Math.hypot(end[0] - a[0], end[1] - a[1]) < 0.5) last.push(b);
        else polys.push([a, b]);
      }
      const narrow = w <= 5;
      const nom = narrow ? (spec.names.lanes[lane++ % spec.names.lanes.length] as string) : (names[named++ % names.length] as string);
      polys.forEach((p, n) => {
        const line = p.length > 2 ? [p[0] as [number, number], p[p.length - 1] as [number, number]] : p;
        rues.push({ id: `${axis}-${k}${polys.length > 1 ? `-${n}` : ""}`, nom, canon: "A", type: narrow ? "ruelle" : "rue", trace: line, largeur_m: w, revetement: narrow ? "terre" : "paves" });
      });
    });
  };
  lineStreets("s");
  lineStreets("t");
  rues.push({ id: "axe-principal", nom: spec.main.nom, canon: "A", type: "principale", trace: [pt(0, 12), pt(0, R - 8)], largeur_m: spec.main.largeur_m, revetement: "paves" });
  const lift = (Math.asin(Math.min(1, MUR_Y / RAMPART)) * 180) / Math.PI;
  const arcAngles = (a0: number, a1: number): number[] => {
    const n = Math.max(2, Math.ceil((a1 - a0) / 3));
    return Array.from({ length: n + 1 }, (_, k) => a0 + ((a1 - a0) * k) / n);
  };
  rues.push({ id: "chemin-du-rempart-est", nom: "Chemin du Rempart", canon: "A", type: "rue", trace: ringLine(RAMPART, arcAngles(lift, 90)), largeur_m: 10, revetement: "gravier" });
  rues.push({ id: "chemin-du-rempart-ouest", nom: "Chemin du Rempart", canon: "A", type: "rue", trace: ringLine(RAMPART, arcAngles(90, 180 - lift)), largeur_m: 10, revetement: "gravier" });
  rues.push({ id: "rue-du-mur", nom: "Rue du Mur", canon: "A", type: "rue", trace: [pt(-RAMPART, MUR_Y), pt(RAMPART, MUR_Y)], largeur_m: 10, revetement: "paves" });
  if (spec.extraStreets) rues.push(...spec.extraStreets(ctx));

  // ——— Cellules : îlots, places, parcs ———
  const ilots: Block[] = [];
  const places: Place["places_publiques"] = [];
  const parcs: Place["vegetation"]["parcs"] = [];
  const merged = new Map<string, { claim: Claim; i0: number; i1: number; j0: number; j1: number }>();
  const hw = (lines: typeof sl, k: number): number => {
    const [v, w] = lines[k] as readonly [number, number];
    if (lines === sl && mainOnGrid && Math.abs(v) < 0.5) return spec.main.largeur_m / 2 + 1.2;
    if (lines === tl && spec.grid.rot === 0 && Math.abs(v - MUR_Y) < 1) return 5 + 1.2;
    return w / 2 + 1.2;
  };
  const rectOf = (i0: number, i1: number, j0: number, j1: number): [number, number][] => {
    const s0 = (sl[i0] as readonly [number, number])[0] + hw(sl, i0);
    const s1 = (sl[i1] as readonly [number, number])[0] - hw(sl, i1);
    const t0 = (tl[j0] as readonly [number, number])[0] + hw(tl, j0);
    const t1 = (tl[j1] as readonly [number, number])[0] - hw(tl, j1);
    if (s1 - s0 < 4 || t1 - t0 < 4) return [];
    return [at(s0, t0), at(s1, t0), at(s1, t1), at(s0, t1)];
  };
  const clipRegion = (poly: [number, number][]): [number, number][][] => {
    if (poly.length < 3) return [];
    let p = clipHalf(poly, [0, 1], yCut);
    p = clipDisc(p, RR);
    if (p.length < 3) return [];
    // Damier oblique : l'axe principal recoupe les cellules.
    const pieces = mainOnGrid ? [p] : outsideStrip(p, [0, 0], [0, R], spec.main.largeur_m / 2 + 1.2);
    return pieces.filter((q) => q.length >= 3);
  };
  for (let i = 0; i + 1 < sl.length; i++) {
    for (let j = 0; j + 1 < tl.length; j++) {
      const c = claimOf(i, j);
      if (c?.kind === "vide") continue;
      if (c && (c.kind === "place" || c.kind === "parc")) {
        const m = merged.get(c.id);
        if (m) {
          m.i0 = Math.min(m.i0, i);
          m.i1 = Math.max(m.i1, i + 1);
          m.j0 = Math.min(m.j0, j);
          m.j1 = Math.max(m.j1, j + 1);
        } else merged.set(c.id, { claim: c, i0: i, i1: i + 1, j0: j, j1: j + 1 });
        continue;
      }
      const pieces = clipRegion(rectOf(i, i + 1, j, j + 1));
      pieces.forEach((pc, k) => {
        if (area(pc) < 500) return;
        const mid = centroid(pc);
        const key = spec.quarterAt(mid, i, j, ctx);
        const q = Object.values(spec.quarters).find((x) => x.id === key) ?? spec.quarters[key];
        if (!q) return;
        const id = `i-${i}-${j}${pieces.length > 1 ? `-${k}` : ""}`;
        if (pieces.length === 1 && spec.placettes.includes(`${i},${j}`) && area(pc) < 9000) {
          const n = places.filter((p) => p.id.startsWith("placette-")).length;
          places.push({ id: `placette-${n}`, nom: (spec.names.placettes[n % spec.names.placettes.length] as string) ?? `Placette ${n + 1}`, canon: "A", polygone: roundPoly(pc), revetement: "paves", fontaine: n % 2 ? pt(mid[0], mid[1]) : null, marche: false });
          return;
        }
        const ov = c?.kind === "ilot" ? c : null;
        ilots.push({ id, quartier: ov?.quartier ?? q.id, fonction: ov?.fonction ?? q.fonction, polygone: roundPoly(pc), densite_bati: ov?.densite ?? q.densite, gabarit: ov?.gabarit ?? q.gabarit });
      });
    }
  }
  for (const { claim, i0, i1, j0, j1 } of merged.values()) {
    const pieces = clipRegion(rectOf(i0, i1, j0, j1));
    pieces.forEach((pc, k) => {
      if (area(pc) < 300) return;
      const id = pieces.length > 1 ? `${claim.kind === "place" || claim.kind === "parc" ? claim.id : "x"}-${k}` : claim.kind === "place" || claim.kind === "parc" ? claim.id : "x";
      if (claim.kind === "place") {
        const c = centroid(pc);
        places.push({ id, nom: claim.nom, canon: "A", polygone: roundPoly(pc), revetement: claim.revetement, fontaine: claim.fontaine && k === 0 ? pt(c[0], c[1]) : null, marche: claim.marche });
      } else if (claim.kind === "parc") parcs.push({ id, nom: claim.nom, canon: "A", polygone: roundPoly(pc), essences: claim.essences, arbres_par_ha: claim.arbres_par_ha });
    });
  }
  // Parvis de la porte intérieure.
  const parvis: [number, number][] = [];
  for (let a = 180; a >= 0; a -= 15) {
    const p = polar(70, a);
    parvis.push(pt(p[0], Math.max(MUR_Y + 6, p[1])));
  }
  if (!ilots.some((b) => b.polygone.some((p) => Math.hypot(p[0], p[1]) < 70))) places.push({ id: "parvis-porte-interieure", nom: "Parvis de la Porte intérieure", canon: "A", polygone: parvis, revetement: "dalles", fontaine: null, marche: false });

  // ——— Faubourg au pied de la porte intérieure (côté du mur, y < 0) ———
  const zones: Place["zones"] = [];
  const quartiers = Object.values(spec.quarters).map((q) => ({ id: q.id, nom: q.nom, canon: "A" as const }));
  const f = spec.faubourg;
  if (f) {
    const { xs, ys } = f;
    const x0 = xs[0] as number;
    const x1 = xs[xs.length - 1] as number;
    const y0 = ys[0] as number;
    const y1 = ys[ys.length - 1] as number;
    rues.push({ id: "route-interieure", nom: "Route de l'intérieur", canon: "A", type: "route", trace: [pt(0, -14), pt(0, y1 - 1200)], largeur_m: 12, revetement: "gravier" });
    xs.forEach((x, k) => {
      if (Math.abs(x) < 0.5) return;
      rues.push({ id: `chemin-faubourg-x${k}`, nom: f.names[k % f.names.length] as string, canon: "A", type: "chemin", trace: [pt(x, y0), pt(x, y1)], largeur_m: 6, revetement: "terre" });
    });
    ys.forEach((y, k) => rues.push({ id: `chemin-faubourg-y${k}`, nom: f.names[(k + xs.length) % f.names.length] as string, canon: "A", type: "chemin", trace: [pt(x0, y), pt(x1, y)], largeur_m: 7, revetement: "terre" }));
    for (let i = 0; i + 1 < xs.length; i++) {
      for (let j = 0; j + 1 < ys.length; j++) {
        const a0 = (xs[i] as number) + (Math.abs(xs[i] as number) < 0.5 ? 7 : 4.2);
        const a1 = (xs[i + 1] as number) - (Math.abs(xs[i + 1] as number) < 0.5 ? 7 : 4.2);
        const b0 = (ys[j] as number) - 4.7;
        const b1 = (ys[j + 1] as number) + 4.7;
        ilots.push({ id: `f-${i}-${j}`, quartier: f.quarter.id, zone: "faubourg", fonction: f.quarter.fonction, polygone: [pt(a0, b1), pt(a1, b1), pt(a1, b0), pt(a0, b0)], densite_bati: f.quarter.densite, gabarit: f.gabarit });
      }
    }
    zones.push({ id: "faubourg", nom: f.nom, canon: "A", polygone: [pt(x0 - 10, y0 + 6), pt(x1 + 10, y0 + 6), pt(x1 + 10, y1 - 10), pt(x0 - 10, y1 - 10)], population: f.population, densite: f.densite });
    quartiers.push({ id: f.quarter.id, nom: f.quarter.nom, canon: "A" });
  }
  rues.push({ id: "route-exterieure", nom: "Route de l'extérieur", canon: "A", type: "route", trace: [pt(0, R + 10), pt(0, R + 420)], largeur_m: 10, revetement: "terre" });

  // ——— Murailles et portes ———
  const sArc = ctx.sArc;
  const gate = (o: Partial<Gate> & Pick<Gate, "id" | "nom" | "role" | "trace" | "s_m">): Gate => ({
    canon: "A",
    sources: [{ ref: "forme des districts : saillie à deux portes (établie pour Shiganshina et Trost) ; dimensions : aucune (Q5)", canon: "A" }],
    passage: { largeur_m: 14, hauteur_m: 20, voute: "plein_cintre", trous_assassin: 8, rainures: true, canon: "A" },
    vantail: { type: "levant", largeur_m: 15, hauteur_m: 20, epaisseur_m: 1.2, materiau: "chene_ferre", canon: "A" },
    structure: { huisserie: true, gonds: 0, treuils: 2, contrepoids: 2, herse: false, canon: "A" },
    tours: [
      { type: "maison_du_treuil", cote: "dessus", hauteur_m: 7, canon: "A" },
      { type: "tourelle", cote: "gauche", hauteur_m: 10, canon: "A" },
      { type: "tourelle", cote: "droite", hauteur_m: 10, canon: "A" },
    ],
    portail: "bossage",
    etat: "intacte",
    ...o,
  });
  const portes = spec.portes
    ? spec.portes(ctx, gate)
    : [
        gate({ id: "exterieure", nom: "Porte extérieure", role: "exterieure", trace: "saillie", s_m: sArc(90) }),
        gate({
          id: "interieure",
          nom: "Porte intérieure",
          role: "interieure",
          trace: "mur-centre",
          s_m: R,
          passage: { largeur_m: 12, hauteur_m: 17, voute: "plein_cintre", trous_assassin: 4, rainures: true, canon: "A" },
          vantail: { type: "battants", largeur_m: 12.4, hauteur_m: 16, epaisseur_m: 0.8, materiau: "chene_ferre", canon: "A" },
          structure: { huisserie: true, gonds: 4, treuils: 1, contrepoids: 0, herse: true, canon: "A" },
          tours: [
            { type: "poste_de_garde", cote: "gauche", hauteur_m: 6, canon: "A" },
            { type: "poste_de_garde", cote: "droite", hauteur_m: 6, canon: "A" },
          ],
          portail: "pilastres",
        }),
      ];
  const perimetre: [number, number][] = [];
  for (let a = 0; a <= 180; a += 3) {
    const p = polar(R - 7.5, a);
    perimetre.push(pt(p[0], Math.max(p[1], 7.5)));
  }
  const span = R + 400;
  const vegetation = spec.vegetation(ctx, parcs);
  // Alignements : seulement sur des rues présentes (une rue du damier peut être coupée par une place).
  const streetIds = new Set(rues.map((r) => r.id));
  vegetation.alignements = vegetation.alignements.filter((a) => streetIds.has(a.rue));
  return {
    id: spec.id,
    nom: spec.nom,
    libelle: spec.libelle,
    canon: spec.canon,
    niveau: "N1",
    sources: spec.sources,
    province: spec.province,
    style: spec.style,
    population: spec.population,
    densite: spec.densite,
    perimetre,
    zones,
    orientation: spec.orientation,
    etendue_m: spec.etendue_m ?? Math.round(2 * R + 800),
    enceinte: {
      mur: spec.mur,
      canon: "C",
      traces: [
        { id: "saillie", type: "arc", centre: [0, 0], rayon_m: R, debut_deg: 0, fin_deg: 180, exterieur: "dehors", canon: "A" },
        { id: "mur-centre", type: "ligne", points: [[-R, 0], [R, 0]], exterieur: "gauche", canon: "A" },
        { id: "mur-ouest", type: "ligne", points: [[-span, 0], [-R, 0]], exterieur: "droite", canon: "A" },
        { id: "mur-est", type: "ligne", points: [[R, 0], [span, 0]], exterieur: "droite", canon: "A" },
      ],
      escaliers: [
        ...[0.1, 0.3, 0.5 - 0.03, 0.5 + 0.03, 0.7, 0.9].map((k) => ({ trace: "saillie", s_m: r1(sArc(180) * k), canon: "A" as const })),
        { trace: "mur-centre", s_m: r1(R - 60), canon: "A" },
        { trace: "mur-centre", s_m: r1(R + 60), canon: "A" },
      ],
      canons: { espacement_m: spec.canons_m ?? 32, canon: "A", traces: ["saillie"] },
      glacis_m: 12,
      pied_vegetal: true,
    },
    portes,
    rues,
    places_publiques: places,
    gabarits: spec.gabarits,
    quartiers: [...new Map(quartiers.map((q) => [q.id, q])).values()],
    ilots,
    batiments: spec.batiments(ctx),
    vegetation,
    eau: spec.eau(ctx),
    points_de_vue: spec.points_de_vue(ctx),
    etats: spec.etats(ctx),
    etat_defaut: spec.etats(ctx)[0]?.id ?? "intact",
  };
}

/** Raccourci : bâtiment repère (repères canon vides par défaut). */
export const building = (o: Omit<Building, "reperes_canon"> & { reperes_canon?: string[] }): Building => ({ reperes_canon: [], ...o });

/** Réclame les cellules du damier comprises entre les lignes de valeurs s0..s1 et t0..t1 (bornes incluses). */
export function claimRect(claims: Record<string, Claim>, s: readonly (readonly [number, number])[], t: readonly (readonly [number, number])[], s0: number, s1: number, t0: number, t1: number, claim: Claim): void {
  const i0 = s.findIndex(([v]) => Math.abs(v - s0) < 0.5);
  const i1 = s.findIndex(([v]) => Math.abs(v - s1) < 0.5);
  const j0 = t.findIndex(([v]) => Math.abs(v - t0) < 0.5);
  const j1 = t.findIndex(([v]) => Math.abs(v - t1) < 0.5);
  if (i0 < 0 || i1 <= i0 || j0 < 0 || j1 <= j0) throw new Error(`claimRect : lignes introuvables (${s0}, ${s1}, ${t0}, ${t1})`);
  for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) claims[`${i},${j}`] = claim;
}

/** Indice « i,j » de la cellule qui commence aux lignes s0 et t0. */
export function cellKey(s: readonly (readonly [number, number])[], t: readonly (readonly [number, number])[], s0: number, t0: number): string {
  const i = s.findIndex(([v]) => Math.abs(v - s0) < 0.5);
  const j = t.findIndex(([v]) => Math.abs(v - t0) < 0.5);
  if (i < 0 || j < 0) throw new Error(`cellKey : lignes introuvables (${s0}, ${t0})`);
  return `${i},${j}`;
}

/** Lignes d'auteur : valeurs données une à une, largeur par défaut `w`, largeurs propres par valeur. */
export function authored(values: readonly number[], w: number, widths: Record<number, number> = {}): [number, number][] {
  return values.map((v) => [v, widths[v] ?? w] as [number, number]);
}

/** Lignes régulières de `a` à `b` par pas `step`, largeur `w`, avec largeurs d'auteur par indice. */
export function lines(a: number, b: number, step: number, w: number, widths: Record<number, number> = {}): [number, number][] {
  const n = Math.round((b - a) / step);
  return Array.from({ length: n + 1 }, (_, k) => [a + k * step, widths[k] ?? w] as [number, number]);
}
