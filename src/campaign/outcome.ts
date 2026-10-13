import type { Campaign, OutcomeCondition, OutcomeRule, ScenarioMods } from "../data/campaignSchema";
import type { GameState } from "../sim/core/state";
import { toAbsoluteDay } from "../sim/core/time";
import type { World } from "../sim/strategic/world";

/**
 * Fin de partie d'une campagne (P9.1, D-155) : évaluée HORS de la simulation, sur l'état, par les règles des données
 * (`data/campagnes/*.json`, `end`). La simulation ne connaît ni victoire ni défaite ; l'interface et `sim:balance` lisent la
 * même fonction. Un petit suivi (départ, jours sans vivres) accompagne l'évaluation.
 */

export interface OutcomeTracker {
  startDay: number;
  startPopulation: number;
  startFood: number;
  startSoldiers: number;
  startControlled: number;
  lastDay: number;
  /** Jours consécutifs sans vivres (stock nul), comptés aux observations. */
  foodEmptyDays: number;
  /** Pire suite de jours sans vivres observée (rapport de sim:balance). */
  foodEmptyMax: number;
}

export interface Outcome {
  rule: string;
  kind: OutcomeRule["kind"];
  winner: string | null;
  text_key: string;
  /** Jours écoulés depuis le départ. */
  days: number;
  /** Score à l'échéance (null pour une règle déclenchée avant). */
  score: number | null;
}

const sum = (xs: Iterable<number>): number => {
  let s = 0;
  for (const x of xs) s += x;
  return s;
};

function population(s: GameState): number {
  return sum(Object.values(s.strategic?.provinces ?? {}).map((p) => p.population));
}
function soldiers(s: GameState): number {
  return sum(Object.values(s.strategic?.provinces ?? {}).map((p) => (p.control === "paradis" ? (p.garrison?.soldiers ?? 0) : 0)));
}
function controlled(s: GameState): number {
  return Object.values(s.strategic?.provinces ?? {}).filter((p) => p.control === "paradis").length;
}
function meanOver(s: GameState, f: "morale" | "stability"): number {
  const own = Object.values(s.strategic?.provinces ?? {}).filter((p) => p.control === "paradis" && p.population > 0);
  return own.length === 0 ? 0 : sum(own.map((p) => p[f])) / own.length;
}

/** Suivi créé sur l'état de départ du scénario (la fonction est pure : l'interface le recrée au chargement d'une sauvegarde). */
export function newTracker(start: GameState): OutcomeTracker {
  const day = toAbsoluteDay(start.date);
  return { startDay: day, startPopulation: population(start), startFood: start.strategic?.stocks.food ?? 0, startSoldiers: soldiers(start), startControlled: controlled(start), lastDay: day, foodEmptyDays: 0, foodEmptyMax: 0 };
}

/** À appeler après chaque avance du temps (une ou plusieurs journées). */
export function observe(t: OutcomeTracker, s: GameState): void {
  const day = toAbsoluteDay(s.date);
  const n = Math.max(0, day - t.lastDay);
  t.lastDay = Math.max(t.lastDay, day);
  if ((s.strategic?.stocks.food ?? 1) <= 0) t.foodEmptyDays += n;
  else t.foodEmptyDays = 0;
  t.foodEmptyMax = Math.max(t.foodEmptyMax, t.foodEmptyDays);
}

/** Puissance terrestre d'un camp dans le monde des nations (formations × force × (attaque + défense)). */
export function worldPower(world: World, s: GameState, factions: readonly string[]): number {
  const nw = world.nations;
  const ns = s.nations;
  if (!nw || !ns) return 0;
  let p = 0;
  for (const stacks of Object.values(ns.forces)) {
    for (const [id, st] of Object.entries(stacks)) {
      const f = nw.formations.get(id);
      if (f && f.domain === "terre" && factions.includes(f.faction)) p += st.count * st.strength * (f.attack + f.defense);
    }
  }
  return p;
}

export function conditionHolds(world: World, s: GameState, t: OutcomeTracker, c: OutcomeCondition): boolean {
  const ev = s.events;
  if ("choice" in c) return ev?.history[c.event]?.status === "survenu" && ev.history[c.event]?.choice === c.choice;
  if ("event" in c) {
    const r = ev?.history[c.event];
    if (c.status === "evite") return r?.status === "evite";
    if (c.status === "regle") return r?.status === "survenu" || r?.status === "evite";
    return r?.status === "survenu";
  }
  if ("lost" in c) return c.lost.filter((p) => (s.strategic?.provinces[p]?.control ?? "paradis") !== "paradis").length >= c.at_least;
  if ("population_below" in c) return t.startPopulation > 0 && population(s) < c.population_below * t.startPopulation;
  if ("legitimacy_below" in c) return s.politics !== null && s.politics.legitimacy < c.legitimacy_below;
  if ("food_empty_days" in c) return t.foodEmptyDays >= c.food_empty_days;
  if ("flag" in c) return (ev?.flags[c.flag] ?? false) === c.eq;
  if ("dead" in c) return s.politics?.characters[c.dead]?.alive === false;
  if ("shifter" in c) return s.shifters?.titans[c.shifter]?.faction === c.side;
  // Porteur aux mains de Paradis (sens de la simulation, `captured`).
  if ("shifter_captured" in c) return s.shifters?.titans[c.shifter_captured]?.captured === true;
  if ("world_control" in c) return c.by.includes(s.nations?.control[c.world_control] ?? "");
  if ("nation_stat_below" in c) {
    const n = s.nations?.nations[c.nation_stat_below];
    return n !== undefined && n[c.stat] < c.value;
  }
  if ("forces_ratio" in c) return worldPower(world, s, c.forces_ratio) >= c.at_least * Math.max(1, worldPower(world, s, [c.against]));
  if ("days_at_least" in c) return toAbsoluteDay(s.date) - t.startDay >= c.days_at_least;
  if ("walls_below" in c) return Object.values(s.strategic?.provinces ?? {}).filter((p) => p.wall_structure !== null && p.wall_structure < c.walls_below).length >= c.at_least;
  if ("occupied_at_least" in c) return Object.values(s.armies?.occupied ?? {}).filter((f) => c.by.includes(f)).length >= c.occupied_at_least;
  return false;
}

/** Score de fin (0 à 1) : moyenne pondérée d'indicateurs ramenés à 0–1 par rapport au départ. */
export function scoreOf(campaign: Campaign, s: GameState, t: OutcomeTracker): { score: number; parts: Record<string, number> } {
  const ratio = (now: number, start: number): number => (start <= 0 ? 1 : Math.max(0, Math.min(1, now / start)));
  const value: Record<string, () => number> = {
    population: () => ratio(population(s), t.startPopulation),
    legitimacy: () => (s.politics?.legitimacy ?? 50) / 100,
    morale: () => meanOver(s, "morale") / 100,
    stability: () => meanOver(s, "stability") / 100,
    food: () => ratio(s.strategic?.stocks.food ?? 0, t.startFood),
    soldiers: () => ratio(soldiers(s), t.startSoldiers),
    control: () => ratio(controlled(s), t.startControlled),
  };
  const parts: Record<string, number> = {};
  let total = 0;
  let w = 0;
  for (const it of campaign.end.deadline.score) {
    const v = value[it.indicator]?.() ?? 0;
    parts[it.indicator] = v;
    total += v * it.weight;
    w += it.weight;
  }
  return { score: w > 0 ? total / w : 0, parts };
}

/** Issue de la partie, ou null si elle continue. Règles dans l'ordre des données ; à l'échéance, le score décide. */
export function evaluateOutcome(world: World, campaign: Campaign, mods: Pick<ScenarioMods, "score_threshold_delta">, s: GameState, t: OutcomeTracker): Outcome | null {
  const days = toAbsoluteDay(s.date) - t.startDay;
  for (const r of campaign.end.rules) {
    if (r.when.every((c) => conditionHolds(world, s, t, c))) return { rule: r.id, kind: r.kind, winner: r.winner, text_key: r.text_key, days, score: null };
  }
  if (days < campaign.end.max_days) return null;
  const { score } = scoreOf(campaign, s, t);
  const d = campaign.end.deadline;
  const r = score >= d.threshold + mods.score_threshold_delta ? d.win : d.lose;
  return { rule: r.id, kind: r.kind, winner: r.winner, text_key: r.text_key, days, score };
}

/** Issue vue de la nation jouée (854 : Paradis ou Marley). */
export function outcomeFor(o: Outcome, player: string): "victoire" | "defaite" | "paix" {
  if (o.winner === null) return o.kind === "paix" ? "paix" : "defaite";
  return o.winner === player ? "victoire" : "defaite";
}
