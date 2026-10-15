import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { Lobby } from "../../src/net";

const world = loadWorld("data", "scn_854");
const playable = world.scenario.world?.playable ?? [];
const init = (): GameState => createInitialState(3, world);

describe("C13 : salon d'attente (27 §2)", () => {
  it("les camps jouables viennent du scénario ; le salon attribue seat_1.. dans l'ordre, refuse au-delà du plafond, réutilise un siège libéré", () => {
    expect(playable.length).toBeGreaterThan(1);
    const l = new Lobby({ playable, maxSeats: 3 });
    expect([l.join(), l.join(), l.join()]).toEqual(["seat_1", "seat_2", "seat_3"]);
    expect(l.join()).toBe("lobby.err.full");
    l.leave("seat_2");
    expect(l.join()).toBe("seat_2");
    expect(new Lobby({ playable, maxSeats: 50 }).seats).toEqual([]);
  });

  it("choix du camp : refus d'un camp non jouable ou d'un siège inconnu ; changer de camp annule l'état prêt ; prêt exige un camp", () => {
    const l = new Lobby({ playable });
    const a = l.join() as string;
    expect(l.setReady(a, true)).toBe("lobby.err.not_ready");
    expect(l.choose(a, "fac_inexistante")).toBe("lobby.err.not_playable");
    expect(l.choose("seat_9", playable[0] as string)).toBe("lobby.err.unknown_seat");
    expect(l.choose(a, playable[0] as string)).toBeNull();
    expect(l.setReady(a, true)).toBeNull();
    expect(l.canStart()).toBeNull();
    l.choose(a, playable[1] as string);
    expect(l.canStart()).toBe("lobby.err.not_ready");
  });

  it("démarrage : salon vide ou joueur non prêt refusés ; la table est installée ; deux sièges d'une faction reçoivent chacun des armées avec owner explicite", () => {
    const l = new Lobby({ playable });
    expect(l.start(init())).toBe("lobby.err.empty");
    const [a, b, c] = [l.join(), l.join(), l.join()] as string[];
    const camps = [playable[0], playable[0], playable[1]] as string[];
    const rival = camps[2] as string;
    [a, b, c].forEach((s, i) => {
      l.choose(s as string, camps[i] as string);
    });
    l.setReady(a as string, true);
    expect(l.start(init())).toBe("lobby.err.not_ready");
    l.setReady(b as string, true);
    l.setReady(c as string, true);
    const s = l.start(init()) as GameState;
    expect(s.seats?.seats).toEqual({ seat_1: { faction: camps[0] }, seat_2: { faction: camps[0] }, seat_3: { faction: rival } });
    const mine = (s.armies?.armies ?? []).filter((x) => x.faction === camps[0]);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((x) => x.owner === "seat_1" || x.owner === "seat_2")).toBe(true);
    if (mine.length > 1) expect(new Set(mine.map((x) => x.owner)).size).toBe(2);
    expect(l.start(init())).toBe("lobby.err.started");
    expect(l.join()).toBe("lobby.err.started");
  });

  it("un seul siège par faction : aucun owner imposé (la faction commande ses armées)", () => {
    const l = new Lobby({ playable });
    const a = l.join() as string;
    l.choose(a, playable[0] as string);
    l.setReady(a, true);
    const s = l.start(init()) as GameState;
    expect((s.armies?.armies ?? []).every((x) => x.owner === undefined || init().armies?.armies.find((y) => y.id === x.id)?.owner === x.owner)).toBe(true);
  });
});
