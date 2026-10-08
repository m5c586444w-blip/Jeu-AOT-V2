import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { applyCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";

const req = <T>(v: T | null | undefined): T => {
  if (v === null || v === undefined) throw new Error("valeur absente");
  return v;
};

const w854 = loadWorld("data", "scn_854");
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, w854), s);
const days = (s: GameState, n: number): GameState => {
  let x = s;
  for (let i = 0; i < n; i++) x = run(x, { type: "AdvanceDays", n: 1 });
  return x;
};

describe("IA des armées (PA.7, CPA-07)", () => {
  it("Marley (IA) : approche la côte la moins défendue, débarque, assiège ; chaque décision a ses raisons", () => {
    const s = days(run(createInitialState(9, w854), { type: "DeclareWar", to: "fac_marley" }), 20);
    const ai = req(s.armies).ai.filter((d) => d.faction === "fac_marley");
    const actions = ai.map((d) => d.action);
    expect(actions.some((a) => a.startsWith("approche:"))).toBe(true);
    expect(actions.some((a) => a.startsWith("debarquer:"))).toBe(true);
    expect(actions.some((a) => a === "bombarder" || a.startsWith("assieger:"))).toBe(true);
    expect(ai.every((d) => d.reasons.length > 0)).toBe(true);
    expect(req(s.armies).sieges.length).toBeGreaterThan(0);
    // En paix, la flotte reste au large.
    const calm = days(createInitialState(9, w854), 20);
    expect(req(calm.armies).ai.filter((d) => d.faction === "fac_marley")).toEqual([]);
  });

  it("Paradis (IA, Marley jouée) : intercepte une menace à sa portée ou tient un mur", () => {
    let s = run(createInitialState(7, w854), { type: "SetPlayerFaction", faction: "fac_marley" }, { type: "DeclareWar", to: "fac_paradis" }, { type: "FleetMove", fleet: "flt_854_marley", to: "sea_sud_est" });
    for (let i = 0; i < 6 && req(s.armies).fleets[0]?.route.length; i++) s = days(s, 1);
    s = days(run(s, { type: "FleetLand", fleet: "flt_854_marley", army: "army_854_marley", province: "prov_plaines_meurtries" }), 10);
    const ai = req(s.armies).ai.filter((d) => d.faction === "fac_paradis");
    expect(ai.some((d) => d.action.startsWith("intercepter:") || d.action.startsWith("tenir_mur:"))).toBe(true);
    expect(ai.every((d) => d.reasons.length > 0)).toBe(true);
  });
});
