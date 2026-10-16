import type { Building, Gabarit, Place, RoofCover, RoofForm, Facade } from "../../../data/placeSchema";
import { building } from "./saillie";

/**
 * Éléments communs aux lieux hors des murs de l'intérieur de Rose (C17, tranche 1) : Jinae, Ragako, Dauper, château d'Utgard, forêt
 * des Arbres Géants. Établi [C] : villages Ragako, Dauper et ville de Jinae au sud de l'intérieur de Rose, château d'Utgard abandonné
 * près du périmètre intérieur de Rose et détruit en 850, forêt des Arbres Géants (fichiers 01 §3.1, 11 §2, atlas 06 S05, S06, S10,
 * S13, R06 ; arbres d'environ 80 m, 03 §2) ; la localisation exacte d'Utgard et de la forêt est [?] (11 §9). Tout le reste (tracé, noms,
 * dimensions, effectifs, parts de province, états) est une adaptation [A] consignée dans `docs/lore/creations.md`.
 */
export const GAB_VILLAGE: Gabarit = { etages: [1, 2, 1, 2], hauteur_etage_m: 2.8, toits: ["pignon", "croupe", "demi_croupe", "pignon"], pente_deg: [42, 55], couvertures: ["chaume", "bardeau", "tuile_plate", "chaume"], facades: ["colombage", "bois", "enduit", "pierre_brute"], teintes: ["#D8CCB4", "#CDBF9F", "#E2D6BF", "#C7B898", "#D9C9AA"], parcelles_m: [11, 14, 9, 12], profondeur_m: 10, boutiques: false, passage_m: 0, cour: { type: "jardin", arbres_par_ha: 70 } };
export const GAB_FERME: Gabarit = { etages: [1, 2, 1], hauteur_etage_m: 3, toits: ["pignon", "demi_croupe", "pignon"], pente_deg: [36, 48], couvertures: ["chaume", "tuile_plate", "bardeau"], facades: ["pierre_brute", "colombage", "bois"], teintes: ["#CDBF9F", "#C2B393", "#D2C6A8"], parcelles_m: [16, 20, 14], profondeur_m: 12, boutiques: false, passage_m: 0, cour: { type: "jardin", arbres_par_ha: 60 } };
export const GAB_CHASSE: Gabarit = { etages: [1, 2, 1], hauteur_etage_m: 2.9, toits: ["pignon", "appentis", "pignon_rue"], pente_deg: [40, 52], couvertures: ["bardeau", "chaume", "bardeau"], facades: ["bois", "colombage", "pierre_brute"], teintes: ["#C9B993", "#BEAE88", "#D2C39F", "#B8A682"], parcelles_m: [10, 13, 9], profondeur_m: 10, boutiques: false, passage_m: 0, cour: { type: "jardin", arbres_par_ha: 70 } };
export const GAB_VILLE_RURALE: Gabarit = { etages: [2, 3, 2, 2], hauteur_etage_m: 3, toits: ["pignon_rue", "pignon", "croupe", "demi_croupe"], pente_deg: [44, 56], couvertures: ["tuile_plate", "ardoise", "tuile_plate", "tuile_canal"], facades: ["colombage", "enduit", "enduit", "brique"], teintes: ["#E2D6BF", "#D9CBAE", "#E8DCC4", "#D4C4A4", "#DDD0B6"], parcelles_m: [8, 10, 7, 9], profondeur_m: 12, boutiques: true, passage_m: 45, cour: { type: "plantee", arbres_par_ha: 90 } };
export const GAB_CHATEAU: Gabarit = { etages: [1, 2, 1], hauteur_etage_m: 3.4, toits: ["pignon", "appentis", "demi_croupe"], pente_deg: [34, 44], couvertures: ["ardoise", "tuile_plate", "ardoise"], facades: ["pierre_brute", "pierre_taillee", "pierre_brute"], teintes: ["#BDB4A0", "#B2A994", "#C6BDA8"], parcelles_m: [12, 16, 10], profondeur_m: 9, boutiques: false, passage_m: 0, cour: { type: "plantee", arbres_par_ha: 60 } };

/** Bâtiment repère abrégé (création [A] sauf indication). */
export function bat(id: string, nom: string, archetype: Building["archetype"], position: [number, number], emprise_m: [number, number], hauteur_m: number, etages: number, toit: RoofForm, couverture: RoofCover, facade: Facade, teinte: string, o: { canon?: Building["canon"]; params?: Building["params"]; reperes_canon?: string[]; angle_deg?: number } = {}): Building {
  return building({ id, nom, canon: o.canon ?? "A", archetype, position, emprise_m, angle_deg: o.angle_deg ?? 0, hauteur_m, etages, toit, couverture, facade, teinte, ...(o.params ? { params: o.params } : {}), ...(o.reperes_canon ? { reperes_canon: o.reperes_canon } : {}) });
}

type State = Place["etats"][number];
export const etat = (e: Omit<State, "portes" | "rochers" | "canon"> & { canon?: State["canon"]; rochers?: State["rochers"] }): State => ({ canon: "A", portes: {}, rochers: [], ...e });
