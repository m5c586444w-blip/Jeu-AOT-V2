import { describe, expect, it } from "vitest";
import { loadWorld } from "../../../src/data/worldNode";
import { stateHash } from "../../../src/sim/core/canonical";
import { applyCommand, replay, validateCommand } from "../../../src/sim/core/commands";
import type { Command } from "../../../src/sim/core/commands";
import { deserialize, serialize } from "../../../src/sim/core/serialize";
import { createInitialState } from "../../../src/sim/core/state";
import type { GameState } from "../../../src/sim/core/state";
import { checkEnvelope } from "../../../src/sim/commands/apply";
import { createRegion, initTide, tickTide, tideDensity, tideFactor } from "../../../src/sim/tide";
import type { TideArmy, TideDay, TideState } from "../../../src/sim/tide";
import { tb } from "./helpers";

const REF_120J_850 = "e0a0b63c";
const w850 = loadWorld("data", "scn_sandbox_850");
const w854 = loadWorld("data", "scn_854");
const PROV = "prov_maria_sud_est";
const NODE = { x: 343.7, y: 343.7 };
const DENS = 0.3;

const army = (o: Partial<TideArmy> = {}): TideArmy => ({ id: "a1", province: PROV, faction: "fac_paradis", xKm: NODE.x, yKm: NODE.y, byKind: { infanterie: 400, artillerie: 60 }, moving: false, ...o });
const day = (armies: TideArmy[], o: Partial<TideDay> = {}): TideDay => ({ armies, baseDensity: () => DENS, clashes: new Set<string>(), season: "ete", ...o });
/** Facteur d'attraction brut au nœud (1 = équilibre). */
const centre = (s: TideState): number | null => tideFactor(s, PROV, NODE.x, NODE.y, DENS, tb);
const run = (s: TideState, n: number, d: TideDay): TideState => {
  let x = s;
  for (let i = 0; i < n; i++) x = tickTide(x, d, tb);
  return x;
};

describe("P2 Marée régionale (D-177) : module pur", () => {
  it("une région neuve est à l'équilibre : la densité effective redonne la densité statique", () => {
    const s: TideState = { regions: { [PROV]: createRegion(NODE.x, NODE.y, DENS, tb) } };
    expect(centre(s)).toBeCloseTo(1, 9);
    expect(tideDensity(s, PROV, NODE.x, NODE.y, DENS, tb)).toBeCloseTo(DENS, 9);
    expect(tideDensity(s, "prov_autre", NODE.x, NODE.y, DENS, tb)).toBeNull();
    expect(tideDensity(s, PROV, NODE.x + 9999, NODE.y, DENS, tb)).toBeNull();
    expect(tideFactor(s, PROV, NODE.x, NODE.y, 0, tb)).toBeNull();
  });

  it("sans humains, une région déjà créée reste à l'équilibre", () => {
    const s: TideState = { regions: { [PROV]: createRegion(NODE.x, NODE.y, DENS, tb) } };
    const t = run(s, tb.region.idle_days - 1, day([]));
    expect(centre(t)).toBeCloseTo(1, 6);
  });

  it("une armée attire les Titans : la densité ressentie dépasse la densité statique, davantage avec une rencontre", () => {
    const calm = run(initTide(), 6, day([army()]));
    const clash = run(initTide(), 6, day([army()], { clashes: new Set([PROV]) }));
    expect(Object.keys(calm.regions)).toEqual([PROV]);
    expect(centre(calm) ?? 0).toBeGreaterThan(1);
    expect(centre(clash) ?? 0).toBeGreaterThan(centre(calm) ?? 0);
    // La densité effective reste bornée : jamais au-dessus de min(1, base × amplify_max).
    const eff = tideDensity(clash, PROV, NODE.x, NODE.y, DENS, tb) ?? 9;
    expect(eff).toBeLessThanOrEqual(Math.min(1, DENS * tb.region.amplify_max) + 1e-12);
    expect(eff).toBeGreaterThan(DENS);
  });

  it("une armée en marche fait plus de bruit qu'une armée à l'arrêt", () => {
    const halt = run(initTide(), 4, day([army({ moving: false })]));
    const march = run(initTide(), 4, day([army({ moving: true })]));
    expect(centre(march) ?? 0).toBeGreaterThan(centre(halt) ?? 0);
  });

  it("la région est oubliée après idle_days jours sans armée, jamais tant qu'une armée est là", () => {
    let s = run(initTide(), 2, day([army()]));
    expect(Object.keys(s.regions)).toEqual([PROV]);
    s = run(s, tb.region.idle_days - 1, day([]));
    expect(Object.keys(s.regions)).toEqual([PROV]);
    s = tickTide(s, day([]), tb);
    expect(s.regions).toEqual({});
    expect(Object.keys(run(initTide(), 20, day([army()])).regions)).toEqual([PROV]);
  });

  it("au plus max_regions régions, dans l'ordre des identifiants ; une province sans armée n'en crée pas", () => {
    const many = Array.from({ length: tb.region.max_regions + 3 }, (_, i) => army({ id: `a${i}`, province: `p${String(i).padStart(2, "0")}` }));
    const s = tickTide(initTide(), day(many), tb);
    expect(Object.keys(s.regions)).toEqual(many.slice(0, tb.region.max_regions).map((a) => a.province));
  });

  it("l'équilibre dépend de la saison et de l'heure : l'hiver ralentit l'attraction", () => {
    const summer = run(initTide(), 5, day([army()], { season: "ete" }));
    const winter = run(initTide(), 5, day([army()], { season: "hiver" }));
    expect(centre(winter) ?? 0).toBeLessThan(centre(summer) ?? 0);
  });

  it("déterminisme et données JSON pures", () => {
    const a = run(initTide(), 5, day([army(), army({ id: "a2", byKind: { cavalerie: 50, odm: 20, mitrailleurs: 10 } })]));
    const b = run(initTide(), 5, day([army(), army({ id: "a2", byKind: { cavalerie: 50, odm: 20, mitrailleurs: 10 } })]));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it("region.march_noise a un effet (à 0, le résultat change)", () => {
    const base = run(initTide(), 3, day([army()]));
    const loud = run(initTide(), 3, day([army({ moving: true })]));
    const quiet = tickTide(initTide(), day([army({ moving: true })]), { ...tb, region: { ...tb.region, march_noise: 0 } });
    expect(JSON.stringify(quiet)).not.toBe(JSON.stringify(tickTide(initTide(), day([army({ moving: true })]), tb)));
    expect(JSON.stringify(base)).not.toBe(JSON.stringify(loud));
  });
});

// — Intégration au tick —
const hot = { ...w854, scenario: { ...w854.scenario, titan_density: { ...w854.scenario.titan_density, [PROV]: DENS } } };
function exposed(seed = 7): GameState {
  const s = createInitialState(seed, hot);
  if (!s.strategic || !s.armies) throw new Error("couche armées absente");
  const strategic = structuredClone(s.strategic);
  (strategic.provinces[PROV] as { control: string }).control = "perdu";
  const armies = structuredClone(s.armies);
  const a = armies.armies.find((x) => x.id === "army_854_sud");
  if (!a) throw new Error("armée absente");
  a.province = PROV;
  a.route = [];
  a.stance = "halte";
  return { ...s, strategic, armies };
}
const runC = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, hot), s);
const tideOf = (s: GameState): TideState => {
  if (!s.pillars?.tide) throw new Error("marée absente");
  return s.pillars.tide;
};

describe("C9.7 : pilier P2 La Marée branché (désactivé par défaut)", () => {
  it("désactivé par défaut : aucun champ pillars, empreinte de 120 jours figée", () => {
    const s = applyCommand(createInitialState(42, w850), { type: "AdvanceDays", n: 120 }, undefined, w850);
    expect(s.pillars).toBeUndefined();
    expect(stateHash(s)).toBe(REF_120J_850);
  });

  it("EnableTide crée un état vide ; idempotent", () => {
    const s = runC(exposed(), { type: "EnableTide" });
    expect(tideOf(s)).toEqual(initTide());
    expect(tideOf(runC(s, { type: "AdvanceDays", n: 2 }, { type: "EnableTide" })).regions).toHaveProperty(PROV);
  });

  it("une armée exposée fait naître une région ; une armée en terre tenue par Paradis, non", () => {
    const s = runC(exposed(), { type: "EnableTide" }, { type: "AdvanceDays", n: 3 });
    expect(Object.keys(tideOf(s).regions)).toContain(PROV);
    const calm = runC(createInitialState(7, hot), { type: "EnableTide" }, { type: "AdvanceDays", n: 3 });
    expect(tideOf(calm).regions).toEqual({});
  });

  it("la Marée change réellement le monde : la densité ressentie diffère de la densité statique après quelques jours", () => {
    const on = runC(exposed(), { type: "EnableTide" }, { type: "AdvanceDays", n: 5 });
    const off = runC(exposed(), { type: "AdvanceDays", n: 5 });
    expect(stateHash(on)).not.toBe(stateHash(off));
    const reg = tideOf(on).regions[PROV];
    expect(reg).toBeDefined();
    expect(Math.max(...(reg?.grid.density ?? [0]))).toBeGreaterThan(DENS * tb.region.per_density);
  });

  it("rejeu du journal et aller-retour de sauvegarde : même empreinte ; deux exécutions identiques", () => {
    const start = runC(exposed(), { type: "EnableTide" });
    const script: Command[] = [{ type: "AdvanceDays", n: 8 }];
    const direct = runC(start, ...script);
    expect(stateHash(replay(start, script, hot))).toBe(stateHash(direct));
    expect(stateHash(deserialize(serialize(direct)))).toBe(stateHash(direct));
    expect(stateHash(runC(exposed(), { type: "EnableTide" }, ...script))).toBe(stateHash(direct));
  });
});

describe("C9.7 : durcissement", () => {
  it("sauvegarde avec pillars/tide mal formé : rejetée", () => {
    const base = runC(exposed(), { type: "EnableTide" }, { type: "AdvanceDays", n: 2 });
    expect(deserialize(serialize(base)).pillars?.tide).toBeDefined();
    const mutate = (f: (r: { regions: Record<string, { grid: Record<string, unknown> }> }) => void): string => {
      const o = JSON.parse(serialize(base)) as { pillars: { tide: { regions: Record<string, { grid: Record<string, unknown> }> } } };
      f(o.pillars.tide);
      return JSON.stringify(o);
    };
    expect(() => deserialize(mutate((r) => ((r as unknown as Record<string, unknown>)["regions"] = [])))).toThrow(/pillars\.tide/);
    expect(() => deserialize(mutate((r) => { (r.regions[PROV] as { grid: Record<string, unknown> }).grid["density"] = [1]; }))).toThrow(/pillars\.tide/);
  });

  it("EnableTide sans données de la Marée : refus typé", () => {
    const s = createInitialState(7, hot);
    const noTide = { ...hot, tide: undefined };
    expect(validateCommand({ type: "EnableTide" }, { state: s, world: noTide }).ok).toBe(false);
    expect(validateCommand({ type: "EnableTide" }, { state: s, world: hot }).ok).toBe(true);
    expect(() => applyCommand(s, { type: "EnableTide" }, undefined, noTide)).toThrow(/Commande rejetée/);
  });

  it("schéma strict", () => {
    const env = (command: Record<string, unknown>) => checkEnvelope({ seat: "seat_1", day: 0, command });
    expect(env({ type: "EnableTide" }).ok).toBe(true);
    expect(env({ type: "EnableTide", extra: 1 }).ok).toBe(false);
  });
});
