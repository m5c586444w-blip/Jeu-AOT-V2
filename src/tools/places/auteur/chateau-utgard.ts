import type { Gabarit, Place } from "../../../data/placeSchema";
import { buildEnclos } from "./enclos";
import { bat, etat, GAB_CHATEAU } from "./horsmurs";
import { pt } from "./kit";
import { pts } from "./maria";
import { authored, claimRect, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * Château d'Utgard (C17, tranche 1) — château abandonné près du périmètre intérieur de Rose, plan d'auteur N1. Établi [C] : château
 * abandonné dans Wall Rose, près du périmètre intérieur, détruit en 850 à l'issue d'un combat de nuit (fichiers 01 §3.1 et 11 §1 et §2,
 * atlas 06 S06 et T08 « Utgard — Cour et tour (nuit, 850) », `prov_utgard`, `destroyed_year: 850`, `evt_850_utgard_battle`) ; position
 * exacte sur la carte [?] (`prov_utgard` : notes_canon). Tout le reste est une adaptation [A] : plan, noms, dimensions, effectif.
 *
 * Écarts de schéma (documentés, `docs/places/chateau-utgard/lore.md`, Q31) : l'enceinte propre d'un château n'est pas modélisable
 * (le schéma ne connaît que les murs Maria, Rose et Sina) : les quatre tours d'angle, le châtelet et le donjon sont des bâtiments, les
 * courtines manquent (dette) ; les douves sont une voie d'eau de type canal.
 *
 * Parti d'auteur [A] : un carré de 180 m de côté (cellules de 45 m) autour d'une cour d'honneur de 90 m, donjon au nord-ouest, tours
 * aux autres angles, logis et salle d'armes au nord, chapelle à l'ouest, écuries et forge, châtelet au sud sur la route ; douves à 100 m ;
 * bois de 270 m de côté. Population : `prov_utgard` vaut 0 dans la simulation : effectif `?` de 24 occupants précaires (braconniers,
 * gardes de la forêt voisine), valeur paramétrable ; densité « ferme » 9,5 hab/ha.
 */
const XS = [-270, -180, -90, -45, 0, 45, 90, 180, 270];
const S = authored(XS, 5);
const T = authored(XS, 5);
const sv = (i: number): number => XS[i] as number;

const GABARITS: Record<string, Gabarit> = { chateau: GAB_CHATEAU };
const Q = {
  chateau: quarter("enceinte-du-chateau", "Enceinte du château", "chateau", "administration", 0.4),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(3), sv(5), sv(3), sv(5), { kind: "place", id: "cour-d-honneur", nom: "Cour d'honneur", revetement: "dalles", fontaine: false, marche: false });
const BOIS: [string, string, number, number, number, number][] = [
  ["bois-du-nord", "Bois du Nord", 0, 8, 0, 2],
  ["bois-du-sud", "Bois du Sud", 0, 8, 6, 8],
  ["bois-de-l-ouest", "Bois de l'Ouest", 0, 2, 2, 6],
  ["bois-de-l-est", "Bois de l'Est", 6, 8, 2, 6],
];
for (const [id, nom, i0, i1, j0, j1] of BOIS) claimRect(claims, S, T, sv(i0), sv(i1), sv(j0), sv(j1), { kind: "parc", id, nom, essences: ["chene", "pin", "bouleau", "chene"], arbres_par_ha: 58 });

export function chateauUtgard(): Place {
  const p = buildEnclos({
    id: "chateau-utgard",
    nom: "Château d'Utgard",
    libelle: "Château d'Utgard (château abandonné de Wall Rose)",
    canon: "C",
    sources: [
      { ref: "docs/spec/01 §3.1 et docs/spec/11 §1 et §2 : château d'Utgard, château abandonné dans Wall Rose près du périmètre intérieur, détruit en 850 [C] ; docs/spec/06 S06, T08 ; data/provinces/paradis.json : prov_utgard, poi_chateau_utgard [C]", canon: "C" },
      { ref: "position exacte sur la carte : non établie [?] (`prov_utgard` : notes_canon) ; `data/geo/paradis.json` le place au nord-est de l'intérieur de Rose [A]", canon: "?" },
      { ref: "plan du château, noms, dimensions, effectif : adaptation (création C17, `docs/lore/creations.md`)", canon: "A" },
    ],
    province: "prov_utgard",
    style: "E20",
    population: { province: null, part: 1, valeur: 24, canon: "?", note: "`prov_utgard` existe [C] mais sa population de simulation est nulle (château abandonné, atlas S06) ; effectif d'occupants précaires (braconniers, gardes de la forêt voisine) : valeur paramétrable `?`." },
    densite: { classe: "ferme", valeur: 9.5, canon: "A" },
    orientation: { valeur: "aucune", canon: "?" },
    s: S,
    t: T,
    names: { s: [], t: [], lanes: ["Ruelle de la Courtine", "Ruelle du Guet", "Ruelle des Remparts", "Ruelle du Puits", "Ruelle des Écuries", "Ruelle de la Herse", "Ruelle du Chemin de ronde", "Ruelle de la Citerne", "Ruelle du Donjon"] },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt: () => Q.chateau.id,
    claims,
    marge_m: 25,
    etendue_m: 700,
    extraStreets: () => [{ id: "route-du-chateau", nom: "Route du Château", canon: "A", type: "route", trace: pts([[0, 270], [0, 130], [0, 92]]), largeur_m: 6, revetement: "gravier" }],
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      return [
        bat("donjon", "Donjon d'Utgard", "donjon", c(2, 2), [22, 22], 34, 5, "plat", "terrasse", "pierre_brute", "#B6AD99", { reperes_canon: ["château d'Utgard [C] (atlas 06 S06, T08 « cour et tour ») : tour et cour établies, plan et volumes [A]"] }),
        bat("tour-du-nord-est", "Tour du nord-est", "tour", c(5, 2), [14, 14], 22, 4, "pavillon", "ardoise", "pierre_brute", "#BAB19D"),
        bat("tour-du-sud-ouest", "Tour du sud-ouest", "tour", c(2, 5), [14, 14], 22, 4, "pavillon", "ardoise", "pierre_brute", "#B7AE9A"),
        bat("tour-du-sud-est", "Tour du sud-est", "tour", c(5, 5), [14, 14], 22, 4, "pavillon", "ardoise", "pierre_brute", "#BAB19D"),
        bat("logis-seigneurial", "Logis seigneurial", "chateau", c(3, 2), [34, 22], 14, 3, "pignon", "ardoise", "pierre_taillee", "#C6BDA8", { params: { pente: 44 } }),
        bat("salle-d-armes", "Salle d'armes", "fort", c(4, 2), [34, 20], 12, 2, "pignon", "ardoise", "pierre_brute", "#BDB4A0", { params: { pente: 38 } }),
        bat("chapelle-du-chateau", "Chapelle du château", "chapelle", c(2, 3), [14, 26], 11, 1, "pignon", "ardoise", "pierre_taillee", "#C9C0AB", { params: { clocher_m: 18, clocher_cote: 4, abside: true, pente: 48 } }),
        bat("ecuries-du-chateau", "Écuries du château", "ecurie", c(2, 4), [30, 16], 8, 1, "pignon", "ardoise", "pierre_brute", "#B9B09B", { params: { pente: 36 } }),
        bat("chatelet-d-entree", "Châtelet d'entrée", "tour", c(3, 5), [28, 14], 18, 3, "plat", "terrasse", "pierre_brute", "#B4AB97"),
        bat("cuisines-et-communs", "Cuisines et communs", "atelier", c(4, 5), [30, 16], 8, 1, "appentis", "ardoise", "pierre_brute", "#B8AF9B", { params: { pente: 30 } }),
        bat("grange-du-chateau", "Grange du château", "grange", c(5, 3), [28, 16], 9, 1, "pignon", "tuile_plate", "bois", "#B2A68C", { params: { pente: 36 } }),
        bat("forge-du-chateau", "Forge du château", "atelier", c(5, 4), [26, 14], 7, 1, "appentis", "ardoise", "pierre_brute", "#B5AC98", { params: { pente: 30 } }),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return {
        alignements: [{ rue: "route-du-chateau", essence: "chene", intervalle_m: 15, cotes: "deux" }],
        isoles: [{ position: pt(-20, 10), essence: "tilleul", hauteur_m: 20, nom: "Tilleul de la cour" }],
        parcs,
        vergers: [],
        haies: [],
        potagers: [],
        essences_cours: ["fruitier", "bouleau", "chene"],
      };
    },
    eau: () => ({
      voies: [{ id: "douves", nom: "Douves du château", canon: "A", type: "canal", trace: pts([[-100, -100], [100, -100], [100, 100], [-100, 100], [-100, -100]]), largeur_m: 8, quais: false }],
      ponts: [{ id: "pont-du-chatelet", position: pt(0, 100), angle_deg: 90, longueur_m: 14, largeur_m: 6, type: "bois" }],
      puits: pts([[-20, 20]]),
      fontaines: [],
    }),
    points_de_vue() {
      return [
        { id: "cour-et-donjon", nom: "Cour d'honneur et donjon", oeil: [30, 40, 3], cible: [-67, -67, 18], fov: 62 },
        { id: "chatelet-et-douves", nom: "Châtelet, pont et douves", oeil: [10, 215, 3], cible: [0, 80, 9], fov: 58 },
        { id: "tour-du-sud-est", nom: "Tour du sud-est vue du bois", oeil: [190, 150, 4], cible: [67, 67, 12], fov: 60 },
        { id: "chapelle-et-ecuries", nom: "Chapelle et écuries", oeil: [-20, 0, 3], cible: [-67, 10, 6], fov: 60 },
      ];
    },
    etats() {
      return [
        etat({
          id: "845-abandonne",
          nom: "845, le château abandonné",
          date: "845",
          canon: "C",
          sources: [
            { ref: "docs/spec/06 S06 et docs/spec/11 §2 : château abandonné [C]", canon: "C" },
            { ref: "degré d'abandon (herbes, jeunes arbres, brume), occupants précaires : adaptation", canon: "A" },
          ],
          ruines: [],
          incendies: [],
          abandon: 0.55,
          ciel: "brumeux",
          habitants: 1,
        }),
        etat({
          id: "850-detruit",
          nom: "850, le château détruit",
          date: "850",
          canon: "C",
          sources: [
            { ref: "docs/spec/06 S06 et T08, docs/spec/11 §1 : combat de nuit à Utgard, château détruit à l'issue [C] ; `prov_utgard.destroyed_year` = 850", canon: "C" },
            { ref: "étendue des ruines, incendies, fumée, effectif nul : adaptation ; déroulement du combat non posé", canon: "A" },
          ],
          ruines: [{ polygone: pts([[-95, -95], [95, -95], [95, 95], [-95, 95]]), part: 0.95 }],
          incendies: pts([[-67, -67], [67, -67], [-60, 20], [67, 67], [-22, 67], [0, 0]]),
          abandon: 0.55,
          ciel: "enfume",
          habitants: 0,
        }),
      ];
    },
  });
  // Zone habitée : le château et ses douves ; le bois alentour reste hors de la zone bâtie (ni rues ni îlots comptés).
  // Vue d'ensemble rapprochée (la vue de base, trop lointaine, noie le château dans le voile) : douves, tours et cour lisibles.
  const ensemble = { id: "ensemble", nom: "Vue d'ensemble", oeil: [-120, 215, 85] as [number, number, number], cible: [0, 0, 0] as [number, number, number], fov: 48 };
  return { ...p, perimetre: pts([[-115, -115], [115, -115], [115, 115], [-115, 115]]), points_de_vue: p.points_de_vue.map((v) => (v.id === "ensemble" ? ensemble : v)) };
}
