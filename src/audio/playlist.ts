import { MOOD_PIECES, PIECE_BY_ID } from "./pieces";
import { renderPiece } from "./render";
import type { Accent, Mood, RenderedPiece } from "./types";

/**
 * Listes de lecture (AUD.2) : ordre mélangé par une graine fixe (aucun `Math.random`), sans pièce répétée avant que toutes les
 * autres aient été jouées, silences entre les pièces. Pur et déterministe.
 */

export const MUSIC_SEED = 20261008;

/** Générateur à congruence (mulberry32) : une graine entière, une suite reproductible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rnd = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * Les `count` premiers éléments de la suite infinie. Premier tour : ordre mélangé par la graine. Tours suivants : une pièce ne
 * peut passer plus d'un rang plus tôt que dans le tour précédent, donc deux jeux d'une même pièce sont séparés d'au moins
 * `ids.length - 1` pièces (soit plus de quatre minutes pour les listes du jeu, vérifié par les tests) ; jamais deux fois de suite.
 */
export function playSequence(ids: readonly string[], count: number, seed = MUSIC_SEED): string[] {
  if (ids.length === 0) return [];
  const out: string[] = [];
  let prev = shuffle(ids, seed >>> 0);
  out.push(...prev);
  for (let cycle = 1; out.length < count; cycle++) {
    const rnd = mulberry32((seed + Math.imul(cycle + 1, 0x9e3779b1)) >>> 0);
    const left = prev.map((id, rank) => ({ id, rank }));
    const next: string[] = [];
    for (let q = 0; left.length > 0; q++) {
      const cands = left.filter((x) => x.rank <= q + 1);
      const pick = cands[Math.floor(rnd() * cands.length)] ?? (left[0] as { id: string; rank: number });
      left.splice(left.indexOf(pick), 1);
      next.push(pick.id);
    }
    out.push(...next);
    prev = next;
  }
  return out.slice(0, count);
}

/** Silence entre deux pièces (secondes) : long et aéré au calme, court au combat. */
const GAP: Record<Mood, readonly [number, number]> = { calme: [6, 11], tension: [3, 6], combat: [1.5, 3.5] };
export function gapSeconds(mood: Mood, counter: number, seed = MUSIC_SEED): number {
  const [lo, hi] = GAP[mood];
  const r = mulberry32((seed ^ Math.imul(counter + 7, 0x85ebca6b) ^ (mood.length * 977)) >>> 0)();
  return Math.round((lo + (hi - lo) * r) * 10) / 10;
}

/**
 * Timbre de chaque état (filtre et volume en plus du choix des pièces) : le calme est plus doux et plus sourd, le combat plus
 * ouvert et plus présent. `cutoff` : fréquence du filtre passe-bas du bus (Hz) ; `gain` : niveau relatif de l'état.
 */
export const MOOD_TONE: Readonly<Record<Mood, { cutoff: number; gain: number }>> = {
  calme: { cutoff: 3200, gain: 0.8 },
  tension: { cutoff: 5200, gain: 0.92 },
  combat: { cutoff: 9500, gain: 1 },
};

const cache = new Map<string, RenderedPiece>();
export function renderCached(id: string, mood: Mood, accent: Accent = "paradis"): RenderedPiece {
  const key = `${id}|${mood}|${accent}`;
  let r = cache.get(key);
  if (!r) {
    const def = PIECE_BY_ID.get(id);
    if (!def) throw new Error(`pièce inconnue : ${id}`);
    r = renderPiece(def, mood, accent);
    cache.set(key, r);
  }
  return r;
}

/** Durée (secondes) d'un tour complet de la liste d'un état : pièces et silences, avant que la première pièce ne revienne. */
export function cycleSeconds(mood: Mood, accent: Accent = "paradis"): number {
  const seq = playSequence(MOOD_PIECES[mood], MOOD_PIECES[mood].length);
  return seq.reduce((a, id, i) => a + renderCached(id, mood, accent).seconds + gapSeconds(mood, i), 0);
}
