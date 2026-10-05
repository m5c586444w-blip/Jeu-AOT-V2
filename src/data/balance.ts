import { z } from "zod";
import { KEY_RESOURCES, RATIONING_LEVELS, RESOURCE_IDS } from "../sim/strategic/resources";
import { FORMATIONS, WEATHERS } from "../sim/military/vocabulary";
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


const pos = z.number().positive();
const prob = z.number().min(0).max(1);
const range = z.tuple([z.number().min(0), z.number().min(0)]).refine(([a, b]) => a <= b, "intervalle [min, max] attendu");
const seasons = z.object({ hiver: num, printemps: num, ete: num, automne: num }).strict();

/** data/balance/expeditions.json — marche, rencontres, auto-résolution, retrait, politique des expéditions (P3, valeurs [A]). */
export const ExpeditionsBalanceSchema = z
  .object({
    canon: CanonSchema,
    notes_canon: z.string().optional(),
    /** Une unité du stock national de gaz = N unités d'ODM (03 §3.2 : réservoir ≈ 100 u). */
    odm_units_per_stock_unit: pos,
    odm_tank: pos,
    gas_spare_tanks_per_soldier: z.number().min(0),
    blades: z.object({ pairs_per_soldier: z.number().int().min(1), cuts_per_pair: range, steel_per_pair: pos, spare_pairs_per_soldier: z.number().min(0) }).strict(),
    pace_km_per_day: z.record(z.enum(FORMATIONS), pos),
    formations: z.record(z.enum(FORMATIONS), z.object({ detection: prob, evasion: prob, engaged_share: prob, signal_quality: prob, exposure: pos }).strict()),
    encounters: z.object({ per_day_at_density_1: pos, size_ref: pos, size_exponent: z.number().min(0).max(1), night_share: prob, season: seasons, abnormal_evasion_mult: prob, commander_k: num }).strict(),
    engagement: z
      .object({
        min_engaged: z.number().int().min(1),
        max_engaged: z.number().int().min(1),
        deaths_base: pos,
        sigma: pos,
        catastrophe: z.object({ p_base: prob, abnormal_mult: pos, column_mult: pos, share: range }).strict(),
        kill_prob: prob,
        skill_k: num,
        wounded_per_death: z.number().min(0),
        serious_share: prob,
        /** Gaz par homme engagé, par classe de Titan (R-gaz, D-77) : table tirée du combat tactique [A]. */
        gas_per_engaged_by_class: z.record(z.string(), range),
        horses_per_death: z.number().min(0),
        no_gas_mult: pos,
        no_blades_mult: pos,
        morale_k: num,
        veteran_k: num,
      })
      .strict(),
    attrition: z.object({ food_per_soldier: pos, fodder_per_horse: pos, outside_morale_per_day: num, horse_fatigue_per_day: num, horse_rest_per_day: num, horse_mortality_at_fatigue_100: prob, hunger_death_rate: prob }).strict(),
    medical: z.object({ serious_death_without: prob, serious_death_with: prob, infection_share: prob }).strict(),
    weather: z.object({ by_season: z.record(z.enum(["hiver", "printemps", "ete", "automne"]), z.record(z.enum(WEATHERS), prob)), effects: z.record(z.enum(WEATHERS), z.object({ encounters: pos, detection: pos, pace: pos, signal_error: prob }).strict()) }).strict(),
    signals: z.object({ error_base: prob, misread_engage_mult: pos }).strict(),
    retreat_defaults: z.object({ losses_pct: z.number().min(0).max(100), gas_pct: z.number().min(0).max(100), abnormal: z.number().int().min(0), max_days: z.number().int().min(1) }).strict(),
    objective_days: z.record(z.string(), z.number().int().min(0)),
    politics: z.object({ capital_base: z.number().min(0), capital_per_100: z.number().min(0), legitimacy_success: num, legitimacy_failure: num, legitimacy_per_loss_pct: num, corps_loyalty_success: num, corps_loyalty_per_loss_pct: num, mourning_days: z.number().int().positive() }).strict(),
    experience: z.object({ survival_per_expedition: num, max_bonus: num }).strict(),
    named: z.object({ exposure_mult: pos, ackerman_mult: pos }).strict(),
    wounds: z.object({ recovery_days: z.number().int().positive() }).strict(),
    roster: z.object({ squad_size: range, roles: z.record(z.string(), prob), attribute_mean: num, attribute_sd: pos, age: range, female_share: prob }).strict(),
  })
  .strict();

/** data/balance/logistics.json — rayons de ravitaillement, dépôts, convois, alertes (P3, valeurs [A]). */
export const LogisticsBalanceSchema = z
  .object({
    canon: CanonSchema,
    notes_canon: z.string().optional(),
    radius_km: z.object({ source: pos, depot: pos }).strict(),
    depot: z.object({ gold_cost: z.number().min(0), capacity: z.record(z.string(), pos) }).strict(),
    convoy: z.object({ pace_km_per_day: pos, wagon_capacity: pos, horses_per_wagon: pos, interception_per_day_at_density_1: prob, escort_k: pos, cargo_loss: range, escort_loss_share: prob }).strict(),
    alerts: z.object({ expedition_gas_pct: z.number().min(0).max(100), expedition_food_days: z.number().min(0), depot_food_days: z.number().min(0) }).strict(),
  })
  .strict();

/** data/balance/tactical.json — combat tactique (03 : « tout est dans /data/balance/tactical.json »). */
export const TacticalBalanceSchema = z
  .object({
    canon: CanonSchema,
    notes_canon: z.string().optional(),
    tick_hz: z.number().int().min(5).max(60),
    odm: z
      .object({
        hook_range_m: pos,
        hook_range_canon: CanonSchema,
        hook_delay_s: range,
        rail_accel: pos,
        max_speed: pos,
        gas_thrust_per_s: range,
        tank: pos,
        gravity: pos,
        drag: z.number().min(0),
        release_dist_m: pos,
        safe_fall_m: pos,
        lethal_fall_m: pos,
        panic_hook_delay_mult: pos,
      })
      .strict(),
    cut: z.object({ reach_m: pos, window_s: pos, base: prob, speed_ref: pos, speed_k: num, angle_k: num, skill_k: num, wear_per_cut: range, change_blades_s: pos, limb_share: prob, cooldown_s: pos, threat_exponent: z.number().min(0) }).strict(),
    titans: z.object({ vision_day_m: pos, vision_night_m: pos, hearing_m: pos, night_activity: prob, group_attraction_k: num, attack_cooldown_s: range, threat_attack_exponent: z.number().min(0), grab_hold_s: pos, limb_regen_s: pos, nape_height_ratio: prob, reach_ratio: pos }).strict(),
    soldiers: z
      .object({
        dodge_base: prob,
        dodge_reaction_k: num,
        dodge_air_bonus: num,
        swat_lethal: prob,
        rescue_reach_m: pos,
        rescue_base: prob,
        bleed_death_s: range,
        serious_share: prob,
        stress_per_death_seen: num,
        stress_leader_death: num,
        stress_abnormal_seen: num,
        stress_gas_empty: num,
        panic_threshold: num,
        panic_gas_waste: pos,
        stress_decay_per_s: num,
        gas_reserve: z.number().min(0),
      })
      .strict(),
    squads: z.object({ spacing_m: pos, flee_speed: pos, retreat_losses_share: prob }).strict(),
    signals: z.object({ error_day: prob, error_night: prob, visibility_m: pos }).strict(),
    resupply: z.object({ radius_m: pos, gas_per_s: pos, blades_per_s: pos }).strict(),
    battle: z.object({ time_limit_s: pos, deploy_margin_m: pos }).strict(),
    coherence: z.array(z.object({ id: z.string(), map: z.string(), titan: z.string(), count: z.number().int().min(1), soldiers: z.number().int().min(1) }).strict()).min(1),
    terrain_mult: z.record(z.enum(["plaine", "foret", "ville", "mur"]), pos),
  })
  .strict();

/** P5 : moteur d'événements (02 §12, 12 §0–§3). Valeurs `A`. */
export const EventsBalanceSchema = z
  .object({
    canon: z.enum(["C", "A", "?"]),
    notes_canon: z.string().optional(),
    divergence_threshold: pos,
    deadline_days: z.number().int().min(0),
    generic: z.object({ checks_per_month: z.number().int().min(0), min_gap_days: z.number().int().min(0), max_pending: z.number().int().min(1) }).strict(),
  })
  .strict();

/** P5 : recherche (02 §7, 13 §12). Valeurs `A`. */
export const ResearchBalanceSchema = z
  .object({
    canon: z.enum(["C", "A", "?"]),
    notes_canon: z.string().optional(),
    base_points: num,
    org_points: z.record(z.string().regex(/^org_[a-z0-9_]+$/), num),
    character_points: z.record(z.string().regex(/^char_[a-z0-9_]+$/), num),
    capture_points: num,
    risk_default: prob,
    accident: z.object({ progress_loss: prob, stress: num }).strict(),
  })
  .strict();

/** P5 : renseignement (02 §6). Valeurs `A`, sauf le bruit de ±20 % (02 §6). */
export const IntelBalanceSchema = z
  .object({
    canon: z.enum(["C", "A", "?"]),
    notes_canon: z.string().optional(),
    estimate_noise: prob,
    report_delay_days: range,
    agents: z.object({ start: z.number().int().min(0), max: z.number().int().min(1), recruit_capital: num, cover: range, loyalty: range, skill: range, burn_per_operation: prob }).strict(),
    operation_days: z.object({ surveiller: z.number().int().min(1), enqueter: z.number().int().min(1), contre: z.number().int().min(1) }).strict(),
    falsehood: z.object({ base: prob, unreliable: prob, unreliable_below: num, mole: prob }).strict(),
    evidence: z.object({ indice: num, preuve: num }).strict(),
    mole_detection: prob,
    cult_by_region: z.record(z.string(), z.number().min(0).max(100)),
    cult_drift: prob,
    legitimacy_local: z.object({ morale_k: num, stability_k: num, cult_k: num }).strict(),
  })
  .strict();

/** P6 : porteurs (02 §10, 03 §8). Horloge de 13 ans : C ; le reste : A. */
export const ShiftersBalanceSchema = z
  .object({
    canon: z.enum(["C", "A", "?"]),
    notes_canon: z.string().optional(),
    curse_years: z.number().int().positive(),
    transform_delay_s: range,
    transform_cost: num,
    transform_cooldown_s: num,
    regen_endurance_per_hp: num,
    hardening: z.object({ cost_per_s: num, duration_s: num }).strict(),
    control: z.object({ stress_threshold: num, wound_share: prob, chance_per_s: prob, rampage_s: num }).strict(),
    /** Dégâts d'un coup de porteur sur un autre porteur, et d'un pur sur un porteur (points de vie de zone). */
    attack: z.object({ reach_ratio: prob, cooldown_s: range, kill_prob: prob, shifter_damage: num, titan_damage: num }).strict(),
    /** Vitesse des purs attirés par un cri d'appel (multiplicateur). */
    call_speed_mult: num,
    /** Stress du porteur par point de vie perdu (perte de contrôle). */
    wound_stress_per_hp: num,
    /** Usure du corps transformé (endurance par seconde). */
    endurance_drain_per_s: num,
    soldiers: z.object({ cut_damage: num, spear_damage: num, spears_per_soldier: z.number().int().min(0), spear_range_m: num, spear_hit: prob }).strict(),
    inheritance: z.object({ heir_stress: num, org_loyalty: num, legitimacy: num, relation_stress: num }).strict(),
    vision: z.object({ chance_per_month: prob, falsehood: prob }).strict(),
  })
  .strict();


/** P7 : monde, guerre moderne, diplomatie, IA (02 §11, §14 ; 09 WAR, DIP). Tout : A. */
export const WorldBalanceSchema = z
  .object({
    canon: z.enum(["C", "A", "?"]),
    notes_canon: z.string().optional(),
    economy: z
      .object({
        /** Part de la production d'une province selon la stabilité (0–100) : mult = floor + (1 − floor) × stabilité/100. */
        stability_floor: prob,
        upkeep_mult: num,
        /** Paradis au monde : industrie et hommes mensuels tirés de ses stocks (acier, poudre, main-d'œuvre). */
        paradis_industry_per_steel: num,
        paradis_manpower_share: prob,
        /** Dérive mensuelle du soutien à la guerre et de la stabilité. */
        war_support_drift: num,
        stability_drift: num,
        war_weariness_per_loss: num,
        stability_low_support: num,
        blockade_industry_mult: prob,
      })
      .strict(),
    war: z
      .object({
        /** Pertes hebdomadaires (part de la force) pour l'attaquant et le défenseur, à rapport de force égal. */
        base_losses: prob,
        artillery_mult: num,
        air_superiority_mult: num,
        recon_bonus: num,
        fort_mult: num,
        terrain: z.record(z.string(), num),
        /** Rapport de force au-delà duquel la province change de mains. */
        capture_ratio: num,
        rail_speed_mult: num,
        naval_control_ratio: num,
        landing_penalty: prob,
        strength_regen_per_week: prob,
      })
      .strict(),
    titans: z
      .object({
        /** Puissance d'un porteur projeté (équivalent en formations), selon sa classe ; usure. */
        power: z.record(z.string(), num),
        stress_per_week: num,
        rest_weeks: z.number().int().min(0),
        death_chance_per_week: prob,
        fear_others: num,
        war_support_self: num,
        legitimacy_cost: num,
      })
      .strict(),
    diplomacy: z
      .object({
        accept_threshold: num,
        weights: z.object({ trust: num, interest: num, fear: num, ideology: num }).strict(),
        treaty_bias: z.record(z.string(), num),
        ultimatum_fear_needed: num,
        embargo_industry_mult: prob,
        relation_drift: num,
        hizuru: z.object({ threshold: num, trade_per_month: num, war_fear_per_month: num, guarantee: num }).strict(),
        coalition_vote_threshold: prob,
      })
      .strict(),
    ai: z
      .object({
        personality: z.record(z.string(), z.object({ attack: num, build: num, diplomacy: num, caution: num }).strict()),
        attractor_bonus: num,
        min_reserve_industry: num,
      })
      .strict(),
  })
  .strict();
export type WorldBalance = z.infer<typeof WorldBalanceSchema>;

export type ShiftersBalance = z.infer<typeof ShiftersBalanceSchema>;
export type EventsBalance = z.infer<typeof EventsBalanceSchema>;
export type ResearchBalance = z.infer<typeof ResearchBalanceSchema>;
export type IntelBalance = z.infer<typeof IntelBalanceSchema>;
export type TacticalBalance = z.infer<typeof TacticalBalanceSchema>;
export type ExpeditionsBalance = z.infer<typeof ExpeditionsBalanceSchema>;
export type LogisticsBalance = z.infer<typeof LogisticsBalanceSchema>;

export type PoliticsBalance = z.infer<typeof PoliticsBalanceSchema>;
export type SocietyBalance = z.infer<typeof SocietyBalanceSchema>;
export type EconomyBalance = z.infer<typeof EconomyBalanceSchema>;
export type TimeBalance = z.infer<typeof TimeBalanceSchema>;

export const BALANCE_FILES = {
  economy: EconomyBalanceSchema,
  time: TimeBalanceSchema,
  politics: PoliticsBalanceSchema,
  society: SocietyBalanceSchema,
  expeditions: ExpeditionsBalanceSchema,
  logistics: LogisticsBalanceSchema,
  tactical: TacticalBalanceSchema,
  events: EventsBalanceSchema,
  research: ResearchBalanceSchema,
  intel: IntelBalanceSchema,
  shifters: ShiftersBalanceSchema,
  world: WorldBalanceSchema,
} as const;
export type BalanceName = keyof typeof BALANCE_FILES;
