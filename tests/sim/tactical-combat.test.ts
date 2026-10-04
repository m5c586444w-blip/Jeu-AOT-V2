import { describe, expect, it } from "vitest";
import { Rng } from "../../src/sim/core/rng";
import { battleHash, runBattle, tryCut } from "../../src/sim/tactical/battle";
import { skirmishSetup } from "../../src/sim/tactical/setup";
import { BATTLE_DEATH_CAUSES } from "../../src/sim/tactical/types";
import { hasKey } from "../../src/i18n";
import { battle, tb, world } from "./tactical-helpers";

describe("coupe et lames (AC4-04, 03 §4.2)", () => {
  it("chaque coupe use la lame ; une lame cassée se change en 1,5 s ; une nuque tranchée tue", () => {
    const bt = battle("tmap_foret", "ttype_petit_errant");
    const s = bt.state.soldiers[0];
    const t = bt.state.titans[0];
    if (!s || !t) throw new Error();
    const rng = new Rng(5);
    let broke = false;
    for (let k = 0; k < 40 && t.alive; k++) {
      const before = s.wear;
      const pairs = s.pairs;
      tryCut(bt, s, t, rng);
      if (s.pairs < pairs) {
        broke = true;
        expect(s.changeTimer).toBe(tb.cut.change_blades_s);
        expect(s.wear).toBe(0);
      } else if (t.alive) expect(s.wear).toBeGreaterThan(before);
    }
    expect(t.alive || bt.state.stats.napes === 1).toBe(true);
    expect(broke || !t.alive).toBe(true);
  });

  it("sur 30 batailles, tout Titan mort l'a été par une coupe de nuque", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = runBattle(world, skirmishSetup(world, "tmap_ville", [{ type: "ttype_moyen_errant", count: 2 }], 12, seed));
      const killed = Object.values(r.state.stats.titansKilled).reduce((a, b) => a + b, 0);
      expect(killed).toBe(r.state.stats.napes);
      expect(r.state.titans.filter((t) => !t.alive).length).toBe(killed);
    }
  });
});

describe("déterminisme et journal (AC4-06, AC4-07)", () => {
  it("même graine + mêmes ordres → même bataille ; ordres différents → bataille différente", () => {
    const setup = skirmishSetup(world, "tmap_ville", [{ type: "ttype_grand_errant", count: 2 }], 18, 11);
    const orders = [{ tick: 60, squad: "esc_01", order: "repli" as const }];
    expect(battleHash(runBattle(world, setup, orders).state)).toBe(battleHash(runBattle(world, setup, orders).state));
    expect(battleHash(runBattle(world, setup, orders).state)).not.toBe(battleHash(runBattle(world, setup).state));
  });

  it("chaque mort a son entrée de journal et son dossier (heure, cause, lieu ; Titan pour les frappes et les saisies)", () => {
    let deaths = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = runBattle(world, skirmishSetup(world, "tmap_plaine", [{ type: "ttype_grand_errant", count: 1 }], 12, seed));
      for (const d of r.dead) {
        deaths++;
        expect(d.death).not.toBeNull();
        expect((BATTLE_DEATH_CAUSES as readonly string[]).includes(d.death?.cause ?? "")).toBe(true);
        if (d.death?.cause === "frappe" || d.death?.cause === "devore") expect(d.death.titan).not.toBeNull();
        expect(r.state.log.some((l) => l.key === `battle.death.${d.death?.cause}` && l.params["name"] === d.name)).toBe(true);
      }
      for (const l of r.state.log) expect(hasKey(l.key), l.key).toBe(true);
    }
    expect(deaths).toBeGreaterThan(0);
  });
});
