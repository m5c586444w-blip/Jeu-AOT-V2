import { describe, expect, it } from "vitest";
import { stepBattle } from "../../src/sim/tactical/battle";
import { battle, tb } from "./tactical-helpers";

describe("Titans purs (AC4-05, 03 §5)", () => {
  it("la nuit, la vision tombe à vision_night : un soldat à 100 m est vu de jour, pas de nuit", () => {
    for (const night of [false, true]) {
      const bt = battle("tmap_plaine", "ttype_moyen_errant", 6, 1, night);
      const t = bt.state.titans[0];
      if (!t) throw new Error();
      for (const s of bt.state.soldiers) Object.assign(s, { x: t.x, y: t.y + 100, z: 0, mode: "sol" });
      // Personne n'utilise l'ODM : seul l'œil compte (pas de bruit de gaz).
      for (const sq of bt.state.squads) sq.order = "tenir";
      stepBattle(bt);
      expect(t.target !== null).toBe(!night);
    }
    expect(tb.titans.vision_night_m).toBeLessThan(100);
  });

  it("attraction : le Titan errant vise le plus proche ; l'anormal « ignorant » vise le plus lointain", () => {
    for (const [type, farthest] of [["ttype_moyen_errant", false], ["ttype_anormal_ignorant", true]] as const) {
      const bt = battle("tmap_plaine", type, 6, 2);
      const t = bt.state.titans[0];
      if (!t) throw new Error();
      bt.state.soldiers.forEach((s, i) => Object.assign(s, { x: t.x, y: t.y + 30 + i * 15, z: 0, mode: "sol" }));
      for (const sq of bt.state.squads) sq.order = "tenir";
      stepBattle(bt);
      expect(t.target).toBe(farthest ? bt.state.soldiers.length - 1 : 0);
    }
  });

  it("un membre coupé repousse (régénération), la nuque seule tue", () => {
    const bt = battle();
    const t = bt.state.titans[0];
    if (!t) throw new Error();
    t.armL = tb.titans.limb_regen_s;
    const ticks = Math.ceil(tb.titans.limb_regen_s * tb.tick_hz) + 2;
    // Soldats qui tiennent leur position hors de vue : la bataille continue, on n'observe que la repousse.
    for (const sq of bt.state.squads) sq.order = "tenir";
    for (const s of bt.state.soldiers) Object.assign(s, { x: 200, y: 299, z: 0, mode: "sol" });
    t.x = 200;
    t.y = 5;
    for (let i = 0; i < ticks; i++) stepBattle(bt);
    expect(t.armL).toBe(0);
    expect(t.alive).toBe(true);
  });
});
