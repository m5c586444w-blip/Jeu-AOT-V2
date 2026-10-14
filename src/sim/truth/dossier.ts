import type { TruthBalance } from "../../data/balance";
import { TruthError } from "./types";
import type { Assessment, Decision, Evidence, Grade, TruthEvent, TruthState } from "./types";

export const cloneTruth = (s: TruthState): TruthState => structuredClone(s);

/** Monde de départ : la vérité de chaque fait de `truth.json`, aucun dossier, aucune découverte. Les actes sont initialisés par `initActs`. */
export function createTruthState(b: TruthBalance, day: number): TruthState {
  const facts: TruthState["facts"] = {};
  for (const id of Object.keys(b.facts).sort()) facts[id] = { veracity: (b.facts[id] as { veracity: boolean }).veracity, day };
  return { facts, dossiers: {}, discovered: {}, acts: {}, canon: { drift: 0, lastDay: day - 1, pulled: {} }, events: [], seq: 0 };
}

/** Ajoute (ou corrige) un fait du monde : sa véracité réelle. */
export function setFact(s: TruthState, id: string, veracity: boolean, day: number): TruthState {
  const out = cloneTruth(s);
  out.facts[id] = { veracity, day };
  return out;
}

const evidenceOf = (s: TruthState, faction: string, fact: string): Evidence[] => s.dossiers[faction]?.[fact] ?? [];

/** Dernière pièce de chaque origine : une origine qui se reprend remplace sa version précédente. */
function latestPerOrigin(list: readonly Evidence[]): Evidence[] {
  const byOrigin = new Map<string, Evidence>();
  for (const e of list) byOrigin.set(e.origin, e);
  return [...byOrigin.values()];
}

/** Poids d'une pièce à la date `today` : poids de la source × qualité × vieillissement (demi-vie, plancher). */
export function weightOf(e: Evidence, today: number, b: TruthBalance): number {
  const src = b.sources[e.source];
  if (!src) throw new TruthError("truth.err.unknown_source");
  const age = Math.max(0, today - e.day);
  const aging = Math.max(b.age.floor, Math.pow(0.5, age / b.age.half_life_days));
  return src.weight * e.quality * aging;
}

/** Score d'une version : poids cumulés, majorés par la corroboration d'origines indépendantes (plafonnée). */
function sideScore(weights: readonly number[], b: TruthBalance): number {
  if (weights.length === 0) return 0;
  const sum = weights.reduce((a, w) => a + w, 0);
  return sum * (1 + b.corroboration.bonus * (Math.min(weights.length, b.corroboration.max_origins) - 1));
}

export function gradeOf(confidence: number, b: TruthBalance): Grade {
  if (confidence >= b.grades.A) return "A";
  if (confidence >= b.grades.B) return "B";
  if (confidence >= b.grades.C) return "C";
  return "D";
}

/**
 * Ce qu'une faction croit d'un fait, et avec quelle fiabilité (A–D). Dépend des seules pièces de son dossier (jamais de la véracité),
 * sauf pour un fait vérifié (découverte) : croyance = vérité, fiabilité `grades.verified`.
 * Confiance = score de la version gagnante − `penalty` × score de la version adverse ; sous `min_margin` d'écart, aucune croyance (grade D).
 */
export function assess(s: TruthState, faction: string, fact: string, today: number, b: TruthBalance): Assessment {
  const list = evidenceOf(s, faction, fact);
  const verified = s.discovered[faction]?.[fact] !== undefined;
  const latest = latestPerOrigin(list);
  const pro = latest.filter((e) => e.claim).map((e) => weightOf(e, today, b));
  const con = latest.filter((e) => !e.claim).map((e) => weightOf(e, today, b));
  const contradicted = pro.length > 0 && con.length > 0;
  const ageDays = list.length === 0 ? null : today - Math.max(...list.map((e) => e.day));
  if (verified) {
    const truth = s.facts[fact];
    if (!truth) throw new TruthError("truth.err.unknown_fact");
    return { belief: truth.veracity, grade: b.grades.verified, confidence: b.grades.A, backing: latest.filter((e) => e.claim === truth.veracity).length, contradicted, ageDays, verified: true };
  }
  if (latest.length === 0) return { belief: null, grade: null, confidence: 0, backing: 0, contradicted: false, ageDays, verified: false };
  const sp = sideScore(pro, b);
  const sc = sideScore(con, b);
  if (Math.abs(sp - sc) < b.contradiction.min_margin) return { belief: null, grade: "D", confidence: 0, backing: 0, contradicted, ageDays, verified: false };
  const belief = sp > sc;
  const confidence = Math.max(0, (belief ? sp : sc) - b.contradiction.penalty * (belief ? sc : sp));
  return { belief, grade: gradeOf(confidence, b), confidence, backing: belief ? pro.length : con.length, contradicted, ageDays, verified: false };
}

/**
 * Une source verse une pièce au dossier d'une faction. Retourne l'état et le coût mental (les visions des Chemins en ont un : à appliquer
 * au stress du porteur par l'appelant). Une contradiction nouvelle produit un événement visible de cette seule faction.
 */
export function recordEvidence(
  s: TruthState,
  faction: string,
  fact: string,
  source: string,
  claim: boolean,
  day: number,
  origin: string,
  b: TruthBalance,
  quality = 1,
): { state: TruthState; mentalCost: number } {
  if (!s.facts[fact]) throw new TruthError("truth.err.unknown_fact");
  const src = b.sources[source];
  if (!src) throw new TruthError("truth.err.unknown_source");
  if (!(quality >= 0 && quality <= 1)) throw new TruthError("truth.err.bad_quality");
  const wasContradicted = assess(s, faction, fact, day, b).contradicted;
  const out = cloneTruth(s);
  const ev: Evidence = { id: `ev_${++out.seq}`, fact, source, claim, day, origin, quality };
  const row = (out.dossiers[faction] ??= {});
  (row[fact] ??= []).push(ev);
  if (!wasContradicted && assess(out, faction, fact, day, b).contradicted) out.events.push({ type: "contradiction", day, faction, fact });
  return { state: out, mentalCost: src.mental_cost };
}

/**
 * Découverte : la faction vérifie le fait (enquête aboutie, preuve décisive). Sa croyance devient la vérité, fiabilité `grades.verified`.
 * `corrected` : elle croyait le contraire.
 */
export function reveal(s: TruthState, faction: string, fact: string, day: number, b: TruthBalance): TruthState {
  const truth = s.facts[fact];
  if (!truth) throw new TruthError("truth.err.unknown_fact");
  if (s.discovered[faction]?.[fact] !== undefined) return s;
  const prior = assess(s, faction, fact, day, b);
  const out = cloneTruth(s);
  (out.discovered[faction] ??= {})[fact] = day;
  const ev: TruthEvent = { type: "discovery", day, faction, fact, corrected: prior.belief !== null && prior.belief !== truth.veracity };
  out.events.push(ev);
  return out;
}

/**
 * Agir sur ce qu'on croit (26 §7) : une croyance fausse a un coût réel, d'autant plus fort qu'elle était jugée sûre (A coûte plus que D) ;
 * agir à l'aveugle (aucune croyance) coûte `blind_ratio` × base ; une croyance juste ne coûte rien.
 */
export function decide(s: TruthState, faction: string, fact: string, today: number, b: TruthBalance): Decision {
  const truth = s.facts[fact];
  if (!truth) throw new TruthError("truth.err.unknown_fact");
  const a = assess(s, faction, fact, today, b);
  if (a.belief === null) return { believed: null, grade: a.grade, mistaken: false, cost: b.error.base * b.error.blind_ratio };
  const mistaken = a.belief !== truth.veracity;
  const grade = a.grade as Grade;
  return { believed: a.belief, grade, mistaken, cost: mistaken ? b.error.base * b.error.cost_by_grade[grade] : 0 };
}

/** Faits contradictoires du dossier d'une faction (les deux versions présentes), triés. */
export function contradictionsOf(s: TruthState, faction: string, today: number, b: TruthBalance): string[] {
  return Object.keys(s.dossiers[faction] ?? {}).sort().filter((f) => assess(s, faction, f, today, b).contradicted);
}

/** Événements visibles par une faction : les siens uniquement. */
export const eventsForFaction = (s: TruthState, faction: string): TruthEvent[] => s.events.filter((e) => e.faction === faction);

/**
 * Invariant (26 §7 test a) : aucun fait « sûr » sans source. Retourne les faits d'une faction dont l'évaluation affiche une croyance ou un
 * grade sans pièce au dossier ni vérification. Toujours vide.
 */
export function unsourcedBeliefs(s: TruthState, faction: string, today: number, b: TruthBalance): string[] {
  const out: string[] = [];
  for (const f of Object.keys(s.facts).sort()) {
    const a = assess(s, faction, f, today, b);
    const hasSource = evidenceOf(s, faction, f).length > 0 || a.verified;
    if (!hasSource && (a.belief !== null || a.grade !== null)) out.push(f);
  }
  return out;
}
