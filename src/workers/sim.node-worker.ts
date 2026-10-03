// Équivalent Node (worker_threads) du Web Worker, pour l'auto-test sim:selftest.
import { parentPort } from "node:worker_threads";
import { readDataFiles } from "../data/loadNode";
import { formatIssue } from "../data/validate";
import { worldSourceFromFiles } from "../data/worldSource";
import { createSimEndpoint } from "../sim/sim";
import type { SimRequest } from "../sim/sim";

const handle = createSimEndpoint(() => {
  const { source, issues } = worldSourceFromFiles(readDataFiles("data"));
  if (!source) throw new Error(`Données invalides :\n${issues.map(formatIssue).join("\n")}`);
  return source;
});

parentPort?.on("message", (req: SimRequest) => {
  parentPort?.postMessage(handle(req));
});
