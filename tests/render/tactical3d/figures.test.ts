import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { colorOf, forwardOf, lowestY, measureBox, measureHeight, worldPoint } from "../../../src/render/tactical3d/rig";
import { TITAN_LARGE, TITAN_POSES, TITAN_SMALL, buildTitan } from "../../../src/render/tactical3d/titan";
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
