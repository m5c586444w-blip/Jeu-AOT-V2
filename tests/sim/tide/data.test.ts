import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/sim/core/rng";
import type { TideBalance } from "../../../src/data/balance";
import {
  addSpike, detectionRange, engage, evacuate, injectBreach, interest, isSaturated, removeTitans, recover, reachOf, scanHumanEncounters, scanTitanEncounters,
  sizeClassOf, stepGrid, stepTitan, updateFocus, viewForFaction, createGrid, initTide, tickTide, tideDensity, tideFactor,
} from "../../../src/sim/tide";
import type { Human, Titan } from "../../../src/sim/tide";
import { NIGHT_WINTER, NOON, openGrid, pile, tb } from "./helpers";

/** Proxy profond : enregistre le chemin de chaque feuille réellement lue. */
function spy(root: object, seen: Set<string>): object {
  const wrap = (o: object, path: string): object =>
    new Proxy(o, {
      get(target, key, recv) {
        const v = Reflect.get(target, key, recv) as unknown;
        if (typeof key !== "string") return v;
        const p = path ? `${path}.${key}` : key;
        if (v !== null && typeof v === "object" && !Array.isArray(v)) return wrap(v, p);
        seen.add(p);
        return v;
      },
    });
  return wrap(root, "");
}
const leaves = (o: object, path = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => {
    const p = path ? `${path}.${k}` : k;
    return v !== null && typeof v === "object" && !Array.isArray(v) ? leaves(v as object, p) : [p];
  });

/** Exécute chaque fonction publique qui lit l'équilibrage, avec des entrées qui atteignent toutes les branches. */
function exercise(b: TideBalance): void {
  const rng = new Rng(3);
  const weapons = Object.keys(tb.weapons);
  // Grille : toutes les saisons, jour et nuit, attention (piles, murs, pics), réveil, repeuplement, plafond.
  const d = new Array<number>(81).fill(0);
  d[40] = 6;
  d[41] = 3;
  let g = createGrid({ w: 9, h: 9, density: d, capacity: 4, blocked: [0] }, b);
  for (const kind of Object.keys(tb.attention.spikes)) g = addSpike(g, kind, 9000, 9000, 1, b);
  const loud = pile("p", "x", 9000, 9000, { troops: Object.fromEntries(weapons.map((w) => [w, 30])), noise: 1, smoke: 1 });
  for (const season of ["hiver", "printemps", "ete", "automne"] as const) {
    for (const hour of [2, 12]) g = stepGrid(g, { piles: [loud], posts: [{ x: 9000, y: 9000, men: 50 }], hour, season, dtH: 2 }, b).grid;
  }
  g = stepGrid(g, { piles: [loud], posts: [], hour: 2, season: "hiver", dtH: 1 }, b).grid;
  removeTitans(g, 9000, 9000, 1);
  injectBreach(g, 9000, 9000, 2, b);
  // Rencontres.
  for (const c of [NOON, NIGHT_WINTER, { ...NOON, visibility: 0.2 }]) {
    scanTitanEncounters(openGrid(3, {}, b), [loud, pile("q", "y", 3000, 3000, { scouts: 1, intel: 1 })], [], c, 1, 1, rng, b);
    scanHumanEncounters([pile("a", "x", 0, 0, { scouts: 1, intel: 1, troops: { artillerie: 3 }, ammo: { artillerie: 9 }, concealment: 1 }), pile("z", "y", 500, 0, { gas: 5, troops: { odm: 3 } })], (a, z) => a !== z, c, 1, b);
    viewForFaction("x", [pile("a", "x", 0, 0), pile("z", "y", 500, 0, { troops: { fusil: 130 } })], c, b);
  }
  detectionRange(pile("a", "x", 0, 0), pile("z", "y", 1, 0), NOON, b);
  for (const w of weapons) reachOf(pile("a", "x", 0, 0, { troops: { [w]: 5 }, ammo: { [w]: 5 }, gas: 5 }), NOON, b);
  // Combat : chaque arme, avec et sans munitions/gaz, couvert, flanquement, embuscade, vue, déroute.
  for (const w of weapons) {
    const geo = { distanceM: 60, flankA: 0.5, flankB: 0, visibility: 1, night: false, seen: { a: true, b: false }, ambusher: "a" as const };
    for (const supplied of [true, false]) {
      const att = pile("a", "x", 0, 0, { troops: { [w]: 40 }, ammo: { [w]: supplied ? 1000 : 0 }, gas: supplied ? 1000 : 0, routed: !supplied, anchors: 0.5 });
      const r = engage(att, pile("z", "y", 60, 0, { cover: 0.5, troops: { fusil: 200, odm: 20 }, anchors: 0.5 }), geo, 20, rng, b);
      evacuate(r.b, 20, b);
      recover(r.b, 20, b);
    }
  }
  engage(pile("a", "x", 0, 0), pile("z", "y", 60, 0), { distanceM: 60, flankA: 0, flankB: 0.5, visibility: 0.5, night: true, seen: { a: true, b: true }, ambusher: null }, 20, rng, b);
  // Focus.
  const humans: Human[] = [{ id: "h", x: 50, y: 0, group: 3, noise: 1, moving: true, bait: true }, { id: "k", x: 80, y: 0, group: 1, noise: 0, moving: false }];
  for (const sizeClass of Object.keys(tb.focus.size_classes)) {
    const t: Titan = { id: "t", x: 0, y: 0, sizeClass, behavior: "anormal", focus: { target: "h", strength: 0.5 } };
    sizeClassOf(t, b);
    updateFocus(t, humans, false, 1, rng, b);
    updateFocus({ ...t, focus: null }, humans, false, 1, rng, b);
    updateFocus({ ...t, focus: { target: "k", strength: 0.01 } }, humans, false, 10, rng, b);
    interest(t, humans[0] as Human, b);
    stepTitan({ ...t, cooldownS: 0 }, humans, false, 30, b);
    stepTitan({ ...t, cooldownS: 0 }, [{ ...(humans[0] as Human), x: 1 }], false, 30, b);
  }
  isSaturated(3, 1, b);
  // Régions à la demande (C9.7) : chaque type de régiment, en marche et à l'arrêt, avec rencontre ; lecture de la densité effective.
  const kinds = Object.keys(tb.region.kind_weapon);
  const armies = kinds.map((k, i) => ({ id: `a${i}`, province: "p", faction: "x", xKm: 10, yKm: 10, byKind: { [k]: 20, inconnu: 5 }, moving: i % 2 === 0 }));
  const tide = tickTide(initTide(), { armies, baseDensity: () => 0.4, clashes: new Set(["p"]), season: "ete" }, b);
  tickTide(tide, { armies: [], baseDensity: () => 0.4, clashes: new Set<string>(), season: "hiver" }, b);
  tideDensity(tide, "p", 10, 10, 0.4, b);
  tideFactor(tide, "p", 10, 10, 0.4, b);
}

describe("tide.json : aucune donnée morte", () => {
  it("chaque feuille de tide.json est lue à l'exécution (proxy) ; le détecteur signale bien un paramètre non exercé", () => {
    const seen = new Set<string>();
    exercise(spy(tb, seen) as TideBalance);
    const want = leaves(tb).filter((p) => p !== "canon" && p !== "notes_canon");
    expect(want.length).toBeGreaterThan(100);
    expect(want.filter((p) => !seen.has(p))).toEqual([]);
    const none = new Set<string>();
    spy(tb, none);
    expect(want.filter((p) => !none.has(p)).length).toBe(want.length);
  });
  it("le fichier ne porte aucune faction : les identifiants de faction viennent des piles", () => {
    const text = JSON.stringify({ ...tb, notes_canon: "" }).toLowerCase();
    for (const f of ["paradis", "marley", "fac_", "hizuru", "eldia"]) expect(text).not.toContain(f);
  });
});
