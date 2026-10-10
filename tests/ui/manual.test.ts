import { describe, expect, it } from "vitest";
import fr from "../../src/i18n/fr.json";
import { findLeaks } from "../../src/ui/leaks";
import { MANUAL_SECTIONS } from "../../src/ui/manual";
import { ACTIONS, DEFAULT_BINDINGS, KeyMap, PANEL_ACTION } from "../../src/ui/keymap";

/** P10.4 (CP10-05) : manuel en jeu — chaque section a un titre et un texte, sans mention interne ; F1 l'ouvre. */
const dict = fr as Record<string, string>;

describe("manuel en jeu (P10.4)", () => {
  it("chaque section a un titre et au moins deux paragraphes, sans mention interne", () => {
    for (const id of MANUAL_SECTIONS) {
      const title = dict[`manual.${id}.title`] ?? "";
      const body = dict[`manual.${id}.body`] ?? "";
      expect(title.length, id).toBeGreaterThan(3);
      expect(body.split("\n").length, id).toBeGreaterThanOrEqual(2);
      expect(findLeaks(`${title} ${body}`), id).toEqual([]);
    }
  });

  it("touches citées : paramètres présents, registres tous nommés", () => {
    expect(dict["manual.temps.keys"]).toMatch(/\{pause\}.*\{slow\}.*\{fast\}/);
    for (const p of ["{zin}", "{zout}", "{world}", "{region}", "{province}", "{fit}", "{layer}", "{off}"]) expect(dict["manual.carte.keys"]).toContain(p);
    for (const panel of Object.keys(PANEL_ACTION)) expect(dict[`panel.${panel}`], panel).toBeTruthy();
  });

  it("F1 ouvre le manuel, sans conflit, et l'action est nommée dans les options", () => {
    expect(new KeyMap().actionFor("F1")).toBe("manual");
    expect(new Set(Object.values(DEFAULT_BINDINGS)).size).toBe(ACTIONS.length);
    expect(dict["action.manual"]).toBe("Manuel");
    for (const a of ACTIONS) expect(dict[`action.${a}`], a).toBeTruthy();
  });
});
