import { describe, expect, it } from "vitest";
import { fnv1a } from "../../src/sim/core/hash";
import { battleHash, createBattle, stepBattle } from "../../src/sim/tactical/battle";
import type { Battle } from "../../src/sim/tactical/battle";
import { blockedAt, freeSpot, segmentBlocked, walkStep } from "../../src/sim/tactical/map";
import { companySetup } from "../../src/sim/tactical/setup";
import type { TimedOrder } from "../../src/sim/tactical/types";
import { LEGACY_CASES, w854 } from "./legacy-cases";

/**
 * R2+ (D-146, dette n° 53) : en temps réel, les hommes à pied ne traversent plus les bâtiments et ne tirent plus à travers.
 * Les batailles d'avant R2 n'empruntent pas ce chemin : leurs empreintes ne bougent pas.
 */
const hz = w854.tactical?.balance.tick_hz ?? 20;

/** Bataille de ville réduite à un fantassin de chaque camp, placés à la main, sections tenues sur place. */
function duel(a: { x: number; y: number }, e: { x: number; y: number }): { bt: Battle; run: (ticks: number) => void } {
  const bt = createBattle(w854, companySetup(w854, { map: "tmap_ville", seed: 3, soldiers: 1, allied: [{ kind: "fusilier", count: 4 }], enemy: [{ kind: "fusilier", count: 4 }] }));
  for (const s of bt.state.soldiers) s.mode = "fui";
  const troops = bt.state.troops ?? [];
  const ally = troops.find((t) => t.side === "allie");
  const foe = troops.find((t) => t.side === "ennemi");
  if (!ally || !foe) throw new Error("fantassins introuvables");
  for (const t of troops) if (t !== ally && t !== foe) t.mode = "fui";
  Object.assign(ally, a, { reload: 0 });
  Object.assign(foe, e, { reload: 0 });
  const run = (ticks: number): void => {
    for (let i = 0; i < ticks && !bt.state.ended; i++) {
      // Les deux sections tiennent (l'IA ennemie ne les fait pas marcher pendant l'essai).
      for (const sq of bt.state.squads) if (sq.side) sq.order = "tenir";
      stepBattle(bt);
    }
  };
  return { bt, run };
}

describe("Temps réel : bâtiments infranchissables et ligne de tir (D-146)", () => {
  // Maison n° 1 de la ville : x 38,3 → 57,7 ; y 36,3 → 55,7 ; 17,6 m de haut. Bord nord de la ville : y < 34, dégagé.
  it("ligne de tir : une maison entre le tireur et la cible bloque le segment ; à découvert, il est libre", () => {
    const bt = createBattle(w854, companySetup(w854, { map: "tmap_ville", seed: 3, soldiers: 1 }));
    const house = bt.map.structures[1];
    expect(house?.kind).toBe("batiment");
    expect(segmentBlocked(bt.map, 34, 46, 1.5, 62, 46, 2.7)).toBe(true);
    expect(segmentBlocked(bt.map, 40, 25, 1.5, 60, 25, 2.7)).toBe(false);
    // Par-dessus le toit (tireur sur un toit voisin plus haut que la maison) : libre.
    expect(segmentBlocked(bt.map, 34, 46, 30, 62, 46, 30)).toBe(false);
  });

  it("un fantassin ne tire pas à travers une maison ; à découvert, il tire", () => {
    const hidden = duel({ x: 34, y: 46 }, { x: 62, y: 46 });
    hidden.run(10 * hz);
    expect(hidden.bt.state.stats.troops?.shots ?? 0).toBe(0);
    const open = duel({ x: 40, y: 25 }, { x: 60, y: 25 });
    open.run(10 * hz);
    expect(open.bt.state.stats.troops?.shots ?? 0).toBeGreaterThan(0);
  });

  it("pas de marche, de place ni d'ordre dans un bâtiment : contournement, glissement, place repoussée dans la rue", () => {
    const bt = createBattle(w854, companySetup(w854, { map: "tmap_ville", seed: 3, soldiers: 1 }));
    const m = bt.map;
    // Droit à travers la maison n° 1 : le pas ne rentre jamais dedans et finit de l'autre côté.
    let p = { x: 34, y: 46 };
    for (let i = 0; i < 400 && Math.hypot(p.x - 62, p.y - 46) > 0.5; i++) {
      p = walkStep(m, p.x, p.y, 0, 62, 46, 0.8);
      expect(blockedAt(m, p.x, p.y, 0, 0)).toBe(false);
    }
    expect(Math.hypot(p.x - 62, p.y - 46)).toBeLessThan(0.5);
    // Une place au cœur de la maison est repoussée hors de ses murs.
    const q = freeSpot(m, 48, 46);
    expect(blockedAt(m, q.x, q.y)).toBe(false);
  });

  it("aucun fantassin ni soldat à pied dans un bâtiment pendant une bataille de ville (60 s d'ordres temps réel)", () => {
    const setup = companySetup(w854, { map: "tmap_ville", seed: 5, soldiers: 24, titans: [{ type: "ttype_moyen_errant", count: 2 }], allied: [{ kind: "fusilier", count: 40 }, { kind: "assaut", count: 20 }], enemy: [{ kind: "fusilier", count: 40 }, { kind: "assaut", count: 20 }] });
    const bt = createBattle(w854, setup);
    // Destinations choisies au cœur de maisons : la marche doit les contourner et s'arrêter dans la rue.
    const orders: TimedOrder[] = [
      { tick: 0, squad: "esc_01", order: "deplacer", x: 48, y: 46, formation: "carre" },
      { tick: 0, squad: "sec_a01", order: "deplacer", x: 175, y: 46, formation: "ligne" },
      { tick: 0, squad: "sec_a02", order: "tuer" },
      { tick: 400, squad: "esc_01", order: "deplacer", x: 110, y: 150, formation: "colonne" },
      { tick: 600, squad: "sec_a01", order: "tuer" },
    ];
    let checked = 0;
    for (let i = 0; i < 60 * hz && !bt.state.ended; i++) {
      stepBattle(bt, orders.filter((o) => o.tick === bt.state.tick));
      if (i % 5 !== 0) continue;
      for (const t of bt.state.troops ?? []) {
        if (t.mode === "mort" || t.mode === "fui") continue;
        expect(blockedAt(bt.map, t.x, t.y, 0, 0), `fantassin ${t.id} (${t.x.toFixed(1)}, ${t.y.toFixed(1)}) au pas ${i}`).toBe(false);
        checked++;
      }
      for (const s of bt.state.soldiers) {
        if (s.mode !== "sol") continue;
        expect(blockedAt(bt.map, s.x, s.y, s.z, 0), `soldat ${s.id} (${s.x.toFixed(1)}, ${s.y.toFixed(1)}, ${s.z.toFixed(1)}) au pas ${i}`).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(1000);
    // La marche aboutit : l'escouade a quitté sa place de départ et des tirs ont eu lieu (le blocage n'a pas figé la bataille).
    expect(bt.state.stats.troops?.shots ?? 0).toBeGreaterThan(0);
  });

  it("empreintes inchangées : une bataille d'avant R2 en ville ne passe jamais en temps réel", () => {
    const c = LEGACY_CASES.find((x) => x.id === "ville-ordres");
    if (!c) throw new Error("cas « ville-ordres » introuvable");
    const bt = createBattle(c.world, c.setup);
    while (!bt.state.ended) {
      stepBattle(bt, c.orders.filter((o) => o.tick === bt.state.tick));
      expect(bt.state.rt ?? false).toBe(false);
    }
    // Même empreinte que sur `baaef9a` (voir rt-legacy.test.ts).
    expect([battleHash(bt.state).toString(16), fnv1a(JSON.stringify(bt.state)).toString(16)]).toEqual(["6f9f37da", "11dfc673"]);
  });
});
