import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

/** Décodeur PNG minimal (8 bits, RGB ou RGBA, non entrelacé) pour les tests de mesure sur captures. Renvoie du RGBA. */
export function decodePng(path: string): { width: number; height: number; rgba: Uint8Array } {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path} : pas un PNG`);
  let off = 8;
  let width = 0;
  let height = 0;
  let type = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const kind = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (kind === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error(`${path} : profondeur ou entrelacement non pris en charge`);
      type = data[9] as number;
    } else if (kind === "IDAT") idat.push(data);
    else if (kind === "IEND") break;
    off += 12 + len;
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (!bpp) throw new Error(`${path} : type de couleur ${type} non pris en charge`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const px = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)] as number;
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? (px[y * stride + x - bpp] as number) : 0;
      const b = y > 0 ? (px[(y - 1) * stride + x] as number) : 0;
      const c = x >= bpp && y > 0 ? (px[(y - 1) * stride + x - bpp] as number) : 0;
      const v = src[x] as number;
      let p: number;
      if (f === 0) p = v;
      else if (f === 1) p = v + a;
      else if (f === 2) p = v + b;
      else if (f === 3) p = v + ((a + b) >> 1);
      else {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        p = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      px[y * stride + x] = p & 255;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = px[i * bpp] as number;
    rgba[i * 4 + 1] = px[i * bpp + 1] as number;
    rgba[i * 4 + 2] = px[i * bpp + 2] as number;
    rgba[i * 4 + 3] = bpp === 4 ? (px[i * bpp + 3] as number) : 255;
  }
  return { width, height, rgba };
}
