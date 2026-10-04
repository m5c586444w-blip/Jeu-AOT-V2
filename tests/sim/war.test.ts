import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { replayFactors } from "../../src/sim/core/explain";
import { applyCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { moveProblem } from "../../src/sim/world/nations";
import type { NationsState } from "../../src/sim/world/nations";
import { sidePower, weeklyWar } from "../../src/sim/world/war";
import fr from "../../src/i18n/fr.json";

const world = loadWorld("data", "scn_854");
const dict = fr as Record<string, string>;
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, world), s);
const ns = (s: GameState): NationsState => {
  if (!s.nations) throw new Error("monde absent");
  return s.nations;
};
const FP = "wprov_forteresse_passage";
const assault = run(
  createInitialState(3, world),
  { type: "SetPlayerFaction", faction: "fac_marley" },
  { type: "MoveFormation", formation: "form_infanterie_ligne", from: "wprov_fort_slava", to: FP, count: 5 },
  { type: "MoveFormation", formation: "form_artillerie", from: "wprov_fort_slava", to: FP, count: 3 },
);

describe("Titans comme armes stratégiques (AC7-04, F-WAR-08)", () => {
  const without = run(assault, { type: "AdvanceDays", n: 42 });
  const withBeast = run(assault, { type: "ProjectTitan", shifter: "shifter_bestial", province: FP }, { type: "AdvanceDays", n: 42 });
  it("la projection du Bestial fait tomber la Forteresse du Passage, que l'infanterie seule ne prend pas", () => {
    expect(ns(without).control[FP]).toBe("fac_allies");
    expect(ns(withBeast).control[FP]).toBe("fac_marley");
    const front = ns(withBeast).fronts.find((f) => f.province === FP);
    expect(front?.attackPower.factors.some((f) => f.key === "why.war_titan")).toBe(true);
  });
  it("usure du porteur (stress chaque semaine) et coût politique (peur des autres nations, soutien chez soi)", () => {
    expect(withBeast.politics?.characters["char_zeke_yeager"]?.stress ?? 0).toBeGreaterThan(without.politics?.characters["char_zeke_yeager"]?.stress ?? 0);
    expect(ns(withBeast).relations["fac_allies"]?.["fac_marley"]?.fear).toBeGreaterThan(ns(without).relations["fac_allies"]?.["fac_marley"]?.fear ?? 0);
    expect(ns(withBeast).log.some((l) => l.key === "world.log.titan_projected")).toBe(true);
  });
  it("refus expliqués : Titan d'une autre nation, hors de portée, déjà engagé ; rappel puis repos forcé", () => {
    expect(() => run(assault, { type: "ProjectTitan", shifter: "shifter_assaillant", province: FP })).toThrow("world.err.titan_not_ours");
    expect(() => run(assault, { type: "ProjectTitan", shifter: "shifter_cuirasse", province: "wprov_paradis" })).toThrow("world.err.titan_out_of_reach");
    const engaged = run(assault, { type: "ProjectTitan", shifter: "shifter_bestial", province: FP });
    expect(() => run(engaged, { type: "ProjectTitan", shifter: "shifter_bestial", province: FP })).toThrow("world.err.titan_engaged");
    const recalled = run(engaged, { type: "RecallTitan", shifter: "shifter_bestial" });
    expect(() => run(recalled, { type: "ProjectTitan", shifter: "shifter_bestial", province: FP })).toThrow("world.err.titan_resting");
    for (const k of ["world.err.titan_not_ours", "world.err.titan_out_of_reach", "world.err.titan_engaged", "world.err.titan_resting"]) expect(dict[k], k).toBeTruthy();
  });
  it("côté Paradis : projeter l'Assaillant coûte de la légitimité", () => {
    const p = createInitialState(3, world);
    const s = structuredClone(ns(p));
    s.wars.push("fac_marley|fac_paradis");
    const ps = run({ ...p, nations: s }, { type: "ProjectTitan", shifter: "shifter_assaillant", province: "wprov_paradis" });
    expect(ps.politics?.legitimacy).toBeLessThan(p.politics?.legitimacy ?? 0);
  });
});

describe("guerre moderne (AC7-05)", () => {
  it("artillerie, supériorité aérienne et fortification : chacune un facteur expliqué de la puissance au front", () => {
    const s = structuredClone(ns(assault));
    s.forces[FP] = { ...(s.forces[FP] ?? {}), form_chasse: { count: 3, strength: 1, moves: 0 } };
    const ctx = { world, seed: 3, date: assault.date, ns: s, sh: assault.shifters, pol: assault.politics, st: assault.strategic };
    const att = sidePower(ctx, FP, "fac_marley", "attaque", "fac_allies");
    const def = sidePower(ctx, FP, "fac_allies", "defense", "fac_marley");
    const keys = att.factors.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["why.war_artillery", "why.war_air", "why.war_recon"]));
    expect(def.factors.map((f) => f.key)).toEqual(expect.arrayContaining(["why.war_terrain", "why.war_fort"]));
    for (const e of [att, def]) {
      expect(replayFactors(e.factors)).toBeCloseTo(e.value);
      for (const f of e.factors) expect(dict[f.key], f.key).toBeTruthy();
    }
    // L'artillerie compte : sans elle, la puissance d'attaque baisse.
    const noArt = structuredClone(s);
    delete noArt.forces[FP]?.["form_artillerie"];
    expect(sidePower({ ...ctx, ns: noArt }, FP, "fac_marley", "attaque", "fac_allies").value).toBeLessThan(att.value);
  });

  it("marine : deux flottes en guerre dans une même mer se battent ; un débarquement exige la mer", () => {
    const s = structuredClone(ns(assault));
    s.forces["wprov_detroit_slava"] = { form_cuirasses: { count: 2, strength: 1, moves: 1 }, form_navires_coalition: { count: 2, strength: 1, moves: 1 } };
    const before = JSON.stringify(s.forces["wprov_detroit_slava"]);
    weeklyWar({ world, seed: 3, date: assault.date, ns: s, sh: null, pol: null, st: null });
    expect(JSON.stringify(s.forces["wprov_detroit_slava"])).not.toBe(before);
    expect(s.log.some((l) => l.key === "world.log.naval")).toBe(true);
    // Débarquement depuis une mer tenue par l'ennemi : refusé.
    const t = structuredClone(ns(assault));
    t.forces["wprov_detroit_slava"] = { form_infanterie_ligne: { count: 2, strength: 1, moves: 1 }, form_navires_coalition: { count: 6, strength: 1, moves: 1 } };
    expect(moveProblem(world, t, "fac_marley", "form_infanterie_ligne", "wprov_detroit_slava", "wprov_cote_voiliers", 1)).toBe("world.err.sea_not_held");
  });
});
