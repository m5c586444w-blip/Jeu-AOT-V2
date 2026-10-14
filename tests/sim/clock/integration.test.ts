import { describe, expect, it } from "vitest";
import { loadWorld } from "../../../src/data/worldNode";
import { stateHash } from "../../../src/sim/core/canonical";
import { applyCommand, replay, validateCommand } from "../../../src/sim/core/commands";
import type { Command } from "../../../src/sim/core/commands";
import { deserialize, serialize } from "../../../src/sim/core/serialize";
import { createInitialState } from "../../../src/sim/core/state";
import type { GameState } from "../../../src/sim/core/state";
import { checkEnvelope } from "../../../src/sim/commands/apply";
import { addEvidence, initClock, tickClock } from "../../../src/sim/clock";
import type { ClockState } from "../../../src/sim/clock";
import { cb } from "./helpers";

const world = loadWorld("data", "scn_sandbox_850");
const REF_120J_850 = "e0a0b63c";
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, world), s);
const clockOf = (s: GameState): ClockState => {
  if (!s.pillars?.clock) throw new Error("horloge absente");
  return s.pillars.clock;
};
const script: Command[] = [{ type: "AdvanceDays", n: 60 }];

/** Horloge activée, puis un soupçon ouvert sur un porteur (le monde ne produit pas encore de preuve). */
function seeded(): GameState {
  const s = run(createInitialState(7, world), { type: "EnableClock" });
  const c = clockOf(s);
  const target = Object.keys(c.bearers).sort()[0] as string;
  const observer = Object.values(c.bearers).find((b) => b.id !== target)?.faction ?? "marley";
  const withEv = addEvidence(c, target, observer === c.bearers[target]?.faction ? "autre" : observer, "anomalie", 0, cb);
  return { ...s, pillars: { ...s.pillars, clock: withEv } };
}

describe("C9 étape 3 : pilier P5 L'Horloge branché au tick (désactivé par défaut)", () => {
  it("désactivé par défaut : aucun champ pillars, empreinte de 120 jours figée", () => {
    const s = run(createInitialState(42, world), { type: "AdvanceDays", n: 120 });
    expect(s.pillars).toBeUndefined();
    expect(stateHash(s)).toBe(REF_120J_850);
  });

  it("EnableClock enregistre les porteurs nommés ; l'activer deux fois ne le réinitialise pas", () => {
    const s = run(createInitialState(7, world), { type: "EnableClock" });
    const bearers = Object.values(clockOf(s).bearers);
    expect(bearers.length).toBeGreaterThan(0);
    for (const b of bearers) expect(b.exposedTo).toContain(b.faction);
    const t = seeded();
    expect(clockOf(run(t, { type: "EnableClock" }))).toEqual(clockOf(t));
  });

  it("60 jours : la suspicion décroît au calme, déterministe, l'état avance", () => {
    const a = run(seeded(), ...script);
    const b = run(seeded(), ...script);
    const before = Object.values(clockOf(seeded()).suspects).flatMap((r) => Object.values(r));
    const after = Object.values(clockOf(a).suspects).flatMap((r) => Object.values(r));
    expect(before.length).toBeGreaterThan(0);
    expect(after.reduce((x, r) => x + r.shown, 0)).toBeLessThan(before.reduce((x, r) => x + r.shown, 0));
    expect(stateHash(a)).toBe(stateHash(b));
    expect(stateHash(a)).not.toBe(stateHash(run(createInitialState(7, world), ...script)));
  });

  it("rejeu du journal et aller-retour de sauvegarde : même empreinte", () => {
    const start = seeded();
    const direct = run(start, ...script);
    expect(stateHash(replay(start, script, world))).toBe(stateHash(direct));
    expect(stateHash(deserialize(serialize(direct)))).toBe(stateHash(direct));
  });

  it("un porteur qui ne tient plus de Titan est retiré avec ses soupçons (accord avec shifters)", () => {
    const s = seeded();
    const c = clockOf(s);
    const id = Object.keys(c.bearers)[0] as string;
    const sh = structuredClone(s.shifters);
    if (!sh) throw new Error("shifters absent");
    for (const t of Object.values(sh.titans)) if (t.holder === id) { t.holder = null; t.faction = "perdu"; }
    const out = tickClock(c, cb, sh, 1);
    expect(out.bearers[id]).toBeUndefined();
    expect(out.suspects[id]).toBeUndefined();
    expect(Object.keys(out.bearers).length).toBe(Object.keys(c.bearers).length - 1);
  });

  it("initClock sans état des Titans : horloge vide", () => {
    expect(Object.keys(initClock(null, cb).bearers)).toHaveLength(0);
  });
});

describe("C9 étape 3 : durcissement", () => {
  it("sauvegarde avec pillars/clock mal formé : rejetée", () => {
    const base = seeded();
    expect(deserialize(serialize(base)).pillars?.clock).toBeDefined();
    const mutate = (f: (r: Record<string, unknown>) => void): string => {
      const o = JSON.parse(serialize(base)) as { pillars: { clock: Record<string, unknown> } };
      f(o.pillars.clock);
      return JSON.stringify(o);
    };
    expect(() => deserialize(mutate((r) => delete r["suspects"]))).toThrow(/pillars\.clock/);
    expect(() => deserialize(mutate((r) => (r["bearers"] = [])))).toThrow(/pillars\.clock/);
    expect(() => deserialize(mutate((r) => { const k = Object.keys(r["bearers"] as object)[0] as string; ((r["bearers"] as Record<string, Record<string, unknown>>)[k] as Record<string, unknown>)["cover"] = "x"; }))).toThrow(/pillars\.clock/);
  });

  it("EnableClock sans données de l'Horloge : refus typé, pas d'exception brute", () => {
    const s = createInitialState(7, world);
    const noClock = { ...world, clock: undefined };
    expect(validateCommand({ type: "EnableClock" }, { state: s, world: noClock }).ok).toBe(false);
    expect(validateCommand({ type: "EnableClock" }, { state: s, world }).ok).toBe(true);
    expect(validateCommand({ type: "EnableClock" }).ok).toBe(true);
    expect(() => applyCommand(s, { type: "EnableClock" }, undefined, noClock)).toThrow(/Commande rejetée/);
    expect(() => applyCommand(s, { type: "EnableClock" })).toThrow(/Commande rejetée/);
  });

  it("schéma strict et classement faction", () => {
    const env = (command: Record<string, unknown>) => checkEnvelope({ seat: "seat_1", day: 0, command });
    expect(env({ type: "EnableClock" }).ok).toBe(true);
    expect(env({ type: "EnableClock", extra: 1 }).ok).toBe(false);
  });
});
