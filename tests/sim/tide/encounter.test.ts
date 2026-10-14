import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/sim/core/rng";
import { createInitialState } from "../../../src/sim/core/state";
import { loadWorld } from "../../../src/data/worldNode";
import { projectEncounterForFaction, conditionMult, detectionRange, engage, injectBreach, reachOf, removeTitans, scanHumanEncounters, scanTitanEncounters, stepGrid, titanLambda, viewForFaction, viewForSeat } from "../../../src/sim/tide";
import type { Conditions, Geometry, Pile } from "../../../src/sim/tide";
import { NIGHT_WINTER, NOON, openGrid, pile, tb, tweak, weapon } from "./helpers";

const P = "paradis";
const M = "marley";
const hostile = (a: string, b: string) => a !== b;
const mid = 9000;

describe("λ des rencontres avec Titans (spec 26 §3)", () => {
  const g = openGrid(1);
  const p = pile("p", P, mid, mid);
  const lam = (pp: Pile, gg = g, c: Conditions = NOON) => titanLambda(pp, gg, c, [], tb);
  it("zéro sans Titan ; croît avec la densité", () => {
    expect(lam(p, openGrid(0))).toBe(0);
    expect(lam(p, openGrid(2))).toBeGreaterThan(lam(p, openGrid(1)));
  });
  it("croît avec chaque composante de l'empreinte (taille, bruit, fumée, artillerie)", () => {
    const base = lam(p);
    expect(lam(pile("p", P, mid, mid, { troops: { fusil: 1000 } }))).toBeGreaterThan(base);
    expect(lam(pile("p", P, mid, mid, { noise: 1 }))).toBeGreaterThan(base);
    expect(lam(pile("p", P, mid, mid, { smoke: 1 }))).toBeGreaterThan(base);
    expect(lam(pile("p", P, mid, mid, { troops: { fusil: 100, artillerie: 4 } }))).toBeGreaterThan(base);
  });
  it("nuit et hiver réduisent λ, sans l'annuler (Titan immobile rencontrable) ; la visibilité le réduit aussi", () => {
    const day = lam(p);
    const night = lam(p, g, NIGHT_WINTER);
    expect(night).toBeGreaterThan(0);
    expect(night).toBeLessThan(day);
    expect(lam(p, g, { ...NOON, season: "hiver" })).toBeLessThan(day);
    expect(lam(p, g, { ...NOON, visibility: 0 })).toBeLessThan(day);
    expect(lam(p, g, { ...NOON, visibility: 0.5 })).toBeGreaterThan(lam(p, g, { ...NOON, visibility: 0 }));
  });
  it("le bruit d'une grosse pile réveille les Titans de nuit : λ_nuit grimpe plus que la simple empreinte", () => {
    const quiet = pile("p", P, mid, mid, { troops: { fusil: 5 }, noise: 0 });
    const loud = pile("p", P, mid, mid, { troops: { fusil: 2500, artillerie: 6 }, noise: 1, smoke: 1 });
    const ratioDay = lam(loud) / lam(quiet);
    const ratioNight = lam(loud, g, NIGHT_WINTER) / lam(quiet, g, NIGHT_WINTER);
    expect(ratioNight).toBeGreaterThan(ratioDay);
  });
  it("tuer des Titans abaisse λ pour les convois suivants ; une brèche l'augmente", () => {
    const before = lam(p);
    const cleaned = removeTitans(g, mid, mid, 0.9).grid;
    expect(lam(p, cleaned)).toBeLessThan(before);
    const breach = injectBreach(openGrid(0), mid, mid, 3, tb).grid;
    expect(lam(pile("p", P, mid + 3000, mid), breach)).toBeGreaterThan(0);
  });
});

describe("tirage des rencontres avec Titans", () => {
  const g = openGrid(3);
  const piles = [pile("b", P, mid, mid), pile("a", M, mid + 2000, mid)];
  it("déterministe, indépendant de l'ordre des piles, différent selon la graine", () => {
    const r1 = scanTitanEncounters(g, piles, [], NOON, 1, 4, new Rng(11), tb);
    const r2 = scanTitanEncounters(g, [...piles].reverse(), [], NOON, 1, 4, new Rng(11), tb);
    expect(r1).toEqual(r2);
    const dt = 0.7 / titanLambda(piles[0] as Pile, g, NOON, [], tb);
    const counts = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => JSON.stringify(scanTitanEncounters(g, piles, [], NOON, dt, 4, new Rng(s), tb)));
    expect(new Set(counts).size).toBeGreaterThan(1);
  });
  it("la fréquence observée suit 1 − exp(−λ·dt)", () => {
    const p = [pile("a", P, mid, mid)];
    const lambda = titanLambda(p[0] as Pile, g, NOON, [], tb);
    const dt = 0.5 / lambda;
    let hits = 0;
    const N = 2000;
    for (let t = 0; t < N; t++) hits += scanTitanEncounters(g, p, [], NOON, dt, t, new Rng(5), tb).length;
    expect(hits / N).toBeGreaterThan(1 - Math.exp(-0.5) - 0.05);
    expect(hits / N).toBeLessThan(1 - Math.exp(-0.5) + 0.05);
  });
  it("densité nulle : aucune rencontre, même sur un très long pas", () => {
    expect(scanTitanEncounters(openGrid(0), piles, [], NOON, 1e6, 1, new Rng(1), tb)).toEqual([]);
  });
  it("le nombre de Titans suit la densité (group_k) et vaut au moins 1", () => {
    const dense = scanTitanEncounters(openGrid(6), [pile("a", P, mid, mid)], [], NOON, 1e6, 1, new Rng(1), tb)[0];
    const thin = scanTitanEncounters(openGrid(0.2), [pile("a", P, mid, mid)], [], NOON, 1e6, 1, new Rng(1), tb)[0];
    expect(dense?.titans).toBe(Math.round(6 * tb.encounter.group_k));
    expect(thin?.titans).toBe(1);
  });
});

describe("détection humaine (§3 bis)", () => {
  const a = pile("a", P, 0, 0);
  const z = pile("z", M, 5000, 0);
  const rng = (o: Partial<Pile>, c: Conditions = NOON, target = z) => detectionRange({ ...a, ...o }, target, c, tb);
  it("éclaireurs et renseignement étendent la portée ; météo et nuit la réduisent", () => {
    const base = rng({});
    expect(rng({ scouts: 1 })).toBeGreaterThan(base);
    expect(rng({ intel: 1 })).toBeGreaterThan(base);
    expect(rng({}, { ...NOON, visibility: 0.2 })).toBeLessThan(base);
    expect(rng({}, { ...NOON, hour: 23 })).toBeLessThan(base);
    expect(conditionMult(1, 12, tb)).toBe(1);
    expect(conditionMult(5, 12, tb)).toBe(1);
    expect(conditionMult(-1, 12, tb)).toBeCloseTo(tb.detection.vis_floor, 12);
  });
  it("une cible plus bruyante, enfumée, nombreuse ou avec artillerie est repérée de plus loin ; le couvert la cache", () => {
    const base = rng({});
    expect(rng({}, NOON, { ...z, noise: 1 })).toBeGreaterThan(base);
    expect(rng({}, NOON, { ...z, smoke: 1 })).toBeGreaterThan(base);
    expect(rng({}, NOON, { ...z, troops: { fusil: 2000 } })).toBeGreaterThan(base);
    expect(rng({}, NOON, { ...z, troops: { fusil: 100, artillerie: 5 } })).toBeGreaterThan(base);
    expect(rng({}, NOON, { ...z, concealment: 1 })).toBeLessThan(base);
  });
  it("portée de tir : armes approvisionnées seulement, réduite par la visibilité", () => {
    expect(reachOf(a, NOON, tb)).toBe(weapon("fusil").range_m);
    expect(reachOf({ ...a, ammo: {} }, NOON, tb)).toBe(0);
    expect(reachOf({ ...a, troops: { fusil: 100, artillerie: 2 }, ammo: { fusil: 1, artillerie: 1 } }, NOON, tb)).toBe(weapon("artillerie").range_m);
    expect(reachOf({ ...a, troops: { odm: 10 }, gas: 0 }, NOON, tb)).toBe(0);
    expect(reachOf({ ...a, troops: { odm: 10 }, gas: 50 }, NOON, tb)).toBe(weapon("odm").range_m);
    expect(reachOf({ ...a, troops: { cavalerie: 10 } }, NOON, tb)).toBe(weapon("cavalerie").range_m);
    expect(reachOf(a, { ...NOON, visibility: 0 }, tb)).toBeLessThan(reachOf(a, NOON, tb));
    expect(reachOf({ ...a, troops: { inconnue: 5 } }, NOON, tb)).toBe(0);
  });
});

describe("(a)(b) scénario Marley–Paradis à densité de Titans nulle", () => {
  const grid = openGrid(0);
  const mk = (): Pile[] => [
    pile("par_1", P, 3000, 9000, { troops: { fusil: 300, odm: 40, cavalerie: 30 }, ammo: { fusil: 3000 }, gas: 400, anchors: 0.6, scouts: 0.1 }),
    pile("mar_1", M, 9000, 9000, { troops: { fusil_repetition: 250, mitrailleuse: 10, mortier: 6, artillerie: 4 }, ammo: { fusil_repetition: 6000, mitrailleuse: 3000, mortier: 200, artillerie: 120 }, noise: 0.6, smoke: 0.3 }),
  ];
  function play(seed: number): { enc: number; fights: number; casualties: number; titanEnc: number; log: string } {
    let piles = mk();
    const rng = new Rng(seed);
    let enc = 0, fights = 0, casualties = 0, titanEnc = 0;
    for (let tick = 0; tick < 60; tick++) {
      titanEnc += scanTitanEncounters(grid, piles, [], NOON, 1, tick, rng, tb).length;
      // approche : chaque pile avance de 300 m par tick l'une vers l'autre tant qu'aucun contact
      const hs = scanHumanEncounters(piles, hostile, NOON, tick, tb);
      if (hs.length === 0) {
        piles = piles.map((p) => ({ ...p, x: p.x + (p.faction === P ? 300 : -300) }));
        continue;
      }
      enc += hs.length;
      for (const h of hs) {
        const ia = piles.findIndex((p) => p.id === h.a), ib = piles.findIndex((p) => p.id === h.b);
        const geo: Geometry = { distanceM: h.distanceM, flankA: 0, flankB: 0, visibility: 1, night: false, seen: h.seen, ambusher: h.ambusher };
        const r = engage(piles[ia] as Pile, piles[ib] as Pile, geo, 30, rng, tb);
        piles[ia] = r.a; piles[ib] = r.b;
        fights++;
        casualties += r.report.a.killed + r.report.a.wounded + r.report.b.killed + r.report.b.wounded;
      }
    }
    return { enc, fights, casualties, titanEnc, log: JSON.stringify(piles) };
  }
  it("produit des rencontres, des batailles et des pertes, sans aucune rencontre de Titan", () => {
    const r = play(7);
    expect(r.titanEnc).toBe(0);
    expect(r.enc).toBeGreaterThan(0);
    expect(r.fights).toBeGreaterThan(0);
    expect(r.casualties).toBeGreaterThan(5);
  });
  it("déterministe : même graine, même déroulement", () => {
    expect(play(7).log).toBe(play(7).log);
    expect(play(8).log).not.toBe(play(7).log);
  });
  it("hors de portée de détection, aucune rencontre ; deux camps alliés ne se rencontrent jamais", () => {
    expect(scanHumanEncounters([pile("a", P, 0, 0), pile("b", M, 90000, 0)], hostile, NOON, 0, tb)).toEqual([]);
    expect(scanHumanEncounters([pile("a", P, 0, 0), pile("b", P, 100, 0)], hostile, NOON, 0, tb)).toEqual([]);
    expect(scanHumanEncounters([pile("a", P, 0, 0), pile("b", M, 100, 0)], () => false, NOON, 0, tb)).toEqual([]);
  });
  it("une pile en déroute des deux côtés ne déclenche plus de contact", () => {
    expect(scanHumanEncounters([pile("a", P, 0, 0, { routed: true }), pile("b", M, 100, 0, { routed: true })], hostile, NOON, 0, tb)).toEqual([]);
    expect(scanHumanEncounters([pile("a", P, 0, 0, { routed: true }), pile("b", M, 100, 0)], hostile, NOON, 0, tb)).toHaveLength(1);
  });
  it("embuscade : celui qui voit sans être vu est désigné ; la nuit réduit les contacts lointains", () => {
    // a est dissimulé et bien renseigné : il voit z à 1 800 m, z ne le voit pas
    const a = pile("a", P, 0, 0, { scouts: 1, intel: 1, concealment: 1, noise: 0, troops: { artillerie: 4 }, ammo: { artillerie: 50 } });
    const z = pile("z", M, 1800, 0);
    const [e] = scanHumanEncounters([a, z], hostile, NOON, 3, tb);
    expect(e?.seen).toEqual({ a: true, b: false });
    expect(e?.ambusher).toBe("a");
    expect(e?.id).toBe("henc_3_a_z");
    const far = [pile("a", P, 0, 0, { troops: { artillerie: 4 }, ammo: { artillerie: 50 } }), pile("z", M, 2800, 0)];
    expect(scanHumanEncounters(far, hostile, NOON, 0, tb)).toHaveLength(1);
    expect(scanHumanEncounters(far, hostile, { ...NOON, hour: 23, visibility: 0.3 }, 0, tb)).toEqual([]);
  });
  it("le paramètre ambush_mult agit sur les pertes de la victime de l'embuscade", () => {
    const a = pile("a", P, 0, 0), z = pile("z", M, 200, 0);
    const geo: Geometry = { distanceM: 200, flankA: 0, flankB: 0, visibility: 1, night: false, seen: { a: true, b: false }, ambusher: "a" };
    const hi = engage(a, z, geo, 30, new Rng(1), tb).report.b;
    const lo = engage(a, z, geo, 30, new Rng(1), tweak("detection", { ambush_mult: 1 })).report.b;
    expect(hi.killed + hi.wounded).toBeGreaterThan(lo.killed + lo.wounded);
  });
});

describe("pas de fuite d'information entre factions", () => {
  const piles = [
    pile("p_own", P, 0, 0, { scouts: 0.5 }),
    pile("m_near", M, 2000, 0, { troops: { fusil_repetition: 123, mortier: 7 } }),
    pile("m_far", M, 80000, 0, { troops: { artillerie: 9 } }),
  ];
  it("une faction voit ses piles exactes, les ennemies repérées en estimation arrondie, et jamais celles hors de portée", () => {
    const v = viewForFaction(P, piles, NOON, tb);
    expect(v.own.map((p) => p.id)).toEqual(["p_own"]);
    expect(v.seen.map((s) => s.id)).toEqual(["m_near"]);
    expect((v.seen[0]?.sizeEstimate ?? 1) % tb.detection.size_bucket).toBe(0);
    expect(v.seen[0]?.sizeEstimate).toBe(Math.round(130 / tb.detection.size_bucket) * tb.detection.size_bucket);
    const json = JSON.stringify(v);
    expect(json).not.toContain("m_far");
    expect(json).not.toContain("mortier");
    expect(json).not.toContain("troops\":{\"fusil_repetition");
    expect(Object.keys(v.seen[0] ?? {}).sort()).toEqual(["faction", "id", "sizeEstimate", "x", "y"]);
  });
  it("la vue de l'autre camp ne contient pas la pile cachée de celui-ci", () => {
    const hidden = [pile("p_own", P, 0, 0, { concealment: 1, noise: 0, troops: { fusil: 5 } }), pile("m", M, 2400, 0)];
    expect(viewForFaction(M, hidden, NOON, tb).seen).toEqual([]);
    expect(viewForFaction(P, hidden, NOON, tb).seen.map((s) => s.id)).toEqual(["m"]);
  });
  it("coalition : avec un prédicat Hostility, les piles alliées sont toujours visibles ; sans, la détection s'applique", () => {
    const A2 = "alliee";
    const ps = [pile("p_own", P, 0, 0), pile("ally_far", A2, 80000, 0, { troops: { mortier: 3 } }), pile("m_far", M, 80000, 0)];
    const h = (a: string, z: string) => a !== z && a !== A2 && z !== A2 && !(a === P && z === A2);
    expect(viewForFaction(P, ps, NOON, tb).seen).toEqual([]);
    const v = viewForFaction(P, ps, NOON, tb, h);
    expect(v.seen.map((s) => s.id)).toEqual(["ally_far"]);
    expect(JSON.stringify(v)).not.toContain("mortier");
    expect(JSON.stringify(v)).not.toContain("m_far");
  });
  it("projection de rencontre : une faction ne reçoit jamais seen/ambusher de l'adversaire", () => {
    const a = pile("a", P, 0, 0, { scouts: 1, intel: 1, concealment: 1, noise: 0, troops: { artillerie: 4 }, ammo: { artillerie: 50 } });
    const z = pile("z", M, 1800, 0);
    const [e] = scanHumanEncounters([a, z], hostile, NOON, 3, tb);
    if (!e) throw new Error("rencontre attendue");
    expect(e.ambusher).toBe("a");
    const vp = projectEncounterForFaction(e, P, [a, z]);
    const vm = projectEncounterForFaction(e, M, [a, z]);
    expect(vp).toEqual({ id: e.id, own: "a", spotted: true, other: "z", otherFaction: M, distanceM: 1800 });
    // la victime de l'embuscade ne sait ni qui tire, ni d'où, ni qu'elle n'a pas été vue
    expect(vm).toEqual({ id: e.id, own: "z", spotted: false, other: null, otherFaction: null, distanceM: null });
    for (const v of [vp, vm]) {
      const json = JSON.stringify(v);
      expect(json).not.toContain("ambusher");
      expect(Object.keys(v ?? {})).not.toContain("seen");
    }
    expect(projectEncounterForFaction(e, "tiers", [a, z])).toBeNull();
    expect(projectEncounterForFaction(e, P, [])).toBeNull();
  });
  it("la nuit réduit ce qu'on voit", () => {
    expect(viewForFaction(P, piles, { ...NOON, hour: 23, visibility: 0.1 }, tb).seen).toEqual([]);
  });
  it("par siège : la faction est celle que dirige le siège ; siège inconnu = vue vide", () => {
    const st = { ...createInitialState(5, loadWorld("data", "scn_sandbox_850")), seats: { seats: { seat_1: { faction: P }, seat_2: { faction: M } } } };
    const v1 = viewForSeat(st, "seat_1", piles, NOON, tb);
    expect(v1.faction).toBe(P);
    expect(v1.own.map((p) => p.id)).toEqual(["p_own"]);
    expect(viewForSeat(st, "seat_2", piles, NOON, tb).own.map((p) => p.id)).toEqual(["m_far", "m_near"]);
    expect(viewForSeat(st, "seat_9", piles, NOON, tb)).toEqual({ faction: "", own: [], seen: [] });
  });
});

describe("intégration : l'effectif d'une pile alimente l'attention de la marée", () => {
  it("une pile détruite cesse d'attirer les Titans", () => {
    const g = openGrid(2);
    const p = pile("p", P, mid, mid, { troops: { fusil: 500 } });
    const noRepop = tweak("repop", { rate_per_h: 0 });
    const alive = stepGrid(g, { piles: [p], posts: [], hour: 12, season: "ete", dtH: 1 }, noRepop).grid;
    const dead = stepGrid(g, { piles: [{ ...p, troops: { fusil: 0 } }], posts: [], hour: 12, season: "ete", dtH: 1 }, noRepop).grid;
    expect(JSON.stringify(alive.density)).not.toBe(JSON.stringify(dead.density));
    expect(JSON.stringify(dead.density)).toBe(JSON.stringify(stepGrid(g, { piles: [], posts: [], hour: 12, season: "ete", dtH: 1 }, noRepop).grid.density));
  });
});
