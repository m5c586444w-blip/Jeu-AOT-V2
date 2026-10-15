import type { SeatId } from "../sim/core/seat";

/**
 * Votes de table (27 §5) : pause et vitesse de la partie. Logique pure : l'hôte ouvre un vote, les sièges répondent, la majorité stricte
 * des sièges présents décide ; un siège qui se déconnecte sort du décompte. Un seul vote ouvert à la fois.
 */
export type VoteSubject = { kind: "pause"; on: boolean } | { kind: "speed"; level: 1 | 2 | 3 };

export type VoteRefusal = "vote.err.open" | "vote.err.none" | "vote.err.not_seated" | "vote.err.speed";

export interface VoteOutcome {
  subject: VoteSubject;
  passed: boolean;
  yes: number;
  no: number;
}

export class VoteBox {
  private current: { subject: VoteSubject; by: SeatId; answers: Map<SeatId, boolean> } | null = null;

  constructor(private readonly present: () => readonly SeatId[]) {}

  get open(): { subject: VoteSubject; by: SeatId } | null {
    return this.current ? { subject: this.current.subject, by: this.current.by } : null;
  }

  /** Ouvre un vote ; le demandeur vote « oui » d'office. Un vote sur le niveau de vitesse n'accepte que 1, 2 ou 3. */
  propose(seat: SeatId, subject: VoteSubject): VoteRefusal | VoteOutcome | null {
    if (!this.present().includes(seat)) return "vote.err.not_seated";
    if (this.current) return "vote.err.open";
    if (subject.kind === "speed" && ![1, 2, 3].includes(subject.level)) return "vote.err.speed";
    this.current = { subject, by: seat, answers: new Map([[seat, true]]) };
    return this.settle();
  }

  /** Réponse d'un siège (modifiable tant que le vote est ouvert) ; retourne le résultat quand il est acquis. */
  answer(seat: SeatId, yes: boolean): VoteRefusal | VoteOutcome | null {
    if (!this.current) return "vote.err.none";
    if (!this.present().includes(seat)) return "vote.err.not_seated";
    this.current.answers.set(seat, yes);
    return this.settle();
  }

  /** À rappeler quand un siège part : le vote peut alors être décidé. */
  recount(): VoteOutcome | null {
    return this.current ? this.settle() : null;
  }

  /** Décide dès qu'une majorité stricte est acquise dans un sens ou dans l'autre (même si tous n'ont pas répondu). */
  private settle(): VoteOutcome | null {
    const v = this.current;
    if (!v) return null;
    const seats = this.present();
    let yes = 0;
    let no = 0;
    for (const s of seats) {
      const a = v.answers.get(s);
      if (a === true) yes++;
      else if (a === false) no++;
    }
    const half = seats.length / 2;
    if (seats.length === 0 || yes > half || no >= half) {
      this.current = null;
      return { subject: v.subject, passed: yes > half, yes, no };
    }
    return null;
  }
}
