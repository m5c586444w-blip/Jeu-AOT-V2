import { describe, expect, it } from "vitest";
import { loadWorld } from "../../../src/data/worldNode";
import { Rng } from "../../../src/sim/core/rng";
import { createInitialState } from "../../../src/sim/core/state";
import { CLEAR, emptyGhostBook, fogView, fogViewForSeat, ghostView, ghostsOf, linkedUnits, markersFor, propagate, recordReports, recordSightings } from "../../../src/sim/signal";
import type { Ghost, WorldEntity } from "../../../src/sim/signal";
import { fan, sb, sig, unit } from "./helpers";

const P = "fac_paradis";
const M = "fac_marley";
const world: WorldEntity[] = [
  { id: "p_chef", faction: P, x: 0, y: 0 },
  { id: "p_loin", faction: P, x: 900, y: 0 },
  { id: "m_proche", faction: M, x: 100, y: 0 },
  { id: "m_loin", faction: M, x: 3000, y: 3000 },
];
const linked = new Set(["p_chef"]);

describe("P4 fantômes d'information", () => {
  const g: Ghost = { entityId: "m1", faction: M, x: 10, y: 20, seenAtS: 100, speedMps: 2 };
  it("âge et incertitude croissent avec le temps, plafonnés, puis le fantôme expire", () => {
    let prev = -1;
    for (const t of [100, 130, 200, 500, 900, 1000]) {
      const v = ghostView(g, t, sb);
      expect(v?.ageS).toBe(t - 100);
      expect(v?.uncertaintyM ?? 0).toBeGreaterThanOrEqual(prev);
      prev = v?.uncertaintyM ?? prev;
    }
    expect(ghostView(g, 100 + sb.ghost.max_age_s + 1, sb)).toBeNull();
    expect(ghostView(g, 100 + 10000, { ...sb, ghost: { ...sb.ghost, max_age_s: 1e9 } })?.uncertaintyM).toBe(sb.ghost.uncertainty_cap_m);
  });
  it("l'information plus ancienne n'écrase pas la plus récente ; carnet indexé par observateur", () => {
    const b1 = recordSightings(emptyGhostBook(), P, "normal", world, linked, 50, sb);
    const b2 = recordSightings(b1, P, "normal", [{ id: "m_proche", faction: M, x: 999, y: 0 }, world[0] as WorldEntity], linked, 20, sb);
    expect(b2.byObserver[P]?.["m_proche"]?.x).toBe(100);
    expect(b2.byObserver[M]).toBeUndefined();
  });
});

describe("P4 (d) brouillard à trois niveaux et fuite d'information", () => {
  const units = fan();
  const s = sig();
  const calm = { ...sb, errors: { ...sb.errors, wrong_code_base: 0, wet_flare_base: 0, wet_flare_rain_k: 0, misunderstand_base: 0, misunderstand_morale_k: 0 } };
  const res = propagate(s, units, CLEAR, "signal", new Rng(1), calm);
  const markers = markersFor(P, [s], [res], 100, calm);
  const rapports = recordReports(emptyGhostBook(), P, res.receptions, units, s.issuedAtS, calm);

  it("Récit : tout est visible, exact", () => {
    expect(fogView("recit", P, world, linked, emptyGhostBook(), markers, 100, sb).visible.map((e) => e.id)).toEqual(["m_loin", "m_proche", "p_chef", "p_loin"]);
  });
  it("Normal : seules les entités propres liées et les ennemis à portée de vue directe ; le reste en fantômes datés", () => {
    const book = recordSightings(emptyGhostBook(), P, "normal", world, linked, 10, sb);
    const v = fogView("normal", P, world, linked, book, markers, 40, sb);
    expect(v.visible.map((e) => e.id)).toEqual(["m_proche", "p_chef"]);
    expect(v.visible.some((e) => e.id === "m_loin" || e.id === "p_loin")).toBe(false);
    expect(v.ghosts.every((x) => !v.visible.some((e) => e.id === x.entityId))).toBe(true);
    expect(JSON.stringify(v)).not.toContain("m_loin");
  });
  it("Rude : aucune unité exposée en position exacte ; fantômes limités aux unités propres rapportées ; jamais d'ennemi", () => {
    const book = recordSightings(rapports, P, "rude", world, linked, 10, sb); // Rude n'observe pas directement
    const v = fogView("rude", P, world, linked, book, markers, 40, sb);
    expect(v.visible).toEqual([]);
    expect(v.ghosts.length).toBeGreaterThan(0);
    expect(v.ghosts.every((g) => g.faction === P)).toBe(true);
    expect(JSON.stringify(v)).not.toMatch(/m_proche|m_loin/);
    expect(v.signals.length).toBe(1);
  });
  it("Rude ignore même un carnet contaminé par des ennemis (défense en profondeur)", () => {
    const dirty = recordSightings(emptyGhostBook(), P, "normal", world, linked, 10, sb);
    const v = fogView("rude", P, world, linked, dirty, markers, 40, sb);
    expect(v.ghosts.some((g) => g.faction === M)).toBe(false);
  });
  it("aucune fuite entre factions : l'autre faction ne reçoit ni ne lit la fusée", () => {
    const mixed = [...units, unit("m_oeil", 3900, { faction: M, relays: true })];
    const r = propagate(s, mixed, CLEAR, "signal", new Rng(1), calm);
    expect(r.receptions.some((x) => x.unitId === "m_oeil")).toBe(false);
    expect(r.unreached).not.toContain("m_oeil");
    expect(markersFor(M, [s], [r], 100, calm)).toEqual([]);
    expect(linkedUnits([r], M).size).toBe(0);
    const vm = fogView("rude", M, world, linkedUnits([r], M), rapports, markersFor(M, [s], [r], 100, calm), 100, sb);
    expect(JSON.stringify(vm)).not.toMatch(/s1|a_scout|z_chef|p_chef/);
  });
  it("information retardée : la fusée n'apparaît qu'à l'arrivée du délai", () => {
    const early = markersFor(P, [s], [res], 1, calm);
    expect(early).toEqual([]);
    const late = markersFor(P, [s], [res], 3, calm);
    expect(late[0]?.meaning).toBe("titan_repere");
    expect(ghostsOf(rapports, P, 3, calm).length).toBeGreaterThan(0);
  });
  it("par siège : la faction est celle que dirige le siège ; siège inconnu = vue vide", () => {
    const st = { ...createInitialState(5, loadWorld("data", "scn_sandbox_850")), seats: { seats: { seat_1: { faction: P }, seat_2: { faction: M } } } };
    const book = recordSightings(emptyGhostBook(), P, "normal", world, linked, 10, sb);
    const v1 = fogViewForSeat(st, "seat_1", "normal", world, linked, book, markers, 40, sb);
    expect(v1.faction).toBe(P);
    expect(v1.visible.map((e) => e.id)).toEqual(["m_proche", "p_chef"]);
    const v2 = fogViewForSeat(st, "seat_2", "normal", world, new Set(), emptyGhostBook(), [], 40, sb);
    expect(v2.faction).toBe(M);
    expect(v2.visible).toEqual([]);
    expect(fogViewForSeat(st, "seat_9", "recit", world, linked, book, markers, 40, sb)).toEqual({ level: "recit", faction: "", visible: [], ghosts: [], signals: [] });
  });
});
