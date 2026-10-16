import type { Gabarit, Place } from "../../../data/placeSchema";
import { buildEnclos } from "./enclos";
import { pt } from "./kit";
import { pts } from "./maria";
import { authored, building, claimRect, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * Chapelle Reiss (C16, tranche 2) — plan d'auteur du site de surface d'un lieu isolé. Établi [C] : la chapelle de la famille Reiss existe
 * (fichier 01 : 850, « chapelle de la famille Reiss » ; atlas 06 I07 « Domaine Reiss / chapelle souterraine », T13 ; `prov_domaine_reiss`
 * et `poi_chapelle_reiss` dans `data/provinces/paradis.json`, province sans population de la simulation) ; sa localisation exacte est
 * non établie [?] (fichiers 01 §10, 11 §9) ; `data/geo/paradis.json` la place à l'intérieur de Sina, au nord-ouest de Mitras, hors de
 * toute ville. Tout le reste est une adaptation [A] : plan du site, noms, dépendances, effectif.
 *
 * Écart avec le schéma (documenté, `docs/places/chapelle-reiss/lore.md`) : l'atlas et la fiche de style E23 décrivent une chapelle
 * souterraine (crypte à colonnes, autel, bougies). Le schéma de lieu n'a pas de sous-sol : seul le site de surface est posé (chapelle
 * de pierre, dépendances, jardin clos, bois, allée), et la crypte reste un lieu souterrain non modélisé (dette). Aucun secret du lieu
 * n'est montré. Le lieu est de niveau N1 (plan d'auteur) et non N2 : le générateur N2 produit des villages-rues, non un domaine isolé.
 *
 * Parti d'auteur [A] : un domaine de 480 m de côté entouré de bois ; au centre un enclos de 240 m (logis du chapelain, chapelle à son
 * parvis, grange, écurie, loge du gardien, buanderie, jardin clos), une allée plantée au sud. Effectif : 38 personnes (chapelain,
 * sacristain, gardien et sa famille, domestiques, jardinier, palefrenier, leurs familles), valeur `?` paramétrable (province sans population).
 */
const XS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
const YS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
const S = authored(XS, 3, { 0: 7 });
const T = authored(YS, 3);
const sv = (i: number): number => XS[i] as number;
const tv = (j: number): number => YS[j] as number;

const GABARITS: Record<string, Gabarit> = {
  domaine: { etages: [1, 2, 1], hauteur_etage_m: 3, toits: ["pignon", "croupe", "pignon"], pente_deg: [38, 50], couvertures: ["ardoise", "tuile_plate", "ardoise"], facades: ["pierre_taillee", "pierre_brute", "enduit"], teintes: ["#D2C9B4", "#C9BFA8", "#D8CFBA"], parcelles_m: [14, 18, 12], profondeur_m: 12, boutiques: false, passage_m: 0, cour: { type: "jardin", arbres_par_ha: 60 } },
  communs: { etages: [1, 2], hauteur_etage_m: 3.4, toits: ["pignon", "demi_croupe"], pente_deg: [34, 44], couvertures: ["tuile_plate", "ardoise"], facades: ["pierre_brute", "bois", "enduit"], teintes: ["#C6BBA2", "#BDB197", "#CCC1A8"], parcelles_m: [16, 20, 14], profondeur_m: 12, boutiques: false, passage_m: 0, cour: { type: "pavee", arbres_par_ha: 50 } },
};

const Q = {
  chapelle: quarter("enclos-de-la-chapelle", "Enclos de la chapelle", "domaine", "culte", 0.45),
  communs: quarter("communs-du-domaine", "Communs et logis du domaine", "communs", "habitation", 0.5),
};

const claims: Record<string, Claim> = {};
// Bois du domaine (anneau de huit cellules de 60 m) : quatre massifs, l'allée du sud passe entre deux d'entre eux.
claimRect(claims, S, T, sv(0), sv(8), tv(0), tv(2), { kind: "parc", id: "bois-du-nord", nom: "Bois du Nord", essences: ["chene", "bouleau", "pin"], arbres_par_ha: 70 });
claimRect(claims, S, T, sv(0), sv(2), tv(2), tv(6), { kind: "parc", id: "bois-de-l-ouest", nom: "Bois de l'Ouest", essences: ["chene", "pin", "bouleau"], arbres_par_ha: 66 });
claimRect(claims, S, T, sv(6), sv(8), tv(2), tv(6), { kind: "parc", id: "bois-de-l-est", nom: "Bois de l'Est", essences: ["chene", "bouleau", "pin"], arbres_par_ha: 66 });
claimRect(claims, S, T, sv(0), sv(4), tv(6), tv(8), { kind: "parc", id: "bois-du-sud-ouest", nom: "Bois du Sud-Ouest", essences: ["chene", "pin", "peuplier"], arbres_par_ha: 64 });
claimRect(claims, S, T, sv(4), sv(8), tv(6), tv(8), { kind: "parc", id: "bois-du-sud-est", nom: "Bois du Sud-Est", essences: ["chene", "bouleau", "peuplier"], arbres_par_ha: 64 });
// Enclos : jardin clos au nord, parvis de la chapelle au sud-centre.
claimRect(claims, S, T, sv(2), sv(5), tv(2), tv(3), { kind: "parc", id: "jardin-clos", nom: "Jardin clos", essences: ["fruitier", "tilleul", "marronnier"], arbres_par_ha: 52 });
claimRect(claims, S, T, sv(3), sv(5), tv(4), tv(5), { kind: "place", id: "parvis-de-la-chapelle", nom: "Parvis de la chapelle", revetement: "gravier", fontaine: false, marche: false });

claims["2,5"] = { kind: "vide" };
claims["4,5"] = { kind: "vide" };

const NOMS_S = ["Allée du Domaine"];
const NOMS_T = ["Chemin du Parvis"];

export function chapelleReiss(): Place {
  return buildEnclos({
    id: "chapelle-reiss",
    nom: "Chapelle Reiss",
    libelle: "Chapelle de la famille Reiss",
    canon: "C",
    sources: [
      { ref: "docs/spec/01 (850 : chapelle de la famille Reiss) et docs/spec/06 I07, T13 : Domaine Reiss, chapelle souterraine [C] ; data/provinces/paradis.json : prov_domaine_reiss, poi_chapelle_reiss [C]", canon: "C" },
      { ref: "docs/spec/01 §10 et docs/spec/11 §9 : localisation exacte non établie [?] ; data/geo/paradis.json : position au nord-ouest de Mitras dans Sina [A]", canon: "?" },
      { ref: "plan du site de surface, noms, dépendances, effectif : adaptation (création C16, `docs/lore/creations.md`) ; crypte non modélisée par le schéma (Q27)", canon: "A" },
    ],
    province: "prov_domaine_reiss",
    style: "E23",
    population: { province: null, part: 1, valeur: 38, canon: "?", note: "`prov_domaine_reiss` existe [C] mais sa population de simulation est nulle (pop 0, atlas I07) ; effectif du site de surface : valeur paramétrable `?` (chapelain, sacristain, gardien et famille, domestiques, jardinier, palefrenier et leurs familles)." },
    densite: { classe: "ferme", valeur: 9.5, canon: "A" },
    orientation: { valeur: "aucune", canon: "?" },
    s: S,
    t: T,
    names: { s: NOMS_S, t: NOMS_T, lanes: ["Sentier du Bois", "Sentier de la Source", "Sentier du Parvis", "Sentier des Communs"] },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      return c[0] > 60 || c[1] > 60 ? Q.communs.id : Q.chapelle.id;
    },
    claims,
    marge_m: 20,
    etendue_m: 900,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      return [
        building({ id: "chapelle", nom: "Chapelle de la famille Reiss", canon: "A", archetype: "chapelle", position: c(3, 3), emprise_m: [14, 30], angle_deg: 0, hauteur_m: 13, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D4CAB4", params: { clocher_m: 22, clocher_cote: 5, abside: true, pente: 50 }, reperes_canon: ["chapelle de la famille Reiss [C] (fichier 01, 850 ; poi_chapelle_reiss) : édifice de surface, plan adapté ; la chapelle souterraine [C] n'est pas modélisée"] }),
        building({ id: "logis-du-chapelain", nom: "Logis du chapelain", canon: "A", archetype: "maison", position: c(2, 3), emprise_m: [20, 14], angle_deg: 0, hauteur_m: 8, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D2C9B4" }),
        building({ id: "sacristie", nom: "Sacristie et charnier", canon: "A", archetype: "maison", position: c(4, 3), emprise_m: [16, 12], angle_deg: 0, hauteur_m: 6, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_brute", teinte: "#C9BFA8" }),
        building({ id: "grange-du-domaine", nom: "Grange du domaine", canon: "A", archetype: "grange", position: c(5, 3), emprise_m: [28, 14], angle_deg: 0, hauteur_m: 9, etages: 1, toit: "pignon", couverture: "tuile_plate", facade: "bois", teinte: "#BDB197" }),
        building({ id: "ecurie-du-domaine", nom: "Écurie du domaine", canon: "A", archetype: "ecurie", position: c(5, 2), emprise_m: [26, 12], angle_deg: 0, hauteur_m: 7, etages: 1, toit: "pignon", couverture: "tuile_plate", facade: "pierre_brute", teinte: "#C6BBA2", params: { pente: 38 } }),
        building({ id: "loge-du-gardien", nom: "Loge du gardien", canon: "A", archetype: "maison", position: c(3, 5), emprise_m: [14, 10], angle_deg: 0, hauteur_m: 6.5, etages: 2, toit: "pignon", couverture: "ardoise", facade: "pierre_brute", teinte: "#C9BFA8" }),
        building({ id: "buanderie", nom: "Buanderie et fournil", canon: "A", archetype: "atelier", position: c(5, 4), emprise_m: [20, 12], angle_deg: 0, hauteur_m: 6, etages: 1, toit: "appentis", couverture: "tuile_plate", facade: "pierre_brute", teinte: "#C6BBA2", params: { pente: 30 } }),
        building({ id: "remise", nom: "Remise des voitures", canon: "A", archetype: "grange", position: c(5, 5), emprise_m: [24, 12], angle_deg: 0, hauteur_m: 7, etages: 1, toit: "pignon", couverture: "tuile_plate", facade: "bois", teinte: "#BDB197" }),
        building({ id: "pavillon-du-jardinier", nom: "Pavillon du jardinier", canon: "A", archetype: "maison", position: c(2, 4), emprise_m: [14, 10], angle_deg: 0, hauteur_m: 6, etages: 1, toit: "croupe", couverture: "tuile_plate", facade: "enduit", teinte: "#D8CFBA" }),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return {
        alignements: [{ rue: "s-4-1", essence: "tilleul", intervalle_m: 12, cotes: "deux" }],
        isoles: [
          { position: pt(-60, 20), essence: "chene", hauteur_m: 22, nom: "Chêne du parvis" },
          { position: pt(30, 90), essence: "tilleul", hauteur_m: 18 },
        ],
        parcs,
        vergers: [],
        haies: [{ trace: pts([[-120, -120], [120, -120]]) }],
        potagers: [{ polygone: pts([[-110, -112], [-50, -112], [-50, -70], [-110, -70]]) }],
        essences_cours: ["fruitier", "tilleul"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-100, 40], [90, 0]]), fontaines: [] }),
    points_de_vue() {
      return [
        { id: "facade-de-la-chapelle", nom: "Chapelle et parvis", oeil: [0, 110, 2.2], cible: [-30, -30, 8], fov: 58 },
        { id: "allee-du-domaine", nom: "Allée du domaine vers la chapelle", oeil: [0, 235, 2], cible: [0, 0, 7], fov: 56 },
        { id: "communs", nom: "Grange, écurie et buanderie", oeil: [20, 120, 3], cible: [120, 20, 5], fov: 60 },
        { id: "jardin-clos", nom: "Jardin clos et logis du chapelain", oeil: [-30, -30, 3], cible: [-100, -90, 3], fov: 60 },
      ];
    },
    etats() {
      return [
        { id: "845-ordinaire", nom: "845, le domaine en temps ordinaire", date: "845", canon: "A", sources: [{ ref: "état ordinaire du site (adaptation)", canon: "A" }], portes: {}, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 1 },
        {
          id: "850-domaine-retire",
          nom: "850, le domaine retiré",
          date: "850",
          canon: "?",
          sources: [
            { ref: "docs/spec/01 (850 : chapelle de la famille Reiss) [C] : le lieu intervient en 850, ce qui s'y passe n'est pas posé ici ; effectif réduit, brume : adaptation", canon: "A" },
          ],
          portes: {},
          ruines: [],
          incendies: [],
          rochers: [],
          abandon: 0.1,
          ciel: "brumeux",
          habitants: 0.4,
        },
      ];
    },
  });
}
