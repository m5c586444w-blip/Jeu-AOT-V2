import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/sim/core/rng";
import { engage, evacuate, headcount, recover, vulnerability } from "../../../src/sim/tide";
import type { Geometry, Pile } from "../../../src/sim/tide";
import { pile, tb, tweak, weapon } from "./helpers";

const geo = (o: Partial<Geometry> = {}): Geometry => ({ distanceM: 200, flankA: 0, flankB: 0, visibility: 1, night: false, seen: { a: true, b: true }, ambusher: null, ...o });
const A = (o: Partial<Pile> = {}) => pile("a", "paradis", 0, 0, o);
const Z = (o: Partial<Pile> = {}) => pile("z", "marley", 200, 0, o);
const lost = (r: { killed: number; wounded: number }) => r.killed + r.wounded;

describe("(c) couvert, suppression et moral", () => {
  it("un fantassin à découvert sous le feu perd plus de moral qu'à couvert", () => {
    const open = engage(A(), Z({ cover: 0 }), geo(), 30, new Rng(1), tb).b;
    const covered = engage(A(), Z({ cover: 0.9 }), geo(), 30, new Rng(1), tb).b;
    expect(open.morale).toBeLessThan(covered.morale);
    expect(open.suppression).toBeGreaterThan(covered.suppression);
  });
  it("le couvert réduit aussi les pertes ; cover_k, suppress_cover_k et morale_cover_k sont de vrais leviers", () => {
    const base = (b = tb) => engage(A(), Z({ cover: 1 }), geo(), 30, new Rng(1), b);
    expect(lost(base().report.b)).toBeLessThan(lost(engage(A(), Z({ cover: 0 }), geo(), 30, new Rng(1), tb).report.b));
    expect(lost(base(tweak("combat", { cover_k: 0 })).report.b)).toBeGreaterThan(lost(base().report.b));
    expect(base(tweak("combat", { suppress_cover_k: 0 })).b.suppression).toBeGreaterThan(base().b.suppression);
    expect(base(tweak("combat", { morale_cover_k: 0 })).b.morale).toBeLessThan(base().b.morale);
  });
  it("la suppression réduit le feu de la pile clouée, le moral bas aussi", () => {
    const fresh = engage(A(), Z(), geo(), 30, new Rng(1), tb);
    const pinned = engage(A(), Z({ suppression: 1 }), geo(), 30, new Rng(1), tb);
    expect(lost(pinned.report.a)).toBeLessThan(lost(fresh.report.a));
    const shaky = engage(A(), Z({ morale: 0.3 }), geo(), 30, new Rng(1), tb);
    expect(lost(shaky.report.a)).toBeLessThan(lost(fresh.report.a));
    const fires = (b = tb) => lost(engage(A(), Z({ suppression: 1 }), geo(), 30, new Rng(1), b).report.a);
    expect(fires(tweak("combat", { suppress_fire_k: 0 }))).toBeGreaterThan(fires());
  });
  it("la déroute coupe presque tout le feu ; sous le seuil de moral la pile est en déroute", () => {
    const heavy = engage(A({ troops: { fusil: 3000 }, ammo: { fusil: 1e6 } }), Z({ troops: { fusil: 300 }, ammo: { fusil: 1e5 } }), geo({ distanceM: 50 }), 120, new Rng(2), tb);
    expect(heavy.b.routed).toBe(true);
    expect(heavy.b.morale).toBeLessThan(tb.combat.rout_threshold);
    const routedFire = engage(A(), Z({ routed: true }), geo(), 30, new Rng(1), tb).report.a;
    const normalFire = engage(A(), Z(), geo(), 30, new Rng(1), tb).report.a;
    expect(lost(routedFire)).toBeLessThan(lost(normalFire) * 0.5);
    expect(lost(engage(A(), Z({ routed: true }), geo(), 30, new Rng(1), tweak("combat", { rout_fire_mult: 1 })).report.a)).toBeGreaterThan(lost(routedFire));
  });
  it("flanquement : plus de pertes et plus de perte de moral pour la victime", () => {
    const front = engage(A(), Z(), geo({ flankA: 0 }), 30, new Rng(1), tb);
    const side = engage(A(), Z(), geo({ flankA: 1 }), 30, new Rng(1), tb);
    expect(lost(side.report.b)).toBeGreaterThan(lost(front.report.b));
    expect(side.b.morale).toBeLessThan(front.b.morale);
    const noFlankMorale = engage(A(), Z(), geo({ flankA: 1 }), 30, new Rng(1), tweak("combat", { flank_morale_k: 0 }));
    expect(noFlankMorale.b.morale).toBeGreaterThan(side.b.morale);
    expect(lost(engage(A(), Z(), geo({ flankA: 1 }), 30, new Rng(1), tweak("combat", { flank_fire_k: 0 })).report.b)).toBeLessThan(lost(side.report.b));
  });
  it("flanquement symétrique : flankB agit sur le feu de b et le moral de a comme flankA sur l'inverse", () => {
    const calm = tweak("combat", { noise_pct: 0 });
    const ab = engage(A(), Z(), geo({ flankA: 1 }), 30, new Rng(1), calm);
    const ba = engage(A(), Z(), geo({ flankB: 1 }), 30, new Rng(1), calm);
    expect(lost(ba.report.a)).toBeGreaterThan(lost(engage(A(), Z(), geo(), 30, new Rng(1), calm).report.a));
    expect(lost(ba.report.a)).toBeCloseTo(lost(ab.report.b), 9);
    expect(ba.a.morale).toBeCloseTo(ab.b.morale, 9);
    expect(ba.b.morale).toBeCloseTo(ab.a.morale, 9);
    expect(ba.a.morale).toBeLessThan(engage(A(), Z(), geo(), 30, new Rng(1), calm).a.morale);
  });
  it("visibilité et nuit réduisent la précision de tir (leviers fire_vis_floor et fire_night_mult)", () => {
    const loss = (g: Partial<Geometry>, b = tb) => lost(engage(A(), Z(), geo(g), 30, new Rng(1), b).report.b);
    const clear = loss({});
    expect(loss({ visibility: 0 })).toBeLessThan(clear);
    expect(loss({ visibility: 0.5 })).toBeGreaterThan(loss({ visibility: 0 }));
    expect(loss({ visibility: 0 })).toBeCloseTo(clear * tb.combat.fire_vis_floor, 9);
    expect(loss({ night: true })).toBeLessThan(clear);
    expect(loss({ night: true })).toBeCloseTo(clear * tb.combat.fire_night_mult, 9);
    expect(loss({ visibility: 0 }, tweak("combat", { fire_vis_floor: 1 }))).toBeCloseTo(clear, 9);
    expect(loss({ night: true }, tweak("combat", { fire_night_mult: 1 }))).toBeCloseTo(clear, 9);
  });
  it("non vu : tire à peine ; la distance réduit la précision ; hors de portée, aucun tir", () => {
    const blind = engage(A(), Z(), geo({ seen: { a: false, b: true } }), 30, new Rng(1), tb);
    expect(lost(blind.report.b)).toBeLessThan(lost(engage(A(), Z(), geo(), 30, new Rng(1), tb).report.b) * 0.5);
    expect(lost(engage(A(), Z(), geo({ distanceM: 400 }), 30, new Rng(1), tb).report.b)).toBeLessThan(lost(engage(A(), Z(), geo({ distanceM: 100 }), 30, new Rng(1), tb).report.b));
    const far = engage(A(), Z(), geo({ distanceM: weapon("fusil").range_m + 1 }), 30, new Rng(1), tb);
    expect(lost(far.report.b)).toBe(0);
    expect(far.report.roundsA).toBe(0);
  });
});

describe("munitions, gaz, armes", () => {
  it("les munitions tirées sont retirées du stock ; sans munitions, aucun tir ; le stock limite le tir", () => {
    const r = engage(A(), Z(), geo(), 30, new Rng(1), tb);
    expect(r.report.roundsA).toBeGreaterThan(0);
    expect(r.a.ammo["fusil"]).toBeCloseTo(5000 - r.report.roundsA, 9);
    const dry = engage(A({ ammo: { fusil: 0 } }), Z(), geo(), 30, new Rng(1), tb);
    expect(dry.report.roundsA).toBe(0);
    expect(lost(dry.report.b)).toBe(0);
    const little = engage(A({ ammo: { fusil: 10 } }), Z(), geo(), 600, new Rng(1), tb);
    expect(little.report.roundsA).toBeCloseTo(10, 9);
    expect(little.a.ammo["fusil"]).toBe(0);
    expect(lost(little.report.b)).toBeLessThan(lost(engage(A(), Z(), geo(), 600, new Rng(1), tb).report.b));
    const noAmmoCost = engage(A(), Z(), geo(), 30, new Rng(1), tweak("weapons", { ...tb.weapons, fusil: { ...weapon("fusil"), ammo_per_shot: 0 } }));
    expect(noAmmoCost.a.ammo["fusil"]).toBe(5000);
  });
  it("l'ODM consomme du gaz ; sans gaz il ne combat pas (P3 s'applique à la bataille humaine)", () => {
    const odm = (gas: number) => engage(A({ troops: { odm: 40 }, ammo: {}, gas }), Z({ cover: 0 }), geo({ distanceM: 60 }), 30, new Rng(1), tb);
    const wet = odm(1000);
    expect(wet.a.gas).toBeLessThan(1000);
    expect(lost(wet.report.b)).toBeGreaterThan(0);
    expect(odm(0).report.roundsA).toBe(0);
    expect(lost(odm(0).report.b)).toBe(0);
    expect(wet.a.gas).toBeCloseTo(1000 - 40 * weapon("odm").gas_per_min * 0.5, 6);
    const half = odm(40 * weapon("odm").gas_per_min * 0.25);
    expect(half.a.gas).toBeCloseTo(0, 9);
    expect(lost(half.report.b)).toBeLessThan(lost(wet.report.b));
  });
  it("l'ODM contre des fusils : sans ancrages un soldat en vol est une cible, avec ancrages il esquive", () => {
    const rifles = Z();
    const withAnchors = vulnerability(A({ troops: { odm: 50 }, anchors: 1 }), tb);
    const noAnchors = vulnerability(A({ troops: { odm: 50 }, anchors: 0 }), tb);
    expect(noAnchors).toBeGreaterThan(1);
    expect(withAnchors).toBeLessThan(1);
    expect(vulnerability(A({ troops: { odm: 50 }, anchors: 0, cover: 1 }), tb)).toBe(noAnchors); // le couvert ne protège pas un soldat en vol
    expect(vulnerability(rifles, tb)).toBe(1);
    expect(vulnerability(Z({ cover: 1 }), tb)).toBeCloseTo(1 - tb.combat.cover_k, 12);
    expect(vulnerability(A({ troops: {} }), tb)).toBe(1);
    const hit = (anchors: number) => lost(engage(Z({ troops: { fusil_repetition: 200 }, ammo: { fusil_repetition: 1e5 } }), A({ troops: { odm: 50 }, anchors, gas: 100 }), geo(), 30, new Rng(1), tb).report.b);
    expect(hit(0)).toBeGreaterThan(hit(1));
    // la mobilité de l'ODM n'est pas gratuite : même troupe au sol, à découvert, perd moins qu'en vol sans ancrage
    expect(hit(0)).toBeGreaterThan(lost(engage(Z({ troops: { fusil_repetition: 200 }, ammo: { fusil_repetition: 1e5 } }), A({ troops: { fusil: 50 }, cover: 0 }), geo(), 30, new Rng(1), tb).report.b));
  });
  it("artillerie et mortiers font plus de victimes sur une cible massée (zone) ; dirigeable, mitrailleuse et cavalerie ont des effets propres", () => {
    const shell = (troops: number, w = "artillerie") => lost(engage(A({ troops: { [w]: 4 }, ammo: { [w]: 100 } }), Z({ troops: { fusil: troops } }), geo({ distanceM: 150 }), 30, new Rng(1), tb).report.b);
    expect(shell(400)).toBeGreaterThan(shell(40));
    expect(shell(400, "mortier")).toBeGreaterThan(shell(40, "mortier"));
    const point = shell(40);
    const noArea = tweak("weapons", { ...tb.weapons, artillerie: { ...weapon("artillerie"), area: 1 } });
    expect(lost(engage(A({ troops: { artillerie: 4 }, ammo: { artillerie: 100 } }), Z({ troops: { fusil: 400 } }), geo({ distanceM: 150 }), 30, new Rng(1), noArea).report.b)).toBeLessThan(shell(400));
    expect(point).toBeGreaterThan(0);
    expect(shell(400, "fusil")).toBeCloseTo(shell(40, "fusil"), 9); // une arme ponctuelle ne profite pas de la masse
    for (const w of ["mitrailleuse", "cavalerie", "dirigeable", "fusil_repetition"]) {
      expect(lost(engage(A({ troops: { [w]: 20 }, ammo: { [w]: 5000 } }), Z(), geo({ distanceM: 80 }), 30, new Rng(1), tb).report.b)).toBeGreaterThan(0);
    }
    // les armes inconnues sont ignorées
    expect(lost(engage(A({ troops: { epee_magique: 99 } }), Z(), geo(), 30, new Rng(1), tb).report.b)).toBe(0);
  });
});

describe("invariants : conservation, monotonie, déterminisme", () => {
  it("effectif + blessés + morts + évacués est constant à chaque échange, évacuation et récupération", () => {
    let a = A({ troops: { fusil: 300, odm: 20 }, gas: 200, anchors: 0.5 });
    let z = Z({ troops: { fusil_repetition: 200, artillerie: 3 }, ammo: { fusil_repetition: 5000, artillerie: 90 } });
    const total = headcount(a);
    const totalZ = headcount(z);
    const rng = new Rng(9);
    for (let i = 0; i < 40; i++) {
      const r = engage(a, z, geo({ flankA: 0.4, flankB: 0.2, distanceM: 120 }), 20, rng, tb);
      a = evacuate(recover(r.a, 20, tb), 20, tb);
      z = evacuate(recover(r.b, 20, tb), 20, tb);
      expect(headcount(a)).toBeCloseTo(total, 9);
      expect(headcount(z)).toBeCloseTo(totalZ, 9);
      for (const v of [...Object.values(a.troops), ...Object.values(a.ammo), a.gas, a.wounded, a.dead, a.evacuated, a.suppression]) expect(v).toBeGreaterThanOrEqual(0);
      expect(a.morale).toBeGreaterThanOrEqual(0);
      expect(a.morale).toBeLessThanOrEqual(1);
    }
    expect(a.dead + z.dead).toBeGreaterThan(0);
  });
  it("jamais plus de pertes que d'effectif ; la part de blessés suit wounded_share", () => {
    const r = engage(A({ troops: { fusil: 3000 }, ammo: { fusil: 1e7 } }), Z({ troops: { fusil: 2 } }), geo({ distanceM: 10 }), 600, new Rng(1), tb);
    expect(r.report.b.killed + r.report.b.wounded).toBeLessThanOrEqual(2 + 1e-9);
    expect(sum(r.b.troops)).toBeCloseTo(0, 9);
    const m = engage(A(), Z(), geo(), 30, new Rng(1), tb).report.b;
    expect(m.wounded / (m.wounded + m.killed)).toBeCloseTo(tb.combat.wounded_share, 9);
  });
  it("monotonie : plus de tireurs ou de temps → plus de pertes ; déterminisme à graine égale, bruit borné", () => {
    const l = (n: number, t: number) => lost(engage(A({ troops: { fusil: n } }), Z(), geo(), t, new Rng(4), tb).report.b);
    expect(l(200, 30)).toBeGreaterThan(l(100, 30));
    expect(l(100, 60)).toBeGreaterThan(l(100, 30));
    expect(JSON.stringify(engage(A(), Z(), geo(), 30, new Rng(4), tb))).toBe(JSON.stringify(engage(A(), Z(), geo(), 30, new Rng(4), tb)));
    const vals = [1, 2, 3, 4, 5, 6].map((s) => lost(engage(A(), Z(), geo(), 30, new Rng(s), tb).report.b));
    expect(new Set(vals).size).toBeGreaterThan(1);
    const mean = vals.reduce((x, y) => x + y, 0) / vals.length;
    for (const v of vals) expect(Math.abs(v - mean) / mean).toBeLessThan(2 * tb.combat.noise_pct);
    expect(() => engage(A(), Z(), geo(), -1, new Rng(1), tb)).toThrow();
  });
  it("évacuation et récupération suivent leurs taux", () => {
    const hurt = Z({ wounded: 100, suppression: 0.8, morale: 0.1, routed: true });
    const e = evacuate(hurt, 60, tb);
    expect(e.wounded).toBeCloseTo(100 * (1 - tb.combat.evac_per_min), 9);
    expect(e.evacuated).toBeCloseTo(100 * tb.combat.evac_per_min, 9);
    expect(evacuate(hurt, 1e6, tb).wounded).toBe(0);
    const r = recover(hurt, 60, tb);
    expect(r.suppression).toBeCloseTo(0.8 * Math.pow(0.5, 60 / tb.combat.suppress_half_life_s), 9);
    expect(r.morale).toBeGreaterThan(0.1);
    expect(recover(hurt, 60, tweak("combat", { morale_recovery_per_min: 0 })).morale).toBe(0.1);
    const back = recover({ ...hurt, morale: tb.combat.rout_threshold - 0.001, suppression: 0 }, 600, tb);
    expect(back.routed).toBe(false);
  });
});

const sum = (r: Record<string, number>): number => Object.values(r).reduce((s, n) => s + n, 0);
