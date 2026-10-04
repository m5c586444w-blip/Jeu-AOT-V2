// npm run sim:tactical — AC4-07 et AC4-08 : batailles headless, journal des morts, cohérence avec l'auto-résolution.
// Pour chacun des 6 engagements types (`coherence` de data/balance/tactical.json : 3 classes × 2 terrains, 12 contre 1),
// N batailles laissées à l'IA (graines 1…N) contre l'auto-résolution de P3 sur les mêmes configurations (4 tirages par graine).
// Critère : |pertes moyennes jouées − auto| ≤ 15 % de l'auto (D-60 : N = 1 000).
// --bench : AC4-09, pas de simulation avec 300 unités (sans rendu), p95 < 5 ms.
// Options : --n 1000, --from 1 (première graine), --bench, --steps 1200.
import { loadWorld } from "../data/worldNode";
import { autoResolveDeaths } from "../sim/tactical/autoresolve";
import { createBattle, runBattle, stepBattle } from "../sim/tactical/battle";
import { skirmishSetup } from "../sim/tactical/setup";
import type { BattleResult } from "../sim/tactical/battle";

const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
};
const N = Number(arg("n", "1000"));
const FROM = Number(arg("from", "1"));
const AUTO_DRAWS = 4;
const TOLERANCE = 0.15;
const world = loadWorld("data", "scn_sandbox_850");
const twMaybe = world.tactical;
if (!twMaybe) throw new Error("monde tactique absent");
const tw = twMaybe;
const failures: string[] = [];
const f2 = (v: number): string => v.toFixed(2);

/** AC4-07 : chaque mort a son entrée de journal (nom, escouade) et un dossier complet (heure, cause, lieu ; Titan sauf hémorragie et chute). */
function deathProblems(r: BattleResult): string[] {
  const out: string[] = [];
  for (const s of r.dead) {
    const d = s.death;
    if (!d || !Number.isFinite(d.t) || !Number.isFinite(d.x) || !Number.isFinite(d.y)) out.push(`${s.id} : dossier incomplet`);
    else if ((d.cause === "frappe" || d.cause === "devore") && d.titan === null) out.push(`${s.id} : Titan manquant`);
    const line = r.state.log.find((l) => l.key === `battle.death.${d?.cause ?? ""}` && l.params["name"] === s.name && l.params["squad"] === s.squad);
    if (!line) out.push(`${s.id} : aucune ligne de journal`);
  }
  return out;
}

function bench(): void {
  const steps = Number(arg("steps", "1200"));
  // 280 soldats et 20 Titans : 5 de chacun de 4 types de classes différentes.
  const titans = [...tw.titanTypes.values()].filter((t, i, all) => all.findIndex((u) => u.class === t.class) === i).slice(0, 4).map((t) => ({ type: t.id, count: 5 }));
  const setup = skirmishSetup(world, "tmap_ville", titans, 280, 7);
  const bt = createBattle(world, setup);
  const units = bt.state.soldiers.length + bt.state.titans.length;
  // Échauffement (compilation JIT), puis mesure pas par pas.
  const warm = createBattle(world, setup);
  for (let i = 0; i < 100; i++) stepBattle(warm, []);
  const times: number[] = [];
  for (let i = 0; i < steps && !bt.state.ended; i++) {
    const t0 = performance.now();
    stepBattle(bt, []);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const p = (q: number): number => times[Math.min(times.length - 1, Math.floor(q * times.length))] ?? NaN;
  const dead = bt.state.soldiers.filter((s) => s.mode === "mort").length;
  console.log(`Banc : ${units} unités (${bt.state.soldiers.length} soldats, ${bt.state.titans.length} Titans), carte Ville, ${times.length} pas de 50 ms`);
  console.log(`  pas de simulation : médiane ${f2(p(0.5))} ms · p95 ${f2(p(0.95))} ms · max ${f2(times[times.length - 1] ?? NaN)} ms (${dead} morts, Titans abattus ${bt.state.stats.napes})`);
  if (!(p(0.95) < 5)) failures.push(`p95 ${f2(p(0.95))} ms ≥ 5 ms`);
  console.log(`${p(0.95) < 5 ? "  OK " : "  KO "} AC4-09 : p95 < 5 ms avec ${units} unités`);
}

function coherence(): void {
  console.log(`Cohérence (AC4-08) : ${tw.balance.coherence.length} engagements types × ${N} batailles (graines ${FROM}–${FROM + N - 1}), auto-résolution : ${AUTO_DRAWS} tirages par graine`);
  console.log("  type             jouée   auto    écart   victoires  durée moy.  morts/bataille (min–max)");
  let deaths = 0;
  let logged = 0;
  const started = performance.now();
  for (const c of tw.balance.coherence) {
    let played = 0;
    let auto = 0;
    let wins = 0;
    let dur = 0;
    let lo = Infinity;
    let hi = 0;
    for (let seed = FROM; seed < FROM + N; seed++) {
      const setup = skirmishSetup(world, c.map, [{ type: c.titan, count: c.count }], c.soldiers, seed);
      let r: BattleResult;
      try {
        r = runBattle(world, setup);
      } catch (e) {
        failures.push(`${c.id} graine ${seed} : ${(e as Error).message}`);
        continue;
      }
      const d = r.dead.length;
      played += d;
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
      wins += r.state.ended?.reason === "victoire" ? 1 : 0;
      dur += r.state.tick / tw.balance.tick_hz;
      const probs = deathProblems(r);
      deaths += d;
      logged += d - probs.length;
      if (probs.length) failures.push(`${c.id} graine ${seed} : ${probs.slice(0, 3).join(" ; ")}`);
      for (let k = 0; k < AUTO_DRAWS; k++) auto += autoResolveDeaths(world, setup, seed * 10 + k) / AUTO_DRAWS;
    }
    const mp = played / N;
    const ma = auto / N;
    const gap = ma > 0 ? (mp - ma) / ma : mp === 0 ? 0 : Infinity;
    const ok = Math.abs(gap) <= TOLERANCE;
    if (!ok) failures.push(`${c.id} : écart ${(100 * gap).toFixed(1)} %`);
    console.log(`  ${c.id.padEnd(16)} ${f2(mp).padStart(5)}   ${f2(ma).padStart(5)}  ${`${gap >= 0 ? "+" : ""}${(100 * gap).toFixed(1)} %`.padStart(7)}   ${`${((100 * wins) / N).toFixed(0)} %`.padStart(6)}     ${`${(dur / N).toFixed(0)} s`.padStart(6)}      ${lo}–${hi}  ${ok ? "OK" : "KO"}`);
  }
  console.log(`  ${tw.balance.coherence.length * N} batailles en ${((performance.now() - started) / 1000).toFixed(0)} s`);
  console.log(`${logged === deaths ? "  OK " : "  KO "} AC4-07 : ${logged}/${deaths} morts avec ligne de journal et dossier (heure, nom, escouade, cause, Titan, lieu)`);
}

if (process.argv.includes("--bench")) bench();
else coherence();
if (failures.length) {
  console.error(`ÉCHEC (${failures.length}) :\n  ${failures.slice(0, 20).join("\n  ")}`);
  process.exit(1);
}
console.log("sim:tactical : tout est conforme.");
