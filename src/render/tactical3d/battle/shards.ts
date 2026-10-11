/**
 * Lames brisées (CLAUDE.md § Style des soldats : « lames longues et fines, cassables et remplaçables », C). Quand la
 * simulation retire une paire de lames à un soldat (usure, `pairs` qui baisse), la vue lâche les deux lames usées : elles
 * tombent en tournoyant depuis les mains, rebondissent à peine et restent au sol quelques secondes. Trajectoires tirées de
 * l'événement (pas d'aléa à l'image) ; vitesses, durées et tailles : choix de rendu (A).
 */

export interface BladeBreak {
  /** Temps de bataille (s) de la casse, position du soldat (x, y de la carte ; z hauteur), cap (rad), graine. */
  t: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  seed: number;
}

export interface Shard {
  x: number;
  y: number;
  z: number;
  /** Rotation (rad) autour de l'axe de la lame et basculement ; à terre, posée à plat. */
  spin: number;
  tilt: number;
  grounded: boolean;
}

/** Durée de vie (s) d'une lame lâchée ; gravité (m/s²) ; nombre de lames par paire. */
export const SHARD_LIFE_S = 4;
const G = 9.8;
export const SHARDS_PER_BREAK = 2;

/** Nombre pseudo-aléatoire dans [0, 1) tiré d'une graine entière et d'un rang (fonction pure). */
function hash01(seed: number, k: number): number {
  let h = (seed * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Lames visibles au temps `time` pour une casse ; liste vide avant la casse et après la durée de vie. */
export function shardsAt(b: BladeBreak, time: number, calm = false): Shard[] {
  const age = time - b.t;
  if (age < 0 || age > SHARD_LIFE_S) return [];
  const out: Shard[] = [];
  for (let k = 0; k < SHARDS_PER_BREAK; k++) {
    const side = k === 0 ? 1 : -1;
    // Départ : la main (0,35 m de côté, 1,1 m au-dessus des pieds), lancée vers l'extérieur et un peu vers le haut.
    const across = b.heading + (side * Math.PI) / 2;
    const x0 = b.x + Math.cos(across) * 0.35;
    const y0 = b.y + Math.sin(across) * 0.35;
    const z0 = b.z + 1.1;
    const v = 1.2 + hash01(b.seed, k) * 1.6;
    const vx = Math.cos(across) * v + Math.cos(b.heading) * (hash01(b.seed, k + 7) - 0.5);
    const vy = Math.sin(across) * v + Math.sin(b.heading) * (hash01(b.seed, k + 9) - 0.5);
    const vz = 1 + hash01(b.seed, k + 3) * 1.5;
    // Temps de chute jusqu'au sol (z = 0,02) ; mouvements réduits : lames posées au sol d'emblée.
    const tFall = (vz + Math.sqrt(vz * vz + 2 * G * Math.max(0, z0 - 0.02))) / G;
    const ta = calm ? tFall : Math.min(age, tFall);
    const grounded = calm || age >= tFall;
    const rate = 9 + hash01(b.seed, k + 5) * 8;
    out.push({
      x: x0 + vx * ta,
      y: y0 + vy * ta,
      z: grounded ? 0.02 : z0 + vz * ta - 0.5 * G * ta * ta,
      spin: grounded ? hash01(b.seed, k + 11) * Math.PI * 2 : rate * ta,
      tilt: grounded ? Math.PI / 2 : rate * 0.7 * ta,
      grounded,
    });
  }
  return out;
}
