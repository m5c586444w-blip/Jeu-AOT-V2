import { describe, expect, it } from "vitest";
import { battleHash, createBattle, runBattle } from "../../src/sim/tactical/battle";
import { skirmishSetup } from "../../src/sim/tactical/setup";
import type { TimedOrder } from "../../src/sim/tactical/types";
import { Rng } from "../../src/sim/core/rng";
import { FRAME_DT_CAP_S, advanceFrame } from "../../src/ui/tactical/battleClock";
import { world } from "../sim/tactical-helpers";

/**
 * R0 (3) : relever le plafond du pas de temps par image (0,25 s → 1 s) ne change aucun résultat.
 * Même graine, mêmes ordres datés en pas : la bataille jouée image par image, sous l'ancien et le nouveau plafond, avec des
 * images irrégulières (16 ms à 1,5 s), aboutit au même hash que la bataille jouée d'un bloc (runBattle).
 */
const CASES = [
  { map: "tmap_ville", titan: "ttype_moyen_errant", count: 4, men: 36, seed: 7 },
  { map: "tmap_plaine", titan: "ttype_grand_errant", count: 1, men: 12, seed: 1001 },
  { map: "tmap_foret", titan: "ttype_anormal_coureur", count: 2, men: 24, seed: 42 },
] as const;

function frames(seed: number): () => number {
  const rng = new Rng(seed).fork("images");
  // Images irrégulières : la plupart fluides, certaines très lentes (4K sans GPU), quelques pauses longues (onglet caché).
  return () => {
    const r = rng.next();
    return r < 0.7 ? 0.016 : r < 0.95 ? 0.3 + rng.next() * 0.6 : 1 + rng.next() * 0.5;
  };
}

function play(c: (typeof CASES)[number], orders: readonly TimedOrder[], cap: number, speed: number): { hash: number; tick: number; frames: number } {
  const bt = createBattle(world, skirmishSetup(world, c.map, [{ type: c.titan, count: c.count }], c.men, c.seed));
  const clock = { acc: 0 };
  const next = frames(c.seed);
  let n = 0;
  while (!bt.state.ended && n < 200000) {
    advanceFrame(bt, clock, next(), speed, orders, undefined, cap);
    n++;
  }
  return { hash: battleHash(bt.state), tick: bt.state.tick, frames: n };
}

describe("pas de temps par image (R0, item 3)", () => {
  it("le nouveau plafond vaut 1 s", () => expect(FRAME_DT_CAP_S).toBe(1));

  for (const c of CASES) {
    it(`${c.map}, ${c.count} × ${c.titan}, ${c.men} hommes, graine ${c.seed} : même hash sous 0,25 s et 1 s, égal à runBattle`, () => {
      const squads = [...new Set(createBattle(world, skirmishSetup(world, c.map, [{ type: c.titan, count: c.count }], c.men, c.seed)).state.soldiers.map((s) => s.squad))];
      const orders: TimedOrder[] = [
        { tick: 40, squad: squads[0] ?? "", order: "tenir" },
        { tick: 160, squad: squads[1] ?? squads[0] ?? "", order: "repli" },
        { tick: 400, squad: squads[0] ?? "", order: "tuer" },
      ];
      const reference = runBattle(world, skirmishSetup(world, c.map, [{ type: c.titan, count: c.count }], c.men, c.seed), orders);
      const ref = battleHash(reference.state);
      const old = play(c, orders, 0.25, 2);
      const now = play(c, orders, FRAME_DT_CAP_S, 2);
      // Valeurs relevées (rapport R0) : hash de référence, puis par plafond hash · pas · images.
      console.info(`R0-horloge ${c.map} graine ${c.seed} : runBattle ${ref} ; plafond 0,25 s → ${old.hash} · ${old.tick} pas · ${old.frames} images ; plafond 1 s → ${now.hash} · ${now.tick} pas · ${now.frames} images`);
      expect(old.hash).toBe(ref);
      expect(now.hash).toBe(ref);
      expect(now.tick).toBe(old.tick);
      // Le plafond relevé ne change que le rythme : moins d'images pour le même nombre de pas.
      expect(now.frames).toBeLessThanOrEqual(old.frames);
    }, 60_000);
  }
});
