import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TruthBalanceSchema } from "../../../src/data/balance";
import type { TruthBalance } from "../../../src/data/balance";
import {
  actAtYear, actPillars, advanceActs, assess, attraction, capabilitiesOf, createTruthState, decide, factionPulls, initActs, pullChance, recordEvidence, reveal, stepAttractors, viewForFaction,
} from "../../../src/sim/truth";
import { canonEvent, emptyEvents, FA, FB, T0, tbal } from "./helpers";

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
function exercise(b: TruthBalance): void {
  let s = createTruthState(b, T0);
  const facts = Object.keys(tbal.facts);
  for (const src of Object.keys(tbal.sources)) for (const fact of facts) for (const claim of [true, false]) s = recordEvidence(s, FA, fact, src, claim, T0, `${src}:${fact}:${claim}`, b).state;
  for (let i = 0; i < 6; i++) s = recordEvidence(s, FB, facts[0] as string, "temoin", true, T0 + i * 200, `o${i}`, b, 0.8).state;
  for (const day of [T0, T0 + 400, T0 + 100_000]) for (const f of facts) { assess(s, FA, f, day, b); decide(s, FA, f, day, b); assess(s, FB, f, day, b); }
  decide(createTruthState(b, T0), FA, facts[0] as string, T0, b);
  let r = createTruthState(b, T0);
  for (const f of facts) r = reveal(r, FA, f, T0, b);
  for (const f of facts) decide(r, FA, f, T0, b);
  // Erreurs à chaque grade (croyance fausse en A, B, C puis D).
  const lie = "humanite_eteinte_hors_murs";
  for (const [src, n] of [["preuve_materielle", 4], ["preuve_materielle", 1], ["interrogatoire", 1], ["temoin", 1]] as const) {
    let e = createTruthState(b, T0);
    for (let i = 0; i < n; i++) e = recordEvidence(e, FA, lie, src, true, T0, `${src}${i}`, b).state;
    decide(e, FA, lie, T0, b);
  }
  // Actes et capacités.
  for (const year of [800, 845, 850, 854]) actAtYear(year, b);
  for (const a of tbal.acts) actPillars(a.id, b);
  const allFac = ["fac_paradis", "fac_marley", "fac_hizuru", "fac_allies"];
  for (const year of [845, 850, 854]) for (const f of allFac) capabilitiesOf(initActs(createTruthState(b, T0), allFac, year, b), f, b);
  advanceActs(initActs(r, [FA], 845, b), FA, T0, b);
  advanceActs(initActs(s, [FA], 845, b), FA, T0, b);
  viewForFaction(s, FA, T0, b);
  // Attracteurs : événement avec et sans conditions, fenêtre ouverte, divergence nulle, au seuil, branche divergente.
  const canon = [canonEvent("evt_a", 850, { conditions: [{ flag: "k", eq: true }], weight: 0.5 }), canonEvent("evt_b", 850, { weight: 0 })];
  for (const [holds, div, branch] of [[true, 0, "canon"], [false, 2, "canon"], [false, 0, "divergente"]] as const) {
    for (let seed = 0; seed < 30; seed++) stepAttractors({ canon, ev: { ...emptyEvents(), divergence: div, branch }, truth: createTruthState(b, T0), day: T0, year: 850, seed, threshold: 2.5, holds: () => holds }, b);
  }
  attraction(1, "canon", 2.5, b);
  attraction(1, "divergente", 2.5, b);
  pullChance(0.5, 0.5, b);
  for (const id of Object.keys(tbal.attractors.faction)) factionPulls(createTruthState(b, T0), FA, [id], 0, "canon", 2.5, T0, b);
  factionPulls(r, FA, Object.keys(tbal.attractors.faction), 0, "canon", 2.5, T0, b);
}

describe("truth.json : aucune donnée morte", () => {
  it("le fichier respecte son schéma strict (cohérences croisées comprises)", () => {
    const raw = JSON.parse(readFileSync("data/balance/truth.json", "utf8")) as Record<string, unknown>;
    expect(() => TruthBalanceSchema.parse(raw)).not.toThrow();
    expect(() => TruthBalanceSchema.parse({ ...raw, extra: 1 })).toThrow();
    expect(() => TruthBalanceSchema.parse({ ...raw, grades: { A: 10, B: 20, C: 5, verified: "A" } })).toThrow();
    expect(() => TruthBalanceSchema.parse({ ...raw, capabilities: { x: { act: "acte_inconnu", factions: null } } })).toThrow();
    expect(() => TruthBalanceSchema.parse({ ...raw, attractors: { ...(raw["attractors"] as object), faction: { x: { fact: "fait_inconnu", pull: 0.5 } } } })).toThrow();
  });

  it("chaque feuille de truth.json est lue à l'exécution (proxy), et le détecteur signale bien un paramètre non exercé", () => {
    const seen = new Set<string>();
    exercise(spy(tbal, seen) as TruthBalance);
    const want = leaves(tbal).filter((p) => p !== "canon" && p !== "notes_canon" && !/^facts\..*\.canon$/.test(p));
    expect(want.length).toBeGreaterThan(40);
    expect(want.filter((p) => !seen.has(p))).toEqual([]);
    const none = new Set<string>();
    spy(tbal, none);
    expect(want.filter((p) => !none.has(p)).length).toBe(want.length);
  });

  it("les faits canon C ne sont pas contredits : véracités fixées et étiquettes présentes", () => {
    const c = Object.entries(tbal.facts).filter(([, f]) => f.canon === "C").map(([id, f]) => [id, f.veracity]);
    expect(Object.fromEntries(c)).toEqual({ titans_sont_humains: true, murs_contiennent_titans: true, monde_exterieur: true, marley_puissance_moderne: true, chemins_visions: true });
    for (const [id, f] of Object.entries(tbal.facts)) if (!f.veracity) expect(f.canon, id).toBe("A");
    // Marine : jamais Paradis (26 §9).
    expect(tbal.capabilities["marine"]?.factions).not.toContain("fac_paradis");
    expect(tbal.capabilities["aviation"]?.factions).not.toContain("fac_paradis");
  });
});
