import { z } from "zod";
import type { WallState } from "./types";

/** Schéma Zod de `WallState` (lecture d'une sauvegarde) : la forme est vérifiée à la désérialisation, pas au tick. */
const num = z.number().finite();
const ring = z.enum(["maria", "rose", "sina"]);

const DistrictSchema = z
  .object({
    id: z.string(),
    ring,
    owner: z.string().optional(),
    population: num,
    foodCapacity: num,
    rations: num,
    rationPolicy: z.object({ mult: num, capacityMult: num, daysLeft: num }).optional(),
    order: num,
    status: z.enum(["intact", "breach", "abandoned", "reconquered"]),
    cleanup: num,
    neighbors: z.array(z.string()),
  })
  .passthrough();

const rec = <T extends z.ZodTypeAny>(t: T) => z.record(z.string(), t);
const byRing = <T extends z.ZodTypeAny>(t: T) => z.object({ maria: t, rose: t, sina: t });

export const WallStateSchema = z
  .object({
    districts: rec(DistrictSchema),
    gates: byRing(z.boolean()),
    evacuations: z.array(
      z
        .object({
          id: z.string(),
          from: z.string(),
          to: z.string(),
          waiting: num,
          batches: z.array(z.object({ n: num, hoursLeft: num })),
          distanceM: num,
          hoursElapsed: num,
          done: z.boolean(),
        })
        .passthrough(),
    ),
    ledger: z.object({ start: num, births: num, deaths: num, exported: num }),
    monthsOver: byRing(num),
    projects: z.array(z.object({ id: z.string(), district: z.string(), monthsLeft: num, gain: num }).passthrough()),
    effects: z.object({ legitimacy: num }),
    nextId: num,
  })
  .passthrough() as unknown as z.ZodType<WallState>;
