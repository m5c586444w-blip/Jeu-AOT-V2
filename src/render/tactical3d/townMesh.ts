import { BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Group, IcosahedronGeometry, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3 } from "three";
import type { Material, Texture } from "three";
import { derive, range, seeded } from "./rng";
import type { Rand } from "./rng";
import { cobbleTexture, facadeTextures, flagTexture, grassTexture, roofTexture } from "./textures";
import type { FacadeSet, WallKind } from "./textures";
import { roofRise, roofSpan } from "./town";
import type { Building, Town, Vec2 } from "./town";

/**
 * Maillage de la ville (R1.2) : maisons extrudées, trois types de toits, fenêtres (textures de façade), cheminées, place
 * avec fontaine, étals et arbres, réverbères, pan d'enceinte. Tout est fusionné par matériau : une quinzaine d'appels de
 * dessin pour toute la ville, quelle que soit la graine.
 */
type V3 = [number, number, number];
type UV = [number, number];

/** Accumule des faces planes (normales calculées, orientées vers `out`) avec couleur de sommet. */
export class FaceBuilder {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly uv: number[] = [];
  readonly col: number[] = [];

  face(v: readonly V3[], uv: readonly UV[], color: Color, out: V3): void {
    const a = v[0] as V3;
    const b = v[1] as V3;
    const c = v[2] as V3;
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n: V3 = [(e1[1] ?? 0) * (e2[2] ?? 0) - (e1[2] ?? 0) * (e2[1] ?? 0), (e1[2] ?? 0) * (e2[0] ?? 0) - (e1[0] ?? 0) * (e2[2] ?? 0), (e1[0] ?? 0) * (e2[1] ?? 0) - (e1[1] ?? 0) * (e2[0] ?? 0)];
    const l = Math.hypot(...n) || 1;
    n = [n[0] / l, n[1] / l, n[2] / l];
    let order = v.map((_, i) => i);
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) {
      n = [-n[0], -n[1], -n[2]];
      order = order.reverse();
    }
    for (let i = 1; i + 1 < order.length; i++) {
      for (const k of [order[0], order[i], order[i + 1]] as number[]) {
        const p = v[k] as V3;
        const t = uv[k] as UV;
        this.pos.push(p[0], p[1], p[2]);
        this.nor.push(n[0], n[1], n[2]);
        this.uv.push(t[0], t[1]);
        this.col.push(color.r, color.g, color.b);
      }
    }
  }

  /** Ajoute une géométrie three.js (primitive) transformée, d'une couleur. */
  geometry(g: BufferGeometry, m: Matrix4, color: Color): void {
    const src = g.index ? g.toNonIndexed() : g;
    const p = src.getAttribute("position");
    const n = src.getAttribute("normal");
    const t = src.getAttribute("uv");
    const nm = new Matrix4().copy(m).invert().transpose();
    const v = new Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix4(nm).normalize();
      this.nor.push(v.x, v.y, v.z);
      this.uv.push(t ? t.getX(i) : 0, t ? t.getY(i) : 0);
      this.col.push(color.r, color.g, color.b);
    }
    if (src !== g) src.dispose();
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute("uv", new BufferAttribute(new Float32Array(this.uv), 2));
    g.setAttribute("color", new BufferAttribute(new Float32Array(this.col), 3));
    g.computeBoundingSphere();
    return g;
  }
}

const ROOF_COLORS = [new Color(0x5a636b), new Color(0x9a5236), new Color(0x6a3c2e)];
const WALL_TINTS = [new Color(0xffffff), new Color(0xf2efe8), new Color(0xffffff)];

interface Frame {
  x: number;
  y: number;
  cos: number;
  sin: number;
}
const frameOf = (b: Pick<Building, "x" | "y" | "angle">): Frame => ({ x: b.x, y: b.y, cos: Math.cos(b.angle), sin: Math.sin(b.angle) });
/** Point local (u le long de la façade, v dans la profondeur, y en hauteur) → monde (x, y, z). */
const P = (f: Frame, u: number, v: number, y: number): V3 => [f.x + u * f.cos - v * f.sin, y, f.y + u * f.sin + v * f.cos];
const dir = (f: Frame, u: number, v: number, y: number): V3 => [u * f.cos - v * f.sin, y, u * f.sin + v * f.cos];

/** Hauteur du toit en un point local (u, v), pour poser les cheminées. */
function roofHeightAt(b: Building, u: number, v: number): number {
  const H = b.floors * b.floorHeight;
  if (b.roof === "plat") return H;
  const rise = roofRise(b);
  const half = roofSpan(b) / 2;
  const alongU = b.roof === "croupe" ? b.width >= b.depth : b.ridgeAlongFront;
  const across = alongU ? Math.abs(v) : Math.abs(u);
  const along = alongU ? Math.abs(u) : Math.abs(v);
  let k = 1 - across / half;
  if (b.roof === "croupe") {
    const L = alongU ? b.width : b.depth;
    const r = Math.max(0, L / 2 - half);
    k = Math.min(k, 1 - Math.max(0, along - r) / half);
  }
  return H + rise * Math.max(0, k);
}

interface Builders {
  ground: FaceBuilder[];
  upper: FaceBuilder[];
  plain: FaceBuilder[];
  roof: FaceBuilder;
}

function addWalls(f: Frame, b: Building, out: Builders): void {
  const hw = b.width / 2;
  const hd = b.depth / 2;
  const fh = b.floorHeight;
  const H = b.floors * fh;
  const corners: [number, number][] = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  const tint = (WALL_TINTS[b.wall] ?? new Color(1, 1, 1)).clone().multiplyScalar(b.tint);
  for (let i = 0; i < 4; i++) {
    const [u0, v0] = corners[i] as [number, number];
    const [u1, v1] = corners[(i + 1) % 4] as [number, number];
    const bays = i % 2 === 0 ? b.bays : b.sideBays;
    const umax = bays / 4;
    const o = dir(f, (u0 + u1) / 2, (v0 + v1) / 2, 0);
    (out.ground[b.wall] as FaceBuilder).face([P(f, u0, v0, 0), P(f, u1, v1, 0), P(f, u1, v1, fh), P(f, u0, v0, fh)], [[0, 0], [umax, 0], [umax, 1], [0, 1]], tint, o);
    const vmax = (b.floors - 1) / 2;
    (out.upper[b.wall] as FaceBuilder).face([P(f, u0, v0, fh), P(f, u1, v1, fh), P(f, u1, v1, H), P(f, u0, v0, H)], [[0, 0], [umax, 0], [umax, vmax], [0, vmax]], tint, o);
  }
}

function addRoof(f: Frame, b: Building, out: Builders, rand: Rand): void {
  const H = b.floors * b.floorHeight;
  const color = (ROOF_COLORS[b.roofColor] ?? new Color(0x777777)).clone().multiplyScalar(range(rand, 0.85, 1.08));
  const plain = out.plain[b.wall] as FaceBuilder;
  const tint = new Color(1, 1, 1).multiplyScalar(b.tint);
  const hw = b.width / 2;
  const hd = b.depth / 2;
  const up: V3 = [0, 1, 0];
  const uvm = (x: number, y: number): UV => [x / 3.2, y / 3.2];
  if (b.roof === "plat") {
    // Toit-terrasse sombre et acrotère.
    out.roof.face([P(f, -hw, -hd, H + 0.05), P(f, hw, -hd, H + 0.05), P(f, hw, hd, H + 0.05), P(f, -hw, hd, H + 0.05)], [uvm(0, 0), uvm(b.width, 0), uvm(b.width, b.depth), uvm(0, b.depth)], new Color(0x4b4a46), up);
    const t = 0.35;
    const ph = 0.9;
    const ring: [number, number, number, number][] = [
      [-hw, -hd, hw, -hd + t],
      [-hw, hd - t, hw, hd],
      [-hw, -hd, -hw + t, hd],
      [hw - t, -hd, hw, hd],
    ];
    for (const [ua, va, ub, vb] of ring) addBox(plain, f, ua, va, ub, vb, H, H + ph, tint);
    return;
  }
  const rise = roofRise(b);
  const half = roofSpan(b) / 2;
  const e = 0.45;
  const drop = e * (rise / half);
  const He = H - drop;
  const alongU = b.roof === "croupe" ? b.width >= b.depth : b.ridgeAlongFront;
  // Repère du toit : r le long du faîtage, a en travers.
  const L = alongU ? b.width : b.depth;
  const R = (r: number, a: number, y: number): V3 => (alongU ? P(f, r, a, y) : P(f, a, r, y));
  const Rd = (r: number, a: number, y: number): V3 => (alongU ? dir(f, r, a, y) : dir(f, a, r, y));
  if (b.roof === "pignon") {
    const g = 0.35;
    for (const s of [-1, 1]) {
      const slope = Math.hypot(half + e, rise + drop);
      out.roof.face([R(-L / 2 - g, s * (half + e), He), R(L / 2 + g, s * (half + e), He), R(L / 2 + g, 0, H + rise), R(-L / 2 - g, 0, H + rise)], [uvm(0, 0), uvm(L + 2 * g, 0), uvm(L + 2 * g, slope), uvm(0, slope)], color, Rd(0, s, 1));
      // Pignon : triangle de mur aveugle.
      plain.face([R((s * L) / 2, -half, H), R((s * L) / 2, half, H), R((s * L) / 2, 0, H + rise)], [[0, 0], [(2 * half) / 6, 0], [half / 6, rise / 6]], tint, Rd(s, 0, 0));
    }
  } else {
    const r = Math.max(0, L / 2 - half);
    const slope = Math.hypot(half + e, rise + drop);
    for (const s of [-1, 1]) {
      // Longs pans (trapèzes) puis croupes (triangles).
      out.roof.face([R(-L / 2 - e, s * (half + e), He), R(L / 2 + e, s * (half + e), He), R(r, 0, H + rise), R(-r, 0, H + rise)], [uvm(0, 0), uvm(L + 2 * e, 0), uvm((L + 2 * e) / 2 + r, slope), uvm((L + 2 * e) / 2 - r, slope)], color, Rd(0, s, 1));
      out.roof.face([R(s * (L / 2 + e), -half - e, He), R(s * (L / 2 + e), half + e, He), R(s * r, 0, H + rise)], [uvm(0, 0), uvm(2 * (half + e), 0), uvm(half + e, slope)], color, Rd(s, 0, 1));
    }
  }
}

/** Boîte alignée sur le repère de la maison, de (ua, va) à (ub, vb), entre les hauteurs y0 et y1. */
function addBox(fb: FaceBuilder, f: Frame, ua: number, va: number, ub: number, vb: number, y0: number, y1: number, color: Color): void {
  const cu = (ua + ub) / 2;
  const cv = (va + vb) / 2;
  const s = 1 / 6;
  const q: [number, number][] = [
    [ua, va],
    [ub, va],
    [ub, vb],
    [ua, vb],
  ];
  for (let i = 0; i < 4; i++) {
    const [u0, v0] = q[i] as [number, number];
    const [u1, v1] = q[(i + 1) % 4] as [number, number];
    const w = Math.hypot(u1 - u0, v1 - v0);
    fb.face([P(f, u0, v0, y0), P(f, u1, v1, y0), P(f, u1, v1, y1), P(f, u0, v0, y1)], [[0, y0 * s], [w * s, y0 * s], [w * s, y1 * s], [0, y1 * s]], color, dir(f, (u0 + u1) / 2 - cu, (v0 + v1) / 2 - cv, 0));
  }
  fb.face([P(f, ua, va, y1), P(f, ub, va, y1), P(f, ub, vb, y1), P(f, ua, vb, y1)], [[0, 0], [(ub - ua) * s, 0], [(ub - ua) * s, (vb - va) * s], [0, (vb - va) * s]], color, [0, 1, 0]);
}

function addChimneys(f: Frame, b: Building, fb: FaceBuilder, rand: Rand): void {
  const brick = new Color(0x9a5a44).multiplyScalar(range(rand, 0.8, 1.05));
  const cap = new Color(0x6d6a63);
  for (const c of b.chimneys) {
    const base = roofHeightAt(b, c.u, c.v) - 0.4;
    const top = roofHeightAt(b, c.u, c.v) + c.height;
    addBox(fb, f, c.u - 0.35, c.v - 0.45, c.u + 0.35, c.v + 0.45, base, top, brick);
    addBox(fb, f, c.u - 0.48, c.v - 0.58, c.u + 0.48, c.v + 0.58, top, top + 0.14, cap);
  }
}

function polygonFace(fb: FaceBuilder, poly: readonly Vec2[], y: number, scale: number, color: Color): void {
  fb.face(
    poly.map((p) => [p.x, y, p.y] as V3),
    poly.map((p) => [p.x / scale, p.y / scale] as UV),
    color,
    [0, 1, 0],
  );
}

export interface TownMeshes {
  group: Group;
  /** Matériaux de façade : leur émission (fenêtres éclairées) suit l'heure. */
  windowMaterials: MeshStandardMaterial[];
  lanternMaterial: MeshStandardMaterial;
  /** Position des lanternes de réverbère (pour les lumières de nuit). */
  lamps: Vector3[];
  dispose(): void;
}

export function buildTownMeshes(town: Town, seed: number): TownMeshes {
  const rand = seeded(derive(seed, 3));
  const facades: FacadeSet[] = ([0, 1, 2] as WallKind[]).map((k) => facadeTextures(seed, k));
  const roofTex = roofTexture(seed);
  const textures: Texture[] = [...facades.flatMap((f) => [f.upper, f.upperLit, f.ground, f.groundLit, f.plain]), roofTex];
  const out: Builders = { ground: [0, 1, 2].map(() => new FaceBuilder()), upper: [0, 1, 2].map(() => new FaceBuilder()), plain: [0, 1, 2].map(() => new FaceBuilder()), roof: new FaceBuilder() };
  const chimneys = new FaceBuilder();
  for (const b of town.buildings) {
    const f = frameOf(b);
    addWalls(f, b, out);
    addRoof(f, b, out, rand);
    addChimneys(f, b, chimneys, rand);
  }

  const group = new Group();
  group.name = "ville";
  const materials: Material[] = [];
  const windowMaterials: MeshStandardMaterial[] = [];
  const add = (fb: FaceBuilder, mat: MeshStandardMaterial, name: string, shadows = true): void => {
    if (fb.pos.length === 0) return;
    const m = new Mesh(fb.build(), mat);
    m.name = name;
    m.castShadow = shadows;
    m.receiveShadow = true;
    group.add(m);
    materials.push(mat);
  };
  facades.forEach((fs, k) => {
    const up = new MeshStandardMaterial({ map: fs.upper, emissiveMap: fs.upperLit, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, roughness: 0.9 });
    const gr = new MeshStandardMaterial({ map: fs.ground, emissiveMap: fs.groundLit, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, roughness: 0.9 });
    windowMaterials.push(up, gr);
    add(out.upper[k] as FaceBuilder, up, `facades-etages-${k}`);
    add(out.ground[k] as FaceBuilder, gr, `facades-rdc-${k}`);
    add(out.plain[k] as FaceBuilder, new MeshStandardMaterial({ map: fs.plain, vertexColors: true, roughness: 0.92 }), `murs-aveugles-${k}`);
  });
  add(out.roof, new MeshStandardMaterial({ map: roofTex, vertexColors: true, roughness: 0.82, side: DoubleSide }), "toits");
  add(chimneys, new MeshStandardMaterial({ map: facades[2]?.plain ?? null, vertexColors: true, roughness: 0.95 }), "cheminees");

  // Sol : prairie, chaussée pavée de la ville, îlots dallés, place.
  const grass = grassTexture(seed);
  grass.repeat.set(140, 140);
  const cob = cobbleTexture(seed);
  const flag = flagTexture(seed);
  textures.push(grass, cob, flag);
  const field = new Mesh(new PlaneGeometry(2400, 2400), new MeshStandardMaterial({ map: grass, roughness: 1 }));
  field.rotation.x = -Math.PI / 2;
  field.receiveShadow = true;
  field.name = "prairie";
  group.add(field);
  materials.push(field.material);
  const bd = town.bounds;
  const pave = new FaceBuilder();
  const m = 6;
  polygonFace(pave, [{ x: bd.minX - m, y: bd.minY - m }, { x: bd.maxX + m, y: bd.minY - m }, { x: bd.maxX + m, y: bd.maxY + m }, { x: bd.minX - m, y: bd.maxY + m }], 0.04, 5, new Color(0xffffff));
  add(pave, new MeshStandardMaterial({ map: cob, vertexColors: true, roughness: 0.95 }), "chaussee", false);
  const yards = new FaceBuilder();
  for (const blk of town.blocks) polygonFace(yards, blk.inner, 0.14, blk.plaza ? 7 : 5, blk.plaza ? new Color(0xf4efe4) : new Color(0xc9c2b2));
  add(yards, new MeshStandardMaterial({ map: flag, vertexColors: true, roughness: 0.9 }), "ilots-et-place", false);

  // Place : fontaine, étals, arbres, réverbères.
  const props = new FaceBuilder();
  const foliage = new FaceBuilder();
  const lanterns = new FaceBuilder();
  const lamps: Vector3[] = [];
  const at = (x: number, y: number, z: number, rotY = 0, s: V3 = [1, 1, 1]): Matrix4 => new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rotY), new Vector3(...s));
  const stone = new Color(0xb9b2a2);
  const pc = town.plaza.center;
  props.geometry(new CylinderGeometry(4.6, 4.9, 0.9, 10), at(pc.x, 0.45, pc.y), stone);
  props.geometry(new CylinderGeometry(4.1, 4.1, 0.2, 10), at(pc.x, 0.8, pc.y), new Color(0x3f4c55));
  props.geometry(new CylinderGeometry(0.45, 0.6, 3.4, 8), at(pc.x, 2.1, pc.y), stone);
  props.geometry(new CylinderGeometry(1.4, 0.5, 0.6, 10), at(pc.x, 3.9, pc.y), stone);
  const stallColors = [new Color(0x4f6b5a), new Color(0x8a3b2a), new Color(0xb5873a), new Color(0x2a3a5c)];
  town.plaza.blocks.forEach((id, bi) => {
    const plaza = town.blocks[id];
    const bc = town.plaza.centers[bi] ?? pc;
    if (!plaza) return;
    plaza.inner.forEach((corner, i) => {
      const toC = { x: bc.x - corner.x, y: bc.y - corner.y };
      const l = Math.hypot(toC.x, toC.y) || 1;
      const tx = corner.x + (toC.x / l) * 6;
      const ty = corner.y + (toC.y / l) * 6;
      const rot = Math.atan2(toC.x, toC.y);
      // Étal : tréteaux, plateau, toile tendue inclinée.
      props.geometry(new CylinderGeometry(0.08, 0.08, 2.4, 5), at(tx - 1.2, 1.2, ty), new Color(0x5b4632));
      props.geometry(new CylinderGeometry(0.08, 0.08, 2.4, 5), at(tx + 1.2, 1.2, ty), new Color(0x5b4632));
      props.geometry(new ConeGeometry(2.2, 0.9, 4, 1), at(tx, 2.75, ty, rot + Math.PI / 4, [1.25, 1, 0.9]), stallColors[i % 4] as Color);
      props.geometry(new CylinderGeometry(1.5, 1.5, 0.12, 4), at(tx, 1.0, ty, rot + Math.PI / 4), new Color(0x7a6248));
      // Arbre de la place (au nord seulement : le marché du sud reste dégagé pour l'action).
      if (bi === 0) addTree(props, foliage, rand, corner.x + (toC.x / l) * 9, corner.y + (toC.y / l) * 9, at);
      // Réverbère.
      const lx = corner.x + (toC.x / l) * 2.2;
      const ly = corner.y + (toC.y / l) * 2.2;
      props.geometry(new CylinderGeometry(0.07, 0.11, 4.2, 6), at(lx, 2.1, ly), new Color(0x2d2c2a));
      lanterns.geometry(new CylinderGeometry(0.22, 0.16, 0.5, 6), at(lx, 4.45, ly), new Color(0xffffff));
      lamps.push(new Vector3(lx, 4.45, ly));
    });
  });
  // Réverbères le long des rues : un coin d'îlot sur deux.
  for (const blk of town.blocks) {
    if (blk.plaza) continue;
    blk.inner.forEach((c, i) => {
      if ((blk.id + i) % 2) return;
      const cx = blk.inner.reduce((s, p) => s + p.x, 0) / 4;
      const cy = blk.inner.reduce((s, p) => s + p.y, 0) / 4;
      const dx = c.x - cx;
      const dy = c.y - cy;
      const l = Math.hypot(dx, dy) || 1;
      const lx = c.x + (dx / l) * 1.2;
      const ly = c.y + (dy / l) * 1.2;
      props.geometry(new CylinderGeometry(0.07, 0.11, 4.2, 6), at(lx, 2.1, ly), new Color(0x2d2c2a));
      lanterns.geometry(new CylinderGeometry(0.22, 0.16, 0.5, 6), at(lx, 4.45, ly), new Color(0xffffff));
      lamps.push(new Vector3(lx, 4.45, ly));
    });
  }
  // Arbres hors de la ville (vergers, haies), sauf au nord où se dresse l'enceinte.
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2;
    const r = range(rand, 30, 260);
    const x = (Math.cos(a) > 0 ? bd.maxX : bd.minX) + Math.cos(a) * r;
    const y = (Math.sin(a) > 0 ? bd.maxY : bd.minY) + Math.sin(a) * r;
    if (y < town.wall.a.y + 20) continue;
    addTree(props, foliage, rand, x, y, at);
  }
  add(props, new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), "place-et-mobilier");
  add(foliage, new MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }), "feuillages");
  const lanternMaterial = new MeshStandardMaterial({ color: 0x3a3226, emissive: 0xffc070, emissiveIntensity: 0, roughness: 0.5 });
  add(lanterns, lanternMaterial, "lanternes", false);

  // Pan d'enceinte, au nord : 50 m [C], 10 m d'épaisseur [?], chemin de ronde.
  const wall = new FaceBuilder();
  const w = town.wall;
  const wf = frameOf({ x: (w.a.x + w.b.x) / 2, y: w.a.y, angle: 0 });
  const half = (w.b.x - w.a.x) / 2;
  const stoneWall = new Color(0xe2dccd);
  addBox(wall, wf, -half, -w.thickness / 2, half, w.thickness / 2, 0, w.height, stoneWall);
  // Garde-corps plein du chemin de ronde (pas de créneaux) et contreforts bas, côté ville.
  addBox(wall, wf, -half, w.thickness / 2 - 0.6, half, w.thickness / 2, w.height, w.height + 1.2, stoneWall);
  for (let x = -half + 20; x < half; x += 45) addBox(wall, wf, x, w.thickness / 2, x + 7, w.thickness / 2 + 5, 0, 14, stoneWall.clone().multiplyScalar(0.92));
  add(wall, new MeshStandardMaterial({ map: facades[1]?.plain ?? null, vertexColors: true, roughness: 0.95 }), "enceinte");

  return {
    group,
    windowMaterials,
    lanternMaterial,
    lamps,
    dispose(): void {
      group.traverse((o) => {
        if (o instanceof Mesh) (o.geometry as BufferGeometry).dispose();
      });
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}

function addTree(trunks: FaceBuilder, foliage: FaceBuilder, rand: Rand, x: number, y: number, at: (x: number, y: number, z: number, r?: number, s?: V3) => Matrix4): void {
  const h = range(rand, 5, 9);
  trunks.geometry(new CylinderGeometry(0.18, 0.3, h * 0.55, 6), at(x, h * 0.275, y), new Color(0x4a3a2a));
  const green = new Color().setHSL(range(rand, 0.17, 0.25), range(rand, 0.25, 0.4), range(rand, 0.22, 0.3));
  for (let k = 0; k < 3; k++) {
    const s = range(rand, 1.6, 2.6) * (h / 7);
    foliage.geometry(new IcosahedronGeometry(1, 1), at(x + range(rand, -1, 1), h * range(rand, 0.62, 0.85), y + range(rand, -1, 1), rand() * 3, [s, s * range(rand, 0.8, 1.1), s]), green.clone().multiplyScalar(range(rand, 0.85, 1.1)));
  }
}
