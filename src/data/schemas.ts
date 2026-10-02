import { z } from "zod";
import type { CollectionName } from "./collections";

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

export const ProvinceSchema = z
  .object({
    id: ProvinceIdSchema,
    atlas_code: z.string().regex(/^[A-Z]{1,2}\d{2}$/).optional(),
    name_key: z.string().min(1),
    region: z.string().min(1),
    wall: z.enum(["maria", "rose", "sina"]).nullable().optional(),
    terrain: z.enum(["urbain", "rural", "foret", "mur", "cote", "plaine", "souterrain", "fort", "ruines", "fleuve", "marais", "plateau", "vallee", "collines", "montagne", "lac", "militaire"]),
    destroyed_year: year.optional(),
    destroyed_event: EventIdSchema.optional(),
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

/** Sous-dossier de /data → schéma de ses entrées. */
export const COLLECTIONS: Record<CollectionName, z.ZodType> = {
  provinces: ProvinceSchema,
  characters: CharacterSchema,
  techs: TechSchema,
  events: EventDefSchema,
  placements: PlacementSchema,
};

export { COLLECTION_NAMES } from "./collections";
export type { CollectionName } from "./collections";
