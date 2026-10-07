import type { RingProfile, WallTrace } from "../../../data/placeSchema";
import type { P2 } from "./geom";
import { along, dist, left, mul, polylineLength, rad, sub, unit } from "./geom";

/**
 * Murailles d'un lieu (R1e, consigne §3.1) : tracés (arc ou polyligne), repère local le long d'un tracé, et coupe calculée depuis
 * `_murs.json` (hauteur, épaisseurs, fruit, talus, chemin de ronde, parapet). Calcul pur : sert au modèle 3D, aux portes et à la
 * coupe SVG.
 * - Tracé : ligne médiane du mur au sol (milieu de l'épaisseur de base).
 * - Côté extérieur : arc « dehors » (hors du cercle) ou « dedans » ; polyligne « droite » ou « gauche », vu sur le plan (nord en
 *   haut) en suivant le tracé.
 */
export interface WallFrame {
  p: [number, number];
  /** Direction du tracé (unitaire). */
  d: [number, number];
  /** Normale vers l'extérieur (unitaire). */
  out: [number, number];
}

export function traceLength(t: WallTrace): number {
  if (t.type === "arc") return Math.abs(rad(t.fin_deg - t.debut_deg)) * t.rayon_m;
  return polylineLength(t.points);
}

export function wallFrameAt(t: WallTrace, s: number): WallFrame {
  if (t.type === "arc") {
    const sign = Math.sign(t.fin_deg - t.debut_deg) || 1;
    const a = rad(t.debut_deg) + (sign * s) / t.rayon_m;
    const r: [number, number] = [Math.cos(a), Math.sin(a)];
    const d: [number, number] = [-Math.sin(a) * sign, Math.cos(a) * sign];
    return { p: [t.centre[0] + r[0] * t.rayon_m, t.centre[1] + r[1] * t.rayon_m], d, out: t.exterieur === "dehors" ? r : mul(r, -1) };
  }
  const { p, d } = along(t.points, s);
  // Plan à y vers le sud : la normale (−dy, dx) est à droite du tracé quand le nord est en haut.
  const right = left(d);
  return { p, d, out: t.exterieur === "droite" ? right : mul(right, -1) };
}

/** Points du tracé tous les `step` m (extrémités comprises), avec leur repère. */
export function sampleTrace(t: WallTrace, step: number): (WallFrame & { s: number })[] {
  const L = traceLength(t);
  const n = Math.max(1, Math.ceil(L / step));
  const out: (WallFrame & { s: number })[] = [];
  if (t.type === "ligne") {
    // Polyligne : un point à chaque sommet, pour garder les angles.
    let s0 = 0;
    for (let i = 1; i < t.points.length; i++) {
      const a = t.points[i - 1] as P2;
      const b = t.points[i] as P2;
      const l = dist(a, b);
      const k = Math.max(1, Math.ceil(l / step));
      const d = unit(sub(b, a));
      const out1 = t.exterieur === "droite" ? left(d) : mul(left(d), -1);
      for (let j = i === 1 ? 0 : 1; j <= k; j++) out.push({ s: s0 + (l * j) / k, p: [a[0] + (b[0] - a[0]) * (j / k), a[1] + (b[1] - a[1]) * (j / k)], d, out: out1 });
      s0 += l;
    }
    return out;
  }
  for (let i = 0; i <= n; i++) out.push({ s: (L * i) / n, ...wallFrameAt(t, (L * i) / n) });
  return out;
}

/** Distance d'un point au tracé (m), mesurée au sol. */
export function distanceToTrace(t: WallTrace, p: P2): number {
  if (t.type === "arc") {
    const dx = p[0] - t.centre[0];
    const dy = p[1] - t.centre[1];
    let a = (Math.atan2(dy, dx) * 180) / Math.PI;
    const [lo, hi] = t.debut_deg <= t.fin_deg ? [t.debut_deg, t.fin_deg] : [t.fin_deg, t.debut_deg];
    while (a < lo) a += 360;
    while (a > lo + 360) a -= 360;
    if (a <= hi) return Math.abs(Math.hypot(dx, dy) - t.rayon_m);
    const e1 = wallFrameAt(t, 0).p;
    const e2 = wallFrameAt(t, traceLength(t)).p;
    return Math.min(dist(p, e1), dist(p, e2));
  }
  let d = Infinity;
  for (let i = 1; i < t.points.length; i++) {
    const a = t.points[i - 1] as P2;
    const b = t.points[i] as P2;
    const ab = sub(b, a);
    const l2 = ab[0] * ab[0] + ab[1] * ab[1];
    const k = l2 > 0 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / l2)) : 0;
    d = Math.min(d, Math.hypot(p[0] - a[0] - ab[0] * k, p[1] - a[1] - ab[1] * k));
  }
  return d;
}

/**
 * Coupe d'un mur (m) dans le repère (n, z) : n vers l'extérieur depuis la ligne médiane, z vers le haut depuis le sol.
 * Les faces suivent le fruit : l'extérieur porte `fruit_part_exterieure` du rétrécissement (base − sommet).
 */
export interface WallSection {
  H: number;
  base: number;
  top: number;
  /** Abscisses (n) des faces au sol et au sommet. */
  extFoot: number;
  extTop: number;
  intFoot: number;
  intTop: number;
  /** Fruits (rapport horizontal / vertical) des deux faces. */
  fruitExt: number;
  fruitInt: number;
  talus: { h: number; out: number };
  foundation: number;
  walkway: number;
  parapet: { h: number; t: number };
  crenels: boolean;
  /** Abscisse de la face extérieure à l'altitude z (au-dessus du talus). */
  extAt(z: number): number;
  intAt(z: number): number;
}

export function wallSection(r: RingProfile): WallSection {
  const H = r.hauteur_m.valeur;
  const base = r.epaisseur_base_m.valeur;
  const top = r.epaisseur_sommet_m.valeur;
  const f = r.fruit_part_exterieure.valeur;
  const shrink = base - top;
  const extFoot = base / 2;
  const intFoot = -base / 2;
  const extTop = extFoot - shrink * f;
  const intTop = intFoot + shrink * (1 - f);
  return {
    H,
    base,
    top,
    extFoot,
    extTop,
    intFoot,
    intTop,
    fruitExt: (shrink * f) / H,
    fruitInt: (shrink * (1 - f)) / H,
    talus: { h: r.talus_hauteur_m.valeur, out: r.talus_avancee_m.valeur },
    foundation: r.fondation_profondeur_m.valeur,
    walkway: r.chemin_de_ronde_m.valeur,
    parapet: { h: r.parapet_hauteur_m.valeur, t: r.parapet_epaisseur_m.valeur },
    crenels: r.creneaux.valeur,
    extAt: (z) => extFoot - (shrink * f * z) / H,
    intAt: (z) => intFoot + (shrink * (1 - f) * z) / H,
  };
}
