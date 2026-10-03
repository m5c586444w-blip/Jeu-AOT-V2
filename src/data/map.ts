import { z } from "zod";
import { CanonSchema, ProvinceIdSchema } from "./schemas";

const point = z.tuple([z.number(), z.number()]);
const measure = z.object({ value: z.number().positive(), canon: CanonSchema, note: z.string() }).strict();

/** data/map/paradis.json — géométrie de la carte stratégique (km), générée puis éditable. */
export const MapSchema = z
  .object({
    canon: CanonSchema,
    notes_canon: z.string().optional(),
    units: z.literal("km"),
    bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    walls: z.object({ height_m: measure, thickness_m: measure }).strict(),
    wall_rings: z.array(z.object({ wall: z.enum(["maria", "rose", "sina"]), r_inner: z.number().positive(), r_outer: z.number().positive() }).strict()),
    gates: z.array(z.object({ province: ProvinceIdSchema, bearing: z.number() }).strict()),
    coast: z.array(point).min(3),
    provinces: z.record(ProvinceIdSchema, z.object({ polygon: z.array(point).min(3), anchor: point, ring: z.string(), bearing: z.tuple([z.number(), z.number()]) }).strict()),
    neighbors: z.record(ProvinceIdSchema, z.array(ProvinceIdSchema)),
  })
  .strict();

export type MapData = z.infer<typeof MapSchema>;

/** Contrôles de cohérence carte ↔ provinces : couverture, références, symétrie des voisinages. */
export function checkMap(map: MapData, provinceIds: readonly string[]): string[] {
  const problems: string[] = [];
  const known = new Set(provinceIds);
  for (const id of provinceIds) if (!map.provinces[id]) problems.push(`province sans polygone : ${id}`);
  for (const id of Object.keys(map.provinces)) if (!known.has(id)) problems.push(`polygone d'une province inconnue : ${id}`);
  for (const [id, list] of Object.entries(map.neighbors)) {
    for (const n of list) {
      if (!known.has(n)) problems.push(`voisin inconnu ${n} (de ${id})`);
      else if (!(map.neighbors[n] ?? []).includes(id)) problems.push(`voisinage non symétrique : ${id} → ${n}`);
    }
  }
  for (const g of map.gates) if (!known.has(g.province)) problems.push(`porte sur une province inconnue : ${g.province}`);
  return problems;
}
