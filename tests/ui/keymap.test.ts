import { describe, expect, it } from "vitest";
import { DEFAULT_BINDINGS, KeyMap, keyLabel } from "../../src/ui/keymap";

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("raccourcis configurables (AC1-14, F-UIX-03)", () => {
  it("valeurs par défaut : Espace = pause, 1–5 = vitesses", () => {
    const k = new KeyMap();
    expect(k.actionFor("Space")).toBe("pause");
    expect(k.actionFor("Digit3")).toBe("speed_3");
    expect(new Set(Object.values(DEFAULT_BINDINGS)).size).toBe(Object.values(DEFAULT_BINDINGS).length);
  });
  it("réassignation persistante, échange en cas de conflit", () => {
    const storage = memoryStorage();
    const k = new KeyMap(storage);
    expect(k.rebind("pause", "KeyP")).toBe("lod_province");
    expect(k.codeOf("lod_province")).toBe("Space");
    const reloaded = new KeyMap(storage);
    expect(reloaded.actionFor("KeyP")).toBe("pause");
    reloaded.reset();
    expect(new KeyMap(storage).codeOf("pause")).toBe("Space");
  });
  it("stockage illisible → valeurs par défaut", () => {
    const k = new KeyMap({ getItem: () => "{pas du json", setItem: () => undefined });
    expect(k.codeOf("pause")).toBe("Space");
  });
  it("libellés", () => {
    expect(keyLabel("KeyO")).toBe("O");
    expect(keyLabel("Space")).toBe("Espace");
  });
});
