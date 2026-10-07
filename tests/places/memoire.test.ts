import { IDBFactory } from "fake-indexeddb";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FrozenPlanSchema } from "../../src/data/placeSchema";
import { frozenHash, frozenLayout } from "../../src/render/tactical3d/places/frozen";
import { PLACE_CACHE_SIZE, PlaceCache } from "../../src/render/tactical3d/places/placeCache";
import { BUILDING_STATES, PlaceDeltaStore, decodeMods, encodeMods } from "../../src/save/placeDeltas";
import type { BuildingDelta } from "../../src/save/placeDeltas";
import { frozenIds } from "../../src/tools/places/check";
import { generateVillage } from "../../src/tools/places/village";

/**
 * Mémoire des lieux (R1e.6, CR1e-09, consigne §4) :
 * - chaque plan figé (`data/places/generated/*.json`) reproduit l'empreinte de rendu écrite au gel, sans relancer de générateur ;
 * - deltas : 100 lieux modifiés (400 bâtiments chacun) tiennent sous 200 Kio dans IndexedDB, et se relisent à l'identique ;
 * - cache LRU de 8 lieux : le moins récemment utilisé est libéré.
 */
describe("R1e.6 — plans figés (CR1e-09)", () => {
  const ids = frozenIds();
  it("au moins un lieu N2 figé (village de démonstration)", () => {
    expect(ids).toContain("village-des-saules");
  });
  for (const id of ids) {
    it(`${id} : même empreinte de rendu qu'au gel`, () => {
      const plan = FrozenPlanSchema.parse(JSON.parse(readFileSync(`data/places/generated/${id}.json`, "utf8")));
      const h = frozenHash(plan);
      console.log(`${id} : empreinte ${h} (gel : ${plan.empreinte}), ${plan.b.length} bâtiments, ${plan.t.length} arbres`);
      expect(h).toBe(plan.empreinte);
      expect(frozenLayout(plan).houses).toHaveLength(plan.b.length);
    });
  }
  it("le générateur de village est déterministe (même graine → même plan)", () => {
    const spec = { id: "essai", nom: "Essai", libelle: "Essai", canon: "A" as const, province: null, style: "E11", graine: 7, population: 300 };
    expect(JSON.stringify(generateVillage(spec))).toBe(JSON.stringify(generateVillage(spec)));
  });
});

describe("R1e.6 — deltas des lieux (CR1e-09)", () => {
  // Suite pseudo-aléatoire fixe (aucun Math.random).
  let s = 12345;
  const rnd = (): number => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 2 ** 32;
  };
  const modsFor = (n: number, max: number): BuildingDelta[] =>
    Array.from({ length: n }, () => ({ index: Math.floor(rnd() * max), state: BUILDING_STATES[Math.floor(rnd() * 4)] as BuildingDelta["state"], ruin: Math.round(rnd() * 100) }));

  it("encodage : aller-retour exact (une modification par bâtiment, la dernière l'emporte)", () => {
    const mods = [...modsFor(300, 9000), { index: 5, state: "detruit" as const, ruin: 100 }];
    const back = decodeMods(encodeMods(mods));
    const last = new Map(mods.map((m) => [m.index, m] as const));
    expect(back).toHaveLength(last.size);
    for (const m of back) expect(m).toEqual(last.get(m.index));
  });

  it("100 lieux modifiés (400 bâtiments chacun) : < 200 Kio dans IndexedDB", async () => {
    const store = await PlaceDeltaStore.open(new IDBFactory(), "essai-deltas");
    let bytes = 0;
    for (let p = 0; p < 100; p++) bytes += await store.put({ place: `lieu-${p}`, version: 1, mods: modsFor(400, 12000) });
    const total = await store.totalBytes();
    console.log(`deltas : 100 lieux × 400 bâtiments → ${bytes} octets de données, ${total} octets avec les clés (${(total / 1024).toFixed(1)} Kio)`);
    expect(total).toBeLessThan(200 * 1024);
    const one = await store.get("lieu-42", 1);
    expect(one?.mods.length).toBeGreaterThan(300);
    expect(await store.get("lieu-42", 2)).toBeNull();
    store.close();
  });
});

describe("R1e.6 — cache LRU des lieux", () => {
  it(`garde ${PLACE_CACHE_SIZE} lieux ; libère le moins récemment utilisé`, async () => {
    const disposed: string[] = [];
    const cache = new PlaceCache(async (id: string) => ({ id, dispose: () => disposed.push(id) }));
    for (let i = 0; i < PLACE_CACHE_SIZE; i++) await cache.get(`l${i}`);
    await cache.get("l0"); // l0 redevient le plus récent
    await cache.get("l8");
    await cache.get("l9");
    expect(disposed).toEqual(["l1", "l2"]);
    expect(cache.keys()).toHaveLength(PLACE_CACHE_SIZE);
    expect(cache.has("l0")).toBe(true);
    let loads = 0;
    const c2 = new PlaceCache(async (id: string) => {
      loads++;
      return { id, dispose: () => undefined };
    });
    await Promise.all([c2.get("a"), c2.get("a")]);
    expect(loads).toBe(1);
  });
});
