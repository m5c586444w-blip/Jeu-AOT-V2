import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { makePilot, PROFILES } from "../../src/tools/balance/autopilot";
import { playGame } from "../../src/tools/balance/game";
import { aggregate, isFamine, limitingOf } from "../../src/tools/balance/stats";
import { renderHtml } from "../../src/tools/balance/report";

/** P9.5 (CP9-03) : `sim:balance` — pilote tiré de la graine, parties déterministes, agrégats et rapport HTML autonome. */
const wg = loadWorld("data", "scn_grondement");

describe("sim:balance (P9.5)", () => {
  it("le profil du pilote dépend de la graine, et toujours le même pour une graine donnée", () => {
    const seen = new Set(Array.from({ length: 40 }, (_, i) => makePilot(i + 1).profile));
    expect([...seen].sort()).toEqual([...PROFILES].sort());
    expect(makePilot(7).profile).toBe(makePilot(7).profile);
  });

  it("une partie va jusqu'à une fin, sans erreur ; même graine, même résultat", () => {
    const a = playGame(wg, "fac_paradis", 3);
    const b = playGame(wg, "fac_paradis", 3);
    expect(a.error).toBeNull();
    expect(["victoire", "defaite", "terme"]).toContain(a.outcome);
    expect(a).toEqual(b);
  });

  it("agrégats : issues qui somment à 1, cas dégénérés et ressource limitante ; page HTML sans ressource externe", () => {
    const games = [1, 2, 3, 4, 5, 6].map((seed) => playGame(wg, "fac_paradis", seed));
    const s = aggregate(games, new Set(["coal"]));
    const camp = s.camps[0];
    expect(camp?.games).toBe(6);
    const total = Object.values(camp?.outcomes ?? {}).reduce((a, x) => a + x.share, 0);
    expect(total).toBeCloseTo(1, 6);
    const g0 = games[0];
    if (!g0) throw new Error("aucune partie");
    expect(isFamine({ ...g0, days: 100, zeroDays: { food: 60 } })).toBe(true);
    expect(limitingOf({ ...g0, days: 100, zeroDays: { coal: 100, gas: 30 } }, new Set(["coal"]))).toBe("gas");
    const html = renderHtml({ generated: "2026-10-10", parties: 6, seedBase: 1, difficulty: "normal", scenarios: [s], criteria: [{ id: "CP9-03", label: "fin", ok: true, detail: "—" }] });
    expect(html).toContain("<!doctype html>");
    expect(html).not.toMatch(/https?:\/\//);
  });
}, 60_000);
