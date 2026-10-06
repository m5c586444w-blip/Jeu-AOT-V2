/**
 * Écriture minimale d'un fichier glTF 2.0 binaire (`.glb`), déterministe (outil Node). Accessoires, vues de tampon, accesseurs
 * pleins, vides (zéros) ou épars, puis assemblage JSON + BIN alignés sur 4 octets.
 */
export const FLOAT = 5126;
export const UNSIGNED_SHORT = 5123;
export const UNSIGNED_INT = 5125;
export const UNSIGNED_BYTE = 5121;
export const ARRAY_BUFFER = 34962;
export const ELEMENT_ARRAY_BUFFER = 34963;

type Json = Record<string, unknown>;

export class GlbWriter {
  readonly json: Json & { accessors: Json[]; bufferViews: Json[]; nodes: Json[]; meshes: Json[]; materials: Json[]; skins: Json[]; scenes: Json[] };
  private readonly chunks: Buffer[] = [];
  private length = 0;

  constructor(generator: string) {
    this.json = { asset: { version: "2.0", generator }, accessors: [], bufferViews: [], nodes: [], meshes: [], materials: [], skins: [], scenes: [], scene: 0 };
  }

  private view(data: Uint8Array, target?: number): number {
    const pad = (4 - (this.length % 4)) % 4;
    if (pad) {
      this.chunks.push(Buffer.alloc(pad));
      this.length += pad;
    }
    const v: Json = { buffer: 0, byteOffset: this.length, byteLength: data.byteLength };
    if (target !== undefined) v["target"] = target;
    this.chunks.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    this.length += data.byteLength;
    this.json.bufferViews.push(v);
    return this.json.bufferViews.length - 1;
  }

  private minMax(data: Float32Array, comps: number): { min: number[]; max: number[] } {
    const min = new Array<number>(comps).fill(Infinity);
    const max = new Array<number>(comps).fill(-Infinity);
    for (let i = 0; i < data.length; i++) {
      const k = i % comps;
      const v = data[i] as number;
      if (v < (min[k] as number)) min[k] = v;
      if (v > (max[k] as number)) max[k] = v;
    }
    return { min: min.map((x) => (Number.isFinite(x) ? x : 0)), max: max.map((x) => (Number.isFinite(x) ? x : 0)) };
  }

  /** Accesseur plein. `bounds` : min et max (obligatoires pour POSITION). */
  accessor(data: Float32Array | Uint16Array | Uint32Array | Uint8Array, type: "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT4", opts: { target?: number; bounds?: boolean; normalized?: boolean } = {}): number {
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    const componentType = data instanceof Float32Array ? FLOAT : data instanceof Uint16Array ? UNSIGNED_SHORT : data instanceof Uint32Array ? UNSIGNED_INT : UNSIGNED_BYTE;
    const a: Json = { bufferView: this.view(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), opts.target), componentType, count: data.length / comps, type };
    if (opts.normalized) a["normalized"] = true;
    if (opts.bounds && data instanceof Float32Array) Object.assign(a, this.minMax(data, comps));
    this.json.accessors.push(a);
    return this.json.accessors.length - 1;
  }

  /**
   * Accesseur VEC3 flottant de `count` éléments, nuls sauf aux indices donnés (accesseur épars). Sans indice : accesseur sans
   * vue de tampon, initialisé à zéro (glTF 2.0, § 3.6.2.1).
   */
  sparseVec3(count: number, indices: Uint32Array, values: Float32Array): number {
    const bounds = this.minMax(values, 3);
    const min = bounds.min.map((x) => Math.min(0, x));
    const max = bounds.max.map((x) => Math.max(0, x));
    const a: Json = { componentType: FLOAT, count, type: "VEC3", min, max };
    if (indices.length > 0) {
      const small = count < 65536;
      const idx = small ? Uint16Array.from(indices) : indices;
      a["sparse"] = {
        count: indices.length,
        indices: { bufferView: this.view(new Uint8Array(idx.buffer, idx.byteOffset, idx.byteLength)), componentType: small ? UNSIGNED_SHORT : UNSIGNED_INT },
        values: { bufferView: this.view(new Uint8Array(values.buffer, values.byteOffset, values.byteLength)) },
      };
    }
    this.json.accessors.push(a);
    return this.json.accessors.length - 1;
  }

  finish(): Buffer {
    const bin = Buffer.concat(this.chunks);
    const binPadded = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
    this.json["buffers"] = [{ byteLength: binPadded.length }];
    // Les listes vides ne s'écrivent pas (glTF : un tableau présent doit avoir au moins un élément).
    const out = Object.fromEntries(Object.entries(this.json).filter(([, v]) => !Array.isArray(v) || v.length > 0));
    const jsonBuf = Buffer.from(JSON.stringify(out), "utf8");
    const jsonPadded = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8);
    const jh = Buffer.alloc(8);
    jh.writeUInt32LE(jsonPadded.length, 0);
    jh.writeUInt32LE(0x4e4f534a, 4);
    const bh = Buffer.alloc(8);
    bh.writeUInt32LE(binPadded.length, 0);
    bh.writeUInt32LE(0x004e4942, 4);
    return Buffer.concat([header, jh, jsonPadded, bh, binPadded]);
  }
}
