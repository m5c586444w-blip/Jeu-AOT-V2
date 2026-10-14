import type { ClockBalance } from "../../data/balance";
import type { ShiftersState } from "../shifters/shifters";
import { titansOf } from "../shifters/shifters";
import { cloneClock, without } from "./suspicion";
import type { Bearer, ClockState, RosterEntry } from "./types";

/** Années restantes d'un Titan (même formule que `yearsLeft` de shifters.ts : curse − (année − since)). */
export const yearsLeftOf = (since: number, year: number, curseYears: number): number => curseYears - (year - since);

/**
 * Invariant des Neuf (spec 26 §6a) : exactement les neuf Titans de `clock.json › nine`, chacun avec au plus un détenteur ;
 * un pouvoir « perdu » n'a pas de détenteur ; un détenteur n'est pas « perdu ». `alive` (facultatif) : un détenteur mort est une violation.
 */
export function nineViolations(sh: ShiftersState, b: ClockBalance, alive?: (character: string) => boolean): string[] {
  const out: string[] = [];
  const ids = Object.keys(sh.titans).sort();
  const want = [...b.nine].sort();
  for (const id of want) if (!ids.includes(id)) out.push(`manquant : ${id}`);
  for (const id of ids) if (!want.includes(id)) out.push(`intrus : ${id}`);
  for (const id of ids) {
    const slot = sh.titans[id];
    if (!slot) continue;
    if (slot.faction === "perdu" && slot.holder !== null) out.push(`${id} : perdu mais détenu par ${slot.holder}`);
    if (slot.holder !== null && slot.faction === "perdu") continue;
    if (slot.holder !== null && alive && !alive(slot.holder)) out.push(`${id} : détenteur mort ${slot.holder}`);
  }
  return out;
}

/** Années utiles restantes = horloge − usure des projections. */
export const effectiveYears = (bearer: Bearer, yearsLeft: number): number => yearsLeft - bearer.wearYears;

export const isExhausted = (bearer: Bearer, yearsLeft: number, b: ClockBalance): boolean => effectiveYears(bearer, yearsLeft) <= b.roster.exhausted_below_years;

/** Coût d'une projection de `days` jours (Marley) : capital politique et usure en années [A]. */
export function projectionCost(days: number, b: ClockBalance): { capital: number; wearYears: number } {
  if (days < 0) throw new RangeError("clock : durée négative");
  return { capital: b.roster.deploy_capital + b.roster.capital_per_day * days, wearYears: b.roster.wear_years_per_day * days };
}

/** Projette un porteur : l'usure s'ajoute (l'horloge canonique des 13 ans n'est pas modifiée). */
export function deployBearer(s: ClockState, id: string, days: number, b: ClockBalance): { state: ClockState; cost: { capital: number; wearYears: number } } {
  const cost = projectionCost(days, b);
  const bearer = s.bearers[id];
  if (!bearer) return { state: s, cost: { capital: 0, wearYears: 0 } };
  const state = cloneClock(s);
  (state.bearers[id] as Bearer).wearYears += cost.wearYears;
  return { state, cost };
}

/** Utiliser maintenant (années utiles ≤ `use_now_years`) ou garder pour plus tard. */
export const adviceFor = (effective: number, b: ClockBalance): "utiliser" | "garder" => (effective <= b.roster.use_now_years ? "utiliser" : "garder");

/** Roster d'une faction : ses porteurs, les plus pressés d'abord. */
export function rosterOf(s: ClockState, sh: ShiftersState, faction: string, year: number, curseYears: number, b: ClockBalance): RosterEntry[] {
  const out: RosterEntry[] = [];
  for (const id of Object.keys(s.bearers).sort()) {
    const br = s.bearers[id] as Bearer;
    const titans = titansOf(sh, id);
    if (br.faction !== faction || titans.length === 0) continue;
    const yl = Math.min(...titans.map((t) => yearsLeftOf(sh.titans[t]?.since ?? year, year, curseYears)));
    const eff = effectiveYears(br, yl);
    out.push({ bearer: id, titans, yearsLeft: yl, effectiveYears: eff, exhausted: isExhausted(br, yl, b), advice: adviceFor(eff, b) });
  }
  return out.sort((a, c) => a.effectiveYears - c.effectiveYears || a.bearer.localeCompare(c.bearer));
}

/**
 * Accord avec l'horloge des Titans (héritage, malédiction, pouvoir perdu) : un suivi dont le personnage ne tient plus aucun Titan est retiré
 * (suspicions comprises : l'identité secrète est morte avec lui) ; les détenteurs nommés sans suivi sont rapportés pour enregistrement.
 */
export function syncBearers(s: ClockState, sh: ShiftersState): { state: ClockState; removed: string[]; unregistered: { holder: string; titans: string[] }[] } {
  const state = cloneClock(s);
  const removed: string[] = [];
  for (const id of Object.keys(state.bearers).sort()) {
    if (titansOf(sh, id).length > 0) continue;
    state.bearers = without(state.bearers, id);
    state.suspects = without(state.suspects, id);
    removed.push(id);
  }
  const holders = [...new Set(Object.values(sh.titans).map((t) => t.holder).filter((h): h is string => h !== null))].sort();
  const unregistered = holders.filter((h) => !state.bearers[h]).map((h) => ({ holder: h, titans: titansOf(sh, h) }));
  return { state, removed, unregistered };
}
