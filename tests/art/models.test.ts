import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Modèles 3D créés par le projet (C10, ERRATA_V3 §4) : lecture directe du JSON glTF des .glb (sans three).
 * Budget d'accessoire (≤ 1 500 triangles, ≤ 4 matériaux nommés), dimensions réelles en mètres, axe Y haut, échelle appliquée,
 * origine à la poignée ou au sol.
 */
interface Accessor { count: number; min?: number[]; max?: number[]; type: string }
interface Gltf {
  asset: { version: string };
  nodes: { mesh?: number; scale?: number[]; rotation?: number[]; translation?: number[]; children?: number[] }[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number; material?: number; mode?: number }[] }[];
  materials?: { name?: string }[];
  accessors: Accessor[];
  images?: unknown[];
}

function lire(fichier: string): Gltf {
  const b = readFileSync(`docs/art/assets/projet/${fichier}`);
  expect(b.toString("ascii", 0, 4)).toBe("glTF");
  const longueurJson = b.readUInt32LE(12);
  expect(b.toString("ascii", 16, 20)).toBe("JSON");
  return JSON.parse(b.toString("utf8", 20, 20 + longueurJson)) as Gltf;
}

type V3 = [number, number, number];
function acc(g: Gltf, i: number | undefined): Accessor {
  const a = i === undefined ? undefined : g.accessors[i];
  if (!a) throw new Error(`accesseur ${String(i)} absent`);
  return a;
}

function triangles(g: Gltf): number {
  let n = 0;
  for (const m of g.meshes) for (const p of m.primitives) {
    expect(p.mode ?? 4).toBe(4);
    n += acc(g, p.indices).count / 3;
  }
  return n;
}

/** Boîte englobante [min, max] des positions (axes glTF : X droite, Y haut, Z vers l'avant). */
function boite(g: Gltf): { min: V3; max: V3 } {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const m of g.meshes) for (const p of m.primitives) {
    const a = acc(g, p.attributes.POSITION);
    const [amin, amax] = [a.min ?? [], a.max ?? []];
    for (const i of [0, 1, 2] as const) {
      min[i] = Math.min(min[i], amin[i] ?? Infinity);
      max[i] = Math.max(max[i], amax[i] ?? -Infinity);
    }
  }
  return { min, max };
}

interface Attendu {
  fichier: string;
  /** Plage plausible [min, max] des dimensions en mètres : largeur (X), hauteur (Y), profondeur (Z). */
  largeur: [number, number];
  hauteur: [number, number];
  profondeur: [number, number];
  origine: "poignee" | "sol";
}
const MODELES: Attendu[] = [
  { fichier: "lame_odm.glb", largeur: [0.03, 0.15], hauteur: [0.8, 1.2], profondeur: [0.02, 0.15], origine: "poignee" },
  { fichier: "lance_de_foudre.glb", largeur: [0.05, 0.2], hauteur: [1.3, 2.2], profondeur: [0.05, 0.2], origine: "poignee" },
  { fichier: "fusil.glb", largeur: [0.03, 0.15], hauteur: [0.1, 0.4], profondeur: [1.0, 1.6], origine: "poignee" },
  { fichier: "canon_chariot.glb", largeur: [1.0, 2.0], hauteur: [0.9, 2.0], profondeur: [2.5, 4.5], origine: "sol" },
  { fichier: "dispositif_odm.glb", largeur: [0.4, 0.8], hauteur: [0.2, 0.6], profondeur: [0.3, 0.8], origine: "poignee" },
];

describe("modèles créés par le projet (C10)", () => {
  for (const a of MODELES) {
    describe(a.fichier, () => {
      const g = lire(a.fichier);
      it("glTF 2.0, un seul maillage sans image", () => {
        expect(g.asset.version).toBe("2.0");
        expect(g.meshes).toHaveLength(1);
        expect(g.images ?? []).toHaveLength(0);
      });
      it("budget : de 1 à 1 500 triangles", () => {
        const n = triangles(g);
        expect(n).toBeGreaterThan(0);
        expect(n).toBeLessThanOrEqual(1500);
      });
      it("au plus 4 matériaux, tous nommés (noms distincts)", () => {
        const noms = (g.materials ?? []).map((m) => m.name ?? "");
        expect(noms.length).toBeGreaterThan(0);
        expect(noms.length).toBeLessThanOrEqual(4);
        for (const n of noms) expect(n).toMatch(/^[a-z_]+$/);
        expect(new Set(noms).size).toBe(noms.length);
      });
      it("échelle appliquée : aucun nœud n'est mis à l'échelle ni pivoté", () => {
        for (const n of g.nodes) {
          expect(n.scale ?? [1, 1, 1]).toEqual([1, 1, 1]);
          expect(n.rotation ?? [0, 0, 0, 1]).toEqual([0, 0, 0, 1]);
          expect(n.translation ?? [0, 0, 0]).toEqual([0, 0, 0]);
        }
      });
      it("dimensions réelles plausibles en mètres, axe Y haut", () => {
        const { min, max } = boite(g);
        const [l, h, p] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
        expect(l).toBeGreaterThanOrEqual(a.largeur[0]);
        expect(l).toBeLessThanOrEqual(a.largeur[1]);
        expect(h).toBeGreaterThanOrEqual(a.hauteur[0]);
        expect(h).toBeLessThanOrEqual(a.hauteur[1]);
        expect(p).toBeGreaterThanOrEqual(a.profondeur[0]);
        expect(p).toBeLessThanOrEqual(a.profondeur[1]);
      });
      it(a.origine === "sol" ? "origine au sol (Y minimal = 0, centré en X)" : "origine à la poignée (à l'intérieur de la boîte englobante)", () => {
        const { min, max } = boite(g);
        if (a.origine === "sol") {
          expect(min[1]).toBeCloseTo(0, 3);
          expect((min[0] + max[0]) / 2).toBeCloseTo(0, 2);
        } else {
          for (const i of [0, 1, 2] as const) {
            expect(min[i]).toBeLessThanOrEqual(1e-6);
            expect(max[i]).toBeGreaterThanOrEqual(-1e-6);
          }
        }
      });
    });
  }

  it("la lame et la lance s'étendent vers +Y (poignée en bas) ; le fusil vers l'avant (+Z glTF)", () => {
    expect(boite(lire("lame_odm.glb")).max[1]).toBeGreaterThan(0.8);
    expect(boite(lire("lance_de_foudre.glb")).max[1]).toBeGreaterThan(1.3);
    expect(boite(lire("fusil.glb")).max[2]).toBeGreaterThan(0.8);
  });
});
