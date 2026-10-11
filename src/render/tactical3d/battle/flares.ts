/**
 * Fusées de signal en 3D (03 §7 ; code du Corps, C : rouge = Titan repéré, noire = Titan anormal, verte = changement de
 * direction ou repli). La simulation lance la fusée (`BattleSignal`) ; la vue la montre comme une traînée de fumée colorée
 * qui monte du chef d'escouade, dérive avec le vent et s'efface. Hauteur, durées et teintes : choix de rendu (A).
 */

/** Teintes des fumées (les couleurs du code sont C ; les teintes exactes, A). */
export const FLARE_COLORS = { rouge: 0xc0392b, noir: 0x1c1c1c, vert: 0x3c8a4a } as const;
/** Durée de vie d'une traînée (s), montée de la fusée (s), hauteur atteinte (m), bouffées par traînée. */
export const FLARE_LIFE_S = 10;
export const FLARE_RISE_S = 1.6;
export const FLARE_TOP_M = 42;
export const FLARE_PUFFS = 22;
/** Hauteur de tir (m) : la main levée du tireur. */
const LAUNCH_M = 1.6;

/** Bouffée de fumée (coordonnées de la carte : x, y au sol, z altitude ; r : rayon) ; `head` : la fusée elle-même. */
export interface FlarePuff {
  x: number;
  y: number;
  z: number;
  r: number;
  head: boolean;
}

/**
 * Bouffées d'une fusée à l'instant `time` (s de bataille) : aucune avant le tir ni après sa durée de vie. `still`
 * (mouvements réduits) : traînée montrée entière, sans montée ni dérive.
 */
export function flarePuffs(s: { t: number; x: number; y: number }, time: number, still = false): FlarePuff[] {
  const age = time - s.t;
  if (age < 0 || age > FLARE_LIFE_S) return [];
  const rise = still ? 1 : Math.min(1, age / FLARE_RISE_S);
  // La fusée ralentit en montant (sortie rapide, fin de course lente).
  const top = LAUNCH_M + FLARE_TOP_M * (1 - (1 - rise) ** 2);
  const fade = age > FLARE_LIFE_S - 3 ? (FLARE_LIFE_S - age) / 3 : 1;
  const drift = still ? 0 : age * 0.5;
  const n = Math.max(2, Math.ceil(FLARE_PUFFS * rise));
  const out: FlarePuff[] = [];
  for (let i = 0; i < n; i++) {
    const z = LAUNCH_M + ((top - LAUNCH_M) * i) / (n - 1);
    // Plus haut, la fumée est plus vieille : plus large, plus déportée par le vent.
    const k = (z - LAUNCH_M) / FLARE_TOP_M;
    const r = (0.6 + 0.9 * k) * (1 + 0.18 * age) * fade;
    // Bouffées un peu décalées (fixe pour une fusée) : une colonne de fumée, pas un chapelet de billes.
    const jx = still ? 0 : Math.sin(i * 2.39 + s.t * 7.1) * 0.3 * r;
    const jy = still ? 0 : Math.cos(i * 1.73 + s.t * 5.3) * 0.3 * r;
    out.push({ x: s.x + drift * k + jx, y: s.y + drift * 0.4 * k + jy, z, r, head: false });
  }
  const kTop = (top - LAUNCH_M) / FLARE_TOP_M;
  if (!still && age < FLARE_RISE_S) out.push({ x: s.x + drift * kTop, y: s.y + drift * 0.4 * kTop, z: top, r: 0.45, head: true });
  return out;
}
