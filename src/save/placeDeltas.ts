/**
 * Deltas des lieux (R1e, consigne §4) : couche séparée de la sauvegarde, une entrée par (lieu, version du plan), qui ne garde
 * que la liste des bâtiments modifiés (rang du bâtiment dans le plan, état, ruine en %) — rien d'autre. Le plan lui-même
 * (N1 d'auteur ou N2 figé) n'est jamais copié dans la sauvegarde.
 * Encodage binaire compact : rangs triés codés en écarts (entier variable), puis `ruine << 2 | état` (entier variable) ;
 * une modification coûte 2 à 4 octets. Objectif : 100 lieux modifiés < 200 Kio.
 */
export const BUILDING_STATES = ["intact", "endommage", "detruit", "construit"] as const;
export type BuildingState = (typeof BUILDING_STATES)[number];

export interface BuildingDelta {
  /** Rang du bâtiment dans le plan (maisons du tracé, puis repères ; lignes `b` d'un plan figé). */
  index: number;
  state: BuildingState;
  /** Ruine (0 à 100 %). */
  ruin: number;
}

export interface PlaceDelta {
  place: string;
  /** Version du plan (générateur ou plan d'auteur) : un delta ne s'applique qu'à la version pour laquelle il a été écrit. */
  version: number;
  mods: BuildingDelta[];
}

function pushVarint(out: number[], v: number): void {
  let x = v >>> 0;
  while (x >= 0x80) {
    out.push((x & 0x7f) | 0x80);
    x >>>= 7;
  }
  out.push(x);
}

function readVarint(b: Uint8Array, at: { i: number }): number {
  let v = 0;
  let shift = 0;
  for (;;) {
    const byte = b[at.i++];
    if (byte === undefined) throw new Error("delta de lieu tronqué");
    v |= (byte & 0x7f) << shift;
    if (byte < 0x80) return v >>> 0;
    shift += 7;
    if (shift > 28) throw new Error("delta de lieu : entier trop long");
  }
}

/** Encode les modifications (une seule par bâtiment ; la dernière l'emporte), triées par rang. */
export function encodeMods(mods: readonly BuildingDelta[]): Uint8Array {
  const byIndex = new Map<number, BuildingDelta>();
  for (const m of mods) {
    if (!Number.isInteger(m.index) || m.index < 0) throw new Error(`rang de bâtiment invalide : ${m.index}`);
    byIndex.set(m.index, m);
  }
  const sorted = [...byIndex.values()].sort((a, b) => a.index - b.index);
  const out: number[] = [];
  pushVarint(out, sorted.length);
  let prev = 0;
  for (const m of sorted) {
    pushVarint(out, m.index - prev);
    prev = m.index;
    const ruin = Math.max(0, Math.min(100, Math.round(m.ruin)));
    pushVarint(out, (ruin << 2) | BUILDING_STATES.indexOf(m.state));
  }
  return Uint8Array.from(out);
}

export function decodeMods(bytes: Uint8Array): BuildingDelta[] {
  const at = { i: 0 };
  const n = readVarint(bytes, at);
  const out: BuildingDelta[] = [];
  let index = 0;
  for (let k = 0; k < n; k++) {
    index += readVarint(bytes, at);
    const v = readVarint(bytes, at);
    out.push({ index, state: BUILDING_STATES[v & 3] as BuildingState, ruin: v >> 2 });
  }
  return out;
}

interface DeltaRecord {
  key: string;
  place: string;
  version: number;
  data: Uint8Array;
}

const DB_NAME = "murs-et-sang-lieux";
const STORE = "deltas";
const keyOf = (place: string, version: number): string => `${place}@${version}`;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("Erreur IndexedDB"));
  });
}

/** Magasin IndexedDB des deltas, clé (lieu, version). */
export class PlaceDeltaStore {
  private constructor(private readonly db: IDBDatabase) {}

  static async open(factory: IDBFactory, dbName = DB_NAME): Promise<PlaceDeltaStore> {
    const open = factory.open(dbName, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE, { keyPath: "key" });
    };
    return new PlaceDeltaStore(await req(open));
  }

  close(): void {
    this.db.close();
  }

  async put(d: PlaceDelta): Promise<number> {
    const data = encodeMods(d.mods);
    const rec: DeltaRecord = { key: keyOf(d.place, d.version), place: d.place, version: d.version, data };
    await req(this.db.transaction(STORE, "readwrite").objectStore(STORE).put(rec));
    return data.byteLength;
  }

  async get(place: string, version: number): Promise<PlaceDelta | null> {
    const rec = (await req(this.db.transaction(STORE, "readonly").objectStore(STORE).get(keyOf(place, version)))) as DeltaRecord | undefined;
    return rec ? { place: rec.place, version: rec.version, mods: decodeMods(rec.data) } : null;
  }

  /** Taille totale des deltas stockés (octets de données). */
  async totalBytes(): Promise<number> {
    const all = (await req(this.db.transaction(STORE, "readonly").objectStore(STORE).getAll())) as DeltaRecord[];
    return all.reduce((s, r) => s + r.data.byteLength + r.key.length, 0);
  }
}
