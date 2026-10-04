// npm run map:generate — produit data/map/paradis.json (et le graphe data/geo/paradis.json) à partir de data/map/paradis.layout.json.
// Déterministe : même disposition = même fichier. Le résultat est une donnée éditable (05 §1, 06 §8).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { geoFromMap } from "../data/geo";
import { MapSchema } from "../data/map";
import { polar } from "../sim/strategic/geometry";
import type { Point } from "../sim/strategic/geometry";
import { Rng } from "../sim/core/rng";

interface Layout {
  walls: Record<"height_m" | "thickness_m", { value: number; canon: string; note: string }>;
  radii: Record<"sina" | "rose" | "maria" | "coast_mean", { value: number }>;
  wall_band_km: number;
  coast: { amplitude_km: number; min_km: number; seed: number };
  gates: { segment: string; bearing: number }[];
  rings: { name: string; r_from: number | string; r_to: number | string; sectors: [string, number, number][] }[];
}

const layout = JSON.parse(readFileSync("data/map/paradis.layout.json", "utf8")) as Layout;
const provinces = JSON.parse(readFileSync("data/provinces/paradis.json", "utf8")) as { id: string; atlas_code: string }[];
const idByCode = new Map(provinces.map((p) => [p.atlas_code, p.id]));
const STEP = 3;
const round = (v: number): number => Math.round(v * 10) / 10;

// Côte : somme de sinusoïdes de phases tirées au sort (graine fixe), donc tracé irrégulier mais reproductible.
const rng = new Rng(layout.coast.seed);
const waves = [2, 3, 5, 7, 11].map((k) => ({ k, phase: rng.next() * Math.PI * 2, amp: (rng.next() * 0.6 + 0.4) / Math.sqrt(k) }));
const ampNorm = waves.reduce((s, w) => s + w.amp, 0);
function coastRadius(bearing: number): number {
  const b = (bearing * Math.PI) / 180;
  const n = waves.reduce((s, w) => s + w.amp * Math.sin(w.k * b + w.phase), 0) / ampNorm;
  return Math.max(layout.coast.min_km, layout.radii.coast_mean.value + n * layout.coast.amplitude_km);
}

function radius(spec: number | string, bearing: number): number {
  if (typeof spec === "number") return spec;
  if (spec === "coast") return coastRadius(bearing);
  const [name, plus] = spec.split("+") as [keyof Layout["radii"], string | undefined];
  return layout.radii[name].value + (plus === "wall" ? layout.wall_band_km : 0);
}

function arc(rSpec: number | string, from: number, to: number): Point[] {
  const pts: Point[] = [];
  const n = Math.max(1, Math.ceil((to - from) / STEP));
  for (let i = 0; i <= n; i++) {
    const b = from + ((to - from) * i) / n;
    pts.push(polar(radius(rSpec, b), b));
  }
  return pts;
}

interface Cell { id: string; ring: number; from: number; to: number; r0: number | string; r1: number | string }
const cells: Cell[] = [];
const out: Record<string, { polygon: Point[]; anchor: Point; ring: string; bearing: [number, number] }> = {};

layout.rings.forEach((ring, ringIndex) => {
  for (const [code, from, to] of ring.sectors) {
    const id = idByCode.get(code);
    if (!id) throw new Error(`Code d'atlas inconnu dans la disposition : ${code}`);
    const inner = ring.r_from === 0 ? [[0, 0] as Point] : arc(ring.r_from, from, to).reverse();
    const polygon = [...arc(ring.r_to, from, to), ...inner].map(([x, y]) => [round(x), round(y)] as Point);
    const mid = (from + to) / 2;
    const rMid = ring.r_from === 0 && to - from > 180 ? 0 : (radius(ring.r_from, mid) + radius(ring.r_to, mid)) / 2;
    const [ax, ay] = polar(rMid, mid);
    out[id] = { polygon, anchor: [round(ax), round(ay)], ring: ring.name, bearing: [from, to] };
    cells.push({ id, ring: ringIndex, from, to, r0: ring.r_from, r1: ring.r_to });
  }
});

/** Recouvrement angulaire (en degrés) de deux intervalles de relèvement, modulo 360. */
function overlap(a: Cell, b: Cell): number {
  let best = 0;
  for (const shift of [-360, 0, 360]) best = Math.max(best, Math.min(a.to, b.to + shift) - Math.max(a.from, b.from + shift));
  return best;
}
const touches = (x: number, y: number): boolean => Math.abs(((x - y) % 360 + 360) % 360) < 1e-9;

const neighbors: Record<string, string[]> = {};
for (const a of cells) {
  neighbors[a.id] = cells
    .filter((b) => b !== a && ((b.ring === a.ring && (touches(a.to, b.from) || touches(a.from, b.to))) || (Math.abs(b.ring - a.ring) === 1 && overlap(a, b) > 0.5)))
    .map((b) => b.id)
    .sort();
}

const coast = arc("coast", 0, 360).slice(0, -1).map(([x, y]) => [round(x), round(y)] as Point);
const extent = Math.ceil(Math.max(...coast.map(([x, y]) => Math.hypot(x, y))) + 40);
const map = {
  canon: "A",
  notes_canon: "Fichier généré par `npm run map:generate` depuis paradis.layout.json ; éditable à la main (polygones, ancres).",
  units: "km",
  bounds: [-extent, -extent, extent, extent],
  walls: layout.walls,
  wall_rings: (["sina", "rose", "maria"] as const).map((wall) => ({ wall, r_inner: layout.radii[wall].value, r_outer: layout.radii[wall].value + layout.wall_band_km })),
  gates: layout.gates.map((g) => ({ province: idByCode.get(g.segment), bearing: g.bearing })),
  coast,
  provinces: out,
  neighbors,
};
writeFileSync("data/map/paradis.json", JSON.stringify(map) + "\n");
// Graphe de routage de la simulation (P3) : dérivé de la carte validée, sans les polygones.
mkdirSync("data/geo", { recursive: true });
writeFileSync("data/geo/paradis.json", JSON.stringify(geoFromMap(MapSchema.parse(map)), null, 1) + "\n");
console.log(`map:generate : ${Object.keys(out).length} polygones, côte de ${coast.length} points, emprise ±${extent} km.`);
