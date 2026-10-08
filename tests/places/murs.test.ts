import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BENCH_FACE, benchPlace } from "../../src/render/tactical3d/places/bench";
import { columnLuminance, maxAutocorrelation } from "../../src/render/tactical3d/places/imageMetrics";
import { GATE_VIEWS } from "../../src/tools/places/check";
import { decodePng } from "./png";

/**
 * Murailles et portes (R1e.3, CR1e-05 et CR1e-06), sur le banc d'essai (`?proto3d&lieu=_banc`, captures
 * `npm run places:captures -- _banc`, dans `docs/places/_banc/`).
 * - Parement : vue de face d'un pan nu de 120 m ; luminance moyenne des colonnes entre 6 m et 46 m de haut ; autocorrélation
 *   normalisée pour des décalages de 2 à 30 m : maximum < 0,35. Le parement de R1d (texture répétée tous les 9,6 m), rendu dans
 *   la même vue, sert de témoin : il dépasse le seuil.
 * - Portes : 7 vues par porte, non vides ; ΔE moyen (grille 64 × 36) ≥ 6 entre deux vues quelconques d'une porte, et entre la
 *   face extérieure de la porte extérieure et celle de la porte intérieure (`docs/reports/places-_banc.json`).
 */
const DIR = "docs/places/_banc";
/** Seuil du plan R1e (§2) : le témoin de R1d doit le dépasser. */
export const PAREMENT_MAX = 0.35;
/**
 * Décision de l'utilisateur (2026-10-07, D-103) : après deux essais (0,689 puis 0,501, pic isolé à 20 m), le parement de R1e
 * est accepté « à 0,5 pour le moment » ; la cible 0,35 reste en dette (docs/reports/dette.md, n° 8).
 */
export const PAREMENT_ACCEPTE = 0.51;

function faceAutocorr(file: string): { max: number; lagM: number } {
  const img = decodePng(file);
  const pxPerM = img.width / BENCH_FACE.width;
  // Caméra à mi-hauteur (26 m) : rang de l'altitude z.
  const row = (z: number): number => img.height / 2 - (z - 26) * pxPerM;
  const series = columnLuminance(img.rgba, img.width, img.height, row(46), row(6));
  const r = maxAutocorrelation(series, 2 * pxPerM, 30 * pxPerM);
  return { max: r.max, lagM: r.lag / pxPerM };
}

describe("R1e.3 — parement sans motif répété (CR1e-05)", () => {
  it("autocorrélation des colonnes (2–30 m) : parement R1e < 0,51 (accepté, cible 0,35), témoin R1d > 0,35", () => {
    const now = faceAutocorr(`${DIR}/vue-mur-face.png`);
    const r1d = faceAutocorr(`${DIR}/mur-face-r1d.png`);
    console.log(`parement R1e : max ${now.max.toFixed(3)} à ${now.lagM.toFixed(1)} m ; témoin R1d : max ${r1d.max.toFixed(3)} à ${r1d.lagM.toFixed(1)} m`);
    expect(r1d.max).toBeGreaterThan(PAREMENT_MAX);
    expect(now.max).toBeLessThan(PAREMENT_ACCEPTE);
  });
});

describe("R1e.3 — portes du banc (CR1e-06)", () => {
  const place = benchPlace();
  const report = existsSync(`docs/reports/places-_banc.json`) ? (JSON.parse(readFileSync("docs/reports/places-_banc.json", "utf8")) as { dE: Record<string, number> }) : { dE: {} };
  it("7 vues par porte, non vides (image non uniforme)", () => {
    for (const g of place.portes) {
      for (const v of GATE_VIEWS) {
        const f = `${DIR}/porte-${g.id}-${v}.png`;
        expect(existsSync(f), f).toBe(true);
        const img = decodePng(f);
        const lum = columnLuminance(img.rgba, img.width, img.height, 0, img.height);
        const mean = lum.reduce((s, x) => s + x, 0) / lum.length;
        const sd = Math.sqrt(lum.reduce((s, x) => s + (x - mean) ** 2, 0) / lum.length);
        expect(sd, `${f} : écart-type des colonnes`).toBeGreaterThan(2);
      }
    }
  });
  it("vues deux à deux distinctes (ΔE moyen ≥ 6) ; porte extérieure ≠ porte intérieure", () => {
    const pairs = Object.entries(report.dE);
    for (const g of place.portes) {
      const own = pairs.filter(([k]) => k.split(" | ").every((x) => x.startsWith(`porte-${g.id}-`)));
      expect(own.length, g.id).toBe((GATE_VIEWS.length * (GATE_VIEWS.length - 1)) / 2);
      for (const [k, v] of own) expect(v, k).toBeGreaterThanOrEqual(6);
    }
    const ei = report.dE["porte-exterieure-exterieure-face | porte-interieure-exterieure-face"];
    expect(ei).toBeGreaterThanOrEqual(6);
  });
});
