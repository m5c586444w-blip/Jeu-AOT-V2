import { z } from "zod";
import type { SignalState } from "./state";

/** Schéma Zod de `SignalState` (lecture d'une sauvegarde). */
const num = z.number().finite();
const str = z.string();
const color = z.enum(["rouge", "vert", "noir", "jaune"]);
const orderKind = z.enum(["tenir", "avancer", "detourner", "escorter", "evacuer", "incendier", "couvrir", "retraite"]);

const GhostSchema = z.object({ entityId: str, faction: str, x: num, y: num, seenAtS: num, speedMps: num }).passthrough();

const RuleSchema = z
  .object({
    id: str,
    priority: num,
    when: z.union([
      z.object({ kind: z.literal("signal"), color, sector: str.optional(), branch: z.enum(["corps", "garnison"]).optional() }).passthrough(),
      z.object({ kind: z.literal("depot_gaz"), maxKm: num, gasBelowPct: num }).passthrough(),
    ]),
    then: z.object({ kind: orderKind, target: str, headingDeltaDeg: num.optional() }).passthrough(),
  })
  .passthrough();

export const SignalStateSchema = z
  .object({
    ghosts: z.object({ byObserver: z.record(str, z.record(str, GhostSchema)) }).passthrough(),
    doctrines: z.record(str, z.array(RuleSchema)),
  })
  .passthrough() as unknown as z.ZodType<SignalState>;
