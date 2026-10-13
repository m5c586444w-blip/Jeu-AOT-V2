import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/sim/core/rng";
import { CLEAR, errorRates, propagate, resolveCancellations, timeToReach } from "../../../src/sim/signal";
import { column, fan, sb, sig, unit } from "./helpers";

describe("P4 (b) relais et erreurs", () => {
  it("déterminisme : même graine, même résultat ; ordre des unités sans effet", () => {
    const a = propagate(sig(), fan(), CLEAR, "signal", new Rng(7), sb);
    const b = propagate(sig(), [...fan()].reverse(), CLEAR, "signal", new Rng(7), sb);
    expect(b).toEqual(a);
    expect(JSON.stringify(a)).toBe(JSON.stringify(propagate(sig(), fan(), CLEAR, "signal", new Rng(7), sb)));
  });
  it("une formation avec relais prévient le chef plus tôt qu'une colonne, à marge fixée (50 graines)", () => {
    let fanReached = 0;
    let colReached = 0;
    let fanBest = Infinity;
    for (let seed = 1; seed <= 50; seed++) {
      const f = propagate(sig(), fan(), CLEAR, "signal", new Rng(seed), sb);
      const c = propagate(sig(), column(), CLEAR, "signal", new Rng(seed), sb);
      const tf = timeToReach(f, "z_chef");
      const tc = timeToReach(c, "z_chef");
      if (tf < Infinity) fanReached++;
      if (tc < Infinity) colReached++;
      expect(tf).toBeLessThanOrEqual(tc); // jamais plus tard
      fanBest = Math.min(fanBest, tf);
    }
    expect(colReached).toBe(0); // colonne : chef hors de portée de l'éclaireur, aucun relais
    expect(fanReached).toBeGreaterThanOrEqual(35); // éventail : chaîne de 2 relais hors de vue directe, erreurs rares
    expect(fanBest).toBeCloseTo(sb.relay.see_delay_s + 2 * sb.relay.hop_delay_s, 5);
  });
  it("chaque relais ajoute un délai ; un maillon manquant coupe la chaîne", () => {
    const calm = { ...sb, errors: { ...sb.errors, wrong_code_base: 0, wet_flare_base: 0, wet_flare_rain_k: 0, misunderstand_base: 0, misunderstand_morale_k: 0 } };
    const r = propagate(sig(), fan(), CLEAR, "signal", new Rng(1), calm);
    const d = r.receptions.map((x) => x.delayS);
    expect(r.receptions.map((x) => x.unitId)).toEqual(["a_scout", "b_relais1", "c_relais2", "z_chef"]);
    expect(d).toEqual([2, 2, 8, 14]);
    expect(r.receptions.find((x) => x.unitId === "z_chef")?.path).toEqual(["b_relais1", "c_relais2", "z_chef"]);
    const cut = fan().filter((u) => u.id !== "c_relais2");
    const r2 = propagate(sig(), cut, CLEAR, "signal", new Rng(1), calm);
    expect(r2.unreached).toEqual(["z_chef"]);
    expect(timeToReach(r2, "z_chef")).toBe(Infinity);
  });
  it("fusée mouillée : le relais ne répète pas, la chaîne s'arrête", () => {
    const wet = { ...sb, errors: { ...sb.errors, wet_flare_base: 1, max_p: 1 } };
    const r = propagate(sig(), fan(), CLEAR, "signal", new Rng(3), wet);
    expect(r.receptions.map((x) => x.unitId)).toEqual(["a_scout", "b_relais1"]);
    expect(r.unreached).toEqual(["c_relais2", "z_chef"]);
    expect(r.receptions[0]?.error).toBe("fusee_mouillee");
  });
  it("mauvais code : la couleur comprise diffère et se propage", () => {
    const bad = { ...sb, errors: { ...sb.errors, wrong_code_base: 1, max_p: 1, wet_flare_base: 0, wet_flare_rain_k: 0 } };
    const r = propagate(sig(), fan(), CLEAR, "signal", new Rng(3), bad);
    expect(r.receptions[0]?.color).not.toBe("rouge");
    expect(r.receptions[0]?.error).toBe("mauvais_code");
  });
  it("taux d'erreur monotones : pluie, fumée ↑ ; moral ↑ → erreur ↓ ; éventail < colonne ; moderne < signal", () => {
    const u = unit("u", 0, { formation: "colonne", morale: 0.5 });
    const r = (o: Partial<typeof CLEAR>, m = 0.5, f = "colonne", t: "signal" | "moderne" = "signal") => errorRates({ ...u, morale: m, formation: f }, { ...CLEAR, ...o }, t, sb);
    expect(r({ rain: 1 }).wet).toBeGreaterThan(r({ rain: 0 }).wet);
    expect(r({ smoke: 1 }).smoke).toBeGreaterThan(r({ smoke: 0.6 }).smoke);
    expect(r({ smoke: 0.4 }).smoke).toBe(0);
    expect(r({}, 0.1).misunderstand).toBeGreaterThan(r({}, 0.9).misunderstand);
    expect(r({}, 0.5, "eventail").wrong).toBeLessThan(r({}, 0.5, "colonne").wrong);
    expect(r({}, 0.5, "colonne", "moderne").wrong).toBeLessThan(r({}, 0.5, "colonne", "signal").wrong);
  });
  it("communications modernes : délais réduits", () => {
    const calm = { ...sb, errors: { ...sb.errors, wrong_code_base: 0, wet_flare_base: 0, wet_flare_rain_k: 0, misunderstand_base: 0, misunderstand_morale_k: 0 } };
    const s = propagate(sig(), fan(), CLEAR, "signal", new Rng(1), calm);
    const m = propagate(sig(), fan(), CLEAR, "moderne", new Rng(1), calm);
    expect(timeToReach(m, "z_chef")).toBeLessThan(timeToReach(s, "z_chef"));
  });
  it("météo pire : la chaîne ne s'allonge jamais (portée ↓ → unités atteintes ↓)", () => {
    const calm = { ...sb, errors: { ...sb.errors, wrong_code_base: 0, wet_flare_base: 0, wet_flare_rain_k: 0, misunderstand_base: 0, misunderstand_morale_k: 0, smoke_garble_k: 0 } };
    let prev = Infinity;
    for (const rain of [0, 0.3, 0.6, 1]) {
      const n = propagate(sig(), fan(), { ...CLEAR, rain }, "signal", new Rng(1), calm).receptions.length;
      expect(n).toBeLessThanOrEqual(prev);
      prev = n;
    }
  });
  it("jaune de Garnison annule un rouge précédent du même secteur [C]", () => {
    const rouge = sig({ id: "r", branch: "garnison", color: "rouge", issuedAtS: 0 });
    const jaune = sig({ id: "j", branch: "garnison", color: "jaune", issuedAtS: 30 });
    const autre = sig({ id: "o", branch: "garnison", color: "rouge", sector: "ouest", issuedAtS: 0 });
    expect(resolveCancellations([rouge, jaune, autre], sb).map((s) => s.id)).toEqual(["j", "o"]);
    expect(resolveCancellations([jaune, sig({ id: "r2", branch: "garnison", color: "rouge", issuedAtS: 50 })], sb).map((s) => s.id)).toEqual(["j", "r2"]);
  });
});
