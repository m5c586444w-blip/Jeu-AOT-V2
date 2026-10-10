import { z } from "zod";
import { CanonSchema } from "./schemas";

/**
 * Fins de partie (P9 ; 02 §13 : « pas de victoire unique », objectifs par faction et par scénario, défaites, épilogue) et
 * difficultés (P9.3). Seuils et durées : choix de design `A`, dans `data/balance/endings.json` et `difficulty.json`.
 *
 * Une condition est un prédicat lu sur l'état (jamais écrit) : objectif atteint quand il est vrai ; défaite quand une condition
 * de défaite est vraie. La victoire se constate au terme (au moins `min_objectifs` objectifs), ou avant si `anticipee`.
 */
const num = z.number().finite();
const share = z.number().min(0).max(1);
const ids = z.array(z.string().min(1)).min(1);

export const EndingConditionSchema = z.discriminatedUnion("type", [
  /** Le terme du scénario est atteint (survivre jusque-là). */
  z.object({ type: z.literal("terme") }).strict(),
  /** Part des provinces de ces régions tenues par le joueur (île de Paradis) : au moins / sous `seuil`. */
  z.object({ type: z.literal("region_min"), regions: ids, seuil: share }).strict(),
  z.object({ type: z.literal("region_max"), regions: ids, seuil: share }).strict(),
  /** Un de ces événements a eu lieu (historique de la chronique). */
  z.object({ type: z.literal("evenement"), evenements: ids }).strict(),
  /** Stabilité ou moral moyens des provinces tenues : au moins / sous `seuil` (0–100). */
  z.object({ type: z.literal("stabilite_min"), seuil: num }).strict(),
  z.object({ type: z.literal("stabilite_max"), seuil: num }).strict(),
  z.object({ type: z.literal("moral_min"), seuil: num }).strict(),
  /** Légitimité du gouvernement sous `seuil` (couche politique) ; au moins `seuil` (objectif de gouvernement). */
  z.object({ type: z.literal("legitimite_max"), seuil: num }).strict(),
  z.object({ type: z.literal("legitimite_min"), seuil: num }).strict(),
  /** Vivres épuisés et moral moyen sous `moral` : famine. */
  z.object({ type: z.literal("famine"), moral: num }).strict(),
  /** Population tenue sous `part` de celle du départ. */
  z.object({ type: z.literal("population_max"), part: share }).strict(),
  /** Le Fondateur est entre les mains de ce camp. */
  z.object({ type: z.literal("fondateur"), camp: z.enum(["paradis", "marley"]) }).strict(),
  /** Province du monde (couche des nations) tenue par cette faction. */
  z.object({ type: z.literal("controle"), province: z.string().min(1), faction: z.string().min(1) }).strict(),
  /** Le joueur n'est pas en guerre avec cette faction ; un traité (tout type, ou `traite`) le lie à elle. */
  z.object({ type: z.literal("paix"), avec: z.string().min(1) }).strict(),
  z.object({ type: z.literal("traite"), avec: z.string().min(1), traite: z.string().optional() }).strict(),
  /** Stabilité d'une nation (couche des nations) : au moins / sous `seuil`. */
  z.object({ type: z.literal("nation_stabilite_min"), faction: z.string().min(1), seuil: num }).strict(),
  z.object({ type: z.literal("nation_stabilite_max"), faction: z.string().min(1), seuil: num }).strict(),
  /** Grondement (P9.4) : part du monde ravagée au moins / sous `seuil` ; crise arrêtée. */
  z.object({ type: z.literal("ravage_min"), seuil: share }).strict(),
  z.object({ type: z.literal("ravage_max"), seuil: share }).strict(),
  z.object({ type: z.literal("grondement_arrete") }).strict(),
]);
export type EndingCondition = z.infer<typeof EndingConditionSchema>;

const Item = z.object({ id: z.string().regex(/^[a-z0-9_]+$/), cle: z.string().min(1), cond: EndingConditionSchema }).strict();

export const EndingRulesSchema = z
  .object({
    scenario: z.string().min(1),
    /** Faction jouée à laquelle s'appliquent ces objectifs. */
    camp: z.string().min(1),
    /** Adversaire désigné pour les statistiques de `sim:balance` (« Titans », Marley…). */
    adversaire: z.string().min(1),
    terme_jours: z.number().int().positive(),
    objectifs: z.array(Item).min(1),
    victoire: z.object({ min_objectifs: z.number().int().positive(), anticipee: z.boolean() }).strict(),
    defaites: z.array(Item),
    canon: CanonSchema,
    note: z.string().min(1),
  })
  .strict();
export type EndingRules = z.infer<typeof EndingRulesSchema>;

export const EndingsBalanceSchema = z
  .object({ fins: z.array(EndingRulesSchema).min(1) })
  .strict()
  .superRefine((f, ctx) => {
    const seen = new Set<string>();
    for (const r of f.fins) {
      const k = `${r.scenario}|${r.camp}`;
      if (seen.has(k)) ctx.addIssue({ code: "custom", message: `fins en double : ${k}` });
      seen.add(k);
      if (r.victoire.min_objectifs > r.objectifs.length) ctx.addIssue({ code: "custom", message: `${k} : min_objectifs > nombre d'objectifs` });
    }
  });
export type EndingsBalance = z.infer<typeof EndingsBalanceSchema>;

/** Niveaux de difficulté (P9.3) ; « normal » est le monde des données, sans changement. */
export const DIFFICULTY_IDS = ["recit", "normal", "rude", "breche"] as const;
export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

const Level = z
  .object({
    id: z.enum(DIFFICULTY_IDS),
    cle: z.string().min(1),
    /** Multiplicateurs (1 = inchangé) : production de Paradis, densité de Titans, agressivité de toutes les IA (personnalités), pertes de combat. */
    production: z.number().positive(),
    titans: z.number().positive(),
    ia_attaque: z.number().positive(),
    pertes: z.number().positive(),
    /** Décalages (points, 0 = inchangé) : moral et stabilité de départ. */
    moral: num,
    stabilite: num,
  })
  .strict();

export const DifficultyBalanceSchema = z
  .object({ canon: CanonSchema, note: z.string().min(1), niveaux: z.array(Level).length(4) })
  .strict()
  .superRefine((f, ctx) => {
    const n = f.niveaux.find((l) => l.id === "normal");
    if (!n || n.production !== 1 || n.titans !== 1 || n.ia_attaque !== 1 || n.pertes !== 1 || n.moral !== 0 || n.stabilite !== 0) ctx.addIssue({ code: "custom", message: "« normal » doit laisser le monde inchangé (multiplicateurs 1, décalages 0)" });
    if (new Set(f.niveaux.map((l) => l.id)).size !== 4) ctx.addIssue({ code: "custom", message: "quatre niveaux distincts attendus" });
  });
export type DifficultyBalance = z.infer<typeof DifficultyBalanceSchema>;

/** Grondement (P9.4, `data/balance/rumbling.json`) : paramètres `?` (aucune durée ni aucun chiffre officiel sûr). */
const pos = z.number().positive();
const frac = z.number().min(0).max(1);
export const RumblingBalanceSchema = z
  .object({
    canon: CanonSchema,
    note: z.string().min(1),
    /** Jours pour ravager une province, à l'allure de base. */
    jours_par_province: pos,
    /** Allure selon la posture du joueur. */
    posture: z.object({ empecher: pos, retarder: pos, laisser: pos }).strict(),
    assaut: z.object({ par_jour: pos, bonus_traite: z.number().min(0), chance: frac, chance_par_echec: frac, recul_echec: z.number().min(0).max(100), effectifs_perdus_echec: frac }).strict(),
    /** Morts estimés par point de poids d'une province ravagée ; évacués par jour en posture « retarder ». */
    morts_par_poids: z.number().min(0),
    evacues_par_jour: z.number().min(0),
    /** Part de l'industrie et des effectifs perdue par la nation qui tenait une province ravagée (pondérée par son poids). */
    ruine_nation: frac,
    paradis: z.object({ legitimite_par_jour_laisser: num, stabilite_par_jour_empecher: num }).strict(),
  })
  .strict();
export type RumblingBalance = z.infer<typeof RumblingBalanceSchema>;
