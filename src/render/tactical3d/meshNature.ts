import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Group, InstancedMesh, LOD, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, Points, PointsMaterial, Quaternion, Vector3 } from "three";
import type { Material, Texture } from "three";
import type { GiantTree, Shaft } from "./envTypes";
import { derive, range, seeded } from "./rng";
import { heightAt } from "./terrain";
import type { TerrainData } from "./terrain";
import { FaceBuilder } from "./townMesh";
import { unitLump, unitLumpCards } from "./meshTrees";

/**
 * Maillage de la forêt des Arbres Géants (R1b.5) : troncs effilés à contreforts racinaires et mousse au pied, branches
 * maîtresses, houppiers (voûte) instanciés, rayons de lumière additifs, nappes de brume. Tuiles de détail (LOD) comme la
 * végétation : proche (troncs à 14 côtés, racines, toutes les branches), loin (8 côtés, sans racines), rien au-delà.
 */
export const GIANT_TILE = 220;

export interface NatureColors {
  bark: string;
  moss: string;
  canopy: [string, string];
  light: string;
}

export interface NatureMeshes {
  group: Group;
  lods: LOD[];
  /** Branches maîtresses et houppiers comptés (proche). */
  counts: Record<string, number>;
  dispose(): void;
}

const up = new Vector3(0, 1, 0);

/** Tronc : cylindre effilé, teinte de sommet du pied moussu à l'écorce. */
function trunk(fb: FaceBuilder, t: GiantTree, ground: number, c: NatureColors, near: boolean): void {
  const g = new CylinderGeometry(t.radius * 0.3, t.radius, t.height, near ? 14 : 8, near ? 8 : 3, false);
  g.translate(0, t.height / 2, 0);
  const bark = new Color(c.bark);
  const moss = new Color(c.moss);
  const tmp = new FaceBuilder();
  const m = new Matrix4().compose(new Vector3(t.x - (Math.floor(t.x / GIANT_TILE) + 0.5) * GIANT_TILE, ground - 1, t.y - (Math.floor(t.y / GIANT_TILE) + 0.5) * GIANT_TILE), new Quaternion().setFromAxisAngle(new Vector3(Math.cos(t.r), 0, Math.sin(t.r)), t.lean), new Vector3(1, 1, 1));
  // Teinte par sommet : on passe par un FaceBuilder intermédiaire, puis on recolore selon la hauteur.
  tmp.geometry(g, m, bark);
  for (let i = 0; i < tmp.pos.length / 3; i++) {
    const y = (tmp.pos[i * 3 + 1] as number) - ground;
    const k = Math.max(0, Math.min(1, (y - 4) / 16));
    const col = moss.clone().lerp(bark, k).multiplyScalar(0.9 + 0.1 * Math.sin(i * 1.7));
    tmp.col[i * 3] = col.r;
    tmp.col[i * 3 + 1] = col.g;
    tmp.col[i * 3 + 2] = col.b;
  }
  fb.pos.push(...tmp.pos);
  fb.nor.push(...tmp.nor);
  fb.uv.push(...tmp.uv);
  fb.col.push(...tmp.col);
  g.dispose();
}

/** Rayons de lumière (forêt géante, puits de jour d'une caverne) : cylindres ouverts additifs, inclinés de `tilt` (rad). */
export function shaftMesh(shafts: readonly Shaft[], groundAt: (x: number, y: number) => number, light: string, tilt: number): Mesh {
  const fb = new FaceBuilder();
  const col = new Color(light);
  for (const s of shafts) {
    const g = new CylinderGeometry(s.radius, s.radius * 1.6, s.height, 14, 1, true);
    const m = new Matrix4().makeTranslation(s.x, groundAt(s.x, s.y) + s.height / 2, s.y).multiply(new Matrix4().makeRotationZ(tilt));
    fb.geometry(g, m, col);
    g.dispose();
  }
  const mat = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.075, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });
  const m = new Mesh(fb.build(), mat);
  m.name = "rayons-lumiere";
  m.renderOrder = 2;
  return m;
}

export function buildGiantForest(giants: readonly GiantTree[], groundAt: (x: number, y: number) => number, shafts: readonly Shaft[], c: NatureColors, q: { near: number; far: number; shadows: boolean }, mistMap: Texture | null, mist: { density: number; top: number }, size: number, leaves: Texture | null = null): NatureMeshes {
  const group = new Group();
  group.name = "foret-geante";
  const materials: Material[] = [];
  const geos: BufferGeometry[] = [];
  const barkMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  // R1c : voûte en massifs lisses (intérieur sombre) habillés de cartes de feuillage quand la texture de feuilles existe.
  const crownMat = new MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const leafMat = leaves ? new MeshStandardMaterial({ vertexColors: true, map: leaves, alphaTest: 0.42, side: DoubleSide, roughness: 0.85 }) : null;
  materials.push(barkMat, crownMat, ...(leafMat ? [leafMat] : []));
  const tiles = new Map<string, GiantTree[]>();
  for (const t of giants) {
    const key = `${Math.floor(t.x / GIANT_TILE)},${Math.floor(t.y / GIANT_TILE)}`;
    const l = tiles.get(key) ?? [];
    l.push(t);
    tiles.set(key, l);
  }
  const lods: LOD[] = [];
  let branches = 0;
  let crowns = 0;
  const crownGeo = { near: unitLump(2, 3.1), far: unitLump(1, 3.1) };
  const cardGeo = leafMat ? unitLumpCards(90, 0.62, 7) : null;
  geos.push(crownGeo.near, crownGeo.far, ...(cardGeo ? [cardGeo] : []));
  for (const [key, list] of [...tiles.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const [ti, tj] = key.split(",").map(Number) as [number, number];
    const cx = (ti + 0.5) * GIANT_TILE;
    const cz = (tj + 0.5) * GIANT_TILE;
    const lod = new LOD();
    lod.name = `geants-${key}`;
    lod.position.set(cx, 0, cz);
    for (const near of [true, false]) {
      const level = new Group();
      const fb = new FaceBuilder();
      const crownsHere: { m: Matrix4; col: Color }[] = [];
      for (const t of list) {
        const ground = groundAt(t.x, t.y);
        trunk(fb, t, ground, c, near);
        const lx = t.x - cx;
        const lz = t.y - cz;
        if (near) {
          // Contreforts racinaires : cônes aplatis, rayonnants.
          for (let k = 0; k < 6; k++) {
            const a = t.r + (k / 6) * Math.PI * 2;
            const m = new Matrix4().makeTranslation(lx + Math.cos(a) * t.radius * 0.9, ground + 2.2, lz + Math.sin(a) * t.radius * 0.9).multiply(new Matrix4().makeRotationY(-a)).multiply(new Matrix4().makeRotationZ(0.5)).multiply(new Matrix4().makeScale(0.45, 1, 1));
            fb.geometry(new ConeGeometry(t.radius * 0.8, 7, 5), m, new Color(c.moss).multiplyScalar(0.9));
          }
        }
        for (const b of near ? t.branches : t.branches.filter((_, i) => i % 2 === 0)) {
          // Branche maîtresse : part du tronc, légèrement montante.
          const len = b.len;
          const m = new Matrix4()
            .makeTranslation(lx, ground + b.h, lz)
            .multiply(new Matrix4().makeRotationY(-b.a))
            .multiply(new Matrix4().makeRotationZ(-Math.PI / 2 + 0.18))
            .multiply(new Matrix4().makeTranslation(0, len / 2 + t.radius * 0.4, 0));
          fb.geometry(new CylinderGeometry(0.35, 1.0, len, near ? 7 : 4), m, new Color(c.bark).multiplyScalar(1.05));
          if (near) branches++;
          // Feuillage au bout des branches hautes.
          if (b.h > t.height * 0.45) {
            const d = t.radius * 0.6 + len;
            crownsHere.push({ m: new Matrix4().compose(new Vector3(lx + Math.cos(b.a) * d, ground + b.h + len * 0.2, lz + Math.sin(b.a) * d), new Quaternion().setFromAxisAngle(up, b.a), new Vector3(9, 5, 8)), col: new Color(c.canopy[1]) });
          }
        }
        // Voûte : masses de feuillage étagées au sommet.
        const n = near ? 8 : 4;
        for (let k = 0; k < n; k++) {
          const a = t.r + (k / n) * Math.PI * 2;
          const r = k === 0 ? 0 : 8 + (k % 3) * 4;
          const y = ground + t.height * (0.78 + 0.18 * ((k * 0.37) % 1));
          const s = 10 + (k % 4) * 3;
          crownsHere.push({ m: new Matrix4().compose(new Vector3(lx + Math.cos(a) * r, y, lz + Math.sin(a) * r), new Quaternion().setFromAxisAngle(up, a), new Vector3(s, s * 0.55, s)), col: new Color(k % 2 ? c.canopy[0] : c.canopy[1]).multiplyScalar(0.85 + 0.2 * ((k * 0.61) % 1)) });
        }
      }
      const tm = new Mesh(fb.build(), barkMat);
      tm.name = near ? "troncs-proches" : "troncs-lointains";
      tm.castShadow = q.shadows;
      tm.receiveShadow = true;
      geos.push(tm.geometry);
      level.add(tm);
      const im = new InstancedMesh(near ? crownGeo.near : crownGeo.far, crownMat, crownsHere.length);
      im.name = near ? "voute-proche" : "voute-lointaine";
      im.castShadow = q.shadows;
      im.receiveShadow = near;
      crownsHere.forEach((x, i) => {
        im.setMatrixAt(i, x.m);
        im.setColorAt(i, x.col);
      });
      im.computeBoundingSphere();
      if (near) crowns += crownsHere.length;
      level.add(im);
      if (near && cardGeo && leafMat) {
        const lm = new InstancedMesh(cardGeo, leafMat, crownsHere.length);
        lm.name = "voute-feuilles";
        lm.receiveShadow = true;
        crownsHere.forEach((x, i) => {
          lm.setMatrixAt(i, x.m);
          lm.setColorAt(i, x.col);
        });
        lm.computeBoundingSphere();
        level.add(lm);
      }
      lod.addLevel(level, near ? 0 : q.near);
    }
    lod.addLevel(new Object3D(), q.far);
    lods.push(lod);
    group.add(lod);
  }

  // Rayons de lumière : cylindres ouverts, additifs, légèrement inclinés comme le soleil.
  if (shafts.length > 0) {
    const m = shaftMesh(shafts, groundAt, c.light, 0.22);
    materials.push(m.material as Material);
    geos.push(m.geometry);
    group.add(m);
  }

  // Brume au sol : nappes superposées, plus denses en bas.
  if (mist.density > 0) {
    const layers = 6;
    for (let k = 0; k < layers; k++) {
      const g = new PlaneGeometry(size, size, 1, 1);
      g.rotateX(-Math.PI / 2);
      geos.push(g);
      const mat = new MeshBasicMaterial({ color: new Color(c.light), map: mistMap, transparent: true, opacity: mist.density * (0.13 - k * 0.018), depthWrite: false, side: DoubleSide });
      materials.push(mat);
      const m = new Mesh(g, mat);
      m.position.y = groundAt(0, 0) + 1.5 + (k * mist.top) / layers;
      m.rotation.y = k * 0.7;
      m.name = `brume-${k}`;
      m.renderOrder = 3;
      group.add(m);
    }
  }
  return {
    group,
    lods,
    counts: { giants: giants.length, branches, crowns, shafts: shafts.length },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of materials) m.dispose();
      group.traverse((o) => {
        if (o instanceof InstancedMesh) o.dispose();
      });
    },
  };
}

/**
 * Embruns de la côte (accessoire « embruns ») : une frange d'écume posée sur la ligne d'eau (cherchée au sud du trait de côte,
 * là où le sol passe sous le niveau de la mer) et un nuage fixe de gouttelettes au-dessus des brisants.
 */
export function buildSpray(t: TerrainData, color: string, seed: number): { group: Group; count: number; dispose(): void } {
  const group = new Group();
  group.name = "embruns";
  const sea = t.seaLevel ?? 0;
  const line: Vector3[] = [];
  for (const c of t.coast) {
    let y = c.y;
    while (y < c.y + 200 && heightAt(t.heights, c.x, y) > sea) y += 1.5;
    line.push(new Vector3(c.x, sea + 0.05, y));
  }
  const fb = new FaceBuilder();
  const foam = new Color(color);
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i] as Vector3;
    const b = line[i + 1] as Vector3;
    fb.face([[a.x, a.y, a.z - 1.5], [b.x, b.y, b.z - 1.5], [b.x, b.y, b.z + 5], [a.x, a.y, a.z + 5]], [[0, 0], [1, 0], [1, 1], [0, 1]], foam, [0, 1, 0]);
  }
  const foamMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false });
  const band = new Mesh(fb.build(), foamMat);
  band.name = "ecume";
  band.renderOrder = 1;
  group.add(band);
  const rand = seeded(derive(seed, 1800));
  const pts: number[] = [];
  const n = 2400;
  for (let k = 0; k < n; k++) {
    const i = Math.floor(rand() * (line.length - 1));
    const a = line[i] as Vector3;
    const b = line[i + 1] as Vector3;
    const f = rand();
    pts.push(a.x + (b.x - a.x) * f, sea + range(rand, 0.1, 2.8) * rand(), a.z + (b.z - a.z) * f + range(rand, -1, 4));
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
  const dropMat = new PointsMaterial({ color: foam, size: 0.35, transparent: true, opacity: 0.55, depthWrite: false });
  const drops = new Points(geo, dropMat);
  drops.name = "gouttelettes";
  group.add(drops);
  return {
    group,
    count: n,
    dispose() {
      band.geometry.dispose();
      geo.dispose();
      foamMat.dispose();
      dropMat.dispose();
    },
  };
}
