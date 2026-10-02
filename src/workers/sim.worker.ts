/// <reference lib="webworker" />
// Web Worker navigateur : la même simulation que l'exécution directe, derrière un protocole de messages.
import { createSim, handleSimRequest } from "../sim/sim";
import type { SimRequest } from "../sim/sim";

const sim = createSim(42);
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = (ev: MessageEvent<SimRequest>) => {
  scope.postMessage(handleSimRequest(sim, ev.data));
};
