import type { TideBalance } from "../../data/balance";
import type { Season } from "../core/time";

/** Nuit si l'heure est avant l'aube ou à partir du crépuscule. */
export function isNight(hour: number, b: TideBalance): boolean {
  const h = ((hour % 24) + 24) % 24;
  return h < b.activity.dawn_hour || h >= b.activity.dusk_hour;
}

/** Activité des Titans purs (03 §5.2) : plus faible la nuit et l'hiver, plus forte au soleil. Produit jour/nuit × saison. */
export function activityOf(hour: number, season: Season, b: TideBalance): number {
  const a = b.activity;
  return (isNight(hour, b) ? a.night : a.day) * a.season[season];
}

/** Activité locale : sous le seuil d'immobilité, un Titan ne bouge pas (0) sauf si l'attention locale atteint le seuil de réveil. */
export function localActivity(global: number, attention: number, b: TideBalance): number {
  if (global >= b.activity.immobile_below) return global;
  return attention >= b.activity.wake_attention ? Math.max(global, b.activity.wake_activity) : 0;
}

export function titanMode(global: number, attention: number, b: TideBalance): "actif" | "immobile" {
  return localActivity(global, attention, b) < b.activity.immobile_below ? "immobile" : "actif";
}
