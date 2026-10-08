import type { Locale } from "../i18n";
import { toAbsoluteDay } from "../sim/core/time";
import type { GameDate } from "../sim/core/time";

/** Préférences d'interface (F-UIX-17, F-UIX-18), stockées localement ; jamais dans l'état de partie. */
export interface Settings {
  locale: Locale;
  /** Échelle de l'interface DOM en pourcentage (100 à 200). */
  uiScale: number;
  /** Volumes (0 à 100) et sous-titres des sons importants (04 §7, P8). */
  volMaster: number;
  volMusic: number;
  volSfx: number;
  subtitles: boolean;
  /** Mode auteur (E-UX-1) : statuts canon et codes internes visibles ; désactivé par défaut. */
  authorMode: boolean;
}

const KEY = "murs-et-sang:preferences";
export const DEFAULT_SETTINGS: Settings = { locale: "fr", uiScale: 100, volMaster: 70, volMusic: 60, volSfx: 80, subtitles: true, authorMode: false };
export const UI_SCALES = [100, 125, 150, 175, 200] as const;

const vol = (v: unknown, d: number): number => (typeof v === "number" && v >= 0 && v <= 100 ? Math.round(v) : d);

/** Volumes du moteur audio tirés des préférences. */
export const volumesOf = (s: Settings): { master: number; music: number; sfx: number; subtitles: boolean } => ({ master: s.volMaster, music: s.volMusic, sfx: s.volSfx, subtitles: s.subtitles });

export function loadSettings(storage: Pick<Storage, "getItem"> | null): Settings {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      locale: s.locale === "en" ? "en" : "fr",
      uiScale: typeof s.uiScale === "number" && s.uiScale >= 100 && s.uiScale <= 200 ? s.uiScale : DEFAULT_SETTINGS.uiScale,
      volMaster: vol(s.volMaster, DEFAULT_SETTINGS.volMaster),
      volMusic: vol(s.volMusic, DEFAULT_SETTINGS.volMusic),
      volSfx: vol(s.volSfx, DEFAULT_SETTINGS.volSfx),
      subtitles: typeof s.subtitles === "boolean" ? s.subtitles : DEFAULT_SETTINGS.subtitles,
      authorMode: s.authorMode === true,
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

/**
 * Échelle d'interface (100 à 200 %) : `--ui-echelle` règle la taille de base (base.css), multipliée par le facteur de
 * hauteur d'écran (tokens.css). Le style en ligne `font-size` reste posé pour les contrôles existants (AC1-14).
 */
export function applyUiScale(percent: number): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.fontSize = `${percent}%`;
  root.style.setProperty("--ui-echelle", String(percent / 100));
}

/** Dernière partie lancée dans ce navigateur (scénario, nation) : l'entrée « Continuer » du menu principal la reprend. */
export const LAST_GAME_KEY = "murs-et-sang:derniere-partie";
