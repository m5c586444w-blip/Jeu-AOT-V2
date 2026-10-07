import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { BALANCE_FILES } from "./balance";
import type { BalanceName, EconomyBalance, PoliticsBalance, SocietyBalance, TimeBalance } from "./balance";
import { COLLECTION_NAMES } from "./schemas";
import { checkReferences, emptyData, jsonPath, validateCollectionFile } from "./validate";
import type { DataIssue, GameData } from "./validate";

export interface Balance {
  economy: EconomyBalance;
  time: TimeBalance;
  politics: PoliticsBalance;
  society: SocietyBalance;
}

/** Charge et valide data/balance/*.json (un schéma par fichier). Fichier absent = tolérée (fixtures). */
export function loadBalanceDir(dir: string, cwd = process.cwd()): { balance: Partial<Balance>; issues: DataIssue[] } {
  const balance: Partial<Balance> = {};
  const issues: DataIssue[] = [];
  for (const name of Object.keys(BALANCE_FILES) as BalanceName[]) {
    const full = join(dir, "balance", `${name}.json`);
    const shown = relative(cwd, full) || full;
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(full, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
      issues.push({ file: shown, jsonPath: "$", message: `JSON invalide : ${(e as Error).message}` });
      continue;
    }
    const res = BALANCE_FILES[name].safeParse(json);
    if (!res.success) {
      for (const iss of res.error.issues) issues.push({ file: shown, jsonPath: jsonPath(iss.path), message: iss.message });
      continue;
    }
    (balance as Record<string, unknown>)[name] = res.data;
  }
  return { balance, issues };
}

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

/** Lit tous les JSON de `dir` en les indexant comme le fait import.meta.glob dans le navigateur (« /data/… »). */
export function readDataFiles(dir: string, exclude: readonly string[] = ["map", "places"]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const folder of readdirSync(dir).sort()) {
    if (exclude.includes(folder)) continue;
    const sub = join(dir, folder);
    if (!statSync(sub).isDirectory()) continue;
    for (const f of readdirSync(sub).filter((x) => x.endsWith(".json")).sort()) {
      out[`/data/${folder}/${f}`] = JSON.parse(readFileSync(join(sub, f), "utf8"));
    }
  }
  return out;
}
