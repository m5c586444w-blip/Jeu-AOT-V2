import { describe, expect, it } from "vitest";
import { stateHash } from "../../src/sim/core/canonical";
import { deserialize, serialize } from "../../src/sim/core/serialize";
import { runBattle } from "../../src/sim/tactical/battle";
import { cmd, mil, plan, ready, world } from "./expedition-helpers";
import type { GameState } from "../../src/sim/core/state";

/** Expédition « jouée » jusqu'à sa première bataille en attente. */
function untilPending(seed: number): GameState {
  const s0 = ready(seed);
  let s = cmd(s0, { type: "LaunchExpedition", plan: { ...plan(s0, "prov_maria_est", "eventail", 20), play: true } });
  for (let d = 0; d < 30 && !mil(s).expeditions[0]?.pending && mil(s).expeditions.length > 0; d++) s = cmd(s, { type: "AdvanceDays", n: 1 });
  return s;
}

describe("lien avec les expéditions (AC4-10, F-EXP-18)", () => {
  it("un engagement « joué » met la campagne en pause : bataille en attente, alerte avec pause, expédition figée", () => {
    const s = untilPending(3);
    const e = mil(s).expeditions[0];
    expect(e?.pending).not.toBeNull();
    expect(s.strategic?.log.some((l) => l.key === "log.battle_pending" && l.pause)).toBe(true);
    const day = e?.day;
    const later = cmd(s, { type: "AdvanceDays", n: 3 });
    expect(mil(later).expeditions[0]?.day).toBe(day);
    expect(e?.pending?.setup.soldiers.length).toBeGreaterThanOrEqual(4);
  });

  it("ResolveBattle « jouer » rejoue la bataille : mêmes morts que la bataille tactique, puis l'expédition repart", () => {
    const s = untilPending(3);
    const e = mil(s).expeditions[0];
    const p = e?.pending;
    if (!e || !p) throw new Error();
    const orders = [{ tick: 40, squad: p.setup.soldiers[0]?.squad ?? "", order: "couvrir" as const }];
    const dead0 = e.dead.length + e.namedDead.length;
    const r = cmd(s, { type: "ResolveBattle", expedition: e.id, mode: "jouer", orders });
    const e2 = mil(r).expeditions[0];
    expect(e2?.pending).toBeNull();
    expect(e2?.log.some((l) => l.key === "field.battle_played")).toBe(true);
    const tactical = runBattle(world, p.setup, orders).dead.length;
    expect((e2?.dead.length ?? 0) + (e2?.namedDead.length ?? 0) - dead0).toBe(tactical);
    const after = cmd(r, { type: "AdvanceDays", n: 1 });
    expect(mil(after).expeditions[0]?.day ?? Infinity).toBeGreaterThan(e2?.day ?? 0);
  });

  it("déterministe et rejouable ; « auto » résout aussi ; sauvegarde avec une bataille en attente", () => {
    const s = untilPending(3);
    const id = mil(s).expeditions[0]?.id ?? "";
    const a = cmd(s, { type: "ResolveBattle", expedition: id, mode: "jouer", orders: [] });
    const b = cmd(deserialize(serialize(s)), { type: "ResolveBattle", expedition: id, mode: "jouer", orders: [] });
    expect(stateHash(a)).toBe(stateHash(b));
    const auto = cmd(s, { type: "ResolveBattle", expedition: id, mode: "auto", orders: [] });
    expect(mil(auto).expeditions[0]?.pending).toBeNull();
    expect(mil(auto).expeditions[0]?.log.some((l) => l.key === "field.battle_auto")).toBe(true);
  });

  it("migration v4 → v5 : chaque expédition reçoit pending: null", () => {
    const s = cmd(ready(2), { type: "LaunchExpedition", plan: plan(ready(2)) });
    const raw = JSON.parse(serialize(s)) as { schemaVersion: number; military: { expeditions: Record<string, unknown>[] } };
    raw.schemaVersion = 4;
    for (const e of raw.military.expeditions) delete e["pending"];
    const m = deserialize(JSON.stringify(raw));
    expect(m.schemaVersion).toBe(5);
    expect(m.military?.expeditions[0]?.pending).toBeNull();
  });
});
