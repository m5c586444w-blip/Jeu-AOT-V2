import { z } from "zod";
import { KEY_RESOURCES, RATIONING_LEVELS, RESOURCE_IDS } from "../sim/strategic/resources";
import { CanonSchema } from "./schemas";

const res = z.partialRecord(z.enum(RESOURCE_IDS), z.number());
const rationingEffect = z.object({ consumption: z.number(), morale: z.number(), productivity: z.number() }).strict();
const factorRange = z.object({ at_0: z.number().positive(), at_100: z.number().positive() }).strict();

/** data/balance/economy.json — tous les chiffres de l'économie (aucun nombre magique dans le code). */
export const EconomyBalanceSchema = z
  .object({
    canon: CanonSchema,
    notes_canon: z.string().optional(),
    population: z.object({ total_start: z.number().positive(), level_weights: z.array(z.number().min(0)).length(6) }).strict(),
    output: z
      .object({
        pop_level_mult: z.array(z.number().min(0)).length(6),
        key_resource: z.record(z.enum(KEY_RESOURCES), res),
        morale_factor: factorRange,
        stability_factor: factorRange,
        season: z.partialRecord(z.enum(["hiver", "printemps", "ete", "automne"]), res),
      })
      .strict(),
    consumption: z
      .object({
        food_per_pop: z.number().min(0),
        food_per_soldier: z.number().min(0),
        gas_per_soldier: z.number().min(0),
        gas_heating_per_pop_winter: z.number().min(0),
        steel_per_soldier: z.number().min(0),
        powder_per_soldier: z.number().min(0),
        horse_mortality: z.number().min(0).max(1),
      })
      .strict(),
    storage: z.object({ per_pop_level: res, per_segment: res, manpower_cap_per_pop: z.number().min(0) }).strict(),
    losses_per_day: res,
    rationing: z.record(z.enum(RATIONING_LEVELS), rationingEffect),
    morale: z.object({ base_target: z.number(), approach_per_day: z.number().min(0).max(1), famine: z.number(), winter: z.number(), reserve_bonus: z.number(), reserve_days: z.number().min(0) }).strict(),
    stability: z.object({ base_target: z.number(), per_morale: z.number(), approach_per_day: z.number().min(0).max(1) }).strict(),
    famine: z.object({ mortality_per_day: z.number().min(0).max(1) }).strict(),
    monthly: z.object({ tax_per_pop: z.number().min(0), tax_stability_floor: z.number().min(0).max(1), soldier_upkeep: z.number().min(0), manpower_growth_per_pop: z.number().min(0) }).strict(),
    alerts: z.object({ pause_on_shortage: z.array(z.enum(RESOURCE_IDS)) }).strict(),
  })
  .strict();

/** data/balance/time.json — durée réelle d'un jour par vitesse (1 à 5). */
export const TimeBalanceSchema = z
  .object({
    canon: CanonSchema,
    notes_canon: z.string().optional(),
    ms_per_day: z.array(z.number().positive()).length(5),
    autosave_every_days: z.number().int().positive(),
  })
  .strict();

export type EconomyBalance = z.infer<typeof EconomyBalanceSchema>;
export type TimeBalance = z.infer<typeof TimeBalanceSchema>;

export const BALANCE_FILES = { economy: EconomyBalanceSchema, time: TimeBalanceSchema } as const;
export type BalanceName = keyof typeof BALANCE_FILES;
