import { z } from "zod";
import type { CollectionName } from "./collections";
import { KEY_RESOURCES, RATIONING_LEVELS, RESOURCE_IDS } from "../sim/strategic/resources";

// Messages d'erreur de Zod en français (langue principale du projet).
z.config(z.locales.fr());

/** Statut de fiabilité de toute entrée : C = canon, A = adaptation, ? = incertain (paramétrable). */
export const CanonSchema = z.enum(["C", "A", "?"]);
export type Canon = z.infer<typeof CanonSchema>;

const year = z.number().int().min(0).max(2000);
const idOf = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-z0-9_]+$`), `identifiant attendu au format ${prefix}_xxx (snake_case)`);

export const ProvinceIdSchema = idOf("prov");
export const CharacterIdSchema = idOf("char");
export const TechIdSchema = idOf("tech");
export const EventIdSchema = idOf("evt");
export const TraitIdSchema = idOf("trait");
export const OrganisationIdSchema = idOf("org");
export const LawIdSchema = idOf("law");
export const RoleIdSchema = idOf("role");
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
    ...canonFields,
  })
  .strict();

export const EventDefSchema = z
  .object({
    id: EventIdSchema,
    code: z.string().regex(/^E\d{2}$/).optional(),
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
    text_key: z.string().min(1),
    ...canonFields,
  })
  .strict()
  .refine((e) => e.year_max === undefined || e.year_max >= e.year_min, { message: "year_max doit être ≥ year_min", path: ["year_max"] });

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

export type Province = z.infer<typeof ProvinceSchema>;
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
};

export { COLLECTION_NAMES } from "./collections";
export type { CollectionName } from "./collections";
