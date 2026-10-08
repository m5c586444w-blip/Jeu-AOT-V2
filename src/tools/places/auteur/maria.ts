import type { Gabarit, Place } from "../../../data/placeSchema";
import type { Ctx } from "./saillie";
import { pt, r1 } from "./kit";

/**
 * Éléments communs aux trois districts du mur Maria dont le nom n'est pas établi (R1e.5, Q1, Q8) : libellé, sources,
 * états (845 avant la chute ; 846 abandon du territoire de Maria, établi [C] ; ce qu'il advient de chaque district : [?]),
 * vues et gabarits de base (chaque district les reprend et les ajuste).
 */
/**
 * Noms affichés (fichier 24 §3, réponse de l'utilisateur du 2026-10-07, source non précisée) : Quinta au nord, `[?]` paramétrable,
 * affiché sans mention de statut ; les districts est et ouest sans nom connu. Aucun n'est retrouvé dans une source officielle (Q1).
 */
export const NOMS = { nord: "Quinta", est: "District est du mur Maria", ouest: "District ouest du mur Maria" } as const;

export const SOURCES_MARIA: Place["sources"] = [
  { ref: "consigne R1e et fichier 24 §3 : quatre districts sur le mur Maria (affirmation de l'utilisateur) ; Quinta au nord (nom donné par l'utilisateur, non retrouvé dans une source officielle) ; rang et orientations non établis (Q1)", canon: "?" },
  { ref: "identité du district, plan, noms de rues, dimensions : adaptation (consigne R1e : « un district agricole et grenier, un district de garnison et d'artillerie, un district de marché et de rivière »)", canon: "A" },
];

export function mariaStates(ctx: Ctx, ruins: [number, number][][]): Place["etats"] {
  return [
    { id: "845-avant", nom: "845, avant la chute du mur Maria", date: "845", canon: "A", sources: [{ ref: "état ordinaire du district (adaptation)", canon: "A" }], portes: {}, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 1 },
    {
      id: "846-abandon",
      nom: "846, territoire de Maria abandonné",
      date: "846",
      canon: "?",
      sources: [{ ref: "ERRATA.md et docs/spec/01 : le territoire du mur Maria est abandonné après 845 (C)", canon: "C" }, { ref: "sort de ce district (portes, ruines, végétation) : non établi", canon: "?" }],
      portes: {},
      ruines: ruins.map((polygone) => ({ polygone, part: 0.25 })),
      incendies: [],
      rochers: [],
      abandon: 0.8,
      ciel: "brumeux",
      habitants: 0,
    },
  ];
}

/** Six vues de base (ensemble, axe, rempart, faubourg, porte depuis la ville, porte de l'extérieur) + vues propres. */
export function baseViews(ctx: Ctx, own: Place["points_de_vue"]): Place["points_de_vue"] {
  const R = ctx.R;
  const P = (x: number, y: number, z: number): [number, number, number] => [r1(x), r1(y), r1(z)];
  const w = [r1(Math.cos((122 * Math.PI) / 180) * (R - 1)), r1(Math.sin((122 * Math.PI) / 180) * (R - 1))];
  const w2 = [r1(Math.cos((100 * Math.PI) / 180) * (R - 1)), r1(Math.sin((100 * Math.PI) / 180) * (R - 1))];
  return [
    { id: "ensemble", nom: "Vue d'ensemble", oeil: P(-1.07 * R, 1.67 * R, 0.73 * R), cible: P(30, 0.47 * R, 0), fov: 50 },
    { id: "axe-principal", nom: "Axe principal vers la porte intérieure", oeil: P(5, 0.67 * R, 1.8), cible: P(0, 0.22 * R, 16), fov: 58 },
    ...own,
    { id: "rempart", nom: "Chemin de ronde de la saillie", oeil: P(w[0] as number, w[1] as number, 52.5), cible: P(w2[0] as number, w2[1] as number, 50), fov: 60 },
    { id: "faubourg", nom: "Faubourg et porte intérieure", oeil: P(260, -620, 28), cible: P(0, -40, 18), fov: 55 },
    { id: "porte-depuis-la-ville", nom: "Porte extérieure depuis la ville", oeil: P(3, R - 160, 1.8), cible: P(0, R, 22), fov: 58 },
  ];
}

export const pts = (xs: [number, number][]): [number, number][] => xs.map(([x, y]) => pt(x, y));

const T_PALE = ["#EFE4CC", "#E9D3B0", "#F1DCCB", "#E2E0CF", "#EADFC2", "#D9C6A2", "#F2E8D6", "#E7CDB8", "#DCD8C4"];
export const BASE_GABARITS: Record<string, Gabarit> = {
  centre: { etages: [3, 4, 3, 2, 4], hauteur_etage_m: 3, toits: ["pignon_rue", "pignon", "pignon_rue", "demi_croupe", "croupe"], pente_deg: [48, 58], couvertures: ["tuile_plate", "ardoise", "tuile_plate", "bardeau", "tuile_plate"], facades: ["colombage", "enduit", "enduit", "colombage", "pierre_taillee"], teintes: T_PALE, parcelles_m: [7, 8.5, 6.5, 9, 7.5], profondeur_m: 13, boutiques: true, passage_m: 45, cour: { type: "plantee", arbres_par_ha: 85 } },
  ouvrier: { etages: [2, 3, 2, 2], hauteur_etage_m: 2.8, toits: ["pignon", "appentis", "pignon_rue", "pignon"], pente_deg: [38, 50], couvertures: ["tuile_canal", "bardeau", "tuile_plate", "chaume"], facades: ["enduit", "bois", "pierre_brute", "colombage"], teintes: ["#D9CCB2", "#CFC2A6", "#E0D4BC", "#C9BBA0", "#D4C7AE"], parcelles_m: [5.5, 6.5, 5, 7], profondeur_m: 10, boutiques: false, passage_m: 30, cour: { type: "jardin", arbres_par_ha: 110 } },
  faubourg: { etages: [1, 2, 1, 2], hauteur_etage_m: 2.8, toits: ["pignon", "croupe", "demi_croupe", "pignon"], pente_deg: [42, 55], couvertures: ["chaume", "bardeau", "chaume", "tuile_canal"], facades: ["bois", "colombage", "enduit", "pierre_brute"], teintes: ["#D8CCB4", "#CDBF9F", "#E2D6BF", "#C7B898"], parcelles_m: [11, 15, 9, 13], profondeur_m: 10, boutiques: false, passage_m: 0, cour: { type: "jardin", arbres_par_ha: 50 } },
  garnison: { etages: [2, 3], hauteur_etage_m: 3.4, toits: ["croupe", "pignon"], pente_deg: [35, 45], couvertures: ["ardoise", "tuile_plate"], facades: ["pierre_taillee", "pierre_brute"], teintes: ["#D9D3C6", "#CFC8B9"], parcelles_m: [14, 18, 12], profondeur_m: 12, boutiques: false, passage_m: 0, cour: { type: "pavee", arbres_par_ha: 25 } },
};
