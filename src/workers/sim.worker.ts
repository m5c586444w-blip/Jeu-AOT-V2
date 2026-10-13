/// <reference lib="webworker" />
// Web Worker navigateur : la même simulation que l'exécution directe, derrière un protocole de messages.
// Les données sont embarquées dans le Worker et validées par Zod ici (05 §1), hors du paquet principal.
import { campaignDataFromFiles, sourceForScenario } from "../campaign/campaign";
import { worldSourceFromFiles } from "../data/worldSource";
import { formatIssue } from "../data/validate";
import { createSimEndpoint } from "../sim/sim";
import type { SimRequest } from "../sim/sim";

const files = import.meta.glob<unknown>(["/data/**/*.json", "!/data/map/**", "!/data/art/**", "!/data/places/**"], { eager: true, import: "default" });

/** Scénario demandé par le dernier `init` : une campagne (P9, D-154) transforme la source de monde avant sa construction. */
let requested: string | null = null;
const handle = createSimEndpoint(() => {
  const { source, issues } = worldSourceFromFiles(files);
  if (!source) throw new Error(`Données invalides :\n${issues.map(formatIssue).join("\n")}`);
  return requested ? sourceForScenario(source, campaignDataFromFiles(files), requested) : source;
});

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = (ev: MessageEvent<SimRequest>) => {
  if (ev.data.op === "init") requested = ev.data.scenario;
  scope.postMessage(handle(ev.data));
};
