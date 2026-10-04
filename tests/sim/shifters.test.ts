import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { replayFactors } from "../../src/sim/core/explain";
import { applyCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState, tickDay } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { deserialize, serialize } from "../../src/sim/core/serialize";
import { founderLock, inheritCosts, yearsLeft } from "../../src/sim/shifters/shifters";
import type { ShiftersState } from "../../src/sim/shifters/shifters";
import fr from "../../src/i18n/fr.json";

const world = loadWorld("data", "scn_sandbox_850");
/** Sans chronologie : seules nos commandes font l'histoire. */
const quiet = { ...world, chronicle: null };
const dict = fr as Record<string, string>;
const run = (s: GameState, w: typeof world, ...cmds: Command[]): GameState => cmds.reduce((x, c) => applyCommand(x, c, undefined, w), s);
const sh = (s: GameState): ShiftersState => {
  if (!s.shifters) throw new Error("couche shifters absente");
  return s.shifters;
};
const withShifters = (s: GameState, f: (x: ShiftersState) => void): GameState => {
  const next = structuredClone(sh(s));
  f(next);
  return { ...s, shifters: next };
};

describe("horloge des 13 ans (AC6-02, F-TIT-03)", () => {
  const s0 = createInitialState(1, quiet);
  it("années restantes des porteurs de 850, expliquées (13 − années écoulées)", () => {
    const left = (id: string) => yearsLeft(quiet, sh(s0).titans[id] ?? { holder: null, faction: "perdu", since: 0, sinceCanon: "?", captured: false, retired: false, visions: 0 }, s0.date);
    expect(s0.date.year).toBe(850);
    expect(left("shifter_assaillant").value).toBe(8);
    expect(left("shifter_fondateur").value).toBe(8);
    expect(left("shifter_machoire").value).toBe(8);
    expect(left("shifter_cuirasse").value).toBe(6);
    expect(left("shifter_bestial").value).toBe(5);
    const e = left("shifter_assaillant");
    expect(replayFactors(e.factors)).toBe(e.value);
    for (const f of e.factors) expect(dict[f.key], f.key).toBeTruthy();
  });

  it("à l'échéance, le porteur meurt de la malédiction et le pouvoir sort du jeu", () => {
    // Eren aurait hérité en 838 : ses 13 ans s'achèvent au 1er jour de 851.
    let s = withShifters(s0, (x) => {
      const a = x.titans["shifter_assaillant"];
      if (a) a.since = 838;
    });
    s = run(s, quiet, { type: "AdvanceDays", n: 360 - (s.date.day - 1) - 1 });
    expect(s.politics?.characters["char_eren_yeager"]?.alive).toBe(true);
    s = run(s, quiet, { type: "AdvanceDays", n: 1 });
    expect(s.date).toEqual({ year: 851, day: 1 });
    const eren = s.politics?.characters["char_eren_yeager"];
    expect(eren?.alive).toBe(false);
    expect(eren?.death?.cause).toBe("malediction");
    // Ses deux Titans (Assaillant et Fondateur) partent à des nouveau-nés.
    expect(sh(s).titans["shifter_assaillant"]?.faction).toBe("perdu");
    expect(sh(s).titans["shifter_fondateur"]?.faction).toBe("perdu");
    expect(sh(s).history.filter((h) => h.kind === "hasard").map((h) => h.shifter).sort()).toEqual(["shifter_assaillant", "shifter_fondateur"]);
  });

  it("un Titan de Marley sans porteur nommé est relayé à l'échéance (nouvel héritier, horloge à 13 ans)", () => {
    let s = withShifters(s0, (x) => {
      // Porteur de Marley sans fiche (cas des Titans dont le porteur n'est pas un personnage).
      const b = x.titans["shifter_bestial"];
      if (b) {
        b.since = 838;
        b.holder = null;
      }
    });
    s = run(s, quiet, { type: "AdvanceDays", n: 360 - (s.date.day - 1) });
    expect(sh(s).titans["shifter_bestial"]).toMatchObject({ faction: "marley", since: 851, holder: null });
    expect(sh(s).history.some((h) => h.kind === "relais_marley" && h.shifter === "shifter_bestial")).toBe(true);
  });
});

describe("mourir ou transmettre (AC6-03, F-TIT-05)", () => {
  const s0 = createInitialState(1, quiet);
  it("mort sans ingestion : le pouvoir passe à un nouveau-né eldien au hasard, hors du jeu", () => {
    let s = run(s0, quiet, { type: "CharacterDies", character: "char_ymir", cause: "combat" }, { type: "AdvanceDays", n: 1 });
    expect(sh(s).titans["shifter_machoire"]).toMatchObject({ holder: null, faction: "perdu" });
    const rec = sh(s).history.at(-1);
    expect(rec).toMatchObject({ kind: "hasard", from: "char_ymir", to: null, shifter: "shifter_machoire" });
    expect(s.strategic?.log.some((l) => l.key === "log.shifter.lost")).toBe(true);
    // Plus rien à hériter : un héritage préparé est refusé, raison affichée.
    s = withShifters(s, (x) => void (x.serum = 1));
    expect(() => run(s, quiet, { type: "InheritTitan", shifter: "shifter_machoire", heir: "char_mikasa_ackerman" })).toThrow("shifter.err.no_holder");
  });

  it("héritage préparé : porteur capturé + sérum + héritier vivant → l'héritier dévore le porteur et reçoit 13 ans", () => {
    let s = withShifters(s0, (x) => {
      x.serum = 1;
      const c = x.titans["shifter_cuirasse"];
      if (c) c.captured = true;
    });
    s = run(s, quiet, { type: "InheritTitan", shifter: "shifter_cuirasse", heir: "char_mikasa_ackerman" });
    const slot = sh(s).titans["shifter_cuirasse"];
    expect(slot).toMatchObject({ holder: "char_mikasa_ackerman", faction: "paradis", since: 850, captured: false });
    if (!slot) throw new Error("emplacement");
    expect(yearsLeft(quiet, slot, s.date).value).toBe(13);
    expect(s.politics?.characters["char_reiner_braun"]?.alive).toBe(false);
    expect(s.politics?.characters["char_reiner_braun"]?.death?.cause).toBe("devore");
    expect(sh(s).serum).toBe(0);
    expect(sh(s).history.at(-1)).toMatchObject({ kind: "prepare", from: "char_reiner_braun", to: "char_mikasa_ackerman" });
  });

  it("refus expliqués : sans sérum, porteur hors de portée, héritier mort ; RetireShifter réservé aux porteurs de Paradis", () => {
    const captured = withShifters(s0, (x) => {
      const c = x.titans["shifter_cuirasse"];
      if (c) c.captured = true;
    });
    expect(() => run(captured, quiet, { type: "InheritTitan", shifter: "shifter_cuirasse", heir: "char_mikasa_ackerman" })).toThrow("shifter.err.no_serum");
    const serum = withShifters(s0, (x) => void (x.serum = 1));
    expect(() => run(serum, quiet, { type: "InheritTitan", shifter: "shifter_cuirasse", heir: "char_mikasa_ackerman" })).toThrow("shifter.err.not_held");
    const dead = run(captured, quiet, { type: "CharacterDies", character: "char_mikasa_ackerman", cause: "combat" });
    expect(() => run(withShifters(dead, (x) => void (x.serum = 1)), quiet, { type: "InheritTitan", shifter: "shifter_cuirasse", heir: "char_mikasa_ackerman" })).toThrow("shifter.err.heir_dead");
    for (const k of ["shifter.err.no_serum", "shifter.err.not_held", "shifter.err.heir_dead", "shifter.err.no_holder", "shifter.err.not_ours"]) expect(dict[k], k).toBeTruthy();
    const retired = run(s0, quiet, { type: "RetireShifter", shifter: "shifter_assaillant", retired: true });
    expect(sh(retired).titans["shifter_assaillant"]?.retired).toBe(true);
    expect(() => run(s0, quiet, { type: "RetireShifter", shifter: "shifter_cuirasse", retired: true })).toThrow("shifter.err.not_ours");
  });

  it("E42 (Canon fidèle) : Armin hérite du Colossal en dévorant Bertholdt ; le sérum de Kenny (E35) est consommé", () => {
    const s = run(createInitialState(42, world), world, { type: "AdvanceDays", n: 360 });
    expect(s.events?.history["evt_850_serum_choice"]?.choice).toBe("armin");
    expect(sh(s).titans["shifter_colossal"]).toMatchObject({ holder: "char_armin_arlert", faction: "paradis", since: 850, sinceCanon: "C" });
    expect(s.politics?.characters["char_bertholdt_hoover"]?.death?.cause).toBe("devore");
    expect(s.politics?.characters["char_erwin_smith"]?.alive).toBe(false);
    expect(sh(s).serum).toBe(0);
    // Ymir est partie avec Reiner et Bertholdt (E28) : la Mâchoire n'est plus à Paradis.
    expect(sh(s).titans["shifter_machoire"]?.faction).toBe("marley");
  });
});

describe("coût systémique de l'héritage (AC6-04)", () => {
  it("sérum, porteur dévoré, horloge, stress de l'héritier et des proches, loyauté de son corps, légitimité : prévus puis appliqués", () => {
    const base = withShifters(createInitialState(1, quiet), (x) => {
      x.serum = 1;
      const c = x.titans["shifter_cuirasse"];
      if (c) c.captured = true;
    });
    const b = quiet.shifters?.balance.inheritance;
    if (!b || !base.politics) throw new Error("données");
    const costs = inheritCosts(quiet, sh(base), base.politics, "shifter_cuirasse", "char_levi_ackerman");
    const keys = costs.map((c) => c.key);
    for (const k of ["shifter.csq_devoured", "shifter.csq_serum", "shifter.csq_clock", "shifter.csq_heir_stress", "shifter.csq_org", "shifter.csq_legitimacy"]) expect(keys, k).toContain(k);
    for (const k of new Set(keys)) expect(dict[k], k).toBeTruthy();
    const close = costs.filter((c) => c.key === "shifter.csq_close").map((c) => String(c.params["who"]));
    // Proches de Levi (relations des données) : Erwin, l'escouade spéciale.
    expect(close).toContain("Erwin Smith");
    const after = run(base, quiet, { type: "InheritTitan", shifter: "shifter_cuirasse", heir: "char_levi_ackerman" });
    const p0 = base.politics;
    const p1 = after.politics;
    if (!p1) throw new Error("politique");
    expect(p1.characters["char_levi_ackerman"]?.stress ?? 0).toBeGreaterThan(p0.characters["char_levi_ackerman"]?.stress ?? 0);
    const org = quiet.politics?.characters.get("char_levi_ackerman")?.org ?? "";
    expect(p1.orgs[org]?.loyalty).toBeLessThan(p0.orgs[org]?.loyalty ?? 0);
    expect(p1.legitimacy).toBeLessThan(p0.legitimacy);
    // Le dossier d'héritage garde les conséquences prévues, à l'identique.
    expect(sh(after).history.at(-1)?.consequences).toEqual(costs);
  });
});

describe("visions et Fondation (AC6-07, F-TIT-06, F-TIT-07)", () => {
  it("visions : rapports de renseignement « rumeur », parfois faux, recoupables", () => {
    let visions = 0;
    let falses = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = run(createInitialState(seed, quiet), quiet, { type: "AdvanceDays", n: 360 });
      const rs = (s.intel?.reports ?? []).filter((r) => r.op === "vision");
      for (const r of rs) {
        expect(r.certainty).toBe("rumeur");
        expect(quiet.provinceById.has(r.target)).toBe(true);
        expect(["char_eren_yeager", "char_ymir"]).toContain(r.agent);
      }
      visions += rs.length;
      falses += rs.filter((r) => r.false).length;
    }
    expect(visions).toBeGreaterThan(10);
    expect(falses).toBeGreaterThan(0);
    expect(falses).toBeLessThan(visions);
    expect(dict["intel.op.vision"]).toBeTruthy();
  });

  it("le contrôle des purs du Fondateur est verrouillé sans contact royal, raison affichée", () => {
    expect(founderLock(quiet, {})).toBe("shifter.lock.royal");
    expect(dict["shifter.lock.royal"]).toBeTruthy();
    expect(founderLock(quiet, { royal_contact: true })).toBeNull();
  });
});

describe("sauvegarde (AC6-08)", () => {
  it("v6 → v7 : la couche est recréée depuis les données au premier jour simulé ; aller-retour sans perte", () => {
    const s = run(createInitialState(3, world), world, { type: "AdvanceDays", n: 20 });
    const raw = JSON.parse(serialize(s)) as Record<string, unknown>;
    delete raw["shifters"];
    raw["schemaVersion"] = 6;
    const migrated = deserialize(JSON.stringify(raw));
    expect(migrated.shifters).toBeNull();
    expect(tickDay(migrated, world).shifters?.titans["shifter_assaillant"]?.holder).toBe("char_eren_yeager");
    expect(serialize(deserialize(serialize(s)))).toBe(serialize(s));
  });
});
