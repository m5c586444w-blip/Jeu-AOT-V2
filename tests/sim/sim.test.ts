import { describe, expect, it } from "vitest";
import { stateHash } from "../../src/sim/core/canonical";
import { replay } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import { createSim, handleSimRequest } from "../../src/sim/sim";
import type { SimRequest, SimResponse } from "../../src/sim/sim";
import { SimClient } from "../../src/workers/simClient";

/** Port en mémoire, asynchrone comme un vrai Worker. */
function memoryPort() {
  const sim = createSim(1);
  let handler: (m: SimResponse) => void = () => undefined;
  return {
    post: (m: SimRequest) => queueMicrotask(() => handler(handleSimRequest(sim, structuredClone(m)))),
    onMessage: (h: (m: SimResponse) => void) => {
      handler = h;
    },
  };
}

describe("createSim et protocole", () => {
  it("le journal de createSim rejoue l'état", () => {
    const sim = createSim(9);
    sim.dispatch({ type: "AdvanceDays", n: 40 });
    sim.dispatch({ type: "SetFlag", key: "k", value: true });
    expect(stateHash(replay(createInitialState(9), sim.journal()))).toBe(sim.hash());
  });
  it("client asynchrone = exécution directe", async () => {
    const client = new SimClient(memoryPort());
    await client.reset(42);
    const direct = createSim(42);
    for (let i = 0; i < 10; i++) {
      direct.dispatch({ type: "AdvanceDays", n: 100 });
      await client.dispatch({ type: "AdvanceDays", n: 100 });
    }
    expect((await client.state()).hash).toBe(direct.hash());
  });
  it("une commande invalide renvoie une erreur sans casser la simulation", async () => {
    const client = new SimClient(memoryPort());
    await expect(client.dispatch({ type: "AdvanceDays", n: 0 })).rejects.toThrow(/AdvanceDays/);
    expect((await client.dispatch({ type: "AdvanceDays", n: 1 })).state.date.day).toBe(2);
  });
});
