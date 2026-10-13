import { buildWorld } from "../sim/strategic/world";
import type { World, WorldSource } from "../sim/strategic/world";
import { campaignDataFromFiles, sourceForScenario } from "../campaign/campaign";
import { readDataFiles } from "./loadNode";
import { formatIssue } from "./validate";
import { worldSourceFromFiles } from "./worldSource";

export const DEFAULT_SCENARIO = "scn_sandbox_845";

/**
 * Source de monde validée depuis le disque, pour un scénario : celle des données pour un scénario de base ; transformée par
 * la campagne (P9, D-154) pour un scénario `scn_camp_<campagne>__<difficulté>`.
 */
export function loadSource(dir = "data", scenarioId = DEFAULT_SCENARIO): WorldSource {
  const files = readDataFiles(dir);
  const { source, issues } = worldSourceFromFiles(files);
  if (!source) throw new Error(`Données invalides :\n${issues.map(formatIssue).join("\n")}`);
  const camp = campaignDataFromFiles(files);
  if (camp.issues.length > 0) throw new Error(`Campagnes invalides :\n${camp.issues.map(formatIssue).join("\n")}`);
  return sourceForScenario(source, camp, scenarioId);
}

/**
 * Monde validé depuis le disque (outils CLI, tests). Même chemin que le Worker (`worldSourceFromFiles`),
 * pour qu'une collection ou un fichier d'équilibrage ajouté soit chargé partout de la même façon.
 */
export function loadWorld(dir = "data", scenarioId = DEFAULT_SCENARIO): World {
  return buildWorld(loadSource(dir, scenarioId), scenarioId);
}
