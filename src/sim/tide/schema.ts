import { z } from "zod";
import type { TideState } from "./region";

/** Schéma Zod de `TideState` (lecture d'une sauvegarde). */
const num = z.number().finite();
const GridSchema = z
  .object({ w: z.number().int().min(1), h: z.number().int().min(1), cellM: num, originX: num, originY: num, density: z.array(num), spike: z.array(num), blocked: z.array(z.boolean()), capacity: z.array(num) })
  .passthrough()
  .refine((g) => [g.density, g.spike, g.blocked, g.capacity].every((a) => a.length === g.w * g.h), "longueurs de grille incohérentes");

export const TideStateSchema = z.object({ regions: z.record(z.string(), z.object({ idle: z.number().int().min(0), grid: GridSchema }).passthrough()) }).passthrough() as unknown as z.ZodType<TideState>;
