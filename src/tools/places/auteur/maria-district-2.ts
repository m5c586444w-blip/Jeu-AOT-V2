import type { Gabarit, Place } from "../../../data/placeSchema";
import { pt } from "./kit";
import { BASE_GABARITS, NOMS, SOURCES_MARIA, baseViews, mariaStates, pts } from "./maria";
import { authored, buildSaillie, building, cellKey, claimRect, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * District ouest du mur Maria (nom et position [?], Q1) — identité d'auteur [A] : district agricole et des greniers. Damier large
 * (îlots de 120 m sur 95 m) à grands jardins, quartier des greniers et foirail au pied de la porte extérieure (le grain et le
 * bétail entrent par là), halle aux grains sur la place du Grenier, quartier des bouviers à l'ouest (fermes urbaines,
 * granges), quartier des meuniers à l'est, faubourg de fermes et de vergers derrière la porte intérieure.
 * Population, densité, rayon : [?] / [A] (Q4, Q8).
 */
const S = authored([-1440, -1320, -1195, -1075, -950, -830, -705, -585, -470, -350, -235, -120, 0, 120, 240, 355, 470, 590, 710, 830, 950, 1075, 1195, 1320, 1440], 9, { [-950]: 11, 950: 11, [-470]: 12, 470: 12, [-1195]: 4.5, 1195: 4.5, [-705]: 5, 710: 5 });
const T = authored([25, 125, 220, 320, 415, 515, 610, 710, 805, 905, 1000, 1100, 1195, 1290, 1400], 9, { 515: 12, 1000: 12, 805: 5 });

const GABARITS: Record<string, Gabarit> = {
  centre: BASE_GABARITS.centre as Gabarit,
  ouvrier: BASE_GABARITS.ouvrier as Gabarit,
  faubourg: { ...(BASE_GABARITS.faubourg as Gabarit), cour: { type: "jardin", arbres_par_ha: 70 } },
  garnison: BASE_GABARITS.garnison as Gabarit,
  greniers: { etages: [2, 3, 3, 2], hauteur_etage_m: 3.8, toits: ["croupe", "pignon", "demi_croupe", "croupe"], pente_deg: [40, 52], couvertures: ["tuile_plate", "bardeau", "ardoise", "tuile_plate", "bardeau"], facades: ["bois", "pierre_brute", "colombage", "bois"], teintes: ["#CDBB9A", "#BFA984", "#D8C8A8", "#C4AE8C", "#D2C2A2"], parcelles_m: [18, 24, 16, 22, 20], profondeur_m: 18, boutiques: false, passage_m: 60, cour: { type: "pavee", arbres_par_ha: 30 } },
  fermes: { etages: [1, 2, 2, 1, 2], hauteur_etage_m: 3, toits: ["pignon", "demi_croupe", "croupe", "pignon"], pente_deg: [45, 58], couvertures: ["chaume", "tuile_plate", "bardeau", "chaume", "tuile_canal"], facades: ["colombage", "bois", "pierre_brute", "enduit", "colombage"], teintes: ["#D6C7A6", "#CBB991", "#E0D2B4", "#C2B08C", "#D9CCAE"], parcelles_m: [14, 18, 11, 20, 16], profondeur_m: 12, boutiques: false, passage_m: 40, cour: { type: "jardin", arbres_par_ha: 95 } },
};

const Q = {
  bourg: quarter("vieux-bourg", "Vieux bourg", "centre", "habitation"),
  greniers: quarter("quartier-des-greniers", "Quartier des Greniers", "greniers", "entrepot", 0.85),
  bouviers: quarter("quartier-des-bouviers", "Quartier des Bouviers (fermes urbaines)", "fermes", "habitation", 0.75),
  meuniers: quarter("quartier-des-meuniers", "Quartier des Meuniers", "ouvrier", "atelier", 0.9),
  garnison: quarter("quartier-de-la-garde", "Quartier de la Garde", "garnison", "caserne", 0.7),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, 0, 240, 1000, 1195, { kind: "place", id: "foirail", nom: "Foirail", revetement: "terre", fontaine: true, marche: true });
claimRect(claims, S, T, -235, 0, 515, 610, { kind: "place", id: "place-du-grenier", nom: "Place du Grenier", revetement: "paves", fontaine: true, marche: true });
claimRect(claims, S, T, 120, 240, 220, 320, { kind: "place", id: "parvis-de-l-eglise", nom: "Parvis de l'église", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, -705, -585, 805, 905, { kind: "parc", id: "jardin-des-semences", nom: "Jardin des Semences", essences: ["fruitier", "tilleul", "erable"], arbres_par_ha: 80 });
claimRect(claims, S, T, 590, 710, 220, 320, { kind: "parc", id: "promenade-des-tilleuls", nom: "Promenade des Tilleuls", essences: ["tilleul", "marronnier"], arbres_par_ha: 65 });
claims[cellKey(S, T, 120, 320)] = { kind: "ilot", fonction: "culte", densite: 0.55 };

export function mariaDistrict2(): Place {
  return buildSaillie({
    id: "maria-district-2",
    nom: NOMS.ouest,
    libelle: NOMS.ouest,
    canon: "?",
    sources: SOURCES_MARIA,
    province: null,
    style: "E01",
    mur: "maria",
    population: { province: null, part: 1, valeur: 42000, canon: "?", note: "Valeur paramétrable (Q8) : aucun district de ce nom dans les données de simulation." },
    densite: { classe: "coeur", valeur: 165, canon: "A" },
    orientation: { valeur: "ouest", canon: "?" },
    R: 1340,
    grid: { rot: 0, s: S, t: T },
    main: { nom: "Grande Rue des Greniers", largeur_m: 18 },
    names: {
      s: ["Rue des Haras", "Rue des Vachers", "Rue de la Paille", "Rue des Granges", "Rue des Charretiers", "Rue des Bergers", "Rue des Laboureurs", "Rue du Fenil", "Rue des Semailles", "Rue des Fléaux", "Rue des Batteurs", "Rue du Pressoir", "Rue des Meules", "Rue des Moulins", "Rue de l'Avoine", "Rue du Seigle", "Rue des Bluteaux", "Rue des Boulangers", "Rue des Sacs"],
      t: ["Rue de la Herse", "Rue des Sillons", "Rue des Moissons", "Rue Traversière", "Grande Traverse", "Rue des Foins", "Rue du Grenier", "Rue des Vergers", "Rue des Étables", "Rue du Foirail", "Rue des Bœufs", "Rue des Remparts", "Rue Haute"],
      lanes: ["Ruelle des Poules", "Ruelle du Fumier", "Ruelle des Oies", "Ruelle de la Grange", "Ruelle du Puits", "Ruelle de l'Abreuvoir"],
      placettes: ["Place de l'Abreuvoir", "Placette du Puits", "Place aux Œufs", "Place des Charrettes"],
    },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      const r = Math.hypot(c[0], c[1]);
      if (c[1] > 1100 && c[0] > -480 && c[0] < -230) return Q.garnison.id;
      if (Math.abs(c[0]) < 360 && c[1] > 780) return Q.greniers.id;
      if (r < 540) return Q.bourg.id;
      if (c[0] < -360) return Q.bouviers.id;
      if (c[0] > 360) return Q.meuniers.id;
      return Q.bourg.id;
    },
    claims,
    placettes: [cellKey(S, T, -830, 415), cellKey(S, T, 830, 610), cellKey(S, T, -350, 905), cellKey(S, T, 590, 1000)],
    faubourg: {
      nom: "Faubourg des fermes",
      population: { province: null, part: 1, valeur: 6000, canon: "?", note: "Valeur paramétrable (Q8)." },
      densite: { classe: "faubourg", valeur: 70, canon: "A" },
      xs: [-840, -630, -420, -210, 0, 210, 420, 630, 840],
      ys: [-30, -170, -310, -450, -590],
      gabarit: "faubourg",
      quarter: quarter("faubourg-des-fermes", "Faubourg des fermes", "faubourg", "habitation", 0.55),
      names: ["Chemin des Prés", "Chemin du Lavoir", "Chemin des Haies", "Chemin des Ruches", "Chemin du Gué", "Chemin des Vergers", "Chemin de la Mare", "Chemin des Saules", "Chemin des Ormes", "Chemin du Glacis", "Chemin des Champs"],
    },
    batiments(ctx) {
      const c = (s: number, t: number): [number, number] => ctx.cell(S.findIndex(([v]) => v === s), T.findIndex(([v]) => v === t));
      return [
        building({ id: "eglise", nom: "Église du district", canon: "A", archetype: "eglise", position: c(120, 320), emprise_m: [22, 46], angle_deg: 0, hauteur_m: 18, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E2DACB", params: { clocher_m: 48, clocher_cote: 8.5, abside: true, pente: 50 } }),
        building({ id: "halle-aux-grains", nom: "Halle aux grains", canon: "A", archetype: "halle", position: pt(-117.5, 562.5), emprise_m: [48, 24], angle_deg: 0, hauteur_m: 12, etages: 1, toit: "croupe", couverture: "tuile_plate", facade: "bois", teinte: "#C8AE88", params: { piliers: 9, pente: 42 } }),
        building({ id: "grenier-du-district", nom: "Grenier du district", canon: "A", archetype: "grenier", position: c(0, 905), emprise_m: [40, 18], angle_deg: 0, hauteur_m: 14, etages: 4, toit: "croupe", couverture: "tuile_plate", facade: "pierre_brute", teinte: "#CFC2A8", params: { pente: 48 } }),
        building({ id: "grenier-des-dimes", nom: "Grenier des Dîmes", canon: "A", archetype: "grenier", position: c(120, 905), emprise_m: [34, 16], angle_deg: 0, hauteur_m: 13, etages: 3, toit: "demi_croupe", couverture: "tuile_plate", facade: "colombage", teinte: "#D4C3A0", params: { pente: 52 } }),
        building({ id: "grenier-de-reserve", nom: "Grenier de réserve", canon: "A", archetype: "grenier", position: c(-120, 1000), emprise_m: [36, 18], angle_deg: 90, hauteur_m: 13, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#C9BCA2", params: { pente: 46 } }),
        building({ id: "caserne-de-la-garde", nom: "Caserne de la Garde", canon: "A", archetype: "caserne", position: c(-470, 1100), emprise_m: [56, 44], angle_deg: 0, hauteur_m: 10, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D8D2C5", params: { cour: true, pente: 38 }, reperes_canon: ["Garnison aux portes (fichiers 01 et 11) : bâtiment adapté"] }),
        building({ id: "maison-commune", nom: "Maison commune", canon: "A", archetype: "hotel_de_ville", position: c(-120, 415), emprise_m: [28, 16], angle_deg: 0, hauteur_m: 13, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 48 } }),
        building({ id: "poste-porte-exterieure", nom: "Poste de garde de la porte extérieure", canon: "A", archetype: "caserne", position: pt(-62, 1238), emprise_m: [24, 12], angle_deg: 0, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { pente: 40 } }),
        building({ id: "grande-grange", nom: "Grande grange des bouviers", canon: "A", archetype: "grange", position: c(-830, 1000), emprise_m: [40, 18], angle_deg: 90, hauteur_m: 11, etages: 1, toit: "demi_croupe", couverture: "chaume", facade: "bois", teinte: "#B9A27E", params: { pente: 55 } }),
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
          { rue: `t-${T.findIndex(([v]) => v === 515)}`, essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: `s-${S.findIndex(([v]) => v === -470)}`, essence: "chene", intervalle_m: 16, cotes: "deux" },
          { rue: `s-${S.findIndex(([v]) => v === 470)}`, essence: "chene", intervalle_m: 16, cotes: "deux" },
        ],
        isoles: [
          { position: pt(-150, 590), essence: "tilleul", hauteur_m: 22, nom: "Tilleul de la place du Grenier" },
          { position: pt(60, 1180), essence: "chene", hauteur_m: 24, nom: "Chêne du Foirail" },
          { position: pt(200, 1020), essence: "marronnier", hauteur_m: 17 },
          { position: pt(-60, 60), essence: "marronnier", hauteur_m: 17 },
          { position: pt(60, 60), essence: "marronnier", hauteur_m: 17 },
        ],
        parcs,
        vergers: [
          { polygone: pts([[-1120, -60], [-860, -60], [-860, -600], [-1120, -600]]), espacement_m: 8 },
          { polygone: pts([[860, -60], [1120, -60], [1120, -600], [860, -600]]), espacement_m: 8 },
          { polygone: pts([[-620, -620], [-20, -620], [-20, -880], [-620, -880]]), espacement_m: 9 },
        ],
        haies: [{ trace: pts([[-1120, -610], [1120, -610]]) }, { trace: pts([[-1130, -60], [-1130, -610]]) }],
        potagers: [{ polygone: pts([[20, -620], [620, -620], [620, -880], [20, -880]]) }],
        essences_cours: ["fruitier", "tilleul", "chene", "erable"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-830, 470], [400, 760], [-500, 1150], [700, 980], [-250, 300]]), fontaines: pts([[-117.5, 590], [120, 1100]]) }),
    points_de_vue(ctx) {
      return baseViews(ctx, [
        { id: "place-du-grenier", nom: "Place du Grenier et halle aux grains", oeil: [-222, 598, 5], cible: [-110, 560, 6], fov: 60 },
        { id: "foirail", nom: "Foirail et greniers", oeil: [228, 1182, 6], cible: [60, 960, 8], fov: 60 },
        { id: "eglise", nom: "Parvis et église", oeil: [240, 230, 6], cible: [180, 360, 20], fov: 58 },
        { id: "quartier-des-bouviers", nom: "Rue du quartier des Bouviers", oeil: [-955, 700, 1.7], cible: [-955, 950, 6], fov: 62 },
      ]);
    },
    etats(ctx) {
      return mariaStates(ctx, [pts([[-300, 1100], [300, 1100], [300, 1290], [-300, 1290]])]);
    },
  });
}
