import { BIOMES, decodeGrid } from "../data/terrain";
import type { TerrainData } from "../data/terrain";

/**
 * Image du terrain (MAP.3) : relief ombré (lumière du nord-ouest), teintes par milieu, profondeur de l'eau, écume.
 * Calcul pur (aucun DOM) : renvoie des pixels RGBA, posés ensuite dans une texture par le rendu Pixi.
 */
const COLORS: Record<(typeof BIOMES)[number], number> = {
  mer_profonde: 0x2c4658,
  mer: 0x4b6f80,
  plage: 0xd2c49a,
  prairie: 0x8e9e60,
  cultures: 0xa9a96e,
  foret: 0x4c6a3c,
  arbres_geants: 0x2c4a2a,
  marais: 0x667458,
  collines: 0x8c8c5e,
  montagne: 0x8b806b,
  roche: 0xaaa497,
  lac: 0x56798c,
  ville: 0x8e8070,
  falaise: 0x8a7e6a,
  foret_morte: 0x6f6a52,
  steppe: 0xb3a777,
};
const RGB = BIOMES.map((b) => {
  const c = COLORS[b];
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff] as const;
});
const WATER = new Set([BIOMES.indexOf("mer_profonde"), BIOMES.indexOf("mer"), BIOMES.indexOf("lac")]);

function hash(x: number, y: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export interface TerrainImage {
  size: number;
  pixels: Uint8ClampedArray<ArrayBuffer>;
}

/** Rend le terrain en `size` × `size` pixels sur l'emprise `bounds` du fichier. */
export function renderTerrain(t: Pick<TerrainData, "grid" | "height" | "biome">, size: number): TerrainImage {
  const n = t.grid.n;
  const sea = t.grid.sea_level;
  const hRaw = decodeGrid(t.height);
  const bRaw = decodeGrid(t.biome);
  // Altitude en unités relatives : mer dans [-1, 0), terre dans [0, 1].
  const elev = new Float32Array(n * n);
  for (let k = 0; k < n * n; k++) {
    const h = hRaw[k] ?? 0;
    elev[k] = h < sea ? h / (sea - 1) - 1 : (h - sea) / (255 - sea);
  }
  const at = (gx: number, gy: number): number => {
    const x = Math.max(0, Math.min(n - 1.001, gx));
    const y = Math.max(0, Math.min(n - 1.001, gy));
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const k = iy * n + ix;
    const a = elev[k] ?? 0;
    const b = elev[k + 1] ?? 0;
    const c = elev[k + n] ?? 0;
    const d = elev[k + n + 1] ?? 0;
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const biomeAt = (gx: number, gy: number): number => {
    const x = Math.max(0, Math.min(n - 1, Math.round(gx)));
    const y = Math.max(0, Math.min(n - 1, Math.round(gy)));
    return bRaw[y * n + x] ?? 0;
  };
  const pixels = new Uint8ClampedArray(size * size * 4);
  const scale = n / size;
  const step = scale * 0.9;
  // Lumière du nord-ouest, hauteur 40° ; relief exagéré pour la lecture à l'échelle de l'île.
  const lx = -0.6;
  const ly = -0.6;
  const lz = 0.53;
  const exaggeration = 40;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const gx = (px + 0.5) * scale - 0.5;
      const gy = (py + 0.5) * scale - 0.5;
      // Bord des milieux irrégulier : l'échantillon de milieu est décalé par un bruit fin.
      const jx = (noise(gx * 1.7, gy * 1.7) - 0.5) * 1.6 + (noise(gx * 6, gy * 6) - 0.5) * 0.6;
      const jy = (noise(gx * 1.7 + 31, gy * 1.7 + 17) - 0.5) * 1.6 + (noise(gx * 6 + 9, gy * 6 + 4) - 0.5) * 0.6;
      const bio = biomeAt(gx + jx, gy + jy);
      const e = at(gx, gy);
      const fine = (noise(gx * 3.1, gy * 3.1) - 0.5) * 0.02 + (noise(gx * 9, gy * 9) - 0.5) * 0.008;
      const dx = (at(gx + step, gy) - at(gx - step, gy)) * exaggeration + (noise(gx * 7 + 3, gy * 7) - 0.5) * 0.12;
      const dy = (at(gx, gy + step) - at(gx, gy - step)) * exaggeration + (noise(gx * 7, gy * 7 + 5) - 0.5) * 0.12;
      const len = Math.hypot(dx, dy, 1);
      const shade = (-dx * lx - dy * ly + lz) / len;
      const [r0, g0, b0] = RGB[bio] ?? [128, 128, 128];
      let r: number;
      let g: number;
      let b: number;
      if (WATER.has(bio)) {
        // Eau : plus claire près des côtes, écume sur le rivage.
        const depth = Math.max(0, -e);
        const k = bio === BIOMES.indexOf("lac") ? 0.15 : Math.min(1, depth * 1.5);
        r = 104 + (40 - 104) * k;
        g = 140 + (68 - 140) * k;
        b = 152 + (88 - 152) * k;
        const shore = e > -0.035 && bio !== BIOMES.indexOf("lac") ? (0.035 + e) / 0.035 : 0;
        // Les rides s'éteignent au large : la mer profonde a exactement la couleur de la mer hors image.
        const ripple = (noise(gx * 2.3, gy * 2.3) - 0.5) * 8 * (1 - k);
        r += shore * 70 + ripple;
        g += shore * 64 + ripple;
        b += shore * 52 + ripple;
      } else {
        // Terre : relief ombré, variation de teinte, champs en parcelles, sommets plus clairs.
        // Teinte mêlée des 4 cellules voisines (poids bilinéaires accentués) : bords des milieux doux, sans marches.
        const sx = gx + jx * 0.5;
        const sy = gy + jy * 0.5;
        const ix = Math.floor(sx);
        const iy = Math.floor(sy);
        const fx = sx - ix;
        const fy = sy - iy;
        let wr = 0;
        let wg = 0;
        let wb = 0;
        let wt = 0;
        for (const [ox, oy, w0] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]] as const) {
          const nb = biomeAt(ix + ox, iy + oy);
          const [cr, cg, cb] = WATER.has(nb) ? [r0, g0, b0] : (RGB[nb] ?? [r0, g0, b0]);
          const w = w0 * w0 * w0;
          wr += cr * w;
          wg += cg * w;
          wb += cb * w;
          wt += w;
        }
        const mix = 0.65;
        const br = r0 * (1 - mix) + (wr / wt) * mix;
        const bg = g0 * (1 - mix) + (wg / wt) * mix;
        const bb = b0 * (1 - mix) + (wb / wt) * mix;
        const light = 0.55 + 0.75 * Math.max(0, shade);
        const tint = 1 + fine * 6 + (noise(gx * 0.9, gy * 0.9) - 0.5) * 0.12;
        let fr = br * light * tint;
        let fg = bg * light * tint;
        let fb = bb * light * tint;
        if (bio === BIOMES.indexOf("cultures")) {
          const plot = hash(Math.floor(gx * 1.3 + noise(gx, gy) * 0.8), Math.floor(gy * 1.3 + noise(gy, gx) * 0.8));
          const f = 0.95 + plot * 0.09;
          fr *= f;
          fg *= f * (plot > 0.7 ? 1.06 : 1);
          fb *= f * 0.95;
        }
        if (bio === BIOMES.indexOf("foret") || bio === BIOMES.indexOf("arbres_geants") || bio === BIOMES.indexOf("foret_morte")) {
          const crown = noise(gx * 11, gy * 11);
          fr *= 0.85 + crown * 0.3;
          fg *= 0.85 + crown * 0.3;
          fb *= 0.85 + crown * 0.25;
        }
        if (e > 0.68) {
          const snow = Math.min(1, (e - 0.68) / 0.12);
          fr += (236 - fr) * snow * 0.8;
          fg += (236 - fg) * snow * 0.8;
          fb += (232 - fb) * snow * 0.8;
        }
        r = fr;
        g = fg;
        b = fb;
      }
      const o = (py * size + px) * 4;
      pixels[o] = r;
      pixels[o + 1] = g;
      pixels[o + 2] = b;
      pixels[o + 3] = 255;
    }
  }
  return { size, pixels };
}
