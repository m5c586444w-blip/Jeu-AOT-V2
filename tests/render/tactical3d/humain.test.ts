import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { buildHumanBody, jointDistance, macroInfluences, setBoneRotation, skinnedBounds, skinnedY, templateFromBuffer } from "../../../src/render/tactical3d/humanBase";
import type { HumanBody, HumanShape, HumanTemplate } from "../../../src/render/tactical3d/humanBase";

/**
 * Corps de base de R1c (CR1c-05) : le `.glb` dérivé de MakeHuman se reconstruit à l'identique, se charge par `GLTFLoader` ;
 * 56 os, 50 cibles, poids normalisés ; corps façonné à la hauteur exacte, pieds au sol ; cibles et proportions mesurables ;
 * mâchoire et yeux articulés ; même forme, même corps.
 */
let t: HumanTemplate;
const DEFAULT: HumanShape = { macro: { gender: 0.5, age: 0.5, muscle: 0.5, weight: 0.5 }, height: 1.7 };

beforeAll(async () => {
  const buf = readFileSync("docs/art/assets/derives/humain.glb");
  t = await templateFromBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
});

function digest(b: HumanBody): string {
  let h = 2166136261;
  for (const m of b.meshes.values()) {
    const a = m.geometry.getAttribute("position").array;
    for (let i = 0; i < a.length; i += 7) h = Math.imul(h ^ Math.round((a[i] as number) * 1e5), 16777619) >>> 0;
  }
  return h.toString(16);
}

/** Étendue verticale des sommets d'une chaîne d'os (poids dominant), au repos. */
function span(b: HumanBody, bones: RegExp, axis: "x" | "y" = "y"): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const m of b.meshes.values()) {
    if (!m.name.startsWith("peau_")) continue;
    const pos = m.geometry.getAttribute("position");
    const si = m.geometry.getAttribute("skinIndex");
    const sw = m.geometry.getAttribute("skinWeight");
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (bones.test(b.skeleton.bones[si.getComponent(i, k)]?.name ?? "")) w += sw.getComponent(i, k);
      if (w < 0.9) continue;
      const v = axis === "y" ? pos.getY(i) : pos.getX(i);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  return hi - lo;
}

describe("corps de base MakeHuman (R1c.1)", () => {
  it("le .glb se reconstruit à l'identique depuis les sources CC0 (npm run assets:build -- --verifier)", () => {
    const out = execFileSync("npx", ["tsx", "src/tools/assets-build.ts", "--verifier"], { encoding: "utf8" });
    expect(out).toMatch(/identiques/);
  });

  it("gabarit : 12 primitives (8 régions de peau, collant, dents, langue, yeux), 56 os, 50 cibles, poids normalisés", () => {
    expect(t.prims.map((p) => p.name)).toEqual(["peau_tete", "peau_torse", "peau_bassin", "peau_bras", "peau_mains", "peau_cuisses", "peau_jambes", "peau_pieds", "pantalon", "dents", "langue", "yeux"]);
    expect(t.bones).toHaveLength(56);
    expect(t.bones[0]?.name).toBe("Root");
    for (const n of ["pelvis", "spine_03", "head", "jaw", "eye_l", "eye_r", "upperarm_l", "hand_r", "thigh_l", "foot_r"]) expect(t.boneIndex.has(n), n).toBe(true);
    expect(t.morphNames).toHaveLength(50);
    for (const p of t.prims) {
      const sw = p.geometry.getAttribute("skinWeight");
      for (let i = 0; i < sw.count; i += 17) expect(sw.getX(i) + sw.getY(i) + sw.getZ(i) + sw.getW(i)).toBeCloseTo(1, 4);
    }
  });

  it("hauteur exacte, pieds au sol, pour des corps très différents", () => {
    for (const shape of [DEFAULT, { macro: { gender: 1, age: 0.5, muscle: 1, weight: 0.2 }, height: 1.85 }, { macro: { gender: 0, age: 1, muscle: 0, weight: 1 }, height: 1.55 }]) {
      const b = buildHumanBody(t, shape);
      const bb = skinnedBounds(b);
      expect(bb.max.y - bb.min.y).toBeCloseTo(shape.height, 3);
      expect(Math.abs(bb.min.y)).toBeLessThan(1e-4);
      b.dispose();
    }
  });

  it("les cibles macro changent le corps ; les articulations les suivent ; même forme, même empreinte", () => {
    const a = buildHumanBody(t, DEFAULT);
    const a2 = buildHumanBody(t, DEFAULT);
    expect(digest(a2)).toBe(digest(a));
    const man = buildHumanBody(t, { ...DEFAULT, macro: { ...DEFAULT.macro, gender: 1 } });
    const woman = buildHumanBody(t, { ...DEFAULT, macro: { ...DEFAULT.macro, gender: 0 } });
    expect(digest(man)).not.toBe(digest(woman));
    // Épaules plus larges chez l'homme, à hauteur égale.
    expect(man.joints.get("upperarm_l")?.x).toBeGreaterThan((woman.joints.get("upperarm_l")?.x ?? 0) + 0.005);
    const strong = buildHumanBody(t, { ...DEFAULT, macro: { gender: 1, age: 0.5, muscle: 1, weight: 0.5 } });
    expect(span(strong, /^upperarm_l$/, "x")).not.toBeCloseTo(span(man, /^upperarm_l$/, "x"), 3);
    expect(macroInfluences({ gender: 1, age: 1, muscle: 1, weight: 1 })["mp_pp_h"]).toBe(1);
    expect(macroInfluences({ gender: 0.5, age: 0.5, muscle: 0.5, weight: 0.5 })["homme"]).toBe(0);
    for (const b of [a, a2, man, woman, strong]) b.dispose();
  });

  it("proportions au repos : tête × 1,9, jambes × 0,66, bras × 0,8 (mesurées à ±5 %, avant mise à l'échelle)", () => {
    const base = buildHumanBody(t, { ...DEFAULT, height: 10 });
    const p = buildHumanBody(t, { ...DEFAULT, height: 10, proportions: { head: 1.9, legs: 0.66, arms: 0.8 } });
    const r = (b: HumanBody, re: RegExp, axis: "x" | "y" = "y"): number => span(b, re, axis) / b.scale;
    expect(r(p, /^head$/) / r(base, /^head$/)).toBeCloseTo(1.9, 1);
    const leg = (b: HumanBody): number => ((b.joints.get("thigh_l")?.y ?? 0) - (b.joints.get("foot_l")?.y ?? 0)) / b.scale;
    expect(leg(p) / leg(base)).toBeGreaterThan(0.66 * 0.95);
    expect(leg(p) / leg(base)).toBeLessThan(0.66 * 1.05);
    const arm = (b: HumanBody): number => jointDistance(b, "hand_l", "upperarm_l") / b.scale;
    expect(arm(p) / arm(base)).toBeCloseTo(0.8, 2);
    base.dispose();
    p.dispose();
  });

  it("mâchoire et yeux articulés : la mâchoire ouvre la bouche (dents du bas seulement), l'œil tourne sans la peau", () => {
    const b = buildHumanBody(t, DEFAULT);
    const before = skinnedY(b, "dents");
    setBoneRotation(b, "jaw", [1, 0, 0], 0.35);
    const after = skinnedY(b, "dents");
    const moved = before.filter((y, i) => Math.abs(y - (after[i] as number)) > 1e-3).length;
    expect(moved).toBeGreaterThan(before.length * 0.3);
    expect(moved).toBeLessThan(before.length * 0.7);
    const skinBefore = skinnedBounds(b);
    setBoneRotation(b, "eye_l", [0, 1, 0], 0.5);
    const skinAfter = skinnedBounds(b);
    expect(skinAfter.max.y).toBeCloseTo(skinBefore.max.y, 6);
    b.dispose();
  });
});
