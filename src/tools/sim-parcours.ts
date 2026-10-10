// npm run sim:parcours — P10.2 (CP10-03) : parcours complet de cinq ans du scénario 850, joué par commandes enregistrées.
// 1. Enregistrement : le pilote de sim:balance (profil militaire, le plus riche en ordres) joue cinq ans ; chaque commande
//    passée (ordres et avances du temps) est consignée.
// 2. Rejeu continu des commandes enregistrées : même empreinte que l'enregistrement (les commandes suffisent à refaire la partie).
// 3. Rejeu avec, à chaque année : sauvegarde, relecture du texte, version vérifiée, chaîne de migrations rejouée (v4 → v8 sur
//    la sauvegarde : contenu identique), chargement, nouvelle sauvegarde identique octet pour octet ; la partie reprend depuis
//    l'état chargé. Même empreinte finale qu'en continu ; aucun blocage (le temps avance, aucune erreur, invariants tenus).
// Option : --sortie chemin (écrit les commandes enregistrées en JSON, pour les rejouer ailleurs).
import { writeFileSync } from "node:fs";
import { loadWorld } from "../data/worldNode";
import { stateHash } from "../sim/core/canonical";
import { applyCommand } from "../sim/core/commands";
import type { Command } from "../sim/core/commands";
import { deserialize, migrate, serialize } from "../sim/core/serialize";
import { CURRENT_SCHEMA_VERSION, createInitialState } from "../sim/core/state";
import type { GameState } from "../sim/core/state";
import { toAbsoluteDay } from "../sim/core/time";
import { evaluateEnding } from "../sim/ending/ending";
import { RESOURCE_IDS } from "../sim/strategic/resources";
import type { World } from "../sim/strategic/world";
import { decide, makePilot } from "./balance/autopilot";
import { STEP } from "./balance/game";

const SCENARIO = "scn_sandbox_850";
const YEARS = 5;
const DAYS_PER_YEAR = 360;
const args = process.argv.slice(2);
const outIndex = args.indexOf("--sortie");
const OUT = outIndex >= 0 ? (args[outIndex + 1] ?? "") : "";

/** Première graine dont le pilote tiré est militaire (missions, expéditions, levées, lois, diplomatie). */
function militarySeed(): number {
  for (let seed = 1; seed < 1000; seed++) if (makePilot(seed).profile === "militaire") return seed;
  throw new Error("aucune graine militaire");
}

interface Run {
  state: GameState;
  refused: number;
  problems: string[];
}

/** Invariants de fin d'année : stocks et populations finis et positifs, moral et stabilité bornés. */
function invariants(s: GameState): string[] {
  const out: string[] = [];
  const st = s.strategic;
  if (!st) return ["pas d'état stratégique"];
  for (const r of RESOURCE_IDS) if (!Number.isFinite(st.stocks[r]) || st.stocks[r] < 0) out.push(`${r} = ${st.stocks[r]}`);
  for (const [id, p] of Object.entries(st.provinces)) {
    if (!Number.isFinite(p.population) || p.population < 0) out.push(`${id}.population = ${p.population}`);
    if (!(p.morale >= 0 && p.morale <= 100) || !(p.stability >= 0 && p.stability <= 100)) out.push(`${id} : moral ou stabilité hors bornes`);
  }
  return out;
}

function send(s: GameState, c: Command, w: World): { state: GameState; refused: boolean } {
  try {
    return { state: applyCommand(s, c, undefined, w), refused: false };
  } catch {
    return { state: s, refused: true };
  }
}

/** Enregistrement : le pilote décide tous les dix jours ; les commandes sont gardées dans l'ordre. */
function record(w: World, seed: number): { log: Command[]; run: Run } {
  const pilot = makePilot(seed);
  let s = createInitialState(seed, w);
  const log: Command[] = [];
  let refused = 0;
  for (let d = 0; d < YEARS * DAYS_PER_YEAR; d += STEP) {
    for (const c of [...decide(pilot, w, s, STEP), { type: "AdvanceDays", n: STEP } as Command]) {
      log.push(c);
      const r = send(s, c, w);
      s = r.state;
      if (r.refused) refused += 1;
    }
  }
  return { log, run: { state: s, refused, problems: [] } };
}

/** Sauvegarde, migration et chargement vérifiés ; renvoie l'état chargé (celui dont la partie repart). */
function saveLoad(s: GameState, problems: string[], label: string): GameState {
  const text = serialize(s);
  const raw = JSON.parse(text) as Record<string, unknown>;
  if (raw["schemaVersion"] !== CURRENT_SCHEMA_VERSION) problems.push(`${label} : version ${String(raw["schemaVersion"])} au lieu de ${CURRENT_SCHEMA_VERSION}`);
  // Chaîne de migrations rejouée depuis la version 4 sur une sauvegarde complète : aucune donnée perdue ni changée.
  const migrated = migrate({ ...raw, schemaVersion: 4 });
  if (JSON.stringify(migrated) !== JSON.stringify(raw)) problems.push(`${label} : la chaîne de migrations v4 → v${CURRENT_SCHEMA_VERSION} change la sauvegarde`);
  const loaded = deserialize(text);
  if (serialize(loaded) !== text) problems.push(`${label} : la sauvegarde rechargée diffère`);
  if (stateHash(loaded) !== stateHash(s)) problems.push(`${label} : empreinte changée au chargement`);
  return loaded;
}

/** Rejeu des commandes enregistrées ; avec `yearly`, sauvegarde et chargement à chaque fin d'année. */
function replay(w: World, seed: number, log: readonly Command[], yearly: boolean): Run & { years: string[] } {
  let s = createInitialState(seed, w);
  const start = toAbsoluteDay(s.date);
  let refused = 0;
  const problems: string[] = [];
  const years: string[] = [];
  let nextYear = start + DAYS_PER_YEAR;
  for (const c of log) {
    const before = toAbsoluteDay(s.date);
    const r = send(s, c, w);
    s = r.state;
    if (r.refused) refused += 1;
    const now = toAbsoluteDay(s.date);
    if (c.type === "AdvanceDays" && now !== before + c.n) problems.push(`blocage : le temps n'avance pas (an ${s.date.year}, jour ${s.date.day})`);
    if (now >= nextYear) {
      const n = (nextYear - start) / DAYS_PER_YEAR;
      for (const p of invariants(s)) problems.push(`année ${n} : ${p}`);
      if (yearly) s = saveLoad(s, problems, `année ${n}`);
      const e = evaluateEnding(w, s);
      years.push(`année ${n} (an ${s.date.year}, jour ${s.date.day}) : empreinte ${stateHash(s)} · sauvegarde ${(serialize(s).length / 1024).toFixed(0)} Kio · fin : ${e?.state ?? "—"} · ordres refusés jusque-là ${refused}`);
      nextYear += DAYS_PER_YEAR;
    }
  }
  return { state: s, refused, problems, years };
}

const w = loadWorld("data", SCENARIO);
const seed = militarySeed();
const t0 = Date.now();
const rec = record(w, seed);
const orders = rec.log.filter((c) => c.type !== "AdvanceDays");
const byType = orders.reduce<Record<string, number>>((a, c) => ({ ...a, [c.type]: (a[c.type] ?? 0) + 1 }), {});
console.log(`sim:parcours : ${SCENARIO}, graine ${seed} (pilote ${makePilot(seed).profile}), ${YEARS} ans de ${DAYS_PER_YEAR} jours`);
console.log(`  enregistrement : ${rec.log.length} commandes (${orders.length} ordres, ${rec.log.length - orders.length} avances de ${STEP} jours) ; ${rec.run.refused} ordre(s) refusé(s) par la simulation`);
console.log(`  ordres : ${Object.entries(byType).sort(([, a], [, b]) => b - a).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
if (OUT) {
  writeFileSync(OUT, JSON.stringify({ scenario: SCENARIO, seed, commands: rec.log }) + "\n");
  console.log(`  commandes écrites dans ${OUT}`);
}
const continuous = replay(w, seed, rec.log, false);
const saved = replay(w, seed, rec.log, true);
for (const y of saved.years) console.log(`  ${y}`);
const hRec = stateHash(rec.run.state);
const hCont = stateHash(continuous.state);
const hSaved = stateHash(saved.state);
const checks: [string, boolean, string][] = [
  ["rejeu continu = enregistrement", hCont === hRec && continuous.refused === rec.run.refused, `${hCont} / ${hRec}`],
  ["rejeu avec sauvegarde annuelle = continu", hSaved === hCont && saved.refused === continuous.refused, `${hSaved} / ${hCont}`],
  ["cinq sauvegardes, migrations et chargements vérifiés", saved.years.length === YEARS && saved.problems.length === 0, saved.problems.length ? saved.problems.slice(0, 5).join(" ; ") : `${saved.years.length} années`],
  ["aucun blocage, invariants tenus", continuous.problems.length === 0 && toAbsoluteDay(saved.state.date) - toAbsoluteDay(createInitialState(seed, w).date) === YEARS * DAYS_PER_YEAR, continuous.problems.length ? continuous.problems.slice(0, 5).join(" ; ") : `an ${saved.state.date.year}, jour ${saved.state.date.day}`],
];
let failed = 0;
for (const [label, ok, detail] of checks) {
  console.log(`${ok ? "OK" : "KO"}  ${label} : ${detail}`);
  if (!ok) failed++;
}
console.log(`sim:parcours : ${failed === 0 ? "OK" : `${failed} vérification(s) KO`} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exitCode = failed === 0 ? 0 : 1;
