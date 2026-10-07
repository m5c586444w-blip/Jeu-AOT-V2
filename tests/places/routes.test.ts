import { describe, expect, it } from "vitest";
import { placeForEnv } from "../../src/render/tactical3d/places/envRoutes";

/** Consigne R1e §2.3 : `?proto3d&env=E01` charge le lieu Shiganshina ; `&scene=r1b` garde la scène générée de R1b (outils). */
describe("R1e.4 — E01 remplacée par le lieu shiganshina", () => {
  it("env=E01 → shiganshina ; env=e01 aussi ; autres environnements inchangés", () => {
    expect(placeForEnv(new URLSearchParams("proto3d&env=E01"))).toBe("shiganshina");
    expect(placeForEnv(new URLSearchParams("proto3d&env=e01"))).toBe("shiganshina");
    expect(placeForEnv(new URLSearchParams("proto3d&env=E02"))).toBeNull();
    expect(placeForEnv(new URLSearchParams("proto3d"))).toBeNull();
  });
  it("scene=r1b garde l'ancienne scène", () => {
    expect(placeForEnv(new URLSearchParams("proto3d&env=E01&scene=r1b"))).toBeNull();
  });
});
