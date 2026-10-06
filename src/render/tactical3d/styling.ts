import type { RoofMaterial, StyleProfile, WallMaterial } from "../../data/artSchemas";
import type { Landmark, LandmarkKind, StyledBuilding } from "./envTypes";
import { range, weighted } from "./rng";
import type { Rand } from "./rng";
import { MATERIALS, facadeColor, roofColor } from "./styles";
import { heightAt } from "./terrain";
import type { Heightfield } from "./terrain";
import { footprint, roofRise } from "./town";
import type { Building, RoofKind } from "./town";

/**
 * Habillage par profil (R1b.3) : matière des murs, couverture, forme et pente du toit, hauteurs, teintes, état. Tout vient du
 * profil de style ou de `data/art/materiaux.json` ; aucun choix de style n'est écrit ici.
 */
const LEGACY_WALL: Record<WallMaterial, 0 | 1 | 2> = { colombage: 0, enduit: 0, bois: 0, pierre_taillee: 1, pierre_brute: 1, brique: 2 };

export function pickWeighted<K extends string>(rand: Rand, w: Partial<Record<K, number>>, exclude: readonly K[] = []): K {
  const entries = (Object.entries(w) as [K, number][]).filter(([k, v]) => v > 0 && !exclude.includes(k)).sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) return (Object.keys(w)[0] ?? "") as K;
  return (entries[weighted(rand, entries.map(([, v]) => v))] as [K, number])[0];
}

/** Forme de toit d'une couverture (formes et pentes de `materiaux.json`). */
export function roofShape(rand: Rand, cover: RoofMaterial): { roof: RoofKind; pitch: number } {
  const def = MATERIALS.toits[cover];
  const f = pickWeighted(rand, def.formes);
  const roof: RoofKind = f === "pignon" || f === "croupe" ? f : "plat";
  const [a, b] = def.pente_deg;
  return { roof, pitch: (range(rand, a, b || a) * Math.PI) / 180 };
}

/** Niveau du rez-de-chaussée et profondeur du soubassement sous une emprise. */
export function groundUnder(hf: Heightfield | null, pts: readonly { x: number; y: number }[]): { base: number; plinth: number } {
  if (!hf) return { base: 0, plinth: 0.4 };
  const hs = pts.map((p) => heightAt(hf, p.x, p.y));
  const hi = Math.max(...hs);
  const lo = Math.min(...hs);
  return { base: hi + 0.15, plinth: hi - lo + 0.6 };
}

export interface StyleOpts {
  hf: Heightfield | null;
  /** 0 intact → 1 ruine ; tirage par maison autour de cette valeur. */
  ruin: number;
  /** Couverture imposée (camps, ruines). */
  cover?: RoofMaterial;
  material?: WallMaterial;
}

/** Habille une maison du générateur de ville ou de village selon le profil. */
export function styleBuilding(b: Building, p: StyleProfile, rand: Rand, o: StyleOpts): StyledBuilding {
  const material = o.material ?? pickWeighted<WallMaterial>(rand, p.materiaux);
  const ruin = o.ruin > 0 ? Math.min(1, Math.max(0, o.ruin + range(rand, -0.35, 0.35))) : 0;
  const cover: RoofMaterial = ruin > 0.55 ? "aucun" : (o.cover ?? pickWeighted<RoofMaterial>(rand, p.toits, ["aucun", "toile"]));
  const shape = cover === "aucun" ? { roof: "plat" as RoofKind, pitch: 0 } : roofShape(rand, cover);
  // Hauteurs : étages et hauteur d'étage du profil, faîtage ramené dans l'intervalle du profil.
  const [f0, f1] = p.batiments.etages;
  const [h0, h1] = p.batiments.hauteur_etage_m;
  let floors = Math.max(1, Math.min(f1, Math.max(f0, b.floors)));
  const floorHeight = Math.max(2.4, Math.min(h1, Math.max(h0, b.floorHeight)));
  const styled0 = { ...b, roof: shape.roof, pitch: shape.pitch, floors, floorHeight };
  const [r0, r1] = p.batiments.faitage_m;
  while (floors > 1 && floors * floorHeight + roofRise(styled0) > r1) styled0.floors = --floors;
  while (floors < f1 && floors * floorHeight + roofRise(styled0) < r0) styled0.floors = ++floors;
  const g = groundUnder(o.hf, footprint(b));
  return {
    ...styled0,
    wall: LEGACY_WALL[material],
    material,
    cover,
    wallHex: facadeColor(p, material),
    roofHex: roofColor(p, cover === "aucun" ? "plat" : cover),
    trimHex: p.palette.bois,
    stoneHex: p.palette.pierre,
    ruin,
    base: g.base,
    plinth: g.plinth,
  };
}

export interface LandmarkInit {
  kind: LandmarkKind;
  x: number;
  y: number;
  angle: number;
  w: number;
  d: number;
  h: number;
  material?: WallMaterial;
  cover?: RoofMaterial;
}

/** Repère (église, cathédrale, palais…) : matière la plus noble du profil, couverture principale du profil. */
export function styleLandmark(l: LandmarkInit, p: StyleProfile, hf: Heightfield | null, ruin = 0): Landmark {
  const noble: WallMaterial[] = ["pierre_taillee", "pierre_brute", "brique", "enduit", "colombage", "bois"];
  const material = l.material ?? noble.find((m) => (p.materiaux[m] ?? 0) > 0) ?? "pierre_taillee";
  const ranked = (Object.entries(p.toits) as [RoofMaterial, number][]).filter(([k, w]) => w > 0 && k !== "aucun" && k !== "toile").sort((a, b) => b[1] - a[1]);
  const cover = ruin > 0.6 ? "aucun" : (l.cover ?? ranked[0]?.[0] ?? "ardoise");
  const hw = l.w / 2;
  const hd = l.d / 2;
  const c = Math.cos(l.angle);
  const s = Math.sin(l.angle);
  const corners = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([u, v]) => ({ x: l.x + (u as number) * c - (v as number) * s, y: l.y + (u as number) * s + (v as number) * c }));
  const g = groundUnder(hf, corners);
  return {
    kind: l.kind,
    x: l.x,
    y: l.y,
    angle: l.angle,
    w: l.w,
    d: l.d,
    h: l.h,
    base: g.base,
    material,
    cover,
    wallHex: facadeColor(p, material),
    roofHex: roofColor(p, cover === "aucun" ? "plat" : cover),
    trimHex: p.palette.bois,
    stoneHex: p.palette.pierre,
    ruin,
  };
}
