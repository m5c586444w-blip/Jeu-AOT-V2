import { DAYS_PER_MONTH } from "../core/time";
import type { GameDate } from "../core/time";
import { pushLog } from "../strategic/economy";
import type { StrategicState } from "../strategic/economy";
import type { World } from "../strategic/world";
import { expireProposals, generateProposals } from "./advisors";
import { tickCharacters } from "./characters";
import { activeLawMods, foodDays, legitimacyTarget, nationalMoraleOf, orgInfluenceTarget, orgLoyaltyTarget } from "./politics";
import { radicalisationTarget, satisfactionTarget } from "./society";
import { absDay, clamp, politicsWorld } from "./state";
import type { PoliticalState } from "./state";

const approach = (v: number, target: number, rate: number): number => clamp(v + (target - v) * rate);

/**
 * Tick politique quotidien (après l'économie du jour) : effets différés des décrets (chaînes), strates,
 * légitimité, organisations, personnages, propositions. Modifie `pol` et `st` (déjà copiés par l'appelant).
 */
export function dailyPolitics(world: World, pol: PoliticalState, st: StrategicState, date: GameDate): void {
  const pw = politicsWorld(world);
  const today = absDay(date);
  // Chaînes : un décret déclenche plus tard une réaction (journalisée) qui modifie à son tour la société.
  for (const a of pol.laws) {
    const law = pw.laws.get(a.id);
    if (!law) continue;
    law.delayed.forEach((d, i) => {
      if (!a.triggered.includes(i) && today >= a.since + d.after_days) {
        a.triggered.push(i);
        pushLog(st, date, d.log_key, { law: law.name_key }, false);
      }
    });
  }
  const active = activeLawMods(pw, pol);
  const sb = pw.balance.strata;
  for (const s of pw.strata) {
    const cur = pol.strata[s.id];
    if (!cur) continue;
    cur.satisfaction = approach(cur.satisfaction, satisfactionTarget(pw, pol, st, active, s.id).value, sb.approach_per_day);
    cur.radicalisation = approach(cur.radicalisation, radicalisationTarget(pw, pol, active, s.id).value, sb.radicalisation_approach_per_day);
  }
  pol.legitimacy = approach(pol.legitimacy, legitimacyTarget(world, pol, st, date, nationalMoraleOf(st), foodDays(st, world)).value, pw.balance.legitimacy.approach_per_day);
  for (const id of Object.keys(pol.orgs)) {
    const org = pol.orgs[id];
    if (!org) continue;
    org.loyalty = approach(org.loyalty, orgLoyaltyTarget(world, pol, id, date).value, pw.balance.orgs.approach_per_day);
    org.influence = approach(org.influence, orgInfluenceTarget(world, pol, id).value, pw.balance.orgs.influence_approach_per_day);
  }
  tickCharacters(world, pol, st, date);
  expireProposals(world, pol, date);
  pol.mourning = pol.mourning.filter((m) => today - m.start < m.days);
}

/** Tick politique mensuel : capital politique (F-POL-20), propositions des conseillers. */
export function monthlyPolitics(world: World, pol: PoliticalState, st: StrategicState, date: GameDate): void {
  const pw = politicsWorld(world);
  const cb = pw.balance.capital;
  const fromLaws = activeLawMods(pw, pol).reduce((a, l) => a + l.mods.filter((m) => m.target === "capital_monthly").reduce((x, m) => x + m.value, 0), 0);
  pol.capital = Math.min(cb.cap, pol.capital + capitalGain(pol.legitimacy, cb) + fromLaws);
  generateProposals(world, pol, st, date);
}

export function capitalGain(legitimacy: number, cb: { monthly_base: number; per_legitimacy: number }): number {
  return cb.monthly_base + legitimacy * cb.per_legitimacy;
}

export function isMonthStart(date: GameDate): boolean {
  return date.day % DAYS_PER_MONTH === 1;
}
