import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { replayFactors } from "../../src/sim/core/explain";
import { applyCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState, tickDay } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { deserialize, serialize } from "../../src/sim/core/serialize";
import { blockaded, nationIncome, nationUpkeep, seaHeldBy } from "../../src/sim/world/nations";
import type { NationsState } from "../../src/sim/world/nations";
import fr from "../../src/i18n/fr.json";

const world = loadWorld("data", "scn_854");
const dict = fr as Record<string, string>;
const run = (s: GameState, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, world), s);
const ns = (s: GameState): NationsState => {
  if (!s.nations) throw new Error("monde absent");
  return s.nations;
};
const start = createInitialState(7, world);

describe("départ du scénario 854 (AC7-01)", () => {
  it("morts de 850 et Ymir au départ ; porteurs de 854 ; secrets percés ; drapeaux", () => {
    for (const id of ["char_erwin_smith", "char_hannes", "char_ymir", "char_bertholdt_hoover"]) expect(start.politics?.characters[id]?.alive, id).toBe(false);
    expect(start.politics?.characters["char_hange_zoe"]?.alive).toBe(true);
    expect(start.shifters?.titans["shifter_colossal"]?.holder).toBe("char_armin_arlert");
    expect(start.shifters?.titans["shifter_bestial"]).toMatchObject({ holder: "char_zeke_yeager", faction: "marley" });
    expect(start.intel?.secrets["secret_reiner_braun"]?.revealed).toBe(true);
    expect(start.intel?.secrets["secret_pieck_finger"]?.revealed).toBe(false);
    expect(start.events?.flags["historia_queen"]).toBe(true);
    expect(ns(start).wars).toEqual(["fac_allies|fac_marley"]);
    expect(ns(start).player).toBe("fac_paradis");
  });

  it("jouer Marley : choix de la nation au départ seulement", () => {
    expect(ns(run(start, { type: "SetPlayerFaction", faction: "fac_marley" })).player).toBe("fac_marley");
    expect(() => run(start, { type: "SetPlayerFaction", faction: "fac_hizuru" })).toThrow("world.err.not_playable");
    const later = run(start, { type: "AdvanceDays", n: 1 });
    expect(() => run(later, { type: "SetPlayerFaction", faction: "fac_marley" })).toThrow("world.err.too_late");
  });
});

describe("économie de guerre (T7.2)", () => {
  it("revenus et entretien expliqués, valeur = rejeu des facteurs ; clés en français", () => {
    for (const f of ["fac_marley", "fac_allies", "fac_hizuru", "fac_paradis"]) {
      const inc = nationIncome(world, ns(start), f, start.strategic);
      for (const e of [inc.industry, inc.manpower, nationUpkeep(world, ns(start), f)]) {
        expect(replayFactors(e.factors)).toBeCloseTo(e.value);
        for (const x of e.factors) expect(dict[x.key], x.key).toBeTruthy();
      }
    }
    expect(nationIncome(world, ns(start), "fac_marley", start.strategic).industry.value).toBeGreaterThan(nationIncome(world, ns(start), "fac_hizuru", start.strategic).industry.value);
  });

  it("un mois : revenus moins entretien ; lever une formation coûte, prend des jours, puis la place sur sa province", () => {
    const m = run(start, { type: "SetPlayerFaction", faction: "fac_marley" });
    const before = ns(m).nations["fac_marley"]?.industry ?? 0;
    const built = run(m, { type: "BuildFormation", formation: "form_artillerie", province: "wprov_liberio", count: 2 });
    expect(ns(built).nations["fac_marley"]?.industry).toBe(before - 80);
    expect(ns(built).forces["wprov_liberio"]?.["form_artillerie"]).toBeUndefined();
    const later = run(built, { type: "AdvanceDays", n: 46 });
    expect(ns(later).forces["wprov_liberio"]?.["form_artillerie"]?.count).toBe(2);
    expect(ns(later).log.some((l) => l.key === "world.log.built")).toBe(true);
    expect(() => run(m, { type: "BuildFormation", formation: "form_blindes", province: "wprov_liberio", count: 1 })).toThrow("world.err.disabled");
    expect(() => run(m, { type: "BuildFormation", formation: "form_garde_clan", province: "wprov_liberio", count: 1 })).toThrow("world.err.not_ours");
    expect(() => run(m, { type: "BuildFormation", formation: "form_cuirasses", province: "wprov_capitale_marley", count: 1 })).toThrow("world.err.not_port");
  });

  it("mouvements : terre par la terre, une fois par semaine hors rail ; embarquer exige des transports ; pas d'entrée chez un neutre", () => {
    const m = run(start, { type: "SetPlayerFaction", faction: "fac_marley" });
    expect(() => run(m, { type: "MoveFormation", formation: "form_troupes_coloniales", from: "wprov_colonies_sud", to: "wprov_ocean_ouest", count: 1 })).toThrow("world.err.no_transport");
    // Fort Slava → Forteresse du Passage (Alliés, en guerre) : permis ; une seule fois par semaine hors du rail.
    const once = run(m, { type: "MoveFormation", formation: "form_infanterie_ligne", from: "wprov_fort_slava", to: "wprov_forteresse_passage", count: 2 });
    expect(ns(once).forces["wprov_forteresse_passage"]?.["form_infanterie_ligne"]?.count).toBe(2);
    expect(() => run(once, { type: "MoveFormation", formation: "form_infanterie_ligne", from: "wprov_forteresse_passage", to: "wprov_haut_plateau", count: 1 })).toThrow("world.err.no_moves");
    expect(() => run(m, { type: "MoveFormation", formation: "form_infanterie_ligne", from: "wprov_fort_slava", to: "wprov_capitale_marley", count: 1 })).toThrow("world.err.not_adjacent");
    // En paix, on n'entre pas chez l'autre.
    const peace = { ...m, nations: { ...ns(m), wars: [] } };
    expect(() => run(peace, { type: "MoveFormation", formation: "form_infanterie_ligne", from: "wprov_fort_slava", to: "wprov_forteresse_passage", count: 1 })).toThrow("world.err.not_at_war");
  });
});

describe("blocus et sauvegarde", () => {
  it("une flotte ennemie qui tient toutes les mers d'une côte la met sous blocus : l'industrie côtière baisse", () => {
    const s = structuredClone(ns(start));
    s.forces["wprov_detroit_slava"] = { form_navires_coalition: { count: 10, strength: 1, moves: 0 } };
    expect(seaHeldBy(world, s, "wprov_detroit_slava")).toBe("fac_allies");
    expect(blockaded(world, s, "wprov_fort_slava", "fac_marley")).toBe(true);
    const a = nationIncome(world, ns(start), "fac_marley", start.strategic).industry;
    const b = nationIncome(world, s, "fac_marley", start.strategic).industry;
    expect(b.value).toBeLessThan(a.value);
    expect(b.factors.some((f) => f.key === "why.world_blockade")).toBe(true);
  });

  it("v7 → v8 : la couche est recréée au premier jour simulé ; aller-retour sans perte", () => {
    const s = run(start, { type: "AdvanceDays", n: 10 });
    const raw = JSON.parse(serialize(s)) as Record<string, unknown>;
    delete raw["nations"];
    raw["schemaVersion"] = 7;
    const migrated = deserialize(JSON.stringify(raw));
    expect(migrated.nations).toBeNull();
    expect(tickDay(migrated, world).nations?.wars).toEqual(["fac_allies|fac_marley"]);
    expect(serialize(deserialize(serialize(s)))).toBe(serialize(s));
  });
});
