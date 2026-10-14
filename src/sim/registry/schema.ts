import { z } from "zod";
import type { RegistryState } from "./types";

/** Schéma Zod de `RegistryState` (lecture d'une sauvegarde) : la forme est vérifiée à la désérialisation, pas au tick. */
const num = z.number().finite();
const str = z.string();
const sNull = str.nullable();
const nNull = num.nullable();

const SoldierSchema = z
  .object({
    id: str, faction: str, named: z.boolean(), name: sNull, rank: str, squad: str,
    status: z.enum(["vivant", "mort", "disparu"]),
    joined: num, battles: num, lastBattle: nNull, renown: num, morale: num, stress: num,
    refusingUntil: nNull, missingSince: nNull, missingReason: sNull, character: sNull, promotedDay: nNull, death: sNull,
  })
  .passthrough();

const DeathSchema = z
  .object({
    id: str, soldier: str, faction: str, name: sNull, named: z.boolean(), renown: num, rank: str, squad: str, day: num,
    cause: str, place: str, circumstances: str, witnesses: z.array(str),
    mourners: z.array(z.object({ id: str, kind: sNull, moraleDelta: num, stressDelta: num, outcome: z.enum(["aucun", "refus", "desertion"]) }).passthrough()),
    succession: sNull, inscribed: sNull,
    political: z.object({ divergence: z.boolean(), consequences: z.array(str) }).passthrough().nullable(),
  })
  .passthrough();

export const RegistryStateSchema = z
  .object({
    soldiers: z.record(str, SoldierSchema),
    bonds: z.array(z.object({ a: str, b: str, kind: str, strength: num, since: num }).passthrough()),
    deaths: z.array(DeathSchema),
    steles: z.array(z.object({ id: str, faction: str, place: str, title: str, epitaph: str, day: num, inscribed: z.array(str) }).passthrough()),
    successions: z.array(
      z
        .object({
          id: str, faction: str, squad: str, vacated: str, rank: str, day: num,
          candidates: z.array(z.object({ id: str, score: num, interested: z.boolean() }).passthrough()), appointed: sNull,
        })
        .passthrough(),
    ),
    enlisted: z.record(str, num),
    events: z.array(z.object({ type: str, day: num }).passthrough()),
    seq: z.object({ soldier: num, file: num, stele: num, succession: num }),
    lastDay: num,
  })
  .passthrough() as unknown as z.ZodType<RegistryState>;
