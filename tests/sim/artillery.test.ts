import { describe, expect, it } from "vitest";
import { checkCanon } from "../../src/data/canonRules";
import { loadRawDir } from "../../src/data/loadRaw";
import { loadWorld } from "../../src/data/worldNode";
import { regimentAvailable } from "../../src/sim/armies/armies";
import { applyCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { createBattle, runBattle } from "../../src/sim/tactical/battle";
import { skirmishSetup } from "../../src/sim/tactical/setup";
import type { BattleSetup } from "../../src/sim/tactical/types";

const req = <T>(v: T | null | undefined): T => {
  if (v === null || v === undefined) throw new Error("valeur absente");
  return v;
};

const w850 = loadWorld("data", "scn_sandbox_850");
const w854 = loadWorld("data", "scn_854");
const run = (world: typeof w850, s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, world), s);

describe("Armes et dates (PA.3, CPA-03)", () => {
  it("lances foudroyantes : indisponibles en 850 sans la technique, disponibles une fois produites en masse", () => {
    const s = createInitialState(1, w850);
    const ctx = (research: GameState["research"]) => ({ world: w850, aw: req(w850.armies), research, events: s.events, date: s.date });
    expect(regimentAvailable(ctx(s.research), "fac_paradis", "rgt_lances_foudre")).toBe(false);
    const done = { ...req(s.research), done: [...req(s.research).done, "tech_thunder_spear_prototype", "tech_thunder_spear_mass"] };
    const lances = req(req(w850.armies).regiments.get("rgt_lances_foudre"));
    const ev = lances.requires.event;
    const events = ev ? { ...req(s.events), history: { ...req(s.events).history, [ev]: { status: "survenu" } } } : s.events;
    expect(regimentAvailable({ ...ctx(done), events: events as GameState["events"] }, "fac_paradis", "rgt_lances_foudre")).toBe(true);
    // Fusil anti-Titan de Marley : rien avant 850.
    expect(regimentAvailable({ world: w850, aw: req(w850.armies), research: null, events: null, date: { year: 845, day: 1 } }, "fac_marley", "rgt_m_anti_titan")).toBe(false);
  });

  it("canon:check R13 : données réelles propres ; navire de Paradis et lances avant 850 refusés", () => {
    const raw = loadRawDir("data").raw;
    expect(checkCanon(raw).filter((v) => v.rule === "R13")).toEqual([]);
    const cat = raw.armies.map((e) => ({ ...e, v: { ...e.v } }));
    const ship = req(cat.find((e) => e.v["type"] === "ship"));
    cat.push({ ...ship, id: "ship_paradis_test", v: { ...ship.v, id: "ship_paradis_test", faction: "fac_paradis" } });
    req(cat.find((e) => e.id === "rgt_lances_foudre")).v["requires"] = { min_year: 845 };
    const bad = checkCanon({ ...raw, armies: cat }).filter((v) => v.rule === "R13");
    expect(bad.some((v) => v.id === "ship_paradis_test")).toBe(true);
    expect(bad.some((v) => v.id === "rgt_lances_foudre")).toBe(true);
  });
});

function artillerySetup(seed: number): BattleSetup {
  return {
    ...skirmishSetup(w854, "tmap_plaine", [{ type: "ttype_grand_errant", count: 3 }], 18, seed),
    artillery: [
      { id: "bat_a", piece: "art_canon_rempart", munition: "mun_boulet", side: "allie", count: 3 },
      { id: "bat_e", piece: "art_marley_campagne", munition: "mun_shrapnel", side: "ennemi", count: 4 },
    ],
  };
}

describe("Artillerie en bataille (PA.5, CPA-06)", () => {
  it("les deux camps tirent : impacts, coups au but, éclats et contre-batterie ; déterministe", () => {
    const a = runBattle(w854, artillerySetup(3));
    const b = runBattle(w854, artillerySetup(3));
    expect(JSON.stringify(a.state.stats)).toBe(JSON.stringify(b.state.stats));
    const art = req(a.state.stats.artillery);
    expect(art.shots).toBeGreaterThan(0);
    const bats = req(a.state.batteries);
    expect(req(bats.find((x) => x.side === "allie")).shots).toBeGreaterThan(0);
    expect(req(bats.find((x) => x.side === "ennemi")).shots).toBeGreaterThan(0);
    expect(art.titanHits + art.soldierKills + art.piecesSilenced).toBeGreaterThan(0);
    expect((a.state.impacts ?? []).length).toBeGreaterThan(0);
  });

  it("une bataille sans canon garde exactement sa suite (aucune régression tactique)", () => {
    const setup = skirmishSetup(w854, "tmap_plaine", [{ type: "ttype_grand_errant", count: 2 }], 12, 5);
    const r = runBattle(w854, setup);
    expect(r.state.batteries).toBeUndefined();
    expect(r.state.stats.artillery).toBeUndefined();
    expect(createBattle(w854, setup).state.impacts).toBeUndefined();
  });
});

describe("Siège (PA.4, PA.7)", () => {
  it("un corps de Marley débarqué à côté d'un mur l'assiège et l'entame avec ses pièces", () => {
    let s = run(w854, createInitialState(42, w854), { type: "DeclareWar", to: "fac_marley" });
    for (let i = 0; i < 40 && (s.armies?.sieges.length ?? 0) === 0; i++) s = run(w854, s, { type: "AdvanceDays", n: 1 });
    const siege = req(s.armies).sieges[0];
    expect(siege).toBeDefined();
    expect(req(s.strategic).log.some((l) => l.key === "alert.siege" && l.pause)).toBe(true);
    const before = req(req(s.strategic).provinces[req(siege).segment]).wall_structure ?? 0;
    const later = run(w854, s, { type: "AdvanceDays", n: 3 });
    expect(req(req(later.strategic).provinces[req(siege).segment]).wall_structure ?? 0).toBeLessThan(before);
  });
});
