import { fnv1a, toHex8 } from "./hash";

/**
 * JSON canonique : clés d'objets triées récursivement, pour que le hash ne dépende jamais
 * de l'ordre d'insertion (piège du fichier 14 §8).
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) {
      const v = src[k];
      if (v !== undefined) out[k] = sortKeys(v);
    }
    return out;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError(`canonicalJson : nombre non fini (${value})`);
  }
  return value;
}

/** Hash d'état : FNV-1a 32 bits du JSON canonique, en 8 caractères hexadécimaux. */
export function stateHash(value: unknown): string {
  return toHex8(fnv1a(canonicalJson(value)));
}
