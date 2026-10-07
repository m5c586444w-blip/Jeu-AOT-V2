import { z } from "zod";
import { ProvinceIdSchema } from "./schemas";

/**
 * data/map/terrain/paradis.json — carte réaliste de l'île (MAP) : terrain figé (relief, milieux), côte, îlots,
 * fleuves, murs, villes, routes, et le dessin des provinces. Généré une fois par `npm run map:terrain` (graine et
 * version dans le fichier), puis committé. Donnée de RENDU seulement : la simulation ne la lit jamais.
 */
export const BIOMES = [
  "mer_profonde", "mer", "plage", "prairie", "cultures", "foret", "arbres_geants", "marais", "collines", "montagne",
  "roche", "lac", "ville", "falaise", "foret_morte", "steppe",
] as const;
export type Biome = (typeof BIOMES)[number];
export const BIOME: Readonly<Record<Biome, number>> = Object.fromEntries(BIOMES.map((b, i) => [b, i])) as Record<Biome, number>;

const point = z.tuple([z.number(), z.number()]);

export const TerrainSchema = z
  .object({
    version: z.literal(1),
    seed: z.string(),
    hash: z.string(),
    units: z.literal("km"),
    bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    grid: z.object({ n: z.number().int().positive(), cell_km: z.number().positive(), sea_level: z.number().int() }).strict(),
    /** Altitude quantifiée par cellule (octets en base64, ligne par ligne, nord en haut) : < sea_level = fond marin. */
    height: z.string(),
    /** Milieu par cellule (indice dans BIOMES), octets en base64. */
    biome: z.string(),
    coast: z.array(point).min(3),
    islets: z.array(z.array(point).min(3)),
    rivers: z.array(z.object({ width: z.number().positive(), points: z.array(point).min(2) }).strict()),
    walls: z.array(z.object({ wall: z.enum(["maria", "rose", "sina"]), line: z.array(point).min(3), band_km: z.number().positive() }).strict()),
    gates: z.array(z.object({ province: ProvinceIdSchema, at: point, bearing: z.number() }).strict()),
    provinces: z.record(ProvinceIdSchema, z.object({ polygon: z.array(point).min(3), anchor: point, pawn: point }).strict()),
    neighbors: z.record(ProvinceIdSchema, z.array(ProvinceIdSchema)),
    towns: z.array(z.object({ province: ProvinceIdSchema, at: point, size: z.enum(["hameau", "bourg", "ville", "district", "capitale", "fort"]) }).strict()),
    roads: z.array(z.object({ points: z.array(point).min(2), kind: z.enum(["route", "chemin"]) }).strict()),
    bridges: z.array(point),
  })
  .strict();

export type TerrainData = z.infer<typeof TerrainSchema>;

/** Octets d'une grille encodée en base64 (navigateur et Node). */
export function decodeGrid(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}
