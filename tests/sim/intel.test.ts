import { describe, expect, it } from "vitest";
import { applyCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { toAbsoluteDay } from "../../src/sim/core/time";
import { knownTitans, localLegitimacy, observe } from "../../src/sim/intel/intel";
import type { IntelState } from "../../src/sim/intel/intel";
import { replayFactors } from "../../src/sim/core/explain";
import { standardPlan } from "../../src/sim/military/plan";
import { world } from "./expedition-helpers";

// Monde sans chronologie : les événements révéleraient les secrets au fil de 850 et fausseraient l'enquête (D-66).
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, world), s);
const intel = (s: GameState): IntelState => {
  if (!s.intel) throw new Error("renseignement absent");
  return s.intel;
};
const withAgent = (s: GameState, skill: number): GameState => {
  const i = structuredClone(intel(s));
  const a = i.agents[0];
  if (a) a.skill = skill;
  return { ...s, intel: i };
};
/** Répète une opération avec le premier agent jusqu'à ce que `done` soit vrai (ou `max` missions). */
function repeat(s: GameState, op: "surveiller" | "enqueter" | "contre", target: string, done: (x: GameState) => boolean, max = 30): GameState {
  let x = s;
  for (let k = 0; k < max && !done(x); k++) {
    const a = intel(x).agents[0];
    if (!a) break;
    if (a.status === "grille") {
      const i = structuredClone(intel(x));
      const b = i.agents[0];
      if (b) b.status = "libre";
      x = { ...x, intel: i };
    }
    x = run(x, { type: "AssignAgent", agent: a.id, op, target }, { type: "AdvanceDays", n: (world.intel?.balance.operation_days[op] ?? 10) + 9 });
  }
  return x;
}

const s0 = createInitialState(42, world);

describe("brouillard de guerre (AC5-06)", () => {
  it("les provinces tenues sont observées chaque jour ; celles de Maria n'ont aucune estimation au départ", () => {
    const s = run(s0, { type: "AdvanceDays", n: 3 });
    const today = toAbsoluteDay(s.date);
    expect(knownTitans(intel(s), "prov_karanes", today)).toMatchObject({ source: "controle", age: 1 });
    expect(knownTitans(intel(s), "prov_maria_est", today)).toBeNull();
  });
  it("une expédition rafraîchit l'observation des provinces qu'elle traverse ; les tours de guet observent la frontière", () => {
    let s = run(s0, { type: "AdvanceDays", n: 120 });
    const plan = s.military ? standardPlan(world, s.military, "prov_maria_est", "eventail", 20) : null;
    if (!plan) throw new Error("plan");
    s = run(s, { type: "LaunchExpedition", plan }, { type: "AdvanceDays", n: 12 });
    const seenByExp = Object.entries(intel(s).seen).filter(([, o]) => o.source === "expedition");
    expect(seenByExp.length).toBeGreaterThan(0);
    const towers = run({ ...s0, research: s0.research ? { ...s0.research, done: [...s0.research.done, "tech_watchtowers"] } : null }, { type: "AdvanceDays", n: 8 });
    expect(Object.values(intel(towers).seen).some((o) => o.source === "tour")).toBe(true);
  });
});

describe("agents et rapports (AC5-07)", () => {
  it("agents : couverture, loyauté, compétence, spécialité ; recrutement payé en capital, postes limités", () => {
    const a = intel(s0).agents;
    expect(a).toHaveLength(world.intel?.balance.agents.start ?? 0);
    for (const x of a) {
      expect(x.cover).toBeGreaterThan(0);
      expect(x.loyalty).toBeGreaterThan(0);
      expect(["surveiller", "enqueter", "contre"]).toContain(x.specialty);
    }
    const rich = run(s0, { type: "AdvanceDays", n: 90 });
    const cap = rich.politics?.capital ?? 0;
    const r = run(rich, { type: "RecruitAgent" });
    expect(intel(r).agents).toHaveLength(a.length + 1);
    expect(r.politics?.capital).toBe(cap - (world.intel?.balance.agents.recruit_capital ?? 0));
    expect(() => run(r, { type: "RecruitAgent" })).toThrow("intel.err.slots");
  });

  it("un rapport peut être faux ; l'observation directe le dément, et confirme un rapport juste", () => {
    let s = withAgent(s0, 30);
    s = repeat(s, "surveiller", "prov_maria_est", (x) => intel(x).reports.some((r) => r.false) && intel(x).reports.some((r) => !r.false));
    const reports = intel(s).reports;
    const bad = reports.find((r) => r.false);
    const good = reports.find((r) => !r.false);
    expect(bad, "aucun rapport faux après 30 missions").toBeDefined();
    expect(good).toBeDefined();
    expect(bad?.status).toBe("non_verifie");
    // L'estimation du brouillard vient du dernier rapport reçu : elle peut donc être fausse.
    expect(intel(s).seen["prov_maria_est"]?.source).toBe("agent");
    const i = structuredClone(intel(s));
    if (!s.strategic) throw new Error("stratégique");
    observe(world, i, s.strategic, "prov_maria_est", toAbsoluteDay(s.date), "expedition");
    expect(i.reports.find((r) => r.id === bad?.id)?.status).toBe("dementi");
    expect(i.reports.find((r) => r.id === good?.id)?.status).toBe("confirme");
  });

  it("enquête : la certitude d'un secret monte de rumeur à preuve ; contre-espionnage : une taupe est démasquée", () => {
    let s = withAgent(s0, 85);
    s = repeat(s, "enqueter", "char_annie_leonhart", (x) => intel(x).secrets["secret_annie_leonhart"]?.certainty === "preuve");
    expect(intel(s).secrets["secret_annie_leonhart"]?.certainty).toBe("preuve");
    expect(intel(s).secrets["secret_annie_leonhart"]?.revealed).toBe(false);
    let c = withAgent(s0, 85);
    c = repeat(c, "contre", "org_training_corps", (x) => intel(x).moles.some((m) => m.exposed) || intel(x).reports.some((r) => r.claim === "taupe" && !r.false), 40);
    const caught = intel(c).reports.find((r) => r.claim === "taupe" && !r.false);
    expect(caught?.named).toMatch(/char_(reiner_braun|bertholdt_hoover|annie_leonhart)/);
  });
});

describe("Culte et légitimité locale (calques, D-57)", () => {
  it("influence du Culte par anneau ; légitimité perçue expliquée (somme des facteurs = valeur)", () => {
    const i = intel(s0);
    expect(i.cult["prov_mitras"]).toBeGreaterThan(i.cult["prov_karanes"] ?? 0);
    const pol = s0.politics;
    if (!pol || !s0.strategic) throw new Error("état");
    const l = localLegitimacy(world, pol, s0.strategic, i, "prov_trost");
    expect(replayFactors(l.factors)).toBeCloseTo(l.value, 9);
  });
});
