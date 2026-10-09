import { describe, expect, it } from "vitest";
import { fnv1a } from "../../src/sim/core/hash";
import { battleHash, createBattle, runBattle, stepBattle } from "../../src/sim/tactical/battle";
import { centroid, squadMembers } from "../../src/sim/tactical/realtime";
import { companySetup, sectionsOf, unitCount } from "../../src/sim/tactical/setup";
import type { BattleSetup } from "../../src/sim/tactical/types";
import { w854 } from "./legacy-cases";

/** R2+ (CR2-05) : compagnies, fantassins des deux camps, bataille d'armées sans Titans (dette n° 33). */
const hz = w854.tactical?.balance.tick_hz ?? 20;

const armyBattle = (seed = 5): BattleSetup =>
  companySetup(w854, { map: "tmap_plaine", seed, soldiers: 60, allied: [{ kind: "fusilier", count: 60 }], enemy: [{ kind: "fusilier", count: 90 }, { kind: "mitrailleur", count: 20 }, { kind: "assaut", count: 30 }] });

const bigBattle = (): BattleSetup =>
  companySetup(w854, {
    map: "tmap_ville",
    seed: 9,
    soldiers: 150,
    allied: [{ kind: "fusilier", count: 60 }],
    enemy: [{ kind: "fusilier", count: 120 }, { kind: "mitrailleur", count: 30 }],
    titans: [{ type: "ttype_grand_errant", count: 3 }, { type: "ttype_moyen_errant", count: 3 }],
    artillery: [
      { id: "bat_a", piece: "art_canon_campagne", munition: "mun_mitraille", side: "allie", count: 4 },
      { id: "bat_e", piece: "art_marley_campagne", munition: "mun_shrapnel", side: "ennemi", count: 4 },
    ],
  });

describe("Sections et compagnies", () => {
  it("découpe en sections d'au plus 30 hommes, identifiants stables, effectifs conservés", () => {
    const s = sectionsOf("ennemi", [{ kind: "fusilier", count: 95 }, { kind: "mitrailleur", count: 20 }], "fac_marley");
    expect(s.map((x) => x.count)).toEqual([24, 24, 24, 23, 20]);
    expect(s.map((x) => x.id)).toEqual(["sec_e01", "sec_e02", "sec_e03", "sec_e04", "sec_e05"]);
    expect(s.every((x) => x.side === "ennemi" && x.faction === "fac_marley")).toBe(true);
  });

  it("100 à 400 unités en scène ; le pas de simulation tient dans le budget du fil de l'interface", () => {
    const setup = bigBattle();
    const n = unitCount(setup);
    expect(n).toBeGreaterThanOrEqual(100);
    expect(n).toBeLessThanOrEqual(400);
    const bt = createBattle(w854, setup);
    expect(bt.state.troops?.length).toBe(210);
    expect(bt.state.squads.filter((x) => x.side).length).toBe(7);
    const t0 = performance.now();
    for (let i = 0; i < 30 * hz && !bt.state.ended; i++) stepBattle(bt);
    const perTick = (performance.now() - t0) / (30 * hz);
    // Mesure sur la machine de test (valeur indicative) : bien en deçà des 50 ms d'un pas à 20 Hz.
    expect(perTick).toBeLessThan(10);
    const tr = bt.state.stats.troops;
    expect(tr?.byTitans ?? 0).toBeGreaterThan(0);
    expect(tr?.byArtillery ?? 0).toBeGreaterThan(0);
    expect(tr?.shots ?? 0).toBeGreaterThan(0);
  });
});

describe("Bataille d'armées sans Titans (CR2-05, dette n° 33)", () => {
  it("les deux camps tirent et tombent ; mêlée des soldats ; déroutes ; fin de bataille", () => {
    const setup = armyBattle();
    const bt0 = createBattle(w854, setup);
    stepBattle(bt0);
    // Sans Titan, la bataille ne s'arrête pas au premier pas (les fantassins ennemis sont debout).
    expect(bt0.state.ended).toBeNull();
    const r = runBattle(w854, setup, []);
    const tr = r.state.stats.troops;
    expect(tr?.shots ?? 0).toBeGreaterThan(100);
    expect(tr?.deadEnemy ?? 0).toBeGreaterThan(0);
    expect((tr?.deadAllied ?? 0) + r.dead.length).toBeGreaterThan(0);
    expect(tr?.melee ?? 0).toBeGreaterThan(0);
    expect(tr?.routs ?? 0).toBeGreaterThan(0);
    expect(r.state.stats.deathsByCause.balle ?? 0).toBeGreaterThan(0);
    expect(["victoire", "defaite", "repli", "temps"]).toContain(r.state.ended?.reason);
    expect(r.state.troops?.filter((t) => t.mode === "mort").every((t) => t.death !== null)).toBe(true);
  });

  it("déterminisme : même graine et mêmes ordres = même hash ; graine différente = autre bataille", () => {
    const orders = [{ tick: 10, squad: "sec_a01", order: "deplacer" as const, x: 120, y: 200, formation: "ligne" as const }, { tick: 10, squad: "sec_a01", order: "tuer" as const, queue: true }];
    const a = runBattle(w854, armyBattle(), orders);
    const b = runBattle(w854, armyBattle(), orders);
    expect(fnv1a(JSON.stringify(a.state))).toBe(fnv1a(JSON.stringify(b.state)));
    expect(battleHash(a.state)).toBe(battleHash(b.state));
    expect(fnv1a(JSON.stringify(runBattle(w854, armyBattle(6), orders).state))).not.toBe(fnv1a(JSON.stringify(a.state)));
  });

  it("les sections de Paradis obéissent aux ordres (section entière et fantassin seul)", () => {
    const bt = createBattle(w854, companySetup(w854, { map: "tmap_plaine", seed: 3, soldiers: 12, allied: [{ kind: "fusilier", count: 20 }], enemy: [{ kind: "fusilier", count: 10 }] }));
    const sec = bt.state.squads.find((x) => x.id === "sec_a01");
    expect(sec?.order).toBe("tenir");
    const lone = bt.state.troops?.find((t) => t.section === "sec_a01");
    const orders = [
      { tick: 0, squad: "sec_a01", order: "deplacer" as const, x: 300, y: 250, formation: "colonne" as const },
      { tick: 1, squad: "sec_a01", order: "deplacer" as const, unit: lone?.id ?? 0, x: 60, y: 260 },
    ];
    for (let i = 0; i < 90 * hz && !bt.state.ended; i++) stepBattle(bt, orders.filter((o) => o.tick === bt.state.tick));
    const up = squadMembers(bt, sec as NonNullable<typeof sec>).filter((m) => m !== lone);
    if (up.length > 3) {
      const c = centroid(up) ?? { x: 0, y: 0 };
      expect(Math.hypot(c.x - 300, c.y - 250)).toBeLessThan(25);
    }
    if (lone && lone.mode !== "mort") expect(Math.hypot(lone.x - 60, lone.y - 260)).toBeLessThan(4);
  });

  it("un porteur allié dont l'objectif est « les fantassins » frappe les sections ennemies", () => {
    const setup = companySetup(w854, { map: "tmap_plaine", seed: 4, soldiers: 12, enemy: [{ kind: "fusilier", count: 60 }], shifters: [{ shifter: "shifter_assaillant", side: "allie", name: "Porteur", character: null, stress: 5 }] });
    const bt = createBattle(w854, setup);
    // Section ennemie déjà au contact, devant le porteur (l'essai porte sur le choix des cibles, pas sur l'approche).
    const u = bt.state.shifters?.[0];
    bt.state.troops?.forEach((t, k) => {
      t.x = (u?.x ?? 200) - 30 + (k % 10) * 6;
      t.y = (u?.y ?? 280) - 40 - Math.floor(k / 10) * 3;
    });
    const hold = bt.state.squads.filter((x) => !x.side).map((x) => ({ tick: 0, squad: x.id, order: "tenir" as const }));
    const orders = [...hold, { tick: 1, squad: "porteurs", order: "porteur" as const, unit: 0, objective: "troupes" as const, restraint: "libre" as const }];
    for (let i = 0; i < 60 * hz && !bt.state.ended; i++) stepBattle(bt, orders.filter((o) => o.tick === bt.state.tick));
    expect(bt.state.troops?.filter((t) => t.side === "ennemi" && t.death?.cause === "frappe").length ?? 0).toBeGreaterThan(0);
    // Un ordre donné à une section ennemie est sans effet.
    const bt2 = createBattle(w854, setup);
    stepBattle(bt2, [{ tick: 0, squad: "sec_e01", order: "repli" }]);
    expect(bt2.state.squads.find((x) => x.id === "sec_e01")?.order).toBe("tuer");
  });
});
