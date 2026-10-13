import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { SOLO_SEAT } from "../../src/sim/core/seat";
import { applyBattleOrderAs, applyEnveloped, checkEnvelope } from "../../src/sim/commands/apply";
import { EnvelopeJournal, fingerprint, replayEnvelopes, submit } from "../../src/sim/commands/journal";
import type { CommandEnvelope } from "../../src/sim/commands/schema";
import { createBattle } from "../../src/sim/tactical/battle";
import { skirmishSetup } from "../../src/sim/tactical/setup";

const w850 = loadWorld("data", "scn_sandbox_850");
const env = (seat: string, day: number, command: CommandEnvelope["command"]): CommandEnvelope => ({ seat, day, command });

/** Journal de référence : ordres d'armée, avancées de temps, commande hors armées. */
const journal = (): CommandEnvelope[] => [
  env(SOLO_SEAT, 0, { type: "ArmyMove", army: "army_850_est", to: "prov_mitras" }),
  env(SOLO_SEAT, 0, { type: "AdvanceDays", n: 5 }),
  env(SOLO_SEAT, 5, { type: "ArmyForcedMarch", army: "army_850_est", on: true }),
  env(SOLO_SEAT, 5, { type: "SetFlag", key: "essai_c3", value: true }),
  env(SOLO_SEAT, 5, { type: "AdvanceDays", n: 10 }),
  env(SOLO_SEAT, 15, { type: "ArmyHalt", army: "army_850_est" }),
];

describe("Rejeu du journal d'enveloppes (C3)", () => {
  it("3 exécutions du même journal et de la même graine : même empreinte", () => {
    const prints = [0, 1, 2].map(() => fingerprint(replayEnvelopes(createInitialState(11, w850), journal(), w850)));
    expect(new Set(prints).size).toBe(1);
    expect(prints[0]).toMatch(/^[0-9a-f]{8}$/);
  });

  it("le journal vivant et le rejeu donnent le même état ; graine différente, empreinte différente", () => {
    const j = new EnvelopeJournal();
    let s: GameState = createInitialState(11, w850);
    for (const e of journal()) s = submit(s, j, e, undefined, w850);
    expect(j.length).toBe(journal().length);
    expect(fingerprint(replayEnvelopes(createInitialState(11, w850), JSON.parse(j.toJSON()) as CommandEnvelope[], w850))).toBe(fingerprint(s));
    expect(fingerprint(replayEnvelopes(createInitialState(12, w850), journal(), w850))).not.toBe(fingerprint(s));
  });

  it("JSON.parse(JSON.stringify(cmd)) est idempotent et reste valide", () => {
    for (const e of journal()) {
      const once = JSON.parse(JSON.stringify(e)) as CommandEnvelope;
      expect(once).toEqual(e);
      expect(JSON.parse(JSON.stringify(once))).toEqual(once);
      expect(checkEnvelope(once).ok).toBe(true);
    }
  });

  it("une enveloppe refusée n'entre pas au journal", () => {
    const j = new EnvelopeJournal();
    const s = createInitialState(11, w850);
    expect(() => submit(s, j, env("seat_2", 0, { type: "ArmyHalt", army: "army_850_est" }), undefined, w850)).toThrow(/unknown_seat/);
    expect(j.length).toBe(0);
  });
});

describe("Droit de commander : un siège ne commande que ses entités", () => {
  const two = (): GameState => ({ ...createInitialState(11, w850), seats: { seats: { seat_1: { faction: "fac_paradis" }, seat_2: { faction: "fac_marley" } } } });

  it("le propriétaire est accepté ; un second siège est rejeté et l'état reste intact", () => {
    const s = two();
    const before = fingerprint(s);
    const order = { type: "ArmyMove", army: "army_850_est", to: "prov_mitras" };
    expect(() => applyEnveloped(s, env("seat_2", 0, order), undefined, w850)).toThrow(/not_owner/);
    expect(fingerprint(s)).toBe(before);
    const ok = applyEnveloped(s, env("seat_1", 0, order), undefined, w850);
    expect(ok.armies?.armies.find((a) => a.id === "army_850_est")?.route.length).toBeGreaterThan(0);
  });

  it("le champ owner explicite prime sur la faction", () => {
    const s = two();
    const armies = s.armies;
    if (!armies) throw new Error("pas d'armées");
    const a = armies.armies.find((x) => x.id === "army_850_est");
    if (!a) throw new Error("armée absente");
    a.owner = "seat_2";
    expect(() => applyEnveloped(s, env("seat_1", 0, { type: "ArmyHalt", army: "army_850_est" }), undefined, w850)).toThrow(/not_owner/);
  });

  it("enveloppes mal formées : siège invalide, champ en trop, commande inconnue", () => {
    expect(checkEnvelope({ seat: "joueur", day: 0, command: { type: "Noop" } }).ok).toBe(false);
    expect(checkEnvelope({ seat: "seat_1", day: -1, command: { type: "Noop" } }).ok).toBe(false);
    expect(checkEnvelope({ seat: "seat_1", day: 0, command: { type: "ArmyHalt", army: "a", extra: 1 } }).ok).toBe(false);
    expect(checkEnvelope({ seat: "seat_1", day: 0, command: { type: "Explode" } }).ok).toBe(false);
    expect(checkEnvelope({ seat: "seat_10", day: 0, command: { type: "Noop" } }).ok).toBe(false);
  });
});

describe("Ordres de bataille par siège", () => {
  it("l'escouade d'un autre siège est refusée, la sienne acceptée", () => {
    const bt = createBattle(w850, skirmishSetup(w850, "tmap_plaine", [{ type: "ttype_moyen_errant", count: 1 }], 12, 3));
    const squad = bt.state.squads[0];
    if (!squad) throw new Error("pas d'escouade");
    const o = { tick: 0, squad: squad.id, order: "tenir" as const };
    expect(applyBattleOrderAs(bt, "seat_2", o, { seats: { seat_1: { faction: "fac_paradis" }, seat_2: { faction: "fac_marley" } } })?.code).toBe("seat.err.not_owner");
    expect(applyBattleOrderAs(bt, SOLO_SEAT, o)).toBeNull();
    squad.owner = "seat_2";
    expect(applyBattleOrderAs(bt, SOLO_SEAT, o)?.code).toBe("seat.err.not_owner");
    expect(applyBattleOrderAs(bt, "seat_2", o, { seats: { seat_1: { faction: "fac_paradis" }, seat_2: { faction: "fac_marley" } } })).toBeNull();
    expect(applyBattleOrderAs(bt, SOLO_SEAT, { tick: 0, squad: "inconnue", order: "tenir" })?.code).toBe("battle.err.unknown_squad");
  });
});
