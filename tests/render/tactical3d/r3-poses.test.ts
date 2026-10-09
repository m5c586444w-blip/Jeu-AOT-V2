import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { skinnedBounds, templateFromBuffer } from "../../../src/render/tactical3d/humanBase";
import type { HumanTemplate } from "../../../src/render/tactical3d/humanBase";
import { R3_SOLDIER_POSES, R3_TITAN_POSES, TITAN_FALL_S } from "../../../src/render/tactical3d/humanAnim";
import { buildHumanSoldier } from "../../../src/render/tactical3d/humanSoldier";
import type { HumanSoldier } from "../../../src/render/tactical3d/humanSoldier";
import { buildHumanTitan } from "../../../src/render/tactical3d/humanTitan";
import type { HumanTitan } from "../../../src/render/tactical3d/humanTitan";
import { OUTFIT_IDS, R3_CLASS_IDS, outfit, r3TitanSpec } from "../../../src/render/tactical3d/figuresR3";
import { soldierMaterials } from "../../../src/render/tactical3d/soldier";

/**
 * Poses de R3 (CR3-06 ; fichier 21 §8 : marche, course, chute, mort, attaque). Contact au sol, mesuré sur la peau articulée à
 * plusieurs instants de chaque cycle :
 * - soldats debout (attente, marche, course, coupe, tir) : point de peau le plus bas à 0 ± 2 cm (épaisseur d'une semelle) ;
 * - Titans debout (debout, marche, course, attaque) : 0 ± 0,5 % de la hauteur (≈ 7 cm à 15 m, l'écart du lissage des pieds) ;
 * - corps couchés (soldat mort, Titan abattu, Titan qui s'effondre) : posés au sol, aucun point dessous ;
 * - chute d'un soldat (en l'air) : aucun point sous l'origine de la figure (la vue la place à l'altitude de la simulation).
 */
let t: HumanTemplate;
const mats = soldierMaterials();
const soldiers: HumanSoldier[] = [];
const titans: HumanTitan[] = [];
const TIMES = [0, 0.13, 0.29, 0.41, 0.58, 0.77, 0.9, 1.21];

beforeAll(async () => {
  const buf = readFileSync("docs/art/assets/derives/humain.glb");
  t = await templateFromBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  OUTFIT_IDS.forEach((id, i) => soldiers.push(buildHumanSoldier(t, 20 + i, mats, { outfit: outfit(id) })));
  R3_CLASS_IDS.forEach((cls, i) => {
    for (const v of ["a", "b", "c"] as const) titans.push(buildHumanTitan(t, r3TitanSpec(cls, v, i % 2 ? "pale" : "rougeaude"), 40 + i));
  });
}, 180_000);

const low = (b: { min: { y: number } }): number => b.min.y;

describe("poses de R3 et contact au sol (R3.3, CR3-06)", () => {
  it("soldats des cinq tenues : attente, marche, course, coupe et tir les pieds au sol (±2 cm)", () => {
    const worst: Record<string, number> = {};
    for (const s of soldiers) {
      for (const p of ["attente", "marche", "course", "frappe", "tir"] as const) {
        for (const time of TIMES) {
          s.setPose(p, time);
          const y = low(skinnedBounds(s.body));
          worst[p] = Math.max(worst[p] ?? 0, Math.abs(y));
          expect(Math.abs(y), `${s.outfit?.id} ${p} t=${time} : ${y.toFixed(3)}`).toBeLessThanOrEqual(0.02);
        }
      }
    }
    console.log(`soldats, écart maximal au sol (m) : ${Object.entries(worst).map(([k, v]) => `${k} ${v.toFixed(4)}`).join(", ")}`);
  });

  it("soldat mort : couché sur le dos, posé au sol, moins de 45 cm de haut ; chute : en l'air, rien sous l'origine", () => {
    for (const s of soldiers) {
      s.setPose("mort", 0.5);
      const b = skinnedBounds(s.body);
      expect(Math.abs(b.min.y), `${s.outfit?.id} mort`).toBeLessThanOrEqual(0.02);
      expect(b.max.y - b.min.y, `${s.outfit?.id} mort`).toBeLessThan(0.45);
      // Couché sur le dos : le visage (yeux) regarde le ciel, au-dessus du bassin.
      const eye = s.body.bones["eye_l"]?.getWorldPosition(s.body.joints.get("eye_l")?.clone() ?? b.min.clone());
      expect((eye?.y ?? 0) > 0.05).toBe(true);
      for (const time of TIMES) {
        s.setPose("chute", time);
        expect(low(skinnedBounds(s.body)), `${s.outfit?.id} chute t=${time}`).toBeGreaterThanOrEqual(-0.05);
      }
    }
  });

  it("Titans des 15 corps : debout, marche, course et attaque les pieds au sol (±0,5 % de la hauteur)", () => {
    const worst: Record<string, number> = {};
    for (const ti of titans) {
      const H = ti.spec.height;
      for (const p of ["debout", "marche", "course", "attaque"] as const) {
        for (const time of TIMES) {
          ti.setPose(p, time);
          const y = low(skinnedBounds(ti.human));
          worst[p] = Math.max(worst[p] ?? 0, Math.abs(y) / H);
          expect(Math.abs(y), `${ti.spec.id} ${p} t=${time} : ${y.toFixed(3)} m`).toBeLessThanOrEqual(0.005 * H);
        }
      }
    }
    console.log(`Titans, écart maximal au sol (fraction de la hauteur) : ${Object.entries(worst).map(([k, v]) => `${k} ${(v * 100).toFixed(3)} %`).join(", ")}`);
  });

  it("Titan abattu : il s'effondre en 1,6 s (de debout à couché), toujours posé au sol, puis reste à terre", () => {
    for (const ti of titans) {
      const H = ti.spec.height;
      const hs: number[] = [];
      for (const k of [0, 0.25, 0.5, 0.75, 1]) {
        ti.setPose("effondre", k * TITAN_FALL_S);
        const b = skinnedBounds(ti.human);
        hs.push((b.max.y - b.min.y) / H);
        expect(Math.abs(b.min.y), `${ti.spec.id} effondre ${k}`).toBeLessThanOrEqual(0.005 * H);
      }
      expect(hs[0] as number, `${ti.spec.id} debout au coup`).toBeGreaterThan(0.85);
      expect(hs[4] as number, `${ti.spec.id} couché à la fin`).toBeLessThan(0.35);
      for (let k = 1; k < hs.length; k++) expect(hs[k] as number).toBeLessThanOrEqual((hs[k - 1] as number) + 0.02);
      ti.setPose("abattu", 0);
      const b = skinnedBounds(ti.human);
      expect(Math.abs(b.min.y)).toBeLessThanOrEqual(0.005 * H);
      // La fin de la chute est la pose « abattu » (aucun saut au passage de l'état « chute » à l'état « mort »).
      expect(Math.abs((b.max.y - b.min.y) / H - (hs[4] as number)), ti.spec.id).toBeLessThan(0.02);
    }
  });

  it("fondu entre états : la nouvelle pose s'installe en 0,3 s d'horloge de bataille ; sans horloge, d'un coup", () => {
    const s = soldiers[0] as HumanSoldier;
    const thigh = s.body.bones["thigh_l"];
    s.setPose("attente", 0, 10);
    const q0 = thigh?.quaternion.clone();
    s.setPose("course", 0.2, 10);
    s.setPose("course", 0.2, 10.15);
    const mid = thigh?.quaternion.clone();
    s.setPose("course", 0.2, 10.5);
    const end = thigh?.quaternion.clone();
    expect(q0 && mid && end).toBeTruthy();
    if (q0 && mid && end) {
      const total = q0.angleTo(end);
      expect(total).toBeGreaterThan(0.1);
      // À mi-fondu, la cuisse est entre les deux poses.
      expect(q0.angleTo(mid)).toBeGreaterThan(0.1 * total);
      expect(mid.angleTo(end)).toBeGreaterThan(0.1 * total);
    }
    const ti = titans[0] as HumanTitan;
    ti.setPose("marche", 0, 3);
    ti.setPose("attaque", 0, 3);
    ti.setPose("attaque", 0, 3.4);
    expect(Math.abs(skinnedBounds(ti.human).min.y)).toBeLessThanOrEqual(0.005 * ti.spec.height);
  });

  it("listes des poses de R3 : marche, course, chute, mort, attaque pour les soldats et les Titans", () => {
    for (const p of ["marche", "course", "chute", "mort", "frappe", "tir"]) expect(R3_SOLDIER_POSES).toContain(p);
    for (const p of ["marche", "course", "attaque", "effondre", "abattu"]) expect(R3_TITAN_POSES).toContain(p);
  });
});
