import titansJson from "../../../data/art/titans.json";
import type { TitansFile } from "../../data/artSchemas";
import type { TitanPose, TitanSpec } from "./titan";

/**
 * Galerie de Titans (R1b.6) : un seul squelette (`titan.ts`, 18 articulations), des paramètres par classe lus dans
 * `data/art/titans.json` :
 * - classes de 3, 5, 8, 12 et 15 m ;
 * - variantes anormal, sentinelle, chasseur, meute et nocturne (modifications d'une classe) ;
 * - Titans spéciaux : Titan-Mur 50 m (buste), Titan de Rod Reiss 120 m (allongé), Colossal 60 m.
 * La hauteur debout est étalonnée sur la géométrie mesurée (`buildTitan`), les pieds posés au sol.
 */
export const TITANS = titansJson as unknown as TitansFile;
export const SOLDIER_BENCH_M = TITANS.soldat_m.valeur;

type Body = TitansFile["classes"][number];

const hex = (h: string): number => Number.parseInt(h.slice(1), 16);
const saltOf = (id: string): number => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 100000;

function specOf(b: Body, over: Partial<TitanSpec> = {}): TitanSpec {
  const pr = b.proportions;
  return {
    id: b.id,
    salt: saltOf(b.id),
    height: b.hauteur_m,
    ...pr,
    skin: hex(b.peau),
    expression: b.expression,
    hair: b.cheveux,
    stride: b.allure.stride,
    walkRate: b.allure.walkRate,
    armSwing: b.allure.armSwing,
    shoulderOut: b.allure.shoulderOut,
    headTilt: b.allure.headTilt,
    heat: b.vapeur ?? false,
    ...over,
  };
}

export const TITAN_CLASS_IDS = TITANS.classes.map((c) => c.id);
export const TITAN_VARIANT_IDS = TITANS.variantes.map((v) => v.id);
export const TITAN_SPECIAL_IDS = TITANS.speciaux.map((s) => s.id);

/** Spécification d'une classe, d'un Titan spécial, ou d'une classe modifiée par une variante. */
export function titanSpec(type: string, variant: string | null = null): TitanSpec {
  const special = TITANS.speciaux.find((s) => s.id === type);
  if (special) return specOf(special);
  const v = variant ? TITANS.variantes.find((x) => x.id === variant) : undefined;
  const cls = TITANS.classes.find((c) => c.id === type) ?? TITANS.classes.find((c) => c.id === v?.base);
  if (!cls) throw new Error(`classe de Titan inconnue : ${type}`);
  if (!v) return specOf(cls);
  const pr = { ...cls.proportions };
  for (const [k, d] of Object.entries(v.modifs) as [keyof typeof pr, number][]) pr[k] += d;
  return specOf({ ...cls, proportions: pr, peau: v.peau ?? cls.peau, expression: v.expression ?? cls.expression }, { id: `${cls.id}_${v.id}`, salt: saltOf(`${cls.id}_${v.id}`), ...Object.fromEntries(Object.entries(v.allure).filter(([, x]) => x !== undefined)) });
}

/** Spécification d'une variante sur sa classe de base (galerie, banc d'échelle). */
export function variantSpec(variant: string): TitanSpec {
  const v = TITANS.variantes.find((x) => x.id === variant);
  if (!v) throw new Error(`variante inconnue : ${variant}`);
  return titanSpec(v.base, variant);
}

/** Pose par défaut d'un Titan de la galerie. */
export function defaultPose(type: string, variant: string | null = null): TitanPose {
  const special = TITANS.speciaux.find((s) => s.id === type);
  if (special?.pose) return special.pose;
  const v = variant ? TITANS.variantes.find((x) => x.id === variant) : undefined;
  return v?.pose ?? "marche";
}

/** Hauteur nominale (m) d'un Titan de la galerie. */
export function titanHeight(type: string): number {
  return (TITANS.speciaux.find((s) => s.id === type) ?? TITANS.classes.find((c) => c.id === type))?.hauteur_m ?? NaN;
}
