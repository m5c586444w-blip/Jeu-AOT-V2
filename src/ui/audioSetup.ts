import { loadUserIndex } from "../audio/userTracks";
import type { UserTrack } from "../audio/userTracks";
import type { AudioEngine } from "./audio";
import { libraryOf } from "./settings";
import type { Settings } from "./settings";

/**
 * Liaison entre les préférences et le moteur audio (AUD.4, AUD.5) : liste des pistes de `assets_user/musique/` lue une fois
 * auprès du serveur, bibliothèque musicale tirée des préférences.
 */

let tracks: readonly UserTrack[] = [];
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export const userTracks = (): readonly UserTrack[] => tracks;
export const onUserTracks = (cb: () => void): void => void listeners.add(cb);

/** Lit l'index des pistes (une seule fois) ; sans serveur ni dossier, la liste reste vide. */
export function loadUserTracks(): Promise<void> {
  loading ??= loadUserIndex((url) => fetch(url)).then((list) => {
    tracks = list;
    for (const cb of listeners) cb();
  });
  return loading;
}

/** Applique les préférences musicales (source, pistes affectées) au moteur. */
export function syncLibrary(audio: AudioEngine, s: Settings): void {
  audio.setLibrary(libraryOf(s, tracks));
}
