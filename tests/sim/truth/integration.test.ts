import { describe, expect, it } from "vitest";
import { loadWorld } from "../../../src/data/worldNode";
import { stateHash } from "../../../src/sim/core/canonical";
import { applyCommand, replay, validateCommand } from "../../../src/sim/core/commands";
import type { Command } from "../../../src/sim/core/commands";
import { deserialize, serialize } from "../../../src/sim/core/serialize";
import { createInitialState } from "../../../src/sim/core/state";
import type { GameState } from "../../../src/sim/core/state";
import { checkEnvelope } from "../../../src/sim/commands/apply";
import { actOf, initTruth, reveal, tickTruth, truthFactions } from "../../../src/sim/truth";
import type { TruthState } from "../../../src/sim/truth";
import { tbal } from "./helpers";

const world = loadWorld("data", "scn_sandbox_850");
const REF_120J_850 = "e0a0b63c";
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, world), s);
const truthOf = (s: GameState): TruthState => {
  if (!s.pillars?.truth) throw new Error("vérité absente");
  return s.pillars.truth;
};
const factions = (): string[] => truthFactions(world);
const script: Command[] = [{ type: "AdvanceDays", n: 60 }];

/** Une faction a vérifié les deux faits de l'acte III (par découverte, jamais par menu). */
function seeded(): GameState {
  const s = run(createInitialState(7, world), { type: "EnableTruth" });
  const f = factions()[0] as string;
  let t = truthOf(s);
  for (const fact of ["marley_puissance_moderne", "hizuru_garanties_possibles"]) t = reveal(t, f, fact, 0, tbal);
  return { ...s, pillars: { ...s.pillars, truth: t } };
}

describe("C9 étape 4 : pilier P6 La Vérité branché au tick (désactivé par défaut)", () => {
  it("désactivé par défaut : aucun champ pillars, empreinte de 120 jours figée", () => {
    const s = run(createInitialState(42, world), { type: "AdvanceDays", n: 120 });
    expect(s.pillars).toBeUndefined();
    expect(stateHash(s)).toBe(REF_120J_850);
  });

  it("EnableTruth fixe l'acte de départ (850 : acte II) ; l'activer deux fois ne le réinitialise pas", () => {
    expect(factions().length).toBeGreaterThan(0);
    const s = run(createInitialState(7, world), { type: "EnableTruth" });
    const t = truthOf(s);
    expect(Object.keys(t.facts).length).toBeGreaterThan(0);
    for (const f of factions()) expect(actOf(t, f, tbal)).toBe("acte_2");
    const u = seeded();
    expect(truthOf(run(u, { type: "EnableTruth" }))).toEqual(truthOf(u));
  });

  it("60 jours : la faction qui connaît les faits requis atteint l'acte III, les autres non ; déterministe", () => {
    const a = run(seeded(), ...script);
    const b = run(seeded(), ...script);
    const first = factions()[0] as string;
    expect(actOf(truthOf(a), first, tbal)).toBe("acte_3");
    // Une autre faction, sans dossier, reste à l'acte II : on n'y arrive pas par menu.
    const two = tickTruth(initTruth(tbal, [first, "fac_autre"], 850, 0), tbal, [first, "fac_autre"], 60);
    expect(actOf(two, "fac_autre", tbal)).toBe("acte_2");
    expect(truthOf(a).events.filter((e) => e.type === "act_reached")).toHaveLength(1);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it("l'acte atteint ne se perd jamais et le tick est idempotent", () => {
    const t = truthOf(run(seeded(), ...script));
    expect(tickTruth(t, tbal, factions(), 500)).toEqual(t);
  });

  it("rejeu du journal et aller-retour de sauvegarde : même empreinte", () => {
    const start = seeded();
    const direct = run(start, ...script);
    expect(stateHash(replay(start, script, world))).toBe(stateHash(direct));
    expect(stateHash(deserialize(serialize(direct)))).toBe(stateHash(direct));
  });

  it("initTruth ne dépend pas de l'ordre des factions", () => {
    expect(initTruth(tbal, ["b", "a"], 850, 0)).toEqual(initTruth(tbal, ["a", "b"], 850, 0));
  });
});

describe("C9 étape 4 : durcissement", () => {
  it("sauvegarde avec pillars/truth mal formé : rejetée", () => {
    const base = seeded();
    expect(deserialize(serialize(base)).pillars?.truth).toBeDefined();
    const mutate = (f: (r: Record<string, unknown>) => void): string => {
      const o = JSON.parse(serialize(base)) as { pillars: { truth: Record<string, unknown> } };
      f(o.pillars.truth);
      return JSON.stringify(o);
    };
    expect(() => deserialize(mutate((r) => delete r["canon"]))).toThrow(/pillars\.truth/);
    expect(() => deserialize(mutate((r) => (r["facts"] = [])))).toThrow(/pillars\.truth/);
    expect(() => deserialize(mutate((r) => (r["seq"] = "x")))).toThrow(/pillars\.truth/);
  });

  it("EnableTruth sans données de la Vérité : refus typé, pas d'exception brute", () => {
    const s = createInitialState(7, world);
    const noTruth = { ...world, truth: undefined };
    expect(validateCommand({ type: "EnableTruth" }, { state: s, world: noTruth }).ok).toBe(false);
    expect(validateCommand({ type: "EnableTruth" }, { state: s, world }).ok).toBe(true);
    expect(validateCommand({ type: "EnableTruth" }).ok).toBe(true);
    expect(() => applyCommand(s, { type: "EnableTruth" }, undefined, noTruth)).toThrow(/Commande rejetée/);
    expect(() => applyCommand(s, { type: "EnableTruth" })).toThrow(/Commande rejetée/);
  });

  it("schéma strict et classement faction", () => {
    const env = (command: Record<string, unknown>) => checkEnvelope({ seat: "seat_1", day: 0, command });
    expect(env({ type: "EnableTruth" }).ok).toBe(true);
    expect(env({ type: "EnableTruth", extra: 1 }).ok).toBe(false);
  });
});
