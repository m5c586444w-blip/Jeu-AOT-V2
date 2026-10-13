import { describe, expect, it } from "vitest";
import { CLEAR, canSee, isActive, meaningOf, visibilityRange } from "../../../src/sim/signal";
import type { SignalConditions } from "../../../src/sim/signal";
import { sb, sig } from "./helpers";

describe("P4 (a) visibilité d'un signal", () => {
  it("déterministe et monotone : pire météo, portée inférieure ou égale", () => {
    const steps = [0, 0.25, 0.5, 0.75, 1];
    for (const color of ["rouge", "vert", "noir", "jaune"] as const) {
      expect(visibilityRange(color, CLEAR, sb)).toBe(visibilityRange(color, CLEAR, sb));
      for (const k of ["rain", "smoke", "relief"] as const) {
        let prev = Infinity;
        for (const v of steps) {
          const r = visibilityRange(color, { ...CLEAR, [k]: v } as SignalConditions, sb);
          expect(r).toBeLessThanOrEqual(prev);
          prev = r;
        }
      }
      expect(visibilityRange(color, { ...CLEAR, night: true }, sb)).toBeLessThanOrEqual(visibilityRange(color, CLEAR, sb));
      const worst = visibilityRange(color, { rain: 1, smoke: 1, night: true, relief: 1 }, sb);
      expect(worst).toBeGreaterThanOrEqual(sb.visibility.min_range_m);
      expect(worst).toBeLessThanOrEqual(visibilityRange(color, CLEAR, sb));
    }
  });
  it("noir moins visible que rouge ; la fusée n'est visible que durant sa durée et dans son rayon", () => {
    expect(visibilityRange("noir", CLEAR, sb)).toBeLessThan(visibilityRange("rouge", CLEAR, sb));
    const s = sig({ x: 0, y: 0, issuedAtS: 10, durationS: 20 });
    expect(isActive(s, 9)).toBe(false);
    expect(isActive(s, 30)).toBe(true);
    expect(isActive(s, 31)).toBe(false);
    expect(canSee(s, { x: 2000, y: 0 }, 15, CLEAR, sb)).toBe(true);
    expect(canSee(s, { x: 2000, y: 0 }, 15, { ...CLEAR, rain: 1, smoke: 1 }, sb)).toBe(false);
    expect(canSee(s, { x: 2000, y: 0 }, 40, CLEAR, sb)).toBe(false);
  });
  it("codes par branche [C] : Corps rouge/vert/noir, Garnison vert/rouge/jaune", () => {
    expect(meaningOf("corps", "rouge", sb)).toBe("titan_repere");
    expect(meaningOf("corps", "noir", sb)).toBe("titan_anormal");
    expect(meaningOf("corps", "jaune", sb)).toBeNull();
    expect(meaningOf("garnison", "jaune", sb)).toBe("reussite");
  });
});
