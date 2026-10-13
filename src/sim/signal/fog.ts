import type { SignalBalance } from "../../data/balance";
import type { SeatId } from "../core/seat";
import type { GameState } from "../core/state";
import { factionOfSeat } from "../knowledge/knowledge";
import { ghostsOf } from "./ghost";
import type { FogLevel, FogViewResult, GhostBook, RelayResult, Signal, SignalMarker, WorldEntity } from "./types";
import { distance, meaningOf } from "./visibility";

/** Unités de la faction « en contact » avec le commandement : atteintes par au moins une fusée/relais. */
export function linkedUnits(results: readonly RelayResult[], faction: string): Set<string> {
  const out = new Set<string>();
  for (const r of results) if (r.faction === faction) for (const x of r.receptions) out.add(x.unitId);
  return out;
}

/** Marqueurs de signaux lisibles par une faction : seuls ses propres signaux, avec la couleur COMPRISE (pas l'émise) et le sens tiré de la branche. */
export function markersFor(faction: string, signals: readonly Signal[], results: readonly RelayResult[], nowS: number, b: SignalBalance): SignalMarker[] {
  const out: SignalMarker[] = [];
  for (const s of [...signals].sort((a, z) => (a.id < z.id ? -1 : 1))) {
    if (s.faction !== faction) continue;
    const r = results.find((x) => x.signalId === s.id && x.faction === faction);
    if (!r || r.receptions.length === 0) continue;
    // meilleure réception (délai minimal) : c'est la première qui informe le commandement
    const first = [...r.receptions].sort((a, z) => a.delayS - z.delayS || (a.unitId < z.unitId ? -1 : 1))[0];
    if (!first || s.issuedAtS + first.delayS > nowS) continue; // pas encore arrivée : information retardée
    out.push({ signalId: s.id, color: first.color, meaning: meaningOf(s.branch, first.color, b), x: s.x, y: s.y, sector: s.sector, ageS: nowS - (s.issuedAtS + first.delayS), error: first.error });
  }
  return out;
}

/**
 * Brouillard de commandement à trois niveaux (spec 26 §5), pour une faction (la connaissance est par faction, 27 §1).
 * - Récit : vision complète (toutes les entités, exactes).
 * - Normal : vision directe + signaux, informations datées. Exact seulement pour les entités propres liées au
 *   commandement et les ennemis proches d'elles ; le reste en fantômes datés.
 * - Rude : signaux seulement. Aucune entité exacte ; fantômes limités aux unités propres rapportées par fusée.
 * Garantie testée : en Normal et Rude, aucune entité d'une autre faction n'est exposée hors vision directe d'une unité propre liée.
 */
export function fogView(
  level: FogLevel,
  faction: string,
  entities: readonly WorldEntity[],
  linked: ReadonlySet<string>,
  book: GhostBook,
  markers: readonly SignalMarker[],
  nowS: number,
  b: SignalBalance,
): FogViewResult {
  const sorted = [...entities].sort((a, z) => (a.id < z.id ? -1 : 1));
  if (level === "recit") return { level, faction, visible: sorted, ghosts: [], signals: [...markers] };
  if (level === "rude") {
    const ghosts = ghostsOf(book, faction, nowS, b).filter((g) => g.faction === faction);
    return { level, faction, visible: [], ghosts, signals: [...markers] };
  }
  const eyes = sorted.filter((e) => e.faction === faction && linked.has(e.id));
  const visible = sorted.filter((e) => (e.faction === faction ? linked.has(e.id) : eyes.some((o) => distance(o, e) <= b.fog.vision_radius_m)));
  const seen = new Set(visible.map((e) => e.id));
  const ghosts = ghostsOf(book, faction, nowS, b).filter((g) => !seen.has(g.entityId));
  return { level, faction, visible, ghosts, signals: [...markers] };
}

/** Variante par siège (27 §1) : la faction est celle que dirige le siège ; siège inconnu = vue vide (aucune information). */
export function fogViewForSeat(
  state: GameState,
  seat: SeatId,
  level: FogLevel,
  entities: readonly WorldEntity[],
  linked: ReadonlySet<string>,
  book: GhostBook,
  markers: readonly SignalMarker[],
  nowS: number,
  b: SignalBalance,
): FogViewResult {
  const faction = factionOfSeat(state, seat);
  if (faction === null) return { level, faction: "", visible: [], ghosts: [], signals: [] };
  return fogView(level, faction, entities, linked, book, markers, nowS, b);
}
