import { describe, expect, it } from "vitest";
import { loadWorld } from "../../../src/data/worldNode";
import { applyCommand } from "../../../src/sim/core/commands";
import { createInitialState } from "../../../src/sim/core/state";
import type { GameState } from "../../../src/sim/core/state";
import { addEvidence, applyCapture, createClockState, extractionProblem, nineViolations, registerBearer, rosterOf, syncBearers, viewForFaction, yearsLeftOf } from "../../../src/sim/clock";
import { inheritProblem, yearsLeft } from "../../../src/sim/shifters/shifters";
import type { ShiftersState } from "../../../src/sim/shifters/shifters";
import { cb, input } from "./helpers";

const world = loadWorld("data", "scn_sandbox_850");
const quiet = { ...world, chronicle: null };
const sh = (s: GameState): ShiftersState => {
  if (!s.shifters) throw new Error("couche shifters absente");
  return s.shifters;
};
const s0 = createInitialState(1, quiet);

describe("P5 sur le monde réel (scénario 850)", () => {
  it("les Neuf des données de monde respectent l'invariant, et nos années restantes égalent yearsLeft de shifters.ts", () => {
    const state = sh(s0);
    expect(nineViolations(state, cb, (c) => s0.politics?.characters[c]?.alive !== false)).toEqual([]);
    for (const [id, slot] of Object.entries(state.titans)) {
      expect(yearsLeftOf(slot.since, s0.date.year, world.shifters?.balance.curse_years ?? 0), id).toBe(yearsLeft(quiet, slot, s0.date).value);
    }
  });

  it("l'invariant tient tout au long de l'échéance de 13 ans (Eren à 838 → mort le 1er jour de 851) ; le suivi suit l'horloge", () => {
    let s: GameState = { ...s0, shifters: { ...sh(s0), titans: { ...sh(s0).titans, shifter_assaillant: { ...(sh(s0).titans["shifter_assaillant"] as ShiftersState["titans"][string]), since: 838 } } } };
    let clock = registerBearer(createClockState(), input("char_eren_yeager", { faction: "paradis", role: "connu" }), cb);
    const alive = (c: string) => s.politics?.characters[c]?.alive !== false;
    for (let i = 0; i < 4; i++) {
      s = applyCommand(s, { type: "AdvanceDays", n: 90 }, undefined, quiet);
      expect(nineViolations(sh(s), cb, alive), `jour ${s.date.day}, an ${s.date.year}`).toEqual([]);
    }
    expect(s.date.year).toBe(851);
    expect(s.politics?.characters["char_eren_yeager"]?.alive).toBe(false);
    const r = syncBearers(clock, sh(s));
    expect(r.removed).toEqual(["char_eren_yeager"]);
    clock = r.state;
    expect(clock.bearers).toEqual({});
  });

  it("démasquer puis capturer le Cuirassé (Marley) ouvre l'héritage préparé de Paradis sans toucher à l'horloge", () => {
    const state = sh(s0);
    const pol = s0.politics ?? null;
    const reiner = state.titans["shifter_cuirasse"]?.holder;
    expect(reiner).toBe("char_reiner_braun");
    // Avant : ni démasqué ni capturé.
    let clock = registerBearer(createClockState(), input("char_reiner_braun", { faction: "marley" }), cb);
    expect(extractionProblem(clock, state, "char_reiner_braun", "paradis")).toBe("clock.err.unknown_identity");
    expect(inheritProblem(quiet, state, pol, "shifter_cuirasse", "char_mikasa_ackerman", false)).toBe("shifter.err.not_held");
    // Les preuves s'accumulent jusqu'au démasquage.
    for (let i = 0; i < 40 && !clock.events.length; i++) clock = addEvidence(clock, "char_reiner_braun", "paradis", "fuite", i, cb);
    expect(clock.events.map((e) => e.type)).toEqual(["unmasked"]);
    expect(extractionProblem(clock, state, "char_reiner_braun", "paradis")).toBeNull();
    expect(viewForFaction(clock, state, "paradis", s0.date.year, 13, cb).known.map((k) => k.id)).toContain("char_reiner_braun");
    // Capture : héritage possible, horloge intacte.
    const caught = applyCapture(clock, state, "char_reiner_braun", "paradis");
    expect(inheritProblem(quiet, caught, pol, "shifter_cuirasse", "char_mikasa_ackerman", false)).toBeNull();
    const slot = caught.titans["shifter_cuirasse"] as ShiftersState["titans"][string];
    expect(yearsLeft(quiet, slot, s0.date).value).toBe(yearsLeft(quiet, state.titans["shifter_cuirasse"] as typeof slot, s0.date).value);
    // L'héritage réel : Reiner dévoré, Mikasa porteuse, 13 ans neufs ; le suivi s'aligne.
    let s: GameState = { ...s0, shifters: { ...caught, serum: 1 } };
    s = applyCommand(s, { type: "InheritTitan", shifter: "shifter_cuirasse", heir: "char_mikasa_ackerman" }, undefined, quiet);
    const sync = syncBearers(clock, sh(s));
    expect(sync.removed).toEqual(["char_reiner_braun"]);
    expect(sync.unregistered.map((u) => u.holder)).toContain("char_mikasa_ackerman");
    expect(nineViolations(sh(s), cb, (c) => s.politics?.characters[c]?.alive !== false)).toEqual([]);
    const mk = registerBearer(sync.state, input("char_mikasa_ackerman", { faction: "paradis", role: "connu" }), cb);
    expect(rosterOf(mk, sh(s), "paradis", s.date.year, 13, cb).find((r) => r.bearer === "char_mikasa_ackerman")?.yearsLeft).toBe(13);
  });
});
