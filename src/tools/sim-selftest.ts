// npm run sim:selftest — AC-16 : même hash après 1000 ticks en direct et via un worker (worker_threads).
import { Worker } from "node:worker_threads";
import type { Command } from "../sim/core/commands";
import { createSim } from "../sim/sim";
import type { SimResponse } from "../sim/sim";
import { SimClient } from "../workers/simClient";

const SEED = 42;
const script: Command[] = [{ type: "SetFlag", key: "selftest", value: true }, ...Array.from({ length: 10 }, (): Command => ({ type: "AdvanceDays", n: 100 }))];

const direct = createSim(SEED);
for (const c of script) direct.dispatch(c);

const worker = new Worker(new URL("../workers/sim.node-worker.boot.mjs", import.meta.url));
const client = new SimClient({
  post: (m) => worker.postMessage(m),
  onMessage: (h) => worker.on("message", (m: SimResponse) => h(m)),
});

try {
  await client.reset(SEED);
  let last = await client.state();
  for (const c of script) last = await client.dispatch(c);
  const ticks = (last.state.date.year - 845) * 360 + last.state.date.day - 1;
  console.log(`direct : ${direct.hash()} | worker : ${last.hash} | ${ticks} ticks | date an ${last.state.date.year}, jour ${last.state.date.day}`);
  if (ticks !== 1000 || last.hash !== direct.hash()) {
    console.error("sim:selftest : ÉCHEC (hash ou nombre de ticks différent).");
    process.exitCode = 1;
  } else {
    console.log("sim:selftest : OK (direct = worker).");
  }
} finally {
  await worker.terminate();
}
