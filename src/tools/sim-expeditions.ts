// npm run sim:expeditions — AC3-07 : 100 expéditions types sans crash, distribution des pertes (02 §15, 03 §12).
// Expédition type [A] : reconnaissance de Maria-Est depuis Karanes, scénario 850, 20 escouades, au 121ᵉ jour.
// Options : --n 100 (nombre de tirages), --target prov_maria_est, --squads 20, --quiet.
import { loadWorld } from "../data/worldNode";
import { applyCommand } from "../sim/core/commands";
import { createInitialState } from "../sim/core/state";
import type { GameState } from "../sim/core/state";
import { standardPlan } from "../sim/military/plan";
import type { ExpeditionReport } from "../sim/military/state";
import type { Formation } from "../sim/military/vocabulary";

const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
};
const N = Number(arg("n", "100"));
const TARGET = arg("target", "prov_maria_est");
const SQUADS = Number(arg("squads", "20"));
const world = loadWorld("data", "scn_sandbox_850");

interface Run {
  report: ExpeditionReport;
  mortality: number;
}

function one(seed: number, formation: Formation): Run {
  let s: GameState = applyCommand(createInitialState(seed, world), { type: "AdvanceDays", n: 120 }, undefined, world);
  if (!s.military) throw new Error("couche militaire absente");
  const plan = standardPlan(world, s.military, TARGET, formation, SQUADS);
  if (!plan) throw new Error(`aucun itinéraire vers ${TARGET}`);
  s = applyCommand(s, { type: "LaunchExpedition", plan }, undefined, world);
  for (let d = 0; d < 80 && (s.military?.expeditions.length ?? 0) > 0; d++) s = applyCommand(s, { type: "AdvanceDays", n: 1 }, undefined, world);
  const report = s.military?.reports.at(-1);
  if (!report || (s.military?.expeditions.length ?? 0) > 0) throw new Error(`graine ${seed} : expédition non rentrée`);
  return { report, mortality: (100 * report.dead.length) / report.stats.departed };
}

const q = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))] ?? NaN;
const f1 = (v: number): string => v.toFixed(1);

function series(formation: Formation): { runs: Run[]; crashes: string[] } {
  const runs: Run[] = [];
  const crashes: string[] = [];
  for (let seed = 1; seed <= N; seed++) {
    try {
      runs.push(one(seed, formation));
    } catch (e) {
      crashes.push(`graine ${seed} : ${(e as Error).message}`);
    }
  }
  return { runs, crashes };
}

function describe(formation: Formation, runs: Run[]): { mean: number; median: number; p10: number; p90: number; max: number } {
  const m = runs.map((r) => r.mortality).sort((a, b) => a - b);
  const mean = m.reduce((a, b) => a + b, 0) / Math.max(1, m.length);
  const stats = { mean, median: q(m, 0.5), p10: q(m, 0.1), p90: q(m, 0.9), max: m[m.length - 1] ?? NaN };
  const reached = runs.filter((r) => r.report.outcome !== "echec").length;
  const days = runs.reduce((a, r) => a + r.report.days, 0) / Math.max(1, runs.length);
  const retreats = runs.filter((r) => r.report.retreat).length;
  const engagements = runs.reduce((a, r) => a + r.report.stats.engagements, 0) / Math.max(1, runs.length);
  const causes: Record<string, number> = {};
  for (const r of runs) for (const [k, v] of Object.entries(r.report.stats.deathsByCause)) causes[k] = (causes[k] ?? 0) + (v ?? 0);
  console.log(`[${formation}] ${runs.length} expéditions vers ${TARGET} (${SQUADS} escouades)`);
  console.log(`  mortalité : moyenne ${f1(stats.mean)} % · médiane ${f1(stats.median)} % · p10 ${f1(stats.p10)} % · p90 ${f1(stats.p90)} % · min ${f1(m[0] ?? NaN)} % · max ${f1(stats.max)} %`);
  const buckets = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((lo) => m.filter((v) => v >= lo && (lo === 90 ? v <= 100 : v < lo + 10)).length);
  console.log(`  histogramme (tranches de 10 %) : ${buckets.map((b, i) => `${i * 10}–${i * 10 + 10} : ${b}`).join(" · ")}`);
  console.log(`  objectif atteint ${reached}/${runs.length} · retraits ${retreats} · durée moyenne ${f1(days)} j · engagements moyens ${f1(engagements)}`);
  console.log(`  causes : ${Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  return stats;
}

const fan = series("eventail");
const col = series("colonnes");
const sFan = describe("eventail", fan.runs);
const sCol = describe("colonnes", col.runs);

const failures: string[] = [];
const check = (ok: boolean, label: string): void => {
  console.log(`  ${ok ? "OK" : "KO"}  ${label}`);
  if (!ok) failures.push(label);
};
console.log("Critères AC3-07 (expédition type : éventail) :");
check(fan.crashes.length === 0 && col.crashes.length === 0 && fan.runs.length === N, `${N} expéditions sans crash (et ${col.runs.length} en colonnes)${[...fan.crashes, ...col.crashes].length ? ` — ${[...fan.crashes, ...col.crashes].slice(0, 3).join(" | ")}` : ""}`);
check(sFan.mean >= 25 && sFan.mean <= 40, `mortalité moyenne dans [25 %, 40 %] (02 §15) : ${f1(sFan.mean)} %`);
check(sFan.p90 - sFan.p10 >= 20, `distribution large : p90 − p10 = ${f1(sFan.p90 - sFan.p10)} points (≥ 20)`);
check(sFan.max >= 1.5 * sFan.median, `queue épaisse : max ${f1(sFan.max)} % ≥ 1,5 × médiane (${f1(1.5 * sFan.median)} %)`);
console.log("Contrôle de cohérence (AC3-06) :");
check(sFan.mean < sCol.mean, `l'éventail perd moins que les colonnes (${f1(sFan.mean)} % < ${f1(sCol.mean)} %)`);

if (failures.length > 0) {
  console.error(`sim:expeditions : ${failures.length} échec(s).`);
  process.exit(1);
}
console.log("sim:expeditions : OK.");
