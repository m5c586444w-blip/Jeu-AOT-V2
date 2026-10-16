import type { Place } from "../../../data/placeSchema";
import { pt } from "./kit";
import { baseViews, pts } from "./maria";
import { building, buildSaillie, cellKey, claimRect, lines, quarter } from "./saillie";
import type { Claim } from "./saillie";
import { GABARIT_ENTREPOTS, GABARIT_HOTELS, GABARIT_NEGOCE, NOMS_CHEMINS, etat845, faubourgPopulation, gabaritsSina, populationSina, portesSina, sourceSina, vegetationSina } from "./sina";

/**
 * Orvud (C16, tranche 1) — district nord du mur Sina, plan d'auteur. Établi [C] : district nord de Wall Sina (atlas 06 I04, rang 3,
 * ressource clé « commerce »), ravagé par le Titan de Rod Reiss en 850 (fichier 11 §2 ; fichier 12 E35 : Orvud ravagé). Tout le reste est
 * une adaptation [A] : tracé, noms, dimensions, quartiers, gabarits.
 *
 * Parti d'auteur [A] : ville planifiée de manufactures de drap du nord — damier large (120 m sur 90 m), Avenue du Drap de la porte extérieure
 * à la porte intérieure, esplanade de la Manufacture et halle des laines au milieu de l'axe, manufacture et grand entrepôt à l'est, place du
 * Conseil et hôtel de ville au nord-ouest, tour de l'Horloge près de l'église, caserne de la porte nord. Population : celle de `prov_orvud`
 * (34 783 au scénario 845), 92 % intra-muros, 8 % au faubourg. L'état 850 pose le ravage [C] ; son étendue est une adaptation [A].
 */
const R = 1080;
const S = lines(-1080, 1080, 120, 9, { 2: 5, 4: 14, 7: 5, 11: 5, 14: 14, 16: 5 });
const T = lines(25, 1015, 90, 9, { 4: 14, 8: 14, 6: 5 });
const sv = (k: number): number => -1080 + 120 * k;
const tv = (k: number): number => 25 + 90 * k;

const GABARITS = gabaritsSina({ negoce: GABARIT_NEGOCE, hotels: GABARIT_HOTELS, entrepots: GABARIT_ENTREPOTS });
const Q = {
  centre: quarter("vieil-orvud", "Vieil Orvud", "centre", "habitation"),
  manufactures: quarter("quartier-des-manufactures", "Quartier des Manufactures", "entrepots", "atelier", 0.85),
  negoce: quarter("quartier-des-drapiers", "Quartier des Drapiers", "negoce", "marche", 0.95),
  conseil: quarter("quartier-du-conseil", "Quartier du Conseil", "hotels", "administration", 0.7),
  garnison: quarter("quartier-de-la-porte-nord", "Quartier de la Porte Nord", "garnison", "caserne", 0.7),
  ouvrier: quarter("quartier-des-tisserands", "Quartier des Tisserands et des Foulons", "ouvrier", "habitation", 0.95),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(10), sv(13), tv(5), tv(7), { kind: "place", id: "esplanade-de-la-manufacture", nom: "Esplanade de la Manufacture", revetement: "paves", fontaine: true, marche: true });
claimRect(claims, S, T, sv(5), sv(8), tv(2), tv(3), { kind: "place", id: "place-du-conseil", nom: "Place du Conseil", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, sv(11), sv(12), tv(2), tv(3), { kind: "place", id: "parvis-de-l-eglise", nom: "Parvis de l'église", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, sv(2), sv(4), tv(4), tv(5), { kind: "parc", id: "jardin-des-tisserands", nom: "Jardin des Tisserands", essences: ["tilleul", "marronnier", "fruitier"], arbres_par_ha: 70 });
claimRect(claims, S, T, sv(14), sv(16), tv(3), tv(4), { kind: "parc", id: "promenade-du-nord", nom: "Promenade du Nord", essences: ["tilleul", "peuplier", "erable"], arbres_par_ha: 62 });
claimRect(claims, S, T, sv(5), sv(7), tv(7), tv(8), { kind: "parc", id: "parc-des-lavoirs", nom: "Parc des Lavoirs", essences: ["saule", "peuplier", "tilleul"], arbres_par_ha: 58 });
claimRect(claims, S, T, sv(12), sv(14), tv(9), tv(10), { kind: "parc", id: "jardin-de-la-porte-nord", nom: "Jardin de la Porte Nord", essences: ["pin", "tilleul", "bouleau"], arbres_par_ha: 55 });
claims[cellKey(S, T, sv(12), tv(2))] = { kind: "ilot", fonction: "culte", densite: 0.55, quartier: Q.centre.id, gabarit: "centre" };

const NOMS_S = [
  "Rue des Drapiers", "Rue des Foulons", "Rue des Tisserands", "Rue des Cardeurs", "Rue des Teinturiers", "Rue des Fileurs", "Rue des Laineurs", "Rue des Tondeurs", "Rue des Pareurs", "Rue des Mesureurs de Draps",
  "Rue des Apprêteurs", "Rue des Navettes", "Rue des Métiers", "Rue des Bobines", "Rue des Lissiers", "Rue des Marchands de Laine", "Rue des Courtiers en Drap", "Rue des Balles", "Rue des Ballots", "Rue des Étendeurs",
];
const NOMS_T = ["Rue du Conseil", "Rue de la Manufacture", "Rue des Lavoirs", "Rue du Drap", "Rue de l'Horloge", "Rue des Halles", "Rue des Greniers", "Rue des Aunes", "Rue des Pesées", "Rue du Nord"];

export function orvud(): Place {
  return buildSaillie({
    id: "orvud",
    nom: "Orvud",
    libelle: "Orvud",
    canon: "C",
    sources: [
      ...sourceSina("I04 (Orvud : district nord de Sina, rang 3)", "Orvud (nord)", "tracé de la saillie, noms de rues, de places et de bâtiments, dimensions, quartiers"),
      { ref: "docs/spec/11 §2 et docs/spec/12 E35 : Orvud ravagé par le Titan de Rod Reiss en 850 [C] ; étendue du ravage : adaptation", canon: "C" },
    ],
    province: "prov_orvud",
    style: "E07",
    mur: "sina",
    population: populationSina("prov_orvud", 34783, 0.92),
    densite: { classe: "coeur", valeur: 215, canon: "A" },
    orientation: { valeur: "nord", canon: "C" },
    R,
    grid: { rot: 0, s: S, t: T },
    main: { nom: "Avenue du Drap", largeur_m: 18 },
    names: {
      s: NOMS_S,
      t: NOMS_T,
      lanes: ["Ruelle des Navettes", "Ruelle des Bobines", "Ruelle des Cardes", "Ruelle du Foulon"],
      placettes: ["Place des Foulons", "Placette des Aunes", "Place des Fileurs", "Placette du Lavoir"],
    },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      const r = Math.hypot(c[0], c[1]);
      if (c[1] > 780 && Math.abs(c[0]) < 520) return Q.garnison.id;
      if (c[0] > 0 && c[0] < 700 && c[1] > 350 && c[1] < 800) return Q.manufactures.id;
      if (c[0] > 700 && c[1] > 250 && c[1] < 800) return Q.manufactures.id;
      if (c[0] < 0 && c[0] > -700 && c[1] > 60 && c[1] < 320) return Q.conseil.id;
      if (c[0] < -250 && c[1] > 320 && c[1] < 800) return Q.negoce.id;
      if (r < 480) return Q.centre.id;
      if (Math.abs(c[0]) > 700) return Q.ouvrier.id;
      return Q.centre.id;
    },
    claims,
    placettes: [cellKey(S, T, sv(1), tv(3)), cellKey(S, T, sv(17), tv(4)), cellKey(S, T, sv(3), tv(8)), cellKey(S, T, sv(16), tv(8))],
    faubourg: {
      nom: "Faubourg de la porte intérieure",
      population: faubourgPopulation("prov_orvud", 34783, 0.08),
      densite: { classe: "faubourg", valeur: 62, canon: "A" },
      xs: [-450, -300, -150, 0, 150, 300, 450],
      ys: [-30, -155, -280, -405, -530],
      gabarit: "faubourg",
      quarter: quarter("faubourg-de-la-porte-interieure", "Faubourg de la porte intérieure", "faubourg", "habitation", 0.55),
      names: NOMS_CHEMINS,
    },
    canons_m: 30,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      const ex = (sv(10) + sv(13)) / 2;
      return [
        building({ id: "halle-des-laines", nom: "Halle des laines", canon: "A", archetype: "halle", position: pt(ex, tv(6)), emprise_m: [60, 26], angle_deg: 0, hauteur_m: 13, etages: 1, toit: "croupe", couverture: "tuile_plate", facade: "bois", teinte: "#C8B088", params: { piliers: 10, pente: 40 }, reperes_canon: ["Orvud, ressource clé : commerce [C] (atlas 06 I04) : la halle est une adaptation"] }),
        ...[[-120, -26], [0, -26], [120, -26], [-120, 28], [0, 28], [120, 28]].map(([dx, dy], k) =>
          building({ id: `etal-${k + 1}`, nom: `Étal de drap ${k + 1}`, canon: "A", archetype: "halle", position: pt(ex + (dx as number), tv(6) + (dy as number)), emprise_m: [14, 7], angle_deg: 0, hauteur_m: 5, etages: 1, toit: "appentis", couverture: "tuile_canal", facade: "bois", teinte: "#C2A57E", params: { piliers: 4, pente: 30 } }),
        ),
        building({ id: "manufacture-de-draps", nom: "Manufacture de draps", canon: "A", archetype: "atelier", position: c(14, 5), emprise_m: [68, 30], angle_deg: 0, hauteur_m: 12, etages: 3, toit: "croupe", couverture: "ardoise", facade: "brique", teinte: "#C4B49C", params: { pente: 36 } }),
        building({ id: "grand-entrepot-du-nord", nom: "Grand entrepôt du Nord", canon: "A", archetype: "entrepot", position: c(14, 7), emprise_m: [70, 28], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "tuile_plate", facade: "pierre_brute", teinte: "#CBBFA5", params: { pente: 40 } }),
        building({ id: "grenier-d-orvud", nom: "Grenier d'Orvud", canon: "A", archetype: "grenier", position: c(3, 7), emprise_m: [50, 24], angle_deg: 0, hauteur_m: 15, etages: 4, toit: "croupe", couverture: "tuile_plate", facade: "pierre_brute", teinte: "#CFC2A8", params: { pente: 46 } }),
        building({ id: "hotel-de-ville", nom: "Hôtel de ville d'Orvud", canon: "A", archetype: "hotel_de_ville", position: c(6, 1), emprise_m: [38, 20], angle_deg: 0, hauteur_m: 15, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 48 } }),
        building({ id: "tour-de-l-horloge", nom: "Tour de l'Horloge", canon: "A", archetype: "tour", position: c(10, 2), emprise_m: [12, 12], angle_deg: 0, hauteur_m: 32, etages: 6, toit: "pavillon", couverture: "cuivre", facade: "pierre_taillee", teinte: "#DCD3C0" }),
        building({ id: "eglise", nom: "Église d'Orvud", canon: "A", archetype: "eglise", position: c(12, 2), emprise_m: [22, 44], angle_deg: 0, hauteur_m: 18, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E2DACB", params: { clocher_m: 48, clocher_cote: 8.5, abside: true, pente: 50 } }),
        building({ id: "ecole-des-apprentis", nom: "École des apprentis tisserands", canon: "A", archetype: "ecole", position: c(4, 3), emprise_m: [44, 24], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "brique", teinte: "#D9CDB6", params: { pente: 42 } }),
        building({ id: "clinique-d-orvud", nom: "Clinique d'Orvud", canon: "A", archetype: "clinique", position: c(15, 3), emprise_m: [40, 24], angle_deg: 0, hauteur_m: 12, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E1DACB", params: { pente: 44 } }),
        building({ id: "caserne-de-la-porte-nord", nom: "Caserne de la porte nord", canon: "A", archetype: "caserne", position: c(8, 9), emprise_m: [60, 50], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D6D0C2", params: { cour: true, pente: 36 }, reperes_canon: ["Garnison aux portes (fichiers 01 et 11) : bâtiment adapté"] }),
        building({ id: "poste-porte-nord", nom: "Poste de garde de la porte nord", canon: "A", archetype: "caserne", position: c(8, 10), emprise_m: [26, 12], angle_deg: 0, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { pente: 40 } }),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return vegetationSina(parcs, {
        xs: [-450, -300, -150, 0, 150, 300, 450],
        ys: [-30, -155, -280, -405, -530],
        alignements: [
          { rue: "s-4", essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: "s-14", essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: "t-4", essence: "tilleul", intervalle_m: 12, cotes: "deux" },
          { rue: "t-8", essence: "marronnier", intervalle_m: 14, cotes: "deux" },
        ],
        isoles: [
          { position: pt(-170, tv(6)), essence: "tilleul", hauteur_m: 22, nom: "Tilleul des Drapiers" },
          { position: pt(150, 960), essence: "chene", hauteur_m: 24, nom: "Chêne de la porte nord" },
        ],
      });
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-700, 300], [700, 300], [-300, 600], [250, 800], [-800, 700]]), fontaines: pts([[(sv(10) + sv(13)) / 2, tv(6) - 40], [-340, 130]]) }),
    points_de_vue(ctx) {
      return baseViews(ctx, [
        { id: "esplanade-de-la-manufacture", nom: "Esplanade de la Manufacture et halle des laines", oeil: [(sv(13)) - 20, tv(5) + 10, 2.4], cible: [(sv(10) + sv(13)) / 2, tv(6) + 30, 7], fov: 62 },
        { id: "place-du-conseil", nom: "Place du Conseil et hôtel de ville", oeil: [-300, tv(3) + 40, 2.8], cible: [-380, tv(1) + 40, 9], fov: 60 },
        { id: "quartier-des-manufactures", nom: "Manufacture et grand entrepôt", oeil: [480, 380, 6], cible: [c14(), tv(6), 8], fov: 60 },
        { id: "porte-nord", nom: "Caserne et poste de la porte nord", oeil: [190, 880, 3.5], cible: [-60, 1000, 10], fov: 62 },
      ]);
    },
    etats(ctx) {
      void ctx;
      return [
        etat845("845, Orvud en temps ordinaire"),
        {
          id: "850-orvud-ravage",
          nom: "850, Orvud ravagé",
          date: "850",
          canon: "C",
          sources: [
            { ref: "docs/spec/11 §2, docs/spec/12 E35 et docs/spec/06 I04 : Orvud ravagé par le Titan de Rod Reiss en 850 [C]", canon: "C" },
            { ref: "étendue des ruines, des incendies et des débris, part des habitants partis : adaptation ; le mur et les portes ne sont pas touchés", canon: "A" },
          ],
          portes: {},
          ruines: [{ polygone: pts([[-800, 120], [800, 120], [800, 900], [-800, 900]]), part: 0.6 }, { polygone: pts([[-500, 900], [500, 900], [500, 1040], [-500, 1040]]), part: 0.3 }],
          incendies: pts([[-300, 300], [150, 420], [-520, 520], [380, 640], [-100, 720], [-350, 840], [250, 880]]),
          rochers: [{ position: pt(0, 560), rayon_m: 9, canon: "A" }, { position: pt(-210, 430), rayon_m: 4.5, canon: "A" }, { position: pt(300, 700), rayon_m: 3.4, canon: "A" }],
          abandon: 0.5,
          ciel: "enfume",
          habitants: 0.1,
        },
      ];
    },
    portes: (_ctx, gate) => portesSina(R, "Porte d'Orvud (porte nord)", "Porte intérieure d'Orvud", gate),
  });
}
const c14 = (): number => (-1080 + 120 * 14 + (-1080 + 120 * 15)) / 2;
