import type { Gabarit, Gate, Place } from "../../../data/placeSchema";
import { pt } from "./kit";
import { BASE_GABARITS } from "./maria";

/**
 * Éléments communs aux districts du mur Sina (C16, tranche 1) : Stohess, Orvud, Ehrmich, Yarckel. Établi [C] : les quatre districts
 * de Sina et leur orientation (nord Orvud, est Stohess, sud Ehrmich, ouest Yarckel : fichiers 01 §3.1 et 11 §2, atlas 06 I03 à I08) ;
 * la forme en saillie à deux portes est celle des districts des autres murs (01 §3.1 : forme établie pour Shiganshina et Trost ; son
 * extension à Sina est une adaptation [A], Q20). Tout le reste (tracé, noms, dimensions, parts de population, états) : [A].
 */
export const gabaritsSina = (extra: Record<string, Gabarit>): Record<string, Gabarit> => ({
  centre: BASE_GABARITS.centre as Gabarit,
  ouvrier: BASE_GABARITS.ouvrier as Gabarit,
  faubourg: { ...(BASE_GABARITS.faubourg as Gabarit), cour: { type: "jardin", arbres_par_ha: 70 } },
  garnison: BASE_GABARITS.garnison as Gabarit,
  ...extra,
});

/** Gabarit « hôtels particuliers » (quartiers aisés de l'intérieur de Sina) : pierre taillée, ardoise, cours plantées. */
export const GABARIT_HOTELS: Gabarit = { etages: [3, 3, 4, 3], hauteur_etage_m: 3.5, toits: ["mansarde", "croupe", "mansarde", "pignon_rue"], pente_deg: [40, 56], couvertures: ["ardoise", "ardoise", "cuivre", "ardoise"], facades: ["pierre_taillee", "pierre_taillee", "enduit", "pierre_taillee"], teintes: ["#E6DFD0", "#DCD3C0", "#EAE2D0", "#D6CCB8", "#E2D8C4"], parcelles_m: [16, 22, 14, 20], profondeur_m: 20, boutiques: false, passage_m: 60, cour: { type: "plantee", arbres_par_ha: 90 } };
/** Gabarit « négoce » (rues commerçantes) : façades à boutiques, pignons sur rue. */
export const GABARIT_NEGOCE: Gabarit = { etages: [3, 4, 3, 3], hauteur_etage_m: 3.2, toits: ["pignon_rue", "croupe", "pignon_rue", "mansarde"], pente_deg: [42, 54], couvertures: ["tuile_plate", "ardoise", "tuile_plate", "tuile_canal"], facades: ["enduit", "pierre_taillee", "colombage", "brique"], teintes: ["#EBDCC0", "#E2CCA6", "#EDD6BE", "#DDD6BE", "#E6D8B8", "#D9C29C"], parcelles_m: [8, 10, 7, 9.5], profondeur_m: 14, boutiques: true, passage_m: 36, cour: { type: "plantee", arbres_par_ha: 80 } };
/** Gabarit « entrepôts et ateliers » : grandes parcelles, pierre brute et brique. */
export const GABARIT_ENTREPOTS: Gabarit = { etages: [2, 3, 3, 2], hauteur_etage_m: 3.7, toits: ["croupe", "pignon", "demi_croupe", "pignon"], pente_deg: [34, 46], couvertures: ["tuile_plate", "ardoise", "tuile_plate", "tuile_canal"], facades: ["pierre_brute", "brique", "bois", "pierre_brute"], teintes: ["#CFC3AA", "#C6BA9F", "#D4C8B0", "#C1B59A"], parcelles_m: [18, 24, 16, 22], profondeur_m: 18, boutiques: false, passage_m: 48, cour: { type: "pavee", arbres_par_ha: 45 } };

export const sourceSina = (atlas: string, detail: string, tracé: string): Place["sources"] => [
  { ref: `docs/spec/01 §3.1 et docs/spec/11 §2 : ${detail}, district du mur Sina ; docs/spec/06 ${atlas}`, canon: "C" },
  { ref: "docs/spec/20 (LC-C) : Mur Sina, districts [C], détails [A] ; forme en saillie à deux portes étendue de Rose à Sina : adaptation (Q20)", canon: "A" },
  { ref: `${tracé} : adaptation (création C16, \`docs/lore/creations.md\`)`, canon: "A" },
];

export const populationSina = (province: string, hab: number, part: number): Place["population"] => ({ province, part, canon: "C", note: `${Math.round(part * 100)} % de la population de \`${province}\` au départ de scn_sandbox_845 (${hab.toLocaleString("fr-FR")} hab.) logés intra-muros ; la province existe [C], la part est adaptée [A].` });
export const faubourgPopulation = (province: string, hab: number, part: number): Place["population"] => ({ province, part, canon: "A", note: `${Math.round(part * 100)} % de la population de \`${province}\` au départ de scn_sandbox_845 (${hab.toLocaleString("fr-FR")} hab.) logés au pied de la porte intérieure, côté intérieur des terres (adaptation).` });
export const NOMS_CHEMINS = ["Chemin des Prés", "Chemin des Haies", "Chemin des Ruches", "Chemin du Gué", "Chemin des Vergers", "Chemin de la Mare", "Chemin des Saules", "Chemin des Ormes", "Chemin du Glacis", "Chemin des Champs", "Chemin des Lavoirs"];

/** Deux portes : extérieure (nom et sources propres) et intérieure (poste de garde, herse). */
export function portesSina(R: number, nomExt: string, nomInt: string, gate: (o: Partial<Gate> & Pick<Gate, "id" | "nom" | "role" | "trace" | "s_m">) => Gate): Gate[] {
  return [
    gate({
      id: "exterieure",
      nom: nomExt,
      role: "exterieure",
      trace: "saillie",
      s_m: Math.round(((R * 90 * Math.PI) / 180) * 10) / 10,
      canon: "A",
      sources: [{ ref: "docs/spec/01 §3.1 : saillie à deux portes pour les districts [C] (étendue à Sina : adaptation) ; nom de la porte et dimensions : aucune source (Q5, Q20)", canon: "A" }],
    }),
    gate({
      id: "interieure",
      nom: nomInt,
      role: "interieure",
      trace: "mur-centre",
      s_m: R,
      passage: { largeur_m: 12, hauteur_m: 17, voute: "plein_cintre", trous_assassin: 4, rainures: true, canon: "A" },
      vantail: { type: "battants", largeur_m: 12.4, hauteur_m: 16, epaisseur_m: 0.8, materiau: "chene_ferre", canon: "A" },
      structure: { huisserie: true, gonds: 4, treuils: 1, contrepoids: 0, herse: true, canon: "A" },
      tours: [
        { type: "poste_de_garde", cote: "gauche", hauteur_m: 6, canon: "A" },
        { type: "poste_de_garde", cote: "droite", hauteur_m: 6, canon: "A" },
      ],
      portail: "pilastres",
    }),
  ];
}

/** Végétation de base d'un district en saillie : alignements, vergers et haies du faubourg, essences des cours. */
export function vegetationSina(parcs: Place["vegetation"]["parcs"], o: { xs: readonly number[]; ys: readonly number[]; alignements: Place["vegetation"]["alignements"]; isoles: Place["vegetation"]["isoles"] }): Place["vegetation"] {
  const xs = o.xs;
  const yEnd = o.ys[o.ys.length - 1] as number;
  const x0 = xs[0] as number;
  const x1 = xs[1] as number;
  const xn = xs[xs.length - 1] as number;
  const xm = xs[xs.length - 2] as number;
  const box = (a: number, b: number, c: number, d: number): [number, number][] => [pt(a, c), pt(b, c), pt(b, d), pt(a, d)];
  return {
    alignements: [
      { rue: "axe-principal", essence: "tilleul", intervalle_m: 12, cotes: "deux" },
      { rue: "rue-du-mur", essence: "marronnier", intervalle_m: 15, cotes: "droite" },
      { rue: "chemin-du-rempart-est", essence: "peuplier", intervalle_m: 14, cotes: "deux" },
      { rue: "chemin-du-rempart-ouest", essence: "peuplier", intervalle_m: 14, cotes: "deux" },
      { rue: "route-interieure", essence: "peuplier", intervalle_m: 12, cotes: "deux" },
      { rue: "route-exterieure", essence: "peuplier", intervalle_m: 14, cotes: "deux" },
      ...o.alignements,
    ],
    isoles: [...o.isoles, { position: pt(-60, 60), essence: "marronnier", hauteur_m: 17 }, { position: pt(60, 60), essence: "marronnier", hauteur_m: 17 }],
    parcs,
    vergers: [{ polygone: box(x0 + 10, x1 - 10, -60, yEnd + 30), espacement_m: 8 }, { polygone: box(xm + 10, xn - 10, -60, yEnd + 30), espacement_m: 8 }],
    haies: [{ trace: [pt(x0, yEnd - 50), pt(xn, yEnd - 50)] }],
    potagers: [{ polygone: box(20, xm - 20, -330, yEnd + 30) }],
    essences_cours: ["tilleul", "marronnier", "erable", "fruitier"],
  };
}

/** États : ordinaire (845) + un état propre au district (850 ou autre). */
export const etat845 = (nom: string): Place["etats"][number] => ({ id: "845-avant", nom, date: "845", canon: "A", sources: [{ ref: "état ordinaire du district (adaptation)", canon: "A" }], portes: {}, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 1 });

