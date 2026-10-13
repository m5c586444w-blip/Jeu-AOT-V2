import { z } from "zod";

/**
 * Campagnes (P9, D-154) : un scénario jouable de bout en bout = scénario de base (référence de la simulation, inchangé) +
 * correctif de scénario + événements propres + difficulté + réglages de P9.5. Tout est donnée ; l'application est faite au
 * chargement du monde (`src/campaign/campaign.ts`), jamais dans `src/sim`.
 */

const canonFields = { canon: z.enum(["C", "A", "?"]), notes_canon: z.string().optional() };
const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-z0-9_]+$`), `identifiant attendu au format ${prefix}_xxx`);

export const DIFFICULTY_IDS = ["recit", "normal", "rude", "breche"] as const;
export const DifficultyIdSchema = z.enum(DIFFICULTY_IDS);
export type DifficultyId = z.infer<typeof DifficultyIdSchema>;

/** Modificateurs appliqués au scénario d'une campagne (valeurs neutres par défaut). */
export const ScenarioModsSchema = z
  .object({
    /** Stocks de départ de la nation jouée. */
    stocks_mult: z.number().positive().default(1),
    morale_delta: z.number().default(0),
    stability_delta: z.number().default(0),
    legitimacy_delta: z.number().default(0),
    capital_mult: z.number().min(0).default(1),
    /** Densité de Titans de chaque province du scénario (et celle du fichier des provinces quand le scénario n'en donne pas). */
    titan_density_mult: z.number().min(0).default(1),
    /** Garnisons de Paradis. */
    garrison_mult: z.number().positive().default(1),
    /** Formations du monde et régiments des armées des nations autres que Paradis. */
    enemy_forces_mult: z.number().positive().default(1),
    /** Penchant d'Hizuru (−100 Marley, +100 Paradis). */
    hizuru_lean_delta: z.number().default(0),
    /** Seuil du score de fin à l'échéance (ajouté à celui de la campagne). */
    score_threshold_delta: z.number().default(0),
  })
  .strict();
export type ScenarioMods = z.infer<typeof ScenarioModsSchema>;

/** Correctif d'équilibrage : fichier de data/balance → valeurs remplacées (fusion profonde, revalidée par le schéma du fichier). */
const BalancePatchSchema = z.record(z.string(), z.record(z.string(), z.unknown()));
export type BalancePatch = z.infer<typeof BalancePatchSchema>;

export const DifficultySchema = z
  .object({
    id: DifficultyIdSchema,
    name_key: z.string().min(1),
    desc_key: z.string().min(1),
    scenario: ScenarioModsSchema.default(ScenarioModsSchema.parse({})),
    balance: BalancePatchSchema.default({}),
  })
  .strict();
export type Difficulty = z.infer<typeof DifficultySchema>;

/** data/balance/difficulty.json : quatre niveaux (P9.3) et réglages de P9.5 communs à toutes les campagnes. */
export const DifficultyFileSchema = z
  .object({
    ...canonFields,
    default: DifficultyIdSchema,
    levels: z.array(DifficultySchema).length(4),
    /** P9.5 : réglages appliqués à toutes les campagnes (tous niveaux), avant ceux du niveau. */
    tuning: z
      .object({
        balance: BalancePatchSchema.default({}),
        /** Par campagne (id `c845`…) : modificateurs de scénario propres. */
        campaigns: z.record(z.string(), ScenarioModsSchema.partial()).default({}),
      })
      .strict()
      .default({ balance: {}, campaigns: {} }),
  })
  .strict()
  .refine((d) => DIFFICULTY_IDS.every((x) => d.levels.some((l) => l.id === x)), { message: "les quatre niveaux recit, normal, rude, breche sont requis", path: ["levels"] });
export type DifficultyFile = z.infer<typeof DifficultyFileSchema>;

// ——— Fins de partie (évaluées hors simulation, src/campaign/outcome.ts) ———

const WorldSide = z.array(id("fac")).min(1);

/** Conditions d'une règle de fin : toutes doivent tenir. */
export const OutcomeConditionSchema = z.union([
  z.object({ event: id("evt"), status: z.enum(["survenu", "evite", "regle"]).default("survenu") }).strict(),
  z.object({ event: id("evt"), choice: z.string().min(1) }).strict(),
  z.object({ lost: z.array(id("prov")).min(1), at_least: z.number().int().min(1) }).strict(),
  z.object({ population_below: z.number().min(0).max(2) }).strict(),
  z.object({ legitimacy_below: z.number().min(0).max(100) }).strict(),
  z.object({ food_empty_days: z.number().int().min(1) }).strict(),
  z.object({ flag: z.string().min(1), eq: z.boolean().default(true) }).strict(),
  z.object({ dead: id("char") }).strict(),
  z.object({ shifter: id("shifter"), side: z.enum(["paradis", "marley", "inconnu", "perdu"]) }).strict(),
  z.object({ shifter_captured: id("shifter") }).strict(),
  z.object({ world_control: id("wprov"), by: WorldSide }).strict(),
  z.object({ nation_stat_below: id("fac"), stat: z.enum(["stability", "warSupport", "industry"]), value: z.number() }).strict(),
  z.object({ forces_ratio: WorldSide, against: id("fac"), at_least: z.number().min(0) }).strict(),
  z.object({ days_at_least: z.number().int().min(0) }).strict(),
  /** Segments de mur dont la structure est tombée sous la valeur (sièges, 02 §16). */
  z.object({ walls_below: z.number().min(0).max(100), at_least: z.number().int().min(1) }).strict(),
  /** Provinces de Paradis occupées par une armée des factions données (occupation de la couche des armées). */
  z.object({ occupied_at_least: z.number().int().min(1), by: WorldSide }).strict(),
]);
export type OutcomeCondition = z.infer<typeof OutcomeConditionSchema>;

export const OUTCOME_KINDS = ["victoire", "defaite", "paix"] as const;

export const OutcomeRuleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    /** Issue vue de la nation jouée par défaut (Paradis) ; `winner` : faction qui l'emporte (null : aucune). */
    kind: z.enum(OUTCOME_KINDS),
    winner: z.string().min(1).nullable(),
    text_key: z.string().min(1),
    when: z.array(OutcomeConditionSchema).min(1),
  })
  .strict();
export type OutcomeRule = z.infer<typeof OutcomeRuleSchema>;

export const SCORE_INDICATORS = ["population", "legitimacy", "morale", "stability", "food", "soldiers", "control", "canon"] as const;

export const CampaignSchema = z
  .object({
    id: z.string().regex(/^c[a-z0-9]+$/, "identifiant de campagne attendu au format c845, cgrondement…"),
    name_key: z.string().min(1),
    summary_key: z.string().min(1),
    year: z.number().int(),
    emblem: id("fac"),
    /** Nations jouables (choix du menu) ; la première est la nation par défaut. */
    nations: z.array(id("fac")).min(1),
    base: id("scn"),
    /** Correctif du scénario de base (fusion profonde ; tableaux remplacés), revalidé par le schéma des scénarios. */
    scenario: z.record(z.string(), z.unknown()).default({}),
    /** Événements propres à la campagne : ajoutés, ou remplaçant l'événement de même id (revalidés par le schéma des événements). */
    events: z.array(z.record(z.string(), z.unknown())).default([]),
    end: z
      .object({
        /** Échéance (jours depuis le départ). */
        max_days: z.number().int().min(30),
        /** Factions comptées dans les victoires (`sim:balance`). */
        factions: z.array(z.string().min(1)).min(2),
        rules: z.array(OutcomeRuleSchema).min(1),
        /** À l'échéance : score pondéré (0 à 1) comparé au seuil ; au-dessus → `win`, sinon → `lose`. */
        deadline: z
          .object({
            score: z.array(z.object({ indicator: z.enum(SCORE_INDICATORS), weight: z.number().positive() }).strict()).min(1),
            threshold: z.number().min(0).max(1),
            win: OutcomeRuleSchema.omit({ when: true }),
            lose: OutcomeRuleSchema.omit({ when: true }),
          })
          .strict(),
      })
      .strict(),
    ...canonFields,
  })
  .strict();
export type Campaign = z.infer<typeof CampaignSchema>;
export const CampaignFileSchema = z.array(CampaignSchema).min(1);
