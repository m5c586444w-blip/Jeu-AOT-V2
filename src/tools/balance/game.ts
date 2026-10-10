import { applyCommand } from "../../sim/core/commands";
import type { Command } from "../../sim/core/commands";
import { createInitialState } from "../../sim/core/state";
import type { GameState } from "../../sim/core/state";
import { toAbsoluteDay } from "../../sim/core/time";
import { evaluateEnding } from "../../sim/ending/ending";
import type { EndingState } from "../../sim/ending/ending";
import type { World } from "../../sim/strategic/world";
import { RESOURCE_IDS } from "../../sim/strategic/resources";
import { decide, makePilot } from "./autopilot";
import type { Profile } from "./autopilot";

/** Une partie de `sim:balance` : scénario, camp joué, graine ; le pilote décide tous les `STEP` jours (2 pendant le Grondement). */
export const STEP = 10;

export interface GameResult {
  scenario: string;
  camp: string;
  seed: number;
  profile: Profile;
  /** Issue pour le camp joué, et pour l'autre camp du scénario s'il a ses propres objectifs (854). */
  outcome: EndingState;
  defeat: string | null;
  objectives: string[];
  others: Record<string, { outcome: EndingState; defeat: string | null }>;
  days: number;
  /** Morts par cause : personnages nommés (cause), expéditions (champ), disette (population), Grondement. */
  deaths: Record<string, number>;
  expeditions: { launched: number; departed: number; dead: number };
  /** Jours où chaque ressource était épuisée (≤ 0). */
  zeroDays: Record<string, number>;
  /** Moyennes en fin de partie (île tenue). */
  end: { morale: number; stability: number; legitimacy: number | null; populationShare: number; food: number };
  minMorale: number;
  orders: { issued: number; refused: number };
  error: string | null;
}

interface Island {
  morale: number;
  stability: number;
  population: number;
}

function island(s: GameState): Island {
  const held = Object.values(s.strategic?.provinces ?? {}).filter((p) => p.control === "paradis");
  const avg = (k: "morale" | "stability"): number => (held.length ? held.reduce((a, p) => a + p[k], 0) / held.length : 0);
  return { morale: avg("morale"), stability: avg("stability"), population: held.reduce((a, p) => a + p.population, 0) };
}

/** Évaluation pour un autre camp que le joueur (la nation jouée est remplacée dans une copie superficielle). */
function evaluateAs(w: World, s: GameState, camp: string): ReturnType<typeof evaluateEnding> {
  if (!s.nations) return null;
  return evaluateEnding(w, { ...s, nations: { ...s.nations, player: camp } });
}

export function playGame(w: World, camp: string, seed: number): GameResult {
  const pilot = makePilot(seed);
  // Crise rapide (Grondement, 150 jours) : le joueur suit de près ; ailleurs, une décision tous les dix jours.
  const step = w.rumbling ? 2 : STEP;
  let s = createInitialState(seed, w);
  if (s.nations && s.nations.player !== camp) s = applyCommand(s, { type: "SetPlayerFaction", faction: camp }, undefined, w);
  const start = island(s);
  const startDay = toAbsoluteDay(s.date);
  const zeroDays: Record<string, number> = Object.fromEntries(RESOURCE_IDS.map((r) => [r, 0]));
  const reports = new Map<string, { departed: number; dead: number; causes: Record<string, number> }>();
  let minMorale = start.morale;
  let e = evaluateEnding(w, s);
  const term = e?.term ?? 1800;
  let error: string | null = null;
  const send = (c: Command): void => {
    pilot.issued += 1;
    try {
      s = applyCommand(s, c, undefined, w);
    } catch {
      pilot.refused += 1;
    }
  };
  try {
    while (e && e.state === "en_cours" && toAbsoluteDay(s.date) - startDay <= term + step) {
      for (const c of decide(pilot, w, s, step)) send(c);
      s = applyCommand(s, { type: "AdvanceDays", n: step }, undefined, w);
      const st = s.strategic;
      if (st) for (const r of RESOURCE_IDS) if (st.stocks[r] <= 0) zeroDays[r] = (zeroDays[r] ?? 0) + step;
      for (const rp of s.military?.reports ?? []) {
        if (reports.has(rp.id)) continue;
        const causes: Record<string, number> = {};
        for (const d of rp.dead) causes[d.cause] = (causes[d.cause] ?? 0) + 1;
        reports.set(rp.id, { departed: rp.stats.departed, dead: rp.dead.length, causes });
      }
      minMorale = Math.min(minMorale, island(s).morale);
      e = evaluateEnding(w, s);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const end = island(s);
  const deaths: Record<string, number> = {};
  const startYear = w.scenario.start;
  for (const c of Object.values(s.politics?.characters ?? {})) {
    if (c.alive || !c.death) continue;
    const d = c.death.date;
    if (d.year < startYear.year || (d.year === startYear.year && d.day < startYear.day)) continue;
    const k = `nomme:${c.death.cause}`;
    deaths[k] = (deaths[k] ?? 0) + 1;
  }
  let departed = 0;
  let dead = 0;
  for (const r of reports.values()) {
    departed += r.departed;
    dead += r.dead;
    for (const [k, v] of Object.entries(r.causes)) deaths[`expedition:${k}`] = (deaths[`expedition:${k}`] ?? 0) + v;
  }
  const lost = Math.max(0, start.population - end.population);
  if (lost > 0) deaths["population:disette_et_pertes"] = lost;
  if (s.rumbling && s.rumbling.dead > 0) deaths["monde:grondement"] = s.rumbling.dead;
  const others: GameResult["others"] = {};
  for (const r of w.endings ?? []) {
    if (r.camp === camp) continue;
    const o = evaluateAs(w, s, r.camp);
    if (o) others[r.camp] = { outcome: o.state, defeat: o.defeat?.id ?? null };
  }
  return {
    scenario: w.scenario.id,
    camp,
    seed,
    profile: pilot.profile,
    outcome: e?.state ?? "en_cours",
    defeat: e?.defeat?.id ?? null,
    objectives: (e?.objectives ?? []).filter((o) => o.met).map((o) => o.id),
    others,
    days: toAbsoluteDay(s.date) - startDay,
    deaths,
    expeditions: { launched: reports.size, departed, dead },
    zeroDays,
    end: { morale: end.morale, stability: end.stability, legitimacy: s.politics?.legitimacy ?? null, populationShare: start.population > 0 ? end.population / start.population : 1, food: s.strategic?.stocks.food ?? 0 },
    minMorale,
    orders: { issued: pilot.issued, refused: pilot.refused },
    error,
  };
}
