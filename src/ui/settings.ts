import type { Mood } from "../audio/types";
import type { Locale } from "../i18n";
import { toAbsoluteDay } from "../sim/core/time";
import type { MusicLibrary, Volumes } from "./audio";
import type { GameDate } from "../sim/core/time";

/** Préférences d'interface (F-UIX-17, F-UIX-18), stockées localement ; jamais dans l'état de partie. */
export interface Settings {
  locale: Locale;
  /** Échelle de l'interface DOM en pourcentage (100 à 200). */
  uiScale: number;
  /** Volumes (0 à 100) et sous-titres des sons importants (04 §7, P8). */
  volMaster: number;
  volMusic: number;
  /** Ambiances de lieu (vent, ville, forêt, mur), effets de bataille, sons d'interface et de notification (AUD.5). */
  volAmbient: number;
  volSfx: number;
  volUi: number;
  subtitles: boolean;
  /** La musique ne joue qu'au combat (AUD.5). */
  musicCombatOnly: boolean;
  /** Source de la musique : pièces du jeu, pièces + pistes de l'utilisateur, ou pistes de l'utilisateur seules (AUD.4). */
  musicSource: MusicSource;
  /** État affecté à chaque piste de `assets_user/musique/` (nom de fichier → état, ou « off » pour l'écarter). */
  userTracks: Record<string, Mood | "off">;
  /** Mode auteur (E-UX-1) : statuts canon et codes internes visibles ; désactivé par défaut. */
  authorMode: boolean;
  /** Tutoriel guidé et aides contextuelles (TUT.2) : préférences locales, jamais dans l'état de partie. */
  tutorial: TutorialPrefs;
  /** Révision de la musique : des préférences antérieures à la musique d'AUD reprennent le volume de musique par défaut. */
  audioRev?: number;
}

/** Tutoriel : terminé ou quitté (`done`), désactivé à la demande (`disabled`), aides contextuelles actives (`hints`), éléments déjà expliqués (`seen`). */
export interface TutorialPrefs {
  done: boolean;
  disabled: boolean;
  hints: boolean;
  seen: string[];
}
export const DEFAULT_TUTORIAL: TutorialPrefs = { done: false, disabled: false, hints: false, seen: [] };

const KEY = "murs-et-sang:preferences";
/** Révision 2 : musique d'AUD (D-117). Les anciennes préférences gardaient 60 % de musique, soit un gain de 0,42 > 0,35. */
export const AUDIO_REV = 2;
/** Volumes par défaut : musique 0,70 × 0,45 = 0,315 (≤ 0,35, E-UX-4 et fichier 24 §2.4). */
export const DEFAULT_SETTINGS: Settings = {
  locale: "fr", uiScale: 100, volMaster: 70, volMusic: 45, volAmbient: 50, volSfx: 80, volUi: 60, subtitles: true,
  musicCombatOnly: false, musicSource: "mixte", userTracks: {}, authorMode: false, tutorial: DEFAULT_TUTORIAL, audioRev: AUDIO_REV,
};
export const MUSIC_SOURCES = ["synthese", "mixte", "perso"] as const;
export type MusicSource = (typeof MUSIC_SOURCES)[number];
export const UI_SCALES = [100, 125, 150, 175, 200] as const;

const vol = (v: unknown, d: number): number => (typeof v === "number" && v >= 0 && v <= 100 ? Math.round(v) : d);

/** Volumes du moteur audio tirés des préférences. */
export const volumesOf = (s: Settings): Volumes => ({
  master: s.volMaster, music: s.volMusic, ambient: s.volAmbient, sfx: s.volSfx, ui: s.volUi, subtitles: s.subtitles, musicCombatOnly: s.musicCombatOnly,
});

/** Bibliothèque musicale tirée des préférences et de la liste des pistes présentes dans `assets_user/musique/`. */
export function libraryOf(s: Settings, tracks: readonly { file: string; mood: Mood }[]): MusicLibrary {
  const out: { file: string; mood: Mood }[] = [];
  for (const t of tracks) {
    const pick = s.userTracks[t.file];
    if (pick === "off") continue;
    out.push({ file: t.file, mood: pick ?? t.mood });
  }
  return { source: s.musicSource, tracks: out };
}

function userTracksOf(v: unknown): Record<string, Mood | "off"> {
  const out: Record<string, Mood | "off"> = {};
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (x === "calme" || x === "tension" || x === "combat" || x === "off") out[k] = x;
  return out;
}

function tutorialOf(v: unknown): TutorialPrefs {
  if (!v || typeof v !== "object") return { ...DEFAULT_TUTORIAL, seen: [] };
  const r = v as Record<string, unknown>;
  const seen = Array.isArray(r["seen"]) ? [...new Set(r["seen"].filter((x): x is string => typeof x === "string" && x.length <= 40))].slice(0, 60) : [];
  return { done: r["done"] === true, disabled: r["disabled"] === true, hints: r["hints"] === true, seen };
}

export function loadSettings(storage: Pick<Storage, "getItem"> | null): Settings {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, tutorial: { ...DEFAULT_TUTORIAL, seen: [] } };
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      locale: s.locale === "en" ? "en" : "fr",
      uiScale: typeof s.uiScale === "number" && s.uiScale >= 100 && s.uiScale <= 200 ? s.uiScale : DEFAULT_SETTINGS.uiScale,
      volMaster: vol(s.volMaster, DEFAULT_SETTINGS.volMaster),
      volMusic: s.audioRev === AUDIO_REV ? vol(s.volMusic, DEFAULT_SETTINGS.volMusic) : DEFAULT_SETTINGS.volMusic,
      volAmbient: vol(s.volAmbient, DEFAULT_SETTINGS.volAmbient),
      volSfx: vol(s.volSfx, DEFAULT_SETTINGS.volSfx),
      volUi: vol(s.volUi, DEFAULT_SETTINGS.volUi),
      subtitles: typeof s.subtitles === "boolean" ? s.subtitles : DEFAULT_SETTINGS.subtitles,
      musicCombatOnly: s.musicCombatOnly === true,
      musicSource: MUSIC_SOURCES.includes(s.musicSource as MusicSource) ? (s.musicSource as MusicSource) : DEFAULT_SETTINGS.musicSource,
      userTracks: userTracksOf(s.userTracks),
      authorMode: s.authorMode === true,
      tutorial: tutorialOf(s.tutorial),
      audioRev: AUDIO_REV,
    };
  } catch {
    return { ...DEFAULT_SETTINGS, tutorial: { ...DEFAULT_TUTORIAL, seen: [] } };
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
