import type { FrozenPlan, Place, WallsParams } from "../../data/placeSchema";
import { frozenLayout, frozenPlace } from "../../render/tactical3d/places/frozen";
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

/** Plan SVG d'un lieu N2 figé (dossier court : plan.svg, consigne §5), lu des lignes du plan sans regénérer. */
export function frozenSvgs(plan: FrozenPlan, walls: WallsParams): Record<string, string> {
  const place = frozenPlace(plan);
  return { "plan.svg": placePlanSvg(place, frozenLayout(plan, place), walls, null) };
}
