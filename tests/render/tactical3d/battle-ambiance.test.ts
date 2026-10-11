import { describe, expect, it } from "vitest";
import { battleAmbiance, sunOffsetFor } from "../../../src/render/tactical3d/battle/ambiance";
import { crowdGeometry } from "../../../src/render/tactical3d/soldier";

/** Dettes n° 70 et 72 : heure (aube, jour, crépuscule, nuit) et pluie de la bataille 3D ; capuches levées sous la pluie. */
describe("ambiance de la bataille 3D", () => {
  it("jour et nuit gardent les réglages d'avant (soleil du matin au sud-est, nuit de la bataille)", () => {
    const day = battleAmbiance("jour", false, false);
    expect(day).toMatchObject({ sky: 0xaebfcc, fogNear: 450, fogFar: 2200, sunIntensity: 2.4, hemiIntensity: 1.5, exposure: 1.05, windows: 0 });
    expect(day.sunOffset).toEqual([260, 420, 180]);
    const night = battleAmbiance("jour", true, false);
    expect(night).toMatchObject({ sky: 0x1b2333, fogNear: 120, fogFar: 700, sunIntensity: 0.5, exposure: 0.7, windows: 0.85 });
    // La nuit vient de la bataille : l'heure choisie n'y change rien.
    expect(battleAmbiance("crepuscule", true, false)).toEqual(night);
  });

  it("aube : astre bas à l'est ; crépuscule : astre bas à l'ouest, teinte chaude, fenêtres plus allumées", () => {
    const dawn = battleAmbiance("aube", false, false);
    const dusk = battleAmbiance("crepuscule", false, false);
    const dist = Math.hypot(260, 420, 180);
    for (const a of [dawn, dusk]) {
      expect(Math.hypot(...a.sunOffset)).toBeCloseTo(dist, 6);
      expect(a.sunOffset[1]).toBeLessThan(dist * 0.2);
      expect(a.fogFar).toBeLessThan(2200);
    }
    expect(dawn.sunOffset[0]).toBeGreaterThan(dist * 0.9);
    expect(dusk.sunOffset[0]).toBeLessThan(-dist * 0.9);
    // Lumière du couchant : rouge > bleu nettement.
    expect(dusk.sunColor >> 16).toBeGreaterThan((dusk.sunColor & 0xff) + 100);
    expect(dusk.windows).toBeGreaterThan(dawn.windows);
    expect(dawn.windows).toBeGreaterThan(0);
    // Azimut 90° : plein est (x), sans composante nord-sud.
    const east = sunOffsetFor(0, 90);
    expect(east[0]).toBeCloseTo(dist, 6);
    expect(Math.abs(east[2])).toBeLessThan(1e-9);
  });

  it("pluie : brume rapprochée, soleil voilé, ciel plus gris, à toute heure", () => {
    for (const [light, night] of [["jour", false], ["aube", false], ["crepuscule", false], ["jour", true]] as const) {
      const dry = battleAmbiance(light, night, false);
      const wet = battleAmbiance(light, night, true);
      expect(wet.rain).toBe(true);
      expect(wet.fogFar).toBeLessThan(dry.fogFar * 0.6);
      expect(wet.sunIntensity).toBeCloseTo(dry.sunIntensity * 0.3, 6);
      const sat = (c: number): number => {
        const r = c >> 16;
        const g = (c >> 8) & 0xff;
        const b = c & 0xff;
        return Math.max(r, g, b) - Math.min(r, g, b);
      };
      if (!night) expect(sat(wet.sky)).toBeLessThan(sat(dry.sky));
    }
  });

  it("foule sous la pluie : la capuche verte de la cape remplace les cheveux (Corps de Reconnaissance)", () => {
    const colors = { veste: "#A07C52", pantalon: "#E8E4DA", bottes: "#4A3424", cape: "#355A3C" };
    const head = (capuche: boolean): Set<string> => {
      const g = crowdGeometry({ ...colors, capuche });
      const pos = g.getAttribute("position");
      const col = g.getAttribute("color");
      const out = new Set<string>();
      let top = -Infinity;
      for (let i = 0; i < pos.count; i++) top = Math.max(top, pos.getY(i));
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) > top - 0.03) out.add([col.getX(i), col.getY(i), col.getZ(i)].map((v) => v.toFixed(3)).join(","));
      return out;
    };
    const cape = (): string => {
      // Couleur des sommets du dos de la cape (plaque derrière le haut du torse, au-dessus des bonbonnes).
      const g = crowdGeometry(colors);
      const pos = g.getAttribute("position");
      const col = g.getAttribute("color");
      let best = -1;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 1.2 && pos.getY(i) < 1.4 && (best < 0 || pos.getZ(i) < pos.getZ(best))) best = i;
      return [col.getX(best), col.getY(best), col.getZ(best)].map((v) => v.toFixed(3)).join(",");
    };
    expect(head(true)).toEqual(new Set([cape()]));
    expect(head(false).has(cape())).toBe(false);
  });
});
