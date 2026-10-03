/** Géométrie plane de la carte (km). Relèvement : 0° = nord, sens horaire ; y vers le bas (écran). */
export type Point = [number, number];

export function polar(r: number, bearingDeg: number): Point {
  const b = (bearingDeg * Math.PI) / 180;
  return [r * Math.sin(b), -r * Math.cos(b)];
}

export function bearingOf([x, y]: Point): number {
  const deg = (Math.atan2(x, -y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Test point-dans-polygone (règle pair-impair). */
export function pointInPolygon([px, py]: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i] as Point;
    const [xj, yj] = poly[j] as Point;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Aire signée (formule du lacet) : sert aux tests de cohérence des polygones. */
export function polygonArea(poly: readonly Point[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i] as Point;
    const [xj, yj] = poly[j] as Point;
    a += xj * yi - xi * yj;
  }
  return a / 2;
}
