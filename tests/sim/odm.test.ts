import { describe, expect, it } from "vitest";
import { pickAnchor, stepOdm } from "../../src/sim/tactical/odm";
import { battle, tb } from "./tactical-helpers";

describe("ODM (AC4-03, 03 §4.1)", () => {
  it("pas de vol sans ancrage à portée : au milieu d'une plaine vide, aucun ancrage fixe", () => {
    const bt = battle("tmap_plaine");
    const s = bt.state.soldiers[0];
    if (!s) throw new Error();
    // Point le plus éloigné de toute structure : aucun ancrage dans le rayon des crochets.
    s.x = 200;
    s.y = 290;
    s.z = 0;
    const near = bt.map.anchors.filter((a) => Math.hypot(a.x - s.x, a.y - s.y, a.z) <= tb.odm.hook_range_m);
    expect(pickAnchor(s, bt.map, tb, { x: 200, y: 150, z: 10 }, null) === null).toBe(near.length === 0);
  });

  it("gaz : consommé en poussée (1–2,5 u/s), nul en glisse ; l'arc balistique conserve la vitesse horizontale", () => {
    const bt = battle("tmap_foret");
    const s = bt.state.soldiers[0];
    const a = bt.map.anchors.find((x) => x.z > 30);
    if (!s || !a) throw new Error();
    Object.assign(s, { x: a.x, y: a.y + 40, z: 5, mode: "rail", anchor: { kind: "fixe", id: a.id, x: a.x, y: a.y, z: a.z }, gas: 100 });
    const dt = 1 / tb.tick_hz;
    const g0 = s.gas;
    stepOdm(s, bt.map, tb, bt.state.titans, dt, false, 1);
    const rate = (g0 - s.gas) / dt;
    expect(rate).toBeGreaterThanOrEqual(tb.odm.gas_thrust_per_s[0] - 1e-9);
    expect(rate).toBeLessThanOrEqual(tb.odm.gas_thrust_per_s[1] + 1e-9);
    Object.assign(s, { mode: "vol", anchor: null, z: 60, vx: 20, vy: 0, vz: 0, apex: 60 });
    const g1 = s.gas;
    stepOdm(s, bt.map, tb, bt.state.titans, dt, false, 1);
    expect(s.gas).toBe(g1);
    expect(s.vx).toBeGreaterThan(19);
    expect(s.vz).toBeLessThan(0);
  });

  it("chute sans gaz : dégâts selon la hauteur ; avec gaz, descente freinée", () => {
    const bt = battle("tmap_plaine");
    const s = bt.state.soldiers[0];
    if (!s) throw new Error();
    const dt = 1 / tb.tick_hz;
    const drop = (gas: number): number => {
      Object.assign(s, { x: 200, y: 290, z: 30, vx: 0, vy: 0, vz: 0, mode: "vol", anchor: null, apex: 30, gas });
      let fall = 0;
      for (let i = 0; i < 200 && s.mode === "vol"; i++) fall = stepOdm(s, bt.map, tb, bt.state.titans, dt, false, 1).fall;
      return fall;
    };
    expect(drop(0)).toBeGreaterThan(tb.odm.lethal_fall_m);
    expect(drop(50)).toBe(0);
  });
});
