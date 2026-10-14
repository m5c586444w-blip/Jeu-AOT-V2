import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadWorld } from "../../../src/data/worldNode";
import { stateHash } from "../../../src/sim/core/canonical";
import { createInitialState, tickDay } from "../../../src/sim/core/state";
import type { GameState } from "../../../src/sim/core/state";
import { toAbsoluteDay } from "../../../src/sim/core/time";
import { conditionHolds } from "../../../src/sim/events/engine";
import { attraction, closeness, effectiveDivergence, factionPulls, inWindow, pullChance, reveal, stepAttractors } from "../../../src/sim/truth";
import type { AttractorInput } from "../../../src/sim/truth";
import { canonEvent, emptyEvents, fresh, T0, tbal, tweak } from "./helpers";

const HELD = { flag: "tient", eq: true } as const;
const LOST = { flag: "perdu", eq: true } as const;
const TH = 2.5;

const input = (o: Partial<AttractorInput> = {}): AttractorInput => ({
  canon: [canonEvent("evt_a", 850)],
  ev: emptyEvents(),
  truth: fresh(),
  day: T0,
  year: 850,
  seed: 7,
  threshold: TH,
  holds: () => true,
  ...o,
});

/** Nombre de jours (sur `n`) où l'attracteur programme l'événement, toutes choses égales, avec des graines différentes. */
function fireRate(o: Partial<AttractorInput>, b = tbal, n = 400): number {
  let k = 0;
  for (let seed = 0; seed < n; seed++) if (stepAttractors(input({ ...o, seed }), b).pulled.length > 0) k++;
  return k / n;
}

describe("P6 attracteurs de canon : primitives", () => {
  it("closeness : part des conditions qui tiennent ; 1 sans condition", () => {
    expect(closeness([], () => false)).toBe(1);
    expect(closeness([HELD, LOST], (c) => "flag" in c && c.flag === "tient")).toBe(0.5);
    expect(closeness([HELD, LOST], () => true)).toBe(1);
    expect(closeness([HELD], () => false)).toBe(0);
  });

  it("attraction : 1 à divergence nulle, décroît jusqu'à weak_at_threshold au seuil, plancher après la bascule", () => {
    expect(attraction(0, "canon", TH, tbal)).toBe(1);
    expect(attraction(TH, "canon", TH, tbal)).toBeCloseTo(tbal.attractors.weak_at_threshold, 12);
    expect(attraction(TH / 2, "canon", TH, tbal)).toBeCloseTo((1 + tbal.attractors.weak_at_threshold) / 2, 12);
    expect(attraction(10 * TH, "canon", TH, tbal)).toBeCloseTo(tbal.attractors.weak_at_threshold, 12);
    expect(attraction(0, "divergente", TH, tbal)).toBe(tbal.attractors.divergent_floor);
    expect(attraction(0, "divergente", TH, tweak("attractors", { ...tbal.attractors, divergent_floor: 0.7 }))).toBe(0.7);
    let prev = 2;
    for (let d = 0; d <= 3; d += 0.25) {
      const a = attraction(d, "canon", TH, tbal);
      expect(a).toBeLessThanOrEqual(prev);
      prev = a;
    }
  });

  it("pullChance : base × attraction × proximité^exposant", () => {
    expect(pullChance(1, 1, tbal)).toBe(tbal.attractors.pull_base);
    expect(pullChance(0, 1, tbal)).toBe(0);
    expect(pullChance(0.5, 0.5, tbal)).toBeCloseTo(tbal.attractors.pull_base * 0.5 * 0.5 ** tbal.attractors.closeness_exp, 12);
  });

  it("fenêtre d'année : year_min..year_max (ou year_min seul)", () => {
    const e = canonEvent("evt_w", 850);
    expect([849, 850, 851].map((y) => inWindow(e, y))).toEqual([false, true, false]);
    expect([849, 850, 852, 853].map((y) => inWindow(canonEvent("evt_x", 850, { yearMax: 852 }), y))).toEqual([false, true, true, false]);
  });
});

describe("P6 (c) un événement canon se déclenche dans sa fenêtre si les conditions sont conformes, et diverge sinon", () => {
  it("conditions conformes : programmé (aux taux attendus) dans la fenêtre, jamais hors fenêtre", () => {
    const e = canonEvent("evt_a", 850, { conditions: [HELD] });
    expect(fireRate({ canon: [e] })).toBeGreaterThan(tbal.attractors.pull_base - 0.08);
    expect(fireRate({ canon: [e] })).toBeLessThan(tbal.attractors.pull_base + 0.08);
    expect(fireRate({ canon: [e], year: 849 })).toBe(0);
    expect(fireRate({ canon: [e], year: 851 })).toBe(0);
    // Levier pull_base.
    expect(fireRate({ canon: [e] }, tweak("attractors", { ...tbal.attractors, pull_base: 0 }))).toBe(0);
    expect(fireRate({ canon: [e] }, tweak("attractors", { ...tbal.attractors, pull_base: 1 }))).toBe(1);
  });

  it("conditions rompues : plus d'attraction (proximité 0) et l'écart s'accumule", () => {
    const e = canonEvent("evt_a", 850, { conditions: [HELD], weight: 0.5 });
    expect(fireRate({ canon: [e], holds: () => false })).toBe(0);
    const r = stepAttractors(input({ canon: [e], holds: () => false }), tbal);
    expect(r.truth.canon.drift).toBeCloseTo(tbal.attractors.gap_weight * 0.5, 12);
    expect(r.pulled).toEqual([]);
    // Moitié des conditions : attraction réduite (proximité^exposant) mais non nulle, écart réduit de moitié.
    const e2 = canonEvent("evt_b", 850, { conditions: [HELD, LOST] });
    const half = (c: unknown) => (c as { flag: string }).flag === "tient";
    const rate = fireRate({ canon: [e2], holds: half as AttractorInput["holds"] });
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(fireRate({ canon: [e2] }));
  });

  it("l'écart est pondéré par le poids de divergence de l'événement (min_weight en plancher) et par gap_weight", () => {
    const run = (weight: number, b = tbal) => stepAttractors(input({ canon: [canonEvent("evt_a", 850, { conditions: [HELD], weight })], holds: () => false }), b).truth.canon.drift;
    expect(run(0.8)).toBeCloseTo(0.8 * tbal.attractors.gap_weight, 12);
    expect(run(0)).toBeCloseTo(tbal.attractors.min_weight * tbal.attractors.gap_weight, 12);
    expect(run(0.8, tweak("attractors", { ...tbal.attractors, gap_weight: 0.1 }))).toBeCloseTo(0.08, 12);
    expect(run(0, tweak("attractors", { ...tbal.attractors, min_weight: 0.5 }))).toBeCloseTo(0.5 * tbal.attractors.gap_weight, 12);
  });

  it("écarts répétés : la divergence effective franchit le seuil et la branche bascule (une seule fois, avec trace)", () => {
    const e = canonEvent("evt_a", 850, { conditions: [HELD], weight: 1 });
    let i = input({ canon: [e], holds: () => false });
    let day = T0;
    for (; day < T0 + 200 && i.ev.branch === "canon"; day++) {
      const r = stepAttractors({ ...i, day }, tbal);
      i = { ...i, ev: r.ev, truth: r.truth };
    }
    const flips = i.ev.chronicle.filter((c) => c.status === "bascule").length;
    expect(i.ev.branch).toBe("divergente");
    expect(effectiveDivergence(i.ev.divergence, i.truth)).toBeGreaterThanOrEqual(TH);
    expect(day - T0).toBeGreaterThan(Math.floor(TH / tbal.attractors.gap_weight) - 2);
    expect(flips).toBe(1);
    const more = stepAttractors({ ...i, day }, tbal);
    expect(more.ev.chronicle.filter((c) => c.status === "bascule")).toHaveLength(1);
  });

  it("l'attraction faiblit avec la divergence du moteur puis s'effondre en branche divergente", () => {
    const e = canonEvent("evt_a", 850);
    const calm = fireRate({ canon: [e] });
    const hot = fireRate({ canon: [e], ev: { ...emptyEvents(), divergence: TH * 0.99 } });
    const split = fireRate({ canon: [e], ev: { ...emptyEvents(), divergence: TH, branch: "divergente" } });
    expect(hot).toBeLessThan(calm);
    expect(split).toBeLessThan(hot);
    expect(split).toBeGreaterThan(0);
  });

  it("idempotent par jour, déterministe, entrées intactes ; événement déjà passé, programmé ou sans prédécesseur : ignoré", () => {
    const i = input({ canon: [canonEvent("evt_a", 850)], seed: 3 });
    const frozen = JSON.stringify(i);
    const r1 = stepAttractors({ ...i, truth: { ...i.truth, canon: { ...i.truth.canon, lastDay: T0 - 1 } } }, tbal);
    const r2 = stepAttractors({ ...i, truth: { ...i.truth, canon: { ...i.truth.canon, lastDay: T0 - 1 } } }, tbal);
    expect(r1).toEqual(r2);
    expect(JSON.stringify(i)).toBe(frozen);
    const again = stepAttractors({ ...i, ev: r1.ev, truth: r1.truth }, tbal);
    expect(again.truth).toBe(r1.truth);
    expect(again.pulled).toEqual([]);
    const done = fireRate({ ev: { ...emptyEvents(), history: { evt_a: { status: "survenu", day: 1, choice: null, auto: false, divergence: 0 } } } });
    const sched = fireRate({ ev: { ...emptyEvents(), scheduled: [{ id: "evt_a", day: T0 + 3 }] } });
    const blocked = fireRate({ canon: [canonEvent("evt_a", 850, { after: "evt_zero" })] });
    expect([done, sched, blocked]).toEqual([0, 0, 0]);
    expect(fireRate({ canon: [{ ...canonEvent("evt_a", 850), playable: false }] })).toBe(0);
  });

  it("un événement programmé par attraction est inscrit au moteur pour le jour même", () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = stepAttractors(input({ seed, canon: [canonEvent("evt_a", 850)] }), tbal);
      if (r.pulled.length === 0) continue;
      expect(r.ev.scheduled).toEqual([{ id: "evt_a", day: T0 }]);
      expect(r.truth.canon.pulled).toEqual({ evt_a: T0 });
      return;
    }
    throw new Error("aucun tirage ne programme l'événement");
  });
});

describe("P6 attracteurs de faction (data/factions)", () => {
  const factions = JSON.parse(readFileSync("data/factions/nations.json", "utf8")) as { id: string; attractors: string[] }[];

  it("chaque attracteur déclaré par une faction du jeu est défini dans truth.json (et inversement)", () => {
    const declared = new Set(factions.flatMap((f) => f.attractors));
    expect([...declared].filter((a) => !(a in tbal.attractors.faction))).toEqual([]);
    expect(Object.keys(tbal.attractors.faction).filter((a) => !declared.has(a))).toEqual([]);
  });

  it("force = pull × attraction de canon ; tri décroissant ; un fait déjà connu (B) n'attire plus ; inconnu ignoré", () => {
    const marley = factions.find((f) => f.id === "fac_marley");
    const ids = marley?.attractors ?? [];
    const s = fresh();
    const calm = factionPulls(s, "fac_marley", [...ids, "inconnu"], 0, "canon", TH, T0, tbal);
    expect(calm.map((p) => p.attractor)).toEqual(["fondateur", "domination"]);
    expect(calm[0]?.pull).toBe(tbal.attractors.faction["fondateur"]?.pull);
    const hot = factionPulls(s, "fac_marley", ids, TH, "canon", TH, T0, tbal);
    expect(hot[0]?.pull).toBeCloseTo((tbal.attractors.faction["fondateur"]?.pull ?? 0) * tbal.attractors.weak_at_threshold, 12);
    const goal = tbal.attractors.faction["fondateur"]?.fact ?? "";
    const known = reveal(s, "fac_marley", goal, T0, tbal);
    expect(factionPulls(known, "fac_marley", ids, 0, "canon", TH, T0, tbal).map((p) => p.attractor)).toEqual(["domination"]);
    // Les autres factions gardent leur attracteur (connaissance par faction).
    expect(factionPulls(known, "fac_paradis", ["fondateur"], 0, "canon", TH, T0, tbal)).toHaveLength(1);
    // Attracteur sans fait (survie) : jamais satisfait.
    expect(factionPulls(known, "fac_marley", ["survie"], 0, "canon", TH, T0, tbal)).toEqual([{ attractor: "survie", fact: null, pull: tbal.attractors.faction["survie"]?.pull }]);
  });

  it("levier attractors.known_grade : la fiabilité exigée pour qu'un fait « connu » éteigne l'attracteur est lue des données", () => {
    const goal = tbal.attractors.faction["fondateur"]?.fact ?? "";
    // Fait découvert, mais seulement à la fiabilité C.
    const weak = { ...tweak("grades", { verified: "C" }) };
    const known = reveal(fresh(), "fac_marley", goal, T0, weak);
    const ids = (g: "A" | "B" | "C" | "D"): string[] =>
      factionPulls(known, "fac_marley", ["fondateur"], 0, "canon", TH, T0, { ...weak, attractors: { ...weak.attractors, known_grade: g } }).map((p) => p.attractor);
    expect(ids("B")).toEqual(["fondateur"]); // C n'atteint pas B : l'attracteur pousse encore
    expect(ids("A")).toEqual(["fondateur"]);
    expect(ids("C")).toEqual([]); // C suffit : plus d'attraction
    expect(ids("D")).toEqual([]);
  });
});

describe("P6 attracteurs sur le vrai moteur d'événements (scn_sandbox_850)", () => {
  const world = loadWorld("data", "scn_sandbox_850");
  const cw = world.chronicle;
  const mk = (): GameState => {
    const s = createInitialState(42, world);
    if (!s.events) throw new Error("pas d'événements");
    return { ...s, events: { ...s.events, scheduled: [] } };
  };
  const ctxOf = (s: GameState) => {
    if (!s.strategic || !s.events) throw new Error("couches absentes");
    return { world, date: s.date, st: s.strategic, pol: s.politics, ev: s.events, intel: s.intel, rs: s.research };
  };

  /** Une année de jeu avec attracteurs : `holds` décide de la conformité du contexte. */
  function year(holds: ((s: GameState) => AttractorInput["holds"]) | null, days = 360): { s: GameState; truth: ReturnType<typeof fresh>; pulled: string[] } {
    let s = mk();
    let truth = fresh();
    const pulled: string[] = [];
    for (let d = 0; d < days; d++) {
      if (!s.events) throw new Error("pas d'événements");
      const day = toAbsoluteDay(s.date);
      const r = stepAttractors({ canon: cw?.canon ?? [], ev: s.events, truth, day, year: s.date.year, seed: s.seed, threshold: cw?.balance.divergence_threshold ?? TH, holds: holds ? holds(s) : (c) => conditionHolds(ctxOf(s), c) }, tbal);
      truth = r.truth;
      pulled.push(...r.pulled);
      s = tickDay({ ...s, events: r.ev }, world);
    }
    return { s, truth, pulled };
  }

  it("sans événement programmé au départ, les attracteurs seuls déclenchent le canon de 850, dans l'année et dans l'ordre du graphe", () => {
    const base = createInitialState(42, world);
    expect(base.events?.scheduled.length ?? 0).toBeGreaterThan(0); // le moteur programme déjà : on le retire pour isoler les attracteurs
    const { s, pulled } = year(null);
    expect(pulled.length).toBeGreaterThan(0);
    const h = s.events?.history ?? {};
    for (const id of pulled) expect(h[id]?.status, id).toBe("survenu");
    for (const id of pulled) expect(cw?.events.get(id)?.year_min).toBe(850);
    expect(s.events?.branch).toBe("canon");
  });

  it("le moteur d'événements reste intact : sans attracteurs, mêmes états qu'avant ; l'état de jeu n'est pas modifié par truth (empreinte)", () => {
    const a = createInitialState(42, world);
    const b = createInitialState(42, world);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(Object.keys(a)).not.toContain("truth");
  });

  it("contexte rompu : l'écart cumulé grandit et seuls les canons sans condition restent attirés", () => {
    const ok = year(null, 300);
    const broken = year(() => () => false, 300);
    expect(broken.truth.canon.drift).toBeGreaterThan(ok.truth.canon.drift);
    expect(broken.pulled.length).toBeGreaterThan(0);
    for (const id of broken.pulled) expect(cw?.events.get(id)?.conditions, id).toEqual([]);
    expect(ok.pulled.some((id) => (cw?.events.get(id)?.conditions.length ?? 0) > 0)).toBe(true);
  });
});
