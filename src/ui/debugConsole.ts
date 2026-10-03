import { t } from "../i18n";
import { stateHash } from "../sim/core/canonical";
import type { Command } from "../sim/core/commands";
import type { GameState } from "../sim/core/state";

/** Ce dont la console a besoin : elle ne touche l'état qu'à travers des commandes. */
export interface ConsoleHost {
  state(): GameState;
  dispatch(cmd: Command): Promise<void>;
  reset(seed: number): Promise<void>;
  save(slot: string): Promise<void>;
  load(slot: string): Promise<void>;
  canonReport(): Promise<string>;
}

export interface ConsoleResult {
  ok: boolean;
  text: string;
}

const COMMANDS = ["help", "seed", "date", "advance", "hash", "save", "load", "canon", "mort", "decret"] as const;

/** Interprète une ligne de la console de service (logique pure, testable sans DOM). */
export async function runConsoleLine(host: ConsoleHost, line: string): Promise<ConsoleResult> {
  const [name = "", ...args] = line.trim().split(/\s+/);
  const ok = (text: string): ConsoleResult => ({ ok: true, text });
  const fail = (text: string): ConsoleResult => ({ ok: false, text });
  try {
    switch (name) {
      case "":
        return ok("");
      case "help":
        return ok(COMMANDS.map((c) => `${c.padEnd(8)} ${t(`console.help.${c}`)}`).join("\n"));
      case "seed": {
        if (args[0] === undefined) return ok(t("console.seed", { seed: host.state().seed }));
        const seed = Number(args[0]);
        if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return fail(t("console.error.seed"));
        await host.reset(seed);
        return ok(t("console.seed_reset", { seed }));
      }
      case "date": {
        const d = host.state().date;
        return ok(t("date.format", { year: d.year, day: d.day }));
      }
      case "advance": {
        const n = Number(args[0] ?? "1");
        await host.dispatch({ type: "AdvanceDays", n });
        const d = host.state().date;
        return ok(t("console.advanced", { n, date: t("date.format", { year: d.year, day: d.day }) }));
      }
      case "hash":
        return ok(stateHash(host.state()));
      case "save": {
        const slot = args[0] ?? "console";
        await host.save(slot);
        return ok(t("console.saved", { slot }));
      }
      case "load": {
        const slot = args[0] ?? "console";
        await host.load(slot);
        return ok(t("console.loaded", { slot, hash: stateHash(host.state()) }));
      }
      case "canon":
        return ok(await host.canonReport());
      case "mort": {
        // Commande de service (P2) : la mort sera déclenchée plus tard par les combats et les événements.
        const character = args[0] ?? "";
        const cause = (args[1] ?? "inconnue") as Extract<Command, { type: "CharacterDies" }>["cause"];
        await host.dispatch({ type: "CharacterDies", character, cause });
        return ok(t("console.died", { id: character }));
      }
      case "decret": {
        await host.dispatch({ type: "EnactLaw", law: args[0] ?? "", override: args[1] === "force" });
        return ok(t("console.decree", { id: args[0] ?? "" }));
      }
      default:
        return fail(t("console.error.unknown", { name }));
    }
  } catch (e) {
    return fail((e as Error).message);
  }
}
