import type { Gabarit, Place } from "../../../data/placeSchema";
import { pt } from "./kit";
import { BASE_GABARITS, baseViews, pts } from "./maria";
import { building, buildSaillie, cellKey, claimRect, lines, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * Krolva (C15, tranche 2) — district ouest du mur Rose, plan d'auteur. Établi [C] : district ouest de Wall Rose, bâti dans une saillie
 * du mur à deux portes (fichiers 01 §3.1 et 11 §2, atlas 06 S04 : « Artisanat », rang 3). Krolva n'est pas la base des expéditions du
 * Bataillon d'exploration : celle-ci est Karanes (atlas 06 S02, `expedition_base: prov_karanes`). Tout le reste est une adaptation [A] :
 * tracé, noms de rues, de places et de bâtiments, dimensions, quartiers, gabarits.
 *
 * Parti d'auteur [A] : ville d'artisans et de corporations de l'ouest — damier régulier de 110 m, Grande Rue des Corporations de la
 * porte extérieure à la porte intérieure, place des Corporations au milieu de l'axe, quartier des Forges à l'est (fonderie, grande
 * forge, moulin à vent), quartier des Tanneurs et des Verriers à l'ouest, école d'apprentissage près de l'église, caserne de la porte
 * ouest contre la porte extérieure. Population : celle de `prov_krolva` (34 783 au scénario 845), 90 % intra-muros, 10 % au faubourg.
 */
const S = lines(-990, 990, 110, 9, { 4: 5, 14: 5, 6: 12, 12: 12 });
const T = lines(25, 905, 110, 9, { 2: 12, 5: 12 });
const sv = (k: number): number => -990 + 110 * k;
const tv = (k: number): number => 25 + 110 * k;

const GABARITS: Record<string, Gabarit> = {
  centre: BASE_GABARITS.centre as Gabarit,
  ouvrier: BASE_GABARITS.ouvrier as Gabarit,
  faubourg: { ...(BASE_GABARITS.faubourg as Gabarit), cour: { type: "jardin", arbres_par_ha: 70 } },
  garnison: BASE_GABARITS.garnison as Gabarit,
  ateliers: { etages: [2, 3, 2, 3], hauteur_etage_m: 3.5, toits: ["pignon", "croupe", "appentis", "pignon_rue"], pente_deg: [34, 46], couvertures: ["tuile_plate", "ardoise", "tuile_canal", "tuile_plate"], facades: ["brique", "pierre_brute", "enduit", "bois"], teintes: ["#D3C5AA", "#C9BBA0", "#D9CCB2", "#C4B698", "#CFC0A4"], parcelles_m: [10, 14, 9, 12], profondeur_m: 15, boutiques: true, passage_m: 40, cour: { type: "pavee", arbres_par_ha: 55 } },
  corporations: { etages: [3, 3, 4, 3], hauteur_etage_m: 3.2, toits: ["pignon_rue", "croupe", "pignon_rue", "mansarde"], pente_deg: [44, 56], couvertures: ["ardoise", "tuile_plate", "ardoise", "tuile_plate"], facades: ["pierre_taillee", "colombage", "enduit", "brique"], teintes: ["#E8DAC0", "#E0CCA8", "#ECD8C2", "#DCD6C2", "#E4D6BA", "#D8C4A0"], parcelles_m: [8, 10, 7, 9], profondeur_m: 14, boutiques: true, passage_m: 38, cour: { type: "plantee", arbres_par_ha: 75 } },
};

const Q = {
  centre: quarter("vieux-krolva", "Vieux Krolva", "centre", "habitation"),
  corporations: quarter("quartier-des-corporations", "Quartier des Corporations", "corporations", "marche", 0.95),
  forges: quarter("quartier-des-forges", "Quartier des Forges", "ateliers", "atelier", 0.9),
  tanneurs: quarter("quartier-des-tanneurs-et-des-verriers", "Quartier des Tanneurs et des Verriers", "ateliers", "atelier", 0.9),
  garnison: quarter("quartier-de-la-porte-ouest", "Quartier de la Porte Ouest", "garnison", "caserne", 0.7),
  ouvrier: quarter("quartier-des-compagnons", "Quartier des Compagnons", "ouvrier", "habitation", 0.95),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(8), sv(10), tv(3), tv(5), { kind: "place", id: "place-des-corporations", nom: "Place des Corporations", revetement: "paves", fontaine: true, marche: true });
claimRect(claims, S, T, sv(13), sv(15), tv(6), tv(7), { kind: "place", id: "place-des-forges", nom: "Place des Forges", revetement: "terre", fontaine: false, marche: false });
claimRect(claims, S, T, sv(5), sv(6), tv(2), tv(3), { kind: "place", id: "parvis-de-l-eglise", nom: "Parvis de l'église", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, sv(2), sv(4), tv(4), tv(5), { kind: "parc", id: "jardin-des-verriers", nom: "Jardin des Verriers", essences: ["tilleul", "marronnier", "fruitier"], arbres_par_ha: 70 });
claimRect(claims, S, T, sv(14), sv(16), tv(2), tv(3), { kind: "parc", id: "promenade-des-tisserands", nom: "Promenade des Tisserands", essences: ["tilleul", "peuplier", "erable"], arbres_par_ha: 62 });
claimRect(claims, S, T, sv(6), sv(8), tv(7), tv(8), { kind: "parc", id: "jardin-de-la-porte-ouest", nom: "Jardin de la Porte Ouest", essences: ["pin", "tilleul", "bouleau"], arbres_par_ha: 55 });
claimRect(claims, S, T, sv(16), sv(17), tv(4), tv(6), { kind: "parc", id: "pre-des-compagnons", nom: "Pré des Compagnons", essences: ["saule", "peuplier", "tilleul"], arbres_par_ha: 50 });
claims[cellKey(S, T, sv(4), tv(2))] = { kind: "ilot", fonction: "culte", densite: 0.55, quartier: Q.centre.id, gabarit: "centre" };

/** Noms de rues de Krolva : tous créés [A]. */
const NOMS_S = [
  "Rue des Forgerons", "Rue des Taillandiers", "Rue des Cloutiers", "Rue des Serruriers", "Rue des Couteliers", "Rue des Fondeurs", "Rue des Chaudronniers du Roi", "Rue des Ferblantiers", "Rue des Tanneurs", "Rue des Corroyeurs",
  "Rue des Mégissiers", "Rue des Cordonniers", "Rue des Gantiers", "Rue des Verriers", "Rue des Vitriers", "Rue des Potiers d'Étain", "Rue des Horlogers", "Rue des Menuisiers",
];
const NOMS_T = [
  "Rue des Corporations", "Rue des Maîtrises", "Rue des Apprentis", "Rue des Compagnons", "Rue des Jurés", "Rue des Chefs-d'œuvre", "Rue des Enclumes", "Rue des Soufflets", "Rue des Fourneaux",
];

export function krolva(): Place {
  return buildSaillie({
    id: "krolva",
    nom: "Krolva",
    libelle: "Krolva",
    canon: "C",
    sources: [
      { ref: "docs/spec/01 §3.1 et docs/spec/11 §2 : Krolva (ouest), district du mur Rose ; docs/spec/06 S04 : district ouest, ressource clé « artisanat » (rang 3)", canon: "C" },
      { ref: "docs/spec/20 (LC-B) : districts du mur Rose [C], détails [A] ; la base des expéditions est Karanes (atlas 06 S02), pas Krolva", canon: "C" },
      { ref: "tracé de la saillie, noms de rues, de places et de bâtiments, dimensions, quartiers : adaptation (création C15, `docs/lore/creations.md`)", canon: "A" },
    ],
    province: "prov_krolva",
    style: "E04",
    mur: "rose",
    population: { province: "prov_krolva", part: 0.9, canon: "C", note: "90 % de la population de `prov_krolva` au départ de scn_sandbox_845 (34 783 hab.) logés intra-muros ; la province existe [C], la part est adaptée [A]." },
    densite: { classe: "coeur", valeur: 240, canon: "A" },
    orientation: { valeur: "ouest", canon: "C" },
    R: 990,
    grid: { rot: 0, s: S, t: T },
    main: { nom: "Grande Rue des Corporations", largeur_m: 18 },
    names: {
      s: NOMS_S,
      t: NOMS_T,
      lanes: ["Ruelle des Forges", "Ruelle du Cuir", "Ruelle des Copeaux", "Ruelle des Braises"],
      placettes: ["Place des Cloutiers", "Placette du Charbon", "Place des Apprentis", "Placette des Peaux"],
    },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      const r = Math.hypot(c[0], c[1]);
      if (c[1] > 760 && Math.abs(c[0]) < 520) return Q.garnison.id;
      if (Math.abs(c[0]) < 330 && c[1] > 300 && c[1] < 760) return Q.corporations.id;
      if (c[0] > 330 && c[1] > 250 && c[1] < 800) return Q.forges.id;
      if (c[0] < -330 && c[1] > 250) return Q.tanneurs.id;
      if (r < 460) return Q.centre.id;
      if (Math.abs(c[0]) > 700) return Q.ouvrier.id;
      return Q.centre.id;
    },
    claims,
    placettes: [cellKey(S, T, sv(1), tv(3)), cellKey(S, T, sv(17), tv(2)), cellKey(S, T, sv(3), tv(7)), cellKey(S, T, sv(16), tv(7))],
    faubourg: {
      nom: "Faubourg de la porte intérieure",
      population: { province: "prov_krolva", part: 0.1, canon: "A", note: "10 % de la population de `prov_krolva` au départ de scn_sandbox_845 logés au pied de la porte intérieure, côté intérieur des terres (adaptation)." },
      densite: { classe: "faubourg", valeur: 80, canon: "A" },
      xs: [-495, -330, -165, 0, 165, 330, 495],
      ys: [-30, -150, -270, -390, -510],
      gabarit: "faubourg",
      quarter: quarter("faubourg-de-la-porte-interieure", "Faubourg de la porte intérieure", "faubourg", "habitation", 0.55),
      names: ["Chemin des Prés", "Chemin des Carrières", "Chemin des Haies", "Chemin des Ruches", "Chemin du Gué", "Chemin des Vergers", "Chemin de la Mare", "Chemin des Saules", "Chemin des Ormes", "Chemin du Glacis", "Chemin des Champs"],
    },
    canons_m: 30,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      return [
        building({ id: "maison-des-corporations", nom: "Maison des Corporations", canon: "A", archetype: "hotel_de_ville", position: c(9, 2), emprise_m: [34, 18], angle_deg: 0, hauteur_m: 14, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 48 }, reperes_canon: ["Krolva, ressource clé : artisanat [C] (atlas 06 S04) : la maison est une adaptation"] }),
        building({ id: "grande-forge", nom: "Grande Forge de Krolva", canon: "A", archetype: "atelier", position: c(13, 5), emprise_m: [40, 22], angle_deg: 0, hauteur_m: 10, etages: 2, toit: "pignon", couverture: "ardoise", facade: "pierre_brute", teinte: "#BDB3A0", params: { pente: 38 } }),
        building({ id: "fonderie", nom: "Fonderie du Levant", canon: "A", archetype: "usine", position: c(15, 4), emprise_m: [44, 26], angle_deg: 0, hauteur_m: 12, etages: 2, toit: "pignon", couverture: "ardoise", facade: "brique", teinte: "#B8A793", params: { pente: 34 } }),
        building({ id: "moulin-des-forges", nom: "Moulin à vent des Forges", canon: "A", archetype: "moulin", position: c(14, 6), emprise_m: [12, 12], angle_deg: 0, hauteur_m: 16, etages: 3, toit: "pavillon", couverture: "bardeau", facade: "pierre_brute", teinte: "#D2C6AE" }),
        building({ id: "tannerie-du-couchant", nom: "Tannerie du Couchant", canon: "A", archetype: "atelier", position: c(4, 6), emprise_m: [38, 22], angle_deg: 0, hauteur_m: 9, etages: 2, toit: "pignon", couverture: "tuile_plate", facade: "bois", teinte: "#B9A27E", params: { pente: 36 } }),
        building({ id: "halle-des-verriers", nom: "Halle des Verriers", canon: "A", archetype: "halle", position: c(3, 3), emprise_m: [46, 24], angle_deg: 0, hauteur_m: 12, etages: 1, toit: "croupe", couverture: "tuile_plate", facade: "bois", teinte: "#C8B088", params: { piliers: 9, pente: 40 } }),
        ...[[-150, 480], [-60, 480], [30, 480], [120, 480], [-150, 650], [-60, 650], [30, 650], [120, 650]].map(([x, y], k) =>
          building({ id: `etal-${k + 1}`, nom: `Étal d'atelier ${k + 1}`, canon: "A", archetype: "halle", position: pt(x as number, y as number), emprise_m: [14, 7], angle_deg: 0, hauteur_m: 5, etages: 1, toit: "appentis", couverture: "tuile_plate", facade: "bois", teinte: "#BFA37C", params: { piliers: 4, pente: 30 } }),
        ),
        building({ id: "ecole-d-apprentissage", nom: "École d'apprentissage", canon: "A", archetype: "ecole", position: c(6, 2), emprise_m: [32, 16], angle_deg: 0, hauteur_m: 11, etages: 2, toit: "croupe", couverture: "ardoise", facade: "brique", teinte: "#D9CDB6", params: { pente: 40 } }),
        building({ id: "entrepot-des-materiaux", nom: "Entrepôt des matériaux", canon: "A", archetype: "entrepot", position: c(12, 7), emprise_m: [54, 24], angle_deg: 0, hauteur_m: 11, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#C8B8A0", params: { pente: 40 } }),
        building({ id: "caserne-de-la-porte-ouest", nom: "Caserne de la porte ouest", canon: "A", archetype: "caserne", position: c(10, 7), emprise_m: [60, 50], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D6D0C2", params: { cour: true, pente: 36 }, reperes_canon: ["Garnison aux portes (fichiers 01 et 11) : bâtiment adapté"] }),
        building({ id: "eglise", nom: "Église de Krolva", canon: "A", archetype: "eglise", position: c(4, 2), emprise_m: [22, 44], angle_deg: 0, hauteur_m: 18, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E2DACB", params: { clocher_m: 46, clocher_cote: 8.5, abside: true, pente: 50 } }),
        building({ id: "poste-porte-ouest", nom: "Poste de garde de la porte ouest", canon: "A", archetype: "caserne", position: pt(-66, 960), emprise_m: [26, 12], angle_deg: 0, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { pente: 40 } }),
      ];
    },
    vegetation(ctx, parcs) {
      return {
        alignements: [
          { rue: "axe-principal", essence: "tilleul", intervalle_m: 12, cotes: "deux" },
          { rue: "rue-du-mur", essence: "marronnier", intervalle_m: 15, cotes: "droite" },
          { rue: "chemin-du-rempart-est", essence: "peuplier", intervalle_m: 14, cotes: "deux" },
          { rue: "chemin-du-rempart-ouest", essence: "peuplier", intervalle_m: 14, cotes: "deux" },
          { rue: "route-interieure", essence: "peuplier", intervalle_m: 12, cotes: "deux" },
          { rue: "route-exterieure", essence: "peuplier", intervalle_m: 14, cotes: "deux" },
          { rue: `s-${S.findIndex(([v]) => v === sv(6))}`, essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: `s-${S.findIndex(([v]) => v === sv(12))}`, essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: `t-${T.findIndex(([v]) => v === tv(5))}`, essence: "marronnier", intervalle_m: 14, cotes: "deux" },
        ],
        isoles: [
          { position: pt(-170, 560), essence: "tilleul", hauteur_m: 22, nom: "Tilleul des Corporations" },
          { position: pt(150, 840), essence: "chene", hauteur_m: 24, nom: "Chêne de la porte ouest" },
          { position: pt(-60, 60), essence: "marronnier", hauteur_m: 17 },
          { position: pt(60, 60), essence: "marronnier", hauteur_m: 17 },
        ],
        parcs,
        vergers: [
          { polygone: pts([[-460, -60], [-320, -60], [-320, -560], [-460, -560]]), espacement_m: 8 },
          { polygone: pts([[320, -60], [460, -60], [460, -560], [320, -560]]), espacement_m: 8 },
        ],
        haies: [{ trace: pts([[-540, -610], [540, -610]]) }],
        potagers: [{ polygone: pts([[20, -330], [300, -330], [300, -560], [20, -560]]) }],
        essences_cours: ["tilleul", "marronnier", "erable", "fruitier"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-700, 300], [700, 300], [-300, 600], [250, 760], [-800, 700]]), fontaines: pts([[0, 465], [-380, 330]]) }),
    points_de_vue(ctx) {
      return baseViews(ctx, [
        { id: "place-des-corporations", nom: "Place des Corporations et maison des corporations", oeil: [190, 520, 2.4], cible: [-60, 420, 7], fov: 62 },
        { id: "quartier-des-forges", nom: "Grande forge et fonderie", oeil: [330, 310, 5], cible: [500, 430, 8], fov: 60 },
        { id: "quartier-des-tanneurs", nom: "Tannerie et halle des verriers", oeil: [-250, 300, 5], cible: [-420, 400, 8], fov: 60 },
        { id: "porte-ouest", nom: "Caserne et poste de la porte ouest", oeil: [190, 800, 3.5], cible: [-60, 950, 10], fov: 62 },
      ]);
    },
    etats(ctx) {
      void ctx;
      const etats: Place["etats"] = [
        { id: "845-avant", nom: "845, Krolva en temps ordinaire", date: "845", canon: "A", sources: [{ ref: "état ordinaire du district (adaptation)", canon: "A" }], portes: {}, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 1 },
        {
          id: "850-afflux-des-evacues",
          nom: "850, afflux des évacués de Trost",
          date: "850",
          canon: "A",
          sources: [
            { ref: "docs/spec/01 (850 : Trost, 104e promotion) : le sud du mur Rose est évacué vers l'intérieur [C] ; destination des évacués dans ce district : adaptation", canon: "A" },
            { ref: "affluence, brume : adaptation (aucune destruction : le district n'est pas touché)", canon: "A" },
          ],
          portes: {},
          ruines: [],
          incendies: [],
          rochers: [],
          abandon: 0,
          ciel: "brumeux",
          habitants: 1,
        },
      ];
      return etats;
    },
    portes: (_ctx, gate) => [
      gate({
        id: "exterieure",
        nom: "Porte de Krolva (porte ouest)",
        role: "exterieure",
        trace: "saillie",
        s_m: Math.round(((990 * 90 * Math.PI) / 180) * 10) / 10,
        canon: "A",
        sources: [{ ref: "docs/spec/01 §3.1 : saillie à deux portes pour les districts [C] ; nom de la porte et dimensions : aucune source (Q5)", canon: "A" }],
      }),
      gate({
        id: "interieure",
        nom: "Porte intérieure de Krolva",
        role: "interieure",
        trace: "mur-centre",
        s_m: 990,
        passage: { largeur_m: 12, hauteur_m: 17, voute: "plein_cintre", trous_assassin: 4, rainures: true, canon: "A" },
        vantail: { type: "battants", largeur_m: 12.4, hauteur_m: 16, epaisseur_m: 0.8, materiau: "chene_ferre", canon: "A" },
        structure: { huisserie: true, gonds: 4, treuils: 1, contrepoids: 0, herse: true, canon: "A" },
        tours: [
          { type: "poste_de_garde", cote: "gauche", hauteur_m: 6, canon: "A" },
          { type: "poste_de_garde", cote: "droite", hauteur_m: 6, canon: "A" },
        ],
        portail: "pilastres",
      }),
    ],
  });
}
