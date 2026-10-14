import { z } from "zod";
import type { TruthState } from "./types";

/** Schéma Zod de `TruthState` (lecture d'une sauvegarde) : la forme est vérifiée à la désérialisation, pas au tick. */
const num = z.number().finite();
const str = z.string();

const EvidenceSchema = z.object({ id: str, fact: str, source: str, claim: z.boolean(), day: num, origin: str, quality: num }).passthrough();

export const TruthStateSchema = z
  .object({
    facts: z.record(str, z.object({ veracity: z.boolean(), day: num }).passthrough()),
    dossiers: z.record(str, z.record(str, z.array(EvidenceSchema))),
    discovered: z.record(str, z.record(str, num)),
    acts: z.record(str, str),
    canon: z.object({ drift: num, lastDay: num, pulled: z.record(str, num) }).passthrough(),
    events: z.array(z.object({ type: z.enum(["discovery", "contradiction", "act_reached"]), day: num, faction: str }).passthrough()),
    seq: num,
  })
  .passthrough() as unknown as z.ZodType<TruthState>;
