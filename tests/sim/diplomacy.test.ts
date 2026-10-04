import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { replayFactors } from "../../src/sim/core/explain";
import { applyCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { acceptance, accepts, hizuruDrift } from "../../src/sim/world/diplomacy";
import { nationIncome } from "../../src/sim/world/nations";
import type { NationsState } from "../../src/sim/world/nations";
import fr from "../../src/i18n/fr.json";

const world = loadWorld("data", "scn_854");
const dict = fr as Record<string, string>;
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, world), s);
const ns = (s: GameState): NationsState => {
  if (!s.nations) throw new Error("monde absent");
  return s.nations;
};
const start = createInitialState(5, world);
const asMarley = run(start, { type: "SetPlayerFaction", faction: "fac_marley" });

describe("Hizuru peut changer de camp (AC7-03, 07 H01)", () => {
  it("sans décision du joueur, Hizuru reste neutre une année entière", () => {
    expect(ns(run(start, { type: "AdvanceDays", n: 360 })).hizuruSide).toBe("neutre");
    expect(ns(run(asMarley, { type: "AdvanceDays", n: 360 })).hizuruSide).toBe("neutre");
  });

  it("Marley achète la neutralité d'Hizuru par des garanties : Hizuru s'allie à Marley, et c'est consigné", () => {
    let s = asMarley;
    for (let i = 0; i < 6; i++) s = run(s, { type: "GuaranteeHizuru" });
    s = run(s, { type: "AdvanceDays", n: 31 });
    expect(ns(s).hizuruSide).toBe("fac_marley");
    expect(ns(s).treaties.some((t) => t.kind === "alliance" && [t.a, t.b].includes("fac_hizuru") && [t.a, t.b].includes("fac_marley"))).toBe(true);
    expect(ns(s).log.some((l) => l.key === "world.log.hizuru_side")).toBe(true);
  });

  it("Paradis, après quelques mois d'industrie, fait basculer Hizuru de son côté", () => {
    let s = run(start, { type: "AdvanceDays", n: 120 });
    for (let i = 0; i < 3; i++) s = run(s, { type: "GuaranteeHizuru" });
    s = run(s, { type: "AdvanceDays", n: 31 });
    expect(ns(s).hizuruSide).toBe("fac_paradis");
  });

  it("le penchant mensuel d'Hizuru est expliqué (commerce, peur de chaque camp)", () => {
    const e = hizuruDrift(world, ns(start));
    expect(replayFactors(e.factors)).toBeCloseTo(e.value);
    for (const f of e.factors) expect(dict[f.key], f.key).toBeTruthy();
  });
});

describe("diplomatie (AC7-06)", () => {
  it("l'acceptation d'un traité est une utilité expliquée ; en guerre, aucun traité", () => {
    const e = acceptance(world, ns(start), "fac_marley", "fac_allies", "commerce");
    expect(replayFactors(e.factors)).toBeCloseTo(e.value);
    for (const f of e.factors) expect(dict[f.key], f.key).toBeTruthy();
    expect(e.factors.some((f) => f.key === "why.dip_at_war")).toBe(true);
    const r = accepts(world, ns(start), "fac_marley", "fac_allies", "commerce");
    expect(r.ok).toBe(false);
    // Coalition alliée : la réponse passe par un vote (F-DIP-09).
    expect(r.vote?.total).toBe(3);
  });

  it("traité proposé (accepté ou refusé, consigné) ; ultimatum sans peur suffisante → guerre ; embargo → industrie de la cible réduite", () => {
    const t = run(start, { type: "ProposeTreaty", to: "fac_hizuru", kind: "renseignement" });
    expect(ns(t).log.at(-1)?.key).toMatch(/^world\.log\.treaty_(signed|refused)$/);
    const u = run(asMarley, { type: "Ultimatum", to: "fac_hizuru", province: "wprov_ile_est_hizuru" });
    expect(ns(u).wars).toContain("fac_hizuru|fac_marley");
    const before = nationIncome(world, ns(asMarley), "fac_allies", asMarley.strategic).industry.value;
    const emb = run(asMarley, { type: "Embargo", to: "fac_allies", on: true });
    expect(nationIncome(world, ns(emb), "fac_allies", emb.strategic).industry.value).toBeLessThan(before);
    expect(() => run(asMarley, { type: "DeclareWar", to: "fac_allies" })).toThrow("world.err.already_at_war");
    expect(() => run(asMarley, { type: "DeclareWar", to: "fac_marley" })).toThrow("world.err.bad_target");
  });

  it("déclarer la guerre à un pays encore en confiance coûte de la stabilité (casus belli, F-DIP-04)", () => {
    const s = structuredClone(ns(asMarley));
    const r = s.relations["fac_marley"]?.["fac_hizuru"];
    if (r) r.trust = 20;
    const after = run({ ...asMarley, nations: s }, { type: "DeclareWar", to: "fac_hizuru" });
    expect(ns(after).nations["fac_marley"]?.stability).toBeLessThan(ns(asMarley).nations["fac_marley"]?.stability ?? 0);
  });
});

describe("IA des nations (AC7-07)", () => {
  it("Marley vise le Fondateur : chaque décision est consignée avec ses raisons ; l'IA attaque, lève et projette ses Titans", () => {
    const s = run(start, { type: "AdvanceDays", n: 180 });
    const ai = ns(s).ai;
    const marley = ai.filter((d) => d.faction === "fac_marley");
    expect(marley.some((d) => d.reasons.some((r) => r.key === "ai.attractor_fondateur"))).toBe(true);
    expect(marley.some((d) => d.action.startsWith("attaquer:"))).toBe(true);
    expect(marley.some((d) => d.action.startsWith("titan:"))).toBe(true);
    for (const d of ai) for (const r of d.reasons) expect(dict[r.key], r.key).toBeTruthy();
  });
});
