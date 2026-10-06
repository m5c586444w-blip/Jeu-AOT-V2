import { Color, ConeGeometry, DoubleSide, Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import type { BufferGeometry, Material, Texture } from "three";
import type { CaveData, Shaft } from "./envTypes";
import { shaftMesh } from "./meshNature";
import { fbm, gradientNoise } from "./noise";
import { derive, range, seeded } from "./rng";
import { FaceBuilder } from "./townMesh";
import { normalOf } from "./texturesEnv";

/**
 * Maillage des lieux souterrains de R1b (lot 2) :
 * - voûte de roche (ville souterraine E08, cavernes de glace E21) : dôme déformé par bruit, vu de l'intérieur, jupe qui descend
 *   sous le sol, ouvertures (puits de jour) et rayons de lumière, stalactites (et stalagmites de glace) ;
 * - crypte (chapelle souterraine Reiss E23) : nef dallée, murs de pierre jointoyée, berceau à arcs doubleaux, porte d'entrée.
 * Teintes : la roche est la `pierre` du profil, l'ombre de la voûte son `toit` (rôle « obscurité » des souterrains), la glace
 * et la lumière viennent des teintes physiques de `materiaux.json`.
 */
type V3 = [number, number, number];

export interface CaveColors {
  rock: string;
  dark: string;
  light: string;
  floor: string;
  ice: string;
}

export interface CaveMeshes {
  group: Group;
  counts: Record<string, number>;
  dispose(): void;
}

const up = new Vector3(0, 1, 0);

/** Dôme de roche : anneaux d'élévation × secteurs, bruit radial ; les cases au droit d'une ouverture sont omises. */
function dome(fb: FaceBuilder, cave: CaveData, floor: number, c: CaveColors, seed: number): number {
  const noise = gradientNoise(derive(seed, 1700));
  const rings = 22;
  const segs = 96;
  const R = cave.radius;
  const H = cave.height;
  const rock = new Color(c.rock);
  const dark = new Color(c.dark);
  const ice = new Color(c.ice);
  const vtx = (i: number, j: number): { p: V3; col: Color } => {
    const phi = (j / segs) * Math.PI * 2;
    const th = (Math.max(0, i) / rings) * (Math.PI / 2);
    const n = i >= rings ? 0 : fbm(noise, Math.cos(phi) * 2.6 + 11, Math.sin(phi) * 2.6 + th * 3.2, 4);
    const k = 1 + 0.12 * n;
    const r = i < 0 ? R * 1.03 * k : R * Math.cos(th) * k;
    const y = i < 0 ? floor - 30 : floor + H * Math.sin(th) * (1 + 0.1 * n);
    const shade = 0.62 + 0.3 * (0.5 + 0.5 * fbm(noise, Math.cos(phi) * 9, Math.sin(phi) * 9 + th * 11, 3));
    const col = rock.clone().multiplyScalar(shade).lerp(dark, Math.max(0, Math.sin(th)) * 0.55);
    if (cave.kind === "glace" && n > 0.05) col.lerp(ice, Math.min(0.7, (n - 0.05) * 3));
    return { p: [Math.cos(phi) * r, y, Math.sin(phi) * r], col };
  };
  const center: V3 = [0, floor + H * 0.3, 0];
  let faces = 0;
  for (let i = -1; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = vtx(i, j);
      const b = vtx(i, j + 1);
      const d = vtx(i + 1, j + 1);
      const e = vtx(i + 1, j);
      const mx = (a.p[0] + d.p[0]) / 2;
      const mz = (a.p[2] + d.p[2]) / 2;
      if (cave.openings.some((o) => Math.hypot(mx - o.x, mz - o.y) < 12)) continue;
      const out: V3 = [center[0] - mx, center[1] - (a.p[1] + d.p[1]) / 2, center[2] - mz];
      const col = a.col.clone().lerp(d.col, 0.5);
      fb.face([a.p, b.p, d.p, e.p], [[j / 8, i / 4], [(j + 1) / 8, i / 4], [(j + 1) / 8, (i + 1) / 4], [j / 8, (i + 1) / 4]], col, out);
      faces++;
    }
  }
  return faces;
}

/** Stalactites (et stalagmites dans la glace) : cônes pendus sous la voûte, pointe en bas. */
function spikes(fb: FaceBuilder, cave: CaveData, floor: number, groundAt: (x: number, y: number) => number, c: CaveColors, seed: number): number {
  const rand = seeded(derive(seed, 1701));
  const n = cave.kind === "glace" ? 120 : 110;
  const rock = new Color(c.rock).multiplyScalar(0.75);
  const ice = new Color(c.ice);
  const m = new Matrix4();
  const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);
  for (let k = 0; k < n; k++) {
    const r = Math.sqrt(rand()) * cave.radius * 0.86;
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const top = floor + cave.height * Math.sin(Math.acos(Math.min(1, r / cave.radius))) * 0.9;
    const L = range(rand, 3, cave.kind === "glace" ? 12 : 14);
    const g = new ConeGeometry(range(rand, 0.8, 2.6), L + 6, 6);
    const col = cave.kind === "glace" ? ice.clone().multiplyScalar(range(rand, 0.8, 1)) : rock.clone().multiplyScalar(range(rand, 0.85, 1.1));
    fb.geometry(g, m.compose(new Vector3(x, top - L / 2 + 3, z), q, new Vector3(1, 1, 1)), col);
    if (cave.kind === "glace" && rand() < 0.45) {
      const h = range(rand, 2, 7);
      fb.geometry(g, m.compose(new Vector3(x + range(rand, -3, 3), groundAt(x, z) + h / 2 - 1, z + range(rand, -3, 3)), new Quaternion().setFromAxisAngle(up, rand() * 6), new Vector3(1, (h + 1) / (L + 6), 1)), col);
    }
    g.dispose();
  }
  return n;
}

/** Crypte : nef rectangulaire (largeur 2a, longueur 2b), murs droits jusqu'à `hw`, berceau jusqu'à la clé `H`. */
function crypt(stone: FaceBuilder, floorFb: FaceBuilder, dark: FaceBuilder, cave: CaveData, c: CaveColors): number {
  const a = 14;
  const b = cave.radius;
  const H = cave.height;
  const hw = 7;
  const wall = new Color(c.rock);
  const rib = new Color(c.rock).multiplyScalar(0.78);
  const s = 1 / 4;
  let faces = 0;
  floorFb.face([[-a, 0, -b], [a, 0, -b], [a, 0, b], [-a, 0, b]], [[0, 0], [2 * a * s, 0], [2 * a * s, 2 * b * s], [0, 2 * b * s]], new Color(c.floor), [0, 1, 0]);
  for (const sx of [-1, 1]) {
    stone.face([[sx * a, -0.5, -b], [sx * a, -0.5, b], [sx * a, hw, b], [sx * a, hw, -b]], [[0, 0], [2 * b * s, 0], [2 * b * s, hw * s], [0, hw * s]], wall, [-sx, 0, 0]);
    faces++;
  }
  // Berceau : 16 bandes le long de la nef ; pignons aux deux bouts.
  const n = 16;
  const arc = (k: number): [number, number] => {
    const t = (k / n) * Math.PI;
    return [a * Math.cos(t), hw + (H - hw) * Math.sin(t)];
  };
  for (let k = 0; k < n; k++) {
    const [x0, y0] = arc(k);
    const [x1, y1] = arc(k + 1);
    stone.face([[x0, y0, -b], [x0, y0, b], [x1, y1, b], [x1, y1, -b]], [[0, k * 1.2], [2 * b * s, k * 1.2], [2 * b * s, (k + 1) * 1.2], [0, (k + 1) * 1.2]], wall.clone().multiplyScalar(0.92 - 0.12 * Math.sin((k / n) * Math.PI)), [-(x0 + x1) / 2, H * 0.4 - (y0 + y1) / 2, 0]);
    faces++;
    for (const sz of [-1, 1]) {
      stone.face([[x0, y0, sz * b], [x1, y1, sz * b], [0, hw, sz * b]], [[x0 * s, y0 * s], [x1 * s, y1 * s], [0, hw * s]], wall, [0, 0, -sz]);
      faces++;
    }
    // Arcs doubleaux : un tous les 9 m, en saillie de 0,4 m.
    for (let r = -3; r <= 3; r++) {
      const z = r * 9;
      const i0: V3 = [x0 * 0.97, y0 - 0.4, z - 0.5];
      const i1: V3 = [x1 * 0.97, y1 - 0.4, z - 0.5];
      const j0: V3 = [x0 * 0.97, y0 - 0.4, z + 0.5];
      const j1: V3 = [x1 * 0.97, y1 - 0.4, z + 0.5];
      stone.face([i0, i1, j1, j0], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]], rib, [-(x0 + x1) / 2, -1, 0]);
    }
  }
  for (const sz of [-1, 1]) {
    stone.face([[-a, -0.5, sz * b], [a, -0.5, sz * b], [a, hw, sz * b], [-a, hw, sz * b]], [[0, 0], [2 * a * s, 0], [2 * a * s, hw * s], [0, hw * s]], wall, [0, 0, -sz]);
    faces++;
  }
  // Porte d'entrée (côté de l'escalier, +b) : baie sombre.
  dark.face([[-2.2, 0, b - 0.05], [2.2, 0, b - 0.05], [2.2, 5, b - 0.05], [-2.2, 5, b - 0.05]], [[0, 0], [1, 0], [1, 1], [0, 1]], new Color(c.dark).multiplyScalar(0.4), [0, 0, -1]);
  return faces;
}

export function buildCave(cave: CaveData, groundAt: (x: number, y: number) => number, shafts: readonly Shaft[], c: CaveColors, stoneMap: Texture | null, seed: number, shadows: boolean): CaveMeshes {
  const group = new Group();
  group.name = `souterrain-${cave.kind}`;
  const materials: Material[] = [];
  const geos: BufferGeometry[] = [];
  const counts: Record<string, number> = {};
  const add = (fb: FaceBuilder, mat: MeshStandardMaterial, name: string, cast: boolean): void => {
    if (fb.pos.length === 0) return;
    const m = new Mesh(fb.build(), mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = true;
    geos.push(m.geometry);
    materials.push(mat);
    group.add(m);
  };
  if (cave.kind === "crypte") {
    const stone = new FaceBuilder();
    const floor = new FaceBuilder();
    const dark = new FaceBuilder();
    counts["caveFaces"] = crypt(stone, floor, dark, cave, c);
    add(stone, new MeshStandardMaterial({ map: stoneMap, normalMap: normalOf(stoneMap, 2.2), vertexColors: true, roughness: 0.93, side: DoubleSide }), "crypte-voute", shadows);
    add(floor, new MeshStandardMaterial({ map: stoneMap, normalMap: normalOf(stoneMap, 2.2), vertexColors: true, roughness: 0.8 }), "crypte-dallage", false);
    add(dark, new MeshStandardMaterial({ vertexColors: true, roughness: 1 }), "crypte-porte", false);
  } else {
    // Niveau du sol : moyenne du terrain sous la voûte.
    let sum = 0;
    let k = 0;
    for (let r = 0; r <= cave.radius; r += cave.radius / 6)
      for (let a = 0; a < 12; a++) {
        sum += groundAt(Math.cos(a * 0.52) * r, Math.sin(a * 0.52) * r);
        k++;
      }
    const floor = sum / k;
    const rock = new FaceBuilder();
    counts["caveFaces"] = dome(rock, cave, floor, c, seed);
    counts["stalactites"] = spikes(rock, cave, floor, groundAt, c, seed);
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: cave.kind === "glace" ? 0.55 : 0.97, side: DoubleSide });
    mat.shadowSide = DoubleSide;
    add(rock, mat, "voute-roche", shadows);
    if (shafts.length > 0) {
      const m = shaftMesh(shafts, groundAt, c.light, 0.05);
      materials.push(m.material as Material);
      geos.push(m.geometry);
      group.add(m);
    }
  }
  counts["openings"] = cave.openings.length;
  return {
    group,
    counts,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
