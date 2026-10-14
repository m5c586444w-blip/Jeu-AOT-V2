import type { TruthBalance } from "../../data/balance";
import type { Condition } from "../../data/effects";
import type { EventDef } from "../../data/schemas";
import { Rng } from "../core/rng";
import { ready, schedule } from "../events/engine";
import type { EventsState } from "../events/engine";
import { cloneTruth } from "./dossier";
import { knows } from "./acts";
import type { TruthState } from "./types";

/**
 * Attracteurs de canon (26 §7) : un événement canon se déclenche dans sa fenêtre tant que les conditions restent proches de l'histoire ;
 * les écarts s'accumulent (`drift`) et s'ajoutent à la divergence du moteur d'événements ; au seuil, l'attraction faiblit puis la branche
 * devient divergente. Réutilise `ready`/`schedule` et la branche de `events/engine.ts` sans les modifier.
 */

/** Part des conditions de l'événement qui tiennent (1 si aucune condition : rien ne s'écarte de l'histoire). */
export function closeness(conditions: readonly Condition[], holds: (c: Condition) => boolean): number {
  if (conditions.length === 0) return 1;
  return conditions.filter((c) => holds(c)).length / conditions.length;
}

/** Divergence effective : poids des événements évités (moteur) + écart cumulé aux conditions. */
export const effectiveDivergence = (evDivergence: number, truth: TruthState): number => evDivergence + truth.canon.drift;

/**
 * Multiplicateur d'attraction (1 = pleine force). Branche canon : décroît linéairement de 1 (divergence nulle) à `weak_at_threshold` (au seuil).
 * Branche divergente : `divergent_floor`.
 */
export function attraction(divergence: number, branch: "canon" | "divergente", threshold: number, b: TruthBalance): number {
  if (branch === "divergente") return b.attractors.divergent_floor;
  const ratio = threshold > 0 ? Math.min(1, Math.max(0, divergence / threshold)) : 1;
  return 1 - ratio * (1 - b.attractors.weak_at_threshold);
}

/** Probabilité quotidienne de déclenchement d'un canon dans sa fenêtre : base × attraction × proximité^exposant. */
export const pullChance = (close: number, att: number, b: TruthBalance): number => b.attractors.pull_base * att * Math.pow(close, b.attractors.closeness_exp);

/** Fenêtre d'année d'un canon : de `year_min` à `year_max` (ou `year_min`). */
export const inWindow = (e: EventDef, year: number): boolean => year >= e.year_min && year <= (e.year_max ?? e.year_min);

export interface AttractorInput {
  /** Événements canon jouables (ex. `world.chronicle.canon`). */
  canon: readonly EventDef[];
  ev: EventsState;
  truth: TruthState;
  day: number;
  year: number;
  seed: number;
  /** Seuil de divergence du moteur (`events.json › divergence_threshold`). */
  threshold: number;
  /** Évaluation d'une condition dans le contexte courant (ex. `conditionHolds` du moteur). */
  holds: (c: Condition) => boolean;
}

export interface AttractorResult {
  ev: EventsState;
  truth: TruthState;
  /** Événements programmés ce jour par attraction. */
  pulled: string[];
}

/**
 * Évalue les attracteurs d'un jour (une fois par jour : idempotent). Pour chaque canon prêt dans sa fenêtre : écart = (1 − proximité) × `gap_weight`
 * × max(poids de divergence, `min_weight`) ajouté au `drift` ; tirage déterministe (graine, événement, jour) contre `pullChance` ; s'il gagne,
 * l'événement est programmé pour le jour même dans le moteur. Au seuil, la branche bascule (comme `checkBranch` du moteur).
 * Entrées non modifiées.
 */
export function stepAttractors(i: AttractorInput, b: TruthBalance): AttractorResult {
  if (i.day <= i.truth.canon.lastDay) return { ev: i.ev, truth: i.truth, pulled: [] };
  const ev = structuredClone(i.ev);
  const truth = cloneTruth(i.truth);
  truth.canon.lastDay = i.day;
  const pulled: string[] = [];
  const att = attraction(effectiveDivergence(ev.divergence, truth), ev.branch, i.threshold, b);
  for (const e of i.canon) {
    if (!e.playable || !inWindow(e, i.year) || !ready(ev, e)) continue;
    const close = closeness(e.conditions, i.holds);
    truth.canon.drift += (1 - close) * b.attractors.gap_weight * Math.max(e.divergence_weight ?? 0, b.attractors.min_weight);
    if (new Rng(i.seed).fork(`attracteur:${e.id}:${i.day}`).next() < pullChance(close, att, b)) {
      schedule(ev, e, i.seed, i.day, [0, 0]);
      truth.canon.pulled[e.id] = i.day;
      pulled.push(e.id);
    }
  }
  if (ev.branch === "canon" && effectiveDivergence(ev.divergence, truth) >= i.threshold) {
    ev.branch = "divergente";
    ev.chronicle.push({ day: i.day, event: "branche", status: "bascule", choice: null, auto: false, divergence: 0, subject: {} });
  }
  return { ev, truth, pulled };
}

export interface FactionPull {
  attractor: string;
  /** Fait que l'attracteur pousse à découvrir (null : orientation sans fait précis, par exemple la survie). */
  fact: string | null;
  pull: number;
}

/**
 * Attracteurs d'une faction (`factions › attractors`, valeurs de `truth.json`) : force = pull × attraction de canon ; un attracteur dont le fait est déjà
 * connu (à la fiabilité B) ne pousse plus. Triés par force décroissante puis identifiant. Un identifiant inconnu est ignoré.
 */
export function factionPulls(s: TruthState, faction: string, attractorIds: readonly string[], divergence: number, branch: "canon" | "divergente", threshold: number, today: number, b: TruthBalance): FactionPull[] {
  const att = attraction(divergence, branch, threshold, b);
  const out: FactionPull[] = [];
  for (const id of attractorIds) {
    const a = b.attractors.faction[id];
    if (!a) continue;
    if (a.fact !== null && knows(s, faction, a.fact, "B", today, b)) continue;
    out.push({ attractor: id, fact: a.fact, pull: a.pull * att });
  }
  return out.sort((x, y) => y.pull - x.pull || x.attractor.localeCompare(y.attractor));
}
