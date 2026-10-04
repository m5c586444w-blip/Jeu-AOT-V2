// npm run sim:world — AC7-02, AC7-03, AC7-07 : scénario 854, parties d'un an headless des deux côtés.
// (1) Marley joué : des décisions du joueur (front, Titan, levées, garanties) changent l'issue par rapport à un Marley passif.
// (2) Hizuru reste neutre sans décision, bascule vers Marley ou vers Paradis selon les garanties du joueur.
// (3) 20 parties d'un an (10 graines × 2 nations jouées) : sans erreur, sans cycle dégénéré ; IA consignée ; tick < 8 ms.
// Options : --seeds 10.
import { loadWorld } from "../data/worldNode";
import { applyCommand } from "../sim/core/commands";
import type { Command } from "../sim/core/commands";
import { createInitialState, tickDay } from "../sim/core/state";
import type { GameState } from "../sim/core/state";

const arg = (name: string, def: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
};
const SEEDS = Number(arg("seeds", "10"));
const world = loadWorld("data", "scn_854");
const failures: string[] = [];
const check = (cond: boolean, label: string): void => {
  console.log(`${cond ? "  OK " : "  KO "} ${label}`);
  if (!cond) failures.push(label);
};
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, world), s);
const held = (s: GameState, f: string): number => Object.values(s.nations?.control ?? {}).filter((x) => x === f).length;

console.log("(1) Partie jouée côté Marley (AC7-02), graine 1, un an");
const marley = run(createInitialState(1, world), { type: "SetPlayerFaction", faction: "fac_marley" });
const passive = run(marley, { type: "AdvanceDays", n: 360 });
let active = run(
  marley,
  { type: "MoveFormation", formation: "form_infanterie_ligne", from: "wprov_fort_slava", to: "wprov_forteresse_passage", count: 5 },
  { type: "MoveFormation", formation: "form_artillerie", from: "wprov_fort_slava", to: "wprov_forteresse_passage", count: 3 },
  { type: "ProjectTitan", shifter: "shifter_bestial", province: "wprov_forteresse_passage" },
  { type: "BuildFormation", formation: "form_infanterie_assaut", province: "wprov_raffineries_sud", count: 2 },
);
let decisions = 4;
for (let m = 0; m < 12; m++) {
  active = run(active, { type: "AdvanceDays", n: 30 });
  // Chaque mois : avancer depuis toute province tenue voisine d'une province alliée tenue par l'ennemi.
  const ns = active.nations;
  if (!ns) break;
  for (const p of world.nations?.order ?? []) {
    if (ns.control[p.id] !== "fac_marley") continue;
    for (const [id, st] of Object.entries(ns.forces[p.id] ?? {})) {
      const f = world.nations?.formations.get(id);
      if (!f || f.faction !== "fac_marley" || f.domain !== "terre" || st.moves <= 0 || st.count < 2) continue;
      const target = p.adjacent.find((a) => ns.control[a] === "fac_allies");
      if (!target) continue;
      try {
        active = run(active, { type: "MoveFormation", formation: id, from: p.id, to: target, count: st.count - 1 });
        decisions++;
      } catch {
        // mouvement refusé (règle expliquée) : on passe
      }
    }
  }
  if (m === 2) {
    for (let g = 0; g < 6; g++) active = run(active, { type: "GuaranteeHizuru" });
    decisions += 6;
  }
}
const pa = held(passive, "fac_marley");
const ac = held(active, "fac_marley");
check(active.date.year === 855 && (active.nations?.player ?? "") === "fac_marley", `un an joué comme Marley sans erreur (${decisions} décisions du joueur)`);
check(ac !== pa || active.nations?.hizuruSide !== passive.nations?.hizuruSide, `les décisions changent l'issue : provinces tenues par Marley ${ac} contre ${pa} (passif) ; Hizuru ${active.nations?.hizuruSide} contre ${passive.nations?.hizuruSide}`);

console.log("(2) Hizuru change de camp selon les décisions (AC7-03)");
for (const side of ["fac_paradis", "fac_marley"]) {
  let s = run(createInitialState(2, world), { type: "SetPlayerFaction", faction: side });
  const neutral = run(s, { type: "AdvanceDays", n: 360 }).nations?.hizuruSide;
  s = run(s, { type: "AdvanceDays", n: 120 });
  const n = side === "fac_marley" ? 6 : 3;
  for (let g = 0; g < n; g++) s = run(s, { type: "GuaranteeHizuru" });
  s = run(s, { type: "AdvanceDays", n: 31 });
  const ally = s.nations?.treaties.some((t) => t.kind === "alliance" && [t.a, t.b].includes("fac_hizuru") && [t.a, t.b].includes(side));
  check(neutral === "neutre" && s.nations?.hizuruSide === side && ally === true, `${side} : neutre sans décision (${neutral}) ; après ${n} garanties, Hizuru s'allie (${s.nations?.hizuruSide}), journal « ${s.nations?.log.filter((l) => l.key === "world.log.hizuru_side").length} bascule(s) »`);
}

console.log(`(3) ${SEEDS * 2} parties d'un an (AC7-07)`);
let ok = 0;
let flips = 0;
let maxFlips = 0;
let attractor = 0;
let reasonsOk = true;
const times: number[] = [];
const outcomes = new Map<string, number>();
for (const side of ["fac_paradis", "fac_marley"])
  for (let seed = 1; seed <= SEEDS; seed++) {
    let s = run(createInitialState(seed, world), { type: "SetPlayerFaction", faction: side });
    try {
      for (let d = 0; d < 360; d++) {
        const t0 = performance.now();
        s = tickDay(s, world);
        times.push(performance.now() - t0);
      }
      ok++;
    } catch (e) {
      console.log(`    erreur ${side} graine ${seed} : ${(e as Error).message}`);
      continue;
    }
    const ns = s.nations;
    if (!ns) continue;
    const wars = ns.log.filter((l) => l.key === "world.log.war" || l.key === "world.log.peace").length;
    flips += wars;
    maxFlips = Math.max(maxFlips, wars);
    if (ns.ai.some((d) => d.faction === "fac_marley" && d.reasons.some((r) => r.key === "ai.attractor_fondateur")) || side === "fac_marley") attractor++;
    if (ns.ai.some((d) => d.reasons.length === 0)) reasonsOk = false;
    for (const n of Object.values(ns.nations)) if (n.industry < 0 || !Number.isFinite(n.industry) || !Number.isFinite(n.manpower)) reasonsOk = false;
    const key = `${side}: Marley ${held(s, "fac_marley")}, Alliés ${held(s, "fac_allies")}, Paradis ${held(s, "fac_paradis")}, Hizuru ${s.nations?.hizuruSide}`;
    outcomes.set(key, (outcomes.get(key) ?? 0) + 1);
  }
times.sort((a, b) => a - b);
const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
check(ok === SEEDS * 2, `${ok}/${SEEDS * 2} parties d'un an sans erreur`);
check(maxFlips <= 4, `pas de cycle guerre–paix : au plus ${maxFlips} déclarations ou paix par partie (${flips} en tout)`);
check(attractor === SEEDS * 2 && reasonsOk, `Marley consigne son attracteur (le Fondateur) ; chaque décision d'IA porte ses raisons ; comptes finis et positifs`);
check(p95 < 8, `tick du scénario 854 : p95 ${p95.toFixed(2)} ms, max ${(times.at(-1) ?? 0).toFixed(2)} ms (budget 8 ms)`);
console.log("  issues (provinces tenues à la fin de l'année) :");
for (const [k, n] of [...outcomes].sort()) console.log(`    ${n} × ${k}`);

if (failures.length) {
  console.error(`sim:world : ÉCHEC (${failures.length})`);
  process.exit(1);
}
console.log("sim:world : tout est conforme.");
