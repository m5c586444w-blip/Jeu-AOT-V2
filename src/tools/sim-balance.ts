// npm run sim:balance — P9.5 (00 §9, 05 §5 et §9.4) : N parties sans interface par scénario, menées par un pilote automatique
// qui ne passe que des commandes ; rapport : durée, victoires par camp, causes de mort, ressources limitantes, cas dégénérés.
// Options : --parties N (1000), --scenarios a,b:camp (les quatre du menu, 854 mené par Paradis puis par Marley), --fils K,
// --graine G (première graine, 1), --sortie chemin (docs/reports/P9-balance : .json et .html).
import { writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import { loadWorld } from "../data/worldNode";
import type { GameResult } from "./balance/game";
import { isFamine, isSpiral, aggregate } from "./balance/stats";
import type { ScenarioStats } from "./balance/stats";
import { renderHtml } from "./balance/report";
import type { BalanceReport, Criterion } from "./balance/report";
import type { BalanceJob } from "./balance/worker";

const args = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? (args[i + 1] as string) : def;
};
const PARTIES = Math.max(1, Number(opt("parties", "1000")));
const SEED0 = Number(opt("graine", "1"));
const THREADS = Math.max(1, Number(opt("fils", String(Math.min(4, availableParallelism())))));
const OUT = opt("sortie", "docs/reports/P9-balance");
const DIR = "data";
const BATCHES = opt("scenarios", "scn_845,scn_sandbox_850,scn_854,scn_854:fac_marley,scn_grondement").split(",").map((x) => {
  const [scenario, camp] = x.split(":");
  return { scenario: scenario as string, camp: camp ?? null };
});
const CHUNK = 5;
/** Parties brutes (une par ligne, JSON) pour l'analyse, si demandé. */
const RAW = opt("brut", "");

/** Profils dont le comportement explique un motif dégénéré sans que la règle soit en cause (ils négligent le levier). */
const NEGLECT = new Set(["passif", "aleatoire"]);

async function runBatch(scenario: string, camp: string): Promise<GameResult[]> {
  const seeds = Array.from({ length: PARTIES }, (_, i) => SEED0 + i);
  const queue: number[][] = [];
  for (let i = 0; i < seeds.length; i += CHUNK) queue.push(seeds.slice(i, i + CHUNK));
  const results: GameResult[] = [];
  let done = 0;
  const started = Date.now();
  const n = Math.min(THREADS, queue.length);
  await Promise.all(
    Array.from({ length: n }, () =>
      new Promise<void>((resolve, reject) => {
        const w = new Worker(new URL("./balance/worker.boot.mjs", import.meta.url));
        const next = (): void => {
          const s = queue.shift();
          if (!s) {
            w.postMessage(null);
            return;
          }
          const job: BalanceJob = { dir: DIR, scenario, camp, seeds: s };
          w.postMessage(job);
        };
        w.on("message", (out: GameResult[]) => {
          results.push(...out);
          done += out.length;
          if (done % 50 < CHUNK) process.stdout.write(`\r  ${scenario} (${camp}) : ${done}/${PARTIES} parties, ${((Date.now() - started) / 1000).toFixed(0)} s`);
          next();
        });
        w.on("error", reject);
        w.on("exit", () => resolve());
        next();
      }),
    ),
  );
  process.stdout.write("\n");
  return results.sort((a, b) => a.seed - b.seed);
}

function explain(s: ScenarioStats, games: readonly GameResult[]): void {
  for (const [label, pred] of [["famine systématique", isFamine], ["spirale de mort", isSpiral]] as const) {
    const hit = games.filter(pred);
    if (hit.length === 0) continue;
    const neglect = hit.filter((g) => NEGLECT.has(g.profile)).length;
    const byProfile = Object.entries(hit.reduce<Record<string, number>>((a, g) => ({ ...a, [g.profile]: (a[g.profile] ?? 0) + 1 }), {})).map(([p, v]) => `${p} ${v}`).join(", ");
    const ok = neglect / hit.length >= 0.8;
    s.degenerate.explained.push(`${label} : ${hit.length} partie(s) (${byProfile}) — ${ok ? "expliqué : profils qui négligent le levier (aucun rationnement, ordres au hasard) ; un joueur attentif l'évite" : "NON expliqué : le motif touche aussi des profils attentifs"}`);
  }
}

const allStats: ScenarioStats[] = [];
let failures = 0;
for (const b of BATCHES) {
  const w = loadWorld(DIR, b.scenario);
  const camp = b.camp ?? (w.scenario.faction.startsWith("fac_") ? w.scenario.faction : `fac_${w.scenario.faction}`);
  const empty = new Set(Object.entries(w.scenario.stocks).filter(([, v]) => v <= 0).map(([k]) => k));
  const games = await runBatch(b.scenario, camp);
  if (RAW) writeFileSync(`${RAW}-${b.scenario}-${camp}.jsonl`, games.map((g) => JSON.stringify(g)).join("\n") + "\n");
  const s = aggregate(games, empty);
  explain(s, games);
  allStats.push(s);
  const camps = s.camps.map((c) => `${c.camp} : victoire ${((c.outcomes["victoire"]?.share ?? 0) * 100).toFixed(1)} %, terme ${((c.outcomes["terme"]?.share ?? 0) * 100).toFixed(1)} %, défaite ${((c.outcomes["defaite"]?.share ?? 0) * 100).toFixed(1)} %`).join(" | ");
  console.log(`[${b.scenario} / ${camp}] ${games.length} parties · durée moyenne ${s.duration.mean.toFixed(0)} j · ${camps}`);
  console.log(`  expéditions : ${s.expeditions.launched} · mortalité ${s.expeditions.mortality === null ? "—" : `${(s.expeditions.mortality * 100).toFixed(1)} %`} · famine systématique ${s.degenerate.famine.n} · spirale ${s.degenerate.spiral.n} · limitante : ${Object.entries(s.limiting).slice(0, 3).map(([k, v]) => `${k} ${(v.share * 100).toFixed(0)} %`).join(", ")}`);
  const bp = s.camps[0]?.byProfile ?? {};
  console.log(`  par profil (${camp}) : ${Object.entries(bp).filter(([, v]) => v.games > 0).map(([p, v]) => `${p} ${((v.victoire / v.games) * 100).toFixed(0)} % de victoires (${v.games})`).join(" · ")}`);
  for (const x of s.degenerate.explained) console.log(`  ${x}`);
  if (s.errors.length) console.log(`  erreurs : ${s.errors.join(" ; ")}`);
}

// Critères (P9 : CP9-03 à CP9-06).
const unfinished = allStats.reduce((a, s) => a + (s.camps[0]?.outcomes["en_cours"]?.n ?? 0), 0);
const errors = allStats.reduce((a, s) => a + s.errors.length, 0);
const over = allStats.flatMap((s) => s.camps.filter((c) => (c.outcomes["victoire"]?.share ?? 0) > 0.7).map((c) => `${s.scenario}/${c.camp} ${((c.outcomes["victoire"]?.share ?? 0) * 100).toFixed(1)} %`));
const unexplained = allStats.flatMap((s) => s.degenerate.explained.filter((x) => x.includes("NON expliqué")).map((x) => `${s.scenario} : ${x.split(" :")[0]}`));
const dep = allStats.reduce((a, s) => a + s.expeditions.departed, 0);
const dead = allStats.reduce((a, s) => a + s.expeditions.dead, 0);
const mortality = dep > 0 ? dead / dep : null;
const criteria: Criterion[] = [
  { id: "CP9-03", label: "chaque partie atteint une fin, sans erreur", ok: unfinished === 0 && errors === 0, detail: `${unfinished} partie(s) inachevée(s), ${errors} erreur(s)` },
  { id: "CP9-04", label: "aucune faction au-dessus de 70 % de victoires", ok: over.length === 0, detail: over.length ? over.join(" ; ") : "toutes ≤ 70 %" },
  { id: "CP9-05", label: "aucun cycle dégénéré non expliqué", ok: unexplained.length === 0, detail: unexplained.length ? unexplained.join(" ; ") : "aucun, ou tous expliqués" },
  { id: "CP9-06", label: "mortalité d'expédition 25–40 %", ok: mortality !== null && mortality >= 0.25 && mortality <= 0.4, detail: mortality === null ? "aucune expédition" : `${(mortality * 100).toFixed(1)} % (${dead} morts sur ${dep} partis)` },
];
for (const c of criteria) {
  console.log(`${c.ok ? "OK" : "KO"}  ${c.id} ${c.label} : ${c.detail}`);
  if (!c.ok) failures++;
}
const report: BalanceReport = { generated: new Date().toISOString().slice(0, 10), parties: PARTIES, seedBase: SEED0, difficulty: "normal", scenarios: allStats, criteria };
writeFileSync(`${OUT}.json`, JSON.stringify(report, null, 1) + "\n");
writeFileSync(`${OUT}.html`, renderHtml(report));
console.log(`sim:balance : rapport ${OUT}.html et ${OUT}.json ; ${failures === 0 ? "tous les critères OK" : `${failures} critère(s) KO`}.`);
process.exitCode = failures === 0 ? 0 : 1;
