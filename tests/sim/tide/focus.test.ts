import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/sim/core/rng";
import { interest, isSaturated, sizeClassOf, stepTitan, updateFocus } from "../../../src/sim/tide";
import type { Human, Titan } from "../../../src/sim/tide";
import { sizeCls, tb, tweak } from "./helpers";

const titan = (o: Partial<Titan> = {}): Titan => ({ id: "t1", x: 0, y: 0, sizeClass: "moyen", behavior: "marcheur", focus: null, ...o });
const human = (id: string, x: number, o: Partial<Human> = {}): Human => ({ id, x, y: 0, group: 1, noise: 0, moving: false, ...o });

describe("(d) focus : le modèle d'attention remplace « le plus proche »", () => {
  it("un appât bien placé détourne un Titan d'un soldat plus proche", () => {
    const soldier = human("soldat", 40);
    const bait = human("appat", 120, { noise: 1, moving: true, bait: true });
    const t = updateFocus(titan(), [soldier, bait], false, 1, new Rng(1), tb);
    expect(t.focus?.target).toBe("appat");
    // sans le bruit ni le mouvement de l'appât, le plus proche gagne
    const silent = updateFocus(titan(), [soldier, human("appat", 120, { bait: false })], false, 1, new Rng(1), tb);
    expect(silent.focus?.target).toBe("soldat");
    // bait_mult est un vrai levier
    const weak = updateFocus(titan(), [soldier, bait], false, 1, new Rng(1), tweak("focus", { bait_mult: 0.01 }));
    expect(weak.focus?.target).toBe("soldat");
  });
  it("un groupe compact attire plus qu'un homme isolé, à égale distance", () => {
    const crowd = human("groupe", 150, { group: 12 });
    const lone = human("seul", 150);
    expect(interest(titan(), crowd, tb)).toBeGreaterThan(interest(titan(), lone, tb));
    expect(updateFocus(titan(), [lone, crowd], false, 1, new Rng(1), tb).focus?.target).toBe("groupe");
    expect(updateFocus(titan(), [lone, human("groupe", 150, { group: 12 })], false, 1, new Rng(1), tweak("focus", { w_group: 0 })).focus?.target).toBe("groupe"); // à égalité, l'identifiant décide (déterminisme)
  });
  it("l'intérêt décroît avec la distance, est nul hors de portée, et croît avec bruit et mouvement", () => {
    const at = (x: number, o: Partial<Human> = {}) => interest(titan(), human("h", x, o), tb);
    expect(at(50)).toBeGreaterThan(at(300));
    expect(at(tb.focus.range_m + 1, { noise: 1 })).toBe(0);
    expect(at(100, { noise: 1 })).toBeGreaterThan(at(100));
    expect(at(100, { moving: true })).toBeGreaterThan(at(100));
  });
  it("le focus décroît, puis disparaît ; sans stimulus il ne se réattribue pas", () => {
    const focused = titan({ focus: { target: "h", strength: 1 } });
    const later = updateFocus(focused, [], false, 2, new Rng(1), tb);
    expect(later.focus?.strength).toBeCloseTo(1 - tb.focus.decay_per_s * 2, 9);
    expect(updateFocus(focused, [], false, 100, new Rng(1), tb).focus).toBeNull();
    expect(updateFocus(focused, [], false, 100, new Rng(1), tweak("focus", { decay_per_s: 0 })).focus?.strength).toBe(1);
  });
  it("le focus ne change que si l'autre cible dépasse la courante de switch_margin", () => {
    const cur = human("a", 200, { noise: 0.5 });
    const rival = human("b", 200, { noise: 0.5 + 0.05 });
    const t = titan({ focus: { target: "a", strength: 1 } });
    expect(updateFocus(t, [cur, rival], false, 0, new Rng(1), tb).focus?.target).toBe("a");
    const big = human("b", 100, { noise: 1, moving: true, group: 8 });
    expect(updateFocus(t, [cur, big], false, 0, new Rng(1), tb).focus?.target).toBe("b");
    expect(updateFocus(t, [cur, rival], false, 0, new Rng(1), tweak("focus", { switch_margin: 0 })).focus?.target).toBe("b");
    // cible courante disparue : réattribution
    expect(updateFocus(t, [rival], false, 0, new Rng(1), tb).focus?.target).toBe("b");
  });
  it("l'anormal ignore souvent l'appât, pas le marcheur ; un immobile ne se donne aucun focus", () => {
    const bait = human("appat", 100, { noise: 1, moving: true, bait: true });
    const soldier = human("soldat", 300);
    let ignored = 0;
    for (let s = 0; s < 200; s++) {
      const t = updateFocus(titan({ behavior: "anormal" }), [bait, soldier], false, 1, new Rng(s), tb);
      if (t.focus?.target === "soldat") ignored++;
    }
    expect(ignored / 200).toBeGreaterThan(tb.focus.anomalous_bait_ignore - 0.12);
    expect(ignored / 200).toBeLessThan(tb.focus.anomalous_bait_ignore + 0.12);
    expect(updateFocus(titan({ behavior: "marcheur" }), [bait, soldier], false, 1, new Rng(1), tb).focus?.target).toBe("appat");
    expect(updateFocus(titan({ focus: { target: "x", strength: 5 } }), [bait], true, 1, new Rng(1), tb).focus).toBeNull();
  });
  it("saturation : plus de Titans que d'ancrages ; classes de taille", () => {
    expect(isSaturated(5, 2, tb)).toBe(true);
    expect(isSaturated(3, 2, tb)).toBe(false);
    expect(isSaturated(2, 0, tb)).toBe(true);
    expect(sizeClassOf(titan({ sizeClass: "anormal" }), tb).speed_mps).toBeGreaterThan(sizeClassOf(titan({ sizeClass: "petit" }), tb).speed_mps);
    expect(sizeClassOf(titan({ sizeClass: "grand" }), tb).grab_radius_m).toBeGreaterThan(sizeClassOf(titan({ sizeClass: "petit" }), tb).grab_radius_m);
    expect(() => sizeClassOf(titan({ sizeClass: "colossal" }), tb)).toThrow();
  });
  it("déterministe et indépendant de l'ordre des humains", () => {
    const hs = [human("b", 90, { noise: 0.2 }), human("a", 90, { noise: 0.2 }), human("c", 90, { bait: true, noise: 1 })];
    const t1 = updateFocus(titan({ behavior: "anormal" }), hs, false, 1, new Rng(3), tb);
    const t2 = updateFocus(titan({ behavior: "anormal" }), [...hs].reverse(), false, 1, new Rng(3), tb);
    expect(t1).toEqual(t2);
  });
  it("stepTitan : avance à la vitesse de sa classe, saisit au rayon de saisie, respecte la cadence", () => {
    const h = [human("h", 100)];
    const t = (o: Partial<Titan> = {}) => titan({ focus: { target: "h", strength: 1 }, ...o });
    const walker = stepTitan(t(), h, false, 5, tb);
    expect(walker.titan.x).toBeCloseTo(sizeCls("moyen").speed_mps * 5, 9);
    expect(walker.grabbed).toBeNull();
    const runner = stepTitan(t({ sizeClass: "anormal", behavior: "anormal" }), h, false, 5, tb);
    expect(runner.titan.x).toBeGreaterThan(walker.titan.x);
    // arrivée : s'arrête au rayon de saisie et saisit une fois, puis attend sa cadence
    const grab = stepTitan(t(), h, false, 1000, tb);
    expect(grab.grabbed).toBe("h");
    expect(100 - grab.titan.x).toBeCloseTo(sizeCls("moyen").grab_radius_m, 9);
    expect(grab.titan.cooldownS).toBe(sizeCls("moyen").cadence_s);
    expect(stepTitan(grab.titan, h, false, 1, tb).grabbed).toBeNull();
    expect(stepTitan(grab.titan, h, false, sizeCls("moyen").cadence_s, tb).grabbed).toBe("h");
    // plus grand rayon de saisie : saisit de plus loin
    expect(stepTitan(t({ sizeClass: "grand" }), h, false, 1000, tb).titan.x).toBeLessThan(grab.titan.x);
    // immobile, sans focus ou cible disparue : ne bouge pas
    expect(stepTitan(t(), h, true, 10, tb).titan.x).toBe(0);
    expect(stepTitan(titan(), h, false, 10, tb).titan.x).toBe(0);
    expect(stepTitan(t(), [], false, 10, tb).titan.x).toBe(0);
    expect(stepTitan(t({ cooldownS: 5 }), [], false, 2, tb).titan.cooldownS).toBe(3);
  });
});
