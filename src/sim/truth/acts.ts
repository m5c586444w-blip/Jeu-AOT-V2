import type { TruthBalance } from "../../data/balance";
import { assess, cloneTruth } from "./dossier";
import { gradeRank, TruthError } from "./types";
import type { Grade, TruthState } from "./types";

type ActDef = TruthBalance["acts"][number];

/** Actes dans l'ordre de la partie. */
export const actsInOrder = (b: TruthBalance): ActDef[] => [...b.acts].sort((x, y) => x.order - y.order);

const actDef = (id: string, b: TruthBalance): ActDef => {
  const a = b.acts.find((x) => x.id === id);
  if (!a) throw new TruthError("truth.err.unknown_act");
  return a;
};

/** Acte de départ d'un scénario : le dernier dont `start_year` ≤ année (845 : I, 850 : II, 854 : III). */
export function actAtYear(year: number, b: TruthBalance): string {
  const sorted = actsInOrder(b);
  let cur = sorted[0] as ActDef;
  for (const a of sorted) if (a.start_year <= year) cur = a;
  return cur.id;
}

/** Acte atteint par une faction (le premier si elle n'en a pas encore). */
export const actOf = (s: TruthState, faction: string, b: TruthBalance): string => s.acts[faction] ?? (actsInOrder(b)[0] as ActDef).id;

/** Fixe l'acte de départ des factions (ne rétrograde jamais). */
export function initActs(s: TruthState, factions: readonly string[], year: number, b: TruthBalance): TruthState {
  const out = cloneTruth(s);
  const start = actDef(actAtYear(year, b), b);
  for (const f of factions) {
    const cur = actDef(actOf(out, f, b), b);
    if (!out.acts[f] || start.order > cur.order) out.acts[f] = start.id;
  }
  return out;
}

/** La faction connaît réellement le fait : sa croyance est la vérité, avec une fiabilité au moins `minGrade`. Une croyance fausse ne compte pas. */
export function knows(s: TruthState, faction: string, fact: string, minGrade: Grade, today: number, b: TruthBalance): boolean {
  const truth = s.facts[fact];
  if (!truth) return false;
  const a = assess(s, faction, fact, today, b);
  return a.belief === truth.veracity && a.grade !== null && gradeRank(a.grade) <= gradeRank(minGrade);
}

/**
 * Passe à l'acte suivant tant que ses faits requis sont connus (par découverte, jamais par menu) à la fiabilité exigée.
 * Par faction ; un acte atteint n'est jamais perdu.
 */
export function advanceActs(s: TruthState, faction: string, today: number, b: TruthBalance): TruthState {
  let out = s;
  for (;;) {
    const cur = actDef(actOf(out, faction, b), b);
    const next = actsInOrder(b).find((a) => a.order > cur.order);
    if (!next || !next.requires.every((f) => knows(out, faction, f, next.min_grade, today, b))) return out;
    out = cloneTruth(out);
    out.acts[faction] = next.id;
    out.events.push({ type: "act_reached", day: today, faction, act: next.id });
  }
}

export const actPillars = (id: string, b: TruthBalance): readonly string[] => actDef(id, b).pillars;

/** Capacités ouvertes à une faction : acte atteint ≥ acte requis, et faction autorisée si la capacité est réservée (marine, aviation). */
export function capabilitiesOf(s: TruthState, faction: string, b: TruthBalance): string[] {
  const cur = actDef(actOf(s, faction, b), b).order;
  return Object.keys(b.capabilities)
    .sort()
    .filter((k) => {
      const c = b.capabilities[k] as TruthBalance["capabilities"][string];
      return actDef(c.act, b).order <= cur && (c.factions === null || c.factions.includes(faction));
    });
}

export const hasCapability = (s: TruthState, faction: string, capability: string, b: TruthBalance): boolean => capabilitiesOf(s, faction, b).includes(capability);
