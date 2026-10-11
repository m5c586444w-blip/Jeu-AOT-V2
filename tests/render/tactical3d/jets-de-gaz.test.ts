import { describe, expect, it } from "vitest";
import { NOZZLE_Z, PUFFS_PER_SOLDIER, PUFF_EVERY_S, PUFF_LIFE_S, puffLook, trailStep } from "../../../src/render/tactical3d/battle/gasJets";

/** Jets de gaz de l'équipement de manœuvre (CLAUDE.md § Style des soldats : sortie de gaz au bas du dos). */
describe("jets de gaz en bataille 3D", () => {
  it("une bouffée à la hauteur du bas du dos quand le gaz baisse, au plus une par intervalle ; aucune sans dépense", () => {
    let tr = trailStep([], true, 10, 5, 6, 12);
    expect(tr).toEqual([{ t: 10, x: 5, y: 6, z: 12 + NOZZLE_Z }]);
    tr = trailStep(tr, true, 10 + PUFF_EVERY_S / 2, 5.5, 6, 12);
    expect(tr).toHaveLength(1);
    tr = trailStep(tr, true, 10 + PUFF_EVERY_S, 6, 6, 12);
    expect(tr).toHaveLength(2);
    expect(trailStep([], false, 10, 0, 0, 0)).toEqual([]);
  });

  it("les bouffées se dissipent après leur durée de vie ; liste bornée par soldat", () => {
    let tr = trailStep([], true, 0, 0, 0, 0);
    tr = trailStep(tr, false, PUFF_LIFE_S + 0.01, 0, 0, 0);
    expect(tr).toEqual([]);
    let long: ReturnType<typeof trailStep> = [];
    for (let k = 0; k < 40; k++) long = trailStep(long, true, k * PUFF_EVERY_S, k, 0, 0);
    expect(long.length).toBeLessThanOrEqual(PUFFS_PER_SOLDIER);
  });

  it("naît petite et dense, grossit en s'effaçant", () => {
    expect(puffLook(0).r).toBeLessThan(puffLook(1).r);
    expect(puffLook(0).fade).toBe(1);
    expect(puffLook(PUFF_LIFE_S).fade).toBe(0);
  });
});
