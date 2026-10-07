import { z } from "zod";

/**
 * Lieux (R1e, consigne §2) : plan d'auteur d'un lieu-clé N1 (`data/places/<id>.json`), paramètres des murailles
 * (`data/places/_murs.json`) et plan figé d'un lieu courant N2 (`data/places/generated/<id>.json`).
 * - Données de présentation : la simulation ne les lit pas (seuls la population et la capacité d'accueil d'un plan N2 lui sont
 *   destinées, §4). Elles sont exclues des globs du worker et des Archives : le bundle principal ne les contient pas.
 * - Ce module ne sert qu'à la validation (`places:valider`, tests) ; le rendu n'en importe que les types (Zod reste hors du
 *   morceau 3D), et lit les fichiers par `fetch` (`/places3d/<id>.json`, voir `vite.config.ts`).
 * - Repère du plan : mètres, x vers l'est, y vers le sud (comme un plan dessiné : le nord en haut), altitude à part.
 *   Angles en degrés, 0 = est, sens horaire sur le plan (de x vers y).
 */
export const CanonSchema = z.enum(["C", "A", "?"]);
export type Canon = z.infer<typeof CanonSchema>;
const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "teinte attendue au format #RRGGBB");
const Id = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, "identifiant en minuscules (a-z, 0-9, _ ou -)");
export const PtSchema = z.tuple([z.number(), z.number()]);
export type Pt = z.infer<typeof PtSchema>;
const Poly = z.array(PtSchema).min(3);
const Line = z.array(PtSchema).min(2);
const Range = z.tuple([z.number(), z.number()]).refine(([a, b]) => a <= b, "intervalle [min, max] attendu");

/** Référence précise (« Manga, chap. 1 », « Databook… ») ou « aucune » ; le statut dit ce qu'elle établit. */
const SourceSchema = z.object({ ref: z.string().min(1), canon: CanonSchema, note: z.string().optional() }).strict();

/** Valeur paramétrable avec son statut et, pour une valeur incertaine, sa plage plausible. */
const ParamNum = z
  .object({ valeur: z.number(), canon: CanonSchema, plage: Range.optional(), note: z.string().optional() })
  .strict()
  .refine((p) => p.canon !== "?" || p.plage !== undefined, "une valeur incertaine (?) porte sa plage plausible")
  .refine((p) => !p.plage || (p.valeur >= p.plage[0] && p.valeur <= p.plage[1]), "valeur hors de sa plage");

// ——— Densité, population ———

/** Classes de densité (consigne §2.2) : habitants par hectare bâti. */
export const DENSITY_CLASSES = ["coeur", "faubourg", "village", "ferme"] as const;
export type DensityClass = (typeof DENSITY_CLASSES)[number];
export const DENSITY_BOUNDS: Record<DensityClass, [number, number]> = { coeur: [150, 300], faubourg: [60, 150], village: [15, 50], ferme: [0, 10] };

/**
 * Population d'une zone : celle de la simulation au départ de `scn_sandbox_845` pour `province`, multipliée par `part` ; sans
 * province dans les données (districts de Maria non établis), `valeur` paramétrable (`?`).
 */
const PopulationSchema = z
  .object({ province: z.string().regex(/^prov_[a-z0-9_]+$/).nullable(), part: z.number().gt(0).max(1), valeur: z.number().int().positive().optional(), canon: CanonSchema, note: z.string().optional() })
  .strict()
  .refine((p) => (p.province === null) === (p.valeur !== undefined), "population : une province, ou une valeur paramétrable sans province")
  .refine((p) => p.province !== null || p.canon === "?", "population sans province : valeur incertaine (?)");
const DensiteSchema = z
  .object({ classe: z.enum(DENSITY_CLASSES), valeur: z.number().positive(), canon: CanonSchema })
  .strict()
  .refine((d) => d.valeur >= DENSITY_BOUNDS[d.classe][0] && (d.classe === "ferme" ? d.valeur < DENSITY_BOUNDS.ferme[1] : d.valeur <= DENSITY_BOUNDS[d.classe][1]), "densité hors des bornes de sa classe");

/** Zone annexe (faubourg hors de l'enceinte, hameau rattaché) : sa propre population et sa densité. */
const ZoneSchema = z.object({ id: Id, nom: z.string().min(1), canon: CanonSchema, polygone: Poly, population: PopulationSchema, densite: DensiteSchema }).strict();

// ——— Murailles ———

export const RINGS = ["maria", "rose", "sina"] as const;
export type Ring = (typeof RINGS)[number];

/** Tracé d'un pan de mur (ligne médiane au sol) : arc de cercle ou polyligne. */
const WallTraceSchema = z.discriminatedUnion("type", [
  z.object({ id: Id, type: z.literal("arc"), centre: PtSchema, rayon_m: z.number().positive(), debut_deg: z.number(), fin_deg: z.number(), exterieur: z.enum(["dehors", "dedans"]), canon: CanonSchema }).strict(),
  z.object({ id: Id, type: z.literal("ligne"), points: Line, exterieur: z.enum(["gauche", "droite"]), canon: CanonSchema }).strict(),
]);
export type WallTrace = z.infer<typeof WallTraceSchema>;

const EnceinteSchema = z
  .object({
    /** Anneau : son profil (hauteur, épaisseur, fruit, chemin de ronde…) est lu dans `_murs.json`. */
    mur: z.enum(RINGS),
    canon: CanonSchema,
    traces: z.array(WallTraceSchema).min(1),
    /** Escaliers d'accès au chemin de ronde, côté intérieur : tracé (id) et abscisse le long du tracé (m). */
    escaliers: z.array(z.object({ trace: Id, s_m: z.number().min(0), canon: CanonSchema }).strict()),
    /** Canons de rempart sur rails, sur le chemin de ronde. */
    canons: z.object({ espacement_m: z.number().positive(), canon: CanonSchema, traces: z.array(Id) }).strict(),
    /** Glacis dégagé au pied du mur, côté ville (m) : hors surface bâtie. */
    glacis_m: z.number().min(0),
    /** Lierre ou pied végétal (campagne). */
    pied_vegetal: z.boolean(),
  })
  .strict();

// ——— Portes ———

export const GATE_ROLES = ["exterieure", "interieure", "riviere", "poterne"] as const;
export const GATE_STATES = ["intacte", "brisee_845", "reparee", "bouchee"] as const;
export type GateState = (typeof GATE_STATES)[number];
const GateSchema = z
  .object({
    id: Id,
    nom: z.string().min(1),
    role: z.enum(GATE_ROLES),
    canon: CanonSchema,
    sources: z.array(SourceSchema).min(1),
    /** Pan de mur qui la porte et abscisse le long de son tracé (m). */
    trace: Id,
    s_m: z.number().min(0),
    passage: z.object({ largeur_m: z.number().positive(), hauteur_m: z.number().positive(), voute: z.enum(["plein_cintre", "surbaisse", "brisee", "linteau"]), trous_assassin: z.number().int().min(0), rainures: z.boolean(), canon: CanonSchema }).strict(),
    vantail: z.object({ type: z.enum(["levant", "battants", "herse"]), largeur_m: z.number().positive(), hauteur_m: z.number().positive(), epaisseur_m: z.number().positive(), materiau: z.enum(["chene_ferre", "fer", "bois_et_fer"]), canon: CanonSchema }).strict(),
    structure: z.object({ huisserie: z.boolean(), gonds: z.number().int().min(0), treuils: z.number().int().min(0), contrepoids: z.number().int().min(0), herse: z.boolean(), canon: CanonSchema }).strict(),
    tours: z.array(z.object({ type: z.enum(["tourelle", "poste_de_garde", "maison_du_treuil"]), cote: z.enum(["gauche", "droite", "dessus"]), hauteur_m: z.number().positive(), canon: CanonSchema }).strict()),
    /** Décor du portail (porte intérieure) : pilastres, fronton, armoiries absentes (aucun emblème inventé). */
    portail: z.enum(["sobre", "pilastres", "bossage"]),
    etat: z.enum(GATE_STATES),
  })
  .strict();
export type Gate = z.infer<typeof GateSchema>;

// ——— Rues, places, îlots, bâtiments ———

export const PAVINGS = ["paves", "dalles", "terre", "gravier"] as const;
const StreetSchema = z
  .object({ id: Id, nom: z.string().min(1), canon: CanonSchema, type: z.enum(["principale", "rue", "ruelle", "quai", "chemin", "route"]), trace: Line, largeur_m: z.number().positive(), revetement: z.enum(PAVINGS) })
  .strict();
export type Street = z.infer<typeof StreetSchema>;

const SquareSchema = z.object({ id: Id, nom: z.string().min(1), canon: CanonSchema, polygone: Poly, revetement: z.enum(PAVINGS), fontaine: PtSchema.nullable(), marche: z.boolean() }).strict();
export type Square = z.infer<typeof SquareSchema>;

export const ROOF_FORMS = ["pignon", "pignon_rue", "croupe", "demi_croupe", "mansarde", "plat", "appentis", "pavillon"] as const;
export type RoofForm = (typeof ROOF_FORMS)[number];
export const ROOF_COVERS = ["ardoise", "tuile_plate", "tuile_canal", "bardeau", "chaume", "cuivre", "terrasse"] as const;
export type RoofCover = (typeof ROOF_COVERS)[number];
export const FACADES = ["enduit", "colombage", "pierre_taillee", "pierre_brute", "brique", "bois"] as const;
export type Facade = (typeof FACADES)[number];
export const BLOCK_FUNCTIONS = ["habitation", "marche", "atelier", "caserne", "entrepot", "culte", "jardin", "noble", "administration"] as const;
export type BlockFunction = (typeof BLOCK_FUNCTIONS)[number];

/**
 * Gabarit d'un îlot, choisi par l'auteur (pas tiré au sort) : les suites `toits`, `couvertures`, `facades`, `teintes`,
 * `etages` et `parcelles_m` sont parcourues dans l'ordre le long des rives (longueurs premières entre elles : pas de motif court).
 */
const GabaritSchema = z
  .object({
    etages: z.array(z.number().int().min(1).max(12)).min(1),
    hauteur_etage_m: z.number().min(2.4).max(6),
    toits: z.array(z.enum(ROOF_FORMS)).min(1),
    pente_deg: Range,
    couvertures: z.array(z.enum(ROOF_COVERS)).min(1),
    facades: z.array(z.enum(FACADES)).min(1),
    teintes: z.array(Hex).min(1),
    /** Largeurs de façade (m), parcourues en suite. */
    parcelles_m: z.array(z.number().min(3).max(60)).min(1),
    profondeur_m: z.number().min(4).max(40),
    /** Boutiques au rez-de-chaussée. */
    boutiques: z.boolean(),
    /** Passages (portes cochères, ruelles) vers la cour : un tous les `passage_m` de rive (0 : aucun). */
    passage_m: z.number().min(0),
    /** Cour : plantée (arbres), jardin (potager et arbres fruitiers), pavée ; `arbres_par_ha` de cour. */
    cour: z.object({ type: z.enum(["plantee", "jardin", "pavee"]), arbres_par_ha: z.number().min(0) }).strict(),
  })
  .strict();
export type Gabarit = z.infer<typeof GabaritSchema>;

const BlockSchema = z
  .object({
    id: Id,
    quartier: Id,
    zone: Id.optional(),
    fonction: z.enum(BLOCK_FUNCTIONS),
    polygone: Poly,
    /** Part de la rive bâtie (0–1) : les vides restent en jardins ou en passages. */
    densite_bati: z.number().min(0).max(1),
    gabarit: Id,
  })
  .strict();
export type Block = z.infer<typeof BlockSchema>;

export const ARCHETYPES = [
  "maison", "eglise", "chapelle", "cathedrale", "halle", "hotel_de_ville", "caserne", "entrepot", "clinique", "ecole", "moulin", "grenier", "arsenal", "tour",
  "chateau", "donjon", "palais", "ferme", "grange", "ecurie", "atelier", "usine", "fort", "blockhaus", "phare", "quai_grue", "fontaine", "kiosque",
] as const;
export type Archetype = (typeof ARCHETYPES)[number];
/** Paramètres propres à un archétype (tour de clocher, nef, ailes…), lus par son constructeur. */
const ArchParams = z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.array(z.number())]));

const BuildingSchema = z
  .object({
    id: Id,
    nom: z.string().min(1),
    canon: CanonSchema,
    archetype: z.enum(ARCHETYPES),
    /** Centre de l'emprise, dimensions (façade × profondeur), angle libre. */
    position: PtSchema,
    emprise_m: z.tuple([z.number().positive(), z.number().positive()]),
    angle_deg: z.number(),
    hauteur_m: z.number().positive(),
    etages: z.number().int().min(1),
    toit: z.enum(ROOF_FORMS),
    couverture: z.enum(ROOF_COVERS),
    facade: z.enum(FACADES),
    teinte: Hex,
    reperes_canon: z.array(z.string()),
    params: ArchParams.optional(),
    sources: z.array(SourceSchema).optional(),
  })
  .strict();
export type Building = z.infer<typeof BuildingSchema>;

// ——— Végétation, eau ———

export const SPECIES = ["tilleul", "marronnier", "chene", "erable", "peuplier", "bouleau", "pin", "saule", "fruitier", "geant"] as const;
export type Species = (typeof SPECIES)[number];
const VegetationSchema = z
  .object({
    alignements: z.array(z.object({ rue: Id, essence: z.enum(SPECIES), intervalle_m: z.number().min(4), cotes: z.enum(["deux", "gauche", "droite"]) }).strict()),
    isoles: z.array(z.object({ position: PtSchema, essence: z.enum(SPECIES), hauteur_m: z.number().positive(), nom: z.string().optional() }).strict()),
    parcs: z.array(z.object({ id: Id, nom: z.string().min(1), canon: CanonSchema, polygone: Poly, essences: z.array(z.enum(SPECIES)).min(1), arbres_par_ha: z.number().min(0) }).strict()),
    vergers: z.array(z.object({ polygone: Poly, espacement_m: z.number().min(3) }).strict()),
    haies: z.array(z.object({ trace: Line }).strict()),
    potagers: z.array(z.object({ polygone: Poly }).strict()),
    /** Essences plantées dans les cours (les gabarits disent combien). */
    essences_cours: z.array(z.enum(SPECIES)).min(1),
  })
  .strict();
export type Vegetation = z.infer<typeof VegetationSchema>;

const WaterSchema = z
  .object({
    voies: z.array(z.object({ id: Id, nom: z.string().min(1), canon: CanonSchema, type: z.enum(["riviere", "canal"]), trace: Line, largeur_m: z.number().positive(), quais: z.boolean() }).strict()),
    ponts: z.array(z.object({ id: Id, position: PtSchema, angle_deg: z.number(), longueur_m: z.number().positive(), largeur_m: z.number().positive(), type: z.enum(["pierre", "bois"]) }).strict()),
    puits: z.array(PtSchema),
    fontaines: z.array(PtSchema),
  })
  .strict();
export type Water = z.infer<typeof WaterSchema>;

// ——— Vues, états ———

/** Caméra nommée : œil et cible (x, y du plan ; altitude en m), champ vertical. */
const ViewSchema = z.object({ id: Id, nom: z.string().min(1), oeil: z.tuple([z.number(), z.number(), z.number()]), cible: z.tuple([z.number(), z.number(), z.number()]), fov: z.number().min(10).max(100) }).strict();
export type PlaceView = z.infer<typeof ViewSchema>;

/** Variante datée : état des portes, ruines (part de bâtiments ruinés par zone), incendies, débris, végétation envahissante. */
const StateSchema = z
  .object({
    id: Id,
    nom: z.string().min(1),
    date: z.string().min(1),
    canon: CanonSchema,
    sources: z.array(SourceSchema).min(1),
    portes: z.record(Id, z.enum(GATE_STATES)),
    ruines: z.array(z.object({ polygone: Poly, part: z.number().min(0).max(1) }).strict()),
    incendies: z.array(PtSchema),
    /** Rochers (bouchage d'une porte) : position, rayon (m). */
    rochers: z.array(z.object({ position: PtSchema, rayon_m: z.number().positive(), canon: CanonSchema }).strict()),
    /** Herbes et jeunes arbres dans les rues (abandon). */
    abandon: z.number().min(0).max(1),
    /** Fumée et lumière : ciel de jour clair, brumeux, enfumé. */
    ciel: z.enum(["clair", "brumeux", "enfume"]),
    /** Habitants présents (part de la population de 845). */
    habitants: z.number().min(0).max(1),
  })
  .strict();
export type PlaceState = z.infer<typeof StateSchema>;

export const PlaceSchema = z
  .object({
    id: Id,
    nom: z.string().min(1),
    /** Libellé affiché quand le nom n'est pas établi. */
    libelle: z.string().min(1),
    canon: CanonSchema,
    niveau: z.literal("N1"),
    sources: z.array(SourceSchema).min(1),
    province: z.string().regex(/^prov_[a-z0-9_]+$/).nullable(),
    /** Profil de style des textures (`data/art/styles.json`). */
    style: z.string().regex(/^E\d\d$/),
    population: PopulationSchema,
    densite: DensiteSchema,
    /** Polygone de la zone principale (intra-muros d'un district) : la population et la densité ci-dessus s'y rapportent. */
    perimetre: Poly,
    zones: z.array(ZoneSchema),
    /** Orientation du lieu par rapport au centre des murs (district) : `?` si non établie. */
    orientation: z.object({ valeur: z.enum(["nord", "est", "sud", "ouest", "centre", "aucune"]), canon: CanonSchema }).strict(),
    /** Emprise rendue (m) : carré de côté `etendue_m` centré sur l'origine. */
    etendue_m: z.number().positive(),
    enceinte: EnceinteSchema.nullable(),
    portes: z.array(GateSchema),
    rues: z.array(StreetSchema),
    places_publiques: z.array(SquareSchema),
    gabarits: z.record(Id, GabaritSchema),
    quartiers: z.array(z.object({ id: Id, nom: z.string().min(1), canon: CanonSchema, note: z.string().optional() }).strict()).min(1),
    ilots: z.array(BlockSchema),
    batiments: z.array(BuildingSchema),
    vegetation: VegetationSchema,
    eau: WaterSchema,
    points_de_vue: z.array(ViewSchema).min(6),
    etats: z.array(StateSchema).min(1),
    /** État affiché par défaut. */
    etat_defaut: Id,
  })
  .strict();
export type Place = z.infer<typeof PlaceSchema>;

// ——— Murailles : `_murs.json` ———

const RingSchema = z
  .object({
    nom: z.string().min(1),
    hauteur_m: ParamNum,
    epaisseur_base_m: ParamNum,
    epaisseur_sommet_m: ParamNum,
    /** Talus de pied (maçonnerie en glacis) : hauteur et avancée (m). */
    talus_hauteur_m: ParamNum,
    talus_avancee_m: ParamNum,
    fondation_profondeur_m: ParamNum,
    chemin_de_ronde_m: ParamNum,
    parapet_hauteur_m: ParamNum,
    parapet_epaisseur_m: ParamNum,
    /** Part du fruit portée par le parement extérieur (le reste par l'intérieur). */
    fruit_part_exterieure: ParamNum,
    creneaux: z.object({ valeur: z.boolean(), canon: CanonSchema }).strict(),
    rayon_km: ParamNum,
  })
  .strict()
  .refine((r) => r.epaisseur_sommet_m.valeur <= r.epaisseur_base_m.valeur, "le sommet est moins épais que la base")
  .refine((r) => r.chemin_de_ronde_m.valeur + r.parapet_epaisseur_m.valeur <= r.epaisseur_sommet_m.valeur, "le chemin de ronde et le parapet tiennent sur le sommet");
export type RingProfile = z.infer<typeof RingSchema>;
export const WallsParamsSchema = z.object({ note: z.string().min(1), sources: z.array(SourceSchema).min(1), anneaux: z.object({ maria: RingSchema, rose: RingSchema, sina: RingSchema }).strict() }).strict();
export type WallsParams = z.infer<typeof WallsParamsSchema>;

// ——— Plan figé d'un lieu N2 (§4) ———

/**
 * Plan compact : positions quantifiées à 0,1 m (entiers ×10), hauteurs à 0,25 m (entiers ×4), angles au degré, archétype par
 * index. `b` : [x, y, angle, largeur, profondeur, hauteur, archétype, toit, couverture, façade, teinte] ; `t` : [x, y, essence, hauteur].
 */
export const FrozenPlanSchema = z
  .object({
    id: Id,
    nom: z.string().min(1),
    libelle: z.string().min(1),
    canon: CanonSchema,
    niveau: z.literal("N2"),
    generateur: z.object({ nom: z.string().min(1), version: z.number().int().positive(), graine: z.number().int() }).strict(),
    province: z.string().regex(/^prov_[a-z0-9_]+$/).nullable(),
    style: z.string().regex(/^E\d\d$/),
    /** Les deux seuls champs lus par la simulation (§4). */
    population: z.number().int().min(0),
    capacite: z.number().int().min(0),
    etendue_m: z.number().positive(),
    archetypes: z.array(z.enum(ARCHETYPES)).min(1),
    toits: z.array(z.enum(ROOF_FORMS)).min(1),
    couvertures: z.array(z.enum(ROOF_COVERS)).min(1),
    facades: z.array(z.enum(FACADES)).min(1),
    teintes: z.array(Hex).min(1),
    essences: z.array(z.enum(SPECIES)).min(1),
    rues: z.array(z.object({ trace: z.array(z.tuple([z.number().int(), z.number().int()])).min(2), largeur: z.number().int().positive(), revetement: z.enum(PAVINGS) }).strict()),
    b: z.array(z.array(z.number().int()).length(11)),
    t: z.array(z.array(z.number().int()).length(4)),
    champs: z.array(z.object({ polygone: z.array(z.tuple([z.number().int(), z.number().int()])).min(3), culture: z.enum(["ble", "orge", "jachere", "labour", "prairie", "potager", "verger"]) }).strict()),
  })
  .strict();
export type FrozenPlan = z.infer<typeof FrozenPlanSchema>;
