import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colorOf, forwardOf, lowestY, measureBox, measureHeight, worldPoint } from "../../../src/render/tactical3d/rig";
import { buildOdm } from "../../../src/render/tactical3d/odm";
import { SOLDIER_HEIGHT_M, SOLDIER_POSES, buildSoldier, soldierHeight, soldierMaterials } from "../../../src/render/tactical3d/soldier";
import { TITAN_LARGE, TITAN_POSES, TITAN_SMALL, buildTitan } from "../../../src/render/tactical3d/titan";
import { generateTown } from "../../../src/render/tactical3d/town";
import type { Titan } from "../../../src/render/tactical3d/titan";

/**
 * Figures de l'essai 3D (R1.4–R1.5), mesurées sur la géométrie posée (boîte englobante sommet par sommet),
 * pas sur les paramètres déclarés.
 */
const types = JSON.parse(readFileSync("data/titan_types/purs.json", "utf8")) as { id: string; height_m: [number, number] }[];
const maxHeight = (id: string): number => types.find((t) => t.id === id)?.height_m[1] ?? NaN;
const PHASES = [0, 0.2, 0.45, 0.7, 1, 1.3, 1.7, 2.1];
const within = (v: number, target: number, tol = 0.1): boolean => Math.abs(v - target) <= tol * target;
const worldPos = (t: Titan, name: keyof Titan["joints"]): ReturnType<typeof worldPoint> => worldPoint(t.joints[name]);

describe("Titans 3D (R1.4)", () => {
  const small = buildTitan(TITAN_SMALL, 850);
  const large = buildTitan(TITAN_LARGE, 850);

  it("hauteurs : 5 m et 15 m à ±10 % (bornes hautes des classes petite et grande des données), à chaque instant de la marche", () => {
    expect(maxHeight("ttype_petit_errant")).toBe(5);
    expect(maxHeight("ttype_grand_errant")).toBe(15);
    for (const ph of PHASES) {
      small.setPose("marche", ph);
      large.setPose("marche", ph);
      const hs = measureHeight(small.body);
      const hl = measureHeight(large.body);
      expect(within(hs, 5), `petit, phase ${ph} : ${hs.toFixed(2)} m`).toBe(true);
      expect(within(hl, 15), `grand, phase ${ph} : ${hl.toFixed(2)} m`).toBe(true);
      expect(within(hl / hs, 3), `rapport grand/petit ${(hl / hs).toFixed(2)}`).toBe(true);
    }
  });

  it("anatomies différentes : tête, cou, longueur des bras, carrure", () => {
    for (const t of [small, large]) t.setPose("marche", 0);
    const headShare = (t: Titan): number => {
      const top = measureBox(t.body).max.y;
      return (top - worldPos(t, "tete").y) / top;
    };
    // Bout des doigts au repos, en fraction de la hauteur : le grand a les mains sous le genou.
    const reach = (t: Titan): number => lowestY(t.joints.poignetG) / measureBox(t.body).max.y;
    expect(headShare(small)).toBeGreaterThan(1.6 * headShare(large));
    // Le grand a les mains sous le genou, le petit à mi-cuisse.
    const knee = (t: Titan): number => worldPos(t, "genouG").y / measureBox(t.body).max.y;
    expect(reach(large)).toBeLessThan(knee(large));
    expect(reach(small)).toBeGreaterThan(knee(small) + 0.05);
    const shoulderRatio = (t: Titan): number => worldPos(t, "epauleG").distanceTo(worldPos(t, "epauleD")) / t.spec.height;
    expect(shoulderRatio(small)).toBeGreaterThan(1.25 * shoulderRatio(large));
  });

  it("membres articulés : 18 articulations nommées, la marche les fait bouger", () => {
    for (const t of [small, large]) {
      expect(Object.keys(t.joints)).toHaveLength(18);
      t.setPose("marche", 0.4);
      const a = worldPos(t, "chevilleG").clone().sub(worldPos(t, "chevilleD"));
      t.setPose("marche", 0.4 + Math.PI / (t.spec.id === "grand" ? 1.6 : 2.3));
      const b = worldPos(t, "chevilleG").clone().sub(worldPos(t, "chevilleD"));
      // Une demi-période plus tard, le pied gauche est passé de l'autre côté du droit.
      expect(Math.sign(a.z)).toBe(-Math.sign(b.z));
      expect(Math.abs(a.z)).toBeGreaterThan(0.1 * t.spec.height * t.spec.stride);
    }
  });

  it("expressions différentes : rictus (bouche fermée, dents serrées) contre bouche béante (mâchoire ouverte)", () => {
    const names = (t: Titan): Set<string> => {
      const s = new Set<string>();
      t.joints.tete.traverse((o) => s.add(o.name));
      return s;
    };
    small.setPose("marche", 0);
    large.setPose("marche", 0);
    expect(names(small).has("dents") && names(small).has("joue") && !names(small).has("gorge")).toBe(true);
    expect(names(large).has("gorge") && names(large).has("meche") && !names(large).has("joue")).toBe(true);
    expect(small.joints.machoire.rotation.x).toBeLessThan(0.05);
    expect(large.joints.machoire.rotation.x).toBeGreaterThan(0.3);
  });

  it("marque rouge sur la nuque : derrière le cou, sous le crâne, visible de dos", () => {
    for (const t of [small, large]) {
      t.setPose("marche", 0);
      const c = colorOf(t.nape);
      expect(c.r).toBeGreaterThan(0.4);
      expect(c.r).toBeGreaterThan(3 * c.g);
      const p = worldPoint(t.nape);
      const forward = forwardOf(t.group);
      const neck = worldPos(t, "cou");
      const head = worldPos(t, "tete");
      expect(p.clone().sub(head).dot(forward), t.spec.id).toBeLessThan(0);
      expect(p.y).toBeGreaterThan(neck.y - 0.02 * t.spec.height);
      expect(p.y).toBeLessThan(measureBox(t.body).max.y - 0.5 * t.spec.head * t.spec.height);
    }
  });

  it("trois poses : marche, saisie (bras tendu vers l'avant), abattu (couché au sol, vapeur)", () => {
    expect(TITAN_POSES).toEqual(["marche", "saisie", "abattu"]);
    for (const t of [small, large]) {
      t.setPose("saisie", 0);
      const chest = worldPos(t, "poitrine");
      const hand = worldPos(t, "poignetD");
      expect(hand.z - chest.z, t.spec.id).toBeGreaterThan(0.2 * t.spec.height);
      expect(t.steam.visible).toBe(false);
      t.setPose("abattu", 1);
      const box = measureBox(t.body);
      expect(box.min.y).toBeCloseTo(0, 3);
      expect(box.max.y - box.min.y, t.spec.id).toBeLessThan(0.3 * t.spec.height);
      expect(box.max.z - box.min.z).toBeGreaterThan(0.8 * t.spec.height);
      expect(t.steam.visible).toBe(true);
    }
  });
});

describe("soldats 3D et manœuvre (R1.5)", () => {
  const mats = soldierMaterials();
  const soldier = buildSoldier(7, mats);

  it("un soldat mesure 1,80 m à ±10 % (sans ses lames) ; rapports Titans/soldat conformes à ±10 %", () => {
    soldier.setPose("sol", 0);
    // Les lames levées en garde dépassent la tête : la boîte englobante complète (lames comprises) n'est pas la taille.
    const h = soldierHeight(soldier);
    expect(within(h, SOLDIER_HEIGHT_M), `${h.toFixed(3)} m`).toBe(true);
    expect(measureHeight(soldier.group)).toBeGreaterThan(h);
    const small = buildTitan(TITAN_SMALL, 850);
    const large = buildTitan(TITAN_LARGE, 850);
    small.setPose("marche", 0);
    large.setPose("marche", 0);
    expect(within(measureHeight(small.body) / h, 5 / 1.8)).toBe(true);
    expect(within(measureHeight(large.body) / h, 15 / 1.8)).toBe(true);
  });

  it("trois poses distinctes : vol (penché, cape au vent), accroché (genoux fléchis), au sol (en garde)", () => {
    expect(SOLDIER_POSES).toEqual(["vol", "accroche", "sol"]);
    const snap = (p: (typeof SOLDIER_POSES)[number]): number[] => {
      soldier.setPose(p, 0);
      return Object.values(soldier.joints).flatMap((g) => [g.rotation.x, g.rotation.y, g.rotation.z]);
    };
    const [v, a, s] = SOLDIER_POSES.map(snap) as [number[], number[], number[]];
    const diff = (x: number[], y: number[]): number => x.reduce((acc, xi, i) => acc + Math.abs(xi - (y[i] ?? 0)), 0);
    expect(diff(v, a)).toBeGreaterThan(1.5);
    expect(diff(v, s)).toBeGreaterThan(1.5);
    expect(diff(a, s)).toBeGreaterThan(1.5);
    soldier.setPose("vol", 0);
    expect(soldier.joints.cape.rotation.x).toBeLessThan(-0.8);
  });

  it("20 soldats en 4 escouades ; câbles tendus (longueur constante au cours du balancement) ; traînées de gaz derrière les soldats en vol", () => {
    const town = generateTown(850);
    const large = buildTitan(TITAN_LARGE, 850);
    const p = town.plaza.centers.map((c) => ({ x: c.x, z: c.y }));
    large.group.position.set(p[0]?.x ?? 0, 0, (p[0]?.z ?? 0) + 20);
    const odm = buildOdm(town, 850, mats, null, {
      plaza: worldPoint(large.group).setX(p[0]?.x ?? 0).setZ(p[0]?.z ?? 0),
      market: worldPoint(large.group).setX(p[1]?.x ?? 0).setZ(p[1]?.z ?? 40),
      titanLarge: large.group,
      titanSmall: worldPoint(large.group).setX((p[1]?.x ?? 0) + 5),
      largeShoulders: [large.joints.epauleG, large.joints.epauleD],
    });
    expect(odm.units).toHaveLength(20);
    for (let q = 0; q < 4; q++) expect(odm.units.filter((u) => u.squad === q)).toHaveLength(5);
    expect(new Set(odm.units.map((u) => u.mode))).toEqual(new Set(["vol", "accroche", "sol"]));
    odm.update(0, null);
    const c0 = odm.cableSegments();
    odm.update(1.3, null);
    const c1 = odm.cableSegments();
    expect(c0.length).toBeGreaterThanOrEqual(16);
    for (const [i, seg] of c0.entries()) {
      const later = c1[i];
      expect(seg.from.distanceTo(seg.to)).toBeGreaterThan(2);
      // Escouade 1 (pendules sur façade) : l'ancrage est fixe, la distance ancrage–soldat ne change pas : le câble reste tendu.
      if (odm.units[seg.unit]?.squad === 0 && later) expect(seg.to.distanceTo(seg.root)).toBeCloseTo(later.to.distanceTo(later.root), 3);
    }
    const trails = odm.trailPoints();
    expect(trails).toHaveLength(10);
    for (const tr of trails) {
      expect(tr).toHaveLength(28);
      // Longueur du chemin, pas distance entre extrémités : un pendule repasse par les mêmes points.
      const path = tr.slice(1).reduce((acc, pt, i) => acc + pt.distanceTo(tr[i] ?? pt), 0);
      expect(path).toBeGreaterThan(2);
    }
  });
});
