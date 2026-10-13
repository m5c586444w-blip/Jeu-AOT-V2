// Fil de travail de sim:balance (worker_threads) : joue des parties d'une campagne et renvoie leurs résultats.
import { parentPort } from "node:worker_threads";
import { campaignDataFromFiles, effectiveMods, findCampaign, parseCampaignScenarioId, sourceForScenario } from "../../campaign/campaign";
import { readDataFiles } from "../../data/loadNode";
import { formatIssue } from "../../data/validate";
import { worldSourceFromFiles } from "../../data/worldSource";
import { buildWorld } from "../../sim/strategic/world";
import type { World } from "../../sim/strategic/world";
import { playGame } from "./game";

export interface BalanceJob {
  scenario: string;
  seeds: number[];
  keepCommands: boolean;
}

const files = readDataFiles("data");
const camp = campaignDataFromFiles(files);
const worlds = new Map<string, World>();

function worldOf(id: string): World {
  const cached = worlds.get(id);
  if (cached) return cached;
  const { source, issues } = worldSourceFromFiles(files);
  if (!source) throw new Error(issues.map(formatIssue).join("\n"));
  const w = buildWorld(sourceForScenario(source, camp, id), id);
  worlds.set(id, w);
  return w;
}

parentPort?.on("message", (job: BalanceJob) => {
  try {
    const p = parseCampaignScenarioId(job.scenario);
    const c = p ? findCampaign(camp, p.campaign) : undefined;
    if (!p || !c) throw new Error(`campagne inconnue : ${job.scenario}`);
    const mods = effectiveMods(camp, c.id, p.difficulty);
    const w = worldOf(job.scenario);
    for (const seed of job.seeds) parentPort?.postMessage({ ok: true, result: playGame(w, c, mods, seed, undefined, job.keepCommands) });
    parentPort?.postMessage({ done: true });
  } catch (e) {
    parentPort?.postMessage({ ok: false, error: (e as Error).stack ?? String(e) });
  }
});
