// P9.2 : journal de raisonnement des IA en mode débogage (commande « ia » de la console) — Marley, Hizuru, Alliés.
import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { applyCommand } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { aiJournal, runConsoleLine } from "../../src/ui/debugConsole";

describe("journal de raisonnement des IA (854)", () => {
  const world = loadWorld("data", "scn_camp_854__normal");
  let s: GameState = createInitialState(9, world);
  for (let i = 0; i < 9; i++) s = applyCommand(s, { type: "AdvanceDays", n: 10 }, undefined, world);
  it("décisions des nations et des armées, avec leurs raisons chiffrées", () => {
    const all = aiJournal(s, null, 500);
    expect(all.some((l) => /^j\d+ monde {3}fac_marley /.test(l))).toBe(true);
    expect(all.some((l) => /armées {2}fac_marley .*(approche|debarquer|assieger|bombarder)/.test(l))).toBe(true);
    expect(all.every((l) => /: .+=/.test(l) || /: $/.test(l))).toBe(true);
  });
  it("filtre par faction et nombre de lignes ; commande de console", async () => {
    const marley = aiJournal(s, "fac_marley", 5);
    expect(marley.length).toBeLessThanOrEqual(5);
    expect(marley.every((l) => l.includes("fac_marley"))).toBe(true);
    const host = { state: () => s, dispatch: async () => undefined, reset: async () => undefined, save: async () => undefined, load: async () => undefined, canonReport: async () => "" };
    const r = await runConsoleLine(host, "ia fac_hizuru 3");
    expect(r.ok).toBe(true);
    expect(r.text.split("\n").length).toBeLessThanOrEqual(3);
  });
});
