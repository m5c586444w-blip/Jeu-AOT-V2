import { CUSTOM_DIFFICULTY_KEYS, CustomDifficultySchema } from "../data/endingSchemas";
import type { CustomDifficulty } from "../data/endingSchemas";

/** Difficulté personnalisée (P10.1) : réglages par défaut = monde inchangé (multiplicateurs 1, décalages 0). */
export const DEFAULT_CUSTOM: CustomDifficulty = { production: 1, titans: 1, ia_attaque: 1, pertes: 1, moral: 0, stabilite: 0 };

/** Paramètre d'URL `dp` : six nombres séparés par des virgules, dans l'ordre de CUSTOM_DIFFICULTY_KEYS. */
export function customDifficultyParam(c: CustomDifficulty): string {
  return CUSTOM_DIFFICULTY_KEYS.map((k) => String(c[k])).join(",");
}

/** Lecture validée (bornes du schéma) ; null si absent ou invalide. */
export function parseCustomDifficulty(raw: string | null): CustomDifficulty | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== CUSTOM_DIFFICULTY_KEYS.length || parts.some((x) => !Number.isFinite(x))) return null;
  const r = CustomDifficultySchema.safeParse(Object.fromEntries(CUSTOM_DIFFICULTY_KEYS.map((k, i) => [k, parts[i]])));
  return r.success ? r.data : null;
}
