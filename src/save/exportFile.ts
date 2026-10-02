import { stateHash } from "../sim/core/canonical";
import { deserialize, SaveFormatError, serialize } from "../sim/core/serialize";
import type { GameState } from "../sim/core/state";

export const EXPORT_FORMAT = "murs-et-sang/sauvegarde";

/** Enveloppe d'export : le hash permet de détecter un fichier modifié ou tronqué. */
export function exportSave(state: GameState, exportedAt: number): string {
  return JSON.stringify(
    { format: EXPORT_FORMAT, exportedAt, hash: stateHash(state), state: JSON.parse(serialize(state)) as unknown },
    null,
    2,
  );
}

export function importSave(text: string): GameState {
  let env: unknown;
  try {
    env = JSON.parse(text);
  } catch (e) {
    throw new SaveFormatError(`Fichier de sauvegarde illisible (JSON invalide) : ${(e as Error).message}`);
  }
  if (typeof env !== "object" || env === null) throw new SaveFormatError("Fichier de sauvegarde : enveloppe absente");
  const e = env as Record<string, unknown>;
  if (e["format"] !== EXPORT_FORMAT) throw new SaveFormatError(`Fichier de sauvegarde : format inattendu (${String(e["format"])})`);
  if (typeof e["state"] !== "object" || e["state"] === null) throw new SaveFormatError("Fichier de sauvegarde : état absent");
  const state = deserialize(JSON.stringify(e["state"]));
  const original = (e["state"] as Record<string, unknown>)["schemaVersion"];
  if (original === state.schemaVersion && stateHash(state) !== e["hash"]) {
    throw new SaveFormatError(`Fichier de sauvegarde corrompu : hash ${stateHash(state)} ≠ ${String(e["hash"])}`);
  }
  return state;
}
