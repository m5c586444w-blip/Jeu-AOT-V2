import { describe, expect, it } from "vitest";
import { CANON_CHAINS } from "../../src/data/canonRules";
import { SHIFTER_EFFECTS } from "../../src/data/schemas";
import { loadWorld } from "../../src/data/worldNode";
import fr from "../../src/i18n/fr.json";

const world = loadWorld("data", "scn_sandbox_850");
const dict = fr as Record<string, string>;
const sw = world.shifters;
const shifters = sw?.order ?? [];

describe("les Neuf Titans (AC6-01, 03 §8, 11 §4)", () => {
  it("9 Titans, nommés, chacun avec au moins une capacité et un statut canon", () => {
    expect(shifters.map((s) => s.id).sort()).toEqual(Object.keys(CANON_CHAINS).sort());
    for (const s of shifters) {
      expect(dict[s.name_key], s.id).toBeTruthy();
      expect(s.abilities.length, s.id).toBeGreaterThan(0);
      expect(["C", "A", "?"]).toContain(s.canon);
    }
  });

  it("chaque capacité a coût, portée, délai, recharge, effet, limites et statut ; toutes nommées ; les passives ont une grandeur", () => {
    const effects = new Set<string>();
    for (const s of shifters)
      for (const a of s.abilities) {
        effects.add(a.effect);
        expect(a.cost, a.id).toBeGreaterThanOrEqual(0);
        expect(a.delay_s, a.id).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(a.power), a.id).toBe(true);
        if (a.passive) expect(a.power, `${a.id} : grandeur`).toBeGreaterThan(0);
        else {
          expect(a.range_m + a.radius_m + a.duration_s, `${a.id} : limites`).toBeGreaterThan(0);
          expect(a.cooldown_s, a.id).toBeGreaterThan(0);
        }
        expect(dict[`shifter.ability.${a.id}`], a.id).toBeTruthy();
      }
    // Les seize effets du vocabulaire sont tous portés par au moins une capacité.
    expect([...effects].sort()).toEqual([...SHIFTER_EFFECTS].sort());
  });

  it("chaînes de porteurs conformes à 11 §4 (noms, ordre, années données)", () => {
    for (const s of shifters) {
      const expected = CANON_CHAINS[s.id] ?? [];
      expect(s.chain.map((c) => c.name), s.id).toEqual(expected.map((x) => x[0]));
      expected.forEach(([, from, to], i) => {
        if (from !== null) expect(s.chain[i]?.from, s.id).toBe(from);
        if (to !== null) expect(s.chain[i]?.to, s.id).toBe(to);
      });
    }
  });

  it("porteurs en 850 : Eren (Assaillant, Fondateur), Ymir (Mâchoire), Reiner, Bertholdt et Annie ; Marley tient le reste sans nom inventé", () => {
    const holder = (id: string): string | null | undefined => sw?.defs.get(id)?.holder_850.character;
    expect(holder("shifter_assaillant")).toBe("char_eren_yeager");
    expect(holder("shifter_fondateur")).toBe("char_eren_yeager");
    expect(holder("shifter_machoire")).toBe("char_ymir");
    expect(holder("shifter_cuirasse")).toBe("char_reiner_braun");
    expect(holder("shifter_colossal")).toBe("char_bertholdt_hoover");
    expect(holder("shifter_feminin")).toBe("char_annie_leonhart");
    for (const id of ["shifter_bestial", "shifter_charrette", "shifter_marteau"]) {
      expect(holder(id), id).toBeNull();
      expect(sw?.defs.get(id)?.holder_850.faction, id).toBe("marley");
    }
    // Les dates d'héritage incertaines restent « ? » (11 §4 : dates de transfert de seconde main).
    expect(sw?.defs.get("shifter_cuirasse")?.holder_850.since_canon).toBe("?");
    for (const s of shifters) {
      const c = s.holder_850.character;
      if (c) expect(world.politics?.characters.get(c), c).toBeTruthy();
    }
  });

  it("le contrôle des purs du Fondateur exige le contact royal (02 §10)", () => {
    const f = sw?.defs.get("shifter_fondateur")?.abilities.find((a) => a.effect === "founder_command");
    expect(f?.requires_flag).toBe("royal_contact");
    expect(sw?.balance.curse_years).toBe(13);
  });
});
