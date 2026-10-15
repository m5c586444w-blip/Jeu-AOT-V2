import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { applyBattleTurn, BattleClient, BattleHost, hashBattle, LoopbackNetwork } from "../../src/net";
import type { Link } from "../../src/net";
import { Rng } from "../../src/sim/core/rng";
import type { SeatsState } from "../../src/sim/core/seat";
import { createBattle } from "../../src/sim/tactical/battle";
import type { Battle } from "../../src/sim/tactical/battle";
import { skirmishSetup } from "../../src/sim/tactical/setup";

const world = loadWorld("data", "scn_sandbox_850");
const SEATS = Array.from({ length: 9 }, (_, i) => `seat_${i + 1}`);
const seats: SeatsState = { seats: Object.fromEntries(SEATS.map((s) => [s, { faction: "fac_paradis" }])) };
const ORDERS = ["tuer", "tenir", "repli", "couvrir"] as const;

/** Même bataille partout : carte et état depuis la graine ; neuf escouades réparties entre neuf sièges. */
function make(seed: number): Battle {
  const bt = createBattle(world, skirmishSetup(world, "tmap_plaine", [{ type: "ttype_moyen_errant", count: 2 }], 54, seed, false));
  bt.state.squads.forEach((sq, i) => {
    if (sq.id.startsWith("esc_")) sq.owner = SEATS[i % SEATS.length] as string;
  });
  return bt;
}

function setup(seed: number): { net: LoopbackNetwork; host: BattleHost; clients: Map<string, BattleClient>; join: (seat: string, bt?: Battle) => BattleClient } {
  const net = new LoopbackNetwork(seed, 0, 2);
  const host = new BattleHost(make(seed), "amis", seats, 20);
  const clients = new Map<string, BattleClient>();
  const join = (seat: string, bt: Battle = make(seed)): BattleClient => {
    const { client, host: h } = net.connect();
    host.accept(h as Link);
    const c = new BattleClient(client, bt, seat, "amis", seats, 20);
    clients.set(seat, c);
    c.connect();
    return c;
  };
  return { net, host, clients, join };
}

describe("C13 : bataille à plusieurs (lockstep à 20 Hz)", () => {
  it("9 commandants, 10 graines : chacun dirige ses escouades ; 0 désynchronisation, même empreinte, ordres usurpés refusés", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const r = setup(seed);
      for (const s of SEATS) r.join(s);
      r.net.drain();
      const rng = new Rng(seed + 99);
      const squads = r.host.bt.state.squads.map((s) => s.id);
      for (let t = 0; t < 80; t++) {
        for (const [seat, c] of r.clients) {
          if (rng.next() < 0.6) c.order({ squad: squads[Math.floor(rng.next() * squads.length)] as string, order: ORDERS[Math.floor(rng.next() * 4)] as (typeof ORDERS)[number] });
          void seat;
        }
        r.net.drain();
        r.host.step(4);
        r.net.drain();
      }
      const ref = hashBattle(r.host.bt);
      for (const [seat, c] of r.clients) {
        expect(c.refused, `${seed} ${seat}`).toBeNull();
        expect(hashBattle(c.bt), `${seed} ${seat}`).toBe(ref);
        expect(c.bt.state.tick).toBe(r.host.bt.state.tick);
      }
      expect(r.host.desyncs).toEqual([]);
      // Des ordres usurpés ont bien été donnés (squad d'un autre) et refusés de la même façon partout.
      const denied = [...r.clients.values()][0]?.rejected.filter((x) => x.code === "seat.err.not_owner").length ?? 0;
      expect(denied).toBeGreaterThan(0);
      for (const c of r.clients.values()) expect(c.rejected).toEqual([...r.clients.values()][0]?.rejected);
    }
  }, 300_000);

  it("l'état restauré depuis un instantané a la même empreinte et continue identique (reconnexion en bataille)", () => {
    const r = setup(3);
    for (const s of SEATS) r.join(s);
    r.net.drain();
    for (let t = 0; t < 10; t++) {
      r.clients.get("seat_1")?.order({ squad: "esc_01", order: "tenir" });
      r.net.drain();
      r.host.step(4);
      r.net.drain();
    }
    const gone = r.clients.get("seat_4") as BattleClient;
    void gone;
    // Un siège déjà pris est refusé ; après la coupure de l'ancien titulaire, le même siège est accueilli sur un instantané.
    const net2 = new LoopbackNetwork(5, 0, 1);
    const l = net2.connect();
    const late = new BattleClient(l.client, make(3), "seat_9", "amis", seats, 20);
    r.host.accept(l.host as Link);
    late.connect();
    net2.drain();
    expect(late.refused).toBe("net.err.seat_taken");
    // Siège connu, déjà pris : refus ; après départ de l'ancien, accueil sur instantané.
    const l2 = net2.connect();
    const dup = new BattleClient(l2.client, make(3), "seat_1", "amis", seats, 20);
    r.host.accept(l2.host as Link);
    dup.connect();
    net2.drain();
    expect(dup.refused).toBe("net.err.seat_taken");
    const old = r.clients.get("seat_6") as BattleClient;
    (old as unknown as { link: Link }).link.close();
    const l3 = net2.connect();
    const back = new BattleClient(l3.client, make(3), "seat_6", "amis", seats, 20);
    r.host.accept(l3.host as Link);
    back.connect();
    net2.drain();
    expect(back.connected).toBe(true);
    expect(hashBattle(back.bt)).toBe(hashBattle(r.host.bt));
    // Même suite d'ordres appliquée à la copie restaurée et à l'hôte : empreintes égales.
    const turn = { tick: r.host.bt.state.tick, steps: 8, orders: [] };
    applyBattleTurn(back.bt, turn, seats);
    applyBattleTurn(r.host.bt, turn, seats);
    expect(hashBattle(back.bt)).toBe(hashBattle(r.host.bt));
  }, 120_000);

  it("désynchronisation provoquée : détectée par l'empreinte, instantané renvoyé, état resynchronisé", () => {
    const r = setup(4);
    for (const s of SEATS) r.join(s);
    r.net.drain();
    const victim = r.clients.get("seat_2") as BattleClient;
    const sol = victim.bt.state.soldiers[0];
    if (!sol) throw new Error("aucun soldat");
    sol.x += 5;
    for (let t = 0; t < 12; t++) {
      r.host.step(4);
      r.net.drain();
    }
    expect(r.host.desyncs.map((d) => d.seat)).toContain("seat_2");
    expect(victim.snapshots).toContain("desync");
    r.host.step(1);
    r.net.drain();
    expect(hashBattle(victim.bt)).toBe(hashBattle(r.host.bt));
  }, 120_000);
});
