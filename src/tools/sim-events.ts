// npm run sim:events — AC5-02 et AC5-04 : l'année 850 en Canon fidèle sur plusieurs graines (choix historiques appliqués
// à l'échéance), puis une partie divergente (Eren retenu à E12) comparée à la partie canon.
// Options : --seeds 20, --days 360.
import { loadWorld } from "../data/worldNode";
import { applyCommand } from "../sim/core/commands";
import { createInitialState, tickDay } from "../sim/core/state";
import type { GameState } from "../sim/core/state";
import { fromAbsoluteDay } from "../sim/core/time";
import { predecessorsOf } from "../sim/strategic/world";

const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
};
const SEEDS = Number(arg("seeds", "20"));
const DAYS = Number(arg("days", "360"));
const world = loadWorld("data", "scn_sandbox_850");
const cw = world.chronicle;
if (!cw) throw new Error("chronologie absente");
// Chronique de 850 (E09–E42) ; les événements de 854 (P7) se vérifient dans le scénario 854 (tests/sim/world-events.test.ts).
const canon850 = cw.canon.filter((e) => e.year_min === 850);
const failures: string[] = [];
const check = (cond: boolean, label: string): void => {
  console.log(`${cond ? "  OK " : "  KO "} ${label}`);
  if (!cond) failures.push(label);
};
const deadline = cw.balance.deadline_days;
const deathEvent = new Map([...(world.politics?.characters.values() ?? [])].filter((c) => c.death_event).map((c) => [c.id, c.death_event as string]));

console.log(`Canon fidèle : ${SEEDS} graines × ${DAYS} jours (scénario 850 ; choix historiques appliqués à l'échéance)`);
let orderOk = 0;
let deathsOk = 0;
let generic = 0;
const families = new Map<string, number>();
let maxDay = 0;
let ms = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const t0 = performance.now();
  const s = applyCommand(createInitialState(seed, world), { type: "AdvanceDays", n: DAYS }, undefined, world);
  ms += performance.now() - t0;
  const ev = s.events;
  if (!ev) throw new Error("événements absents");
  let ok = ev.divergence === 0 && ev.branch === "canon";
  for (const e of canon850) {
    const r = ev.history[e.id];
    if (r?.status !== "survenu" || fromAbsoluteDay(r.day).year !== 850 || r.choice !== (e.choices.find((c) => c.historical)?.id ?? null)) ok = false;
    for (const p of predecessorsOf(e)) {
      const pr = ev.history[p];
      if (pr?.status === "survenu" && r) {
        const [lo, hi] = e.window.within_days ?? [0, 0];
        const gap = r.day - pr.day;
        if (gap < lo || gap > hi + deadline) ok = false;
      }
    }
    if (r) maxDay = Math.max(maxDay, fromAbsoluteDay(r.day).day);
  }
  if (ok) orderOk++;
  // Morts : exactement les personnages à death_event jouable, chacun le jour de son événement.
  const dead = Object.entries(s.politics?.characters ?? {}).filter(([, c]) => !c.alive);
  // Un événement déclenché mais encore en attente de décision a déjà appliqué ses effets : il compte.
  const occurred = (evt: string): boolean => ev.history[evt]?.status === "survenu" || ev.chronicle.some((c) => c.event === evt && c.status === "en_attente");
  const expected = [...deathEvent].filter(([, evt]) => cw.events.get(evt)?.playable && occurred(evt));
  const fine = dead.length === expected.length && dead.every(([id]) => occurred(deathEvent.get(id) ?? ""));
  if (fine) deathsOk++;
  for (const c of ev.chronicle) {
    const e = cw.events.get(c.event);
    if (e?.kind === "generic" && c.status === "survenu") {
      generic++;
      families.set(e.family ?? "?", (families.get(e.family ?? "?") ?? 0) + 1);
    }
  }
}
check(orderOk === SEEDS, `E09 → E42 en 850, dans l'ordre du graphe et dans les fenêtres, choix historiques, divergence 0 : ${orderOk}/${SEEDS} graines (dernier événement au plus tard le jour ${maxDay})`);
check(deathsOk === SEEDS, `morts canon : chacune à son événement et aucune autre, ${deathsOk}/${SEEDS} graines`);
check(generic > 0 && families.size >= 5, `événements génériques : ${generic} en ${SEEDS} ans (${[...families].map(([f, n]) => `${f} ${n}`).join(", ")})`);
console.log(`  ${SEEDS * DAYS} jours simulés en ${(ms / 1000).toFixed(1)} s`);

console.log("Divergence (AC5-04) : Eren retenu à E12, graine 42, comparée à la partie canon");
const canon = applyCommand(createInitialState(42, world), { type: "AdvanceDays", n: DAYS }, undefined, world);
let s: GameState = createInitialState(42, world);
for (let i = 0; i < DAYS && !s.events?.pending.some((p) => p.id === "evt_850_eren_first_transformation"); i++) s = tickDay(s, world);
s = applyCommand(s, { type: "ChooseEventOption", event: "evt_850_eren_first_transformation", choice: "retenir" }, undefined, world);
s = applyCommand(s, { type: "AdvanceDays", n: DAYS - (s.date.day - 1) }, undefined, world);
const h = s.events?.history ?? {};
const avoided = canon850.filter((e) => h[e.id]?.status === "evite").map((e) => e.code);
console.log(`  évités : ${avoided.length} (${avoided[0]} → ${avoided.at(-1)}) ; divergence ${s.events?.divergence.toFixed(2)} ; branche ${s.events?.branch}`);
check(h["evt_850_trost_plug"]?.status === "evite" && avoided.length >= 30 && s.events?.branch === "divergente", "le bouchage de Trost (E13) et toute la suite sont évités ; bascule en branche divergente");
const wallC = canon.strategic?.provinces["prov_rose_sud"]?.wall_structure ?? 0;
const wallD = s.strategic?.provinces["prov_rose_sud"]?.wall_structure ?? 0;
const alive = ["char_erwin_smith", "char_mike_zacharias", "char_hannes", "char_petra"].filter((id) => s.politics?.characters[id]?.alive && !canon.politics?.characters[id]?.alive);
check(wallD < wallC && alive.length === 4, `l'état diffère du canon : mur de Trost ${wallD} contre ${wallC} ; en vie alors que morts en canon : ${alive.length}/4`);

if (failures.length) {
  console.error(`sim:events : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log("sim:events : tout est conforme.");
