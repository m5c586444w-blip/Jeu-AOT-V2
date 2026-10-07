import type { Place } from "../../../data/placeSchema";

/**
 * Plans d'auteur des lieux N1 (R1e) : un module par lieu, qui décrit à la main rues nommées, îlots, gabarits, repères, portes,
 * eau et végétation, et rend l'objet `Place` écrit dans `data/places/<id>.json` par `npm run places:regenerer -- <id>`.
 */
export const AUTHORS: Record<string, () => Place> = {};
