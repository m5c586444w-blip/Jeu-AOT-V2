import { readFileSync } from "node:fs";
import { TruthBalanceSchema } from "../../../src/data/balance";
import type { TruthBalance } from "../../../src/data/balance";
import { EventDefSchema } from "../../../src/data/schemas";
import type { EventDef } from "../../../src/data/schemas";
import type { Condition } from "../../../src/data/effects";
import { createTruthState, recordEvidence } from "../../../src/sim/truth";
import type { TruthState } from "../../../src/sim/truth";
import type { EventsState } from "../../../src/sim/events/engine";

export const tbal: TruthBalance = TruthBalanceSchema.parse(JSON.parse(readFileSync("data/balance/truth.json", "utf8")));

/** Copie de l'équilibrage avec une section modifiée (prouve qu'un paramètre a un effet). */
export function tweak<K extends keyof TruthBalance>(key: K, patch: Partial<TruthBalance[K]>): TruthBalance {
  return { ...tbal, [key]: { ...(tbal[key] as object), ...(patch as object) } };
}

export const FA = "fac_a";
export const FB = "fac_b";
export const T0 = 1000;

export const fresh = (): TruthState => createTruthState(tbal, T0);

/** Verse une pièce au dossier de `faction` (jour `day`, origine distincte par défaut). */
export function put(s: TruthState, faction: string, fact: string, source: string, claim: boolean, o: { day?: number; origin?: string; quality?: number; b?: TruthBalance } = {}): TruthState {
  const b = o.b ?? tbal;
  return recordEvidence(s, faction, fact, source, claim, o.day ?? T0, o.origin ?? `${source}:${s.seq}`, b, o.quality ?? 1).state;
}

/** Événement canon synthétique, sans effet ni choix. */
export function canonEvent(id: string, year: number, o: Partial<{ after: string | null; conditions: Condition[]; weight: number; yearMax: number }> = {}): EventDef {
  return EventDefSchema.parse({
    id,
    kind: "canon",
    year_min: year,
    ...(o.yearMax !== undefined ? { year_max: o.yearMax } : {}),
    window: { after: o.after ?? null, within_days: [0, 0] },
    divergence_weight: o.weight ?? 0.5,
    conditions: o.conditions ?? [],
    text_key: `evt.${id}`,
    canon: "A",
  } as unknown);
}

export const emptyEvents = (): EventsState => ({ history: {}, scheduled: [], pending: [], divergence: 0, branch: "canon", flags: {}, chronicle: [], genericLast: {}, lastGeneric: -999 });
