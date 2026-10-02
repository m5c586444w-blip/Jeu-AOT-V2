// Équivalent Node (worker_threads) du Web Worker, pour l'auto-test sim:selftest.
import { parentPort } from "node:worker_threads";
import { createSim, handleSimRequest } from "../sim/sim";
import type { SimRequest } from "../sim/sim";

const sim = createSim(42);
parentPort?.on("message", (req: SimRequest) => {
  parentPort?.postMessage(handleSimRequest(sim, req));
});
