import type { Texture } from "three";
import { loadEyeTexture, loadHumanTemplate, skinnedBounds } from "./humanBase";
import type { HumanTemplate } from "./humanBase";
import { buildHumanSoldier } from "./humanSoldier";
import type { HumanSoldier } from "./humanSoldier";
import { buildHumanTitan } from "./humanTitan";
import { SOLDIER_HEIGHT_M, buildSoldier, soldierHeight } from "./soldier";
import type { Soldier, SoldierLike, SoldierMaterials } from "./soldier";
import { buildTitan } from "./titan";
import type { Titan, TitanSpec } from "./titan";

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
      const [template, eyeMap] = await Promise.all([loadHumanTemplate(), loadEyeTexture()]);
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

/** Titan : corps de base déformé par les paramètres de R1b, ou figure en primitives de R1. */
export function makeTitan(kit: BodyKit, spec: TitanSpec, seed: number, skinMap: Texture | null): Titan {
  if (kit.template) return buildHumanTitan(kit.template, spec, seed, { skinMap, eyeMap: kit.eyeMap });
  return buildTitan(spec, seed, skinMap);
}

/** Taille d'un soldat posé, sans les lames, dans le monde : la peau du corps de base, ou la mesure de R1. */
export function soldierStature(s: SoldierLike): number {
  if ("body" in s) {
    const b = skinnedBounds((s as HumanSoldier).body);
    return b.max.y - b.min.y;
  }
  return soldierHeight(s as Soldier);
}

/** Facteur qui ramène un soldat de R1 (1,8 m) à une taille voulue ; le corps de base est construit à la bonne taille. */
export function soldierScaleFor(s: SoldierLike, height: number): number {
  return "body" in s ? 1 : height / SOLDIER_HEIGHT_M;
}

/** Soldat debout pour une mesure de taille : attente (corps de base) ou garde de R1. */
export function standSoldier(s: SoldierLike): void {
  if ("body" in s) (s as HumanSoldier).setPose("attente", 0);
  else s.setPose("sol", 0);
}

/** Option `titan` d'un environnement : la fabrique du corps de base quand il est chargé (sinon, rien : figures de R1). */
export function titanFactory(kit: BodyKit | null): { titan?: (spec: TitanSpec, seed: number, skin: Texture | null) => Titan } {
  return kit?.template ? { titan: (spec, seed, skin) => makeTitan(kit, spec, seed, skin) } : {};
}
