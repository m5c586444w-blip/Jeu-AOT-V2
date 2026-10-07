import { BufferAttribute, BufferGeometry } from "three";

/**
 * Géométries unité des pièces de maison (R1e) : boîte des murs, toits de chaque forme, pignons, lucarne, cheminée, tas de
 * gravats. Repère : x le long de la façade (−0,5 à 0,5), y vers le haut (0 à 1), z vers l'intérieur de l'îlot (−0,5 côté rue).
 * L'instance les met à l'échelle ; le shader recale les textures sur la taille réelle (`placeMaterials.ts`).
 * Attributs propres :
 * - `fa` (façades) : axe de la face (0 : le long de x, 1 : le long de z, 2 : dessus), face sur rue (1), 0 ;
 * - `hip` (toits) : axe du faîtage (0 : x, 1 : z), extrémité de faîtage (−1, 0, 1), face de croupe (−1, 0, 1), part de croupe ;
 * - `rax` (toits) : coordonnées de texture (0 : pente en travers de z, 1 : pente en travers de x, 2 : plan).
 */
type V = [number, number, number];

class GeoBuilder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  extra = new Map<string, { size: number; data: number[] }>();
  constructor(attrs: Record<string, number>) {
    for (const [k, s] of Object.entries(attrs)) this.extra.set(k, { size: s, data: [] });
  }
  /** Polygone plan convexe (sommets dans l'ordre), orienté vers `out` ; attributs par sommet ou constants. */
  poly(v: readonly V[], uv: readonly [number, number][], out: V, attrs: Record<string, readonly number[] | readonly (readonly number[])[]> = {}): void {
    const a = v[0] as V;
    const b = v[1] as V;
    const c = v[2] as V;
    const e1: V = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2: V = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n: V = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(...n) || 1;
    n = [n[0] / l, n[1] / l, n[2] / l];
    let order = v.map((_, i) => i);
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) {
      n = [-n[0], -n[1], -n[2]];
      order = order.reverse();
    }
    for (let i = 1; i + 1 < order.length; i++) {
      for (const k of [order[0], order[i], order[i + 1]] as number[]) {
        const p = v[k] as V;
        const t = uv[k] as [number, number];
        this.pos.push(...p);
        this.nor.push(...n);
        this.uv.push(...t);
        for (const [name, e] of this.extra) {
          const val = attrs[name];
          const per = Array.isArray(val?.[0]) ? ((val as readonly (readonly number[])[])[k] as readonly number[]) : ((val as readonly number[] | undefined) ?? new Array<number>(e.size).fill(0));
          e.data.push(...per);
        }
      }
    }
  }
  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute("uv", new BufferAttribute(new Float32Array(this.uv), 2));
    for (const [name, e] of this.extra) g.setAttribute(name, new BufferAttribute(new Float32Array(e.data), e.size));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Boîte des murs : quatre faces et le dessus (visible sur une ruine). */
export function boxGeometry(): BufferGeometry {
  const g = new GeoBuilder({ fa: 3 });
  const q = (a: V, b: V, axis: number, front: number, out: V): void =>
    g.poly([a, b, [b[0], 1, b[2]], [a[0], 1, a[2]]], [[0, 0], [1, 0], [1, 1], [0, 1]], out, { fa: [axis, front, 0] });
  q([-0.5, 0, -0.5], [0.5, 0, -0.5], 0, 1, [0, 0, -1]);
  q([0.5, 0, 0.5], [-0.5, 0, 0.5], 0, 0, [0, 0, 1]);
  q([0.5, 0, -0.5], [0.5, 0, 0.5], 1, 0, [1, 0, 0]);
  q([-0.5, 0, 0.5], [-0.5, 0, -0.5], 1, 0, [-1, 0, 0]);
  g.poly([[-0.5, 1, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0], { fa: [2, 0, 0] });
  return g.build();
}

const H0 = [0, 0, 0, 0];

/** Toits (géométries unité) ; voir l'en-tête pour `hip` et `rax`. */
export function roofGeometry(kind: "pignon_x" | "pignon_z" | "croupe" | "croupe_z" | "demi_croupe" | "mansarde" | "plat" | "appentis" | "pavillon"): BufferGeometry {
  const g = new GeoBuilder({ hip: 4, rax: 1 });
  const uv4: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const uv3: [number, number][] = [[0, 0], [1, 0], [0.5, 1]];
  switch (kind) {
    case "pignon_x":
      for (const s of [-1, 1]) g.poly([[-0.5, 0, 0.5 * s], [0.5, 0, 0.5 * s], [0.5, 1, 0], [-0.5, 1, 0]], uv4, [0, 1, s], { hip: H0, rax: [0] });
      break;
    case "pignon_z":
      for (const s of [-1, 1]) g.poly([[0.5 * s, 0, -0.5], [0.5 * s, 0, 0.5], [0, 1, 0.5], [0, 1, -0.5]], uv4, [s, 1, 0], { hip: H0, rax: [1] });
      break;
    case "croupe":
    case "demi_croupe": {
      const demi = kind === "demi_croupe";
      const k = demi ? 0.3 : 1;
      const yb = demi ? 0.7 : 0;
      const zb = demi ? 0.15 : 0.5;
      for (const s of [-1, 1]) {
        // Long pan : de l'égout au faîtage ; les extrémités du faîtage (hip.y = ±1) sont recalées par le shader.
        const pts: V[] = demi
          ? [[-0.5, 0, 0.5 * s], [0.5, 0, 0.5 * s], [0.5, yb, zb * s], [0.25, 1, 0], [-0.25, 1, 0], [-0.5, yb, zb * s]]
          : [[-0.5, 0, 0.5 * s], [0.5, 0, 0.5 * s], [0.25, 1, 0], [-0.25, 1, 0]];
        const hips: number[][] = demi
          ? [[0, 0, 0, k], [0, 0, 0, k], [0, 0, 0, k], [0, 1, 0, k], [0, -1, 0, k], [0, 0, 0, k]]
          : [[0, 0, 0, k], [0, 0, 0, k], [0, 1, 0, k], [0, -1, 0, k]];
        const uvs: [number, number][] = pts.map((p) => [p[0] + 0.5, p[1]]);
        g.poly(pts, uvs, [0, 1, s], { hip: hips, rax: [0] });
        // Croupe : triangle au bout du faîtage.
        g.poly([[0.5 * s, yb, -zb], [0.5 * s, yb, zb], [0.25 * s, 1, 0]], uv3, [s, 1, 0], { hip: [[0, 0, s, k], [0, 0, s, k], [0, s, s, k]], rax: [1] });
      }
      break;
    }
    case "croupe_z":
      for (const s of [-1, 1]) {
        g.poly([[0.5 * s, 0, -0.5], [0.5 * s, 0, 0.5], [0, 1, 0.25], [0, 1, -0.25]], [[0, 0], [1, 0], [0.75, 1], [0.25, 1]], [s, 1, 0], { hip: [[1, 0, 0, 1], [1, 0, 0, 1], [1, 1, 0, 1], [1, -1, 0, 1]], rax: [1] });
        g.poly([[-0.5, 0, 0.5 * s], [0.5, 0, 0.5 * s], [0, 1, 0.25 * s]], uv3, [0, 1, s], { hip: [[1, 0, s, 1], [1, 0, s, 1], [1, s, s, 1]], rax: [0] });
      }
      break;
    case "mansarde":
      for (const s of [-1, 1]) {
        g.poly([[-0.5, 0, 0.5 * s], [0.5, 0, 0.5 * s], [0.5, 0.62, 0.36 * s], [-0.5, 0.62, 0.36 * s]], uv4, [0, 0.4, s], { hip: H0, rax: [0] });
        g.poly([[-0.5, 0.62, 0.36 * s], [0.5, 0.62, 0.36 * s], [0.5, 1, 0], [-0.5, 1, 0]], uv4, [0, 1, s * 0.4], { hip: H0, rax: [0] });
      }
      break;
    case "appentis":
      g.poly([[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5]], uv4, [0, 1, -1], { hip: H0, rax: [0] });
      break;
    case "pavillon":
      for (const [a, b, out] of [
        [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0, 0.4, -1]],
        [[0.5, 0, -0.5], [0.5, 0, 0.5], [1, 0.4, 0]],
        [[0.5, 0, 0.5], [-0.5, 0, 0.5], [0, 0.4, 1]],
        [[-0.5, 0, 0.5], [-0.5, 0, -0.5], [-1, 0.4, 0]],
      ] as [V, V, V][])
        g.poly([a, b, [0, 1, 0]], uv3, out, { hip: H0, rax: [out[0] === 0 ? 0 : 1] });
      break;
    case "plat": {
      // Toit-terrasse : dalle au tiers de la hauteur, acrotère (bord relevé) tout autour.
      const t = 0.035;
      g.poly([[-0.5, 0.35, -0.5], [0.5, 0.35, -0.5], [0.5, 0.35, 0.5], [-0.5, 0.35, 0.5]], uv4, [0, 1, 0], { hip: H0, rax: [2] });
      for (const [x0, z0, x1, z1] of [
        [-0.5, -0.5, 0.5, -0.5 + t],
        [-0.5, 0.5 - t, 0.5, 0.5],
        [-0.5, -0.5, -0.5 + t, 0.5],
        [0.5 - t, -0.5, 0.5, 0.5],
      ] as [number, number, number, number][]) {
        const box: [V, V, V][] = [
          [[x0, 0, z0], [x1, 0, z0], [0, 0, -1]],
          [[x1, 0, z0], [x1, 0, z1], [1, 0, 0]],
          [[x1, 0, z1], [x0, 0, z1], [0, 0, 1]],
          [[x0, 0, z1], [x0, 0, z0], [-1, 0, 0]],
        ];
        for (const [a, b, out] of box) g.poly([a, b, [b[0], 1, b[2]], [a[0], 1, a[2]]], uv4, out, { hip: H0, rax: [2] });
        g.poly([[x0, 1, z0], [x1, 1, z0], [x1, 1, z1], [x0, 1, z1]], uv4, [0, 1, 0], { hip: H0, rax: [2] });
      }
      break;
    }
  }
  return g.build();
}

/** Pignons (triangles de mur sous les toits à deux pans). `uv` : abscisse centrée (−0,5 à 0,5) et hauteur (0 à 1). */
export function gableGeometry(kind: "gable_x" | "gable_z" | "gable_demi" | "gable_mansarde" | "gable_appentis"): BufferGeometry {
  const g = new GeoBuilder({ fa: 3 });
  for (const s of [-1, 1]) {
    if (kind === "gable_z") {
      g.poly([[-0.5, 0, 0.5 * s], [0.5, 0, 0.5 * s], [0, 1, 0.5 * s]], [[-0.5, 0], [0.5, 0], [0, 1]], [0, 0, s], { fa: [0, s < 0 ? 1 : 0, 0] });
      continue;
    }
    const x = 0.5 * s;
    const out: V = [s, 0, 0];
    if (kind === "gable_x") g.poly([[x, 0, -0.5], [x, 0, 0.5], [x, 1, 0]], [[-0.5, 0], [0.5, 0], [0, 1]], out, { fa: [1, 0, 0] });
    else if (kind === "gable_demi")
      g.poly([[x, 0, -0.5], [x, 0, 0.5], [x, 0.68, 0.16], [x, 0.68, -0.16]], [[-0.5, 0], [0.5, 0], [0.16, 0.68], [-0.16, 0.68]], out, { fa: [1, 0, 0] });
    else if (kind === "gable_mansarde")
      g.poly([[x, 0, -0.5], [x, 0, 0.5], [x, 0.58, 0.35], [x, 0.96, 0], [x, 0.58, -0.35]], [[-0.5, 0], [0.5, 0], [0.35, 0.58], [0, 0.96], [-0.35, 0.58]], out, { fa: [1, 0, 0] });
    else g.poly([[x, 0, -0.5], [x, 0, 0.5], [x, 1, 0.5]], [[-0.5, 0], [0.5, 0], [0.5, 1]], out, { fa: [1, 0, 0] });
  }
  return g.build();
}

/** Lucarne : façade vitrée sur rue (z = −0,5), joues, petit toit à deux pans (géométrie à part, `dormerRoofGeometry`). */
export function dormerGeometry(): BufferGeometry {
  const g = new GeoBuilder({ fa: 3 });
  g.poly([[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0.8, -0.5], [-0.5, 0.8, -0.5]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 0, -1], { fa: [0, 1, 0] });
  g.poly([[-0.5, 0.8, -0.5], [0.5, 0.8, -0.5], [0, 1, -0.5]], [[0, 0.98], [1, 0.98], [0.5, 1]], [0, 0, -1], { fa: [0, 1, 0] });
  for (const s of [-1, 1]) g.poly([[0.5 * s, 0, -0.5], [0.5 * s, 0, 0.5], [0.5 * s, 0.8, 0.5], [0.5 * s, 0.8, -0.5]], [[0, 0], [0.02, 0], [0.02, 0.02], [0, 0.02]], [s, 0, 0], { fa: [1, 0, 0] });
  return g.build();
}

export function dormerRoofGeometry(): BufferGeometry {
  const g = new GeoBuilder({ hip: 4, rax: 1 });
  for (const s of [-1, 1]) g.poly([[0.6 * s, 0.76, -0.6], [0.6 * s, 0.76, 0.5], [0, 1.02, 0.5], [0, 1.02, -0.6]], [[0, 0], [1, 0], [1, 1], [0, 1]], [s, 1, 0], { hip: H0, rax: [1] });
  return g.build();
}

/** Cheminée : fût et chapeau. */
export function chimneyGeometry(): BufferGeometry {
  const g = new GeoBuilder({});
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): void => {
    g.poly([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 0, -1]);
    g.poly([[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 0, 1]);
    g.poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [[0, 0], [1, 0], [1, 1], [0, 1]], [1, 0, 0]);
    g.poly([[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [-1, 0, 0]);
    g.poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
  };
  box(-0.5, 0.5, 0, 0.92, -0.5, 0.5);
  box(-0.62, 0.62, 0.92, 1, -0.62, 0.62);
  return g.build();
}

/** Tas de gravats (ruine) : dôme bosselé, base carrée. */
export function rubbleGeometry(): BufferGeometry {
  const g = new GeoBuilder({});
  const N = 6;
  const h = (i: number, j: number): number => {
    const x = i / N - 0.5;
    const z = j / N - 0.5;
    const r = Math.max(Math.abs(x), Math.abs(z)) * 2;
    const bump = 0.18 * Math.sin(i * 2.3 + j * 1.7) * Math.cos(i * 1.1 - j * 2.9);
    return Math.max(0, (1 - r * r) * (0.82 + bump));
  };
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const p = (a: number, b: number): V => [a / N - 0.5, h(a, b), b / N - 0.5];
      g.poly([p(i, j), p(i + 1, j), p(i + 1, j + 1)], [[0, 0], [1, 0], [1, 1]], [0, 1, 0]);
      g.poly([p(i, j), p(i + 1, j + 1), p(i, j + 1)], [[0, 0], [1, 1], [0, 1]], [0, 1, 0]);
    }
  return g.build();
}
