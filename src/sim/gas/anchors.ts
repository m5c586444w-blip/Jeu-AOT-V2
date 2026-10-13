import type { GasBalance } from "../../data/balance";
import type { Rng } from "../core/rng";
import type { Anchor, TacticalWorldMap } from "../tactical/map";
import { anchorsNear } from "../tactical/map";
import type { AnchorLedger, DensityEstimate, DestructionCause, SectorDensity, Vec3 } from "./types";

/** Réseau d'ancrage (spec 26 §4) : la carte tactique reste immuable, les pertes vivent dans un registre séparé. */

export function createLedger(): AnchorLedger {
  return { damage: {} };
}

export function effectiveSolidity(a: Anchor, ledger: AnchorLedger): number {
  return a.solidity * (1 - (ledger.damage[String(a.id)] ?? 0));
}

export function isAnchorValid(a: Anchor, ledger: AnchorLedger, b: GasBalance): boolean {
  return effectiveSolidity(a, ledger) >= b.anchor.min_solidity;
}

export function validAnchorsNear(m: TacticalWorldMap, ledger: AnchorLedger, b: GasBalance, p: Vec3, range: number): Anchor[] {
  return anchorsNear(m, p.x, p.y, p.z, range)
    .filter((a) => isAnchorValid(a, ledger, b))
    .sort((u, v) => u.id - v.id);
}

/**
 * Détruit/fragilise les ancrages autour d'un point (Titan, incendie, démolition, artillerie). Pure : renvoie un nouveau registre.
 * Les pertes sont monotones : un registre ne « répare » jamais.
 */
export function destroyAnchors(m: TacticalWorldMap, ledger: AnchorLedger, b: GasBalance, cause: DestructionCause, at: Vec3): AnchorLedger {
  const radius = b.destruction.radius_m[cause] ?? 0;
  const loss = b.destruction.solidity_loss[cause] ?? 0;
  const damage = { ...ledger.damage };
  for (const a of anchorsNear(m, at.x, at.y, at.z, radius)) {
    const key = String(a.id);
    damage[key] = Math.min(1, (damage[key] ?? 0) + loss);
  }
  return { damage };
}

/**
 * Tente de s'ancrer depuis `from` : l'ancrage valide qui laisse le moins de distance jusqu'à `goal`, dans la portée du crochet.
 * Null sans support valide à portée (pas d'ODM sans ancrage).
 */
export function tryAnchor(m: TacticalWorldMap, ledger: AnchorLedger, b: GasBalance, from: Vec3, goal: Vec3, hookRange: number): Anchor | null {
  let best: Anchor | null = null;
  let bestD = Infinity;
  for (const a of validAnchorsNear(m, ledger, b, from, hookRange)) {
    if (Math.hypot(a.x - from.x, a.y - from.y, a.z - from.z) < b.anchor.chain_hop_min_m) continue;
    const d = Math.hypot(a.x - goal.x, a.y - goal.y, a.z - goal.z);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

const dist = (a: Vec3, c: Vec3): number => Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z);

/**
 * Chemin d'ancrage en ancrage de `from` à `to` (plus court en nombre de sauts, ancrages valides, saut ≤ hookRange).
 * Renvoie les identifiants d'ancrage dans l'ordre, ou null si aucun chemin n'existe. Parcours déterministe (ordre d'id).
 */
export function anchorPath(m: TacticalWorldMap, ledger: AnchorLedger, b: GasBalance, from: Vec3, to: Vec3, hookRange: number): number[] | null {
  if (dist(from, to) <= hookRange) return [];
  const starts = validAnchorsNear(m, ledger, b, from, hookRange);
  const prev = new Map<number, number>();
  const queue: number[] = [];
  for (const a of starts) {
    prev.set(a.id, -1);
    queue.push(a.id);
  }
  for (let head = 0; head < queue.length; head++) {
    const cur = m.anchors[queue[head] as number] as Anchor;
    if (dist(cur, to) <= hookRange) {
      const path: number[] = [];
      for (let id = cur.id; id !== -1; id = prev.get(id) as number) path.push(id);
      return path.reverse();
    }
    for (const n of validAnchorsNear(m, ledger, b, cur, hookRange)) {
      if (prev.has(n.id)) continue;
      prev.set(n.id, cur.id);
      queue.push(n.id);
    }
  }
  return null;
}

/** Carte d'ancrage réelle : densité d'ancrages valides par secteur carré de `sector_m`. */
export function anchorDensityMap(m: TacticalWorldMap, ledger: AnchorLedger, b: GasBalance): SectorDensity[] {
  const s = b.anchor.sector_m;
  const nx = Math.max(1, Math.ceil(m.width / s));
  const ny = Math.max(1, Math.ceil(m.height / s));
  const counts = new Array<number>(nx * ny).fill(0);
  for (const a of m.anchors) {
    if (!isAnchorValid(a, ledger, b)) continue;
    const sx = Math.min(nx - 1, Math.floor(a.x / s));
    const sy = Math.min(ny - 1, Math.floor(a.y / s));
    counts[sy * nx + sx] = (counts[sy * nx + sx] as number) + 1;
  }
  const ha = (s * s) / 10000;
  const out: SectorDensity[] = [];
  for (let sy = 0; sy < ny; sy++) {
    for (let sx = 0; sx < nx; sx++) {
      const count = counts[sy * nx + sx] as number;
      const perHa = count / ha;
      out.push({ sx, sy, count, perHa, klass: classify(perHa, b) });
    }
  }
  return out;
}

export function classify(perHa: number, b: GasBalance): SectorDensity["klass"] {
  return perHa < b.anchor.density_classes.rare ? "rare" : perHa < b.anchor.density_classes.moyen ? "moyen" : "riche";
}

/** Densité moyenne (par ha) de toute la carte. */
export function meanDensity(sectors: readonly SectorDensity[]): number {
  return sectors.length === 0 ? 0 : sectors.reduce((t, s) => t + s.perHa, 0) / sectors.length;
}

/**
 * Carte d'ancrage estimée : sans renseignement (P6), le joueur ne voit qu'une fourchette large. `intel` ∈ [0, 1].
 * Le bruit est tiré du Rng fourni (déterministe) ; la valeur vraie reste dans [low, high].
 */
export function estimateDensityMap(truth: readonly SectorDensity[], b: GasBalance, intel: number, rng: Rng): DensityEstimate[] {
  const k = Math.max(0, Math.min(1, intel));
  const error = b.estimate.error_no_intel + (b.estimate.error_full_intel - b.estimate.error_no_intel) * k;
  return truth.map((t) => {
    const shown = Math.max(0, t.perHa * (1 + error * (rng.next() * 2 - 1) * 0.5));
    return { ...t, perHa: shown, klass: classify(shown, b), error, low: shown * (1 - error), high: shown * (1 + error) };
  });
}
