import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { skinnedBounds, templateFromBuffer } from "../../../src/render/tactical3d/humanBase";
import type { HumanTemplate } from "../../../src/render/tactical3d/humanBase";
import { SOLDIER_ANIMS } from "../../../src/render/tactical3d/humanAnim";
import { buildHumanSoldier } from "../../../src/render/tactical3d/humanSoldier";
import type { HumanSoldier } from "../../../src/render/tactical3d/humanSoldier";
import { worldPoint } from "../../../src/render/tactical3d/rig";
import { soldierMaterials } from "../../../src/render/tactical3d/soldier";

/**
 * Soldats de R1c (CR1c-06) : corps de base MakeHuman animé par le projet et équipement de R1 porté par les os.
 * Mesures sur la peau posée (sommets skinnés), pas sur les paramètres.
 */
let t: HumanTemplate;
const mats = soldierMaterials();
const built: HumanSoldier[] = [];
const make = (seed: number, opts: Parameters<typeof buildHumanSoldier>[3] = {}): HumanSoldier => {
  const s = buildHumanSoldier(t, seed, mats, opts);
  built.push(s);
  return s;
};

beforeAll(async () => {
  const buf = readFileSync("docs/art/assets/derives/humain.glb");
  t = await templateFromBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
});
afterAll(() => {
  for (const s of built) s.dispose();
});

const named = (s: HumanSoldier, name: string): { name: string; parent: string }[] => {
  const out: { name: string; parent: string }[] = [];
  s.group.traverse((o) => {
    if (o.name !== name) return;
    let p = o.parent;
    while (p && !(p as { isBone?: boolean }).isBone) p = p.parent;
    out.push({ name: o.name, parent: p?.name ?? "" });
  });
  return out;
};

describe("soldats sur le corps de base (R1c.2)", () => {
  it("7 animations ; pieds au sol à ±2 cm dans les poses au sol, à chaque instant", () => {
    expect(SOLDIER_ANIMS).toEqual(["attente", "marche", "course", "sol", "vol", "accroche", "frappe"]);
    const s = make(7);
    for (const p of ["attente", "marche", "course", "sol", "frappe"] as const) {
      for (const time of [0, 0.17, 0.41, 0.8, 1.3]) {
        s.setPose(p, time);
        const low = skinnedBounds(s.body, "peau_pieds").min.y;
        expect(Math.abs(low), `${p} à ${time} s : ${low.toFixed(3)} m`).toBeLessThan(0.02);
      }
    }
  });

  it("hauteur : 1,7 m à ±5 % debout (banc) ; tailles tirées de la graine entre 1,58 et 1,86 m", () => {
    const s = make(11, { height: 1.7, gender: 1 });
    s.setPose("attente", 0);
    const bb = skinnedBounds(s.body);
    const h = bb.max.y - bb.min.y;
    expect(Math.abs(h - 1.7) / 1.7, `${h.toFixed(3)} m`).toBeLessThan(0.05);
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = make(seed);
      expect(r.body.height).toBeGreaterThanOrEqual(1.58);
      expect(r.body.height).toBeLessThanOrEqual(1.86);
    }
  });

  it("l'équipement est porté par les os : réservoir et lanceurs au bassin, fourreaux aux cuisses, lames aux mains, cape au haut du dos", () => {
    const s = make(3);
    expect(named(s, "reservoir").map((o) => o.parent)).toEqual(["pelvis"]);
    expect(named(s, "lanceur").map((o) => o.parent).every((p) => p === "pelvis")).toBe(true);
    expect(named(s, "fourreau").map((o) => o.parent).sort()).toEqual(["thigh_l", "thigh_r"]);
    expect(named(s, "lame").filter((o) => o.parent.startsWith("hand_")).map((o) => o.parent).sort()).toEqual(["hand_l", "hand_l", "hand_r", "hand_r"]);
    expect(named(s, "cape").some((o) => o.parent === "spine_03")).toBe(true);
    // La lame suit la main quand la pose change.
    const blade = s.group.getObjectByName("lame");
    expect(blade).toBeDefined();
    s.setPose("sol", 0);
    const a = worldPoint(blade ?? s.group);
    s.setPose("frappe", 0.5);
    const b = worldPoint(blade ?? s.group);
    expect(a.distanceTo(b)).toBeGreaterThan(0.1);
    // Lames rangées à l'arrêt, tirées au combat.
    s.setPose("attente", 0);
    expect(blade?.visible).toBe(false);
    s.setPose("sol", 0);
    expect(blade?.visible).toBe(true);
  });

  it("les poses bougent avec le temps ; vol et accroche quittent le sol", () => {
    const s = make(5);
    const foot = (): number => {
      const f = s.body.bones["foot_l"];
      return f ? worldPoint(f).z : 0;
    };
    s.setPose("marche", 0);
    const z0 = foot();
    s.setPose("marche", 0.3);
    expect(Math.abs(foot() - z0)).toBeGreaterThan(0.05);
    s.setPose("vol", 0);
    const knee = s.body.bones["calf_l"];
    const hip = s.body.bones["thigh_l"];
    expect(knee && hip ? worldPoint(knee).z - worldPoint(hip).z : 0).toBeGreaterThan(0.15);
  });

  it("même graine, même soldat ; graines différentes, soldats différents", () => {
    const sig = (s: HumanSoldier): string => {
      s.setPose("sol", 0.5);
      const bb = skinnedBounds(s.body);
      return [s.body.height, bb.max.x - bb.min.x, bb.max.z - bb.min.z].map((v) => v.toFixed(5)).join("/");
    };
    expect(sig(make(42))).toBe(sig(make(42)));
    expect(sig(make(42))).not.toBe(sig(make(43)));
  });
});
