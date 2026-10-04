import { BALANCE_FILES } from "./balance";
import { GeoSchema } from "./geo";
import type { GeoData } from "./geo";
import type { BalanceName } from "./balance";
import { COLLECTION_NAMES } from "./schemas";
import type { CollectionName } from "./schemas";
import { checkReferences, emptyData, jsonPath, validateCollectionFile } from "./validate";
import type { DataIssue } from "./validate";
import type { WorldSource } from "../sim/strategic/world";

/**
 * Construit une source de monde VALIDÉE à partir de fichiers déjà lus, indexés par chemin « /data/<dossier>/<fichier>.json ».
 * Même code dans le Worker (import.meta.glob) et sous Node (lecture disque).
 */
export function worldSourceFromFiles(files: Readonly<Record<string, unknown>>): { source: WorldSource | null; issues: DataIssue[] } {
  const data = emptyData();
  const issues: DataIssue[] = [];
  const balance: Partial<Record<BalanceName, unknown>> = {};
  let geo: GeoData | undefined;
  for (const path of Object.keys(files).sort()) {
    const parts = path.split("/");
    const folder = parts[2] ?? "";
    const file = path.slice(1);
    const json = files[path];
    if ((COLLECTION_NAMES as readonly string[]).includes(folder)) {
      issues.push(...validateCollectionFile(folder as CollectionName, file, json, data));
    } else if (folder === "geo") {
      const res = GeoSchema.safeParse(json);
      if (res.success) geo = res.data;
      else for (const i of res.error.issues) issues.push({ file, jsonPath: jsonPath(i.path), message: i.message });
    } else if (folder === "balance") {
      const name = (parts[3] ?? "").replace(/\.json$/, "") as BalanceName;
      const schema = BALANCE_FILES[name];
      if (!schema) continue;
      const res = schema.safeParse(json);
      if (res.success) balance[name] = res.data;
      else for (const i of res.error.issues) issues.push({ file, jsonPath: jsonPath(i.path), message: i.message });
    }
  }
  if (issues.length === 0) issues.push(...checkReferences(data));
  if (!balance.economy || !balance.time) issues.push({ file: "data/balance", jsonPath: "$", message: "economy.json et time.json requis" });
  if (issues.length > 0) return { source: null, issues };
  return {
    source: {
      provinces: data.provinces,
      buildings: data.buildings,
      scenarios: data.scenarios,
      economy: balance.economy as WorldSource["economy"],
      time: balance.time as WorldSource["time"],
      characters: data.characters,
      traits: data.traits,
      strata: data.strata,
      organisations: data.organisations,
      laws: data.laws,
      roles: data.roles,
      ...(balance.politics ? { politics: balance.politics as WorldSource["politics"] } : {}),
      ...(balance.society ? { society: balance.society as WorldSource["society"] } : {}),
      ...(balance.expeditions ? { expeditions: balance.expeditions as WorldSource["expeditions"] } : {}),
      ...(balance.logistics ? { logistics: balance.logistics as WorldSource["logistics"] } : {}),
      ...(geo ? { geo } : {}),
      ...(balance.tactical ? { tactical: balance.tactical as WorldSource["tactical"] } : {}),
      titanTypes: data.titan_types,
      tacticalMaps: data.tactical_maps,
      units: data.units,
      titans: data.titans,
      names: data.names,
    },
    issues,
  };
}
