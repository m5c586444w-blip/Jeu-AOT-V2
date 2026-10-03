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
    ...canonFields,
  })
  .strict();

export const CharacterSchema = z
  .object({
    id: CharacterIdSchema,
    name: z.string().min(1),
    birth_year: year.optional(),
    active_from: year,
    active_until: year.optional(),
    death_event: EventIdSchema.optional(),
    faction: z.string().min(1),
    roles: z.array(z.string()).default([]),
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

/** Sous-dossier de /data → schéma de ses entrées. */
export const COLLECTIONS: Record<CollectionName, z.ZodType> = {
  provinces: ProvinceSchema,
  characters: CharacterSchema,
  techs: TechSchema,
  events: EventDefSchema,
  placements: PlacementSchema,
  buildings: BuildingSchema,
  scenarios: ScenarioSchema,
};

export { COLLECTION_NAMES } from "./collections";
export type { CollectionName } from "./collections";
