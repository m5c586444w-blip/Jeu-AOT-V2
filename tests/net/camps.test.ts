import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { applyEnveloped } from "../../src/sim/commands/apply";
import { applyCommand } from "../../src/sim/core/commands";
import { stateHash } from "../../src/sim/core/canonical";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { withTable } from "../../src/sim/core/table";
import { isHumanFaction } from "../../src/sim/world/nations";
import { Client, Host, hashOf, LoopbackNetwork } from "../../src/net";

const world = loadWorld("data", "scn_854");
const env = (seat: string, command: Record<string, unknown>) => ({ seat, day: 0, command });
const base = (): GameState => createInitialState(5, world);
const table = (): GameState => withTable(base(), { seat_1: "fac_paradis", seat_2: "fac_paradis", seat_3: "fac_marley", seat_4: "fac_marley" });
const adv = (s: GameState, n: number): GameState => applyCommand(s, { type: "AdvanceDays", n }, undefined, world);

describe("C13 : camps rivaux (27 §4.2, D-179)", () => {
  it("withTable : les factions autres que la faction jouée deviennent des camps humains ; solo inchangé", () => {
    const s = table();
    expect(s.nations?.player).toBe("fac_paradis");
    expect(s.nations?.humans).toEqual(["fac_marley"]);
    expect(isHumanFaction(s.nations, "fac_marley")).toBe(true);
    expect(isHumanFaction(s.nations, "fac_hizuru")).toBe(false);
    const solo = withTable(base(), { seat_1: "fac_paradis" });
    expect(solo.nations?.humans).toBeUndefined();
    expect(stateHash(adv(base(), 20))).toBe(stateHash(adv(base(), 20)));
  });

  it("un siège de Marley agit pour Marley : déclaration de guerre exécutée avec Marley pour acteur, faction jouée rétablie", () => {
    const s = table();
    const out = applyEnveloped(s, env("seat_3", { type: "DeclareWar", to: "fac_paradis" }), undefined, world);
    expect(out.nations?.wars).toContain("fac_marley|fac_paradis");
    expect(out.nations?.player).toBe("fac_paradis");
    expect(out.nations?.humans).toEqual(["fac_marley"]);
  });

  it("un siège de Marley ne peut pas donner les ordres politiques de la faction jouée", () => {
    const s = table();
    expect(() => applyEnveloped(s, env("seat_3", { type: "SetRationing", level: "strict" }), undefined, world)).toThrow(/seat\.err\.not_faction/);
  });

  it("chaque camp ne commande que ses flottes et armées", () => {
    const s = table();
    const move = { type: "FleetMove", fleet: "flt_854_marley", to: "sea_sud_est" };
    expect(() => applyEnveloped(s, env("seat_1", move), undefined, world)).toThrow(/seat\.err\.not_owner/);
    const out = applyEnveloped(s, env("seat_3", move), undefined, world);
    expect(out.armies?.fleets.find((f) => f.id === "flt_854_marley")?.route.length).toBeGreaterThan(0);
  });

  it("l'IA ne pilote plus un camp tenu par un humain : sans siège, la flotte de Marley est menée par l'IA ; avec un siège, elle reste où le joueur Marley l'a laissée", () => {
    const war = (s: GameState): GameState => applyEnveloped(s, env("seat_1", { type: "DeclareWar", to: "fac_marley" }), undefined, world);
    const withAi = adv(war(withTable(base(), { seat_1: "fac_paradis" })), 30);
    const human = adv(war(table()), 30);
    const fleet = (s: GameState) => s.armies?.fleets.find((f) => f.id === "flt_854_marley");
    const start = fleet(base());
    expect(JSON.stringify(fleet(withAi))).not.toBe(JSON.stringify(start));
    expect(JSON.stringify(fleet(human))).toBe(JSON.stringify(start));
  }, 120_000);
});

describe("C13 : camps rivaux en réseau", () => {
  it("2 sièges Paradis et 2 sièges Marley en lockstep : chacun ne commande que son camp, 0 désynchronisation, empreintes identiques", () => {
    const net = new LoopbackNetwork(21, 0, 3);
    const host = new Host({ world, initial: table(), password: "amis", hashEvery: 2 });
    const clients = new Map<string, Client>();
    for (const seat of ["seat_1", "seat_2", "seat_3", "seat_4"]) {
      const { client, host: h } = net.connect();
      host.accept(h);
      const c = new Client(client, world, seat, "amis", 2);
      clients.set(seat, c);
      c.connect();
    }
    net.drain();
    const send = (seat: string, cmd: { type: string } & Record<string, unknown>): void => void clients.get(seat)?.submit(cmd);
    for (let t = 0; t < 14; t++) {
      if (t === 0) send("seat_1", { type: "DeclareWar", to: "fac_marley" });
      if (t === 1) send("seat_3", { type: "FleetMove", fleet: "flt_854_marley", to: "sea_sud_est" });
      if (t === 2) send("seat_1", { type: "FleetMove", fleet: "flt_854_marley", to: "sea_sud_est" }); // usurpation : refusée
      if (t === 3) send("seat_4", { type: "SetRationing", level: "strict" }); // politique de Paradis : refusée
      if (t === 4) send("seat_2", { type: "SetRationing", level: "reduit" });
      net.drain();
      host.step(1);
      net.drain();
    }
    const ref = hashOf(host.state);
    for (const [seat, c] of clients) {
      expect(c.tick, seat).toBe(host.tick);
      expect(hashOf(c.state as GameState), seat).toBe(ref);
    }
    expect(host.desyncs).toEqual([]);
    expect(clients.get("seat_1")?.rejected.map((r) => r.code)).toEqual(["seat.err.not_owner"]);
    expect(clients.get("seat_4")?.rejected.map((r) => r.code)).toEqual(["seat.err.not_faction"]);
    expect(host.state.nations?.wars).toContain("fac_marley|fac_paradis");
    expect(host.state.nations?.player).toBe("fac_paradis");
  }, 120_000);
});
