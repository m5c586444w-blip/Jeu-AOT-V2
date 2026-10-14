import { readFileSync } from "node:fs";
import { ClockBalanceSchema, ShiftersBalanceSchema } from "../../../src/data/balance";
import type { ClockBalance } from "../../../src/data/balance";
import { createClockState, registerBearer } from "../../../src/sim/clock";
import type { BearerInput, ClockState } from "../../../src/sim/clock";
import type { ShiftersState, ShifterSlot } from "../../../src/sim/shifters/shifters";

export const cb = ClockBalanceSchema.parse(JSON.parse(readFileSync("data/balance/clock.json", "utf8")));
export const shb = ShiftersBalanceSchema.parse(JSON.parse(readFileSync("data/balance/shifters.json", "utf8")));

/** Copie de l'équilibrage avec une section modifiée (prouve qu'un paramètre a un effet). */
export function tweak<K extends keyof ClockBalance>(key: K, patch: Partial<ClockBalance[K]>): ClockBalance {
  return { ...cb, [key]: { ...(cb[key] as object), ...(patch as object) } };
}

export const slot = (holder: string | null, faction: ShifterSlot["faction"], since: number, o: Partial<ShifterSlot> = {}): ShifterSlot => ({ holder, faction, since, sinceCanon: "A", captured: false, retired: false, visions: 0, ...o });

/** Les Neuf, tenus comme indiqué (Titans non cités : pouvoir perdu). */
export function nineState(held: Record<string, ShifterSlot>): ShiftersState {
  const titans: Record<string, ShifterSlot> = {};
  for (const id of cb.nine) titans[id] = held[id] ?? slot(null, "perdu", 840);
  return { titans, serum: 0, history: [] };
}

export const input = (id: string, o: Partial<BearerInput> = {}): BearerInput => ({ id, faction: "marley", role: "infiltre", will: 60, stress: 20, bonds: 50, ...o });

export function withBearer(i: BearerInput, b: ClockBalance = cb): ClockState {
  return registerBearer(createClockState(), i, b);
}
