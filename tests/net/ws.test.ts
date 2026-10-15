import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { Client, connectWs, Host, hashOf, WsServer } from "../../src/net";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";

const world = loadWorld("data", "scn_854");
const until = async (cond: () => boolean, ms = 10_000): Promise<void> => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("délai dépassé");
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe("C13 : transport WebSocket réel (boucle locale)", () => {
  it("trois clients sur de vraies sockets : accueil, commandes, tours, empreintes identiques", async () => {
    const s = createInitialState(3, world);
    const initial: GameState = { ...s, seats: { seats: { seat_1: { faction: "fac_paradis" }, seat_2: { faction: "fac_paradis" }, seat_3: { faction: "fac_paradis" } } } };
    const host = new Host({ world, initial, password: "amis", hashEvery: 2 });
    const server = new WsServer((l) => host.accept(l), 0);
    const port = await server.listening;
    const clients: Client[] = [];
    for (const seat of ["seat_1", "seat_2", "seat_3"]) {
      const c = new Client(await connectWs(`ws://127.0.0.1:${port}`), world, seat, "amis", 2);
      clients.push(c);
      c.connect();
    }
    await until(() => clients.every((c) => c.connected));
    for (let t = 0; t < 5; t++) {
      clients[t % 3]?.submit({ type: "SetRationing", level: t % 2 ? "reduit" : "normal" });
      await new Promise((r) => setTimeout(r, 30));
      host.step(1);
      await until(() => clients.every((c) => c.tick === host.tick));
    }
    for (const c of clients) expect(hashOf(c.state as GameState)).toBe(hashOf(host.state));
    expect(host.desyncs).toEqual([]);
    const intruder = new Client(await connectWs(`ws://127.0.0.1:${port}`), world, "seat_1", "amis", 2);
    intruder.connect();
    await until(() => intruder.refused !== null);
    expect(intruder.refused).toBe("net.err.seat_taken");
    for (const c of clients) c.leave();
    await server.close();
  }, 60_000);
});
