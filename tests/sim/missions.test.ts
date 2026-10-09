import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { worldSourceFromFiles } from "../../src/data/worldSource";
import { readDataFiles } from "../../src/data/loadNode";
import { stateHash } from "../../src/sim/core/canonical";
import { applyCommand, replay } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { deserialize, serialize } from "../../src/sim/core/serialize";
import { sideOf, techModsWithMissions, withMissionMods } from "../../src/sim/missions/missions";
import { NO_MODS } from "../../src/sim/strategic/economy";
import { buildWorld } from "../../src/sim/strategic/world";

const req = <T>(v: T | null | undefined): T => {
  if (v === null || v === undefined) throw new Error("valeur absente");
  return v;
};

const w845 = loadWorld("data", "scn_sandbox_845");
const w850 = loadWorld("data", "scn_sandbox_850");
const run = (w: typeof w845, s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, w), s);
const days = (w: typeof w845, s: GameState, n: number): GameState => run(w, s, { type: "AdvanceDays", n });
const start = (id: string): Command => ({ type: "StartMission", mission: id });
const fails = (fn: () => unknown, key: string): void => expect(fn).toThrow(key);

describe("missions : lancement, verrous et coût (MIS.1, CMIS-07)", () => {
  it("une mission lançable paie son coût, entre en cours et se consigne ; l'état est créé à ce moment seulement", () => {
    const s0 = createInitialState(42, w845);
    expect(s0.missions).toBeUndefined();
    const s1 = run(w845, s0, start("mis_mil_inventaire_garnisons"));
    const side = sideOf(s1.missions, "paradis");
    expect(side.current).toHaveLength(1);
    expect(side.current[0]?.end).toBeGreaterThan(side.current[0]?.start ?? 0);
    expect(req(s1.strategic).stocks.gold).toBe(req(s0.strategic).stocks.gold - 800);
    expect(req(s1.missions).log.at(-1)?.key).toBe("mission.log.started");
  });

  it("verrous : prérequis, exclusion, places, coût, déjà en cours, nation, inconnue", () => {
    const s0 = createInitialState(42, w845);
    fails(() => run(w845, s0, start("mis_mil_reforme_armee")), "mission.lock.prereq");
    fails(() => run(w845, s0, start("mis_inexistante")), "mission.err.unknown");
    fails(() => run(w845, s0, start("mis_marley_arsenaux")), "mission.err.unknown");
    const a = run(w845, s0, start("mis_mil_inventaire_garnisons"), start("mis_eco_recensement_greniers"));
    fails(() => run(w845, a, start("mis_eco_routes_marchandes")), "mission.lock.slots");
    fails(() => run(w845, a, start("mis_mil_inventaire_garnisons")), "mission.lock.running");
    const poor: GameState = { ...s0, strategic: { ...req(s0.strategic), stocks: { ...req(s0.strategic).stocks, gold: 100 } } };
    fails(() => run(w845, poor, start("mis_mil_inventaire_garnisons")), "mission.lock.cost");
    // Exclusion mutuelle (église des murs / tolérance), en 850.
    let s = days(w850, createInitialState(42, w850), 1);
    s = days(w850, run(w850, s, start("mis_rel_dialogue_culte")), 91);
    s = run(w850, s, start("mis_rel_eglise_des_murs"));
    fails(() => run(w850, s, start("mis_rel_tolerance_courants")), "mission.lock.exclusive");
  });

  it("condition d'accès : une mission qui exige une technologie ou un contrôle reste verrouillée", () => {
    const s = days(w850, createInitialState(42, w850), 1);
    fails(() => run(w850, s, start("mis_mil_lances_foudroyantes")), "mission.lock.prereq");
    const done: GameState = { ...s, missions: { sides: { paradis: { current: [], done: ["mis_mil_etude_anti_titan"], doneDay: {} } }, log: [], ai: [] } };
    fails(() => run(w850, done, start("mis_mil_lances_foudroyantes")), "mission.lock.condition");
  });

  it("annulation : la moitié du coût est rendue, la mission sort de la liste", () => {
    const s0 = createInitialState(42, w845);
    const s1 = run(w845, s0, start("mis_mil_inventaire_garnisons"));
    const s2 = run(w845, s1, { type: "CancelMission", mission: "mis_mil_inventaire_garnisons" });
    expect(sideOf(s2.missions, "paradis").current).toHaveLength(0);
    expect(req(s2.strategic).stocks.gold).toBe(req(s0.strategic).stocks.gold - 400);
    fails(() => run(w845, s2, { type: "CancelMission", mission: "mis_mil_inventaire_garnisons" }), "mission.err.not_running");
  });
});

describe("missions : accomplissement, effets, pause et journal (MIS.1, MIS.4)", () => {
  it("à l'échéance : effets appliqués, modificateurs actifs, alerte avec pause, mission accomplie", () => {
    const s0 = createInitialState(42, w845);
    const moraleBefore = req(s0.strategic).provinces["prov_maria_sud"]?.morale ?? 0;
    const s1 = days(w845, run(w845, s0, start("mis_mil_inventaire_garnisons")), 59);
    expect(sideOf(s1.missions, "paradis").done).toEqual([]);
    const s2 = days(w845, s1, 1);
    const side = sideOf(s2.missions, "paradis");
    expect(side.done).toEqual(["mis_mil_inventaire_garnisons"]);
    expect(side.current).toHaveLength(0);
    // Morale +1 dans les provinces tenues (l'économie du jour peut la déplacer ensuite : on compare à un témoin sans mission).
    const control = days(w845, createInitialState(42, w845), 60);
    expect((req(s2.strategic).provinces["prov_maria_sud"]?.morale ?? 0) - (req(control.strategic).provinces["prov_maria_sud"]?.morale ?? 0)).toBeGreaterThan(0.5);
    expect(moraleBefore).toBeGreaterThan(0);
    const alert = req(s2.strategic).log.filter((l) => l.key === "alert.mission_done");
    expect(alert).toHaveLength(1);
    expect(alert[0]?.pause).toBe(true);
    expect(alert[0]?.params["mission"]).toBe("mission.mis_mil_inventaire_garnisons");
    expect(req(s2.missions).log.map((l) => l.key)).toEqual(["mission.log.started", "mission.log.done"]);
    const mods = withMissionMods(w845, s2.missions, NO_MODS);
    expect(mods.byTarget["losses_mult:gas"]?.[0]).toMatchObject({ key: "why.mission", value: -0.03 });
  });

  it("crochets d'expédition : multipliés aux effets des technologies", () => {
    let s = createInitialState(42, w845);
    s = run(w845, s, start("mis_mil_inventaire_garnisons"));
    s = days(w845, s, 60);
    s = days(w845, run(w845, s, start("mis_mil_reforme_armee")), 150);
    s = days(w845, run(w845, s, start("mis_mil_manoeuvres_odm")), 150);
    expect(sideOf(s.missions, "paradis").done).toContain("mis_mil_manoeuvres_odm");
    expect(techModsWithMissions(w845, s.research, s.missions).gasOdm).toBeCloseTo(0.94, 9);
    expect(techModsWithMissions(w845, s.research, undefined).gasOdm).toBe(1);
  });

  it("en 850 : événement non canon déclenché, drapeau posé, rien du récit forcé", () => {
    let s = days(w850, createInitialState(42, w850), 1);
    const canonBefore = Object.keys(req(s.events).history).filter((k) => w850.chronicle?.events.get(k)?.kind === "canon").length;
    s = days(w850, run(w850, s, start("mis_mil_inventaire_garnisons")), 60);
    const ev = req(s.events);
    expect(ev.chronicle.some((c) => c.event === "evt_mis_revue_postes" && c.status === "survenu")).toBe(true);
    expect(ev.flags["mission_mil_inventaire_garnisons"]).toBe(true);
    const control0 = createInitialState(42, w850);
    // Le contrôle des provinces n'est jamais modifié par une mission.
    for (const [id, p] of Object.entries(req(s.strategic).provinces)) expect(p.control, id).toBe(req(control0.strategic).provinces[id]?.control);
    expect(Object.keys(ev.history).filter((k) => w850.chronicle?.events.get(k)?.kind === "canon").length).toBeGreaterThanOrEqual(canonBefore);
  });

  it("une décision déclenchée par une mission se présente et se règle comme un événement", () => {
    let s = days(w850, createInitialState(42, w850), 1);
    s = days(w850, run(w850, s, start("mis_mil_inventaire_garnisons")), 60);
    s = days(w850, run(w850, s, start("mis_mil_reforme_armee")), 150);
    expect(req(s.events).pending.some((p) => p.id === "evt_mis_dilemme_reforme")).toBe(true);
    s = run(w850, s, { type: "ChooseEventOption", event: "evt_mis_dilemme_reforme", choice: "negocier" });
    expect(req(s.events).pending.some((p) => p.id === "evt_mis_dilemme_reforme")).toBe(false);
  });
});

describe("missions : déterminisme et sauvegardes (CMIS-07)", () => {
  const script: Command[] = [start("mis_eco_recensement_greniers"), { type: "AdvanceDays", n: 70 }, start("mis_eco_greniers_publics"), start("mis_mil_inventaire_garnisons"), { type: "AdvanceDays", n: 200 }];
  it("même graine et mêmes commandes : même empreinte ; le journal rejoué donne l'état final", () => {
    const a = replay(createInitialState(7, w845), script, w845);
    const b = replay(createInitialState(7, w845), script, w845);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(sideOf(a.missions, "paradis").done).toEqual(["mis_eco_recensement_greniers", "mis_mil_inventaire_garnisons", "mis_eco_greniers_publics"]);
  });
  it("sérialisation : un état avec missions se relit à l'identique ; un état sans missions se charge et reste sans", () => {
    const a = replay(createInitialState(7, w845), script, w845);
    expect(stateHash(deserialize(serialize(a)))).toBe(stateHash(a));
    const plain = days(w845, createInitialState(7, w845), 30);
    expect(deserialize(serialize(plain)).missions).toBeUndefined();
    expect(() => deserialize(serialize({ ...plain, missions: { nope: 1 } } as unknown as GameState))).toThrow("missions");
  });
  it("sans mission lancée, rien ne change : même empreinte qu'un monde sans la couche (anciennes sauvegardes)", () => {
    const { source } = worldSourceFromFiles(readDataFiles("data"));
    const bare = buildWorld({ ...req(source), missions: [] }, "scn_sandbox_850");
    expect(bare.missions).toBeUndefined();
    const a = days(w850, createInitialState(5, w850), 120);
    const b = days(bare, createInitialState(5, bare), 120);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(a.missions).toBeUndefined();
  });
});
