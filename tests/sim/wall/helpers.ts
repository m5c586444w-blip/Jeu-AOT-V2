import { readFileSync } from "node:fs";
import { WallBalanceSchema } from "../../../src/data/balance";
import type { District, Ring, WallState } from "../../../src/sim/wall";

export const wb = WallBalanceSchema.parse(
  JSON.parse(readFileSync("data/balance/wall.json", "utf8")),
);

export function district(
  id: string,
  ring: Ring,
  population: number,
  foodCapacity: number,
  neighbors: string[],
): District {
  return {
    id,
    ring,
    population,
    foodCapacity,
    rations: 1,
    order: 70,
    status: "intact",
    cleanup: 1,
    neighbors,
  };
}

/** Trois districts : Maria (sa), Rose (ro), Sina (si), en chaîne ma - ro - si. Maria pressé, Rose confortable. */
export function world3(
  over: Partial<Record<"ma" | "ro" | "si", [number, number]>> = {},
): WallState {
  const [mp, mc] = over.ma ?? [100000, 90000];
  const [rp, rc] = over.ro ?? [400000, 700000];
  const [sp, sc] = over.si ?? [300000, 600000];
  const districts = {
    ma: district("ma", "maria", mp, mc, ["ro"]),
    ro: district("ro", "rose", rp, rc, ["ma", "si"]),
    si: district("si", "sina", sp, sc, ["ro"]),
  };
  return {
    districts,
    gates: { maria: true, rose: true, sina: true },
    evacuations: [],
    ledger: { start: mp + rp + sp, births: 0, deaths: 0, exported: 0 },
    monthsOver: { maria: 0, rose: 0, sina: 0 },
    projects: [],
    effects: { legitimacy: 0 },
    nextId: 1,
  };
}

export function at(s: WallState, id: string): District {
  const d = s.districts[id];
  if (!d) throw new Error(`district absent : ${id}`);
  return d;
}
