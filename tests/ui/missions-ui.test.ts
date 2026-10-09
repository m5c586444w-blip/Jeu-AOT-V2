import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { hasKey, t } from "../../src/i18n";
import { applyCommand } from "../../src/sim/core/commands";
import type { Command } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import { effectLines } from "../../src/ui/eventText";
import { findLeaks } from "../../src/ui/leaks";
import { missionItems } from "../../src/ui/timeline";

const w854 = loadWorld("data", "scn_854");
const w850 = loadWorld("data", "scn_sandbox_850");
const missions = w854.missions?.order ?? [];

describe("écran des missions : textes (MIS.3, CMIS-05)", () => {
  it("chaque mission a un nom et une description, sans mention interne", () => {
    expect(missions.length).toBeGreaterThanOrEqual(40);
    for (const m of missions) {
      expect(hasKey(`mission.${m.id}`), m.id).toBe(true);
      expect(hasKey(`mission.${m.id}.desc`), m.id).toBe(true);
      expect(findLeaks(`${t(`mission.${m.id}`)} ${t(`mission.${m.id}.desc`)}`), m.id).toEqual([]);
    }
  });

  it("chaque effet d'une mission donne une ligne lisible, sans accolade ni clé brute ; modificateurs et crochets ont leur texte", () => {
    for (const m of missions) {
      const lines = effectLines(w854, m.effects);
      expect(lines.length, m.id).toBeGreaterThanOrEqual(m.effects.filter((e) => e.op !== "stratum" && e.op !== "flag").length);
      for (const l of lines) {
        expect(l.text, m.id).not.toMatch(/[{}]|^eff\.|^mission\./);
        expect(findLeaks(l.text), m.id).toEqual([]);
      }
      for (const x of m.modifiers) expect(hasKey(`mission.mod.${x.target.split(":")[0]}`) || hasKey(`mission.mod.${x.target}`), `${m.id} ${x.target}`).toBe(true);
      for (const h of m.hooks) expect(hasKey(`mission.hook.${h.hook}`), `${m.id} ${h.hook}`).toBe(true);
      for (const e of m.events) expect(hasKey(`evt.mis.${e.replace(/^evt_mis_/, "")}`), `${m.id} ${e}`).toBe(true);
    }
  });

  it("textes de verrou, de condition et de branche présents", () => {
    for (const k of ["done", "running", "nation", "slots", "year", "prereq", "any_of", "exclusive", "condition", "cost"]) expect(hasKey(`mission.lock.${k}`), k).toBe(true);
    for (const b of ["militaire", "politique", "economique", "religion", "renseignement", "monde"]) expect(hasKey(`mission.branch.${b}`), b).toBe(true);
    expect(hasKey("notif.cat.missions")).toBe(true);
  });
});

describe("frise : missions (MIS.4)", () => {
  it("sans mission lancée : aucun repère ; lancée : en cours à sa date prévue ; accomplie : passée à sa date", () => {
    const cmd = (c: Command) => c;
    const s0 = createInitialState(42, w850);
    expect(missionItems(w850, s0)).toEqual([]);
    const s1 = applyCommand(s0, cmd({ type: "StartMission", mission: "mis_mil_inventaire_garnisons" }), undefined, w850);
    const run = missionItems(w850, s1);
    expect(run).toHaveLength(1);
    expect(run[0]?.status).toBe("en_cours");
    expect(run[0]?.group).toBe("mission");
    const s2 = applyCommand(s1, cmd({ type: "AdvanceDays", n: 100 }), undefined, w850);
    const done = missionItems(w850, s2);
    expect(done.map((i) => i.status)).toEqual(["passe"]);
    expect(done[0]?.title).toBe(t("mission.mis_mil_inventaire_garnisons"));
    expect(done[0]?.title).not.toMatch(/mis_/);
  });
});
