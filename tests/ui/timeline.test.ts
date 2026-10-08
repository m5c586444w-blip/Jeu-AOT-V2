import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { createInitialState, tickDay } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { axisYears, buildTimeline, dateLabel, filterItems, foresightFor, intelLevel } from "../../src/ui/timeline";
import { findLeaks } from "../../src/ui/leaks";

/** Frise « Chronologie » (CHR.3, E-UX-6) : états des événements, annonces selon le renseignement, thèmes, axe. */
const w850 = loadWorld("data", "scn_sandbox_850");
const w854 = loadWorld("data", "scn_854");

function withLevel(s: GameState, certainty: "aucune" | "rumeur" | "indice" | "preuve"): GameState {
  const c = structuredClone(s);
  if (c.intel) for (const sec of Object.values(c.intel.secrets)) Object.assign(sec, { certainty });
  return c;
}
const canon = (items: ReturnType<typeof buildTimeline>) => items.filter((i) => i.group === "canon");

describe("niveau de renseignement et annonces", () => {
  it("niveaux 0 à 3 d'après les secrets et les rapports recoupés", () => {
    const s = createInitialState(42, w850);
    expect(intelLevel(null)).toBe(0);
    expect(intelLevel(s.intel)).toBe(0);
    expect(intelLevel(withLevel(s, "rumeur").intel)).toBe(1);
    expect(intelLevel(withLevel(s, "indice").intel)).toBe(2);
    expect(intelLevel(withLevel(s, "preuve").intel)).toBe(3);
  });

  it("horizons : rien sans renseignement ; rumeur proche ; prévision plus loin ; certitude avec date", () => {
    expect(foresightFor(0, 5, 0)).toBeNull();
    expect(foresightFor(1, 50, 0)).toBe("rumeur");
    expect(foresightFor(1, 150, 0)).toBeNull();
    expect(foresightFor(2, 150, 0)).toBe("prevision");
    expect(foresightFor(2, null, 1)).toBe("prevision");
    expect(foresightFor(2, null, 2)).toBeNull();
    expect(foresightFor(3, 300, 0)).toBe("certitude");
    expect(foresightFor(3, null, 3)).toBe("prevision");
    expect(foresightFor(3, null, 4)).toBeNull();
    expect(foresightFor(1, null, 1)).toBeNull();
  });
});

describe("850 au départ : le passé est coché, l'avenir invisible sans renseignement", () => {
  const s = createInitialState(42, w850);
  const base = canon(buildTimeline(w850, s));

  it("sept événements passés (E03 reste caché jusqu'à la chapelle Reiss), aucun annoncé", () => {
    expect(base.map((i) => i.status)).toEqual(Array(7).fill("passe"));
    expect(base.some((i) => i.code === "E03")).toBe(false);
  });

  it("rumeur : thème vague, ni titre ni code ; prévision : titre réel ; certitude : date exacte", () => {
    const r = canon(buildTimeline(w850, withLevel(s, "rumeur"))).filter((i) => i.status === "annonce");
    expect(r.length).toBeGreaterThan(0);
    for (const i of r) {
      expect(i.foresight).toBe("rumeur");
      expect(i.code).toBeNull();
      expect(i.title).not.toBe("Remise des diplômes de la 104ᵉ promotion");
      expect(dateLabel(i)).toBe("dans les mois à venir");
    }
    const p = canon(buildTimeline(w850, withLevel(s, "indice"))).filter((i) => i.status === "annonce");
    expect(p.some((i) => i.title === "Remise des diplômes de la 104ᵉ promotion" && i.foresight === "prevision")).toBe(true);
    const c = canon(buildTimeline(w850, withLevel(s, "preuve"))).filter((i) => i.status === "annonce" && i.foresight === "certitude");
    expect(c.length).toBeGreaterThan(0);
    for (const i of c) expect(i.day).not.toBeNull();
  });

  it("aucune mention interne dans les textes de la frise (E-UX-1)", () => {
    for (const lvl of ["aucune", "rumeur", "indice", "preuve"] as const) {
      for (const i of buildTimeline(w850, withLevel(s, lvl))) expect(findLeaks(`${i.title} ${i.summary} ${dateLabel(i)}`), i.id).toEqual([]);
    }
  });
});

describe("854 : les 60 événements du récit sont sur la frise", () => {
  it("au départ : 52 passés, E53 daté, les trois suivants annoncés ; E57 à E60 pas encore visibles", () => {
    const items = canon(buildTimeline(w854, createInitialState(42, w854)));
    expect(items.filter((i) => i.status === "passe")).toHaveLength(52);
    const e53 = items.find((i) => i.code === "E53");
    expect(e53?.status).toBe("annonce");
    expect(e53?.foresight).toBe("certitude");
    expect(e53?.day).not.toBeNull();
    expect(items.map((i) => i.code)).toContain("E56");
    expect(items.map((i) => i.code)).not.toContain("E60");
  });

  it("au bout d'une année de jeu, les 60 sont passés ou en cours, avec titre et résumé", () => {
    let s = createInitialState(42, w854);
    for (let d = 0; d < 360; d++) s = tickDay(s, w854);
    const items = canon(buildTimeline(w854, s));
    expect(new Set(items.map((i) => i.code)).size).toBe(60);
    expect(items.every((i) => i.status === "passe" || i.status === "en_cours" || i.status === "evite")).toBe(true);
    expect(items.every((i) => i.title.length > 0 && i.summary.length > 0)).toBe(true);
  });
});

describe("une année de jeu", () => {
  let s = createInitialState(42, w850);
  for (let d = 0; d < 360; d++) s = tickDay(s, w850);
  const items = buildTimeline(w850, s);

  it("les événements survenus sont cochés avec leur date ; les faits du quotidien forment leur propre groupe", () => {
    const e10 = items.find((i) => i.code === "E10");
    expect(e10?.status).toBe("passe");
    expect(e10?.day).not.toBeNull();
    expect(e10?.conform).toBe(true);
    const daily = items.filter((i) => i.group === "quotidien");
    expect(daily.length).toBeGreaterThan(40);
    expect(items.every((i) => i.group === "canon" || i.code === null)).toBe(true);
  });

  it("les squelettes suivent le récit : E43 passé, périodes en cours (E50), E51 pas encore", () => {
    const by = new Map(items.map((i) => [i.code, i]));
    expect(by.get("E43")?.status).toBe("passe");
    expect(by.get("E50")?.status).toBe("en_cours");
    expect(by.get("E51")?.status).toBe("annonce");
    expect(by.get("E51")?.foresight).toBe("prevision");
  });

  it("filtre par thème et axe 845 à 854+", () => {
    const only = filterItems(items, "titans", "canon");
    expect(only.length).toBeGreaterThan(0);
    expect(only.every((i) => i.theme === "titans")).toBe(true);
    expect(axisYears(items, 851).map((a) => a.year)).toEqual(Array.from({ length: 10 }, (_, k) => 845 + k));
    expect(axisYears(items, 857).at(-1)?.year).toBe(857);
  });
});
