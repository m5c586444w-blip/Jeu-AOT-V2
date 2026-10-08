// npm run sim:selftest — AC-16 / AC1-06 : même hash après 1000 ticks en direct et via un worker (worker_threads),
// sans monde (fondations P0), avec l'économie (845), avec la couche politique, les événements (850, P5) et les porteurs (P6), puis avec une expédition (P3) et une bataille jouée (P4).
import { Worker } from "node:worker_threads";
import { DEFAULT_SCENARIO, loadWorld } from "../data/worldNode";
import type { Command } from "../sim/core/commands";
import { createSim } from "../sim/sim";
import type { SimResponse } from "../sim/sim";
import { SimClient } from "../workers/simClient";
import { standardPlan } from "../sim/military/plan";

const SEED = 42;
const script: Command[] = [{ type: "SetFlag", key: "selftest", value: true }, ...Array.from({ length: 10 }, (): Command => ({ type: "AdvanceDays", n: 100 }))];

const worker = new Worker(new URL("../workers/sim.node-worker.boot.mjs", import.meta.url));
const client = new SimClient({
  post: (m) => worker.postMessage(m),
  onMessage: (h) => worker.on("message", (m: SimResponse) => h(m)),
});

let failed = false;
try {
  for (const scenario of [null, DEFAULT_SCENARIO, "scn_sandbox_850", "scn_854"]) {
    const direct = createSim(SEED, scenario ? loadWorld("data", scenario) : undefined);
    for (const c of script) direct.dispatch(c);
    let last = await client.init(SEED, scenario);
    for (const c of script) last = await client.dispatch(c);
    const d = last.state.date;
    const label = scenario ?? "sans monde";
    const ev = last.state.events;
    const p5 = ev ? ` | événements : ${Object.values(ev.history).filter((r) => r.status === "survenu").length} canon survenus, divergence ${ev.divergence}, ${last.state.research?.done.length ?? 0} technologies` : "";
    const sh = last.state.shifters;
    const p6 = sh ? ` | porteurs (P6) : Colossal → ${sh.titans["shifter_colossal"]?.holder ?? "—"}, ${sh.history.length} héritage(s), sérum ${sh.serum}` : "";
    console.log(`[${label}] direct : ${direct.hash()} | worker : ${last.hash} | date an ${d.year}, jour ${d.day}${p5}${p6}`);
    if (last.hash !== direct.hash() || last.state.commandIndex !== script.length) failed = true;
  }
  // AC7-08 : 854 mené par Marley (choix de la nation, levée, projection d'un Titan), direct = worker.
  {
    const w854 = loadWorld("data", "scn_854");
    const script854: Command[] = [
      { type: "SetPlayerFaction", faction: "fac_marley" },
      { type: "BuildFormation", formation: "form_artillerie", province: "wprov_liberio", count: 1 },
      { type: "MoveFormation", formation: "form_infanterie_ligne", from: "wprov_fort_slava", to: "wprov_forteresse_passage", count: 4 },
      { type: "ProjectTitan", shifter: "shifter_bestial", province: "wprov_forteresse_passage" },
      { type: "AdvanceDays", n: 180 },
    ];
    const d854 = createSim(SEED, w854);
    for (const c of script854) d854.dispatch(c);
    let l854 = await client.init(SEED, "scn_854");
    for (const c of script854) l854 = await client.dispatch(c);
    const ns = d854.state().nations;
    console.log(`[scn_854, Marley] direct : ${d854.hash()} | worker : ${l854.hash} | date an ${l854.state.date.year}, jour ${l854.state.date.day} | guerres : ${ns?.wars.join(", ")} | Marteau → ${d854.state().shifters?.titans["shifter_marteau"]?.holder ?? "—"}`);
    if (l854.hash !== d854.hash() || ns?.player !== "fac_marley") failed = true;
  }

  // AC3-10 : une expédition lancée en 850 (plan calculé sur l'état direct, puis rejoué tel quel des deux côtés).
  const w850 = loadWorld("data", "scn_sandbox_850");
  const direct = createSim(SEED, w850);
  direct.dispatch({ type: "AdvanceDays", n: 120 });
  const mil = direct.state().military;
  const plan = mil ? standardPlan(w850, mil, "prov_maria_est", "eventail", 20) : null;
  if (!plan) throw new Error("plan d'expédition introuvable");
  const expScript: Command[] = [{ type: "AdvanceDays", n: 120 }, { type: "LaunchExpedition", plan }, { type: "AdvanceDays", n: 7 }, { type: "AdvanceDays", n: 40 }];
  for (const c of expScript.slice(1)) direct.dispatch(c);
  let last = await client.init(SEED, "scn_sandbox_850");
  for (const c of expScript) last = await client.dispatch(c);
  const report = direct.state().military?.reports.at(-1);
  const d = last.state.date;
  console.log(`[scn_sandbox_850 + expédition] direct : ${direct.hash()} | worker : ${last.hash} | date an ${d.year}, jour ${d.day} | rapport : ${report ? `${report.dead.length} morts / ${report.stats.departed}` : "aucun"}`);
  if (last.hash !== direct.hash() || !report) failed = true;

  // AC4-06 : une expédition « jouée » (P4) — la campagne s'arrête sur un engagement, la bataille est rejouée avec des ordres.
  const played = createSim(SEED, w850);
  const playScript: Command[] = [{ type: "AdvanceDays", n: 120 }, { type: "LaunchExpedition", plan: { ...plan, play: true } }];
  for (const c of playScript) played.dispatch(c);
  for (let i = 0; i < 40 && !played.state().military?.expeditions[0]?.pending; i++) {
    const c: Command = { type: "AdvanceDays", n: 1 };
    played.dispatch(c);
    playScript.push(c);
  }
  const exp = played.state().military?.expeditions[0];
  const squad = exp?.pending?.setup.soldiers[0]?.squad;
  if (!exp?.pending || !squad) throw new Error("aucune bataille en attente");
  const tail: Command[] = [{ type: "ResolveBattle", expedition: exp.id, mode: "jouer", orders: [{ tick: 40, squad, order: "tenir" }, { tick: 400, squad, order: "tuer" }] }, { type: "AdvanceDays", n: 5 }];
  for (const c of tail) {
    played.dispatch(c);
    playScript.push(c);
  }
  last = await client.init(SEED, "scn_sandbox_850");
  for (const c of playScript) last = await client.dispatch(c);
  const pd = last.state.date;
  const field = played.state().military?.expeditions[0]?.log.find((l) => l.key === "field.battle_played") ?? played.state().military?.reports.at(-1);
  console.log(`[scn_sandbox_850 + bataille jouée] direct : ${played.hash()} | worker : ${last.hash} | date an ${pd.year}, jour ${pd.day} | ${playScript.length} commandes | ${field ? "bataille reportée" : "bataille absente"}`);
  if (last.hash !== played.hash() || !field) failed = true;
  // MIS : deux missions lancées en 845 (économie seule), accomplies avant la fin ; 854 laisse l'IA de Marley choisir les siennes (ligne « 854 »).
  {
    const w845 = loadWorld("data", DEFAULT_SCENARIO);
    const missionScript: Command[] = [{ type: "StartMission", mission: "mis_mil_inventaire_garnisons" }, { type: "StartMission", mission: "mis_eco_recensement_greniers" }, { type: "AdvanceDays", n: 90 }, { type: "StartMission", mission: "mis_mil_reforme_armee" }, { type: "AdvanceDays", n: 200 }];
    const m845 = createSim(SEED, w845);
    for (const c of missionScript) m845.dispatch(c);
    let lm = await client.init(SEED, DEFAULT_SCENARIO);
    for (const c of missionScript) lm = await client.dispatch(c);
    const side = m845.state().missions?.sides["paradis"];
    console.log(`[${DEFAULT_SCENARIO} + missions] direct : ${m845.hash()} | worker : ${lm.hash} | date an ${lm.state.date.year}, jour ${lm.state.date.day} | missions accomplies : ${side?.done.join(", ") ?? "aucune"}`);
    if (lm.hash !== m845.hash() || (side?.done.length ?? 0) !== 3) failed = true;
  }
} finally {
  await worker.terminate();
}
if (failed) {
  console.error("sim:selftest : ÉCHEC (hash différent entre direct et worker).");
  process.exitCode = 1;
} else {
  console.log("sim:selftest : OK (direct = worker : sans monde, bac à sable 845, bac à sable politique 850, 854, 854 mené par Marley, 850 avec une expédition, 850 avec une bataille jouée, 845 avec des missions).");
}
