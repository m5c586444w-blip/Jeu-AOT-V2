import { describe, expect, it } from "vitest";
import { battleHash, createBattle, runBattle, stepBattle } from "../../src/sim/tactical/battle";
import type { Battle } from "../../src/sim/tactical/battle";
import { cutShifter, damageShifter, throwSpear } from "../../src/sim/tactical/shifters";
import { skirmishSetup } from "../../src/sim/tactical/setup";
import type { BattleSetup, ShifterSpec, ShifterUnit, TitanUnit } from "../../src/sim/tactical/types";
import { Rng } from "../../src/sim/core/rng";
import fr from "../../src/i18n/fr.json";
import { world } from "./tactical-helpers";

const sb = world.shifters?.balance;
if (!sb) throw new Error("équilibrage des porteurs absent");
const hz = world.tactical?.balance.tick_hz ?? 20;
const dict = fr as Record<string, string>;
const noop = { log: () => undefined, killSoldier: () => undefined };

function setup(shifter: string, side: ShifterSpec["side"], opts: { titans?: { type: string; count: number }[]; n?: number; seed?: number; map?: string; stress?: number; spears?: boolean } = {}): BattleSetup {
  const base = skirmishSetup(world, opts.map ?? "tmap_plaine", opts.titans ?? [], opts.n ?? 12, opts.seed ?? 1, false);
  return { ...base, shifters: [{ shifter, side, name: "Porteur", character: null, stress: opts.stress ?? 20 }], ...(opts.spears ? { thunderSpears: true } : {}) };
}

/** Bataille avancée jusqu'à la transformation du porteur. */
function transformed(s: BattleSetup): { bt: Battle; u: ShifterUnit; body: TitanUnit } {
  const bt = createBattle(world, s);
  for (let i = 0; i < 5 * hz && bt.state.shifters?.[0]?.phase !== "titan"; i++) stepBattle(bt);
  const u = bt.state.shifters?.[0];
  const body = u?.body !== null && u?.body !== undefined ? bt.state.titans[u.body] : undefined;
  if (!u || !body) throw new Error("pas de transformation");
  return { bt, u, body };
}

describe("transformation (AC6-06, F-TIT-04)", () => {
  it("délai de 1 à 3 s, coût d'endurance, corps de Titan ajouté au champ de bataille", () => {
    for (const seed of [1, 2, 3, 4]) {
      const bt = createBattle(world, setup("shifter_assaillant", "allie", { seed, titans: [{ type: "ttype_moyen_errant", count: 2 }] }));
      const e0 = bt.state.shifters?.[0]?.endurance ?? 0;
      let tick = 0;
      while (bt.state.shifters?.[0]?.phase !== "titan") {
        stepBattle(bt);
        tick++;
      }
      expect(tick / hz).toBeGreaterThanOrEqual(sb.transform_delay_s[0]);
      expect(tick / hz).toBeLessThanOrEqual(sb.transform_delay_s[1] + 1 / hz);
      const u = bt.state.shifters?.[0];
      expect(e0 - (u?.endurance ?? 0)).toBeCloseTo(sb.transform_cost, 0);
      expect(bt.state.titans.some((t) => t.shifter === 0 && t.ally && t.alive)).toBe(true);
      expect(bt.state.log.some((l) => l.key === "battle.shifter.transformed")).toBe(true);
    }
  });

  it("endurance à zéro : détransformation (épuisé), pas de nouvelle transformation avant la recharge", () => {
    const { bt, u } = transformed(setup("shifter_assaillant", "allie", { titans: [{ type: "ttype_moyen_errant", count: 3 }] }));
    u.endurance = 0.001;
    stepBattle(bt);
    expect(u.phase).toBe("epuise");
    for (let i = 0; i < (sb.transform_cooldown_s - 1) * hz; i++) stepBattle(bt);
    expect(u.phase).not.toBe("titan");
  });

  it("un porteur ennemi pas encore transformé empêche la victoire, même sans Titan pur", () => {
    const bt = createBattle(world, setup("shifter_feminin", "ennemi", { n: 6 }));
    stepBattle(bt);
    expect(bt.state.ended).toBeNull();
  });
});

describe("points de vie par zones, armure, lances (AC6-05)", () => {
  it("lame contre l'armure durcie : ×0,08 ; lance de foudre : dégâts pleins (perce)", () => {
    const { bt, u } = transformed(setup("shifter_cuirasse", "ennemi"));
    const armor = world.shifters?.defs.get("shifter_cuirasse")?.abilities.find((a) => a.effect === "armor")?.power ?? 1;
    expect(damageShifter(bt, u, "legs", sb.soldiers.cut_damage, { pierce: false, source: "lame" }, noop)).toBeCloseTo(sb.soldiers.cut_damage * armor);
    expect(damageShifter(bt, u, "legs", sb.soldiers.spear_damage, { pierce: true, source: "lance" }, noop)).toBe(sb.soldiers.spear_damage);
  });

  it("un soldat équipé tire ses lances sur un porteur à portée ; la nuque à zéro abat le porteur (vaincu)", () => {
    const { bt, u, body } = transformed(setup("shifter_feminin", "ennemi", { spears: true }));
    const s = bt.state.soldiers[0];
    if (!s) throw new Error("soldat");
    expect(s.spears).toBe(sb.soldiers.spears_per_soldier);
    s.x = body.x + 5;
    s.y = body.y;
    const rng = new Rng(9);
    for (let k = 0; k < 20 && (s.spears ?? 0) > 0; k++) throwSpear(bt, s, body, rng, noop);
    expect(bt.state.stats.spears?.thrown).toBe(sb.soldiers.spears_per_soldier);
    damageShifter(bt, u, "nape", 999, { pierce: true, source: "lance" }, noop);
    expect(u.phase).toBe("vaincu");
    expect(body.alive).toBe(false);
  });

  it("durcissement local : la nuque durcie bloque la lame ; onde de chaleur : aucune coupe possible", () => {
    const fem = transformed(setup("shifter_feminin", "ennemi"));
    fem.u.hardened = 3;
    const nape0 = fem.u.hp.nape;
    expect(damageShifter(fem.bt, fem.u, "nape", sb.soldiers.cut_damage, { pierce: false, source: "lame" }, noop)).toBe(0);
    expect(fem.u.hp.nape).toBe(nape0);
    const col = transformed(setup("shifter_colossal", "ennemi"));
    col.u.active["onde_chaleur"] = 5;
    const s = col.bt.state.soldiers[0];
    if (!s) throw new Error("soldat");
    const hp = { ...col.u.hp };
    cutShifter(col.bt, s, col.body, "nape", new Rng(1), noop);
    expect(col.u.hp).toEqual(hp);
    expect(col.bt.state.stats.abilities?.["onde_chaleur"]?.effect).toBe(1);
  });

  it("régénération : les points de vie reviennent en consommant l'endurance", () => {
    const { bt, u } = transformed(setup("shifter_assaillant", "allie", { titans: [{ type: "ttype_petit_errant", count: 1 }] }));
    u.hp.armL = 1;
    const e0 = u.endurance;
    for (let i = 0; i < 2 * hz; i++) stepBattle(bt);
    expect(u.hp.armL).toBeGreaterThan(1);
    expect(u.endurance).toBeLessThan(e0);
  });
});

describe("perte de contrôle (AC6-06, F-TIT-14)", () => {
  it("sous stress extrême, le porteur finit par perdre le contrôle (crise journalisée) ; jamais à stress nul et sans blessure", () => {
    let crises = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { bt, u } = transformed(setup("shifter_assaillant", "allie", { seed, titans: [{ type: "ttype_moyen_errant", count: 4 }] }));
      for (let i = 0; i < 60 * hz && !bt.state.ended; i++) {
        u.stress = 200;
        stepBattle(bt);
      }
      crises += bt.state.stats.rampages ?? 0;
      if ((bt.state.stats.rampages ?? 0) > 0) expect(bt.state.log.some((l) => l.key === "battle.shifter.rampage")).toBe(true);
    }
    expect(crises).toBeGreaterThan(0);
    const calm = transformed(setup("shifter_assaillant", "allie", { titans: [{ type: "ttype_petit_errant", count: 1 }] }));
    for (let i = 0; i < 30 * hz; i++) {
      calm.u.stress = 0;
      stepBattle(calm.bt);
    }
    expect(calm.bt.state.stats.rampages ?? 0).toBe(0);
  });
});

describe("déterminisme et textes", () => {
  it("même configuration avec porteur et lances → même bataille", () => {
    const s = setup("shifter_cuirasse", "ennemi", { map: "tmap_foret", n: 18, spears: true, seed: 4 });
    expect(battleHash(runBattle(world, s).state)).toBe(battleHash(runBattle(world, s).state));
  });

  it("toutes les clés du journal produites par les porteurs existent en français", () => {
    const keys = new Set<string>();
    for (const [id, side] of [["shifter_feminin", "ennemi"], ["shifter_fondateur", "allie"], ["shifter_assaillant", "allie"], ["shifter_cuirasse", "ennemi"]] as const) {
      const s = { ...setup(id, side, { titans: [{ type: "ttype_moyen_errant", count: 3 }], map: "tmap_foret", n: 18, stress: 95 }), flags: ["royal_contact"] };
      for (const l of runBattle(world, s).state.log) keys.add(l.key);
    }
    for (const k of keys) expect(dict[k], k).toBeTruthy();
    for (const k of ["battle.shifter.transformed", "battle.shifter.defeated", "battle.shifter.exhausted", "battle.shifter.kills_titan", "battle.shifter.rampage", "battle.shifter.founder"]) expect(dict[k], k).toBeTruthy();
  });
});
