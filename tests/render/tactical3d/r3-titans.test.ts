import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { skinnedBounds, templateFromBuffer } from "../../../src/render/tactical3d/humanBase";
import type { HumanTemplate } from "../../../src/render/tactical3d/humanBase";
import { buildHumanTitan } from "../../../src/render/tactical3d/humanTitan";
import type { HumanTitan } from "../../../src/render/tactical3d/humanTitan";
import { R3_CLASS_IDS, r3Gallery, r3TitanForUnit, r3TitanSpec } from "../../../src/render/tactical3d/figuresR3";
import { worldPoint } from "../../../src/render/tactical3d/rig";
import { coverage, overlap, silhouettePair } from "../../../src/render/tactical3d/silhouette";
import type { Mask } from "../../../src/render/tactical3d/silhouette";
import { titanSpec } from "../../../src/render/tactical3d/titanGallery";

/**
 * Titans de R3 (CR3-03, CR3-04 ; fichier 21 §8) : 5 tailles × 3 corps × 2 peaux. Mesures sur la peau articulée : hauteur debout
 * (posture comprise) à ±5 %, silhouettes rendues hors écran (face + profil, à hauteur égale) distinctes deux à deux (< 85 %),
 * peaux différentes, dents et yeux, démarche propre à chaque individu.
 */
let t: HumanTemplate;
const SPECS = r3Gallery();
const titans = new Map<string, HumanTitan>();
const key = (id: string, skin: string): string => `${id}:${skin}`;
const masks = new Map<string, Mask>();

beforeAll(async () => {
  const buf = readFileSync("docs/art/assets/derives/humain.glb");
  t = await templateFromBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  for (const spec of SPECS) titans.set(key(spec.id, spec.r3?.skin.id ?? ""), buildHumanTitan(t, spec, 850));
}, 180_000);

const height = (ti: HumanTitan): number => {
  const b = skinnedBounds(ti.human);
  return b.max.y - b.min.y;
};

describe("Titans de R3 : tailles, corps, peaux (R3.1)", () => {
  it("30 Titans : 5 classes de 3 à 15 m, 3 corps, 2 peaux ; hauteur debout mesurée à ±5 %, pieds au sol", () => {
    expect(SPECS).toHaveLength(30);
    expect(R3_CLASS_IDS.map((c) => titanSpec(c).height)).toEqual([3, 5, 8, 12, 15]);
    const lines: string[] = [];
    for (const spec of SPECS) {
      const ti = titans.get(key(spec.id, spec.r3?.skin.id ?? "")) as HumanTitan;
      ti.setPose("debout", 0);
      const h = height(ti);
      const minY = skinnedBounds(ti.human).min.y;
      lines.push(`${spec.id}/${spec.r3?.skin.id} ${h.toFixed(2)}`);
      expect(Math.abs(h / spec.height - 1), `${spec.id} : ${h.toFixed(2)} m pour ${spec.height} m`).toBeLessThanOrEqual(0.05);
      expect(Math.abs(minY), `${spec.id} : pieds à ${minY.toFixed(3)} m`).toBeLessThanOrEqual(0.005 * spec.height);
    }
    console.log(`hauteurs debout (m) : ${lines.join(" | ")}`);
  });

  it("hauteurs relatives conformes (±5 %) : rapport de chaque Titan au 15 m de même corps", () => {
    for (const v of ["a", "b", "c"] as const) {
      const ref = height(titans.get(key(`classe_15_r3${v}`, "pale")) as HumanTitan);
      for (const cls of R3_CLASS_IDS) {
        const ti = titans.get(key(`${cls}_r3${v}`, "pale")) as HumanTitan;
        const want = titanSpec(cls).height / 15;
        expect(Math.abs(height(ti) / ref / want - 1), `${cls} ${v}`).toBeLessThanOrEqual(0.05);
      }
    }
  });

  it("silhouettes distinctes : recouvrement (intersection / union, face + profil, à hauteur égale) < 85 % deux à deux sur les 15 corps", () => {
    const bodies = SPECS.filter((s) => s.r3?.skin.id === "pale");
    expect(bodies).toHaveLength(15);
    for (const spec of bodies) {
      const ti = titans.get(key(spec.id, "pale")) as HumanTitan;
      ti.setPose("debout", 0);
      ti.group.scale.setScalar(1 / spec.height);
      const m = silhouettePair(ti.group, { half: 0.6, top: 1.1 });
      ti.group.scale.setScalar(1);
      expect(coverage(m), spec.id).toBeGreaterThan(0.04);
      masks.set(spec.id, m);
    }
    let worst = { v: 0, pair: "" };
    let sum = 0;
    let n = 0;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]?.id as string;
        const b = bodies[j]?.id as string;
        const o = overlap(masks.get(a) as Mask, masks.get(b) as Mask);
        sum += o;
        n++;
        if (o > worst.v) worst = { v: o, pair: `${a} / ${b}` };
        expect(o, `${a} / ${b}`).toBeLessThan(0.85);
      }
    }
    console.log(`silhouettes de Titans : ${n} paires, recouvrement maximal ${worst.v.toFixed(3)} (${worst.pair}), moyen ${(sum / n).toFixed(3)}`);
  });

  it("deux peaux par taille : même corps, teinte différente ; émail ivoire des dents, yeux de tailles inégales", () => {
    for (const cls of R3_CLASS_IDS) {
      for (const v of ["a", "b", "c"] as const) {
        const pale = titans.get(key(`${cls}_r3${v}`, "pale")) as HumanTitan;
        const red = titans.get(key(`${cls}_r3${v}`, "rougeaude")) as HumanTitan;
        type Tinted = { color: { r: number; g: number } };
        const cp = (pale.human.meshes.get("peau_torse")?.material as unknown as Tinted).color;
        const cr = (red.human.meshes.get("peau_torse")?.material as unknown as Tinted).color;
        // La rougeaude est plus rouge que verte, relativement à la pâle.
        expect(cr.r / cr.g, `${cls} ${v}`).toBeGreaterThan((cp.r / cp.g) * 1.05);
        pale.setPose("debout", 0);
        red.setPose("debout", 0);
        expect(Math.abs(height(pale) - height(red)), `${cls} ${v} : même corps`).toBeLessThan(0.01 * titanSpec(cls).height);
      }
    }
    // Dents : émail ivoire propre à chaque peau (clair, un peu jaune : rouge ≥ vert ≥ bleu), dans la tête.
    const enamel = (ti: HumanTitan): { r: number; g: number; b: number } => (ti.human.meshes.get("dents")?.material as unknown as { color: { r: number; g: number; b: number } }).color;
    const ep = enamel(titans.get(key("classe_12_r3b", "pale")) as HumanTitan);
    const er = enamel(titans.get(key("classe_12_r3b", "rougeaude")) as HumanTitan);
    for (const e of [ep, er]) {
      expect(e.r).toBeGreaterThanOrEqual(e.g);
      expect(e.g).toBeGreaterThanOrEqual(e.b);
      expect(e.b).toBeGreaterThan(0.3);
    }
    expect(Math.abs(ep.b - er.b)).toBeGreaterThan(0.02);
    // Yeux : la variante « c » de 12 m a l'œil droit plus grand que le gauche (0,85 / 1,2).
    const c = titans.get(key("classe_12_r3c", "pale")) as HumanTitan;
    const eye = c.human.meshes.get("yeux")?.geometry.getAttribute("position");
    let l = [Infinity, -Infinity];
    let r = [Infinity, -Infinity];
    for (let i = 0; i < (eye?.count ?? 0); i++) {
      const y = eye?.getY(i) ?? 0;
      if ((eye?.getX(i) ?? 0) >= 0) l = [Math.min(l[0] as number, y), Math.max(l[1] as number, y)];
      else r = [Math.min(r[0] as number, y), Math.max(r[1] as number, y)];
    }
    expect(((r[1] as number) - (r[0] as number)) / ((l[1] as number) - (l[0] as number))).toBeGreaterThan(1.25);
  });

  it("démarche non uniforme : deux individus du même corps marchent différemment ; la boiterie rend le pas dissymétrique", () => {
    const spec = r3TitanSpec("classe_8", "c", "pale");
    const one = buildHumanTitan(t, spec, 1);
    const two = buildHumanTitan(t, spec, 2);
    const foot = (ti: HumanTitan, side: "l" | "r"): { x: number; y: number; z: number; distanceTo(o: { x: number; y: number; z: number }): number } => worldPoint(ti.joints[side === "l" ? "chevilleG" : "chevilleD"]);
    let diff = 0;
    let zl = [Infinity, -Infinity];
    let zr = [Infinity, -Infinity];
    for (let k = 0; k < 40; k++) {
      const time = k * 0.1;
      one.setPose("marche", time);
      two.setPose("marche", time);
      diff += foot(one, "l").distanceTo(foot(two, "l"));
      const fl = foot(one, "l");
      const fr = foot(one, "r");
      zl = [Math.min(zl[0] as number, fl.z), Math.max(zl[1] as number, fl.z)];
      zr = [Math.min(zr[0] as number, fr.z), Math.max(zr[1] as number, fr.z)];
    }
    const stepL = (zl[1] as number) - (zl[0] as number);
    const stepR = (zr[1] as number) - (zr[0] as number);
    expect(diff / 40, "écart moyen des pieds entre deux individus").toBeGreaterThan(0.05 * spec.height * 0.1);
    expect(stepL, "pas de la jambe boiteuse plus court").toBeLessThan(stepR * 0.9);
    one.dispose();
    two.dispose();
  });

  it("Titan de la simulation : classe la plus proche de sa hauteur, corps et peau tirés de sa silhouette et de son numéro", () => {
    expect(r3TitanForUnit(4.2, 0, 0).id.startsWith("classe_5")).toBe(true);
    expect(r3TitanForUnit(13, 1, 4).id.startsWith("classe_12")).toBe(true);
    expect(r3TitanForUnit(13, 1, 4).height).toBe(13);
    const ids = new Set([0, 1, 2, 3, 4, 5].map((i) => `${r3TitanForUnit(8, 0, i).id}/${r3TitanForUnit(8, 0, i).r3?.skin.id}`));
    expect(ids.size).toBe(6);
  });
});
