import { Color, MeshStandardMaterial } from "three";
import type { SoldierOutfit } from "../humanSoldier";
import type { SoldierMaterials } from "../soldier";
import { outfit } from "./catalog";
import type { GearRole, OutfitId } from "./catalog";

/**
 * Tenues de R3 sur les figures complètes (corps de base) : matériaux d'une tenue (veste, pantalon, cape, manteau ou écharpe,
 * couvre-chef) et options d'équipement. Un jeu de matériaux par tenue est partagé par toutes les figures de cette tenue.
 */
export function outfitMaterials(base: SoldierMaterials, id: OutfitId): SoldierMaterials {
  const o = outfit(id);
  const jacket = base.jacket.clone();
  jacket.color = new Color(o.veste);
  const trousers = base.trousers.clone();
  trousers.color = new Color(o.pantalon);
  const cape = base.cape.clone();
  cape.color = new Color(o.cape ?? o.manteau ?? o.echarpe ?? o.veste);
  const hat = new MeshStandardMaterial({ color: new Color(o.couvre_chef_teinte ?? 0x2a2a2a), roughness: o.couvre_chef === "casque" ? 0.45 : 0.8, metalness: o.couvre_chef === "casque" ? 0.35 : 0 });
  return { ...base, jacket, trousers, cape, hat, all: [...base.all.filter((m) => m !== base.jacket && m !== base.trousers && m !== base.cape), jacket, trousers, cape, hat] };
}

export function outfitOptions(id: OutfitId, gear: GearRole): SoldierOutfit {
  const o = outfit(id);
  return { cape: o.cape !== null, gear, headgear: o.couvre_chef, coat: o.manteau !== null, scarf: o.echarpe !== null };
}
