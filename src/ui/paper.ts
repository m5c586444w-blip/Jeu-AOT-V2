/**
 * Textures de papier procédurales (aucune image externe) : bruit fractal SVG encodé en data URI.
 * Deux grains différents servent au fond et au cadre, pour éviter toute répétition visible.
 */
export function noiseDataUri(opts: { frequency: number; octaves: number; seed: number; alpha: number; size: number }): string {
  const { frequency, octaves, seed, alpha, size } = opts;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 0.11  0 0 0 0 0.10  0 0 0 0 0.09  0 0 0 ${alpha} 0'/></filter>` +
    `<rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Fibres : bruit très étiré horizontalement, comme les fibres d'un papier vergé. */
export function fibreDataUri(seed: number): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420'>` +
    `<filter id='f'><feTurbulence type='turbulence' baseFrequency='0.004 0.09' numOctaves='2' seed='${seed}' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.18  0 0 0 0.10 0'/></filter>` +
    `<rect width='100%' height='100%' filter='url(#f)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Masque d'encrage d'un tampon : presque opaque, avec des manques là où l'encre n'a pas pris. */
export function stampMaskUri(seed: number): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>` +
    `<filter id='m'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${seed}' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.9'/></filter>` +
    `<rect width='100%' height='100%' filter='url(#m)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function applyPaperTextures(root: HTMLElement): void {
  root.style.setProperty("--grain-fond", noiseDataUri({ frequency: 0.85, octaves: 3, seed: 7, alpha: 0.16, size: 300 }));
  root.style.setProperty("--grain-cadre", noiseDataUri({ frequency: 0.55, octaves: 4, seed: 23, alpha: 0.12, size: 260 }));
  root.style.setProperty("--fibres", fibreDataUri(11));
  root.style.setProperty("--masque-tampon", stampMaskUri(5));
  root.style.setProperty("--taches", noiseDataUri({ frequency: 0.012, octaves: 2, seed: 3, alpha: 0.10, size: 900 }));
}
