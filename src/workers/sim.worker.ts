/// <reference lib="webworker" />
// Web Worker navigateur : la même simulation que l'exécution directe, derrière un protocole de messages.
// Les données sont embarquées dans le Worker et validées par Zod ici (05 §1), hors du paquet principal.
import { worldSourceFromFiles } from "../data/worldSource";
import { formatIssue } from "../data/validate";
import { createSimEndpoint } from "../sim/sim";
import type { SimRequest } from "../sim/sim";

const files = import.meta.glob<unknown>(["/data/**/*.json", "!/data/map/**", "!/data/art/**"], { eager: true, import: "default" });

const handle = createSimEndpoint(() => {
  const { source, issues } = worldSourceFromFiles(files);
  if (!source) throw new Error(`Données invalides :\n${issues.map(formatIssue).join("\n")}`);
  return source;
});

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = (ev: MessageEvent<SimRequest>) => {
  scope.postMessage(handle(ev.data));
};
