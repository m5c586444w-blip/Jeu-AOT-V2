import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateEnvironment, supportedGenerators } from "../../../src/render/tactical3d/environment";
import { buildEnvironmentMeshes } from "../../../src/render/tactical3d/envMesh";
import { distanceToWall, wallFrame } from "../../../src/render/tactical3d/envWall";
import { measureBox, meshNames } from "../../../src/render/tactical3d/rig";
import { PROFILES, WALLS, hiddenBelowHorizon, ringMidDistanceM, wallTopAboveHorizon } from "../../../src/render/tactical3d/styles";
import { heightAt } from "../../../src/render/tactical3d/terrain";

/**
 * Murs (R1b.4, CR1b-08, CR1b-11) :
 * - règle de visibilité : jamais de mur dans la campagne intérieure (100 à 130 km entre les murs, `?`), toujours un mur près des
 *   districts adossés et des ouvrages qui le touchent ;
 * - mur de 50 m mesuré, porte massive, chemin de ronde, canons posés sur leurs rails, variante endommagée.
 * `R1B_LOG=1` écrit `docs/reports/R1b-murs.log`.
 */
const log: string[] = [];
const available = new Set(supportedGenerators());
const testable = PROFILES.filter((p) => available.has(p.generateur));

describe("règle de visibilité du mur (R1b.4)", () => {
  it("au milieu d'un anneau (≥ 50 km d'un mur), le sommet du mur de 50 m est sous l'horizon ; près d'un district, il le domine", () => {
    const mid = ringMidDistanceM();
    expect(mid).toBe(50_000);
    expect(hiddenBelowHorizon(mid, 1.7)).toBeGreaterThan(WALLS.hauteur_m.valeur);
    expect(wallTopAboveHorizon(mid)).toBe(false);
    // Même du haut d'un clocher de 30 m, à 50 km, le mur reste caché.
    expect(hiddenBelowHorizon(mid, 30)).toBeGreaterThan(WALLS.hauteur_m.valeur);
    for (const d of [0, 400, 2000, 10_000]) expect(wallTopAboveHorizon(d), `${d} m`).toBe(true);
    // Distance où le sommet passe sous l'horizon, pour un œil à 1,7 m.
    let d = 1000;
    while (wallTopAboveHorizon(d)) d += 100;
    log.push(`horizon : sommet du mur (50 m) caché au-delà de ${(d / 1000).toFixed(1)} km pour un œil à 1,7 m ; milieu d'anneau à ${mid / 1000} km : ${hiddenBelowHorizon(mid, 1.7).toFixed(0)} m cachés`);
    expect(d).toBeLessThan(mid);
  });

  it("aucun mur dans les scènes dont le profil l'exclut (campagne intérieure, capitale, nature) ; un mur dans les autres", () => {
    for (const p of testable) {
      const env = generateEnvironment(p.id, 850);
      const meshes = buildEnvironmentMeshes(env, { quality: "bas", textures: null });
      const names = meshNames(meshes.group);
      const hasWall = names.some((n) => n.startsWith("mur-"));
      log.push(`${p.id} ${p.nom} : profil « mur visible » = ${p.mur_visible.visible ? "oui" : "non"} ; maillages de mur dans la scène : ${hasWall ? "oui" : "non"}`);
      expect(hasWall, p.id).toBe(p.mur_visible.visible);
      expect(env.wall !== null, p.id).toBe(p.mur_visible.visible);
      meshes.dispose();
    }
    // La campagne pure et le village sont dans le lot testé.
    expect(testable.map((p) => p.id)).toEqual(expect.arrayContaining(["E11", "E13", "E06", "E14", "E19"]));
  });
});

describe("le mur (R1b.4)", () => {
  const e22 = generateEnvironment("E22", 850);
  const wall = e22.wall;
  const ground = (q: { x: number; y: number }): number => (e22.terrain ? heightAt(e22.terrain.heights, q.x, q.y) : 0);

  it("50 m mesurés du pied au chemin de ronde, épaisseur et teinte en paramètres « ? »", () => {
    expect(wall).not.toBeNull();
    if (!wall) return;
    const m = buildEnvironmentMeshes(e22, { quality: "bas", textures: null });
    let body: Parameters<typeof measureBox>[0] | null = null;
    m.group.traverse((o) => {
      if (o.name === "mur-parement") body = o;
    });
    expect(body).not.toBeNull();
    const box = measureBox(body as unknown as Parameters<typeof measureBox>[0]);
    const g = ground(wall.paths[0]?.path[10] ?? { x: 0, y: 0 });
    const h = box.max.y - WALLS.parapet_m.valeur - g;
    log.push(`E22 : hauteur mesurée ${h.toFixed(2)} m (sol ${g.toFixed(2)} m) ; épaisseur ${wall.thickness} m (${WALLS.epaisseur_m.canon}) ; teinte ${wall.tint} (${WALLS.teinte.canon})`);
    expect(Math.abs(h - 50)).toBeLessThan(2.5);
    expect(WALLS.epaisseur_m.canon).toBe("?");
    expect(WALLS.teinte.canon).toBe("?");
    m.dispose();
  });

  it("porte massive, chemin de ronde avec canons posés sur les rails, la volée vers l'extérieur", () => {
    if (!wall) return;
    const w = wall.paths[0];
    if (!w) return;
    expect(w.gates).toHaveLength(1);
    const cannons = e22.props.filter((p) => p.kind === "canons");
    expect(cannons.length).toBe(w.cannons.length);
    expect(cannons.length).toBeGreaterThan(30);
    for (const c of cannons) {
      // Sur le chemin de ronde (sommet du mur) et entre les deux rails.
      expect(Math.abs(c.z - (ground(c) + WALLS.hauteur_m.valeur + 0.2))).toBeLessThan(0.01);
      expect(distanceToWall(wall, c)).toBeLessThan(wall.railGauge / 2);
      // Volée vers l'extérieur (le sud pour ce pan) : direction de l'accessoire = normale extérieure.
      expect(Math.sin(c.r)).toBeGreaterThan(0.99);
    }
    const spacing = w.cannons.slice(1).map((s, i) => s - (w.cannons[i] as number));
    expect(Math.min(...spacing)).toBeGreaterThanOrEqual(WALLS.canon_espacement_m.valeur - 1e-6);
    log.push(`E22 : ${cannons.length} canons, espacement ${WALLS.canon_espacement_m.valeur} m, ${w.gates.length} porte (${w.gates[0]?.state}) ; rails continus le long du chemin de ronde`);
    const f = wallFrame(w, w.gates[0]?.s ?? 0);
    expect(Math.abs(f.out.y - 1)).toBeLessThan(1e-9);
  });

  it("variante endommagée : brèche haute qui révèle un Titan-Mur ; districts : saillie à deux portes", () => {
    const dmg = generateEnvironment("E22", 850, "endommage");
    const b = dmg.wall?.paths[0]?.breaches[0];
    expect(b?.face).toBe(true);
    expect(b?.floor).toBeGreaterThan(0);
    expect(dmg.titans.some((t) => t.type === "titan_mur" && t.pose === "buste")).toBe(true);
    const e01 = generateEnvironment("E01", 850);
    expect(e01.wall?.paths).toHaveLength(2);
    // R1c : plus les deux portes de rivière de la voie d'eau (districts-r1c.test.ts).
    expect(e01.wall?.paths.flatMap((w) => w.gates.map((g) => g.kind)).sort()).toEqual(["eau", "eau", "exterieure", "interieure"]);
    expect(generateEnvironment("E01", 850, "850").wall?.paths[1]?.gates[0]?.state).toBe("scellee");
    expect(generateEnvironment("E01", 850, "845").wall?.paths[1]?.gates[0]?.state).toBe("breche");
    expect(generateEnvironment("E01", 850, "851").wall?.paths[1]?.gates[0]?.state).toBe("passage");
    if (process.env["R1B_LOG"] === "1") writeFileSync("docs/reports/R1b-murs.log", `${log.join("\n")}\n`);
  });
});
