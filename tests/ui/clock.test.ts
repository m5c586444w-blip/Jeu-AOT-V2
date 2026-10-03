import { describe, expect, it } from "vitest";
import { GameClock } from "../../src/ui/clock";

const MS = [3000, 1500, 750, 350, 150];

describe("horloge de jeu (AC1-12)", () => {
  it("en pause au départ ; aucune journée ne s'écoule", () => {
    const c = new GameClock(MS);
    expect(c.paused).toBe(true);
    expect(c.consume(10_000)).toBe(0);
  });
  it("vitesse 1 ≈ 3 s par jour ; le reste est reporté", () => {
    const c = new GameClock(MS);
    c.setSpeed(1);
    expect(c.consume(2000)).toBe(0);
    expect(c.consume(1000)).toBe(1);
    c.setSpeed(5);
    expect(c.consume(160)).toBe(1);
    expect(c.consume(10_000, 3)).toBe(3);
  });
  it("Espace : bascule pause / dernière vitesse", () => {
    const c = new GameClock(MS);
    c.setSpeed(4);
    c.togglePause();
    expect(c.speed).toBe(0);
    c.togglePause();
    expect(c.speed).toBe(4);
    expect(() => c.setSpeed(6)).toThrow(RangeError);
  });
  it("pause automatique sur une alerte bloquante, une seule fois par alerte", () => {
    const c = new GameClock(MS);
    c.setSpeed(3);
    const info = { seq: 1, date: { year: 845, day: 3 }, key: "alert.recovered", params: {}, pause: false };
    expect(c.observeAlerts([info])).toHaveLength(1);
    expect(c.speed).toBe(3);
    const rupture = { seq: 2, date: { year: 845, day: 4 }, key: "alert.shortage", params: { resource: "food" }, pause: true };
    expect(c.observeAlerts([info, rupture])).toEqual([rupture]);
    expect(c.paused).toBe(true);
    c.setSpeed(3);
    expect(c.observeAlerts([info, rupture])).toEqual([]);
    expect(c.speed).toBe(3);
  });
});
