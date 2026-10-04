// npm run sim:shifters — AC6-05 et AC6-06 : chaque capacité des Neuf (03 §8.2) s'exerce en bataille et produit l'effet
// mesurable de sa fiche ; les lances de foudre percent l'armure durcie ; transformation (délai, endurance, recharge) ;
// perte de contrôle sous le stress. Batailles headless, graines 1…N par engagement.
// Options : --n 6.
import { loadWorld } from "../data/worldNode";
import { createBattle, runBattle, stepBattle } from "../sim/tactical/battle";
import { damageShifter } from "../sim/tactical/shifters";
import { skirmishSetup } from "../sim/tactical/setup";
import type { BattleSetup, ShifterSpec } from "../sim/tactical/types";

const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
};
const N = Number(arg("n", "6"));
const world = loadWorld("data", "scn_sandbox_850");
const sw = world.shifters;
if (!sw) throw new Error("Titans-porteurs absents");
const sb = sw.balance;
const failures: string[] = [];
const check = (cond: boolean, label: string): void => {
  console.log(`${cond ? "  OK " : "  KO "} ${label}`);
  if (!cond) failures.push(label);
};
const f1 = (v: number): string => v.toFixed(1);

interface Engagement {
  shifter: string;
  side: ShifterSpec["side"];
  map: string;
  titans: { type: string; count: number }[];
  soldiers: number;
  spears?: boolean;
  flags?: string[];
  stress?: number;
}

function setupOf(e: Engagement, seed: number): BattleSetup {
  const base = skirmishSetup(world, e.map, e.titans, e.soldiers, seed, false);
  return { ...base, shifters: [{ shifter: e.shifter, side: e.side, name: "Porteur", character: null, stress: e.stress ?? 20 }], ...(e.spears ? { thunderSpears: true } : {}), ...(e.flags ? { flags: e.flags } : {}) };
}

/** Unité de l'effet mesuré, par type d'effet (fiche de la capacité). */
const UNIT: Record<string, string> = {
  heat_wave: "ennemis brûlés ou coupes empêchées",
  armor: "points de dégâts de lame absorbés",
  charge: "ennemis renversés",
  hardening: "points de dégâts sur la nuque bloqués",
  call: "Titans purs attirés",
  projectiles: "ennemis tués",
  command_pures: "secondes d'attaque gagnées par les purs",
  speed: "mètres gagnés",
  bite: "victimes ou points de dégâts",
  endurance: "points d'endurance épargnés",
  transport: "unités de gaz livrées",
  spikes: "ennemis tués",
  remote_body: "points de dégâts sur la nuque absorbés",
  melee_titans: "Titans purs abattus",
  regeneration: "points de vie rendus en plus",
  founder_command: "Titans purs ralliés",
};

// Un engagement par capacité : le porteur du côté où sa capacité sert, sur un terrain où l'on se bat à l'ODM.
const PURES = [{ type: "ttype_moyen_errant", count: 6 }];
const SCOUTS = [{ type: "ttype_petit_errant", count: 3 }];
const ENGAGEMENTS: Record<string, Engagement> = {
  onde_chaleur: { shifter: "shifter_colossal", side: "ennemi", map: "tmap_ville", titans: [], soldiers: 18 },
  armure: { shifter: "shifter_cuirasse", side: "ennemi", map: "tmap_foret", titans: [], soldiers: 18 },
  charge: { shifter: "shifter_cuirasse", side: "ennemi", map: "tmap_plaine", titans: [], soldiers: 18 },
  durcissement_local: { shifter: "shifter_feminin", side: "ennemi", map: "tmap_foret", titans: [], soldiers: 18 },
  cri_appel: { shifter: "shifter_feminin", side: "ennemi", map: "tmap_foret", titans: SCOUTS, soldiers: 18 },
  projectiles: { shifter: "shifter_bestial", side: "ennemi", map: "tmap_plaine", titans: SCOUTS, soldiers: 16 },
  controle_purs: { shifter: "shifter_bestial", side: "ennemi", map: "tmap_plaine", titans: SCOUTS, soldiers: 16 },
  vitesse: { shifter: "shifter_machoire", side: "allie", map: "tmap_plaine", titans: PURES, soldiers: 16 },
  morsure: { shifter: "shifter_machoire", side: "allie", map: "tmap_plaine", titans: PURES, soldiers: 16 },
  endurance: { shifter: "shifter_charrette", side: "allie", map: "tmap_foret", titans: PURES, soldiers: 16 },
  transport: { shifter: "shifter_charrette", side: "allie", map: "tmap_foret", titans: PURES, soldiers: 16 },
  pieux_cristal: { shifter: "shifter_marteau", side: "ennemi", map: "tmap_foret", titans: [], soldiers: 18 },
  corps_distant: { shifter: "shifter_marteau", side: "ennemi", map: "tmap_foret", titans: [], soldiers: 18 },
  combat_rapproche: { shifter: "shifter_assaillant", side: "allie", map: "tmap_plaine", titans: PURES, soldiers: 16 },
  regeneration: { shifter: "shifter_assaillant", side: "ennemi", map: "tmap_foret", titans: [], soldiers: 18 },
  controle_purs_fondateur: { shifter: "shifter_fondateur", side: "allie", map: "tmap_plaine", titans: PURES, soldiers: 16, flags: ["royal_contact"] },
};

console.log(`Capacités des Neuf (AC6-05) : ${N} batailles par capacité`);
let abilities = 0;
for (const def of sw.order) {
  for (const a of def.abilities) {
    abilities++;
    const e = ENGAGEMENTS[a.id];
    if (!e) {
      check(false, `${def.id} / ${a.id} : aucun engagement de mesure`);
      continue;
    }
    let uses = 0;
    let effect = 0;
    for (let seed = 1; seed <= N; seed++) {
      const r = runBattle(world, setupOf(e, seed));
      const st = r.state.stats.abilities?.[a.id];
      uses += st?.uses ?? 0;
      effect += st?.effect ?? 0;
    }
    const used = a.passive ? "passive" : `${uses} emplois`;
    check((a.passive || uses > 0) && effect > 0, `${def.id} / ${a.id} (${a.effect}) : ${used}, effet ${f1(effect)} ${UNIT[a.effect] ?? ""} (${e.side}, ${e.map})`);
  }
}
check(abilities === Object.keys(ENGAGEMENTS).length, `${abilities} capacités dans les données, toutes mesurées`);

// Fondation verrouillée sans contact royal (02 §10) : la Coordonnée ne s'exerce pas.
{
  const locked = ENGAGEMENTS["controle_purs_fondateur"] as Engagement;
  let uses = 0;
  for (let seed = 1; seed <= N; seed++) uses += runBattle(world, setupOf({ ...locked, flags: [] }, seed)).state.stats.abilities?.["controle_purs_fondateur"]?.uses ?? 0;
  check(uses === 0, `Fondateur sans contact royal : ${uses} emploi de la Coordonnée`);
}

console.log("Lances de foudre contre l'armure durcie (T-ANT-08)");
{
  // Même Cuirassé, même zone : une lame (10) contre une lance (30), dégâts effectifs.
  const bt = createBattle(world, setupOf({ shifter: "shifter_cuirasse", side: "ennemi", map: "tmap_plaine", titans: [], soldiers: 6 }, 1));
  for (let i = 0; i < 100 && bt.state.shifters?.[0]?.phase !== "titan"; i++) stepBattle(bt);
  const u = bt.state.shifters?.[0];
  if (!u) throw new Error("porteur absent");
  const h = { log: () => undefined, killSoldier: () => undefined };
  const blade = damageShifter(bt, u, "legs", sb.soldiers.cut_damage, { pierce: false, source: "lame" }, h);
  const spear = damageShifter(bt, u, "legs", sb.soldiers.spear_damage, { pierce: true, source: "lance" }, h);
  check(spear === sb.soldiers.spear_damage && blade < sb.soldiers.cut_damage * 0.2, `coup de lame ${f1(blade)} (armure : ×${sw.defs.get("shifter_cuirasse")?.abilities.find((a) => a.effect === "armor")?.power}), lance ${f1(spear)} (perce)`);
  let withSpears = 0;
  let without = 0;
  for (let seed = 1; seed <= N; seed++) {
    const e: Engagement = { shifter: "shifter_cuirasse", side: "ennemi", map: "tmap_foret", titans: [], soldiers: 18 };
    if (runBattle(world, setupOf({ ...e, spears: true }, seed)).state.shifters?.[0]?.phase === "vaincu") withSpears++;
    if (runBattle(world, setupOf(e, seed)).state.shifters?.[0]?.phase === "vaincu") without++;
  }
  check(withSpears > without, `Cuirassé vaincu : ${withSpears}/${N} avec lances, ${without}/${N} aux lames seules`);
}

console.log("Transformation et perte de contrôle (AC6-06)");
{
  let ok = 0;
  const delays: number[] = [];
  for (let seed = 1; seed <= N; seed++) {
    const bt = createBattle(world, setupOf({ shifter: "shifter_assaillant", side: "allie", map: "tmap_plaine", titans: PURES, soldiers: 12 }, seed));
    const u0 = bt.state.shifters?.[0];
    const e0 = u0?.endurance ?? 0;
    let tick = 0;
    while (bt.state.shifters?.[0]?.phase !== "titan" && tick < 200) {
      stepBattle(bt);
      tick++;
    }
    const t = tick / (world.tactical?.balance.tick_hz ?? 20);
    delays.push(t);
    const u = bt.state.shifters?.[0];
    if (u && t >= sb.transform_delay_s[0] && t <= sb.transform_delay_s[1] + 0.1 && Math.abs(e0 - u.endurance - sb.transform_cost) < 1) ok++;
  }
  check(ok === N, `délai de transformation dans [${sb.transform_delay_s.join(", ")}] s (${delays.map(f1).join(", ")}) et coût d'endurance ${sb.transform_cost}, ${ok}/${N}`);
  let rampages = 0;
  let calm = 0;
  let friendly = 0;
  for (let seed = 1; seed <= N; seed++) {
    const e: Engagement = { shifter: "shifter_assaillant", side: "allie", map: "tmap_plaine", titans: PURES, soldiers: 16 };
    const hot = runBattle(world, setupOf({ ...e, stress: 95 }, seed));
    rampages += hot.state.stats.rampages ?? 0;
    friendly += hot.dead.filter((s) => s.death?.titan !== null && hot.state.titans[s.death?.titan ?? -1]?.ally).length;
    calm += runBattle(world, setupOf({ ...e, stress: 0 }, seed)).state.stats.rampages ?? 0;
  }
  check(rampages > calm, `perte de contrôle : ${rampages} crises à stress 95, ${calm} à stress 0 ; soldats alliés frappés par le porteur en crise : ${friendly}`);
  // Épuisement puis recharge : une nouvelle transformation n'arrive pas avant la recharge.
  const bt = createBattle(world, setupOf({ shifter: "shifter_assaillant", side: "allie", map: "tmap_plaine", titans: PURES, soldiers: 12 }, 1));
  const hz = (world.tactical?.balance.tick_hz ?? 20);
  let exhaustedAt = -1;
  let backAt = -1;
  for (let i = 0; i < 240 * hz && backAt < 0; i++) {
    const u = bt.state.shifters?.[0];
    if (u && u.phase === "titan" && exhaustedAt < 0 && i > hz * 5) u.endurance = 0.01;
    stepBattle(bt);
    const v = bt.state.shifters?.[0];
    if (v?.phase === "epuise" && exhaustedAt < 0) exhaustedAt = i;
    if (exhaustedAt >= 0 && v?.phase === "titan") backAt = i;
    if (bt.state.ended) break;
  }
  const gap = backAt < 0 ? Infinity : (backAt - exhaustedAt) / hz;
  check(exhaustedAt >= 0 && gap >= sb.transform_cooldown_s, `épuisé (endurance à zéro) : détransformation, retour ${Number.isFinite(gap) ? `après ${f1(gap)} s` : "pas avant la fin"} ≥ recharge ${sb.transform_cooldown_s} s`);
}

if (failures.length) {
  console.error(`sim:shifters : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log("sim:shifters : tout est conforme.");
