/** Vocabulaire de la couche personnages et politique (sans dépendance à Zod : utilisable par la simulation). */

/** Attributs d'un personnage (02 §9.1), échelle 0–100 [A]. */
export const ATTRIBUTES = ["odm", "melee", "aim", "command", "tactics", "intellect", "charisma", "endurance", "composure", "ambition", "faith", "health"] as const;
export type AttributeId = (typeof ATTRIBUTES)[number];

/** Programmes politiques (08 §3.1 : réformateur, conservateur, opportuniste…). */
export const AGENDAS = ["reformateur", "conservateur", "opportuniste", "religieux", "militariste", "pragmatique"] as const;
export type Agenda = (typeof AGENDAS)[number];

export const RELATION_TYPES = ["amitie", "loyaute", "respect", "rivalite", "amour", "dette", "haine", "tension", "mentor"] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/** Relations « affectueuses » : un deuil les touche, une clique s'y appuie. */
export const WARM_RELATIONS: readonly RelationType[] = ["amitie", "loyaute", "respect", "amour", "mentor", "dette"];
