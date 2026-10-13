import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/sim/core/rng";
import { anchorDensityMap, anchorPath, createLedger, destroyAnchors, estimateDensityMap, meanDensity, tryAnchor, validAnchorsNear } from "../../../src/sim/gas";
import { gb, hook, mapOf } from "./helpers";

describe("P3 réseau d'ancrage", () => {
  it("ancrage impossible sans support : point isolé hors de portée → null", () => {
    const m = mapOf("tmap_plaine");
    const far = { x: -5000, y: -5000, z: 0 };
    expect(tryAnchor(m, createLedger(), gb, far, { x: 0, y: 0, z: 10 }, hook)).toBeNull();
    expect(anchorPath(m, createLedger(), gb, far, { x: 100, y: 100, z: 5 }, hook)).toBeNull();
  });

  it("l'ancrage choisi est valide et à portée", () => {
    const m = mapOf("tmap_foret");
    const ledger = createLedger();
    const a = m.anchors[0];
    if (!a) throw new Error();
    const from = { x: a.x + 10, y: a.y, z: a.z - 2 };
    const got = tryAnchor(m, ledger, gb, from, { x: a.x, y: a.y, z: a.z }, hook);
    expect(got).not.toBeNull();
    expect(Math.hypot((got?.x ?? 0) - from.x, (got?.y ?? 0) - from.y, (got?.z ?? 0) - from.z)).toBeLessThanOrEqual(hook);
  });

  it("la destruction est monotone et supprime des ancrages valides (pure : le registre d'origine est intact)", () => {
    const m = mapOf("tmap_foret");
    const a = m.anchors[0];
    if (!a) throw new Error();
    const at = { x: a.x, y: a.y, z: a.z };
    const l0 = createLedger();
    const n0 = validAnchorsNear(m, l0, gb, at, 30).length;
    const l1 = destroyAnchors(m, l0, gb, "titan", at);
    const l2 = destroyAnchors(m, l1, gb, "incendie", at);
    const n1 = validAnchorsNear(m, l1, gb, at, 30).length;
    const n2 = validAnchorsNear(m, l2, gb, at, 30).length;
    expect(Object.keys(l0.damage)).toHaveLength(0);
    expect(n1).toBeLessThan(n0);
    expect(n2).toBeLessThanOrEqual(n1);
  });

  it("supprimer un ancrage change les chemins possibles (spec 26 test d)", () => {
    const m = mapOf("tmap_foret");
    const ledger = createLedger();
    let found = false;
    // Cherche une paire (départ, but) distante de plus de deux portées de crochet, reliée par un chemin d'au moins un ancrage intermédiaire.
    outer: for (const s of m.anchors.filter((_, i) => i % 7 === 0)) {
      const from = { x: s.x, y: s.y, z: s.z };
      for (const to of m.anchors.filter((_, i) => i % 11 === 0)) {
        const goal = { x: to.x, y: to.y, z: to.z };
        if (Math.hypot(goal.x - from.x, goal.y - from.y) < hook * 1.8) continue;
        const p0 = anchorPath(m, ledger, gb, from, goal, hook);
        if (!p0 || p0.length < 2) continue;
        const mid = m.anchors[p0[Math.floor(p0.length / 2)] as number];
        if (!mid) continue;
        const l1 = destroyAnchors(m, ledger, gb, "demolition", { x: mid.x, y: mid.y, z: mid.z });
        const p1 = anchorPath(m, l1, gb, from, goal, hook);
        expect(JSON.stringify(p1)).not.toBe(JSON.stringify(p0));
        found = true;
        break outer;
      }
    }
    expect(found).toBe(true);
  });

  it("carte d'ancrage : la forêt est plus riche que la plaine ; le total des secteurs = ancrages valides", () => {
    const f = mapOf("tmap_foret");
    const p = mapOf("tmap_plaine");
    const df = anchorDensityMap(f, createLedger(), gb);
    const dp = anchorDensityMap(p, createLedger(), gb);
    expect(meanDensity(df)).toBeGreaterThan(meanDensity(dp));
    expect(df.reduce((t, s) => t + s.count, 0)).toBe(f.anchors.filter((a) => a.solidity >= gb.anchor.min_solidity).length);
  });

  it("estimation : déterministe à graine égale, fourchette plus étroite avec plus de renseignement", () => {
    const truth = anchorDensityMap(mapOf("tmap_foret"), createLedger(), gb);
    const e1 = estimateDensityMap(truth, gb, 0.2, new Rng(7));
    const e2 = estimateDensityMap(truth, gb, 0.2, new Rng(7));
    expect(e1).toEqual(e2);
    const hi = estimateDensityMap(truth, gb, 0.9, new Rng(7));
    expect(hi[0]?.error ?? 1).toBeLessThan(e1[0]?.error ?? 0);
    for (const [i, t] of truth.entries()) {
      const e = e1[i];
      if (!e) throw new Error();
      expect(e.high).toBeGreaterThanOrEqual(e.low);
      expect(t.perHa).toBeGreaterThanOrEqual(e.low - 1e-9);
      expect(t.perHa).toBeLessThanOrEqual(e.high + 1e-9);
    }
  });

  it("déterminisme : même carte, même registre → mêmes résultats", () => {
    const m = mapOf("tmap_foret");
    const a = m.anchors[3];
    if (!a) throw new Error();
    const at = { x: a.x, y: a.y, z: a.z };
    expect(JSON.stringify(destroyAnchors(m, createLedger(), gb, "titan", at))).toBe(JSON.stringify(destroyAnchors(m, createLedger(), gb, "titan", at)));
  });
});
