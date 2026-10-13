import { readFileSync } from "node:fs";
import { SignalBalanceSchema } from "../../../src/data/balance";
import type { Signal, SignalUnit } from "../../../src/sim/signal";

export const sb = SignalBalanceSchema.parse(JSON.parse(readFileSync("data/balance/signal.json", "utf8")));

export const sig = (o: Partial<Signal> = {}): Signal => ({ id: "s1", faction: "fac_paradis", branch: "corps", color: "rouge", x: 4000, y: 0, sector: "est", issuedAtS: 0, durationS: 60, ...o });
export const unit = (id: string, x: number, o: Partial<SignalUnit> = {}): SignalUnit => ({ id, faction: "fac_paradis", x, y: 0, relays: false, morale: 1, ...o });

/** Éventail : éclaireur au contact du Titan, un relais en vue directe, puis deux maillons hors de la portée de la fusée (2,5 km). */
export const fan = (): SignalUnit[] => [
  unit("a_scout", 4000, { formation: "eventail", relays: true }),
  unit("b_relais1", 3000, { formation: "eventail", relays: true }),
  unit("c_relais2", 1400, { formation: "eventail", relays: true }),
  unit("z_chef", 0, { formation: "eventail", relays: true }),
];
/** Colonne : éclaireur isolé devant ; le gros de la troupe groupé autour du chef, sans relais. */
export const column = (): SignalUnit[] => [
  unit("a_scout", 4000, { formation: "colonne" }),
  unit("b_t1", 60, { formation: "colonne" }),
  unit("c_t2", 30, { formation: "colonne" }),
  unit("z_chef", 0, { formation: "colonne" }),
];
