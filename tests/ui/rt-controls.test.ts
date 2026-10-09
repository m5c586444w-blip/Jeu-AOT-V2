import { describe, expect, it } from "vitest";
import { battleHash, createBattle, stepBattle } from "../../src/sim/tactical/battle";
import { validTimedOrder } from "../../src/sim/tactical/realtime";
import { companySetup } from "../../src/sim/tactical/setup";
import type { TimedOrder } from "../../src/sim/tactical/types";
import * as C from "../../src/ui/tactical/rtControls";
import { w854 } from "../sim/legacy-cases";

/** Commandement temps réel (R2.5, CR2-04) : sélection, ordres par escouade et par unité, groupes, ordre par défaut, journal. */
const setup = () =>
  companySetup(w854, {
    map: "tmap_plaine",
    seed: 21,
    soldiers: 24,
    allied: [{ kind: "fusilier", count: 40 }],
    enemy: [{ kind: "fusilier", count: 60 }],
    titans: [{ type: "ttype_grand_errant", count: 2 }],
    artillery: [
      { id: "bat_a", piece: "art_canon_campagne", munition: "mun_mitraille", side: "allie", count: 2 },
      { id: "bat_e", piece: "art_marley_campagne", munition: "mun_shrapnel", side: "ennemi", count: 2 },
    ],
  });

describe("sélection", () => {
  it("clic : l'escouade de l'homme ; Alt : l'homme seul ; Maj : ajoute ou retire ; adversaire et Titan : rien", () => {
    const bt = createBattle(w854, setup());
    const st = bt.state;
    const s0 = st.soldiers[0];
    expect(s0).toBeDefined();
    const a = C.clickSelect(st, C.EMPTY, { kind: "soldat", index: 0 }, { alt: false, shift: false });
    expect(a.squads).toEqual([s0?.squad]);
    const b = C.clickSelect(st, a, { kind: "soldat", index: 0 }, { alt: true, shift: false });
    expect(b.unit).toEqual({ squad: s0?.squad, index: 0, troop: false });
    const allied = (st.troops ?? []).find((x) => x.side === "allie");
    const enemy = (st.troops ?? []).find((x) => x.side === "ennemi");
    const c = C.clickSelect(st, a, { kind: "troupe", index: allied?.id ?? -1 }, { alt: false, shift: true });
    expect(c.squads).toEqual([s0?.squad, allied?.section]);
    expect(C.clickSelect(st, c, { kind: "troupe", index: allied?.id ?? -1 }, { alt: false, shift: true }).squads).toEqual([s0?.squad]);
    expect(C.clickSelect(st, a, { kind: "troupe", index: enemy?.id ?? -1 }, { alt: false, shift: false })).toEqual(C.EMPTY);
    expect(C.clickSelect(st, a, { kind: "titan", index: 0 }, { alt: false, shift: false })).toEqual(C.EMPTY);
  });

  it("rectangle : toutes les escouades alliées dont un homme est dedans ; groupes : rappel des escouades encore debout", () => {
    const bt = createBattle(w854, setup());
    const st = bt.state;
    const all = C.rectSelect(st, (x, y) => [x, y], { x0: 0, y0: 0, x1: bt.map.width, y1: bt.map.height });
    expect(all.squads.length).toBe(C.commandable(st).length);
    expect(all.squads.every((id) => C.isAllied(st, id))).toBe(true);
    const none = C.rectSelect(st, (x, y) => [x, y], { x0: 0, y0: 0, x1: 5, y1: 5 });
    expect(none.squads).toEqual([]);
    const groups = new Map([[1, [all.squads[0] ?? "", "esc_inexistante"]]]);
    expect(C.recallGroup(st, groups, 1).squads).toEqual([all.squads[0]]);
    expect(C.recallGroup(st, groups, 2).squads).toEqual([]);
  });
});

describe("ordres", () => {
  it("déplacement groupé : un ordre par escouade, côte à côte ; formes valides pour le journal", () => {
    const bt = createBattle(w854, setup());
    const st = bt.state;
    const sel = { ...C.EMPTY, squads: C.commandable(st).slice(0, 3).map((x) => x.id) };
    const list = C.ordersFor(st, sel, "deplacer", { x: 200, y: 150 });
    expect(list.length).toBe(3);
    expect(list.every(validTimedOrder)).toBe(true);
    const pts = list.map((o) => `${Math.round(o.x ?? 0)},${Math.round(o.y ?? 0)}`);
    expect(new Set(pts).size).toBe(3);
    expect(C.ordersFor(st, sel, "deplacer")).toEqual([]);
    const q = C.ordersFor(st, sel, "tenir", { queue: true });
    expect(q.every((o) => o.queue === true && validTimedOrder(o))).toBe(true);
  });

  it("clic droit : Titan → attaquer ; fantassins ennemis → attaquer la section ; escouade amie → suivre ; sol → se rendre", () => {
    const bt = createBattle(w854, setup());
    const st = bt.state;
    const ids = C.commandable(st).map((x) => x.id);
    const sel = { ...C.EMPTY, squads: [ids[0] ?? ""] };
    expect(C.defaultOrders(st, sel, { kind: "titan", index: 1 }, null, false)).toMatchObject([{ order: "tuer", target: 1 }]);
    const enemy = (st.troops ?? []).find((x) => x.side === "ennemi");
    expect(C.defaultOrders(st, sel, { kind: "troupe", index: enemy?.id ?? -1 }, null, false)).toMatchObject([{ order: "tuer", troop: enemy?.id }]);
    const other = st.soldiers.findIndex((s) => s.squad === ids[1]);
    expect(C.defaultOrders(st, sel, { kind: "soldat", index: other }, null, true)).toMatchObject([{ order: "suivre", follow: ids[1], queue: true }]);
    expect(C.defaultOrders(st, sel, null, { x: 50, y: 60 }, false)).toMatchObject([{ order: "deplacer" }]);
    expect(C.defaultOrders(st, C.EMPTY, null, { x: 50, y: 60 }, false)).toEqual([]);
    // Porteur allié sous le curseur : pas d'« attaquer » ; le clic vaut un clic au sol (D-146).
    const ally = st.titans[1];
    if (ally) ally.ally = true;
    expect(C.defaultOrders(st, sel, { kind: "titan", index: 1 }, { x: 50, y: 60 }, false)).toMatchObject([{ order: "deplacer" }]);
    expect(C.defaultOrders(st, sel, { kind: "titan", index: 1 }, null, false)).toEqual([]);
  });

  it("artillerie et porteurs : seulement les alliés ; formation suivante en boucle", () => {
    const bt = createBattle(w854, setup());
    const st = bt.state;
    expect(C.batteryOrder(st, "bat_a", { x: 100, y: 100, r: 30 })).toMatchObject({ order: "tir_zone", squad: "bat_a", r: 30 });
    expect(C.batteryOrder(st, "bat_a", null)).toMatchObject({ order: "cessez_feu" });
    expect(C.batteryOrder(st, "bat_e", null)).toBeNull();
    expect(C.shifterOrder(st, 0, { objective: "titans", restraint: "stricte", zone: null })).toBeNull();
    expect(C.nextFormation("ligne")).toBe("colonne");
    expect(C.nextFormation("carre")).toBe("ligne");
  });

  it("ordres de l'interface journalisés : la bataille rejouée avec le journal donne le même résultat", () => {
    const play = (record: TimedOrder[] | null): { hash: number; orders: TimedOrder[] } => {
      const bt = createBattle(w854, setup());
      const orders: TimedOrder[] = record ? [...record] : [];
      for (let i = 0; i < 400; i++) {
        if (!record) {
          const st = bt.state;
          const ids = C.commandable(st).map((x) => x.id);
          if (i === 5) orders.push(...C.ordersFor(st, { ...C.EMPTY, squads: ids.slice(0, 2) }, "deplacer", { x: 120, y: 200 }));
          if (i === 40) orders.push(...C.formationOrders(st, { ...C.EMPTY, squads: ids.slice(0, 1) }, "colonne"));
          if (i === 60) orders.push(...C.defaultOrders(st, { ...C.EMPTY, squads: ids.slice(2, 3) }, { kind: "titan", index: 0 }, null, false));
          if (i === 80) orders.push(C.batteryOrder(st, "bat_a", { x: 200, y: 80, r: 30 }) as TimedOrder);
        }
        stepBattle(bt, orders.filter((o) => o.tick === bt.state.tick));
      }
      return { hash: battleHash(bt.state), orders };
    };
    const a = play(null);
    expect(a.orders.length).toBeGreaterThanOrEqual(5);
    const b = play(a.orders);
    expect(b.hash).toBe(a.hash);
  });
});
