// npm run sim:year [-- --bench] — AC1-03 / AC1-09 : un an de jeu headless, invariants vérifiés chaque jour ;
// avec --bench, mesure du tick stratégique sur 150 provinces (74 réelles + 76 copies synthétiques).
import { performance } from "node:perf_hooks";
import { DEFAULT_SCENARIO, loadWorld } from "../data/worldNode";
import { createInitialState, tickDay } from "../sim/core/state";
import type { GameState } from "../sim/core/state";
import { planDay, totals } from "../sim/strategic/economy";
import { RESOURCE_IDS } from "../sim/strategic/resources";
import { buildWorld } from "../sim/strategic/world";
import type { World } from "../sim/strategic/world";

const bench = process.argv.includes("--bench");
const BUDGET_MS = 8;

function check(world: World, s: GameState): string[] {
  const st = s.strategic;
  if (!st) return ["pas d'état stratégique"];
  const problems: string[] = [];
  const plan = planDay(world, st, s.date);
  for (const r of RESOURCE_IDS) {
    const v = st.stocks[r];
    const cap = Math.max(plan.resources[r].capacity.value, world.scenario.stocks[r] ?? 0);
    if (!Number.isFinite(v) || v < 0 || v > cap + 1e-6) problems.push(`${r} = ${v} hors de [0, ${cap}]`);
  }
  for (const [id, p] of Object.entries(st.provinces)) {
    if (!Number.isFinite(p.population) || p.population < 0) problems.push(`${id}.population = ${p.population}`);
    if (!(p.morale >= 0 && p.morale <= 100)) problems.push(`${id}.moral = ${p.morale}`);
  }
  return problems;
}

function runYear(world: World): { state: GameState; times: number[]; problems: string[] } {
  let s = createInitialState(42, world);
  const times: number[] = [];
  const problems: string[] = [];
  for (let d = 0; d < 360; d++) {
    const t0 = performance.now();
    s = tickDay(s, world);
    times.push(performance.now() - t0);
    for (const p of check(world, s)) problems.push(`an ${s.date.year} j${s.date.day} : ${p}`);
  }
  return { state: s, times, problems };
}

function stats(times: number[]): { mean: number; p95: number; max: number } {
  const sorted = [...times].sort((a, b) => a - b);
  return { mean: times.reduce((a, b) => a + b, 0) / times.length, p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0, max: sorted.at(-1) ?? 0 };
}

const fr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const world = loadWorld("data", DEFAULT_SCENARIO);
const year = runYear(world);
const st = year.state.strategic;
if (!st) throw new Error("pas d'état stratégique");
const tot = totals(st);
console.log(`sim:year : ${DEFAULT_SCENARIO}, graine 42, 360 jours → an ${year.state.date.year}, jour ${year.state.date.day}`);
console.log(`  population ${fr.format(tot.population)} · soldats ${fr.format(tot.soldiers)} · alertes ${st.log.length}`);
console.log(`  stocks : ${RESOURCE_IDS.map((r) => `${r} ${fr.format(st.stocks[r])}`).join(" · ")}`);
let failed = year.problems.length > 0;
for (const p of year.problems.slice(0, 20)) console.error(`  INVARIANT ${p}`);
const s74 = stats(year.times);
console.log(`  tick (74 provinces) : moyenne ${s74.mean.toFixed(3)} ms · p95 ${s74.p95.toFixed(3)} ms · max ${s74.max.toFixed(3)} ms`);

if (bench) {
  const pool = world.provinces;
  const extra = Array.from({ length: 150 - pool.length }, (_, i) => pool[i % pool.length]).flatMap((p, i) => (p ? [{ ...p, id: `${p.id}_bis${i}`, atlas_code: undefined }] : []));
  const scenario = { ...world.scenario, garrisons: { ...world.scenario.garrisons }, buildings: { ...world.scenario.buildings } };
  for (const p of extra) {
    const base = p.id.replace(/_bis\d+$/, "");
    const g = world.scenario.garrisons[base];
    if (g) scenario.garrisons[p.id] = g;
    const b = world.scenario.buildings[base];
    if (b) scenario.buildings[p.id] = b;
  }
  const big = buildWorld({ provinces: [...world.provinces, ...extra], buildings: [...world.buildings.values()], scenarios: [scenario], economy: world.economy, time: world.time }, scenario.id);
  const run = runYear(big);
  const s150 = stats(run.times);
  console.log(`  tick (${big.provinces.length} provinces) : moyenne ${s150.mean.toFixed(3)} ms · p95 ${s150.p95.toFixed(3)} ms · max ${s150.max.toFixed(3)} ms (budget ${BUDGET_MS} ms, 00 §6.8)`);
  if (s150.p95 > BUDGET_MS) {
    console.error(`  ÉCHEC : p95 du tick au-dessus de ${BUDGET_MS} ms.`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("sim:year : OK.");
