import { describe, expect, it } from "vitest";
import { createLighting } from "../../../src/render/tactical3d/lighting";
import { realisticTree } from "../../../src/render/tactical3d/meshTrees";
import type { TreeParts } from "../../../src/render/tactical3d/meshTrees";
import { TREE_KINDS, buildVegetation } from "../../../src/render/tactical3d/meshVegetation";
import { createPost } from "../../../src/render/tactical3d/post";
import { assembledSphere, blankStage, blankTexture } from "../../../src/render/tactical3d/rig";
import type { TreeInst } from "../../../src/render/tactical3d/terrain";

type Geo = TreeParts["solid"];
type V = [number, number, number];
const at = (a: ArrayLike<number>, i: number): V => [a[i * 3] as number, a[i * 3 + 1] as number, a[i * 3 + 2] as number];
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V): number => Math.hypot(...a);
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** Objet de scène trouvé par son nom (visibilité, nom), sans importer three.js. */
interface Named {
  name: string;
  visible: boolean;
}

/**
 * Rendu réaliste de R1c (R1c.4), parties vérifiables sans moteur WebGL : arbres (géométries, bois non teinté, cartes de
 * feuillage, normales de volume), normales des pièces assemblées, ciel physique selon l'heure et le lieu, post-traitement
 * selon la qualité.
 */
const digest = (g: Geo): string => {
  const a = g.getAttribute("position").array;
  let h = 2166136261;
  for (let i = 0; i < a.length; i += 5) h = Math.imul(h ^ Math.round((a[i] as number) * 1000), 16777619) >>> 0;
  return `${a.length}:${h.toString(16)}`;
};

/** Lanterne et centre d'éclairage : objets three.js obtenus sans importer three.js (voir `rig.ts`). */
const lanternOf = (): Parameters<typeof createLighting>[2]["lanternMaterial"] => {
  const g = buildVegetation([], null, { leaf: ["#4F6B34", "#7C9446"], conifer: "#34482C", bush: "#4F6B34" }, { near: 1, far: 2, density: 1, shadows: false });
  return g.material;
};
const centerOf = (): Parameters<typeof createLighting>[2]["center"] => blankStage().camera.position.clone();

describe("rendu réaliste (R1c.4)", () => {
  it("arbres : mêmes attributs partout, bois séparé, cartes de feuillage au niveau proche, géométries déterministes", () => {
    for (const kind of TREE_KINDS) {
      for (const near of [true, false]) {
        const t = realisticTree(kind, near);
        const again = realisticTree(kind, near);
        for (const g of [t.wood, t.solid, t.cards]) {
          if (!g) continue;
          expect(Object.keys(g.attributes).sort(), `${kind} ${near}`).toEqual(["color", "normal", "position", "uv"]);
          expect(g.getAttribute("position").count).toBeGreaterThan(0);
        }
        expect(digest(again.solid)).toBe(digest(t.solid));
        expect(t.wood === null, kind).toBe(kind === "buisson");
        expect(t.cards !== null, `${kind} ${near}`).toBe(near && (kind === "feuillu" || kind === "fruitier" || kind === "buisson"));
      }
    }
    // Plus détaillé de près que de loin.
    const near = realisticTree("feuillu", true);
    const far = realisticTree("feuillu", false);
    expect(near.solid.getAttribute("position").count).toBeGreaterThan(far.solid.getAttribute("position").count * 2);
  });

  it("houppier : normales unitaires, tournées vers l'extérieur du houppier (lumière de volume)", () => {
    const t = realisticTree("feuillu", true);
    const pos = t.solid.getAttribute("position").array;
    const nor = t.solid.getAttribute("normal").array;
    const count = pos.length / 3;
    const crown: V = [0, 7.6, 0];
    let out = 0;
    for (let i = 0; i < count; i++) {
      const n = at(nor, i);
      expect(len(n)).toBeCloseTo(1, 3);
      if (dot(n, sub(at(pos, i), crown)) > 0) out++;
    }
    expect(out / count).toBeGreaterThan(0.95);
  });

  it("pièces assemblées : la normale suit la transformation (translation, échelle non uniforme), sans retournement", () => {
    const c: V = [-0.4, 0.8, 0.3];
    const g = assembledSphere(c, [0.2, 0.9, 0.75]);
    const pos = g.getAttribute("position").array;
    const nor = g.getAttribute("normal").array;
    for (let i = 0; i < pos.length / 3; i++) {
      const n = at(nor, i);
      expect(len(n)).toBeCloseTo(1, 4);
      expect(dot(n, sub(at(pos, i), c)), `sommet ${i}`).toBeGreaterThan(0);
    }
  });

  it("ciel physique (nuages calculés) le jour à l'air libre ; dôme peint à l'aube, au crépuscule, la nuit et sous terre", () => {
    const { scene } = blankStage();
    const rig = createLighting(scene, 850, { windowMaterials: [], lanternMaterial: lanternOf(), lamps: [], center: centerOf() });
    const phys = scene.getObjectByName("ciel-physique") as unknown as Named;
    const dome = scene.getObjectByName("ciel") as unknown as Named;
    rig.apply("jour");
    expect([phys.visible, dome.visible]).toEqual([true, false]);
    for (const p of ["aube", "crepuscule", "nuit"] as const) {
      rig.apply(p);
      expect([phys.visible, dome.visible], p).toEqual([false, true]);
    }
    const under = blankStage().scene;
    const ug = createLighting(under, 850, { windowMaterials: [], lanternMaterial: lanternOf(), lamps: [], center: centerOf(), underground: { ambient: "#806040", ground: "#403020", fog: "#302820", openings: true } });
    ug.apply("jour");
    expect((under.getObjectByName("ciel-physique") as unknown as Named).visible).toBe(false);
    rig.dispose();
    ug.dispose();
  });

  it("post-traitement : aucun en qualité basse ; occlusion ambiante en qualité moyenne et haute", () => {
    const { scene, camera: cam } = blankStage();
    expect(createPost(scene, cam, "bas")).toBeNull();
    for (const q of ["moyen", "haut"] as const) {
      const p = createPost(scene, cam, q);
      expect(p).not.toBeNull();
      p?.dispose();
    }
  });

  it("végétation : bois non teinté par le feuillage ; cartes de feuillage seulement avec la texture de feuilles", () => {
    const trees: TreeInst[] = [0, 1, 2, 3].map((k) => ({ x: k * 12, y: 5, kind: "feuillu", s: 1, r: k * 0.7 }) as TreeInst);
    const foliage = { leaf: ["#4F6B34", "#7C9446"] as [string, string], conifer: "#34482C", bush: "#4F6B34" };
    const q = { near: 300, far: 1000, density: 1, shadows: false };
    const names = (v: ReturnType<typeof buildVegetation>): string[] => {
      const out: string[] = [];
      v.group.traverse((o) => out.push(o.name));
      return out;
    };
    const bare = buildVegetation(trees, null, foliage, q, null);
    expect(names(bare)).toContain("arbres-feuillu-proche-bois");
    expect(names(bare).some((n) => n.endsWith("-feuilles"))).toBe(false);
    // Teinte d'instance : écorce brune (rouge ≥ vert) pour le bois ; feuillage vert (vert > rouge).
    const tintOf = (name: string): V => at((bare.group.getObjectByName(name) as unknown as { instanceColor: { array: ArrayLike<number> } }).instanceColor.array, 0);
    const cw = tintOf("arbres-feuillu-proche-bois");
    const cl = tintOf("arbres-feuillu-proche");
    expect(cw[0]).toBeGreaterThanOrEqual(cw[1]);
    expect(cl[1]).toBeGreaterThan(cl[0]);
    const leafy = buildVegetation(trees, null, foliage, q, blankTexture());
    expect(names(leafy)).toContain("arbres-feuillu-proche-feuilles");
    expect(leafy.leafMaterial?.alphaTest).toBeGreaterThan(0);
    bare.dispose();
    leafy.dispose();
  });
});
