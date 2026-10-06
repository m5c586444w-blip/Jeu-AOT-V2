import materialsJson from "../../../data/art/materiaux.json";
import stylesJson from "../../../data/art/styles.json";
import wallsJson from "../../../data/art/murs.json";
import type { MaterialsFile, RoofMaterial, StyleProfile, WallMaterial, WallsFile } from "../../data/artSchemas";

/**
 * Profils de style des environnements (R1b.1) : lecture de `data/art/`, distances entre profils, règle de visibilité du mur.
 * Calcul pur, sans three.js ni DOM. Les données sont validées par `npm run data:validate` (schémas de `src/data/artSchemas.ts`,
 * dont on n'importe ici que les types : Zod reste hors du morceau 3D).
 */
export type { RoofMaterial, StyleProfile, WallMaterial } from "../../data/artSchemas";
export type Variant = StyleProfile["variantes"][number];
export type PaletteRole = keyof StyleProfile["palette"];

export const PROFILES = stylesJson as unknown as readonly StyleProfile[];
export const MATERIALS = materialsJson as unknown as MaterialsFile;
export const WALLS = wallsJson as unknown as WallsFile;

export function profile(id: string): StyleProfile {
  const p = PROFILES.find((x) => x.id === id);
  if (!p) throw new Error(`profil de style inconnu : ${id}`);
  return p;
}

/** Profil d'une variante : ses surcharges (densité, terrain) appliquées, l'identité gardée. */
export function withVariant(p: StyleProfile, variantId: string | null): { profile: StyleProfile; variant: Variant | null } {
  const v = variantId ? (p.variantes.find((x) => x.id === variantId) ?? null) : null;
  if (!v?.surcharges) return { profile: p, variant: v };
  return { profile: { ...p, densite: v.surcharges.densite ?? p.densite, terrain: v.surcharges.terrain ?? p.terrain }, variant: v };
}

export const LOTS: Record<1 | 2, readonly string[]> = {
  1: PROFILES.filter((p) => p.lot === 1).map((p) => p.id),
  2: PROFILES.filter((p) => p.lot === 2).map((p) => p.id),
};

// ——— Couleur ———

export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const lin = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** sRGB (0–255) → CIELAB (D65). */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE76(a: readonly [number, number, number], b: readonly [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export const hexLab = (hex: string): [number, number, number] => rgbToLab(...hexToRgb(hex));

/**
 * Distance entre deux palettes : moyenne symétrique, sur les 6 teintes, de la distance ΔE76 de chaque teinte à la plus proche de
 * l'autre palette. Indépendante de l'ordre des teintes : deux palettes qui ne diffèrent que par l'attribution des rôles sont à 0.
 */
export function paletteDistance(a: StyleProfile["palette"], b: StyleProfile["palette"]): number {
  const A = Object.values(a).map(hexLab);
  const B = Object.values(b).map(hexLab);
  const side = (X: [number, number, number][], Y: [number, number, number][]): number => X.reduce((s, x) => s + Math.min(...Y.map((y) => deltaE76(x, y))), 0) / X.length;
  return (side(A, B) + side(B, A)) / 2;
}

/** Distance de variation totale entre deux répartitions (moitié de la somme des écarts absolus, de 0 à 1). */
export function totalVariation(a: Partial<Record<string, number>>, b: Partial<Record<string, number>>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let s = 0;
  for (const k of keys) s += Math.abs((a[k] ?? 0) - (b[k] ?? 0));
  return s / 2;
}

/**
 * Écarts « nettement perceptibles » de chaque composante (`docs/phases/R1b.md` § 4) :
 * - palette : ΔE76 = 10 ;
 * - toits et matériaux : 0,25 de variation totale (un bâtiment sur quatre change) ;
 * - densité bâtie : 0,15.
 */
export const DISTINCT_STEP = { palette: 10, toits: 0.25, materiaux: 0.25, densite: 0.15 } as const;
/** Seuil de distinction : la norme des écarts normalisés vaut au moins un écart nettement perceptible. */
export const DISTINCT_THRESHOLD = 1;

export interface ProfileDistance {
  /** Norme euclidienne des quatre écarts normalisés. */
  total: number;
  palette: number;
  toits: number;
  materiaux: number;
  densite: number;
}

export interface StyleShares {
  palette: StyleProfile["palette"];
  toits: Partial<Record<string, number>>;
  materiaux: Partial<Record<string, number>>;
  densite: number;
}

export function styleDistance(a: StyleShares, b: StyleShares): ProfileDistance {
  const palette = paletteDistance(a.palette, b.palette);
  const toits = totalVariation(a.toits, b.toits);
  const materiaux = totalVariation(a.materiaux, b.materiaux);
  const densite = Math.abs(a.densite - b.densite);
  const total = Math.hypot(palette / DISTINCT_STEP.palette, toits / DISTINCT_STEP.toits, materiaux / DISTINCT_STEP.materiaux, densite / DISTINCT_STEP.densite);
  return { total, palette, toits, materiaux, densite };
}

export const profileDistance = (a: StyleProfile, b: StyleProfile): ProfileDistance => styleDistance(a, b);

/** Toutes les paires d'un lot, de la plus proche à la plus lointaine. */
export function lotPairs(lot: 1 | 2): { a: string; b: string; d: ProfileDistance }[] {
  const ids = LOTS[lot];
  const out: { a: string; b: string; d: ProfileDistance }[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i] as string;
      const b = ids[j] as string;
      out.push({ a, b, d: profileDistance(profile(a), profile(b)) });
    }
  }
  return out.sort((x, y) => x.d.total - y.d.total);
}

// ——— Couvertures et façades : rôle de palette ———

/** Teinte d'une couverture pour un profil : la plus fréquente prend `toit`, la deuxième `toit_2`, les autres leur teinte de base. */
export function roofColor(p: StyleProfile, m: RoofMaterial): string {
  const ranked = (Object.entries(p.toits) as [RoofMaterial, number][]).filter(([k, w]) => w > 0 && k !== "aucun").sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  if (ranked[0]?.[0] === m) return p.palette.toit;
  if (ranked[1]?.[0] === m) return p.palette.toit_2;
  return MATERIALS.toits[m].base;
}

/** Teinte d'une façade pour un profil : le rôle de palette du matériau, ou sa teinte de base (brique). */
export function facadeColor(p: StyleProfile, m: WallMaterial): string {
  const role = MATERIALS.facades[m].role;
  return role === "base" ? MATERIALS.facades[m].base : p.palette[role];
}

// ——— Visibilité du mur ———

export const EARTH_RADIUS_M = 6_371_000;

/**
 * Hauteur cachée par la courbure de la Terre, pour un œil à `eye` m et un objet à `distance` m (sans réfraction) :
 * la partie de l'objet sous l'horizon géométrique.
 */
export function hiddenBelowHorizon(distance: number, eye: number, R = EARTH_RADIUS_M): number {
  const horizon = Math.sqrt(2 * R * eye + eye * eye);
  if (distance <= horizon) return 0;
  const beyond = distance - horizon;
  return Math.sqrt(R * R + beyond * beyond) - R;
}

/** Le sommet du mur dépasse-t-il l'horizon pour un observateur au sol ? */
export function wallTopAboveHorizon(distance: number, eye = 1.7, height = WALLS.hauteur_m.valeur): boolean {
  return hiddenBelowHorizon(distance, eye) < height;
}

/**
 * Distance minimale au mur le plus proche au milieu d'un anneau : la moitié de l'écart entre deux murs (≈ 100 km Maria → Rose,
 * ≈ 130 km Rose → Sina, `?`).
 */
export function ringMidDistanceM(): number {
  return (Math.min(WALLS.distance_maria_rose_km.valeur, WALLS.distance_rose_sina_km.valeur) / 2) * 1000;
}

/**
 * Règle de visibilité (consigne R1b, tâche 4) : le mur n'apparaît à l'horizon que près des districts adossés à un mur (et des
 * ouvrages qui le touchent) ; jamais dans la campagne intérieure. Le profil le décide ; les scènes n'ajoutent un mur que si
 * cette fonction l'autorise.
 */
export function wallInScene(p: StyleProfile): boolean {
  return p.mur_visible.visible;
}

/** Teinte d'un sol (`materiaux.json`, sols) mêlée à la teinte `sol` du profil : terre battue, potagers, berges… */
export function groundHex(p: StyleProfile, k: keyof MaterialsFile["sols"], share = 0.25): string {
  const a = hexToRgb(MATERIALS.sols[k].base);
  const b = hexToRgb(p.palette.sol);
  const mix = a.map((v, i) => Math.round(v + ((b[i] as number) - v) * share));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
