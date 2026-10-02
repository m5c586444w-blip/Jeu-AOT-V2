import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { COLLECTION_NAMES } from "./schemas";
import type { CollectionName } from "./schemas";
import type { RawData, RawEntry } from "./canonRules";

/**
 * Chargement SANS validation de schéma : canon:check doit pouvoir signaler une donnée incomplète
 * (ex. canon absent → R6) au lieu d'échouer avant d'appliquer ses règles.
 */
export function loadRawDir(dir: string, cwd = process.cwd()): { raw: RawData; errors: string[] } {
  const raw: RawData = { provinces: [], characters: [], techs: [], events: [], placements: [] };
  const errors: string[] = [];
  for (const collection of COLLECTION_NAMES) {
    const sub = join(dir, collection);
    let files: string[] = [];
    try {
      if (statSync(sub).isDirectory()) files = readdirSync(sub).filter((f) => f.endsWith(".json")).sort();
    } catch {
      continue;
    }
    for (const f of files) {
      const full = join(sub, f);
      const shown = relative(cwd, full) || full;
      try {
        const json: unknown = JSON.parse(readFileSync(full, "utf8"));
        if (!Array.isArray(json)) {
          errors.push(`${shown} : la racine doit être un tableau`);
          continue;
        }
        for (const e of json) pushEntry(raw, collection, shown, e);
      } catch (e) {
        errors.push(`${shown} : JSON invalide (${(e as Error).message})`);
      }
    }
  }
  return { raw, errors };
}

function pushEntry(raw: RawData, collection: CollectionName, file: string, e: unknown): void {
  const obj = (typeof e === "object" && e !== null ? e : {}) as Record<string, unknown>;
  const entry: RawEntry = { file, id: typeof obj["id"] === "string" ? obj["id"] : "(sans id)", v: obj };
  raw[collection].push(entry);
}
