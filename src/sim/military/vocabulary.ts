/** Vocabulaire des expéditions et de la logistique (P3), sans dépendance à Zod : utilisable par la simulation et les schémas. */

/** Formations (03 §6) : éventail de reconnaissance longue portée [C] ; colonnes lourdes [C]. */
export const FORMATIONS = ["eventail", "colonnes"] as const;
export type Formation = (typeof FORMATIONS)[number];

/** Temps du jour (F-EXP-05) ; tirage quotidien selon la saison [A]. */
export const WEATHERS = ["clair", "nuageux", "pluie", "brouillard", "neige"] as const;
export type Weather = (typeof WEATHERS)[number];

/** Rôles individuels (03 §3.1). */
export const SOLDIER_ROLES = ["eclaireur", "tueur", "soutien", "cavalier", "medecin"] as const;
export type SoldierRole = (typeof SOLDIER_ROLES)[number];

/** Objectifs types (02 §8), limités à ceux que l'auto-résolution sait évaluer ; « capture » exige T-ANT-06 (P5). */
export const OBJECTIVES = ["reconnaissance", "exploration", "recuperation", "depot", "capture"] as const;
export type Objective = (typeof OBJECTIVES)[number];

/** Causes de mort d'un soldat en campagne (03 §9 : hémorragie et infection simulées). */
export const FIELD_DEATH_CAUSES = ["titan", "anormal", "hemorragie", "infection", "epuisement", "convoi"] as const;
export type FieldDeathCause = (typeof FIELD_DEATH_CAUSES)[number];

/** Codes de fusées du Corps (03 §7, expédition 57) [C]. */
export const SIGNALS = ["rouge", "vert", "noir"] as const;
export type Signal = (typeof SIGNALS)[number];

/** Conditions de retrait (F-EXP-04). */
export const RETREAT_CONDITIONS = ["losses_pct", "gas_pct", "abnormal", "max_days"] as const;
export type RetreatCondition = (typeof RETREAT_CONDITIONS)[number];
