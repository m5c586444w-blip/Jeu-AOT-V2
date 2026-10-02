import { describe, expect, it } from "vitest";
import { advance, compareDates, DAYS_PER_YEAR, isValidDate, monthOf, seasonOf, START_DATE } from "../../../src/sim/core/time";

describe("GameDate", () => {
  it("départ : an 845, jour 1", () => {
    expect(START_DATE).toEqual({ year: 845, day: 1 });
  });
  it("année de 360 jours", () => {
    expect(DAYS_PER_YEAR).toBe(360);
    expect(advance(START_DATE, 359)).toEqual({ year: 845, day: 360 });
    expect(advance(START_DATE, 360)).toEqual({ year: 846, day: 1 });
    expect(advance({ year: 845, day: 200 }, 3650)).toEqual({ year: 855, day: 250 });
  });
  it("advance(0) est l'identité et refuse les valeurs invalides", () => {
    expect(advance(START_DATE, 0)).toEqual(START_DATE);
    expect(() => advance(START_DATE, -1)).toThrow(RangeError);
    expect(() => advance(START_DATE, 1.5)).toThrow(RangeError);
  });
  it("mois et saisons de 3 mois", () => {
    expect(monthOf({ year: 845, day: 30 })).toBe(1);
    expect(monthOf({ year: 845, day: 31 })).toBe(2);
    expect(monthOf({ year: 845, day: 360 })).toBe(12);
    expect(seasonOf({ year: 845, day: 1 })).toBe("hiver");
    expect(seasonOf({ year: 845, day: 91 })).toBe("printemps");
    expect(seasonOf({ year: 845, day: 181 })).toBe("ete");
    expect(seasonOf({ year: 845, day: 360 })).toBe("automne");
  });
  it("comparaison et validation", () => {
    expect(compareDates({ year: 850, day: 1 }, { year: 849, day: 360 })).toBeGreaterThan(0);
    expect(isValidDate({ year: 850, day: 0 })).toBe(false);
    expect(isValidDate({ year: 850, day: 361 })).toBe(false);
  });
});
