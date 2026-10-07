import { writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { createBattle } from "../../src/sim/tactical/battle";
import { skirmishSetup } from "../../src/sim/tactical/setup";
import type { BattleSetup } from "../../src/sim/tactical/types";
import { shifterFlashBounds, titanFigureBounds } from "../../src/render/tactical/figures";
import type { DrawnBox } from "../../src/render/tactical/figures";
import { FRAME_TOP_MARGIN_MIN_PX, computeFrame, drawnTitanHeight, edgeArrows, groundShare, project } from "../../src/render/tactical/framing";
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

/**
 * R0, critère f rouvert (revue de R0) : la tête du porteur était coupée par la barre de titre alors que le contrôle (un point
 * à mi-corps) passait. On calcule ici la boîte englobante de ce que la scène DESSINE pour le porteur, avec les tracés
 * réels (`figures.ts`, bornes Pixi, épaisseur des traits comprise) :
 * - la figure du Titan à sa hauteur dessinée (agrandie en vue d'ensemble), tête comprise, pour les 10 silhouettes et les
 *   deux sens : entièrement dans la zone visible, sous la marge haute retenue (24 px, jamais moins de 4 px) ;
 * - les éclairs : le centre des halos et les zigzags ENTIERS dans la zone visible, sous la marge haute (R1e §6, point 8).
 * La zone visible est la scène (le canevas sous la barre de titre).
 */
describe("R0 f rouvert : boîte englobante du porteur dessiné (tête comprise) contre la zone visible", () => {
  const out: string[] = [];
  const withShifter = SCENARIOS.filter((s) => (s.setup.shifters ?? []).length > 0);
  it.each(withShifter.map((s) => [s.name, s] as const))("%s", (_name, s) => {
    const b = build(s);
    const f = computeFrame({ ...s.scene, mapW: b.mapW, mapH: b.mapH, points: b.points });
    const toScr = (w: DrawnBox): { x0: number; y0: number; x1: number; y1: number } => ({ x0: w.minX * f.zoom + f.x, y0: w.minY * f.zoom + f.y, x1: w.maxX * f.zoom + f.x, y1: w.maxY * f.zoom + f.y });
    for (const p of b.shifters) {
      const [fx, fy] = project(p.x, p.y, 0);
      const h = drawnTitanHeight(p.reach ?? 15, f.zoom, s.scene.width, s.scene.height);
      const parts: DrawnBox[] = [];
      for (let sil = 0; sil < 10; sil++) {
        for (const facing of [-1, 1]) {
          const t = titanFigureBounds(sil, facing);
          const k = h / 100;
          parts.push({ minX: fx + t.minX * k, minY: fy + t.minY * k, maxX: fx + t.maxX * k, maxY: fy + t.maxY * k });
        }
      }
      const scr = parts.map(toScr);
      const box = { x0: Math.min(...scr.map((q) => q.x0)), y0: Math.min(...scr.map((q) => q.y0)), x1: Math.max(...scr.map((q) => q.x1)), y1: Math.max(...scr.map((q) => q.y1)) };
      const margin = f.topMarginPx ?? 0;
      const where = `boîte du porteur (${box.x0.toFixed(1)}, ${box.y0.toFixed(1)}) – (${box.x1.toFixed(1)}, ${box.y1.toFixed(1)}) px dans une scène de ${s.scene.width}×${s.scene.height}, zoom ${f.zoom.toFixed(2)} px/m, figure de ${h.toFixed(1)} m, marge haute ${margin} px`;
      // Figure entière, tête comprise, sous la marge haute retenue (jamais moins de FRAME_TOP_MARGIN_MIN_PX).
      expect(margin, where).toBeGreaterThanOrEqual(f.boltsInFrame ? FRAME_TOP_MARGIN_MIN_PX : 2);
      expect(box.y0, `tête sous le bord haut, avec la marge haute : ${where}`).toBeGreaterThanOrEqual(margin - 0.5);
      expect(box.x0, `bord gauche : ${where}`).toBeGreaterThanOrEqual(0);
      expect(box.x1, `bord droit : ${where}`).toBeLessThanOrEqual(s.scene.width);
      expect(box.y1, `bord bas : ${where}`).toBeLessThanOrEqual(s.scene.height);
      // Éclairs : le pied des halos et les zigzags entiers se voient (R1e §6, point 8), sous la marge haute.
      const flash = shifterFlashBounds(fx, fy, h);
      for (const bolt of flash.bolts.map(toScr)) {
        // Sauf repli (sol sous 85 % même à la marge minimale) : le haut du zigzag, à côté de la figure, peut alors sortir.
        if (!f.boltsInFrame) continue;
        expect(bolt.y0 >= margin - 0.5 && bolt.y1 <= s.scene.height && bolt.x0 >= 0 && bolt.x1 <= s.scene.width, `zigzag entier visible (${bolt.y0.toFixed(1)} → ${bolt.y1.toFixed(1)} px) : ${where}`).toBe(true);
      }
      for (const halo of flash.halos.map(toScr)) {
        const cx = (halo.x0 + halo.x1) / 2;
        expect(cx >= 0 && cx <= s.scene.width && halo.y1 > 0 && halo.y0 < s.scene.height, `halo de l'éclair dans le champ : ${where}`).toBe(true);
      }
      out.push(`${s.name} : ${where} ; zigzags entiers : ${f.boltsInFrame ? "oui" : "non (repli)"} ; sol ${(100 * groundShare(f, { ...s.scene, mapW: b.mapW, mapH: b.mapH })).toFixed(1)} %`);
    }
  });

  // Détail par scénario, sur demande : R0_F_LOG=1 npx vitest run tests/render/framing.test.ts → docs/reports/R0-f-boite.log.
  afterAll(() => {
    if (process.env["R0_F_LOG"]) writeFileSync("docs/reports/R0-f-boite.log", `${out.join("\n")}\n`);
  });

  it("contrôle de la mesure : la figure dessinée dépasse la hauteur 100 (tête) ; les zigzags montent à 1,06 × la hauteur", () => {
    const tops = Array.from({ length: 10 }, (_, sil) => -titanFigureBounds(sil, 1).minY);
    expect(Math.max(...tops)).toBeGreaterThan(100);
    expect(Math.max(...tops)).toBeLessThanOrEqual(105);
    for (const bolt of shifterFlashBounds(0, 0, 15).bolts) expect(-bolt.minY).toBeGreaterThanOrEqual(15.9);
  });
});
