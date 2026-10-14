import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/sim/core/rng";
import {
  adviceFor, addEvidence, autonomyOf, controlOf, createClockState, decideAction, deployBearer, extractionOdds, ignoreProbability, isExhausted,
  initClock, isGeneralOrder, levelOf, modelPick, modelTopAbility, nineViolations, projectionCost, reactionDelayS, registerBearer, stepSuspicionDay, transformGate, viewForFaction,
} from "../../../src/sim/clock";
import type { ClockBalance } from "../../../src/data/balance";
import { cb, input, nineState, shb, slot } from "./helpers";

/** Proxy profond : enregistre le chemin de chaque feuille (valeur primitive ou tableau) réellement lue. */
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
function exercise(b: ClockBalance): void {
  const rng = new Rng(3);
  // Suspicion : chaque preuve, chaque rôle, démasquage, fausse accusation, décroissance.
  for (const role of Object.keys(cb.cover.initial)) {
    let s = registerBearer(createClockState(), input("p", { role }), b);
    for (const kind of Object.keys(cb.suspicion.evidence)) for (let i = 0; i < 6; i++) s = addEvidence(s, "p", "paradis", kind, i, b);
    for (let i = 0; i < 6; i++) s = addEvidence(s, "inno", "paradis", "transformation_vue", i, b);
    s = addEvidence(s, "p2", "paradis", "temoin", 0, b);
    s = stepSuspicionDay(s, 100, b);
    levelOf(10, b);
    viewForFaction(s, null, "paradis", 850, 13, b);
  }
  // Contrôle, autonomie, ordres, modèles.
  const bearer = registerBearer(createClockState(), input("c", { convictions: { ouvre_breche: -1, tiens_ligne: 1 } }), b).bearers["c"];
  if (!bearer) throw new Error("porteur absent");
  for (const order of [null, ...cb.orders]) {
    controlOf(bearer, order, b, true);
    controlOf(bearer, order, b, false);
    if (order) isGeneralOrder(order, b);
    for (const titan of cb.nine) decideAction(bearer, titan, order, rng, b);
  }
  for (const c of [0, 20, 50, 100]) {
    autonomyOf(c, b);
    ignoreProbability(c, b);
    reactionDelayS(c, b);
  }
  for (const titan of cb.nine) {
    modelTopAbility(titan, b);
    modelPick(titan, rng, b);
  }
  transformGate({ control: 50, handsBound: false, surprised: true, endurance: 100, cooldownS: 0 }, shb, b);
  // Extraction, roster, Neuf.
  for (const contention of [false, true]) extractionOdds(5, contention, 50, b);
  projectionCost(10, b);
  const reg = registerBearer(createClockState(), input("r"), b);
  deployBearer(reg, "r", 10, b);
  isExhausted(bearer, 2, b);
  adviceFor(2, b);
  nineViolations(nineState({}), b);
  // Activation du pilier (C9.3) : enregistrement des porteurs nommés.
  initClock(nineState({ shifter_assaillant: slot("h1", "paradis", 845), shifter_cuirasse: slot("h2", "marley", 845), shifter_bestial: slot("h3", "inconnu", 845) }), b);
}

describe("clock.json : aucune donnée morte", () => {
  it("chaque feuille de clock.json est lue à l'exécution (proxy), et la lecture est un vrai effet : sans scénario, rien n'est lu", () => {
    const seen = new Set<string>();
    exercise(spy(cb, seen) as ClockBalance);
    const want = leaves(cb).filter((p) => p !== "canon" && p !== "notes_canon");
    expect(want.length).toBeGreaterThan(40);
    expect(want.filter((p) => !seen.has(p))).toEqual([]);
    // Garde-fou du détecteur lui-même : un paramètre non exercé est bien signalé.
    const none = new Set<string>();
    spy(cb, none);
    expect(want.filter((p) => !none.has(p)).length).toBe(want.length);
  });
});
