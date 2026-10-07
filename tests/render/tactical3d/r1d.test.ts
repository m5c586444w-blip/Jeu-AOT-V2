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
import { PHOTO_MATIERES, applyPhotoTextures, photoCounts } from "../../../src/render/tactical3d/photoTextures";
import type { Matiere, PhotoTag, PhotoTextures } from "../../../src/render/tactical3d/photoTextures";
import { POLYHAVEN_MAPS, POLYHAVEN_TEXTURES, polyhavenFile } from "../../../src/tools/assetsSources";
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
    parement: () => ({ A: t("parement"), B: t("parement"), C: t("parement") }),
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

describe("textures de Poly Haven (R1d, CR1d-11)", () => {
  interface Mat {
    map: { userData: { photo?: PhotoTag }; repeat: { x: number; y: number } } | null;
    normalMap: unknown;
    color: { r: number; g: number; b: number };
    userData: { photo?: Matiere; relief?: unknown; photoDetail?: { uniforms: { detailMap: { value: unknown }; detailGain: { value: number }; detailRepeat: { value: number } }; size: number } };
  }
  const materials = (root: { traverse(f: (o: { material?: Mat | Mat[] }) => void): void }): Mat[] => {
    const out = new Set<Mat>();
    root.traverse((o) => {
      for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) out.add(m);
    });
    return [...out];
  };
  const fakePhotos = (): PhotoTextures => new Map((Object.keys(PHOTO_MATIERES) as Matiere[]).map((m) => [m, { map: blankTexture(), normal: blankTexture(), mean: [0.25, 0.2, 0.1] as [number, number, number] }]));
  const procMean = (): [number, number, number] => [0.5, 0.5, 0.5];
  type Root = Parameters<typeof applyPhotoTextures>[0];

  it("12 fichiers : 6 matières (pavés, sol, pierre de taille, pierre brute, tuiles, ardoise) × (couleur, relief), au manifeste et servis au rendu", () => {
    expect(POLYHAVEN_TEXTURES.map((t) => [t.matiere, t.id, t.taille])).toEqual((Object.entries(PHOTO_MATIERES) as [Matiere, { id: string; taille: number }][]).map(([m, v]) => [m, v.id, v.taille]));
    const manifest = JSON.parse(readFileSync("docs/art/assets/manifest.json", "utf8")) as { fichiers: { fichier: string; usage: string; execution?: boolean; url: string }[] };
    const ph = manifest.fichiers.filter((e) => e.usage === "texture_environnement");
    expect(ph.map((e) => e.fichier).sort()).toEqual(POLYHAVEN_TEXTURES.flatMap((t) => POLYHAVEN_MAPS.map((m) => polyhavenFile(t.id, m.suffixe))).sort());
    expect(ph).toHaveLength(12);
    for (const e of ph) {
      expect(e.execution, e.fichier).toBe(true);
      expect(e.url, e.fichier).toMatch(/^https:\/\/dl\.polyhaven\.org\/file\/ph-assets\/Textures\/jpg\/1k\//);
    }
  });

  it("environnement (Shiganshina) : toits, pavés, parement des murs et détail du sol passent aux photos ; teinte du profil conservée", () => {
    const env = generateEnvironment("E01", 850, null);
    const m = buildEnvironmentMeshes(env, { quality: "moyen", textures: stubTextures() });
    const root = m.group as unknown as Root;
    const mats = materials(m.group as unknown as { traverse(f: (o: { material?: Mat | Mat[] }) => void): void });
    const tagged = mats.filter((x) => x.map?.userData.photo);
    const kinds = new Set(tagged.map((x) => x.map?.userData.photo?.matiere));
    for (const k of ["tuiles", "ardoise", "pave"]) expect(kinds.has(k as Matiere), k).toBe(true);
    // R1e (§6, point 3) : le parement des murs n'a plus une seule texture étiquetée ; ses appareils A et C passent aux photos de
    // pierre de taille et de pierre brute (uniformes propres, gain qui garde la teinte procédurale).
    const parement = mats.filter((x) => (x.userData as { parement?: unknown }).parement);
    expect(parement.length).toBeGreaterThan(0);
    const ground = mats.find((x) => x.userData.photoDetail);
    expect(ground).toBeDefined();
    const before = new Map(tagged.map((x) => [x, { map: x.map, color: { ...x.color }, tag: x.map?.userData.photo as PhotoTag }]));
    const n = applyPhotoTextures(root, fakePhotos(), false, procMean);
    expect(n).toBe(tagged.length + 1 + parement.length);
    for (const x of parement) {
      const u = (x.userData as { parement: { parSizeA: { value: number[] }; parGainA: { value: number[] } } }).parement;
      expect(u.parSizeA.value).toEqual([PHOTO_MATIERES.pierre_taille.taille, PHOTO_MATIERES.pierre_taille.taille]);
      // Gain : moyenne visée (appareil A procédural ; 0,5 avec la texture blanche des contrôles) / moyenne de la photo (0,25).
      expect(u.parGainA.value[0]).toBeCloseTo(0.5 / 0.25, 6);
      expect((x.userData as { parementPhoto?: boolean }).parementPhoto).toBe(true);
    }
    for (const [x, b] of before) {
      const { taille } = PHOTO_MATIERES[b.tag.matiere];
      expect(x.map).not.toBe(b.map);
      expect([x.map?.repeat.x, x.map?.repeat.y]).toEqual([b.tag.metres[0] / taille, b.tag.metres[1] / taille]);
      // Moyenne conservée : couleur × moyenne de la photo = moyenne de la procédurale (0,5).
      expect(x.color.r * 0.25).toBeCloseTo(b.color.r * 0.5, 6);
      expect(x.color.b * 0.1).toBeCloseTo(b.color.b * 0.5, 6);
      expect(x.normalMap).not.toBeNull();
      expect(x.userData.relief).toBe(x.normalMap);
      expect(x.userData.photo).toBe(b.tag.matiere);
    }
    expect(ground?.userData.photoDetail?.uniforms.detailGain.value).toBeCloseTo(1 / 0.25, 6);
    expect(photoCounts(root).sol).toBe(1);
    // Une seule fois par matériau.
    expect(applyPhotoTextures(root, fakePhotos(), false, procMean)).toBe(0);
    m.dispose();
  });

  it("qualité basse : relief gardé à part (pas de carte de normales) ; repli : sans photos, rien ne change", () => {
    const env = generateEnvironment("E01", 850, null);
    const low = buildEnvironmentMeshes(env, { quality: "bas", textures: stubTextures() });
    const lowMats = materials(low.group as unknown as { traverse(f: (o: { material?: Mat | Mat[] }) => void): void });
    expect(lowMats.some((x) => x.userData.photoDetail)).toBe(false);
    expect(applyPhotoTextures(low.group as unknown as Root, fakePhotos(), true, procMean)).toBeGreaterThan(0);
    for (const x of lowMats.filter((y) => y.userData.photo)) {
      expect(x.normalMap).toBeNull();
      expect(x.userData.relief).toBeTruthy();
    }
    applyLite(low.group as unknown as Root, false);
    for (const x of lowMats.filter((y) => y.userData.photo)) expect(x.normalMap).toBe(x.userData.relief);
    low.dispose();
    const m = buildEnvironmentMeshes(env, { quality: "moyen", textures: stubTextures() });
    const maps = materials(m.group as unknown as { traverse(f: (o: { material?: Mat | Mat[] }) => void): void }).map((x) => x.map);
    expect(applyPhotoTextures(m.group as unknown as Root, new Map(), false, procMean)).toBe(0);
    expect(materials(m.group as unknown as { traverse(f: (o: { material?: Mat | Mat[] }) => void): void }).map((x) => x.map)).toEqual(maps);
    m.dispose();
  });

  it("scène tactique : chaussée, toits de tuiles et d'ardoise, enceinte et champ étiquetés ; photos chargées après les corps détaillés", () => {
    const town = readFileSync("src/render/tactical3d/townMesh.ts", "utf8");
    for (const k of ['"pave", 5', '"tuiles", 3.2', '"ardoise", 3.2', '"pierre_taille", 6', '"sol", 2400']) expect(town, k).toContain(k);
    const proto = readFileSync("src/render/tactical3d/proto.ts", "utf8");
    // Chargées en dernier : après l'échange des corps détaillés (ou leur repli), jamais avant « prêt ».
    expect(proto.match(/void upgradePhotos\(\)/g)).toHaveLength(1);
    expect(proto).toMatch(/const startPhotos = \(\): void => \{[^}]*void upgradePhotos\(\)/);
    expect(proto).toMatch(/corpsPending = true;\s*startPhotos\(\);/);
  });
});
