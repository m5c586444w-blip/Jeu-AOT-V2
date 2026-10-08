import { z } from "zod";
import type { CollectionName } from "./collections";
import { KEY_RESOURCES, RATIONING_LEVELS, RESOURCE_IDS } from "../sim/strategic/resources";
import { ChoiceSchema, ConditionSchema, EffectSchema, TechEffectSchema } from "./effects";
import { ArmiesEntrySchema, ArtilleryEntrySchema } from "./armySchemas";

// Messages d'erreur de Zod en français (langue principale du projet).
z.config(z.locales.fr());

/** Statut de fiabilité de toute entrée : C = canon, A = adaptation, ? = incertain (paramétrable). */
export const CanonSchema = z.enum(["C", "A", "?"]);
export type Canon = z.infer<typeof CanonSchema>;

const year = z.number().int().min(0).max(2000);
const idOf = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-z0-9_]+$`), `identifiant attendu au format ${prefix}_xxx (snake_case)`);

export const ProvinceIdSchema = idOf("prov");
export const FactionIdSchema = idOf("fac");
export const WorldProvinceIdSchema = idOf("wprov");
export const FormationIdSchema = idOf("form");

export const CharacterIdSchema = idOf("char");
export const TechIdSchema = idOf("tech");
export const EventIdSchema = idOf("evt");
export const TraitIdSchema = idOf("trait");
export const OrganisationIdSchema = idOf("org");
export const LawIdSchema = idOf("law");
export const RoleIdSchema = idOf("role");
export const UnitIdSchema = idOf("unit");
export const TitanClassIdSchema = idOf("titan");
export const TitanTypeIdSchema = idOf("ttype");
export const TacticalMapIdSchema = idOf("tmap");
export const StratumIdSchema = idOf("str");


/** Champs communs : statut canon et note facultative. */
const canonFields = {
  canon: CanonSchema,
  notes_canon: z.string().optional(),
};

const unit = z.number().min(0).max(1);
const resourceRecord = z.partialRecord(z.enum(RESOURCE_IDS), z.number());
export const BuildingIdSchema = idOf("bld");
export const ScenarioIdSchema = idOf("scn");

export const PoiSchema = z.object({ id: idOf("poi"), name_key: z.string().min(1), ...{ canon: CanonSchema } }).strict();

export const ProvinceSchema = z
  .object({
    id: ProvinceIdSchema,
    atlas_code: z.string().regex(/^[A-Z]{1,2}\d{2}$/).optional(),
    name_key: z.string().min(1),
    desc_key: z.string().min(1).optional(),
    /** outre = territoire des Titans ; segment = tronçon de mur ; province = terre habitée entre les murs. */
    kind: z.enum(["outre", "segment", "province"]).default("province"),
    region: z.string().min(1),
    wall: z.enum(["maria", "rose", "sina"]).nullable().optional(),
    terrain: z.enum(["urbain", "rural", "foret", "mur", "cote", "plaine", "souterrain", "fort", "ruines", "fleuve", "marais", "plateau", "vallee", "collines", "montagne", "lac", "militaire"]),
    pop_level: z.number().int().min(0).max(5).default(0),
    key_resource: z.enum(KEY_RESOURCES).default("none"),
    titan_density: unit.default(0),
    visibility: z.enum(["connue", "partielle", "inexplore"]).default("connue"),
    poi: z.array(PoiSchema).optional(),
    destroyed_year: year.optional(),
    destroyed_event: EventIdSchema.optional(),
    /** Statut de la position sur la carte quand il diffère de celui de l'existence (ex. ville-usine : existence C, localisation ?). */
    location_canon: CanonSchema.optional(),
    ...canonFields,
  })
  .strict();

export const BuildingSchema = z
  .object({
    id: BuildingIdSchema,
    name_key: z.string().min(1),
    /** Capacité de stockage ajoutée à la réserve nationale. */
    storage: resourceRecord.default({}),
    /** Bonus multiplicatif de production de la province (0.2 = +20 %). */
    production_bonus: resourceRecord.default({}),
    /** Transformation quotidienne (ex. fabrique de gaz : pierre à éclatement de glace → gaz). */
    conversion: z.object({ from: z.enum(RESOURCE_IDS), to: z.enum(RESOURCE_IDS), per_day: z.number().positive(), ratio: z.number().positive() }).strict().optional(),
    upkeep_gold_month: z.number().min(0).default(0),
    ...canonFields,
  })
  .strict();

const garrison = z.object({ org: z.enum(["garrison", "military_police", "survey_corps", "training_corps"]), soldiers: z.number().int().min(0) }).strict();

export const ScenarioSchema = z
  .object({
    id: ScenarioIdSchema,
    name_key: z.string().min(1),
    faction: z.string().min(1),
    start: z.object({ year, day: z.number().int().min(1).max(360) }).strict(),
    default_control: z.enum(["paradis", "titans", "perdu"]),
    control: z.record(ProvinceIdSchema, z.enum(["paradis", "titans", "perdu"])).default({}),
    /** Statut du rattachement indiqué dans `control` (règle R7 : jamais « C » pour une province à localisation « ? »). */
    control_canon: z.record(ProvinceIdSchema, CanonSchema).default({}),
    /** Densité de Titans propre au scénario (D-51), par province ; sinon celle du fichier des provinces. */
    titan_density: z.record(ProvinceIdSchema, unit).default({}),
    /** Province de départ des expéditions (850 : Karanes, 06 S02 [C]). */
    expedition_base: ProvinceIdSchema.optional(),
    /** P5 : « canon_fidele » fait tourner le moteur d'événements canon (02 §12) ; « aucun » pour un bac à sable sans chronologie. */
    events_mode: z.enum(["canon_fidele", "aucun"]).default("aucun"),
    garrisons: z.record(ProvinceIdSchema, garrison).default({}),
    buildings: z.record(ProvinceIdSchema, z.array(BuildingIdSchema)).default({}),
    stocks: resourceRecord,
    rationing: z.enum(RATIONING_LEVELS),
    morale: z.number().min(0).max(100),
    stability: z.number().min(0).max(100),
    /** Population de départ (sinon : data/balance/economy.json). */
    population_total: z.number().positive().optional(),
    /** Conditions propres au scénario sur la production (ex. terres mises en culture) [A]. */
    production_mult: z.partialRecord(z.enum(RESOURCE_IDS), z.number().positive()).default({}),
    production_note_key: z.string().optional(),
    /** Part de réfugiés dans la population, par région. */
    refugee_share: z.record(z.string(), z.number().min(0).max(1)).default({}),
    /** P7 : morts avant le départ du scénario (854), avec l'événement ou la raison. */
    deceased: z.array(CharacterIdSchema).default([]),
    /** P7 : porteurs au départ du scénario, à la place de `holder_850`. */
    shifter_holders: z.record(z.string().regex(/^shifter_[a-z_]+$/), z.object({ character: CharacterIdSchema.nullable(), faction: z.enum(["paradis", "marley", "inconnu", "perdu"]), since: year, since_canon: CanonSchema }).strict()).default({}),
    /** P7 : secrets déjà percés au départ. */
    revealed_secrets: z.array(z.string()).default([]),
    /** P7 : drapeaux d'événements au départ. */
    flags: z.record(z.string(), z.boolean()).default({}),
    /** P7 : couche du monde (nations, formations, guerres). */
    world: z
      .object({
        playable: z.array(FactionIdSchema).min(1),
        control: z.record(WorldProvinceIdSchema, FactionIdSchema).default({}),
        formations: z.record(WorldProvinceIdSchema, z.array(z.object({ formation: FormationIdSchema, count: z.number().int().min(1) }).strict())).default({}),
        wars: z.array(z.tuple([FactionIdSchema, FactionIdSchema])).default([]),
        treaties: z.array(z.object({ kind: z.enum(["alliance", "non_agression", "commerce", "renseignement"]), a: FactionIdSchema, b: FactionIdSchema }).strict()).default([]),
        /** Neutralité crédible d'Hizuru (07 H01) : −100 = Marley, +100 = Paradis. */
        hizuru_lean: z.number().min(-100).max(100).default(0),
      })
      .strict()
      .optional(),
    politics: z
      .object({
        player: CharacterIdSchema,
        legitimacy: z.number().min(0).max(100),
        political_capital: z.number().min(0),
        roles: z.record(RoleIdSchema, CharacterIdSchema.nullable()),
        org_leaders: z.record(OrganisationIdSchema, CharacterIdSchema),
        budget: z.record(OrganisationIdSchema, z.number().min(0)),
        laws: z.array(LawIdSchema).default([]),
        /** Sièges du Cabinet sans rôle de conseiller (ex. représentant de la noblesse, 08 §4.1). */
        cabinet_extra: z.array(CharacterIdSchema).default([]),
        org_influence: z.record(OrganisationIdSchema, z.number().min(0).max(100)).default({}),
      })
      .strict()
      .optional(),
    ...canonFields,
  })
  .strict();


import { AGENDAS, ATTRIBUTES, RELATION_TYPES } from "../sim/politics/vocabulary";
export type { AttributeId } from "../sim/politics/vocabulary";

const attributeRecord = z.partialRecord(z.enum(ATTRIBUTES), z.number().int().min(0).max(100));
/** Écart d'attribut apporté par un trait (−50 à +50). */
const attributeDelta = z.partialRecord(z.enum(ATTRIBUTES), z.number().int().min(-50).max(50));

export const CharacterSchema = z
  .object({
    id: CharacterIdSchema,
    name: z.string().min(1),
    /** Nom sous lequel le personnage est connu au départ (identité de couverture). */
    display_name: z.string().min(1).optional(),
    birth_year: year.optional(),
    active_from: year,
    active_until: year.optional(),
    death_event: EventIdSchema.optional(),
    faction: z.string().min(1),
    org: OrganisationIdSchema.optional(),
    rank_key: z.string().optional(),
    roles: z.array(z.string()).default([]),
    attributes: attributeRecord.default({}),
    traits: z.array(TraitIdSchema).default([]),
    agenda: z.enum(AGENDAS).default("pragmatique"),
    honesty: z.number().int().min(0).max(100).default(50),
    /** Notoriété (0–100) : poids d'une mort sur la légitimité et le moral [A]. */
    fame: z.number().int().min(0).max(100).default(20),
    relations: z.array(z.object({ to: CharacterIdSchema, type: z.enum(RELATION_TYPES), strength: z.number().min(-100).max(100), canon: CanonSchema }).strict()).default([]),
    /** Secrets (porteurs infiltrés, identité cachée) : jamais affichés avant le système de révélation (P5). */
    hidden: z.object({ faction: z.string().optional(), titan: z.string().optional(), true_name: z.string().optional() }).strict().optional(),
    portrait: z.object({ seed: z.number().int(), archetype: z.enum(["officier", "soldat", "cadet", "civil", "clerc", "noble", "ombre"]) }).strict().optional(),
    bio_key: z.string().optional(),
    ...canonFields,
  })
  .strict();

/** Modificateur générique appliqué par un décret ou un trait. */
export const ModifierSchema = z
  .object({
    target: z.string().regex(/^(legitimacy|stability|morale|tax_mult|manpower_mult|capital_monthly|(production_mult|consumption_mult|losses_mult):[a-z]+|(satisfaction|radicalisation):str_[a-z_]+|(org_loyalty|org_influence):org_[a-z_]+)$/, "cible de modificateur inconnue"),
    value: z.number(),
  })
  .strict();
export type Modifier = z.infer<typeof ModifierSchema>;

export const TraitSchema = z
  .object({
    id: TraitIdSchema,
    name_key: z.string().min(1),
    attributes: attributeDelta.default({}),
    /** Multiplicateur du stress reçu (1 = neutre). */
    stress_gain: z.number().positive().default(1),
    /** Biais des avis (08 §3.2) : gonfle les succès, exagère les risques, ignore les contre-indices. */
    advice_bias: z.enum(["gonfle", "exagere", "ignore"]).optional(),
    /** Penchants de vote : étiquette de décret → affinité (−1 à 1). */
    vote: z.record(z.string(), z.number().min(-1).max(1)).default({}),
    opposes: z.array(TraitIdSchema).default([]),
    /** Trait acquis en cours de partie (trauma, épuisement) plutôt que de naissance. */
    acquired: z.boolean().default(false),
    ...canonFields,
  })
  .strict();

export const StratumSchema = z
  .object({ id: StratumIdSchema, name_key: z.string().min(1), ...canonFields })
  .strict();

export const OrganisationSchema = z
  .object({
    id: OrganisationIdSchema,
    /** Clé courte utilisée par les garnisons (`garrison`, `military_police`…). */
    key: z.string().min(1),
    name_key: z.string().min(1),
    kind: z.enum(["militaire", "religieuse", "civile", "cour"]),
    /** Reçoit une part du budget militaire (F-ECO-15). */
    budgeted: z.boolean().default(false),
    ...canonFields,
  })
  .strict();

export const LawSchema = z
  .object({
    id: LawIdSchema,
    name_key: z.string().min(1),
    desc_key: z.string().min(1),
    category: z.enum(["militaire", "economie", "ordre", "religion", "information", "societe"]),
    requires_vote: z.boolean(),
    cost: z.object({ capital: z.number().min(0), gold: z.number().min(0) }).strict(),
    /** Étiquettes de programme : servent au vote (affinités des membres du Cabinet). */
    tags: z.array(z.string()).min(1),
    exclusive_group: z.string().optional(),
    effects: z.array(ModifierSchema).min(1),
    delayed: z.array(z.object({ after_days: z.number().int().positive(), effects: z.array(ModifierSchema).min(1), log_key: z.string().min(1) }).strict()).default([]),
    ...canonFields,
  })
  .strict();

export const RoleSchema = z
  .object({
    id: RoleIdSchema,
    number: z.number().int().min(1).max(18),
    name_key: z.string().min(1),
    /** Siège au Cabinet (08 §4.1). */
    cabinet: z.boolean(),
    /** Grandeur surveillée par le conseiller pour ses avis. */
    metric: z.enum(["food_days", "gas_days", "steel_days", "gold", "legitimacy", "morale", "stability", "radicalisation", "faith", "manpower", "wall_structure", "horses", "capital", "none"]),
    /** Seuil sous lequel (ou au-dessus duquel, pour la radicalisation) le conseiller s'alarme. */
    alarm: z.number(),
    /** Décret proposé quand l'alarme est atteinte. */
    proposal: LawIdSchema.optional(),
    /** Domaine du veto (catégorie de décrets) quand le titulaire est influent (F-ADV-03). */
    veto_category: z.string().optional(),
    ...canonFields,
  })
  .strict();

const unlockEvent = z.union([EventIdSchema, z.array(EventIdSchema).min(1)]);

export const TechSchema = z
  .object({
    id: TechIdSchema,
    code: z.string().regex(/^T-[A-Z]{3}-\d{2}$/).optional(),
    tree: z.string().min(1),
    faction: z.string().optional(),
    cost: z.number().nonnegative().nullable(),
    prereqs: z.array(TechIdSchema).default([]),
    start: z.boolean().default(false),
    unlock_event: unlockEvent.optional(),
    requires_character: CharacterIdSchema.optional(),
    min_year: year,
    risk: z.number().min(0).max(1).optional(),
    exclusive_with: z.array(TechIdSchema).optional(),
    /** P5 : effets lus par les systèmes (13, valeurs `A`). */
    effects: z.array(TechEffectSchema).default([]),
    /** Exige un Titan capturé vivant (13 §0, « Capture / expérience »). */
    requires_capture: z.boolean().default(false),
    /** Doctrine (13 §10) : choix exclusif. */
    doctrine: z.boolean().default(false),
    /** Phase où sa mécanique arrive quand elle n'existe pas encore (affiché, aucune valeur inventée). */
    mechanic_phase: z.enum(["P6", "P7", "P8", "P9"]).optional(),
    ...canonFields,
  })
  .strict();

export const EVENT_FAMILIES = ["civil", "militaire", "politique", "personnage", "titans", "monde", "etranger"] as const;
/** Thèmes de la frise (CHR.3) : filtre de la chronologie. */
export const EVENT_THEMES = ["politique", "militaire", "titans", "famille", "monde"] as const;
export type EventTheme = (typeof EVENT_THEMES)[number];
export const EVENT_FORMS = ["rapport", "lettre", "telegramme", "article", "proces_verbal"] as const;

export const EventDefSchema = z
  .object({
    id: EventIdSchema,
    code: z.string().regex(/^E\d{2}$/).optional(),
    /** Canon (12 §1, graphe), générique à décision (12 §5) ou de fond (CHR.2 : petit fait de la vie du royaume, sans décision). */
    kind: z.enum(["canon", "generic", "fond"]).default("canon"),
    /** Thème de la frise (CHR.3). */
    theme: z.enum(EVENT_THEMES).optional(),
    /** Année approximative (le canon ne la donne pas avec certitude) : la frise écrit « vers ». */
    date_approx: z.boolean().optional(),
    /** Frise : événement caché au joueur tant que celui-ci n'est pas survenu (E03, révélé à la chapelle Reiss). */
    known_after: EventIdSchema.optional(),
    /** Faux pour un squelette sans mécanique (événement d'une phase ultérieure, référencé par une technologie). */
    playable: z.boolean().default(true),
    year_min: year,
    year_max: year.optional(),
    window: z
      .object({
        after: z.union([EventIdSchema, z.array(EventIdSchema)]).nullable(),
        within_days: z.tuple([z.number().int().min(0), z.number().int().min(0)]).optional(),
      })
      .strict(),
    location: z.union([ProvinceIdSchema, z.literal("?")]).optional(),
    divergence_weight: z.number().min(0).max(1).optional(),
    bifurcation: z.string().regex(/^B\d$/).optional(),
    /** Conditions de contexte ; si l'une ne tient plus au jour dit, l'événement canon est évité. */
    conditions: z.array(ConditionSchema).default([]),
    /** Effets appliqués au déclenchement (avant tout choix). */
    effects: z.array(EffectSchema).default([]),
    choices: z.array(ChoiceSchema).default([]),
    /** Jours laissés au joueur avant que le choix historique (ou le premier) ne s'applique. */
    deadline_days: z.number().int().min(0).optional(),
    form: z.enum(EVENT_FORMS).default("rapport"),
    family: z.enum(EVENT_FAMILIES).optional(),
    /** Générique : sujet tiré au sort, désigné dans les effets par char_subject ou prov_subject. */
    subject: z.enum(["personnage", "province", "province_frontiere"]).optional(),
    /** Générique : probabilité par mois quand les conditions tiennent ; délai minimal entre deux occurrences. */
    chance: z.number().min(0).max(1).optional(),
    cooldown_days: z.number().int().min(0).optional(),
    text_key: z.string().min(1),
    ...canonFields,
  })
  .strict()
  .refine((e) => e.year_max === undefined || e.year_max >= e.year_min, { message: "year_max doit être ≥ year_min", path: ["year_max"] })
  .refine((e) => e.kind === "canon" || (e.family !== undefined && (e.kind === "fond" || e.chance !== undefined)), { message: "un événement générique exige family et chance (fond : family)", path: ["family"] })
  .refine((e) => e.kind !== "fond" || e.choices.length === 0, { message: "un événement de fond n'a pas de choix", path: ["choices"] })
  .refine((e) => new Set(e.choices.map((c) => c.id)).size === e.choices.length, { message: "identifiants de choix en double", path: ["choices"] })
  .refine((e) => e.kind !== "canon" || !e.playable || e.choices.length === 0 || e.choices.filter((c) => c.historical).length === 1, { message: "un événement canon à choix a exactement un choix historique", path: ["choices"] });

/** Positionnement d'une entité (unité…) dans un lieu à une année donnée : sert à la règle R5. */
export const PlacementSchema = z
  .object({
    id: z.string().regex(/^[a-z]+_[a-z0-9_]+$/),
    kind: z.enum(["unit", "character"]),
    location: ProvinceIdSchema,
    year,
    ...canonFields,
  })
  .strict();

/** data/units — types d'unités (10 §1.1). */
export const UnitSchema = z
  .object({
    id: UnitIdSchema,
    code: z.string().regex(/^U-[A-Z]\d{2}$/),
    name_key: z.string().min(1),
    size: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
    role: z.enum(["eclaireur", "tueur", "soutien", "cavalier", "medecin", "convoi"]),
    ...canonFields,
  })
  .strict();

/** data/titans — classes de Titans purs (03 §5.2, valeurs [A]). */
export const TitanClassSchema = z
  .object({
    id: TitanClassIdSchema,
    name_key: z.string().min(1),
    size_m: z.tuple([z.number().positive(), z.number().positive()]),
    threat: z.number().positive(),
    weight: unit,
    abnormal: z.boolean(),
    ...canonFields,
  })
  .strict();

/** data/names — listes de noms pour le générateur de soldats (F-CHR-17), créations du projet [A]. */
export const NameListSchema = z
  .object({
    id: z.string().regex(/^names_[a-z0-9_]+$/),
    given_m: z.array(z.string().min(1)).min(20),
    given_f: z.array(z.string().min(1)).min(20),
    family: z.array(z.string().min(1)).min(40),
    ...canonFields,
  })
  .strict();

/** Effets des capacités des Neuf (03 §8.2), interprétés par la simulation tactique (P6). */
export const SHIFTER_EFFECTS = ["heat_wave", "armor", "charge", "hardening", "call", "projectiles", "command_pures", "speed", "bite", "endurance", "transport", "spikes", "remote_body", "melee_titans", "regeneration", "founder_command"] as const;

export const ShifterAbilitySchema = z
  .object({
    id: z.string().regex(/^[a-z_]+$/),
    effect: z.enum(SHIFTER_EFFECTS),
    /** Capacité passive : toujours active quand le porteur est transformé ; `power` en est la grandeur et la limite. */
    passive: z.boolean().default(false),
    /** Coût d'endurance par emploi (ou par seconde pour un effet continu). */
    cost: z.number().min(0),
    range_m: z.number().min(0),
    radius_m: z.number().min(0).default(0),
    delay_s: z.number().min(0),
    cooldown_s: z.number().min(0),
    duration_s: z.number().min(0).default(0),
    /** Grandeur principale (probabilité de tuer, multiplicateur…), selon l'effet. */
    power: z.number(),
    /** Exige un drapeau de partie (Fondation : contact royal, 02 §10). */
    requires_flag: z.string().optional(),
    canon: z.enum(["C", "A", "?"]),
  })
  .strict();

/** data/shifters — les Neuf Titans (03 §8, 11 §4) : capacités, chaîne de porteurs, porteur en 850. */
export const ShifterSchema = z
  .object({
    id: z.string().regex(/^shifter_[a-z_]+$/),
    name_key: z.string().min(1),
    height_m: z.tuple([z.number().positive(), z.number().positive()]),
    speed_m_s: z.number().positive(),
    hp: z.object({ nape: z.number().positive(), arm: z.number().positive(), leg: z.number().positive() }).strict(),
    endurance: z.number().positive(),
    regen_per_s: z.number().min(0),
    abilities: z.array(ShifterAbilitySchema).min(1),
    chain: z.array(z.object({ holder: CharacterIdSchema.nullable(), name: z.string().min(1), from: year.nullable(), to: year.nullable(), canon: z.enum(["C", "A", "?"]) }).strict()).min(1),
    holder_850: z.object({ character: CharacterIdSchema.nullable(), faction: z.enum(["paradis", "marley", "inconnu"]), since: year, since_canon: z.enum(["C", "A", "?"]) }).strict(),
    ...canonFields,
  })
  .strict();

/** P7 — nations du monde (02 §11, §13, §14). */
export const PERSONALITIES = ["prudent", "agressif", "ideologue", "pragmatique", "opportuniste"] as const;
export const FORMATION_KINDS = ["infanterie", "assaut", "artillerie", "mitrailleurs", "cavalerie", "blindes", "train_blinde", "chasse", "bombardement", "dirigeable", "cuirasses", "croiseurs", "transports", "police", "guerriers", "espions", "coloniaux", "antiaerien", "garde", "marine_cotiere", "ingenieurs"] as const;
const relationAxes = z.object({ trust: z.number().min(-100).max(100), interest: z.number().min(-100).max(100), fear: z.number().min(0).max(100), ideology: z.number().min(-100).max(100) }).strict();

/** data/world_provinces — les 60 provinces du monde (06 §3) et Paradis, en nœuds schématiques [A]. */
export const WorldProvinceSchema = z
  .object({
    id: WorldProvinceIdSchema,
    code: z.string().min(1),
    name_key: z.string().min(1),
    faction: z.union([FactionIdSchema, z.literal("mer")]),
    type: z.enum(["urbain", "port", "fort", "militaire", "industriel", "rural", "colonie", "foret", "special", "mer", "ile"]),
    /** Production mensuelle [A] : industrie, nourriture, hommes. */
    industry: z.number().min(0).default(0),
    food: z.number().min(0).default(0),
    manpower: z.number().min(0).default(0),
    coastal: z.boolean().default(false),
    rail: z.boolean().default(false),
    /** Fortification (0–1) : bonus de défense. */
    fort: unit.default(0),
    /** Position schématique sur l'atlas du monde (0–1000) [A]. */
    at: z.tuple([z.number(), z.number()]),
    adjacent: z.array(WorldProvinceIdSchema).default([]),
    ...canonFields,
  })
  .strict();

/** data/factions — nations jouables ou non (02 §13–14 ; 07 ; 11 §5). */
export const FactionSchema = z
  .object({
    id: FactionIdSchema,
    name_key: z.string().min(1),
    playable: z.boolean().default(false),
    personality: z.enum(PERSONALITIES),
    /** Attracteurs canon (02 §14) : orientent l'IA sans la scénariser. */
    attractors: z.array(z.enum(["fondateur", "garanties", "survie", "commerce", "revanche", "verite", "domination"])).min(1),
    objectives: z.array(z.string().min(1)).min(1),
    relations: z.record(FactionIdSchema, relationAxes).default({}),
    war_support: z.number().min(0).max(100),
    stability: z.number().min(0).max(100),
    industry_stock: z.number().min(0).default(0),
    manpower_stock: z.number().min(0).default(0),
    leader: CharacterIdSchema.optional(),
    ...canonFields,
  })
  .strict();

/** data/formations — formations de la guerre moderne (10 §1.2–1.3) [A]. */
export const FormationSchema = z
  .object({
    id: FormationIdSchema,
    code: z.string().min(1),
    name_key: z.string().min(1),
    faction: FactionIdSchema,
    kind: z.enum(FORMATION_KINDS),
    domain: z.enum(["terre", "air", "mer"]),
    attack: z.number().min(0),
    defense: z.number().min(0),
    /** Coût de levée et entretien mensuel (industrie, hommes). */
    cost: z.object({ industry: z.number().min(0), manpower: z.number().min(0) }).strict(),
    upkeep: z.number().min(0),
    build_days: z.number().int().min(0),
    /** Provinces franchies par semaine. */
    speed: z.number().min(0),
    /** Désactivée tant que son existence n'est pas confirmée (blindés `?`). */
    enabled: z.boolean().default(true),
    ...canonFields,
  })
  .strict();

/** data/titan_types — types de Titans purs du combat tactique (F-TIT-01) : classe (03 §5.2) × comportement [A]. */
export const TitanTypeSchema = z
  .object({
    id: TitanTypeIdSchema,
    class: TitanClassIdSchema,
    behavior: z.enum(["errant", "meute", "coureur", "sauteur", "ignorant", "rampant"]),
    name_key: z.string().min(1),
    height_m: z.tuple([z.number().positive(), z.number().positive()]),
    speed_m_s: z.number().positive(),
    silhouettes: z.array(z.number().int().min(0).max(9)).min(1),
    weight: unit,
    ...canonFields,
  })
  .strict();

const range = z.tuple([z.number().min(0), z.number().min(0)]);
const brick = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("batiment"), grid: z.object({ cell_m: z.number().positive(), street_m: z.number().min(0), fill: unit }).strict(), height_m: range, anchors_per_face: z.number().int().min(0), band_m: range.optional() }).strict(),
  z.object({ kind: z.literal("arbre_geant"), count: z.number().int().min(0), radius_m: range, height_m: range, anchors_per_tree: z.number().int().min(0) }).strict(),
  z.object({ kind: z.literal("arbre"), count: z.number().int().min(0), radius_m: range, height_m: range, anchors_per_tree: z.number().int().min(0) }).strict(),
  z.object({ kind: z.literal("rocher"), count: z.number().int().min(0), size_m: range, height_m: range, anchors_per_face: z.number().int().min(0) }).strict(),
  z.object({ kind: z.literal("mur"), height_m: range, thickness_m: z.number().positive(), anchors_per_face: z.number().int().min(0) }).strict(),
]);

/** data/tactical_maps — cartes tactiques en briques de terrain (03 §2, F-CMB-40), générées par graine. */
export const TacticalMapSchema = z
  .object({
    id: TacticalMapIdSchema,
    name_key: z.string().min(1),
    terrain: z.enum(["ville", "foret", "plaine", "mur"]),
    size_m: z.tuple([z.number().positive(), z.number().positive()]),
    bricks: z.array(brick).min(1),
    ...canonFields,
  })
  .strict();

export type Province = z.infer<typeof ProvinceSchema>;
export type TitanType = z.infer<typeof TitanTypeSchema>;
export type Shifter = z.infer<typeof ShifterSchema>;
export type WorldProvince = z.infer<typeof WorldProvinceSchema>;
export type Faction = z.infer<typeof FactionSchema>;
export type Formation = z.infer<typeof FormationSchema>;
export type ShifterAbility = z.infer<typeof ShifterAbilitySchema>;
export type TacticalMap = z.infer<typeof TacticalMapSchema>;
export type MapBrick = z.infer<typeof brick>;
export type Unit = z.infer<typeof UnitSchema>;
export type TitanClass = z.infer<typeof TitanClassSchema>;
export type NameList = z.infer<typeof NameListSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type Tech = z.infer<typeof TechSchema>;
export type EventDef = z.infer<typeof EventDefSchema>;
export type Placement = z.infer<typeof PlacementSchema>;
export type Building = z.infer<typeof BuildingSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type Trait = z.infer<typeof TraitSchema>;
export type Stratum = z.infer<typeof StratumSchema>;
export type Organisation = z.infer<typeof OrganisationSchema>;
export type Law = z.infer<typeof LawSchema>;
export type Role = z.infer<typeof RoleSchema>;

/** Sous-dossier de /data → schéma de ses entrées. */
export const COLLECTIONS: Record<CollectionName, z.ZodType> = {
  provinces: ProvinceSchema,
  characters: CharacterSchema,
  techs: TechSchema,
  events: EventDefSchema,
  placements: PlacementSchema,
  buildings: BuildingSchema,
  scenarios: ScenarioSchema,
  traits: TraitSchema,
  strata: StratumSchema,
  organisations: OrganisationSchema,
  laws: LawSchema,
  roles: RoleSchema,
  units: UnitSchema,
  titans: TitanClassSchema,
  names: NameListSchema,
  titan_types: TitanTypeSchema,
  shifters: ShifterSchema,
  tactical_maps: TacticalMapSchema,
  world_provinces: WorldProvinceSchema,
  factions: FactionSchema,
  formations: FormationSchema,
  artillery: ArtilleryEntrySchema,
  armies: ArmiesEntrySchema,
};

export { COLLECTION_NAMES } from "./collections";
export type { CollectionName } from "./collections";
