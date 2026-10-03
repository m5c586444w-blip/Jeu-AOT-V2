import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportSave, importSave } from "../../src/save/exportFile";
import { SaveStore } from "../../src/save/saveStore";
import { stateHash } from "../../src/sim/core/canonical";
import { applyCommand } from "../../src/sim/core/commands";
import { SaveFormatError } from "../../src/sim/core/serialize";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";

let now = 1_000;
const clock = (): number => ++now;
let store: SaveStore;

function stateAt(days: number): GameState {
  return applyCommand(createInitialState(42), { type: "AdvanceDays", n: days });
}

beforeEach(async () => {
  store = await SaveStore.open(new IDBFactory(), clock);
});
afterEach(() => store.close());

describe("IndexedDB (AC-10)", () => {
  it("sauvegarde puis chargement : même hash", async () => {
    const s = stateAt(123);
    await store.save("partie-1", s, "Trost");
    const loaded = await store.load("partie-1");
    expect(stateHash(loaded)).toBe(stateHash(s));
    const list = await store.list();
    expect(list.map((x) => x.slot)).toEqual(["partie-1"]);
    expect(list[0]?.label).toBe("Trost");
  });

  it("rotation sur 3 sauvegardes automatiques", async () => {
    for (let i = 1; i <= 5; i++) await store.autosave(stateAt(i));
    const autos = (await store.list()).filter((x) => x.slot.startsWith("auto-"));
    expect(autos).toHaveLength(3);
    // 5 écritures : auto-1 (1, puis 4), auto-2 (2, puis 5), auto-3 (3)
    expect((await store.load("auto-1")).date.day).toBe(5);
    expect((await store.load("auto-2")).date.day).toBe(6);
    expect((await store.load("auto-3")).date.day).toBe(4);
    expect(autos[0]?.slot).toBe("auto-2"); // la plus récente en tête
  });

  it("JSON corrompu → erreur explicite, sans plantage du magasin", async () => {
    await store.putRaw({ slot: "abime", label: "x", savedAt: 1, schemaVersion: 1, hash: "00000000", data: "{tronqué" });
    await expect(store.load("abime")).rejects.toThrow(SaveFormatError);
    await expect(store.load("abime")).rejects.toThrow(/abime.*JSON invalide/);
    await store.save("ok", stateAt(2));
    expect(stateHash(await store.load("ok"))).toBe(stateHash(stateAt(2)));
  });

  it("données modifiées → hash incohérent détecté", async () => {
    const s = stateAt(10);
    const good = JSON.stringify({ ...s, commandIndex: 99 });
    await store.putRaw({ slot: "triche", label: "x", savedAt: 1, schemaVersion: s.schemaVersion, hash: stateHash(s), data: good });
    await expect(store.load("triche")).rejects.toThrow(/hash/);
  });

  it("créneau absent ou nom invalide", async () => {
    await expect(store.load("rien")).rejects.toThrow(/Aucune sauvegarde/);
    await expect(store.save("../x", stateAt(1))).rejects.toThrow(/invalide/);
  });
});

describe("export / import fichier (AC-11)", () => {
  it("export → import redonne le même hash", () => {
    const s = stateAt(777);
    expect(stateHash(importSave(exportSave(s, 0)))).toBe(stateHash(s));
  });
  it("fichiers invalides", () => {
    expect(() => importSave("nope")).toThrow(SaveFormatError);
    expect(() => importSave(JSON.stringify({ format: "autre" }))).toThrow(/format/);
    const tampered = JSON.parse(exportSave(stateAt(3), 0)) as { state: { world: { noise: number } } };
    tampered.state.world.noise = 0.5;
    expect(() => importSave(JSON.stringify(tampered))).toThrow(/corrompu/);
  });
});
