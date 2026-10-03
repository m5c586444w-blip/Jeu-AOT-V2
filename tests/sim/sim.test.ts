import { describe, expect, it } from "vitest";
import { stateHash } from "../../src/sim/core/canonical";
import { replay } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import { createSim, createSimEndpoint } from "../../src/sim/sim";
import type { SimRequest, SimResponse } from "../../src/sim/sim";
import { SimClient } from "../../src/workers/simClient";

/** Port en mémoire, asynchrone comme un vrai Worker. */
function memoryPort() {
  const handle = createSimEndpoint(() => {
    throw new Error("pas de monde dans ce test");
  });
  let handler: (m: SimResponse) => void = () => undefined;
  return {
    post: (m: SimRequest) => queueMicrotask(() => handler(handle(structuredClone(m)))),
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
    await client.init(42, null);
    const direct = createSim(42);
    for (let i = 0; i < 10; i++) {
      direct.dispatch({ type: "AdvanceDays", n: 100 });
      await client.dispatch({ type: "AdvanceDays", n: 100 });
    }
    expect((await client.state()).hash).toBe(direct.hash());
  });
  it("une commande invalide renvoie une erreur sans casser la simulation", async () => {
    const client = new SimClient(memoryPort());
    await client.init(1, null);
    await expect(client.dispatch({ type: "AdvanceDays", n: 0 })).rejects.toThrow(/AdvanceDays/);
    expect((await client.dispatch({ type: "AdvanceDays", n: 1 })).state.date.day).toBe(2);
  });
});

describe("monde dans la simulation distante", () => {
  it("init avec scénario renvoie la source validée ; erreur lisible si le chargement échoue", async () => {
    const { readDataFiles } = await import("../../src/data/loadNode");
    const { worldSourceFromFiles } = await import("../../src/data/worldSource");
    const ok = createSimEndpoint(() => {
      const { source } = worldSourceFromFiles(readDataFiles("data"));
      if (!source) throw new Error("données invalides");
      return source;
    });
    const r = ok({ id: 1, op: "init", seed: 42, scenario: "scn_sandbox_845" });
    expect(r.ok && r.source?.provinces.length).toBe(74);
    expect(r.ok && r.state.strategic?.scenario).toBe("scn_sandbox_845");
    const bad = createSimEndpoint(() => {
      throw new Error("données invalides");
    })({ id: 2, op: "init", seed: 1, scenario: "scn_sandbox_845" });
    expect(bad).toEqual({ id: 2, ok: false, error: "données invalides" });
  });
  it("worldSourceFromFiles signale une donnée invalide avec son chemin", async () => {
    const { readDataFiles } = await import("../../src/data/loadNode");
    const { worldSourceFromFiles } = await import("../../src/data/worldSource");
    const files = readDataFiles("data");
    const provinces = structuredClone(files["/data/provinces/paradis.json"]) as Record<string, unknown>[];
    (provinces[0] as Record<string, unknown>)["pop_level"] = 9;
    const { source, issues } = worldSourceFromFiles({ ...files, "/data/provinces/paradis.json": provinces });
    expect(source).toBeNull();
    expect(issues[0]).toMatchObject({ file: "data/provinces/paradis.json", jsonPath: "$[0].pop_level" });
  });
});
