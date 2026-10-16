import type { Gabarit, Place } from "../../../data/placeSchema";
import { buildEnclos } from "./enclos";
import { bat, etat, GAB_CHASSE, GAB_FERME } from "./horsmurs";
import { pt } from "./kit";
import { pts } from "./maria";
import { authored, claimRect, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * Dauper (C17, tranche 1) — petit village de chasse du sud de l'intérieur de Rose, plan d'auteur N1. Établi [C] : Dauper est un petit
 * village du sud de l'intérieur de Rose, ressource clé « chasse » (fichiers 01 §3.1 et 11 §2, atlas 06 S10, `prov_dauper`). Aucun lieu
 * N2 n'existait pour lui (`data/places/generated` ne contient que le village des Saules) : plan d'auteur. Tout le reste est une
 * adaptation [A] : tracé, noms, bâtiments, part de population, états.
 *
 * Parti d'auteur [A] : un hameau de lisière entouré de bois (800 m de côté), place du Rendez-vous au centre (étal des peaux),
 * chapelle à l'ouest, pavillon de chasse et auberge à l'est, chenil, fumoir et forge au sud, scierie au nord-ouest, fermes en bordure.
 * Population : 8 % de `prov_dauper` (8 696 au scénario 845), le reste en cabanes et fermes isolées (adaptation) ; densité 25 hab/ha.
 */
const XS = [-400, -262, -157, -52, 52, 157, 262, 400];
const YS = [-400, -262, -160, -52, 52, 160, 262, 400];
const S = authored(XS, 5, { 52: 8, [-157]: 6, 262: 6 });
const T = authored(YS, 5, { 52: 8, [-160]: 6, 262: 6 });
const sv = (i: number): number => XS[i] as number;
const tv = (j: number): number => YS[j] as number;

const GABARITS: Record<string, Gabarit> = { chasse: GAB_CHASSE, ferme: GAB_FERME };
const Q = {
  hameau: quarter("hameau-du-rendez-vous", "Hameau du Rendez-vous", "chasse", "habitation", 0.8),
  lisiere: quarter("lisiere-et-fermes", "Lisière et fermes", "ferme", "habitation", 0.55),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(3), sv(4), tv(3), tv(4), { kind: "place", id: "place-du-rendez-vous", nom: "Place du Rendez-vous", revetement: "terre", fontaine: false, marche: true });
const BOIS: [string, string, number, number, number, number, ("chene" | "pin" | "bouleau")[]][] = [
  ["bois-du-nord", "Bois du Nord", 0, 7, 0, 1, ["chene", "pin", "bouleau"]],
  ["bois-du-sud", "Bois du Sud", 0, 7, 6, 7, ["chene", "bouleau", "pin"]],
  ["bois-de-l-ouest", "Bois de l'Ouest", 0, 1, 1, 6, ["pin", "chene", "pin"]],
  ["bois-de-l-est", "Bois de l'Est", 6, 7, 1, 6, ["chene", "pin", "bouleau"]],
];
for (const [id, nom, i0, i1, j0, j1, essences] of BOIS) claimRect(claims, S, T, sv(i0), sv(i1), tv(j0), tv(j1), { kind: "parc", id, nom, essences, arbres_par_ha: 52 });
claimRect(claims, S, T, sv(1), sv(2), tv(4), tv(5), { kind: "parc", id: "pre-des-chiens", nom: "Pré des chiens", essences: ["fruitier", "bouleau", "saule"], arbres_par_ha: 36 });

const NOMS_S = ["Sentier de l'Ouest", "Rue du Gibier", "Rue des Piqueurs", "Rue du Rendez-vous", "Rue des Fourreurs", "Rue des Fumoirs", "Sentier de l'Est", "Sentier des Bois"];
const NOMS_T = ["Sentier du Nord", "Rue des Veneurs", "Rue des Traqueurs", "Rue des Peaux", "Rue des Affûts", "Rue des Sangliers", "Sentier du Sud", "Sentier des Pièges"];

export function dauper(): Place {
  return buildEnclos({
    id: "dauper",
    nom: "Dauper",
    libelle: "Dauper (petit village de chasse du sud de l'intérieur de Rose)",
    canon: "C",
    sources: [
      { ref: "docs/spec/01 §3.1 et docs/spec/11 §2 : Dauper, petit village du sud de l'intérieur de Rose [C] ; docs/spec/06 S10 (ressource clé : chasse) ; data/provinces/paradis.json : prov_dauper [C]", canon: "C" },
      { ref: "tracé, noms, bâtiments, part de population, états : adaptation (création C17, `docs/lore/creations.md`)", canon: "A" },
    ],
    province: "prov_dauper",
    style: "E11",
    population: { province: "prov_dauper", part: 0.08, canon: "A", note: "8 % de la population de `prov_dauper` au départ de scn_sandbox_845 (8 696 hab.) logés dans le hameau ; le reste de la province vit en cabanes et fermes isolées ; la province existe [C], la part est adaptée [A]." },
    densite: { classe: "village", valeur: 25, canon: "A" },
    orientation: { valeur: "sud", canon: "C" },
    s: S,
    t: T,
    names: { s: NOMS_S, t: NOMS_T, lanes: ["Ruelle des Fumoirs", "Sentier des Chiens", "Ruelle des Cuirs", "Sentier de la Harde", "Ruelle du Bois sec", "Sentier des Pièces"] },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      return Math.abs(c[0]) < 160 && Math.abs(c[1]) < 160 ? Q.hameau.id : Q.lisiere.id;
    },
    claims,
    marge_m: 30,
    etendue_m: 1000,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      return [
        bat("chapelle", "Chapelle du Rendez-vous", "chapelle", c(2, 3), [12, 22], 9, 1, "pignon", "bardeau", "pierre_brute", "#D8CFBA", { params: { clocher_m: 16, clocher_cote: 4, abside: false, pente: 48 } }),
        bat("pavillon-de-chasse", "Pavillon de chasse", "maison", c(4, 2), [24, 14], 8, 2, "croupe", "ardoise", "colombage", "#D9CCAE", { params: { pente: 46 } }),
        bat("auberge-des-chasseurs", "Auberge des Chasseurs", "maison", c(4, 3), [26, 14], 8, 2, "croupe", "bardeau", "bois", "#C9B993", { params: { pente: 44 } }),
        bat("poste-du-garde-chasse", "Poste du garde-chasse", "maison", c(3, 2), [16, 11], 6, 1, "pignon", "bardeau", "bois", "#BEAE88", { params: { pente: 42 } }),
        bat("etal-des-peaux", "Étal des peaux", "halle", [0, 0], [20, 9], 5, 1, "appentis", "bardeau", "bois", "#C2A57E", { params: { piliers: 4, pente: 30 } }),
        bat("fumoir-et-sechoir", "Fumoir et séchoir à viande", "atelier", c(2, 4), [22, 12], 7, 1, "pignon", "bardeau", "bois", "#B8A682", { params: { pente: 38 } }),
        bat("chenil", "Chenil du village", "ecurie", c(3, 4), [28, 12], 5, 1, "pignon", "bardeau", "bois", "#BCAD88", { params: { pente: 34 } }),
        bat("forge", "Forge de Dauper", "atelier", c(4, 4), [20, 12], 6, 1, "appentis", "tuile_plate", "pierre_brute", "#C3B79F", { params: { pente: 30 } }),
        bat("scierie", "Scierie de la lisière", "atelier", c(1, 2), [30, 16], 8, 1, "pignon", "bardeau", "bois", "#B4A47E", { params: { pente: 32 } }),
        bat("ferme-de-la-lisiere", "Ferme de la lisière", "ferme", c(5, 3), [26, 15], 8, 2, "pignon", "chaume", "pierre_brute", "#CDBF9F", { params: { pente: 40 } }),
        bat("grange-aux-fourrages", "Grange aux fourrages", "grange", c(5, 5), [24, 12], 8, 1, "pignon", "chaume", "bois", "#BDB197", { params: { pente: 38 } }),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return {
        alignements: [{ rue: "s-3", essence: "chene", intervalle_m: 14, cotes: "deux" }],
        isoles: [
          { position: pt(-30, -30), essence: "chene", hauteur_m: 24, nom: "Chêne du Rendez-vous" },
          { position: pt(40, 35), essence: "bouleau", hauteur_m: 15 },
        ],
        parcs,
        vergers: [],
        haies: [{ trace: pts([[-300, 300], [300, 300]]) }],
        potagers: [{ polygone: pts([[-150, 80], [-100, 80], [-100, 120], [-150, 120]]) }],
        essences_cours: ["fruitier", "bouleau", "chene"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-100, -110], [100, 100]]), fontaines: [] }),
    points_de_vue() {
      return [
        { id: "place-du-rendez-vous", nom: "Place du Rendez-vous, auberge et chapelle", oeil: [20, 100, 3], cible: [-40, -20, 6], fov: 62 },
        { id: "pavillon-de-chasse", nom: "Pavillon de chasse et lisière", oeil: [60, -20, 3], cible: [105, -105, 6], fov: 60 },
        { id: "fumoir-et-chenil", nom: "Fumoir, chenil et forge", oeil: [-40, 100, 3], cible: [60, 105, 5], fov: 60 },
        { id: "scierie", nom: "Scierie de la lisière", oeil: [-100, -60, 4], cible: [-210, -110, 6], fov: 60 },
      ];
    },
    etats() {
      return [
        etat({ id: "845-ordinaire", nom: "845, le village en temps ordinaire", date: "845", sources: [{ ref: "état ordinaire du village (adaptation)", canon: "A" }], ruines: [], incendies: [], abandon: 0, ciel: "clair", habitants: 1 }),
        etat({ id: "845-automne-de-battue", nom: "845, automne : jour de battue", date: "845", sources: [{ ref: "saison de chasse (ressource clé : chasse [C], atlas 06 S10) : brume d'automne, hommes aux bois, adaptation", canon: "A" }], ruines: [], incendies: [], abandon: 0, ciel: "brumeux", habitants: 0.6 }),
      ];
    },
  });
}
