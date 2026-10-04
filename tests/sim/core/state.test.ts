import { describe, expect, it } from "vitest";
import { canonicalJson, stateHash } from "../../../src/sim/core/canonical";
import { applyCommand, replay } from "../../../src/sim/core/commands";
import type { Command } from "../../../src/sim/core/commands";
import { deserialize, SaveFormatError, serialize } from "../../../src/sim/core/serialize";
import { createInitialState } from "../../../src/sim/core/state";
import type { GameState } from "../../../src/sim/core/state";

function run1000(seed: number): GameState {
  let s = createInitialState(seed);
  s = applyCommand(s, { type: "SetFlag", key: "debut", value: true });
  for (let i = 0; i < 10; i++) s = applyCommand(s, { type: "AdvanceDays", n: 100 });
  return s;
}

describe("JSON canonique et hash", () => {
  it("indépendant de l'ordre des clés", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
    expect(stateHash({ b: 1, a: 2 })).toBe(stateHash({ a: 2, b: 1 }));
  });
  it("format hexadécimal sur 8 caractères", () => {
    expect(stateHash(createInitialState(42))).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("déterminisme (AC-07)", () => {
  it("1000 ticks, graine 42, deux fois → même hash ; graine 43 → hash différent", () => {
    const a = run1000(42);
    const b = run1000(42);
    expect(a.date).toEqual({ year: 847, day: 281 });
    expect(stateHash(a)).toBe(stateHash(b));
    expect(stateHash(run1000(43))).not.toBe(stateHash(a));
  });
  it("le nombre de ticks change le hash", () => {
    const s = createInitialState(42);
    expect(stateHash(applyCommand(s, { type: "AdvanceDays", n: 1 }))).not.toBe(stateHash(applyCommand(s, { type: "AdvanceDays", n: 2 })));
  });
});

describe("rejeu (AC-08)", () => {
  it("replay a le même hash que l'état vivant", () => {
    const initial = createInitialState(42);
    const cmds: Command[] = [{ type: "AdvanceDays", n: 700 }, { type: "SetFlag", key: "x", value: false }, { type: "AdvanceDays", n: 300 }];
    let live = initial;
    for (const c of cmds) live = applyCommand(live, c);
    expect(stateHash(replay(initial, cmds))).toBe(stateHash(live));
  });
});

describe("sérialisation et migration (AC-09)", () => {
  it("deserialize(serialize(s)) garde le même hash", () => {
    const s = run1000(42);
    expect(stateHash(deserialize(serialize(s)))).toBe(stateHash(s));
  });
  it("un état v0 est migré jusqu'à la version courante (v0 → v1 → … → v5 → v6)", () => {
    const v0 = { seed: 42, rng: { state: 42 }, turn: 365, world: { noise: 0, flags: {} } };
    const migrated = deserialize(JSON.stringify(v0));
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.strategic).toBeNull();
    expect(migrated.politics).toBeNull();
    expect(migrated.military).toBeNull();
    expect(migrated.date).toEqual({ year: 846, day: 6 });
    expect(migrated.commandIndex).toBe(0);
    expect("turn" in migrated).toBe(false);
  });
  it("erreurs explicites", () => {
    expect(() => deserialize("{pas du json")).toThrow(SaveFormatError);
    expect(() => deserialize("[]")).toThrow(/racine/);
    expect(() => deserialize(JSON.stringify({ schemaVersion: 1, seed: 1 }))).toThrow(/corrompue/);
    expect(() => deserialize(JSON.stringify({ schemaVersion: 99 }))).toThrow(/plus récente/);
  });
});
