import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/sim/core/rng";
import { fnv1a } from "../../../src/sim/core/hash";

const round10 = (v: number): string => v.toFixed(10);

describe("Rng mulberry32 (AC-04)", () => {
  it("graine 42 : 5 premières valeurs", () => {
    const r = new Rng(42);
    expect(Array.from({ length: 5 }, () => round10(r.next()))).toEqual([
      "0.6011037519", "0.4482905590", "0.8524657935", "0.6697340414", "0.1748138987",
    ]);
  });
  it("graine 12345 : 5 premières valeurs", () => {
    const r = new Rng(12345);
    expect(Array.from({ length: 5 }, () => round10(r.next()))).toEqual([
      "0.9797282678", "0.3067522645", "0.4842054215", "0.8179344125", "0.5094283693",
    ]);
  });
  it("graine 42 : 1000e et 1001e appels", () => {
    const r = new Rng(42);
    for (let i = 0; i < 999; i++) r.next();
    expect(round10(r.next())).toBe("0.6425111389");
    expect(round10(r.next())).toBe("0.3865283413");
  });
  it("état sérialisable : reprise identique", () => {
    const a = new Rng(7);
    for (let i = 0; i < 10; i++) a.next();
    const b = Rng.fromState(a.serialize());
    expect(b.next()).toBe(a.next());
  });
  it("int, pick, shuffle restent dans leurs bornes", () => {
    const r = new Rng(1);
    for (let i = 0; i < 500; i++) {
      const v = r.int(-3, 3);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThanOrEqual(3);
    }
    expect(["a", "b"]).toContain(r.pick(["a", "b"]));
    expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
    expect(() => r.int(3, 1)).toThrow(RangeError);
    expect(() => r.pick([])).toThrow(RangeError);
  });
});

describe("Rng.fork (AC-05)", () => {
  it("(a) fork('a') ≠ fork('b')", () => {
    const r = new Rng(42);
    expect(r.fork("a").next()).not.toBe(r.fork("b").next());
  });
  it("(b) créer un fork ne change pas la suite du parent", () => {
    const ref = new Rng(42);
    const withFork = new Rng(42);
    ref.next();
    withFork.next();
    withFork.fork("x").next();
    expect(withFork.next()).toBe(ref.next());
  });
  it("(c) même graine + même label = même suite, quel que soit l'état du parent", () => {
    const p1 = new Rng(42);
    const p2 = new Rng(42);
    for (let i = 0; i < 37; i++) p2.next();
    const f1 = p1.fork("combat");
    const f2 = p2.fork("combat");
    expect([f1.next(), f1.next(), f1.next()]).toEqual([f2.next(), f2.next(), f2.next()]);
  });
});

describe("FNV-1a (AC-06)", () => {
  it('fnv1a("canon") === 49169776', () => {
    expect(fnv1a("canon")).toBe(49169776);
    expect(fnv1a("canon").toString(16)).toBe("2ee4570");
  });
});
