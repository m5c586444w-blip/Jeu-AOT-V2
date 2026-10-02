import { describe, expect, it } from "vitest";
import { EventBus } from "../../../src/sim/core/bus";
import { applyCommand, CommandJournal, replay, validateCommand } from "../../../src/sim/core/commands";
import type { Command, SimEvents } from "../../../src/sim/core/commands";
import { createInitialState } from "../../../src/sim/core/state";

describe("validation des commandes", () => {
  it("AdvanceDays : n entier entre 1 et 3650", () => {
    expect(validateCommand({ type: "AdvanceDays", n: 1 }).ok).toBe(true);
    expect(validateCommand({ type: "AdvanceDays", n: 3650 }).ok).toBe(true);
    for (const n of [0, 3651, 1.5, -2, "3", Number.NaN]) {
      expect(validateCommand({ type: "AdvanceDays", n }).ok).toBe(false);
    }
  });
  it("SetFlag, Noop, inconnues", () => {
    expect(validateCommand({ type: "SetFlag", key: "trost_breached", value: true }).ok).toBe(true);
    expect(validateCommand({ type: "SetFlag", key: "", value: true }).ok).toBe(false);
    expect(validateCommand({ type: "SetFlag", key: "x", value: 1 }).ok).toBe(false);
    expect(validateCommand({ type: "Noop" }).ok).toBe(true);
    expect(validateCommand({ type: "Explode" }).ok).toBe(false);
    expect(validateCommand(null).ok).toBe(false);
  });
  it("applyCommand rejette et publie commandRejected", () => {
    const bus = new EventBus<SimEvents>();
    const errors: string[] = [];
    bus.on("commandRejected", (e) => errors.push(e.error));
    expect(() => applyCommand(createInitialState(1), { type: "AdvanceDays", n: 0 }, bus)).toThrow();
    expect(errors).toHaveLength(1);
  });
});

describe("application et bus", () => {
  it("AdvanceDays avance la date et publie les événements", () => {
    const bus = new EventBus<SimEvents>();
    let days = 0;
    let applied = 0;
    bus.on("dayAdvanced", () => days++);
    const off = bus.on("commandApplied", () => applied++);
    const s = applyCommand(createInitialState(42), { type: "AdvanceDays", n: 10 }, bus);
    expect(s.date).toEqual({ year: 845, day: 11 });
    expect(days).toBe(10);
    expect(applied).toBe(1);
    off();
    applyCommand(s, { type: "Noop" }, bus);
    expect(applied).toBe(1);
  });
  it("l'état d'entrée n'est pas modifié", () => {
    const s0 = createInitialState(42);
    const copy = structuredClone(s0);
    applyCommand(s0, { type: "SetFlag", key: "a", value: true });
    applyCommand(s0, { type: "AdvanceDays", n: 3 });
    expect(s0).toEqual(copy);
  });
});

describe("journal et replay (AC-08, partie 1)", () => {
  it("replay(initial, journal) reproduit l'état vivant", () => {
    const initial = createInitialState(42);
    const journal = new CommandJournal();
    const cmds: Command[] = [
      { type: "AdvanceDays", n: 5 },
      { type: "SetFlag", key: "evt_850_trost_breach", value: true },
      { type: "Noop" },
      { type: "AdvanceDays", n: 300 },
    ];
    let live = initial;
    for (const c of cmds) {
      live = applyCommand(live, c);
      journal.record(c);
    }
    expect(journal.length).toBe(4);
    expect(replay(initial, journal.list())).toEqual(live);
  });
});
