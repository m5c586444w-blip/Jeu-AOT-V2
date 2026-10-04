import { CERTAINTY_LEVELS } from "../../data/effects";
import type { Certainty } from "../../data/effects";
import { Explainer } from "../core/explain";
import type { Explained } from "../core/explain";
import { Rng } from "../core/rng";
import type { GameDate } from "../core/time";
import { toAbsoluteDay } from "../core/time";
import { titanDensity } from "../military/routes";
import type { MilitaryState } from "../military/state";
import type { PoliticalState } from "../politics/state";
import { techHook } from "../research/research";
import type { ResearchState } from "../research/research";
import type { StrategicState } from "../strategic/economy";
import type { World } from "../strategic/world";

/** Renseignement (02 §6) : brouillard daté, agents, rapports bruités et parfois faux, secrets, taupes, Culte. */

export type ObservationSource = "controle" | "expedition" | "tour" | "agent" | "evenement";
export interface Observation {
  day: number;
  /** Densité de Titans estimée (0–1). */
  titans: number;
  source: ObservationSource;
  report: string | null;
}

export const INTEL_OPS = ["surveiller", "enqueter", "contre"] as const;
export type IntelOp = (typeof INTEL_OPS)[number];

export interface Agent {
  id: string;
  name: string;
  cover: number;
  loyalty: number;
  skill: number;
  specialty: IntelOp;
  status: "libre" | "mission" | "grille" | "retourne";
  mission: { op: IntelOp; target: string; start: number; end: number } | null;
  recruited: number;
}

export type ReportClaim = number | "soupcon" | "rien" | "taupe" | "aucune_taupe";
export interface IntelReport {
  id: string;
  /** Jour de réception (le rapport n'est visible qu'à partir de ce jour) et jour de l'observation. */
  day: number;
  about: number;
  agent: string;
  op: IntelOp;
  target: string;
  /** Personnage désigné (taupe présumée). */
  named: string | null;
  claim: ReportClaim;
  /** Vérité au moment de l'observation : jamais affichée tant que le rapport n'est pas recoupé. */
  truth: ReportClaim;
  false: boolean;
  certainty: Certainty;
  status: "non_verifie" | "confirme" | "dementi";
}

export interface SecretState {
  evidence: number;
  certainty: Certainty;
  revealed: boolean;
  day: number | null;
}

export interface Mole {
  character: string;
  org: string;
  exposed: boolean;
}

export interface IntelState {
  seen: Record<string, Observation>;
  agents: Agent[];
  reports: IntelReport[];
  secrets: Record<string, SecretState>;
  moles: Mole[];
  /** Influence du Culte des Murs par province (calque « Religion »), 0–100. */
  cult: Record<string, number>;
  seq: number;
}

const REPORT_CAP = 80;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const between = (rng: Rng, [a, b]: readonly [number, number]): number => Math.round(a + (b - a) * rng.next());

function agentName(world: World, rng: Rng): string {
  const n = world.military?.names;
  if (!n) return "—";
  const given = n.given_m[Math.floor(rng.next() * n.given_m.length)] ?? "";
  const family = n.family[Math.floor(rng.next() * n.family.length)] ?? "";
  return `${given} ${family}`.trim();
}

function newAgent(world: World, rng: Rng, seq: number, day: number): Agent {
  const a = world.intel?.balance.agents;
  const specialty = INTEL_OPS[seq % INTEL_OPS.length] ?? "surveiller";
  return { id: `agent_${seq}`, name: agentName(world, rng), cover: a ? between(rng, a.cover) : 60, loyalty: a ? between(rng, a.loyalty) : 70, skill: a ? between(rng, a.skill) : 50, specialty, status: "libre", mission: null, recruited: day };
}

export function createIntelState(world: World, seed: number, st: StrategicState, date: GameDate): IntelState | null {
  const iw = world.intel;
  if (!iw) return null;
  const day = toAbsoluteDay(date);
  const rng = new Rng(seed).fork("renseignement:depart");
  const s: IntelState = { seen: {}, agents: [], reports: [], secrets: {}, moles: [], cult: {}, seq: 0 };
  for (let i = 0; i < iw.balance.agents.start; i++) s.agents.push(newAgent(world, rng, ++s.seq, day));
  for (const sec of iw.secrets) s.secrets[sec.id] = { evidence: 0, certainty: "aucune", revealed: false, day: null };
  // Taupes : personnages dont l'allégeance cachée n'est pas Paradis (les infiltrés de 850).
  for (const sec of iw.secrets) {
    const c = world.politics?.characters.get(sec.character);
    const faction = c?.hidden?.["faction"];
    if (c && typeof faction === "string" && faction !== "paradis" && c.org) s.moles.push({ character: c.id, org: c.org, exposed: false });
  }
  for (const p of world.provinces) s.cult[p.id] = iw.balance.cult_by_region[p.region] ?? 0;
  observeOwn(world, s, st, day);
  return s;
}

export function certaintyOf(world: World, evidence: number): Certainty {
  const ev = world.intel?.balance.evidence;
  if (!ev) return "aucune";
  return evidence >= ev.preuve ? "preuve" : evidence >= ev.indice ? "indice" : evidence >= 1 ? "rumeur" : "aucune";
}

export const atLeast = (c: Certainty, min: Certainty): boolean => CERTAINTY_LEVELS.indexOf(c) >= CERTAINTY_LEVELS.indexOf(min);

/** Observation directe d'une province (vérité du jour) ; recoupe les rapports d'agents qui la concernent. */
export function observe(world: World, s: IntelState, st: StrategicState, province: string, day: number, source: ObservationSource): void {
  const truth = titanDensity(world, province, st);
  s.seen[province] = { day, titans: truth, source, report: null };
  // Le bruit est relatif (±20 %, 02 §6) : un rapport est confirmé s'il reste dans 1,5 fois ce bruit (au moins 0,05).
  const tol = Math.max(0.05, truth * (world.intel?.balance.estimate_noise ?? 0.2) * 1.5);
  for (const r of s.reports) {
    if (r.op !== "surveiller" || r.target !== province || r.status !== "non_verifie" || typeof r.claim !== "number") continue;
    r.status = Math.abs(r.claim - truth) <= tol ? "confirme" : "dementi";
  }
}

function observeOwn(world: World, s: IntelState, st: StrategicState, day: number): void {
  for (const p of world.provinces) if (st.provinces[p.id]?.control === "paradis") s.seen[p.id] = { day, titans: titanDensity(world, p.id, st), source: "controle", report: null };
}

/** Révélation d'un secret (événement) : preuve publique ; les rapports qui le concernaient sont confirmés ou démentis. */
export function revealSecret(world: World, s: IntelState, secret: string, day: number): void {
  const sec = s.secrets[secret];
  if (!sec) return;
  sec.revealed = true;
  sec.certainty = "preuve";
  sec.day = sec.day ?? day;
  const who = world.intel?.secrets.find((x) => x.id === secret)?.character;
  const m = s.moles.find((x) => x.character === who);
  if (m) m.exposed = true;
  for (const r of s.reports) {
    if (r.status !== "non_verifie") continue;
    if (r.op === "enqueter" && r.target === who) r.status = r.claim === "soupcon" ? "confirme" : "dementi";
    if (r.op === "contre" && r.named === who) r.status = "confirme";
  }
}

export function addEvidence(world: World, s: IntelState, secret: string, n: number, day: number): void {
  const sec = s.secrets[secret];
  if (!sec || sec.revealed) return;
  sec.evidence += n;
  const c = certaintyOf(world, sec.evidence);
  if (c !== sec.certainty) {
    sec.certainty = c;
    if (c === "preuve") sec.day = day;
  }
}

/** Secret d'un personnage, s'il en porte un. */
export function secretOf(world: World, character: string): string | null {
  return world.intel?.secrets.find((x) => x.character === character)?.id ?? null;
}

export interface IntelCtx {
  world: World;
  seed: number;
  date: GameDate;
  st: StrategicState;
  pol: PoliticalState | null;
  mil: MilitaryState | null;
  rs: ResearchState | null;
}

/** Un jour de renseignement : observations, missions terminées, rapports, recoupements. */
export function dailyIntel(ctx: IntelCtx, s: IntelState): void {
  const iw = ctx.world.intel;
  if (!iw) return;
  const day = toAbsoluteDay(ctx.date);
  observeOwn(ctx.world, s, ctx.st, day);
  // Tours de guet (T-FOR-07) : provinces voisines du territoire tenu, observées chaque semaine.
  const geo = ctx.world.military?.geo;
  if (geo && techHook(ctx.world, ctx.rs, "intel_watchtowers") > 0 && day % 7 === 0) {
    for (const p of ctx.world.provinces) {
      if (ctx.st.provinces[p.id]?.control !== "paradis") continue;
      for (const n of geo.adj.get(p.id) ?? []) if (ctx.st.provinces[n.to]?.control !== "paradis") observe(ctx.world, s, ctx.st, n.to, day, "tour");
    }
  }
  // Expéditions : la province où se trouve la colonne est observée.
  for (const e of ctx.mil?.expeditions ?? []) if (e.path[0]) observe(ctx.world, s, ctx.st, e.path[0], day, "expedition");
  for (const a of s.agents) {
    if (!a.mission || a.mission.end > day || a.status === "grille") continue;
    report(ctx, s, a, day);
    a.mission = null;
    a.status = a.status === "mission" ? "libre" : a.status;
    const rng = new Rng(ctx.seed).fork(`agent:${a.id}:${day}`);
    if (rng.next() < iw.balance.agents.burn_per_operation * (2 - a.cover / 50)) a.status = "grille";
    else if (a.loyalty < 30 && rng.next() < 0.2) a.status = "retourne";
  }
  // Rapports arrivés : une estimation d'agent devient l'observation de la province si rien de plus frais ne la contredit.
  for (const r of s.reports) {
    if (r.day !== day || r.op !== "surveiller" || typeof r.claim !== "number") continue;
    const cur = s.seen[r.target];
    if (!cur || cur.day < r.about) s.seen[r.target] = { day: r.about, titans: r.claim, source: "agent", report: r.id };
  }
  if (s.reports.length > REPORT_CAP) s.reports.splice(0, s.reports.length - REPORT_CAP);
}

/** Probabilité qu'un rapport soit faux (02 §6) : base, agent peu fiable, taupe dans l'organisation visée, agent retourné. */
export function falsehoodChance(world: World, s: IntelState, a: Agent, targetOrg: string | null): number {
  const f = world.intel?.balance.falsehood;
  if (!f) return 0;
  let p = f.base;
  if (a.skill < f.unreliable_below) p += f.unreliable;
  if (targetOrg && s.moles.some((m) => m.org === targetOrg && !m.exposed)) p += f.mole;
  if (a.status === "retourne") p = Math.max(p, 0.9);
  return clamp(p, 0, 0.95);
}

function report(ctx: IntelCtx, s: IntelState, a: Agent, end: number): void {
  const iw = ctx.world.intel;
  const m = a.mission;
  if (!iw || !m) return;
  const rng = new Rng(ctx.seed).fork(`rapport:${a.id}:${end}`);
  const delay = between(rng, iw.balance.report_delay_days);
  const certainty: Certainty = a.skill >= 70 ? "indice" : "rumeur";
  const base = { id: `rap_${++s.seq}`, day: end + delay, about: end, agent: a.id, op: m.op, target: m.target, named: null as string | null, certainty, status: "non_verifie" as const };
  if (m.op === "surveiller") {
    const truth = titanDensity(ctx.world, m.target, ctx.st);
    const isFalse = rng.next() < falsehoodChance(ctx.world, s, a, null);
    const noise = iw.balance.estimate_noise * techHook(ctx.world, ctx.rs, "intel_noise_mult");
    const claim = isFalse ? (truth > 0.3 ? truth * 0.2 : Math.min(1, truth + 0.5)) : clamp(truth * (1 + (rng.next() * 2 - 1) * noise), 0, 1);
    s.reports.push({ ...base, claim: Math.round(claim * 100) / 100, truth, false: isFalse });
    return;
  }
  if (m.op === "enqueter") {
    const secret = secretOf(ctx.world, m.target);
    const hidden = secret !== null && !s.secrets[secret]?.revealed;
    const org = ctx.world.politics?.characters.get(m.target)?.org ?? null;
    const found = hidden && rng.next() < a.skill / 100;
    const isFalse = rng.next() < falsehoodChance(ctx.world, s, a, org);
    const honest: ReportClaim = found ? "soupcon" : "rien";
    const claim: ReportClaim = isFalse ? (honest === "soupcon" ? "rien" : "soupcon") : honest;
    s.reports.push({ ...base, claim, truth: hidden ? "soupcon" : "rien", false: claim !== (hidden ? "soupcon" : "rien") || isFalse });
    if (secret && !isFalse && found) addEvidence(ctx.world, s, secret, a.skill >= 70 ? 2 : 1, end);
    return;
  }
  // Contre-espionnage dans une organisation : chance de démasquer une taupe (T-INT-02 l'augmente).
  const moles = s.moles.filter((x) => x.org === m.target && !x.exposed);
  const chance = iw.balance.mole_detection + techHook(ctx.world, ctx.rs, "intel_counter");
  const isFalse = rng.next() < falsehoodChance(ctx.world, s, a, m.target);
  const caught = moles.length > 0 && rng.next() < chance ? moles[Math.floor(rng.next() * moles.length)] : undefined;
  if (caught && !isFalse) {
    const secret = secretOf(ctx.world, caught.character);
    if (secret) addEvidence(ctx.world, s, secret, 2, end);
    s.reports.push({ ...base, named: caught.character, claim: "taupe", truth: "taupe", false: false });
    return;
  }
  if (isFalse) {
    // Fausse piste : un innocent de l'organisation est désigné, ou une taupe présente est niée.
    const members = [...(ctx.world.politics?.characters.values() ?? [])].filter((c) => c.org === m.target && !s.moles.some((x) => x.character === c.id) && ctx.pol?.characters[c.id]?.alive);
    const innocent = members.length > 0 ? members[Math.floor(rng.next() * members.length)] : undefined;
    if (innocent) s.reports.push({ ...base, named: innocent.id, claim: "taupe", truth: "aucune_taupe", false: true });
    else s.reports.push({ ...base, claim: "aucune_taupe", truth: moles.length > 0 ? "taupe" : "aucune_taupe", false: moles.length > 0 });
    return;
  }
  s.reports.push({ ...base, claim: "aucune_taupe", truth: moles.length > 0 ? "taupe" : "aucune_taupe", false: moles.length > 0 });
}

export function agentSlots(world: World, rs: ResearchState | null): number {
  return (world.intel?.balance.agents.max ?? 0) + techHook(world, rs, "intel_agent_slots");
}

export function recruitProblem(world: World, s: IntelState, pol: PoliticalState | null, rs: ResearchState | null): string | null {
  const iw = world.intel;
  if (!iw) return "intel.err.closed";
  if (s.agents.filter((a) => a.status !== "grille").length >= agentSlots(world, rs)) return "intel.err.slots";
  if (!pol || pol.capital < iw.balance.agents.recruit_capital) return "intel.err.capital";
  return null;
}

export function recruitAgent(world: World, seed: number, s: IntelState, pol: PoliticalState, day: number): Agent {
  const rng = new Rng(seed).fork(`recrue:${s.seq + 1}:${day}`);
  const a = newAgent(world, rng, ++s.seq, day);
  pol.capital -= world.intel?.balance.agents.recruit_capital ?? 0;
  s.agents.push(a);
  return a;
}

export function assignProblem(world: World, s: IntelState, agentId: string, op: IntelOp, target: string): string | null {
  const a = s.agents.find((x) => x.id === agentId);
  if (!a) return "intel.err.agent";
  if (a.status !== "libre" && a.status !== "retourne") return "intel.err.busy";
  if (op === "surveiller" && !world.provinceById.has(target)) return "intel.err.target";
  if (op === "enqueter" && !world.politics?.characters.has(target)) return "intel.err.target";
  if (op === "contre" && !world.politics?.organisations.has(target)) return "intel.err.target";
  return null;
}

export function assignAgent(world: World, s: IntelState, agentId: string, op: IntelOp, target: string, day: number): void {
  const a = s.agents.find((x) => x.id === agentId);
  const days = world.intel?.balance.operation_days[op] ?? 10;
  if (!a) return;
  a.mission = { op, target, start: day, end: day + days };
  // Un agent retourné reste « retourné » : il continue de servir, et de tromper.
  if (a.status === "libre") a.status = "mission";
}

export function recallAgent(s: IntelState, agentId: string): void {
  const a = s.agents.find((x) => x.id === agentId);
  if (!a) return;
  a.mission = null;
  if (a.status === "mission") a.status = "libre";
}

/** Dérive mensuelle de l'influence du Culte vers sa base d'anneau, plus les doctrines (13 §10). */
export function monthlyCult(world: World, s: IntelState, rs: ResearchState | null): void {
  const iw = world.intel;
  if (!iw) return;
  const doctrine = techHook(world, rs, "cult_month");
  for (const p of world.provinces) {
    const base = iw.balance.cult_by_region[p.region] ?? 0;
    const cur = s.cult[p.id] ?? base;
    s.cult[p.id] = clamp(cur + (base - cur) * iw.balance.cult_drift + (base > 0 ? doctrine : 0), 0, 100);
  }
}

/** Légitimité perçue dans une province (calque « Légitimité ») : légitimité nationale, moral, stabilité, Culte. */
export function localLegitimacy(world: World, pol: PoliticalState, st: StrategicState, s: IntelState | null, province: string): Explained {
  const e = new Explainer();
  const k = world.intel?.balance.legitimacy_local;
  const ps = st.provinces[province];
  e.base("intel.legit.national", pol.legitimacy);
  if (k && ps) {
    e.add("intel.legit.morale", k.morale_k * (ps.morale - 50));
    e.add("intel.legit.stability", k.stability_k * (ps.stability - 50));
    if (s) e.add("intel.legit.cult", k.cult_k * ((s.cult[province] ?? 0) - 50));
  }
  const raw = e.done().value;
  if (raw > 100 || raw < 0) e.add("intel.legit.bounds", clamp(raw, 0, 100) - raw);
  return e.done();
}

/** Estimation connue de la présence de Titans dans une province (calque, planificateur) : valeur, âge, source. */
export function knownTitans(s: IntelState | null, province: string, today: number): { value: number; age: number; source: ObservationSource } | null {
  const o = s?.seen[province];
  if (!o) return null;
  return { value: o.titans, age: Math.max(0, today - o.day), source: o.source };
}
