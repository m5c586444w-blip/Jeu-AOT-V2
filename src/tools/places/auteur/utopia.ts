import type { Gabarit, Place } from "../../../data/placeSchema";
import { pt } from "./kit";
import { BASE_GABARITS, baseViews, pts } from "./maria";
import { building, buildSaillie, cellKey, claimRect, lines, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * Utopia (C15, tranche 2) — district nord du mur Rose, plan d'auteur. Établi [C] : district nord de Wall Rose, bâti dans une saillie
 * du mur à deux portes (fichiers 01 §3.1 et 11 §2, atlas 06 S03 : « Commerce », rang 3). Tout le reste est une adaptation [A] :
 * tracé, noms de rues, de places et de bâtiments, dimensions, quartiers, gabarits.
 *
 * Parti d'auteur [A] : ville de foires et de bourse des grains du nord de l'intérieur — damier régulier de 105 m sur 102 m, Grande
 * Avenue du Nord de la porte extérieure à la porte intérieure, vaste place de la Foire au milieu de l'axe, place de la Bourse des
 * grains au nord, halle aux grains et entrepôts à l'ouest du marché, quartier des Minotiers à l'est, caserne de la porte nord
 * contre la porte extérieure. Population : celle de `prov_utopia` (34 783 au scénario 845), 92 % intra-muros, 8 % au faubourg.
 */
const S = lines(-1050, 1050, 105, 9, { 3: 5, 5: 12, 15: 12, 17: 5, 7: 12, 13: 12 });
const T = lines(25, 943, 102, 9, { 2: 12, 6: 12 });
const sv = (k: number): number => -1050 + 105 * k;
const tv = (k: number): number => 25 + 102 * k;

const GABARITS: Record<string, Gabarit> = {
  centre: BASE_GABARITS.centre as Gabarit,
  ouvrier: BASE_GABARITS.ouvrier as Gabarit,
  faubourg: { ...(BASE_GABARITS.faubourg as Gabarit), cour: { type: "jardin", arbres_par_ha: 70 } },
  garnison: BASE_GABARITS.garnison as Gabarit,
  foires: { etages: [3, 3, 4, 3], hauteur_etage_m: 3.2, toits: ["pignon_rue", "croupe", "pignon_rue", "mansarde"], pente_deg: [42, 54], couvertures: ["tuile_plate", "ardoise", "tuile_plate", "bardeau"], facades: ["colombage", "enduit", "pierre_taillee", "brique"], teintes: ["#EBDCC0", "#E2CCA6", "#EDD6BE", "#DDD6BE", "#E6D8B8", "#D9C29C"], parcelles_m: [8, 9.5, 7, 10], profondeur_m: 14, boutiques: true, passage_m: 36, cour: { type: "plantee", arbres_par_ha: 80 } },
  grains: { etages: [2, 3, 3, 2], hauteur_etage_m: 3.7, toits: ["croupe", "pignon", "demi_croupe", "pignon"], pente_deg: [34, 46], couvertures: ["tuile_plate", "ardoise", "tuile_plate", "tuile_canal"], facades: ["pierre_brute", "brique", "bois", "pierre_brute"], teintes: ["#CFC3AA", "#C6BA9F", "#D4C8B0", "#C1B59A"], parcelles_m: [18, 24, 16, 22], profondeur_m: 18, boutiques: false, passage_m: 48, cour: { type: "pavee", arbres_par_ha: 45 } },
};

const Q = {
  centre: quarter("vieil-utopia", "Vieil Utopia", "centre", "habitation"),
  foires: quarter("quartier-des-foires", "Quartier des Foires", "foires", "marche", 0.95),
  grains: quarter("quartier-des-grains", "Quartier des Grains et des Minotiers", "grains", "entrepot", 0.85),
  garnison: quarter("quartier-de-la-porte-nord", "Quartier de la Porte Nord", "garnison", "caserne", 0.7),
  ouvrier: quarter("quartier-des-bouviers", "Quartier des Bouviers et des Colporteurs", "ouvrier", "habitation", 0.95),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(8), sv(12), tv(5), tv(7), { kind: "place", id: "place-de-la-foire", nom: "Place de la Foire", revetement: "terre", fontaine: false, marche: true });
claimRect(claims, S, T, sv(11), sv(13), tv(2), tv(3), { kind: "place", id: "place-de-la-bourse", nom: "Place de la Bourse des grains", revetement: "paves", fontaine: true, marche: false });
claimRect(claims, S, T, sv(7), sv(8), tv(3), tv(4), { kind: "place", id: "parvis-de-l-eglise", nom: "Parvis de l'église", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, sv(3), sv(5), tv(3), tv(4), { kind: "parc", id: "jardin-des-halles", nom: "Jardin des Halles", essences: ["tilleul", "marronnier", "fruitier"], arbres_par_ha: 70 });
claimRect(claims, S, T, sv(15), sv(17), tv(6), tv(7), { kind: "parc", id: "promenade-des-foires", nom: "Promenade des Foires", essences: ["tilleul", "peuplier", "erable"], arbres_par_ha: 62 });
claimRect(claims, S, T, sv(5), sv(7), tv(7), tv(8), { kind: "parc", id: "jardin-de-la-porte-nord", nom: "Jardin de la Porte Nord", essences: ["pin", "tilleul", "bouleau"], arbres_par_ha: 55 });
claimRect(claims, S, T, sv(1), sv(3), tv(5), tv(6), { kind: "parc", id: "prairie-des-bouviers", nom: "Prairie des Bouviers", essences: ["saule", "peuplier", "tilleul"], arbres_par_ha: 50 });
claims[cellKey(S, T, sv(6), tv(3))] = { kind: "ilot", fonction: "culte", densite: 0.55, quartier: Q.centre.id, gabarit: "centre" };

/** Noms de rues d'Utopia : tous créés [A]. */
const NOMS_S = [
  "Rue des Grainetiers", "Rue des Minotiers", "Rue des Boisseaux", "Rue des Mesureurs", "Rue des Fariniers", "Rue des Bouviers", "Rue des Laitiers", "Rue des Fromagers", "Rue des Beurriers", "Rue des Lainiers",
  "Rue des Cardeurs", "Rue des Fileuses", "Rue des Palefreniers", "Rue des Maquignons", "Rue des Colporteurs", "Rue des Banquiers", "Rue des Hôteliers", "Rue des Foins", "Rue des Fourragers", "Rue des Tonneliers",
];
const NOMS_T = [
  "Rue de la Bourse", "Rue des Courtiers en Grains", "Rue de la Foire", "Rue des Forains", "Rue des Halles Neuves", "Rue des Étaleurs", "Rue des Crieurs", "Rue des Bateleurs", "Rue des Comptoirs", "Rue des Greniers",
];

export function utopia(): Place {
  return buildSaillie({
    id: "utopia",
    nom: "Utopia",
    libelle: "Utopia",
    canon: "C",
    sources: [
      { ref: "docs/spec/01 §3.1 et docs/spec/11 §2 : Utopia (nord), district du mur Rose ; docs/spec/06 S03 : district nord, ressource clé « commerce » (rang 3)", canon: "C" },
      { ref: "docs/spec/20 (LC-B) : districts du mur Rose [C], détails [A]", canon: "C" },
      { ref: "tracé de la saillie, noms de rues, de places et de bâtiments, dimensions, quartiers : adaptation (création C15, `docs/lore/creations.md`)", canon: "A" },
    ],
    province: "prov_utopia",
    style: "E04",
    mur: "rose",
    population: { province: "prov_utopia", part: 0.92, canon: "C", note: "92 % de la population de `prov_utopia` au départ de scn_sandbox_845 (34 783 hab.) logés intra-muros ; la province existe [C], la part est adaptée [A]." },
    densite: { classe: "coeur", valeur: 220, canon: "A" },
    orientation: { valeur: "nord", canon: "C" },
    R: 1040,
    grid: { rot: 0, s: S, t: T },
    main: { nom: "Grande Avenue du Nord", largeur_m: 18 },
    names: {
      s: NOMS_S,
      t: NOMS_T,
      lanes: ["Ruelle des Veaux", "Ruelle des Sacs", "Ruelle des Cloches", "Ruelle du Four"],
      placettes: ["Place des Bouviers", "Placette des Mesures", "Place des Colporteurs", "Placette du Foin"],
    },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      const r = Math.hypot(c[0], c[1]);
      if (c[1] > 830 && Math.abs(c[0]) < 520) return Q.garnison.id;
      if (Math.abs(c[0]) < 450 && c[1] > 300 && c[1] < 830) return Q.foires.id;
      if (c[0] < -250 && c[1] > 200 && c[1] < 800) return Q.grains.id;
      if (c[0] > 450 && c[1] > 300) return Q.grains.id;
      if (r < 480) return Q.centre.id;
      if (Math.abs(c[0]) > 700) return Q.ouvrier.id;
      return Q.centre.id;
    },
    claims,
    placettes: [cellKey(S, T, sv(1), tv(3)), cellKey(S, T, sv(18), tv(4)), cellKey(S, T, sv(3), tv(8)), cellKey(S, T, sv(16), tv(8))],
    faubourg: {
      nom: "Faubourg de la porte intérieure",
      population: { province: "prov_utopia", part: 0.08, canon: "A", note: "8 % de la population de `prov_utopia` au départ de scn_sandbox_845 logés au pied de la porte intérieure, côté intérieur des terres (adaptation)." },
      densite: { classe: "faubourg", valeur: 62, canon: "A" },
      xs: [-525, -350, -175, 0, 175, 350, 525],
      ys: [-30, -155, -280, -405, -530],
      gabarit: "faubourg",
      quarter: quarter("faubourg-de-la-porte-interieure", "Faubourg de la porte intérieure", "faubourg", "habitation", 0.55),
      names: ["Chemin des Prés", "Chemin des Bœufs", "Chemin des Haies", "Chemin des Ruches", "Chemin du Gué", "Chemin des Vergers", "Chemin de la Mare", "Chemin des Saules", "Chemin des Ormes", "Chemin du Glacis", "Chemin des Champs"],
    },
    canons_m: 30,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      return [
        building({ id: "halle-aux-grains", nom: "Halle aux grains", canon: "A", archetype: "halle", position: c(6, 5), emprise_m: [56, 26], angle_deg: 0, hauteur_m: 13, etages: 1, toit: "croupe", couverture: "tuile_plate", facade: "bois", teinte: "#C8B088", params: { piliers: 10, pente: 40 }, reperes_canon: ["Utopia, ressource clé : commerce [C] (atlas 06 S03) : la halle est une adaptation"] }),
        building({ id: "bourse-des-grains", nom: "Bourse des grains", canon: "A", archetype: "hotel_de_ville", position: c(12, 2), emprise_m: [34, 18], angle_deg: 0, hauteur_m: 14, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 48 } }),
        ...[[-150, 540], [-60, 540], [30, 540], [120, 540], [-150, 700], [-60, 700], [30, 700], [120, 700]].map(([x, y], k) =>
          building({ id: `etal-${k + 1}`, nom: `Étal de foire ${k + 1}`, canon: "A", archetype: "halle", position: pt(x as number, y as number), emprise_m: [14, 7], angle_deg: 0, hauteur_m: 5, etages: 1, toit: "appentis", couverture: "tuile_canal", facade: "bois", teinte: "#C2A57E", params: { piliers: 4, pente: 30 } }),
        ),
        building({ id: "grenier-d-utopia", nom: "Grenier d'Utopia", canon: "A", archetype: "grenier", position: c(4, 5), emprise_m: [46, 22], angle_deg: 0, hauteur_m: 15, etages: 4, toit: "croupe", couverture: "tuile_plate", facade: "pierre_brute", teinte: "#CFC2A8", params: { pente: 46 } }),
        building({ id: "moulin-des-minotiers", nom: "Moulin des Minotiers", canon: "A", archetype: "moulin", position: c(17, 4), emprise_m: [12, 12], angle_deg: 0, hauteur_m: 16, etages: 3, toit: "pavillon", couverture: "bardeau", facade: "pierre_brute", teinte: "#D2C6AE" }),
        building({ id: "entrepot-des-farines", nom: "Entrepôt des farines", canon: "A", archetype: "entrepot", position: c(16, 5), emprise_m: [52, 24], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "brique", teinte: "#C8B8A0", params: { pente: 40 } }),
        building({ id: "caserne-de-la-porte-nord", nom: "Caserne de la porte nord", canon: "A", archetype: "caserne", position: c(8, 8), emprise_m: [60, 50], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D6D0C2", params: { cour: true, pente: 36 }, reperes_canon: ["Garnison aux portes (fichiers 01 et 11) : bâtiment adapté"] }),
        building({ id: "hotel-de-ville", nom: "Hôtel de ville d'Utopia", canon: "A", archetype: "hotel_de_ville", position: c(10, 1), emprise_m: [30, 18], angle_deg: 0, hauteur_m: 14, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 48 } }),
        building({ id: "eglise", nom: "Église d'Utopia", canon: "A", archetype: "eglise", position: c(6, 3), emprise_m: [22, 44], angle_deg: 0, hauteur_m: 18, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E2DACB", params: { clocher_m: 48, clocher_cote: 8.5, abside: true, pente: 50 } }),
        building({ id: "poste-porte-nord", nom: "Poste de garde de la porte nord", canon: "A", archetype: "caserne", position: pt(-66, 1010), emprise_m: [26, 12], angle_deg: 0, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { pente: 40 } }),
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
          { rue: `s-${S.findIndex(([v]) => v === sv(5))}`, essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: `s-${S.findIndex(([v]) => v === sv(15))}`, essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: `t-${T.findIndex(([v]) => v === tv(6))}`, essence: "marronnier", intervalle_m: 14, cotes: "deux" },
        ],
        isoles: [
          { position: pt(-170, 640), essence: "tilleul", hauteur_m: 22, nom: "Tilleul de la Foire" },
          { position: pt(150, 880), essence: "chene", hauteur_m: 24, nom: "Chêne de la porte nord" },
          { position: pt(-60, 60), essence: "marronnier", hauteur_m: 17 },
          { position: pt(60, 60), essence: "marronnier", hauteur_m: 17 },
        ],
        parcs,
        vergers: [
          { polygone: pts([[-480, -60], [-330, -60], [-330, -560], [-480, -560]]), espacement_m: 8 },
          { polygone: pts([[330, -60], [480, -60], [480, -560], [330, -560]]), espacement_m: 8 },
        ],
        haies: [{ trace: pts([[-560, -610], [560, -610]]) }],
        potagers: [{ polygone: pts([[20, -330], [300, -330], [300, -560], [20, -560]]) }],
        essences_cours: ["tilleul", "marronnier", "erable", "fruitier"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-700, 300], [700, 300], [-300, 600], [250, 800], [-800, 700]]), fontaines: pts([[-100, 585], [420, 150]]) }),
    points_de_vue(ctx) {
      void ctx;
      return baseViews(ctx, [
        { id: "place-de-la-foire", nom: "Place de la Foire et étals", oeil: [190, 520, 2.4], cible: [-60, 620, 6], fov: 62 },
        { id: "bourse-des-grains", nom: "Place de la Bourse des grains", oeil: [350, 170, 3], cible: [210, 280, 10], fov: 60 },
        { id: "quartier-des-grains", nom: "Halle aux grains et entrepôts", oeil: [-350, 460, 6], cible: [-420, 600, 8], fov: 60 },
        { id: "porte-nord", nom: "Caserne et poste de la porte nord", oeil: [190, 850, 3.5], cible: [-60, 1000, 10], fov: 62 },
      ]);
    },
    etats(ctx) {
      void ctx;
      const etats: Place["etats"] = [
        { id: "845-avant", nom: "845, Utopia en temps ordinaire", date: "845", canon: "A", sources: [{ ref: "état ordinaire du district (adaptation)", canon: "A" }], portes: {}, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 1 },
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
        nom: "Porte d'Utopia (porte nord)",
        role: "exterieure",
        trace: "saillie",
        s_m: Math.round(((1040 * 90 * Math.PI) / 180) * 10) / 10,
        canon: "A",
        sources: [{ ref: "docs/spec/01 §3.1 : saillie à deux portes pour les districts [C] ; nom de la porte et dimensions : aucune source (Q5)", canon: "A" }],
      }),
      gate({
        id: "interieure",
        nom: "Porte intérieure d'Utopia",
        role: "interieure",
        trace: "mur-centre",
        s_m: 1040,
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
