import { describe, expect, it } from "vitest";
import { VoteBox } from "../../src/net";

describe("C13 : votes de table (27 §5)", () => {
  it("seul un siège présent propose ; un seul vote ouvert ; vitesse limitée à 1-3", () => {
    const seats = ["seat_1", "seat_2", "seat_3"];
    const v = new VoteBox(() => seats);
    expect(v.propose("seat_9", { kind: "pause", on: true })).toBe("vote.err.not_seated");
    expect(v.propose("seat_1", { kind: "speed", level: 7 as 1 })).toBe("vote.err.speed");
    expect(v.answer("seat_1", true)).toBe("vote.err.none");
    expect(v.propose("seat_1", { kind: "pause", on: true })).toBeNull();
    expect(v.propose("seat_2", { kind: "pause", on: false })).toBe("vote.err.open");
    expect(v.open?.by).toBe("seat_1");
  });

  it("majorité stricte pour adopter ; égalité = refus ; décidé sans attendre les absents de réponse", () => {
    const seats = ["seat_1", "seat_2", "seat_3", "seat_4"];
    const v = new VoteBox(() => seats);
    v.propose("seat_1", { kind: "pause", on: true });
    expect(v.answer("seat_2", true)).toBeNull(); // 2 sur 4 : pas encore majoritaire
    expect(v.answer("seat_3", true)).toEqual({ subject: { kind: "pause", on: true }, passed: true, yes: 3, no: 0 });
    v.propose("seat_1", { kind: "speed", level: 3 });
    expect(v.answer("seat_2", false)).toBeNull();
    expect(v.answer("seat_3", false)).toEqual({ subject: { kind: "speed", level: 3 }, passed: false, yes: 1, no: 2 });
    v.propose("seat_1", { kind: "speed", level: 2 });
    const r = v.answer("seat_2", false); // 1 oui, 1 non sur 4 : ouvert
    expect(r).toBeNull();
    expect(v.answer("seat_3", true)).toBeNull();
    expect(v.answer("seat_4", false)).toMatchObject({ passed: false });
  });

  it("un siège qui part sort du décompte ; un vote d'un seul siège passe seul ; une réponse modifiée remplace la précédente", () => {
    let seats = ["seat_1", "seat_2", "seat_3"];
    const v = new VoteBox(() => seats);
    v.propose("seat_1", { kind: "pause", on: true });
    seats = ["seat_1", "seat_2"];
    expect(v.recount()).toBeNull(); // 1 oui sur 2 : pas de majorité stricte
    expect(v.answer("seat_2", false)).toMatchObject({ passed: false });
    const solo = new VoteBox(() => ["seat_1"]);
    expect(solo.propose("seat_1", { kind: "pause", on: true })).toMatchObject({ passed: true });
    const t = new VoteBox(() => ["seat_1", "seat_2", "seat_3"]);
    t.propose("seat_1", { kind: "pause", on: true });
    expect(t.answer("seat_2", false)).toBeNull();
    expect(t.answer("seat_2", true)).toMatchObject({ passed: true });
  });
});
