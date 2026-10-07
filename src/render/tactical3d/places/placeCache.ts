/**
 * Mémoire d'exécution des lieux (R1e, consigne §4) : cache LRU de 8 lieux construits ; au-delà, le moins récemment utilisé est
 * libéré (`dispose`) et sera reconstruit à la demande depuis son plan. Dans chaque lieu, seuls les tronçons de 64 m visibles
 * sont recopiés dans les instances (`InstanceLayer`) ; budget visé par lieu : 250 000 triangles visibles et 400 appels de rendu
 * (valeurs cibles à confirmer sur le PC de l'utilisateur ; mesurées par la sonde `__place3d.stats()`).
 */
export const PLACE_CACHE_SIZE = 8;
export const PLACE_BUDGET = { triangles: 250_000, calls: 400 } as const;

export class PlaceCache<T extends { dispose(): void }> {
  private readonly items = new Map<string, T>();
  private readonly pending = new Map<string, Promise<T>>();

  constructor(private readonly load: (id: string) => Promise<T>, readonly capacity = PLACE_CACHE_SIZE) {}

  /** Lieu construit (depuis le cache, ou chargé) ; il devient le plus récent. */
  async get(id: string): Promise<T> {
    const hit = this.items.get(id);
    if (hit) {
      this.items.delete(id);
      this.items.set(id, hit);
      return hit;
    }
    const inFlight = this.pending.get(id);
    if (inFlight) return inFlight;
    const p = this.load(id).then((v) => {
      this.pending.delete(id);
      this.items.set(id, v);
      while (this.items.size > this.capacity) {
        const [oldest, value] = this.items.entries().next().value as [string, T];
        this.items.delete(oldest);
        value.dispose();
      }
      return v;
    });
    this.pending.set(id, p);
    return p;
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  /** Identifiants du plus ancien au plus récent. */
  keys(): string[] {
    return [...this.items.keys()];
  }

  clear(): void {
    for (const v of this.items.values()) v.dispose();
    this.items.clear();
  }
}
