/** FNV-1a 32 bits (offset 0x811c9dc5, prime 0x01000193) sur les unités UTF-16 d'une chaîne. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Hash 32 bits formaté en 8 caractères hexadécimaux. */
export function toHex8(value: number): string {
  return (value >>> 0).toString(16).padStart(8, "0");
}
