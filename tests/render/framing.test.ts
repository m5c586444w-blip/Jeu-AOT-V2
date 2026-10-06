import { describe, expect, it } from "vitest";
import { createBattle } from "../../src/sim/tactical/battle";
import { skirmishSetup } from "../../src/sim/tactical/setup";
import type { BattleSetup } from "../../src/sim/tactical/types";
import { computeFrame, edgeArrows, project } from "../../src/render/tactical/framing";
import type { Frame, UnitPose } from "../../src/render/tactical/framing";
import { world } from "../sim/tactical-helpers";

/**
 * R0, critère f (décision de l'utilisateur) : cadrage d'ouverture, piloté par tableau.
 * Exigences, pour chaque scénario :
 * - tous les hommes du joueur (pieds et tête) et chaque porteur (pieds et tête de son Titan) sont dans le champ ;
 * - l'échelle reste lisible : jamais sous l'échelle « carte entière » (vue d'ensemble, pastilles d'escouade) ;
 * - si tout ne tient pas, chaque Titan engagé hors champ est signalé par une flèche de bord, dans le champ, tournée vers lui.
 */
const SCENE_1366 = { width: 1014, height: 588 };
const SCENE_4K = { width: 3488, height: 2004 };

interface Scenario {
  name: string;
  scene: { width: number; height: number };
  setup: BattleSetup;
  /** Transformation des positions (miroir, déplacement du porteur). */
  transform?: (p: UnitPose, kind: "own" | "titan" | "shifter", mapW: number, mapH: number) => UnitPose;
}

const shifterTrial = (seed: number): BattleSetup => ({ ...skirmishSetup(world, "tmap_foret", [], 18, seed, false), shifters: [{ shifter: "shifter_cuirasse", side: "ennemi", name: "X", character: null, stress: 20 }], thunderSpears: true });
const mirror = (p: UnitPose, _k: string, _w: number, h: number): UnitPose => ({ ...p, y: h - p.y });
const corner = (p: UnitPose, k: string, w: number): UnitPose => (k === "shifter" ? { ...p, x: w - 6, y: 6 } : p);
const city300 = skirmishSetup(world, "tmap_ville", [{ type: "ttype_moyen_errant", count: 20 }], 280, 3, false);

const SCENARIOS: Scenario[] = [
  { name: "hommes au sud, porteur au nord (essai de porteur), 1366×768", scene: SCENE_1366, setup: shifterTrial(1) },
  { name: "hommes au sud, porteur au nord, 3840×2160", scene: SCENE_4K, setup: shifterTrial(1) },
  { name: "l'inverse : hommes au nord, porteur au sud, 1366×768", scene: SCENE_1366, setup: shifterTrial(2), transform: mirror },
  { name: "l'inverse, 3840×2160", scene: SCENE_4K, setup: shifterTrial(2), transform: mirror },
  { name: "porteur excentré (coin nord-est), 1366×768", scene: SCENE_1366, setup: shifterTrial(3), transform: corner },
  { name: "porteur excentré, 3840×2160", scene: SCENE_4K, setup: shifterTrial(3), transform: corner },
  { name: "300 unités (280 hommes, 20 Titans, ville), 1366×768", scene: SCENE_1366, setup: city300 },
  { name: "300 unités, 3840×2160", scene: SCENE_4K, setup: city300 },
];

function build(s: Scenario): { points: UnitPose[]; own: UnitPose[]; shifters: UnitPose[]; titans: { x: number; y: number; height: number; alive: boolean }[]; mapW: number; mapH: number } {
  const bt = createBattle(world, s.setup);
  const mapW = bt.map.width;
  const mapH = bt.map.height;
  const tf = s.transform ?? ((p: UnitPose) => p);
  const own = bt.state.soldiers.map((u) => tf({ x: u.x, y: u.y, z: 0, own: true }, "own", mapW, mapH));
  const titans = bt.state.titans.map((t) => {
    const p = tf({ x: t.x, y: t.y, z: t.height }, "titan", mapW, mapH);
    return { x: p.x, y: p.y, height: t.height, alive: t.alive };
  });
  const shifters = (bt.state.shifters ?? []).map((u) => {
    const h = world.shifters?.defs.get(u.shifter)?.height_m;
    return tf({ x: u.x, y: u.y, z: 0, reach: h ? (h[0] + h[1]) / 2 : 15 }, "shifter", mapW, mapH);
  });
  return { points: [...own, ...titans.map((t) => ({ x: t.x, y: t.y, z: t.height })), ...shifters], own, shifters, titans, mapW, mapH };
}

const toScreen = (f: Frame, x: number, y: number, z: number): [number, number] => {
  const [px, py] = project(x, y, z);
  return [px * f.zoom + f.x, py * f.zoom + f.y];
};
const inside = (s: { width: number; height: number }, [x, y]: [number, number]): boolean => x >= 0 && x <= s.width && y >= 0 && y <= s.height;

describe("cadrage d'ouverture de bataille (R0, critère f), piloté par tableau", () => {
  it.each(SCENARIOS.map((s) => [s.name, s] as const))("%s", (_name, s) => {
    const b = build(s);
    const f = computeFrame({ ...s.scene, mapW: b.mapW, mapH: b.mapH, points: b.points });
    // Hommes du joueur : pieds et tête (1,8 m).
    const lostMen = b.own.filter((p) => !inside(s.scene, toScreen(f, p.x, p.y, 0)) || !inside(s.scene, toScreen(f, p.x, p.y, 1.8)));
    expect(lostMen.length, `${lostMen.length} homme(s) hors champ sur ${b.own.length}`).toBe(0);
    // Porteurs : pieds et tête du Titan à venir.
    for (const p of b.shifters) {
      expect(inside(s.scene, toScreen(f, p.x, p.y, 0)), "pieds du porteur dans le champ").toBe(true);
      expect(inside(s.scene, toScreen(f, p.x, p.y, p.reach ?? 0)), "tête du porteur dans le champ").toBe(true);
    }
    // Zone de jeu : le sol de la carte couvre au moins 85 % de la scène (D-78), y compris quand tout ne tient pas.
    const gx = Math.max(0, Math.min(s.scene.width, b.mapW * f.zoom + f.x) - Math.max(0, f.x));
    const gy = Math.max(0, Math.min(s.scene.height, b.mapH * 0.8 * f.zoom + f.y) - Math.max(0, f.y));
    expect((gx * gy) / (s.scene.width * s.scene.height), "part de la scène couverte par le sol").toBeGreaterThanOrEqual(0.85);
    // Lisibilité : jamais sous l'échelle « carte entière ».
    expect(f.zoom).toBeGreaterThanOrEqual(f.fitZoom * 0.999);
    // Titans engagés hors champ : une flèche de bord chacun, dans le champ, tournée vers lui.
    const arrows = edgeArrows(f, b.titans, s.scene.width, s.scene.height);
    b.titans.forEach((t, i) => {
      if (!t.alive) return;
      const out = !inside(s.scene, toScreen(f, t.x, t.y, 0)) && !inside(s.scene, toScreen(f, t.x, t.y, t.height));
      const a = arrows.find((x) => x.titan === i);
      if (!out) {
        expect(a, `Titan ${i} dans le champ : pas de flèche`).toBeUndefined();
        return;
      }
      expect(a, `Titan ${i} hors champ : flèche de bord attendue`).toBeDefined();
      if (!a) return;
      expect(inside(s.scene, [a.x, a.y])).toBe(true);
      const [tx, ty] = toScreen(f, t.x, t.y, t.height / 2);
      expect(Math.cos(a.angle) * (tx - a.x) + Math.sin(a.angle) * (ty - a.y), `flèche ${i} tournée vers le Titan`).toBeGreaterThan(0);
    });
  });

  it("une flèche n'apparaît que pour un Titan hors champ ; tous dans le champ → aucune flèche", () => {
    const f = { zoom: 2, x: 0, y: 0 };
    const titans = [
      { x: 100, y: 100, height: 10, alive: true },
      { x: 5000, y: 100, height: 10, alive: true },
      { x: 5000, y: 100, height: 10, alive: false },
    ];
    const a = edgeArrows(f, titans, 1014, 588);
    expect(a.map((x) => x.titan)).toEqual([1]);
    expect(edgeArrows(f, [titans[0] as (typeof titans)[number]], 1014, 588)).toEqual([]);
  });
});
