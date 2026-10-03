import { Texture } from "pixi.js";
import { Rng } from "../sim/core/rng";

/**
 * Texture de papier procédurale (aucune image externe) : bruit de valeur à plusieurs octaves + fibres.
 * Générée une fois sur un canvas 2D puis répétée ; la taille (512) et le bruit basse fréquence évitent un motif visible.
 */
export function paperTexture(seed = 845, size = 512): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Texture.WHITE;
  const rng = new Rng(seed);
  const grid = (cells: number): number[] => Array.from({ length: (cells + 1) * (cells + 1) }, () => rng.next());
  const octaves = [4, 16, 64, 128].map((cells) => ({ cells, g: grid(cells) }));
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      let w = 0;
      octaves.forEach(({ cells, g }, i) => {
        const fx = (x / size) * cells;
        const fy = (y / size) * cells;
        const ix = Math.floor(fx) % cells;
        const iy = Math.floor(fy) % cells;
        const tx = fx - Math.floor(fx);
        const ty = fy - Math.floor(fy);
        const at = (a: number, b: number): number => g[(b % cells) * (cells + 1) + (a % cells)] ?? 0;
        const top = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx;
        const bot = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx;
        const weight = 1 / (i + 1);
        v += (top * (1 - ty) + bot * ty) * weight;
        w += weight;
      });
      const n = v / w;
      const fibre = rng.next() < 0.004 ? 18 : 0;
      const k = (y * size + x) * 4;
      const shade = 232 - (n - 0.5) * 26 - fibre;
      img.data[k] = shade;
      img.data[k + 1] = shade - 10;
      img.data[k + 2] = shade - 30;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return Texture.from(canvas);
}
