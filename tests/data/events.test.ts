import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import fr from "../../src/i18n/fr.json";
import { predecessorsOf } from "../../src/sim/strategic/world";

const world = loadWorld("data", "scn_sandbox_850");
const dict = fr as Record<string, string>;
const chronicle = world.chronicle;

describe("événements de P5 (AC5-01)", () => {
  it("34 événements canon jouables E09 → E42, dans l'ordre du graphe ; textes et choix en français", () => {
    expect(chronicle).not.toBeNull();
    const canon = (chronicle?.canon ?? []).filter((e) => e.year_min === 850);
    expect(canon.map((e) => e.code)).toEqual(Array.from({ length: 34 }, (_, i) => `E${String(i + 9).padStart(2, "0")}`));
    for (const e of canon) {
      expect(dict[e.text_key], e.id).toBeTruthy();
      expect(dict[`${e.text_key}.body`], e.id).toBeTruthy();
      for (const c of e.choices) expect(dict[`${e.text_key}.choice.${c.id}`], `${e.id}/${c.id}`).toBeTruthy();
      if (e.choices.length > 0) expect(e.choices.filter((c) => c.historical)).toHaveLength(1);
      expect(e.canon).toBe("C");
      for (const p of predecessorsOf(e)) expect(chronicle?.events.has(p), `${e.id} ← ${p}`).toBe(true);
    }
  });

  it("la chronique de 850 tient dans l'année même au pire : délais maximaux et décisions prises à l'échéance (D-67)", () => {
    const by = new Map(((chronicle?.canon ?? []).filter((e) => e.year_min === 850)).map((e) => [e.id, e]));
    const worst = (id: string): number => {
      const e = by.get(id);
      if (!e) return 0;
      const pred = predecessorsOf(e).filter((p) => by.has(p));
      return Math.max(0, ...pred.map(worst)) + (e.window.within_days?.[1] ?? 0) + (e.choices.length > 0 ? (chronicle?.balance.deadline_days ?? 0) : 0);
    };
    expect(worst("evt_850_serum_choice")).toBeLessThanOrEqual(355);
  });

  it("bifurcations B2–B5 portées par leurs événements (12 §2)", () => {
    const bif = new Map(((chronicle?.canon ?? []).filter((e) => e.year_min === 850)).filter((e) => e.bifurcation).map((e) => [e.code, e.bifurcation]));
    expect(bif.get("E12")).toBe("B2");
    expect(bif.get("E14")).toBe("B3");
    expect(bif.get("E33")).toBe("B4");
    expect(bif.get("E41")).toBe("B5");
  });

  it("morts canon : 12 personnages, chacun à son death_event, sur le chemin historique (11 §3, errata)", () => {
    const kills = new Map<string, string>();
    for (const e of (chronicle?.canon ?? []).filter((e) => e.year_min === 850)) {
      const hist = [...e.effects, ...e.choices.filter((c) => c.historical).flatMap((c) => c.effects)];
      // Un héritage préparé (P6) fait dévorer le porteur de 850 du Titan.
      for (const f of hist) if (f.op === "kill") kills.set(f.character, e.id);
      else if (f.op === "inherit") kills.set(world.shifters?.defs.get(f.shifter)?.holder_850.character ?? "?", e.id);
    }
    const pw = world.politics;
    for (const [who, ev] of kills) expect(pw?.characters.get(who)?.death_event, who).toBe(ev);
    expect([...kills.keys()].sort()).toEqual(["char_bertholdt_hoover", "char_eld", "char_erwin_smith", "char_gelgar", "char_gunther", "char_hannes", "char_kenny_ackerman", "char_mike_zacharias", "char_nanaba", "char_oluo", "char_petra", "char_rod_reiss"]);
  });

  it("≥ 30 événements génériques, les 7 familles du fichier 12 §5, chacun avec des choix à coût concret", () => {
    const generic = chronicle?.generic ?? [];
    expect(generic.length).toBeGreaterThanOrEqual(30);
    expect(new Set(generic.map((e) => e.family))).toEqual(new Set(["civil", "militaire", "politique", "personnage", "titans", "monde", "etranger"]));
    for (const e of generic) {
      expect(e.choices.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.choices.some((c) => c.effects.length > 0), e.id).toBe(true);
      expect(dict[`${e.text_key}.body`], e.id).toBeTruthy();
      expect(e.canon).toBe("A");
    }
  });
});
