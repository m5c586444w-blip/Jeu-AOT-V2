import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { stateHash } from "../../src/sim/core/canonical";
import { applyCommand, replay } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { deserialize, serialize } from "../../src/sim/core/serialize";
import { encounterSetup, visibleProvinces } from "../../src/sim/armies/armies";
import { armyMen } from "../../src/sim/armies/state";
import type { ArmiesState, ArmyState } from "../../src/sim/armies/state";

const req = <T>(v: T | null | undefined): T => {
  if (v === null || v === undefined) throw new Error("valeur absente");
  return v;
};

const w850 = loadWorld("data", "scn_sandbox_850");
const w854 = loadWorld("data", "scn_854");
const run = (world: typeof w850, s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, world), s);
const ar = (s: GameState): ArmiesState => {
  if (!s.armies) throw new Error("pas d'armées");
  return s.armies;
};
const army = (s: GameState, id: string): ArmyState => {
  const a = ar(s).armies.find((x) => x.id === id);
  if (!a) throw new Error(`armée absente : ${id}`);
  return a;
};
const days = (world: typeof w850, s: GameState, n: number): GameState => run(world, s, { type: "AdvanceDays", n });

/** 854, Marley jouée, en guerre contre Paradis : la flotte mouille au sud-est et le corps débarque. */
function marleyLanded(seed = 7): GameState {
  let s = run(w854, createInitialState(seed, w854), { type: "SetPlayerFaction", faction: "fac_marley" }, { type: "DeclareWar", to: "fac_paradis" }, { type: "FleetMove", fleet: "flt_854_marley", to: "sea_sud_est" });
  for (let i = 0; i < 6 && ar(s).fleets[0]?.route.length; i++) s = days(w854, s, 1);
  return run(w854, s, { type: "FleetLand", fleet: "flt_854_marley", army: "army_854_marley", province: "prov_plaines_meurtries" });
}

describe("Armées sur la carte (PA.2, CPA-04)", () => {
  it("chaque scénario a des piles avec un général, un insigne, un effectif, du moral et du ravitaillement", () => {
    const s = createInitialState(1, w850);
    expect(ar(s).armies.length).toBeGreaterThanOrEqual(3);
    for (const a of ar(s).armies) {
      expect(a.general ?? a.general_key).toBeTruthy();
      expect(a.insignia).toBeTruthy();
      expect(armyMen(req(w850.armies), a)).toBeGreaterThan(0);
      expect(a.morale).toBeGreaterThan(0);
      expect(a.supply).toBeGreaterThan(0);
    }
    expect(army(s, "army_850_sud").general).toBe("char_dot_pixis");
  });

  it("ordre de mouvement terrestre : trajet par les portes, arrivée, vivres puisés dans les stocks", () => {
    const s0 = createInitialState(2, w850);
    const s1 = run(w850, s0, { type: "ArmyMove", army: "army_850_est", to: "prov_mitras" });
    const route = army(s1, "army_850_est").route;
    expect(route.at(-1)).toBe("prov_mitras");
    expect(route.length).toBeGreaterThanOrEqual(2);
    let s = s1;
    for (let i = 0; i < 40 && army(s, "army_850_est").province !== "prov_mitras"; i++) s = days(w850, s, 1);
    expect(army(s, "army_850_est").province).toBe("prov_mitras");
    expect(army(s, "army_850_est").fatigue).toBeGreaterThanOrEqual(0);
    // Marche forcée : plus vite, plus de fatigue.
    const slow = days(w850, s1, 2);
    const fast = days(w850, run(w850, s1, { type: "ArmyForcedMarch", army: "army_850_est", on: true }), 2);
    const prog = (x: GameState): number => army(x, "army_850_est").route.length * 1000 - army(x, "army_850_est").progress;
    expect(prog(fast)).toBeLessThan(prog(slow));
    expect(army(fast, "army_850_est").fatigue).toBeGreaterThan(army(slow, "army_850_est").fatigue);
  });

  it("refus : batteries de rempart immobiles, mur franchi seulement aux portes, armée d'un autre camp", () => {
    const s = createInitialState(3, w850);
    expect(() => run(w850, s, { type: "ArmyMove", army: "army_850_sud", to: "prov_trost" })).toThrow("army.err.no_route");
    expect(() => run(w850, s, { type: "FleetMove", fleet: "flt_x", to: "sea_large" })).toThrow();
  });

  it("fusion, division (général choisi), retraite et relève de garnison", () => {
    let s = createInitialState(4, w850);
    s = run(w850, s, { type: "ArmyMove", army: "army_850_est", to: "prov_trost" });
    for (let i = 0; i < 40 && army(s, "army_850_est").province !== "prov_trost"; i++) s = days(w850, s, 1);
    const men = armyMen(req(w850.armies), army(s, "army_850_sud")) + armyMen(req(w850.armies), army(s, "army_850_est"));
    const merged = run(w850, s, { type: "ArmyMerge", army: "army_850_est", into: "army_850_sud" });
    expect(ar(merged).armies.some((a) => a.id === "army_850_est")).toBe(false);
    expect(Math.abs(armyMen(req(w850.armies), army(merged, "army_850_sud")) - men)).toBeLessThanOrEqual(1);
    const split = run(w850, merged, { type: "ArmySplit", army: "army_850_sud", regiments: [{ regiment: "rgt_garnison", count: 2 }], general: "char_kitz_weilman" });
    const det = ar(split).armies.at(-1) as ArmyState;
    expect(det.general).toBe("char_kitz_weilman");
    expect(det.regiments[0]?.count).toBe(2);
    const before = req(req(split.strategic).provinces["prov_trost"]).garrison?.soldiers ?? 0;
    const g = run(w850, split, { type: "ArmyGarrison", army: det.id, mode: "deposer", soldiers: 150 });
    expect(req(req(g.strategic).provinces["prov_trost"]).garrison?.soldiers).toBe(before + 150);
    const r = run(w850, g, { type: "ArmyRetreat", army: det.id });
    expect(ar(r).armies.find((a) => a.id === det.id)?.stance).toBe("retraite");
  });

  it("ordre maritime : la flotte de Marley fait route, débarque son corps ; Paradis n'a aucune flotte", () => {
    const s = marleyLanded();
    const m = army(s, "army_854_marley");
    expect(m.province).toBe("prov_plaines_meurtries");
    expect(m.fleet).toBeNull();
    expect(ar(s).fleets[0]?.embarked).toEqual([]);
    expect(ar(createInitialState(1, w854)).fleets.every((f) => f.faction !== "fac_paradis")).toBe(true);
    expect([...req(w854.armies).ships.values()].every((x) => x.faction !== "fac_paradis")).toBe(true);
    // Paradis (joueur par défaut) ne commande pas la flotte de Marley.
    expect(() => run(w854, createInitialState(1, w854), { type: "FleetMove", fleet: "flt_854_marley", to: "sea_sud_est" })).toThrow("army.err.not_ours");
  });
});

describe("Interception et rencontre (PA.2, CPA-05)", () => {
  it("une armée de Paradis intercepte le corps débarqué : contact, pause, résolution rapide expliquée", () => {
    // Paradis joué, Marley en guerre : on débarque avec la flotte de l'IA, puis Paradis marche à l'ennemi.
    let s = run(w854, createInitialState(11, w854), { type: "DeclareWar", to: "fac_marley" });
    for (let i = 0; i < 30 && !ar(s).armies.find((a) => a.faction === "fac_marley")?.province; i++) s = days(w854, s, 1);
    const m = army(s, "army_854_marley");
    expect(m.province).toBeTruthy();
    expect(visibleProvinces({ world: w854, aw: req(w854.armies), s: ar(s), st: req(s.strategic) }, "fac_paradis").size).toBeGreaterThan(0);
    s = run(w854, s, { type: "ArmyMove", army: "army_854_sud", to: m.province as string }, { type: "ArmyForcedMarch", army: "army_854_sud", on: true });
    // L'île est grande (≈ 1 500 km par Shiganshina) : environ 110 jours de marche forcée.
    for (let i = 0; i < 150 && !ar(s).encounters.some((e) => e.kind !== "titans" && e.status === "attente"); i++) s = days(w854, s, 1);
    const enc = ar(s).encounters.find((e) => e.kind !== "titans" && e.status === "attente");
    expect(enc).toBeDefined();
    expect(req(s.strategic).log.some((l) => (l.key === "alert.army_contact" || l.key === "alert.army_landing_battle") && l.pause)).toBe(true);
    const r = run(w854, s, { type: "ResolveEncounter", encounter: req(enc).id, mode: "auto", orders: [] });
    const done = ar(r).encounters.find((e) => e.id === req(enc).id);
    expect(done?.status).toBe("resolue");
    expect(Object.keys(done?.result?.power ?? {}).length).toBe(2);
    expect(Object.values(done?.result?.losses ?? {}).some((x) => x > 0)).toBe(true);
    // Bataille tactique au choix : batteries de Marley contre soldats de Paradis.
    const setup = encounterSetup({ world: w854, aw: req(w854.armies), s: ar(s), seed: s.seed }, req(enc).id);
    expect(setup?.artillery?.some((b) => b.side === "ennemi")).toBe(true);
    const played = run(w854, s, { type: "ResolveEncounter", encounter: req(enc).id, mode: "jouer", orders: [] });
    expect(ar(played).encounters.find((e) => e.id === req(enc).id)?.result?.mode).toBe("jouer");
  });

  it("rencontre de Titans hors des murs (850) : jouable en bataille tactique", () => {
    let s = run(w850, createInitialState(5, w850), { type: "ArmyMove", army: "army_850_sud", to: "prov_maria_sud" });
    for (let i = 0; i < 40 && !ar(s).encounters.some((e) => e.kind === "titans" && e.status === "attente"); i++) s = days(w850, s, 1);
    const enc = ar(s).encounters.find((e) => e.kind === "titans" && e.status === "attente");
    expect(enc).toBeDefined();
    const setup = encounterSetup({ world: w850, aw: req(w850.armies), s: ar(s), seed: s.seed }, req(enc).id);
    expect(setup?.titans.reduce((n, t) => n + t.count, 0)).toBe(Math.min(12, req(enc).titans));
    const r = run(w850, s, { type: "ResolveEncounter", encounter: req(enc).id, mode: "jouer", orders: [] });
    expect(ar(r).encounters.find((e) => e.id === req(enc).id)?.status).toBe("resolue");
    expect(ar(r).log.some((l) => l.key === "army.log.battle_played")).toBe(true);
  });
});

describe("Déterminisme et sauvegardes (CPA-09)", () => {
  const script: Command[] = [{ type: "DeclareWar", to: "fac_marley" }, { type: "ArmyMove", army: "army_854_est", to: "prov_trost" }, { type: "AdvanceDays", n: 45 }, { type: "ArmyForcedMarch", army: "army_854_sud", on: true }, { type: "AdvanceDays", n: 20 }];
  it("même graine et mêmes commandes : même hash ; le journal rejoue la partie", () => {
    const a = replay(createInitialState(42, w854), script, w854);
    const b = replay(createInitialState(42, w854), script, w854);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(stateHash(a)).not.toBe(stateHash(replay(createInitialState(43, w854), script, w854)));
  });

  it("une sauvegarde sans armées (antérieure à PA) se charge, garde son hash et n'en crée pas ; RaiseArmies les lève", () => {
    const { armies: _drop, ...old } = createInitialState(9, w850);
    void _drop;
    const loaded = deserialize(serialize(old as GameState));
    expect(loaded.armies).toBeUndefined();
    expect(stateHash(loaded)).toBe(stateHash(old));
    const later = days(w850, loaded, 10);
    expect(later.armies).toBeUndefined();
    const raised = run(w850, later, { type: "RaiseArmies" });
    expect(raised.armies?.armies.length).toBe(3);
    const again = deserialize(serialize(raised));
    expect(stateHash(again)).toBe(stateHash(raised));
  });
});

describe("Succession (PA.10)", () => {
  it("mort du chef : crise, prétendants, légitimité ; le successeur choisi prend la tête", () => {
    const s0 = createInitialState(6, w850);
    let s = run(w850, s0, { type: "CharacterDies", character: "char_darius_zackly", cause: "assassinat" }, { type: "AdvanceDays", n: 1 });
    const crisis = ar(s).succession;
    expect(crisis?.claimants.length).toBe(3);
    expect(req(s.politics).legitimacy).toBeLessThan(req(s0.politics).legitimacy);
    expect(req(s.strategic).log.some((l) => l.key === "alert.succession_crisis" && l.pause)).toBe(true);
    const heir = req(req(crisis).claimants[1]).id;
    s = run(w850, s, { type: "ChooseSuccessor", candidate: heir });
    expect(req(s.politics).player).toBe(heir);
    expect(ar(s).succession).toBeNull();
    expect(() => run(w850, s, { type: "ChooseSuccessor", candidate: heir })).toThrow("succession.err.none");
  });

  it("mort d'un général : commandement intérimaire, moral en baisse, nouveau général nommé", () => {
    const s0 = createInitialState(8, w850);
    let s = run(w850, s0, { type: "CharacterDies", character: "char_dot_pixis", cause: "combat" }, { type: "AdvanceDays", n: 1 });
    const a = army(s, "army_850_sud");
    expect(a.general).toBeNull();
    expect(a.interim).toBe(true);
    expect(a.morale).toBeLessThan(army(s0, "army_850_sud").morale);
    s = run(w850, s, { type: "ArmySetGeneral", army: "army_850_sud", general: "char_rico_brzenska" });
    expect(army(s, "army_850_sud").general).toBe("char_rico_brzenska");
    expect(army(s, "army_850_sud").interim).toBe(false);
  });
});
