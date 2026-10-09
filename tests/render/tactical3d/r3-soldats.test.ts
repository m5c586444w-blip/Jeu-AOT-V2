import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { skinnedBounds, templateFromBuffer } from "../../../src/render/tactical3d/humanBase";
import type { HumanTemplate } from "../../../src/render/tactical3d/humanBase";
import { buildHumanSoldier } from "../../../src/render/tactical3d/humanSoldier";
import type { HumanSoldier } from "../../../src/render/tactical3d/humanSoldier";
import type { HumanPose } from "../../../src/render/tactical3d/humanAnim";
import { soldierMaterials } from "../../../src/render/tactical3d/soldier";
import { OUTFITS, gearOf, outfitOfSoldier, outfitOfTroop } from "../../../src/render/tactical3d/figures/catalog";
import type { OutfitId } from "../../../src/render/tactical3d/figures/catalog";
import { CROWD_POSES, crowdFigure } from "../../../src/render/tactical3d/figures/crowd";
import { outfitMaterials, outfitOptions } from "../../../src/render/tactical3d/figures/soldier3";
import { overlap, silhouette, trisOfColored, trisOfFigure } from "../../../src/render/tactical3d/figures/raster";

/**
 * Soldats de R3 (CR3-04, CR3-05) : 5 tenues (Bataillon, Garnison, Brigades spéciales, infanterie et officiers de Marley),
 * distinctes à la silhouette colorée (recouvrement des cases de même teinte < 85 %, rendu hors écran), en foule comme en figure
 * complète ; contact au sol de chaque pose.
 */
const NATURAL: Record<OutfitId, boolean> = { bataillon: false, garnison: true, brigade: true, marley_infanterie: true, marley_officier: true };
let t: HumanTemplate;
const men = new Map<OutfitId, HumanSoldier>();

beforeAll(async () => {
  const buf = readFileSync("docs/art/assets/derives/humain.glb");
  t = await templateFromBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  for (const o of OUTFITS) men.set(o.id, buildHumanSoldier(t, 41, outfitMaterials(soldierMaterials(), o.id), { outfit: outfitOptions(o.id, gearOf(o.id, NATURAL[o.id])), height: 1.78, gender: 1 }));
}, 120_000);

const trisOfSoldier = (s: HumanSoldier) => trisOfFigure(s.group, () => s.body.skeleton.update());

describe("soldats de R3 : tenues et poses", () => {
  it("règle des tenues : soldats à appareil au Bataillon, fantassins de Paradis selon l'arme, adversaires de Marley (chef : officier)", () => {
    expect(outfitOfSoldier()).toBe("bataillon");
    expect(outfitOfTroop({ side: "allie", kind: "fusilier", faction: "fac_paradis" }, false)).toBe("garnison");
    expect(outfitOfTroop({ side: "allie", kind: "assaut", faction: "fac_paradis" }, false)).toBe("brigade");
    expect(outfitOfTroop({ side: "ennemi", kind: "fusilier", faction: "fac_marley" }, false)).toBe("marley_infanterie");
    expect(outfitOfTroop({ side: "ennemi", kind: "mitrailleur", faction: "fac_marley" }, true)).toBe("marley_officier");
    expect(gearOf("bataillon", false)).toBe("odm");
    expect(gearOf("marley_officier", true)).toBe("officier");
  });

  it("foule : 5 tenues distinctes deux à deux (silhouette colorée < 85 %), dans chaque pose", () => {
    const lines: string[] = [];
    let worst = 0;
    for (const pose of ["attente", "pasA", "tir", "mort"] as const) {
      const sil = OUTFITS.map((o) => silhouette(trisOfColored(crowdFigure(o.id, gearOf(o.id, NATURAL[o.id]), pose)), 96));
      for (let i = 0; i < sil.length; i++)
        for (let j = i + 1; j < sil.length; j++) {
          const v = overlap(sil[i] as Int32Array, sil[j] as Int32Array, true);
          worst = Math.max(worst, v);
          if (pose === "attente") lines.push(`${OUTFITS[i]?.id}~${OUTFITS[j]?.id} ${(v * 100).toFixed(0)} (forme ${(overlap(sil[i] as Int32Array, sil[j] as Int32Array) * 100).toFixed(0)})`);
        }
    }
    console.log(`foule, recouvrement coloré (%) : ${lines.join(" | ")} ; pire, toutes poses : ${(worst * 100).toFixed(1)} %`);
    expect(worst).toBeLessThan(0.85);
  });

  it("foule : contact au sol de chaque pose (point le plus bas à 0) ; en vol, figure au-dessus de ses pieds", () => {
    for (const o of OUTFITS)
      for (const pose of CROWD_POSES) {
        const g = crowdFigure(o.id, gearOf(o.id, NATURAL[o.id]), pose);
        g.computeBoundingBox();
        const b = g.boundingBox;
        expect(b).not.toBeNull();
        if (pose === "vol") expect(b?.min.y ?? -1).toBeGreaterThan(-0.2);
        else expect(Math.abs(b?.min.y ?? 1)).toBeLessThan(1e-6);
        const h = (b?.max.y ?? 0) - (b?.min.y ?? 0);
        if (pose !== "mort" && pose !== "vol") expect(h, `${o.id} ${pose}`).toBeGreaterThan(1.55);
        if (pose === "mort") expect(h, `${o.id} mort : épaisseur`).toBeLessThan(0.6);
      }
  });

  it("figures complètes : pièces de chaque tenue ; 5 tenues distinctes (silhouette colorée < 85 %)", () => {
    const names = (s: HumanSoldier): Set<string> => {
      const n = new Set<string>();
      s.group.traverse((o) => n.add(o.name));
      return n;
    };
    const b = names(men.get("bataillon") as HumanSoldier);
    expect(b.has("cape") && b.has("reservoir") && b.has("lame")).toBe(true);
    const g = names(men.get("garnison") as HumanSoldier);
    expect(g.has("echarpe") && g.has("fusil") && !g.has("reservoir")).toBe(true);
    const br = names(men.get("brigade") as HumanSoldier);
    expect(br.has("manteau") && br.has("couvre-chef-kepi")).toBe(true);
    const mi = names(men.get("marley_infanterie") as HumanSoldier);
    expect(mi.has("couvre-chef-casque") && mi.has("havresac") && mi.has("fusil")).toBe(true);
    const mo = names(men.get("marley_officier") as HumanSoldier);
    expect(mo.has("couvre-chef-casquette") && mo.has("pistolet") && !mo.has("fusil")).toBe(true);
    const sil = OUTFITS.map((o) => {
      const s = men.get(o.id) as HumanSoldier;
      s.setPose("attente", 0);
      return silhouette(trisOfSoldier(s), 96);
    });
    let worst = 0;
    const lines: string[] = [];
    for (let i = 0; i < sil.length; i++)
      for (let j = i + 1; j < sil.length; j++) {
        const v = overlap(sil[i] as Int32Array, sil[j] as Int32Array, true);
        worst = Math.max(worst, v);
        lines.push(`${OUTFITS[i]?.id}~${OUTFITS[j]?.id} ${(v * 100).toFixed(0)}`);
      }
    console.log(`figures complètes, recouvrement coloré (%) : ${lines.join(" | ")}`);
    expect(worst).toBeLessThan(0.85);
  });

  it("figures complètes : contact au sol de chaque pose (pieds ±0,5 %, couché ±1 %, rien sous −1 %)", () => {
    const feet: HumanPose[] = ["attente", "marche", "course", "sol", "frappe", "tir"];
    const bad: string[] = [];
    for (const [id, s] of men) {
      for (const pose of [...feet, "mort" as HumanPose]) {
        for (const time of pose === "marche" || pose === "course" ? [0, 0.3, 0.7] : [0.2]) {
          s.setPose(pose, time);
          const all = skinnedBounds(s.body).min.y;
          const low = pose === "mort" ? all : skinnedBounds(s.body, "peau_pieds").min.y;
          const tol = pose === "mort" ? 0.01 : 0.005;
          if (Math.abs(low) > tol * 1.78 || all < -0.01 * 1.78) bad.push(`${id} ${pose} ${time} : bas ${low.toFixed(3)}, peau ${all.toFixed(3)}`);
        }
      }
      s.setPose("tir", 0);
      const rifle = s.group.getObjectByName("fusil");
      if (rifle) expect(rifle.visible, `${id} : fusil épaulé`).toBe(true);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
});
