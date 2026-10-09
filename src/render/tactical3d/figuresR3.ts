import figuresJson from "../../../data/art/figures_r3.json";
import type { FiguresR3File } from "../../data/artSchemas";
import { titanSpec } from "./titanGallery";
import type { TitanR3, TitanSpec } from "./titan";

/**
 * Figures de R3 (fichier 21 §8), lues dans `data/art/figures_r3.json` (choix de design A) :
 * - Titans : pour chaque classe de 3, 5, 8, 12 et 15 m, trois corps (a : la classe de R1b ; b et c : proportions, corpulence,
 *   posture et démarche propres) et deux peaux (pâle et marbrée, rougeaude et tachée) : 30 Titans ;
 * - soldats : cinq tenues, Paradis (Bataillon d'exploration, Garnison, Police militaire) et Marley (infanterie, officier).
 */
export const FIGURES_R3 = figuresJson as unknown as FiguresR3File;
export type TitanVariantId = "a" | "b" | "c";
export type SkinId = "pale" | "rougeaude";
export type OutfitId = FiguresR3File["soldats"][number]["id"];
export type Outfit = FiguresR3File["soldats"][number];

export const R3_CLASS_IDS: readonly string[] = FIGURES_R3.titans.map((t) => t.classe);
export const R3_VARIANT_IDS: readonly TitanVariantId[] = ["a", "b", "c"];
export const R3_SKIN_IDS: readonly SkinId[] = ["pale", "rougeaude"];
export const OUTFIT_IDS: readonly OutfitId[] = FIGURES_R3.soldats.map((s) => s.id);

const hex = (h: string): number => Number.parseInt(h.slice(1), 16);
const saltOf = (id: string): number => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 100000;

/** Spécification d'un Titan de R3 : classe, corps (a, b, c), peau. Le même corps garde ses mesures d'une peau à l'autre. */
export function r3TitanSpec(cls: string, variant: TitanVariantId, skin: SkinId): TitanSpec {
  const entry = FIGURES_R3.titans.find((t) => t.classe === cls);
  const v = entry?.variantes.find((x) => x.id === variant);
  const sk = FIGURES_R3.peaux.find((p) => p.id === skin);
  if (!entry || !v || !sk) throw new Error(`Titan de R3 inconnu : ${cls} ${variant} ${skin}`);
  const base = titanSpec(cls);
  const id = `${cls}_r3${variant}`;
  const out: TitanSpec = { ...base, id, salt: saltOf(id) };
  for (const [k, d] of Object.entries(v.modifs) as [keyof typeof v.modifs, number][]) out[k] += d;
  if (v.expression) out.expression = v.expression;
  if (v.cheveux !== undefined) out.hair = v.cheveux;
  const r3: TitanR3 = { variant, skin: { id: skin, tint: hex(sk.teinte), mix: sk.melange, marbling: sk.marbrures, teeth: hex(sk.dents) } };
  if (v.macro) r3.macro = v.macro;
  if (v.posture) r3.posture = v.posture;
  if (v.demarche) r3.demarche = v.demarche;
  if (v.dents) r3.teeth = v.dents;
  if (v.yeux) r3.eyes = v.yeux;
  out.r3 = r3;
  return out;
}

/** Les 15 corps (une peau) ou les 30 Titans de la galerie. */
export function r3Gallery(skins: readonly SkinId[] = R3_SKIN_IDS): TitanSpec[] {
  const out: TitanSpec[] = [];
  for (const cls of R3_CLASS_IDS) for (const v of R3_VARIANT_IDS) for (const s of skins) out.push(r3TitanSpec(cls, v, s));
  return out;
}

/**
 * Titan de R3 pour un Titan de la simulation (lecture seule) : la classe la plus proche de sa hauteur, le corps tiré de sa
 * silhouette et de son numéro, la peau de son numéro. La hauteur reste celle de la simulation.
 */
export function r3TitanForUnit(height: number, silhouette: number, id: number): TitanSpec {
  let best = R3_CLASS_IDS[0] as string;
  let bd = Infinity;
  for (const cls of R3_CLASS_IDS) {
    const h = titanSpec(cls).height;
    const d = Math.abs(Math.log(h / Math.max(0.5, height)));
    if (d < bd) {
      bd = d;
      best = cls;
    }
  }
  const variant = R3_VARIANT_IDS[(Math.abs(silhouette) + id) % 3] as TitanVariantId;
  const skin = R3_SKIN_IDS[Math.abs(id) % 2] as SkinId;
  return { ...r3TitanSpec(best, variant, skin), height };
}

export function outfit(id: OutfitId): Outfit {
  const o = FIGURES_R3.soldats.find((s) => s.id === id);
  if (!o) throw new Error(`tenue inconnue : ${id}`);
  return o;
}

/**
 * Tenue d'un fantassin de la simulation selon sa faction [A] : Paradis → Garnison (la Police militaire reste à l'intérieur des
 * murs, hors des batailles de compagnie) ; les autres → infanterie de Marley, et l'officier en tête de section.
 */
export function outfitForFaction(faction: string, officer: boolean): OutfitId {
  if (faction === "fac_paradis") return "garnison";
  return officer ? "marley_officier" : "marley_infanterie";
}
