import { describe, expect, it } from "vitest";
import { addEvidence, createClockState, eventsForFaction, registerBearer, viewForFaction, viewForSeat } from "../../../src/sim/clock";
import type { ClockState } from "../../../src/sim/clock";
import { cb, input, nineState, slot } from "./helpers";

const sh = nineState({
  shifter_cuirasse: slot("char_reiner", "marley", 843),
  shifter_colossal: slot("char_bertholdt", "marley", 845),
  shifter_assaillant: slot("char_eren", "paradis", 845),
  shifter_fondateur: slot("char_eren", "paradis", 845),
});
const mk = (): ClockState => {
  let s = createClockState();
  s = registerBearer(s, input("char_reiner"), cb);
  s = registerBearer(s, input("char_bertholdt", { role: "civil" }), cb);
  s = registerBearer(s, input("char_eren", { faction: "paradis", role: "connu" }), cb);
  return s;
};
const view = (s: ClockState, f: string, year = 850) => viewForFaction(s, sh, f, year, 13, cb);

describe("P5 (d) un porteur non démasqué n'apparaît jamais", () => {
  it("la faction adverse ne voit ni le porteur ni ses Titans, quelles que soient les preuves non concluantes", () => {
    let s = mk();
    s = addEvidence(s, "char_reiner", "paradis", "temoin", 1, cb);
    const v = view(s, "paradis");
    const dump = JSON.stringify(v);
    expect(v.known.map((k) => k.id)).toEqual(["char_eren"]); // seulement les siens
    for (const leaked of ["shifter_cuirasse", "shifter_colossal", "char_reiner", "char_bertholdt"]) expect(dump).not.toContain(leaked);
    expect(dump).not.toMatch(/value|exposedTo|wearYears/);
    expect(v.suspects).toEqual([]); // 8 < suspect_threshold : rien d'affiché non plus
  });

  it("le suspect est donné par niveau seulement ; porteur et innocent y sont indiscernables à preuves égales", () => {
    let t = createClockState();
    t = registerBearer(t, input("char_reiner", { role: "connu" }), cb);
    for (const id of ["char_reiner", "char_innocent"]) t = addEvidence(t, id, "paradis", "interrogatoire", 1, cb);
    const w = view(t, "paradis").suspects;
    expect(w).toEqual([
      { character: "char_innocent", level: "soupcon" },
      { character: "char_reiner", level: "soupcon" },
    ]);
    expect(Object.keys(w[0] ?? {}).sort()).toEqual(["character", "level"]);
    expect(JSON.stringify(view(t, "paradis").known)).not.toContain("char_reiner");
  });

  it("sous suspect_threshold, aucun soupçon n'est affiché", () => {
    const s = addEvidence(mk(), "char_innocent", "paradis", "temoin", 1, cb);
    expect(view(s, "paradis").suspects).toEqual([]);
  });

  it("après démasquage la faction voit l'identité et les Titans, sans les années restantes ni la couverture", () => {
    let s = mk();
    for (let i = 0; i < 12; i++) s = addEvidence(s, "char_bertholdt", "paradis", "interrogatoire", i, cb);
    const v = view(s, "paradis");
    expect(v.known.filter((k) => !k.own)).toEqual([{ id: "char_bertholdt", titans: ["shifter_colossal"], own: false, cover: null, yearsLeft: null }]);
    expect(v.suspects.find((x) => x.character === "char_bertholdt")).toBeUndefined();
    expect(view(s, "hizuru").known).toEqual([]);
    expect(JSON.stringify(v)).not.toContain("char_reiner");
  });

  it("la faction du porteur voit les siens avec couverture et années restantes (Eren : le plus court des deux horloges)", () => {
    const own = view(mk(), "paradis");
    expect(own.known).toEqual([{ id: "char_eren", titans: ["shifter_assaillant", "shifter_fondateur"], own: true, cover: cb.cover.initial["connu"], yearsLeft: 8 }]);
    const marley = view(mk(), "marley").known.map((k) => k.id);
    expect(marley).toEqual(["char_bertholdt", "char_reiner"]);
  });

  it("par siège : multi-sièges, siège de la même faction identique, siège inconnu vide, solo = faction jouée", () => {
    const s = mk();
    const seats = { seats: { seat_1: { faction: "paradis" }, seat_2: { faction: "marley" }, seat_3: { faction: "marley" } } };
    const f = (seat: string, st: typeof seats | undefined) => viewForSeat(s, sh, seat, st, "paradis", 850, 13, cb);
    const g = (seat: string) => f(seat, seats);
    expect(g("seat_1").known.map((k) => k.id)).toEqual(["char_eren"]);
    expect(g("seat_2").known.map((k) => k.id)).toEqual(["char_bertholdt", "char_reiner"]);
    expect(g("seat_3")).toEqual(g("seat_2"));
    expect(g("seat_9")).toEqual({ faction: "", known: [], suspects: [] });
    expect(f("seat_1", undefined).faction).toBe("paradis");
    expect(f("seat_2", undefined).known).toEqual([]);
  });
});

describe("P5 biais de couverture : le niveau visible ne trahit pas le porteur", () => {
  it("porteurs couverts (infiltré, civil) et innocents, mêmes preuves : suite de niveaux identique à chaque pas", () => {
    for (const role of ["infiltre", "civil"]) {
      let t = registerBearer(createClockState(), input("char_porteur", { role }), cb);
      const levels = (id: string) => view(t, "paradis").suspects.find((x) => x.character === id)?.level ?? "aucun";
      for (const kind of ["temoin", "anomalie", "fuite", "temoin", "interrogatoire"]) {
        for (const id of ["char_porteur", "char_innocent_a", "char_innocent_b"]) t = addEvidence(t, id, "paradis", kind, 1, cb);
        if (t.events.length) break;
        expect(levels("char_porteur"), `${role}/${kind}`).toBe(levels("char_innocent_a"));
        expect(levels("char_innocent_b")).toBe(levels("char_innocent_a"));
      }
      expect(t.suspects["char_porteur"]?.["paradis"]?.shown).toBe(t.suspects["char_innocent_a"]?.["paradis"]?.shown);
    }
  });
  it("la couverture reste utile : à preuves égales le porteur couvert est démasqué après l'innocent n'est accusé", () => {
    let t = registerBearer(createClockState(), input("char_porteur"), cb);
    let n = 0;
    while (!t.events.some((e) => e.type === "false_accusation") && n < 100) {
      t = addEvidence(t, "char_innocent", "paradis", "temoin", n, cb);
      t = addEvidence(t, "char_porteur", "paradis", "temoin", n, cb);
      n++;
    }
    expect(t.events.map((e) => e.type)).toEqual(["false_accusation"]);
    expect(t.bearers["char_porteur"]?.exposedTo).toEqual(["marley"]);
  });
});

describe("P5 événements par observateur", () => {
  it("un autre observateur ne voit ni le porteur ni l'observateur d'autrui", () => {
    let s = mk();
    for (let i = 0; i < 12; i++) s = addEvidence(s, "char_bertholdt", "paradis", "interrogatoire", i, cb);
    for (let i = 0; i < 12; i++) s = addEvidence(s, "char_innocent", "hizuru", "interrogatoire", i, cb);
    expect(eventsForFaction(s, "paradis")).toEqual([{ type: "unmasked", day: expect.any(Number) as number, bearer: "char_bertholdt", observer: "paradis" }]);
    expect(eventsForFaction(s, "hizuru").map((e) => e.type)).toEqual(["false_accusation"]);
    expect(JSON.stringify(eventsForFaction(s, "hizuru"))).not.toMatch(/bertholdt|paradis/);
    expect(JSON.stringify(eventsForFaction(s, "paradis"))).not.toMatch(/hizuru|innocent/);
    expect(eventsForFaction(s, "marley")).toEqual([]);
  });
});

describe("P5 observateur qui sait déjà : indiscernable d'un innocent côté vue et événements", () => {
  it("porteur déjà connu et innocent, mêmes preuves : ni suspect affiché ni événement", () => {
    let t = registerBearer(createClockState(), input("char_connu", { role: "connu" }), cb);
    for (let i = 0; i < 12; i++) t = addEvidence(t, "char_connu", "paradis", "interrogatoire", i, cb);
    const evBefore = eventsForFaction(t, "paradis").length;
    const known = view(t, "paradis").known.map((k) => k.id);
    for (let i = 0; i < 12; i++) t = addEvidence(t, "char_connu", "paradis", "transformation_vue", i, cb);
    expect(eventsForFaction(t, "paradis").length).toBe(evBefore);
    expect(view(t, "paradis").known.map((k) => k.id)).toEqual(known);
    expect(view(t, "paradis").suspects).toEqual([]);
  });
});

describe("P5 années restantes bornées", () => {
  it("jamais négatives, même après l'échéance", () => {
    const own = viewForFaction(mk(), sh, "paradis", 900, 13, cb).known[0];
    expect(own?.yearsLeft).toBe(0);
  });
});
