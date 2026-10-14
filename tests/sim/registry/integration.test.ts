import { describe, expect, it } from "vitest";
import { loadWorld } from "../../../src/data/worldNode";
import { stateHash } from "../../../src/sim/core/canonical";
import { applyCommand, replay, validateCommand } from "../../../src/sim/core/commands";
import type { Command } from "../../../src/sim/core/commands";
import { deserialize, serialize } from "../../../src/sim/core/serialize";
import { createInitialState } from "../../../src/sim/core/state";
import type { GameState } from "../../../src/sim/core/state";
import { checkEnvelope } from "../../../src/sim/commands/apply";
import { enlistGenerated, registryViolations } from "../../../src/sim/registry";
import type { RegistryState } from "../../../src/sim/registry";
import { rbal } from "./helpers";

const world = loadWorld("data", "scn_sandbox_850");
const REF_120J_850 = "e0a0b63c";
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, world), s);
const regOf = (s: GameState): RegistryState => {
  if (!s.pillars?.registry) throw new Error("registre absent");
  return s.pillars.registry;
};
/** Monde de test : registre activé puis garni de recrues stressées (le monde ne fournit pas d'individus). */
function seeded(): GameState {
  const s = run(createInitialState(7, world), { type: "EnableRegistry" });
  const e = enlistGenerated(regOf(s), { faction: "fac_paradis", squad: "esc_1", count: 6, day: 0 }, rbal);
  for (const id of e.ids) {
    const x = e.state.soldiers[id];
    if (x) x.stress = 90;
  }
  return { ...s, pillars: { ...s.pillars, registry: e.state } };
}
const script: Command[] = [{ type: "AdvanceDays", n: 60 }];

describe("C9 étape 2 : pilier P7 Le Registre branché au tick (désactivé par défaut)", () => {
  it("désactivé par défaut : aucun champ pillars, empreinte de 120 jours figée", () => {
    const s = run(createInitialState(42, world), { type: "AdvanceDays", n: 120 });
    expect(s.pillars).toBeUndefined();
    expect(stateHash(s)).toBe(REF_120J_850);
  });

  it("EnableRegistry crée un registre vide ; l'activer deux fois ne le réinitialise pas", () => {
    const s = run(createInitialState(7, world), { type: "EnableRegistry" });
    expect(Object.keys(regOf(s).soldiers)).toHaveLength(0);
    const t = seeded();
    expect(regOf(run(t, { type: "EnableRegistry" }))).toEqual(regOf(t));
  });

  it("60 jours : le stress retombe, invariants tenus, déterministe, registre avancé", () => {
    const a = run(seeded(), ...script);
    const b = run(seeded(), ...script);
    const r = regOf(a);
    expect(r.lastDay).toBeGreaterThan(0);
    expect(Object.values(r.soldiers).every((x) => x.stress < 90)).toBe(true);
    expect(registryViolations(r, rbal)).toEqual([]);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(stateHash(a)).not.toBe(stateHash(run(createInitialState(7, world), ...script)));
  });

  it("rejeu du journal et aller-retour de sauvegarde : même empreinte", () => {
    const start = seeded();
    const direct = run(start, ...script);
    expect(stateHash(replay(start, script, world))).toBe(stateHash(direct));
    expect(stateHash(deserialize(serialize(direct)))).toBe(stateHash(direct));
  });
});

describe("C9 étape 2 : durcissement", () => {
  it("sauvegarde avec pillars/registry mal formé : rejetée", () => {
    const base = seeded();
    expect(deserialize(serialize(base)).pillars?.registry).toBeDefined();
    const mutate = (f: (r: Record<string, unknown>) => void): string => {
      const o = JSON.parse(serialize(base)) as { pillars: { registry: Record<string, unknown> } };
      f(o.pillars.registry);
      return JSON.stringify(o);
    };
    expect(() => deserialize(mutate((r) => delete r["seq"]))).toThrow(/pillars\.registry/);
    expect(() => deserialize(mutate((r) => (r["soldiers"] = [])))).toThrow(/pillars\.registry/);
    expect(() => deserialize(mutate((r) => (r["lastDay"] = "x")))).toThrow(/pillars\.registry/);
    expect(() => deserialize(mutate((r) => { const k = Object.keys(r["soldiers"] as object)[0] as string; ((r["soldiers"] as Record<string, Record<string, unknown>>)[k] as Record<string, unknown>)["status"] = "ressuscité"; }))).toThrow(/pillars\.registry/);
  });

  it("EnableRegistry sans données du Registre : refus typé, pas d'exception brute", () => {
    const s = createInitialState(7, world);
    const noReg = { ...world, registry: undefined };
    expect(validateCommand({ type: "EnableRegistry" }, { state: s, world: noReg }).ok).toBe(false);
    expect(validateCommand({ type: "EnableRegistry" }, { state: s, world }).ok).toBe(true);
    expect(validateCommand({ type: "EnableRegistry" }).ok).toBe(true);
    const events: unknown[] = [];
    const bus = { emit: (n: string, p: unknown) => events.push([n, p]) } as never;
    expect(() => applyCommand(s, { type: "EnableRegistry" }, bus, noReg)).toThrow(/Commande rejetée/);
    expect(events.length).toBe(1);
    expect(() => applyCommand(s, { type: "EnableRegistry" })).toThrow(/Commande rejetée/);
  });

  it("schéma strict et classement faction", () => {
    const env = (command: Record<string, unknown>) => checkEnvelope({ seat: "seat_1", day: 0, command });
    expect(env({ type: "EnableRegistry" }).ok).toBe(true);
    expect(env({ type: "EnableRegistry", extra: 1 }).ok).toBe(false);
  });
});
