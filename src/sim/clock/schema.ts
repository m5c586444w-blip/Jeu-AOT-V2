import { z } from "zod";
import type { ClockState } from "./types";

/** Schéma Zod de `ClockState` (lecture d'une sauvegarde) : la forme est vérifiée à la désérialisation, pas au tick. */
const num = z.number().finite();
const str = z.string();

const BearerSchema = z
  .object({
    id: str, faction: str, role: str, cover: num, will: num, stress: num, bonds: num,
    convictions: z.record(str, num), wearYears: num, exposedTo: z.array(str),
  })
  .passthrough();

const SuspectSchema = z.object({ value: num, shown: num, lastEvidenceDay: num, closed: z.boolean() }).passthrough();

export const ClockStateSchema = z
  .object({
    bearers: z.record(str, BearerSchema),
    suspects: z.record(str, z.record(str, SuspectSchema)),
    events: z.array(z.object({ type: z.enum(["unmasked", "false_accusation"]), day: num }).passthrough()),
  })
  .passthrough() as unknown as z.ZodType<ClockState>;
