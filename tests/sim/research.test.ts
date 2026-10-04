import { describe, expect, it } from "vitest";
import { applyCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { replayFactors } from "../../src/sim/core/explain";
import { standardPlan } from "../../src/sim/military/plan";
import { lockOf, monthlyPoints, monthlyResearch, techMods } from "../../src/sim/research/research";
import { world as worldNoEvents } from "./expedition-helpers";
import { loadWorld } from "../../src/data/worldNode";

const world = loadWorld("data", "scn_sandbox_850");
const run = (w: typeof world, s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, w), s);
const tech = (id: string) => {
  const t = world.research?.techs.get(id);
  if (!t) throw new Error(id);
  return t;
};

describe("recherche (AC5-05)", () => {
  const s0 = createInitialState(42, world);
  const rs0 = s0.research;
  if (!rs0) throw new Error("recherche absente");

  it("points mensuels expliqués : la somme des facteurs égale la valeur ; Hange compte tant qu'elle vit", () => {
    const pts = monthlyPoints(world, rs0, s0.politics);
    expect(replayFactors(pts.factors)).toBeCloseTo(pts.value, 9);
    expect(pts.factors.some((f) => f.key === "research.why.character" && f.params?.["character"] === "char_hange_zoe")).toBe(true);
    const pol = structuredClone(s0.politics);
    const h = pol?.characters["char_hange_zoe"];
    if (h) h.alive = false;
    expect(monthlyPoints(world, rs0, pol).value).toBeLessThan(pts.value);
  });

  it("chaque verrou refuse avec sa raison (13 §0)", () => {
    const fired = (): boolean => false;
    const alive = (): boolean => true;
    expect(lockOf(world, rs0, tech("tech_thunder_spear_prototype"), s0.date, fired, alive)?.key).toBe("research.lock.event");
    expect(lockOf(world, rs0, tech("tech_thunder_spear_prototype"), s0.date, () => true, (id) => id !== "char_hange_zoe")?.key).toBe("research.lock.character");
    expect(lockOf(world, rs0, tech("tech_odm_maintenance"), s0.date, fired, alive)).toBeNull();
    expect(lockOf(world, rs0, tech("tech_odm_elite_tuning"), s0.date, fired, alive)?.key).toBe("research.lock.prereq");
    expect(lockOf(world, rs0, tech("tech_titan_biology"), s0.date, () => true, alive)?.key).toBe("research.lock.prereq");
    expect(lockOf(world, { ...rs0, done: [...rs0.done, "tech_titan_capture"] }, tech("tech_titan_biology"), s0.date, () => true, alive)?.key).toBe("research.lock.capture");
    expect(lockOf(world, rs0, tech("tech_paradis_railway"), s0.date, () => true, alive)?.key).toBe("research.lock.prereq");
    expect(lockOf(world, rs0, tech("tech_airships"), s0.date, fired, alive)?.key).toBe("research.lock.foreign");
    expect(lockOf(world, { ...rs0, done: [...rs0.done, "tech_doctrine_capture"] }, tech("tech_doctrine_elimination"), s0.date, fired, alive)?.key).toBe("research.lock.exclusive");
    expect(() => run(world, s0, { type: "SetResearch", tech: "tech_thunder_spear_prototype" })).toThrow("research.lock.event");
  });

  it("une recherche avance chaque mois et s'achève ; un accident fait perdre de l'avancement", () => {
    let s = run(world, s0, { type: "SetResearch", tech: "tech_field_medicine" }, { type: "AdvanceDays", n: 30 * 8 });
    expect(s.research?.done).toContain("tech_field_medicine");
    expect(s.research?.log.some((l) => l.key === "research.done")).toBe(true);
    const rs = { ...rs0, current: "tech_odm_maintenance", progress: 50 };
    const risky = { ...world, research: world.research ? { ...world.research, balance: { ...world.research.balance, risk_default: 1 } } : null };
    const log = monthlyResearch(risky, 1, rs, s0.politics, s0.date);
    expect(log.some((l) => l.key === "research.accident")).toBe(true);
    expect(rs.progress).toBeLessThan(50 + monthlyPoints(world, rs0, s0.politics).value);
    s = run(world, s, { type: "SetResearch", tech: null });
    expect(s.research?.current).toBeNull();
  });

  it("T-ODM-08 réduit le gaz consommé par une même expédition (mécanique réelle) ; T-ANT-06 ouvre l'objectif « capture »", () => {
    const base = run(worldNoEvents, createInitialState(42, worldNoEvents), { type: "AdvanceDays", n: 120 });
    const mil = base.military;
    if (!mil || !base.research) throw new Error("état incomplet");
    const plan = standardPlan(worldNoEvents, mil, "prov_maria_est", "eventail", 20);
    if (!plan) throw new Error("plan");
    const gasOf = (done: string[]): number => {
      const s0b = { ...base, research: { ...base.research, done: [...(base.research?.done ?? []), ...done] } } as GameState;
      const s = run(worldNoEvents, s0b, { type: "LaunchExpedition", plan }, { type: "AdvanceDays", n: 25 });
      const r = s.military?.reports.at(-1);
      const e = s.military?.expeditions[0];
      const used = r?.stats.gasUsedOdm ?? e?.stats.gasUsedOdm ?? 0;
      const engaged = r?.stats.engagements ?? e?.stats.engagements ?? 1;
      return used / Math.max(1, engaged);
    };
    expect(techMods(worldNoEvents, { ...base.research, done: ["tech_compact_gas"] }).gasOdm).toBeCloseTo(0.87, 9);
    const without = gasOf([]);
    const withTech = gasOf(["tech_compact_gas"]);
    expect(withTech).toBeLessThan(without);
    expect(() => run(worldNoEvents, base, { type: "LaunchExpedition", plan: { ...plan, objective: "capture" } })).toThrow("plan.capture_locked");
    const withCapture = { ...base, research: { ...base.research, done: [...base.research.done, "tech_titan_capture"] } } as GameState;
    expect(() => run(worldNoEvents, withCapture, { type: "LaunchExpedition", plan: { ...plan, objective: "capture" } })).not.toThrow();
  });
});
