import { Rng } from "./rng";
import { canonicalClone } from "./canonical";
import { advance, DAYS_PER_MONTH, START_DATE, toAbsoluteDay } from "./time";
import type { GameDate } from "./time";
import { applyDay, applyMonth, createStrategicState, NO_MODS, planDay, planMonth } from "../strategic/economy";
import type { StrategicState } from "../strategic/economy";
import { economyMods } from "../politics/politics";
import { createPoliticalState } from "../politics/state";
import type { PoliticalState } from "../politics/state";
import { dailyPolitics, monthlyPolitics } from "../politics/tick";
import type { World } from "../strategic/world";
import { createMilitaryState } from "../military/state";
import type { MilitaryState } from "../military/state";
import { dailyMilitary } from "../military/tick";
import { createEventsState, dailyEvents } from "../events/engine";
import type { EventsState } from "../events/engine";
import { createIntelState, dailyIntel, monthlyCult } from "../intel/intel";
import type { IntelState } from "../intel/intel";
import { createResearchState, monthlyResearch, techHook, techMods } from "../research/research";
import type { ResearchState } from "../research/research";
import { createShiftersState, dailyShifters } from "../shifters/shifters";
import type { ShiftersState } from "../shifters/shifters";
import { createNationsState, dailyBuilds, monthlyNations, weeklyMoves } from "../world/nations";
import type { NationsState } from "../world/nations";
import { weeklyWar } from "../world/war";
import { monthlyAi, weeklyAi } from "../world/ai";
import { monthlyDiplomacy } from "../world/diplomacy";
import { pushLog } from "../strategic/economy";

export const CURRENT_SCHEMA_VERSION = 8 as const;

/** État complet et sérialisable de la partie (P0 + couche stratégique de P1). */
export interface GameState {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  seed: number;
  rng: { state: number };
  date: GameDate;
  world: { noise: number; flags: Record<string, boolean> };
  commandIndex: number;
  /** null quand la partie tourne sans monde chargé (tests de fondation P0). */
  strategic: StrategicState | null;
  /** Couche politique (P2) ; null pour un scénario sans politique. */
  politics: PoliticalState | null;
  /** Expéditions et logistique (P3) ; null sans couche militaire, ou juste après migration d'une sauvegarde v3. */
  military: MilitaryState | null;
  /** Événements canon et génériques, divergence (P5) ; null sans chronologie ou juste après migration d'une sauvegarde v5. */
  events: EventsState | null;
  /** Recherche (P5). */
  research: ResearchState | null;
  /** Renseignement (P5). */
  intel: IntelState | null;
  /** Titans-porteurs (P6) ; null sans données des Neuf, ou juste après migration d'une sauvegarde v6. */
  shifters: ShiftersState | null;
  /** Monde des nations (P7) ; null hors d'un scénario à couche `world`, ou juste après migration d'une sauvegarde v7. */
  nations: NationsState | null;
}

export function createInitialState(seed: number, world?: World): GameState {
  const s = seed >>> 0;
  // Forme canonique (D-66), comme après chaque commande.
  return canonicalClone<GameState>({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    seed: s,
    rng: { state: s | 0 },
    date: world ? { ...world.scenario.start } : { ...START_DATE },
    world: { noise: 0, flags: {} },
    commandIndex: 0,
    strategic: world ? createStrategicState(world) : null,
    politics: world ? createPoliticalState(world) : null,
    military: world?.military ? createMilitaryState(world, s) : null,
    events: null,
    research: null,
    intel: null,
    shifters: world ? createShiftersState(world) : null,
    nations: world ? createNationsState(world, world.scenario.start) : null,
    ...(world ? p5Layers(world, s, world.scenario.start) : {}),
  });
}

/** Couches de P5 créées au départ, ou au premier jour simulé d'une sauvegarde migrée. */
function p5Layers(world: World, seed: number, date: GameDate): Pick<GameState, "events" | "research" | "intel"> {
  const st = createStrategicState(world);
  return { events: createEventsState(world, seed, date), research: createResearchState(world), intel: createIntelState(world, seed, st, date) };
}

/**
 * Avance d'un jour. Un tirage du RNG par jour alimente `world.noise` (système témoin de P0) ;
 * si un monde est chargé, l'économie du jour est appliquée, puis les flux mensuels au 1er du mois.
 */
export function tickDay(state: GameState, world?: World): GameState {
  const rng = Rng.fromState({ seed: state.seed, state: state.rng.state });
  const noise = rng.next();
  let strategic = state.strategic;
  let politics = state.politics;
  let military = state.military ?? (world?.military ? createMilitaryState(world, state.seed) : null);
  let events = state.events;
  let research = state.research;
  let intel = state.intel;
  let shifters = state.shifters;
  let nations = state.nations;
  const date = advance(state.date, 1);
  if (world && strategic) {
    // Sauvegarde migrée (v5) : couches de P5 créées à la date courante.
    if (!events && world.chronicle) events = createEventsState(world, state.seed, state.date);
    if (!research && world.research) research = createResearchState(world);
    if (!intel && world.intel) intel = createIntelState(world, state.seed, strategic, state.date);
    // Sauvegarde migrée (v6) : porteurs de 850 repris des données.
    if (!shifters && world.shifters) shifters = createShiftersState(world);
    if (shifters) shifters = structuredClone(shifters);
    if (!nations && world.nations) nations = createNationsState(world, state.date);
    if (nations) nations = structuredClone(nations);
    const mods = politics && world.politics ? economyMods(world, politics, strategic) : NO_MODS;
    strategic = applyDay(world, strategic, planDay(world, strategic, state.date, mods));
    if (politics && world.politics) {
      politics = structuredClone(politics);
      dailyPolitics(world, politics, strategic, state.date);
    }
    // Événements (P5) : effets sur les couches stratégique, politique, recherche et renseignement.
    if (events) {
      const ctx = { world, seed: state.seed, date: state.date, st: strategic, pol: politics, mil: military, rs: research ? structuredClone(research) : null, intel: intel ? structuredClone(intel) : null, ev: structuredClone(events), sh: shifters, na: nations };
      dailyEvents(ctx);
      strategic = ctx.st;
      politics = ctx.pol;
      research = ctx.rs;
      intel = ctx.intel;
      events = ctx.ev;
    }
    if (military) {
      const reportsBefore = military.reports.length;
      const r = dailyMilitary(world, state.seed, state.date, military, strategic, politics, techMods(world, research));
      military = r.mil;
      strategic = r.st;
      politics = r.pol;
      // Titans capturés vivants par une expédition « capture » réussie (F-TEC-02).
      const captures = military.reports.slice(reportsBefore).filter((x) => x.objective === "capture" && x.outcome !== "echec").length;
      if (captures > 0 && research) research = { ...research, captured: research.captured + captures };
    }
    if (intel) {
      intel = structuredClone(intel);
      dailyIntel({ world, seed: state.seed, date: state.date, st: strategic, pol: politics, mil: military, rs: research }, intel);
    }
    // Porteurs (P6) : morts du jour sans ingestion, horloge des 13 ans, visions.
    if (shifters) {
      const sctx = { world, seed: state.seed, date, st: strategic, pol: politics, intel, sh: shifters, flags: events?.flags ?? {} };
      dailyShifters(sctx);
      strategic = sctx.st;
      politics = sctx.pol;
    }
    // Monde des nations (P7) : levées du jour, mouvements à chaque semaine, économie de guerre au 1er du mois.
    if (nations && world.nations) {
      dailyBuilds(world, nations, date);
      if (toAbsoluteDay(date) % 7 === 0) {
        const wctx = { world, seed: state.seed, date, ns: nations, sh: shifters, pol: politics, st: strategic };
        weeklyWar(wctx);
        politics = wctx.pol;
        if (wctx.st) strategic = wctx.st;
        weeklyMoves(world, nations);
        weeklyAi({ world, date, ns: nations, sh: shifters, pol: politics, st: strategic });
      }
      if (date.day % DAYS_PER_MONTH === 1) {
        monthlyNations(world, nations, strategic, date);
        monthlyDiplomacy(world, nations, date);
        monthlyAi({ world, date, ns: nations, sh: shifters, pol: politics, st: strategic });
      }
    }
    if (date.day % DAYS_PER_MONTH === 1) {
      strategic = applyMonth(world, strategic, planMonth(world, strategic, mods), date);
      if (politics && world.politics) monthlyPolitics(world, politics, strategic, date);
      if (research) {
        research = structuredClone(research);
        for (const l of monthlyResearch(world, state.seed, research, politics, date)) pushLog(strategic, date, `log.${l.key}`, l.params, l.key === "research.completed");
        const legit = techHook(world, research, "legitimacy_month");
        if (politics && legit !== 0) politics.legitimacy = Math.max(0, Math.min(100, politics.legitimacy + legit));
      }
      if (intel) monthlyCult(world, intel, research);
    }
  }
  return { ...state, rng: { state: rng.serialize().state }, date, world: { ...state.world, noise }, strategic, politics, military, events, research, intel, shifters, nations };
}
