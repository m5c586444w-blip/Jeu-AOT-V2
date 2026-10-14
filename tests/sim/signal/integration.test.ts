import { describe, expect, it } from "vitest";
import { loadWorld } from "../../../src/data/worldNode";
import { stateHash } from "../../../src/sim/core/canonical";
import { applyCommand, replay, validateCommand } from "../../../src/sim/core/commands";
import type { Command } from "../../../src/sim/core/commands";
import { deserialize, serialize } from "../../../src/sim/core/serialize";
import { createInitialState } from "../../../src/sim/core/state";
import type { GameState } from "../../../src/sim/core/state";
import { checkEnvelope } from "../../../src/sim/commands/apply";
import { doctrineOf, evaluateDoctrine, ghostsOf, initSignal, recordSightings, validateDoctrine, withDoctrine, withGhosts } from "../../../src/sim/signal";
import type { DoctrineRule, SignalState } from "../../../src/sim/signal";
import { sb } from "./helpers";

const world = loadWorld("data", "scn_sandbox_850");
const REF_120J_850 = "e0a0b63c";
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, world), s);
const sigOf = (s: GameState): SignalState => {
  if (!s.pillars?.signal) throw new Error("signal absent");
  return s.pillars.signal;
};
const script: Command[] = [{ type: "AdvanceDays", n: 60 }];
const RULES: DoctrineRule[] = [{ id: "r1", priority: 5, when: { kind: "signal", color: "rouge" }, then: { kind: "retraite", target: "tous" } }];

/** Signal activé, doctrine programmée pour Paradis et un fantôme vu par Paradis (le monde n'écrit pas encore dans l'état). */
function seeded(): GameState {
  const s = run(createInitialState(7, world), { type: "EnableSignal" });
  let st = withDoctrine(sigOf(s), "fac_paradis", RULES);
  const book = recordSightings(st.ghosts, "fac_paradis", "normal", [{ id: "scout", faction: "fac_paradis", x: 90, y: 50 }, { id: "titan_1", faction: "fac_titans", x: 100, y: 50, speedMps: 3 }], new Set(["scout"]), 10, sb);
  st = withGhosts(st, book);
  return { ...s, pillars: { ...s.pillars, signal: st } };
}

describe("C9 étape 6 : pilier P4 Le Signal branché (désactivé par défaut, sans pas de tick)", () => {
  it("désactivé par défaut : aucun champ pillars, empreinte de 120 jours figée", () => {
    const s = run(createInitialState(42, world), { type: "AdvanceDays", n: 120 });
    expect(s.pillars).toBeUndefined();
    expect(stateHash(s)).toBe(REF_120J_850);
  });

  it("EnableSignal crée un état vide ; l'activer deux fois ne le réinitialise pas", () => {
    const s = run(createInitialState(7, world), { type: "EnableSignal" });
    expect(sigOf(s)).toEqual(initSignal());
    const t = seeded();
    expect(sigOf(run(t, { type: "EnableSignal" }))).toEqual(sigOf(t));
  });

  it("la doctrine et les fantômes d'une faction ne fuient pas vers une autre ; 60 jours sans changement", () => {
    const a = run(seeded(), ...script);
    expect(sigOf(a)).toEqual(sigOf(seeded()));
    expect(doctrineOf(sigOf(a), "fac_paradis")).toEqual(RULES);
    expect(doctrineOf(sigOf(a), "fac_marley")).toEqual([]);
    expect(ghostsOf(sigOf(a).ghosts, "fac_paradis", 20, sb).length).toBeGreaterThan(0);
    expect(ghostsOf(sigOf(a).ghosts, "fac_marley", 20, sb)).toEqual([]);
  });

  it("la doctrine enregistrée s'évalue (rouge reçu → retraite)", () => {
    const rules = doctrineOf(sigOf(seeded()), "fac_paradis");
    expect(validateDoctrine(rules, sb)).toEqual([]);
    const out = evaluateDoctrine(rules, { signals: [{ color: "rouge", sector: "est", branch: "corps", faction: "fac_paradis", x: 0, y: 0, ageS: 0, understood: true } as never], gasPct: 100, depotKm: null }, sb);
    expect(out.map((o) => o.kind)).toEqual(["retraite"]);
  });

  it("rejeu du journal et aller-retour de sauvegarde : même empreinte", () => {
    const start = seeded();
    const direct = run(start, ...script);
    expect(stateHash(replay(start, script, world))).toBe(stateHash(direct));
    expect(stateHash(deserialize(serialize(direct)))).toBe(stateHash(direct));
  });

  it("withDoctrine copie : modifier la table d'origine ne change pas l'état", () => {
    const rules = structuredClone(RULES);
    const st = withDoctrine(initSignal(), "f", rules);
    (rules[0] as DoctrineRule).priority = 99;
    expect((doctrineOf(st, "f")[0] as DoctrineRule).priority).toBe(5);
  });
});

describe("C9 étape 6 : durcissement", () => {
  it("sauvegarde avec pillars/signal mal formé : rejetée", () => {
    const base = seeded();
    expect(deserialize(serialize(base)).pillars?.signal).toBeDefined();
    const mutate = (f: (r: Record<string, unknown>) => void): string => {
      const o = JSON.parse(serialize(base)) as { pillars: { signal: Record<string, unknown> } };
      f(o.pillars.signal);
      return JSON.stringify(o);
    };
    expect(() => deserialize(mutate((r) => delete r["ghosts"]))).toThrow(/pillars\.signal/);
    expect(() => deserialize(mutate((r) => (r["doctrines"] = [])))).toThrow(/pillars\.signal/);
    expect(() => deserialize(mutate((r) => { const rule = ((r["doctrines"] as Record<string, { then: { kind: string } }[]>)["fac_paradis"] ?? [])[0]; if (rule) rule.then.kind = "pillage"; }))).toThrow(/pillars\.signal/);
  });

  it("EnableSignal sans données du Signal : refus typé, pas d'exception brute", () => {
    const s = createInitialState(7, world);
    const noSig = { ...world, signal: undefined };
    expect(validateCommand({ type: "EnableSignal" }, { state: s, world: noSig }).ok).toBe(false);
    expect(validateCommand({ type: "EnableSignal" }, { state: s, world }).ok).toBe(true);
    expect(validateCommand({ type: "EnableSignal" }).ok).toBe(true);
    expect(() => applyCommand(s, { type: "EnableSignal" }, undefined, noSig)).toThrow(/Commande rejetée/);
    expect(() => applyCommand(s, { type: "EnableSignal" })).toThrow(/Commande rejetée/);
  });

  it("schéma strict et classement faction", () => {
    const env = (command: Record<string, unknown>) => checkEnvelope({ seat: "seat_1", day: 0, command });
    expect(env({ type: "EnableSignal" }).ok).toBe(true);
    expect(env({ type: "EnableSignal", extra: 1 }).ok).toBe(false);
  });
});
