import { describe, expect, it } from "vitest";
import { loadWorld } from "../../../src/data/worldNode";
import { createInitialState } from "../../../src/sim/core/state";
import { emptyKnowledge, factionOfSeat, fogView, observe } from "../../../src/sim/knowledge/knowledge";

const w850 = loadWorld("data", "scn_sandbox_850");

describe("Connaissance par faction (C3)", () => {
  const s = { ...createInitialState(5, w850), seats: { seats: { seat_1: { faction: "fac_paradis" }, seat_2: { faction: "fac_marley" } } } };

  it("chaque faction connaît ses propres armées, pas celles d'autrui hors de sa vue", () => {
    const ks = observe(s, emptyKnowledge(), ["fac_paradis", "fac_marley"]);
    const own = (s.armies?.armies ?? []).filter((a) => a.faction === "fac_paradis").map((a) => a.id);
    expect(own.length).toBeGreaterThan(0);
    for (const id of own) expect(ks.byFaction["fac_paradis"]?.armies[id]).toBeDefined();
    const marleyView = fogView(s, ks).armiesKnownTo("seat_2");
    for (const id of own) {
      const a = s.armies?.armies.find((x) => x.id === id);
      const seen = marleyView.some((v) => v.id === id);
      const sameProvince = (s.armies?.armies ?? []).some((m) => m.faction === "fac_marley" && m.province === a?.province);
      if (!sameProvince) expect(seen).toBe(false);
    }
  });

  it("le brouillard est par siège ; l'observation est pure et déterministe", () => {
    const a = observe(s, emptyKnowledge(), ["fac_paradis", "fac_marley"]);
    const b = observe(s, emptyKnowledge(), ["fac_marley", "fac_paradis"]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(fogView(s, a).armiesKnownTo("seat_9")).toEqual([]);
    expect(factionOfSeat(s, "seat_2")).toBe("fac_marley");
    expect(factionOfSeat(createInitialState(5, w850), "seat_1")).toBe("fac_paradis");
  });
});
