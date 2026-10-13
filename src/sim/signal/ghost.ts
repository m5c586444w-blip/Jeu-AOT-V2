import type { SignalBalance } from "../../data/balance";
import type { FogLevel, Ghost, GhostBook, GhostView, Reception, SignalUnit, WorldEntity } from "./types";
import { distance } from "./visibility";

export const emptyGhostBook = (): GhostBook => ({ byObserver: {} });

const put = (book: GhostBook, observer: string, g: Ghost): GhostBook => {
  const mine = book.byObserver[observer] ?? {};
  const prev = mine[g.entityId];
  if (prev && prev.seenAtS > g.seenAtS) return book; // information plus ancienne : ignorée
  return { byObserver: { ...book.byObserver, [observer]: { ...mine, [g.entityId]: g } } };
};

/**
 * Observation directe (niveau Normal) : toute entité à moins de `fog.vision_radius_m` d'une entité observatrice liée
 * devient un fantôme tout frais. Récit n'en a pas besoin (vision complète) ; Rude n'observe pas directement.
 * Pure : renvoie un nouveau carnet. Le carnet est indexé par faction observatrice : rien ne passe d'une faction à l'autre.
 */
export function recordSightings(book: GhostBook, observer: string, level: FogLevel, entities: readonly WorldEntity[], linked: ReadonlySet<string>, nowS: number, b: SignalBalance): GhostBook {
  if (level !== "normal") return book;
  const eyes = entities.filter((e) => e.faction === observer && linked.has(e.id));
  let out = book;
  for (const e of [...entities].sort((a, z) => (a.id < z.id ? -1 : 1))) {
    if (e.faction === observer ? !linked.has(e.id) : !eyes.some((o) => distance(o, e) <= b.fog.vision_radius_m)) continue;
    out = put(out, observer, { entityId: e.id, faction: e.faction, x: e.x, y: e.y, seenAtS: nowS, speedMps: e.speedMps ?? b.ghost.default_speed_mps });
  }
  return out;
}

/** Rapports par fusée : une unité qui a reçu/relayé un signal est « située » à cet instant (source de fantômes de ses propres unités). */
export function recordReports(book: GhostBook, observer: string, receptions: readonly Reception[], units: readonly SignalUnit[], issuedAtS: number, b: SignalBalance): GhostBook {
  let out = book;
  for (const r of receptions) {
    const u = units.find((x) => x.id === r.unitId);
    if (!u || u.faction !== observer) continue;
    out = put(out, observer, { entityId: u.id, faction: u.faction, x: u.x, y: u.y, seenAtS: issuedAtS + r.delayS, speedMps: b.ghost.default_speed_mps });
  }
  return out;
}

/** Fantôme vu à l'instant `nowS` : âge et rayon d'incertitude (croît avec l'âge, plafonné), nul passé `max_age_s`. */
export function ghostView(g: Ghost, nowS: number, b: SignalBalance): GhostView | null {
  const ageS = Math.max(0, nowS - g.seenAtS);
  if (ageS > b.ghost.max_age_s) return null;
  return { ...g, ageS, uncertaintyM: Math.min(b.ghost.uncertainty_cap_m, g.speedMps * ageS) };
}

/** Fantômes d'une faction observatrice, triés par id. */
export function ghostsOf(book: GhostBook, observer: string, nowS: number, b: SignalBalance): GhostView[] {
  const mine = book.byObserver[observer] ?? {};
  const out: GhostView[] = [];
  for (const id of Object.keys(mine).sort()) {
    const v = ghostView(mine[id] as Ghost, nowS, b);
    if (v) out.push(v);
  }
  return out;
}
