/**
 * Placement des sous-titres de bataille (R0, item 2) : en haut à gauche de la scène, sauf si des marqueurs (pastilles
 * d'escouade, flèches de bord) s'y trouvent ; alors le premier coin libre (haut droit, bas gauche, bas droit), ou à défaut
 * le moins recouvert. Calcul pur, en coordonnées de page (px).
 */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type Corner = "haut-gauche" | "haut-droit" | "bas-gauche" | "bas-droit";
export const CORNERS: readonly Corner[] = ["haut-gauche", "haut-droit", "bas-gauche", "bas-droit"];

const overlapArea = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

export function cornerRect(scene: Rect, w: number, h: number, corner: Corner, margin: number): Rect {
  const x0 = corner.endsWith("gauche") ? scene.x0 + margin : scene.x1 - margin - w;
  const y0 = corner.startsWith("haut") ? scene.y0 + margin : scene.y1 - margin - h;
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

export function placeSubtitles(scene: Rect, size: { w: number; h: number }, obstacles: readonly Rect[], margin = 12): { corner: Corner; rect: Rect } {
  let best: { corner: Corner; rect: Rect; area: number } | null = null;
  for (const corner of CORNERS) {
    const rect = cornerRect(scene, size.w, size.h, corner, margin);
    const area = obstacles.reduce((s, o) => s + overlapArea(rect, o), 0);
    if (area === 0) return { corner, rect };
    if (!best || area < best.area) best = { corner, rect, area };
  }
  const b = best ?? { corner: "haut-gauche" as const, rect: cornerRect(scene, size.w, size.h, "haut-gauche", margin) };
  return { corner: b.corner, rect: b.rect };
}
