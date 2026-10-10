import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { t } from "../../src/i18n";
import { effectLines } from "../../src/ui/eventText";

/** Dette n° 31 : les conséquences d'un événement survenu s'écrivent au passé ; celles d'un choix à venir, au futur. */
describe("textes des effets d'événement", () => {
  const w = loadWorld("data", "scn_sandbox_850");
  const kill = [{ op: "kill", character: "char_x" }] as unknown as Parameters<typeof effectLines>[1];
  it("officiers exposés : futur pour un choix, passé pour un événement survenu", () => {
    expect(effectLines(w, kill).map((l) => l.text)).toEqual([t("eff.officers_exposed")]);
    expect(effectLines(w, kill, {}, true).map((l) => l.text)).toEqual([t("eff.officers_exposed_past")]);
    expect(t("eff.officers_exposed_past")).toMatch(/ont été/);
  });
});
