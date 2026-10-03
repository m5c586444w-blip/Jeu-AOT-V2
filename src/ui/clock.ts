import type { AlertEntry } from "../sim/strategic/economy";

/**
 * Horloge de jeu côté interface (02 §1) : pause + vitesses 1 à 5. Elle transforme le temps réel écoulé
 * en jours à simuler ; la simulation, elle, ne connaît que des commandes AdvanceDays (déterminisme).
 */
export class GameClock {
  private speedIndex = 0;
  private lastSpeed = 1;
  private carryMs = 0;
  private seenAlertSeq = 0;

  constructor(private readonly msPerDay: readonly number[]) {
    if (msPerDay.length !== 5) throw new Error("GameClock : 5 vitesses attendues");
  }

  /** 0 = pause, 1 à 5 = vitesses. */
  get speed(): number {
    return this.speedIndex;
  }

  get paused(): boolean {
    return this.speedIndex === 0;
  }

  setSpeed(speed: number): void {
    if (!Number.isInteger(speed) || speed < 0 || speed > 5) throw new RangeError(`vitesse invalide : ${speed}`);
    if (speed > 0) this.lastSpeed = speed;
    this.speedIndex = speed;
    this.carryMs = 0;
  }

  /** Espace : bascule entre pause et la dernière vitesse utilisée. */
  togglePause(): void {
    this.setSpeed(this.paused ? this.lastSpeed : 0);
  }

  /** Temps réel écoulé → nombre entier de jours à simuler (le reste est reporté). Au plus `maxDays`. */
  consume(elapsedMs: number, maxDays = 1): number {
    if (this.paused || elapsedMs <= 0) return 0;
    const perDay = this.msPerDay[this.speedIndex - 1] as number;
    this.carryMs += elapsedMs;
    const days = Math.min(maxDays, Math.floor(this.carryMs / perDay));
    this.carryMs = Math.min(this.carryMs - days * perDay, perDay);
    return days;
  }

  /** Examine les nouvelles alertes ; met en pause si l'une l'exige (02 §1). Renvoie les nouvelles alertes. */
  observeAlerts(log: readonly AlertEntry[]): AlertEntry[] {
    const fresh = log.filter((a) => a.seq > this.seenAlertSeq);
    if (fresh.length > 0) this.seenAlertSeq = Math.max(...fresh.map((a) => a.seq));
    if (fresh.some((a) => a.pause)) this.setSpeed(0);
    return fresh;
  }
}
