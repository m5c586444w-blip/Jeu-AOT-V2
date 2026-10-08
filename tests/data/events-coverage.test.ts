import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import fr from "../../src/i18n/fr.json";
import { EVENT_THEMES } from "../../src/data/schemas";
import type { EventDef } from "../../src/data/schemas";

/** CHR.5 : chacun des 60 événements du fichier 12 a une entrée dans data/events, avec titre, résumé et thème. */
const dict = fr as Record<string, string>;

/** Codes E01 → E60 lus dans la table du fichier 12 (§1) : la source de vérité du test. */
export function codesOfSpec(markdown: string): { code: string; title: string }[] {
  const section = markdown.slice(markdown.indexOf("## 1. TABLE DES 60"), markdown.indexOf("## 2. POINTS DE BIFURCATION"));
  return [...section.matchAll(/^\| (E\d{2}) \| \*\*(.+?)\*\*/gm)].map((m) => ({ code: m[1] as string, title: m[2] as string }));
}

/** Codes sans entrée : vide si la couverture est complète. */
export function missingCodes(codes: readonly string[], events: readonly Pick<EventDef, "code">[]): string[] {
  const have = new Set(events.map((e) => e.code));
  return codes.filter((c) => !have.has(c));
}

const spec = codesOfSpec(readFileSync("docs/spec/12_EVENEMENTS_CANON.md", "utf8"));
const world = loadWorld("data", "scn_sandbox_850");
const events = [...(world.chronicle?.events.values() ?? [])].filter((e) => e.kind === "canon");

describe("couverture des 60 événements du fichier 12 (CCHR-03)", () => {
  it("le fichier 12 donne bien E01 → E60", () => {
    expect(spec.map((s) => s.code)).toEqual(Array.from({ length: 60 }, (_, i) => `E${String(i + 1).padStart(2, "0")}`));
  });

  it("aucun des 60 n'est sans entrée dans data/events", () => {
    expect(missingCodes(spec.map((s) => s.code), events)).toEqual([]);
  });

  it("le test échoue quand une entrée manque", () => {
    expect(missingCodes(["E01", "E02"], events.filter((e) => e.code !== "E02"))).toEqual(["E02"]);
  });

  it("un code, une entrée ; chaque entrée a un titre, un résumé, un thème, une année et un statut canon", () => {
    const seen = new Set<string>();
    for (const { code } of spec) {
      const found = events.filter((e) => e.code === code);
      expect(found, code).toHaveLength(1);
      const e = found[0] as EventDef;
      expect(seen.has(e.id), e.id).toBe(false);
      seen.add(e.id);
      expect(dict[e.text_key], `${code} titre`).toBeTruthy();
      expect(dict[`${e.text_key}.body`], `${code} résumé`).toBeTruthy();
      expect(EVENT_THEMES, code).toContain(e.theme);
      expect(["C", "A", "?"], code).toContain(e.canon);
      expect(e.year_min, code).toBeGreaterThanOrEqual(845);
      expect(e.year_min, code).toBeLessThanOrEqual(854);
    }
  });

  it("l'ordre du graphe suit les codes : un événement ne dépend que de codes plus petits (hors E29, pendant E32)", () => {
    const byId = new Map(events.map((e) => [e.id, e]));
    for (const e of events.filter((x) => x.code && x.code !== "E29")) {
      const after = e.window.after === null ? [] : Array.isArray(e.window.after) ? e.window.after : [e.window.after];
      for (const p of after) {
        const pc = byId.get(p)?.code;
        expect(pc, `${e.code} ← ${p}`).toBeTruthy();
        expect((pc ?? "") < (e.code ?? ""), `${e.code} ← ${pc}`).toBe(true);
      }
    }
  });

  it("jouable ou texte seul : 40 jouables, 20 textes seuls (squelettes E01–E08, E43–E52, E59–E60)", () => {
    const solo = events.filter((e) => e.code && !e.playable).map((e) => e.code).sort();
    expect(solo).toEqual(["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08", "E43", "E44", "E45", "E46", "E47", "E48", "E49", "E50", "E51", "E52", "E59", "E60"]);
    expect(events.filter((e) => e.code && e.playable)).toHaveLength(40);
  });
});
