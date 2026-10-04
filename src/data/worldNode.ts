import { buildWorld } from "../sim/strategic/world";
import type { World } from "../sim/strategic/world";
import { readDataFiles } from "./loadNode";
import { formatIssue } from "./validate";
import { worldSourceFromFiles } from "./worldSource";

export const DEFAULT_SCENARIO = "scn_sandbox_845";

/**
 * Monde validé depuis le disque (outils CLI, tests). Même chemin que le Worker (`worldSourceFromFiles`),
 * pour qu'une collection ou un fichier d'équilibrage ajouté soit chargé partout de la même façon.
 */
export function loadWorld(dir = "data", scenarioId = DEFAULT_SCENARIO): World {
  const { source, issues } = worldSourceFromFiles(readDataFiles(dir));
  if (!source) throw new Error(`Données invalides :\n${issues.map(formatIssue).join("\n")}`);
  return buildWorld(source, scenarioId);
}
