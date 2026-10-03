// npm run sim:selftest — AC-16 / AC1-06 : même hash après 1000 ticks en direct et via un worker (worker_threads),
// sans monde (fondations P0), avec l'économie (845), puis avec la couche politique (850).
import { Worker } from "node:worker_threads";
import { DEFAULT_SCENARIO, loadWorld } from "../data/worldNode";
import type { Command } from "../sim/core/commands";
import { createSim } from "../sim/sim";
import type { SimResponse } from "../sim/sim";
import { SimClient } from "../workers/simClient";

const SEED = 42;
const script: Command[] = [{ type: "SetFlag", key: "selftest", value: true }, ...Array.from({ length: 10 }, (): Command => ({ type: "AdvanceDays", n: 100 }))];

const worker = new Worker(new URL("../workers/sim.node-worker.boot.mjs", import.meta.url));
const client = new SimClient({
  post: (m) => worker.postMessage(m),
  onMessage: (h) => worker.on("message", (m: SimResponse) => h(m)),
});

let failed = false;
try {
  for (const scenario of [null, DEFAULT_SCENARIO, "scn_sandbox_850"]) {
    const direct = createSim(SEED, scenario ? loadWorld("data", scenario) : undefined);
    for (const c of script) direct.dispatch(c);
    let last = await client.init(SEED, scenario);
    for (const c of script) last = await client.dispatch(c);
    const d = last.state.date;
    const label = scenario ?? "sans monde";
    console.log(`[${label}] direct : ${direct.hash()} | worker : ${last.hash} | date an ${d.year}, jour ${d.day}`);
    if (last.hash !== direct.hash() || last.state.commandIndex !== script.length) failed = true;
  }
} finally {
  await worker.terminate();
}
if (failed) {
  console.error("sim:selftest : ÉCHEC (hash différent entre direct et worker).");
  process.exitCode = 1;
} else {
  console.log("sim:selftest : OK (direct = worker : sans monde, bac à sable 845, bac à sable politique 850).");
}
