import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { applyCommand } from "../../src/sim/core/commands";
import { createInitialState } from "../../src/sim/core/state";
import fr from "../../src/i18n/fr.json";

const world = loadWorld("data", "scn_854");
const dict = fr as Record<string, string>;
const year = applyCommand(createInitialState(1, world), { type: "AdvanceDays", n: 360 }, undefined, world);

describe("événements de 854 au monde (T7.5, 12 §1 H)", () => {
  const order = ["evt_854_fort_slava", "evt_854_operation_paradis", "evt_854_liberio_raid", "evt_854_liberio_escape", "evt_854_yeagerist_coup", "evt_854_marley_counterattack"];
  it("E53 → E58 surviennent en 854, dans l'ordre, avec les choix historiques à l'échéance", () => {
    const h = year.events?.history ?? {};
    let last = -1;
    for (const id of order) {
      const r = h[id];
      expect(r?.status, id).toBe("survenu");
      expect(r?.day ?? 0, id).toBeGreaterThan(last);
      last = r?.day ?? 0;
      expect(r?.choice, id).toBe(world.chronicle?.events.get(id)?.choices.find((c) => c.historical)?.id);
    }
    // La guerre du Moyen-Orient, antérieure au scénario, est « passée ».
    expect(h["evt_851_middle_east_war"]?.status).toBe("passe");
  });

  it("Fort Slava met fin à la guerre du Moyen-Orient ; Liberio déclenche la guerre Marley–Paradis ; Eren hérite du Marteau de guerre", () => {
    expect(year.nations?.wars).toEqual(["fac_marley|fac_paradis"]);
    expect(year.shifters?.titans["shifter_marteau"]).toMatchObject({ holder: "char_eren_yeager", faction: "paradis" });
    expect(year.politics?.characters["char_lara_tybur"]?.death?.cause).toBe("devore");
  });

  it("morts canon de 854 (11 §3) : Willy Tybur, Zackly, Pixis, Nile", () => {
    for (const id of ["char_willy_tybur", "char_darius_zackly", "char_dot_pixis", "char_nile_dok"]) expect(year.politics?.characters[id]?.alive, id).toBe(false);
    expect(year.politics?.characters["char_sasha_blouse"]?.alive).toBe(true);
  });

  it("textes : titre, corps et choix en français", () => {
    for (const id of order) {
      const e = world.chronicle?.events.get(id);
      expect(dict[e?.text_key ?? ""], id).toBeTruthy();
      expect(dict[`${e?.text_key ?? ""}.body`], id).toBeTruthy();
      for (const c of e?.choices ?? []) expect(dict[`${e?.text_key ?? ""}.choice.${c.id}`], `${id}/${c.id}`).toBeTruthy();
    }
  });
});
