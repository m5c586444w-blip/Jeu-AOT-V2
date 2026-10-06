import { stepBattle } from "../../sim/tactical/battle";
import type { Battle } from "../../sim/tactical/battle";
import type { TimedOrder } from "../../sim/tactical/types";

/**
 * Plafond du temps réel pris en compte par image (s). Jusqu'à 1 s par image, la simulation rattrape le temps réel
 * (en 4K sans GPU, une image prend ~0,75 s ; plafonné à 0,25 s, la bataille tournait au tiers de sa vitesse, R0.3).
 * Au-delà (onglet en arrière-plan), le pas reste borné. Le plafond ne change que le rythme, jamais le résultat :
 * la bataille avance par pas fixes et les ordres sont datés en pas (tests/ui/battle-clock.test.ts).
 */
export const FRAME_DT_CAP_S = 1;

export interface BattleClock {
  /** Temps de simulation en attente (s), reporté d'une image à l'autre. */
  acc: number;
}

/**
 * Avance la bataille d'une image : `frameSeconds` de temps réel × `speed`, en pas fixes de 1/tick_hz.
 * `beforeStep` est appelé avant chaque pas (copie des positions pour l'interpolation). Retourne le nombre de pas joués.
 */
export function advanceFrame(bt: Battle, clock: BattleClock, frameSeconds: number, speed: number, orders: readonly TimedOrder[], beforeStep?: () => void, cap = FRAME_DT_CAP_S): number {
  const tick = 1 / bt.world.balance.tick_hz;
  clock.acc += Math.min(cap, frameSeconds) * speed;
  let steps = 0;
  while (clock.acc >= tick && !bt.state.ended) {
    beforeStep?.();
    stepBattle(bt, orders.filter((x) => x.tick === bt.state.tick));
    clock.acc -= tick;
    steps++;
  }
  return steps;
}
