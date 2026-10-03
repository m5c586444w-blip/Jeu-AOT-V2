import type { Locale } from "../i18n";
import { toAbsoluteDay } from "../sim/core/time";
import type { GameDate } from "../sim/core/time";

/** Préférences d'interface (F-UIX-17, F-UIX-18), stockées localement ; jamais dans l'état de partie. */
export interface Settings {
  locale: Locale;
  /** Échelle de l'interface DOM en pourcentage (100 à 200). */
  uiScale: number;
}

const KEY = "murs-et-sang:preferences";
export const DEFAULT_SETTINGS: Settings = { locale: "fr", uiScale: 100 };
export const UI_SCALES = [100, 125, 150, 175, 200] as const;

export function loadSettings(storage: Pick<Storage, "getItem"> | null): Settings {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      locale: s.locale === "en" ? "en" : "fr",
      uiScale: typeof s.uiScale === "number" && s.uiScale >= 100 && s.uiScale <= 200 ? s.uiScale : DEFAULT_SETTINGS.uiScale,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: Pick<Storage, "setItem"> | null, s: Settings): void {
  try {
    storage?.setItem(KEY, JSON.stringify(s));
  } catch {
    // Stockage refusé : la préférence vaut pour la session.
  }
}

/** Vrai si l'intervalle de sauvegarde automatique est franchi entre deux dates (F-SYS-03). */
export function crossesAutosave(before: GameDate, after: GameDate, everyDays: number): boolean {
  return Math.floor(toAbsoluteDay(after) / everyDays) > Math.floor(toAbsoluteDay(before) / everyDays);
}
