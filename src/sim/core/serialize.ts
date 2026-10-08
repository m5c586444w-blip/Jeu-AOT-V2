import { canonicalJson } from "./canonical";
import { CURRENT_SCHEMA_VERSION } from "./state";
import type { GameState } from "./state";

/** Une migration fait passer un état brut de la version `from` à `from + 1`. */
export interface Migration {
  from: number;
  describe: string;
  migrate(raw: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Registre des migrations. Exemple de référence (AC-09) : la version 0 (prototype) stockait
 * `turn` (jours écoulés depuis an 845 jour 1) et pas de `commandIndex`.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    from: 0,
    describe: "v0 → v1 : `turn` devient `date {year, day}` ; ajout de `commandIndex`",
    migrate(raw) {
      const turn = typeof raw["turn"] === "number" ? raw["turn"] : 0;
      const { turn: _dropped, ...rest } = raw;
      void _dropped;
      return {
        ...rest,
        schemaVersion: 1,
        date: { year: 845 + Math.floor(turn / 360), day: (turn % 360) + 1 },
        commandIndex: typeof raw["commandIndex"] === "number" ? raw["commandIndex"] : 0,
      };
    },
  },
  {
    from: 1,
    describe: "v1 → v2 : ajout de la couche stratégique (`strategic: null` pour une partie de fondation)",
    migrate(raw) {
      return { ...raw, schemaVersion: 2, strategic: raw["strategic"] ?? null };
    },
  },
  {
    from: 2,
    describe: "v2 → v3 : ajout de la couche politique (`politics: null` pour une partie sans politique)",
    migrate(raw) {
      return { ...raw, schemaVersion: 3, politics: raw["politics"] ?? null };
    },
  },
  {
    from: 3,
    describe: "v3 → v4 : ajout de la couche militaire (`military: null` ; le Corps est généré au premier jour simulé si le monde en a une)",
    migrate(raw) {
      return { ...raw, schemaVersion: 4, military: raw["military"] ?? null };
    },
  },
  {
    from: 4,
    describe: "v4 → v5 : bataille en attente sur chaque expédition (`pending: null`), P4",
    migrate(raw) {
      const mil = raw["military"] as { expeditions?: Record<string, unknown>[] } | null | undefined;
      const military = mil ? { ...mil, expeditions: (mil.expeditions ?? []).map((e) => ({ ...e, pending: e["pending"] ?? null })) } : (mil ?? null);
      return { ...raw, schemaVersion: 5, military };
    },
  },
  {
    from: 5,
    describe: "v5 → v6 : événements, recherche et renseignement (`events`, `research`, `intel` : null ; créés au premier jour simulé), P5",
    migrate(raw) {
      return { ...raw, schemaVersion: 6, events: raw["events"] ?? null, research: raw["research"] ?? null, intel: raw["intel"] ?? null };
    },
  },
  {
    from: 6,
    describe: "v6 → v7 : Titans-porteurs (`shifters` : null ; porteurs de 850 repris des données au premier jour simulé), P6",
    migrate(raw) {
      return { ...raw, schemaVersion: 7, shifters: raw["shifters"] ?? null };
    },
  },
  {
    from: 7,
    describe: "v7 → v8 : monde des nations (`nations` : null ; créé au premier jour simulé si le scénario en a un), P7",
    migrate(raw) {
      return { ...raw, schemaVersion: 8, nations: raw["nations"] ?? null };
    },
  },
];

export class SaveFormatError extends Error {
  override readonly name = "SaveFormatError";
}

export function serialize(state: GameState): string {
  return canonicalJson(state);
}

export function migrate(raw: Record<string, unknown>, migrations: readonly Migration[] = MIGRATIONS): Record<string, unknown> {
  let current = raw;
  let version = typeof current["schemaVersion"] === "number" ? current["schemaVersion"] : 0;
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new SaveFormatError(`Version de sauvegarde ${version} plus récente que le jeu (${CURRENT_SCHEMA_VERSION})`);
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const m = migrations.find((x) => x.from === version);
    if (!m) throw new SaveFormatError(`Aucune migration depuis la version ${version}`);
    current = m.migrate(current);
    version = m.from + 1;
  }
  return current;
}

/** Désérialise, migre et vérifie la forme ; lève SaveFormatError avec un message explicite. */
export function deserialize(text: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new SaveFormatError(`Sauvegarde illisible (JSON invalide) : ${(e as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new SaveFormatError("Sauvegarde illisible : la racine doit être un objet");
  }
  const raw = migrate(parsed as Record<string, unknown>);
  assertGameState(raw);
  return raw;
}

function assertGameState(raw: Record<string, unknown>): asserts raw is Record<string, unknown> & GameState {
  const problems: string[] = [];
  const isInt = (v: unknown): boolean => typeof v === "number" && Number.isInteger(v);
  if (raw["schemaVersion"] !== CURRENT_SCHEMA_VERSION) problems.push("schemaVersion");
  if (!isInt(raw["seed"])) problems.push("seed");
  const rng = raw["rng"] as Record<string, unknown> | undefined;
  if (!rng || !isInt(rng["state"])) problems.push("rng.state");
  const date = raw["date"] as Record<string, unknown> | undefined;
  if (!date || !isInt(date["year"]) || !isInt(date["day"])) problems.push("date");
  const world = raw["world"] as Record<string, unknown> | undefined;
  if (!world || typeof world["noise"] !== "number" || typeof world["flags"] !== "object" || world["flags"] === null) problems.push("world");
  if (!isInt(raw["commandIndex"])) problems.push("commandIndex");
  const strat = raw["strategic"];
  if (strat !== null && (typeof strat !== "object" || strat === undefined || !("stocks" in strat) || !("provinces" in strat))) problems.push("strategic");
  const pol = raw["politics"];
  if (pol !== null && (typeof pol !== "object" || pol === undefined || !("legitimacy" in pol) || !("characters" in pol))) problems.push("politics");
  const mil = raw["military"];
  if (mil !== null && (typeof mil !== "object" || mil === undefined || !("soldiers" in mil) || !("expeditions" in mil))) problems.push("military");
  const ev = raw["events"];
  if (ev !== null && (typeof ev !== "object" || ev === undefined || !("history" in ev) || !("scheduled" in ev))) problems.push("events");
  const rs = raw["research"];
  if (rs !== null && (typeof rs !== "object" || rs === undefined || !("done" in rs))) problems.push("research");
  const intel = raw["intel"];
  if (intel !== null && (typeof intel !== "object" || intel === undefined || !("agents" in intel) || !("seen" in intel))) problems.push("intel");
  const sh = raw["shifters"];
  if (sh !== null && (typeof sh !== "object" || sh === undefined || !("titans" in sh) || !("serum" in sh))) problems.push("shifters");
  const na = raw["nations"];
  if (na !== null && (typeof na !== "object" || na === undefined || !("nations" in na) || !("forces" in na))) problems.push("nations");
  const ar = raw["armies"];
  if (ar !== undefined && (typeof ar !== "object" || ar === null || !("armies" in ar) || !("fleets" in ar))) problems.push("armies");
  if (problems.length > 0) throw new SaveFormatError(`Sauvegarde corrompue : champs invalides (${problems.join(", ")})`);
}
