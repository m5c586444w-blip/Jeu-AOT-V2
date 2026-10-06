import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { makeTitan } from "../../../src/render/tactical3d/bodies";
import { skinnedBounds, templateFromBuffer } from "../../../src/render/tactical3d/humanBase";
import type { HumanTemplate } from "../../../src/render/tactical3d/humanBase";
import { TITAN_BONES, buildHumanTitan, titanMeasures } from "../../../src/render/tactical3d/humanTitan";
import type { HumanTitan } from "../../../src/render/tactical3d/humanTitan";
import { worldPoint } from "../../../src/render/tactical3d/rig";
import { TITAN_SMALL } from "../../../src/render/tactical3d/titan";
import type { TitanPose, TitanSpec } from "../../../src/render/tactical3d/titan";
import { TITAN_CLASS_IDS, TITAN_SPECIAL_IDS, TITAN_VARIANT_IDS, titanSpec, variantSpec } from "../../../src/render/tactical3d/titanGallery";

/**
 * Titans de R1c (CR1c-07) : le corps de base déformé par les paramètres de `data/art/titans.json`. Mesures sur la peau posée
 * (sommets articulés), pas sur les paramètres : hauteur debout à ±5 % (3 à 120 m), proportions (tête, jambes, bras) à ±10 %,
 * pieds au sol à 0,5 % de la hauteur, corps couchés à plat, mâchoire, nuque, vapeur, déterminisme.
 */
let t: HumanTemplate;
const SPECS: TitanSpec[] = [...TITAN_CLASS_IDS.map((id) => titanSpec(id)), ...TITAN_VARIANT_IDS.map(variantSpec), ...TITAN_SPECIAL_IDS.map((id) => titanSpec(id))];
const titans = new Map<string, HumanTitan>();
const of = (spec: TitanSpec): HumanTitan => titans.get(spec.id) as HumanTitan;
const height = (ti: HumanTitan): number => {
  const b = skinnedBounds(ti.human);
  return b.max.y - b.min.y;
};
const within = (v: number, target: number, tol: number): boolean => Math.abs(v - target) <= tol * target;
/** Au repos : distance du bassin à l'avant du ventre (sommets du torse et du bassin). */
const frontOf = (ti: HumanTitan): number => {
  let front = -Infinity;
  for (const name of ["peau_torse", "peau_bassin"]) {
    const p = ti.human.meshes.get(name)?.geometry.getAttribute("position");
    if (p) for (let i = 0; i < p.count; i++) front = Math.max(front, p.getZ(i));
  }
  return front - (ti.human.joints.get("pelvis")?.z ?? 0);
};

beforeAll(async () => {
  const buf = readFileSync("docs/art/assets/derives/humain.glb");
  t = await templateFromBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  for (const spec of SPECS) titans.set(spec.id, buildHumanTitan(t, spec, 850));
});

describe("Titans sur le corps de base (R1c.3)", () => {
  it("hauteur debout mesurée à ±5 % : classes 3–15 m, variantes, Titan-Mur 50 m, Colossal 60 m, Rod Reiss 120 m", () => {
    expect(SPECS).toHaveLength(13);
    for (const spec of SPECS) {
      const ti = of(spec);
      ti.setPose("debout", 0);
      const h = height(ti);
      expect(within(h, spec.height, 0.05), `${spec.id} : ${h.toFixed(2)} m pour ${spec.height} m`).toBe(true);
    }
  });

  it("proportions mesurées au repos conformes aux paramètres à ±10 % : tête, jambes, bras, avant-bras", () => {
    for (const spec of SPECS) {
      const m = titanMeasures(of(spec).human);
      for (const k of ["head", "legs", "upperArm", "foreArm"] as const) {
        expect(within(m[k], spec[k], 0.1), `${spec.id} ${k} : ${m[k].toFixed(3)} pour ${spec[k]}`).toBe(true);
      }
    }
    // Les anatomies restent opposées : grosse tête et jambes courtes (3 m) contre petite tête et longues jambes (15 m).
    const small = titanMeasures(of(titanSpec("classe_3")).human);
    const large = titanMeasures(of(titanSpec("classe_15")).human);
    expect(small.head).toBeGreaterThan(large.head * 1.7);
    expect(large.legs).toBeGreaterThan(small.legs * 1.35);
  });

  it("pieds au sol (±0,5 % de la hauteur), debout, en marche, en course, en buste, y compris sur un relief", () => {
    const cases: [TitanSpec, TitanPose[]][] = [...SPECS.map((s): [TitanSpec, TitanPose[]] => [s, ["debout", "marche", "course"]]), [titanSpec("titan_mur"), ["buste"]]];
    for (const [spec, poses] of cases) {
      const ti = of(spec);
      for (const ground of [0, 37]) {
        ti.group.position.set(10, ground, -4);
        ti.group.updateMatrixWorld(true);
        for (const pose of poses) {
          for (const time of pose === "debout" || pose === "buste" ? [0] : [0, 0.4, 0.9, 1.6]) {
            ti.setPose(pose, time);
            const low = skinnedBounds(ti.human, "peau_pieds").min.y - ground;
            const all = skinnedBounds(ti.human).min.y - ground;
            expect(Math.abs(low), `${spec.id} ${pose} t=${time} sol ${ground} : pied à ${low.toFixed(3)} m`).toBeLessThanOrEqual(0.005 * spec.height);
            expect(all, `${spec.id} ${pose} : rien sous le sol`).toBeGreaterThanOrEqual(-0.01 * spec.height);
          }
        }
      }
      ti.group.position.set(0, 0, 0);
      ti.group.updateMatrixWorld(true);
    }
  });

  it("corps couchés à plat : abattu et allongé touchent le sol ; Rod Reiss allongé plus long que haut", () => {
    for (const spec of SPECS) {
      const ti = of(spec);
      for (const pose of ["abattu", "allonge"] as const) {
        ti.setPose(pose, 0.5);
        const b = skinnedBounds(ti.human);
        expect(Math.abs(b.min.y), `${spec.id} ${pose} : point bas ${b.min.y.toFixed(3)}`).toBeLessThanOrEqual(0.01 * spec.height);
        // Épaisseur du corps couché : torse, ventre, tête de côté (le quart de la hauteur chez les petites classes, à grosse
        // tête) ; en rampant, tête relevée et jambe pliée (borne de R1b pour Rod Reiss : 40 %).
        expect(b.max.y - b.min.y, `${spec.id} ${pose} : épaisseur`).toBeLessThan((pose === "abattu" ? 0.36 : 0.4) * spec.height);
        // Le corps repose sur le ventre : le bassin n'est pas plus haut que la profondeur du ventre devant lui (au repos), à
        // 35 % près (tête relevée des petites classes en rampant : 27 %). Un corps soulevé par un bras la dépassait de 56 %.
        const pelvis = worldPoint(ti.joints.bassin).y - ti.group.position.y;
        expect(pelvis, `${spec.id} ${pose} : bassin à ${pelvis.toFixed(2)} m, ventre à ${frontOf(ti).toFixed(2)} m`).toBeLessThan(1.35 * frontOf(ti));
      }
    }
    const rod = of(titanSpec("rod_reiss"));
    rod.setPose("allonge", 0);
    const b = skinnedBounds(rod.human);
    expect(Math.max(b.max.x - b.min.x, b.max.z - b.min.z)).toBeGreaterThan(100);
    expect(b.max.y - b.min.y).toBeLessThan(0.4 * 120);
  });

  it("interface des Titans de R1 : 18 articulations portées par les os, mâchoire, marque de nuque au cou, vapeur", () => {
    const beant = of(titanSpec("classe_15"));
    const rictus = of(titanSpec("classe_3"));
    expect(Object.keys(beant.joints)).toHaveLength(18);
    for (const [j, bone] of Object.entries(TITAN_BONES)) expect(beant.joints[j as keyof typeof beant.joints].name, j).toBe(bone);
    beant.setPose("marche", 0.3);
    rictus.setPose("marche", 0.3);
    expect(beant.joints.machoire.rotation.x).toBeGreaterThan(0.3);
    expect(Math.abs(rictus.joints.machoire.rotation.x)).toBeLessThan(0.05);
    // Nuque : derrière le cou, au-dessus des épaules, sous le sommet du crâne, portée par l'os du cou.
    expect(beant.nape.parent?.name).toBe("neck_01");
    beant.setPose("debout", 0);
    const nape = worldPoint(beant.nape);
    const neck = worldPoint(beant.joints.cou);
    const head = worldPoint(beant.joints.tete);
    expect(nape.z).toBeLessThan(neck.z);
    expect(nape.y).toBeGreaterThan(neck.y);
    expect(nape.y).toBeLessThan(head.y + 0.05 * 15);
    expect(beant.steam.visible).toBe(false);
    beant.setPose("abattu", 1);
    expect(beant.steam.visible).toBe(true);
    const colossal = of(titanSpec("colossal"));
    colossal.setPose("debout", 0.5);
    expect(colossal.steam.visible).toBe(true);
  });

  it("même graine, même Titan ; graines différentes, individus différents ; repli sur les figures de R1 sans gabarit", () => {
    const sig = (ti: HumanTitan): string => {
      ti.setPose("marche", 0.7);
      const b = skinnedBounds(ti.human);
      return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].map((v) => v.toFixed(4)).join("/");
    };
    const spec = titanSpec("classe_8");
    const a = buildHumanTitan(t, spec, 7);
    const a2 = buildHumanTitan(t, spec, 7);
    const c = buildHumanTitan(t, spec, 8);
    expect(sig(a2)).toBe(sig(a));
    expect(sig(c)).not.toBe(sig(a));
    for (const x of [a, a2, c]) x.dispose();
    const r1 = makeTitan({ template: null, eyeMap: null, reason: "primitives" }, TITAN_SMALL, 3, null);
    expect("human" in r1).toBe(false);
    expect(r1.body.getObjectByName("crane")).toBeDefined();
    const human = makeTitan({ template: t, eyeMap: null, reason: "makehuman" }, TITAN_SMALL, 3, null);
    expect("human" in human).toBe(true);
    r1.dispose();
    human.dispose();
  });
});
