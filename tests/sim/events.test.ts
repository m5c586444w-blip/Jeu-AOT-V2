import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { applyCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState, tickDay } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { stateHash } from "../../src/sim/core/canonical";
import { deserialize, serialize } from "../../src/sim/core/serialize";
import { predecessorsOf } from "../../src/sim/strategic/world";
import { fromAbsoluteDay } from "../../src/sim/core/time";

const world = loadWorld("data", "scn_sandbox_850");
const cw = world.chronicle;
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, world), s);
const ev = (s: GameState) => {
  if (!s.events) throw new Error("pas d'événements");
  return s.events;
};
/** Avance jour par jour jusqu'à ce qu'un événement soit en attente (ou abandon après `max` jours). */
function untilPending(s: GameState, id: string, max = 400): GameState {
  let x = s;
  for (let i = 0; i < max && !ev(x).pending.some((p) => p.id === id); i++) x = tickDay(x, world);
  if (!ev(x).pending.some((p) => p.id === id)) throw new Error(`${id} jamais en attente`);
  return x;
}

const canonYear = run(createInitialState(42, world), { type: "AdvanceDays", n: 360 });

describe("moteur d'événements : Canon fidèle (AC5-02)", () => {
  it("E09 → E42 surviennent en 850, chacun après son prédécesseur et dans sa fenêtre ; aucune divergence", () => {
    const h = ev(canonYear).history;
    for (const e of cw?.canon ?? []) {
      const r = h[e.id];
      expect(r?.status, e.id).toBe("survenu");
      for (const p of predecessorsOf(e)) {
        const pr = h[p];
        if (pr?.status !== "survenu") continue;
        const [lo, hi] = e.window.within_days ?? [0, 0];
        // Le jour d'un événement est compté depuis la fin de son prédécesseur (choix fait ou échéance).
        expect((r?.day ?? 0) - pr.day, `${e.id} après ${p}`).toBeGreaterThanOrEqual(lo);
        expect((r?.day ?? 0) - pr.day, `${e.id} après ${p}`).toBeLessThanOrEqual(hi + (world.chronicle?.balance.deadline_days ?? 0));
      }
      expect(r?.choice ?? null, e.id).toBe(e.choices.find((c) => c.historical)?.id ?? null);
    }
    expect(ev(canonYear).divergence).toBe(0);
    expect(ev(canonYear).branch).toBe("canon");
    for (const e of cw?.canon ?? []) expect(fromAbsoluteDay(h[e.id]?.day ?? 0).year, e.id).toBe(850);
  });

  it("chaque mort canon a lieu le jour de son événement, et personne d'autre ne meurt par un événement", () => {
    const pol = canonYear.politics;
    const h = ev(canonYear).history;
    const deaths = Object.entries(pol?.characters ?? {}).filter(([, c]) => !c.alive);
    expect(deaths.map(([id]) => id).sort()).toEqual(["char_bertholdt_hoover", "char_eld", "char_erwin_smith", "char_gelgar", "char_gunther", "char_hannes", "char_kenny_ackerman", "char_mike_zacharias", "char_nanaba", "char_oluo", "char_petra", "char_rod_reiss"]);
    for (const [id, c] of deaths) {
      const evt = world.politics?.characters.get(id)?.death_event ?? "";
      const r = h[evt];
      // Mort au déclenchement (effets) ou au choix (choix historique) de son événement.
      const fired = ev(canonYear).chronicle.filter((x) => x.event === evt).map((x) => x.day);
      expect(fired, id).toContain(r?.day ?? -1);
      expect(c.death?.date.year).toBe(850);
    }
  });

  it("révélations : les six secrets sont révélés par E12, E22 et E27 ; deux Titans capturés à Trost (E11)", () => {
    for (const s of Object.values(canonYear.intel?.secrets ?? {})) expect(s.revealed).toBe(true);
    expect(canonYear.research?.captured).toBe(2);
  });
});

describe("choix, échéance, coûts (AC5-03)", () => {
  const atE09 = untilPending(createInitialState(42, world), "evt_850_104th_graduation");
  it("un événement à choix attend, avec une alerte qui met en pause ; à l'échéance, le choix historique s'applique", () => {
    expect(atE09.strategic?.log.some((l) => l.key === "log.event_pending" && l.pause)).toBe(true);
    expect(ev(atE09).pending.some((p) => p.id === "evt_850_104th_graduation")).toBe(true);
    let s = atE09;
    for (let i = 0; i <= (world.chronicle?.balance.deadline_days ?? 5); i++) s = tickDay(s, world);
    const r = ev(s).history["evt_850_104th_graduation"];
    expect(r?.auto).toBe(true);
    expect(r?.choice).toBe("corps");
    expect(s.strategic?.log.some((l) => l.key === "log.event_auto")).toBe(true);
  });
  it("le choix du joueur applique ses effets et sa part de divergence ; un choix non offert est refusé", () => {
    const loyal = atE09.politics?.orgs["org_military_police"]?.loyalty ?? 0;
    const s = run(atE09, { type: "ChooseEventOption", event: "evt_850_104th_graduation", choice: "brigade" });
    expect(s.politics?.orgs["org_military_police"]?.loyalty).toBeCloseTo(Math.min(100, loyal + 4), 6);
    const e = cw?.events.get("evt_850_104th_graduation");
    expect(ev(s).divergence).toBeCloseTo((e?.divergence_weight ?? 0) * 0.3, 9);
    expect(() => run(atE09, { type: "ChooseEventOption", event: "evt_850_104th_graduation", choice: "inexistant" })).toThrow();
  });
});

describe("divergence (AC5-04)", () => {
  it("retenir Eren à E12 : E13 est évité, et toute la suite avec lui ; la partie bascule ; l'état diffère du canon", () => {
    let s = untilPending(createInitialState(42, world), "evt_850_eren_first_transformation");
    s = run(s, { type: "ChooseEventOption", event: "evt_850_eren_first_transformation", choice: "retenir" }, { type: "AdvanceDays", n: 360 - (s.date.day - 1) });
    const h = ev(s).history;
    expect(h["evt_850_trost_plug"]?.status).toBe("evite");
    expect(h["evt_850_eren_trial"]?.status).toBe("evite");
    expect(h["evt_850_serum_choice"]?.status).toBe("evite");
    expect(ev(s).branch).toBe("divergente");
    expect(ev(s).divergence).toBeGreaterThan(world.chronicle?.balance.divergence_threshold ?? 0);
    expect(s.strategic?.log.some((l) => l.key === "log.branch_divergent")).toBe(true);
    // La brèche de Trost n'a jamais été bouchée ; Erwin, Mike et Hannes sont en vie.
    expect(s.strategic?.provinces["prov_rose_sud"]?.wall_structure).toBeLessThan(canonYear.strategic?.provinces["prov_rose_sud"]?.wall_structure ?? 0);
    for (const who of ["char_erwin_smith", "char_mike_zacharias", "char_hannes"]) expect(s.politics?.characters[who]?.alive, who).toBe(true);
  });

  it("abandonner Trost à E13 : la province passe aux Titans, la chronique continue autrement", () => {
    let s = untilPending(createInitialState(42, world), "evt_850_trost_plug");
    s = run(s, { type: "ChooseEventOption", event: "evt_850_trost_plug", choice: "abandonner" }, { type: "AdvanceDays", n: 30 });
    expect(s.strategic?.provinces["prov_trost"]?.control).toBe("titans");
    expect(ev(s).flags["trost_lost"]).toBe(true);
    expect(ev(s).divergence).toBeGreaterThan(0);
  });

  it("le renseignement change la suite (AC5-08) : une preuve contre Annie avant E21 ouvre l'arrestation discrète", () => {
    let s = untilPending(createInitialState(42, world), "evt_850_stohess_capture");
    expect(() => run(s, { type: "ChooseEventOption", event: "evt_850_stohess_capture", choice: "arrestation_discrete" })).toThrow();
    const intel = structuredClone(s.intel);
    const sec = intel?.secrets["secret_annie_leonhart"];
    if (!intel || !sec) throw new Error("secret absent");
    sec.evidence = 4;
    sec.certainty = "preuve";
    s = run({ ...s, intel }, { type: "ChooseEventOption", event: "evt_850_stohess_capture", choice: "arrestation_discrete" });
    expect(ev(s).flags["annie_arrested_quietly"]).toBe(true);
    expect(ev(s).history["evt_850_stohess_capture"]?.choice).toBe("arrestation_discrete");
  });
});

describe("déterminisme et sauvegarde (AC5-09)", () => {
  it("même graine = même chronique ; aller-retour de sauvegarde au milieu d'une attente, puis même suite", () => {
    const a = run(createInitialState(9, world), { type: "AdvanceDays", n: 120 });
    const b = run(createInitialState(9, world), { type: "AdvanceDays", n: 120 });
    expect(stateHash(a)).toBe(stateHash(b));
    const back = deserialize(serialize(a));
    expect(stateHash(run(back, { type: "AdvanceDays", n: 40 }))).toBe(stateHash(run(a, { type: "AdvanceDays", n: 40 })));
  });
});
