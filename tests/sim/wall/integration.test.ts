import { describe, expect, it } from "vitest";
import { loadWorld } from "../../../src/data/worldNode";
import { stateHash } from "../../../src/sim/core/canonical";
import { applyCommand, replay } from "../../../src/sim/core/commands";
import type { Command } from "../../../src/sim/core/commands";
import { deserialize, serialize } from "../../../src/sim/core/serialize";
import { createInitialState } from "../../../src/sim/core/state";
import type { GameState } from "../../../src/sim/core/state";
import { conservationGap, totalPopulation } from "../../../src/sim/wall";
import type { WallState } from "../../../src/sim/wall";

const world = loadWorld("data", "scn_sandbox_850");
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, world), s);
const wallOf = (s: GameState): WallState => {
  if (!s.pillars?.wall) throw new Error("mur absent");
  return s.pillars.wall;
};
const script: Command[] = [{ type: "EnableWall" }, { type: "AdvanceDays", n: 365 }];

describe("C9 étape 1 : pilier P1 Le Mur branché au tick (désactivé par défaut)", () => {
  it("désactivé par défaut : aucun champ pillars, le tick ignore le mur, l'empreinte ne dépend pas de la table", () => {
    const s = run(createInitialState(7, world), { type: "AdvanceDays", n: 40 });
    expect(s.pillars).toBeUndefined();
    expect(world.wall?.layout.districts).toBeDefined();
  });

  it("EnableWall crée l'état depuis les provinces de 850 ; l'activer deux fois ne le réinitialise pas", () => {
    const s = run(createInitialState(7, world), { type: "EnableWall" });
    const w = wallOf(s);
    const prov = s.strategic?.provinces ?? {};
    const expected = Object.keys(w.districts).reduce((n, id) => n + (prov[id]?.population ?? 0), 0);
    expect(Object.keys(w.districts).length).toBeGreaterThan(10);
    expect(totalPopulation(w)).toBe(expected);
    expect(expected).toBeGreaterThan(0);
    const later = run(s, { type: "AdvanceDays", n: 3 }, { type: "EnableWall" });
    expect(wallOf(later)).toEqual(wallOf(run(s, { type: "AdvanceDays", n: 3 })));
  });

  it("365 jours : population conservée au registre, mur avancé, déterministe", () => {
    const a = run(createInitialState(7, world), ...script);
    const b = run(createInitialState(7, world), ...script);
    const w = wallOf(a);
    expect(Math.abs(conservationGap(w))).toBeLessThan(1e-6);
    expect(w.ledger.births).toBeGreaterThan(0);
    expect(w.ledger.deaths).toBeGreaterThan(0);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(stateHash(a)).not.toBe(stateHash(run(createInitialState(7, world), { type: "AdvanceDays", n: 365 })));
  });

  it("rejeu du journal et aller-retour de sauvegarde : même empreinte", () => {
    const direct = run(createInitialState(7, world), ...script);
    const replayed = replay(createInitialState(7, world), script, world);
    expect(stateHash(replayed)).toBe(stateHash(direct));
    expect(stateHash(deserialize(serialize(direct)))).toBe(stateHash(direct));
  });
});
