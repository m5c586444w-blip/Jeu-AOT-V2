import { SRGBColorSpace, TextureLoader } from "three";
import type { Texture } from "three";
import { EYE_TEXTURE_URL, loadHumanTemplate } from "./humanBase";
import type { HumanTemplate } from "./humanBase";
import { buildHumanSoldier } from "./humanSoldier";
import { buildSoldier } from "./soldier";
import type { SoldierLike, SoldierMaterials } from "./soldier";

/**
 * Choix des corps d'une scène (R1c) : le corps de base MakeHuman (CC0) chargé à la demande, ou, en repli, les figures en
 * primitives de R1 (`?corps=primitives`, ou si le `.glb` ne se charge pas). La raison est notée sur `<html data-corps>`.
 */
export interface BodyKit {
  template: HumanTemplate | null;
  eyeMap: Texture | null;
  reason: string;
}

export async function loadBodyKit(search: string): Promise<BodyKit> {
  const q = new URLSearchParams(search);
  let kit: BodyKit;
  if (q.get("corps") === "primitives") kit = { template: null, eyeMap: null, reason: "primitives" };
  else {
    try {
      const [template, eyeMap] = await Promise.all([loadHumanTemplate(), new TextureLoader().loadAsync(EYE_TEXTURE_URL)]);
      eyeMap.colorSpace = SRGBColorSpace;
      kit = { template, eyeMap, reason: "makehuman" };
    } catch (e) {
      kit = { template: null, eyeMap: null, reason: `repli-primitives : ${String(e)}` };
    }
  }
  document.documentElement.dataset["corps"] = kit.reason.split(" ")[0] ?? "";
  return kit;
}

export function makeSoldier(kit: BodyKit, seed: number, mats: SoldierMaterials, height?: number): SoldierLike {
  if (kit.template) return buildHumanSoldier(kit.template, seed, mats, { eyeMap: kit.eyeMap, ...(height !== undefined ? { height, gender: 1 } : {}) });
  return buildSoldier(seed, mats);
}
