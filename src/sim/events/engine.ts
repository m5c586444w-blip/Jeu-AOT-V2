import type { Choice, Condition, Effect } from "../../data/effects";
import type { EventDef } from "../../data/schemas";
import { Rng } from "../core/rng";
import type { GameDate } from "../core/time";
import { DAYS_PER_MONTH, fromAbsoluteDay, seasonOf, toAbsoluteDay } from "../core/time";
import { addEvidence, atLeast, observe, revealSecret } from "../intel/intel";
import type { IntelState } from "../intel/intel";
import type { MilitaryState } from "../military/state";
import { characterDies, DEATH_CAUSES, stressCharacter } from "../politics/characters";
import type { DeathCause } from "../politics/characters";
import type { PoliticalState } from "../politics/state";
import type { ResearchState } from "../research/research";
import { isDomestic } from "../politics/vocabulary";
import { declareWar } from "../world/diplomacy";
import { nationsWorld, warKey } from "../world/nations";
import type { NationsState } from "../world/nations";
import { inherit } from "../shifters/shifters";
import type { ShiftersState } from "../shifters/shifters";
import { pushLog } from "../strategic/economy";
import type { StrategicState } from "../strategic/economy";
import type { World } from "../strategic/world";
import { predecessorsOf } from "../strategic/world";
import type { ChronicleWorld } from "../strategic/world";

/**
 * Moteur d'événements (02 §12, 12 §0–§3) : échéancier déterministe, conditions, effets typés, choix, échéance,
 * divergence, évitement en cascade, bascule de branche, chaînes, événements génériques.
 */

export type EventStatus = "survenu" | "evite" | "passe";
export interface EventRecord {
  status: EventStatus;
  day: number;
  choice: string | null;
  /** Choix appliqué à l'échéance, sans décision du joueur. */
  auto: boolean;
  /** Divergence ajoutée par cet événement. */
  divergence: number;
}

export interface PendingEvent {
  id: string;
  day: number;
  deadline: number;
  subject: { character?: string; province?: string };
}

export interface ChronicleEntry {
  day: number;
  event: string;
  status: EventStatus | "en_attente" | "bascule";
  choice: string | null;
  auto: boolean;
  divergence: number;
  subject: { character?: string; province?: string };
}

export interface EventsState {
  history: Record<string, EventRecord>;
  scheduled: { id: string; day: number }[];
  pending: PendingEvent[];
  divergence: number;
  branch: "canon" | "divergente";
  flags: Record<string, boolean>;
  chronicle: ChronicleEntry[];
  genericLast: Record<string, number>;
  lastGeneric: number;
}

/** Couches modifiées par les effets ; le moteur travaille sur des copies. */
export interface EventCtx {
  world: World;
  seed: number;
  date: GameDate;
  st: StrategicState;
  pol: PoliticalState | null;
  mil: MilitaryState | null;
  rs: ResearchState | null;
  intel: IntelState | null;
  ev: EventsState;
  /** Titans-porteurs (P6) ; absent avant P6 ou sans données des Neuf. */
  sh?: ShiftersState | null;
  /** Monde des nations (P7). */
  na?: NationsState | null;
}

/** Plafond de la chronique : une décennie d'événements de fond (3 à 4 par mois) y tient avec les événements canon (CHR.2). */
const CHRONICLE_CAP = 800;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function createEventsState(world: World, seed: number, date: GameDate): EventsState | null {
  const cw = world.chronicle;
  if (!cw) return null;
  const s: EventsState = { history: {}, scheduled: [], pending: [], divergence: 0, branch: "canon", flags: { ...world.scenario.flags }, chronicle: [], genericLast: {}, lastGeneric: -999 };
  const today = toAbsoluteDay(date);
  // Événements antérieurs au scénario : « passés » (histoire déjà écrite).
  for (const e of cw.events.values()) {
    if (e.kind !== "canon") continue;
    // Un squelette sans mécanique commencé avant l'année du scénario est passé (854 : E46–E52, guerre du Moyen-Orient comprise).
    const past = e.playable ? (e.year_max ?? e.year_min) < date.year : e.year_min < date.year;
    if (past) s.history[e.id] = { status: "passe", day: today, choice: null, auto: false, divergence: 0 };
  }
  if (cw.mode === "canon_fidele") for (const e of cw.canon) if (ready(s, e)) schedule(s, e, seed, today);
  seedBackstory(world, s, seed, date);
  return s;
}

// ——— Événements de fond (CHR.2) ———

/**
 * Jours (0 à 29) d'un mois où un événement de fond survient : de 3 à 4 jours répartis en tranches égales, chacun tiré dans sa tranche
 * (pas de grappe, jamais deux le même jour). Déterministe : ne dépend que de la graine et du mois.
 */
export function fondDays(seed: number, month: number, perMonth: readonly [number, number]): number[] {
  const rng = new Rng(seed).fork(`fond:mois:${month}`);
  const n = rng.int(perMonth[0], perMonth[1]);
  const width = 30 / n;
  return Array.from({ length: n }, (_, k) => {
    const lo = Math.floor(width * k);
    const hi = Math.max(lo, Math.floor(width * (k + 1)) - 1);
    return rng.int(lo, hi);
  });
}

const inEra = (e: EventDef, year: number): boolean => e.year_min <= year && (e.year_max === undefined || e.year_max >= year);

/** Candidats d'un jour : époque, délai de réemploi (aucun texte ne revient dans l'année), famille différente de la précédente. */
function fondCandidates(cw: ChronicleWorld, ev: EventsState, year: number, day: number): EventDef[] {
  const cool = cw.balance.fond?.cooldown_days ?? 0;
  const lastFamily = (() => {
    for (let i = ev.chronicle.length - 1; i >= 0 && i >= ev.chronicle.length - 12; i--) {
      const e = cw.events.get(ev.chronicle[i]?.event ?? "");
      if (e?.kind === "fond") return e.family;
    }
    return undefined;
  })();
  const all = cw.fond.filter((e) => inEra(e, year) && day - (ev.genericLast[e.id] ?? -99999) >= Math.max(cool, e.cooldown_days ?? 0));
  const varied = all.filter((e) => e.family !== lastFamily);
  return varied.length > 0 ? varied : all;
}

function fondTick(ctx: EventCtx, day: number): void {
  const cw = ctx.world.chronicle;
  const b = cw?.balance.fond;
  if (!cw || !b || cw.fond.length === 0) return;
  if (!fondDays(ctx.seed, Math.floor(day / DAYS_PER_MONTH), b.per_month).includes(day % DAYS_PER_MONTH)) return;
  const rng = new Rng(ctx.seed).fork(`fond:jour:${day}`);
  const order = rng.shuffle(fondCandidates(cw, ctx.ev, ctx.date.year, day));
  for (const e of order) {
    if (!e.conditions.every((c) => conditionHolds(ctx, c))) continue;
    const subject = pickSubject(ctx, e, rng);
    if (subject === null) continue;
    fire(ctx, e, day, subject);
    return;
  }
}

/** Chronique non vide dès le début : quelques faits de fond datés du premier jour (aucun effet appliqué). */
function seedBackstory(world: World, s: EventsState, seed: number, date: GameDate): void {
  const cw = world.chronicle;
  const b = cw?.balance.fond;
  if (!cw || !b || b.backstory <= 0 || cw.fond.length === 0) return;
  const day = toAbsoluteDay(date);
  const rng = new Rng(seed).fork("fond:depart");
  const own = world.provinces.filter((p) => p.pop_level > 0 && (world.scenario.control[p.id] ?? world.scenario.default_control) === "paradis");
  const pool = rng.shuffle(cw.fond.filter((e) => inEra(e, date.year) && e.conditions.length === 0 && (e.subject === undefined || e.subject === "province")));
  let done = 0;
  for (const e of pool) {
    if (done >= b.backstory) break;
    const province = e.subject === "province" ? rng.pick(own) : undefined;
    if (e.subject === "province" && !province) continue;
    s.genericLast[e.id] = day;
    chronicle(s, { day, event: e.id, status: "survenu", choice: null, auto: false, divergence: 0, subject: province ? { province: province.id } : {} });
    done++;
  }
}

const ready = (s: EventsState, e: EventDef): boolean => !s.history[e.id] && !s.scheduled.some((x) => x.id === e.id) && predecessorsOf(e).every((p) => s.history[p]?.status === "survenu" || s.history[p]?.status === "passe");

function schedule(s: EventsState, e: EventDef, seed: number, from: number, range?: readonly [number, number]): void {
  const [lo, hi] = range ?? e.window.within_days ?? [0, 0];
  const day = from + new Rng(seed).fork(`echeance:${e.id}:${from}`).int(lo, Math.max(lo, hi));
  s.scheduled.push({ id: e.id, day });
  s.scheduled.sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));
}

// ——— Conditions ———

export function conditionHolds(ctx: Pick<EventCtx, "world" | "date" | "st" | "pol" | "ev" | "intel" | "rs">, c: Condition): boolean {
  if ("flag" in c) return (ctx.ev.flags[c.flag] ?? false) === c.eq;
  if ("alive" in c) return ctx.pol?.characters[c.alive]?.alive ?? false;
  if ("dead" in c) return !(ctx.pol?.characters[c.dead]?.alive ?? true);
  if ("control" in c) return ctx.st.provinces[c.control]?.control === c.eq;
  if ("legitimacy_below" in c) return (ctx.pol?.legitimacy ?? 50) < c.legitimacy_below;
  if ("legitimacy_above" in c) return (ctx.pol?.legitimacy ?? 50) > c.legitimacy_above;
  if ("fired" in c) return ctx.ev.history[c.fired]?.status === "survenu" || ctx.ev.history[c.fired]?.status === "passe";
  if ("not_fired" in c) return !ctx.ev.history[c.not_fired] || ctx.ev.history[c.not_fired]?.status === "evite";
  if ("choice" in c) return ctx.ev.history[c.choice]?.choice === c.is;
  if ("secret" in c) return atLeast(ctx.intel?.secrets[c.secret]?.certainty ?? "aucune", c.at_least);
  if ("tech" in c) return ctx.rs?.done.includes(c.tech) ?? false;
  if ("stock_below" in c) return (ctx.st.stocks[c.stock_below] ?? 0) < c.value;
  if ("branch" in c) return ctx.ev.branch === c.branch;
  if ("season" in c) return seasonOf(ctx.date) === c.season;
  return false;
}

export function choiceAvailable(ctx: Pick<EventCtx, "world" | "date" | "st" | "pol" | "ev" | "intel" | "rs">, c: Choice): boolean {
  return c.requires.every((r) => conditionHolds(ctx, r));
}

// ——— Effets ———

const subst = (id: string, subject: PendingEvent["subject"]): string => (id === "char_subject" ? (subject.character ?? id) : id === "prov_subject" ? (subject.province ?? id) : id);

function provinces(ctx: EventCtx, p: string): string[] {
  return p === "all" ? ctx.world.provinces.filter((x) => ctx.st.provinces[x.id]?.control === "paradis").map((x) => x.id) : [p];
}

export function applyEffect(ctx: EventCtx, f: Effect, subject: PendingEvent["subject"], source: string): void {
  const day = toAbsoluteDay(ctx.date);
  switch (f.op) {
    case "resource":
      ctx.st.stocks[f.resource] = Math.max(0, (ctx.st.stocks[f.resource] ?? 0) + f.delta);
      return;
    case "legitimacy":
      if (ctx.pol) ctx.pol.legitimacy = clamp(ctx.pol.legitimacy + f.delta, 0, 100);
      return;
    case "capital":
      if (ctx.pol) ctx.pol.capital = Math.max(0, ctx.pol.capital + f.delta);
      return;
    case "morale":
    case "stability":
      for (const id of provinces(ctx, subst(f.province, subject))) {
        const ps = ctx.st.provinces[id];
        if (ps) ps[f.op] = clamp(ps[f.op] + f.delta, 0, 100);
      }
      return;
    case "population": {
      const ps = ctx.st.provinces[subst(f.province, subject)];
      if (ps) ps.population = Math.max(0, Math.round(ps.population * (1 + f.share)));
      return;
    }
    case "control": {
      const ps = ctx.st.provinces[f.province];
      if (ps) ps.control = f.value;
      return;
    }
    case "wall": {
      const ps = ctx.st.provinces[f.province];
      if (ps && ps.wall_structure !== null) ps.wall_structure = f.value;
      return;
    }
    case "titans": {
      const p = subst(f.province, subject);
      ctx.st.titanMods = { ...(ctx.st.titanMods ?? {}), [p]: (ctx.st.titanMods?.[p] ?? 0) + f.delta };
      return;
    }
    case "garrison": {
      const ps = ctx.st.provinces[subst(f.province, subject)];
      if (ps?.garrison) ps.garrison = { ...ps.garrison, soldiers: Math.max(0, Math.round(ps.garrison.soldiers * (1 + f.share))) };
      return;
    }
    case "org_loyalty":
    case "org_influence": {
      const o = ctx.pol?.orgs[f.org];
      if (o) {
        if (f.op === "org_loyalty") o.loyalty = clamp(o.loyalty + f.delta, 0, 100);
        else o.influence = clamp(o.influence + f.delta, 0, 100);
      }
      return;
    }
    case "stratum": {
      const x = ctx.pol?.strata[f.stratum];
      if (x) {
        x.satisfaction = clamp(x.satisfaction + f.satisfaction, 0, 100);
        x.radicalisation = clamp(x.radicalisation + f.radicalisation, 0, 100);
      }
      return;
    }
    case "cult":
      if (ctx.intel) for (const id of provinces(ctx, subst(f.province, subject))) ctx.intel.cult[id] = clamp((ctx.intel.cult[id] ?? 0) + f.delta, 0, 100);
      return;
    case "kill": {
      const who = subst(f.character, subject);
      if (ctx.pol?.characters[who]?.alive) {
        const r = characterDies(ctx.world, ctx.pol, ctx.st, ctx.date, who, (DEATH_CAUSES as readonly string[]).includes(f.cause) ? (f.cause as DeathCause) : "combat", source);
        ctx.pol = r.state;
        ctx.st = r.strategic;
      }
      return;
    }
    case "stress": {
      const who = subst(f.character, subject);
      if (ctx.pol?.characters[who]?.alive) stressCharacter(ctx.world, ctx.pol, who, f.delta);
      return;
    }
    case "reveal":
      if (ctx.intel) revealSecret(ctx.world, ctx.intel, f.secret, day);
      return;
    case "flag":
      ctx.ev.flags[f.key] = f.value;
      return;
    case "schedule": {
      const e = ctx.world.chronicle?.events.get(f.event);
      if (e && !ctx.ev.history[e.id]) schedule(ctx.ev, e, ctx.seed, day, f.days);
      return;
    }
    case "divergence":
      ctx.ev.divergence += f.delta;
      return;
    case "research":
      if (ctx.rs) ctx.rs.bank += f.delta;
      return;
    case "observe":
      if (ctx.intel) observe(ctx.world, ctx.intel, ctx.st, subst(f.province, subject), day, "evenement");
      return;
    case "captured":
      if (ctx.rs) ctx.rs.captured = Math.max(0, ctx.rs.captured + f.delta);
      return;
    case "inherit": {
      if (!ctx.sh) return;
      const sctx = { world: ctx.world, seed: ctx.seed, date: ctx.date, st: ctx.st, pol: ctx.pol, intel: ctx.intel, sh: ctx.sh, flags: ctx.ev.flags };
      // Un événement apporte sa dose (E42 : le sérum de Kenny) ; il la consomme si Paradis en détient une.
      const problem = inherit(sctx, f.shifter, subst(f.heir, subject), source, [...(ctx.world.chronicle?.events.values() ?? [])].find((e) => e.text_key === source)?.canon ?? "A", false);
      ctx.st = sctx.st;
      ctx.pol = sctx.pol;
      if (problem) pushLog(ctx.st, ctx.date, "log.shifter.inherit_failed", { titan: ctx.world.shifters?.defs.get(f.shifter)?.name_key ?? f.shifter, why: problem }, false);
      return;
    }
    case "serum":
      if (ctx.sh) ctx.sh.serum = Math.max(0, ctx.sh.serum + f.delta);
      return;
    case "capture_shifter": {
      const slot = ctx.sh?.titans[f.shifter];
      if (slot) slot.captured = f.value;
      return;
    }
    case "shifter_faction": {
      const slot = ctx.sh?.titans[f.shifter];
      if (slot && slot.faction !== "perdu") slot.faction = f.faction;
      return;
    }
    case "world_war": {
      const na = ctx.na;
      if (!na || !ctx.world.nations) return;
      if (f.on) declareWar(ctx.world, na, f.a, f.b, ctx.date);
      else na.wars = na.wars.filter((x) => x !== warKey(f.a, f.b));
      return;
    }
    case "world_relation": {
      const r = ctx.na?.relations[f.from]?.[f.to];
      if (r) r[f.axis] = clamp(r[f.axis] + f.delta, f.axis === "fear" ? 0 : -100, 100);
      return;
    }
    case "world_losses": {
      const na = ctx.na;
      if (!na || !ctx.world.nations) return;
      const nw = nationsWorld(ctx.world);
      for (const [id, s] of Object.entries(na.forces[f.province] ?? {})) {
        if (nw.formations.get(id)?.faction !== f.faction) continue;
        s.count = Math.max(0, Math.round(s.count * (1 - f.share)));
      }
      na.forces[f.province] = Object.fromEntries(Object.entries(na.forces[f.province] ?? {}).filter(([, s]) => s.count > 0));
      return;
    }
    case "world_support": {
      const n = ctx.na?.nations[f.faction];
      if (n) n.warSupport = clamp(n.warSupport + f.delta, 0, 100);
      return;
    }
    case "world_hizuru":
      if (ctx.na) ctx.na.hizuruLean = clamp(ctx.na.hizuruLean + f.delta, -100, 100);
      return;
    case "nation": {
      const n = ctx.na?.nations[f.faction];
      if (!n) return;
      if (f.stat === "industry") n.industry = Math.max(0, n.industry + f.delta);
      else if (f.stat === "manpower") n.manpower = Math.max(0, n.manpower + f.delta);
      else n.stability = clamp(n.stability + f.delta, 0, 100);
      return;
    }
  }
}

function chronicle(ev: EventsState, entry: ChronicleEntry): void {
  ev.chronicle.push(entry);
  if (ev.chronicle.length > CHRONICLE_CAP) ev.chronicle.splice(0, ev.chronicle.length - CHRONICLE_CAP);
}

/** Événement canon évité : son poids de divergence, puis l'évitement de tous ses dépendants, chacun avec son poids (12 §0). */
function avoid(ctx: EventCtx, e: EventDef, day: number): void {
  const w = e.divergence_weight ?? 0;
  ctx.ev.history[e.id] = { status: "evite", day, choice: null, auto: false, divergence: w };
  ctx.ev.divergence += w;
  chronicle(ctx.ev, { day, event: e.id, status: "evite", choice: null, auto: false, divergence: w, subject: {} });
  pushLog(ctx.st, ctx.date, "log.event_avoided", { event: e.text_key }, false);
  const stack = [...(ctx.world.chronicle?.successors.get(e.id) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (ctx.ev.history[id]) continue;
    const dw = ctx.world.chronicle?.events.get(id)?.divergence_weight ?? 0;
    ctx.ev.history[id] = { status: "evite", day, choice: null, auto: false, divergence: dw };
    ctx.ev.divergence += dw;
    ctx.ev.scheduled = ctx.ev.scheduled.filter((x) => x.id !== id);
    chronicle(ctx.ev, { day, event: id, status: "evite", choice: null, auto: false, divergence: dw, subject: {} });
    stack.push(...(ctx.world.chronicle?.successors.get(id) ?? []));
  }
  checkBranch(ctx, day);
}

function fire(ctx: EventCtx, e: EventDef, day: number, subject: PendingEvent["subject"]): void {
  for (const f of e.effects) applyEffect(ctx, f, subject, e.text_key);
  const avail = e.choices.filter((c) => choiceAvailable(ctx, c));
  if (avail.length === 0) {
    settle(ctx, e, null, false, day, subject);
    return;
  }
  const deadline = day + (e.deadline_days ?? ctx.world.chronicle?.balance.deadline_days ?? 5);
  ctx.ev.pending.push({ id: e.id, day, deadline, subject });
  chronicle(ctx.ev, { day, event: e.id, status: "en_attente", choice: null, auto: false, divergence: 0, subject });
  pushLog(ctx.st, ctx.date, e.kind === "canon" ? "log.event_pending" : "log.event_generic", { event: e.text_key }, true);
}

/** Fin d'un événement : choix appliqué, divergence, successeurs programmés, bascule éventuelle. */
function settle(ctx: EventCtx, e: EventDef, choice: Choice | null, auto: boolean, day: number, subject: PendingEvent["subject"]): void {
  if (choice) for (const f of choice.effects) applyEffect(ctx, f, subject, e.text_key);
  const div = e.kind === "canon" && choice ? (e.divergence_weight ?? 0) * choice.divergence : 0;
  ctx.ev.divergence += div;
  if (e.kind === "canon") ctx.ev.history[e.id] = { status: "survenu", day, choice: choice?.id ?? null, auto, divergence: div };
  else ctx.ev.genericLast[e.id] = day;
  chronicle(ctx.ev, { day, event: e.id, status: "survenu", choice: choice?.id ?? null, auto, divergence: div, subject });
  if (e.kind === "canon") for (const id of ctx.world.chronicle?.successors.get(e.id) ?? []) {
    const next = ctx.world.chronicle?.events.get(id);
    if (next && ready(ctx.ev, next)) schedule(ctx.ev, next, ctx.seed, day);
  }
  checkBranch(ctx, day);
}

function checkBranch(ctx: EventCtx, day: number): void {
  const t = ctx.world.chronicle?.balance.divergence_threshold ?? Infinity;
  if (ctx.ev.branch === "canon" && ctx.ev.divergence >= t) {
    ctx.ev.branch = "divergente";
    chronicle(ctx.ev, { day, event: "branche", status: "bascule", choice: null, auto: false, divergence: 0, subject: {} });
    pushLog(ctx.st, ctx.date, "log.branch_divergent", { score: Math.round(ctx.ev.divergence * 100) / 100 }, true);
  }
}

/**
 * Déclenche un événement non canon à la demande (missions, MIS.1) : effets, puis décision en attente s'il y a des choix.
 * Un événement canon n'est jamais déclenché ainsi (les divergences passent par le graphe du fichier 12 §3).
 */
export function triggerEvent(ctx: EventCtx, eventId: string): boolean {
  const e = ctx.world.chronicle?.events.get(eventId);
  if (!e || e.kind === "canon") return false;
  fire(ctx, e, toAbsoluteDay(ctx.date), {});
  return true;
}

/** Choix du joueur (commande `ChooseEventOption`). Lève une erreur si le choix n'est pas offert. */
export function chooseOption(ctx: EventCtx, eventId: string, choiceId: string): void {
  const p = ctx.ev.pending.find((x) => x.id === eventId);
  const e = ctx.world.chronicle?.events.get(eventId);
  if (!p || !e) throw new Error(`Aucun événement en attente : ${eventId}`);
  const c = e.choices.find((x) => x.id === choiceId);
  if (!c || !choiceAvailable(ctx, c)) throw new Error(`Choix indisponible : ${eventId}/${choiceId}`);
  ctx.ev.pending = ctx.ev.pending.filter((x) => x !== p);
  settle(ctx, e, c, false, toAbsoluteDay(ctx.date), p.subject);
}

/** Choix appliqué à l'échéance : le choix historique pour un événement canon, sinon le premier choix offert. */
export function defaultChoice(ctx: Pick<EventCtx, "world" | "date" | "st" | "pol" | "ev" | "intel" | "rs">, e: EventDef): Choice | null {
  const avail = e.choices.filter((c) => choiceAvailable(ctx, c));
  return avail.find((c) => c.historical) ?? avail[0] ?? null;
}

/** Un jour du moteur : échéances dépassées, événements programmés, génériques. */
export function dailyEvents(ctx: EventCtx): void {
  const cw = ctx.world.chronicle;
  if (!cw) return;
  const day = toAbsoluteDay(ctx.date);
  for (const p of ctx.ev.pending.filter((x) => x.deadline <= day)) {
    const e = cw.events.get(p.id);
    ctx.ev.pending = ctx.ev.pending.filter((x) => x !== p);
    if (e) {
      settle(ctx, e, defaultChoice(ctx, e), true, day, p.subject);
      pushLog(ctx.st, ctx.date, "log.event_auto", { event: e.text_key }, false);
    }
  }
  while (ctx.ev.scheduled.length > 0 && (ctx.ev.scheduled[0]?.day ?? Infinity) <= day) {
    const next = ctx.ev.scheduled.shift() as { id: string; day: number };
    const e = cw.events.get(next.id);
    if (!e || ctx.ev.history[e.id]) continue;
    // En branche divergente, comme en canon, un événement dont le contexte a disparu est évité.
    if (e.conditions.every((c) => conditionHolds(ctx, c))) fire(ctx, e, day, {});
    else avoid(ctx, e, day);
  }
  genericTick(ctx, day);
  fondTick(ctx, day);
}

function genericTick(ctx: EventCtx, day: number): void {
  const cw = ctx.world.chronicle;
  if (!cw || cw.generic.length === 0) return;
  const g = cw.balance.generic;
  if (g.checks_per_month <= 0) return;
  const every = Math.max(1, Math.floor(30 / g.checks_per_month));
  if (day % every !== 0) return;
  if (ctx.ev.pending.filter((p) => cw.events.get(p.id)?.kind === "generic").length >= g.max_pending) return;
  if (day - ctx.ev.lastGeneric < g.min_gap_days) return;
  const rng = new Rng(ctx.seed).fork(`generique:${day}`);
  const order = cw.generic.map((e) => ({ e, k: rng.next() })).sort((a, b) => a.k - b.k);
  for (const { e } of order) {
    if (e.year_min > ctx.date.year || (e.year_max !== undefined && e.year_max < ctx.date.year)) continue;
    if (day - (ctx.ev.genericLast[e.id] ?? -99999) < (e.cooldown_days ?? 0)) continue;
    if (!e.conditions.every((c) => conditionHolds(ctx, c))) continue;
    if (rng.next() >= (e.chance ?? 0) / g.checks_per_month) continue;
    const subject = pickSubject(ctx, e, rng);
    if (subject === null) continue;
    ctx.ev.lastGeneric = day;
    ctx.ev.genericLast[e.id] = day;
    fire(ctx, e, day, subject);
    return;
  }
}

function pickSubject(ctx: EventCtx, e: EventDef, rng: Rng): PendingEvent["subject"] | null {
  if (!e.subject) return {};
  if (e.subject === "personnage") {
    const def = (id: string) => ctx.world.politics?.characters.get(id);
    const list = Object.entries(ctx.pol?.characters ?? {}).filter(([id, c]) => c.alive && id !== ctx.pol?.player && (def(id)?.active_from ?? 9999) <= ctx.date.year && isDomestic(def(id) ?? { faction: "marley" })).map(([id]) => id).sort();
    const c = list[Math.floor(rng.next() * list.length)];
    return c ? { character: c } : null;
  }
  const geo = ctx.world.military?.geo;
  const own = ctx.world.provinces.filter((p) => ctx.st.provinces[p.id]?.control === "paradis" && (ctx.st.provinces[p.id]?.population ?? 0) > 0);
  const list = e.subject === "province_frontiere" ? own.filter((p) => (geo?.adj.get(p.id) ?? []).some((n) => ctx.st.provinces[n.to]?.control !== "paradis")) : own;
  const p = list[Math.floor(rng.next() * list.length)];
  return p ? { province: p.id } : null;
}

/** Jours restants avant l'échéance d'un événement en attente (affichage). */
export function daysLeft(p: PendingEvent, date: GameDate): number {
  return Math.max(0, p.deadline - toAbsoluteDay(date));
}

/** Date d'un jour absolu (affichage de la chronique). */
export const dateOfDay = fromAbsoluteDay;

/** Preuve d'une enquête, donnée par un effet d'événement : réutilise la certitude du renseignement. */
export function evidenceFromEvent(ctx: EventCtx, secret: string, n: number): void {
  if (ctx.intel) addEvidence(ctx.world, ctx.intel, secret, n, toAbsoluteDay(ctx.date));
}
