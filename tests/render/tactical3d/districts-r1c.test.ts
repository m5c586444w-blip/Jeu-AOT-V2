import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateEnvironment } from "../../../src/render/tactical3d/environment";
import type { EnvData, WallPath } from "../../../src/render/tactical3d/envTypes";
import { WATER_ROUTE } from "../../../src/render/tactical3d/envTown";
import { nearestOnPath, v2 } from "../../../src/render/tactical3d/geom2";
import type { Vec2 } from "../../../src/render/tactical3d/geom2";
import { PROFILES, WALLS } from "../../../src/render/tactical3d/styles";

/**
 * Districts d'après l'animé (R1c.5, CR1c-08) : saillie avancée hors du mur, porte extérieure à sa pointe, porte intérieure dans
 * la ligne principale, rue principale pavée de porte à porte ; Shiganshina : voie d'eau par deux portes de rivière, barques
 * d'évacuation côté porte intérieure ; Trost 850 : porte bouchée par le rocher ; dimensions incertaines marquées « ? ».
 */
const R = WALLS.saillie_rayon_m.valeur;
const DISTRICTS = PROFILES.filter((p) => p.generateur === "district").map((p) => p.id);

function inside(poly: readonly Vec2[], q: Vec2): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Vec2;
    const b = poly[j] as Vec2;
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** Emprise d'une maison (rectangle tourné). */
function inBuilding(h: EnvData["buildings"][number], q: Vec2): boolean {
  const dx = q.x - h.x;
  const dy = q.y - h.y;
  const u = dx * Math.cos(h.angle) + dy * Math.sin(h.angle);
  const v = -dx * Math.sin(h.angle) + dy * Math.cos(h.angle);
  return Math.abs(u) <= h.width / 2 && Math.abs(v) <= h.depth / 2;
}

const lines = (e: EnvData): { main: WallPath; arc: WallPath } => {
  const [main, arc] = e.wall?.paths ?? [];
  if (!main || !arc) throw new Error(`${e.id} : mur absent`);
  return { main, arc };
};

describe("districts d'après l'animé (R1c.5)", () => {
  it("chaque district : saillie hors de la ligne du mur, porte extérieure à la pointe, porte intérieure dans la ligne principale", () => {
    expect(DISTRICTS.sort()).toEqual(["E01", "E02", "E03", "E04", "E05", "E07"]);
    for (const id of DISTRICTS) {
      const e = generateEnvironment(id, 850, null);
      const { main, arc } = lines(e);
      expect(main.path.every((q) => Math.abs(q.y) < 1e-6), id).toBe(true);
      // La saillie avance vers l'extérieur (sud) : demi-cercle de rayon R.
      expect(arc.path.every((q) => Math.abs(Math.hypot(q.x, q.y) - R) < 1 && q.y >= -1e-6), id).toBe(true);
      const outer = arc.gates.filter((g) => g.kind === "exterieure");
      const inner = main.gates.filter((g) => g.kind === "interieure");
      expect([outer.length, inner.length], id).toEqual([1, 1]);
      const tip = nearestOnPath(arc.path, v2(0, R));
      expect(Math.abs((outer[0]?.s ?? 0) - tip.s), `${id} : porte extérieure à la pointe`).toBeLessThan(2);
      const atZero = nearestOnPath(main.path, v2(0, 0));
      expect(Math.abs((inner[0]?.s ?? 0) - atZero.s), `${id} : porte intérieure face à la rue principale`).toBeLessThan(2);
    }
  });

  it("rue principale pavée de porte à porte, sans maison dessus", () => {
    for (const id of DISTRICTS) {
      const e = generateEnvironment(id, 850, null);
      for (let y = 4; y <= R - 4; y += 8) {
        const q = v2(0, y);
        expect(e.paving.some((p) => inside(p.poly, q)), `${id} : rue pavée à y = ${y}`).toBe(true);
        expect(e.buildings.some((h) => inBuilding(h, q)), `${id} : maison sur la rue à y = ${y}`).toBe(false);
      }
    }
  });

  it("Shiganshina : voie d'eau par deux portes de rivière, barques d'évacuation côté porte intérieure, ponts, lit libre de maisons", () => {
    const e = generateEnvironment("E01", 850, null);
    const { main, arc } = lines(e);
    const wg = [...main.gates, ...arc.gates].filter((g) => g.kind === "eau");
    expect(wg).toHaveLength(2);
    expect(main.gates.some((g) => g.kind === "eau") && arc.gates.some((g) => g.kind === "eau")).toBe(true);
    const canal = e.canals[0];
    expect(canal).toBeDefined();
    const path = canal?.path ?? [];
    // Le lit franchit les deux murs : il commence hors de la saillie et finit au nord de la ligne principale.
    expect(Math.hypot((path[0] as Vec2).x, (path[0] as Vec2).y)).toBeGreaterThan(R + 50);
    expect((path[path.length - 1] as Vec2).y).toBeLessThan(-100);
    // Les portes d'eau sont là où le lit franchit les murs.
    const mainGate = v2(R * WATER_ROUTE.mainX, 0);
    expect(nearestOnPath(path, mainGate).d).toBeLessThan(1);
    // Barques à flot près de la porte d'eau intérieure, dans le district.
    const boats = e.props.filter((p) => p.kind === "barques");
    expect(boats.length).toBeGreaterThanOrEqual(6);
    for (const b of boats) {
      expect(Math.hypot(b.x - mainGate.x, b.y - mainGate.y), "barque près de la porte intérieure").toBeLessThan(200);
      expect(b.y).toBeGreaterThan(0);
      expect(nearestOnPath(path, v2(b.x, b.y)).d).toBeLessThan((canal?.width ?? 0) / 2);
    }
    expect(e.stoneBridges.length).toBeGreaterThanOrEqual(3);
    for (const h of e.buildings) expect(nearestOnPath(path, v2(h.x, h.y)).d, `maison ${h.id} dans le lit`).toBeGreaterThan((canal?.width ?? 0) / 2);
    expect(e.landmarks.map((l) => l.kind)).toContain("caserne");
  });

  it("Trost 850 : la porte extérieure bouchée par le rocher ; les autres districts n'ont pas de voie d'eau", () => {
    const t = generateEnvironment("E02", 850, "850_rocher");
    expect(lines(t).arc.gates.find((g) => g.kind === "exterieure")?.state).toBe("rocher");
    for (const id of DISTRICTS.filter((d) => d !== "E01")) {
      const e = generateEnvironment(id, 850, null);
      expect(e.wall?.paths.flatMap((w) => w.gates).some((g) => g.kind === "eau"), id).toBe(false);
    }
  });

  it("dimensions incertaines marquées « ? » ; faits de l'animé notés dans les profils ; même graine, même district", () => {
    const murs = JSON.parse(readFileSync("data/art/murs.json", "utf8")) as Record<string, { canon: string }>;
    for (const k of ["saillie_rayon_m", "porte_eau_largeur_m", "porte_eau_hauteur_m", "porte_largeur_m"]) expect(murs[k]?.canon, k).toBe("?");
    const shig = PROFILES.find((p) => p.id === "E01");
    expect(shig?.notes_canon).toMatch(/portes de rivière/);
    expect(shig?.batiments.reperes).toContain("voie_eau_evacuation");
    const a = generateEnvironment("E01", 850, null);
    const b = generateEnvironment("E01", 850, null);
    expect(JSON.stringify(b.canals)).toBe(JSON.stringify(a.canals));
    expect(b.buildings.length).toBe(a.buildings.length);
  });
});
