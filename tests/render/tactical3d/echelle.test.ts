import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { wallLayout, straightWall } from "../../../src/render/tactical3d/envWall";
import { buildWallMeshes } from "../../../src/render/tactical3d/meshWall";
import { measureBox, measureHeight } from "../../../src/render/tactical3d/rig";
import { buildSoldier, soldierHeight, soldierMaterials, SOLDIER_HEIGHT_M } from "../../../src/render/tactical3d/soldier";
import { WALLS } from "../../../src/render/tactical3d/styles";
import { buildTitan } from "../../../src/render/tactical3d/titan";
import type { Titan, TitanPose } from "../../../src/render/tactical3d/titan";
import { SOLDIER_BENCH_M, TITANS, TITAN_CLASS_IDS, TITAN_SPECIAL_IDS, TITAN_VARIANT_IDS, titanHeight, titanSpec, variantSpec } from "../../../src/render/tactical3d/titanGallery";

/**
 * Banc d'échelle (R1b.6, CR1b-07) : hauteurs MESURÉES sur la géométrie posée (boîte englobante sommet par sommet), à ±5 % :
 * soldat de 1,7 m, Titans de 3, 5, 8, 12, 15, 50, 60 et 120 m, mur de 50 m ; rapports entre eux à ±5 % ; pieds au contact
 * du sol, debout comme en marche, y compris posés sur un relief. `R1B_LOG=1` écrit `docs/reports/R1b-echelle.log`.
 */
const TOL = 0.05;
const within = (v: number, target: number, tol = TOL): boolean => Math.abs(v - target) <= tol * target;
const PHASES = [0, 0.25, 0.5, 0.8, 1.1, 1.4, 1.9, 2.4];
const log: string[] = [];

const footLow = (t: Titan): number => {
  let low = Infinity;
  t.body.traverse((o) => {
    if (o.name === "pied") low = Math.min(low, measureBox(o).min.y);
  });
  return low;
};

function measureStanding(t: Titan): number {
  t.setPose("debout", 0);
  return measureHeight(t.body);
}

describe("banc d'échelle (R1b.6)", () => {
  const mats = soldierMaterials();
  const soldier = buildSoldier(1, mats);
  soldier.group.scale.setScalar(SOLDIER_BENCH_M / SOLDIER_HEIGHT_M);
  soldier.setPose("sol", 0);
  const soldierH = soldierHeight(soldier);
  const wallMeshes = buildWallMeshes(wallLayout([straightWall(120, 0, 1, [])]), () => 0, null, 1);
  const body = wallMeshes.meshes.find((m) => m.name === "mur-parement");
  const wallH = body ? measureBox(body).max.y - WALLS.parapet_m.valeur : NaN;

  const figures: { id: string; nominal: number; measured: number }[] = [];
  for (const id of TITAN_CLASS_IDS) figures.push({ id, nominal: titanHeight(id), measured: measureStanding(buildTitan(titanSpec(id), 850)) });
  for (const v of TITAN_VARIANT_IDS) {
    const spec = variantSpec(v);
    figures.push({ id: spec.id, nominal: spec.height, measured: measureStanding(buildTitan(spec, 850)) });
  }
  for (const id of TITAN_SPECIAL_IDS) figures.push({ id, nominal: titanHeight(id), measured: measureStanding(buildTitan(titanSpec(id), 850)) });

  it("soldat 1,7 m et mur 50 m, mesurés, à ±5 %", () => {
    log.push(`soldat : nominal ${SOLDIER_BENCH_M} m, mesuré ${soldierH.toFixed(3)} m (sans les lames)`, `mur : nominal ${WALLS.hauteur_m.valeur} m, mesuré ${wallH.toFixed(2)} m (pied → chemin de ronde, sans parapet)`);
    expect(within(soldierH, SOLDIER_BENCH_M), `soldat ${soldierH}`).toBe(true);
    expect(within(wallH, 50), `mur ${wallH}`).toBe(true);
  });

  it("Titans : classes 3, 5, 8, 12, 15 m, variantes, Titan-Mur 50 m, Colossal 60 m, Titan de Rod Reiss 120 m — hauteur debout mesurée à ±5 %", () => {
    expect(TITAN_CLASS_IDS.map(titanHeight)).toEqual([3, 5, 8, 12, 15]);
    expect(TITAN_SPECIAL_IDS.map((id) => [id, titanHeight(id)])).toEqual([
      ["titan_mur", 50],
      ["rod_reiss", 120],
      ["colossal", 60],
    ]);
    for (const f of figures) {
      log.push(`${f.id} : nominal ${f.nominal} m, mesuré ${f.measured.toFixed(3)} m (écart ${(((f.measured - f.nominal) / f.nominal) * 100).toFixed(2)} %)`);
      expect(within(f.measured, f.nominal), `${f.id} : ${f.measured}`).toBe(true);
    }
  });

  it("hauteurs relatives à ±5 % : Titans / soldat, mur / Titans", () => {
    for (const f of figures) {
      const rs = f.measured / soldierH;
      const rw = wallH / f.measured;
      log.push(`${f.id} : ${rs.toFixed(2)} soldats (nominal ${(f.nominal / SOLDIER_BENCH_M).toFixed(2)}) ; mur / Titan ${rw.toFixed(3)} (nominal ${(50 / f.nominal).toFixed(3)})`);
      expect(within(rs, f.nominal / SOLDIER_BENCH_M), `${f.id} / soldat`).toBe(true);
      expect(within(rw, 50 / f.nominal), `mur / ${f.id}`).toBe(true);
    }
    // Le Titan-Mur a la hauteur du mur ; le Colossal le dépasse (01 : Titans-Murs « plus petits que le Colossal de 60 m »).
    const mur = figures.find((f) => f.id === "titan_mur");
    const col = figures.find((f) => f.id === "colossal");
    expect(mur && within(mur.measured / wallH, 1)).toBe(true);
    expect(col && mur && col.measured > mur.measured * 1.15).toBe(true);
  });

  it("pieds au contact du sol : debout, en marche, en course, posés sur un relief (sol à 37 m)", () => {
    const cases: { spec: ReturnType<typeof titanSpec>; poses: TitanPose[] }[] = [
      ...TITAN_CLASS_IDS.map((id) => ({ spec: titanSpec(id), poses: ["debout", "marche"] as TitanPose[] })),
      ...TITAN_VARIANT_IDS.map((v) => ({ spec: variantSpec(v), poses: ["debout", "marche", "course"] as TitanPose[] })),
      { spec: titanSpec("colossal"), poses: ["debout", "marche"] },
      { spec: titanSpec("titan_mur"), poses: ["buste"] },
    ];
    for (const { spec, poses } of cases) {
      const t = buildTitan(spec, 7);
      for (const ground of [0, 37]) {
        t.group.position.set(10, ground, -4);
        t.group.updateMatrixWorld(true);
        for (const pose of poses) {
          for (const ph of pose === "debout" || pose === "buste" ? [0] : PHASES) {
            t.setPose(pose, ph);
            const foot = footLow(t);
            const all = measureBox(t.body).min.y;
            const gap = foot - ground;
            expect(Math.abs(gap), `${spec.id} ${pose} t=${ph} sol ${ground} : pied à ${gap.toFixed(3)} m`).toBeLessThanOrEqual(0.005 * spec.height);
            expect(all - ground, `${spec.id} ${pose} : rien sous le sol`).toBeGreaterThanOrEqual(-0.01 * spec.height);
          }
        }
      }
    }
    log.push("pieds : écart au sol ≤ 0,5 % de la hauteur, debout, en marche (8 instants), en course, sur sol à 0 et à 37 m — vérifié");
  });

  it("Titan de Rod Reiss allongé : à plat sur le sol, plus long que haut", () => {
    const t = buildTitan(titanSpec("rod_reiss"), 3);
    t.setPose("allonge", 0);
    const box = measureBox(t.body);
    const len = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    const h = box.max.y - box.min.y;
    log.push(`rod_reiss allongé : longueur au sol ${len.toFixed(1)} m, hauteur ${h.toFixed(1)} m, point bas ${box.min.y.toFixed(3)} m`);
    expect(Math.abs(box.min.y)).toBeLessThan(0.01);
    expect(len).toBeGreaterThan(100);
    expect(h).toBeLessThan(0.4 * 120);
    if (process.env["R1B_LOG"] === "1") writeFileSync("docs/reports/R1b-echelle.log", `${log.join("\n")}\n`);
  });

  it("données : soldat, classes et Titans spéciaux portent un statut canon", () => {
    expect(TITANS.soldat_m.valeur).toBe(1.7);
    for (const b of [...TITANS.classes, ...TITANS.speciaux]) expect(["C", "A", "?"]).toContain(b.canon);
    expect(TITANS.speciaux.every((s) => s.canon === "C")).toBe(true);
  });
});
