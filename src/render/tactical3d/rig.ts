import { Box3, Group, LatheGeometry, Mesh, MeshStandardMaterial, SphereGeometry, Vector2, Vector3 } from "three";
import type { BufferGeometry, Material, Object3D } from "three";

/**
 * Outils de figure articulée (R1.4, R1.5) : formes organiques par révolution, articulations nommées, mesure de hauteur.
 * Repère d'une figure : y vers le haut, face vers +z ; la gauche du personnage est +x.
 * Rotation x d'un membre qui pend : négative = vers l'avant. Rotation x d'un segment dressé (torse, cou) : positive = vers l'avant.
 */

/**
 * Profil de membre, du haut (articulation, y = 0) vers le bas (y = −L), arrondi aux deux bouts.
 * r0 / r1 : rayons haut et bas ; `bulge` : renflement musculaire (fraction de r0) centré à `at` (0 = haut, 1 = bas).
 */
export function limbProfile(L: number, r0: number, r1: number, bulge = 0, at = 0.35, n = 12): Vector2[] {
  const pts: Vector2[] = [];
  const cap = 5;
  // Calotte basse (vers −L − r1), puis le fût, puis la calotte haute : y croissant, comme l'attend LatheGeometry.
  for (let i = 0; i <= cap; i++) {
    const a = (i / cap) * (Math.PI / 2);
    pts.push(new Vector2(r1 * Math.sin(a), -L - r1 * 0.85 * Math.cos(a)));
  }
  for (let i = n - 1; i >= 1; i--) {
    const t = i / n;
    const r = r0 + (r1 - r0) * t + bulge * r0 * Math.exp(-(((t - at) / 0.24) ** 2));
    pts.push(new Vector2(r, -t * L));
  }
  for (let i = cap; i >= 0; i--) {
    const a = (i / cap) * (Math.PI / 2);
    pts.push(new Vector2(r0 * Math.sin(a), r0 * 0.85 * Math.cos(a)));
  }
  return pts;
}

/** Membre par révolution autour de y (le haut à l'articulation). */
export function limb(L: number, r0: number, r1: number, bulge = 0, at = 0.35, segments = 14): BufferGeometry {
  return new LatheGeometry(limbProfile(L, r0, r1, bulge, at), segments);
}

/** Profil libre (rayon, hauteur) par révolution, y croissant. */
export function lathe(profile: readonly [number, number][], segments = 18): BufferGeometry {
  return new LatheGeometry(
    profile.map(([r, y]) => new Vector2(Math.max(0, r), y)),
    segments,
  );
}

const SPHERE = new Map<number, SphereGeometry>();
/** Sphère unité partagée (mise à l'échelle par l'objet). */
export function unitSphere(detail = 18): SphereGeometry {
  let g = SPHERE.get(detail);
  if (!g) {
    g = new SphereGeometry(1, detail, Math.max(8, Math.round(detail * 0.7)));
    SPHERE.set(detail, g);
  }
  return g;
}

export function part(geo: BufferGeometry, mat: Material, name: string, at: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0]): Mesh {
  const m = new Mesh(geo, mat);
  m.name = name;
  m.position.set(...at);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function joint(name: string, parent: Object3D, at: [number, number, number] = [0, 0, 0]): Group {
  const g = new Group();
  g.name = name;
  g.position.set(...at);
  parent.add(g);
  return g;
}

/** Hauteur réelle d'une figure : boîte englobante calculée sommet par sommet, après poses et échelles. */
export function measureBox(obj: Object3D): Box3 {
  obj.updateMatrixWorld(true);
  return new Box3().setFromObject(obj, true);
}

export function measureHeight(obj: Object3D): number {
  const b = measureBox(obj);
  return b.max.y - b.min.y;
}

/** Position monde d'un objet (articulation, pièce). */
export function worldPoint(obj: Object3D): Vector3 {
  obj.updateWorldMatrix(true, false);
  return obj.getWorldPosition(new Vector3());
}

/** Direction « devant » (+z local) d'un objet, dans le monde. */
export function forwardOf(obj: Object3D): Vector3 {
  obj.updateWorldMatrix(true, false);
  return new Vector3(0, 0, 1).transformDirection(obj.matrixWorld);
}

/** Point le plus bas des maillages sous un objet (m). */
export function lowestY(obj: Object3D): number {
  let low = Infinity;
  obj.traverse((o) => {
    if (o instanceof Mesh) low = Math.min(low, measureBox(o).min.y);
  });
  return low;
}

/** Couleur de base d'un maillage (matériau standard), pour les contrôles. */
export function colorOf(obj: Object3D): { r: number; g: number; b: number } {
  const m = obj instanceof Mesh && obj.material instanceof MeshStandardMaterial ? obj.material : null;
  return m ? { r: m.color.r, g: m.color.g, b: m.color.b } : { r: 0, g: 0, b: 0 };
}
