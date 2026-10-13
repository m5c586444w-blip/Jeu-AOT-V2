import type { Choice } from "../data/effects";
import type { EventDef } from "../data/schemas";
import type { GameState } from "../sim/core/state";
import type { World } from "../sim/strategic/world";

/**
 * Divergence avertie (12 §3, P9.1) : avant de signer un choix non historique d'un événement canon, le joueur voit ce qu'il
 * engage — l'écart ajouté, les événements canon qui en dépendent (successeurs encore à venir), les personnages dont la mort
 * est liée à ces événements, et la bascule de branche si le seuil est franchi. Calcul pur, sur le monde et l'état.
 */
export interface DivergenceNotice {
  /** Écart ajouté (poids de l'événement × divergence du choix). */
  d: number;
  /** Événements canon à venir qui dépendent de celui-ci (clés de titre), dans l'ordre de la chaîne. */
  events: string[];
  /** Personnages dont l'événement de mort est dans la chaîne. */
  people: string[];
  /** Le choix fait passer la partie dans la branche divergente. */
  flips: boolean;
}

/** Nombre d'événements cités au plus (le reste est résumé par « … »). */
export const NOTICE_MAX = 5;

const after = (e: EventDef): string[] => (e.window.after === null ? [] : Array.isArray(e.window.after) ? [...e.window.after] : [e.window.after]);

export function divergenceNotice(world: World, state: GameState, e: EventDef, c: Choice): DivergenceNotice | null {
  if (e.kind !== "canon" || c.historical) return null;
  const d = (e.divergence_weight ?? 0) * c.divergence;
  const all = [...(world.chronicle?.events.values() ?? [])];
  const next = new Map<string, EventDef[]>();
  for (const x of all) if (x.kind === "canon") for (const p of after(x)) next.set(p, [...(next.get(p) ?? []), x]);
  const history = state.events?.history ?? {};
  const chain: EventDef[] = [];
  const seen = new Set<string>([e.id]);
  const queue = [e.id];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const x of [...(next.get(id) ?? [])].sort((a, b) => (a.year_min ?? 0) - (b.year_min ?? 0) || a.id.localeCompare(b.id))) {
      if (seen.has(x.id)) continue;
      seen.add(x.id);
      if (!history[x.id]) chain.push(x);
      queue.push(x.id);
    }
  }
  const ids = new Set(chain.map((x) => x.id));
  const people = [...(world.politics?.characters.values() ?? [])]
    .filter((ch) => ch.death_event !== undefined && ids.has(ch.death_event) && state.politics?.characters[ch.id]?.alive !== false)
    .map((ch) => ch.display_name ?? ch.name)
    .sort((a, b) => a.localeCompare(b, "fr"));
  const ev = state.events;
  const threshold = world.chronicle?.balance.divergence_threshold ?? Infinity;
  const flips = ev !== null && ev !== undefined && ev.branch !== "divergente" && ev.divergence + d >= threshold;
  return { d, events: chain.map((x) => x.text_key), people, flips };
}
