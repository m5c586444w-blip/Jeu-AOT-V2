import { describe, expect, it } from "vitest";
import { spreadSlots } from "../../src/ui/mapRoutes";

/** Dette n° 36 : deux étendards proches ne partagent pas la même case (contact, armée de passage). */
describe("étendards de la carte qui ne se chevauchent pas (dette n° 36)", () => {
  it("une armée en marche arrêtée au contact d'une autre prend la case suivante ; loin, chacune garde la sienne", () => {
    const list = [
      { at: [100, 200] as [number, number], slot: 0 },
      { at: [102, 198] as [number, number], slot: 0 },
      { at: [300, 300] as [number, number], slot: 0 },
      { at: [101, 201] as [number, number], slot: 1 },
    ];
    spreadSlots(list);
    expect(list.map((a) => a.slot)).toEqual([0, 1, 0, 2]);
  });
  it("les cases déjà distinctes d'une même province sont gardées", () => {
    const list = [
      { at: [5, 5] as [number, number], slot: 1 },
      { at: [5, 5] as [number, number], slot: 2 },
    ];
    spreadSlots(list);
    expect(list.map((a) => a.slot)).toEqual([1, 2]);
  });
});
