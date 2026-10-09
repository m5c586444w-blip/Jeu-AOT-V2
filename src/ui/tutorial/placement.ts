/** Placement d'une bulle près d'un élément (TUT.1) : logique pure, testée sans navigateur. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type Side = "bas" | "haut" | "droite" | "gauche" | "bord" | "dedans";

export interface Placed {
  left: number;
  top: number;
  side: Side;
}

const overlaps = (a: Box, b: Box): boolean => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
const within = (b: Box, vp: { width: number; height: number }, m: number): boolean => b.left >= m && b.top >= m && b.left + b.width <= vp.width - m && b.top + b.height <= vp.height - m;

/**
 * Cherche d'abord une place hors de l'élément (dessous, dessus, droite, gauche) qui tienne dans la fenêtre sans
 * recouvrir `avoid` (barres et menus qui doivent rester lisibles), puis à défaut dans l'élément lui-même.
 */
export function placeBubble(anchor: Box, bubble: { width: number; height: number }, vp: { width: number; height: number }, gap = 14, margin = 8, avoid: readonly Box[] = [], dock: "bas-droite" | null = null): Placed {
  const cx = anchor.left + anchor.width / 2 - bubble.width / 2;
  const cy = anchor.top + anchor.height / 2 - bubble.height / 2;
  const clampX = (x: number): number => Math.max(margin, Math.min(vp.width - bubble.width - margin, x));
  const clampY = (y: number): number => Math.max(margin, Math.min(vp.height - bubble.height - margin, y));
  const tries: { side: Side; left: number; top: number }[] = [
    { side: "bas", left: clampX(cx), top: anchor.top + anchor.height + gap },
    { side: "haut", left: clampX(cx), top: anchor.top - bubble.height - gap },
    { side: "droite", left: anchor.left + anchor.width + gap, top: clampY(cy) },
    { side: "gauche", left: anchor.left - bubble.width - gap, top: clampY(cy) },
  ];
  for (const c of tries) {
    const box: Box = { left: c.left, top: c.top, width: bubble.width, height: bubble.height };
    if (within(box, vp, margin) && !overlaps(box, anchor) && !avoid.some((a) => overlaps(box, a))) return { left: Math.round(c.left), top: Math.round(c.top), side: c.side };
  }
  // Registre large : la bulle se range contre le bord de la fenêtre, en ne mordant que sur une petite part de l'élément
  // (colonne de notifications ou de calques à droite, marge à gauche), plutôt que de masquer son contenu.
  const small = (b: Box): boolean => {
    const w = Math.max(0, Math.min(b.left + b.width, anchor.left + anchor.width) - Math.max(b.left, anchor.left));
    return w <= bubble.width * 0.25;
  };
  for (const left of [vp.width - bubble.width - margin, margin]) {
    const box: Box = { left, top: clampY(anchor.top + 64), width: bubble.width, height: bubble.height };
    if (small(box) && !avoid.some((a) => overlaps(box, a))) return { left: Math.round(left), top: Math.round(box.top), side: "bord" };
  }
  if (dock === "bas-droite") return { left: Math.round(clampX(vp.width - bubble.width - 16)), top: Math.round(clampY(vp.height - bubble.height - 16)), side: "dedans" };
  // Élément trop grand (la carte) : la bulle se pose dedans, vers le bas et le centre, hors des zones à préserver.
  const inside = { left: clampX(cx), top: clampY(anchor.top + anchor.height * 0.62 - bubble.height / 2) };
  for (const top of [inside.top, ...avoid.map((a) => a.top - bubble.height - gap), ...avoid.map((a) => a.top + a.height + gap)]) {
    const box: Box = { left: inside.left, top: clampY(top), width: bubble.width, height: bubble.height };
    if (!avoid.some((a) => overlaps(box, a))) return { left: Math.round(box.left), top: Math.round(box.top), side: "dedans" };
  }
  return { left: Math.round(inside.left), top: Math.round(inside.top), side: "dedans" };
}
