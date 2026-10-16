import type { Gabarit, Place } from "../../../data/placeSchema";
import { buildEnclos } from "./enclos";
import { bat, etat, GAB_VILLE_RURALE } from "./horsmurs";
import { pt } from "./kit";
import { BASE_GABARITS, pts } from "./maria";
import { claimRect, lines, quarter } from "./saillie";
import type { Claim } from "./saillie";
import { GABARIT_ENTREPOTS } from "./sina";

/**
 * Zone d'internement de Liberio (C18, tranche 1) — quartier clos de la ville marleyenne de Liberio, plan d'auteur de niveau N1.
 * Établi [C] : les Eldiens restés sur le continent sont internés dans des zones d'internement, dont celle de Liberio (fichiers 01 §3,
 * 11, atlas 06 MA03 et T23), nation de début de XXe siècle d'inspiration européenne ; la zone est un quartier clos. Tout le reste est
 * une adaptation [A] : étendue, tracé, noms, bâtiments, effectif, états. L'étendue exacte de la zone est `?` (01 §« questions », 9).
 *
 * Parti d'auteur [A] : un quartier rectangulaire de 900 m × 700 m, clos par un mur de clôture (non modélisable par le schéma : le
 * lieu est un lieu sans enceinte, la clôture est rendue par les rues de ceinture, les miradors et les postes de garde), deux accès
 * gardés (portail nord et portail sud) aux extrémités de la Grande Rue ; place du Marché et sa halle à l'est de l'axe, chapelle du
 * quartier, dispensaire et école communale à l'ouest, ateliers et entrepôt de la coopérative à l'est, château d'eau, bains-douches,
 * jardins ouvriers au sud-est. Population : la simulation ne porte pas de population pour les provinces du monde (`wprov_liberio_
 * internement`) : valeur paramétrable `?` (12 000), densité 200 hab/ha (classe coeur, quartier dense à maisons basses).
 */
const S = lines(-450, 450, 100, 7, { 4: 10, 1: 5, 7: 5 });
const T = lines(-350, 350, 100, 7, { 3: 10, 1: 5, 5: 5 });
const sv = (k: number): number => -450 + 100 * k;
const tv = (k: number): number => -350 + 100 * k;

const GABARITS: Record<string, Gabarit> = {
  habitat: { ...(BASE_GABARITS.ouvrier as Gabarit), etages: [2, 3, 3, 2], cour: { type: "jardin", arbres_par_ha: 90 } },
  marche: { ...GAB_VILLE_RURALE, cour: { type: "plantee", arbres_par_ha: 90 } },
  ateliers: { ...GABARIT_ENTREPOTS, cour: { type: "plantee", arbres_par_ha: 80 } },
  garde: { ...(BASE_GABARITS.garnison as Gabarit), cour: { type: "pavee", arbres_par_ha: 40 } },
};

const Q = {
  vieux: quarter("vieux-quartier", "Vieux quartier", "habitat", "habitation", 0.95),
  marche: quarter("quartier-du-marche", "Quartier du Marché", "marche", "marche", 0.95),
  ateliers: quarter("quartier-des-ateliers", "Quartier des Ateliers", "ateliers", "atelier", 0.9),
  portails: quarter("quartier-des-portails", "Quartier des Portails", "garde", "caserne", 0.7),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(5), sv(7), tv(3), tv(5), { kind: "place", id: "place-du-marche", nom: "Place du Marché", revetement: "paves", fontaine: true, marche: true });
claimRect(claims, S, T, sv(2), sv(3), tv(4), tv(5), { kind: "parc", id: "square-des-tilleuls", nom: "Square des Tilleuls", essences: ["tilleul", "marronnier", "erable"], arbres_par_ha: 60 });
claimRect(claims, S, T, sv(7), sv(9), tv(5), tv(7), { kind: "parc", id: "jardins-ouvriers", nom: "Jardins ouvriers", essences: ["fruitier", "saule", "peuplier"], arbres_par_ha: 50 });
claimRect(claims, S, T, sv(0), sv(1), tv(2), tv(3), { kind: "parc", id: "cour-des-lavoirs", nom: "Cour des Lavoirs", essences: ["saule", "peuplier", "fruitier"], arbres_par_ha: 52 });

const NOMS_S = ["Rue de la Clôture ouest", "Rue des Tisserands", "Rue des Savetiers", "Grande Rue", "Rue des Rémouleurs", "Rue des Cordiers", "Rue des Chaudronniers", "Rue de la Clôture est"];
const NOMS_T = ["Rue du Portail nord", "Rue des Lavandières", "Rue du Marché", "Rue des Ateliers", "Rue des Fumistes", "Rue du Portail sud"];
const LANES = ["Ruelle du Puits", "Ruelle des Chiffonniers", "Ruelle du Four", "Ruelle des Rapiéceurs", "Ruelle du Pain bis", "Ruelle des Sabots"];

export function liberio(): Place {
  return buildEnclos({
    id: "liberio",
    nom: "Zone d'internement de Liberio",
    libelle: "Zone d'internement de Liberio (Marley)",
    canon: "C",
    sources: [
      { ref: "docs/spec/01 §3 et docs/spec/11 : zone d'internement de Liberio, quartier clos où sont internés les Eldiens du continent [C] ; docs/spec/06 MA03 et T23 ; data/world_provinces/world.json : wprov_liberio_internement [C]", canon: "C" },
      { ref: "clôture non modélisable par le schéma (lieu sans enceinte) ; étendue exacte de la zone `?` ; population : le monde n'a pas de population de simulation par province", canon: "A" },
      { ref: "tracé, noms de rues, de places, de quartiers et de bâtiments, états : adaptation (création C18, `docs/lore/creations.md`)", canon: "A" },
    ],
    province: null,
    style: "E07",
    population: { province: null, part: 1, valeur: 12000, canon: "?", note: "`wprov_liberio_internement` (atlas MA03) n'a pas de population dans la simulation (les provinces du monde portent industrie, vivres, effectifs) ; valeur paramétrable `?` pour un quartier clos de ville de début de XXe siècle (ordre de grandeur adapté, à relire quand la simulation du monde portera des habitants)." },
    densite: { classe: "coeur", valeur: 200, canon: "A" },
    orientation: { valeur: "nord", canon: "?" },
    s: S,
    t: T,
    names: { s: NOMS_S, t: NOMS_T, lanes: LANES },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      if (Math.abs(c[0] + 50) < 250 && Math.abs(c[1]) > 250) return Q.portails.id;
      if (c[0] > 250) return Q.ateliers.id;
      if (c[0] > -50 && c[0] < 260 && Math.abs(c[1] - 50) < 260) return Q.marche.id;
      return Q.vieux.id;
    },
    claims,
    marge_m: 30,
    etendue_m: 1200,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      return [
        bat("halle-du-marche", "Halle du marché", "halle", [150, 50], [50, 22], 11, 1, "croupe", "tuile_plate", "bois", "#C8B088", { params: { piliers: 8, pente: 40 } }),
        bat("chapelle-du-quartier", "Chapelle du quartier", "chapelle", c(3, 2), [18, 34], 12, 1, "pignon", "ardoise", "pierre_brute", "#D9D0BE", { params: { clocher_m: 22, clocher_cote: 5, pente: 50 } }),
        bat("dispensaire", "Dispensaire du quartier", "clinique", c(1, 3), [34, 20], 9, 2, "croupe", "tuile_plate", "brique", "#D6CDB8", { params: { pente: 42 } }),
        bat("ecole-communale", "École du quartier", "ecole", c(2, 5), [38, 20], 9, 2, "croupe", "ardoise", "brique", "#D8CCB4", { params: { pente: 40 } }),
        bat("maison-du-conseil", "Maison du Conseil du quartier", "hotel_de_ville", c(4, 2), [28, 18], 10, 2, "croupe", "ardoise", "enduit", "#DDD3BC", { params: { pente: 42 } }),
        bat("bains-douches", "Bains-douches", "atelier", c(0, 0), [30, 16], 7, 1, "pignon", "tuile_plate", "brique", "#CFC2A8", { params: { pente: 34 } }),
        bat("chateau-d-eau", "Château d'eau", "tour", c(3, 4), [9, 9], 24, 6, "pavillon", "ardoise", "brique", "#CFC6B2"),
        bat("atelier-de-tricotage", "Atelier de tricotage", "usine", c(7, 2), [44, 28], 10, 2, "pignon", "tuile_plate", "brique", "#C9B596", { params: { pente: 32 } }),
        bat("atelier-de-cordonnerie", "Atelier de cordonnerie", "atelier", c(7, 3), [34, 20], 8, 2, "pignon", "tuile_plate", "brique", "#C7B393", { params: { pente: 34 } }),
        bat("atelier-du-chiffon", "Atelier du chiffon", "atelier", c(8, 1), [32, 20], 8, 1, "appentis", "tuile_canal", "bois", "#B9A27E", { params: { pente: 26 } }),
        bat("entrepot-de-la-cooperative", "Entrepôt de la coopérative", "entrepot", c(8, 4), [50, 24], 9, 2, "pignon", "tuile_plate", "brique", "#C6B190", { params: { pente: 34 } }),
        bat("cuisine-communale", "Cuisine communale", "atelier", c(6, 6), [38, 20], 8, 1, "pignon", "tuile_plate", "pierre_brute", "#CDBE9F", { params: { pente: 36 } }),
        bat("poste-du-portail-nord", "Poste de garde du portail nord", "caserne", c(4, 0), [42, 24], 10, 3, "croupe", "ardoise", "pierre_taillee", "#D2CCBD", { params: { cour: true, pente: 40 } }),
        bat("poste-du-portail-sud", "Poste de garde du portail sud", "caserne", c(4, 6), [42, 24], 10, 3, "croupe", "ardoise", "pierre_taillee", "#D2CCBD", { params: { cour: true, pente: 40 } }),
        bat("mirador-nord-ouest", "Mirador nord-ouest", "tour", c(1, 0), [8, 8], 14, 3, "pavillon", "ardoise", "bois", "#BDB29A"),
        bat("mirador-nord-est", "Mirador nord-est", "tour", c(8, 0), [8, 8], 14, 3, "pavillon", "ardoise", "bois", "#BDB29A"),
        bat("mirador-sud-ouest", "Mirador sud-ouest", "tour", c(0, 6), [8, 8], 14, 3, "pavillon", "ardoise", "bois", "#BDB29A"),
        bat("mirador-sud-est", "Mirador sud-est", "tour", c(7, 6), [8, 8], 14, 3, "pavillon", "ardoise", "bois", "#BDB29A"),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return {
        alignements: [
          { rue: "s-4", essence: "tilleul", intervalle_m: 16, cotes: "deux" },
          { rue: "t-3", essence: "marronnier", intervalle_m: 16, cotes: "deux" },
        ],
        isoles: [{ position: pt(150, -90), essence: "tilleul", hauteur_m: 19, nom: "Tilleul de la place du Marché" }],
        parcs,
        vergers: [],
        haies: [],
        potagers: [],
        essences_cours: ["tilleul", "marronnier", "erable", "fruitier"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-300, -190], [-110, 160], [330, 20], [-390, 250]]), fontaines: pts([[150, 50]]) }),
    points_de_vue() {
      return [
        { id: "grande-rue", nom: "Grande Rue et portail sud", oeil: [-50, -240, 3], cible: [-50, 200, 8], fov: 58 },
        { id: "place-du-marche", nom: "Place du Marché et halle", oeil: [20, 200, 3], cible: [150, 40, 7], fov: 60 },
        { id: "quartier-des-ateliers", nom: "Ateliers et entrepôt", oeil: [300, 230, 4], cible: [380, 20, 8], fov: 60 },
        { id: "portail-nord", nom: "Portail nord et miradors", oeil: [-50, -180, 3.5], cible: [-50, -320, 10], fov: 62 },
      ];
    },
    etats() {
      return [
        etat({ id: "845-ordinaire", nom: "845, un jour ordinaire dans la zone", date: "845", sources: [{ ref: "état ordinaire du quartier (adaptation)", canon: "A" }], ruines: [], incendies: [], abandon: 0, ciel: "clair", habitants: 1 }),
        etat({
          id: "854-nuit-du-raid",
          nom: "854, le quartier de Liberio frappé",
          date: "854",
          canon: "C",
          sources: [
            { ref: "docs/spec/01 §3 (854 : frappe sur Liberio) ; data/events/canon_854.json : evt_854_liberio_raid [C] ; la zone d'internement est dans la ville de Liberio", canon: "C" },
            { ref: "étendue des ruines et des incendies dans la zone, effectif réduit, fumée : adaptation ; déroulement non posé", canon: "A" },
          ],
          ruines: [{ polygone: pts([[-300, -250], [150, -250], [150, 100], [-300, 100]]), part: 0.4 }],
          incendies: pts([[-200, -120], [-60, 40], [90, -60], [-250, 60]]),
          abandon: 0,
          ciel: "enfume",
          habitants: 0.4,
        }),
      ];
    },
  });
}
