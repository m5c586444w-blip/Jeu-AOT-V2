import { parentPort } from "node:worker_threads";
import { loadWorld } from "../../data/worldNode";
import type { World } from "../../sim/strategic/world";
import { playGame } from "./game";
import type { GameResult } from "./game";

/** Fil de `sim:balance` : reçoit des lots de graines, renvoie les résultats ; un monde chargé par scénario et par fil. */
export interface BalanceJob {
  dir: string;
  scenario: string;
  camp: string;
  seeds: number[];
}

const worlds = new Map<string, World>();

parentPort?.on("message", (job: BalanceJob | null) => {
  if (job === null) {
    process.exit(0);
  }
  let w = worlds.get(job.scenario);
  if (!w) {
    w = loadWorld(job.dir, job.scenario);
    worlds.set(job.scenario, w);
  }
  const out: GameResult[] = job.seeds.map((seed) => playGame(w as World, job.camp, seed));
  parentPort?.postMessage(out);
});
