// Équivalent Node (worker_threads) du Web Worker, pour l'auto-test sim:selftest et le contrôle de déterminisme de sim:balance.
import { parentPort } from "node:worker_threads";
import { campaignDataFromFiles, sourceForScenario } from "../campaign/campaign";
import { readDataFiles } from "../data/loadNode";
import { formatIssue } from "../data/validate";
import { worldSourceFromFiles } from "../data/worldSource";
import { createSimEndpoint } from "../sim/sim";
import type { SimRequest } from "../sim/sim";

/** Scénario demandé par le dernier `init` : une campagne (P9) transforme la source de monde avant sa construction. */
let requested: string | null = null;
const handle = createSimEndpoint(() => {
  const files = readDataFiles("data");
  const { source, issues } = worldSourceFromFiles(files);
  if (!source) throw new Error(`Données invalides :\n${issues.map(formatIssue).join("\n")}`);
  return requested ? sourceForScenario(source, campaignDataFromFiles(files), requested) : source;
});

parentPort?.on("message", (req: SimRequest) => {
  if (req.op === "init") requested = req.scenario;
  parentPort?.postMessage(handle(req));
});
