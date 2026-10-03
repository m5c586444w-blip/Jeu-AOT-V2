import { describe, expect, it } from "vitest";
import { applyCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { runConsoleLine } from "../../src/ui/debugConsole";
import type { ConsoleHost } from "../../src/ui/debugConsole";

function memoryHost(seed = 42): ConsoleHost {
  let state = createInitialState(seed);
  const slots = new Map<string, GameState>();
  return {
    state: () => state,
    dispatch: async (cmd: Command) => {
      state = applyCommand(state, cmd);
    },
    reset: async (s: number) => {
      state = createInitialState(s);
    },
    save: async (slot: string) => {
      slots.set(slot, state);
    },
    load: async (slot: string) => {
      const s = slots.get(slot);
      if (!s) throw new Error(`créneau vide : ${slot}`);
      state = s;
    },
    canonReport: async () => "canon:check : conforme",
  };
}

describe("console de debug (AC-15)", () => {
  it("advance 10 change la date", async () => {
    const host = memoryHost();
    const r = await runConsoleLine(host, "advance 10");
    expect(r.ok).toBe(true);
    expect(host.state().date).toEqual({ year: 845, day: 11 });
    expect((await runConsoleLine(host, "date")).text).toBe("an 845, jour 11");
  });
  it("seed affiche et réinitialise la graine", async () => {
    const host = memoryHost(42);
    expect((await runConsoleLine(host, "seed")).text).toBe("graine 42");
    await runConsoleLine(host, "seed 7");
    expect(host.state().seed).toBe(7);
    expect((await runConsoleLine(host, "seed -1")).ok).toBe(false);
  });
  it("hash : 8 caractères hexadécimaux, change après advance", async () => {
    const host = memoryHost();
    const h1 = (await runConsoleLine(host, "hash")).text;
    expect(h1).toMatch(/^[0-9a-f]{8}$/);
    await runConsoleLine(host, "advance 1");
    expect((await runConsoleLine(host, "hash")).text).not.toBe(h1);
  });
  it("save / load / canon / help / erreurs", async () => {
    const host = memoryHost();
    await runConsoleLine(host, "save a");
    const before = (await runConsoleLine(host, "hash")).text;
    await runConsoleLine(host, "advance 5");
    expect((await runConsoleLine(host, "load a")).text).toContain(before);
    expect((await runConsoleLine(host, "canon")).text).toContain("conforme");
    const help = (await runConsoleLine(host, "help")).text;
    expect(help.split("\n")).toHaveLength(10);
    expect(help).not.toContain("console.help");
    expect((await runConsoleLine(host, "advance 0")).ok).toBe(false);
    expect((await runConsoleLine(host, "load vide")).ok).toBe(false);
    expect((await runConsoleLine(host, "explose")).text).toContain("commande inconnue");
  });
});
