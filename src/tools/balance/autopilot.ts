import type { Command } from "../../sim/core/commands";
import { Rng } from "../../sim/core/rng";
import type { GameState } from "../../sim/core/state";
import { toAbsoluteDay } from "../../sim/core/time";
import { planProblem, standardPlan } from "../../sim/military/plan";
import type { World } from "../../sim/strategic/world";
import type { RationingLevel } from "../../sim/strategic/resources";
import { invasionPlan, seaPath } from "../../sim/world/ai";

/**
 * Pilote automatique de `sim:balance` (P9.5) : un « joueur type » tiré de la graine, qui agit seulement par commandes, comme
 * l'interface. Quatre profils, aux réglages eux aussi tirés de la graine :
 * - passif : ne donne aucun ordre (événements, rencontres et propositions se règlent d'eux-mêmes à échéance) ;
 * - gestionnaire : rationne selon les jours de vivres restants, mène les missions économiques, la recherche, la diplomatie ;
 * - militaire : comme le gestionnaire, mais missions militaires d'abord, expéditions régulières, levées ;
 * - aléatoire : ordres tirés au hasard parmi ceux que l'interface propose (rationnement, missions, expéditions, lois…).
 * Les ordres refusés par la simulation sont comptés, jamais forcés.
 */
export const PROFILES = ["passif", "gestionnaire", "militaire", "aleatoire"] as const;
export type Profile = (typeof PROFILES)[number];

export interface Pilot {
  profile: Profile;
  rng: Rng;
  /** Jours de vivres sous lesquels on rationne davantage, au-dessus desquels on desserre. */
  lowDays: number;
  highDays: number;
  /** Probabilités par décision (tous les `step` jours). */
  pMission: number;
  pExpedition: number;
  pDiplomacy: number;
  pBuild: number;
  /** Légitimité sous laquelle le pilote cherche une loi qui la rehausse. */
  legitimacyFloor: number;
  /** Grondement : posture choisie et probabilité de lancer l'assaut quand il est prêt. */
  stance: "empecher" | "retarder" | "laisser" | null;
  pAssault: number;
  /** Dernier stock de vivres vu (pour estimer la consommation nette). */
  lastFood: number | null;
  refused: number;
  issued: number;
}

const LEVELS: readonly RationingLevel[] = ["normal", "reduit", "strict"];

export function makePilot(seed: number): Pilot {
  const rng = new Rng(seed).fork("pilote");
  const profile = PROFILES[rng.int(0, PROFILES.length - 1)] as Profile;
  const u = (lo: number, hi: number): number => lo + (hi - lo) * rng.next();
  const base = { rng, profile, lastFood: null, refused: 0, issued: 0 };
  switch (profile) {
    case "passif":
      return { ...base, lowDays: 0, highDays: 0, pMission: 0, pExpedition: 0, pDiplomacy: 0, pBuild: 0, legitimacyFloor: 0, stance: null, pAssault: 0 };
    case "gestionnaire":
      return { ...base, lowDays: u(60, 240), highDays: u(300, 600), pMission: u(0.3, 0.8), pExpedition: u(0, 0.05), pDiplomacy: u(0.2, 0.6), pBuild: u(0, 0.2), legitimacyFloor: u(45, 60), stance: rng.next() < 0.7 ? "empecher" : "retarder", pAssault: 1 };
    case "militaire":
      return { ...base, lowDays: u(30, 150), highDays: u(200, 500), pMission: u(0.3, 0.8), pExpedition: u(0.05, 0.2), pDiplomacy: u(0, 0.3), pBuild: u(0.2, 0.6), legitimacyFloor: u(35, 50), stance: "empecher", pAssault: 1 };
    case "aleatoire":
      return { ...base, lowDays: 0, highDays: 0, pMission: u(0.05, 0.4), pExpedition: u(0, 0.15), pDiplomacy: u(0, 0.3), pBuild: u(0, 0.4), legitimacyFloor: 0, stance: rng.pick(["empecher", "retarder", "laisser"] as const), pAssault: u(0.2, 0.8) };
  }
}

/** Faction jouée, forme courte (« paradis ») ou longue (« fac_paradis »). */
function playerFaction(s: GameState): string {
  return s.nations?.player ?? (s.strategic?.faction ? `fac_${s.strategic.faction}` : "fac_paradis");
}

function rationing(p: Pilot, s: GameState, step: number): Command[] {
  const st = s.strategic;
  if (!st) return [];
  const food = st.stocks.food;
  const prev = p.lastFood;
  p.lastFood = food;
  if (p.profile === "aleatoire") return p.rng.next() < 0.08 ? [{ type: "SetRationing", level: p.rng.pick(LEVELS) }] : [];
  if (p.profile === "passif" || prev === null) return [];
  const net = (food - prev) / step;
  const i = LEVELS.indexOf(st.rationing);
  const days = net < 0 ? food / -net : Infinity;
  if ((food <= 0 || days < p.lowDays) && i < LEVELS.length - 1) return [{ type: "SetRationing", level: LEVELS[i + 1] as RationingLevel }];
  if (days > p.highDays && net >= 0 && i > 0) return [{ type: "SetRationing", level: LEVELS[i - 1] as RationingLevel }];
  return [];
}

function missions(p: Pilot, w: World, s: GameState): Command[] {
  const mw = w.missions;
  if (!mw || !s.missions || p.rng.next() >= p.pMission) return [];
  const me = playerFaction(s).replace(/^fac_/, "");
  const side = s.missions.sides?.[me];
  const busy = new Set([...(side?.current ?? []).map((r) => r.id), ...(side?.done ?? [])]);
  const pool = mw.order.filter((m) => m.nation === me && !busy.has(m.id));
  const lowLegitimacy = (s.politics?.legitimacy ?? 100) < p.legitimacyFloor;
  const first = lowLegitimacy ? "politique" : p.profile === "militaire" ? "militaire" : "economique";
  const ordered = p.profile === "aleatoire" ? p.rng.shuffle(pool) : [...pool.filter((m) => m.branch === first), ...p.rng.shuffle(pool.filter((m) => m.branch !== first))];
  return ordered.slice(0, 3).map((m): Command => ({ type: "StartMission", mission: m.id }));
}

function research(p: Pilot, w: World, s: GameState): Command[] {
  const rs = s.research;
  const rw = w.research;
  if (!rs || !rw || rs.current || p.profile === "passif") return [];
  const done = new Set(rs.done);
  const pool = rw.order.filter((t) => !done.has(t.id) && (t.faction ?? "paradis") === "paradis");
  return p.rng.shuffle(pool).slice(0, 3).map((t): Command => ({ type: "SetResearch", tech: t.id }));
}

function expedition(p: Pilot, w: World, s: GameState): Command[] {
  const mil = s.military;
  const st = s.strategic;
  if (!mil || !st || p.rng.next() >= p.pExpedition || mil.expeditions.length > 0) return [];
  const targets = w.provinces.filter((d) => st.provinces[d.id]?.control === "titans").map((d) => d.id);
  for (const target of p.rng.shuffle(targets).slice(0, 3)) {
    const formation = p.profile === "aleatoire" ? p.rng.pick(["eventail", "colonnes"] as const) : "eventail";
    const plan = standardPlan(w, mil, target, formation, p.rng.int(8, 24));
    if (plan && !planProblem(w, st, s.politics, mil, s.date, plan)) return [{ type: "LaunchExpedition", plan }];
  }
  return [];
}

function events(p: Pilot, w: World, s: GameState): Command[] {
  const ev = s.events;
  const cw = w.chronicle;
  if (!ev || !cw || p.profile === "passif") return [];
  const out: Command[] = [];
  for (const pe of ev.pending) {
    const e = cw.events.get(pe.id);
    const choices = e?.choices ?? [];
    if (choices.length === 0) continue;
    const c = p.profile === "aleatoire" ? p.rng.pick(choices) : (choices.find((x) => x.historical) ?? choices[0]);
    if (c) out.push({ type: "ChooseEventOption", event: pe.id, choice: c.id });
  }
  return out;
}

function politics(p: Pilot, w: World, s: GameState): Command[] {
  const pol = s.politics;
  if (!pol || p.profile === "passif") return [];
  const out: Command[] = [];
  // Gouverner : une loi qui rehausse la légitimité quand elle fléchit (gestionnaire, militaire), une loi au hasard (aléatoire).
  const laws = [...(w.politics?.laws.values() ?? [])].filter((l) => !pol.laws.some((a) => a.id === l.id));
  const gain = (id: string): number => (w.politics?.laws.get(id)?.effects ?? []).filter((m) => m.target === "legitimacy").reduce((a, m) => a + m.value, 0);
  if (p.profile === "aleatoire") {
    if (p.rng.next() < 0.03 && laws.length) out.push({ type: "EnactLaw", law: p.rng.pick(laws).id });
  } else if (pol.legitimacy < p.legitimacyFloor) {
    const best = laws.filter((l) => gain(l.id) > 0).sort((a, b) => gain(b.id) - gain(a.id) || a.id.localeCompare(b.id))[0];
    if (best) out.push({ type: "EnactLaw", law: best.id });
  }
  for (const pr of pol.proposals) {
    const yes = p.profile === "aleatoire" ? p.rng.next() < 0.5 : p.rng.next() < 0.6;
    out.push(yes ? { type: "AcceptProposal", proposal: pr.id } : { type: "RejectProposal", proposal: pr.id });
  }
  return out;
}

/** Diplomatie et levées de la couche des nations (854, Grondement). */
function nations(p: Pilot, w: World, s: GameState): Command[] {
  const ns = s.nations;
  const nw = w.nations;
  if (!ns || !nw || p.profile === "passif") return [];
  const me = ns.player;
  const out: Command[] = [];
  if (p.rng.next() < p.pDiplomacy) {
    if (me === "fac_paradis") {
      out.push(p.rng.pick<Command>([{ type: "ProposeTreaty", to: "fac_hizuru", kind: "alliance" }, { type: "MakePeace", to: "fac_marley" }, { type: "GuaranteeHizuru" }, { type: "ProposeTreaty", to: "fac_allies", kind: "non_agression" }]));
    } else {
      out.push(p.rng.pick<Command>([{ type: "MakePeace", to: "fac_allies" }, { type: "ProposeTreaty", to: "fac_hizuru", kind: "commerce" }, { type: "DeclareWar", to: "fac_paradis" }]));
    }
  }
  if (p.rng.next() < p.pBuild) {
    const held = nw.order.filter((x) => ns.control[x.id] === me);
    const province = me === "fac_paradis" ? "wprov_paradis" : (p.rng.pick(held)?.id ?? "");
    const f = p.rng.pick([...nw.formations.values()].filter((x) => x.faction === me && x.enabled && x.domain === "terre"));
    if (f && province) out.push({ type: "BuildFormation", formation: f.id, province, count: p.rng.int(1, 2) });
  }
  // Titans de la nation jouée : projetés sur une province ennemie voisine d'un front récent.
  if (s.shifters && w.shifters) {
    const day = toAbsoluteDay(s.date);
    const front = ns.fronts.filter((f) => f.day > day - 30 && (f.attacker === me || f.defender === me)).map((f) => f.province)[0];
    if (front) for (const d of w.shifters.order) out.push({ type: "ProjectTitan", shifter: d.id, province: front });
  }
  return out;
}

function rumbling(p: Pilot, s: GameState): Command[] {
  const rb = s.rumbling;
  if (!rb || rb.stopped || p.profile === "passif") return [];
  const out: Command[] = [];
  if (p.stance && rb.stance !== p.stance) out.push({ type: "RumblingStance", stance: p.stance });
  if (p.profile === "aleatoire" && p.rng.next() < 0.05) p.stance = p.rng.pick(["empecher", "retarder", "laisser"] as const);
  if (rb.stance === "empecher" && rb.assault >= 100 && p.rng.next() < p.pAssault) out.push({ type: "RumblingAssault" });
  return out;
}

/**
 * Joueur qui mène Marley (profils militaire et aléatoire) : la même invasion que l'IA, mais par commandes — embarquer au port
 * quand les troupes dépassent la défense de l'île, une zone de mer à la fois, puis débarquer.
 */
function invasion(p: Pilot, w: World, s: GameState): Command[] {
  const ns = s.nations;
  const nw = w.nations;
  if (!ns || !nw || ns.player === "fac_paradis" || (p.profile !== "militaire" && p.profile !== "aleatoire")) return [];
  const me = ns.player;
  const holder = s.shifters?.titans["shifter_fondateur"]?.faction === "paradis" ? "fac_paradis" : null;
  if (holder && !ns.wars.includes([me, holder].sort().join("|"))) return [{ type: "DeclareWar", to: holder }];
  const plan = invasionPlan({ world: w, date: s.date, ns, sh: s.shifters, pol: s.politics, st: s.strategic }, me);
  if (!plan) return [];
  const mine = (province: string, domain: string): { id: string; count: number }[] =>
    Object.entries(ns.forces[province] ?? {}).filter(([id, x]) => x.count > 0 && nw.formations.get(id)?.faction === me && nw.formations.get(id)?.domain === domain && (domain !== "terre" || (nw.formations.get(id)?.attack ?? 0) > 0)).map(([id, x]) => ({ id, count: x.count })).sort((a, b) => a.id.localeCompare(b.id));
  const move = (from: string, to: string, domain: string, share: number): Command[] => mine(from, domain).map((x): Command => ({ type: "MoveFormation", formation: x.id, from, to, count: Math.max(1, Math.floor(x.count * share)) }));
  const afloat = nw.order.filter((x) => x.faction === "mer" && mine(x.id, "terre").length > 0);
  if (afloat.length > 0) {
    return afloat.flatMap((sea) => {
      if (nw.provinces.get(plan.target)?.adjacent.includes(sea.id)) return move(sea.id, plan.target, "terre", 1);
      const next = seaPath({ world: w, date: s.date, ns, sh: s.shifters, pol: s.politics, st: s.strategic }, sea.id, plan.target)?.[0];
      return next ? [...move(sea.id, next, "terre", 1), ...move(sea.id, next, "mer", 1)] : [];
    });
  }
  const first = plan.seas[0];
  const troops = mine(plan.port, "terre").reduce((a, x) => a + x.count * (nw.formations.get(x.id)?.attack ?? 0), 0);
  const garrison = Object.entries(ns.forces[plan.target] ?? {}).reduce((a, [id, x]) => a + x.count * (nw.formations.get(id)?.defense ?? 0), 0);
  const out: Command[] = [];
  if (p.rng.next() < p.pBuild) {
    const f = [...nw.formations.values()].filter((x) => x.faction === me && x.enabled && x.domain === "terre" && x.attack > 0).sort((a, b) => b.attack / (b.cost.industry + 1) - a.attack / (a.cost.industry + 1) || a.id.localeCompare(b.id))[0];
    // Un joueur résolu investit l'essentiel de son industrie disponible dans le corps de débarquement.
    const industry = ns.nations[me]?.industry ?? 0;
    const count = f ? Math.max(1, Math.min(10, Math.floor((industry * 0.8) / Math.max(1, f.cost.industry)))) : 0;
    if (f) out.push({ type: "BuildFormation", formation: f.id, province: plan.port, count });
    if (mine(plan.port, "mer").length === 0) {
      const t = [...nw.formations.values()].find((x) => x.faction === me && x.kind === "transports");
      if (t) out.push({ type: "BuildFormation", formation: t.id, province: plan.port, count: 1 });
    }
  }
  // Titans de Marley disponibles (projetés après le débarquement) : ils complètent l'effort, sans le porter seuls.
  const titans = Object.entries(s.shifters?.titans ?? {}).filter(([, t]) => t.faction === "marley" && t.holder !== null && s.politics?.characters[t.holder]?.alive).reduce((a, [id]) => a + (nw.balance.titans.power[id] ?? 0), 0);
  // Besoin estimé comme l'IA : défense de l'île (terrain 1,3 × fort 1,7) × seuil de prise 1,3 ; les troupes en portent la moitié.
  const need = garrison * 2.9;
  if (first && troops >= need / 2 && troops + titans >= need) out.push(...move(plan.port, first, "terre", 0.75), ...move(plan.port, first, "mer", 1));
  return out;
}

/** Ordres du pilote pour cette décision (tous les `step` jours). */
export function decide(p: Pilot, w: World, s: GameState, step: number): Command[] {
  return [...rationing(p, s, step), ...events(p, w, s), ...politics(p, w, s), ...missions(p, w, s), ...research(p, w, s), ...expedition(p, w, s), ...nations(p, w, s), ...invasion(p, w, s), ...rumbling(p, s)];
}
