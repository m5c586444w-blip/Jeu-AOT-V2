import { describe, expect, it } from "vitest";
import { fnv1a } from "../../src/sim/core/hash";
import { battleHash, createBattle, runBattle, stepBattle } from "../../src/sim/tactical/battle";
import type { Battle } from "../../src/sim/tactical/battle";
import { centroid, formationOffset, formationSlot, squadMembers, validTimedOrder } from "../../src/sim/tactical/realtime";
import { skirmishSetup } from "../../src/sim/tactical/setup";
import type { BattleSetup, SquadState, TimedOrder } from "../../src/sim/tactical/types";
import { FORMATIONS } from "../../src/sim/tactical/types";
import { w850, w854 } from "./legacy-cases";

/** R2+ (CR2-03, CR2-04) : ordres temps réel. Le Titan de ces essais est immobilisé (jambes et bras coupés en continu). */
const hz = w850.tactical?.balance.tick_hz ?? 20;

function calm(bt: Battle): void {
  for (const t of bt.state.titans) {
    t.legs = 1e9;
    t.armL = 1e9;
    t.armR = 1e9;
    t.x = 200;
    t.y = 10;
  }
}

/** Toutes les escouades tiennent au départ (le Titan immobile n'est pas attaqué) ; puis les ordres de l'essai. */
const holdAll = (bt: Battle): TimedOrder[] => bt.state.squads.map((s) => ({ tick: 0, squad: s.id, order: "tenir" }));

function run(setup: BattleSetup, orders: TimedOrder[], ticks: number, world = w850, keepCalm = true): Battle {
  const bt = createBattle(world, setup);
  if (keepCalm) calm(bt);
  const all = [...holdAll(bt), ...orders];
  for (let i = 0; i < ticks && !bt.state.ended; i++) {
    stepBattle(bt, all.filter((o) => o.tick === bt.state.tick));
    if (keepCalm) calm(bt);
  }
  return bt;
}

const base = (n = 18, seed = 3): BattleSetup => skirmishSetup(w850, "tmap_plaine", [{ type: "ttype_moyen_errant", count: 1 }], n, seed);
const sq = (bt: Battle, id: string): SquadState => {
  const s = bt.state.squads.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};
const center = (bt: Battle, id: string): { x: number; y: number } => centroid(squadMembers(bt, sq(bt, id))) ?? { x: NaN, y: NaN };

describe("Forme des ordres (validTimedOrder)", () => {
  it("accepte les ordres classiques et temps réel, refuse les formes fausses", () => {
    expect(validTimedOrder({ tick: 0, squad: "esc_01", order: "tenir" })).toBe(true);
    expect(validTimedOrder({ tick: 4, squad: "esc_01", order: "deplacer", x: 10, y: 20, formation: "coin", queue: true })).toBe(true);
    expect(validTimedOrder({ tick: 4, squad: "porteurs", order: "porteur", unit: 0, objective: "titans", restraint: "stricte", x: 1, y: 2, r: 50 })).toBe(true);
    expect(validTimedOrder({ tick: 4, squad: "bat_a", order: "tir_zone", x: 1, y: 2 })).toBe(true);
    expect(validTimedOrder({ tick: -1, squad: "esc_01", order: "tenir" })).toBe(false);
    expect(validTimedOrder({ tick: 1, squad: "esc_01", order: "voler" })).toBe(false);
    expect(validTimedOrder({ tick: 1, squad: "esc_01", order: "deplacer", x: "a" })).toBe(false);
    expect(validTimedOrder({ tick: 1, squad: "esc_01", order: "formation", formation: "tortue" })).toBe(false);
    expect(validTimedOrder({ tick: 1, squad: "esc_01", order: "porteur", objective: "tout" })).toBe(false);
  });
});

describe("Formations", () => {
  it("chaque formation donne des places distinctes, centrées, à l'écart voulu", () => {
    for (const f of FORMATIONS) {
      const pts = Array.from({ length: 9 }, (_, k) => formationOffset(f, k, 9));
      const keys = new Set(pts.map((p) => `${p.x.toFixed(2)}:${p.y.toFixed(2)}`));
      expect(keys.size, f).toBe(9);
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i] as { x: number; y: number };
        const b = pts[j] as { x: number; y: number };
        expect(Math.hypot(a.x - b.x, a.y - b.y), f).toBeGreaterThanOrEqual(2.9);
      }
    }
    // Ligne vers le nord (cap −π/2) : front est-ouest, même profondeur.
    const line = Array.from({ length: 5 }, (_, k) => formationSlot("ligne", k, 5, { x: 100, y: 100 }, -Math.PI / 2));
    expect(Math.max(...line.map((p) => Math.abs(p.y - 100)))).toBeLessThan(1e-9);
    expect(Math.max(...line.map((p) => p.x)) - Math.min(...line.map((p) => p.x))).toBeCloseTo(12, 6);
  });
});

describe("Ordres temps réel (CR2-04)", () => {
  it("déplacer : l'escouade marche en formation, arrive, puis tient", () => {
    const bt = run(base(), [{ tick: 1, squad: "esc_01", order: "deplacer", x: 120, y: 200, formation: "ligne" }], 40 * hz);
    const s = sq(bt, "esc_01");
    const c = center(bt, "esc_01");
    expect(Math.hypot(c.x - 120, c.y - 200)).toBeLessThan(3);
    expect(s.order).toBe("tenir");
    expect(s.dest ?? null).toBeNull();
    const ys = squadMembers(bt, s).map((m) => m.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(6);
    expect(bt.state.log.some((l) => l.key === "battle.rt.arrived")).toBe(true);
  });

  it("par unité : un seul soldat part, son escouade reste ; un ordre d'escouade efface l'ordre propre", () => {
    const setup = base();
    const bt0 = createBattle(w850, setup);
    const i = bt0.state.soldiers.findIndex((s) => s.squad === "esc_02");
    const before = center(bt0, "esc_02");
    const bt = run(setup, [{ tick: 1, squad: "esc_02", order: "deplacer", unit: i, x: 300, y: 150 }], 30 * hz);
    const s = bt.state.soldiers[i];
    expect(s && Math.hypot(s.x - 300, s.y - 150)).toBeLessThan(3);
    expect(s?.rt?.order).toBe("tenir");
    const others = squadMembers(bt, sq(bt, "esc_02")).filter((m) => m !== s);
    const c = centroid(others) ?? { x: 0, y: 0 };
    expect(Math.hypot(c.x - before.x, c.y - before.y)).toBeLessThan(60);
    const bt2 = run(setup, [{ tick: 1, squad: "esc_02", order: "deplacer", unit: i, x: 300, y: 150 }, { tick: 2, squad: "esc_02", order: "tenir" }], 3);
    expect(bt2.state.soldiers[i]?.rt).toBeUndefined();
  });

  it("file d'ordres : deux déplacements enchaînés (Maj), le second part à l'arrivée du premier", () => {
    const orders: TimedOrder[] = [
      { tick: 1, squad: "esc_01", order: "deplacer", x: 80, y: 220 },
      { tick: 1, squad: "esc_01", order: "deplacer", x: 320, y: 220, queue: true },
      { tick: 1, squad: "esc_01", order: "tenir", queue: true },
    ];
    const mid = run(base(), orders, 3);
    expect(sq(mid, "esc_01").queue?.length).toBe(2);
    const bt = run(base(), orders, 80 * hz);
    const c = center(bt, "esc_01");
    expect(Math.hypot(c.x - 320, c.y - 220)).toBeLessThan(3);
    expect(sq(bt, "esc_01").order).toBe("tenir");
    expect(bt.state.log.filter((l) => l.key === "battle.rt.arrived").length).toBe(2);
    expect(bt.state.log.some((l) => l.key === "battle.rt.queued")).toBe(true);
  });

  it("suivre : l'escouade suit celle qu'on déplace", () => {
    const bt = run(base(), [{ tick: 1, squad: "esc_02", order: "suivre", follow: "esc_01" }, { tick: 1, squad: "esc_01", order: "deplacer", x: 60, y: 120 }], 45 * hz);
    const a = center(bt, "esc_01");
    const b = center(bt, "esc_02");
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(20);
    expect(sq(bt, "esc_02").order).toBe("suivre");
  });

  it("attaquer, tenir, couvrir, replier : la posture est prise ; le repli lance la fusée verte", () => {
    const orders: TimedOrder[] = [
      { tick: 1, squad: "esc_01", order: "deplacer", x: 100, y: 250 },
      { tick: 2, squad: "esc_01", order: "tuer", target: 0 },
      { tick: 2, squad: "esc_02", order: "deplacer", x: 100, y: 250 },
      { tick: 3, squad: "esc_02", order: "repli" },
      { tick: 2, squad: "esc_03", order: "formation", formation: "carre" },
    ];
    const bt = run(base(), orders, 10);
    expect(sq(bt, "esc_01").order).toBe("tuer");
    expect(bt.state.soldiers.filter((s) => s.squad === "esc_01").every((s) => s.target === 0)).toBe(true);
    expect(sq(bt, "esc_02").order).toBe("repli");
    expect(bt.state.signals.some((x) => x.squad === "esc_02" && x.color === "vert")).toBe(true);
    expect(sq(bt, "esc_03").formation).toBe("carre");
  });

  it("déterminisme : même graine et mêmes ordres temps réel = même hash ; rejeu par runBattle identique au pas à pas", () => {
    const setup = skirmishSetup(w850, "tmap_ville", [{ type: "ttype_moyen_errant", count: 2 }], 24, 21);
    const orders: TimedOrder[] = [
      { tick: 5, squad: "esc_01", order: "deplacer", x: 150, y: 150, formation: "coin" },
      { tick: 5, squad: "esc_01", order: "tuer", queue: true },
      { tick: 30, squad: "esc_02", order: "suivre", follow: "esc_01" },
      { tick: 60, squad: "esc_03", order: "couvrir", unit: 13 },
      { tick: 90, squad: "esc_04", order: "formation", formation: "colonne" },
    ];
    const a = runBattle(w850, setup, orders);
    const b = runBattle(w850, setup, orders);
    expect(battleHash(a.state)).toBe(battleHash(b.state));
    expect(fnv1a(JSON.stringify(a.state))).toBe(fnv1a(JSON.stringify(b.state)));
    const bt = createBattle(w850, setup);
    while (!bt.state.ended) stepBattle(bt, orders.filter((o) => o.tick === bt.state.tick));
    expect(battleHash(bt.state)).toBe(battleHash(a.state));
    // Un ordre de plus change la bataille.
    const c = runBattle(w850, setup, [...orders, { tick: 6, squad: "esc_02", order: "deplacer", x: 20, y: 280 }]);
    expect(battleHash(c.state)).not.toBe(battleHash(a.state));
  });
});

describe("Artillerie sur zone et ordres de porteur (CR2-04)", () => {
  const artSetup = (): BattleSetup => ({
    ...skirmishSetup(w854, "tmap_plaine", [{ type: "ttype_grand_errant", count: 2 }], 12, 4),
    artillery: [{ id: "bat_a", piece: "art_canon_rempart", munition: "mun_boulet", side: "allie", count: 3 }],
  });

  it("tir sur zone : les impacts tombent autour du point désigné ; cessez-le-feu : plus aucun tir", () => {
    const zone = { x: 300, y: 120 };
    // Canon de rempart : un coup par minute et par pièce (3 pièces) ; 90 s de tir.
    const bt = run(artSetup(), [{ tick: 1, squad: "bat_a", order: "tir_zone", x: zone.x, y: zone.y, r: 20 }], 90 * hz, w854);
    const impacts = bt.state.impacts ?? [];
    expect(impacts.length).toBeGreaterThanOrEqual(4);
    const mean = centroid(impacts) ?? { x: 0, y: 0 };
    expect(Math.hypot(mean.x - zone.x, mean.y - zone.y)).toBeLessThan(40);
    const bt2 = run(artSetup(), [{ tick: 1, squad: "bat_a", order: "cessez_feu" }], 40 * hz, w854);
    expect(bt2.state.batteries?.[0]?.shots).toBe(0);
    expect(bt2.state.log.some((l) => l.key === "battle.rt.cease_fire")).toBe(true);
    // Feu libre (tir sur zone sans point) : la batterie reprend ses cibles.
    const bt3 = run(artSetup(), [{ tick: 1, squad: "bat_a", order: "cessez_feu" }, { tick: 2, squad: "bat_a", order: "tir_zone" }], 90 * hz, w854);
    expect(bt3.state.batteries?.[0]?.hold).toBe(false);
    expect(bt3.state.batteries?.[0]?.zone ?? null).toBeNull();
    expect(bt3.state.log.some((l) => l.key === "battle.rt.free_fire")).toBe(true);
    expect(bt3.state.batteries?.[0]?.shots ?? 0).toBeGreaterThan(0);
  });

  it("porteur allié : la zone et l'objectif restreignent ses cibles ; il rejoint sa zone", () => {
    const setup: BattleSetup = { ...skirmishSetup(w850, "tmap_plaine", [{ type: "ttype_moyen_errant", count: 3 }], 12, 2), shifters: [{ shifter: "shifter_assaillant", side: "allie", name: "Porteur", character: null, stress: 10 }] };
    const zone = { x: 60, y: 200 };
    const order: TimedOrder = { tick: 1, squad: "porteurs", order: "porteur", unit: 0, objective: "troupes", restraint: "stricte", x: zone.x, y: zone.y, r: 30 };
    const bt = createBattle(w850, setup);
    const hold = holdAll(bt);
    for (let i = 0; i < 60 * hz && !bt.state.ended; i++) {
      stepBattle(bt, i === 1 ? [order] : i === 0 ? hold : []);
      for (const t of bt.state.titans) if (t.shifter === undefined) {
        t.legs = 1e9;
        t.armL = 1e9;
        t.armR = 1e9;
      }
    }
    const u = bt.state.shifters?.[0];
    expect(u?.directive).toEqual({ objective: "troupes", zone: { x: 60, y: 200, r: 30 }, restraint: "stricte" });
    const body = u?.body !== null && u?.body !== undefined ? bt.state.titans[u.body] : undefined;
    expect(body).toBeDefined();
    // Aucun fantassin dans la zone : le porteur n'attaque pas les Titans hors zone, il s'y rend.
    expect(Math.hypot((body?.x ?? 0) - zone.x, (body?.y ?? 0) - zone.y)).toBeLessThan(20);
    expect(bt.state.titans.filter((t) => t.shifter === undefined && !t.alive).length).toBe(0);
    expect(bt.state.log.some((l) => l.key === "battle.rt.shifter_order")).toBe(true);
  });

  it("un ordre de porteur à un porteur ennemi est sans effet (l'IA ennemie n'obéit pas au joueur)", () => {
    const setup: BattleSetup = { ...skirmishSetup(w850, "tmap_plaine", [], 12, 2), shifters: [{ shifter: "shifter_cuirasse", side: "ennemi", name: "Porteur", character: null, stress: 10 }] };
    const bt = createBattle(w850, setup);
    stepBattle(bt, [{ tick: 0, squad: "porteurs", order: "porteur", unit: 0, objective: "titans" }]);
    expect(bt.state.shifters?.[0]?.directive).toBeUndefined();
  });
});
