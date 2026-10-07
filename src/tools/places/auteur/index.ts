import type { Place } from "../../../data/placeSchema";
import { mariaDistrict2 } from "./maria-district-2";
import { mariaDistrict3 } from "./maria-district-3";
import { mariaDistrict4 } from "./maria-district-4";
import { shiganshina } from "./shiganshina";

/**
 * Plans d'auteur des lieux N1 (R1e) : un module par lieu, qui décrit à la main rues nommées, îlots, gabarits, repères, portes,
 * eau et végétation, et rend l'objet `Place` écrit dans `data/places/<id>.json` par `npm run places:regenerer -- <id>`.
 */
export const AUTHORS: Record<string, () => Place> = { shiganshina, "maria-district-2": mariaDistrict2, "maria-district-3": mariaDistrict3, "maria-district-4": mariaDistrict4 };
