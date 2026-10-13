import figuresJson from "../../../../data/art/figures.json";
import type { FiguresFile } from "../../../data/artSchemas";
import { TITANS, titanSpec } from "../titanGallery";
import type { TitanSpec } from "../titan";

/**
 * Catalogue des figures de R3 (sans three.js : testable, lisible par la simulation de rendu seulement).
 * - Titans : pour chaque classe de R1b (3, 5, 8, 12, 15 m), 3 variantes de proportions et 3 peaux (`data/art/figures.json`) ;
 *   la variante d'un Titan de la simulation est tirée de son type, de sa silhouette et de son identifiant (déterministe), sa
 *   hauteur est celle de la simulation.
 * - Tenues : Bataillon, Garnison, Brigades spéciales, infanterie et officiers de Marley ; une règle de rendu donne une tenue à
 *   chaque unité (la simulation ne porte pas le corps d'un soldat). Tous ces choix sont des choix de design `A`.
 */
export const FIGURES = figuresJson as unknown as FiguresFile;
export type OutfitId = FiguresFile["tenues"][number]["id"];
export type Outfit = FiguresFile["tenues"][number];
export type ProportionVariant = FiguresFile["titans"]["proportions"][number];
export type SkinVariant = FiguresFile["titans"]["peaux"][number];

export const TITAN_SIZES: readonly number[] = TITANS.classes.map((c) => c.hauteur_m).sort((a, b) => a - b);
export const PROPORTION_IDS: readonly string[] = FIGURES.titans.proportions.map((p) => p.id);
export const SKIN_IDS: readonly string[] = FIGURES.titans.peaux.map((p) => p.id);
export const OUTFITS: readonly Outfit[] = FIGURES.tenues;
export const STATES = FIGURES.etats;

/** Spécification d'un Titan de R3 : celle de R1b plus l'allure irrégulière et la peau. */
export interface R3TitanSpec extends TitanSpec {
  classId: string;
  proportion: string;
  skinId: string;
  /** Boiterie (0–1) : une jambe traîne, le bassin plonge du côté faible. */
  limp: number;
  /** Roulis des épaules (rad). */
  sway: number;
}

const hex = (h: string): number => Number.parseInt(h.slice(1), 16);
const fnv = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

/** Classe de R1b la plus proche d'une hauteur (m). */
export function classOfHeight(h: number): string {
  let best = TITANS.classes[0];
  for (const c of TITANS.classes) if (best && Math.abs(c.hauteur_m - h) < Math.abs(best.hauteur_m - h)) best = c;
  return best?.id ?? "classe_8";
}

/** Bornes de sécurité des proportions modifiées (une épaisseur ne devient jamais nulle). */
const FLOOR: Partial<Record<keyof TitanSpec, number>> = { belly: 0, waist: 0.035, chest: 0.05, armR: 0.012, thighR: 0.025, neckR: 0.015, hip: 0.035, shoulder: 0.06, depth: 0.4, hand: 0.05 };

export function r3TitanSpec(classId: string, proportion: string, skin: string, height?: number): R3TitanSpec {
  const base = titanSpec(classId);
  const v = FIGURES.titans.proportions.find((p) => p.id === proportion);
  const s = FIGURES.titans.peaux.find((p) => p.id === skin);
  if (!v || !s) throw new Error(`variante de Titan inconnue : ${proportion} / ${skin}`);
  const spec: R3TitanSpec = { ...base, classId, proportion, skinId: skin, limp: v.boiterie, sway: v.roulis, id: `${classId}_${proportion}`, salt: base.salt + fnv(proportion) % 997 };
  const rec = spec as unknown as Record<string, number>;
  // Trait de la classe (R3), puis variante de proportions.
  for (const [k, d] of [...Object.entries(FIGURES.titans.classes.traits[classId]?.modifs ?? {}), ...Object.entries(v.modifs)]) {
    const floor = FLOOR[k as keyof TitanSpec] ?? 0.001;
    rec[k] = Math.max(floor, (rec[k] ?? 0) + d);
  }
  // Les quatre fractions verticales restent de somme 1 (les planchers ne les touchent pas : elles restent loin du bas).
  spec.stride = base.stride * (v.allure.stride ?? 1);
  spec.walkRate = base.walkRate * (v.allure.walkRate ?? 1);
  spec.armSwing = base.armSwing * (v.allure.armSwing ?? 1);
  spec.headTilt = base.headTilt + (v.allure.headTilt ?? 0);
  spec.expression = v.expression;
  spec.hair = v.cheveux;
  spec.skin = hex(s.teinte);
  if (height !== undefined) spec.height = height;
  return spec;
}

/** Les 45 figures de la galerie : 5 classes × 3 proportions × 3 peaux. */
export function allR3Specs(): R3TitanSpec[] {
  const out: R3TitanSpec[] = [];
  for (const c of TITANS.classes) for (const p of PROPORTION_IDS) for (const s of SKIN_IDS) out.push(r3TitanSpec(c.id, p, s));
  return out;
}

/** Ce que le catalogue lit d'un Titan de la simulation (lecture seule). */
export interface TitanKey {
  id: number;
  type: string;
  height: number;
  silhouette: number;
  abnormal: boolean;
}

/** Variante d'un Titan de la simulation : classe la plus proche, proportions et peau tirées de son type, silhouette, identifiant. */
export function titanLook(t: TitanKey): R3TitanSpec {
  const h = fnv(`${t.type}:${t.silhouette}:${t.id}`);
  // Un anormal court : il garde la variante aux longues jambes.
  const prop = t.abnormal ? "echalas" : (PROPORTION_IDS[h % PROPORTION_IDS.length] ?? "trapu");
  const skin = SKIN_IDS[(h >>> 4) % SKIN_IDS.length] ?? "chair";
  return r3TitanSpec(classOfHeight(t.height), prop, skin, t.height);
}

export function outfit(id: OutfitId): Outfit {
  const o = OUTFITS.find((x) => x.id === id);
  if (!o) throw new Error(`tenue inconnue : ${id}`);
  return o;
}

/** Tenue d'un soldat à équipement tridimensionnel (Paradis). */
export function outfitOfSoldier(): OutfitId {
  return FIGURES.regle_tenues.soldat_odm;
}

/** Tenue d'un fantassin : arme pour Paradis ; infanterie adverse, le premier homme de chaque section en officier. */
export function outfitOfTroop(t: { side: "allie" | "ennemi"; kind: string; faction: string }, firstOfSection: boolean): OutfitId {
  const r = FIGURES.regle_tenues;
  if (t.side === "allie" || t.faction === "fac_paradis") return r.paradis[t.kind] ?? "garnison";
  return firstOfSection ? r.adverse_chef : r.adverse;
}

/** Rôle d'équipement d'une figure : lames et appareil (soldat), fusil (fantassin), pistolet (officier). */
export type GearRole = "odm" | "fusil" | "officier";
export function gearOf(o: OutfitId, isTroop: boolean): GearRole {
  if (!isTroop) return "odm";
  return o === "marley_officier" ? "officier" : "fusil";
}
