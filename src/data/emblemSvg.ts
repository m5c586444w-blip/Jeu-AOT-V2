import type { Emblem } from "./emblemSchemas";

/** Contours du champ (grille 48 × 48), communs à tous les rendus. */
const FIELD_PATH: Readonly<Record<Emblem["field"], string>> = {
  rond: "M24 1a23 23 0 1 1 0 46 23 23 0 0 1 0-46Z",
  ecu: "M6 3h36v24c0 9-8 16-18 20C14 43 6 36 6 27Z",
  losange: "M24 1 46 24 24 47 2 24Z",
};

const attr = (s: string): string => s.replace(/[&"<>]/g, "");

/** Trait unique, `currentColor` : pour l'interface (blason de nation, en-têtes). Déterministe. */
export function emblemLineSvg(e: Emblem): string {
  const d = e.charges.map((c) => c.d).join(" ");
  return `<svg class="blason" data-emblem="${attr(e.id)}" data-canon="${e.canon}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="${attr(d)}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Version en couleurs (champ, traits, accents) : même définition, pour la texture et le décalque 3D (SVG autonome). */
export function emblemColorSvg(e: Emblem, size = 256): string {
  const { field, line, accent } = e.colors;
  const parts = e.charges.map((c) => {
    if (c.role === "fill") return `<path d="${attr(c.d)}" fill="${line}" stroke="none"/>`;
    const stroke = c.role === "accent" ? accent : line;
    return `<path d="${attr(c.d)}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48" data-emblem="${attr(e.id)}"><defs><clipPath id="clip_${attr(e.id)}"><path d="${FIELD_PATH[e.field]}"/></clipPath></defs><path d="${FIELD_PATH[e.field]}" fill="${field}"/><g clip-path="url(#clip_${attr(e.id)})">${parts.join("")}</g><path d="${FIELD_PATH[e.field]}" fill="none" stroke="${accent}" stroke-width="1.2"/></svg>`;
}
