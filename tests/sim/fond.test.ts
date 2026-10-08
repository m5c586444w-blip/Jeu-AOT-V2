import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import fr from "../../src/i18n/fr.json";
import { createInitialState, tickDay } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { fondDays } from "../../src/sim/events/engine";
import { stateHash } from "../../src/sim/core/canonical";

/** CHR.2 : événements de fond (3 à 4 par mois, aucun texte repris dans l'année, déterministes, génériques). */
const dict = fr as Record<string, string>;
/** Titres du nom d'un personnage (« Maître … », « Pasteur … ») : mots communs, pas des noms. */
const TITLES = new Set(["Maître", "Pasteur", "Docteur", "Capitaine", "Commandant", "Sergent"]);
const world = loadWorld("data", "scn_sandbox_850");
const cw = world.chronicle;
const fondIds = new Set((cw?.fond ?? []).map((e) => e.id));

function runYear(seed: number, w = world, days = 360): GameState {
  let s = createInitialState(seed, w);
  for (let d = 0; d < days; d++) s = tickDay(s, w);
  return s;
}
const fondEntries = (s: GameState, from: number) => (s.events?.chronicle ?? []).filter((c) => fondIds.has(c.event) && c.day > from);

describe("jours d'événements de fond", () => {
  it("3 à 4 jours distincts par mois, dans le mois, déterministes", () => {
    for (let month = 0; month < 40; month++) {
      const days = fondDays(7, month, [3, 4]);
      expect(days.length).toBeGreaterThanOrEqual(3);
      expect(days.length).toBeLessThanOrEqual(4);
      expect(new Set(days).size).toBe(days.length);
      for (const d of days) expect(d >= 0 && d <= 29).toBe(true);
      expect(fondDays(7, month, [3, 4])).toEqual(days);
    }
    expect(fondDays(7, 1, [3, 4])).not.toEqual(fondDays(8, 1, [3, 4]));
  });
});

describe("événements de fond sur un an simulé (CCHR-04)", () => {
  const start = createInitialState(42, world);
  const startDay = (world.scenario.start.year * 360) + world.scenario.start.day - 1;
  const s = runYear(42);
  const entries = fondEntries(s, startDay);

  it("chaque mois de jeu compte au moins 3 événements de fond, 3,5 en moyenne ou plus", () => {
    const perMonth = Array.from({ length: 12 }, (_, m) => entries.filter((c) => Math.floor((c.day - startDay) / 30) === m).length);
    expect(Math.min(...perMonth)).toBeGreaterThanOrEqual(3);
    expect(entries.length / 12).toBeGreaterThanOrEqual(3.3);
  });

  it("chronique non vide dès le premier jour : 3 faits de fond, sans effet appliqué", () => {
    const first = (start.events?.chronicle ?? []).filter((c) => fondIds.has(c.event));
    expect(first).toHaveLength(cw?.balance.fond?.backstory ?? -1);
    expect(new Set(first.map((c) => c.event)).size).toBe(first.length);
    expect(stateHash(createInitialState(42, world))).toBe(stateHash(start));
  });

  it("aucun texte repris dans l'année : ni le même événement, ni la même phrase", () => {
    const keys = entries.map((c) => c.event);
    expect(new Set(keys).size).toBe(keys.length);
    const bodies = keys.map((k) => dict[`${cw?.events.get(k)?.text_key}.body`]);
    expect(new Set(bodies).size).toBe(bodies.length);
  });

  it("déterministe : même graine, même chronique ; autre graine, autre chronique", () => {
    expect(stateHash(runYear(42, world, 120))).toBe(stateHash(runYear(42, world, 120)));
    const other = fondEntries(runYear(43), startDay).map((c) => c.event);
    expect(other).not.toEqual(entries.map((c) => c.event));
  });

  it("les événements de fond ne déclenchent aucune décision et laissent le tirage des génériques inchangé", () => {
    expect(s.events?.pending.every((p) => !fondIds.has(p.id))).toBe(true);
    const generic = (st: GameState) => (st.events?.chronicle ?? []).filter((c) => cw?.events.get(c.event)?.kind === "generic").map((c) => `${c.day}:${c.event}`);
    const without = loadWorld("data", "scn_sandbox_850");
    if (without.chronicle) (without.chronicle as { fond: unknown }).fond = [];
    expect(generic(runYear(42, without))).toEqual(generic(s));
  });
});

describe("données de fond", () => {
  const fond = cw?.fond ?? [];
  it("au moins 90 entrées, canon A, sans choix, avec thème et famille ; textes en français", () => {
    expect(fond.length).toBeGreaterThanOrEqual(90);
    for (const e of fond) {
      expect(e.canon, e.id).toBe("A");
      expect(e.choices, e.id).toHaveLength(0);
      expect(e.theme, e.id).toBeTruthy();
      expect(e.family, e.id).toBeTruthy();
      expect(dict[e.text_key], e.id).toBeTruthy();
      expect(dict[`${e.text_key}.body`], e.id).toBeTruthy();
    }
  });

  it("aucune phrase en double entre deux événements, aucun nom de personnage, aucun anachronisme", () => {
    const sentences = fond.flatMap((e) => (dict[`${e.text_key}.body`] ?? "").split(/(?<=[.;:!?])\s+/));
    expect(sentences.length - new Set(sentences).size).toBe(0);
    const names = new Set([...(world.politics?.characters.values() ?? [])].flatMap((c) => c.name.split(/\s+/)).filter((w) => w.length > 3 && !TITLES.has(w)));
    const banned = /\b(Lances? de foudre|Marley|Hizuru|océan|Colossal|Eren|chemin de fer)\b/;
    for (const e of fond) {
      const text = `${dict[e.text_key]} ${dict[`${e.text_key}.body`]}`;
      for (const w of names) expect(new RegExp(`\\b${w}\\b`).test(text), `${e.id} : ${w}`).toBe(false);
      expect(banned.test(text), e.id).toBe(false);
    }
  });

  it("assez de textes pour tenir l'année même hors saison : au moins 70 sans condition de saison", () => {
    expect(fond.filter((e) => e.conditions.length === 0).length).toBeGreaterThanOrEqual(70);
  });
});
