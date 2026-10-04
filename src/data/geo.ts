import { z } from "zod";
import type { MapData } from "./map";
import { CanonSchema, ProvinceIdSchema } from "./schemas";

/**
 * data/geo/paradis.json — graphe de routage dérivé de la carte (P3) : ancre de chaque province (km), zone,
 * arêtes pondérées par la distance, portes. Généré par `npm run map:generate` ; la simulation ne lit jamais les polygones.
 */
export const GEO_ZONES = ["sina", "rose", "maria", "outre", "mur_sina", "mur_rose", "mur_maria"] as const;
export type GeoZone = (typeof GEO_ZONES)[number];

export const GeoSchema = z
  .object({
    canon: CanonSchema,
    notes_canon: z.string().optional(),
    units: z.literal("km"),
    provinces: z.record(ProvinceIdSchema, z.object({ x: z.number(), y: z.number(), zone: z.enum(GEO_ZONES) }).strict()),
    edges: z.array(z.tuple([ProvinceIdSchema, ProvinceIdSchema, z.number().positive()])),
    gates: z.array(ProvinceIdSchema),
  })
  .strict();

export type GeoData = z.infer<typeof GeoSchema>;

const ZONE_OF_RING: Record<string, GeoZone> = {
  sina_coeur: "sina",
  sina_anneau: "sina",
  mur_sina: "mur_sina",
  rose_interieur: "rose",
  rose_exterieur: "rose",
  mur_rose: "mur_rose",
  maria_interieur: "maria",
  maria_exterieur: "maria",
  mur_maria: "mur_maria",
  outre_murs: "outre",
};

const round = (v: number): number => Math.round(v * 10) / 10;

/** Dérive le graphe de routage de la géométrie : une arête par paire de voisins, distance entre ancres. */
export function geoFromMap(map: MapData): GeoData {
  const provinces: GeoData["provinces"] = {};
  for (const id of Object.keys(map.provinces).sort()) {
    const p = map.provinces[id];
    if (!p) continue;
    const zone = ZONE_OF_RING[p.ring];
    if (!zone) throw new Error(`anneau inconnu : ${p.ring} (${id})`);
    provinces[id] = { x: p.anchor[0], y: p.anchor[1], zone };
  }
  const edges: GeoData["edges"] = [];
  for (const a of Object.keys(map.neighbors).sort()) {
    for (const b of [...(map.neighbors[a] ?? [])].sort()) {
      if (a >= b) continue;
      const pa = provinces[a];
      const pb = provinces[b];
      if (!pa || !pb) continue;
      edges.push([a, b, Math.max(0.1, round(Math.hypot(pa.x - pb.x, pa.y - pb.y)))]);
    }
  }
  return {
    canon: "A",
    notes_canon: "Généré par `npm run map:generate` à partir de data/map/paradis.json : ne pas éditer à la main.",
    units: "km",
    provinces,
    edges,
    gates: map.gates.map((g) => g.province).sort(),
  };
}

export function isWallZone(z: GeoZone): boolean {
  return z.startsWith("mur_");
}
