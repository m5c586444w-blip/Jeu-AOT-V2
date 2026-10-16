import type { Gabarit, Place } from "../../../data/placeSchema";
import { pt } from "./kit";
import { BASE_GABARITS, baseViews, pts } from "./maria";
import { authored, building, buildSaillie, cellKey, claimRect, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * Karanes (C15, tranche 1) — district est du mur Rose, plan d'auteur. Établi [C] : district est de Wall Rose, bâti dans une saillie du
 * mur à deux portes (fichiers 01 §3.1 et 11 §2, atlas 06 S02 et W03), ressource clé : le commerce, départ des expéditions du Bataillon d'exploration
 * (atlas 06 : « départ des expéditions » ; `expedition_base: prov_karanes` au scénario 845). Karanes est transcrit « Calaneth » dans
 * certaines versions (01 §3.1). Tout le reste est une adaptation [A] : tracé, noms, dimensions, quartiers, gabarits.
 *
 * Parti d'auteur [A] : ville de commerce et de caravanes de l'est — damier irrégulier aux îlots variés, Grand-Chemin des Départs de
 * la porte extérieure (porte de départ des expéditions) à la porte intérieure, place des Départs (rassemblement des colonnes) au pied
 * de la porte extérieure, marché aux caravanes et halle des marchands à l'est de l'axe, entrepôts et relais de poste à l'ouest, église
 * et maison des Poids et Mesures près de l'axe. Population : celle de `prov_karanes` (60 870 au scénario 845), 92 % intra-muros, 8 %
 * au faubourg de la porte intérieure.
 */
const S = authored([-1380, -1270, -1150, -1030, -920, -800, -690, -570, -450, -340, -220, -110, 0, 110, 230, 350, 470, 580, 700, 810, 930, 1050, 1160, 1280, 1390], 9, { [-920]: 12, 930: 12, [-450]: 14, 470: 14, [-1150]: 5, 1160: 5, [-110]: 5 });
const T = authored([25, 130, 240, 350, 460, 570, 690, 800, 910, 1020, 1130, 1240, 1350], 9, { 350: 12, 690: 12, 1020: 12, 570: 5, 1240: 5 });

const GABARITS: Record<string, Gabarit> = {
  centre: BASE_GABARITS.centre as Gabarit,
  ouvrier: BASE_GABARITS.ouvrier as Gabarit,
  faubourg: { ...(BASE_GABARITS.faubourg as Gabarit), cour: { type: "jardin", arbres_par_ha: 70 } },
  garnison: BASE_GABARITS.garnison as Gabarit,
  negoce: { etages: [3, 4, 3, 3], hauteur_etage_m: 3.2, toits: ["pignon_rue", "croupe", "pignon_rue", "mansarde"], pente_deg: [42, 54], couvertures: ["tuile_plate", "ardoise", "tuile_plate", "tuile_canal"], facades: ["enduit", "pierre_taillee", "colombage", "brique"], teintes: ["#EBDCC0", "#E2CCA6", "#EDD6BE", "#DDD6BE", "#E6D8B8", "#D9C29C"], parcelles_m: [8, 10, 7, 9.5], profondeur_m: 14, boutiques: true, passage_m: 36, cour: { type: "plantee", arbres_par_ha: 75 } },
  relais: { etages: [2, 2, 3, 2], hauteur_etage_m: 3.6, toits: ["pignon", "croupe", "appentis", "demi_croupe"], pente_deg: [36, 48], couvertures: ["tuile_canal", "tuile_plate", "bardeau", "tuile_plate"], facades: ["pierre_brute", "bois", "enduit", "colombage"], teintes: ["#D2C4A6", "#C7B898", "#DCCFB2", "#C2B394"], parcelles_m: [14, 20, 12, 18], profondeur_m: 16, boutiques: false, passage_m: 36, cour: { type: "pavee", arbres_par_ha: 40 } },
};

const Q = {
  centre: quarter("vieux-karanes", "Vieux Karanes", "centre", "habitation"),
  negoce: quarter("quartier-du-negoce", "Quartier du Négoce", "negoce", "marche", 0.95),
  relais: quarter("quartier-des-relais", "Quartier des Relais et des Entrepôts", "relais", "entrepot", 0.8),
  departs: quarter("quartier-des-departs", "Quartier des Départs", "garnison", "caserne", 0.7),
  ouvrier: quarter("quartier-des-chartiers", "Quartier des Chartiers (charretiers et portefaix)", "ouvrier", "habitation", 0.95),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, -220, 230, 1130, 1240, { kind: "place", id: "place-des-departs", nom: "Place des Départs", revetement: "terre", fontaine: false, marche: false });
claimRect(claims, S, T, 350, 700, 690, 910, { kind: "place", id: "marche-aux-caravanes", nom: "Marché aux caravanes", revetement: "paves", fontaine: true, marche: true });
claimRect(claims, S, T, 110, 230, 240, 350, { kind: "place", id: "parvis-de-l-eglise", nom: "Parvis de l'église", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, -690, -570, 910, 1020, { kind: "place", id: "place-du-relais", nom: "Place du Relais", revetement: "terre", fontaine: true, marche: false });
claimRect(claims, S, T, -800, -690, 240, 350, { kind: "parc", id: "jardin-du-caravanserail", nom: "Jardin du Caravansérail", essences: ["tilleul", "marronnier", "fruitier"], arbres_par_ha: 75 });
claimRect(claims, S, T, 580, 810, 350, 460, { kind: "parc", id: "promenade-des-chartiers", nom: "Promenade des Chartiers", essences: ["tilleul", "peuplier", "erable"], arbres_par_ha: 65 });
claimRect(claims, S, T, 470, 700, 1020, 1130, { kind: "parc", id: "jardin-des-expeditions", nom: "Jardin des Expéditions", essences: ["pin", "tilleul", "bouleau"], arbres_par_ha: 55 });
claims[cellKey(S, T, 110, 240)] = { kind: "ilot", fonction: "culte", densite: 0.55, quartier: Q.centre.id, gabarit: "centre" };

/** Noms de rues de Karanes : tous créés [A]. */
const NOMS_S = [
  "Rue des Caravaniers", "Rue des Chameliers", "Rue des Muletiers", "Rue des Portefaix", "Rue des Chartiers", "Rue des Rouliers", "Rue des Postillons", "Rue du Relais", "Rue des Courtiers", "Rue des Changeurs",
  "Rue des Pesées", "Rue des Peseurs", "Rue des Étoffes", "Rue des Teinturiers", "Rue des Fourreurs", "Rue des Épiciers", "Rue des Parfumeurs", "Rue des Tapissiers", "Rue des Verriers", "Rue des Cartographes",
  "Rue des Interprètes", "Rue du Négoce", "Rue des Ballots", "Rue des Barils",
];
const NOMS_T = [
  "Rue du Départ", "Rue des Éclaireurs", "Rue des Provisions", "Rue de la Douane", "Rue du Poids Public", "Rue des Enseignes", "Rue des Étals", "Rue du Marché aux Chevaux", "Rue des Sacs", "Rue des Écritures",
  "Rue des Étapes", "Rue du Rempart",
];

export function karanes(): Place {
  const base = buildSaillie({
    id: "karanes",
    nom: "Karanes",
    libelle: "Karanes",
    canon: "C",
    sources: [
      { ref: "docs/spec/01 §3.1 et docs/spec/11 §2 : Karanes (est), district du mur Rose ; transcrit « Calaneth » dans certaines versions ; docs/spec/06 (S02, W03) : district est, départ des expéditions, porte de Karanes", canon: "C" },
      { ref: "data/scenarios/sandbox_845.json : expedition_base = prov_karanes ; docs/spec/20 (LC-B) : districts du mur Rose [C], détails [A]", canon: "C" },
      { ref: "tracé de la saillie, noms de rues, de places et de bâtiments, dimensions, quartiers : adaptation (création C15, `docs/lore/creations.md`)", canon: "A" },
    ],
    province: "prov_karanes",
    style: "E01",
    mur: "rose",
    population: { province: "prov_karanes", part: 0.92, canon: "C", note: "92 % de la population de `prov_karanes` au départ de scn_sandbox_845 (60 870 hab.) logés intra-muros ; la province existe [C], la part est adaptée [A]." },
    densite: { classe: "coeur", valeur: 210, canon: "A" },
    orientation: { valeur: "est", canon: "C" },
    R: 1370,
    grid: { rot: 0, s: S, t: T },
    main: { nom: "Grand-Chemin des Départs", largeur_m: 18 },
    names: {
      s: NOMS_S,
      t: NOMS_T,
      lanes: ["Ruelle des Mules", "Ruelle du Lasso", "Ruelle des Balles", "Ruelle des Lanternes"],
      placettes: ["Place des Interprètes", "Placette du Poids", "Place des Chartiers", "Placette des Épices", "Place des Muletiers"],
    },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      const r = Math.hypot(c[0], c[1]);
      if (c[1] > 1100 && Math.abs(c[0]) < 520) return Q.departs.id;
      if (c[0] > 0 && c[0] < 900 && c[1] > 500 && c[1] < 1100) return Q.negoce.id;
      if (c[0] < -300 && c[1] > 700) return Q.relais.id;
      if (r < 560) return Q.centre.id;
      if (Math.abs(c[0]) > 800) return Q.ouvrier.id;
      return Q.centre.id;
    },
    claims,
    placettes: [cellKey(S, T, -1030, 460), cellKey(S, T, 1050, 570), cellKey(S, T, -340, 800), cellKey(S, T, 470, 1130), cellKey(S, T, -220, 460)],
    faubourg: {
      nom: "Faubourg de la porte intérieure",
      population: { province: "prov_karanes", part: 0.08, canon: "A", note: "8 % de la population de `prov_karanes` au départ de scn_sandbox_845 logés au pied de la porte intérieure, côté intérieur des terres (adaptation)." },
      densite: { classe: "faubourg", valeur: 62, canon: "A" },
      xs: [-630, -420, -210, 0, 210, 420, 630, 840],
      ys: [-30, -170, -310, -450, -590],
      gabarit: "faubourg",
      quarter: quarter("faubourg-de-la-porte-interieure", "Faubourg de la porte intérieure", "faubourg", "habitation", 0.55),
      names: ["Chemin des Prés", "Chemin des Mulets", "Chemin des Haies", "Chemin des Ruches", "Chemin du Gué", "Chemin des Vergers", "Chemin de la Mare", "Chemin des Saules", "Chemin des Ormes", "Chemin du Glacis", "Chemin des Champs"],
    },
    canons_m: 28,
    batiments(ctx) {
      const c = (s: number, t: number): [number, number] => ctx.cell(S.findIndex(([v]) => v === s), T.findIndex(([v]) => v === t));
      return [
        building({ id: "depot-des-expeditions", nom: "Dépôt des expéditions", canon: "A", archetype: "entrepot", position: c(-450, 1130), emprise_m: [60, 26], angle_deg: 0, hauteur_m: 10, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#C9BFA9", params: { pente: 36 }, reperes_canon: ["Karanes, départ des expéditions [C] (atlas 06 S02) : le dépôt est une adaptation"] }),
        building({ id: "ecuries-des-expeditions", nom: "Écuries des expéditions", canon: "A", archetype: "ecurie", position: c(-450, 1240), emprise_m: [56, 20], angle_deg: 0, hauteur_m: 8, etages: 1, toit: "pignon", couverture: "tuile_plate", facade: "bois", teinte: "#BCA682", params: { pente: 38 } }),
        building({ id: "caserne-de-la-porte-de-depart", nom: "Caserne de la porte de départ", canon: "A", archetype: "caserne", position: c(350, 1130), emprise_m: [60, 50], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D6D0C2", params: { cour: true, pente: 36 }, reperes_canon: ["Garnison aux portes (fichiers 01 et 11) : bâtiment adapté"] }),
        building({ id: "halle-des-marchands", nom: "Halle des marchands", canon: "A", archetype: "halle", position: pt(450, 800), emprise_m: [52, 24], angle_deg: 0, hauteur_m: 12, etages: 1, toit: "croupe", couverture: "tuile_plate", facade: "bois", teinte: "#C8B088", params: { piliers: 10, pente: 40 }, reperes_canon: ["bld_marche dans prov_karanes (data/scenarios/sandbox_845.json)"] }),
        ...[[380, 730], [520, 730], [640, 730], [380, 870], [520, 870], [640, 870]].map(([x, y], k) =>
          building({ id: `etal-${k + 1}`, nom: `Étal de caravane ${k + 1}`, canon: "A", archetype: "halle", position: pt(x as number, y as number), emprise_m: [14, 7], angle_deg: 0, hauteur_m: 5, etages: 1, toit: "appentis", couverture: "tuile_canal", facade: "bois", teinte: "#C2A57E", params: { piliers: 4, pente: 30 } }),
        ),
        building({ id: "maison-des-poids-et-mesures", nom: "Maison des Poids et Mesures", canon: "A", archetype: "hotel_de_ville", position: c(-110, 460), emprise_m: [28, 16], angle_deg: 0, hauteur_m: 13, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 48 } }),
        building({ id: "caravanserail", nom: "Caravansérail du Nord-Est", canon: "A", archetype: "ecurie", position: c(-800, 240), emprise_m: [48, 24], angle_deg: 0, hauteur_m: 9, etages: 2, toit: "pignon", couverture: "tuile_canal", facade: "pierre_brute", teinte: "#CDBE9E", params: { pente: 34 } }),
        building({ id: "entrepot-du-negoce", nom: "Grand entrepôt du négoce", canon: "A", archetype: "entrepot", position: c(-570, 800), emprise_m: [58, 24], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "tuile_plate", facade: "brique", teinte: "#C8B8A0", params: { pente: 40 } }),
        building({ id: "eglise", nom: "Église de Karanes", canon: "A", archetype: "eglise", position: c(110, 240), emprise_m: [22, 44], angle_deg: 0, hauteur_m: 18, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E2DACB", params: { clocher_m: 48, clocher_cote: 8.5, abside: true, pente: 50 } }),
        building({ id: "poste-porte-de-depart", nom: "Poste de garde de la porte de départ", canon: "A", archetype: "caserne", position: pt(-66, 1300), emprise_m: [26, 12], angle_deg: 0, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { pente: 40 } }),
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
          { rue: `s-${S.findIndex(([v]) => v === -450)}`, essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: `s-${S.findIndex(([v]) => v === 470)}`, essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: `t-${T.findIndex(([v]) => v === 690)}`, essence: "marronnier", intervalle_m: 14, cotes: "deux" },
        ],
        isoles: [
          { position: pt(-150, 1180), essence: "chene", hauteur_m: 24, nom: "Chêne des Départs" },
          { position: pt(640, 700), essence: "tilleul", hauteur_m: 21, nom: "Tilleul du marché aux caravanes" },
          { position: pt(-60, 60), essence: "marronnier", hauteur_m: 17 },
          { position: pt(60, 60), essence: "marronnier", hauteur_m: 17 },
        ],
        parcs,
        vergers: [
          { polygone: pts([[-620, -60], [-440, -60], [-440, -560], [-620, -560]]), espacement_m: 8 },
          { polygone: pts([[440, -60], [620, -60], [620, -560], [440, -560]]), espacement_m: 8 },
        ],
        haies: [{ trace: pts([[-650, -610], [860, -610]]) }],
        potagers: [{ polygone: pts([[20, -330], [400, -330], [400, -560], [20, -560]]) }],
        essences_cours: ["tilleul", "marronnier", "erable", "fruitier"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-900, 300], [900, 300], [-300, 700], [200, 1000], [-1000, 1000]]), fontaines: pts([[525, 800], [-630, 965]]) }),
    points_de_vue(ctx) {
      return baseViews(ctx, [
        { id: "place-des-departs", nom: "Place des Départs et porte de départ", oeil: [190, 1150, 3], cible: [-60, 1290, 12], fov: 62 },
        { id: "marche-aux-caravanes", nom: "Marché aux caravanes et halle des marchands", oeil: [660, 790, 2.4], cible: [450, 800, 7], fov: 60 },
        { id: "depot-des-expeditions", nom: "Dépôt et écuries des expéditions", oeil: [-250, 1090, 6], cible: [-450, 1180, 7], fov: 60 },
        { id: "quartier-du-negoce", nom: "Rue du Négoce", oeil: [-110, 560, 1.7], cible: [-110, 900, 6], fov: 62 },
      ]);
    },
    etats(ctx) {
      void ctx;
      const etats: Place["etats"] = [
        { id: "845-avant", nom: "845, Karanes en temps ordinaire", date: "845", canon: "A", sources: [{ ref: "état ordinaire du district (adaptation)", canon: "A" }], portes: {}, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 1 },
        {
          id: "850-depart-expedition",
          nom: "850, matin d'un départ d'expédition",
          date: "850",
          canon: "A",
          sources: [
            { ref: "docs/spec/01 (850 : Expédition 57) ; docs/spec/06 S02 : départ des expéditions à Karanes [C]", canon: "C" },
            { ref: "affluence, brume du matin : adaptation (aucune destruction : le district n'est pas touché)", canon: "A" },
          ],
          portes: {},
          ruines: [],
          incendies: [],
          rochers: [],
          abandon: 0,
          ciel: "brumeux",
          habitants: 0.6,
        },
      ];
      return etats;
    },
    portes: (_ctx, gate) => [
      gate({
        id: "exterieure",
        nom: "Porte de Karanes (porte de départ des expéditions)",
        role: "exterieure",
        trace: "saillie",
        s_m: Math.round(((1370 * 90 * Math.PI) / 180) * 10) / 10,
        canon: "C",
        sources: [{ ref: "docs/spec/06 W03 : porte de Karanes [C] ; S02 : départ des expéditions [C]", canon: "C" }, { ref: "dimensions et mécanisme : aucune source (Q5)", canon: "A" }],
      }),
      gate({
        id: "interieure",
        nom: "Porte intérieure de Karanes",
        role: "interieure",
        trace: "mur-centre",
        s_m: 1370,
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
  return base;
}
