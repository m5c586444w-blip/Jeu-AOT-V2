import { z } from "zod";

/**
 * Données de rendu de R1b (`data/art/`) : profils de style des environnements, matériaux, murs.
 * - Données de présentation, pas de jeu : la simulation ne les lit pas.
 * - Elles sont exclues des globs du worker et des Archives (bundle principal inchangé, `docs/phases/R1b.md` § 1).
 * - Seul le morceau 3D les charge ; ce module ne sert qu'à leur validation (`data:validate`, tests). Le rendu n'en importe
 *   que les types.
 */
const CanonSchema = z.enum(["C", "A", "?"]);
const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "teinte attendue au format #RRGGBB");
const Share = z.number().min(0).max(1);
const Range = z.tuple([z.number().min(0), z.number().min(0)]).refine(([a, b]) => a <= b, "intervalle [min, max] attendu");

/**
 * Couvertures de toit : celles de la fiche B1, plus la toile (camps) et « aucun » (ruines, lieux sans bâtiment) ; R1e (§6,
 * point 2) : tuile canal et bardeau de bois.
 */
export const ROOF_MATERIALS = ["tuiles_rouges", "ardoise", "chaume", "plat", "toile", "aucun", "tuile_canal", "bardeau"] as const;
export type RoofMaterial = (typeof ROOF_MATERIALS)[number];
/** Matériaux de façade de la fiche B1. */
export const WALL_MATERIALS = ["colombage", "enduit", "pierre_taillee", "pierre_brute", "brique", "bois"] as const;
export type WallMaterial = (typeof WALL_MATERIALS)[number];

/** Sols : cultures du patchwork, routes, berges, sable, roche, neige, boue, eau, sous-bois. */
export const GROUNDS = ["ble", "orge", "jachere", "labour", "potager", "verger", "route", "berge", "sable", "roche", "neige", "boue", "eau", "sous_bois"] as const;
export type Ground = (typeof GROUNDS)[number];

/** Teintes physiques (matières, pas style) utilisées par le maillage. */
export const PHYSICAL = ["fer", "fer_canon", "verre", "vitrail", "flamme", "braise", "suie", "fumee", "corde", "toile_claire", "cire", "mousse", "ecorce", "feuillage", "feuillage_clair", "conifere", "herbe_seche", "roseau", "lumiere", "cristal"] as const;
export type Physical = (typeof PHYSICAL)[number];

export const GENERATORS = ["district", "capitale", "ville", "village", "campagne", "foret_geante", "foret", "territoire", "mur", "montagne", "eaux", "cote", "chateau", "usine", "souterrain", "crypte", "camp", "glacis"] as const;
export type Generator = (typeof GENERATORS)[number];

/** Accessoires connus : chaque clé a un constructeur dans le rendu (test « les générateurs lisent le profil »). */
export const ACCESSORIES = [
  "fontaines", "puits", "etals", "charrettes", "charrettes_abandonnees", "lanternes", "lampadaires", "tonneaux", "caisses", "cordes_a_linge", "cordes",
  "canons", "rails", "drapeaux", "escaliers", "abreuvoirs", "rateliers", "ecuries", "enclos", "potagers", "clotures", "palissade", "moulins",
  "meules_de_foin", "bornes", "ponts", "grilles", "bancs", "statues", "jardins", "arbres_alignement", "bois_empile", "roues", "haies",
  "points_ancrage", "branches_basses", "racines", "mousse", "rayons_lumiere", "sous_bois", "souches", "rochers", "sentier", "eboulis",
  "roseaux", "pontons", "barques", "gue", "embruns", "murs_effondres", "herbes_hautes", "broussailles", "cheminees_usine", "colonnes",
  "bougies", "tentes", "feux_de_camp",
] as const;

const weights = <K extends string>(keys: readonly [K, ...K[]]) =>
  z
    .partialRecord(z.enum(keys), Share)
    .refine((w) => Math.abs((Object.values(w) as (number | undefined)[]).reduce<number>((s, v) => s + (v ?? 0), 0) - 1) < 1e-6, "les parts doivent faire 1");

const TerrainSchema = z
  .object({
    type: z.enum(["plat", "collines", "riviere", "canaux", "montagne", "cote", "souterrain"]),
    relief_m: z.number().min(0).max(400),
    eau: z.enum(["aucune", "riviere", "lac", "riviere_lac", "canaux", "marais", "mer"]),
  })
  .strict();

const VegetationSchema = z
  .object({
    arbres: Share,
    haies: Share,
    champs: Share,
    vergers: Share,
    foret: Share,
    essence: z.enum(["ordinaire", "geante", "aucune"]),
    envahissement: Share,
  })
  .strict();

export const VARIANT_STATES = ["intact", "ravage", "ruines_incendies", "abandonne", "reconstruit"] as const;

const VariantSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    nom: z.string().min(1),
    canon: CanonSchema,
    etat: z.enum(VARIANT_STATES),
    special: z.string().regex(/^[a-z0-9_]+$/).optional(),
    surcharges: z
      .object({ densite: Share.optional(), terrain: TerrainSchema.optional() })
      .strict()
      .optional(),
  })
  .strict();

/**
 * Palette : 6 teintes à rôle fixe. Les générateurs de nature réinterprètent les rôles (voir `docs/phases/R1b.md`) :
 * forêt : `toit` = voûte ; eaux : `toit_2` = eau ; côte : `toit` = mer ; souterrain : `toit` = obscurité.
 */
const PaletteSchema = z.object({ facade: Hex, bois: Hex, pierre: Hex, toit: Hex, toit_2: Hex, sol: Hex }).strict();

export const StyleProfileSchema = z
  .object({
    id: z.string().regex(/^E\d{2}$/),
    nom: z.string().min(1),
    lot: z.union([z.literal(1), z.literal(2)]),
    categorie: z.enum(["ville", "campagne", "abords", "nature", "ouvrage"]),
    generateur: z.enum(GENERATORS),
    canon: CanonSchema,
    canon_style: CanonSchema,
    interprete: z.boolean(),
    lieu: z
      .object({
        provinces: z.array(z.string().regex(/^[ORSI]\d{2}$/)),
        mur: z.enum(["maria", "rose", "sina"]).nullable(),
        position: z.string().min(1),
      })
      .strict(),
    disposition: z.enum(["organique", "planifiee", "quadrillee", "aucune"]),
    rues_m: Range,
    batiments: z
      .object({
        types: z.array(z.string().regex(/^[a-z_]+$/)),
        etages: Range,
        hauteur_etage_m: Range,
        faitage_m: Range,
        reperes: z.array(z.string().regex(/^[a-z_]+$/)),
      })
      .strict(),
    toits: weights(ROOF_MATERIALS),
    materiaux: weights(WALL_MATERIALS),
    densite: Share,
    palette: PaletteSchema,
    accessoires: z.array(z.enum(ACCESSORIES)),
    terrain: TerrainSchema,
    vegetation: VegetationSchema,
    mur_visible: z
      .object({
        visible: z.boolean(),
        distance_m: z.number().min(0).nullable(),
        forme: z.enum(["saillie", "ligne", "aucune"]),
        canon: CanonSchema,
        note: z.string().min(1),
      })
      .strict()
      .refine((m) => m.visible === (m.forme !== "aucune") && m.visible === (m.distance_m !== null), "mur visible ⇔ forme et distance renseignées"),
    variantes: z.array(VariantSchema),
    notes_canon: z.string().min(1),
    /**
     * R1e (§6, point 1) : atmosphère du lieu. `fumee` : ciel gris de fumée, voile de brume, lumière plus sombre et plus rouge ;
     * `suie` : suie sur les façades et les toits (0 à 1). Absente : ciel clair.
     */
    atmosphere: z.object({ fumee: Share, suie: Share, canon: CanonSchema, note: z.string().min(1) }).strict().optional(),
  })
  .strict();
export type StyleProfile = z.infer<typeof StyleProfileSchema>;

/** Les 28 environnements de la partie B (E09 n'existe pas) et le lot 1 imposé par la consigne. */
export const ENVIRONMENT_IDS = ["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08", "E10", "E11", "E12", "E13", "E14", "E15", "E16", "E17", "E18", "E19", "E20", "E21", "E22", "E23", "E24", "E25", "E26", "E27", "E28", "E29"] as const;
export const LOT1_IDS = ["E01", "E02", "E05", "E06", "E11", "E13", "E14", "E19", "E22"] as const;

export const StylesFileSchema = z
  .array(StyleProfileSchema)
  .superRefine((profiles, ctx) => {
    const ids = profiles.map((p) => p.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "identifiants de profil en double" });
    const missing = ENVIRONMENT_IDS.filter((id) => !ids.includes(id));
    const extra = ids.filter((id) => !(ENVIRONMENT_IDS as readonly string[]).includes(id));
    if (missing.length > 0) ctx.addIssue({ code: "custom", message: `profils manquants : ${missing.join(", ")}` });
    if (extra.length > 0) ctx.addIssue({ code: "custom", message: `profils inconnus : ${extra.join(", ")}` });
    for (const p of profiles) {
      const lot1 = (LOT1_IDS as readonly string[]).includes(p.id);
      if ((p.lot === 1) !== lot1) ctx.addIssue({ code: "custom", message: `${p.id} : lot ${p.lot} contraire à la consigne` });
      const vids = p.variantes.map((v) => v.id);
      if (new Set(vids).size !== vids.length) ctx.addIssue({ code: "custom", message: `${p.id} : variantes en double` });
    }
  });

const Param = <T extends z.ZodTypeAny>(v: T) => z.object({ valeur: v, canon: CanonSchema, note: z.string().min(1) }).strict();

/** Matériaux : rôle de palette et motif de texture de chaque façade et de chaque toit. Les teintes de base servent hors palette. */
export const MaterialsFileSchema = z
  .object({
    facades: z.record(z.enum(WALL_MATERIALS), z.object({ role: z.enum(["facade", "bois", "pierre", "base"]), base: Hex, trame: Hex.optional(), canon: CanonSchema }).strict()),
    toits: z.record(
      z.enum(ROOF_MATERIALS),
      z
        .object({
          base: Hex,
          pente_deg: Range,
          formes: z.partialRecord(z.enum(["pignon", "croupe", "plat", "tente", "aucun"]), Share),
          canon: CanonSchema,
        })
        .strict(),
    ),
    accents: z.array(Hex).min(2),
    /** R1e (§6, point 2) : teintes d'enduit (ocre, rose, sauge, gris bleu, crème…) mêlées maison par maison à celle du profil. */
    enduits: z.object({ teintes: z.array(Hex).min(4), canon: CanonSchema }).strict(),
    sols: z.record(z.enum(GROUNDS), z.object({ base: Hex, canon: CanonSchema }).strict()),
    physiques: z.record(z.enum(PHYSICAL), Hex),
    notes_canon: z.string().min(1),
  })
  .strict();

/** Mur : hauteur canon ; épaisseur, teinte et dimensions de rendu marquées `?` ou `A`, à valider par l'utilisateur. */
export const WallsFileSchema = z
  .object({
    hauteur_m: Param(z.number().positive()),
    epaisseur_m: Param(z.number().positive()),
    teinte: Param(Hex),
    porte_largeur_m: Param(z.number().positive()),
    porte_hauteur_m: Param(z.number().positive()),
    chemin_de_ronde_m: Param(z.number().positive()),
    parapet_m: Param(z.number().positive()),
    canon_espacement_m: Param(z.number().positive()),
    rail_longueur_m: Param(z.number().positive()),
    rail_ecartement_m: Param(z.number().positive()),
    bloc_m: Param(z.tuple([z.number().positive(), z.number().positive()])),
    saillie_rayon_m: Param(z.number().positive()),
    distance_maria_rose_km: Param(z.number().positive()),
    distance_rose_sina_km: Param(z.number().positive()),
    breche_largeur_m: Param(z.number().positive()),
    porte_eau_largeur_m: Param(z.number().positive()),
    porte_eau_hauteur_m: Param(z.number().positive()),
  })
  .strict();
export type WallsFile = z.infer<typeof WallsFileSchema>;
export type MaterialsFile = z.infer<typeof MaterialsFileSchema>;

/** Galerie de Titans (R1b.6) : classes, variantes, Titans spéciaux ; un seul squelette, des paramètres par classe. */
export const TITAN_PROPORTIONS = ["legs", "torso", "neck", "head", "headW", "shoulder", "hip", "chest", "waist", "belly", "depth", "upperArm", "foreArm", "hand", "armR", "thighR", "neckR", "hunch"] as const;
const Proportions = z.object(Object.fromEntries(TITAN_PROPORTIONS.map((k) => [k, z.number()])) as Record<(typeof TITAN_PROPORTIONS)[number], z.ZodNumber>).strict();
const Gait = z.object({ stride: z.number(), walkRate: z.number(), armSwing: z.number(), shoulderOut: z.number(), headTilt: z.number() }).strict();
const Expression = z.enum(["rictus", "beant", "neutre", "creuse"]);
const sumsToOne = (p: { legs: number; torso: number; neck: number; head: number }): boolean => Math.abs(p.legs + p.torso + p.neck + p.head - 1) < 1e-6;
const TitanBody = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    hauteur_m: z.number().positive(),
    canon: CanonSchema,
    note: z.string().min(1),
    proportions: Proportions.refine(sumsToOne, "jambes + torse + cou + tête = 1"),
    allure: Gait,
    peau: Hex,
    expression: Expression,
    cheveux: z.boolean(),
    pose: z.enum(["debout", "marche", "buste", "allonge", "course"]).optional(),
    vapeur: z.boolean().optional(),
  })
  .strict();
export const TitansFileSchema = z
  .object({
    soldat_m: Param(z.number().positive()),
    classes: z.array(TitanBody).min(5),
    variantes: z.array(
      z
        .object({
          id: z.enum(["anormal", "sentinelle", "chasseur", "meute", "nocturne"]),
          base: z.string(),
          canon: CanonSchema,
          note: z.string().min(1),
          modifs: z.partialRecord(z.enum(TITAN_PROPORTIONS), z.number()).refine((m) => Math.abs((m.legs ?? 0) + (m.torso ?? 0) + (m.neck ?? 0) + (m.head ?? 0)) < 1e-6, "les modifications de jambes, torse, cou et tête s'annulent"),
          allure: Gait.partial(),
          pose: z.enum(["debout", "marche", "course"]),
          peau: Hex.optional(),
          expression: Expression.optional(),
          groupe: z.number().int().positive().optional(),
        })
        .strict(),
    ),
    speciaux: z.array(TitanBody).length(3),
  })
  .strict()
  .superRefine((f, ctx) => {
    const ids = f.classes.map((c) => c.hauteur_m);
    for (const h of [3, 5, 8, 12, 15]) if (!ids.includes(h)) ctx.addIssue({ code: "custom", message: `classe de ${h} m manquante` });
    for (const v of f.variantes) if (!f.classes.some((c) => c.id === v.base)) ctx.addIssue({ code: "custom", message: `variante ${v.id} : classe ${v.base} inconnue` });
    for (const [id, h] of [["titan_mur", 50], ["rod_reiss", 120], ["colossal", 60]] as const) if (!f.speciaux.some((x) => x.id === id && x.hauteur_m === h)) ctx.addIssue({ code: "custom", message: `${id} (${h} m) manquant` });
  });
export type TitansFile = z.infer<typeof TitansFileSchema>;

/** Figures de R3 (fichier 21 §8) : trois corps par classe de Titan, deux peaux, cinq tenues de soldat. Choix de design `A`. */
const Expressions = Expression;
const Unit = z.number().min(0).max(1);
const TitanR3Variant = z
  .object({
    id: z.enum(["a", "b", "c"]),
    nom: z.string().min(1),
    modifs: z.partialRecord(z.enum(TITAN_PROPORTIONS), z.number()).refine((m) => Math.abs((m.legs ?? 0) + (m.torso ?? 0) + (m.neck ?? 0) + (m.head ?? 0)) < 1e-6, "les modifications de jambes, torse, cou et tête s'annulent"),
    macro: z.object({ age: Unit.optional(), weight: Unit.optional(), muscle: Unit.optional() }).strict().optional(),
    posture: z.object({ lean: z.number().optional(), drop: z.number().optional(), armOut: z.tuple([z.number(), z.number()]).optional(), kneeBend: z.number().min(0).optional(), headRoll: z.number().optional() }).strict().optional(),
    demarche: z.object({ limp: Unit.optional(), sway: z.number().min(0).optional(), drag: Unit.optional(), jerk: Unit.optional() }).strict().optional(),
    expression: Expressions.optional(),
    cheveux: z.boolean().optional(),
    dents: z.number().min(1).max(1.8).optional(),
    yeux: z.tuple([z.number().min(0.7).max(1.4), z.number().min(0.7).max(1.4)]).optional(),
  })
  .strict();
const UnitRange = z.tuple([Unit, Unit]).refine(([a, b]) => a <= b, "plage croissante");
const Headgear = z.object({ forme: z.enum(["kepi", "casque", "casquette"]), teinte: Hex, bandeau: Hex.optional() }).strict();
export const SOLDIER_OUTFIT_IDS = ["exploration", "garnison", "police", "marley_infanterie", "marley_officier"] as const;
const Outfit = z
  .object({
    id: z.enum(SOLDIER_OUTFIT_IDS),
    camp: z.enum(["paradis", "marley"]),
    nom: z.string().min(1),
    veste: Hex,
    pantalon: Hex,
    bottes: Hex,
    molletieres: Hex.optional(),
    cape: Hex.optional(),
    echarpe: Hex.optional(),
    manteau: z.object({ teinte: Hex, longueur: z.number().min(0.2).max(0.9) }).strict().optional(),
    coiffe: Headgear.optional(),
    odm: z.boolean(),
    lames: z.enum(["mains", "fourreau"]).optional(),
    fusil: z.enum(["dos", "mains"]).optional(),
    sac: Hex.optional(),
    baudrier: z.boolean().optional(),
    etui: z.boolean().optional(),
    corpulence: z.object({ age: UnitRange, muscle: UnitRange, weight: UnitRange }).strict(),
  })
  .strict();
export const FiguresR3FileSchema = z
  .object({
    canon: CanonSchema,
    note: z.string().min(1),
    titans: z.array(z.object({ classe: z.string(), variantes: z.array(TitanR3Variant).length(3) }).strict()).length(5),
    peaux: z.array(z.object({ id: z.enum(["pale", "rougeaude"]), nom: z.string().min(1), teinte: Hex, melange: Unit, marbrures: Unit, dents: Hex }).strict()).length(2),
    soldats: z.array(Outfit).length(5),
  })
  .strict()
  .superRefine((f, ctx) => {
    const ids = new Set(f.soldats.map((s) => s.id));
    if (ids.size !== f.soldats.length) ctx.addIssue({ code: "custom", message: "tenue en double" });
    for (const t of f.titans) if (t.variantes.map((v) => v.id).join() !== "a,b,c") ctx.addIssue({ code: "custom", message: `${t.classe} : variantes a, b, c attendues dans l'ordre` });
  });
export type FiguresR3File = z.infer<typeof FiguresR3FileSchema>;
