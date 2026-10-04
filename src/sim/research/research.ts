import type { Tech } from "../../data/schemas";
import type { TechHook } from "../../data/effects";
import { Explainer } from "../core/explain";
import type { Explained } from "../core/explain";
import { Rng } from "../core/rng";
import type { GameDate } from "../core/time";
import { toAbsoluteDay } from "../core/time";
import type { PoliticalState } from "../politics/state";
import type { World } from "../strategic/world";

/** Recherche (02 §7, 13) : points mensuels, technologie en cours, verrous, effets, accidents. État sérialisable. */
export interface ResearchState {
  current: string | null;
  /** Points accumulés sur la technologie en cours. */
  progress: number;
  /** Points en réserve (effets d'événements) versés à la prochaine technologie. */
  bank: number;
  done: string[];
  /** Titans capturés vivants disponibles pour l'étude (F-TEC-02). */
  captured: number;
  log: ResearchLogEntry[];
}

export interface ResearchLogEntry {
  date: GameDate;
  key: string;
  params: Record<string, string | number>;
}

const LOG_CAP = 40;

export function createResearchState(world: World): ResearchState | null {
  const rw = world.research;
  if (!rw) return null;
  return { current: null, progress: 0, bank: 0, done: rw.order.filter((t) => t.start && (t.faction ?? "paradis") === "paradis").map((t) => t.id), captured: 0, log: [] };
}

/** Effets cumulés des technologies acquises, pour un crochet : produit pour les « _mult », somme sinon. */
export function techHook(world: World, rs: ResearchState | null, hook: TechHook): number {
  const mult = hook.endsWith("_mult");
  let v = mult ? 1 : 0;
  if (!rs || !world.research) return v;
  for (const id of rs.done) {
    for (const e of world.research.techs.get(id)?.effects ?? []) {
      if (e.hook !== hook) continue;
      v = mult ? v * e.value : v + e.value;
    }
  }
  return v;
}

/** Technologies qui contribuent à un crochet (pour la fiche « pourquoi ? »). */
export function hookSources(world: World, rs: ResearchState | null, hook: TechHook): { tech: string; value: number }[] {
  if (!rs || !world.research) return [];
  return rs.done.flatMap((id) => (world.research?.techs.get(id)?.effects ?? []).filter((e) => e.hook === hook).map((e) => ({ tech: id, value: e.value })));
}

/** Points de recherche mensuels, expliqués (13 §12 : organisations, personnages scientifiques, écoles, captures). */
export function monthlyPoints(world: World, rs: ResearchState, pol: PoliticalState | null): Explained {
  const rw = world.research;
  const e = new Explainer();
  if (!rw) return e.done();
  const b = rw.balance;
  e.base("research.why.base", b.base_points);
  for (const [org, pts] of Object.entries(b.org_points)) if (!pol || pol.orgs[org]) e.add("research.why.org", pts, { org: world.politics?.organisations.get(org)?.name_key ?? org });
  for (const [who, pts] of Object.entries(b.character_points)) if (pol?.characters[who]?.alive) e.add("research.why.character", pts, { character: who });
  if (rs.captured > 0) e.add("research.why.captured", b.capture_points * rs.captured, { n: rs.captured });
  const add = techHook(world, rs, "research_points");
  if (add !== 0) e.add("research.why.tech_add", add);
  const mult = techHook(world, rs, "research_points_mult");
  if (mult !== 1) e.mul("research.why.tech_mult", mult);
  return e.done();
}

export type LockReason =
  | { key: "research.lock.done" }
  | { key: "research.lock.foreign"; params: { faction: string } }
  | { key: "research.lock.prereq"; params: { tech: string } }
  | { key: "research.lock.event"; params: { event: string } }
  | { key: "research.lock.character"; params: { character: string } }
  | { key: "research.lock.capture" }
  | { key: "research.lock.year"; params: { year: number } }
  | { key: "research.lock.exclusive"; params: { tech: string } };

/**
 * Verrou d'une technologie (13 §0) : null si elle peut être étudiée. Une technologie `C` tardive ne s'achète jamais
 * avant son événement ; les événements « passés » au début du scénario comptent comme survenus.
 */
export function lockOf(world: World, rs: ResearchState, t: Tech, date: GameDate, fired: (id: string) => boolean, alive: (id: string) => boolean): LockReason | null {
  if (rs.done.includes(t.id)) return { key: "research.lock.done" };
  const faction = t.faction ?? "paradis";
  if (faction !== "paradis") return { key: "research.lock.foreign", params: { faction } };
  const missing = t.prereqs.find((p) => !rs.done.includes(p));
  if (missing) return { key: "research.lock.prereq", params: { tech: missing } };
  const events = t.unlock_event === undefined ? [] : Array.isArray(t.unlock_event) ? t.unlock_event : [t.unlock_event];
  if (events.length > 0 && !events.some(fired)) return { key: "research.lock.event", params: { event: events[0] as string } };
  if (t.requires_character && !alive(t.requires_character)) return { key: "research.lock.character", params: { character: t.requires_character } };
  if (t.requires_capture && rs.captured < 1) return { key: "research.lock.capture" };
  if (t.min_year > date.year) return { key: "research.lock.year", params: { year: t.min_year } };
  const excl = (t.exclusive_with ?? []).find((x) => rs.done.includes(x));
  if (excl) return { key: "research.lock.exclusive", params: { tech: excl } };
  return null;
}

/** Fin de mois : points versés à la technologie en cours, accident possible, achèvement. Renvoie les alertes à publier. */
export function monthlyResearch(world: World, seed: number, rs: ResearchState, pol: PoliticalState | null, date: GameDate): ResearchLogEntry[] {
  const rw = world.research;
  const out: ResearchLogEntry[] = [];
  if (!rw || !rs.current) return out;
  const t = rw.techs.get(rs.current);
  if (!t || t.cost === null) {
    rs.current = null;
    return out;
  }
  const pts = monthlyPoints(world, rs, pol).value + rs.bank;
  rs.bank = 0;
  rs.progress += pts;
  const rng = new Rng(seed).fork(`recherche:${toAbsoluteDay(date)}:${t.id}`);
  if (rng.next() < (t.risk ?? rw.balance.risk_default)) {
    const lost = Math.round(rs.progress * rw.balance.accident.progress_loss);
    rs.progress -= lost;
    out.push({ date: { ...date }, key: "research.accident", params: { tech: `tech.${t.id}`, lost } });
  }
  if (rs.progress >= t.cost) {
    rs.done.push(t.id);
    rs.bank += rs.progress - t.cost;
    rs.progress = 0;
    rs.current = null;
    out.push({ date: { ...date }, key: "research.completed", params: { tech: `tech.${t.id}` } });
  }
  for (const l of out) rs.log.push(l);
  if (rs.log.length > LOG_CAP) rs.log.splice(0, rs.log.length - LOG_CAP);
  return out;
}

/** Mois restants estimés pour la technologie en cours (affichage). */
export function monthsLeft(world: World, rs: ResearchState, pol: PoliticalState | null): number | null {
  const t = rs.current ? world.research?.techs.get(rs.current) : undefined;
  if (!t || t.cost === null) return null;
  const pts = monthlyPoints(world, rs, pol).value;
  return pts <= 0 ? null : Math.max(0, Math.ceil((t.cost - rs.progress) / pts));
}

/** Effets des technologies lus par les expéditions et la logistique (P5 §2) ; neutres sans recherche. */
export interface TechMods {
  gasOdm: number;
  nightLoss: number;
  woundDeath: number;
  loss: number;
  attrition: number;
  interception: number;
  capture: boolean;
}

export const NO_TECH: TechMods = { gasOdm: 1, nightLoss: 1, woundDeath: 1, loss: 1, attrition: 1, interception: 1, capture: false };

export function techMods(world: World, rs: ResearchState | null): TechMods {
  if (!rs) return NO_TECH;
  return {
    gasOdm: techHook(world, rs, "exp_gas_odm_mult"),
    nightLoss: techHook(world, rs, "exp_night_loss_mult"),
    woundDeath: techHook(world, rs, "exp_wound_death_mult"),
    loss: techHook(world, rs, "exp_loss_mult"),
    attrition: techHook(world, rs, "log_attrition_mult"),
    interception: techHook(world, rs, "log_interception_mult"),
    capture: techHook(world, rs, "exp_capture") > 0,
  };
}
