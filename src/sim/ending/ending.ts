import { toAbsoluteDay } from "../core/time";
import type { GameState } from "../core/state";
import { createStrategicState } from "../strategic/economy";
import type { World } from "../strategic/world";
import type { EndingCondition, EndingRules } from "../../data/endingSchemas";

/**
 * Fins de partie (P9.1 ; 02 §13) : objectifs et défaites du scénario pour le camp joué, lus sur l'état sans jamais l'écrire
 * (aucune empreinte ne bouge). La partie est :
 * - en défaite dès qu'une condition de défaite est vraie ;
 * - en victoire au terme si au moins `min_objectifs` objectifs sont atteints, ou avant le terme si la victoire est
 *   « anticipée » et que ce nombre est atteint sans compter le terme ;
 * - « au terme » (issue mitigée) sinon, une fois le terme passé ; « en cours » avant.
 * L'interface arrête le temps et montre l'épilogue ; le joueur peut poursuivre en partie libre.
 */
export type EndingState = "en_cours" | "victoire" | "defaite" | "terme";

export interface ConditionStatus {
  id: string;
  cle: string;
  met: boolean;
  /** Avancement 0–1 (affichage) ; 1 quand atteint. */
  progress: number;
}

export interface EndingStatus {
  scenario: string;
  camp: string;
  adversaire: string;
  state: EndingState;
  objectives: ConditionStatus[];
  /** Objectifs atteints (terme compris s'il est passé). */
  met: number;
  needed: number;
  defeat: ConditionStatus | null;
  /** Jours écoulés depuis le départ ; jour du terme. */
  day: number;
  term: number;
}

const PARADIS = "paradis";

/** Camp joué : la nation du joueur (couche des nations), sinon la faction du scénario (« paradis » → « fac_paradis »). */
export function playedCamp(world: World, s: GameState): string {
  const f = s.nations?.player ?? s.strategic?.faction ?? world.scenario.faction;
  return f.startsWith("fac_") ? f : `fac_${f}`;
}

export function endingRules(world: World, s: GameState): EndingRules | null {
  const camp = playedCamp(world, s);
  return world.endings?.find((r) => r.camp === camp) ?? null;
}

const startPop = new WeakMap<World, number>();
function initialPopulation(world: World): number {
  let v = startPop.get(world);
  if (v === undefined) {
    const st = createStrategicState(world);
    v = Object.values(st.provinces).reduce((a, p) => a + (p.control === PARADIS ? p.population : 0), 0);
    startPop.set(world, v);
  }
  return v;
}

/** Grandeurs de l'île tenue : part des provinces des régions tenues, moyennes de moral et de stabilité, population. */
function island(world: World, s: GameState): { share: (regions: readonly string[]) => number; morale: number; stability: number; population: number } {
  const st = s.strategic;
  const held = st ? Object.values(st.provinces).filter((p) => p.control === PARADIS) : [];
  const avg = (k: "morale" | "stability"): number => (held.length ? held.reduce((a, p) => a + p[k], 0) / held.length : 0);
  return {
    share(regions) {
      const ids = world.provinces.filter((p) => regions.includes(p.region)).map((p) => p.id);
      if (!st || ids.length === 0) return 0;
      return ids.filter((id) => st.provinces[id]?.control === PARADIS).length / ids.length;
    },
    morale: avg("morale"),
    stability: avg("stability"),
    population: held.reduce((a, p) => a + p.population, 0),
  };
}

const ratio = (v: number, target: number): number => (target <= 0 ? 1 : Math.max(0, Math.min(1, v / target)));

/** Valeur d'une condition (vrai / faux) et son avancement. `elapsed` : jours écoulés ; `term` : jour du terme. */
export function condition(world: World, s: GameState, c: EndingCondition, camp: string, elapsed: number, term: number): { met: boolean; progress: number } {
  const isl = island(world, s);
  const ns = s.nations;
  switch (c.type) {
    case "terme":
      return { met: elapsed >= term, progress: ratio(elapsed, term) };
    case "region_min": {
      const v = isl.share(c.regions);
      return { met: v >= c.seuil, progress: ratio(v, c.seuil) };
    }
    case "region_max": {
      const v = isl.share(c.regions);
      return { met: v < c.seuil, progress: v < c.seuil ? 1 : 0 };
    }
    case "evenement": {
      // Survenu seulement (un événement évité ne compte pas).
      const met = c.evenements.some((e) => s.events?.history[e]?.status === "survenu");
      return { met, progress: met ? 1 : 0 };
    }
    case "stabilite_min":
      return { met: isl.stability >= c.seuil, progress: ratio(isl.stability, c.seuil) };
    case "stabilite_max":
      return { met: s.strategic !== null && isl.stability < c.seuil, progress: isl.stability < c.seuil ? 1 : 0 };
    case "moral_min":
      return { met: isl.morale >= c.seuil, progress: ratio(isl.morale, c.seuil) };
    case "legitimite_max": {
      const l = s.politics?.legitimacy;
      return { met: l !== undefined && l < c.seuil, progress: l !== undefined && l < c.seuil ? 1 : 0 };
    }
    case "famine": {
      const met = s.strategic !== null && s.strategic.stocks.food <= 0 && isl.morale <= c.moral;
      return { met, progress: met ? 1 : 0 };
    }
    case "population_max": {
      const met = s.strategic !== null && isl.population < c.part * initialPopulation(world);
      return { met, progress: met ? 1 : 0 };
    }
    case "fondateur": {
      const met = s.shifters?.titans["shifter_fondateur"]?.faction === c.camp;
      return { met, progress: met ? 1 : 0 };
    }
    case "controle": {
      const met = ns?.control[c.province] === c.faction;
      return { met, progress: met ? 1 : 0 };
    }
    case "paix": {
      const pair = [camp, c.avec].sort().join("|");
      const met = ns !== null && !ns.wars.includes(pair);
      return { met, progress: met ? 1 : 0 };
    }
    case "traite": {
      const met = ns !== null && ns.treaties.some((t) => (c.traite === undefined || t.kind === c.traite) && ((t.a === camp && t.b === c.avec) || (t.b === camp && t.a === c.avec)));
      return { met, progress: met ? 1 : 0 };
    }
    case "nation_stabilite_min": {
      const v = ns?.nations[c.faction]?.stability ?? 0;
      return { met: v >= c.seuil, progress: ratio(v, c.seuil) };
    }
    case "nation_stabilite_max": {
      const v = ns?.nations[c.faction]?.stability;
      return { met: v !== undefined && v < c.seuil, progress: v !== undefined && v < c.seuil ? 1 : 0 };
    }
    case "ravage_min": {
      const v = s.rumbling?.ravaged ?? 0;
      return { met: s.rumbling !== undefined && v >= c.seuil, progress: ratio(v, c.seuil) };
    }
    case "ravage_max": {
      const v = s.rumbling?.ravaged ?? 0;
      return { met: s.rumbling !== undefined && v < c.seuil, progress: s.rumbling !== undefined && v < c.seuil ? 1 : 0 };
    }
    case "grondement_arrete": {
      const met = s.rumbling?.stopped === true;
      return { met, progress: met ? 1 : 0 };
    }
  }
}

/** Fin de partie pour le camp joué, ou `null` si le scénario n'en a pas pour ce camp. */
export function evaluateEnding(world: World, s: GameState): EndingStatus | null {
  const rules = endingRules(world, s);
  if (!rules) return null;
  const camp = rules.camp;
  const elapsed = toAbsoluteDay(s.date) - toAbsoluteDay(world.scenario.start);
  const term = rules.terme_jours;
  const objectives = rules.objectifs.map((o) => ({ id: o.id, cle: o.cle, ...condition(world, s, o.cond, camp, elapsed, term) }));
  const defeats = rules.defaites.map((o) => ({ id: o.id, cle: o.cle, ...condition(world, s, o.cond, camp, elapsed, term) }));
  const met = objectives.filter((o) => o.met).length;
  const metEarly = objectives.filter((o, i) => o.met && rules.objectifs[i]?.cond.type !== "terme").length;
  const defeat = defeats.find((d) => d.met) ?? null;
  let state: EndingState = "en_cours";
  if (defeat) state = "defaite";
  else if (rules.victoire.anticipee && metEarly >= rules.victoire.min_objectifs) state = "victoire";
  else if (elapsed >= term) state = met >= rules.victoire.min_objectifs ? "victoire" : "terme";
  return { scenario: rules.scenario, camp, adversaire: rules.adversaire, state, objectives, met, needed: rules.victoire.min_objectifs, defeat, day: elapsed, term };
}
