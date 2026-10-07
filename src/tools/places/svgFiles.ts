import type { Place, WallsParams } from "../../data/placeSchema";
import { layoutPlace, placeMetrics } from "../../render/tactical3d/places/layout";
import { gateElevationSvg, placePlanSvg, wallSectionSvg } from "../../render/tactical3d/places/svg";
import { placePopulations, simPopulations } from "./population";

/**
 * Plans SVG d'un lieu (R1e) : nom de fichier → contenu. Mêmes données → mêmes fichiers (test de fraîcheur de `docs/places/`).
 * - plan.svg : plan coté (rues nommées, îlots, emprises, repères, murailles, portes, eau, arbres, cartouche) ;
 * - mur-coupe.svg : coupe du mur de l'enceinte, lue de `_murs.json` ;
 * - porte-<id>-elevation-exterieure.svg et -interieure.svg : élévations cotées de chaque porte.
 */
export function placeSvgs(place: Place, walls: WallsParams): Record<string, string> {
  const L = layoutPlace(place);
  const out: Record<string, string> = { "plan.svg": placePlanSvg(place, L, walls, placeMetrics(L, placePopulations(place, simPopulations()))) };
  if (place.enceinte) {
    const ring = walls.anneaux[place.enceinte.mur];
    out["mur-coupe.svg"] = wallSectionSvg(ring, ring.nom);
    for (const g of place.portes) {
      out[`porte-${g.id}-elevation-exterieure.svg`] = gateElevationSvg(g, ring, "exterieure");
      out[`porte-${g.id}-elevation-interieure.svg`] = gateElevationSvg(g, ring, "interieure");
    }
  }
  return out;
}
