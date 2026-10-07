import { describe, expect, it } from "vitest";
import { generateEnvironment } from "../../../src/render/tactical3d/environment";
import { buildEnvironmentMeshes } from "../../../src/render/tactical3d/envMesh";
import type { EnvTextures } from "../../../src/render/tactical3d/envMesh";
import { createLighting } from "../../../src/render/tactical3d/lighting";
import { applyLite, liteCounts } from "../../../src/render/tactical3d/lite";
import { buildVegetation } from "../../../src/render/tactical3d/meshVegetation";
import { blankStage, blankTexture } from "../../../src/render/tactical3d/rig";
import { seeded } from "../../../src/render/tactical3d/rng";
import { townTree } from "../../../src/render/tactical3d/townMesh";
import { readFileSync } from "node:fs";
import type { Quality } from "../../../src/render/tactical3d/quality";

/**
 * R1d (CR1d-07) : qualité basse allégée — sans éclairage d'image ni ciel physique, sans relief, sans cartes de feuilles ;
 * le reste du rendu est inchangé. Parties vérifiables sans moteur WebGL.
 */
interface Named {
  name: string;
  visible: boolean;
}

/** Fournisseur de textures vides (sous Node) qui note ce qu'on lui demande. */
function stubTextures(): EnvTextures & { calls: string[] } {
  const calls: string[] = [];
  const t = (n: string): ReturnType<typeof blankTexture> => {
    calls.push(n);
    return blankTexture();
  };
  return {
    calls,
    facade: () => ({ upper: t("facade"), upperLit: t("facade"), ground: t("facade"), groundLit: t("facade"), plain: t("facade") }),
    roof: () => t("roof"),
    ground: () => t("ground"),
    cobble: () => t("cobble"),
    wallStone: () => t("wallStone"),
    mist: () => t("mist"),
    skin: () => t("skin"),
    puff: () => t("puff"),
    leaves: () => t("leaves"),
    groundDetail: () => ({ albedo: t("groundDetail"), normal: t("groundDetail") }),
    waterNormal: () => t("waterNormal"),
  };
}

const leafMeshes = (root: { traverse(f: (o: Named) => void): void }): string[] => {
  const out: string[] = [];
  root.traverse((o) => {
    if (o.name.endsWith("-feuilles")) out.push(o.name);
  });
  return out;
};

describe("qualité basse allégée (R1d, CR1d-07)", () => {
  it("forêt des Arbres Géants et campagne : aucune carte de feuilles ni détail du sol en qualité basse ; présents en moyenne", () => {
    for (const id of ["E14", "E13"]) {
      const env = generateEnvironment(id, 850, null);
      const built: Record<Quality, { leaves: string[]; calls: string[] }> = {} as Record<Quality, { leaves: string[]; calls: string[] }>;
      for (const q of ["bas", "moyen"] as const) {
        const tx = stubTextures();
        const m = buildEnvironmentMeshes(env, { quality: q, textures: tx });
        built[q] = { leaves: leafMeshes(m.group as unknown as { traverse(f: (o: Named) => void): void }), calls: tx.calls };
        m.dispose();
      }
      expect(built.bas.leaves, id).toEqual([]);
      expect(built.bas.calls, id).not.toContain("leaves");
      expect(built.bas.calls, id).not.toContain("groundDetail");
      expect(built.bas.calls, id).not.toContain("waterNormal");
      expect(built.moyen.leaves.length, id).toBeGreaterThan(0);
      expect(built.moyen.calls, id).toContain("leaves");
    }
  });

  it("forêt : moins d'arbres gardés en qualité basse qu'en moyenne (densité de la qualité)", () => {
    const env = generateEnvironment("E15", 850, null);
    const count = (q: Quality): number => {
      const m = buildEnvironmentMeshes(env, { quality: q, textures: null });
      const n = Object.entries(m.counts).filter(([k]) => k.startsWith("arbres-")).reduce((s, [, v]) => s + v, 0);
      m.dispose();
      return n;
    };
    const bas = count("bas");
    const moyen = count("moyen");
    expect(bas).toBeGreaterThan(0);
    expect(bas).toBeLessThan(moyen * 0.7);
  });

  it("à chaud : relief et cartes de feuilles retirés en qualité basse, rendus en la quittant", () => {
    const leaves = blankTexture();
    const v = buildVegetation(
      [0, 1, 2].map((k) => ({ x: k * 10, y: 4, kind: "feuillu" as const, s: 1, r: k })),
      null,
      { leaf: ["#4F6B34", "#7C9446"], conifer: "#34482C", bush: "#4F6B34" },
      { near: 300, far: 900, density: 1, shadows: false },
      leaves,
    );
    // Relief sur le bois (comme les cartes de normales des textures procédurales).
    const relief = blankTexture();
    v.group.traverse((o) => {
      const mat = (o as unknown as { material?: { normalMap: unknown; name: string } }).material;
      if (mat && o.name.endsWith("-bois")) mat.normalMap = relief;
    });
    const before = liteCounts(v.group);
    expect(before.relief).toBeGreaterThan(0);
    expect(before.leafCards).toBeGreaterThan(0);
    applyLite(v.group, true);
    expect(liteCounts(v.group)).toEqual({ relief: 0, leafCards: 0 });
    applyLite(v.group, false);
    expect(liteCounts(v.group)).toEqual(before);
    v.dispose();
  });

  it("éclairage : en qualité basse, dôme peint au lieu du ciel physique, sans éclairage d'image ; retour au ciel physique ensuite", () => {
    const { scene } = blankStage();
    const lantern = buildVegetation([], null, { leaf: ["#4F6B34", "#7C9446"], conifer: "#34482C", bush: "#4F6B34" }, { near: 1, far: 2, density: 1, shadows: false }).material;
    const rig = createLighting(scene, 850, { windowMaterials: [], lanternMaterial: lantern, lamps: [], center: blankStage().camera.position.clone() });
    const phys = scene.getObjectByName("ciel-physique") as unknown as Named;
    const dome = scene.getObjectByName("ciel") as unknown as Named;
    rig.apply("jour");
    expect([phys.visible, dome.visible, rig.lite]).toEqual([true, false, false]);
    rig.setLite(true);
    expect([phys.visible, dome.visible, rig.lite]).toEqual([false, true, true]);
    expect(scene.environment).toBeNull();
    rig.setLite(false);
    expect([phys.visible, dome.visible]).toEqual([true, false]);
    rig.dispose();
  });
});

describe("arbres réalistes dans la scène tactique (R1d, CR1d-10)", () => {
  it("un arbre de la ville prend les 22 tirages de R1 (le reste de la ville garde ses graines) ; place : feuillu ; abords : feuillus et fruitiers", () => {
    let draws = 0;
    const base = seeded(850);
    const counted = (): number => {
      draws++;
      return base();
    };
    const kinds = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const before = draws;
      const t = townTree(counted, i, 2 * i, i % 5 === 0);
      expect(draws - before).toBe(22);
      if (i % 5 === 0) expect(t.kind).toBe("feuillu");
      kinds.add(t.kind);
      expect([t.x, t.y]).toEqual([i, 2 * i]);
      // Feuillu : sommet de 6 à 10 m, comme les arbres de R1 ; fruitier : échelle de verger.
      expect(t.s).toBeGreaterThan(0.5);
      expect(t.s).toBeLessThan(1.2);
    }
    expect([...kinds].sort()).toEqual(["feuillu", "fruitier"]);
  });

  it("plus d'icosaèdres de R1 dans la ville : les arbres sont rendus par la végétation réaliste (bois séparé, massifs, cartes de feuilles)", () => {
    const src = readFileSync("src/render/tactical3d/townMesh.ts", "utf8");
    expect(src).not.toMatch(/IcosahedronGeometry/);
    expect(src).not.toMatch(/"feuillages"/);
    expect(readFileSync("src/render/tactical3d/proto.ts", "utf8")).toMatch(/buildVegetation\(\s*townMeshes\.trees/);
    const rand = seeded(3);
    const trees = Array.from({ length: 12 }, (_, i) => townTree(rand, i * 20, 0, i < 4));
    const v = buildVegetation(trees, null, { leaf: ["#4F6B34", "#7C9446"], conifer: "#34482C", bush: "#4F6B34" }, { near: 400, far: 4000, density: 1, shadows: true }, blankTexture());
    const names: string[] = [];
    v.group.traverse((o) => names.push(o.name));
    expect(names).toContain("arbres-feuillu-proche-bois");
    expect(names).toContain("arbres-feuillu-proche");
    expect(names).toContain("arbres-feuillu-proche-feuilles");
    expect(v.counts.feuillu + v.counts.fruitier).toBe(12);
    v.dispose();
  });
});
