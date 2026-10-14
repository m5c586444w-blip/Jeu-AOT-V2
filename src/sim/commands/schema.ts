import { z } from "zod";
import { MAX_SEATS, SEAT_PATTERN } from "../core/seat";
import { RT_ORDERS, TACTICAL_ORDERS } from "../tactical/types";

/**
 * Commandes typées (27 §1, C3) : enveloppe `{ seat, day, command }` en JSON pur. Les commandes d'armée et les ordres de
 * bataille ont ici un schéma Zod strict ; les autres commandes (politique, économie…) gardent leur validation de forme
 * (`validateCommand`) et passent par la même enveloppe.
 */

export const SeatIdSchema = z.string().regex(SEAT_PATTERN).refine((s) => Number(s.slice(5)) >= 1 && Number(s.slice(5)) <= MAX_SEATS, "siège hors plage");

const id = z.string().min(1).max(80);
const idOrNull = id.nullable();

const TimedOrderSchema = z
  .object({
    tick: z.number().int().min(0),
    squad: id,
    order: z.enum([...TACTICAL_ORDERS, ...RT_ORDERS] as [string, ...string[]]),
    target: z.number().int().min(0).optional(),
    unit: z.number().int().min(0).optional(),
    troop: z.number().int().min(0).optional(),
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    r: z.number().finite().optional(),
    follow: z.string().optional(),
    formation: z.string().optional(),
    queue: z.boolean().optional(),
    objective: z.string().optional(),
    restraint: z.string().optional(),
  })
  .strict();

/** Ordres d'armée et de flotte (ArmyOrder). */
export const ArmyOrderSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ArmyMove"), army: id, to: id }).strict(),
  z.object({ type: z.literal("ArmyHalt"), army: id }).strict(),
  z.object({ type: z.literal("ArmyForcedMarch"), army: id, on: z.boolean() }).strict(),
  z.object({ type: z.literal("ArmyIntercept"), army: id, target: id }).strict(),
  z.object({ type: z.literal("ArmyRetreat"), army: id }).strict(),
  z.object({ type: z.literal("ArmyMerge"), army: id, into: id }).strict(),
  z.object({ type: z.literal("ArmySplit"), army: id, regiments: z.array(z.object({ regiment: id, count: z.number().int().min(0) }).strict()), general: idOrNull }).strict(),
  z.object({ type: z.literal("ArmySetGeneral"), army: id, general: idOrNull }).strict(),
  z.object({ type: z.literal("ArmyGarrison"), army: id, mode: z.enum(["deposer", "prelever"]), soldiers: z.number().int().min(0) }).strict(),
  z.object({ type: z.literal("FleetMove"), fleet: id, to: id }).strict(),
  z.object({ type: z.literal("FleetMission"), fleet: id, mission: z.enum(["patrouille", "blocus", "escorte"]) }).strict(),
  z.object({ type: z.literal("FleetEmbark"), fleet: id, army: id }).strict(),
  z.object({ type: z.literal("FleetLand"), fleet: id, army: id, province: id }).strict(),
]);

export const ResolveEncounterSchema = z
  .object({ type: z.literal("ResolveEncounter"), encounter: id, mode: z.enum(["auto", "jouer", "retraite"]), orders: z.array(TimedOrderSchema), rt: z.boolean().optional() })
  .strict();

/** Ordre de bataille donné par un siège (appliqué à une bataille en cours, hors état de campagne). */
export const BattleOrderCommandSchema = z.object({ type: z.literal("BattleOrder"), order: TimedOrderSchema }).strict();

/** Pilier P1 Le Mur (D-165) : activation, sans paramètre. */
export const EnableWallSchema = z.object({ type: z.literal("EnableWall") }).strict();

/** Pilier P7 Le Registre (D-166) : activation, sans paramètre. */
export const EnableRegistrySchema = z.object({ type: z.literal("EnableRegistry") }).strict();

export const StrictCommandSchema = z.union([ArmyOrderSchema, ResolveEncounterSchema, BattleOrderCommandSchema, EnableWallSchema, EnableRegistrySchema]);

export type BattleOrderCommand = z.infer<typeof BattleOrderCommandSchema>;

/** Enveloppe sérialisable : qui (siège), quand (jour absolu de la partie), quoi (commande brute, validée ensuite). */
export const EnvelopeSchema = z
  .object({
    seat: SeatIdSchema,
    day: z.number().int().min(0),
    command: z.object({ type: z.string().min(1).max(40) }).passthrough(),
  })
  .strict();

export type CommandEnvelope = { seat: string; day: number; command: { type: string } & Record<string, unknown> };

const STRICT_TYPES: ReadonlySet<string> = new Set([...ArmyOrderSchema.options.map((o) => o.shape.type.value), "ResolveEncounter", "BattleOrder", "EnableWall", "EnableRegistry"]);

/** Vrai si le type de commande a un schéma Zod strict dans ce module. */
export const isStrictType = (t: string): boolean => STRICT_TYPES.has(t);
