import { z } from "zod";
import type { GasState } from "./state";

/** Schéma Zod de `GasState` (lecture d'une sauvegarde) : dégâts par ancrage dans [0, 1]. */
export const GasStateSchema = z
  .object({
    ledgers: z.record(z.string(), z.object({ damage: z.record(z.string(), z.number().finite().min(0).max(1)) }).passthrough()),
  })
  .passthrough() as unknown as z.ZodType<GasState>;
