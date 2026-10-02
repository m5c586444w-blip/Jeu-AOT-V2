import type { z } from "zod";
import { COLLECTION_NAMES, COLLECTIONS } from "./schemas";
import type { Character, CollectionName, EventDef, Placement, Province, Tech } from "./schemas";

/** Une erreur de donnée porte toujours le chemin du fichier et le chemin JSON. */
export interface DataIssue {
  file: string;
  jsonPath: string;
  message: string;
}

export function formatIssue(i: DataIssue): string {
  return `${i.file} : ${i.jsonPath} — ${i.message}`;
}

export interface GameData {
  provinces: Province[];
  characters: Character[];
  techs: Tech[];
  events: EventDef[];
  placements: Placement[];
  /** Fichier d'origine de chaque identifiant (pour les messages de canon:check). */
  sources: Map<string, string>;
}

export function emptyData(): GameData {
  return { provinces: [], characters: [], techs: [], events: [], placements: [], sources: new Map() };
}

export function jsonPath(path: readonly PropertyKey[]): string {
  return "$" + path.map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`)).join("");
}

/** Valide le contenu (déjà parsé) d'un fichier de collection ; ajoute les entrées valides à `data`. */
export function validateCollectionFile(collection: CollectionName, file: string, json: unknown, data: GameData): DataIssue[] {
  const issues: DataIssue[] = [];
  if (!Array.isArray(json)) return [{ file, jsonPath: "$", message: "la racine doit être un tableau d'entrées" }];
  const schema = COLLECTIONS[collection] as z.ZodType;
  json.forEach((entry, index) => {
    const res = schema.safeParse(entry);
    if (!res.success) {
      for (const iss of res.error.issues) issues.push({ file, jsonPath: jsonPath([index, ...iss.path]), message: iss.message });
      return;
    }
    const value = res.data as { id: string };
    const previous = data.sources.get(value.id);
    if (previous) {
      issues.push({ file, jsonPath: jsonPath([index, "id"]), message: `identifiant « ${value.id} » déjà défini dans ${previous}` });
      return;
    }
    data.sources.set(value.id, file);
    (data[collection] as unknown[]).push(value);
  });
  return issues;
}

/** Vérifie que chaque référence pointe vers une entrée existante. */
export function checkReferences(data: GameData): DataIssue[] {
  const issues: DataIssue[] = [];
  const has = (id: string): boolean => data.sources.has(id);
  const ref = (owner: string, field: string, target: string | undefined): void => {
    if (target !== undefined && target !== "?" && !has(target)) {
      issues.push({ file: data.sources.get(owner) ?? "?", jsonPath: `${owner}.${field}`, message: `référence inconnue « ${target} »` });
    }
  };
  for (const p of data.provinces) ref(p.id, "destroyed_event", p.destroyed_event);
  for (const c of data.characters) ref(c.id, "death_event", c.death_event);
  for (const t of data.techs) {
    for (const ev of [t.unlock_event ?? []].flat()) ref(t.id, "unlock_event", ev);
    for (const p of t.prereqs) ref(t.id, "prereqs", p);
    ref(t.id, "requires_character", t.requires_character);
  }
  for (const e of data.events) ref(e.id, "location", e.location);
  for (const pl of data.placements) ref(pl.id, "location", pl.location);
  return issues;
}

export { COLLECTION_NAMES };
