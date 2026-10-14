import type { ClockBalance } from "../../data/balance";
import type { ShiftersState } from "../shifters/shifters";
import { titansOf } from "../shifters/shifters";
import { isExposedTo } from "./suspicion";
import { ClockError, FACTION_PARADIS } from "./types";
import type { ClockState, ExtractionOdds, ExtractionOutcome } from "./types";

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Pourquoi `observer` ne peut pas viser l'extraction de `target`, ou null. Un personnage inconnu comme porteur et un innocent
 * donnent le même refus (aucune fuite par le message). Le porteur est dans la nuque [C] : il faut le connaître pour le capturer.
 */
export function extractionProblem(s: ClockState, sh: ShiftersState | null, target: string, observer: string): string | null {
  const br = s.bearers[target];
  if (!br || !isExposedTo(br, observer)) return "clock.err.unknown_identity";
  if (br.faction === observer) return "clock.err.own_bearer";
  const titans = titansOf(sh, target);
  if (titans.length > 0 && titans.every((t) => sh?.titans[t]?.captured)) return "clock.err.already_captured";
  return null;
}

/**
 * Chances d'une extraction : mort = kill_base (× contention_kill_mult avec l'arme de contention [C]) ; capture = base + per_attacker × min(n, max)
 * + contention_bonus − resist_k × contrôle/100, bornée à ce qui reste après la mort ; le reste est une fuite. Somme = 1.
 */
export function extractionOdds(attackers: number, contention: boolean, control: number, b: ClockBalance): ExtractionOdds {
  if (!Number.isInteger(attackers) || attackers < 1) throw new RangeError("clock : au moins un assaillant");
  const e = b.extraction;
  const kill = e.kill_base * (contention ? e.contention_kill_mult : 1);
  const raw = e.base + e.per_attacker * Math.min(attackers, e.max_attackers) + (contention ? e.contention_bonus : 0) - (e.resist_k * clamp(control, 0, 100)) / 100;
  const capture = clamp(raw, 0, 1 - kill);
  return { kill, capture, escape: 1 - kill - capture };
}

export function extractionOutcome(odds: ExtractionOdds, roll: number): ExtractionOutcome {
  if (roll < odds.kill) return "mort";
  if (roll < odds.kill + odds.capture) return "capture";
  return "fuite";
}

/**
 * Capture : tous les Titans du porteur passent « captured » (héritage préparé possible par Paradis, `inheritProblem`) ; l'horloge des 13 ans
 * n'est pas touchée (`since` inchangé). Seul Paradis peut marquer `captured` (le drapeau de `ShiftersSlot` signifie « aux mains de Paradis »).
 * Refus typé (`ClockError`, mêmes clés que `extractionProblem`) si l'identité n'est pas connue de l'observateur, si le porteur est le sien ou déjà capturé.
 * La mort du porteur (outcome « mort ») est appliquée par l'appelant via le système de personnages.
 */
export function applyCapture(s: ClockState, sh: ShiftersState, target: string, observer: string): ShiftersState {
  const problem = extractionProblem(s, sh, target, observer);
  if (problem !== null) throw new ClockError(problem);
  if (observer !== FACTION_PARADIS) return sh;
  const out = structuredClone(sh);
  for (const t of titansOf(out, target)) {
    const slot = out.titans[t];
    if (slot) out.titans[t] = { ...slot, captured: true };
  }
  return out;
}
