import type { Gabarit, Place } from "../../../data/placeSchema";
import { pt } from "./kit";
import { BASE_GABARITS, pts } from "./maria";
import { buildEnclos } from "./enclos";
import { building, cellKey, claimRect, lines, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * Camp d'entraînement du Corps d'entraînement (C15, tranche 2) — plan d'auteur d'un lieu sans enceinte. Établi [C] : le Corps
 * d'entraînement forme les recrues par promotions annuelles (fichier 01 §5) ; le camp d'entraînement existe (atlas 06 S08 : « Corps
 * d'Entraînement », recrues, rang 2) et la 104e promotion est formée avant 850 ; son emplacement exact n'est pas établi `[?]`
 * (fichiers 01 et 11, questions ouvertes : « localisation du camp d'entraînement »). La province `prov_camp_entrainement`
 * (garnison de 400 soldats du Corps d'entraînement, `scn_sandbox_845`) le place dans l'anneau de Rose, au nord-ouest dans la carte
 * du jeu `[A]`. Tout le reste est une adaptation [A] : tracé, noms, dimensions, quartiers, bâtiments.
 *
 * Parti d'auteur [A] : un camp de caserne ouvert, sans mur, sur un damier de 70 m — dortoirs des recrues au nord, grand champ de
 * manœuvre au centre, commandement, chapelle et logements des instructeurs à l'ouest, écuries, manège et magasins à l'est, réfectoire,
 * infirmerie et magasin des équipements au sud, bois d'entraînement au nord-est, entrée au sud. Population : 9 % de celle de
 * `prov_camp_entrainement` (17 391 au scénario 845) : recrues de la promotion en cours, instructeurs et personnel, dont les 400
 * soldats de la garnison du camp.
 */
const S = lines(-420, 420, 70, 9);
const T = lines(-280, 280, 70, 9);
const sv = (i: number): number => -420 + 70 * i;
const tv = (j: number): number => -280 + 70 * j;

const GABARITS: Record<string, Gabarit> = {
  dortoirs: { ...(BASE_GABARITS.garnison as Gabarit), etages: [2, 2], hauteur_etage_m: 3.2, parcelles_m: [16, 20, 14], profondeur_m: 11, cour: { type: "pavee", arbres_par_ha: 45 } },
  commandement: { ...(BASE_GABARITS.garnison as Gabarit), teintes: ["#DDD6C6", "#D2CBB9"], cour: { type: "plantee", arbres_par_ha: 60 } },
  magasins: { etages: [1, 2, 1], hauteur_etage_m: 3.8, toits: ["pignon", "croupe", "pignon"], pente_deg: [32, 42], couvertures: ["tuile_plate", "ardoise", "tuile_canal"], facades: ["bois", "brique", "pierre_brute"], teintes: ["#C9BDA3", "#BFB399", "#CFC3AB", "#C3B79D"], parcelles_m: [18, 24, 16], profondeur_m: 14, boutiques: false, passage_m: 0, cour: { type: "pavee", arbres_par_ha: 40 } },
  logements: { etages: [1, 2, 2], hauteur_etage_m: 3, toits: ["pignon", "croupe", "pignon"], pente_deg: [38, 48], couvertures: ["tuile_plate", "ardoise", "bardeau"], facades: ["enduit", "colombage", "brique"], teintes: ["#E2D6BF", "#D9CCB2", "#E6DAC4", "#D2C5AB"], parcelles_m: [9, 11, 8], profondeur_m: 10, boutiques: false, passage_m: 0, cour: { type: "jardin", arbres_par_ha: 90 } },
};

const Q = {
  dortoirs: quarter("casernements-des-recrues", "Casernements des recrues", "dortoirs", "caserne", 0.8),
  commandement: quarter("commandement-et-instructeurs", "Commandement et logements des instructeurs", "commandement", "administration", 0.7),
  logements: quarter("logements-des-instructeurs", "Logements des instructeurs", "logements", "habitation", 0.7),
  ecuries: quarter("ecuries-et-manege", "Écuries et manège", "magasins", "entrepot", 0.8),
  services: quarter("services-du-camp", "Réfectoire, infirmerie et magasins", "magasins", "entrepot", 0.8),
};

const claims: Record<string, Claim> = {};
// Champ de manœuvre : 4 × 3 cellules au centre (280 m × 210 m).
claimRect(claims, S, T, sv(4), sv(8), tv(2), tv(5), { kind: "place", id: "champ-de-manoeuvre", nom: "Champ de manœuvre", revetement: "terre", fontaine: false, marche: false });
claimRect(claims, S, T, sv(1), sv(2), tv(5), tv(6), { kind: "place", id: "cour-du-refectoire", nom: "Cour du réfectoire", revetement: "gravier", fontaine: true, marche: false });
// Bois d'entraînement au nord-est.
claimRect(claims, S, T, sv(8), sv(12), tv(0), tv(2), { kind: "parc", id: "bois-d-entrainement", nom: "Bois d'entraînement", essences: ["pin", "chene", "bouleau"], arbres_par_ha: 95 });
claimRect(claims, S, T, sv(9), sv(12), tv(6), tv(8), { kind: "parc", id: "pre-des-chevaux", nom: "Pré des chevaux", essences: ["chene", "peuplier", "saule"], arbres_par_ha: 40 });
claimRect(claims, S, T, sv(4), sv(6), tv(6), tv(8), { kind: "parc", id: "jardin-du-camp", nom: "Jardin du camp", essences: ["tilleul", "marronnier", "fruitier"], arbres_par_ha: 60 });
claims[cellKey(S, T, sv(0), tv(2))] = { kind: "ilot", fonction: "culte", densite: 0.5, quartier: Q.commandement.id, gabarit: "commandement" };

/** Noms de rues du camp : tous créés [A]. */
const NOMS_S = [
  "Allée des Recrues", "Allée de la Revue", "Allée des Instructeurs", "Allée du Clairon", "Allée des Sergents", "Allée du Rassemblement", "Allée de la Promotion", "Allée du Serment", "Allée des Gardes", "Allée des Sentinelles",
  "Allée du Manège", "Allée des Chevaux", "Allée de la Remise",
];
const NOMS_T = ["Rue du Réveil", "Rue des Dortoirs", "Rue du Champ", "Rue de la Revue", "Rue de l'Exercice", "Rue du Réfectoire", "Rue de l'Infirmerie", "Rue de l'Entrée", "Rue de la Garde"];

export function campEntrainement(): Place {
  return buildEnclos({
    id: "camp-entrainement",
    nom: "Camp d'entraînement",
    libelle: "Camp d'entraînement du Corps d'entraînement",
    canon: "C",
    sources: [
      { ref: "docs/spec/01 §5 et docs/spec/06 S08 : Corps d'Entraînement, camp d'entraînement (recrues, rang 2), promotions annuelles [C] ; 104e promotion formée avant 850 [C]", canon: "C" },
      { ref: "docs/spec/01 §10 et docs/spec/11 : localisation exacte du camp d'entraînement non établie [?] ; data/scenarios/sandbox_845.json : garnison de 400 soldats du Corps d'entraînement à `prov_camp_entrainement`", canon: "?" },
      { ref: "tracé, noms de rues et de bâtiments, dimensions, quartiers : adaptation (création C15, `docs/lore/creations.md`)", canon: "A" },
    ],
    province: "prov_camp_entrainement",
    style: "E24",
    population: { province: "prov_camp_entrainement", part: 0.09, canon: "A", note: "9 % de la population de `prov_camp_entrainement` au départ de scn_sandbox_845 (17 391 hab.) : recrues de la promotion en cours, instructeurs et personnel, dont les 400 soldats de la garnison du camp ; la province existe [C], la part est adaptée [A]." },
    densite: { classe: "village", valeur: 45, canon: "A" },
    orientation: { valeur: "aucune", canon: "?" },
    s: S,
    t: T,
    names: { s: NOMS_S, t: NOMS_T, lanes: ["Sentier des Cibles", "Sentier du Bois"] },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      if (c[1] < -200) return Q.dortoirs.id;
      if (c[0] < -140) return c[1] < 90 ? Q.commandement.id : Q.services.id;
      if (c[0] > 140) return Q.ecuries.id;
      if (c[1] > 90) return Q.services.id;
      return Q.dortoirs.id;
    },
    claims,
    marge_m: 45,
    etendue_m: 1400,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      return [
        ...[1, 3, 5, 7].map((i, k) =>
          building({ id: `dortoir-${k + 1}`, nom: `Dortoir ${k + 1} des recrues`, canon: "A", archetype: "caserne", position: c(i, 0), emprise_m: [56, 18], angle_deg: 0, hauteur_m: 9, etages: 2, toit: "pignon", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { cour: false, pente: 36 } }),
        ),
        building({ id: "etat-major-du-camp", nom: "Commandement du camp", canon: "A", archetype: "hotel_de_ville", position: c(2, 3), emprise_m: [32, 18], angle_deg: 0, hauteur_m: 12, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E0D9C8", params: { pente: 44 }, reperes_canon: ["Corps d'entraînement : camp existant [C] (atlas 06 S08) ; le bâtiment du commandement est une adaptation"] }),
        building({ id: "chapelle-du-camp", nom: "Chapelle du camp", canon: "A", archetype: "chapelle", position: c(0, 2), emprise_m: [12, 24], angle_deg: 0, hauteur_m: 10, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_brute", teinte: "#DDD6C6", params: { pente: 48 } }),
        building({ id: "refectoire", nom: "Réfectoire et cuisines", canon: "A", archetype: "halle", position: c(2, 6), emprise_m: [54, 20], angle_deg: 0, hauteur_m: 9, etages: 1, toit: "croupe", couverture: "tuile_plate", facade: "brique", teinte: "#C9B79A", params: { piliers: 8, pente: 38 } }),
        building({ id: "infirmerie", nom: "Infirmerie du camp", canon: "A", archetype: "clinique", position: c(3, 6), emprise_m: [36, 16], angle_deg: 0, hauteur_m: 8, etages: 2, toit: "croupe", couverture: "ardoise", facade: "enduit", teinte: "#EDE6D6", params: { pente: 40 } }),
        building({ id: "magasin-des-equipements", nom: "Magasin des équipements de manœuvre", canon: "A", archetype: "arsenal", position: c(6, 6), emprise_m: [46, 22], angle_deg: 0, hauteur_m: 9, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#BFB6A4", params: { pente: 36 }, reperes_canon: ["équipement de manœuvre tridimensionnelle [C] (fichier 01) : le magasin est une adaptation"] }),
        building({ id: "manege", nom: "Manège couvert", canon: "A", archetype: "ecurie", position: c(10, 3), emprise_m: [60, 24], angle_deg: 0, hauteur_m: 10, etages: 1, toit: "pignon", couverture: "tuile_plate", facade: "bois", teinte: "#BCA682", params: { pente: 34 } }),
        building({ id: "ecuries-du-camp", nom: "Écuries du camp", canon: "A", archetype: "ecurie", position: c(10, 5), emprise_m: [56, 20], angle_deg: 0, hauteur_m: 8, etages: 1, toit: "pignon", couverture: "tuile_plate", facade: "bois", teinte: "#B9A37F", params: { pente: 38 } }),
        building({ id: "tour-d-exercice", nom: "Tour d'exercice", canon: "A", archetype: "tour", position: pt(180, -100), emprise_m: [9, 9], angle_deg: 0, hauteur_m: 22, etages: 5, toit: "pavillon", couverture: "ardoise", facade: "pierre_brute", teinte: "#CDC6B6" }),
        building({ id: "corps-de-garde-de-l-entree", nom: "Corps de garde de l'entrée", canon: "A", archetype: "caserne", position: pt(-60, 246), emprise_m: [24, 12], angle_deg: 0, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { pente: 40 } }),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return {
        alignements: [
          { rue: `s-${S.findIndex(([v]) => v === sv(6))}`, essence: "tilleul", intervalle_m: 12, cotes: "deux" },
          { rue: `t-${T.findIndex(([v]) => v === tv(7))}`, essence: "marronnier", intervalle_m: 14, cotes: "deux" },
        ],
        isoles: [
          { position: pt(-150, 60), essence: "chene", hauteur_m: 24, nom: "Chêne du serment" },
          { position: pt(0, 215), essence: "tilleul", hauteur_m: 20, nom: "Tilleul de l'entrée" },
        ],
        parcs,
        vergers: [{ polygone: pts([[-470, 300], [-300, 300], [-300, 380], [-470, 380]]), espacement_m: 8 }],
        haies: [{ trace: pts([[-470, 390], [470, 390]]) }],
        potagers: [{ polygone: pts([[-300, 300], [-150, 300], [-150, 380], [-300, 380]]) }],
        essences_cours: ["tilleul", "marronnier", "erable", "fruitier"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-250, 120], [250, 80], [-60, -230]]), fontaines: pts([[-315, 245]]) }),
    points_de_vue() {
      return [
        { id: "champ-de-manoeuvre", nom: "Champ de manœuvre et dortoirs", oeil: [0, 190, 3], cible: [0, -190, 8], fov: 62 },
        { id: "dortoirs", nom: "Dortoirs des recrues", oeil: [-250, -150, 2.5], cible: [-100, -245, 6], fov: 60 },
        { id: "ecuries-et-manege", nom: "Manège et écuries", oeil: [290, 130, 4], cible: [330, 20, 6], fov: 60 },
        { id: "entree-du-camp", nom: "Entrée du camp et réfectoire", oeil: [0, 340, 3], cible: [-100, 200, 7], fov: 60 },
      ];
    },
    etats() {
      const etats: Place["etats"] = [
        { id: "845-ordinaire", nom: "845, le camp en temps ordinaire", date: "845", canon: "A", sources: [{ ref: "état ordinaire du camp ; garnison de 400 soldats du Corps d'entraînement (data/scenarios/sandbox_845.json)", canon: "A" }], portes: {}, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 1 },
        {
          id: "850-apres-la-promotion",
          nom: "850, après le départ de la 104e promotion",
          date: "850",
          canon: "?",
          sources: [
            { ref: "docs/spec/01 (850 : Trost, 104e promotion) : la promotion quitte le camp avant la bataille de Trost [C] ; effectifs restants et état du camp : non établis [?]", canon: "?" },
            { ref: "effectifs réduits, brume : adaptation", canon: "A" },
          ],
          portes: {},
          ruines: [],
          incendies: [],
          rochers: [],
          abandon: 0.1,
          ciel: "brumeux",
          habitants: 0.45,
        },
      ];
      return etats;
    },
  });
}
