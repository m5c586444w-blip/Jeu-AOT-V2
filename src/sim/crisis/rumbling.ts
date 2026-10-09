/**
 * Grondement (P9.4 ; 01 §8 : « crise systémique à conséquences réelles », jamais un « mode ultime » ; 03 §8 : pas de bataille
 * classique, une crise avec moyens de défense et de diplomatie). Couche facultative de l'état : absente hors du scénario du
 * Grondement (aucune empreinte existante ne bouge). Mécanique : voir `tickRumbling`.
 */
export type RumblingStance = "empecher" | "retarder" | "laisser";

export interface RumblingState {
  /** Jours depuis le déclenchement. */
  day: number;
  /** Part du monde ravagée (0–1) : population des provinces du monde touchées, sur la population hors de l'île. */
  ravaged: number;
  /** Provinces du monde touchées, dans l'ordre de passage. */
  provinces: string[];
  /** Front : avancée vers la prochaine province (0–1). */
  front: number;
  /** Arrêté (Fondateur neutralisé). */
  stopped: boolean;
  /** Posture du joueur (choix de l'événement E59) ; null avant le choix. */
  stance: RumblingStance | null;
  /** Assaut contre le Fondateur : préparation (0–100), tentatives, échecs. */
  assault: number;
  attempts: number;
  /** Morts estimés hors de l'île et évacués (affichage, ordres de grandeur `?`). */
  dead: number;
  evacuated: number;
}
