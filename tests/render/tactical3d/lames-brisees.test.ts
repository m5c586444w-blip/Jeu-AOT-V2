import { describe, expect, it } from "vitest";
import { SHARDS_PER_BREAK, SHARD_LIFE_S, shardsAt } from "../../../src/render/tactical3d/battle/shards";

/** Lames brisées (CLAUDE.md § Style des soldats : lames cassables et remplaçables) : les deux lames usées tombent au sol. */
describe("lames brisées en bataille 3D", () => {
  const b = { t: 10, x: 50, y: 40, z: 0, heading: 0, seed: 77 };
  it("rien avant la casse ni après la durée de vie ; deux lames lâchées des mains, de part et d'autre du soldat", () => {
    expect(shardsAt(b, 9.99)).toEqual([]);
    expect(shardsAt(b, 10 + SHARD_LIFE_S + 0.01)).toEqual([]);
    const s = shardsAt(b, 10);
    expect(s).toHaveLength(SHARDS_PER_BREAK);
    expect(s.every((x) => Math.abs(x.z - 1.1) < 1e-9)).toBe(true);
    // Cap 0 (vers l'est) : une lame au sud (y +), l'autre au nord (y −).
    expect(Math.sign((s[0]?.y ?? 0) - b.y)).toBe(-Math.sign((s[1]?.y ?? 0) - b.y));
  });

  it("elles montent un peu, retombent, puis restent posées à plat au sol jusqu'à la fin", () => {
    const up = shardsAt(b, 10.08);
    expect(up.every((x) => x.z > 1.1 && !x.grounded)).toBe(true);
    const late = shardsAt(b, 12.5);
    expect(late.every((x) => x.grounded && x.z === 0.02 && x.tilt === Math.PI / 2)).toBe(true);
    // Posées à moins de 4 m du soldat ; même trajectoire à chaque appel (déterministe).
    for (const x of late) expect(Math.hypot(x.x - b.x, x.y - b.y)).toBeLessThan(4);
    expect(shardsAt(b, 11.3)).toEqual(shardsAt(b, 11.3));
  });

  it("mouvements réduits : lames posées au sol d'emblée", () => {
    expect(shardsAt(b, 10.05, true).every((x) => x.grounded)).toBe(true);
  });
});
