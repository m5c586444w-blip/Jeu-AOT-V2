import { describe, expect, it } from "vitest";
import { loadWorld } from "../../../src/data/worldNode";
import { stateHash } from "../../../src/sim/core/canonical";
import { applyCommand, validateCommand } from "../../../src/sim/core/commands";
import type { Command } from "../../../src/sim/core/commands";
import { deserialize, serialize } from "../../../src/sim/core/serialize";
import { createInitialState } from "../../../src/sim/core/state";
import { checkEnvelope } from "../../../src/sim/commands/apply";

const world = loadWorld("data", "scn_sandbox_850");
const REF_120J_850 = "e0a0b63c";

describe("C9 étape 1 : durcissement (revue)", () => {
  it("sauvegarde avec pillars/wall mal formé : rejetée", () => {
    const base = applyCommand(createInitialState(7, world), { type: "EnableWall" }, undefined, world);
    expect(deserialize(serialize(base)).pillars?.wall).toBeDefined();
    const mutate = (f: (o: Record<string, unknown>) => void): string => {
      const o = JSON.parse(serialize(base)) as Record<string, unknown>;
      f(o);
      return JSON.stringify(o);
    };
    const wallOf = (o: Record<string, unknown>) => (o["pillars"] as { wall: Record<string, unknown> }).wall;
    expect(() => deserialize(mutate((o) => (o["pillars"] = 3)))).toThrow(/pillars/);
    expect(() => deserialize(mutate((o) => (o["pillars"] = { wall: { districts: [] } })))).toThrow(/pillars\.wall/);
    expect(() => deserialize(mutate((o) => delete wallOf(o)["ledger"]))).toThrow(/pillars\.wall/);
    expect(() => deserialize(mutate((o) => (wallOf(o)["gates"] = { maria: true })))).toThrow(/pillars\.wall/);
  });

  it("EnableWall sans données du Mur ou sans partie stratégique : refus typé, pas d'exception brute à l'application", () => {
    const s = createInitialState(7, world);
    const noWall = { ...world, wall: undefined };
    expect(validateCommand({ type: "EnableWall" }, { state: s, world: noWall }).ok).toBe(false);
    expect(validateCommand({ type: "EnableWall" }, { state: { ...s, strategic: null }, world }).ok).toBe(false);
    expect(validateCommand({ type: "EnableWall" }, { state: s, world }).ok).toBe(true);
    expect(validateCommand({ type: "EnableWall" }).ok).toBe(true);
    const events: unknown[] = [];
    const bus = { emit: (n: string, p: unknown) => events.push([n, p]) } as never;
    expect(() => applyCommand(s, { type: "EnableWall" }, bus, noWall)).toThrow(/Commande rejetée/);
    expect(events.length).toBe(1);
    expect(() => applyCommand(s, { type: "EnableWall" })).toThrow(/Commande rejetée/);
  });

  it("schéma strict : EnableWall refuse les champs en trop", () => {
    const env = (command: Record<string, unknown>) => checkEnvelope({ seat: "seat_1", day: 0, command });
    expect(env({ type: "EnableWall" }).ok).toBe(true);
    expect(env({ type: "EnableWall", extra: 1 }).ok).toBe(false);
  });

  it("sans activation, l'état est inchangé : empreinte de 120 jours sur 850 figée", () => {
    let s = createInitialState(42, world);
    s = applyCommand(s, { type: "AdvanceDays", n: 120 } as Command, undefined, world);
    expect(s.pillars).toBeUndefined();
    expect(stateHash(s)).toBe(REF_120J_850);
  });
});
