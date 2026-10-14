import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/sim/core/rng";
import { assess, contradictionsOf, createTruthState, decide, eventsForFaction, gradeOf, recordEvidence, reveal, setFact, TruthError, unsourcedBeliefs, viewForFaction, weightOf } from "../../../src/sim/truth";
import { FA, FB, fresh, put, T0, tbal, tweak } from "./helpers";

const F = "monde_exterieur"; // vrai
const LIE = "humanite_eteinte_hors_murs"; // faux

describe("P6 fiabilité A–D par fait", () => {
  it("aucune pièce : inconnu (ni croyance ni grade)", () => {
    const a = assess(fresh(), FA, F, T0, tbal);
    expect(a).toMatchObject({ belief: null, grade: null, backing: 0, contradicted: false, ageDays: null, verified: false });
  });

  it("le grade monte avec le poids de la source : chaque source aboutit à son grade attendu et la suite est monotone", () => {
    const grades = Object.keys(tbal.sources).map((src) => {
      const a = assess(put(fresh(), FA, F, src, true), FA, F, T0, tbal);
      return { src, w: tbal.sources[src]?.weight ?? 0, g: a.grade, c: a.confidence };
    });
    const sorted = [...grades].sort((x, y) => x.w - y.w);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]?.c ?? 0).toBeGreaterThanOrEqual(sorted[i - 1]?.c ?? 0);
    expect(grades.find((g) => g.src === "preuve_materielle")?.g).toBe("B");
    expect(grades.find((g) => g.src === "vision")?.g).toBe("D");
    expect(grades.find((g) => g.src === "temoin")?.g).toBe("D");
    expect(grades.find((g) => g.src === "archive")?.g).toBe("B");
  });

  it("gradeOf : seuils A/B/C de truth.json, bornes incluses", () => {
    const { A, B, C } = tbal.grades;
    expect([A, A - 0.01, B, B - 0.01, C, C - 0.01, 0].map((v) => gradeOf(v, tbal))).toEqual(["A", "B", "B", "C", "C", "D", "D"]);
  });

  it("levier : relever le seuil A fait descendre un dossier de A à B", () => {
    let s = fresh();
    for (let i = 0; i < 4; i++) s = put(s, FA, F, "preuve_materielle", true);
    expect(assess(s, FA, F, T0, tbal).grade).toBe("A");
    expect(assess(s, FA, F, T0, tweak("grades", { A: 10_000 })).grade).toBe("B");
  });

  it("corroboration : des origines indépendantes montent la fiabilité ; la même origine répétée ne compte qu'une fois", () => {
    const one = put(fresh(), FA, F, "rapport_espion", true, { origin: "agent1" });
    const same = put(put(one, FA, F, "rapport_espion", true, { origin: "agent1" }), FA, F, "rapport_espion", true, { origin: "agent1" });
    expect(assess(same, FA, F, T0, tbal).confidence).toBe(assess(one, FA, F, T0, tbal).confidence);
    expect(assess(same, FA, F, T0, tbal).backing).toBe(1);
    const two = put(one, FA, F, "rapport_espion", true, { origin: "agent2" });
    const three = put(two, FA, F, "rapport_espion", true, { origin: "agent3" });
    const c1 = assess(one, FA, F, T0, tbal).confidence;
    const c2 = assess(two, FA, F, T0, tbal).confidence;
    const c3 = assess(three, FA, F, T0, tbal).confidence;
    expect(c2).toBeGreaterThan(2 * c1);
    expect(c3).toBeGreaterThan(c2);
    expect(assess(three, FA, F, T0, tbal).backing).toBe(3);
    // Levier : sans bonus de corroboration, deux origines valent exactement la somme de leurs poids.
    expect(assess(two, FA, F, T0, tweak("corroboration", { bonus: 0 })).confidence).toBeCloseTo(2 * (tbal.sources.rapport_espion?.weight ?? 0), 9);
  });

  it("levier : max_origins plafonne la corroboration", () => {
    let s = fresh();
    for (let i = 0; i < 6; i++) s = put(s, FA, F, "temoin", true, { origin: `t${i}` });
    const capped = assess(s, FA, F, T0, tweak("corroboration", { max_origins: 2 })).confidence;
    const wide = assess(s, FA, F, T0, tweak("corroboration", { max_origins: 6 })).confidence;
    expect(wide).toBeGreaterThan(capped);
  });

  it("une origine qui se reprend remplace sa version précédente (rétractation)", () => {
    let s = put(fresh(), FA, F, "rapport_espion", true, { origin: "ag" });
    s = put(s, FA, F, "rapport_espion", false, { origin: "ag", day: T0 + 1 });
    const a = assess(s, FA, F, T0 + 1, tbal);
    expect(a.belief).toBe(false);
    expect(a.contradicted).toBe(false);
  });

  it("vieillissement : une pièce perd de son poids (demi-vie) jusqu'au plancher", () => {
    const s = put(fresh(), FA, F, "archive", true);
    const ev = s.dossiers[FA]?.[F]?.[0];
    if (!ev) throw new Error("pièce absente");
    const w0 = weightOf(ev, T0, tbal);
    const wHalf = weightOf(ev, T0 + tbal.age.half_life_days, tbal);
    expect(wHalf).toBeCloseTo(w0 / 2, 9);
    expect(weightOf(ev, T0 + 100_000, tbal)).toBeCloseTo(w0 * tbal.age.floor, 9);
    expect(weightOf(ev, T0 + 100_000, tweak("age", { floor: 0.5 }))).toBeCloseTo(w0 * 0.5, 9);
    expect(weightOf(ev, T0 + tbal.age.half_life_days, tweak("age", { half_life_days: tbal.age.half_life_days * 2 }))).toBeGreaterThan(wHalf);
    expect(assess(s, FA, F, T0 + 720, tbal).ageDays).toBe(720);
    expect(assess(s, FA, F, T0 + 720, tbal).confidence).toBeLessThan(assess(s, FA, F, T0, tbal).confidence);
  });

  it("qualité de la source (fiabilité de l'agent) : multiplie le poids ; hors 0..1 refusée", () => {
    const full = assess(put(fresh(), FA, F, "rapport_espion", true), FA, F, T0, tbal).confidence;
    const half = assess(put(fresh(), FA, F, "rapport_espion", true, { quality: 0.5 }), FA, F, T0, tbal).confidence;
    expect(half).toBeCloseTo(full / 2, 9);
    expect(() => recordEvidence(fresh(), FA, F, "temoin", true, T0, "o", tbal, 1.5)).toThrow(TruthError);
  });

  it("contradictions : deux versions font pénalité ; sous min_margin aucune croyance ; événement visible de la seule faction", () => {
    let s = put(fresh(), FA, F, "archive", true, { origin: "arc" });
    const solo = assess(s, FA, F, T0, tbal);
    s = put(s, FA, F, "rapport_espion", false, { origin: "ag" });
    const a = assess(s, FA, F, T0, tbal);
    expect(a.contradicted).toBe(true);
    expect(a.belief).toBe(true);
    expect(a.confidence).toBeLessThan(solo.confidence);
    expect(assess(s, FA, F, T0, tweak("contradiction", { penalty: 0 })).confidence).toBeCloseTo(solo.confidence, 9);
    expect(contradictionsOf(s, FA, T0, tbal)).toEqual([F]);
    expect(eventsForFaction(s, FA)).toEqual([{ type: "contradiction", day: T0, faction: FA, fact: F }]);
    expect(eventsForFaction(s, FB)).toEqual([]);
    // Égalité : aucune croyance, grade D.
    const tie = put(put(fresh(), FA, F, "archive", true, { origin: "x" }), FA, F, "archive", false, { origin: "y" });
    expect(assess(tie, FA, F, T0, tbal)).toMatchObject({ belief: null, grade: "D", contradicted: true });
    // Levier min_margin : une grande marge transforme la croyance en indécision.
    expect(assess(s, FA, F, T0, tweak("contradiction", { min_margin: 1000 })).belief).toBeNull();
  });

  it("un seul événement de contradiction par apparition (pas de doublon à la troisième pièce)", () => {
    let s = put(fresh(), FA, F, "archive", true, { origin: "a" });
    s = put(s, FA, F, "temoin", false, { origin: "b" });
    s = put(s, FA, F, "temoin", false, { origin: "c" });
    expect(s.events.filter((e) => e.type === "contradiction")).toHaveLength(1);
  });

  it("refus typés : fait inconnu, source inconnue", () => {
    expect(() => recordEvidence(fresh(), FA, "inconnu", "archive", true, T0, "o", tbal)).toThrow(TruthError);
    expect(() => recordEvidence(fresh(), FA, F, "inconnue", true, T0, "o", tbal)).toThrow(TruthError);
    expect(() => reveal(fresh(), FA, "inconnu", T0, tbal)).toThrow(TruthError);
  });

  it("vision des Chemins : non fiable (grade D seule) et coût mental réel ; les autres sources n'en ont pas", () => {
    const r = recordEvidence(fresh(), FA, F, "vision", true, T0, "chemins", tbal);
    expect(r.mentalCost).toBe(tbal.sources.vision?.mental_cost);
    expect(r.mentalCost).toBeGreaterThan(0);
    expect(assess(r.state, FA, F, T0, tbal).grade).toBe("D");
    expect(recordEvidence(fresh(), FA, F, "archive", true, T0, "a", tbal).mentalCost).toBe(0);
    expect(recordEvidence(fresh(), FA, F, "vision", true, T0, "c", tweak("sources", { vision: { weight: 12, mental_cost: 99 } })).mentalCost).toBe(99);
  });
});

describe("P6 découverte et conséquences d'une erreur", () => {
  it("reveal : la croyance devient la vérité en A ; correction signalée seulement si elle croyait le contraire", () => {
    let s = put(put(fresh(), FA, LIE, "doctrine", true), FA, LIE, "archive", true, { origin: "arc2" });
    expect(assess(s, FA, LIE, T0, tbal)).toMatchObject({ belief: true, verified: false });
    s = reveal(s, FA, LIE, T0 + 5, tbal);
    expect(assess(s, FA, LIE, T0 + 5, tbal)).toMatchObject({ belief: false, grade: tbal.grades.verified, verified: true });
    expect(eventsForFaction(s, FA).filter((e) => e.type === "discovery")).toEqual([{ type: "discovery", day: T0 + 5, faction: FA, fact: LIE, corrected: true }]);
    // Idempotent ; l'autre faction n'a rien découvert.
    expect(reveal(s, FA, LIE, T0 + 9, tbal)).toBe(s);
    expect(assess(s, FB, LIE, T0 + 5, tbal).verified).toBe(false);
    const right = reveal(put(fresh(), FA, F, "archive", true), FA, F, T0, tbal);
    expect(right.events.find((e) => e.type === "discovery")).toMatchObject({ corrected: false });
    expect(eventsForFaction(right, FB)).toEqual([]);
  });

  it("une information fausse suivie coûte, d'autant plus qu'elle était jugée sûre ; croyance juste : 0 ; à l'aveugle : blind_ratio", () => {
    const wrongSolid = (() => {
      let s = fresh();
      for (let i = 0; i < 4; i++) s = put(s, FA, LIE, "preuve_materielle", true);
      return s;
    })();
    const wrongWeak = put(fresh(), FA, LIE, "temoin", true);
    const right = put(fresh(), FA, F, "archive", true);
    const dSolid = decide(wrongSolid, FA, LIE, T0, tbal);
    const dWeak = decide(wrongWeak, FA, LIE, T0, tbal);
    expect(dSolid).toMatchObject({ believed: true, mistaken: true, grade: "A" });
    expect(dWeak).toMatchObject({ mistaken: true, grade: "D" });
    expect(dSolid.cost).toBe(tbal.error.base * tbal.error.cost_by_grade.A);
    expect(dWeak.cost).toBe(tbal.error.base * tbal.error.cost_by_grade.D);
    expect(dSolid.cost).toBeGreaterThan(dWeak.cost);
    expect(decide(right, FA, F, T0, tbal)).toMatchObject({ mistaken: false, cost: 0 });
    expect(decide(fresh(), FA, F, T0, tbal)).toMatchObject({ believed: null, mistaken: false, cost: tbal.error.base * tbal.error.blind_ratio });
    expect(decide(fresh(), FA, F, T0, tweak("error", { blind_ratio: 1 })).cost).toBe(tbal.error.base);
    expect(decide(wrongWeak, FA, LIE, T0, tweak("error", { base: 100 })).cost).toBe(100 * tbal.error.cost_by_grade.D);
    // Après découverte, plus d'erreur.
    expect(decide(reveal(wrongSolid, FA, LIE, T0, tbal), FA, LIE, T0, tbal)).toMatchObject({ mistaken: false, cost: 0 });
  });

  it("la véracité d'un fait est la seule différence entre deux mondes : le calcul de décision la lit, pas l'évaluation", () => {
    const a = put(fresh(), FA, LIE, "archive", true);
    const flipped = setFact(a, LIE, true, T0);
    expect(assess(flipped, FA, LIE, T0, tbal)).toEqual(assess(a, FA, LIE, T0, tbal));
    expect(decide(a, FA, LIE, T0, tbal).mistaken).toBe(true);
    expect(decide(flipped, FA, LIE, T0, tbal).mistaken).toBe(false);
  });
});

describe("P6 anti-fuite et invariants", () => {
  it("la vue ne dépend pas de la véracité (tant que rien n'est vérifié) : monde vrai et monde inversé donnent la même vue", () => {
    let s = put(put(fresh(), FA, LIE, "archive", true), FA, F, "rapport_espion", false);
    const inverted = setFact(setFact(s, LIE, true, T0), F, false, T0);
    expect(viewForFaction(inverted, FA, T0, tbal)).toEqual(viewForFaction(s, FA, T0, tbal));
    // Une fois vérifié, la vue change : le détecteur de fuite voit bien une dépendance.
    s = reveal(s, FA, LIE, T0, tbal);
    const inv2 = setFact(s, LIE, true, T0);
    expect(viewForFaction(inv2, FA, T0, tbal)).not.toEqual(viewForFaction(s, FA, T0, tbal));
  });

  it("la vue d'une faction ne contient ni le dossier, ni les découvertes, ni les contradictions d'une autre", () => {
    let s = put(fresh(), FA, F, "archive", true, { origin: "secret_a" });
    s = put(s, FA, F, "temoin", false, { origin: "autre_a" });
    s = reveal(s, FA, LIE, T0, tbal);
    const vb = viewForFaction(s, FB, T0, tbal);
    expect(vb.dossier).toEqual([]);
    expect(JSON.stringify(vb)).not.toContain("secret_a");
    expect(JSON.stringify(vb)).not.toContain(LIE);
    const va = viewForFaction(s, FA, T0, tbal);
    expect(va.dossier.map((l) => l.fact)).toEqual([LIE, F].sort());
    expect(va.dossier.find((l) => l.fact === F)).toMatchObject({ contradicted: true, belief: true });
    // Sur un même fait, B ne voit que ses propres pièces.
    const both = put(s, FB, F, "temoin", true, { origin: "propre_b" });
    const lineB = viewForFaction(both, FB, T0, tbal).dossier.find((l) => l.fact === F);
    expect(lineB?.evidence.map((e) => e.origin)).toEqual(["propre_b"]);
    expect(lineB).toMatchObject({ contradicted: false, backing: 1 });
    // Ajouter des pièces à A ne change pas la vue de B.
    const s2 = put(s, FA, "chemins_visions", "vision", true);
    expect(viewForFaction(s2, FB, T0, tbal)).toEqual(vb);
  });

  it("aucun fait « sûr » sans source (26 §7 a) : suite aléatoire d'ajouts, de vieillissements, de rétractations", () => {
    const rng = new Rng(11);
    const facts = Object.keys(tbal.facts);
    const sources = Object.keys(tbal.sources);
    for (let run = 0; run < 25; run++) {
      let s = fresh();
      for (let i = 0; i < 30; i++) {
        const fact = rng.pick(facts);
        s = put(s, rng.pick([FA, FB]), fact, rng.pick(sources), rng.next() < 0.5, { origin: `o${rng.int(0, 4)}`, day: T0 + i * 40, quality: rng.next() });
        if (rng.next() < 0.1) s = reveal(s, rng.pick([FA, FB]), rng.pick(facts), T0 + i * 40, tbal);
        for (const f of [FA, FB]) {
          expect(unsourcedBeliefs(s, f, T0 + i * 40 + 500, tbal)).toEqual([]);
          for (const l of viewForFaction(s, f, T0 + i * 40, tbal).dossier) if (l.grade !== null) expect(l.evidence.length > 0 || l.verified).toBe(true);
        }
      }
    }
    // Garde-fou du détecteur : une évaluation « sûre » sans pièce serait signalée.
    const empty = fresh();
    expect(unsourcedBeliefs(empty, FA, T0, tbal)).toEqual([]);
    const forged = { ...empty, discovered: { [FA]: { [F]: T0 } } };
    expect(unsourcedBeliefs(forged, FA, T0, tbal)).toEqual([]); // vérifié = source
    expect(assess(forged, FA, F, T0, tbal).grade).toBe("A");
  });

  it("déterminisme, pureté (entrée non modifiée) et sérialisation", () => {
    const a = put(fresh(), FA, F, "archive", true);
    const frozen = JSON.stringify(a);
    const b1 = put(a, FA, F, "temoin", false);
    const b2 = put(a, FA, F, "temoin", false);
    expect(JSON.stringify(a)).toBe(frozen);
    expect(b1).toEqual(b2);
    expect(JSON.parse(JSON.stringify(b1))).toEqual(b1);
    expect(createTruthState(tbal, 5)).toEqual(createTruthState(tbal, 5));
  });

  it("le monde de départ reflète truth.json (véracités) et ne contient aucun dossier", () => {
    const s = fresh();
    for (const [id, f] of Object.entries(tbal.facts)) expect(s.facts[id]?.veracity).toBe(f.veracity);
    expect(s.dossiers).toEqual({});
    expect(setFact(s, "nouveau", false, T0).facts["nouveau"]?.veracity).toBe(false);
  });
});
