import { z } from "zod";
import { RESOURCE_IDS } from "../sim/strategic/resources";

/**
 * Vocabulaire fermé des événements et des technologies (P5) : conditions, effets et crochets typés.
 * Chaque opération est interprétée par la simulation et expliquée dans l'interface ; aucune chaîne libre n'est évaluée.
 */

const id = (prefix: string): z.ZodString => z.string().regex(new RegExp(`^${prefix}_[a-z0-9_]+$`));
const provinceOrAll = z.union([id("prov"), z.literal("all")]);

export const CONTROL_VALUES = ["paradis", "titans", "perdu"] as const;
export const CERTAINTY_LEVELS = ["aucune", "rumeur", "indice", "preuve"] as const;
export type Certainty = (typeof CERTAINTY_LEVELS)[number];

/** Condition de contexte (toutes doivent tenir). */
export const ConditionSchema = z.union([
  z.object({ flag: z.string().min(1), eq: z.boolean() }).strict(),
  z.object({ alive: id("char") }).strict(),
  z.object({ dead: id("char") }).strict(),
  z.object({ control: id("prov"), eq: z.enum(CONTROL_VALUES) }).strict(),
  z.object({ legitimacy_below: z.number() }).strict(),
  z.object({ legitimacy_above: z.number() }).strict(),
  z.object({ fired: id("evt") }).strict(),
  z.object({ not_fired: id("evt") }).strict(),
  z.object({ choice: id("evt"), is: z.string().min(1) }).strict(),
  z.object({ secret: z.string().min(1), at_least: z.enum(CERTAINTY_LEVELS) }).strict(),
  z.object({ tech: id("tech") }).strict(),
  z.object({ stock_below: z.enum(RESOURCE_IDS), value: z.number() }).strict(),
  z.object({ branch: z.enum(["canon", "divergente"]) }).strict(),
  z.object({ season: z.enum(["printemps", "ete", "automne", "hiver"]) }).strict(),
]);
export type Condition = z.infer<typeof ConditionSchema>;

/** Effet d'un événement ou d'un choix. */
export const EffectSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("resource"), resource: z.enum(RESOURCE_IDS), delta: z.number() }).strict(),
  z.object({ op: z.literal("legitimacy"), delta: z.number() }).strict(),
  z.object({ op: z.literal("capital"), delta: z.number() }).strict(),
  z.object({ op: z.literal("morale"), province: provinceOrAll, delta: z.number() }).strict(),
  z.object({ op: z.literal("stability"), province: provinceOrAll, delta: z.number() }).strict(),
  /** Part de la population perdue ou gagnée (−0,1 = −10 %). */
  z.object({ op: z.literal("population"), province: id("prov"), share: z.number().min(-1).max(1) }).strict(),
  z.object({ op: z.literal("control"), province: id("prov"), value: z.enum(CONTROL_VALUES) }).strict(),
  z.object({ op: z.literal("wall"), province: id("prov"), value: z.number().min(0).max(100) }).strict(),
  /** Densité de Titans (par 100 km²) ajoutée à celle du scénario ; négatif pour un nettoyage. */
  z.object({ op: z.literal("titans"), province: id("prov"), delta: z.number() }).strict(),
  /** Part de la garnison perdue (−0,2 = −20 %). */
  z.object({ op: z.literal("garrison"), province: id("prov"), share: z.number().min(-1).max(1) }).strict(),
  z.object({ op: z.literal("org_loyalty"), org: id("org"), delta: z.number() }).strict(),
  z.object({ op: z.literal("org_influence"), org: id("org"), delta: z.number() }).strict(),
  z.object({ op: z.literal("stratum"), stratum: id("str"), satisfaction: z.number().default(0), radicalisation: z.number().default(0) }).strict(),
  /** Influence du Culte des Murs (calque « Religion »). */
  z.object({ op: z.literal("cult"), province: provinceOrAll, delta: z.number() }).strict(),
  z.object({ op: z.literal("kill"), character: id("char"), cause: z.string().min(1) }).strict(),
  z.object({ op: z.literal("stress"), character: id("char"), delta: z.number() }).strict(),
  z.object({ op: z.literal("reveal"), secret: z.string().min(1) }).strict(),
  z.object({ op: z.literal("flag"), key: z.string().min(1), value: z.boolean() }).strict(),
  z.object({ op: z.literal("schedule"), event: id("evt"), days: z.tuple([z.number().int().min(0), z.number().int().min(0)]) }).strict(),
  z.object({ op: z.literal("divergence"), delta: z.number() }).strict(),
  z.object({ op: z.literal("research"), delta: z.number() }).strict(),
  z.object({ op: z.literal("observe"), province: id("prov") }).strict(),
]);
export type Effect = z.infer<typeof EffectSchema>;

/** Choix proposé par un événement (12 §0) : effets, part de divergence (0–1 du poids de l'événement), choix historique. */
export const ChoiceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    historical: z.boolean().default(false),
    divergence: z.number().min(0).max(1).default(0),
    requires: z.array(ConditionSchema).default([]),
    effects: z.array(EffectSchema).default([]),
    canon: z.enum(["C", "A", "?"]).default("A"),
  })
  .strict();
export type Choice = z.infer<typeof ChoiceSchema>;

/** Crochets des technologies (13 ; effets `A`) : chaque crochet est lu par un système existant. */
export const TECH_HOOKS = [
  "exp_gas_odm_mult",
  "exp_night_loss_mult",
  "exp_wound_death_mult",
  "exp_loss_mult",
  "exp_capture",
  "log_attrition_mult",
  "log_interception_mult",
  "intel_watchtowers",
  "intel_agent_slots",
  "intel_noise_mult",
  "intel_counter",
  "research_points",
  "research_points_mult",
  "legitimacy_month",
  "cult_month",
] as const;
export type TechHook = (typeof TECH_HOOKS)[number];
export const TechEffectSchema = z.object({ hook: z.enum(TECH_HOOKS), value: z.number() }).strict();
export type TechEffect = z.infer<typeof TechEffectSchema>;
