import { describe, expect, it } from "vitest";
import { COATS, HORSE, gaitParams, horseGeometry, riderGeometry } from "../../../src/render/tactical3d/battle/horses";

/** Cavaliers de la bataille 3D (fichier 18, R3.6 : cheval animé, marche et galop). */
describe("chevaux et cavaliers de la bataille 3D", () => {
  it("cheval : garrot vers 1,6 m, regard vers +z, quatre pattes marquées (avant ±2, arrière ±1) posées au sol", () => {
    const g = horseGeometry();
    const pos = g.getAttribute("position");
    const limb = g.getAttribute("aLimb");
    let minY = Infinity;
    let maxZ = -Infinity;
    let minZ = Infinity;
    const codes = new Set<number>();
    for (let i = 0; i < pos.count; i++) {
      minY = Math.min(minY, pos.getY(i));
      maxZ = Math.max(maxZ, pos.getZ(i));
      minZ = Math.min(minZ, pos.getZ(i));
      codes.add(limb.getX(i));
    }
    expect(minY).toBeCloseTo(0, 2);
    // La tête dépasse vers l'avant plus loin que la queue vers l'arrière ; longueur totale de 2,5 à 3,2 m.
    expect(maxZ).toBeGreaterThan(-minZ);
    expect(maxZ - minZ).toBeGreaterThan(2.5);
    expect(maxZ - minZ).toBeLessThan(3.2);
    expect([...codes].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
    // Sommets des pattes sous le pivot de l'épaule ou de la hanche.
    for (let i = 0; i < pos.count; i++) if (limb.getX(i) !== 0) expect(pos.getY(i)).toBeLessThanOrEqual(HORSE.legPivotY + 1e-6);
    expect(COATS.length).toBeGreaterThanOrEqual(4);
  });

  it("cavalier en selle : rien sous les flancs plus bas que les étriers, tête vers 2,4 m ; allures marche et galop, arrêt sinon", () => {
    for (const style of ["paradis", "marley"] as const) {
      const pos = riderGeometry(style).getAttribute("position");
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        minY = Math.min(minY, pos.getY(i));
        maxY = Math.max(maxY, pos.getY(i));
      }
      expect(minY).toBeGreaterThan(0.9);
      expect(maxY).toBeGreaterThan(2.3);
      expect(maxY).toBeLessThan(2.6);
    }
    expect(gaitParams("course").rate).toBeGreaterThan(gaitParams("marche").rate);
    expect(gaitParams("course").amp).toBeGreaterThan(gaitParams("marche").amp);
    expect(gaitParams("arret")).toEqual({ amp: 0, rate: 0 });
  });
});
