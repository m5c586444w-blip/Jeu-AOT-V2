import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { ARCHETYPES, archetypeOf, archetypeSvg } from "../../src/ui/eventArt";

/** CHR.4 : une illustration d'archétype par thème d'événement, dessinée au trait avec les jetons de style. */
describe("illustrations d'archétype", () => {
  const world = loadWorld("data", "scn_sandbox_850");

  it("cinq archétypes, un SVG décoratif chacun, sans couleur écrite en dur", () => {
    expect(ARCHETYPES).toHaveLength(5);
    for (const a of ARCHETYPES) {
      const svg = archetypeSvg(a);
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain(`art--${a}`);
      expect(svg).not.toMatch(/#[0-9a-f]{3,8}|rgb\(/i);
    }
  });

  it("chaque événement du récit et chaque fait de fond a un archétype ; les cinq sont employés", () => {
    const used = new Set<string>();
    for (const e of world.chronicle?.events.values() ?? []) used.add(archetypeOf(e));
    expect([...used].sort()).toEqual([...ARCHETYPES].sort());
  });
});
