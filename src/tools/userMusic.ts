import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** AUD.4 : fichiers mp3 et ogg du dossier `assets_user/musique/` (outil Node, jamais empaqueté dans le jeu). */
export const USER_MUSIC_DIR = "assets_user/musique";

export interface UserMusicFile {
  fichier: string;
  octets: number;
}

export function listUserMusic(dir = USER_MUSIC_DIR): UserMusicFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.(mp3|ogg)$/i.test(f) && !f.startsWith(".") && statSync(join(dir, f)).isFile())
    .sort((a, b) => a.localeCompare(b, "fr"))
    .map((f) => ({ fichier: f, octets: statSync(join(dir, f)).size }));
}

export const userMusicIndex = (dir = USER_MUSIC_DIR): string => JSON.stringify({ fichiers: listUserMusic(dir) });

export const readUserMusic = (file: string, dir = USER_MUSIC_DIR): Buffer | null => (listUserMusic(dir).some((f) => f.fichier === file) ? readFileSync(join(dir, file)) : null);
