import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { createInitialState } from "../../src/sim/core/state";
import { buildSearchIndex, normalizeSearch, searchEntries } from "../../src/ui/globalSearch";
import type { SearchEntry } from "../../src/ui/globalSearch";
import { PANEL_IDS } from "../../src/ui/registers";

/** Recherche globale (F-UIX-06, 09 : « Recherche globale (personnes, lieux, lois) »). */
const e = (kind: SearchEntry["kind"], id: string, label: string): SearchEntry => ({ kind, id, label, detail: "", key: normalizeSearch(label) });

describe("recherche globale", () => {
  it("sans accents, casse, ligatures ni apostrophes", () => {
    expect(normalizeSearch("  Œil-de-Bœuf  d’ÉTÉ ")).toBe("oeil de boeuf d ete");
  });

  it("nom exact puis début de mot devant un fragment ; à score égal, provinces avant personnages ; limite", () => {
    const list = [e("personnage", "c1", "Hannes"), e("province", "p1", "Trost"), e("registre", "r1", "Décrets"), e("decret", "d1", "Rationnement des districts"), e("province", "p2", "District de Trost")];
    expect(searchEntries(list, "trost").map((x) => x.id)).toEqual(["p1", "p2"]);
    expect(searchEntries(list, "DECR").map((x) => x.id)).toEqual(["r1"]);
    expect(searchEntries(list, "rict").map((x) => x.id)).toEqual(["p2", "d1"]);
    expect(searchEntries(list, "trost district").map((x) => x.id)).toEqual(["p2"]);
    expect(searchEntries(list, "")).toEqual([]);
    expect(searchEntries(list, "s", 2)).toHaveLength(2);
  });

  it("index de 850 : provinces, personnages du pays sous leur nom connu, décrets et registres présents", () => {
    const world = loadWorld("data", "scn_sandbox_850");
    const state = createInitialState(42, world);
    const all = buildSearchIndex(world, state, PANEL_IDS);
    const kinds = new Set(all.map((x) => x.kind));
    expect([...kinds].sort()).toEqual(["decret", "personnage", "province", "registre"]);
    expect(all.filter((x) => x.kind === "province")).toHaveLength(world.provinces.length);
    expect(all.filter((x) => x.kind === "registre")).toHaveLength(PANEL_IDS.length);
    // Jamais le nom caché d'un personnage : seuls `display_name` (ou `name` à défaut) sont indexés.
    for (const c of world.politics?.characters.values() ?? []) {
      const hit = all.find((x) => x.kind === "personnage" && x.id === c.id);
      if (hit) expect(hit.label).toBe(c.display_name ?? c.name);
    }
    // Sans registre des personnages ni des décrets : provinces et registres seulement.
    const bare = buildSearchIndex(world, state, ["journal"]);
    expect(new Set(bare.map((x) => x.kind))).toEqual(new Set(["province", "registre"]));
    const trost = world.provinces.find((p) => p.id === "prov_trost");
    if (trost) expect(searchEntries(all, "trost")[0]?.id).toBe("prov_trost");
  });
});
