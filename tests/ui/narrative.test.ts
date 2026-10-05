import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { applyCommand } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import { runBattle } from "../../src/sim/tactical/battle";
import { skirmishSetup } from "../../src/sim/tactical/setup";
import { epilogue, gazette, letterFor } from "../../src/ui/narrative";
import fr from "../../src/i18n/fr.json";

const keys = Object.keys(fr);
const noRawKey = (text: string): string[] => keys.filter((k) => k.includes(".") && text.includes(k));
const w850 = loadWorld("data", "scn_sandbox_850");
const w854 = loadWorld("data", "scn_854");
const w845 = loadWorld("data", "scn_sandbox_845");
const year850 = applyCommand(createInitialState(42, w850), { type: "AdvanceDays", n: 120 }, undefined, w850);

describe("récits (AC8-07, 04 §5.10, §5.12, §5.15)", () => {
  it("gazette de Paradis : une tirée de la chronique, brèves tirées des alertes ; aucune clé brute", () => {
    const g = gazette(w850, year850);
    expect(g.masthead).toBe(fr["narr.paradis.masthead"]);
    expect(g.articles.length).toBeGreaterThanOrEqual(3);
    expect(g.articles[0]?.kind).toBe("une");
    const text = g.articles.map((a) => `${a.headline} ${a.body}`).join(" ");
    expect(noRawKey(text)).toEqual([]);
    expect(text).not.toMatch(/\b(evt|char|prov|wprov|fac)_[a-z]/);
  });

  it("gazette de Marley quand le joueur mène Marley : propagande et nouvelles du front", () => {
    let s = applyCommand(createInitialState(1, w854), { type: "SetPlayerFaction", faction: "fac_marley" }, undefined, w854);
    s = applyCommand(s, { type: "AdvanceDays", n: 90 }, undefined, w854);
    const g = gazette(w854, s);
    expect(g.masthead).toBe(fr["narr.marley.masthead"]);
    expect(noRawKey(g.articles.map((a) => `${a.headline} ${a.body}`).join(" "))).toEqual([]);
  });

  it("lettres aux familles : nom, escouade, cause, lieu ; même soldat → même lettre ; aucune clé brute", () => {
    // Première graine qui fait des morts (bataille déterministe).
    let r = runBattle(w850, skirmishSetup(w850, "tmap_plaine", [{ type: "ttype_grand_errant", count: 3 }], 8, 1, false));
    for (let seed = 2; seed < 30 && r.dead.length === 0; seed++) r = runBattle(w850, skirmishSetup(w850, "tmap_plaine", [{ type: "ttype_grand_errant", count: 3 }], 8, seed, false));
    expect(r.dead.length).toBeGreaterThan(0);
    for (const s of r.dead) {
      const l = letterFor(w850, r.state, s, "Plaine");
      expect(l).toContain(s.name);
      expect(l).toContain("Plaine");
      expect(noRawKey(l)).toEqual([]);
      expect(letterFor(w850, r.state, s, "Plaine")).toBe(l);
    }
  });

  it("épilogue : récit des décisions marquantes et chiffres, tirés de l'état", () => {
    const e = epilogue(w850, year850);
    expect(e.lines.length).toBeGreaterThan(0);
    expect(e.stats.find((x) => x.key === "narr.stat.days")?.value).toBe(120);
    for (const x of e.stats) {
      expect((fr as Record<string, string>)[x.key], x.key).toBeTruthy();
      expect((fr as Record<string, string>)[`${x.key}_why`], x.key).toBeTruthy();
    }
    expect(noRawKey(`${e.title} ${e.lines.join(" ")}`)).toEqual([]);
  });

  it("R0.2g : épilogue sans « 0 » par défaut — « — » pour un compte encore nul, ligne masquée si la donnée est absente", () => {
    // 845 : ni couche politique ni événements ; la légitimité, les événements et la divergence n'existent pas.
    const e845 = epilogue(w845, createInitialState(42, w845));
    const k845 = e845.stats.map((x) => x.key);
    for (const absent of ["narr.stat.legitimacy", "narr.stat.events", "narr.stat.divergence"]) expect(k845, absent).not.toContain(absent);
    for (const [w, s] of [[w845, createInitialState(42, w845)], [w850, createInitialState(42, w850)], [w850, year850]] as const) {
      for (const x of epilogue(w, s).stats) expect(String(x.value), x.key).not.toBe("0");
    }
    const start = epilogue(w850, createInitialState(42, w850));
    // Le récit non plus n'écrit pas « 0 événements » : un premier jour se dit autrement (relevé sur la capture, R0.4).
    for (const l of start.lines) expect(l, l).not.toMatch(/(^|\D)0 /);
    expect(start.stats.find((x) => x.key === "narr.stat.events")?.value).toBe("—");
    expect(start.stats.find((x) => x.key === "narr.stat.legitimacy")?.value).toBe(52);
  });
});
