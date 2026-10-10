import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { stateHash } from "../../src/sim/core/canonical";
import { createInitialState, tickDay } from "../../src/sim/core/state";
import type { GameState } from "../../src/sim/core/state";
import { fromAbsoluteDay } from "../../src/sim/core/time";

/**
 * P9.8 (reports vers P9, PROGRESS : « E43–E52 jouables ») : la chronique de 850 se poursuit après le choix du sérum — sous-sol,
 * nettoyage de Maria, océan, flotte de Marley, Volontaires, Hizuru, départ d'Eren, guerre du Moyen-Orient, navires perdus —
 * jusqu'aux événements de 854 ; le scénario 854 trouve ces événements passés (aucun changement pour lui).
 */
const w850 = loadWorld("data", "scn_sandbox_850");
const w854 = loadWorld("data", "scn_854");
const days = (s: GameState, n: number, w = w850): GameState => {
  let x = s;
  for (let d = 0; d < n; d++) x = tickDay(x, w);
  return x;
};
const E43_52 = ["evt_850_yeager_basement", "evt_850_wall_maria_cleanup", "evt_850_ocean", "evt_851_marley_fleet", "evt_851_volunteers", "evt_851_hizuru_visit", "evt_851_eren_departure", "evt_851_middle_east_war", "evt_853_hizuru_refusal", "evt_851_marley_ships_lost"];

describe("chronique de 850 à 854 (P9.8)", () => {
  const end = days(createInitialState(42, w850), 4 * 360 + 160);
  const h = end.events?.history ?? {};

  it("E43 → E52 surviennent, dans l'ordre du graphe et dans leurs années ; choix historiques sans divergence", () => {
    const year = (id: string): number => fromAbsoluteDay(h[id]?.day ?? 0).year;
    for (const id of E43_52) expect(h[id]?.status, id).toBe("survenu");
    expect(year("evt_850_yeager_basement")).toBe(850);
    expect(year("evt_850_wall_maria_cleanup")).toBe(851);
    expect(year("evt_850_ocean")).toBe(851);
    for (const id of ["evt_851_eren_departure", "evt_851_middle_east_war", "evt_853_hizuru_refusal"]) expect([853, 854], id).toContain(year(id));
    expect((h["evt_850_wall_maria_cleanup"]?.day ?? 0) - (h["evt_850_yeager_basement"]?.day ?? 0)).toBeGreaterThanOrEqual(240);
    expect(end.events?.divergence).toBe(0);
    // Fort Slava (E53) suit la guerre du Moyen-Orient, en 854.
    expect(fromAbsoluteDay(h["evt_854_fort_slava"]?.day ?? 0).year).toBe(854);
  });

  it("le nettoyage de Maria rend l'anneau à Paradis ; l'océan ouvre la mission des rivages", () => {
    const maria = w850.provinces.filter((p) => p.region === "anneau_maria" || p.region === "mur_maria");
    expect(maria.length).toBeGreaterThan(20);
    for (const p of maria) expect(end.strategic?.provinces[p.id]?.control, p.id).toBe("paradis");
    expect(end.events?.flags["ocean_seen"]).toBe(true);
  });

  it("854 : E43–E52 sont passés au départ ; le scénario ne change pas", () => {
    const s = createInitialState(1, w854);
    for (const id of E43_52) expect(s.events?.history[id]?.status, id).toBe("passe");
    expect(stateHash(days(s, 30, w854))).toBe(stateHash(days(createInitialState(1, w854), 30, w854)));
  });
}, 120_000);
