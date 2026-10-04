import type { Character, Modifier } from "../../data/schemas";
import { ATTRIBUTES } from "./vocabulary";
import type { AttributeId } from "./vocabulary";
import type { GameDate } from "../core/time";
import type { PoliticsWorld, World } from "../strategic/world";

/** État d'un personnage pendant la partie (les données de départ restent dans le monde statique). */
export interface CharacterState {
  alive: boolean;
  stress: number;
  /** Traits acquis en cours de partie (épuisement, blessure psychique). */
  acquired: string[];
  /** Loyauté envers le joueur (0–100). */
  loyalty: number;
  /** Refus successifs de ses propositions (conseillers). */
  rejections: number;
  divergenceReported: boolean;
  death: DeathRecord | null;
}

export interface Consequence {
  key: string;
  params: Record<string, string | number>;
}

/** Dossier de décès (F-CHR-04) : cause, circonstances, conséquences. */
export interface DeathRecord {
  date: GameDate;
  cause: string;
  circumstances: string;
  consequences: Consequence[];
  divergence: boolean;
}

export interface OrgState {
  loyalty: number;
  influence: number;
  /** Part du budget militaire (en %), pour les organisations budgétées. */
  budget: number;
  leader: string | null;
}

export interface StratumState {
  satisfaction: number;
  radicalisation: number;
}

export interface ActiveLaw {
  id: string;
  /** Jour absolu d'entrée en vigueur. */
  since: number;
  /** Indices des effets différés déjà déclenchés. */
  triggered: number[];
}

export interface Proposal {
  id: number;
  advisor: string;
  role: string;
  law: string;
  created: number;
  expires: number;
}

export interface Nomination {
  id: number;
  post: { kind: "role" | "org"; id: string };
  candidates: string[];
  opened: number;
}

/** Deuil : pénalité temporaire qui s'estompe linéairement. */
export interface Mourning {
  target: string;
  key: string;
  params: Record<string, string | number>;
  start: number;
  value: number;
  days: number;
}

export interface VoteLine {
  character: string;
  score: number;
  vote: "pour" | "contre" | "abstention";
}

export interface VoteRecord {
  law: string;
  date: GameDate;
  lines: VoteLine[];
  pour: number;
  contre: number;
  abstention: number;
  passed: boolean;
  veto: { character: string; role: string } | null;
}

export interface PoliticalState {
  player: string;
  legitimacy: number;
  capital: number;
  characters: Record<string, CharacterState>;
  orgs: Record<string, OrgState>;
  strata: Record<string, StratumState>;
  laws: ActiveLaw[];
  roles: Record<string, string | null>;
  cabinetExtra: string[];
  persuasion: Record<string, number>;
  proposals: Proposal[];
  proposalSeq: number;
  nominations: Nomination[];
  nominationSeq: number;
  mourning: Mourning[];
  lastVote: VoteRecord | null;
}

export function politicsWorld(world: World): PoliticsWorld {
  if (!world.politics) throw new Error("Ce scénario n'a pas de couche politique.");
  return world.politics;
}

export function createPoliticalState(world: World): PoliticalState | null {
  const pw = world.politics;
  const pol = world.scenario.politics;
  if (!pw || !pol) return null;
  const characters: Record<string, CharacterState> = {};
  for (const c of pw.characters.values()) {
    const toPlayer = c.relations.find((r) => r.to === pol.player)?.strength ?? 0;
    const loyal = c.traits.includes("trait_loyal") ? 10 : 0;
    characters[c.id] = { alive: true, stress: 0, acquired: [], loyalty: clamp(50 + toPlayer / 2 + loyal), rejections: 0, divergenceReported: false, death: null };
  }
  const orgs: Record<string, OrgState> = {};
  for (const o of pw.organisations.values()) {
    orgs[o.id] = { loyalty: pw.balance.orgs.loyalty_base, influence: pol.org_influence[o.id] ?? 50, budget: pol.budget[o.id] ?? 0, leader: pol.org_leaders[o.id] ?? null };
  }
  const strata: Record<string, StratumState> = {};
  for (const s of pw.strata) strata[s.id] = { satisfaction: pw.balance.strata.base, radicalisation: 0 };
  const start = absDay(world.scenario.start);
  // Morts avant le départ du scénario (854 : morts de 850, Ymir).
  for (const id of world.scenario.deceased) {
    const cs = characters[id];
    if (cs) Object.assign(cs, { alive: false, death: { date: { ...world.scenario.start }, cause: "inconnue", circumstances: "death.before_scenario", consequences: [], divergence: false } });
  }
  return {
    player: pol.player,
    legitimacy: pol.legitimacy,
    capital: pol.political_capital,
    characters,
    orgs,
    strata,
    laws: pol.laws.map((id) => ({ id, since: start, triggered: [] })),
    roles: { ...pol.roles },
    cabinetExtra: [...pol.cabinet_extra],
    persuasion: {},
    proposals: [],
    proposalSeq: 0,
    nominations: [],
    nominationSeq: 0,
    mourning: [],
    lastVote: null,
  };
}

export function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

export function absDay(d: GameDate): number {
  return d.year * 360 + d.day - 1;
}

/** Attributs effectifs : données de départ + traits (de naissance et acquis), bornés à 0–100. */
export function effectiveAttributes(pw: PoliticsWorld, c: Character, cs: CharacterState | undefined): Record<AttributeId, number> {
  const out = {} as Record<AttributeId, number>;
  for (const a of ATTRIBUTES) out[a] = c.attributes[a] ?? 50;
  for (const t of [...c.traits, ...(cs?.acquired ?? [])]) {
    const tr = pw.traits.get(t);
    if (!tr) continue;
    for (const a of ATTRIBUTES) out[a] += tr.attributes[a] ?? 0;
  }
  for (const a of ATTRIBUTES) out[a] = clamp(out[a]);
  return out;
}

export function allTraits(c: Character, cs: CharacterState | undefined): string[] {
  return [...c.traits, ...(cs?.acquired ?? [])];
}

/** Le personnage est-il présent à cette année (fenêtre de présence, 11 §3) et vivant ? */
export function isPresent(c: Character, cs: CharacterState | undefined, year: number): boolean {
  return (cs?.alive ?? true) && c.active_from <= year;
}

/** Somme des valeurs d'un ensemble de modificateurs pour une cible. */
export function sumModifiers(list: readonly Modifier[], target: string): number {
  return list.filter((m) => m.target === target).reduce((a, m) => a + m.value, 0);
}
