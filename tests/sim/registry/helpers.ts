import { readFileSync } from "node:fs";
import { RegistryBalanceSchema } from "../../../src/data/balance";
import type { RegistryBalance } from "../../../src/data/balance";
import { Rng } from "../../../src/sim/core/rng";
import { addBond, createRegistry, enlistGenerated, enlistNamed } from "../../../src/sim/registry";
import type { RegistryState } from "../../../src/sim/registry";

export const rbal: RegistryBalance = RegistryBalanceSchema.parse(JSON.parse(readFileSync("data/balance/registry.json", "utf8")));

export const FA = "fac_paradis";
export const FB = "fac_marley";
export const D0 = 1000;
export const rng = (seed = 7): Rng => new Rng(seed);

/** Copie de l'équilibrage avec une feuille modifiée (chemin « a.b.c »). */
export function withPath(b: RegistryBalance, path: string, value: unknown): RegistryBalance {
  const copy = structuredClone(b) as Record<string, unknown>;
  const keys = path.split(".");
  let cur = copy;
  for (const k of keys.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[keys[keys.length - 1] as string] = value;
  return copy as unknown as RegistryBalance;
}

/** Feuilles de l'équilibrage (tableaux et primitives), hors métadonnées de canon. */
export function leaves(o: object, path = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) => {
    const p = path ? `${path}.${k}` : k;
    if (!path && (k === "canon" || k === "notes_canon")) return [];
    return v !== null && typeof v === "object" && !Array.isArray(v) ? leaves(v as object, p) : [p];
  });
}

export function getPath(o: unknown, path: string): unknown {
  return path.split(".").reduce((c, k) => (c as Record<string, unknown>)[k], o);
}

export interface Squad {
  state: RegistryState;
  leader: string;
  ami: string;
  rival: string;
  amour: string;
  dette: string;
  haine: string;
  plain: string;
  other: string;
  recruits: string[];
}

/** Escouade de test : un chef nommé, un soldat de chaque type de lien, un camarade sans lien, un soldat d'une autre escouade, des recrues générées. */
export function squad(b: RegistryBalance = rbal, faction = FA, day = D0 - 200): Squad {
  const r = rng(1);
  let s = createRegistry();
  const named = (name: string, rank: string, squadId: string): string => {
    const x = enlistNamed(s, { faction, squad: squadId, rank, day, name }, r, b);
    s = x.state;
    return x.id;
  };
  const leader = named("Anton Albrecht", "chef_escouade", "sq1");
  const ami = named("Bertram Brenner", "soldat", "sq1");
  const rival = named("Cornelius Dorfmann", "caporal", "sq1");
  const amour = named("Greta Eisler", "soldat", "sq1");
  const dette = named("Dieter Grabner", "soldat", "sq1");
  const haine = named("Emil Hollweg", "caporal", "sq1");
  const plain = named("Falk Imhoff", "soldat", "sq1");
  const other = named("Gerold Kellner", "soldat", "sq2");
  const g = enlistGenerated(s, { faction, squad: "sq1", count: 3, day }, b);
  s = g.state;
  for (const [id, kind, strength] of [[ami, "ami", 60], [rival, "rival", 50], [amour, "amour", 80], [dette, "dette", 40], [haine, "haine", 70]] as const) s = addBond(s, leader, id, kind, strength, day, b);
  return { state: s, leader, ami, rival, amour, dette, haine, plain, other, recruits: g.ids };
}
