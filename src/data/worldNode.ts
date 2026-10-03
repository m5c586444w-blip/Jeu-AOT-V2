import { buildWorld } from "../sim/strategic/world";
import type { World } from "../sim/strategic/world";
import { loadBalanceDir, loadDataDir } from "./loadNode";
import { formatIssue } from "./validate";

export const DEFAULT_SCENARIO = "scn_sandbox_845";

/** Monde validé depuis le disque (outils CLI, tests). Lève une erreur lisible si les données sont invalides. */
export function loadWorld(dir = "data", scenarioId = DEFAULT_SCENARIO): World {
  const { data, issues } = loadDataDir(dir);
  const { balance, issues: bIssues } = loadBalanceDir(dir);
  const all = [...issues, ...bIssues];
  if (all.length > 0) throw new Error(`Données invalides :\n${all.map(formatIssue).join("\n")}`);
  if (!balance.economy || !balance.time) throw new Error(`Équilibrage incomplet dans ${dir}/balance (economy.json et time.json requis)`);
  return buildWorld({ provinces: data.provinces, buildings: data.buildings, scenarios: data.scenarios, economy: balance.economy, time: balance.time }, scenarioId);
}
