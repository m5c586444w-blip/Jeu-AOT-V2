import { polar } from "../../sim/strategic/geometry";
import type { Point } from "../../sim/strategic/geometry";
import { circleNoise, lineNoise } from "./noise";

/**
 * Géométrie de dessin de la carte réaliste (MAP.2) : mêmes anneaux et secteurs que data/map/paradis.layout.json
 * (donc mêmes voisinages), mais frontières sinueuses, murs légèrement déformés et côte d'île allongée.
 * Chaque frontière est une fonction unique partagée par ses deux provinces : le pavage reste exact.
 */
export interface Layout {
  radii: Record<"sina" | "rose" | "maria" | "coast_mean", { value: number }>;
  wall_band_km: number;
  gates: { segment: string; bearing: number }[];
  rings: { name: string; r_from: number | string; r_to: number | string; sectors: [string, number, number][] }[];
}

export interface CoastFeature {
  bearing: number;
  width: number;
  km: number;
}

export interface DrawLayoutOptions {
  seed: string;
  /** Demi-axes de l'ellipse de base (km) : est-ouest, nord-sud. */
  axisEW: number;
  axisNS: number;
  features: readonly CoastFeature[];
  coastMin: number;
  coastMax: number;
}

const STEP_DEG = 0.5;
const STEP_KM = 2;
const norm = (b: number): number => Math.round((((b % 360) + 360) % 360) * 100) / 100;
const round = (v: number): number => Math.round(v * 10) / 10;

export class DrawLayout {
  constructor(
    private readonly layout: Layout,
    private readonly opt: DrawLayoutOptions,
  ) {}

  /** Déformation commune des anneaux de murs (± 1,8 %) : ils ne sont plus des cercles parfaits. */
  wallWarp(bearing: number): number {
    return 1 + 0.018 * circleNoise(bearing, 3, `${this.opt.seed}:murs`, 2);
  }

  /** Rayon de la côte : ellipse allongée nord-sud, ondulations, caps et baies. */
  coastRadius(bearing: number): number {
    const b = (bearing * Math.PI) / 180;
    const ell = 1 / Math.sqrt((Math.sin(b) / this.opt.axisEW) ** 2 + (Math.cos(b) / this.opt.axisNS) ** 2);
    let r = ell + 30 * circleNoise(bearing, 6, `${this.opt.seed}:cote:grande`, 3) + 11 * circleNoise(bearing, 28, `${this.opt.seed}:cote:fine`, 4);
    for (const f of this.opt.features) {
      const d = ((bearing - f.bearing + 540) % 360) - 180;
      r += f.km * Math.exp(-((d / f.width) ** 2));
    }
    return Math.min(this.opt.coastMax, Math.max(this.opt.coastMin, r));
  }

  /** Rayon d'une frontière d'anneau au relèvement donné. */
  radius(spec: number | string, bearing: number): number {
    if (spec === 0) return 0;
    if (spec === "coast") return this.coastRadius(bearing);
    if (typeof spec === "number") return spec * this.wallWarp(bearing) + 6 * circleNoise(bearing, spec / 9, `${this.opt.seed}:anneau:${spec}`, 3);
    const [name, plus] = spec.split("+") as [keyof Layout["radii"], string | undefined];
    return (this.layout.radii[name].value + (plus === "wall" ? this.layout.wall_band_km : 0)) * this.wallWarp(bearing);
  }

  /**
   * Écart angulaire (degrés) d'une frontière radiale à la distance r ; nul dans les anneaux de murs et aux deux bouts
   * (les coins restent sur le relèvement de la disposition : aucun contact nouveau entre provinces).
   */
  radialOffset(ring: Layout["rings"][number], bearing: number, r: number): number {
    if (ring.name.startsWith("mur_") || r <= 1) return 0;
    const r0 = this.radius(ring.r_from, bearing);
    const r1 = this.radius(ring.r_to, bearing);
    const taper = Math.min(1, Math.max(0, Math.min(r - r0, r1 - r) / 18));
    const km = 9 * lineNoise(r, 32, `${this.opt.seed}:radiale:${ring.name}:${norm(bearing)}`, 3) * taper * taper;
    return ((km / r) * 180) / Math.PI;
  }

  private arc(spec: number | string, from: number, to: number): Point[] {
    const at = (b: number): Point => polar(this.radius(spec, b), b);
    const pts: Point[] = [at(from)];
    if (to > from) for (let b = Math.floor(from / STEP_DEG + 1) * STEP_DEG; b < to; b += STEP_DEG) pts.push(at(b));
    else for (let b = Math.ceil(from / STEP_DEG - 1) * STEP_DEG; b > to; b -= STEP_DEG) pts.push(at(b));
    pts.push(at(to));
    return pts;
  }

  private radial(ring: Layout["rings"][number], bearing: number, r0: number, r1: number): Point[] {
    const pts: Point[] = [];
    const dir = r1 >= r0 ? 1 : -1;
    const at = (r: number): Point => polar(r, bearing + this.radialOffset(ring, bearing, r));
    if (dir > 0) for (let r = Math.floor(r0 / STEP_KM + 1) * STEP_KM; r < r1; r += STEP_KM) pts.push(at(r));
    else for (let r = Math.ceil(r0 / STEP_KM - 1) * STEP_KM; r > r1; r -= STEP_KM) pts.push(at(r));
    return pts;
  }

  /** Polygone d'un secteur, sens horaire : côté extérieur, frontière d'arrivée, côté intérieur, frontière de départ. */
  sector(ring: Layout["rings"][number], from: number, to: number): Point[] {
    const o0 = this.radius(ring.r_to, from);
    const o1 = this.radius(ring.r_to, to);
    const pts: Point[] = [...this.arc(ring.r_to, from, to)];
    if (ring.r_from === 0) {
      pts.push(...this.radial(ring, to, o1, 0), [0, 0], ...this.radial(ring, from, 0, o0));
    } else {
      const i0 = this.radius(ring.r_from, from);
      const i1 = this.radius(ring.r_from, to);
      pts.push(...this.radial(ring, to, o1, i1), ...this.arc(ring.r_from, to, from), ...this.radial(ring, from, i0, o0));
    }
    return dedupe(pts.map(([x, y]) => [round(x), round(y)] as Point));
  }

  /** Point au milieu du secteur, à la fraction `f` entre bord intérieur et bord extérieur. */
  inside(ring: Layout["rings"][number], from: number, to: number, f: number, db = 0): Point {
    const mid = (from + to) / 2 + db * (to - from);
    if (ring.r_from === 0 && to - from > 180) return f < 0.5 ? [0, 0] : polar(this.radius(ring.r_to, mid) * (f - 0.5), mid);
    const r0 = this.radius(ring.r_from, mid);
    const r1 = this.radius(ring.r_to, mid);
    const [x, y] = polar(r0 + (r1 - r0) * f, mid);
    return [round(x), round(y)];
  }

  coast(): Point[] {
    const pts: Point[] = [];
    for (let b = 0; b < 360; b += STEP_DEG) {
      const [x, y] = polar(this.coastRadius(b), b);
      pts.push([round(x), round(y)]);
    }
    return pts;
  }

  /** Ligne médiane d'un mur (relèvement tous les 0,5°, rayon) pour le dessin et les étiquettes. */
  wallLine(wall: "sina" | "rose" | "maria"): Point[] {
    const pts: Point[] = [];
    for (let b = 0; b < 360; b += STEP_DEG) {
      const [x, y] = polar((this.layout.radii[wall].value + this.layout.wall_band_km / 2) * this.wallWarp(b), b);
      pts.push([round(x), round(y)]);
    }
    return pts;
  }
}

function dedupe(pts: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) out.pop();
  return out;
}
