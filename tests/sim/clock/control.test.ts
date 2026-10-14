import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/sim/core/rng";
import { autonomyOf, controlOf, decideAction, ignoreProbability, modelPick, modelTopAbility, reactionDelayS, registerBearer, createClockState, transformGate } from "../../../src/sim/clock";
import type { Bearer } from "../../../src/sim/clock";
import { cb, input, shb, tweak } from "./helpers";

const bearer = (o: Partial<Bearer> = {}): Bearer => ({ ...(registerBearer(createClockState(), input("b"), cb).bearers["b"] as Bearer), ...o });
const strong = () => bearer({ will: 100, bonds: 100, stress: 0 });
const weak = () => bearer({ will: 0, bonds: 0, stress: 100 });
const freq = (n: number, f: (r: Rng) => boolean, seed = 7): number => {
  const rng = new Rng(seed);
  let k = 0;
  for (let i = 0; i < n; i++) if (f(rng)) k++;
  return k / n;
};

describe("P5 (c) contrôle", () => {
  it("monte avec la volonté et les liens, baisse avec le stress", () => {
    const c = (o: Partial<Bearer>) => controlOf(bearer(o), null, cb);
    expect(c({ will: 70 })).toBeGreaterThan(c({ will: 40 }));
    expect(c({ bonds: 70 })).toBeGreaterThan(c({ bonds: 40 }));
    expect(c({ stress: 70 })).toBeLessThan(c({ stress: 40 }));
    expect(c({ will: 60, bonds: 50, stress: 20 })).toBeCloseTo(cb.control.base + cb.control.will_w * 60 + cb.control.bonds_w * 50 - cb.control.stress_w * 20, 9);
  });

  it("un ordre contraire à ses convictions fait baisser le contrôle ; un ordre conforme le fait monter", () => {
    const b = bearer({ convictions: { couvre_repli: -1, tiens_ligne: 1, detruis_tour: -0.5 } });
    const none = controlOf(b, null, cb);
    expect(controlOf(b, "couvre_repli", cb)).toBeCloseTo(none - cb.control.contrary_penalty, 9);
    expect(controlOf(b, "detruis_tour", cb)).toBeCloseTo(none - cb.control.contrary_penalty / 2, 9);
    expect(controlOf(b, "tiens_ligne", cb)).toBeCloseTo(none + cb.control.aligned_bonus, 9);
    expect(controlOf(b, "ouvre_breche", cb)).toBe(none);
    expect(controlOf(b, "couvre_repli", tweak("control", { contrary_penalty: 0 }))).toBe(none);
  });

  it("l'épuisement retranche exhausted_penalty ; le contrôle reste dans 0..100", () => {
    const b = bearer();
    expect(controlOf(b, null, cb, true)).toBeCloseTo(controlOf(b, null, cb) - cb.control.exhausted_penalty, 9);
    expect(controlOf(weak(), null, cb)).toBe(0);
    expect(controlOf(bearer({ will: 100, bonds: 100, stress: 0, convictions: { tiens_ligne: 1 } }), "tiens_ligne", tweak("control", { base: 500 }))).toBe(100);
  });

  it("autonomie dérivée du contrôle : monotone, base et pente de la donnée, bornée", () => {
    expect(autonomyOf(0, cb)).toBe(cb.autonomy.base);
    expect(autonomyOf(50, cb)).toBeCloseTo(cb.autonomy.base + 50 * cb.autonomy.per_control, 9);
    expect(autonomyOf(80, cb)).toBeGreaterThan(autonomyOf(30, cb));
    expect(autonomyOf(100, tweak("autonomy", { per_control: 50 }))).toBe(100);
  });

  it("probabilité d'ignorer un ordre : nulle au-dessus du seuil, max_p à contrôle nul, décroissante", () => {
    expect(ignoreProbability(cb.ignore.below_control, cb)).toBe(0);
    expect(ignoreProbability(100, cb)).toBe(0);
    expect(ignoreProbability(0, cb)).toBe(cb.ignore.max_p);
    expect(ignoreProbability(10, cb)).toBeGreaterThan(ignoreProbability(20, cb));
    expect(ignoreProbability(0, tweak("ignore", { max_p: 0.3 }))).toBe(0.3);
  });

  it("délai de réaction : lent à autonomie nulle, vif à autonomie pleine, monotone", () => {
    expect(reactionDelayS(0, cb)).toBe(cb.reaction.slow_s);
    expect(reactionDelayS(100, cb)).toBe(cb.reaction.fast_s);
    expect(reactionDelayS(70, cb)).toBeLessThan(reactionDelayS(30, cb));
  });
});

describe("P5 ordres généraux et autonomie", () => {
  it("les modèles de chaque Titan ne citent que des capacités de data/shifters/nine.json, et couvrent les Neuf", () => {
    const nine = JSON.parse(readFileSync("data/shifters/nine.json", "utf8")) as { id: string; abilities: { id: string }[] }[];
    expect(nine.map((t) => t.id).sort()).toEqual([...cb.nine].sort());
    for (const t of nine) {
      const known = new Set(t.abilities.map((a) => a.id));
      const model = cb.models[t.id];
      expect(model, t.id).toBeDefined();
      for (const m of model ?? []) expect(known.has(m.ability), `${t.id}:${m.ability}`).toBe(true);
    }
    expect(Object.keys(cb.models).sort()).toEqual([...cb.nine].sort());
  });

  it("sans ordre, le porteur agit selon son modèle ; faible autonomie = prévisible, forte = varié", () => {
    const low = Array.from({ length: 60 }, (_, i) => decideAction(weak(), "shifter_cuirasse", null, new Rng(i), cb));
    expect(new Set(low.map((a) => JSON.stringify(a)))).toEqual(new Set([JSON.stringify({ kind: "own", ability: modelTopAbility("shifter_cuirasse", cb) })]));
    const high = Array.from({ length: 200 }, (_, i) => decideAction(strong(), "shifter_cuirasse", null, new Rng(i), cb));
    const abilities = new Set(high.map((a) => (a.kind === "own" ? a.ability : "?")));
    expect(abilities).toEqual(new Set(["charge", "armure"]));
    const charge = high.filter((a) => a.kind === "own" && a.ability === "charge").length / high.length;
    expect(charge).toBeGreaterThan(0.55);
    expect(charge).toBeLessThan(0.78);
  });

  it("modèle à une seule capacité : toujours celle-là ; Titan sans modèle refusé", () => {
    expect(modelPick("shifter_colossal", new Rng(1), cb)).toBe("onde_chaleur");
    expect(() => modelPick("shifter_inconnu", new Rng(1), cb)).toThrow(RangeError);
  });

  it("avec un ordre : faible autonomie et contrôle correct = exécute toujours l'ordre ; forte autonomie = initiative fréquente", () => {
    const calm = bearer({ will: 10, bonds: 90, stress: 0 }); // contrôle ≥ seuil d'indocilité, autonomie < predictable_below
    expect(controlOf(calm, "tiens_ligne", cb)).toBeGreaterThanOrEqual(cb.ignore.below_control);
    expect(autonomyOf(controlOf(calm, "tiens_ligne", cb), cb)).toBeLessThan(100);
    const calmTight = tweak("autonomy", { predictable_below: 100 });
    for (let i = 0; i < 100; i++) expect(decideAction(calm, "shifter_machoire", "tiens_ligne", new Rng(i), calmTight)).toEqual({ kind: "order", order: "tiens_ligne" });
    const own = freq(2000, (r) => decideAction(strong(), "shifter_machoire", "tiens_ligne", r, cb).kind === "own");
    const a = autonomyOf(controlOf(strong(), "tiens_ligne", cb), cb) / 100;
    expect(own).toBeGreaterThan(a - 0.05);
    expect(own).toBeLessThan(a + 0.05);
  });

  it("un ordre contraire est plus souvent ignoré qu'un ordre conforme ; la fréquence suit ignoreProbability", () => {
    const b = bearer({ will: 30, bonds: 30, stress: 40, convictions: { couvre_repli: -1, tiens_ligne: 1 } });
    const ign = (order: string) => freq(4000, (r) => decideAction(b, "shifter_cuirasse", order, r, cb).kind === "ignore");
    const pCon = ignoreProbability(controlOf(b, "couvre_repli", cb), cb);
    expect(pCon).toBeGreaterThan(0.1);
    expect(ign("couvre_repli")).toBeGreaterThan(ign("tiens_ligne"));
    expect(Math.abs(ign("couvre_repli") - pCon)).toBeLessThan(0.03);
  });

  it("ordre inconnu refusé ; déterminisme à graine égale", () => {
    expect(() => decideAction(strong(), "shifter_cuirasse", "bombarder", new Rng(1), cb)).toThrow(RangeError);
    const run = () => Array.from({ length: 30 }, (_, i) => decideAction(strong(), "shifter_bestial", i % 2 ? "tiens_ligne" : null, new Rng(i), cb));
    expect(run()).toEqual(run());
  });

  it("les six ordres généraux de la spec existent", () => {
    expect([...cb.orders].sort()).toEqual(["couvre_repli", "detruis_tour", "neutralise_titan", "ouvre_breche", "protege_escouade", "tiens_ligne"]);
  });
});

describe("P5 porte de transformation", () => {
  const ok = { control: 100, handsBound: false, surprised: false, endurance: 100, cooldownS: 0 };
  it("accepte quand libre, endurance suffisante et sans cooldown ; délai dans [1, 3] s", () => {
    const g = transformGate(ok, shb, cb);
    expect(g).toMatchObject({ ok: true, reason: null });
    expect(g.delayS).toBe(shb.transform_delay_s[0]);
    expect(transformGate({ ...ok, control: 0 }, shb, cb).delayS).toBe(shb.transform_delay_s[1]);
  });
  it("mains entravées, endurance sous transform_cost ou cooldown : refus motivé", () => {
    expect(transformGate({ ...ok, handsBound: true }, shb, cb)).toMatchObject({ ok: false, reason: "clock.err.hands_bound" });
    expect(transformGate({ ...ok, endurance: shb.transform_cost - 1 }, shb, cb)).toMatchObject({ ok: false, reason: "clock.err.endurance" });
    expect(transformGate({ ...ok, endurance: shb.transform_cost }, shb, cb).ok).toBe(true);
    expect(transformGate({ ...ok, cooldownS: 0.5 }, shb, cb)).toMatchObject({ ok: false, reason: "clock.err.cooldown" });
  });
  it("surpris : délai augmenté de surprised_extra_delay_s ; contrôle bas : délai plus long", () => {
    const base = transformGate(ok, shb, cb).delayS;
    expect(transformGate({ ...ok, surprised: true }, shb, cb).delayS).toBeCloseTo(base + cb.transform.surprised_extra_delay_s, 9);
    expect(transformGate({ ...ok, control: 20 }, shb, cb).delayS).toBeGreaterThan(transformGate({ ...ok, control: 80 }, shb, cb).delayS);
    expect(transformGate({ ...ok, surprised: true }, shb, tweak("transform", { surprised_extra_delay_s: 0 })).delayS).toBe(base);
  });
});
