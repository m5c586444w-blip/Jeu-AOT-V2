/**
 * Calendrier de jeu [A] : année de 360 jours (12 mois × 30), saisons de 3 mois.
 * Le canon ne donne aucun calendrier fin (fichier 12) : ce découpage est une adaptation.
 */
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR;

export type Season = "hiver" | "printemps" | "ete" | "automne";
const SEASONS: readonly Season[] = ["hiver", "printemps", "ete", "automne"];

/** `day` va de 1 à 360. */
export interface GameDate {
  year: number;
  day: number;
}

export const START_DATE: GameDate = { year: 845, day: 1 };

export function isValidDate(d: GameDate): boolean {
  return Number.isInteger(d.year) && Number.isInteger(d.day) && d.day >= 1 && d.day <= DAYS_PER_YEAR;
}

export function advance(d: GameDate, days: number): GameDate {
  if (!Number.isInteger(days) || days < 0) throw new RangeError(`advance : nombre de jours invalide (${days})`);
  const absolute = toAbsoluteDay(d) + days;
  return fromAbsoluteDay(absolute);
}

/** Jour absolu (0 = an 0, jour 1) : utile pour comparer et différencier des dates. */
export function toAbsoluteDay(d: GameDate): number {
  return d.year * DAYS_PER_YEAR + (d.day - 1);
}

export function fromAbsoluteDay(abs: number): GameDate {
  const year = Math.floor(abs / DAYS_PER_YEAR);
  return { year, day: abs - year * DAYS_PER_YEAR + 1 };
}

/** Mois de 1 à 12. */
export function monthOf(d: GameDate): number {
  return Math.floor((d.day - 1) / DAYS_PER_MONTH) + 1;
}

/** Saisons [A] : mois 1–3 hiver, 4–6 printemps, 7–9 été, 10–12 automne. */
export function seasonOf(d: GameDate): Season {
  return SEASONS[Math.floor((monthOf(d) - 1) / 3)] as Season;
}

export function compareDates(a: GameDate, b: GameDate): number {
  return toAbsoluteDay(a) - toAbsoluteDay(b);
}

export function formatDate(d: GameDate): string {
  return `an ${d.year}, jour ${d.day}`;
}
