/**
 * Mesures sur images (R1e, CR1e-05) : luminance moyenne des colonnes d'une bande de l'image, autocorrélation normalisée
 * (moyenne retirée) d'une série à un décalage donné, maximum sur une plage de décalages. Calcul pur (tampons RGBA).
 */
export function columnLuminance(rgba: Uint8Array, w: number, h: number, y0: number, y1: number, x0 = 0, x1 = w): Float64Array {
  const out = new Float64Array(x1 - x0);
  const r0 = Math.max(0, Math.min(h, Math.round(y0)));
  const r1 = Math.max(r0 + 1, Math.min(h, Math.round(y1)));
  for (let x = x0; x < x1; x++) {
    let s = 0;
    for (let y = r0; y < r1; y++) {
      const i = (y * w + x) * 4;
      s += 0.2126 * (rgba[i] as number) + 0.7152 * (rgba[i + 1] as number) + 0.0722 * (rgba[i + 2] as number);
    }
    out[x - x0] = s / (r1 - r0);
  }
  return out;
}

/** Autocorrélation normalisée au décalage `lag` (−1 à 1). */
export function autocorrelation(s: ArrayLike<number>, lag: number): number {
  const n = s.length;
  if (lag <= 0 || lag >= n) return lag === 0 ? 1 : 0;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += s[i] as number;
  mean /= n;
  let den = 0;
  for (let i = 0; i < n; i++) den += ((s[i] as number) - mean) ** 2;
  if (den <= 1e-12) return 0;
  let num = 0;
  for (let i = 0; i + lag < n; i++) num += ((s[i] as number) - mean) * ((s[i + lag] as number) - mean);
  // Normalisation par le nombre de paires (estimateur sans biais de longueur).
  return (num / (n - lag)) / (den / n);
}

/** Maximum de l'autocorrélation entre `minLag` et `maxLag` (en échantillons), et le décalage atteint. */
export function maxAutocorrelation(s: ArrayLike<number>, minLag: number, maxLag: number): { max: number; lag: number } {
  let best = -Infinity;
  let at = minLag;
  for (let l = Math.max(1, Math.round(minLag)); l <= Math.min(s.length - 2, Math.round(maxLag)); l++) {
    const r = autocorrelation(s, l);
    if (r > best) {
      best = r;
      at = l;
    }
  }
  return { max: best, lag: at };
}
