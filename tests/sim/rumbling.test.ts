import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { stateHash } from "../../src/sim/core/canonical";
import { applyCommand } from "../../src/sim/core/commands";
import { createInitialState, tickDay } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { evaluateEnding } from "../../src/sim/ending/ending";

/** P9.4 (CP9-03, CP9-07) : Grondement, couche de crise facultative du scénario `scn_grondement`. */
const w = loadWorld("data", "scn_grondement");
const days = (s: GameState, n: number): GameState => {
  let x = s;
  for (let d = 0; d < n; d++) x = tickDay(x, w);
  return x;
};

describe("Grondement (P9.4)", () => {
  it("couche présente dans son seul scénario ; ordre de passage : terres hors de Paradis, sans les mers", () => {
    expect(w.rumbling).toBeDefined();
    expect(loadWorld("data", "scn_854").rumbling).toBeUndefined();
    expect(createInitialState(1, loadWorld("data", "scn_854")).rumbling).toBeUndefined();
    const order = w.rumbling?.order ?? [];
    expect(order.length).toBeGreaterThan(30);
    for (const id of order) {
      const p = w.nations?.provinces.get(id);
      expect(p?.type).not.toBe("mer");
      expect(p?.faction).not.toBe("fac_paradis");
    }
    expect(createInitialState(1, w).rumbling?.ravaged).toBe(0);
  });

  it("le front avance chaque jour et ruine les nations touchées ; « retarder » ralentit, « laisser » accélère", () => {
    const s0 = createInitialState(4, w);
    const plain = days(s0, 40);
    expect(plain.rumbling?.provinces.length).toBeGreaterThan(5);
    expect(plain.rumbling?.ravaged).toBeGreaterThan(0);
    // Même partie sans la crise : la nation de la première province touchée y garde plus d'industrie.
    const first = plain.rumbling?.provinces[0] as string;
    const owner = s0.nations?.control[first] as string;
    const calm = { ...w, rumbling: undefined };
    let c: GameState = { ...s0 };
    delete c.rumbling;
    for (let d = 0; d < 40; d++) c = tickDay(c, calm);
    expect(plain.nations?.nations[owner]?.industry ?? 0).toBeLessThan(c.nations?.nations[owner]?.industry ?? 0);
    const slow = days(applyCommand(s0, { type: "RumblingStance", stance: "retarder" }, undefined, w), 40);
    const fast = days(applyCommand(s0, { type: "RumblingStance", stance: "laisser" }, undefined, w), 40);
    expect(slow.rumbling?.ravaged ?? 0).toBeLessThan(plain.rumbling?.ravaged ?? 0);
    expect(fast.rumbling?.ravaged ?? 0).toBeGreaterThanOrEqual(plain.rumbling?.ravaged ?? 0);
    expect(slow.rumbling?.evacuated).toBeGreaterThan(0);
  });

  it("« empêcher » prépare l'assaut ; refusé avant d'être prêt ; ensuite il arrête la crise ou échoue, de façon déterministe", () => {
    let s = applyCommand(createInitialState(4, w), { type: "RumblingStance", stance: "empecher" }, undefined, w);
    expect(() => applyCommand(s, { type: "RumblingAssault" }, undefined, w)).toThrow("rumbling.not_ready");
    s = days(s, 80);
    expect(s.rumbling?.assault).toBe(100);
    const a = applyCommand(s, { type: "RumblingAssault" }, undefined, w);
    const b = applyCommand(s, { type: "RumblingAssault" }, undefined, w);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(a.rumbling?.attempts).toBe(1);
    // Assauts répétés jusqu'à l'arrêt : la chance croît après chaque échec.
    let x = a;
    for (let k = 0; k < 6 && !x.rumbling?.stopped; k++) {
      x = days(x, 40);
      x = applyCommand(x, { type: "RumblingAssault" }, undefined, w);
    }
    expect(x.rumbling?.stopped).toBe(true);
    const ravaged = x.rumbling?.ravaged ?? 0;
    const later = days(x, 30);
    expect(later.rumbling?.ravaged).toBe(ravaged);
  });

  it("fins : arrêté tôt = victoire ; le monde ravagé = défaite ; au terme sans arrêt = issue mitigée ou défaite", () => {
    const s0 = createInitialState(4, w);
    const rb = structuredClone(s0.rumbling);
    if (!rb) throw new Error("couche absente");
    expect(evaluateEnding(w, s0)?.state).toBe("en_cours");
    expect(evaluateEnding(w, { ...s0, rumbling: { ...rb, stopped: true, ravaged: 0.12 } })?.state).toBe("victoire");
    expect(evaluateEnding(w, { ...s0, rumbling: { ...rb, stopped: true, ravaged: 0.45 } })?.state).toBe("en_cours");
    const ravaged = evaluateEnding(w, { ...s0, rumbling: { ...rb, ravaged: 0.85 } });
    expect(ravaged?.state).toBe("defaite");
    expect(ravaged?.defeat?.id).toBe("monde_ravage");
    const end = days(applyCommand(s0, { type: "RumblingStance", stance: "laisser" }, undefined, w), 150);
    expect(["terme", "defaite"]).toContain(evaluateEnding(w, end)?.state);
  }, 120_000);
});
