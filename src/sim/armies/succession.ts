import { toAbsoluteDay } from "../core/time";
import { effectiveAttributes, isPresent } from "../politics/state";
import { postsOf } from "../politics/characters";
import { pushLog } from "../strategic/economy";
import type { ArmyCtx } from "./armies";
import { playerOf, pushArmyLog } from "./state";
import type { Claimant } from "./state";

/**
 * Succession (PA.10, 24 §2.1) : la mort du chef (personnage joué) ouvre une crise — prétendants classés par la force de leur
 * prétention, légitimité et stabilité touchées, rancœur des écartés ; la mort d'un général laisse son armée sous un
 * commandement intérimaire jusqu'à une nouvelle nomination (`ArmySetGeneral`).
 */

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Prétendants : personnages de Paradis vivants, présents, hors recrues, classés (notoriété, commandement, charisme, postes, loyauté). */
export function claimantsOf(ctx: ArmyCtx): Claimant[] {
  const pol = ctx.pol;
  const pw = ctx.world.politics;
  if (!pol || !pw) return [];
  const scored: Claimant[] = [];
  for (const c of [...pw.characters.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const cs = pol.characters[c.id];
    if (!cs?.alive || c.faction !== "paradis" || c.rank_key === "rank.cadet" || c.id === pol.player || !isPresent(c, cs, ctx.date.year)) continue;
    const at = effectiveAttributes(pw, c, cs);
    const posts = postsOf(pol, c.id);
    const reasons = [
      { key: "succession.reason_fame", value: Math.round(c.fame * 0.5) },
      { key: "succession.reason_command", value: Math.round(at.command * 0.2) },
      { key: "succession.reason_charisma", value: Math.round(at.charisma * 0.2) },
      { key: "succession.reason_posts", value: posts.some((p) => p.kind === "org") ? 10 : posts.length > 0 ? 5 : 0 },
      { key: "succession.reason_loyalty", value: Math.round(cs.loyalty * 0.1) },
    ];
    scored.push({ id: c.id, claim: reasons.reduce((n, r) => n + r.value, 0), reasons });
  }
  scored.sort((a, b) => b.claim - a.claim || a.id.localeCompare(b.id));
  const top = scored.slice(0, ctx.aw.balance.succession.claimants);
  const max = Math.max(1, ...top.map((x) => x.claim));
  return top.map((x) => ({ ...x, claim: Math.round((100 * x.claim) / max) }));
}

/** Chaque jour : généraux tombés (événements, ordres, combats), mort du chef, fin de crise sans choix. */
export function dailySuccession(ctx: ArmyCtx): void {
  const b = ctx.aw.balance;
  const pol = ctx.pol;
  const player = playerOf(ctx.ns);
  for (const a of ctx.s.armies) {
    const who = a.general;
    if (!who || pol?.characters[who]?.alive !== false) continue;
    a.general = null;
    a.interim = true;
    a.general_key = "army.general.interim";
    a.morale = clamp(a.morale - b.morale.general_lost, 0, 100);
    pushArmyLog(ctx.s, ctx.date, "army.log.general_fell", { army: a.name_key, general: who });
    pushLog(ctx.st, ctx.date, "alert.general_lost", { army: a.name_key, name: who }, a.faction === player);
  }
  if (!pol || !ctx.world.politics) return;
  const day = toAbsoluteDay(ctx.date);
  if (!ctx.s.succession && pol.characters[pol.player]?.alive === false) {
    const claimants = claimantsOf(ctx);
    if (claimants.length === 0) return;
    ctx.s.succession = { deceased: pol.player, since: day, deadline: day + b.succession.crisis_days, claimants };
    pol.legitimacy = clamp(pol.legitimacy - b.succession.legitimacy_hit, 0, 100);
    for (const ps of Object.values(ctx.st.provinces)) ps.stability = clamp(ps.stability - b.succession.stability_hit, 0, 100);
    pushLog(ctx.st, ctx.date, "alert.succession_crisis", { name: pol.player, n: claimants.length }, true);
    return;
  }
  const crisis = ctx.s.succession;
  if (crisis && day >= crisis.deadline && crisis.claimants[0]) {
    pushLog(ctx.st, ctx.date, "alert.succession_forced", { name: crisis.claimants[0].id }, true);
    chooseSuccessor(ctx, crisis.claimants[0].id);
  }
}

/** Raison pour laquelle un successeur est refusé, ou null. */
export function successorProblem(ctx: ArmyCtx, candidate: string): string | null {
  const c = ctx.s.succession;
  if (!c) return "succession.err.none";
  if (!c.claimants.some((x) => x.id === candidate) || ctx.pol?.characters[candidate]?.alive !== true) return "succession.err.not_claimant";
  return null;
}

/** Le successeur prend la tête : légitimité selon sa prétention, rancœur des prétendants écartés, fin de la crise. */
export function chooseSuccessor(ctx: ArmyCtx, candidate: string): void {
  const crisis = ctx.s.succession;
  const pol = ctx.pol;
  if (!crisis || !pol) return;
  const b = ctx.aw.balance.succession;
  const chosen = crisis.claimants.find((x) => x.id === candidate);
  const mean = crisis.claimants.reduce((n, x) => n + x.claim, 0) / Math.max(1, crisis.claimants.length);
  pol.player = candidate;
  pol.legitimacy = clamp(pol.legitimacy + ((chosen?.claim ?? mean) - mean) / 5, 0, 100);
  for (const x of crisis.claimants) {
    if (x.id === candidate) continue;
    const cs = pol.characters[x.id];
    if (cs) cs.loyalty = clamp(cs.loyalty + b.loyalty_rival, 0, 100);
  }
  // Le nouveau chef quitte ses postes : ils s'ouvrent aux nominations (cabinet sans le joueur).
  for (const [role, who] of Object.entries(pol.roles)) if (who === candidate) pol.roles[role] = null;
  ctx.s.succession = null;
  pushLog(ctx.st, ctx.date, "alert.succession_resolved", { name: candidate }, false);
  pushArmyLog(ctx.s, ctx.date, "army.log.succession", { name: candidate });
}
