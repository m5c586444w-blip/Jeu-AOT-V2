import { describe, expect, it } from "vitest";
import { replayFactors } from "../../src/sim/core/explain";
import { stateHash } from "../../src/sim/core/canonical";
import { replay } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { deserialize, serialize } from "../../src/sim/core/serialize";
import { computeVote, foodDays, legitimacyTarget, nationalMoraleOf } from "../../src/sim/politics/politics";
import { provinceProduction } from "../../src/sim/strategic/economy";
import { economyMods } from "../../src/sim/politics/politics";
import { displayedFactors } from "../../src/ui/why";
import { pol, run, start, strat, world850 } from "./politics-helpers";

const pw = world850.politics;
if (!pw) throw new Error("monde sans politique");

describe("légitimité (AC2-04, F-POL-01)", () => {
  it("cible expliquée = rejeu des facteurs ; valeur bornée 0–100 sur un an", () => {
    let s = start();
    const x = legitimacyTarget(world850, pol(s), strat(s), s.date, nationalMoraleOf(strat(s)), foodDays(strat(s), world850));
    expect(replayFactors(x.factors)).toBeCloseTo(x.value, 9);
    s = run(s, { type: "AdvanceDays", n: 360 });
    expect(pol(s).legitimacy).toBeGreaterThanOrEqual(0);
    expect(pol(s).legitimacy).toBeLessThanOrEqual(100);
  });
});

describe("chaîne d'un décret (AC2-05)", () => {
  it("couvre-feu : effet immédiat, réaction différée journalisée, puis moral en baisse et production modifiée (facteur moral en baisse)", () => {
    const base = start();
    const withLaw = run(base, { type: "EnactLaw", law: "law_couvre_feu" });
    expect(pol(withLaw).laws.map((l) => l.id)).toContain("law_couvre_feu");
    expect(strat(withLaw).log.at(-1)).toMatchObject({ key: "alert.law_enacted" });
    // 1. Immédiat : la cible de stabilité contient le décret.
    const plan0 = economyMods(world850, pol(withLaw), strat(withLaw));
    expect(plan0.byTarget["stability"]?.some((m) => m.params?.["law"] === "law.couvre_feu")).toBe(true);
    // 2. Différé : la réaction (radicalisation des bas-fonds) arrive au jour 30 et est journalisée.
    const after29 = run(withLaw, { type: "AdvanceDays", n: 29 });
    expect(strat(after29).log.some((l) => l.key === "law.couvre_feu.later0")).toBe(false);
    const after31 = run(withLaw, { type: "AdvanceDays", n: 31 });
    expect(strat(after31).log.some((l) => l.key === "law.couvre_feu.later0")).toBe(true);
    // 3. Conséquence mesurable : bas-fonds moins satisfaits et plus radicaux, moral et production de la ville souterraine en baisse.
    const control = run(base, { type: "AdvanceDays", n: 120 });
    const chained = run(withLaw, { type: "AdvanceDays", n: 120 });
    const bf = (s: typeof base) => pol(s).strata["str_basfonds"];
    expect(bf(chained)?.satisfaction).toBeLessThan(bf(control)?.satisfaction ?? 0);
    expect(bf(chained)?.radicalisation).toBeGreaterThan(bf(control)?.radicalisation ?? 0);
    const id = "prov_ville_souterraine";
    expect(strat(chained).provinces[id]?.morale).toBeLessThan(strat(control).provinces[id]?.morale ?? 0);
    const prod = (s: typeof base) => provinceProduction(world850, strat(s), s.date, id, "gold", economyMods(world850, pol(s), strat(s)));
    const moraleFactor = (s: typeof base) => prod(s).factors.find((f) => f.key === "why.morale")?.value ?? 0;
    expect(moraleFactor(chained)).toBeLessThan(moraleFactor(control));
    expect(prod(chained).value).not.toBe(prod(control).value);
    expect(replayFactors(prod(chained).factors)).toBeCloseTo(prod(chained).value, 9);
  });
  it("décrets incompatibles et coûts vérifiés", () => {
    const s = run(start(), { type: "EnactLaw", law: "law_censure_presse" });
    expect(() => run(s, { type: "EnactLaw", law: "law_liberte_presse" })).toThrow(/Incompatible/);
    expect(() => run(s, { type: "EnactLaw", law: "law_censure_presse" })).toThrow(/déjà en vigueur/);
    const repealed = run(s, { type: "RepealLaw", law: "law_censure_presse" });
    expect(pol(repealed).laws).toHaveLength(0);
  });
});

describe("fiche « pourquoi ? » d'un vote (AC2-11 révisé, D-48)", () => {
  it("pour chaque décret soumis au vote et chaque membre : facteurs affichés ≥ 1, somme = score ; sur la motion de smoke:politique, au moins un membre a ≥ 2 facteurs", () => {
    const p = pol(start());
    let laws = 0;
    for (const law of pw.laws.values()) {
      if (!law.requires_vote) continue;
      laws++;
      const v = computeVote(world850, p, law);
      const counts: number[] = [];
      for (const line of v.record.lines) {
        const why = v.reasons[line.character];
        if (!why) throw new Error(`raisons manquantes : ${line.character}`);
        const shown = displayedFactors(why);
        counts.push(shown.length);
        expect(shown.length).toBeGreaterThanOrEqual(1);
        expect(shown.every((f) => f.op !== "mul")).toBe(true);
        expect(shown.reduce((a, f) => a + f.value, 0)).toBeCloseTo(line.score, 9);
      }
      if (law.id === "law_exemptions_conscription") {
        expect(counts.length).toBe(8);
        expect(Math.max(...counts)).toBeGreaterThanOrEqual(2);
      }
    }
    expect(laws).toBe(22);
  });
});

describe("Cabinet votable (AC2-06, F-POL-03)", () => {
  it("chaque membre vote avec des raisons ; résultat déterministe", () => {
    const s = start();
    const law = pw.laws.get("law_privileges_culte");
    if (!law) throw new Error();
    const a = computeVote(world850, pol(s), law);
    const b = computeVote(world850, pol(s), law);
    expect(a.record).toEqual(b.record);
    expect(a.record.lines.length).toBeGreaterThanOrEqual(7);
    for (const line of a.record.lines) {
      const why = a.reasons[line.character];
      expect(why && replayFactors(why.factors)).toBeCloseTo(line.score, 9);
    }
  });
  it("la persuasion fait basculer un vote serré", () => {
    // Six mois de gouvernement pour accumuler du capital politique (30 au départ).
    const s = run(start(), { type: "AdvanceDays", n: 180 });
    const close = [...pw.laws.values()]
      .filter((l) => l.requires_vote)
      .map((l) => ({ l, r: computeVote(world850, pol(s), l).record }))
      .find(({ r }) => !r.passed && !r.veto && r.contre - r.pour <= 2);
    expect(close).toBeDefined();
    if (!close) return;
    let state = s;
    const targets = close.r.lines.filter((x) => x.vote !== "pour").sort((x, y) => y.score - x.score).slice(0, 3);
    for (const t of targets) state = run(state, { type: "Persuade", character: t.character });
    const after = computeVote(world850, pol(state), close.l).record;
    expect(after.pour).toBeGreaterThan(close.r.pour);
    expect(after.passed).toBe(true);
    const enacted = run(state, { type: "EnactLaw", law: close.l.id });
    expect(pol(enacted).laws.map((x) => x.id)).toContain(close.l.id);
    expect(pol(enacted).lastVote?.passed).toBe(true);
  });
  it("veto d'un conseiller influent et hostile sur son domaine (F-ADV-03), levé au prix d'un surcoût", () => {
    const s = run(start(), { type: "AdvanceDays", n: 180 });
    const tax = pw.laws.get("law_taxe_culte");
    if (!tax) throw new Error();
    const v = computeVote(world850, pol(s), tax).record;
    expect(v.veto?.role).toBe("role_religieux");
    const blocked = run(s, { type: "EnactLaw", law: "law_taxe_culte" });
    expect(pol(blocked).laws).toHaveLength(0);
    expect(strat(blocked).log.at(-1)).toMatchObject({ key: "alert.law_vetoed" });
    const forced = run(s, { type: "EnactLaw", law: "law_taxe_culte", override: true });
    expect(pol(forced).lastVote?.veto).toBeNull();
    expect(pol(forced).capital).toBe(pol(s).capital - tax.cost.capital - pw.balance.votes.veto_override_cost);
  });
});

describe("déterminisme, rejeu, sauvegarde avec la politique (AC2-10)", () => {
  const cmds: Command[] = [
    { type: "EnactLaw", law: "law_couvre_feu" },
    { type: "AdvanceDays", n: 45 },
    { type: "CharacterDies", character: "char_mike_zacharias", cause: "combat" },
    { type: "AdvanceDays", n: 100 },
  ];
  it("rejeu = état vivant ; deux exécutions = même hash", () => {
    const live = run(start(), ...cmds);
    expect(stateHash(replay(start(), cmds, world850))).toBe(stateHash(live));
    expect(stateHash(run(start(), ...cmds))).toBe(stateHash(live));
  });
  it("aller-retour de sauvegarde puis même suite", () => {
    const mid = run(start(), ...cmds);
    const back = deserialize(serialize(mid));
    expect(stateHash(back)).toBe(stateHash(mid));
    expect(stateHash(run(back, { type: "AdvanceDays", n: 30 }))).toBe(stateHash(run(mid, { type: "AdvanceDays", n: 30 })));
  });
});

describe("textes de la couche politique", () => {
  it("toutes les clés produites en un an (facteurs, journal, décès) existent en français", async () => {
    const fr = (await import("../../src/i18n/fr.json")).default as Record<string, string>;
    const { orgLoyaltyTarget } = await import("../../src/sim/politics/politics");
    const { satisfactionTarget, radicalisationTarget } = await import("../../src/sim/politics/society");
    const { activeLawMods } = await import("../../src/sim/politics/politics");
    const s = run(start(), { type: "EnactLaw", law: "law_couvre_feu" }, { type: "AdvanceDays", n: 90 }, { type: "CharacterDies", character: "char_erwin_smith", cause: "combat" }, { type: "AdvanceDays", n: 300 });
    const p = pol(s);
    const keys = new Set<string>();
    for (const l of strat(s).log) keys.add(l.key);
    for (const c of Object.values(p.characters)) for (const x of c.death?.consequences ?? []) keys.add(x.key);
    const active = activeLawMods(pw, p);
    for (const id of Object.keys(p.strata)) {
      for (const f of satisfactionTarget(pw, p, strat(s), active, id).factors) keys.add(f.key);
      for (const f of radicalisationTarget(pw, p, active, id).factors) keys.add(f.key);
    }
    for (const id of Object.keys(p.orgs)) for (const f of orgLoyaltyTarget(world850, p, id, s.date).factors) keys.add(f.key);
    for (const f of legitimacyTarget(world850, p, strat(s), s.date, nationalMoraleOf(strat(s)), foodDays(strat(s), world850)).factors) keys.add(f.key);
    for (const law of pw.laws.values()) if (law.requires_vote) for (const r of Object.values(computeVote(world850, p, law).reasons)) for (const f of r.factors) keys.add(f.key);
    expect([...keys].filter((k) => !(k in fr))).toEqual([]);
  });
});
