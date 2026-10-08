import type { Mood } from "./types";

/**
 * Pistes de l'utilisateur (AUD.4) : fichiers mp3 ou ogg déposés dans `assets_user/musique/`, servis sous
 * `musique-utilisateur/` (intergiciel Vite en développement, copie dans `dist/` à la construction). Le jeu les propose comme
 * pistes réglables ; sans dossier ni fichier, rien ne change. Seul ce module crée un lecteur de fichier audio.
 */

export const USER_MUSIC_BASE = "musique-utilisateur/";
export const USER_MUSIC_EXT = /\.(mp3|ogg)$/i;

export interface UserTrack {
  file: string;
  /** Titre affiché : nom du fichier sans extension ni préfixe d'état. */
  name: string;
  /** État proposé d'après le préfixe du fichier (`combat-`, `tension-`, `calme-`) ; « calme » sans préfixe. */
  mood: Mood;
}

export function defaultMoodOf(file: string): Mood {
  const m = /^(calme|tension|combat)[-_ ]/i.exec(file);
  return (m?.[1]?.toLowerCase() as Mood | undefined) ?? "calme";
}

export function trackName(file: string): string {
  return file
    .replace(USER_MUSIC_EXT, "")
    .replace(/^(calme|tension|combat)[-_ ]/i, "")
    .replace(/[_]+/g, " ")
    .trim();
}

/** Lit l'index servi par le serveur (`{ fichiers: [{ fichier, octets }] }`) ; tout ce qui n'est pas valide est ignoré. */
export function parseUserIndex(json: unknown): UserTrack[] {
  const list = (json as { fichiers?: unknown } | null)?.fichiers;
  if (!Array.isArray(list)) return [];
  const out: UserTrack[] = [];
  for (const e of list) {
    const file = (e as { fichier?: unknown } | null)?.fichier;
    if (typeof file !== "string" || !USER_MUSIC_EXT.test(file) || file.includes("/") || file.includes("\\") || file.startsWith(".")) continue;
    out.push({ file, name: trackName(file), mood: defaultMoodOf(file) });
  }
  return out;
}

export async function loadUserIndex(fetchFn: (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>): Promise<UserTrack[]> {
  try {
    const r = await fetchFn(`${USER_MUSIC_BASE}index.json`);
    return r.ok ? parseUserIndex(await r.json()) : [];
  } catch {
    return [];
  }
}

export const userTrackUrl = (file: string): string => `${USER_MUSIC_BASE}${encodeURIComponent(file)}`;

/** Lecteur d'un fichier : démarre la lecture, appelle `onEnded` à la fin (ou sur erreur), `stop` coupe. */
export type UserPlayer = (url: string, out: AudioNode, onEnded: () => void) => { stop: () => void };

/** Lecteur réel : un élément audio relié au bus de musique (lecture en flux, sans décoder le fichier entier). */
export function mediaElementPlayer(ctx: AudioContext): UserPlayer {
  return (url, out, onEnded) => {
    const el = new Audio(url);
    el.preload = "auto";
    const src = ctx.createMediaElementSource(el);
    src.connect(out);
    let done = false;
    const end = (): void => {
      if (done) return;
      done = true;
      onEnded();
    };
    el.addEventListener("ended", end);
    el.addEventListener("error", end);
    void el.play().catch(end);
    return {
      stop: () => {
        done = true;
        el.pause();
        src.disconnect();
      },
    };
  };
}
