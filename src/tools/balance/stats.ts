import type { GameResult } from "./game";
import { PROFILES } from "./autopilot";
import type { Profile } from "./autopilot";

/**
 * Agrégats de `sim:balance` (P9.5 ; 05 §9.4) : durée, victoires par camp, causes de mort, ressources limitantes, cas
 * dégénérés. Un cas dégénéré est un motif qui revient dans une large part des parties : famine systématique (vivres épuisés
 * plus de la moitié de la partie) ou spirale de mort (île dépeuplée d'un cinquième, moral au plus bas).
 */
export interface Share {
  n: number;
  share: number;
}

export interface CampStats {
  camp: string;
  games: number;
  outcomes: Record<string, Share>;
  defeats: Record<string, number>;
  byProfile: Record<string, { games: number; victoire: number; defaite: number; terme: number }>;
}

export interface ScenarioStats {
  scenario: string;
  camp: string;
  games: number;
  errors: string[];
  duration: { mean: number; p10: number; p50: number; p90: number };
  camps: CampStats[];
  /** Victoires d'un camp adverse évaluées sur les mêmes parties (854 : Marley mené par l'IA). */
  deaths: Record<string, { total: number; perGame: number }>;
  expeditions: { launched: number; departed: number; dead: number; mortality: number | null; perGameMean: number | null };
  limiting: Record<string, Share>;
  degenerate: { famine: Share; spiral: Share; explained: string[] };
  ordersRefused: number;
  objectives: Record<string, Share>;
}

const q = (xs: readonly number[], p: number): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))] as number;
};
const sh = (n: number, of: number): Share => ({ n, share: of > 0 ? n / of : 0 });

export function isFamine(g: GameResult): boolean {
  return g.days > 0 && (g.zeroDays["food"] ?? 0) >= g.days * 0.5;
}

/** Spirale de mort : l'île perd au moins un vingtième de sa population et le moral tombe sous 30 (avant toute défaite). */
export function isSpiral(g: GameResult): boolean {
  return g.end.populationShare < 0.95 && g.minMorale < 30;
}

/** Ressource limitante d'une partie : celle restée épuisée le plus longtemps, si plus d'un dixième de la partie. */
export function limitingOf(g: GameResult, startedEmpty: ReadonlySet<string>): string {
  let best = "aucune";
  let days = g.days * 0.1;
  for (const [r, d] of Object.entries(g.zeroDays)) {
    if (startedEmpty.has(r)) continue;
    if (d > days) {
      best = r;
      days = d;
    }
  }
  return best;
}

function campStats(camp: string, list: readonly { outcome: string; defeat: string | null; profile: Profile }[]): CampStats {
  const outcomes: Record<string, number> = { victoire: 0, defaite: 0, terme: 0, en_cours: 0 };
  const defeats: Record<string, number> = {};
  const byProfile: CampStats["byProfile"] = {};
  for (const p of PROFILES) byProfile[p] = { games: 0, victoire: 0, defaite: 0, terme: 0 };
  for (const g of list) {
    outcomes[g.outcome] = (outcomes[g.outcome] ?? 0) + 1;
    if (g.defeat) defeats[g.defeat] = (defeats[g.defeat] ?? 0) + 1;
    const bp = byProfile[g.profile];
    if (bp) {
      bp.games += 1;
      if (g.outcome === "victoire" || g.outcome === "defaite" || g.outcome === "terme") bp[g.outcome] += 1;
    }
  }
  return { camp, games: list.length, outcomes: Object.fromEntries(Object.entries(outcomes).map(([k, v]) => [k, sh(v, list.length)])), defeats, byProfile };
}

export function aggregate(games: readonly GameResult[], startedEmpty: ReadonlySet<string>): ScenarioStats {
  const first = games[0];
  const n = games.length;
  const durations = games.map((g) => g.days);
  const camps = [campStats(first?.camp ?? "", games)];
  const otherCamps = [...new Set(games.flatMap((g) => Object.keys(g.others)))].sort();
  for (const c of otherCamps) camps.push(campStats(c, games.flatMap((g) => (g.others[c] ? [{ ...g.others[c], profile: g.profile }] : []))));
  const deaths: Record<string, number> = {};
  for (const g of games) for (const [k, v] of Object.entries(g.deaths)) deaths[k] = (deaths[k] ?? 0) + v;
  const launched = games.reduce((a, g) => a + g.expeditions.launched, 0);
  const departed = games.reduce((a, g) => a + g.expeditions.departed, 0);
  const dead = games.reduce((a, g) => a + g.expeditions.dead, 0);
  const perGame = games.filter((g) => g.expeditions.departed > 0).map((g) => g.expeditions.dead / g.expeditions.departed);
  const limiting: Record<string, number> = {};
  for (const g of games) {
    const r = limitingOf(g, startedEmpty);
    limiting[r] = (limiting[r] ?? 0) + 1;
  }
  const objectives: Record<string, number> = {};
  for (const g of games) for (const o of g.objectives) objectives[o] = (objectives[o] ?? 0) + 1;
  const famine = games.filter(isFamine).length;
  const spiral = games.filter(isSpiral).length;
  return {
    scenario: first?.scenario ?? "",
    camp: first?.camp ?? "",
    games: n,
    errors: games.filter((g) => g.error).map((g) => `graine ${g.seed} : ${g.error}`).slice(0, 10),
    duration: { mean: n ? durations.reduce((a, b) => a + b, 0) / n : 0, p10: q(durations, 0.1), p50: q(durations, 0.5), p90: q(durations, 0.9) },
    camps,
    deaths: Object.fromEntries(Object.entries(deaths).sort(([, a], [, b]) => b - a).map(([k, v]) => [k, { total: v, perGame: n ? v / n : 0 }])),
    expeditions: { launched, departed, dead, mortality: departed > 0 ? dead / departed : null, perGameMean: perGame.length ? perGame.reduce((a, b) => a + b, 0) / perGame.length : null },
    limiting: Object.fromEntries(Object.entries(limiting).sort(([, a], [, b]) => b - a).map(([k, v]) => [k, sh(v, n)])),
    degenerate: { famine: sh(famine, n), spiral: sh(spiral, n), explained: [] },
    ordersRefused: games.reduce((a, g) => a + g.orders.refused, 0),
    objectives: Object.fromEntries(Object.entries(objectives).map(([k, v]) => [k, sh(v, n)])),
  };
}
