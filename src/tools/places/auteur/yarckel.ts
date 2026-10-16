import type { Place } from "../../../data/placeSchema";
import { pt } from "./kit";
import { baseViews, pts } from "./maria";
import { building, buildSaillie, cellKey, claimRect, lines, quarter } from "./saillie";
import type { Claim } from "./saillie";
import { GABARIT_ENTREPOTS, GABARIT_HOTELS, GABARIT_NEGOCE, etat845, faubourgPopulation, gabaritsSina, populationSina, portesSina, sourceSina, vegetationSina } from "./sina";

/**
 * Yarckel (C16, tranche 1) — district ouest du mur Sina, plan d'auteur. Établi [C] : district ouest de Wall Sina (atlas 06 I05, rang 3,
 * ressource clé « artisanat »). Tout le reste est une adaptation [A] : tracé, noms de rues, de places et de bâtiments, dimensions, quartiers.
 *
 * Parti d'auteur [A] : ville d'artisans d'art et de compagnons — damier régulier de 100 m, Grande Rue des Métiers de la porte extérieure à la
 * porte intérieure, cour des Métiers (halle et étals) à l'est de l'axe, place des Compagnons et maison des Compagnons au nord-ouest, ateliers
 * de menuiserie et de verrerie d'art, école d'apprentissage près de l'église, caserne de la porte ouest. Population : celle de `prov_yarckel`
 * (34 783 au scénario 845), 90 % intra-muros, 10 % au faubourg.
 */
const R = 1000;
const S = lines(-1000, 1000, 100, 9, { 2: 5, 4: 14, 7: 5, 13: 5, 16: 14, 18: 5 });
const T = lines(25, 925, 100, 9, { 2: 14, 5: 14, 7: 5 });
const sv = (k: number): number => -1000 + 100 * k;
const tv = (k: number): number => 25 + 100 * k;

const GABARITS = gabaritsSina({ negoce: GABARIT_NEGOCE, hotels: GABARIT_HOTELS, ateliers: GABARIT_ENTREPOTS });
const Q = {
  centre: quarter("vieux-yarckel", "Vieux Yarckel", "centre", "habitation"),
  metiers: quarter("quartier-des-metiers", "Quartier des Métiers", "negoce", "marche", 0.95),
  ateliers: quarter("quartier-des-ateliers", "Quartier des Ateliers", "ateliers", "atelier", 0.85),
  compagnons: quarter("quartier-des-compagnons", "Quartier des Compagnons", "hotels", "administration", 0.7),
  garnison: quarter("quartier-de-la-porte-ouest", "Quartier de la Porte Ouest", "garnison", "caserne", 0.7),
  ouvrier: quarter("quartier-des-apprentis", "Quartier des Apprentis et des Journaliers", "ouvrier", "habitation", 0.95),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(11), sv(14), tv(4), tv(6), { kind: "place", id: "cour-des-metiers", nom: "Cour des Métiers", revetement: "paves", fontaine: true, marche: true });
claimRect(claims, S, T, sv(6), sv(9), tv(2), tv(3), { kind: "place", id: "place-des-compagnons", nom: "Place des Compagnons", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, sv(4), sv(5), tv(3), tv(4), { kind: "place", id: "parvis-de-l-eglise", nom: "Parvis de l'église", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, sv(13), sv(15), tv(2), tv(3), { kind: "parc", id: "jardin-des-compagnons", nom: "Jardin des Compagnons", essences: ["tilleul", "marronnier", "fruitier"], arbres_par_ha: 70 });
claimRect(claims, S, T, sv(2), sv(4), tv(5), tv(6), { kind: "parc", id: "promenade-des-artisans", nom: "Promenade des Artisans", essences: ["tilleul", "peuplier", "erable"], arbres_par_ha: 62 });
claimRect(claims, S, T, sv(15), sv(17), tv(6), tv(7), { kind: "parc", id: "parc-des-carrieres", nom: "Parc des Carrières", essences: ["pin", "bouleau", "tilleul"], arbres_par_ha: 55 });
claimRect(claims, S, T, sv(6), sv(8), tv(7), tv(8), { kind: "parc", id: "jardin-de-la-porte-ouest", nom: "Jardin de la Porte Ouest", essences: ["pin", "tilleul", "bouleau"], arbres_par_ha: 55 });
claims[cellKey(S, T, sv(5), tv(3))] = { kind: "ilot", fonction: "culte", densite: 0.55, quartier: Q.centre.id, gabarit: "centre" };

const NOMS_S = [
  "Rue des Menuisiers", "Rue des Ébénistes", "Rue des Tourneurs", "Rue des Charrons", "Rue des Serruriers", "Rue des Ferronniers", "Rue des Verriers", "Rue des Vitriers", "Rue des Tailleurs de Pierre", "Rue des Sculpteurs",
  "Rue des Luthiers", "Rue des Horlogers", "Rue des Potiers", "Rue des Cordonniers", "Rue des Selliers", "Rue des Tapissiers", "Rue des Ciseleurs", "Rue des Doreurs", "Rue des Relieurs", "Rue des Graveurs",
];
const NOMS_T = ["Rue des Métiers", "Rue des Compagnons", "Rue de la Maîtrise", "Rue des Apprentis", "Rue du Chef-d'Œuvre", "Rue des Ateliers", "Rue des Jurandes", "Rue du Tour de France", "Rue de l'Équerre", "Rue de l'Ouest"];

export function yarckel(): Place {
  return buildSaillie({
    id: "yarckel",
    nom: "Yarckel",
    libelle: "Yarckel",
    canon: "C",
    sources: sourceSina("I05 (Yarckel : district ouest de Sina, rang 3, artisanat)", "Yarckel (ouest)", "tracé de la saillie, noms de rues, de places et de bâtiments, dimensions, quartiers"),
    province: "prov_yarckel",
    style: "E07",
    mur: "sina",
    population: populationSina("prov_yarckel", 34783, 0.9),
    densite: { classe: "coeur", valeur: 235, canon: "A" },
    orientation: { valeur: "ouest", canon: "C" },
    R,
    grid: { rot: 0, s: S, t: T },
    main: { nom: "Grande Rue des Métiers", largeur_m: 18 },
    names: {
      s: NOMS_S,
      t: NOMS_T,
      lanes: ["Ruelle des Copeaux", "Ruelle de l'Étau", "Ruelle des Gabarits", "Ruelle du Burin"],
      placettes: ["Place des Tourneurs", "Placette des Luthiers", "Place des Potiers", "Placette du Burin"],
    },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      const r = Math.hypot(c[0], c[1]);
      if (c[1] > 780 && Math.abs(c[0]) < 520) return Q.garnison.id;
      if (c[0] > 0 && c[0] < 500 && c[1] > 350 && c[1] < 750) return Q.metiers.id;
      if (c[0] > 500 && c[1] > 250) return Q.ateliers.id;
      if (c[0] < -250 && c[1] > 500 && c[1] < 800) return Q.ateliers.id;
      if (c[0] < 0 && c[0] > -600 && c[1] > 60 && c[1] < 330) return Q.compagnons.id;
      if (r < 460) return Q.centre.id;
      if (Math.abs(c[0]) > 700) return Q.ouvrier.id;
      return Q.centre.id;
    },
    claims,
    placettes: [cellKey(S, T, sv(1), tv(3)), cellKey(S, T, sv(17), tv(3)), cellKey(S, T, sv(3), tv(7)), cellKey(S, T, sv(14), tv(8))],
    faubourg: {
      nom: "Faubourg de la porte intérieure",
      population: faubourgPopulation("prov_yarckel", 34783, 0.1),
      densite: { classe: "faubourg", valeur: 80, canon: "A" },
      xs: [-495, -330, -165, 0, 165, 330, 495],
      ys: [-30, -150, -270, -390, -510],
      gabarit: "faubourg",
      quarter: quarter("faubourg-de-la-porte-interieure", "Faubourg de la porte intérieure", "faubourg", "habitation", 0.55),
      names: ["Chemin des Copeaux", "Chemin des Scieurs", "Chemin des Haies", "Chemin des Ruches", "Chemin du Gué", "Chemin des Vergers", "Chemin de la Mare", "Chemin des Saules", "Chemin des Ormes", "Chemin du Glacis", "Chemin des Champs"],
    },
    canons_m: 30,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      const hx = (sv(11) + sv(14)) / 2;
      return [
        building({ id: "halle-des-metiers", nom: "Halle des métiers", canon: "A", archetype: "halle", position: pt(hx, tv(5)), emprise_m: [60, 26], angle_deg: 0, hauteur_m: 13, etages: 1, toit: "croupe", couverture: "tuile_plate", facade: "bois", teinte: "#C8B088", params: { piliers: 10, pente: 40 }, reperes_canon: ["Yarckel, ressource clé : artisanat [C] (atlas 06 I05) : la halle est une adaptation"] }),
        ...[[-90, -34], [0, -34], [90, -34], [-90, 34], [0, 34], [90, 34]].map(([dx, dy], k) =>
          building({ id: `etal-${k + 1}`, nom: `Étal d'artisan ${k + 1}`, canon: "A", archetype: "halle", position: pt(hx + (dx as number), tv(5) + (dy as number)), emprise_m: [14, 7], angle_deg: 0, hauteur_m: 5, etages: 1, toit: "appentis", couverture: "tuile_canal", facade: "bois", teinte: "#C2A57E", params: { piliers: 4, pente: 30 } }),
        ),
        building({ id: "maison-des-compagnons", nom: "Maison des Compagnons", canon: "A", archetype: "hotel_de_ville", position: c(7, 1), emprise_m: [36, 20], angle_deg: 0, hauteur_m: 14, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 48 } }),
        building({ id: "atelier-de-menuiserie", nom: "Grand atelier de menuiserie", canon: "A", archetype: "atelier", position: c(15, 4), emprise_m: [60, 26], angle_deg: 0, hauteur_m: 10, etages: 2, toit: "pignon", couverture: "tuile_plate", facade: "brique", teinte: "#C4B49C", params: { pente: 36 } }),
        building({ id: "verrerie-d-art", nom: "Verrerie d'art", canon: "A", archetype: "atelier", position: c(16, 5), emprise_m: [50, 26], angle_deg: 0, hauteur_m: 11, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#CBBFA5", params: { pente: 38 } }),
        building({ id: "magasin-des-ebenistes", nom: "Magasin des ébénistes", canon: "A", archetype: "entrepot", position: c(4, 6), emprise_m: [56, 24], angle_deg: 0, hauteur_m: 10, etages: 2, toit: "croupe", couverture: "tuile_plate", facade: "brique", teinte: "#C8B8A0", params: { pente: 40 } }),
        building({ id: "eglise", nom: "Église de Yarckel", canon: "A", archetype: "eglise", position: c(5, 3), emprise_m: [22, 44], angle_deg: 0, hauteur_m: 18, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E2DACB", params: { clocher_m: 48, clocher_cote: 8.5, abside: true, pente: 50 } }),
        building({ id: "ecole-des-apprentis", nom: "École des apprentis", canon: "A", archetype: "ecole", position: c(14, 3), emprise_m: [44, 24], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "brique", teinte: "#D9CDB6", params: { pente: 42 } }),
        building({ id: "clinique-de-yarckel", nom: "Clinique de Yarckel", canon: "A", archetype: "clinique", position: c(12, 1), emprise_m: [40, 24], angle_deg: 0, hauteur_m: 12, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E1DACB", params: { pente: 44 } }),
        building({ id: "caserne-de-la-porte-ouest", nom: "Caserne de la porte ouest", canon: "A", archetype: "caserne", position: c(9, 8), emprise_m: [60, 50], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D6D0C2", params: { cour: true, pente: 36 }, reperes_canon: ["Garnison aux portes (fichiers 01 et 11) : bâtiment adapté"] }),
        building({ id: "poste-porte-ouest", nom: "Poste de garde de la porte ouest", canon: "A", archetype: "caserne", position: c(10, 8), emprise_m: [26, 12], angle_deg: 0, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { pente: 40 } }),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return vegetationSina(parcs, {
        xs: [-495, -330, -165, 0, 165, 330, 495],
        ys: [-30, -150, -270, -390, -510],
        alignements: [
          { rue: "s-4", essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: "s-16", essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: "t-2", essence: "tilleul", intervalle_m: 12, cotes: "deux" },
          { rue: "t-5", essence: "marronnier", intervalle_m: 14, cotes: "deux" },
        ],
        isoles: [
          { position: pt(-170, tv(4)), essence: "tilleul", hauteur_m: 22, nom: "Tilleul des Compagnons" },
          { position: pt(150, 900), essence: "chene", hauteur_m: 24, nom: "Chêne de la porte ouest" },
        ],
      });
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-700, 300], [700, 300], [-300, 600], [250, 700], [-800, 650]]), fontaines: pts([[(sv(11) + sv(14)) / 2, tv(5) - 50], [-570, 150]]) }),
    points_de_vue(ctx) {
      return baseViews(ctx, [
        { id: "cour-des-metiers", nom: "Cour des Métiers et halle", oeil: [sv(14) - 20, tv(4) + 20, 2.4], cible: [(sv(11) + sv(14)) / 2, tv(5) + 30, 7], fov: 62 },
        { id: "place-des-compagnons", nom: "Place des Compagnons", oeil: [-400, tv(3) + 40, 2.8], cible: [-420, tv(1) + 40, 9], fov: 60 },
        { id: "quartier-des-ateliers", nom: "Ateliers de menuiserie et de verrerie", oeil: [sv(15) - 40, tv(3), 6], cible: [sv(15) + 50, tv(5), 8], fov: 60 },
        { id: "porte-ouest", nom: "Caserne et poste de la porte ouest", oeil: [190, 800, 3.5], cible: [-60, 930, 10], fov: 62 },
      ]);
    },
    etats(ctx) {
      void ctx;
      return [
        etat845("845, Yarckel en temps ordinaire"),
        {
          id: "850-afflux-des-evacues",
          nom: "850, afflux des évacués",
          date: "850",
          canon: "A",
          sources: [
            { ref: "docs/spec/01 (850 : Trost, 104e promotion) : l'évacuation vers l'intérieur [C] ; accueil des évacués à Yarckel : adaptation", canon: "A" },
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
    },
    portes: (_ctx, gate) => portesSina(R, "Porte de Yarckel (porte ouest)", "Porte intérieure de Yarckel", gate),
  });
}
