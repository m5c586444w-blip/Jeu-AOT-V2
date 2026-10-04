import { Explainer } from "../core/explain";
import type { Explained } from "../core/explain";
import type { GameDate } from "../core/time";
import { toAbsoluteDay } from "../core/time";
import type { World } from "../strategic/world";
import { atWar, hasTreaty, nationsWorld, pushWorldLog, warKey } from "./nations";
import type { NationsState, Treaty } from "./nations";

/**
 * Diplomatie (P7 ; 02 §11 ; 09 F-DIP-01 à 07, 09) : relations à quatre axes, traités, guerre et paix, ultimatum,
 * embargo, garanties ; neutralité crédible d'Hizuru (07 H01) qui peut basculer d'un camp à l'autre.
 * Toute réponse d'une nation est une utilité expliquée.
 */

export type TreatyKind = Treaty["kind"];
export const TREATY_KINDS: readonly TreatyKind[] = ["alliance", "non_agression", "commerce", "renseignement"];
const HIZURU = "fac_hizuru";

/** Utilité, pour `to`, d'accepter la proposition `kind` de `from` (expliquée). */
export function acceptance(world: World, ns: NationsState, from: string, to: string, kind: TreatyKind | "paix"): Explained {
  const db = nationsWorld(world).balance.diplomacy;
  const r = ns.relations[to]?.[from] ?? { trust: 0, interest: 0, fear: 0, ideology: 0 };
  const e = new Explainer()
    .base("why.dip_trust", r.trust * db.weights.trust, { v: Math.round(r.trust) })
    .add("why.dip_interest", r.interest * db.weights.interest, { v: Math.round(r.interest) })
    .add("why.dip_ideology", r.ideology * db.weights.ideology, { v: Math.round(r.ideology) });
  if (kind === "paix") {
    // La peur et la lassitude poussent à la paix.
    e.add("why.dip_fear", r.fear * db.weights.fear, { v: Math.round(r.fear) });
    const n = ns.nations[to];
    if (n) e.add("why.dip_weariness", (50 - n.warSupport) * 0.5, { v: Math.round(n.warSupport) });
  } else {
    if (kind === "non_agression") e.add("why.dip_fear", r.fear * db.weights.fear, { v: Math.round(r.fear) });
    e.add(`why.dip_bias_${kind}`, db.treaty_bias[kind] ?? 0);
    if (atWar(ns, from, to)) e.add("why.dip_at_war", -100);
  }
  // Hizuru : un pays qui le garantit ou commerce avec lui est mieux reçu (07 H01).
  if (to === HIZURU) e.add("why.dip_hizuru_lean", (from === "fac_paradis" ? 1 : from === "fac_marley" ? -1 : 0) * ns.hizuruLean * 0.3, { v: Math.round(ns.hizuruLean) });
  return e.done();
}

/** Vote de la coalition alliée (F-DIP-09) : trois voix (QG, Nord, Est), seuil de majorité. */
export function coalitionVote(world: World, base: number): { yes: number; total: number; passed: boolean } {
  const db = nationsWorld(world).balance.diplomacy;
  const offsets = [-10, 0, 10];
  const yes = offsets.filter((o) => base + o >= db.accept_threshold).length;
  return { yes, total: offsets.length, passed: yes / offsets.length >= db.coalition_vote_threshold };
}

export function accepts(world: World, ns: NationsState, from: string, to: string, kind: TreatyKind | "paix"): { ok: boolean; why: Explained; vote?: { yes: number; total: number; passed: boolean } } {
  const why = acceptance(world, ns, from, to, kind);
  const th = nationsWorld(world).balance.diplomacy.accept_threshold;
  if (to === "fac_allies") {
    const vote = coalitionVote(world, why.value);
    return { ok: vote.passed, why, vote };
  }
  return { ok: why.value >= th, why };
}

function relation(ns: NationsState, a: string, b: string): { trust: number; interest: number; fear: number; ideology: number } | null {
  return ns.relations[a]?.[b] ?? null;
}

function shift(ns: NationsState, a: string, b: string, axis: "trust" | "interest" | "fear" | "ideology", d: number): void {
  const r = relation(ns, a, b);
  if (r) r[axis] = Math.max(axis === "fear" ? 0 : -100, Math.min(100, r[axis] + d));
}

/** Proposition de traité ; renvoie l'issue expliquée et applique le traité s'il est accepté. */
export function proposeTreaty(world: World, ns: NationsState, from: string, to: string, kind: TreatyKind, date: GameDate): { ok: boolean; why: Explained } {
  const day = toAbsoluteDay(date);
  const res = accepts(world, ns, from, to, kind);
  const nw = nationsWorld(world);
  if (res.ok && !hasTreaty(ns, kind, from, to)) {
    ns.treaties.push({ kind, a: from, b: to, since: day });
    shift(ns, from, to, "trust", 5);
    shift(ns, to, from, "trust", 5);
  } else if (!res.ok) shift(ns, to, from, "trust", -2);
  pushWorldLog(ns, day, res.ok ? "world.log.treaty_signed" : "world.log.treaty_refused", { from: nw.factions.get(from)?.name_key ?? from, to: nw.factions.get(to)?.name_key ?? to, kind: `world.treaty.${kind}` });
  return res;
}

export function declareWar(world: World, ns: NationsState, from: string, to: string, date: GameDate): void {
  if (atWar(ns, from, to)) return;
  const nw = nationsWorld(world);
  const day = toAbsoluteDay(date);
  ns.treaties = ns.treaties.filter((t) => !((t.a === from && t.b === to) || (t.a === to && t.b === from)));
  ns.wars = [...ns.wars, warKey(from, to)].sort();
  shift(ns, to, from, "trust", -30);
  // Sans casus belli (confiance encore positive), la guerre coûte de la stabilité (F-DIP-04).
  const r = relation(ns, from, to);
  const n = ns.nations[from];
  if (r && r.trust > 0 && n) n.stability = Math.max(0, n.stability - 10);
  // Les alliés du défenseur entrent en guerre (alliance).
  for (const t of ns.treaties.filter((x) => x.kind === "alliance" && (x.a === to || x.b === to))) {
    const ally = t.a === to ? t.b : t.a;
    if (ally !== from && !atWar(ns, ally, from)) ns.wars = [...ns.wars, warKey(ally, from)].sort();
  }
  pushWorldLog(ns, day, "world.log.war", { from: nw.factions.get(from)?.name_key ?? from, to: nw.factions.get(to)?.name_key ?? to });
}

export function makePeace(world: World, ns: NationsState, from: string, to: string, date: GameDate): { ok: boolean; why: Explained } {
  const res = accepts(world, ns, from, to, "paix");
  const nw = nationsWorld(world);
  if (res.ok) {
    ns.wars = ns.wars.filter((w) => w !== warKey(from, to));
    pushWorldLog(ns, toAbsoluteDay(date), "world.log.peace", { from: nw.factions.get(from)?.name_key ?? from, to: nw.factions.get(to)?.name_key ?? to });
  } else pushWorldLog(ns, toAbsoluteDay(date), "world.log.peace_refused", { from: nw.factions.get(from)?.name_key ?? from, to: nw.factions.get(to)?.name_key ?? to });
  return res;
}

/** Ultimatum (F-DIP-04) : céder une province ou la guerre. Accepté si la peur l'emporte. */
export function ultimatum(world: World, ns: NationsState, from: string, to: string, province: string, date: GameDate): { ok: boolean; why: Explained } {
  const db = nationsWorld(world).balance.diplomacy;
  const nw = nationsWorld(world);
  const r = relation(ns, to, from);
  const why = new Explainer().base("why.dip_fear", r?.fear ?? 0, { v: Math.round(r?.fear ?? 0) }).add("why.dip_ultimatum_needed", -db.ultimatum_fear_needed).done();
  const ok = why.value >= 0 && ns.control[province] === to;
  if (ok) {
    ns.control[province] = from;
    shift(ns, to, from, "trust", -20);
    pushWorldLog(ns, toAbsoluteDay(date), "world.log.ultimatum_yield", { from: nw.factions.get(from)?.name_key ?? from, to: nw.factions.get(to)?.name_key ?? to, province: nw.provinces.get(province)?.name_key ?? province });
  } else declareWar(world, ns, from, to, date);
  return { ok, why };
}

export function embargo(world: World, ns: NationsState, from: string, to: string, on: boolean, date: GameDate): void {
  const key = `${from}>${to}`;
  ns.embargoes = on ? [...new Set([...ns.embargoes, key])].sort() : ns.embargoes.filter((e) => e !== key);
  if (on) shift(ns, to, from, "trust", -10);
  const nw = nationsWorld(world);
  pushWorldLog(ns, toAbsoluteDay(date), on ? "world.log.embargo" : "world.log.embargo_lifted", { from: nw.factions.get(from)?.name_key ?? from, to: nw.factions.get(to)?.name_key ?? to });
}

/** Garantie à Hizuru (07 H01, 02 §11) : promesse de protection payée en industrie ; pousse sa neutralité vers le garant. */
export function guaranteeProblem(world: World, ns: NationsState, from: string): string | null {
  const n = ns.nations[from];
  if (from !== "fac_paradis" && from !== "fac_marley") return "world.err.not_playable";
  if (!n || n.industry < 50) return "world.err.cost";
  void world;
  return null;
}

export function guaranteeHizuru(world: World, ns: NationsState, from: string, date: GameDate): void {
  const db = nationsWorld(world).balance.diplomacy;
  const n = ns.nations[from];
  if (n) n.industry -= 50;
  ns.hizuruLean = Math.max(-100, Math.min(100, ns.hizuruLean + (from === "fac_paradis" ? 1 : -1) * db.hizuru.guarantee));
  shift(ns, HIZURU, from, "trust", 5);
  pushWorldLog(ns, toAbsoluteDay(date), "world.log.guarantee", { from: nationsWorld(world).factions.get(from)?.name_key ?? from });
}

/** Penchant mensuel d'Hizuru, expliqué : commerce, garanties (déjà comptées), peur de chaque camp. */
export function hizuruDrift(world: World, ns: NationsState): Explained {
  const db = nationsWorld(world).balance.diplomacy;
  const trade = (f: string): number => (hasTreaty(ns, "commerce", HIZURU, f) ? db.hizuru.trade_per_month : 0);
  const fear = (f: string): number => relation(ns, HIZURU, f)?.fear ?? 0;
  return new Explainer()
    .base("why.hizuru_trade_paradis", trade("fac_paradis"))
    .add("why.hizuru_trade_marley", -trade("fac_marley"))
    .add("why.hizuru_fear", ((fear("fac_marley") - fear("fac_paradis")) / 100) * db.hizuru.war_fear_per_month, { m: Math.round(fear("fac_marley")), p: Math.round(fear("fac_paradis")) })
    .done();
}

/** Mois de diplomatie : relations qui dérivent, neutralité d'Hizuru qui peut basculer (et revenir). */
export function monthlyDiplomacy(world: World, ns: NationsState, date: GameDate): void {
  const nw = nationsWorld(world);
  const db = nw.balance.diplomacy;
  const day = toAbsoluteDay(date);
  for (const [a, rs] of Object.entries(ns.relations)) {
    for (const [b, r] of Object.entries(rs)) {
      if (atWar(ns, a, b)) r.trust = Math.max(-100, r.trust - db.relation_drift);
      if (hasTreaty(ns, "commerce", a, b)) r.interest = Math.min(100, r.interest + db.relation_drift);
      r.fear = Math.max(0, r.fear - db.relation_drift * 0.5);
    }
  }
  ns.hizuruLean = Math.max(-100, Math.min(100, ns.hizuruLean + hizuruDrift(world, ns).value));
  const side: NationsState["hizuruSide"] = ns.hizuruLean >= db.hizuru.threshold ? "fac_paradis" : ns.hizuruLean <= -db.hizuru.threshold ? "fac_marley" : "neutre";
  if (side !== ns.hizuruSide) {
    const before = ns.hizuruSide;
    ns.hizuruSide = side;
    ns.treaties = ns.treaties.filter((t) => !(t.kind === "alliance" && (t.a === HIZURU || t.b === HIZURU)));
    if (side !== "neutre") ns.treaties.push({ kind: "alliance", a: HIZURU, b: side, since: day });
    pushWorldLog(ns, day, "world.log.hizuru_side", { before: `world.side.${before}`, after: `world.side.${side}` });
  }
}
