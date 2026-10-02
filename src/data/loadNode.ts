import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { COLLECTION_NAMES } from "./schemas";
import { checkReferences, emptyData, validateCollectionFile } from "./validate";
import type { DataIssue, GameData } from "./validate";

/** Charge un dossier de données (structure : <dir>/<collection>/*.json) depuis le disque (outils CLI, tests). */
export function loadDataDir(dir: string, cwd = process.cwd()): { data: GameData; issues: DataIssue[] } {
  const data = emptyData();
  const issues: DataIssue[] = [];
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
      let json: unknown;
      try {
        json = JSON.parse(readFileSync(full, "utf8"));
      } catch (e) {
        issues.push({ file: shown, jsonPath: "$", message: `JSON invalide : ${(e as Error).message}` });
        continue;
      }
      issues.push(...validateCollectionFile(collection, shown, json, data));
    }
  }
  if (issues.length === 0) issues.push(...checkReferences(data));
  return { data, issues };
}
