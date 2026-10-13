import { STATES } from "./catalog";

/**
 * Machine d'états d'affichage de R3 (logique pure, sans three.js) : l'état montré d'une figure est LU sur l'état de la
 * simulation à chaque pas, sans jamais le modifier ; une petite mémoire par figure garde ce que la simulation ne dit pas
 * (instant de la mort pour la chute, dernier coup de lame, arrêt depuis deux pas) et l'état précédent pour le fondu.
 */
export type TitanShow = "repos" | "marche" | "course" | "saisie" | "devore" | "rampant" | "chute" | "abattu";
export const TITAN_SHOWS: readonly TitanShow[] = ["repos", "marche", "course", "saisie", "devore", "rampant", "chute", "abattu"];

/** Ce que la machine lit d'un Titan de la simulation. */
export interface TitanReading {
  alive: boolean;
  grabbing: number | null;
  grabTimer: number;
  legs: number;
  x: number;
  y: number;
  abnormal: boolean;
}

export interface ShowMemory<S extends string> {
  state: S;
  /** Instant (s) où l'état a commencé ; état d'avant (fondu). */
  since: number;
  prev: S;
  x: number;
  y: number;
  /** Pas consécutifs sans déplacement ; vitesse mesurée au dernier pas (m/s). */
  still: number;
  speed: number;
  /** Instant de la mort (chute), du dernier coup de lame. */
  deadAt: number | null;
  cutAt: number | null;
  cut: number;
}

const MOVE_EPS = 0.01;

function remember<S extends string>(mem: ShowMemory<S> | null, next: S, time: number, x: number, y: number, still: number, speed: number, extra: Partial<ShowMemory<S>> = {}): ShowMemory<S> {
  const changed = !mem || mem.state !== next;
  return {
    state: next,
    since: changed ? time : (mem as ShowMemory<S>).since,
    prev: changed ? (mem?.state ?? next) : (mem as ShowMemory<S>).prev,
    x,
    y,
    still,
    speed,
    deadAt: mem?.deadAt ?? null,
    cutAt: mem?.cutAt ?? null,
    cut: mem?.cut ?? 0,
    ...extra,
  };
}

/** État montré d'un Titan au pas courant (`time` en s, `dt` : durée depuis la lecture précédente). */
export function titanShow(mem: ShowMemory<TitanShow> | null, t: TitanReading, time: number, dt: number): ShowMemory<TitanShow> {
  const d = mem ? Math.hypot(t.x - mem.x, t.y - mem.y) : 0;
  const moved = d > MOVE_EPS;
  const still = moved ? 0 : (mem?.still ?? 2) + 1;
  const speed = dt > 0 ? d / dt : (mem?.speed ?? 0);
  if (!t.alive) {
    const deadAt = mem?.deadAt ?? time;
    return remember(mem, time - deadAt < STATES.chute_s ? "chute" : "abattu", time, t.x, t.y, still, 0, { deadAt });
  }
  let s: TitanShow;
  if (t.grabbing !== null) s = t.grabTimer <= STATES.devore_dernieres_s ? "devore" : "saisie";
  else if (t.legs > 0) s = "rampant";
  else if (still < 2) s = speed >= STATES.course_m_s || (t.abnormal && speed >= STATES.course_m_s * 0.6) ? "course" : "marche";
  else s = "repos";
  return remember(mem, s, time, t.x, t.y, still, speed, { deadAt: null });
}

/** Poids du fondu de l'état précédent vers l'état courant (0 → 1 en `fondu_s`). */
export function blendWeight(mem: ShowMemory<string>, time: number): number {
  return Math.max(0, Math.min(1, (time - mem.since) / STATES.fondu_s));
}

/** Avancement de la chute d'un Titan (0 → 1 en `chute_s`). */
export function fallProgress(mem: ShowMemory<string>, time: number): number {
  return mem.deadAt === null ? 1 : Math.max(0, Math.min(1, (time - mem.deadAt) / STATES.chute_s));
}

export type SoldierShow = "garde" | "marche" | "course" | "coupe" | "vol" | "accroche" | "saisi" | "chute" | "mort";
export const SOLDIER_SHOWS: readonly SoldierShow[] = ["garde", "marche", "course", "coupe", "vol", "accroche", "saisi", "chute", "mort"];

export interface SoldierReading {
  mode: "sol" | "crochet" | "rail" | "vol" | "saisi" | "mort" | "fui";
  x: number;
  y: number;
  z: number;
  vz: number;
  cutCooldown: number;
  anchor: unknown;
}

/** État montré d'un soldat à équipement tridimensionnel. */
export function soldierShow(mem: ShowMemory<SoldierShow> | null, s: SoldierReading, time: number, dt: number): ShowMemory<SoldierShow> {
  const d = mem ? Math.hypot(s.x - mem.x, s.y - mem.y) : 0;
  const still = d > MOVE_EPS ? 0 : (mem?.still ?? 2) + 1;
  const speed = dt > 0 ? d / dt : (mem?.speed ?? 0);
  // Coup de lame : le délai de coupe remonte (la simulation vient de le réarmer).
  const cutAt = mem && s.cutCooldown > mem.cut + 1e-6 ? time : (mem?.cutAt ?? null);
  let st: SoldierShow;
  if (s.mode === "mort" || s.mode === "fui") st = "mort";
  else if (s.mode === "saisi") st = "saisi";
  else if (s.mode === "crochet" || s.mode === "rail") st = speed < 1 ? "accroche" : "vol";
  else if (s.mode === "vol") st = !s.anchor && s.vz <= -STATES.chute_soldat_m_s ? "chute" : "vol";
  else if (cutAt !== null && time - cutAt < STATES.coupe_s) st = "coupe";
  else if (still < 2) st = speed > 3.5 ? "course" : "marche";
  else st = "garde";
  return remember(mem, st, time, s.x, s.y, still, speed, { cutAt, cut: s.cutCooldown });
}

export type TroopShow = "attente" | "marche" | "tir" | "mort";
export const TROOP_SHOWS: readonly TroopShow[] = ["attente", "marche", "tir", "mort"];

export interface TroopReading {
  mode: "ligne" | "marche" | "mort" | "fui";
  x: number;
  y: number;
  shot: number;
  target: unknown;
}

/** État montré d'un fantassin : `tick` courant et cadence de la simulation (`hz`) pour dater le dernier tir. */
export function troopShow(t: TroopReading, tick: number, hz: number): TroopShow {
  if (t.mode === "mort" || t.mode === "fui") return "mort";
  if (t.mode === "marche") return "marche";
  if (t.shot >= 0 && (tick - t.shot) / hz < 1.5) return "tir";
  return t.target ? "tir" : "attente";
}
