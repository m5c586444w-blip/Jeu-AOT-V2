import { describe, expect, it } from "vitest";
import { stateHash } from "../../src/sim/core/canonical";
import { replayFactors } from "../../src/sim/core/explain";
import { deserialize, serialize } from "../../src/sim/core/serialize";
import { contactRate } from "../../src/sim/military/expedition";
import { estimatePlan, planCapitalCost, planProblem, preBrief } from "../../src/sim/military/plan";
import { routeProblem, shortestRoute } from "../../src/sim/military/routes";
import { FIELD_DEATH_CAUSES } from "../../src/sim/military/vocabulary";
import { foodDays, legitimacyTarget, nationalMoraleOf } from "../../src/sim/politics/politics";
import { hasKey } from "../../src/i18n";
import { cmd, mil, plan, pol, ready, strat, untilBack, world } from "./expedition-helpers";

const run = (seed: number, p = plan(ready(seed))): ReturnType<typeof ready> => untilBack(cmd(ready(seed), { type: "LaunchExpedition", plan: p }));

describe("planification (AC3-05, F-EXP-01, F-EXP-15, F-LOG-15)", () => {
  it("un plan invalide est refusé avec sa raison", () => {
    const s = ready();
    const base = plan(s);
    const prob = (p: typeof base): string | undefined => planProblem(world, strat(s), s.politics, mil(s), s.date, p)?.key;
    expect(prob(base)).toBeUndefined();
    expect(prob({ ...base, route: ["prov_karanes", "prov_maria_est"] })).toBe("route.not_adjacent");
    expect(prob({ ...base, route: ["prov_trost", ...base.route.slice(1)] })).toBe("plan.route_start");
    // Rose-Nord-Est n'est pas une porte : on ne franchit pas le mur Rose par là (D-52).
    expect(prob({ ...base, route: ["prov_karanes", "prov_rose_nord_est", "prov_hameaux_est"] })).toMatch(/route\.(no_gate|not_adjacent)/);
    expect(prob({ ...base, squads: [] })).toBe("plan.no_squad");
    expect(prob({ ...base, wagons: 0 })).toBe("plan.no_wagons");
    const poor = { ...s, politics: { ...pol(s), capital: 0 } };
    expect(planProblem(world, strat(poor), poor.politics, mil(poor), poor.date, base)?.key).toBe("plan.no_capital");
  });

  it("règle des portes (D-52) : longer le mur ne permet pas de le franchir ; tout plus court chemin vers Maria passe une porte", () => {
    const g = world.military?.geo;
    if (!g) throw new Error();
    expect(routeProblem(g, ["prov_karanes", "prov_utgard", "prov_rose_nord_est", "prov_rose_nord", "prov_gorge_du_silence"])?.key).toBe("route.no_gate");
    for (const [id, n] of g.nodes) {
      if (n.zone !== "maria") continue;
      const r = shortestRoute(g, "prov_karanes", id);
      expect(r, id).not.toBeNull();
      expect(routeProblem(g, r ?? []), id).toBeNull();
      expect(r?.some((p) => g.gates.has(p)), `${id} : ${r?.join(" > ")}`).toBe(true);
    }
  });

  it("coût et estimations expliqués : le « pourquoi ? » rejoue le calcul ; relais proposés hors rayon", () => {
    const s = ready();
    const p = plan(s);
    const cost = planCapitalCost(world, mil(s), p);
    expect(replayFactors(cost.factors)).toBeCloseTo(cost.value, 9);
    const est = estimatePlan(world, strat(s), mil(s), s.date, p);
    for (const x of [est.days, est.contacts, est.engagements, est.deaths, est.gasOdm, est.food]) expect(replayFactors(x.factors)).toBeCloseTo(x.value, 9);
    expect(est.deathsLow).toBeLessThan(est.deaths.value);
    expect(est.deathsHigh).toBeGreaterThan(est.deaths.value);
    expect(est.outside.length).toBeGreaterThan(0);
    expect(est.relays.length).toBeGreaterThan(0);
    const brief = preBrief(world, s.politics, s.date, est);
    expect(brief.strategist).toBe("char_dot_pixis");
    expect(brief.losses).not.toBeNull();
    for (const f of [...est.deaths.factors, ...est.contacts.factors, ...cost.factors]) expect(hasKey(f.key), f.key).toBe(true);
  });
});

describe("auto-résolution (AC3-06, 03 §12)", () => {
  it("déterministe : même graine, même plan → même rapport", () => {
    expect(mil(run(5)).reports.at(-1)).toEqual(mil(run(5)).reports.at(-1));
  });

  it("chaque mort a un dossier individuel (cause, lieu, escouade, date)", () => {
    const r = mil(run(5)).reports.at(-1);
    expect(r?.dead.length).toBeGreaterThan(0);
    for (const d of r?.dead ?? []) {
      expect((FIELD_DEATH_CAUSES as readonly string[]).includes(d.cause)).toBe(true);
      expect(world.provinceById.has(d.province)).toBe(true);
      expect(d.date.year).toBe(850);
      if (!d.named) expect(d.squad).toMatch(/^esc_\d+$/);
      expect(d.name.length).toBeGreaterThan(3);
    }
  });

  it("sur 30 tirages, l'éventail longue portée perd moins que les colonnes lourdes en terrain découvert", () => {
    const mean = (formation: "eventail" | "colonnes"): number => {
      let sum = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const r = mil(run(seed, plan(ready(seed), "prov_hameaux_est", formation))).reports.at(-1);
        sum += (r?.dead.length ?? 0) / (r?.stats.departed ?? 1);
      }
      return sum / 30;
    };
    expect(mean("eventail")).toBeLessThan(mean("colonnes"));
    // Délai relevé seul (D-79) : ~15 s seul, 31–34 s quand un navigateur tourne en parallèle ; assertions inchangées.
  }, 90_000);

  it("la nuit réduit les rencontres (03 §5.2)", () => {
    const r = contactRate(world, 0.5, 100, { year: 850, day: 150 }, "clair");
    expect(r.night).toBeLessThan(r.day);
    expect(r.total).toBeCloseTo(r.day + r.night, 9);
  });

  it("chaque condition de retrait déclenche le retrait", () => {
    const reasonWith = (retreat: { losses_pct: number; gas_pct: number; abnormal: number; max_days: number }): Set<string> => {
      const out = new Set<string>();
      for (let seed = 1; seed <= 12; seed++) {
        const s = ready(seed);
        const r = mil(untilBack(cmd(s, { type: "LaunchExpedition", plan: { ...plan(s), retreat } }))).reports.at(-1);
        if (r?.retreat) out.add(r.retreat);
      }
      return out;
    };
    expect(reasonWith({ losses_pct: 1, gas_pct: 0, abnormal: 99, max_days: 99 }).has("losses_pct")).toBe(true);
    expect(reasonWith({ losses_pct: 100, gas_pct: 99, abnormal: 99, max_days: 99 }).has("gas_pct")).toBe(true);
    expect(reasonWith({ losses_pct: 100, gas_pct: 0, abnormal: 1, max_days: 99 }).has("abnormal")).toBe(true);
    expect(reasonWith({ losses_pct: 100, gas_pct: 0, abnormal: 99, max_days: 2 }).has("max_days")).toBe(true);
  });

  it("sauvegarde pendant une expédition : la suite est identique (AC3-10)", () => {
    let s = cmd(ready(9), { type: "LaunchExpedition", plan: plan(ready(9)) });
    s = cmd(s, { type: "AdvanceDays", n: 4 });
    expect(mil(s).expeditions).toHaveLength(1);
    const a = untilBack(s);
    const b = untilBack(deserialize(serialize(s)));
    expect(stateHash(a)).toBe(stateHash(b));
  });
});

describe("rapport et conséquences (AC3-08, AC3-09)", () => {
  it("rapport lisible : objectifs, pertes par cause, morts, signaux, leçons ; tous les textes existent", () => {
    const r = mil(run(5)).reports.at(-1);
    if (!r) throw new Error();
    expect(["reussie", "partielle", "echec"]).toContain(r.outcome);
    expect(Object.values(r.stats.deathsByCause).reduce((a, b) => a + (b ?? 0), 0)).toBe(r.dead.length);
    expect(r.signals.length).toBeGreaterThan(0);
    expect(r.lessons.length).toBeGreaterThan(1);
    for (const k of [...r.log.map((l) => l.key), ...r.lessons.map((l) => l.key), `outcome.${r.outcome}`]) expect(hasKey(k), k).toBe(true);
  });

  it("politique : capital au départ ; au retour, légitimité et loyauté du Corps expliquées", () => {
    const s0 = ready(5);
    const p = plan(s0);
    const cost = planCapitalCost(world, mil(s0), p).value;
    const launched = cmd(s0, { type: "LaunchExpedition", plan: p });
    expect(pol(launched).capital).toBeCloseTo(pol(s0).capital - cost, 9);
    const back = untilBack(launched);
    const ps = pol(back);
    expect(ps.mourning.some((x) => x.key === "why.expedition_outcome" && x.target === "legitimacy")).toBe(true);
    expect(ps.mourning.some((x) => x.key === "why.expedition_corps" && x.target === "org_loyalty:org_survey_corps")).toBe(true);
    const st = strat(back);
    const target = legitimacyTarget(world, ps, st, back.date, nationalMoraleOf(st), foodDays(st, world));
    expect(target.factors.some((f) => f.key === "why.expedition_outcome")).toBe(true);
    const r = mil(back).reports.at(-1);
    expect(r?.politics.capital).toBeCloseTo(cost, 9);
  });

  it("un officier nommé tombé : mort dans la couche politique, proches éprouvés", () => {
    let found = false;
    for (let seed = 1; seed <= 80 && !found; seed++) {
      const s = ready(seed);
      const p = plan(s, "prov_foret_arbres_geants", "colonnes", 10, ["char_petra"]);
      const back = untilBack(cmd(s, { type: "LaunchExpedition", plan: p }));
      const r = mil(back).reports.at(-1);
      if (r?.dead.some((d) => d.named && d.id === "char_petra")) {
        found = true;
        expect(pol(back).characters["char_petra"]?.alive).toBe(false);
        expect(pol(back).characters["char_petra"]?.death?.circumstances).toBe("death.circumstances.expedition");
        // Conséquences relationnelles (P2) : deuil des proches (stress) consigné dans le dossier de décès.
        expect(pol(back).characters["char_petra"]?.death?.consequences.some((c) => c.key === "death.csq_grief")).toBe(true);
      }
    }
    expect(found).toBe(true);
  });
});
