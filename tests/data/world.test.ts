import { describe, expect, it } from "vitest";
import { CANON_CHAINS } from "../../src/data/canonRules";
import { loadDataDir } from "../../src/data/loadNode";
import { isDomestic } from "../../src/sim/politics/vocabulary";
import fr from "../../src/i18n/fr.json";

const { data, issues } = loadDataDir("data");
const dict = fr as Record<string, string>;

describe("données du monde de P7 (AC7-01, 06 §3)", () => {
  it("données valides", () => expect(issues).toEqual([]));

  it("60 provinces du monde (30 Marley, 8 Hizuru, 14 Alliés, 8 zones maritimes) et l'île Paradis, toutes nommées", () => {
    const by = (f: string): number => data.world_provinces.filter((p) => p.faction === f).length;
    expect([by("fac_marley"), by("fac_hizuru"), by("fac_allies"), by("mer"), by("fac_paradis")]).toEqual([30, 8, 14, 8, 1]);
    for (const p of data.world_provinces) expect(dict[p.name_key], p.id).toBeTruthy();
    // Lieux canon de 06 §3 (C) : Liberio, zone d'internement, Fort Slava, domaine Azumabito.
    const canon = data.world_provinces.filter((p) => p.canon === "C").map((p) => p.code).sort();
    expect(canon).toEqual(expect.arrayContaining(["MA02", "MA03", "MA04", "HZ02"]));
  });

  it("graphe symétrique et connexe ; une province de terre touchant une mer est côtière ; Paradis n'est joignable que par la mer", () => {
    const byId = new Map(data.world_provinces.map((p) => [p.id, p]));
    for (const p of data.world_provinces) for (const a of p.adjacent) expect(byId.get(a)?.adjacent, `${p.id} ↔ ${a}`).toContain(p.id);
    const seen = new Set<string>();
    const todo = ["wprov_liberio"];
    while (todo.length) {
      const x = todo.pop() as string;
      if (seen.has(x)) continue;
      seen.add(x);
      todo.push(...(byId.get(x)?.adjacent ?? []));
    }
    expect(seen.size).toBe(data.world_provinces.length);
    for (const p of data.world_provinces) if (p.faction !== "mer" && p.adjacent.some((a) => byId.get(a)?.faction === "mer")) expect(p.coastal, p.id).toBe(true);
    expect(byId.get("wprov_paradis")?.adjacent.every((a) => byId.get(a)?.faction === "mer")).toBe(true);
    // Front du Moyen-Orient : Fort Slava touche la Forteresse du Passage (12 E50, E53).
    expect(byId.get("wprov_fort_slava")?.adjacent).toContain("wprov_forteresse_passage");
  });

  it("4 nations ; Paradis et Marley jouables ; Marley vise le Fondateur, Hizuru des garanties (02 §14)", () => {
    expect(data.factions.map((f) => f.id).sort()).toEqual(["fac_allies", "fac_hizuru", "fac_marley", "fac_paradis"]);
    expect(data.factions.filter((f) => f.playable).map((f) => f.id).sort()).toEqual(["fac_marley", "fac_paradis"]);
    expect(data.factions.find((f) => f.id === "fac_marley")?.attractors).toContain("fondateur");
    expect(data.factions.find((f) => f.id === "fac_hizuru")?.attractors).toContain("garanties");
    for (const f of data.factions) for (const o of f.objectives) expect(dict[o], o).toBeTruthy();
  });

  it("formations de 10 §1.2–1.3 : armes de terre, d'air et de mer ; blindés « ? » désactivés", () => {
    const kinds = new Set(data.formations.map((f) => f.domain));
    expect([...kinds].sort()).toEqual(["air", "mer", "terre"]);
    expect(data.formations.filter((f) => f.faction === "fac_marley")).toHaveLength(18);
    const tank = data.formations.find((f) => f.kind === "blindes");
    expect(tank?.canon).toBe("?");
    expect(tank?.enabled).toBe(false);
    for (const f of data.formations) expect(dict[f.name_key], f.id).toBeTruthy();
  });

  it("personnages de Marley, d'Hizuru, des Alliés et des Volontaires : hors des registres de Paradis ; porteurs rattachés à 11 §4", () => {
    const foreign = data.characters.filter((c) => !isDomestic(c));
    expect(foreign.length).toBeGreaterThanOrEqual(25);
    for (const id of ["char_zeke_yeager", "char_pieck_finger", "char_porco_galliard", "char_falco_grice", "char_willy_tybur", "char_theo_magath", "char_kiyomi_azumabito", "char_yelena", "char_onyankopon"]) expect(foreign.map((c) => c.id), id).toContain(id);
    const holders = new Set(data.shifters.flatMap((s) => s.chain.map((c) => c.holder)));
    for (const id of ["char_zeke_yeager", "char_pieck_finger", "char_lara_tybur", "char_porco_galliard", "char_falco_grice"]) expect(holders.has(id), id).toBe(true);
    for (const s of data.shifters) expect(s.chain.map((c) => c.name)).toEqual((CANON_CHAINS[s.id] ?? []).map((x) => x[0]));
  });

  it("scénario 854 : morts de 850 au départ, porteurs de 854, guerre Marley–Alliés en cours, Paradis ou Marley au choix", () => {
    const s = data.scenarios.find((x) => x.id === "scn_854");
    expect(s?.start).toEqual({ year: 854, day: 1 });
    expect(s?.deceased).toEqual(expect.arrayContaining(["char_erwin_smith", "char_bertholdt_hoover", "char_ymir"]));
    expect(s?.shifter_holders["shifter_colossal"]?.character).toBe("char_armin_arlert");
    expect(s?.shifter_holders["shifter_machoire"]?.character).toBe("char_porco_galliard");
    expect(s?.world?.wars).toEqual([["fac_marley", "fac_allies"]]);
    expect(s?.world?.playable).toEqual(["fac_paradis", "fac_marley"]);
    expect(dict[s?.name_key ?? ""]).toBeTruthy();
  });
});
