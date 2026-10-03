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

const decay = z.object({ value: z.number(), days: z.number().int().positive() }).strict();
const num = z.number();

/** data/balance/politics.json — légitimité, capital politique, organisations, votes, stress, deuils, conseillers. */
export const PoliticsBalanceSchema = z
  .object({
    canon: CanonSchema,
    notes_canon: z.string().optional(),
    legitimacy: z.object({ base: num, approach_per_day: num, morale_k: num, famine: num, reserve_bonus: num, culte_k: num, radicalisation_k: num }).strict(),
    capital: z.object({ monthly_base: num, per_legitimacy: num, cap: num }).strict(),
    stability: z.object({ legitimacy_k: num, radicalisation_k: num }).strict(),
    morale: z.object({ strata_k: num }).strict(),
    orgs: z.object({ loyalty_base: num, approach_per_day: num, budget_k: num, leader_relation_k: num, influence_approach_per_day: num }).strict(),
    strata: z
      .object({
        base: num,
        approach_per_day: num,
        famine: num,
        rationing: z.record(z.string(), z.record(z.string(), num)),
        tax_k: z.record(z.string(), num),
        legitimacy_k: z.record(z.string(), num),
        radicalisation_threshold: num,
        radicalisation_k: num,
        radicalisation_approach_per_day: num,
      })
      .strict(),
    votes: z.object({ threshold: num, loyalty_k: num, relation_k: num, clique_k: num, clique_min_strength: num, persuasion_cost: num, persuasion_value: num, veto_influence: num, veto_affinity: num, veto_override_cost: num }).strict(),
    agenda_affinity: z.record(z.string(), z.record(z.string(), num)),
    stress: z.object({ decay_per_day: num, famine_per_day: num, friend_death: num, proposal_rejected: num, vote_defeat: num, exhausted: num, trauma: num, breakdown: num }).strict(),
    deaths: z.object({ legitimacy_per_fame: num, mourning: decay, org_leader: decay, friend_loyalty: num }).strict(),
    advisors: z.object({ proposal_days: z.number().int().positive(), rejections_to_resign: z.number().int().positive(), accept_gain: num, reject_loss: num, expire_loss: num, bias_k: num }).strict(),
    nominations: z.object({ candidates: z.number().int().min(1), resentment: num }).strict(),
  })
  .strict();

/** data/balance/society.json — composition des provinces par strate (gabarits). */
export const SocietyBalanceSchema = z
  .object({
    canon: CanonSchema,
    notes_canon: z.string().optional(),
    profiles: z.record(z.string(), z.record(z.string(), z.number().min(0))),
    /** Règles de choix du gabarit : la première qui correspond s'applique. */
    rules: z.array(z.object({ profile: z.string(), atlas_codes: z.array(z.string()).optional(), terrains: z.array(z.string()).optional(), kinds: z.array(z.string()).optional(), regions: z.array(z.string()).optional() }).strict()),
  })
  .strict();

export type PoliticsBalance = z.infer<typeof PoliticsBalanceSchema>;
export type SocietyBalance = z.infer<typeof SocietyBalanceSchema>;
export type EconomyBalance = z.infer<typeof EconomyBalanceSchema>;
export type TimeBalance = z.infer<typeof TimeBalanceSchema>;

export const BALANCE_FILES = { economy: EconomyBalanceSchema, time: TimeBalanceSchema, politics: PoliticsBalanceSchema, society: SocietyBalanceSchema } as const;
export type BalanceName = keyof typeof BALANCE_FILES;
