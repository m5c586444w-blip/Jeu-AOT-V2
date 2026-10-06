import { describe, expect, it } from "vitest";
import { generateEnvironment } from "../../../src/render/tactical3d/environment";
import { buildEnvironmentMeshes } from "../../../src/render/tactical3d/envMesh";
import { LIGHT_PRESETS } from "../../../src/render/tactical3d/lighting";
import { QUALITY } from "../../../src/render/tactical3d/quality";
import { meshNames } from "../../../src/render/tactical3d/rig";
import { WEATHERS, createFires, createWeather } from "../../../src/render/tactical3d/weather";

/**
 * Cycle, météo, ruines et incendies (R1b.7, CR1b-12) : aube, jour, crépuscule, nuit ; brume, pluie, neige d'hiver ; feux dans la
 * variante « ruines et incendies », lumières de feu bornées par la qualité. Les rendus sont dans `npm run smoke:r1b`.
 */
describe("cycle et météo (R1b.7)", () => {
  it("quatre heures et quatre états du ciel", () => {
    expect([...LIGHT_PRESETS].sort()).toEqual(["aube", "crepuscule", "jour", "nuit"]);
    expect(WEATHERS).toEqual(["aucune", "brume", "pluie", "neige"]);
  });

  it("brume, pluie, neige : brouillard épaissi, soleil voilé, particules selon la qualité ; la neige retouche les matériaux", () => {
    const env = generateEnvironment("E13", 850, "hiver");
    const m = buildEnvironmentMeshes(env, { quality: "bas", textures: null });
    for (const kind of ["brume", "pluie", "neige"] as const) {
      const w = createWeather(m.group, kind, { seed: 850, particles: QUALITY.haut.particles, mistMap: null, groundY: 0, size: 1600 });
      expect(w.fogBoost, kind).toBeGreaterThan(1.5);
      expect(w.sunFactor, kind).toBeLessThan(0.6);
      if (kind === "brume") expect(meshNames(m.group).length).toBeGreaterThan(5);
      w.dispose();
    }
    const snow = createWeather(m.group, "neige", { seed: 850, particles: 1000, mistMap: null, groundY: 0, size: 1600 });
    let patched = 0;
    m.group.traverse((o) => {
      const mat = (o as { material?: { customProgramCacheKey?: () => string } }).material;
      if (mat?.customProgramCacheKey?.() === "neige") patched++;
    });
    expect(patched).toBeGreaterThan(5);
    snow.dispose();
    m.dispose();
  });

  it("ruines et incendies : des feux sur les maisons ruinées, des lumières de feu bornées par la qualité", () => {
    const env = generateEnvironment("E01", 850, "ruines");
    expect(env.fires.length).toBeGreaterThan(10);
    expect(env.buildings.filter((b) => b.ruin > 0.55).length).toBeGreaterThan(env.buildings.length * 0.4);
    const m = buildEnvironmentMeshes(env, { quality: "bas", textures: null });
    for (const q of ["bas", "moyen", "haut"] as const) {
      const f = createFires(m.group, env.fires, { lights: QUALITY[q].fireLights, puff: null, seed: 850 });
      expect(f.count).toBe(env.fires.length);
      expect(f.lights.length).toBe(Math.min(env.fires.length, QUALITY[q].fireLights));
      f.update(1.5);
      f.dispose();
    }
    expect(QUALITY.haut.fireLights).toBeGreaterThan(QUALITY.bas.fireLights);
    m.dispose();
  });
});
