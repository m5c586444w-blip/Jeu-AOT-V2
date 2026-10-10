import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { stateHash } from "../../src/sim/core/canonical";
import { applyCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { sideOf } from "../../src/sim/missions/missions";

const req = <T>(v: T | null | undefined): T => {
  if (v === null || v === undefined) throw new Error("valeur absente");
  return v;
};
const w854 = loadWorld("data", "scn_854");
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, w854), s);
const days = (s: GameState, n: number): GameState => {
  let x = s;
  for (let i = 0; i < n; i += 30) x = run(x, { type: "AdvanceDays", n: Math.min(30, n - i) });
  return x;
};
const byId = new Map(req(w854.missions).order.map((m) => [m.id, m]));

describe("IA de Marley : missions cohérentes (MIS.6, CMIS-08)", () => {
  const s = days(createInitialState(11, w854), 720);
  const ms = req(s.missions);

  it("Marley (IA) lance et accomplit des missions, chaque choix a ses raisons consignées", () => {
    const side = sideOf(ms, "marley");
    expect(side.done.length).toBeGreaterThanOrEqual(3);
    expect(ms.ai.length).toBeGreaterThanOrEqual(side.done.length);
    expect(ms.ai.every((d) => d.nation === "marley" && d.reasons.length >= 2 && d.reasons.some((r) => r.key === "mission.ai.base"))).toBe(true);
    // Paradis (jouée) n'est jamais conduite par l'IA des missions.
    expect(sideOf(ms, "paradis").current).toEqual([]);
    expect(sideOf(ms, "paradis").done).toEqual([]);
  });

  it("en guerre, la première mission est militaire ; chaque mission respecte ses prérequis, son coût et le nombre de places", () => {
    const first = byId.get(req(ms.ai[0]).mission);
    expect(first?.branch).toBe("militaire");
    const started = new Map<string, number>();
    ms.log.filter((l) => l.key === "mission.log.started").forEach((l) => started.set(String(l.params["mission"]).replace("mission.", ""), l.day));
    for (const [id, day] of started) {
      const m = req(byId.get(id));
      for (const p of m.prereqs) expect(req(sideOf(ms, "marley").doneDay[p] ?? null), `${id} exige ${p}`).toBeLessThanOrEqual(day);
    }
    expect(sideOf(ms, "marley").current.length).toBeLessThanOrEqual(req(w854.missions).balance.slots.marley);
    expect(req(s.nations).nations["fac_marley"]?.industry).toBeGreaterThanOrEqual(0);
    expect(req(s.nations).nations["fac_marley"]?.manpower).toBeGreaterThanOrEqual(0);
  });

  it("la suite est cohérente : la campagne contre Paradis n'est lancée qu'après le corps expéditionnaire et la flotte ; déterministe", () => {
    const done = sideOf(ms, "marley").done;
    const k = done.indexOf("mis_marley_campagne_de_paradis");
    if (k >= 0) {
      expect(done.indexOf("mis_marley_corps_expeditionnaire")).toBeLessThan(k);
      expect(done.indexOf("mis_marley_flotte_transport")).toBeLessThan(k);
    }
    expect(stateHash(days(createInitialState(11, w854), 720))).toBe(stateHash(s));
    // 720 jours de 854 rejoués : délai explicite (le défaut de 30 s est frôlé quand la machine est chargée).
  }, 120_000);

  it("quand Marley est jouée, l'IA ne lance rien pour elle : ses missions viennent des commandes du joueur", () => {
    let m = run(createInitialState(11, w854), { type: "SetPlayerFaction", faction: "fac_marley" });
    m = days(m, 120);
    expect(sideOf(m.missions, "marley").current).toEqual([]);
    m = run(m, { type: "StartMission", mission: "mis_marley_mobilisation_industrielle" });
    expect(sideOf(m.missions, "marley").current).toHaveLength(1);
    expect(() => run(m, { type: "StartMission", mission: "mis_mil_inventaire_garnisons" })).toThrow("mission.lock.nation");
    const industryBefore = req(m.nations).nations["fac_marley"]?.industry ?? 0;
    m = days(m, 90);
    expect(sideOf(m.missions, "marley").done).toContain("mis_marley_mobilisation_industrielle");
    expect(req(m.nations).nations["fac_marley"]?.industry).toBeGreaterThan(industryBefore);
    expect(req(m.strategic).log.some((l) => l.key === "alert.mission_done" && l.pause)).toBe(true);
  });
});
