import type { Gabarit, Place } from "../../../data/placeSchema";
import { buildEnclos } from "./enclos";
import { pt } from "./kit";
import { BASE_GABARITS, pts } from "./maria";
import { authored, building, claimRect, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * Ville souterraine (C16, tranche 2) — plan d'auteur. Établi [C] : Mitras, capitale, a une ville souterraine (fichiers 01 §3.1 et 11 §2) ;
 * atlas 06 I06 : « Ville souterraine », terrain souterrain, marché noir et contrebande ; `prov_ville_souterraine` et son point d'intérêt
 * `poi_marche_noir` (`data/provinces/paradis.json`) ; fiche de style E08 (galeries, puits de jour, lanternes, escaliers, aucun horizon).
 * Tout le reste est une adaptation [A] : tracé, noms, dimensions, quartiers, accès.
 *
 * Écart avec le schéma (documenté, `docs/places/ville-souterraine/lore.md`) : le schéma de lieu n'a ni plafond, ni voûte, ni galerie en
 * relief. La ville souterraine est donc un lieu à ciel couvert posé sur un damier à plan d'auteur ; la voûte de la caverne, les
 * galeries et la lumière des lanternes ne sont pas modélisées (dette) ; l'ambiance est portée par le ciel « enfumé » et les toits plats.
 * Les arbres exigés par la mesure CR1e-04 sont des fruitiers en espalier et des arbres nains en bacs, au fond des cours éclairées par
 * les puits de jour ; la fiche E08 dit « arbres 0 » : l'écart est assumé et signalé (Q26).
 *
 * Parti d'auteur [A] : une grande caverne de 1 280 m sur 1 200 m sous Mitras, damier irrégulier. La Grande Galerie (x = -50) et la
 * Galerie des Lanternes (y = 0) se croisent près de la place du Marché noir, au centre-est ; les accès de Mitras sont le Grand
 * Escalier (au nord, sous la cour du château), l'Escalier du Sud et deux puits-escaliers à l'est et à l'ouest ; trois jardins sous
 * des puits de lumière ; ateliers de lampes à l'ouest, entrepôts de contrebande au sud-est. Population : celle de
 * `prov_ville_souterraine` (34 783 au scénario 845), tout intra-muros, densité 260 hab/ha (cœur très dense).
 */
const XS = [-640, -540, -450, -350, -250, -140, -50, 50, 140, 250, 350, 450, 540, 640];
const YS = [-600, -500, -410, -310, -210, -110, 0, 100, 190, 290, 390, 490, 600];
const S = authored(XS, 7, { [-450]: 4, [-250]: 4, 250: 4, 450: 4, [-50]: 14 });
const T = authored(YS, 7, { [-410]: 4, [-210]: 4, 190: 4, 390: 4, 0: 14 });
const sv = (i: number): number => XS[i] as number;
const tv = (j: number): number => YS[j] as number;

const DARK = ["#7A6A52", "#6E5A44", "#85735A", "#645240", "#7E6C54"];
const GABARITS: Record<string, Gabarit> = {
  souterrain: { etages: [2, 3, 2, 4], hauteur_etage_m: 2.9, toits: ["plat", "appentis", "plat", "pignon"], pente_deg: [20, 36], couvertures: ["terrasse", "bardeau", "terrasse", "tuile_plate"], facades: ["pierre_brute", "bois", "pierre_brute", "brique"], teintes: DARK, parcelles_m: [5.5, 6.5, 5, 7.5], profondeur_m: 10, boutiques: false, passage_m: 32, cour: { type: "jardin", arbres_par_ha: 22 } },
  atelier: { ...(BASE_GABARITS.ouvrier as Gabarit), toits: ["plat", "appentis", "plat"], couvertures: ["terrasse", "bardeau", "terrasse"], facades: ["pierre_brute", "bois", "brique"], teintes: ["#6A5C48", "#5C4E3C", "#74644E"], cour: { type: "pavee", arbres_par_ha: 20 } },
  negoce: { etages: [2, 3, 2], hauteur_etage_m: 3, toits: ["plat", "appentis", "pignon_rue"], pente_deg: [22, 34], couvertures: ["terrasse", "bardeau", "tuile_plate"], facades: ["bois", "pierre_brute", "enduit"], teintes: ["#8A7458", "#7C6648", "#92805F", "#6E5A44"], parcelles_m: [6, 7.5, 5.5], profondeur_m: 11, boutiques: true, passage_m: 30, cour: { type: "pavee", arbres_par_ha: 20 } },
  entrepot: { etages: [2, 3, 3], hauteur_etage_m: 3.4, toits: ["plat", "croupe", "plat"], pente_deg: [24, 36], couvertures: ["terrasse", "tuile_plate", "terrasse"], facades: ["pierre_brute", "bois", "brique"], teintes: ["#6E6048", "#625540", "#7A6A50"], parcelles_m: [16, 20, 14], profondeur_m: 16, boutiques: false, passage_m: 40, cour: { type: "pavee", arbres_par_ha: 18 } },
};

const Q = {
  basse: quarter("basse-ville", "Basse Ville", "souterrain", "habitation", 0.95),
  marche: quarter("quartier-du-marche-noir", "Quartier du Marché noir", "negoce", "marche", 0.95),
  escaliers: quarter("quartier-des-escaliers", "Quartier des Escaliers", "souterrain", "administration", 0.85),
  lampes: quarter("quartier-des-lampistes", "Quartier des Lampistes et des Forgerons", "atelier", "atelier", 0.95),
  entrepots: quarter("quartier-des-entrepots-de-la-remonte", "Quartier des Entrepôts de la Remonte", "entrepot", "entrepot", 0.85),
  reservoir: quarter("quartier-du-reservoir", "Quartier du Réservoir", "souterrain", "habitation", 0.95),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(7), sv(9), tv(6), tv(8), { kind: "place", id: "place-du-marche-noir", nom: "Place du Marché noir", revetement: "paves", fontaine: true, marche: true });
claimRect(claims, S, T, sv(6), sv(7), tv(1), tv(2), { kind: "place", id: "parvis-du-grand-escalier", nom: "Parvis du Grand Escalier", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, sv(2), sv(3), tv(2), tv(3), { kind: "parc", id: "jardin-du-puits-nord-ouest", nom: "Jardin du Puits de lumière du Nord-Ouest", essences: ["fruitier", "saule", "bouleau"], arbres_par_ha: 40 });
claimRect(claims, S, T, sv(8), sv(9), tv(10), tv(11), { kind: "parc", id: "jardin-du-puits-sud", nom: "Jardin du Puits de lumière du Sud", essences: ["fruitier", "saule"], arbres_par_ha: 36 });
claimRect(claims, S, T, sv(10), sv(11), tv(3), tv(4), { kind: "parc", id: "jardin-du-puits-est", nom: "Jardin du Puits de lumière de l'Est", essences: ["fruitier", "bouleau", "saule"], arbres_par_ha: 38 });

const NOMS_S = [
  "Galerie des Mineurs", "Galerie des Lampistes", "Galerie du Cordage", "Galerie des Porteurs", "Galerie des Tonneliers", "Galerie des Passeurs", "Grande Galerie", "Galerie du Troc", "Galerie des Rats", "Galerie des Marchands de nuit",
  "Galerie des Charbonniers", "Galerie du Sel", "Galerie des Fumeurs", "Galerie du Fond",
];
const NOMS_T = [
  "Galerie du Puits", "Galerie de l'Escalier", "Galerie des Chaînes", "Galerie des Poulies", "Galerie des Chandelles", "Galerie du Marché noir", "Galerie des Lanternes", "Galerie des Eaux", "Galerie des Contrebandiers", "Galerie des Soupiraux",
  "Galerie des Cordiers", "Galerie des Fonds",
];

export function villeSouterraine(): Place {
  const base = buildEnclos({
    id: "ville-souterraine",
    nom: "Ville souterraine",
    libelle: "Ville souterraine de Mitras",
    canon: "C",
    sources: [
      { ref: "docs/spec/01 §3.1 et docs/spec/11 §2 : Mitras, capitale de Wall Sina, avec ville souterraine [C] ; docs/spec/06 I06 : ville souterraine, marché noir et contrebande [C]", canon: "C" },
      { ref: "data/provinces/paradis.json : prov_ville_souterraine, poi_marche_noir [C] ; data/art/styles.json E08 : galeries, puits de jour, lanternes, escaliers, aucun horizon [C/A]", canon: "C" },
      { ref: "tracé, noms de galeries, de places, de quartiers et de bâtiments, accès, dimensions : adaptation (création C16, `docs/lore/creations.md`) ; voûte et plafond non modélisés par le schéma (Q26)", canon: "A" },
    ],
    province: "prov_ville_souterraine",
    style: "E08",
    population: { province: "prov_ville_souterraine", part: 1, canon: "C", note: "100 % de la population de `prov_ville_souterraine` au départ de scn_sandbox_845 (34 783 hab.) ; la province existe [C], elle est distincte de `prov_mitras` (pas de double compte)." },
    densite: { classe: "coeur", valeur: 260, canon: "A" },
    orientation: { valeur: "centre", canon: "C" },
    s: S,
    t: T,
    names: { s: NOMS_S, t: NOMS_T, lanes: ["Boyau des Rats", "Boyau de la Corde", "Boyau du Sel", "Boyau des Fumeurs", "Boyau des Porteurs"] },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      const [x, y] = c;
      if (y < -420 || (y > 480 && Math.abs(x) < 120)) return Q.escaliers.id;
      if (x > -80 && x < 380 && y > -130 && y < 330) return Q.marche.id;
      if (x < -330 && y > -230 && y < 400) return Q.lampes.id;
      if (x > 100 && y > 330) return Q.entrepots.id;
      if (x > 330) return Q.reservoir.id;
      return Q.basse.id;
    },
    claims,
    marge_m: 30,
    etendue_m: 1900,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      return [
        building({ id: "halle-du-marche-noir", nom: "Halle du Marché noir", canon: "A", archetype: "halle", position: pt(150, 95), emprise_m: [60, 26], angle_deg: 0, hauteur_m: 11, etages: 1, toit: "plat", couverture: "terrasse", facade: "bois", teinte: "#8A7458", params: { piliers: 10, pente: 24 }, reperes_canon: ["poi_marche_noir dans prov_ville_souterraine [C] (data/provinces/paradis.json) : la halle est une adaptation"] }),
        ...[[-85, -45], [0, -45], [85, -45], [-85, 45], [0, 45], [85, 45]].map(([dx, dy], k) =>
          building({ id: `etal-${k + 1}`, nom: `Étal du Marché noir ${k + 1}`, canon: "A", archetype: "halle", position: pt(150 + (dx as number), 95 + (dy as number)), emprise_m: [14, 7], angle_deg: 0, hauteur_m: 4.5, etages: 1, toit: "appentis", couverture: "bardeau", facade: "bois", teinte: "#7C6648", params: { piliers: 4, pente: 24 } }),
        ),
        building({ id: "grand-escalier", nom: "Grand Escalier de Mitras", canon: "A", archetype: "tour", position: pt(0, -470), emprise_m: [20, 20], angle_deg: 0, hauteur_m: 16, etages: 3, toit: "plat", couverture: "terrasse", facade: "pierre_brute", teinte: "#8A7C66", reperes_canon: ["Mitras a une ville souterraine [C] (fichier 01 §3.1) : l'accès par escalier est une adaptation"] }),
        building({ id: "corps-de-garde-du-grand-escalier", nom: "Corps de garde du Grand Escalier", canon: "A", archetype: "caserne", position: c(5, 1), emprise_m: [34, 18], angle_deg: 0, hauteur_m: 8, etages: 2, toit: "croupe", couverture: "tuile_plate", facade: "pierre_brute", teinte: "#8A7C66", params: { cour: false, pente: 28 } }),
        building({ id: "escalier-du-sud", nom: "Escalier du Sud", canon: "A", archetype: "tour", position: c(6, 11), emprise_m: [14, 14], angle_deg: 0, hauteur_m: 14, etages: 3, toit: "plat", couverture: "terrasse", facade: "pierre_brute", teinte: "#85775F" }),
        building({ id: "puits-escalier-de-l-ouest", nom: "Puits-escalier de l'Ouest", canon: "A", archetype: "tour", position: c(1, 6), emprise_m: [11, 11], angle_deg: 0, hauteur_m: 13, etages: 3, toit: "pavillon", couverture: "bardeau", facade: "pierre_brute", teinte: "#85775F" }),
        building({ id: "puits-escalier-de-l-est", nom: "Puits-escalier de l'Est", canon: "A", archetype: "tour", position: c(11, 6), emprise_m: [11, 11], angle_deg: 0, hauteur_m: 13, etages: 3, toit: "pavillon", couverture: "bardeau", facade: "pierre_brute", teinte: "#85775F" }),
        building({ id: "chapelle-des-remontees", nom: "Chapelle des Remontées", canon: "A", archetype: "chapelle", position: c(4, 4), emprise_m: [12, 26], angle_deg: 0, hauteur_m: 11, etages: 1, toit: "pignon", couverture: "tuile_plate", facade: "pierre_brute", teinte: "#8E8068", params: { pente: 34 } }),
        building({ id: "dispensaire-des-lampistes", nom: "Dispensaire des Lampistes", canon: "A", archetype: "clinique", position: c(3, 7), emprise_m: [36, 18], angle_deg: 0, hauteur_m: 9, etages: 2, toit: "plat", couverture: "terrasse", facade: "enduit", teinte: "#9A8A6E", params: { pente: 22 } }),
        building({ id: "fabrique-de-lampes", nom: "Fabrique de lampes", canon: "A", archetype: "usine", position: c(2, 5), emprise_m: [42, 22], angle_deg: 0, hauteur_m: 10, etages: 2, toit: "plat", couverture: "terrasse", facade: "brique", teinte: "#74644E", params: { cheminees: 1, pente: 22 } }),
        building({ id: "forges-du-boyau", nom: "Forges du Boyau", canon: "A", archetype: "atelier", position: c(1, 4), emprise_m: [30, 16], angle_deg: 0, hauteur_m: 8, etages: 1, toit: "appentis", couverture: "bardeau", facade: "pierre_brute", teinte: "#6A5C48", params: { pente: 24 } }),
        building({ id: "maison-des-anciens", nom: "Maison des Anciens", canon: "A", archetype: "hotel_de_ville", position: c(7, 3), emprise_m: [36, 20], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "plat", couverture: "terrasse", facade: "pierre_brute", teinte: "#948568", params: { pente: 22 } }),
        building({ id: "ecole-des-remontees", nom: "École des Remontées", canon: "A", archetype: "ecole", position: c(4, 8), emprise_m: [34, 18], angle_deg: 0, hauteur_m: 8, etages: 2, toit: "plat", couverture: "terrasse", facade: "enduit", teinte: "#92826A", params: { pente: 22 } }),
        building({ id: "auberge-du-puits", nom: "Auberge du Puits", canon: "A", archetype: "maison", position: c(9, 6), emprise_m: [22, 14], angle_deg: 0, hauteur_m: 9, etages: 3, toit: "pignon_rue", couverture: "bardeau", facade: "bois", teinte: "#7E6C54" }),
        building({ id: "entrepots-de-la-remonte-1", nom: "Entrepôts de la Remonte", canon: "A", archetype: "entrepot", position: c(9, 10), emprise_m: [60, 28], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "plat", couverture: "terrasse", facade: "pierre_brute", teinte: "#6E6048", params: { pente: 22 } }),
        building({ id: "entrepots-de-la-remonte-2", nom: "Entrepôts du Sel", canon: "A", archetype: "entrepot", position: c(10, 10), emprise_m: [54, 26], angle_deg: 0, hauteur_m: 10, etages: 3, toit: "plat", couverture: "terrasse", facade: "brique", teinte: "#625540", params: { pente: 22 } }),
        building({ id: "grenier-souterrain", nom: "Grenier souterrain", canon: "A", archetype: "grenier", position: c(7, 9), emprise_m: [46, 22], angle_deg: 0, hauteur_m: 12, etages: 3, toit: "plat", couverture: "terrasse", facade: "pierre_brute", teinte: "#7A6A50", params: { pente: 22 } }),
        building({ id: "reservoir-des-eaux", nom: "Réservoir des Eaux", canon: "A", archetype: "fontaine", position: c(11, 3), emprise_m: [14, 14], angle_deg: 0, hauteur_m: 5, etages: 1, toit: "plat", couverture: "terrasse", facade: "pierre_brute", teinte: "#8A7C66" }),
        building({ id: "poste-de-garde-de-l-escalier-du-sud", nom: "Poste de garde de l'Escalier du Sud", canon: "A", archetype: "caserne", position: c(5, 11), emprise_m: [26, 14], angle_deg: 0, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "tuile_plate", facade: "pierre_brute", teinte: "#8A7C66", params: { cour: false, pente: 28 } }),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return {
        alignements: [],
        isoles: [
          { position: pt(0, -420), essence: "fruitier", hauteur_m: 7, nom: "Poirier du Parvis" },
          { position: pt(150, 235), essence: "fruitier", hauteur_m: 6, nom: "Figuier du Marché" },
        ],
        parcs,
        vergers: [],
        haies: [],
        potagers: [],
        essences_cours: ["fruitier", "saule"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-500, 250], [-200, -160], [300, -100], [200, 340], [-100, 400], [500, 250]]), fontaines: pts([[150, 95], [0, -440], [-495, -55]]) }),
    points_de_vue() {
      return [
        { id: "marche-noir", nom: "Place et halle du Marché noir", oeil: [150, 195, 2.4], cible: [150, 95, 6], fov: 62 },
        { id: "grand-escalier", nom: "Grand Escalier et son parvis", oeil: [0, -380, 2.4], cible: [0, -470, 9], fov: 60 },
        { id: "grande-galerie", nom: "Grande Galerie vers le nord", oeil: [-50, 420, 2], cible: [-50, -200, 6], fov: 58 },
        { id: "puits-de-lumiere", nom: "Jardin sous un puits de lumière", oeil: [-300, -220, 2.4], cible: [-400, -360, 5], fov: 60 },
      ];
    },
    etats() {
      return [
        { id: "845-ordinaire", nom: "845, la ville souterraine en temps ordinaire", date: "845", canon: "A", sources: [{ ref: "état ordinaire (adaptation) ; marché noir et contrebande [C] (atlas 06 I06)", canon: "A" }], portes: {}, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "brumeux", habitants: 1 },
        {
          id: "850-coup-d-etat",
          nom: "850, journée du coup d'État",
          date: "850",
          canon: "A",
          sources: [
            { ref: "docs/spec/01 (850 : coup d'État mené par le Corps de Reconnaissance) [C], ordre des faits [?] ; effets sous terre : adaptation (aucune destruction)", canon: "C" },
            { ref: "galeries désertées, marché fermé : adaptation", canon: "A" },
          ],
          portes: {},
          ruines: [],
          incendies: [],
          rochers: [],
          abandon: 0.05,
          ciel: "enfume",
          habitants: 0.5,
        },
      ];
    },
  });
  // Vue d'ensemble plus proche que la vue de base (la caverne est sombre et le voile des lanternes masque les grandes distances).
  base.points_de_vue = base.points_de_vue.map((v) => (v.id === "ensemble" ? { ...v, oeil: [-720, 940, 520], cible: [0, 40, 0], fov: 60 } : v));
  return base;
}
