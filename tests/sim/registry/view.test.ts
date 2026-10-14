import { describe, expect, it } from "vitest";
import type { SeatsState } from "../../../src/sim/core/seat";
import { createRegistry, enlistGenerated, enlistNamed, raiseStele, registerDeath, viewForFaction, viewForSeat } from "../../../src/sim/registry";
import type { RegistryState } from "../../../src/sim/registry";
import { D0, FA, FB, rbal, rng, squad } from "./helpers";

/** Deux camps : A (escouade de test, un mort gravé) et B (nommés, généré, un mort, une stèle). */
function world(): { s: RegistryState; b: { named: string; dead: string; live: string } } {
  const q = squad();
  let s = raiseStele(q.state, FA, "Trost", D0, rng(2), rbal).state;
  s = registerDeath(s, { soldier: q.ami, day: D0, cause: "frappe", place: "Trost", circumstances: "Brèche." }, rng(1), rbal).state;
  const n = enlistNamed(s, { faction: FB, squad: "sqB", rank: "caporal", day: D0 - 300, name: "Konrad Vogel" }, rng(1), rbal);
  const g = enlistGenerated(n.state, { faction: FB, squad: "sqB", count: 2, day: D0 - 300 }, rbal);
  const dead = registerDeath(raiseStele(g.state, FB, "Orvaux", D0, rng(2), rbal).state, { soldier: g.ids[0] as string, day: D0, cause: "balle", place: "Orvaux", circumstances: "Tranchée." }, rng(1), rbal);
  return { s: dead.state, b: { named: n.id, dead: g.ids[0] as string, live: g.ids[1] as string } };
}

describe("P7 pas de fuite entre factions", () => {
  it("la vue d'une faction ne contient aucune trace de l'autre (identifiants, noms, lieux, stèles)", () => {
    const { s, b } = world();
    const json = JSON.stringify(viewForFaction(s, FA, D0, rbal));
    for (const secret of [b.named, b.dead, "Konrad Vogel", "Orvaux", "Tranchée", "ste_002"]) expect(json).not.toContain(secret);
    const jb = JSON.stringify(viewForFaction(s, FB, D0, rbal));
    for (const secret of ["Anton Albrecht", "Bertram Brenner", "Brèche", "Trost", "ste_001"]) expect(jb).not.toContain(secret);
  });

  it("non-interférence : la vue de A est identique si l'on retire tout ce qui concerne B de l'état", () => {
    const { s } = world();
    const onlyA: RegistryState = {
      ...s,
      soldiers: Object.fromEntries(Object.entries(s.soldiers).filter(([, x]) => x.faction === FA)),
      bonds: s.bonds.filter((l) => s.soldiers[l.a]?.faction === FA),
      deaths: s.deaths.filter((d) => d.faction === FA),
      steles: s.steles.filter((x) => x.faction === FA),
      successions: s.successions.filter((x) => x.faction === FA),
      enlisted: { [FA]: s.enlisted[FA] ?? 0 },
    };
    expect(viewForFaction(s, FA, D0, rbal)).toEqual(viewForFaction(onlyA, FA, D0, rbal));
  });

  it("la vue ne donne ni liens, ni successions, ni événements bruts ; un mort n'apparaît que dans les morts, jamais dans l'effectif", () => {
    const { s } = world();
    const v = viewForFaction(s, FA, D0, rbal);
    expect(Object.keys(v).sort()).toEqual(["counts", "deaths", "faction", "roster", "standing", "steles"]);
    expect(v.counts).toMatchObject({ enlisted: 11, dead: 1, living: 10, named: 7, generated: 3, missing: 0 });
    expect(v.counts.living + v.counts.dead + v.counts.missing).toBe(v.counts.enlisted);
    expect(v.roster.some((r) => r.status === "mort")).toBe(false);
    expect(v.deaths).toHaveLength(1);
    expect(v.deaths[0]).toMatchObject({ label: "Bertram Brenner", cause: "frappe", place: "Trost", inscribed: "ste_001" });
    expect(v.steles).toEqual([{ id: "ste_001", title: expect.stringContaining("Trost") as string, place: "Trost", epitaph: expect.any(String) as string, inscribed: 1, capacity: rbal.stele.capacity }]);
    expect(v.roster.find((r) => r.id === "mat_0009")?.label).toBe("mat_0009");
  });

  it("par siège : le siège dirige une faction ; en solo le siège solo dirige la faction jouée ; un siège inconnu ne voit rien", () => {
    const { s } = world();
    const seats: SeatsState = { seats: { seat_1: { faction: FA }, seat_2: { faction: FB } } };
    expect(viewForSeat(s, "seat_2", seats, FA, D0, rbal)).toEqual(viewForFaction(s, FB, D0, rbal));
    expect(viewForSeat(s, "seat_1", seats, FB, D0, rbal)).toEqual(viewForFaction(s, FA, D0, rbal));
    expect(viewForSeat(s, "seat_1", undefined, FB, D0, rbal)).toEqual(viewForFaction(s, FB, D0, rbal));
    for (const v of [viewForSeat(s, "seat_9", seats, FA, D0, rbal), viewForSeat(s, "seat_2", undefined, FA, D0, rbal)]) {
      expect(v.faction).toBe("");
      expect(v.roster).toEqual([]);
      expect(v.deaths).toEqual([]);
    }
  });

  it("une faction inexistante n'a rien ; les morts d'un camp ne changent pas la vue de l'autre", () => {
    const { s, b } = world();
    expect(viewForFaction(createRegistry(), FA, D0, rbal).counts.enlisted).toBe(0);
    const t = registerDeath(s, { soldier: b.live, day: D0 + 1, cause: "chute", place: "Mur", circumstances: "x" }, rng(1), rbal).state;
    expect(viewForFaction(t, FA, D0, rbal)).toEqual(viewForFaction(s, FA, D0, rbal));
  });
});
