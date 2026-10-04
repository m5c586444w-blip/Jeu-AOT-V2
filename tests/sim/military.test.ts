import { describe, expect, it } from "vitest";
import { stateHash } from "../../src/sim/core/canonical";
import { deserialize, serialize } from "../../src/sim/core/serialize";
import { createInitialState, tickDay } from "../../src/sim/core/state";
import { corpsSize, createMilitaryState } from "../../src/sim/military/state";
import { loadWorld } from "../../src/data/worldNode";

const world = loadWorld("data", "scn_sandbox_850");

describe("Corps d'exploration individuel (AC3-02, F-CHR-17)", () => {
  it("300 soldats, escouades de 4 à 6, rôles et attributs bornés, noms uniques", () => {
    const m = createMilitaryState(world, 42);
    const soldiers = Object.values(m.soldiers);
    expect(corpsSize(world)).toBe(300);
    expect(soldiers).toHaveLength(300);
    for (const sq of m.squads) {
      expect(sq.members.length).toBeGreaterThanOrEqual(1);
      expect(sq.members.length).toBeLessThanOrEqual(6);
      expect(sq.members.filter((id) => m.soldiers[id]?.leader)).toHaveLength(1);
    }
    // Seule la dernière escouade peut être incomplète (reste de l'effectif).
    expect(m.squads.slice(0, -1).every((sq) => sq.members.length >= 4)).toBe(true);
    for (const s of soldiers) for (const a of [s.odm, s.melee, s.courage, s.endurance]) expect(a >= 5 && a <= 95).toBe(true);
    expect(new Set(soldiers.map((s) => `${s.given} ${s.family}`)).size).toBe(300);
    expect(new Set(soldiers.map((s) => s.role)).size).toBe(5);
  });

  it("déterministe : même graine → mêmes soldats ; autre graine → autres soldats", () => {
    expect(createMilitaryState(world, 42)).toEqual(createMilitaryState(world, 42));
    expect(createMilitaryState(world, 7).soldiers["sol_001"]).not.toEqual(createMilitaryState(world, 42).soldiers["sol_001"]);
  });

  it("migration v3 → v4 : `military` absent devient null, puis le Corps est régénéré au premier jour, identique", () => {
    const fresh = createInitialState(42, world);
    const v3 = JSON.parse(serialize(fresh)) as Record<string, unknown>;
    v3["schemaVersion"] = 3;
    delete v3["military"];
    const migrated = deserialize(JSON.stringify(v3));
    expect(migrated.military).toBeNull();
    const a = tickDay(migrated, world);
    const b = tickDay(fresh, world);
    expect(a.military).toEqual(b.military);
    expect(stateHash(a)).toBe(stateHash(b));
  });
});
