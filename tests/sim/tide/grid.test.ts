import { describe, expect, it } from "vitest";
import { activityOf, addSpike, attentionField, cellOf, centerOf, createGrid, injectBreach, isNight, localActivity, removeTitans, stepGrid, titanMode, totalDensity } from "../../../src/sim/tide";
import type { Pile, TideGrid, WallPost } from "../../../src/sim/tide";
import { openGrid, pile, spikeOf, tb, tweak } from "./helpers";

const mid = { x: 9000, y: 9000 };
const run = (g: TideGrid, n: number, piles: Pile[] = [], posts: WallPost[] = [], hour = 12, season: "ete" | "hiver" = "ete", b = tb, dtH = 1): { grid: TideGrid; injected: number } => {
  let injected = 0;
  for (let i = 0; i < n; i++) {
    const r = stepGrid(g, { piles, posts, hour, season, dtH }, b);
    g = r.grid;
    injected += r.report.injected;
  }
  return { grid: g, injected };
};

function seeded(): TideGrid {
  const d = new Array<number>(81).fill(0);
  [[10, 3], [40, 5.5], [41, 2], [70, 1]].forEach(([i, v]) => (d[i as number] = v as number));
  return openGrid(0, { density: d });
}

describe("grille : validité", () => {
  it("rejette dimensions, longueurs et cellules incohérentes", () => {
    expect(() => createGrid({ w: 0, h: 3 }, tb)).toThrow();
    expect(() => createGrid({ w: 2, h: 2, density: [1, 2] }, tb)).toThrow();
    expect(() => createGrid({ w: 2, h: 2, blocked: [9] }, tb)).toThrow();
    expect(() => createGrid({ w: 2, h: 2, density: [-1, 0, 0, 0] }, tb)).toThrow();
  });
  it("une cellule bloquée est vide à la création ; la densité initiale est plafonnée", () => {
    const g = createGrid({ w: 2, h: 1, density: [99, 99], blocked: [1] }, tb);
    expect(g.density).toEqual([tb.grid.max_density, 0]);
  });
  it("cellOf/centerOf sont réciproques et hors grille = -1", () => {
    const g = openGrid();
    for (const i of [0, 13, 80]) {
      const c = centerOf(g, i);
      expect(cellOf(g, c.x, c.y)).toBe(i);
    }
    expect(cellOf(g, -1, 0)).toBe(-1);
    expect(cellOf(g, 9 * tb.grid.cell_m, 0)).toBe(-1);
  });
});

describe("(a) déterminisme et (b) invariants du champ", () => {
  const piles = [pile("p", "paradis", mid.x, mid.y, { troops: { fusil: 800, artillerie: 4 } })];
  it("même état initial, mêmes entrées → même champ au pas N (et ordre des piles indifférent)", () => {
    const a = run(seeded(), 30, piles).grid;
    const c = run(seeded(), 30, [...piles]).grid;
    expect(JSON.stringify(a)).toBe(JSON.stringify(c));
    const two = [pile("a", "paradis", 5000, 5000), pile("b", "marley", 14000, 12000)];
    expect(JSON.stringify(run(seeded(), 12, two).grid)).toBe(JSON.stringify(run(seeded(), 12, [...two].reverse()).grid));
  });
  it("densité ≥ 0 et ≤ plafond à chaque pas, même avec un grand pas de temps et une forte attraction", () => {
    for (const dtH of [0.1, 1, 24, 500]) {
      let g = seeded();
      for (let i = 0; i < 25; i++) {
        g = stepGrid(g, { piles, posts: [], hour: 12, season: "ete", dtH }, tweak("dynamics", { attraction_per_h: 5, diffusion_per_h: 3 })).grid;
        for (const v of g.density) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(tb.grid.max_density + 1e-9);
        }
      }
    }
  });
  it("conservation : sans repeuplement la masse totale est constante ; avec, elle varie exactement de la source déclarée", () => {
    const noRepop = tweak("repop", { rate_per_h: 0 });
    const before = totalDensity(seeded());
    const r = run(seeded(), 40, piles, [], 12, "ete", noRepop);
    expect(r.injected).toBe(0);
    expect(totalDensity(r.grid)).toBeCloseTo(before, 9);
    let g = seeded();
    for (let i = 0; i < 40; i++) {
      const t0 = totalDensity(g);
      const s = stepGrid(g, { piles, posts: [], hour: 12, season: "ete", dtH: 1 }, tb);
      expect(totalDensity(s.grid) - t0).toBeCloseTo(s.report.injected, 9);
      g = s.grid;
    }
  });
  it("la diffusion étale réellement (sans elle, rien ne bouge sans attention) ; la masse reste conservée", () => {
    const still = run(seeded(), 5, [], [], 12, "ete", { ...tweak("dynamics", { diffusion_per_h: 0 }), repop: { ...tb.repop, rate_per_h: 0 } }).grid;
    expect(still.density).toEqual(seeded().density);
    const spread = run(seeded(), 5, [], [], 12, "ete", tweak("repop", { rate_per_h: 0 })).grid;
    expect(Math.max(...spread.density)).toBeLessThan(Math.max(...seeded().density));
    expect(totalDensity(spread)).toBeCloseTo(totalDensity(seeded()), 9);
  });
  it("pas négatif refusé", () => {
    expect(() => stepGrid(seeded(), { piles: [], posts: [], hour: 0, season: "ete", dtH: -1 }, tb)).toThrow();
  });
});

describe("attention : bruit, humains sur les murs, pics", () => {
  const g = openGrid();
  it("croît avec l'effectif, le bruit, la fumée et l'artillerie, et décroît avec la distance", () => {
    const at = (p: Pile) => attentionField(g, [p], [], tb)[cellOf(g, mid.x, mid.y)] as number;
    const base = at(pile("p", "x", mid.x, mid.y));
    expect(at(pile("p", "x", mid.x, mid.y, { troops: { fusil: 400 } }))).toBeGreaterThan(base);
    expect(at(pile("p", "x", mid.x, mid.y, { noise: 1 }))).toBeGreaterThan(base);
    expect(at(pile("p", "x", mid.x, mid.y, { smoke: 1 }))).toBeGreaterThan(base);
    expect(at(pile("p", "x", mid.x, mid.y, { troops: { fusil: 100, artillerie: 3 } }))).toBeGreaterThan(base);
    const f = attentionField(g, [pile("p", "x", mid.x, mid.y)], [], tb);
    expect(f[cellOf(g, mid.x, mid.y)] as number).toBeGreaterThan(f[cellOf(g, mid.x + 2 * tb.grid.cell_m, mid.y)] as number);
    expect(f[cellOf(g, mid.x + 4 * tb.grid.cell_m, mid.y)] as number).toBe(0);
  });
  it("toutes les factions attirent la marée de la même façon (pas de chaîne de faction)", () => {
    const a = attentionField(g, [pile("p", "paradis", mid.x, mid.y)], [], tb);
    const m = attentionField(g, [pile("p", "marley", mid.x, mid.y)], [], tb);
    expect(a).toEqual(m);
  });
  it("les humains postés sur un mur attirent les Titans, qui s'accumulent contre le mur sans le franchir", () => {
    // Mur vertical colonne 4 ; humains sur le mur ; Titans à l'ouest.
    const wall = [4, 13, 22, 31, 40, 49, 58, 67, 76];
    const d = new Array<number>(81).fill(0);
    for (let y = 0; y < 9; y++) d[y * 9 + 1] = 2;
    const w = openGrid(0, { density: d, blocked: wall });
    const post: WallPost = { x: 4.5 * tb.grid.cell_m, y: 4.5 * tb.grid.cell_m, men: 400 };
    const noPost = run(w, 60, [], [], 12, "ete", tweak("repop", { rate_per_h: 0 })).grid;
    const withPost = run(w, 60, [], [post], 12, "ete", tweak("repop", { rate_per_h: 0 })).grid;
    const border = (gr: TideGrid) => [3, 12, 21, 30, 39, 48, 57, 66, 75].reduce((s, i) => s + (gr.density[i] as number), 0);
    expect(border(withPost)).toBeGreaterThan(border(noPost) * 1.5);
    for (const i of wall) {
      expect(withPost.density[i]).toBe(0);
    }
    for (let y = 0; y < 9; y++) for (let x = 5; x < 9; x++) expect(withPost.density[y * 9 + x]).toBe(0);
  });
  it("un pic s'ajoute, puis décroît de moitié en spike_half_life_h", () => {
    const s = addSpike(g, "cannon", mid.x, mid.y, 2, tb);
    const i = cellOf(g, mid.x, mid.y);
    expect(s.spike[i]).toBeCloseTo(spikeOf("cannon") * 2, 9);
    const after = stepGrid(s, { piles: [], posts: [], hour: 12, season: "ete", dtH: tb.attention.spike_half_life_h }, tb).grid;
    expect(after.spike[i]).toBeCloseTo((s.spike[i] as number) / 2, 9);
    expect(() => addSpike(g, "inconnu", 0, 0, 1, tb)).toThrow();
    expect(addSpike(g, "combat", -5000, 0, 1, tb)).toBe(g);
  });
  it("un pic de combat attire la densité voisine (les Titans convergent vers le bruit)", () => {
    const d = new Array<number>(81).fill(0);
    d[cellOf(g, mid.x - 3 * tb.grid.cell_m, mid.y)] = 3;
    const base = openGrid(0, { density: d });
    const spiked = addSpike(base, "cannon", mid.x, mid.y, 3, tb);
    const ci = cellOf(base, mid.x, mid.y);
    const noRepop = tweak("repop", { rate_per_h: 0 });
    const a = run(base, 6, [], [], 12, "ete", noRepop).grid;
    const s = run(spiked, 6, [], [], 12, "ete", noRepop).grid;
    expect(s.density[ci]).toBeGreaterThan(a.density[ci] as number);
  });
});

describe("activité : nuit, hiver, immobilité et réveil par le bruit", () => {
  it("nuit et hiver réduisent l'activité (03 §5.2) ; frontières de l'aube et du crépuscule", () => {
    expect(isNight(2, tb)).toBe(true);
    expect(isNight(12, tb)).toBe(false);
    expect(isNight(tb.activity.dawn_hour, tb)).toBe(false);
    expect(isNight(tb.activity.dusk_hour, tb)).toBe(true);
    expect(isNight(26, tb)).toBe(true);
    expect(activityOf(12, "ete", tb)).toBeGreaterThan(activityOf(2, "ete", tb));
    expect(activityOf(12, "ete", tb)).toBeGreaterThan(activityOf(12, "hiver", tb));
    expect(activityOf(12, "ete", tb)).toBe(tb.activity.day * tb.activity.season.ete);
  });
  it("sous le seuil : immobile, sauf si l'attention locale atteint le seuil de réveil", () => {
    const night = activityOf(2, "hiver", tb);
    expect(night).toBeLessThan(tb.activity.immobile_below);
    expect(titanMode(night, 0, tb)).toBe("immobile");
    expect(titanMode(night, tb.activity.wake_attention, tb)).toBe("actif");
    expect(localActivity(night, tb.activity.wake_attention, tb)).toBe(tb.activity.wake_activity);
    expect(localActivity(0.9, 0, tb)).toBe(0.9);
    expect(localActivity(night, 0, tb)).toBe(0);
  });
  it("la marée bouge moins la nuit d'hiver qu'en plein été (même état, même durée)", () => {
    const noRepop = tweak("repop", { rate_per_h: 0 });
    const day = run(seeded(), 5, [], [], 12, "ete", noRepop).grid;
    const night = run(seeded(), 5, [], [], 2, "hiver", noRepop).grid;
    const moved = (gr: TideGrid) => gr.density.reduce((s, v, i) => s + Math.abs(v - (seeded().density[i] as number)), 0);
    expect(moved(night)).toBeLessThan(moved(day));
    expect(moved(night)).toBe(0); // immobile : rien ne bouge sans bruit
  });
  it("un Titan immobile se réveille et converge vers une pile bruyante, de nuit d'hiver", () => {
    const noRepop = tweak("repop", { rate_per_h: 0 });
    const d = new Array<number>(81).fill(0);
    d[cellOf(openGrid(), mid.x - 2 * tb.grid.cell_m, mid.y)] = 3;
    const loud = pile("p", "x", mid.x, mid.y, { troops: { fusil: 1500, artillerie: 8 }, noise: 1, smoke: 1 });
    const g = openGrid(0, { density: d });
    const out = run(g, 6, [loud], [], 2, "hiver", noRepop).grid;
    expect(out.density).not.toEqual(g.density);
    expect(totalDensity(out)).toBeCloseTo(3, 9);
  });
});

describe("repeuplement, nettoyage, brèche", () => {
  const noise = [pile("p", "x", mid.x, mid.y, { troops: { fusil: 600 }, noise: 1 })];
  it("une zone nettoyée se repeuple si le bruit humain persiste, pas s'il cesse", () => {
    const empty = openGrid(0);
    const loud = run(empty, 40, noise).grid;
    const quiet = run(empty, 40, []).grid;
    expect(totalDensity(quiet)).toBe(0);
    expect(totalDensity(loud)).toBeGreaterThan(1);
    const ci = cellOf(empty, mid.x, mid.y);
    expect(loud.density[ci]).toBeLessThanOrEqual(tb.grid.max_density + 1e-9);
    // un seul pas : le repeuplement seul ne dépasse jamais la capacité de la cellule
    const one = stepGrid(empty, { piles: noise, posts: [], hour: 12, season: "ete", dtH: 1000 }, tb).grid;
    for (const v of one.density) expect(v).toBeLessThanOrEqual(4 + 1e-9);
    expect(one.density[ci]).toBeGreaterThan(0);
  });
  it("jamais de repeuplement dans une cellule de capacité nulle (intérieur des murs)", () => {
    const g = createGrid({ w: 3, h: 3, capacity: 0 }, tb);
    const r = run(g, 30, [pile("p", "x", 3000, 3000, { noise: 1 })]);
    expect(r.injected).toBe(0);
    expect(totalDensity(r.grid)).toBe(0);
  });
  it("le taux de repeuplement est un vrai paramètre", () => {
    const slow = run(openGrid(0), 10, noise, [], 12, "ete", tweak("repop", { rate_per_h: 0.005 })).injected;
    const fast = run(openGrid(0), 10, noise, [], 12, "ete", tweak("repop", { rate_per_h: 0.2 })).injected;
    expect(fast).toBeGreaterThan(slow * 5);
  });
  it("removeTitans abaisse la densité locale du retiré exact, sans passer sous zéro", () => {
    const g = openGrid(2);
    const r = removeTitans(g, mid.x, mid.y, 1.25);
    expect(r.removed).toBe(1.25);
    expect(totalDensity(r.grid)).toBeCloseTo(totalDensity(g) - 1.25, 9);
    const r2 = removeTitans(g, mid.x, mid.y, 50);
    expect(r2.removed).toBe(2);
    expect(r2.grid.density[cellOf(g, mid.x, mid.y)]).toBe(0);
    expect(removeTitans(g, -9999, 0, 1).removed).toBe(0);
    expect(removeTitans(g, mid.x, mid.y, 0).grid).toBe(g);
  });
  it("une brèche injecte exactement amount_per_power × puissance dans l'anneau, rien hors de l'anneau, et respecte le plafond", () => {
    const g = openGrid(0);
    const r = injectBreach(g, mid.x, mid.y, 4, tb);
    expect(r.injected).toBeCloseTo(tb.breach.amount_per_power * 4, 9);
    expect(totalDensity(r.grid)).toBeCloseTo(r.injected, 9);
    for (let i = 0; i < 81; i++) {
      const c = centerOf(g, i);
      const d = Math.hypot(c.x - mid.x, c.y - mid.y);
      if (d < tb.breach.inner_m || d > tb.breach.outer_m) expect(r.grid.density[i]).toBe(0);
    }
    const full = injectBreach(openGrid(tb.grid.max_density), mid.x, mid.y, 4, tb);
    expect(full.injected).toBe(0);
    expect(injectBreach(g, mid.x, mid.y, 0, tb).injected).toBe(0);
    expect(injectBreach(g, 1e9, 1e9, 4, tb).injected).toBe(0);
  });
});
