import { describe, expect, it } from "vitest";
import { walkParams } from "../../../src/render/tactical3d/crowdWalk";
import { CROWD_HIP, CROWD_SHOULDER, crowdGeometry } from "../../../src/render/tactical3d/soldier";
import { troopGeometry } from "../../../src/render/tactical3d/battle/units";

/** Dette n° 61 : la foule instanciée marche et court (membres marqués, pivot dans le shader). */
describe("marche de la foule instanciée (dette n° 61)", () => {
  const geos = {
    soldats: crowdGeometry({ veste: "#A07C52", pantalon: "#E4DECF", bottes: "#4B3322", cape: "#2F5A3A" }),
    "fantassins de Marley": troopGeometry("marley"),
    "fantassins de Paradis": troopGeometry("paradis"),
  };
  it("jambes sous la hanche, bras sous l'épaule, gauche en +x ; le reste du corps n'est pas marqué", () => {
    for (const [name, g] of Object.entries(geos)) {
      const limb = g.getAttribute("aLimb");
      const pos = g.getAttribute("position");
      expect(limb?.count, name).toBe(pos.count);
      const seen = new Set<number>();
      for (let i = 0; i < pos.count; i++) {
        const l = limb.getX(i);
        seen.add(l);
        if (l === 0) continue;
        expect(Math.sign(pos.getX(i)), `${name} sommet ${i}`).toBe(Math.sign(l));
        if (Math.abs(l) === 1) expect(pos.getY(i), `${name} jambe`).toBeLessThan(CROWD_HIP + 0.01);
        else {
          expect(pos.getY(i), `${name} bras`).toBeLessThan(CROWD_SHOULDER + 0.06);
          expect(pos.getY(i), `${name} bras`).toBeGreaterThan(CROWD_HIP - 0.1);
        }
      }
      expect([...seen].sort((a, b) => a - b), name).toEqual([-2, -1, 0, 1, 2]);
    }
  });
  it("pas selon l'état montré : immobile à l'arrêt, en vol ou mort ; la course balance plus vite et plus loin que la marche", () => {
    for (const st of ["attente", "garde", "vol", "mort", "tir"]) expect(walkParams(st).amp, st).toBe(0);
    const m = walkParams("marche");
    const c = walkParams("course");
    expect(m.amp).toBeGreaterThan(0);
    expect(c.amp).toBeGreaterThan(m.amp);
    expect(c.rate).toBeGreaterThan(m.rate);
  });
});
