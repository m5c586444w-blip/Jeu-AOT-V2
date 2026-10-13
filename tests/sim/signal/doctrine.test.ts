import { describe, expect, it } from "vitest";
import { evaluateDoctrine, orderDelayS, validateDoctrine } from "../../../src/sim/signal";
import type { DoctrineContext, DoctrineRule, SignalMarker } from "../../../src/sim/signal";
import { sb } from "./helpers";

const mk = (color: SignalMarker["color"], sector: string, meaning: string): SignalMarker => ({ signalId: `s_${color}_${sector}`, color, meaning, x: 0, y: 0, sector, ageS: 5, error: null });
const rules: DoctrineRule[] = [
  { id: "r_rouge_est", priority: 5, when: { kind: "signal", color: "rouge", sector: "est" }, then: { kind: "detourner", target: "tous", headingDeltaDeg: -30 } },
  { id: "r_noire", priority: 9, when: { kind: "signal", color: "noir" }, then: { kind: "retraite", target: "aile_est" } },
  { id: "r_gaz", priority: 3, when: { kind: "depot_gaz", maxKm: 5, gasBelowPct: 40 }, then: { kind: "avancer", target: "convoi" } },
];
const ctx = (signals: SignalMarker[], gasPct = 80, depotKm: number | null = null): DoctrineContext => ({ signals, gasPct, depotKm });

describe("P4 (c) doctrine programmable", () => {
  it("scénario scripté : les règles produisent les ordres attendus", () => {
    expect(evaluateDoctrine(rules, ctx([]), sb)).toEqual([]);
    const o1 = evaluateDoctrine(rules, ctx([mk("rouge", "est", "titan_repere")]), sb);
    expect(o1).toEqual([{ kind: "detourner", target: "tous", headingDeltaDeg: -30, ruleId: "r_rouge_est", delayS: sb.doctrine.order_hop_delay_s }]);
    expect(evaluateDoctrine(rules, ctx([mk("rouge", "ouest", "titan_repere")]), sb)).toEqual([]);
    const o2 = evaluateDoctrine(rules, ctx([mk("noir", "est", "titan_anormal"), mk("rouge", "est", "titan_repere")], 30, 3), sb);
    expect(o2.map((o) => [o.ruleId, o.kind, o.target])).toEqual([["r_noire", "retraite", "aile_est"], ["r_rouge_est", "detourner", "tous"], ["r_gaz", "avancer", "convoi"]]);
  });
  it("dépôt : se déclenche seulement à moins de 5 km ET gaz < 40 %", () => {
    const g = (gas: number, km: number | null) => evaluateDoctrine(rules, ctx([], gas, km), sb).length;
    expect(g(30, 4)).toBe(1);
    expect(g(50, 4)).toBe(0);
    expect(g(30, 6)).toBe(0);
    expect(g(30, null)).toBe(0);
  });
  it("un seul ordre par cible : la règle la plus prioritaire l'emporte ; déterministe quel que soit l'ordre de la table", () => {
    const conflict: DoctrineRule[] = [
      { id: "b", priority: 1, when: { kind: "signal", color: "rouge" }, then: { kind: "tenir", target: "tous" } },
      { id: "a", priority: 1, when: { kind: "signal", color: "rouge" }, then: { kind: "avancer", target: "tous" } },
      { id: "c", priority: 2, when: { kind: "signal", color: "rouge" }, then: { kind: "couvrir", target: "tous" } },
    ];
    const c = ctx([mk("rouge", "est", "titan_repere")]);
    expect(evaluateDoctrine(conflict, c, sb).map((o) => o.ruleId)).toEqual(["c"]);
    expect(evaluateDoctrine([...conflict].reverse(), c, sb)).toEqual(evaluateDoctrine(conflict, c, sb));
    expect(evaluateDoctrine(conflict.slice(0, 2), c, sb).map((o) => o.ruleId)).toEqual(["a"]);
  });
  it("chaîne coupée : délai nul = null (retombée sur les règles de formation) ; délai croît avec la profondeur", () => {
    expect(orderDelayS(3, true, sb)).toBeGreaterThan(orderDelayS(1, true, sb) ?? 0);
    expect(orderDelayS(2, false, sb)).toBeNull();
    const o = evaluateDoctrine(rules, ctx([mk("noir", "est", "titan_anormal")]), sb, () => ({ depth: 2, connected: false }));
    expect(o[0]?.delayS).toBeNull();
  });
  it("validation : ordre inconnu, id dupliqué, plafond, bornes", () => {
    expect(validateDoctrine(rules, sb)).toEqual([]);
    const bad = [
      { ...(rules[0] as DoctrineRule), then: { kind: "bombarder" as never, target: "x" } },
      { ...(rules[1] as DoctrineRule), id: "r_rouge_est" },
      { ...(rules[2] as DoctrineRule), then: { kind: "tenir" as const, target: "x", headingDeltaDeg: 400 } },
    ];
    expect(validateDoctrine(bad, sb).length).toBe(3);
    const many = Array.from({ length: sb.doctrine.max_rules + 1 }, (_, i) => ({ ...(rules[0] as DoctrineRule), id: `r${i}` }));
    expect(validateDoctrine(many, sb).some((e) => e.includes("trop de règles"))).toBe(true);
  });
});
