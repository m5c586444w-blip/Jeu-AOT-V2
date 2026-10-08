import { z } from "zod";

/**
 * Données de PA (fichier 21 §7, 23 §3.2) : artillerie (`data/artillery`), régiments, navires, zones maritimes,
 * armées et flottes de départ (`data/armies`). Une entrée par objet, discriminée par `type`.
 */

const canon = z.enum(["C", "A", "?"]);
const idOf = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-z0-9_]+$`), `identifiant attendu au format ${prefix}_xxx (snake_case)`);
const year = z.number().int().min(0).max(2000);
const canonFields = { canon, notes_canon: z.string().optional() };

/** Conditions d'accès : année minimale, technologie étudiée, événement survenu (11 §8 : aucune arme avant sa date). */
export const RequiresSchema = z
  .object({
    min_year: year,
    tech: idOf("tech").optional(),
    event: idOf("evt").optional(),
  })
  .strict();

export const PIECE_KINDS = ["rempart", "rail", "campagne", "mortier", "lourde", "obusier", "cotiere", "navale"] as const;
export const REGIMENT_KINDS = ["infanterie", "cavalerie", "odm", "artillerie", "lances", "genie", "convoi", "milice", "police", "mitrailleurs", "assaut", "anti_titan"] as const;
export const SHIP_KINDS = ["cuirasse", "croiseur", "transport", "cotier"] as const;
export const INSIGNIA = ["garnison", "brigade", "corps", "marley", "allies", "hizuru"] as const;

/** Pièce d'artillerie (PA.3, PA.4) : portée, cadence, dispersion, souffle, effets, entretien, munitions. */
export const PieceSchema = z
  .object({
    type: z.literal("piece"),
    id: idOf("art"),
    name_key: z.string().min(1),
    faction: idOf("fac"),
    kind: z.enum(PIECE_KINDS),
    /** Transportable par une armée (sinon : rempart, côte ou navire). */
    mobile: z.boolean(),
    range_m: z.number().positive(),
    min_range_m: z.number().min(0),
    /** Coups par minute d'une pièce. */
    rate_per_min: z.number().positive(),
    /** Écart type de la chute à portée maximale (m) ; décroît avec la distance. */
    dispersion_m: z.number().min(0),
    /** Rayon de la zone de danger d'un impact (m). */
    blast_m: z.number().positive(),
    crew: z.number().int().min(1),
    /** Dégâts sur un Titan touché (secondes d'immobilisation d'un membre) et probabilité de tuer un soldat dans le souffle. */
    vs_titan: z.number().min(0),
    vs_soldier: z.number().min(0).max(1),
    /** Stress ajouté aux soldats dans la zone de danger ; moral perdu par l'armée visée (stratégique). */
    morale_hit: z.number().min(0),
    /** Usure d'un mur assiégé (points de structure par pièce et par jour de tir). */
    wall_damage: z.number().min(0),
    /** Entretien mensuel par pièce (or pour Paradis, industrie pour les nations). */
    upkeep: z.number().min(0),
    /** Poudre consommée par jour de tir (unités de stock, Paradis) ou obus (industrie, nations). */
    powder_per_day: z.number().min(0),
    ammo: z.array(idOf("mun")).min(1),
    requires: RequiresSchema,
    /** Valeur `?` paramétrable : pièce désactivée tant que son existence n'est pas tranchée. */
    enabled: z.boolean(),
    ...canonFields,
  })
  .strict();

/** Munition : multiplicateurs contre Titans et soldats, souffle, ralentissement. */
export const MunitionSchema = z
  .object({
    type: z.literal("munition"),
    id: idOf("mun"),
    name_key: z.string().min(1),
    factions: z.array(idOf("fac")).min(1),
    vs_titan_mult: z.number().min(0),
    vs_soldier_mult: z.number().min(0),
    blast_mult: z.number().positive(),
    /** Secondes de ralentissement d'un Titan touché (chaînes). */
    slow_s: z.number().min(0),
    requires: RequiresSchema,
    enabled: z.boolean(),
    ...canonFields,
  })
  .strict();

export const ArtilleryEntrySchema = z.discriminatedUnion("type", [PieceSchema, MunitionSchema]);

/** Régiment : brique d'une armée (une compagnie de type U-Pxx ou U-Mxx). */
export const RegimentSchema = z
  .object({
    type: z.literal("regiment"),
    id: idOf("rgt"),
    code: z.string().min(1),
    name_key: z.string().min(1),
    faction: idOf("fac"),
    kind: z.enum(REGIMENT_KINDS),
    men: z.number().int().min(1),
    attack: z.number().min(0),
    defense: z.number().min(0),
    /** Efficacité contre les Titans (rencontres hors des murs). */
    anti_titan: z.number().min(0),
    speed_km_day: z.number().positive(),
    /** Vivres et gaz consommés par jour (unités de stock, pour tout le régiment). */
    food_per_day: z.number().min(0),
    gas_per_day: z.number().min(0),
    upkeep: z.number().min(0),
    pieces: z.object({ piece: idOf("art"), count: z.number().int().min(1) }).strict().optional(),
    /** Portée de vue supplémentaire (provinces). */
    scout: z.number().int().min(0).max(2),
    /** Ne quitte pas les provinces de mur (batteries de rempart). */
    static: z.boolean(),
    requires: RequiresSchema,
    enabled: z.boolean(),
    ...canonFields,
  })
  .strict();

/** Navire (flottes de Marley, des Alliés et d'Hizuru : aucun pour Paradis, 23 §3.2). */
export const ShipSchema = z
  .object({
    type: z.literal("ship"),
    id: idOf("ship"),
    code: z.string().min(1),
    name_key: z.string().min(1),
    faction: idOf("fac"),
    kind: z.enum(SHIP_KINDS),
    attack: z.number().min(0),
    defense: z.number().min(0),
    /** Régiments transportés par navire. */
    capacity: z.number().int().min(0),
    speed_km_day: z.number().positive(),
    guns: z.object({ piece: idOf("art"), count: z.number().int().min(1) }).strict().optional(),
    upkeep: z.number().min(0),
    requires: RequiresSchema,
    enabled: z.boolean(),
    ...canonFields,
  })
  .strict();

/** Zone maritime autour de l'île [A] : position (km), voisines, côtes où débarquer ; `offmap` = au large. */
export const SeaSchema = z
  .object({
    type: z.literal("sea"),
    id: idOf("sea"),
    name_key: z.string().min(1),
    x: z.number(),
    y: z.number(),
    adjacent: z.array(idOf("sea")),
    coasts: z.array(idOf("prov")),
    offmap: z.boolean(),
    ...canonFields,
  })
  .strict();

const regimentList = z.array(z.object({ regiment: idOf("rgt"), count: z.number().int().min(1) }).strict()).min(1);

/** Armée de départ d'un scénario : pile de régiments et un général (personnage, sinon titre générique). */
export const ArmyStartSchema = z
  .object({
    type: z.literal("army"),
    id: idOf("army"),
    scenario: idOf("scn"),
    faction: idOf("fac"),
    name_key: z.string().min(1),
    insignia: z.enum(INSIGNIA),
    general: idOf("char").nullable(),
    general_key: z.string().min(1),
    /** Province de départ ; null = embarquée sur la flotte qui la cite. */
    province: idOf("prov").nullable(),
    regiments: regimentList,
    morale: z.number().min(0).max(100),
    supply_days: z.number().min(0),
    ...canonFields,
  })
  .strict();

export const FleetStartSchema = z
  .object({
    type: z.literal("fleet"),
    id: idOf("flt"),
    scenario: idOf("scn"),
    faction: idOf("fac"),
    name_key: z.string().min(1),
    admiral: idOf("char").nullable(),
    sea: idOf("sea"),
    ships: z.array(z.object({ ship: idOf("ship"), count: z.number().int().min(1) }).strict()).min(1),
    embarked: z.array(idOf("army")),
    ...canonFields,
  })
  .strict();

export const ArmiesEntrySchema = z.discriminatedUnion("type", [RegimentSchema, ShipSchema, SeaSchema, ArmyStartSchema, FleetStartSchema]);

export type Piece = z.infer<typeof PieceSchema>;
export type Munition = z.infer<typeof MunitionSchema>;
export type ArtilleryEntry = z.infer<typeof ArtilleryEntrySchema>;
export type Regiment = z.infer<typeof RegimentSchema>;
export type Ship = z.infer<typeof ShipSchema>;
export type Sea = z.infer<typeof SeaSchema>;
export type ArmyStart = z.infer<typeof ArmyStartSchema>;
export type FleetStart = z.infer<typeof FleetStartSchema>;
export type ArmiesEntry = z.infer<typeof ArmiesEntrySchema>;
export type Requires = z.infer<typeof RequiresSchema>;

/** Équilibrage des armées (data/balance/armies.json) ; toutes les valeurs sont des adaptations [A] ou des `?` paramétrables. */
const n = z.number();
export const ArmiesBalanceSchema = z
  .object({
    canon,
    notes_canon: z.string().optional(),
    move: z
      .object({
        terrain_speed: z.record(z.string(), n),
        forced_mult: n,
        fatigue_per_day: n,
        forced_fatigue_per_day: n,
        rest_recovery: n,
        fatigue_speed_floor: n,
        march_fatigue_cap: n,
        forced_attrition: n,
        sea_speed_mult: n,
      })
      .strict(),
    supply: z
      .object({
        max_days: n,
        resupply_per_day: n,
        starvation_attrition: n,
        starvation_morale: n,
        gas_out_odm_mult: n,
        naval_supply: n,
      })
      .strict(),
    morale: z.object({ base: n, drift: n, victory: n, defeat: n, general_lost: n, rout_below: n }).strict(),
    combat: z
      .object({
        base_losses: n,
        noise: n,
        fatigue_penalty: n,
        command_bonus_per_point: n,
        defender_terrain: z.record(z.string(), n),
        wall_defense_mult: n,
        artillery_weight: n,
        counter_battery: n,
        general_death_chance: n,
        retreat_losses: n,
        landing_penalty: n,
        landing_cliffs_penalty: n,
      })
      .strict(),
    titans: z.object({ attrition_per_density: n, encounter_per_density: n, odm_protection: n, group_per_density: n }).strict(),
    vision: z.object({ base: n, cavalry: n }).strict(),
    encounter: z.object({ pending_days_max: n, battle_soldiers_max: n }).strict(),
    siege: z.object({ wall_per_piece_day: n, garrison_losses_per_piece_day: n, capture_below_structure: n }).strict(),
    naval: z.object({ battle_losses: n, blockade_supply_mult: n, escort_ratio: n }).strict(),
    garrison: z.object({ transfer_max: n, relief_morale: n }).strict(),
    succession: z
      .object({
        crisis_days: n,
        legitimacy_hit: n,
        stability_hit: n,
        claimants: n,
        loyalty_rival: n,
        interim_command_mult: n,
      })
      .strict(),
    ai: z
      .object({
        threat_ratio: n,
        attack_ratio: n,
        landing_min_ratio: n,
        retreat_ratio: n,
        decision_cap: n,
      })
      .strict(),
  })
  .strict();

export type ArmiesBalance = z.infer<typeof ArmiesBalanceSchema>;
