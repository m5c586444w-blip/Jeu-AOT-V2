import { describe, expect, it } from "vitest";
import {
  createRegistry, enlistGenerated, enlistNamed, getSoldier, inscribe, memoryWeight, raiseStele, recordBattle, registerDeath, RegistryError, registryViolations, standing,
} from "../../../src/sim/registry";
import type { RegistryState } from "../../../src/sim/registry";
import { D0, FA, FB, rbal, rng, withPath } from "./helpers";

const code = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    return e instanceof RegistryError ? e.code : `autre:${(e as Error).message}`;
  }
  return "aucune";
};

const troop = (faction = FA, n = 6): { s: RegistryState; ids: string[] } => {
  const g = enlistGenerated(createRegistry(), { faction, squad: "sq", count: n, day: D0 - 500 }, rbal);
  return { s: g.state, ids: g.ids };
};
const die = (s: RegistryState, id: string, day: number, cause = "frappe", place = "Trost"): RegistryState =>
  registerDeath(s, { soldier: id, day, cause, place, circumstances: "x" }, rng(1), rbal).state;

describe("P7 stèles", () => {
  it("une stèle porte un titre et une épitaphe tirés des tables, le lieu, et son coût est renvoyé ; le nombre par faction est limité", () => {
    let s = createRegistry();
    const r = raiseStele(s, FA, "Trost", D0, rng(2), rbal);
    expect(r.cost).toBe(rbal.stele.cost);
    s = r.state;
    const st = s.steles[0];
    expect(st?.id).toBe("ste_001");
    expect(rbal.stele.titles.map((t) => t.replace("{place}", "Trost"))).toContain(st?.title);
    expect(rbal.stele.epitaphs).toContain(st?.epitaph);
    const again = raiseStele(createRegistry(), FA, "Trost", D0, rng(2), rbal).state.steles[0];
    expect(again).toEqual(st);
    for (let i = 1; i < rbal.stele.max_per_faction; i++) s = raiseStele(s, FA, `L${i}`, D0, rng(2), rbal).state;
    expect(code(() => raiseStele(s, FA, "Encore", D0, rng(2), rbal))).toBe("trop_de_steles");
    expect(code(() => raiseStele(s, FB, "Encore", D0, rng(2), rbal))).toBe("aucune");
    expect(code(() => raiseStele(s, FB, "", D0, rng(2), rbal))).toBe("faction_ou_lieu_vide");
  });

  it("gravure manuelle : un mort, une fois, sur une stèle de sa faction, dans la limite de la capacité", () => {
    const { s: s0, ids } = troop();
    let s = raiseStele(s0, FA, "Trost", D0, rng(2), rbal).state;
    s = die(s, ids[0] as string, D0);
    expect(code(() => inscribe(s, "ste_001", ids[1] as string, D0, rbal))).toBe("pas_de_dossier_de_mort");
    expect(code(() => inscribe(s, "ste_099", ids[0] as string, D0, rbal))).toBe("stele_inconnue");
    const g = inscribe(s, "ste_001", ids[0] as string, D0 + 1, rbal);
    expect(g.steles[0]?.inscribed).toEqual([ids[0]]);
    expect(g.deaths[0]?.inscribed).toBe("ste_001");
    expect(code(() => inscribe(g, "ste_001", ids[0] as string, D0 + 2, rbal))).toBe("deja_grave");
    expect(registryViolations(g, rbal)).toEqual([]);
    const foe = raiseStele(g, FB, "Ailleurs", D0, rng(2), rbal).state;
    const s2 = die(s, ids[1] as string, D0);
    expect(code(() => inscribe({ ...foe, deaths: s2.deaths, soldiers: s2.soldiers }, "ste_002", ids[1] as string, D0, rbal))).toBe("stele_autre_faction");
    const tiny = withPath(rbal, "stele.capacity", 1);
    expect(code(() => inscribe(inscribe(s2, "ste_001", ids[0] as string, D0, tiny), "ste_001", ids[1] as string, D0, tiny))).toBe("stele_pleine");
  });

  it("gravure automatique des nommés seulement (stele.auto_named) : stèle du lieu, sinon la première avec de la place", () => {
    let s = createRegistry();
    s = raiseStele(s, FA, "Trost", D0, rng(2), rbal).state;
    s = raiseStele(s, FA, "Karanes", D0, rng(2), rbal).state;
    const n1 = enlistNamed(s, { faction: FA, squad: "sq", rank: "soldat", day: D0 - 10, name: "Anton Albrecht" }, rng(1), rbal);
    const n2 = enlistNamed(n1.state, { faction: FA, squad: "sq", rank: "soldat", day: D0 - 10, name: "Bertram Brenner" }, rng(1), rbal);
    const g = enlistGenerated(n2.state, { faction: FA, squad: "sq", count: 1, day: D0 - 10 }, rbal);
    let t = die(g.state, n1.id, D0, "frappe", "Karanes");
    t = die(t, n2.id, D0, "frappe", "Ailleurs");
    t = die(t, g.ids[0] as string, D0, "frappe", "Trost");
    expect(t.deaths.map((d) => d.inscribed)).toEqual(["ste_002", "ste_001", null]);
    const off = registerDeath(g.state, { soldier: n1.id, day: D0, cause: "frappe", place: "Karanes", circumstances: "x" }, rng(1), withPath(rbal, "stele.auto_named", false));
    expect(off.file.inscribed).toBeNull();
    // sans stèle, rien n'est gravé
    const none = registerDeath(enlistNamed(createRegistry(), { faction: FA, squad: "sq", rank: "soldat", day: D0 - 1, name: "X Y" }, rng(1), rbal).state, { soldier: "nom_0001", day: D0, cause: "frappe", place: "T", circumstances: "x" }, rng(1), rbal);
    expect(none.file.inscribed).toBeNull();
    expect(registryViolations(t, rbal)).toEqual([]);
  });
});

describe("P7 le public réagit aux pertes (opinion, légitimité, recrutement)", () => {
  it("sans perte : rien ne bouge (opinion 0, légitimité 0, recrutement 1)", () => {
    const { s } = troop();
    expect(standing(s, FA, D0, rbal)).toEqual({ opinion: 0, legitimacy: 0, recruitment: 1 });
  });

  it("la mémoire décroît avec la demi-vie et s'éteint hors de la fenêtre ; pas d'effet avant la mort", () => {
    expect(memoryWeight(D0, D0, rbal)).toBe(1);
    expect(memoryWeight(D0, D0 + rbal.memory.half_life_days, rbal)).toBeCloseTo(0.5, 9);
    expect(memoryWeight(D0, D0 + rbal.memory.window_days + 1, rbal)).toBe(0);
    expect(memoryWeight(D0, D0 - 1, rbal)).toBe(0);
    const { s, ids } = troop();
    const t = die(s, ids[0] as string, D0);
    const a = standing(t, FA, D0, rbal);
    const b = standing(t, FA, D0 + 120, rbal);
    expect(a.opinion).toBeLessThan(b.opinion);
    expect(b.opinion).toBeLessThan(0);
    expect(a.recruitment).toBeLessThan(b.recruitment);
    expect(standing(t, FA, D0 + 400, rbal)).toEqual({ opinion: 0, legitimacy: 0, recruitment: 1 });
    expect(standing(t, FA, D0 - 5, rbal).opinion).toBe(0);
  });

  it("perdre un nommé célèbre pèse plus que perdre un généré ; l'opinion vaut exactement la formule de registry.json", () => {
    const n = enlistNamed(createRegistry(), { faction: FA, squad: "sq", rank: "soldat", day: D0 - 400, name: "Anton Albrecht" }, rng(1), rbal);
    let s = n.state;
    for (let d = 0; d < 10; d++) s = recordBattle(s, [n.id], D0 - 300 + d, rbal);
    const renown = getSoldier(s, n.id).renown;
    const g = troop();
    const named = standing(die(s, n.id, D0), FA, D0, rbal);
    const gen = standing(die(g.s, g.ids[0] as string, D0), FA, D0, rbal);
    expect(named.opinion).toBeLessThan(gen.opinion);
    expect(named.opinion).toBeCloseTo(0 - (rbal.opinion.per_named + renown * rbal.opinion.renown_scale), 9);
    expect(gen.opinion).toBeCloseTo(0 - rbal.opinion.per_generated, 9);
    expect(named.legitimacy).toBeCloseTo(0 - (rbal.legitimacy.named_base + renown * rbal.legitimacy.per_renown), 9);
    expect(gen.legitimacy).toBe(0);
    expect(named.recruitment).toBeCloseTo(1 - rbal.recruitment.per_named_loss, 9);
    expect(gen.recruitment).toBeCloseTo(1 - rbal.recruitment.per_loss, 9);
    // cause marquante : dévoré pèse plus qu'une maladie
    const dev = standing(die(g.s, g.ids[0] as string, D0, "devore"), FA, D0, rbal).opinion;
    const mal = standing(die(g.s, g.ids[0] as string, D0, "maladie"), FA, D0, rbal).opinion;
    expect(dev).toBeLessThan(mal);
  });

  it("la stèle apaise l'opinion et la légitimité, et aide le recrutement ; chaque nom gravé compte", () => {
    const n = enlistNamed(createRegistry(), { faction: FA, squad: "sq", rank: "soldat", day: D0 - 400, name: "Anton Albrecht" }, rng(1), rbal);
    let s = n.state;
    for (let d = 0; d < 10; d++) s = recordBattle(s, [n.id], D0 - 300 + d, rbal);
    const without = die(s, n.id, D0);
    const withSt = die(raiseStele(s, FA, "Trost", D0 - 1, rng(2), rbal).state, n.id, D0);
    const a = standing(without, FA, D0, rbal);
    const b = standing(withSt, FA, D0, rbal);
    expect(withSt.deaths[0]?.inscribed).toBe("ste_001");
    expect(b.opinion).toBeGreaterThan(a.opinion);
    expect(b.opinion).toBeCloseTo(a.opinion * (1 - rbal.stele.opinion_relief), 9);
    expect(b.legitimacy).toBeCloseTo(a.legitimacy * (1 - rbal.stele.legitimacy_relief), 9);
    expect(b.recruitment - a.recruitment).toBeCloseTo(rbal.stele.recruit_bonus, 9);
    // hors fenêtre de mémoire, le bonus de recrutement des noms gravés demeure (la stèle se souvient)
    expect(standing(withSt, FA, D0 + 1000, rbal).recruitment).toBeCloseTo(1 + rbal.stele.recruit_bonus, 9);
    expect(standing(without, FA, D0 + 1000, rbal).recruitment).toBe(1);
  });

  it("plafonds : l'opinion et la légitimité ne dépassent pas leur cap ; le recrutement reste entre ses bornes", () => {
    let s = createRegistry();
    const ids: string[] = [];
    for (let i = 0; i < rbal.troop.named_cap; i++) {
      const r = enlistNamed(s, { faction: FA, squad: "sq", rank: "soldat", day: D0 - 400, name: `N${i}` }, rng(1), rbal);
      s = r.state;
      ids.push(r.id);
    }
    for (let d = 0; d < 20; d++) s = recordBattle(s, ids, D0 - 300 + d, rbal);
    for (const id of ids) s = die(s, id, D0, "devore");
    const st = standing(s, FA, D0, rbal);
    expect(st.opinion).toBe(-rbal.opinion.cap);
    expect(st.legitimacy).toBe(-rbal.legitimacy.cap);
    expect(st.recruitment).toBe(rbal.recruitment.min_factor);
  });

  it("par faction : les pertes d'un camp ne changent pas la situation de l'autre", () => {
    const a = troop(FA);
    const b = enlistGenerated(a.s, { faction: FB, squad: "sq", count: 3, day: D0 - 500 }, rbal);
    const before = standing(b.state, FB, D0, rbal);
    const after = standing(die(b.state, a.ids[0] as string, D0), FB, D0, rbal);
    expect(after).toEqual(before);
    expect(standing(die(b.state, a.ids[0] as string, D0), FA, D0, rbal).opinion).toBeLessThan(0);
  });
});
