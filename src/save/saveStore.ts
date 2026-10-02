import { stateHash } from "../sim/core/canonical";
import { deserialize, SaveFormatError, serialize } from "../sim/core/serialize";
import type { GameState } from "../sim/core/state";

/** Nombre de sauvegardes automatiques conservées en rotation (fichier 14, T0.7). */
export const AUTOSAVE_SLOTS = 3;
const DB_NAME = "murs-et-sang";
const DB_VERSION = 1;
const STORE = "saves";
const META = "meta";

export interface SaveRecord {
  slot: string;
  label: string;
  savedAt: number;
  schemaVersion: number;
  hash: string;
  data: string;
}

export type SaveSummary = Omit<SaveRecord, "data">;

/** Horloge injectée : l'horodatage des sauvegardes n'entre jamais dans la simulation. */
export type Clock = () => number;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("Erreur IndexedDB"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Transaction IndexedDB échouée"));
    tx.onabort = () => reject(tx.error ?? new Error("Transaction IndexedDB annulée"));
  });
}

export class SaveStore {
  private constructor(private readonly db: IDBDatabase, private readonly clock: Clock) {}

  static async open(factory: IDBFactory, clock: Clock, dbName = DB_NAME): Promise<SaveStore> {
    const open = factory.open(dbName, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "slot" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    return new SaveStore(await req(open), clock);
  }

  close(): void {
    this.db.close();
  }

  async save(slot: string, state: GameState, label = slot): Promise<SaveSummary> {
    if (!/^[\w:-]{1,40}$/.test(slot)) throw new Error(`Nom de créneau invalide : « ${slot} »`);
    const record: SaveRecord = {
      slot,
      label,
      savedAt: this.clock(),
      schemaVersion: state.schemaVersion,
      hash: stateHash(state),
      data: serialize(state),
    };
    const tx = this.db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    await txDone(tx);
    const { data: _data, ...summary } = record;
    void _data;
    return summary;
  }

  /** Sauvegarde automatique : écrit dans auto-1, auto-2, auto-3 puis recommence (la plus ancienne est écrasée). */
  async autosave(state: GameState): Promise<SaveSummary> {
    const tx = this.db.transaction(META, "readonly");
    const counter = (await req(tx.objectStore(META).get("autosave_counter"))) as number | undefined;
    const n = counter ?? 0;
    const summary = await this.save(`auto-${(n % AUTOSAVE_SLOTS) + 1}`, state, "Sauvegarde automatique");
    const wtx = this.db.transaction(META, "readwrite");
    wtx.objectStore(META).put(n + 1, "autosave_counter");
    await txDone(wtx);
    return summary;
  }

  async load(slot: string): Promise<GameState> {
    const tx = this.db.transaction(STORE, "readonly");
    const rec = (await req(tx.objectStore(STORE).get(slot))) as SaveRecord | undefined;
    if (!rec) throw new SaveFormatError(`Aucune sauvegarde dans le créneau « ${slot} »`);
    if (typeof rec.data !== "string") throw new SaveFormatError(`Sauvegarde « ${slot} » corrompue : données absentes`);
    let state: GameState;
    try {
      state = deserialize(rec.data);
    } catch (e) {
      throw new SaveFormatError(`Sauvegarde « ${slot} » : ${(e as Error).message}`);
    }
    // Une sauvegarde migrée change légitimement de hash ; on ne contrôle que les versions courantes.
    if (rec.schemaVersion === state.schemaVersion && stateHash(state) !== rec.hash) {
      throw new SaveFormatError(`Sauvegarde « ${slot} » corrompue : hash ${stateHash(state)} ≠ ${rec.hash}`);
    }
    return state;
  }

  async list(): Promise<SaveSummary[]> {
    const tx = this.db.transaction(STORE, "readonly");
    const all = (await req(tx.objectStore(STORE).getAll())) as SaveRecord[];
    return all
      .map(({ data: _d, ...s }) => {
        void _d;
        return s;
      })
      .sort((a, b) => b.savedAt - a.savedAt);
  }

  async remove(slot: string): Promise<void> {
    const tx = this.db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(slot);
    await txDone(tx);
  }

  /** Écriture brute, réservée aux tests de robustesse (données corrompues). */
  async putRaw(record: unknown): Promise<void> {
    const tx = this.db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    await txDone(tx);
  }
}
