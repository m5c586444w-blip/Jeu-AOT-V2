// npm run sim:year [-- --bench] — AC1-03 / AC1-09 : un an de jeu headless, invariants vérifiés chaque jour ;
// avec --bench, mesure du tick stratégique sur 150 provinces (74 réelles + 76 copies synthétiques),
// puis avec 3 expéditions et 5 convois en route (AC3-12).
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { GeoSchema } from "../data/geo";
import { applyCommand } from "../sim/core/commands";
import { standardPlan } from "../sim/military/plan";
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
let failed = false;
let world = loadWorld("data", DEFAULT_SCENARIO);
for (const scenarioId of [DEFAULT_SCENARIO, "scn_sandbox_850"]) {
  const w = loadWorld("data", scenarioId);
  world = w;
  const year = runYear(w);
  const st = year.state.strategic;
  if (!st) throw new Error("pas d'état stratégique");
  const tot = totals(st);
  console.log(`sim:year : ${scenarioId}, graine 42, 360 jours → an ${year.state.date.year}, jour ${year.state.date.day}`);
  console.log(`  population ${fr.format(tot.population)} · soldats ${fr.format(tot.soldiers)} · alertes ${st.log.length}`);
  console.log(`  stocks : ${RESOURCE_IDS.map((r) => `${r} ${fr.format(st.stocks[r])}`).join(" · ")}`);
  const pol = year.state.politics;
  if (pol) {
    console.log(`  politique : légitimité ${pol.legitimacy.toFixed(1)} · capital ${fr.format(pol.capital)} · décrets ${pol.laws.length} · propositions ${pol.proposals.length} · vivants ${Object.values(pol.characters).filter((c) => c.alive).length}/${Object.keys(pol.characters).length}`);
    for (const [id, s] of Object.entries(pol.strata)) if (!(s.satisfaction >= 0 && s.satisfaction <= 100 && s.radicalisation >= 0 && s.radicalisation <= 100)) year.problems.push(`strate ${id} hors bornes`);
    if (!(pol.legitimacy >= 0 && pol.legitimacy <= 100)) year.problems.push("légitimité hors bornes");
  }
  // CHR.2 / CCHR-04 : événements de fond par mois de jeu (la chronique de départ n'est pas comptée).
  const ev = year.state.events;
  const cw = w.chronicle;
  if (ev && cw && cw.fond.length > 0) {
    const first = w.scenario.start.year * 360 + w.scenario.start.day - 1;
    const fond = ev.chronicle.filter((c) => cw.events.get(c.event)?.kind === "fond" && c.day > first);
    const perMonth = Array.from({ length: 12 }, (_, m) => fond.filter((c) => Math.floor((c.day - first) / 30) === m).length);
    const distinct = new Set(fond.map((c) => c.event)).size;
    console.log(`  fond : ${fond.length} événements en 12 mois (${perMonth.join(", ")} par mois), moyenne ${(fond.length / 12).toFixed(2)}, ${distinct} textes distincts, ${ev.chronicle.length - fond.length} autres entrées de chronique`);
    if (fond.length / 12 < 3 || Math.min(...perMonth) < 3) year.problems.push(`événements de fond : ${perMonth.join(", ")} (moins de 3 par mois)`);
    if (distinct !== fond.length) year.problems.push("événements de fond : un texte revient dans l'année");
  } else console.log("  fond : pas de couche d'événements dans ce scénario (bac à sable économique)");
  if (year.problems.length > 0) failed = true;
  for (const p of year.problems.slice(0, 20)) console.error(`  INVARIANT ${p}`);
  const s74 = stats(year.times);
  console.log(`  tick (74 provinces) : moyenne ${s74.mean.toFixed(3)} ms · p95 ${s74.p95.toFixed(3)} ms · max ${s74.max.toFixed(3)} ms`);
}

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
  const pw = world.politics;
  const politicsSource = pw
    ? { characters: [...pw.characters.values()], traits: [...pw.traits.values()], strata: pw.strata, organisations: [...pw.organisations.values()], laws: [...pw.laws.values()], roles: pw.roles, politics: pw.balance, society: pw.society }
    : {};
  const mw = world.military;
  const militarySource = mw
    ? { geo: GeoSchema.parse(JSON.parse(readFileSync("data/geo/paradis.json", "utf8"))), units: [...mw.units.values()], titans: mw.titans, names: [mw.names], expeditions: mw.exp, logistics: mw.log }
    : {};
  const big = buildWorld({ provinces: [...world.provinces, ...extra], buildings: [...world.buildings.values()], scenarios: [scenario], economy: world.economy, time: world.time, ...politicsSource, ...militarySource }, scenario.id);
  const run = runYear(big);
  const s150 = stats(run.times);
  console.log(`  tick (${big.provinces.length} provinces, ${world.scenario.id}${pw ? ", politique comprise" : ""}) : moyenne ${s150.mean.toFixed(3)} ms · p95 ${s150.p95.toFixed(3)} ms · max ${s150.max.toFixed(3)} ms (budget ${BUDGET_MS} ms, 00 §6.8)`);
  if (s150.p95 > BUDGET_MS) {
    console.error(`  ÉCHEC : p95 du tick au-dessus de ${BUDGET_MS} ms.`);
    failed = true;
  }
  // AC3-12 : même monde, avec 3 expéditions et 5 convois en route (10 graines × 10 jours mesurés).
  if (big.military) {
    const busy: number[] = [];
    for (let seed = 1; seed <= 10; seed++) {
      let x = applyCommand(createInitialState(seed, big), { type: "AdvanceDays", n: 120 }, undefined, big);
      const mil = x.military;
      if (!mil) break;
      mil.depots.push({ id: "dep_bench", province: "prov_foret_arbres_geants", stocks: { food: 50, gas: 50, steel: 0 }, built: { ...x.date }, lowAlerted: false });
      for (const target of ["prov_maria_est", "prov_hameaux_est", "prov_lac_des_reflets"]) {
        const m = x.military;
        const plan = m ? standardPlan(big, m, target, "eventail", 10) : null;
        if (plan) x = applyCommand(x, { type: "LaunchExpedition", plan }, undefined, big);
      }
      for (let k = 0; k < 5; k++) x = applyCommand(x, { type: "SendConvoy", order: { depot: "dep_bench", cargo: { food: 20, gas: 10, steel: 0 }, wagons: 1, escort: 20 } }, undefined, big);
      const active = `${x.military?.expeditions.length ?? 0} expéditions, ${x.military?.convoys.length ?? 0} convois`;
      if (seed === 1) console.log(`  banc militaire : ${active} au départ (graine 1)`);
      for (let d = 0; d < 10; d++) {
        const t0 = performance.now();
        x = tickDay(x, big);
        busy.push(performance.now() - t0);
      }
    }
    const sm = stats(busy);
    console.log(`  tick (${big.provinces.length} provinces, 3 expéditions et 5 convois en route) : moyenne ${sm.mean.toFixed(3)} ms · p95 ${sm.p95.toFixed(3)} ms · max ${sm.max.toFixed(3)} ms (budget ${BUDGET_MS} ms)`);
    if (sm.p95 > BUDGET_MS) {
      console.error(`  ÉCHEC : p95 du tick militaire au-dessus de ${BUDGET_MS} ms.`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log("sim:year : OK.");
