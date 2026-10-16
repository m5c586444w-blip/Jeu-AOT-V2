import type { Place } from "../../../data/placeSchema";
import { buildEnclos } from "./enclos";
import { pt } from "./kit";
import { pts } from "./maria";
import { building, claimRect, lines, quarter } from "./saillie";
import type { Claim } from "./saillie";
import { GABARIT_ENTREPOTS, GABARIT_HOTELS, GABARIT_NEGOCE, gabaritsSina } from "./sina";

/**
 * Mitras (C16, tranche 1) — capitale, au centre de l'intérieur du mur Sina, plan d'auteur. Établi [C] : Mitras est la capitale, dans Wall
 * Sina, avec une ville souterraine (fichiers 01 §3.1 et 11 §2) ; cour royale, Cabinet et cathédrale (atlas 06 I01, `poi_cathedrale_murs` et
 * `poi_tribunal_militaire` dans `data/provinces/paradis.json`) ; le « quartier des nobles » est un point d'intérêt de Mitras (atlas 06 I08) ;
 * 1 000 soldats de la Police militaire à Mitras (`data/scenarios/sandbox_845.json`) ; coup d'État de 850 (01). Tout le reste est une adaptation
 * [A] : tracé, noms, dimensions, quartiers, plan du château. La ville n'a pas d'enceinte propre dans le schéma (le mur Sina l'entoure à
 * distance ; la ville souterraine et la chapelle Reiss sont d'autres lieux).
 *
 * Parti d'auteur [A] : une capitale plane de 2 200 m de côté, damier de 100 m, Grande Avenue (24 m) du château au sud, jardins du château et
 * cour d'honneur au nord (château royal, hôtel du Cabinet, écuries royales), quartier des Nobles et parc à l'ouest, tribunal militaire,
 * cathédrale et sa place au nord-est, grand marché et halle à l'est de l'avenue, hôtel de ville, Police militaire au sud-ouest, entrepôts
 * au sud-est. Population : celle de `prov_mitras` (95 652 au scénario 845), tout intra-muros, densité 230 hab/ha.
 */
const S = lines(-1100, 1100, 100, 9, { 11: 24, 5: 14, 17: 14, 2: 5, 8: 5, 14: 5, 20: 5 });
const T = lines(-1100, 1100, 100, 9, { 5: 14, 11: 14, 16: 14, 2: 5, 8: 5, 14: 5, 19: 5 });
const sv = (k: number): number => -1100 + 100 * k;
const tv = (k: number): number => -1100 + 100 * k;

const GABARITS = gabaritsSina({ negoce: GABARIT_NEGOCE, hotels: GABARIT_HOTELS, entrepots: GABARIT_ENTREPOTS });
const Q = {
  centre: quarter("vieux-mitras", "Vieux Mitras", "centre", "habitation"),
  chateau: quarter("quartier-du-chateau", "Quartier du Château et du Cabinet", "hotels", "administration", 0.75),
  nobles: quarter("quartier-des-nobles", "Quartier des Nobles", "hotels", "noble", 0.7),
  cathedrale: quarter("quartier-de-la-cathedrale", "Quartier de la Cathédrale", "centre", "culte", 0.7),
  negoce: quarter("quartier-du-grand-marche", "Quartier du Grand Marché", "negoce", "marche", 0.95),
  entrepots: quarter("quartier-des-entrepots", "Quartier des Entrepôts du Sud-Est", "entrepots", "entrepot", 0.85),
  police: quarter("quartier-de-la-police-militaire", "Quartier de la Police militaire", "garnison", "caserne", 0.7),
  ouvrier: quarter("quartier-des-faubourgs", "Quartiers des Artisans et des Journaliers", "ouvrier", "habitation", 0.95),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(9), sv(13), tv(3), tv(4), { kind: "place", id: "cour-d-honneur", nom: "Cour d'honneur du château", revetement: "dalles", fontaine: true, marche: false });
claimRect(claims, S, T, sv(14), sv(16), tv(7), tv(9), { kind: "place", id: "place-de-la-cathedrale", nom: "Place de la Cathédrale", revetement: "dalles", fontaine: true, marche: false });
claimRect(claims, S, T, sv(12), sv(15), tv(12), tv(14), { kind: "place", id: "place-du-grand-marche", nom: "Place du Grand Marché", revetement: "paves", fontaine: true, marche: true });
claimRect(claims, S, T, sv(7), sv(15), tv(0), tv(3), { kind: "parc", id: "jardins-du-chateau", nom: "Jardins du château", essences: ["tilleul", "marronnier", "erable", "fruitier"], arbres_par_ha: 62 });
claimRect(claims, S, T, sv(3), sv(6), tv(4), tv(6), { kind: "parc", id: "parc-des-nobles", nom: "Parc des Nobles", essences: ["tilleul", "marronnier", "chene"], arbres_par_ha: 66 });
claimRect(claims, S, T, sv(8), sv(10), tv(18), tv(20), { kind: "parc", id: "jardin-du-sud", nom: "Jardin du Sud", essences: ["peuplier", "tilleul", "erable"], arbres_par_ha: 58 });
claimRect(claims, S, T, sv(17), sv(19), tv(10), tv(12), { kind: "parc", id: "promenade-de-l-est", nom: "Promenade de l'Est", essences: ["tilleul", "peuplier", "bouleau"], arbres_par_ha: 55 });
claims["6,12"] = { kind: "ilot", fonction: "culte", densite: 0.55, quartier: Q.centre.id, gabarit: "centre" };

const NOMS_S = [
  "Rue des Courtisans", "Rue des Huissiers", "Rue des Secrétaires", "Rue des Chambellans", "Rue des Orfèvres", "Rue des Joailliers", "Rue des Couturières", "Rue des Parfumeurs", "Rue des Libraires", "Rue des Gantiers",
  "Rue des Carrossiers", "Rue des Ébénistes", "Rue des Horlogers", "Rue des Fleuristes", "Rue des Traiteurs", "Rue des Perruquiers", "Rue des Armuriers", "Rue des Chapeliers", "Rue des Tailleurs", "Rue des Banquiers",
];
const NOMS_T = [
  "Rue des Grilles", "Rue du Cabinet", "Rue de la Cour", "Rue des Hôtels", "Rue de la Cathédrale", "Rue du Palais de Justice", "Rue de l'Hôtel de Ville", "Rue du Marché", "Rue des Halles", "Rue des Remises",
  "Rue des Cochers", "Rue du Guet", "Rue des Messageries", "Rue des Lanternes", "Rue des Fiacres", "Rue du Sud", "Rue des Entrepôts", "Rue des Magasins",
];

export function mitras(): Place {
  const base = buildEnclos({
    id: "mitras",
    nom: "Mitras",
    libelle: "Mitras (capitale)",
    canon: "C",
    sources: [
      { ref: "docs/spec/01 §3.1 et docs/spec/11 §2 : Mitras, capitale, dans Wall Sina, avec ville souterraine [C] ; docs/spec/06 I01 (rang 5) : cour royale, Cabinet, cathédrale [C]", canon: "C" },
      { ref: "data/provinces/paradis.json : poi_cathedrale_murs et poi_tribunal_militaire dans prov_mitras [C] ; docs/spec/06 I08 : le « quartier des nobles » est un POI de Mitras [C] ; data/scenarios/sandbox_845.json : 1 000 soldats de la Police militaire", canon: "C" },
      { ref: "tracé, noms de rues, de places, de quartiers et de bâtiments, plan du château, dimensions : adaptation (création C16, `docs/lore/creations.md`) ; enceinte propre non modélisée par le schéma (Q20)", canon: "A" },
    ],
    province: "prov_mitras",
    style: "E06",
    population: { province: "prov_mitras", part: 1, canon: "C", note: "100 % de la population de `prov_mitras` au départ de scn_sandbox_845 (95 652 hab.) ; la province existe [C]. La ville souterraine est une autre province (`prov_ville_souterraine`) et un autre lieu." },
    densite: { classe: "coeur", valeur: 230, canon: "A" },
    orientation: { valeur: "centre", canon: "C" },
    s: S,
    t: T,
    names: { s: NOMS_S, t: NOMS_T, lanes: ["Ruelle des Carrosses", "Ruelle des Lanternes", "Ruelle du Valet", "Ruelle des Messagers"] },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      const [x, y] = c;
      if (y < -650 && Math.abs(x) < 500) return Q.chateau.id;
      if (x < -300 && y < -300) return Q.nobles.id;
      if (x > 250 && y < -150 && y > -650) return Q.cathedrale.id;
      if (x < -350 && y > 300 && y < 900) return Q.police.id;
      if (x > 300 && y > 600) return Q.entrepots.id;
      if (Math.abs(x) < 450 && y > -100 && y < 650) return Q.negoce.id;
      if (Math.abs(x) > 800 || y > 850) return Q.ouvrier.id;
      return Q.centre.id;
    },
    claims,
    marge_m: 30,
    etendue_m: 3000,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      return [
        building({ id: "chateau-royal", nom: "Château royal", canon: "A", archetype: "chateau", position: pt(0, -750), emprise_m: [180, 60], angle_deg: 0, hauteur_m: 30, etages: 4, toit: "mansarde", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E4DCCB", params: { pente: 52 }, reperes_canon: ["Cour royale de Mitras [C] (atlas 06 I01) ; château royal, salle d'audience et jardins (docs/spec/20) : plan du château adapté"] }),
        building({ id: "hotel-du-cabinet", nom: "Hôtel du Cabinet", canon: "A", archetype: "palais", position: c(13, 3), emprise_m: [56, 36], angle_deg: 0, hauteur_m: 18, etages: 3, toit: "mansarde", couverture: "ardoise", facade: "pierre_taillee", teinte: "#DCD3C0", params: { pente: 48 }, reperes_canon: ["Cabinet (atlas 06 I01) [C] : l'hôtel est une adaptation"] }),
        building({ id: "ecuries-royales", nom: "Écuries royales", canon: "A", archetype: "ecurie", position: c(8, 3), emprise_m: [64, 24], angle_deg: 0, hauteur_m: 9, etages: 1, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D9D0BD", params: { pente: 38 } }),
        building({ id: "cathedrale", nom: "Cathédrale des Murs", canon: "A", archetype: "cathedrale", position: pt(400, -300), emprise_m: [36, 84], angle_deg: 0, hauteur_m: 38, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E2DACB", params: { clocher_m: 78, clocher_cote: 10, abside: true, pente: 54 }, reperes_canon: ["poi_cathedrale_murs dans prov_mitras [C] (data/provinces/paradis.json) ; religion d'État (01 §5.1) : plan adapté"] }),
        building({ id: "tribunal-militaire", nom: "Tribunal militaire", canon: "A", archetype: "hotel_de_ville", position: c(10, 6), emprise_m: [46, 24], angle_deg: 0, hauteur_m: 16, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 48 }, reperes_canon: ["poi_tribunal_militaire dans prov_mitras [C] : emplacement adapté"] }),
        building({ id: "hotel-de-ville", nom: "Hôtel de ville de Mitras", canon: "A", archetype: "hotel_de_ville", position: c(10, 14), emprise_m: [40, 22], angle_deg: 0, hauteur_m: 16, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 48 } }),
        building({ id: "hotel-de-la-police-militaire", nom: "Hôtel de la Police militaire", canon: "A", archetype: "caserne", position: c(4, 15), emprise_m: [70, 50], angle_deg: 0, hauteur_m: 13, etages: 3, toit: "mansarde", couverture: "ardoise", facade: "pierre_taillee", teinte: "#DDD6C6", params: { cour: true, pente: 44 }, reperes_canon: ["Police militaire à Mitras [C] (1 000 soldats au scénario 845) : l'hôtel est une adaptation"] }),
        building({ id: "halle-du-grand-marche", nom: "Halle du Grand Marché", canon: "A", archetype: "halle", position: pt(250, 200), emprise_m: [60, 26], angle_deg: 0, hauteur_m: 13, etages: 1, toit: "croupe", couverture: "tuile_plate", facade: "bois", teinte: "#C8B088", params: { piliers: 10, pente: 40 } }),
        ...[[-90, -50], [0, -50], [90, -50], [-90, 50], [0, 50], [90, 50]].map(([dx, dy], k) =>
          building({ id: `etal-${k + 1}`, nom: `Étal du grand marché ${k + 1}`, canon: "A", archetype: "halle", position: pt(250 + (dx as number), 200 + (dy as number)), emprise_m: [14, 7], angle_deg: 0, hauteur_m: 5, etages: 1, toit: "appentis", couverture: "tuile_canal", facade: "bois", teinte: "#C2A57E", params: { piliers: 4, pente: 30 } }),
        ),
        building({ id: "eglise-de-la-grande-avenue", nom: "Église de la Grande Avenue", canon: "A", archetype: "eglise", position: c(6, 12), emprise_m: [22, 44], angle_deg: 0, hauteur_m: 18, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E2DACB", params: { clocher_m: 48, clocher_cote: 8.5, abside: true, pente: 50 } }),
        building({ id: "hopital-royal", nom: "Hôpital royal", canon: "A", archetype: "clinique", position: c(3, 11), emprise_m: [56, 26], angle_deg: 0, hauteur_m: 14, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E1DACB", params: { pente: 44 } }),
        building({ id: "college-de-mitras", nom: "Collège de Mitras", canon: "A", archetype: "ecole", position: c(15, 16), emprise_m: [50, 26], angle_deg: 0, hauteur_m: 13, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D9CDB6", params: { pente: 42 } }),
        building({ id: "entrepots-du-sud-est", nom: "Grands entrepôts du Sud-Est", canon: "A", archetype: "entrepot", position: c(17, 19), emprise_m: [64, 28], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "tuile_plate", facade: "brique", teinte: "#C8B8A0", params: { pente: 40 } }),
        building({ id: "grenier-de-la-capitale", nom: "Grenier de la capitale", canon: "A", archetype: "grenier", position: c(15, 19), emprise_m: [54, 24], angle_deg: 0, hauteur_m: 15, etages: 4, toit: "croupe", couverture: "tuile_plate", facade: "pierre_brute", teinte: "#CFC2A8", params: { pente: 46 } }),
        building({ id: "hotel-d-un-grand-seigneur", nom: "Hôtel du Parc des Nobles", canon: "A", archetype: "palais", position: c(2, 5), emprise_m: [60, 40], angle_deg: 0, hauteur_m: 17, etages: 3, toit: "mansarde", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 46 }, reperes_canon: ["quartier des nobles de Mitras [C] (atlas 06 I08) : l'hôtel est une adaptation"] }),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return {
        alignements: [
          { rue: "s-11", essence: "tilleul", intervalle_m: 12, cotes: "deux" },
          { rue: "s-5", essence: "marronnier", intervalle_m: 14, cotes: "deux" },
          { rue: "s-17", essence: "marronnier", intervalle_m: 14, cotes: "deux" },
          { rue: "t-11", essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: "t-16", essence: "erable", intervalle_m: 14, cotes: "deux" },
        ],
        isoles: [
          { position: pt(-170, 150), essence: "tilleul", hauteur_m: 23, nom: "Tilleul du Grand Marché" },
          { position: pt(0, -640), essence: "chene", hauteur_m: 25, nom: "Chêne de la cour d'honneur" },
        ],
        parcs,
        vergers: [],
        haies: [],
        potagers: [],
        essences_cours: ["tilleul", "marronnier", "erable", "fruitier"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-700, 100], [700, -500], [-300, 500], [800, 800], [-800, 800]]), fontaines: pts([[0, -750], [400, -300], [250, 200]]) }),
    points_de_vue() {
      return [
        { id: "chateau-royal", nom: "Château royal et cour d'honneur", oeil: [0, -560, 4], cible: [0, -750, 18], fov: 62 },
        { id: "cathedrale", nom: "Cathédrale et sa place", oeil: [400, -190, 3], cible: [400, -300, 18], fov: 60 },
        { id: "grande-avenue", nom: "Grande Avenue vers le château", oeil: [0, 600, 2], cible: [0, -300, 12], fov: 58 },
        { id: "grand-marche", nom: "Grand Marché et halle", oeil: [400, 280, 2.4], cible: [250, 200, 7], fov: 60 },
      ];
    },
    etats() {
      return [
        { id: "845-avant", nom: "845, Mitras en temps ordinaire", date: "845", canon: "A", sources: [{ ref: "état ordinaire de la capitale (adaptation)", canon: "A" }], portes: {}, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 1 },
        {
          id: "850-coup-d-etat",
          nom: "850, journée du coup d'État",
          date: "850",
          canon: "A",
          sources: [
            { ref: "docs/spec/01 (850 : coup d'État mené par le Corps de Reconnaissance) [C], ordre des faits [?] ; atteintes à la ville : adaptation", canon: "C" },
            { ref: "affluence, brume, rues désertées près du château : adaptation (aucune destruction)", canon: "A" },
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
    },
  });
  // La Grande Avenue (s-11, x = 0) : voie principale nommée (atlas 06 T11 : « Mitras — Grande Avenue » [C]) ; nom créé [A].
  base.rues = base.rues.map((r) => (r.id.startsWith("s-11") ? { ...r, nom: "Grande Avenue", type: "principale" as const } : r));
  return base;
}
