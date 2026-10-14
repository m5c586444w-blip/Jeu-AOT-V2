import { describe, expect, it } from "vitest";
import { loadWorld } from "../../../src/data/worldNode";
import { stateHash } from "../../../src/sim/core/canonical";
import { applyCommand, replay, validateCommand } from "../../../src/sim/core/commands";
import type { Command } from "../../../src/sim/core/commands";
import { deserialize, serialize } from "../../../src/sim/core/serialize";
import { createInitialState } from "../../../src/sim/core/state";
import type { GameState } from "../../../src/sim/core/state";
import { checkEnvelope } from "../../../src/sim/commands/apply";
import { destroyAnchors, initGas, ledgerOf, validAnchorsNear, withLedger } from "../../../src/sim/gas";
import type { GasState } from "../../../src/sim/gas";
import { gb, mapOf } from "./helpers";

const world = loadWorld("data", "scn_sandbox_850");
const REF_120J_850 = "e0a0b63c";
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, world), s);
const gasOf = (s: GameState): GasState => {
  if (!s.pillars?.gas) throw new Error("gaz absent");
  return s.pillars.gas;
};
const script: Command[] = [{ type: "AdvanceDays", n: 60 }];

/** Gaz activé, puis une démolition détruit des ancrages de la forêt (la bataille n'écrit pas encore dans l'état). */
function seeded(): GameState {
  const s = run(createInitialState(7, world), { type: "EnableGas" });
  const m = mapOf("tmap_foret");
  const a = m.anchors[0];
  if (!a) throw new Error("aucun ancrage");
  const l = destroyAnchors(m, ledgerOf(gasOf(s), "tmap_foret"), gb, "demolition", { x: a.x, y: a.y, z: a.z });
  return { ...s, pillars: { ...s.pillars, gas: withLedger(gasOf(s), "tmap_foret", l) } };
}

describe("C9 étape 5 : pilier P3 Le Gaz et l'Ancrage branché (désactivé par défaut, sans pas de tick)", () => {
  it("désactivé par défaut : aucun champ pillars, empreinte de 120 jours figée", () => {
    const s = run(createInitialState(42, world), { type: "AdvanceDays", n: 120 });
    expect(s.pillars).toBeUndefined();
    expect(stateHash(s)).toBe(REF_120J_850);
  });

  it("EnableGas crée des registres vides ; l'activer deux fois ne les réinitialise pas", () => {
    const s = run(createInitialState(7, world), { type: "EnableGas" });
    expect(gasOf(s)).toEqual(initGas());
    const t = seeded();
    expect(Object.keys(ledgerOf(gasOf(t), "tmap_foret").damage).length).toBeGreaterThan(0);
    expect(gasOf(run(t, { type: "EnableGas" }))).toEqual(gasOf(t));
  });

  it("le registre d'une carte survit au temps (60 jours) sans changer ; la carte reste immuable", () => {
    const a = run(seeded(), ...script);
    expect(gasOf(a)).toEqual(gasOf(seeded()));
    // Moins d'ancrages valides près du foyer après l'incendie, et la carte d'origine est intacte.
    const m = mapOf("tmap_foret");
    const at = m.anchors[0];
    if (!at) throw new Error();
    const p = { x: at.x, y: at.y, z: at.z };
    const fresh = validAnchorsNear(m, ledgerOf(initGas(), "tmap_foret"), gb, p, 12).length;
    const burnt = validAnchorsNear(m, ledgerOf(gasOf(a), "tmap_foret"), gb, p, 12).length;
    expect(burnt).toBeLessThan(fresh);
    expect(stateHash(a)).toBe(stateHash(run(seeded(), ...script)));
  });

  it("rejeu du journal et aller-retour de sauvegarde : même empreinte", () => {
    const start = seeded();
    const direct = run(start, ...script);
    expect(stateHash(replay(start, script, world))).toBe(stateHash(direct));
    expect(stateHash(deserialize(serialize(direct)))).toBe(stateHash(direct));
  });

  it("withLedger ne modifie pas l'état d'origine", () => {
    const s = initGas();
    withLedger(s, "x", { damage: { a: 1 } });
    expect(s).toEqual({ ledgers: {} });
  });
});

describe("C9 étape 5 : durcissement", () => {
  it("sauvegarde avec pillars/gas mal formé : rejetée", () => {
    const base = seeded();
    expect(deserialize(serialize(base)).pillars?.gas).toBeDefined();
    const mutate = (f: (r: Record<string, unknown>) => void): string => {
      const o = JSON.parse(serialize(base)) as { pillars: { gas: Record<string, unknown> } };
      f(o.pillars.gas);
      return JSON.stringify(o);
    };
    expect(() => deserialize(mutate((r) => delete r["ledgers"]))).toThrow(/pillars\.gas/);
    expect(() => deserialize(mutate((r) => (r["ledgers"] = [])))).toThrow(/pillars\.gas/);
    expect(() => deserialize(mutate((r) => { ((r["ledgers"] as Record<string, { damage: Record<string, number> }>)["tmap_foret"] as { damage: Record<string, number> }).damage["x"] = 2; }))).toThrow(/pillars\.gas/);
  });

  it("EnableGas sans données du Gaz : refus typé, pas d'exception brute", () => {
    const s = createInitialState(7, world);
    const noGas = { ...world, gas: undefined };
    expect(validateCommand({ type: "EnableGas" }, { state: s, world: noGas }).ok).toBe(false);
    expect(validateCommand({ type: "EnableGas" }, { state: s, world }).ok).toBe(true);
    expect(validateCommand({ type: "EnableGas" }).ok).toBe(true);
    expect(() => applyCommand(s, { type: "EnableGas" }, undefined, noGas)).toThrow(/Commande rejetée/);
    expect(() => applyCommand(s, { type: "EnableGas" })).toThrow(/Commande rejetée/);
  });

  it("schéma strict et classement faction", () => {
    const env = (command: Record<string, unknown>) => checkEnvelope({ seat: "seat_1", day: 0, command });
    expect(env({ type: "EnableGas" }).ok).toBe(true);
    expect(env({ type: "EnableGas", extra: 1 }).ok).toBe(false);
  });
});
