import { Rng } from "../sim/core/rng";
import type { SeatId } from "../sim/core/seat";

/** Réglage de l'hôte (27 §4.4). */
export type TreasonMode = "aucune" | "possible" | "garantie";

/** Allégeance secrète d'un siège : tenue par l'hôte, jamais dans l'état partagé, jamais dans un instantané ni dans un tour. */
export interface Secret {
  seat: SeatId;
  /** Camp ou cause servie en secret (création `A` : libellés fournis par la partie). */
  serves: string;
  objective: string;
  /** Capital de trahison restant (limité, lent à reconstituer : paramètres de données au chantier suivant). */
  capital: number;
}

/** Au plus 1 traître pour 5 joueurs d'un camp, 2 au-delà (27 §4.4) ; un joueur seul n'a pas de traître. */
export const maxTraitors = (players: number): number => (players < 2 ? 0 : players <= 5 ? 1 : 2);

/**
 * Désigne les traîtres d'un camp : pure et déterministe (graine). `aucune` : personne ; `garantie` : au moins un (si le camp a ≥ 2 joueurs) ;
 * `possible` : la graine décide s'il y en a.
 */
export function assignTraitors(seats: readonly SeatId[], mode: TreasonMode, seed: number): SeatId[] {
  const cap = maxTraitors(seats.length);
  if (mode === "aucune" || cap === 0) return [];
  const rng = new Rng(seed).fork("traitres");
  if (mode === "possible" && rng.next() < 0.5) return [];
  const count = cap === 2 && rng.next() < 0.4 ? 2 : 1;
  const pool = [...seats].sort();
  const out: SeatId[] = [];
  while (out.length < count && pool.length > 0) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0] as SeatId);
  return out.sort();
}

/** Coffre de secrets de l'hôte : seul le titulaire d'un secret peut le lire par l'hôte ; le reste de la partie n'en voit que les conséquences communes. */
export class SecretVault {
  private readonly secrets = new Map<SeatId, Secret>();

  set(secret: Secret): void {
    this.secrets.set(secret.seat, { ...secret });
  }

  /** Le secret d'un siège, pour ce siège seulement. */
  secretFor(seat: SeatId): Secret | null {
    const s = this.secrets.get(seat);
    return s ? { ...s } : null;
  }

  get size(): number {
    return this.secrets.size;
  }
}
