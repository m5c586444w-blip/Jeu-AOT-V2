// npm run sim:balance [-- --n 1000 --budget 30 --campaigns 845,850,854,grondement --difficulty normal --threads 4 --no-report]
// P9.4 : parties headless par campagne, joueur type tiré par graine, en parallèle (worker_threads). Rapport : durée moyenne,
// victoires par faction, causes de mort, ressources limitantes, mortalité d'expédition, cas dégénérés, IA ; contrôle de
// déterminisme (rejeu du journal : direct et Worker). Écrit docs/reports/P9-balance.html (autonome) sauf --no-report.
import { writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { performance } from "node:perf_hooks";
import { Worker } from "node:worker_threads";
import { campaignDataFromFiles, campaignScenarioId, effectiveMods, findCampaign } from "../campaign/campaign";
import type { Campaign } from "../data/campaignSchema";
import type { DifficultyId } from "../data/campaignSchema";
import { readDataFiles } from "../data/loadNode";
import { loadWorld } from "../data/worldNode";
import { createSim } from "../sim/sim";
import type { SimResponse } from "../sim/sim";
import { SimClient } from "../workers/simClient";
import { playGame } from "./balance/game";
import type { GameResult } from "./balance/game";
import type { BalanceJob } from "./balance/worker";
import { renderHtml } from "./balance/report";
import type { CampaignSummary } from "./balance/report";

const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
};
const N = Number(arg("n", "1000"));
const BUDGET_MIN = Number(arg("budget", "30"));
const THREADS = Number(arg("threads", String(Math.max(1, cpus().length))));
const DIFF = arg("difficulty", "normal") as DifficultyId;
const CAMPAIGNS = arg("campaigns", "845,850,854,grondement").split(",").map((c) => `c${c}`);
const REPORT = !process.argv.includes("--no-report");

const camp = campaignDataFromFiles(readDataFiles("data"));
const pct = (x: number): string => `${(100 * x).toFixed(1)} %`;

/** Réservoir de fils : chaque fil reçoit des lots de graines et renvoie les résultats un par un. */
async function runPool(scenario: string, seeds: number[], onResult?: (r: GameResult) => void): Promise<GameResult[]> {
  const results: GameResult[] = [];
  const queue = [...seeds];
  const chunk = Math.max(1, Math.min(10, Math.ceil(seeds.length / (THREADS * 4))));
  await Promise.all(
    Array.from({ length: Math.min(THREADS, seeds.length) }, async () => {
      const w = new Worker(new URL("./balance/worker.boot.mjs", import.meta.url));
      try {
        while (queue.length > 0) {
          const job: BalanceJob = { scenario, seeds: queue.splice(0, chunk), keepCommands: false };
          await new Promise<void>((resolve, reject) => {
            const onMsg = (m: { ok?: boolean; done?: boolean; result?: GameResult; error?: string }): void => {
              if (m.done) {
                w.off("message", onMsg);
                resolve();
              } else if (m.ok && m.result) {
                results.push(m.result);
                onResult?.(m.result);
              } else if (m.ok === false) {
                w.off("message", onMsg);
                reject(new Error(m.error));
              }
            };
            w.on("message", onMsg);
            w.postMessage(job);
          });
        }
      } finally {
        await w.terminate();
      }
    }),
  );
  return results.sort((a, b) => a.seed - b.seed);
}

/** Déterminisme (CP9-08) : rejouer le journal d'une partie donne le même hash, en direct et dans un Worker. */
async function determinism(c: Campaign, scenario: string, seeds: number[]): Promise<{ ok: boolean; lines: string[] }> {
  const world = loadWorld("data", scenario);
  const mods = effectiveMods(camp, c.id, DIFF);
  const lines: string[] = [];
  let ok = true;
  const worker = new Worker(new URL("../workers/sim.node-worker.boot.mjs", import.meta.url));
  const client = new SimClient({ post: (m) => worker.postMessage(m), onMessage: (h) => worker.on("message", (m: SimResponse) => h(m)) });
  try {
    for (const seed of seeds) {
      const a = playGame(world, c, mods, seed, undefined, true);
      const b = playGame(world, c, mods, seed, undefined, true);
      const direct = createSim(seed, world);
      for (const cmd of a.commands) direct.dispatch(cmd);
      let last = await client.init(seed, scenario);
      for (const cmd of a.commands) last = await client.dispatch(cmd);
      const same = a.hash === b.hash && a.hash === direct.hash() && a.hash === last.hash;
      ok &&= same;
      lines.push(`graine ${seed} (${a.profile}) : partie ${a.hash} · rejouée ${b.hash} · journal direct ${direct.hash()} · journal Worker ${last.hash} · ${a.commands.length} commandes → ${same ? "identiques" : "DIFFÉRENTS"}`);
    }
  } finally {
    await worker.terminate();
  }
  return { ok, lines };
}

function summarize(c: Campaign, scenario: string, results: GameResult[], requested: number, msPerGame: number, det: { ok: boolean; lines: string[] }): CampaignSummary {
  const n = results.length;
  const wins: Record<string, number> = {};
  for (const f of c.end.factions) wins[f] = 0;
  wins["aucune"] = 0;
  const rules: Record<string, number> = {};
  const causes: Record<string, number> = {};
  const charCauses: Record<string, number> = {};
  const shortage: Record<string, number> = {};
  const limiting: Record<string, number> = {};
  const ai: Record<string, number> = {};
  const byProfile: Record<string, { n: number; win: number }> = {};
  let days = 0;
  let dep = 0;
  let dead = 0;
  const mort: number[] = [];
  let famine = 0;
  let spiral = 0;
  const famineRules: Record<string, number> = {};
  const spiralRules: Record<string, number> = {};
  const faminProfiles: Record<string, number> = {};
  const spiralProfiles: Record<string, number> = {};
  let hizuru = 0;
  let divergent = 0;
  for (const r of results) {
    const w = r.outcome.winner ?? "aucune";
    wins[w] = (wins[w] ?? 0) + 1;
    rules[r.outcome.rule] = (rules[r.outcome.rule] ?? 0) + 1;
    days += r.outcome.days;
    dep += r.stats.expDeparted;
    dead += r.stats.expDead;
    mort.push(...r.stats.expMortality);
    for (const [k, v] of Object.entries(r.stats.deathCauses)) causes[k] = (causes[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.stats.characterDeaths)) charCauses[k] = (charCauses[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.stats.shortageDays)) shortage[k] = (shortage[k] ?? 0) + v;
    const lim = Object.entries(r.stats.shortageDays).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (lim) limiting[lim[0]] = (limiting[lim[0]] ?? 0) + 1;
    for (const [k, v] of Object.entries(r.stats.ai)) ai[k] = (ai[k] ?? 0) + v;
    const bp = (byProfile[r.profile] ??= { n: 0, win: 0 });
    bp.n++;
    if (r.outcome.winner === c.nations[0]) bp.win++;
    if (r.stats.foodEmptyMax >= 30) {
      famine++;
      famineRules[r.outcome.rule] = (famineRules[r.outcome.rule] ?? 0) + 1;
      faminProfiles[r.profile] = (faminProfiles[r.profile] ?? 0) + 1;
    }
    if (r.stats.popRatio < 0.7 && r.stats.legitimacy < 25) {
      spiral++;
      spiralRules[r.outcome.rule] = (spiralRules[r.outcome.rule] ?? 0) + 1;
      spiralProfiles[r.profile] = (spiralProfiles[r.profile] ?? 0) + 1;
    }
    if (r.stats.hizuruSwitches > 0) hizuru++;
    if (r.stats.branch === "divergente") divergent++;
  }
  const mean = (xs: number[]): number => (xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length);
  const deadline = results.filter((r) => r.outcome.score !== null).map((r) => r.outcome.score as number).sort((a, b) => a - b);
  return {
    id: c.id,
    scenario,
    nameKey: c.name_key,
    requested,
    played: n,
    msPerGame,
    meanDays: n ? days / n : 0,
    wins,
    rules,
    causes,
    charCauses,
    shortage,
    limiting,
    ai,
    byProfile,
    expeditions: results.reduce((a, r) => a + r.stats.expeditions, 0),
    expPooled: dep > 0 ? dead / dep : NaN,
    expMean: mean(mort),
    expPerGame: mort,
    famine,
    spiral,
    famineRules,
    spiralRules,
    faminProfiles,
    spiralProfiles,
    hizuru,
    divergent,
    meanScore: mean(results.map((r) => r.stats.score)),
    deadlineQ: deadline.length ? [0.1, 0.25, 0.5, 0.75, 0.9].map((q) => deadline[Math.min(deadline.length - 1, Math.round(q * (deadline.length - 1)))] ?? NaN) : null,
    deadlineCount: deadline.length,
    parts: Object.fromEntries(Object.keys(results[0]?.stats.scoreParts ?? {}).map((k) => [k, mean(results.map((r) => r.stats.scoreParts[k] ?? 0))])),
    threshold: c.end.deadline.threshold + effectiveMods(camp, c.id, DIFF).score_threshold_delta,
    determinism: det,
  };
}

const t0 = performance.now();
const summaries: CampaignSummary[] = [];
let failed = false;
console.log(`sim:balance : ${N} parties demandées par campagne, budget ${BUDGET_MIN} min par campagne, ${THREADS} fils, difficulté ${DIFF}.`);
for (const cid of CAMPAIGNS) {
  const c = findCampaign(camp, cid);
  if (!c) throw new Error(`campagne inconnue : ${cid}`);
  const scenario = campaignScenarioId(c.id, DIFF);
  // Essai : 2 parties par fil pour mesurer la durée d'une partie, puis le plus grand nombre qui tient dans le budget.
  const pilotSeeds = Array.from({ length: Math.min(N, THREADS * 2) }, (_, i) => i + 1);
  const tp = performance.now();
  const pilot = await runPool(scenario, pilotSeeds);
  const wall = performance.now() - tp;
  const msPerGame = pilot.reduce((a, r) => a + r.ms, 0) / Math.max(1, pilot.length);
  const fit = Math.floor((BUDGET_MIN * 60000 * 0.92) / Math.max(1, wall / pilotSeeds.length));
  const target = Math.min(N, Math.max(pilotSeeds.length, fit));
  console.log(`[${c.id}] essai : ${pilot.length} parties en ${(wall / 1000).toFixed(1)} s (${(msPerGame / 1000).toFixed(2)} s par partie et par fil) → ${target} parties${target < N ? ` (budget de ${BUDGET_MIN} min : écart de ${N - target} sur ${N})` : ""}`);
  const rest = Array.from({ length: target - pilotSeeds.length }, (_, i) => pilotSeeds.length + i + 1);
  let done = pilot.length;
  const results = [...pilot, ...(await runPool(scenario, rest, () => {
    done++;
    if (done % 100 === 0) console.log(`[${c.id}]   ${done}/${target}`);
  }))].sort((a, b) => a.seed - b.seed);
  const det = await determinism(c, scenario, [1, 2, 3]);
  const s = summarize(c, scenario, results, N, msPerGame, det);
  summaries.push(s);
  const total = s.played;
  console.log(`[${c.id}] ${total} parties · durée moyenne ${s.meanDays.toFixed(0)} jours de jeu · score moyen ${s.meanScore.toFixed(3)}`);
  console.log(`  victoires : ${Object.entries(s.wins).map(([f, v]) => `${f} ${pct(v / total)}`).join(" · ")}`);
  console.log(`  fins : ${Object.entries(s.rules).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  console.log(`  score à l'échéance (${s.deadlineCount} parties, seuil ${s.threshold.toFixed(2)}) : ${s.deadlineQ ? `p10 ${s.deadlineQ[0]?.toFixed(3)} · p25 ${s.deadlineQ[1]?.toFixed(3)} · médiane ${s.deadlineQ[2]?.toFixed(3)} · p75 ${s.deadlineQ[3]?.toFixed(3)} · p90 ${s.deadlineQ[4]?.toFixed(3)}` : "—"} ; composantes : ${Object.entries(s.parts).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(" · ")}`);
  console.log(`  joueur type (victoires de ${c.nations[0]}) : ${Object.entries(s.byProfile).map(([k, v]) => `${k} ${v.win}/${v.n}`).join(" · ")}`);
  console.log(`  expéditions : ${s.expeditions} · mortalité moyenne ${Number.isNaN(s.expMean) ? "—" : pct(s.expMean)} · cumulée ${Number.isNaN(s.expPooled) ? "—" : pct(s.expPooled)}`);
  console.log(`  causes de mort (expéditions) : ${Object.entries(s.causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"} ; personnages : ${Object.entries(s.charCauses).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"}`);
  console.log(`  ressources limitantes (parties où elle est la plus longtemps sous 5 % du départ) : ${Object.entries(s.limiting).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ") || "aucune"}`);
  console.log(`  cas dégénérés : famine ≥ 30 jours ${s.famine} (${pct(s.famine / total)}) · spirale de mort ${s.spiral} (${pct(s.spiral / total)})`);
  console.log(`  IA : ${Object.entries(s.ai).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${(v / total).toFixed(2)}/partie`).join(" · ") || "—"} · bascules d'Hizuru dans ${s.hizuru} parties · branche divergente ${s.divergent}`);
  for (const l of det.lines) console.log(`  déterminisme : ${l}`);
  if (!det.ok) failed = true;
}

// Critères (CP9-05 à CP9-08).
const allMort = summaries.flatMap((s) => s.expPerGame);
const mortMean = allMort.reduce((a, b) => a + b, 0) / Math.max(1, allMort.length);
console.log("Critères :");
for (const s of summaries) {
  const top = Object.entries(s.wins).filter(([f]) => f !== "aucune").sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];
  const ok = top[1] / s.played <= 0.7;
  console.log(`  ${ok ? "OK" : "KO"}  ${s.id} : faction la plus victorieuse ${top[0]} ${pct(top[1] / s.played)} (≤ 70 %)`);
  if (!ok) failed = true;
}
const mortOk = mortMean >= 0.25 && mortMean <= 0.4;
console.log(`  ${mortOk ? "OK" : "KO"}  mortalité d'expédition moyenne ${pct(mortMean)} sur ${allMort.length} expéditions (25–40 %)`);
if (!mortOk) failed = true;
const detOk = summaries.every((s) => s.determinism.ok);
console.log(`  ${detOk ? "OK" : "KO"}  déterminisme : même graine et mêmes commandes = même hash (${summaries.length * 3} rejeux directs et Worker)`);
if (REPORT) {
  writeFileSync("docs/reports/P9-balance.html", renderHtml(summaries, { n: N, budgetMin: BUDGET_MIN, threads: THREADS, difficulty: DIFF, mortMean, mortCount: allMort.length, minutes: (performance.now() - t0) / 60000 }));
  console.log("  rapport : docs/reports/P9-balance.html");
}
console.log(`sim:balance : ${failed ? "ÉCHEC" : "OK"} (${((performance.now() - t0) / 60000).toFixed(1)} min).`);
if (failed) process.exitCode = 1;
