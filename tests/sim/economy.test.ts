import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { stateHash } from "../../src/sim/core/canonical";
import { applyCommand, replay, validateCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { deserialize, serialize } from "../../src/sim/core/serialize";
import { createInitialState, tickDay } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { applyDay, planDay, provinceProduction } from "../../src/sim/strategic/economy";
import { RESOURCE_IDS } from "../../src/sim/strategic/resources";
import fr from "../../src/i18n/fr.json";

const world = loadWorld();
const strat = (s: GameState) => {
  if (!s.strategic) throw new Error("pas d'état stratégique");
  return s.strategic;
};

function runYear(seed = 42, cmds: Command[] = []): GameState {
  let s = createInitialState(seed, world);
  for (const c of cmds) s = applyCommand(s, c, undefined, world);
  return applyCommand(s, { type: "AdvanceDays", n: 360 }, undefined, world);
}

describe("un an de jeu (AC1-03)", () => {
  it("360 jours sans erreur ; invariants respectés chaque jour", () => {
    let s = createInitialState(42, world);
    const usedKeys = new Set<string>();
    for (let d = 0; d < 360; d++) {
      const st = strat(s);
      const plan = planDay(world, st, s.date);
      for (const r of RESOURCE_IDS) {
        const day = plan.resources[r];
        for (const f of [...day.production.factors, ...day.consumption.factors, ...day.losses.factors, ...day.capacity.factors, ...day.net.factors]) usedKeys.add(f.key);
        expect(Number.isFinite(st.stocks[r]), r).toBe(true);
        expect(st.stocks[r]).toBeGreaterThanOrEqual(0);
        expect(st.stocks[r]).toBeLessThanOrEqual(Math.max(day.capacity.value, world.scenario.stocks[r] ?? 0) + 1e-6);
      }
      for (const p of Object.values(st.provinces)) {
        expect(p.population).toBeGreaterThanOrEqual(0);
        expect(p.morale).toBeGreaterThanOrEqual(0);
        expect(p.morale).toBeLessThanOrEqual(100);
      }
      s = tickDay(s, world);
    }
    expect(s.date).toEqual({ year: 846, day: 1 });
    expect([...usedKeys].filter((k) => !(k in fr))).toEqual([]);
  });
});

describe("règles chiffrées (AC1-05)", () => {
  const s0 = createInitialState(42, world);
  const trost = "prov_trost";
  it("hiver : −35 % de nourriture (02 §1)", () => {
    const winter = provinceProduction(world, strat(s0), { year: 845, day: 1 }, trost, "food").value;
    const spring = provinceProduction(world, strat(s0), { year: 845, day: 91 }, trost, "food").value;
    expect(winter / spring).toBeCloseTo(0.65, 10);
  });
  it.each([
    ["reduit", 0.85, -3, 0.95],
    ["strict", 0.7, -8, 0.88],
  ] as const)("rationnement %s : consommation ×%f, moral %i, productivité ×%f (02 §3.2)", (level, cons, morale, prod) => {
    const normal = strat(s0);
    const rationed = strat(applyCommand(s0, { type: "SetRationing", level }, undefined, world));
    const date = { year: 845, day: 91 };
    const pN = planDay(world, normal, date);
    const pR = planDay(world, rationed, date);
    expect(pR.resources.food.consumption.value / pN.resources.food.consumption.value).toBeCloseTo(cons, 10);
    expect((pR.moraleTarget[trost]?.value ?? 0) - (pN.moraleTarget[trost]?.value ?? 0)).toBeCloseTo(morale, 10);
    expect(provinceProduction(world, rationed, date, trost, "food").value / provinceProduction(world, normal, date, trost, "food").value).toBeCloseTo(prod, 10);
  });
  it("famine : rupture → mortalité, moral en baisse, alerte avec pause", () => {
    const st = structuredClone(strat(s0));
    st.stocks.food = 0;
    const plan = planDay(world, st, { year: 845, day: 1 });
    expect(plan.famine).toBeGreaterThan(0);
    expect(plan.moraleTarget[trost]?.factors.map((f) => f.key)).toContain("why.morale_famine");
    const after = applyDay(world, st, plan);
    expect(after.provinces[trost]?.population).toBeLessThan(st.provinces[trost]?.population ?? 0);
    expect(after.log.at(-1)).toMatchObject({ key: "alert.shortage", params: { resource: "food" }, pause: true });
    expect(after.shortages).toContain("food");
  });
  it("commande SetRationing validée", () => {
    expect(validateCommand({ type: "SetRationing", level: "strict" }).ok).toBe(true);
    expect(validateCommand({ type: "SetRationing", level: "total" }).ok).toBe(false);
  });
});

describe("déterminisme et sauvegarde (AC1-06, AC1-07)", () => {
  it("1 an deux fois → même hash ; une décision différente → hash différent", () => {
    expect(stateHash(runYear())).toBe(stateHash(runYear()));
    expect(stateHash(runYear(42, [{ type: "SetRationing", level: "reduit" }]))).not.toBe(stateHash(runYear()));
  });
  it("rejeu = état vivant", () => {
    const initial = createInitialState(7, world);
    const cmds: Command[] = [{ type: "AdvanceDays", n: 100 }, { type: "SetRationing", level: "strict" }, { type: "AdvanceDays", n: 60 }];
    let live = initial;
    for (const c of cmds) live = applyCommand(live, c, undefined, world);
    expect(stateHash(replay(initial, cmds, world))).toBe(stateHash(live));
  });
  it("sauvegarde en cours de partie : aller-retour au même hash, puis même suite", () => {
    const mid = applyCommand(createInitialState(42, world), { type: "AdvanceDays", n: 123 }, undefined, world);
    const restored = deserialize(serialize(mid));
    expect(stateHash(restored)).toBe(stateHash(mid));
    const a = applyCommand(mid, { type: "AdvanceDays", n: 50 }, undefined, world);
    const b = applyCommand(restored, { type: "AdvanceDays", n: 50 }, undefined, world);
    expect(stateHash(a)).toBe(stateHash(b));
  });
});
