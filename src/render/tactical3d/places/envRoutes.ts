/**
 * Scènes R1b remplacées par un lieu N1 (consigne R1e §2.3) : `?proto3d&env=E01` charge le lieu `shiganshina`. L'ancienne scène
 * générée reste accessible par `&scene=r1b` (outils de comparaison de R1b et R1d : `smoke:r1b`, `mesure:r1d`).
 * Module sans dépendance : lu par le point d'entrée sans charger la visionneuse.
 */
export const ENV_TO_PLACE: Record<string, string> = { E01: "shiganshina" };

export function placeForEnv(q: URLSearchParams): string | null {
  if (q.get("scene") === "r1b") return null;
  return ENV_TO_PLACE[(q.get("env") ?? "").toUpperCase()] ?? null;
}
