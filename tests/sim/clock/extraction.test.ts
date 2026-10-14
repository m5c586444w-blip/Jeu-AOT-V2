import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/sim/core/rng";
import { addEvidence, applyCapture, createClockState, extractionOdds, extractionOutcome, extractionProblem, registerBearer } from "../../../src/sim/clock";
import type { ClockState } from "../../../src/sim/clock";
import { cb, input, nineState, slot, tweak } from "./helpers";

const sh = nineState({ shifter_cuirasse: slot("char_reiner", "marley", 843), shifter_colossal: slot("char_reiner", "marley", 843), shifter_machoire: slot("char_ymir", "paradis", 845) });
const exposed = (): ClockState => {
  let s = registerBearer(createClockState(), input("char_reiner", { role: "connu" }), cb);
  s = registerBearer(s, input("char_ymir", { faction: "paradis" }), cb);
  for (let i = 0; i < 12; i++) s = addEvidence(s, "char_reiner", "paradis", "interrogatoire", i, cb);
  return s;
};

describe("P5 extraction : conditions", () => {
  it("il faut connaître l'identité : porteur caché et innocent reçoivent le même refus", () => {
    const hidden = registerBearer(createClockState(), input("char_reiner"), cb);
    expect(extractionProblem(hidden, sh, "char_reiner", "paradis")).toBe("clock.err.unknown_identity");
    expect(extractionProblem(hidden, sh, "char_innocent", "paradis")).toBe("clock.err.unknown_identity");
    expect(extractionProblem(exposed(), sh, "char_reiner", "paradis")).toBeNull();
    expect(extractionProblem(exposed(), sh, "char_reiner", "hizuru")).toBe("clock.err.unknown_identity");
  });
  it("pas de capture de ses propres porteurs ; pas de seconde capture", () => {
    expect(extractionProblem(exposed(), sh, "char_ymir", "paradis")).toBe("clock.err.own_bearer");
    const done = applyCapture(sh, "char_reiner", "paradis");
    expect(extractionProblem(exposed(), done, "char_reiner", "paradis")).toBe("clock.err.already_captured");
  });
});

describe("P5 extraction : chances", () => {
  it("mort + capture + fuite = 1, chaque terme dans [0,1]", () => {
    for (const n of [1, 2, 4, 9]) for (const c of [true, false]) for (const ctl of [0, 50, 100]) {
      const o = extractionOdds(n, c, ctl, cb);
      expect(o.kill + o.capture + o.escape).toBeCloseTo(1, 12);
      for (const v of [o.kill, o.capture, o.escape]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    }
  });
  it("plus d'assaillants = plus de captures, jusqu'à max_attackers puis plateau", () => {
    const cap = (n: number) => extractionOdds(n, false, 50, cb).capture;
    expect(cap(2)).toBeGreaterThan(cap(1));
    expect(cap(cb.extraction.max_attackers)).toBeGreaterThan(cap(2));
    expect(cap(cb.extraction.max_attackers + 5)).toBe(cap(cb.extraction.max_attackers));
    expect(cap(1)).toBeCloseTo(cb.extraction.base + cb.extraction.per_attacker - (cb.extraction.resist_k * 50) / 100, 9);
  });
  it("l'arme de contention augmente la capture et réduit le risque de tuer le porteur", () => {
    const w = extractionOdds(3, false, 50, cb);
    const c = extractionOdds(3, true, 50, cb);
    expect(c.capture).toBeGreaterThan(w.capture);
    expect(c.kill).toBeLessThan(w.kill);
    expect(w.kill).toBe(cb.extraction.kill_base);
    expect(c.kill).toBeCloseTo(cb.extraction.kill_base * cb.extraction.contention_kill_mult, 12);
    expect(extractionOdds(3, true, 50, tweak("extraction", { contention_bonus: 0 })).capture).toBeCloseTo(w.capture, 9);
  });
  it("un porteur qui contrôle mieux résiste mieux (resist_k)", () => {
    expect(extractionOdds(3, false, 90, cb).capture).toBeLessThan(extractionOdds(3, false, 10, cb).capture);
    expect(extractionOdds(3, false, 90, tweak("extraction", { resist_k: 0 })).capture).toBe(extractionOdds(3, false, 10, tweak("extraction", { resist_k: 0 })).capture);
  });
  it("capture bornée par ce que laisse le risque de mort ; zéro assaillant refusé", () => {
    const o = extractionOdds(4, true, 0, tweak("extraction", { base: 1, kill_base: 0.5 }));
    expect(o.kill + o.capture).toBeCloseTo(1, 12);
    expect(o.escape).toBeCloseTo(0, 12);
    expect(() => extractionOdds(0, false, 0, cb)).toThrow(RangeError);
  });
  it("issue selon le jet : frontières exactes, et fréquences conformes aux chances", () => {
    const o = extractionOdds(3, true, 40, cb);
    expect(extractionOutcome(o, 0)).toBe("mort");
    expect(extractionOutcome(o, o.kill - 1e-9)).toBe("mort");
    expect(extractionOutcome(o, o.kill)).toBe("capture");
    expect(extractionOutcome(o, o.kill + o.capture - 1e-9)).toBe("capture");
    expect(extractionOutcome(o, o.kill + o.capture)).toBe("fuite");
    const rng = new Rng(11);
    const n = 6000;
    const k = { mort: 0, capture: 0, fuite: 0 };
    for (let i = 0; i < n; i++) k[extractionOutcome(o, rng.next())]++;
    expect(Math.abs(k.capture / n - o.capture)).toBeLessThan(0.02);
    expect(Math.abs(k.mort / n - o.kill)).toBeLessThan(0.02);
  });
});

describe("P5 extraction : effets sur l'horloge des Titans", () => {
  it("capture par Paradis : tous les Titans du porteur sont captured, horloge (since) inchangée, le reste intact, entrée non modifiée", () => {
    const before = JSON.stringify(sh);
    const out = applyCapture(sh, "char_reiner", "paradis");
    expect(JSON.stringify(sh)).toBe(before);
    expect(out.titans["shifter_cuirasse"]).toMatchObject({ captured: true, since: 843, holder: "char_reiner", faction: "marley" });
    expect(out.titans["shifter_colossal"]?.captured).toBe(true);
    expect(out.titans["shifter_machoire"]?.captured).toBe(false);
  });
  it("seul Paradis marque « captured » (le drapeau signifie aux mains de Paradis)", () => {
    expect(applyCapture(sh, "char_reiner", "marley")).toBe(sh);
  });
});
