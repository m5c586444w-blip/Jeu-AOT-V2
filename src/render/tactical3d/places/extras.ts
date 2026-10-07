import type { Group } from "three";
import type { Place, RingProfile } from "../../../data/placeSchema";
import type { PlaceLayout } from "./layout";
import type { PlaceMaterials } from "./placeMaterials";

/**
 * Ouvrages construits à part (R1e) : portes, bâtiments repères à constructeur propre, accessoires. Renvoie les identifiants des
 * bâtiments repères ainsi pris en charge (les autres sont rendus comme de grandes maisons de leur gabarit).
 */
export function placeExtras(scene: { place: Place; layout: PlaceLayout; ring: RingProfile | null; materials: PlaceMaterials; group: Group }, stateId: string): Set<string> {
  void scene;
  void stateId;
  return new Set();
}
