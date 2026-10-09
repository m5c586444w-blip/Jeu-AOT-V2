import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { stateHash } from "../../src/sim/core/canonical";
import { applyCommand, validateCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { canPlay, encounterSetup, encounterSetupRt } from "../../src/sim/armies/armies";
import type { ArmiesState, Encounter } from "../../src/sim/armies/state";
import { unitCount } from "../../src/sim/tactical/setup";
import type { TimedOrder } from "../../src/sim/tactical/types";

/** R2+ (CR2-05, dette n° 33) : une rencontre d'armées (sans Titans) se joue dans la bataille de compagnies, puis l'issue revient à la campagne. */
const req = <T>(v: T | null | undefined): T => {
  if (v === null || v === undefined) throw new Error("valeur absente");
  return v;
};
const w854 = loadWorld("data", "scn_854");
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, w854), s);
const ar = (s: GameState): ArmiesState => req(s.armies);

/** 854, guerre déclarée : le corps de Marley au contact de l'armée du Sud de Paradis à Trost (rencontre en attente). */
function contact(seed = 3, titans = 0): GameState {
  const s = run(createInitialState(seed, w854), { type: "DeclareWar", to: "fac_marley" });
  const a = ar(s);
  const m = req(a.armies.find((x) => x.id === "army_854_marley"));
  const p = req(a.armies.find((x) => x.id === "army_854_sud"));
  m.province = p.province;
  for (const f of a.fleets) f.embarked = f.embarked.filter((x) => x !== m.id);
  const enc: Encounter = { id: "enc_r2", day: 0, province: req(p.province), kind: titans > 0 ? "titans" : "armees", sides: [{ faction: "fac_paradis", armies: [p.id] }, ...(titans > 0 ? [] : [{ faction: "fac_marley", armies: [m.id] }])], titans, defender: "fac_paradis", status: "attente", result: null };
  a.encounters.push(enc);
  m.engaged = enc.id;
  p.engaged = enc.id;
  return s;
}
const ctx = (s: GameState) => ({ world: w854, aw: req(w854.armies), s: ar(s), seed: s.seed, st: req(s.strategic), ns: s.nations ?? null });
const orders: TimedOrder[] = [
  { tick: 2, squad: "sec_a01", order: "deplacer", x: 200, y: 230, formation: "ligne" },
  { tick: 2, squad: "sec_a01", order: "tuer", queue: true },
  { tick: 40, squad: "sec_a02", order: "suivre", follow: "sec_a01" },
];

describe("Rencontre d'armées jouée en bataille de compagnies (CR2-05)", () => {
  it("armée contre armée sans Titans : jouable ; 100 à 400 unités ; fantassins des deux camps en scène", () => {
    const s = contact();
    const enc = req(ar(s).encounters.find((e) => e.id === "enc_r2"));
    expect(canPlay(ctx(s), enc, true)).toBe(true);
    const setup = req(encounterSetupRt(ctx(s), enc.id));
    const n = unitCount(setup);
    expect(n).toBeGreaterThanOrEqual(100);
    expect(n).toBeLessThanOrEqual(400);
    expect(setup.titans).toEqual([]);
    expect(setup.troops?.some((t) => t.side === "allie" && t.kind === "fusilier")).toBe(true);
    expect(setup.troops?.some((t) => t.side === "ennemi" && t.faction === "fac_marley")).toBe(true);
    expect(setup.troops?.some((t) => t.side === "ennemi" && t.kind === "mitrailleur")).toBe(true);
    expect(setup.artillery?.some((b) => b.side === "ennemi")).toBe(true);
    // Le chemin d'avant R2 (sans `rt`) n'a pas de fantassins.
    expect(encounterSetup(ctx(s), enc.id)?.troops).toBeUndefined();
  });

  it("jouée puis reportée : pertes des deux camps, bilan, journal ; même graine et mêmes ordres = même état", () => {
    const s = contact();
    const cmd: Command = { type: "ResolveEncounter", encounter: "enc_r2", mode: "jouer", orders, rt: true };
    expect(validateCommand(cmd).ok).toBe(true);
    const a = run(s, cmd);
    const done = req(ar(a).encounters.find((e) => e.id === "enc_r2"));
    expect(done.status).toBe("resolue");
    expect(done.result?.mode).toBe("jouer");
    expect(done.result?.losses["fac_paradis"] ?? 0).toBeGreaterThan(0);
    expect(done.result?.losses["fac_marley"] ?? 0).toBeGreaterThan(0);
    expect(ar(a).log.some((l) => l.key === "army.log.battle_played")).toBe(true);
    expect(ar(a).armies.filter((x) => x.engaged === "enc_r2")).toEqual([]);
    const b = run(contact(), cmd);
    expect(stateHash(b)).toBe(stateHash(a));
    // D'autres ordres donnent une autre bataille (et le plus souvent un autre état).
    const c = run(contact(), { ...cmd, orders: [{ tick: 1, squad: "sec_a01", order: "repli" }, { tick: 1, squad: "sec_a02", order: "repli" }, { tick: 1, squad: "sec_a03", order: "repli" }] });
    expect(stateHash(c)).not.toBe(stateHash(a));
  });

  it("rencontre de Titans en bataille de compagnies : 6 Titans au plus, fantassins de Paradis", () => {
    const s = contact(4, 9);
    const enc = req(ar(s).encounters.find((e) => e.id === "enc_r2"));
    expect(canPlay(ctx(s), enc, true)).toBe(true);
    const setup = req(encounterSetupRt(ctx(s), enc.id));
    expect(setup.titans.reduce((n, t) => n + t.count, 0)).toBe(6);
    expect(unitCount(setup)).toBeGreaterThanOrEqual(100);
    const a = run(s, { type: "ResolveEncounter", encounter: "enc_r2", mode: "jouer", orders: [], rt: true });
    expect(ar(a).encounters.find((e) => e.id === "enc_r2")?.status).toBe("resolue");
  });

  it("forme des commandes : ordres temps réel reçus, `rt` booléen, ordres mal formés refusés", () => {
    expect(validateCommand({ type: "ResolveEncounter", encounter: "enc_1", mode: "jouer", orders, rt: true }).ok).toBe(true);
    expect(validateCommand({ type: "ResolveEncounter", encounter: "enc_1", mode: "jouer", orders: [], rt: "oui" }).ok).toBe(false);
    expect(validateCommand({ type: "ResolveEncounter", encounter: "enc_1", mode: "jouer", orders: [{ tick: 1, squad: "a", order: "voler" }] }).ok).toBe(false);
    expect(validateCommand({ type: "ResolveBattle", expedition: "exp_1", mode: "jouer", orders: [{ tick: 3, squad: "esc_01", order: "deplacer", x: 1, y: 2 }] }).ok).toBe(true);
  });
});
