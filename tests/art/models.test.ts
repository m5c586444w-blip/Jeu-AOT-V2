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
  nodes: { name?: string; extras?: Record<string, unknown>; mesh?: number; scale?: number[]; rotation?: number[]; translation?: number[]; children?: number[] }[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number; material?: number; mode?: number }[] }[];
  materials?: { name?: string }[];
  accessors: Accessor[];
  images?: unknown[];
}

function lire(fichier: string, dossier = "projet"): Gltf {
  const b = readFileSync(`docs/art/assets/${dossier}/${fichier}`);
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

/**
 * Tenues par institution (tranche 2) : pièces rigides ajustées au corps de base `derives/humain.glb`, un nœud par os (le nœud porte le
 * nom de l'os qu'il suit), deux niveaux de détail, emblème porté référencé par identifiant (extras) et décalque d'emblème plat.
 */
const TENUES: { id: string; institution: string; emblem: string }[] = [
  { id: "bataillon_exploration", institution: "Bataillon d'exploration", emblem: "emb_org_survey_corps" },
  { id: "garnison", institution: "Garnison", emblem: "emb_org_garrison" },
  { id: "police_militaire", institution: "Police militaire", emblem: "emb_org_military_police" },
  { id: "corps_entrainement", institution: "Corps d'entraînement", emblem: "emb_org_training_corps" },
  { id: "police_interieure", institution: "Police intérieure (anti-personnel)", emblem: "emb_org_military_police" },
  { id: "marley_soldat", institution: "Soldat de Marley", emblem: "emb_fac_marley" },
  { id: "marley_officier", institution: "Officier de Marley", emblem: "emb_fac_marley" },
];
const OS_HUMAIN = new Set(lire("humain.glb", "derives").nodes.map((n) => n.name ?? ""));
const EMBLEMES = new Set((JSON.parse(readFileSync("data/emblems/emblems.json", "utf8")) as { emblems: { id: string }[] }).emblems.map((e) => e.id));

describe("corps de base humain.glb (référence des tenues)", () => {
  it("expose les os utilisés par les tenues", () => {
    for (const os of ["spine_02", "spine_03", "pelvis", "head", "neck_01", "upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r", "thigh_l", "thigh_r", "calf_l", "calf_r", "foot_l", "foot_r", "clavicle_l", "clavicle_r"]) {
      expect(OS_HUMAIN.has(os), os).toBe(true);
    }
  });
});

describe("tenues par institution (C10, tranche 2)", () => {
  it("couvre les cinq institutions de Paradis et Marley (soldat, officier)", () => {
    expect(TENUES.map((t) => t.institution)).toEqual(expect.arrayContaining(["Bataillon d'exploration", "Garnison", "Police militaire", "Corps d'entraînement", "Police intérieure (anti-personnel)", "Soldat de Marley", "Officier de Marley"]));
  });
  for (const t of TENUES) {
    for (const [lod, budget] of [[0, 8000], [1, 2000]] as const) {
      const fichier = `tenue_${t.id}_lod${String(lod)}.glb`;
      describe(fichier, () => {
        const g = lire(fichier);
        it("glTF 2.0 sans image ; maillages de 1 à budget triangles", () => {
          expect(g.asset.version).toBe("2.0");
          expect(g.images ?? []).toHaveLength(0);
          const n = triangles(g);
          expect(n).toBeGreaterThan(0);
          expect(n).toBeLessThanOrEqual(budget);
        });
        it("au plus 4 matériaux, tous nommés (noms distincts)", () => {
          const noms = (g.materials ?? []).map((m) => m.name ?? "");
          expect(noms.length).toBeGreaterThanOrEqual(3);
          expect(noms.length).toBeLessThanOrEqual(4);
          for (const n of noms) expect(n).toMatch(/^[a-z_]+$/);
          expect(new Set(noms).size).toBe(noms.length);
        });
        it("chaque nœud porte le nom d'un os de humain.glb, sans transformation (échelle appliquée)", () => {
          const maillees = g.nodes.filter((n) => n.mesh !== undefined);
          expect(maillees.length).toBeGreaterThanOrEqual(10);
          const noms = maillees.map((n) => n.name ?? "");
          for (const nom of noms) expect(OS_HUMAIN.has(nom), nom).toBe(true);
          expect(new Set(noms).size).toBe(noms.length);
          for (const n of g.nodes) {
            expect(n.scale ?? [1, 1, 1]).toEqual([1, 1, 1]);
            expect(n.rotation ?? [0, 0, 0, 1]).toEqual([0, 0, 0, 1]);
            expect(n.translation ?? [0, 0, 0]).toEqual([0, 0, 0]);
          }
        });
        it("hauteur 1,5 à 2,0 m, origine aux pieds (Y minimal 0), symétrique en X", () => {
          const { min, max } = boite(g);
          expect(max[1] - min[1]).toBeGreaterThanOrEqual(1.5);
          expect(max[1] - min[1]).toBeLessThanOrEqual(2.0);
          expect(min[1]).toBeCloseTo(0, 3);
          expect(Math.abs((min[0] + max[0]) / 2)).toBeLessThan(0.02);
          expect(max[0] - min[0]).toBeGreaterThan(0.6);
          expect(max[0] - min[0]).toBeLessThan(1.2);
        });
        it(`porte l'emblème ${t.emblem} en extras (id, os, position, largeur), emblème existant dans data/emblems`, () => {
          const porteur = g.nodes.find((n) => n.extras?.emblem_id !== undefined);
          expect(porteur?.extras?.emblem_id).toBe(t.emblem);
          expect(EMBLEMES.has(t.emblem)).toBe(true);
          expect(porteur?.extras?.emblem_os).toBe(porteur?.name);
          expect(["poitrine", "dos"]).toContain(porteur?.extras?.emblem_face);
          expect(porteur?.extras?.emblem_pos).toHaveLength(3);
          expect(Number(porteur?.extras?.emblem_largeur_m)).toBeGreaterThan(0.05);
          expect(g.nodes.some((n) => n.extras?.tenue_id === t.id)).toBe(true);
        });
      });
    }
  }
});

describe("décalques d'emblèmes (maillage plat, sans image)", () => {
  const portes = [...new Set(TENUES.map((t) => t.emblem))];
  for (const eid of portes) {
    describe(`decalque_${eid}.glb`, () => {
      const g = lire(`decalque_${eid}.glb`);
      it("référence l'emblème (id emb_…) existant, un maillage, 3 matériaux, aucune image", () => {
        expect(EMBLEMES.has(eid)).toBe(true);
        expect(g.meshes).toHaveLength(1);
        expect(g.images ?? []).toHaveLength(0);
        expect(g.nodes[0]?.name).toBe(eid);
        expect(g.nodes[0]?.extras?.emblem_id).toBe(eid);
        expect((g.materials ?? []).map((m) => m.name).sort()).toEqual(["emblem_accent", "emblem_champ", "emblem_trait"]);
      });
      it("plaque fine de 0,09 m de côté (≤ 1,5 mm d'épaisseur), face vers +Z, centrée, ≤ 1 500 triangles", () => {
        const { min, max } = boite(g);
        expect(max[0] - min[0]).toBeGreaterThan(0.05);
        expect(max[0] - min[0]).toBeLessThanOrEqual(0.09);
        expect(max[1] - min[1]).toBeGreaterThan(0.05);
        expect(max[1] - min[1]).toBeLessThanOrEqual(0.09);
        expect(max[2] - min[2]).toBeGreaterThan(0);
        expect(max[2] - min[2]).toBeLessThanOrEqual(0.0015);
        expect(Math.abs((min[0] + max[0]) / 2)).toBeLessThan(0.005);
        expect(triangles(g)).toBeLessThanOrEqual(1500);
      });
    });
  }
  it("la Police militaire porte la licorne (emb_org_military_police) sur sa tenue", () => {
    const g = lire("tenue_police_militaire_lod0.glb");
    expect(g.nodes.some((n) => n.extras?.emblem_id === "emb_org_military_police")).toBe(true);
  });
});
