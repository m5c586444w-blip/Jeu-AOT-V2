import { z } from "zod";
import { RESOURCE_IDS } from "../sim/strategic/resources";
import { ConditionSchema, EffectSchema } from "./effects";

/**
 * Missions nationales (MIS ; fichier 23 §5) : objectifs à long terme d'une nation, à la manière des « focus » d'un jeu de grande
 * stratégie. Une mission coûte des ressources, dure des mois de jeu, puis donne des effets ponctuels, des modificateurs durables
 * et peut déclencher des événements non canon. Elle ne force jamais un événement du récit : les divergences passent par le
 * graphe du fichier 12 §3 (règle R14 de `canon:check`).
 */

const idOf = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-z0-9_]+$`), `identifiant attendu au format ${prefix}_xxx (snake_case)`);
const year = z.number().int().min(0).max(2000);

export const MissionIdSchema = idOf("mis");
export const MISSION_BRANCHES = ["militaire", "politique", "economique", "religion", "renseignement", "monde"] as const;
export type MissionBranch = (typeof MISSION_BRANCHES)[number];
/** Nations qui ont un arbre de missions (Marley : branche simplifiée). */
export const MISSION_NATIONS = ["paradis", "marley"] as const;
export type MissionNation = (typeof MISSION_NATIONS)[number];

/** Identifiant de nation du monde (`fac_…`) d'une nation de missions. */
export const NATION_FACTION: Readonly<Record<MissionNation, string>> = { paradis: "fac_paradis", marley: "fac_marley" };

/** Conditions d'une mission : celles des événements, plus quelques-unes propres à la stratégie militaire et nationale. */
export const MissionConditionSchema = z.union([
  ConditionSchema,
  z.object({ stock_at_least: z.enum(RESOURCE_IDS), value: z.number() }).strict(),
  z.object({ garrison_at_least: idOf("prov"), value: z.number().int().min(0) }).strict(),
  z.object({ soldiers_at_least: z.number().int().min(0) }).strict(),
  z.object({ year_at_least: year }).strict(),
  z.object({ law: idOf("law") }).strict(),
  z.object({ armies_at_least: z.number().int().min(1) }).strict(),
  z.object({ army_in: idOf("prov") }).strict(),
  /** État de guerre entre la nation de la mission et une autre (monde des nations, 854). */
  z.object({ at_war: idOf("fac"), eq: z.boolean() }).strict(),
]);
export type MissionCondition = z.infer<typeof MissionConditionSchema>;

/** Effets permis à une mission : jamais le contrôle d'une province, une mort, un porteur, une guerre ni un événement du récit. */
export const MISSION_EFFECT_OPS = [
  "resource", "legitimacy", "capital", "morale", "stability", "population", "wall", "titans", "garrison", "org_loyalty", "org_influence", "stratum", "cult",
  "research", "observe", "world_relation", "world_support", "world_hizuru", "nation",
] as const;

/** Effets des missions de Marley : grandeurs des nations du monde seulement (l'économie détaillée est celle de Paradis). */
export const MARLEY_EFFECT_OPS = ["nation", "world_relation", "world_support", "world_hizuru"] as const;

/** Cibles des modificateurs durables : celles de l'économie (`EconomyMods`). */
export const MODIFIER_TARGET = new RegExp(`^(?:(?:production_mult|consumption_mult|losses_mult):(?:${RESOURCE_IDS.join("|")})|morale|stability|tax_mult|manpower_mult)$`);
/** Crochets d'expédition et de logistique que peut porter une mission (multiplicateurs, comme ceux des technologies). */
export const MISSION_HOOKS = ["exp_gas_odm_mult", "exp_night_loss_mult", "exp_wound_death_mult", "exp_loss_mult", "log_attrition_mult", "log_interception_mult"] as const;
export type MissionHook = (typeof MISSION_HOOKS)[number];

export const MissionSchema = z
  .object({
    id: MissionIdSchema,
    nation: z.enum(MISSION_NATIONS),
    branch: z.enum(MISSION_BRANCHES),
    /** Scénarios où la mission est offerte. */
    scenarios: z.array(idOf("scn")).min(1),
    /** Durée en jours de jeu (30 = un mois). */
    duration_days: z.number().int().min(15).max(1080),
    cost: z.partialRecord(z.enum(RESOURCE_IDS), z.number().positive()).default({}),
    /** Missions à avoir accomplies (toutes). */
    prereqs: z.array(MissionIdSchema).default([]),
    /** Au moins une de ces missions accomplie (liste vide : sans objet). */
    any_of: z.array(MissionIdSchema).default([]),
    exclusive_with: z.array(MissionIdSchema).default([]),
    requires: z.array(MissionConditionSchema).default([]),
    min_year: year,
    effects: z.array(EffectSchema).default([]),
    modifiers: z.array(z.object({ target: z.string().regex(MODIFIER_TARGET), value: z.number() }).strict()).default([]),
    hooks: z.array(z.object({ hook: z.enum(MISSION_HOOKS), value: z.number().positive() }).strict()).default([]),
    /** Événements déclenchés à l'accomplissement : génériques ou de fond seulement (R14). */
    events: z.array(idOf("evt")).default([]),
    /** Poids de l'IA (MIS.6) : plus il est haut, plus la mission est tentante pour une nation conduite par l'ordinateur. */
    ai_weight: z.number().min(0).max(10).default(1),
    canon: z.enum(["C", "A", "?"]),
    notes_canon: z.string().optional(),
  })
  .strict()
  .refine((m) => m.effects.every((e) => (MISSION_EFFECT_OPS as readonly string[]).includes(e.op)), { message: "effet interdit pour une mission (contrôle, mort, porteur, guerre, drapeau ou événement du récit)", path: ["effects"] })
  .refine((m) => m.nation === "paradis" || m.effects.every((e) => (MARLEY_EFFECT_OPS as readonly string[]).includes(e.op)), { message: "une mission de Marley n'agit que sur les grandeurs des nations", path: ["effects"] })
  .refine((m) => m.nation === "paradis" || (m.modifiers.length === 0 && m.hooks.length === 0 && m.events.length === 0 && Object.keys(m.cost).every((k) => k === "gold" || k === "manpower")), { message: "une mission de Marley se paie en industrie (gold) et en hommes (manpower) et n'a ni modificateur durable ni événement", path: ["cost"] })
  .refine((m) => !m.prereqs.includes(m.id) && !m.any_of.includes(m.id) && !m.exclusive_with.includes(m.id), { message: "une mission ne se référence pas elle-même", path: ["prereqs"] });
export type Mission = z.infer<typeof MissionSchema>;

/** Équilibrage des missions (`data/balance/missions.json`). */
export const MissionsBalanceSchema = z
  .object({
    canon: z.enum(["C", "A", "?"]),
    notes_canon: z.string().optional(),
    /** Missions menées en même temps, par nation. */
    slots: z.object({ paradis: z.number().int().min(1).max(4), marley: z.number().int().min(1).max(4) }).strict(),
    /** Part du coût rendue à l'annulation (le reste est perdu). */
    refund_share: z.number().min(0).max(1),
    /** Journal conservé (entrées). */
    log_cap: z.number().int().min(10).max(500),
    ai: z
      .object({
        /** Jours entre deux revues de l'IA. */
        review_every_days: z.number().int().min(1).max(360),
        /** Jour du scénario avant lequel l'IA ne lance rien. */
        first_after_days: z.number().int().min(0).max(720),
        /** Part des réserves que l'IA veut garder après avoir payé. */
        reserve_share: z.number().min(0).max(1),
        /** Poids d'une raison (valeurs de l'utilité). */
        weights: z.object({ branch_need: z.number(), at_war: z.number(), cheap: z.number(), base: z.number() }).strict(),
      })
      .strict(),
  })
  .strict();
export type MissionsBalance = z.infer<typeof MissionsBalanceSchema>;
