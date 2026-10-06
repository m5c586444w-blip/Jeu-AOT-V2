import { Color, ConeGeometry, CylinderGeometry, Matrix4, Quaternion, Vector3 } from "three";
import type { RoofMaterial, WallMaterial } from "../../data/artSchemas";
import type { Landmark, StyledBuilding } from "./envTypes";
import { range, seeded, derive } from "./rng";
import type { Rand } from "./rng";
import { phys } from "./meshProps";
import { FaceBuilder } from "./townMesh";
import { roofRise, roofSpan } from "./town";

/**
 * Maillage des bâtiments et des repères de R1b (R1b.3) : façades par matière (une texture de façade par matière et par profil),
 * toits par couverture, soubassement de pierre posé sur le relief, ruines (murs arasés en dents de scie, sans toit).
 * Les faces sont accumulées par matière dans des `FaceBuilder` : quelques appels de dessin pour toute une ville.
 * Couleur de sommet :
 * - avec textures (navigateur) : seulement la nuance claire/sombre, la teinte est dans la texture de façade ;
 * - sans textures (tests) : la teinte du profil, multipliée par la nuance.
 * Les toits ont une texture en niveaux de gris : la teinte du profil vient toujours du sommet.
 */
type V3 = [number, number, number];
type UV = [number, number];

export interface BuildingBuilders {
  /** Façades : rez-de-chaussée et étages par matière (fenêtres), murs aveugles. */
  ground: Map<WallMaterial, FaceBuilder>;
  upper: Map<WallMaterial, FaceBuilder>;
  plain: Map<WallMaterial, FaceBuilder>;
  roofs: Map<RoofMaterial, FaceBuilder>;
  /** Soubassements, cheminées, gravats : pierre en couleur de sommet. */
  stone: FaceBuilder;
  /** Pièces de bois (pans de colombage saillants, ailes de moulin, charpentes à nu). */
  wood: FaceBuilder;
  /** Verre et ouvertures sombres (rosaces, baies de clocher). */
  dark: FaceBuilder;
}

export function emptyBuilders(): BuildingBuilders {
  return { ground: new Map(), upper: new Map(), plain: new Map(), roofs: new Map(), stone: new FaceBuilder(), wood: new FaceBuilder(), dark: new FaceBuilder() };
}

const get = <K>(m: Map<K, FaceBuilder>, k: K): FaceBuilder => {
  let fb = m.get(k);
  if (!fb) {
    fb = new FaceBuilder();
    m.set(k, fb);
  }
  return fb;
};

interface Frame {
  x: number;
  y: number;
  cos: number;
  sin: number;
  base: number;
}
const P = (f: Frame, u: number, v: number, y: number): V3 => [f.x + u * f.cos - v * f.sin, f.base + y, f.y + u * f.sin + v * f.cos];
const D = (f: Frame, u: number, v: number, y: number): V3 => [u * f.cos - v * f.sin, y, u * f.sin + v * f.cos];

export const hexColor = (hex: string): Color => new Color(hex);

/** Teinte de sommet d'une façade : nuance seule avec texture, teinte × nuance sans. */
function wallTint(hex: string, tint: number, textured: boolean): Color {
  return textured ? new Color(tint, tint, tint) : new Color(hex).multiplyScalar(tint);
}

/** Boîte alignée sur le repère, de (ua, va) à (ub, vb), entre y0 et y1 (au-dessus de la base). */
export function frameBox(fb: FaceBuilder, f: Frame, ua: number, va: number, ub: number, vb: number, y0: number, y1: number, color: Color, top = true, uvScale = 1 / 3): void {
  const q: [number, number][] = [
    [ua, va],
    [ub, va],
    [ub, vb],
    [ua, vb],
  ];
  const cu = (ua + ub) / 2;
  const cv = (va + vb) / 2;
  for (let i = 0; i < 4; i++) {
    const [u0, v0] = q[i] as [number, number];
    const [u1, v1] = q[(i + 1) % 4] as [number, number];
    const w = Math.hypot(u1 - u0, v1 - v0);
    fb.face([P(f, u0, v0, y0), P(f, u1, v1, y0), P(f, u1, v1, y1), P(f, u0, v0, y1)], [[0, y0 * uvScale], [w * uvScale, y0 * uvScale], [w * uvScale, y1 * uvScale], [0, y1 * uvScale]], color, D(f, (u0 + u1) / 2 - cu, (v0 + v1) / 2 - cv, 0));
  }
  if (top) fb.face([P(f, ua, va, y1), P(f, ub, va, y1), P(f, ub, vb, y1), P(f, ua, vb, y1)], [[0, 0], [(ub - ua) * uvScale, 0], [(ub - ua) * uvScale, (vb - va) * uvScale], [0, (vb - va) * uvScale]], color, [0, 1, 0]);
}

/** Toit à deux pans ou en croupe sur un rectangle (repère du bâtiment), du haut des murs `H` ; renvoie la hauteur du faîtage. */
export function addRoofShape(fb: FaceBuilder, gable: FaceBuilder | null, f: Frame, w: number, d: number, H: number, kind: "pignon" | "croupe" | "plat", pitch: number, ridgeAlongFront: boolean, color: Color, gableColor: Color, eave = 0.45): number {
  const uvm = (x: number, y: number): UV => [x / 3.2, y / 3.2];
  const hw = w / 2;
  const hd = d / 2;
  if (kind === "plat") {
    fb.face([P(f, -hw, -hd, H + 0.05), P(f, hw, -hd, H + 0.05), P(f, hw, hd, H + 0.05), P(f, -hw, hd, H + 0.05)], [uvm(0, 0), uvm(w, 0), uvm(w, d), uvm(0, d)], color, [0, 1, 0]);
    return H + 0.05;
  }
  const b = { roof: kind, width: w, depth: d, ridgeAlongFront, pitch } as const;
  const rise = roofRise(b);
  const half = roofSpan(b) / 2;
  const e = eave;
  const drop = e * (rise / half);
  const He = H - drop;
  const alongU = kind === "croupe" ? w >= d : ridgeAlongFront;
  const L = alongU ? w : d;
  const R = (r: number, a: number, y: number): V3 => (alongU ? P(f, r, a, y) : P(f, a, r, y));
  const Rd = (r: number, a: number, y: number): V3 => (alongU ? D(f, r, a, y) : D(f, a, r, y));
  const slope = Math.hypot(half + e, rise + drop);
  if (kind === "pignon") {
    const g = 0.35;
    for (const s of [-1, 1]) {
      fb.face([R(-L / 2 - g, s * (half + e), He), R(L / 2 + g, s * (half + e), He), R(L / 2 + g, 0, H + rise), R(-L / 2 - g, 0, H + rise)], [uvm(0, 0), uvm(L + 2 * g, 0), uvm(L + 2 * g, slope), uvm(0, slope)], color, Rd(0, s, 1));
      if (gable) gable.face([R((s * L) / 2, -half, H), R((s * L) / 2, half, H), R((s * L) / 2, 0, H + rise)], [[0, 0], [(2 * half) / 6, 0], [half / 6, rise / 6]], gableColor, Rd(s, 0, 0));
    }
  } else {
    const r = Math.max(0, L / 2 - half);
    for (const s of [-1, 1]) {
      fb.face([R(-L / 2 - e, s * (half + e), He), R(L / 2 + e, s * (half + e), He), R(r, 0, H + rise), R(-r, 0, H + rise)], [uvm(0, 0), uvm(L + 2 * e, 0), uvm((L + 2 * e) / 2 + r, slope), uvm((L + 2 * e) / 2 - r, slope)], color, Rd(0, s, 1));
      fb.face([R(s * (L / 2 + e), -half - e, He), R(s * (L / 2 + e), half + e, He), R(s * r, 0, H + rise)], [uvm(0, 0), uvm(2 * (half + e), 0), uvm(half + e, slope)], color, Rd(s, 0, 1));
    }
  }
  return H + rise;
}

/** Murs à fenêtres (rez-de-chaussée et étages), arasés en dents de scie pour une ruine. */
function addWalls(out: BuildingBuilders, f: Frame, b: StyledBuilding, textured: boolean, rand: Rand): void {
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
  const tint = wallTint(b.wallHex, b.tint, textured);
  for (let i = 0; i < 4; i++) {
    const [u0, v0] = corners[i] as [number, number];
    const [u1, v1] = corners[(i + 1) % 4] as [number, number];
    const bays = i % 2 === 0 ? b.bays : b.sideBays;
    const umax = bays / 4;
    const o = D(f, (u0 + u1) / 2, (v0 + v1) / 2, 0);
    // Ruine : chaque pan s'arrête à une hauteur propre ; un pan sur trois est tombé jusqu'au rez-de-chaussée.
    const top = b.ruin > 0.55 ? (rand() < 0.3 ? fh * range(rand, 0.4, 1) : H * range(rand, 0.35, 0.85)) : H;
    const g = Math.min(fh, top);
    get(out.ground, b.material).face([P(f, u0, v0, 0), P(f, u1, v1, 0), P(f, u1, v1, g), P(f, u0, v0, g)], [[0, 0], [umax, 0], [umax, g / fh], [0, g / fh]], tint, o);
    if (top > fh) {
      const vmax = (top - fh) / fh / 2;
      get(out.upper, b.material).face([P(f, u0, v0, fh), P(f, u1, v1, fh), P(f, u1, v1, top), P(f, u0, v0, top)], [[0, 0], [umax, 0], [umax, vmax], [0, vmax]], tint, o);
    }
    if (b.ruin > 0.55) {
      // Ruine sans toit : l'intérieur des murs se voit (face intérieure, plus sombre), sinon l'arase flotte seule.
      // Décalée de l'épaisseur du mur vers l'intérieur (la pierre est à deux faces : pas de face confondue avec la façade).
      const inner = new Color(b.stoneHex).multiplyScalar(0.7);
      const ol = Math.hypot(o[0], o[2]) || 1;
      const inset = (q: V3): V3 => [q[0] - (o[0] / ol) * 0.4, q[1], q[2] - (o[2] / ol) * 0.4];
      out.stone.face([inset(P(f, u0, v0, 0)), inset(P(f, u1, v1, 0)), inset(P(f, u1, v1, top)), inset(P(f, u0, v0, top))], [[0, 0], [umax, 0], [umax, top / fh], [0, top / fh]], inner, [-o[0], -o[1], -o[2]]);
      // Arase du mur (épaisseur visible) et poutres calcinées.
      const t = 0.45;
      const n = D(f, (u0 + u1) / 2, (v0 + v1) / 2, 0);
      const l = Math.hypot(n[0], n[2]) || 1;
      const nx = (n[0] / l) * t;
      const nz = (n[2] / l) * t;
      const a = P(f, u0, v0, top);
      const c = P(f, u1, v1, top);
      out.stone.face([a, c, [c[0] - nx, c[1], c[2] - nz], [a[0] - nx, a[1], a[2] - nz]], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]], new Color(b.stoneHex).multiplyScalar(0.8), [0, 1, 0]);
    }
  }
}

function addPlinth(out: BuildingBuilders, f: Frame, w: number, d: number, plinth: number, hex: string): void {
  if (plinth <= 0.05) return;
  frameBox(out.stone, f, -w / 2 - 0.12, -d / 2 - 0.12, w / 2 + 0.12, d / 2 + 0.12, -plinth, 0.35, new Color(hex).multiplyScalar(0.92), true, 1 / 2);
}

function addChimneys(out: BuildingBuilders, f: Frame, b: StyledBuilding, rand: Rand): void {
  if (b.ruin > 0.3 || b.cover === "chaume" || b.cover === "aucun") return;
  const H = b.floors * b.floorHeight;
  const rise = b.roof === "plat" ? 0 : roofRise(b);
  const brick = new Color(b.stoneHex).multiplyScalar(range(rand, 0.75, 0.95));
  for (const c of b.chimneys.slice(0, 2)) {
    const top = H + rise * 0.8 + c.height;
    frameBox(out.stone, f, c.u - 0.35, c.v - 0.45, c.u + 0.35, c.v + 0.45, H - 0.4, top, brick);
  }
}

/** Ajoute une maison stylée. */
export function addBuilding(out: BuildingBuilders, b: StyledBuilding, textured: boolean, seed: number): void {
  const rand = seeded(derive(seed, 9000 + b.id));
  const f: Frame = { x: b.x, y: b.y, cos: Math.cos(b.angle), sin: Math.sin(b.angle), base: b.base };
  addPlinth(out, f, b.width, b.depth, b.plinth, b.stoneHex);
  addWalls(out, f, b, textured, rand);
  if (b.cover !== "aucun" && b.ruin <= 0.55) {
    const H = b.floors * b.floorHeight;
    const roofTint = new Color(b.roofHex).multiplyScalar(range(rand, 0.86, 1.06));
    const gableTint = wallTint(b.wallHex, b.tint, textured);
    addRoofShape(get(out.roofs, b.cover), get(out.plain, b.material), f, b.width, b.depth, H, b.roof, b.pitch, b.ridgeAlongFront, roofTint, gableTint, b.cover === "chaume" ? 0.8 : 0.45);
    if (b.roof === "plat") {
      const ring = 0.35;
      const g = get(out.plain, b.material);
      for (const [ua, va, ub, vb] of [
        [-b.width / 2, -b.depth / 2, b.width / 2, -b.depth / 2 + ring],
        [-b.width / 2, b.depth / 2 - ring, b.width / 2, b.depth / 2],
        [-b.width / 2, -b.depth / 2, -b.width / 2 + ring, b.depth / 2],
        [b.width / 2 - ring, -b.depth / 2, b.width / 2, b.depth / 2],
      ] as const)
        frameBox(g, f, ua, va, ub, vb, H, H + 0.9, gableTint);
    }
    addChimneys(out, f, b, rand);
  }
}

// ——— Repères ———

const mat4 = (x: number, y: number, z: number, rotY = 0, s: V3 = [1, 1, 1]): Matrix4 => new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rotY), new Vector3(...s));

/** Corps de bâtiment d'un repère : murs à fenêtres (comme une maison) et toit. */
function hall(out: BuildingBuilders, l: Landmark, f: Frame, w: number, d: number, floors: number, fh: number, roof: "pignon" | "croupe" | "plat", pitch: number, textured: boolean, along = true, id = 0): number {
  const b: StyledBuilding = {
    id,
    block: -1,
    x: f.x,
    y: f.y,
    angle: Math.atan2(f.sin, f.cos),
    width: w,
    depth: d,
    floors,
    floorHeight: fh,
    roof,
    pitch,
    ridgeAlongFront: along,
    wall: 1,
    roofColor: 1,
    tint: 1,
    chimneys: [],
    bays: Math.max(1, Math.round(w / 3.6)),
    sideBays: Math.max(1, Math.round(d / 3.6)),
    material: l.material,
    cover: l.cover,
    wallHex: l.wallHex,
    roofHex: l.roofHex,
    trimHex: l.trimHex,
    stoneHex: l.stoneHex,
    ruin: l.ruin,
    base: f.base,
    plinth: 0.8,
  };
  addBuilding(out, b, textured, id);
  return floors * fh;
}

/** Flèche ou toit en pyramide sur une tour carrée de côté `s`, à partir de `y0`. */
function spire(out: BuildingBuilders, cover: RoofMaterial, f: Frame, u: number, v: number, s: number, y0: number, h: number, color: Color): void {
  const fb = get(out.roofs, cover === "aucun" ? "ardoise" : cover);
  const c = P(f, u, v, 0);
  fb.geometry(new ConeGeometry(s * 0.72, h, 4, 1, true), mat4(c[0], f.base + y0 + h / 2, c[2], Math.atan2(f.sin, f.cos) + Math.PI / 4), color);
}

/** Tour carrée (clocher, tour de château) : fût à fenêtres, baies sombres, flèche. */
function tower(out: BuildingBuilders, l: Landmark, f: Frame, u: number, v: number, s: number, h: number, spireH: number, textured: boolean, id: number): void {
  const fc: Frame = { ...f, x: f.x + u * f.cos - v * f.sin, y: f.y + u * f.sin + v * f.cos };
  const floors = Math.max(2, Math.round(h / 4.2));
  hall(out, l, fc, s, s, floors, h / floors, "plat", 0, textured, true, id);
  // Baies du beffroi.
  for (const [du, dv] of [
    [0, s / 2 + 0.02],
    [0, -s / 2 - 0.02],
  ] as const) {
    const a = P(fc, du - s * 0.18, dv, h - 3.6);
    const b = P(fc, du + s * 0.18, dv, h - 3.6);
    const c = P(fc, du + s * 0.18, dv, h - 1.2);
    const d2 = P(fc, du - s * 0.18, dv, h - 1.2);
    out.dark.face([a, b, c, d2], [[0, 0], [1, 0], [1, 1], [0, 1]], phys("verre"), D(fc, 0, dv, 0));
  }
  if (spireH > 0 && l.ruin < 0.6) spire(out, l.cover, fc, 0, 0, s, h, spireH, new Color(l.roofHex));
}

/** Ajoute un repère (église, cathédrale, palais, moulin…). */
export function addLandmark(out: BuildingBuilders, l: Landmark, textured: boolean, seed: number): void {
  const rand = seeded(derive(seed, 7000 + Math.round(l.x * 7 + l.y * 13)));
  const f: Frame = { x: l.x, y: l.y, cos: Math.cos(l.angle), sin: Math.sin(l.angle), base: l.base };
  const id = 50000 + Math.abs(Math.round(l.x * 3 + l.y * 5)) % 40000;
  const pitch = (l.cover === "ardoise" ? 50 : l.cover === "chaume" ? 50 : 38) * (Math.PI / 180);
  const roofC = new Color(l.roofHex);
  switch (l.kind) {
    case "chapelle":
    case "eglise": {
      // Nef (le long de v), clocher sur la façade (côté +v), chevet.
      const big = l.kind === "eglise";
      const nave = hall(out, l, f, l.w, l.d, 1, l.h, "pignon", pitch, textured, false, id);
      const ts = big ? l.w * 0.55 : l.w * 0.42;
      tower(out, l, f, 0, l.d / 2 + ts / 2 - 0.2, ts, nave + (big ? 14 : 6), big ? 14 : 7, textured, id + 1);
      const apse: Frame = { ...f, x: f.x - (-l.d / 2) * f.sin, y: f.y + (-l.d / 2) * f.cos };
      hall(out, l, apse, l.w * 0.7, l.w * 0.5, 1, l.h * 0.8, "croupe", pitch, textured, true, id + 2);
      break;
    }
    case "cathedrale": {
      // Nef haute, bas-côtés, transept, deux tours de façade à flèches, contreforts.
      const nave = hall(out, l, f, l.w * 0.45, l.d, 1, l.h, "pignon", (55 * Math.PI) / 180, textured, false, id);
      for (const s of [-1, 1]) {
        const aisle: Frame = { ...f, x: f.x + s * l.w * 0.34 * f.cos, y: f.y + s * l.w * 0.34 * f.sin };
        hall(out, l, aisle, l.w * 0.24, l.d * 0.9, 1, l.h * 0.55, "plat", 0, textured, false, id + 3 + s);
        // Arcs-boutants : piles et volées obliques.
        for (let k = -3; k <= 3; k++) {
          const v = (k / 3.5) * l.d * 0.42;
          frameBox(out.stone, f, s * l.w * 0.47 - 0.7, v - 0.7, s * l.w * 0.47 + 0.7, v + 0.7, 0, l.h * 0.62, new Color(l.stoneHex));
          const a = P(f, s * l.w * 0.47, v, l.h * 0.62);
          const b = P(f, s * l.w * 0.23, v, l.h * 0.9);
          out.stone.face([a, [a[0], a[1] + 1.2, a[2]], [b[0], b[1] + 1.2, b[2]], b], [[0, 0], [1, 0], [1, 1], [0, 1]], new Color(l.stoneHex), D(f, 0, 1, 0));
        }
      }
      const transept: Frame = { ...f, x: f.x - (-l.d * 0.12) * f.sin, y: f.y + (-l.d * 0.12) * f.cos };
      hall(out, l, transept, l.w * 1.05, l.w * 0.3, 1, l.h * 0.92, "pignon", (55 * Math.PI) / 180, textured, true, id + 6);
      for (const s of [-1, 1]) tower(out, l, f, s * l.w * 0.2, l.d / 2 + 3, l.w * 0.22, nave + 16, 26, textured, id + 7 + s);
      // Rosace : disque sombre sur le pignon de façade.
      const rc = P(f, 0, l.d / 2 + 0.08, l.h * 0.72);
      const rose = new Matrix4().makeTranslation(rc[0], rc[1], rc[2]).multiply(new Matrix4().makeRotationY(-Math.atan2(f.sin, f.cos))).multiply(new Matrix4().makeRotationX(Math.PI / 2));
      out.dark.geometry(new CylinderGeometry(l.w * 0.1, l.w * 0.1, 0.1, 16), rose, phys("vitrail"));
      // Flèche de croisée.
      spire(out, l.cover, f, 0, -l.d * 0.12, 4, nave + l.h * 0.15, 22, roofC);
      break;
    }
    case "palais": {
      // Corps central à fronton, deux ailes en retour sur une cour d'honneur, pavillons d'angle.
      hall(out, l, f, l.w, l.d * 0.32, 3, 5, "croupe", (40 * Math.PI) / 180, textured, true, id);
      for (const s of [-1, 1]) {
        const wing: Frame = { ...f, x: f.x + s * (l.w / 2 - l.w * 0.09) * f.cos - (l.d * 0.34) * f.sin, y: f.y + s * (l.w / 2 - l.w * 0.09) * f.sin + (l.d * 0.34) * f.cos };
        hall(out, l, wing, l.w * 0.18, l.d * 0.7, 2, 5, "croupe", (40 * Math.PI) / 180, textured, false, id + 2 + s);
      }
      const dome: Frame = { ...f };
      frameBox(out.stone, dome, -5, -5, 5, 5, 15, 20, new Color(l.stoneHex));
      get(out.roofs, l.cover === "aucun" ? "ardoise" : l.cover).geometry(new ConeGeometry(7, 8, 8), mat4(f.x, f.base + 24, f.y), roofC);
      break;
    }
    case "caserne":
    case "ecurie": {
      // Longs bâtiments autour d'une cour.
      const floors = l.kind === "caserne" ? 3 : 1;
      for (const [du, dv, w, d, along] of [
        [0, -l.d / 2 + 6, l.w, 12, true],
        [0, l.d / 2 - 6, l.w, 12, true],
        [-l.w / 2 + 6, 0, 12, l.d - 24, false],
      ] as const) {
        const fr: Frame = { ...f, x: f.x + du * f.cos - dv * f.sin, y: f.y + du * f.sin + dv * f.cos };
        hall(out, l, fr, along ? w : w, along ? d : d, floors, 3.4, "croupe", pitch, textured, along, id + Math.round(du + dv));
      }
      break;
    }
    case "halle": {
      // Grande halle de marché : toit sur piliers.
      for (let i = -2; i <= 2; i++) for (const s of [-1, 1]) frameBox(out.stone, f, i * (l.w / 5) - 0.4, s * (l.d / 2 - 0.5) - 0.4, i * (l.w / 5) + 0.4, s * (l.d / 2 - 0.5) + 0.4, 0, l.h, new Color(l.stoneHex));
      addRoofShape(get(out.roofs, l.cover === "aucun" ? "tuiles_rouges" : l.cover), null, f, l.w, l.d, l.h, "croupe", pitch, true, roofC, roofC, 1);
      break;
    }
    case "edifice": {
      // Grand édifice de pierre : bloc massif, portique, tour d'horloge centrale.
      const H = hall(out, l, f, l.w, l.d, 4, 5, "croupe", (32 * Math.PI) / 180, textured, true, id);
      for (let k = -3; k <= 3; k++) frameBox(out.stone, f, k * (l.w / 9) - 0.6, l.d / 2 + 2, k * (l.w / 9) + 0.6, l.d / 2 + 3.2, 0, 12, new Color(l.stoneHex));
      frameBox(out.stone, f, -l.w * 0.4, l.d / 2, l.w * 0.4, l.d / 2 + 4, 12, 13.4, new Color(l.stoneHex));
      tower(out, l, f, 0, 0, 9, H + 14, 8, textured, id + 9);
      break;
    }
    case "moulin": {
      // Tour de pierre tronconique, calotte, quatre ailes de bois.
      const fbS = get(out.plain, l.material);
      fbS.geometry(new CylinderGeometry(l.w * 0.36, l.w * 0.5, l.h, 12, 1, true), mat4(f.x, f.base + l.h / 2, f.y), textured ? new Color(1, 1, 1) : new Color(l.wallHex));
      get(out.roofs, l.cover === "aucun" ? "chaume" : l.cover).geometry(new ConeGeometry(l.w * 0.45, 3.2, 12), mat4(f.x, f.base + l.h + 1.6, f.y), roofC);
      if (l.ruin < 0.6) {
        const hub = P(f, 0, l.w * 0.45, l.h - 0.5);
        const a0 = rand() * Math.PI;
        for (let k = 0; k < 4; k++) {
          const a = a0 + (k * Math.PI) / 2;
          const m = new Matrix4().makeTranslation(hub[0], hub[1], hub[2]).multiply(new Matrix4().makeRotationY(l.angle)).multiply(new Matrix4().makeRotationZ(a)).multiply(new Matrix4().makeTranslation(0, 5.5, 0)).multiply(new Matrix4().makeScale(1.4, 11, 0.12));
          out.wood.geometry(new CylinderGeometry(0.5, 0.5, 1, 4), m, new Color(l.trimHex).multiplyScalar(1.1));
        }
      }
      break;
    }
    case "chateau": {
      // Enceinte de pierre crénelée, tours d'angle rondes, châtelet d'entrée (côté +v), logis contre la courtine du fond.
      const stone = wallTint(l.wallHex, 1, textured);
      const fb = get(out.plain, l.material);
      const t = 3;
      const sides: [number, number, number, number][] = [
        [-l.w / 2, -l.d / 2, l.w / 2, -l.d / 2],
        [l.w / 2, -l.d / 2, l.w / 2, l.d / 2],
        [l.w / 2, l.d / 2, -l.w / 2, l.d / 2],
        [-l.w / 2, l.d / 2, -l.w / 2, -l.d / 2],
      ];
      for (const [ua, va, ub, vb] of sides) {
        const len = Math.hypot(ub - ua, vb - va);
        const n = Math.max(2, Math.round(len / 9));
        for (let k = 0; k < n; k++) {
          const a = k / n;
          const b = (k + 1) / n;
          // Ruine : pans arasés à des hauteurs diverses, quelques pans tombés.
          if (l.ruin > 0.6 && rand() < 0.22) continue;
          const top = l.ruin > 0.3 ? l.h * (l.ruin > 0.6 ? range(rand, 0.25, 0.9) : range(rand, 0.8, 1)) : l.h;
          const u0 = ua + (ub - ua) * a;
          const v0 = va + (vb - va) * a;
          const u1 = ua + (ub - ua) * b;
          const v1 = va + (vb - va) * b;
          frameBox(fb, f, Math.min(u0, u1) - t / 2, Math.min(v0, v1) - t / 2, Math.max(u0, u1) + t / 2, Math.max(v0, v1) + t / 2, -1, top, stone);
          if (top > l.h * 0.97) {
            const m = Math.max(1, Math.floor((len / n) / 2.4));
            for (let j = 0; j < m; j += 1) {
              const c = (j + 0.5) / m;
              const uu = u0 + (u1 - u0) * c;
              const vv = v0 + (v1 - v0) * c;
              frameBox(fb, f, uu - 0.6, vv - 0.6, uu + 0.6, vv + 0.6, top, top + 1.4, stone);
            }
          }
        }
      }
      for (const [u, v] of [
        [-l.w / 2, -l.d / 2],
        [l.w / 2, -l.d / 2],
        [l.w / 2, l.d / 2],
        [-l.w / 2, l.d / 2],
        [-6, l.d / 2 + 1],
        [6, l.d / 2 + 1],
      ] as const) {
        const c = P(f, u, v, 0);
        const r = Math.abs(u) < 10 ? 3.6 : 5.2;
        const th = l.ruin > 0.6 ? l.h * range(rand, 0.5, 1.2) : l.h + 7;
        fb.geometry(new CylinderGeometry(r, r * 1.08, th + 1, 14, 1, true), mat4(c[0], f.base + th / 2 - 0.5, c[2]), stone);
        out.stone.geometry(new CylinderGeometry(r, r, 0.3, 14), mat4(c[0], f.base + th - 0.15, c[2]), new Color(l.stoneHex).multiplyScalar(0.8));
        if (l.cover !== "aucun" && l.ruin < 0.6) get(out.roofs, l.cover).geometry(new ConeGeometry(r * 1.15, r * 1.9, 14, 1, true), mat4(c[0], f.base + th + r * 0.95, c[2]), roofC);
      }
      // Porte du châtelet : ouverture sombre.
      const g0 = P(f, -2.4, l.d / 2 + t / 2 + 0.05, 0);
      const g1 = P(f, 2.4, l.d / 2 + t / 2 + 0.05, 0);
      out.dark.face([g0, g1, [g1[0], g1[1] + 6, g1[2]], [g0[0], g0[1] + 6, g0[2]]], [[0, 0], [1, 0], [1, 1], [0, 1]], phys("suie"), D(f, 0, 1, 0));
      const logis: Frame = { ...f, x: f.x - (-l.d / 2 + 9) * f.sin, y: f.y + (-l.d / 2 + 9) * f.cos };
      hall(out, { ...l, ruin: Math.max(l.ruin, l.ruin > 0.6 ? 0.8 : 0) }, logis, l.w * 0.55, 12, 2, 4.5, "pignon", pitch, textured, true, id + 11);
      break;
    }
    case "donjon": {
      // Tour maîtresse carrée, à étages ; couronnement crénelé ; arasée en dents de scie si elle est ruinée.
      const H = hall(out, l, f, l.w, l.d, Math.max(3, Math.round(l.h / 5)), l.h / Math.max(3, Math.round(l.h / 5)), "plat", 0, textured, true, id);
      if (l.ruin <= 0.55) {
        const stone = wallTint(l.wallHex, 1, textured);
        const fb = get(out.plain, l.material);
        const m = Math.max(3, Math.round(l.w / 2.4));
        for (let k = 0; k < m; k++) {
          const a = -l.w / 2 + (k + 0.5) * (l.w / m);
          for (const [u, v] of [
            [a, -l.d / 2],
            [a, l.d / 2],
            [-l.w / 2, a],
            [l.w / 2, a],
          ] as const)
            frameBox(fb, f, u - 0.55, v - 0.55, u + 0.55, v + 0.55, H + 0.9, H + 2.4, stone);
        }
      }
      break;
    }
    case "usine": {
      // Halle de fabrique : murs de brique ou de pierre, toit en sheds (pans vitrés au nord).
      const H = hall(out, l, f, l.w, l.d, 2, l.h / 2, "plat", 0, textured, true, id);
      const teeth = Math.max(2, Math.round(l.w / 6));
      const step = l.w / teeth;
      const rise = 3.4;
      const fb = get(out.roofs, l.cover === "aucun" ? "ardoise" : l.cover);
      const side = wallTint(l.wallHex, 0.9, textured);
      const gable = get(out.plain, l.material);
      for (let k = 0; k < teeth; k++) {
        const u0 = -l.w / 2 + k * step;
        const u1 = u0 + step;
        const y0 = H + 0.9;
        fb.face([P(f, u0, -l.d / 2, y0), P(f, u0, l.d / 2, y0), P(f, u1, l.d / 2, y0 + rise), P(f, u1, -l.d / 2, y0 + rise)], [[0, 0], [l.d / 3.2, 0], [l.d / 3.2, step / 3.2], [0, step / 3.2]], roofC, D(f, -rise, 0, step));
        out.dark.face([P(f, u1, l.d / 2, y0), P(f, u1, -l.d / 2, y0), P(f, u1, -l.d / 2, y0 + rise), P(f, u1, l.d / 2, y0 + rise)], [[0, 0], [1, 0], [1, 1], [0, 1]], phys("verre"), D(f, 1, 0, 0));
        for (const s of [-1, 1]) gable.face([P(f, u0, (s * l.d) / 2, y0), P(f, u1, (s * l.d) / 2, y0), P(f, u1, (s * l.d) / 2, y0 + rise)], [[0, 0], [step / 6, 0], [step / 6, rise / 6]], side, D(f, 0, s, 0));
      }
      break;
    }
    case "autel": {
      // Autel de pierre : socle, table débordante, gradin.
      const c = new Color(l.stoneHex);
      frameBox(out.stone, f, -l.w / 2 - 1, -l.d / 2 - 1, l.w / 2 + 1, l.d / 2 + 1, 0, 0.3, c.clone().multiplyScalar(0.85));
      frameBox(out.stone, f, -l.w / 2 + 0.3, -l.d / 2 + 0.3, l.w / 2 - 0.3, l.d / 2 - 0.3, 0.3, l.h - 0.2, c);
      frameBox(out.stone, f, -l.w / 2, -l.d / 2, l.w / 2, l.d / 2, l.h - 0.2, l.h, c.clone().multiplyScalar(1.08));
      frameBox(out.stone, f, -l.w / 2 + 0.6, -l.d / 2 + 0.2, l.w / 2 - 0.6, -l.d / 2 + 0.9, l.h, l.h + 0.5, c.clone().multiplyScalar(0.95));
      break;
    }
    default: {
      hall(out, l, f, l.w, l.d, Math.max(1, Math.round(l.h / 4)), l.h / Math.max(1, Math.round(l.h / 4)), "croupe", pitch, textured, true, id);
    }
  }
}
