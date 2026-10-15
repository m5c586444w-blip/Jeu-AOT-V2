import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { Rng } from "../../src/sim/core/rng";
import { createInitialState } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { assignTraitors, Client, Host, LoopbackNetwork, hashOf } from "../../src/net";
import type { Link } from "../../src/net";
import { serialize } from "../../src/sim/core/serialize";

const world = loadWorld("data", "scn_854");
const PASSWORD = "amis";
const SEATS = Array.from({ length: 9 }, (_, i) => `seat_${i + 1}`);
const ARMY_OWNERS: Record<string, string> = { army_854_sud: "seat_2", army_854_est: "seat_3", army_854_brigade: "seat_4" };

/** Partie de 9 sièges de Paradis (conseil mixte) ; trois armées confiées à trois sièges. */
function table(seed: number): GameState {
  const s = createInitialState(seed, world);
  if (!s.armies) throw new Error("couche armées absente");
  const armies = structuredClone(s.armies);
  for (const a of armies.armies) if (ARMY_OWNERS[a.id]) a.owner = ARMY_OWNERS[a.id];
  const player = s.nations?.player ?? "fac_paradis";
  return { ...s, armies, seats: { seats: Object.fromEntries(SEATS.map((id) => [id, { faction: player }])) } };
}

interface Room {
  net: LoopbackNetwork;
  host: Host;
  clients: Map<string, Client>;
  join: (seat: string) => Client;
}

function room(seed: number, maxDelay = 3): Room {
  const net = new LoopbackNetwork(seed, 0, maxDelay);
  const host = new Host({ world, initial: table(seed), password: PASSWORD, hashEvery: 3 });
  const clients = new Map<string, Client>();
  const join = (seat: string): Client => {
    const { client, host: h } = net.connect();
    host.accept(h);
    const c = new Client(client, world, seat, PASSWORD, 3);
    clients.set(seat, c);
    c.connect();
    return c;
  };
  return { net, host, clients, join };
}

const geoNeighbors = (p: string): string[] => (world.military?.geo.adj.get(p) ?? []).map((e) => e.to).sort();

/** Commandes au hasard (graine fixée) : ordres d'armée légitimes, ordres usurpés, commandes de faction. */
function randomCommand(rng: Rng, c: Client): ({ type: string } & Record<string, unknown>) | null {
  const st = c.state;
  if (!st?.armies) return null;
  const k = rng.next();
  if (k < 0.35) {
    const mine = st.armies.armies.filter((a) => a.owner === c.seat && a.province);
    const a = mine[Math.floor(rng.next() * mine.length)];
    if (!a?.province) return { type: "Noop" };
    const to = geoNeighbors(a.province);
    const dest = to[Math.floor(rng.next() * to.length)];
    return dest ? { type: "ArmyMove", army: a.id, to: dest } : { type: "ArmyHalt", army: a.id };
  }
  if (k < 0.5) return { type: "ArmyHalt", army: "army_854_sud" }; // légitime seulement pour seat_2
  if (k < 0.7) return { type: "SetRationing", level: (["normal", "reduit", "strict"] as const)[Math.floor(rng.next() * 3)] };
  if (k < 0.8) return { type: "SetFlag", key: `f${Math.floor(rng.next() * 3)}`, value: rng.next() < 0.5 };
  if (k < 0.85) return { type: "ArmyMove", army: "army_inconnue", to: "prov_nulle" };
  return null;
}

function play(r: Room, seed: number, turns: number): void {
  const rng = new Rng(seed * 7919 + 1);
  for (const seat of SEATS) r.join(seat);
  r.net.drain();
  for (let t = 0; t < turns; t++) {
    for (const seat of SEATS) {
      const c = r.clients.get(seat) as Client;
      if (rng.next() < 0.5) {
        const cmd = randomCommand(rng, c);
        if (cmd) c.submit(cmd);
      }
    }
    r.net.drain();
    r.host.step(1);
    r.net.drain();
  }
}

describe("C13 : lockstep, hôte séquenceur, 9 clients headless", () => {
  it("9 clients, 10 graines : 0 désynchronisation, même tour et même empreinte partout", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const r = room(seed);
      play(r, seed, 10);
      const ref = hashOf(r.host.state);
      for (const [seat, c] of r.clients) {
        expect(c.refused, `graine ${seed} ${seat}`).toBeNull();
        expect(c.tick, `graine ${seed} ${seat}`).toBe(r.host.tick);
        expect(c.state ? hashOf(c.state) : null, `graine ${seed} ${seat}`).toBe(ref);
      }
      expect(r.host.desyncs).toEqual([]);
      expect(r.host.seats).toEqual(SEATS);
    }
  }, 300_000);
});

describe("C13 : accueil, droits, reprise", () => {
  it("refus d'accueil : mot de passe, siège inconnu, siège déjà pris, version", () => {
    const r = room(1);
    // Chaque tentative a son propre lien.
    const attempt = (seat: string, pwd: string): Client => {
      const { client, host: h } = r.net.connect();
      r.host.accept(h);
      const c = new Client(client, world, seat, pwd, 3);
      c.connect();
      return c;
    };
    const a = attempt("seat_1", "faux");
    const b = attempt("seat_12", PASSWORD);
    const ok = attempt("seat_1", PASSWORD);
    const dup = attempt("seat_1", PASSWORD);
    r.net.drain();
    expect(a.refused).toBe("net.err.password");
    expect(b.refused).toBe("net.err.bad_message");
    expect(ok.connected).toBe(true);
    expect(dup.refused).toBe("net.err.seat_taken");
  });

  it("un siège ne commande que ses armées : l'ordre d'un autre siège est refusé à l'hôte et n'entre pas au journal", () => {
    const r = room(2);
    for (const s of SEATS) r.join(s);
    r.net.drain();
    const intruder = r.clients.get("seat_5") as Client;
    const id = intruder.submit({ type: "ArmyHalt", army: "army_854_sud" });
    const owner = (r.clients.get("seat_2") as Client).submit({ type: "ArmyHalt", army: "army_854_sud" });
    r.net.drain();
    r.host.step(1);
    r.net.drain();
    expect(intruder.rejected).toEqual([{ id, code: "seat.err.not_owner" }]);
    expect(owner).not.toBeNull();
    expect(r.host.journal.flatMap((t) => t.envs).map((e) => e.env.seat)).toEqual(["seat_2"]);
  });

  it("un client ne peut pas parler au nom d'un autre siège", () => {
    const r = room(3);
    for (const s of SEATS) r.join(s);
    r.net.drain();
    const c = r.clients.get("seat_5") as Client;
    const { client, host: h } = r.net.connect();
    void client;
    void h;
    // Enveloppe forgée : le message passe par le lien de seat_5 mais prétend venir de seat_2.
    (c as unknown as { post: (m: unknown) => void }).post({ t: "cmd", id: 1, env: { seat: "seat_2", day: 0, command: { type: "ArmyHalt", army: "army_854_sud" } } });
    r.net.drain();
    expect(c.rejected).toEqual([{ id: 1, code: "seat.err.spoof" }]);
    r.host.step(1);
    expect(r.host.journal.flatMap((t) => t.envs)).toEqual([]);
  });

  it("aucune commande perdue ni dupliquée : chaque commande acceptée figure une fois au journal, numéros strictement croissants", () => {
    const r = room(4);
    for (const s of SEATS) r.join(s);
    r.net.drain();
    let sent = 0;
    for (let t = 0; t < 6; t++) {
      for (const s of SEATS) {
        const c = r.clients.get(s) as Client;
        if (c.submit({ type: "SetRationing", level: t % 2 ? "reduit" : "normal" }) !== null) sent++;
      }
      r.net.drain();
      r.host.step(1);
      r.net.drain();
    }
    const seqs = r.host.journal.flatMap((t) => t.envs.map((e) => e.seq));
    expect(seqs.length + [...r.clients.values()].reduce((n, c) => n + c.rejected.length, 0)).toBe(sent);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
  });

  it("déconnexion puis reconnexion en cours de partie : le siège reprend sur un instantané synchronisé", () => {
    const r = room(5);
    play(r, 5, 4);
    const gone = r.clients.get("seat_6") as Client;
    gone.leave();
    r.net.drain();
    expect(r.host.seats).not.toContain("seat_6");
    for (let t = 0; t < 4; t++) {
      r.host.step(1);
      r.net.drain();
    }
    const back = r.join("seat_6");
    r.net.drain();
    expect(back.tick).toBe(r.host.tick);
    expect(hashOf(back.state as GameState)).toBe(hashOf(r.host.state));
    for (let t = 0; t < 4; t++) {
      back.submit({ type: "SetRationing", level: "strict" });
      r.net.drain();
      r.host.step(1);
      r.net.drain();
    }
    for (const c of r.clients.values()) if (c !== gone) expect(hashOf(c.state as GameState)).toBe(hashOf(r.host.state));
    expect(r.host.desyncs).toEqual([]);
  });

  it("désynchronisation provoquée : détectée par l'empreinte, le client fautif reçoit un instantané et se resynchronise", () => {
    const r = room(6);
    for (const s of SEATS) r.join(s);
    r.net.drain();
    const victim = r.clients.get("seat_3") as Client;
    const st = victim.state as GameState;
    // Corruption locale : un client dont l'état dérive (mémoire altérée, outil de développement).
    (st.strategic as { rationing?: string }).rationing = "strict";
    for (let t = 0; t < 7; t++) {
      r.host.step(1);
      r.net.drain();
    }
    expect(r.host.desyncs.map((d) => d.seat)).toContain("seat_3");
    expect(victim.snapshots.map((s) => s.reason)).toContain("desync");
    expect(hashOf(victim.state as GameState)).toBe(hashOf(r.host.state));
  });

  it("tours reçus en désordre : le client attend le tour manquant puis les applique dans l'ordre ; un tour passé est ignoré", () => {
    const r = room(7, 0);
    const ref = r.join("seat_1");
    r.net.drain();
    const quiet: Link = { send: () => undefined, onMessage: () => undefined, onClose: () => undefined, close: () => undefined };
    const fresh = new Client(quiet, world, "seat_9", PASSWORD, 3);
    const feed = (m: unknown): void => (fresh as unknown as { receive: (s: string) => void }).receive(JSON.stringify(m));
    feed({ t: "welcome", seat: "seat_9", tick: r.host.tick, snapshot: serialize(r.host.state) });
    const t1 = r.host.step(1).turn;
    const t2 = r.host.step(1).turn;
    const t3 = r.host.step(1).turn;
    feed({ t: "turn", turn: t3 });
    feed({ t: "turn", turn: t2 });
    expect(fresh.tick).toBe(0);
    feed({ t: "turn", turn: t1 });
    expect(fresh.tick).toBe(3);
    feed({ t: "turn", turn: t1 });
    expect(fresh.tick).toBe(3);
    r.net.drain();
    expect(hashOf(fresh.state as GameState)).toBe(hashOf(r.host.state));
    expect(hashOf(ref.state as GameState)).toBe(hashOf(r.host.state));
  });
});

describe("C13 : réserves de la revue (siège, nation fixée, trou de tours)", () => {
  it("un second hello sur un lien déjà assis est ignoré : un refus ne libère pas le siège, aucun siège n'est cumulé", () => {
    const r = room(11, 0);
    const c = r.join("seat_1");
    r.net.drain();
    const link = (c as unknown as { link: Link }).link;
    link.send(JSON.stringify({ t: "hello", v: 1, seat: "seat_2", password: "faux" }));
    link.send(JSON.stringify({ t: "hello", v: 1, seat: "seat_2", password: PASSWORD }));
    r.net.drain();
    expect(r.host.seats).toEqual(["seat_1"]);
  });

  it("SetPlayerFaction est refusé à l'exécution quand la table a des sièges", () => {
    const r = room(12, 0);
    const c = r.join("seat_1");
    r.net.drain();
    c.submit({ type: "SetPlayerFaction", faction: "fac_marley" });
    r.net.drain();
    r.host.step(1);
    r.net.drain();
    expect(r.host.executionRejects.length + c.rejected.length).toBeGreaterThan(0);
    expect(r.host.state.nations?.player).toBe(table(12).nations?.player);
  });

  it("trou persistant de tours : le client redemande un instantané au lieu de rester bloqué", () => {
    const r = room(13, 0);
    r.join("seat_1");
    r.net.drain();
    const sent: string[] = [];
    const quiet: Link = { send: (m) => void sent.push(m), onMessage: () => undefined, onClose: () => undefined, close: () => undefined };
    const fresh = new Client(quiet, world, "seat_9", PASSWORD, 3);
    const feed = (m: unknown): void => (fresh as unknown as { receive: (s: string) => void }).receive(JSON.stringify(m));
    feed({ t: "welcome", seat: "seat_9", tick: r.host.tick, snapshot: serialize(r.host.state) });
    r.host.step(1); // ce tour-là ne parvient jamais au client
    for (let i = 0; i < 9; i++) feed({ t: "turn", turn: r.host.step(1).turn });
    expect(sent.some((m) => m.includes('"resync"'))).toBe(true);
  });
});

describe("C13 : trahison, coffre de secrets de l'hôte (27 §4.4)", () => {
  it("assignTraitors : aucune → personne ; garantie → au moins un ; plafond 1 jusqu'à 5 joueurs, 2 au-delà ; déterministe ; seul seul = personne", () => {
    expect(assignTraitors(SEATS, "aucune", 1)).toEqual([]);
    expect(assignTraitors(["seat_1"], "garantie", 1)).toEqual([]);
    let some = 0;
    let none = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const g = assignTraitors(SEATS, "garantie", seed);
      expect(g.length).toBeGreaterThanOrEqual(1);
      expect(g.length).toBeLessThanOrEqual(2);
      expect(assignTraitors(SEATS.slice(0, 5), "garantie", seed).length).toBe(1);
      expect(assignTraitors(SEATS, "garantie", seed)).toEqual(g);
      expect(g.every((s) => SEATS.includes(s))).toBe(true);
      if (assignTraitors(SEATS, "possible", seed).length > 0) some++;
      else none++;
    }
    expect(some).toBeGreaterThan(0);
    expect(none).toBeGreaterThan(0);
  });

  it("le secret d'un traître n'est ni dans l'état partagé, ni dans un tour, ni dans un instantané ; seul son titulaire le reçoit ; empreintes identiques", () => {
    const r = room(11);
    const SECRET = { seat: "seat_7", serves: "marley", objective: "livrer le plan des canons XYZ-SECRET", capital: 3 };
    r.host.vault.set(SECRET);
    for (const s of SEATS) r.join(s);
    r.net.drain();
    for (let t = 0; t < 4; t++) {
      r.host.step(1);
      r.net.drain();
    }
    for (const [seat, c] of r.clients) {
      if (seat === "seat_7") expect(c.secret).toEqual({ serves: "marley", objective: SECRET.objective, capital: 3 });
      else expect(c.secret, seat).toBeNull();
      expect(hashOf(c.state as GameState)).toBe(hashOf(r.host.state));
    }
    expect(serialize(r.host.state)).not.toContain("XYZ-SECRET");
    expect(JSON.stringify(r.host.journal)).not.toContain("XYZ-SECRET");
    for (const c of r.clients.values()) expect(serialize(c.state as GameState)).not.toContain("XYZ-SECRET");
  });
});
