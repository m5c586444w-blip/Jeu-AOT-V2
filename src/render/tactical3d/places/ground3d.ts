import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, ShapeUtils, Vector2, Vector3 } from "three";
import type { Material, Texture } from "three";
import type { Culture, Place } from "../../../data/placeSchema";
import { tagPhoto } from "../photoTextures";
import { grassTexture } from "../textures";
import { waterNormalTex } from "../texturesEnv";
import type { P2, Poly2 } from "./geom";
import { add, along, left, mul, polylineLength, rad, sub, unit } from "./geom";
import type { PlaceLayout } from "./layout";
import { pavingTexture } from "./textures";

/**
 * Sol d'un lieu (R1e) : prairie autour, chaussées (rubans le long des rues, par revêtement), places, cours d'îlots (pelouse,
 * potager, dalles), parcs, vergers, canaux en creux avec quais de pierre, ponts. Géométries fusionnées par matériau
 * (statique) ; coordonnées de texture en mètres du plan (aucune couture d'un ruban à l'autre).
 */
const PAVE_M = 4;
/** Pas de la grille qui recoupe les surfaces du sol (m). */
const GRID_M = 64;

/** Polygone convexe coupé par le demi-plan `côté * (p[axe] - v) >= 0` (Sutherland–Hodgman). */
function clipAxis(poly: P2[], axis: 0 | 1, v: number, side: 1 | -1): P2[] {
  const out: P2[] = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k] as P2;
    const b = poly[(k + 1) % poly.length] as P2;
    const da = side * (a[axis] - v);
    const db = side * (b[axis] - v);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** Morceaux (polygones convexes) d'un triangle dans chaque case de la grille qu'il touche. */
function clipToGrid(tri: P2[], cell: number): P2[][] {
  const xs = tri.map((p) => p[0]);
  const ys = tri.map((p) => p[1]);
  const i0 = Math.floor(Math.min(...xs) / cell);
  const i1 = Math.ceil(Math.max(...xs) / cell);
  const j0 = Math.floor(Math.min(...ys) / cell);
  const j1 = Math.ceil(Math.max(...ys) / cell);
  if (i1 - i0 <= 1 && j1 - j0 <= 1) return [tri];
  const out: P2[][] = [];
  for (let i = i0; i < i1; i++) {
    const cx = clipAxis(clipAxis(tri, 0, i * cell, 1), 0, (i + 1) * cell, -1);
    if (cx.length < 3) continue;
    for (let j = j0; j < j1; j++) {
      const c = clipAxis(clipAxis(cx, 1, j * cell, 1), 1, (j + 1) * cell, -1);
      if (c.length >= 3) out.push(c);
    }
  }
  return out;
}

/** Accumulateur de triangles (position, normale verticale ou donnée, uv en mètres / échelle). */
class Tris {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  constructor(private readonly uvScale: number) {}
  /**
   * Polygone horizontal (triangulé), à l'altitude y. Chaque triangle est recoupé par la grille de pas `cell` mètres (0 : non) :
   * en rendu logiciel, un triangle de plusieurs centaines de mètres perd la précision de profondeur qui garde les chaussées
   * (+6 cm) au-dessus de la prairie.
   */
  flat(poly: Poly2, y: number, holes: Poly2[] = [], cell = GRID_M): void {
    const contour = poly.map((p) => new Vector2(p[0], p[1]));
    const hs = holes.map((h) => h.map((p) => new Vector2(p[0], p[1])));
    const all = [...contour, ...hs.flat()];
    for (const t of ShapeUtils.triangulateShape(contour, hs)) {
      const tri = t.map((i) => [(all[i] as Vector2).x, (all[i] as Vector2).y] as P2);
      for (const piece of cell > 0 ? clipToGrid(tri, cell) : [tri]) for (let k = 1; k + 1 < piece.length; k++) this.tri(piece[0] as P2, piece[k] as P2, piece[k + 1] as P2, y);
    }
  }
  private tri(a: P2, b: P2, c: P2, y: number): void {
    // Ordre : normale vers le haut (repère monde : y vers le haut, z = y du plan).
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(cross) < 1e-9) return;
    for (const v of cross > 0 ? [a, c, b] : [a, b, c]) {
      this.pos.push(v[0], y, v[1]);
      this.nor.push(0, 1, 0);
      this.uv.push(v[0] / this.uvScale, v[1] / this.uvScale);
    }
  }
  /** Quadrilatère quelconque (sommets monde), normale calculée, uv donnés. */
  quad(v: [number, number, number][], uv: [number, number][]): void {
    const [a, b, c] = v as [[number, number, number], [number, number, number], [number, number, number]];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [(e1[1] as number) * (e2[2] as number) - (e1[2] as number) * (e2[1] as number), (e1[2] as number) * (e2[0] as number) - (e1[0] as number) * (e2[2] as number), (e1[0] as number) * (e2[1] as number) - (e1[1] as number) * (e2[0] as number)];
    const l = Math.hypot(...n) || 1;
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const p = v[k] as [number, number, number];
      this.pos.push(...p);
      this.nor.push((n[0] as number) / l, (n[1] as number) / l, (n[2] as number) / l);
      const t = uv[k] as [number, number];
      this.uv.push(t[0], t[1]);
    }
  }
  build(): BufferGeometry | null {
    if (this.pos.length === 0) return null;
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute("uv", new BufferAttribute(new Float32Array(this.uv), 2));
    g.computeBoundingSphere();
    return g;
  }
}

/** Contour d'un ruban (polyligne élargie, onglets bornés). */
export function ribbon(line: Poly2, w: number): [number, number][] {
  const L: [number, number][] = [];
  const R: [number, number][] = [];
  for (let i = 0; i < line.length; i++) {
    const p = line[i] as P2;
    const d0 = i > 0 ? unit(sub(p, line[i - 1] as P2)) : null;
    const d1 = i + 1 < line.length ? unit(sub(line[i + 1] as P2, p)) : null;
    const n0 = d0 ? left(d0) : null;
    const n1 = d1 ? left(d1) : null;
    let n: [number, number];
    let k = 1;
    if (n0 && n1) {
      n = unit(add(n0, n1));
      k = Math.min(2.5, 1 / Math.max(0.2, n[0] * n0[0] + n[1] * n0[1]));
    } else n = (n0 ?? n1) as [number, number];
    L.push(add(p, mul(n, (w / 2) * k)));
    R.push(add(p, mul(n, (-w / 2) * k)));
  }
  return [...L, ...R.reverse()];
}

export interface GroundMeshes {
  group: Group;
  textures: Texture[];
  materials: Material[];
  dispose(): void;
}

const COURT: Record<string, string> = { plantee: "#ffffff", jardin: "#c7b48c", pavee: "#d8d2c6" };

/** Teintes des champs d'un lieu N2 (sur la texture d'herbe, ou de terre pour le labour et le potager). */
const CULTURE_TINT: Record<Culture, number> = { ble: 0xd9c27a, orge: 0xc9c08a, jachere: 0xa8b07c, labour: 0x9c8462, prairie: 0xc4d29c, potager: 0xa89670, verger: 0xd0dcb0 };

export function buildGround(place: Place, L: PlaceLayout, seed: number, fields: { polygone: [number, number][]; culture: Culture }[] = []): GroundMeshes {
  const group = new Group();
  group.name = "sol";
  const textures: Texture[] = [];
  const materials: Material[] = [];
  const add3 = (g: BufferGeometry | null, mat: MeshStandardMaterial, name: string, receive = true): void => {
    materials.push(mat);
    if (!g) return;
    const m = new Mesh(g, mat);
    m.name = name;
    m.receiveShadow = receive;
    group.add(m);
  };
  // Prairie : carré du lieu percé par les canaux, puis anneau jusqu'à l'horizon du brouillard (pas de bord visible en vue
  // d'ensemble), 25 cm plus bas : ses triangles de plusieurs kilomètres n'ont pas la précision de profondeur voulue pour
  // passer sous les chaussées (+6 cm) en qualité moyenne.
  const E = place.etendue_m * 0.8;
  const EF = Math.max(E * 1.5, 9000);
  const canals = place.eau.voies.map((w) => ribbon(w.trace, w.largeur_m));
  const grass = grassTexture(seed);
  tagPhoto(grass, "sol", 8);
  textures.push(grass);
  const field = new Tris(8);
  field.flat([[-E, -E], [E, -E], [E, E], [-E, E]], 0, canals);
  for (const q of [
    [[-EF, -EF], [EF, -EF], [EF, -E], [-EF, -E]],
    [[-EF, E], [EF, E], [EF, EF], [-EF, EF]],
    [[-EF, -E], [-E, -E], [-E, E], [-EF, E]],
    [[E, -E], [EF, -E], [EF, E], [E, E]],
  ] as [number, number][][])
    field.flat(q, -0.25, [], 0);
  add3(field.build(), new MeshStandardMaterial({ map: grass, roughness: 1, color: 0xd8e0c0 }), "prairie");
  // Cours d'îlots : pelouse, potager, dalles (selon le gabarit).
  for (const kind of ["plantee", "jardin", "pavee"] as const) {
    const t = new Tris(kind === "pavee" ? PAVE_M : 6);
    for (const b of L.blocks) {
      const g = place.gabarits[b.block.gabarit];
      const k = b.block.fonction === "jardin" ? "jardin" : (g?.cour.type ?? "plantee");
      if (k !== kind) continue;
      t.flat(b.block.polygone, 0.03);
    }
    const tex = kind === "pavee" ? pavingTexture("dalles", seed) : kind === "jardin" ? pavingTexture("terre", seed) : grass;
    if (tex !== grass) textures.push(tex);
    add3(t.build(), new MeshStandardMaterial({ map: tex, roughness: 1, color: new Color(COURT[kind]) }), `cours-${kind}`);
  }
  // Champs (lieux N2) : une couche par culture.
  for (const cult of [...new Set(fields.map((f) => f.culture))]) {
    const t = new Tris(cult === "labour" || cult === "potager" ? 6 : 10);
    for (const f of fields) if (f.culture === cult) t.flat(f.polygone, 0.02);
    const soilLike = cult === "labour" || cult === "potager";
    const tex = soilLike ? pavingTexture("terre", seed + 3) : grass;
    if (tex !== grass) textures.push(tex);
    add3(t.build(), new MeshStandardMaterial({ map: tex, roughness: 1, color: CULTURE_TINT[cult] }), `champs-${cult}`);
  }
  // Parcs, vergers, potagers.
  const parks = new Tris(8);
  for (const k of place.vegetation.parcs) parks.flat(k.polygone, 0.035);
  for (const v of place.vegetation.vergers) parks.flat(v.polygone, 0.035);
  add3(parks.build(), new MeshStandardMaterial({ map: grass, roughness: 1, color: 0xe4ecc8 }), "parcs");
  const pot = new Tris(6);
  for (const v of place.vegetation.potagers) pot.flat(v.polygone, 0.035);
  const soil = pavingTexture("terre", seed + 1);
  textures.push(soil);
  add3(pot.build(), new MeshStandardMaterial({ map: soil, roughness: 1, color: 0xa89670 }), "potagers");
  // Chaussées par revêtement (hauteurs décalées : pas de scintillement aux croisements), places.
  const PAV_Y = { paves: 0.06, dalles: 0.065, gravier: 0.055, terre: 0.05 } as const;
  for (const kind of ["paves", "dalles", "gravier", "terre"] as const) {
    const t = new Tris(PAVE_M);
    for (const r of place.rues) if (r.revetement === kind) t.flat(ribbon(r.trace, r.largeur_m), PAV_Y[kind]);
    for (const s of place.places_publiques) if (s.revetement === kind) t.flat(s.polygone, PAV_Y[kind] + 0.01);
    const tex = pavingTexture(kind, seed);
    if (kind === "paves") tagPhoto(tex, "pave", PAVE_M);
    textures.push(tex);
    add3(t.build(), new MeshStandardMaterial({ map: tex, roughness: 0.95, color: kind === "terre" ? 0xc8b08a : 0xffffff }), `chaussee-${kind}`);
  }
  // Canaux : eau en creux, quais de pierre (parement vertical et margelle), fond.
  const water = new Tris(20);
  const quay = new Tris(1);
  const WATER_Y = -1.7;
  for (const w of place.eau.voies) {
    const n = Math.max(2, Math.ceil(polylineLength(w.trace) / 6));
    const Ltot = polylineLength(w.trace);
    for (const side of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const a = along(w.trace, (Ltot * i) / n);
        const b = along(w.trace, (Ltot * (i + 1)) / n);
        const pa = add(a.p, mul(left(a.d), (side * w.largeur_m) / 2));
        const pb = add(b.p, mul(left(b.d), (side * w.largeur_m) / 2));
        const s0 = (Ltot * i) / n;
        const s1 = (Ltot * (i + 1)) / n;
        // Parement du quai (face vers l'eau), du fond jusqu'au sol.
        const v = side < 0 ? ([[pa[0], -3, pa[1]], [pb[0], -3, pb[1]], [pb[0], 0.08, pb[1]], [pa[0], 0.08, pa[1]]] as [number, number, number][]) : ([[pb[0], -3, pb[1]], [pa[0], -3, pa[1]], [pa[0], 0.08, pa[1]], [pb[0], 0.08, pb[1]]] as [number, number, number][]);
        quay.quad(v, side < 0 ? [[s0 / 2, 0], [s1 / 2, 0], [s1 / 2, 1.5], [s0 / 2, 1.5]] : [[s1 / 2, 0], [s0 / 2, 0], [s0 / 2, 1.5], [s1 / 2, 1.5]]);
        // Margelle : bande de pierre de 0,8 m au bord.
        const qa = add(pa, mul(left(a.d), side * 0.8));
        const qb = add(pb, mul(left(b.d), side * 0.8));
        quay.quad([[pa[0], 0.09, pa[1]], [pb[0], 0.09, pb[1]], [qb[0], 0.09, qb[1]], [qa[0], 0.09, qa[1]]], [[s0 / 2, 0], [s1 / 2, 0], [s1 / 2, 0.4], [s0 / 2, 0.4]]);
      }
    }
    water.flat(ribbon(w.trace, w.largeur_m), WATER_Y);
  }
  const ripples = waterNormalTex(seed);
  textures.push(ripples);
  add3(water.build(), new MeshStandardMaterial({ color: 0x3d5a5c, roughness: 0.12, metalness: 0.1, normalMap: ripples }), "eau");
  const stone = pavingTexture("dalles", seed + 2);
  tagPhoto(stone, "pierre_taille", 2);
  textures.push(stone);
  const quayMat = new MeshStandardMaterial({ map: stone, roughness: 0.9, color: 0xcfc6b4 });
  // Le parement est vu des deux côtés selon le sens du canal : face double.
  quayMat.side = DoubleSide;
  add3(quay.build(), quayMat, "quais");
  // Ponts de pierre : tablier, parapets, arche (demi-cylindre) ; ponts de bois : tablier et garde-corps.
  const bridge = new Tris(2);
  const arches: { m: Matrix4; L: number; w: number }[] = [];
  for (const p of place.eau.ponts) {
    const a = rad(p.angle_deg);
    const u: P2 = [Math.cos(a), Math.sin(a)];
    const nn = left(u);
    const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): void => {
      const P = (s: number, t: number): P2 => add(add(p.position, mul(u, s)), mul(nn, t));
      const c = [P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1)] as P2[];
      for (let i = 0; i < 4; i++) {
        const q0 = c[i] as P2;
        const q1 = c[(i + 1) % 4] as P2;
        bridge.quad([[q0[0], y0, q0[1]], [q1[0], y0, q1[1]], [q1[0], y1, q1[1]], [q0[0], y1, q0[1]]], [[0, y0], [1, y0], [1, y1], [0, y1]]);
      }
      bridge.quad(c.map((q) => [q[0], y1, q[1]] as [number, number, number]).reverse() as [number, number, number][], [[0, 0], [0, 1], [1, 1], [1, 0]]);
    };
    const hl = p.longueur_m / 2;
    const hw = p.largeur_m / 2;
    box(-hl, hl, -hw, hw, -0.3, 0.35);
    box(-hl, hl, -hw, -hw + 0.4, 0.35, p.type === "pierre" ? 1.25 : 1.1);
    box(-hl, hl, hw - 0.4, hw, 0.35, p.type === "pierre" ? 1.25 : 1.1);
    if (p.type === "pierre") arches.push({ m: new Matrix4().compose(new Vector3(p.position[0], -0.3, p.position[1]), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -a), new Vector3(1, 1, 1)), L: p.longueur_m, w: p.largeur_m });
  }
  const bg = bridge.build();
  if (bg) {
    const mat = new MeshStandardMaterial({ map: stone, roughness: 0.9, color: 0xc4baa6 });
    const m = new Mesh(bg, mat);
    m.name = "ponts";
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    materials.push(mat);
    for (const ar of arches) {
      // Arche : demi-cylindre plein sous le tablier (intrados sombre).
      const cyl = new CylinderGeometry(ar.L * 0.42, ar.L * 0.42, ar.w * 0.98, 16, 1, false, Math.PI / 2, Math.PI);
      cyl.rotateX(Math.PI / 2);
      cyl.scale(1, 0.35, 1);
      cyl.applyMatrix4(ar.m);
      const am = new Mesh(cyl, mat);
      am.castShadow = true;
      group.add(am);
    }
  }
  return {
    group,
    textures,
    materials,
    dispose() {
      group.traverse((o) => {
        if (o instanceof Mesh) (o.geometry as BufferGeometry).dispose();
      });
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
