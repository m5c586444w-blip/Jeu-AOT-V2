import type { Gabarit, Place } from "../../../data/placeSchema";
import { buildEnclos } from "./enclos";
import { bat, etat, GAB_FERME } from "./horsmurs";
import { pt } from "./kit";
import { pts } from "./maria";
import { authored, claimRect, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * Ferme de campagne (C17, tranche 2) — ferme type de l'intérieur de Wall Maria, plan d'auteur N1, petit lieu. Établi [C] : rien de précis sur
 * ce lieu ; l'anneau de Maria compte des « terres agricoles avant 845 » et sa population est évacuée après la chute de Maria en 845 (atlas 06
 * R03, R07, note « scénario 845+ » ; `prov_plaines_interieures_maria_sud` [A]). Tout le reste est une adaptation [A] : plan, noms,
 * dimensions, effectif, états.
 *
 * Parti d'auteur [A] : une ferme à cour fermée de 300 m × 260 m de côté, corps de ferme, étable, grange, fournil, porcherie et pigeonnier autour
 * d'une cour de terre ; verger à l'ouest, champs et bocage au nord, à l'est et au sud ; mare à l'angle nord-est (voie d'eau de type canal : le
 * schéma ne connaît pas d'étang). Population : 22 habitants, soit une famille de métayers et ses valets (part de
 * `prov_plaines_interieures_maria_sud`, 34 783 au scénario 845, province agricole) ; densité « ferme » 9,5 hab/ha.
 */
const XS = [-150, -100, -50, 10, 70, 150];
const YS = [-130, -90, -30, 30, 90, 130];
const S = authored(XS, 5, { [-50]: 8, 70: 8 });
const T = authored(YS, 5);
const sv = (i: number): number => XS[i] as number;
const tv = (j: number): number => YS[j] as number;

const GABARITS: Record<string, Gabarit> = { ferme: GAB_FERME };
const Q = {
  cour: quarter("cour-de-la-ferme", "Cour de la ferme", "ferme", "habitation", 0.9),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(2), sv(4), tv(2), tv(3), { kind: "place", id: "cour-de-la-ferme", nom: "Cour de la ferme", revetement: "terre", fontaine: false, marche: false });
const CH = { essences: ["chene", "saule", "fruitier"] as ("chene" | "saule" | "fruitier")[], arbres_par_ha: 24 };
claimRect(claims, S, T, sv(0), sv(5), tv(0), tv(1), { kind: "parc", id: "champs-du-nord", nom: "Champs du Nord", ...CH });
claimRect(claims, S, T, sv(0), sv(5), tv(4), tv(5), { kind: "parc", id: "champs-du-sud", nom: "Champs du Sud", ...CH });
claimRect(claims, S, T, sv(4), sv(5), tv(1), tv(4), { kind: "parc", id: "champs-de-l-est", nom: "Champs de l'Est", ...CH });
claimRect(claims, S, T, sv(0), sv(2), tv(1), tv(4), { kind: "parc", id: "verger-de-la-ferme", nom: "Verger de la ferme", essences: ["fruitier", "fruitier", "tilleul"], arbres_par_ha: 70 });

export function fermeCampagne(): Place {
  return buildEnclos({
    id: "ferme-campagne",
    nom: "Ferme de campagne",
    libelle: "Ferme de campagne (plaines intérieures de Wall Maria)",
    canon: "A",
    sources: [
      { ref: "docs/spec/06 R03 et R07 : plaines agricoles de l'anneau de Maria, population évacuée après la chute de Maria en 845 (note « scénario 845+ ») ; data/provinces/paradis.json : prov_plaines_interieures_maria_sud [A]", canon: "A" },
      { ref: "plan, noms, dimensions, effectif, états : adaptation (création C17, `docs/lore/creations.md`)", canon: "A" },
    ],
    province: "prov_plaines_interieures_maria_sud",
    style: "E11",
    population: { province: "prov_plaines_interieures_maria_sud", part: 0.000632, canon: "A", note: "22 habitants (famille de métayers et valets) : part de `prov_plaines_interieures_maria_sud` (34 783 au départ de scn_sandbox_845), province agricole ; la part est adaptée [A], le reste de la province vit en fermes et hameaux hors de ce lieu." },
    densite: { classe: "ferme", valeur: 9.5, canon: "A" },
    orientation: { valeur: "aucune", canon: "?" },
    s: S,
    t: T,
    names: { s: ["Chemin de l'Étable", "Chemin de la Grange"], t: [], lanes: ["Chemin du Verger", "Chemin des Champs", "Chemin de la Mare", "Chemin de l'Aire", "Chemin des Bœufs", "Chemin du Fournil", "Sentier des Haies", "Sentier du Puits", "Chemin des Labours", "Sentier de la Meule", "Chemin du Colombier", "Sentier des Saules"] },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt: () => Q.cour.id,
    claims,
    marge_m: 20,
    etendue_m: 600,
    extraStreets: () => [{ id: "chemin-de-la-ferme", nom: "Chemin de la ferme", canon: "A", type: "route", trace: pts([[40, 148], [40, 120], [40, 92]]), largeur_m: 7, revetement: "gravier" }],
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      const [nx, ny] = c(2, 1);
      const [sx, sy] = c(2, 3);
      const [ex, ey] = c(3, 1);
      const [fx, fy] = c(3, 3);
      return [
        bat("corps-de-ferme", "Corps de ferme", "ferme", [sx - 4, sy + 6], [32, 13], 8, 2, "pignon", "tuile_plate", "pierre_brute", "#CDBF9F", { params: { pente: 42 } }),
        bat("maison-du-metayer", "Maison du métayer", "maison", [fx - 6, fy + 8], [14, 10], 6, 1, "pignon", "chaume", "colombage", "#D2C6A8", { params: { pente: 44 } }),
        bat("fournil", "Fournil et four à pain", "atelier", [fx + 12, fy - 6], [10, 8], 5, 1, "appentis", "tuile_plate", "pierre_brute", "#C2B393", { params: { pente: 30 } }),
        bat("etable", "Étable et écurie", "ecurie", [nx, ny - 8], [34, 13], 7, 1, "pignon", "tuile_plate", "pierre_brute", "#C2B393", { params: { pente: 38 } }),
        bat("porcherie", "Porcherie et poulailler", "atelier", [nx, ny + 10], [18, 7], 3, 1, "appentis", "bardeau", "bois", "#BDB197", { params: { pente: 26 } }),
        bat("pigeonnier", "Pigeonnier", "tour", [nx - 22, ny + 10], [5, 5], 8, 2, "pavillon", "tuile_plate", "pierre_brute", "#CDBF9F"),
        bat("grange", "Grange aux grains", "grange", [ex, ey - 6], [30, 18], 10, 1, "pignon", "chaume", "bois", "#BDB197", { params: { pente: 40 } }),
        bat("remise-aux-chariots", "Remise aux chariots", "grange", [ex, ey + 12], [22, 8], 4, 1, "appentis", "bardeau", "bois", "#B4A47E", { params: { pente: 28 } }),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return {
        alignements: [
          { rue: "chemin-de-la-ferme", essence: "chene", intervalle_m: 14, cotes: "deux" },
          { rue: "s-2", essence: "fruitier", intervalle_m: 12, cotes: "deux" },
          { rue: "s-4", essence: "saule", intervalle_m: 12, cotes: "deux" },
        ],
        isoles: [{ position: pt(20, 0), essence: "tilleul", hauteur_m: 18, nom: "Tilleul de la cour" }],
        parcs,
        vergers: [],
        haies: [{ trace: pts([[-150, 125], [150, 125]]) }, { trace: pts([[-150, -125], [150, -125]]) }],
        potagers: [{ polygone: pts([[80, -25], [120, -25], [120, 25], [80, 25]]) }],
        essences_cours: ["fruitier", "tilleul", "chene"],
      };
    },
    eau: () => ({
      voies: [{ id: "mare", nom: "Mare de la ferme", canon: "A", type: "canal", trace: pts([[100, -110], [125, -105], [130, -90], [115, -80], [98, -88], [100, -110]]), largeur_m: 5, quais: false }],
      ponts: [],
      puits: pts([[10, 0]]),
      fontaines: [],
    }),
    points_de_vue() {
      return [
        { id: "cour-et-corps-de-ferme", nom: "Cour et corps de ferme", oeil: [20, 20, 2.5], cible: [6, 66, 5], fov: 62 },
        { id: "grange-et-mare", nom: "Grange et mare", oeil: [30, 15, 2.5], cible: [40, -60, 6], fov: 60 },
        { id: "verger", nom: "Verger de la ferme", oeil: [-60, 0, 2.5], cible: [-110, 0, 5], fov: 60 },
        { id: "chemin-d-acces", nom: "Chemin d'accès et champs du Sud", oeil: [40, 215, 2.5], cible: [30, 70, 6], fov: 58 },
      ];
    },
    etats() {
      return [
        etat({ id: "845-ordinaire", nom: "845, la ferme en temps ordinaire", date: "845", sources: [{ ref: "état ordinaire d'une ferme de l'anneau de Maria avant la chute (adaptation)", canon: "A" }], ruines: [], incendies: [], abandon: 0, ciel: "clair", habitants: 1 }),
        etat({ id: "845-evacuee", nom: "845, la ferme évacuée", date: "845", sources: [{ ref: "anneau de Maria évacué après la chute de Maria (atlas 06, note « scénario 845+ ») ; degré d'abandon : adaptation", canon: "A" }], ruines: [], incendies: [], abandon: 0.6, ciel: "brumeux", habitants: 0 }),
      ];
    },
  });
}
