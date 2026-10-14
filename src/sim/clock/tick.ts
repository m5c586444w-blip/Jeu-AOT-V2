import type { ClockBalance } from "../../data/balance";
import type { ShiftersState } from "../shifters/shifters";
import { registerBearer, createClockState, stepSuspicionDay } from "./suspicion";
import { syncBearers } from "./roster";
import type { ClockState } from "./types";

/**
 * État initial du pilier P5 (D-169). Les porteurs nommés de `shifters` sont enregistrés (rôle de couverture selon la faction du Titan,
 * état d'esprit de départ de `clock.json › init`) ; sans état des porteurs, l'horloge démarre vide. Pur.
 */
export function initClock(sh: ShiftersState | null, b: ClockBalance): ClockState {
  let s = createClockState();
  const init = b.init;
  if (!sh || !init) return s;
  const seen = new Set<string>();
  for (const id of Object.keys(sh.titans).sort()) {
    const slot = sh.titans[id];
    if (!slot || !slot.holder || seen.has(slot.holder)) continue;
    const role = init.role_by_faction[slot.faction];
    if (role === undefined || b.cover.initial[role] === undefined) continue; // pouvoir perdu, ou faction sans rôle : non suivi
    seen.add(slot.holder);
    s = registerBearer(s, { id: slot.holder, faction: slot.faction, role, will: init.will, stress: init.stress, bonds: init.bonds }, b);
  }
  return s;
}

/**
 * Pas d'un jour du pilier P5 (D-169) : décroissance des suspicions au calme, puis accord avec l'horloge des Titans (un suivi dont le
 * personnage ne tient plus aucun Titan est retiré). Lecture seule sur `shifters` ; aucune preuve n'est créée ici (elles viennent des
 * événements, branchement ultérieur). `day` est le jour absolu. Pur.
 */
export function tickClock(prev: ClockState, b: ClockBalance, sh: ShiftersState | null, day: number): ClockState {
  const decayed = stepSuspicionDay(prev, day, b);
  return sh ? syncBearers(decayed, sh).state : decayed;
}
