import { readFileSync } from "node:fs";
import { gasPerEngaged } from "../../src/sim/military/plan";
import { describe, expect, it } from "vitest";
import { geoFromMap } from "../../src/data/geo";
import { MapSchema } from "../../src/data/map";
import { loadDataDir } from "../../src/data/loadNode";
import { loadWorld } from "../../src/data/worldNode";
import fr from "../../src/i18n/fr.json";

const { data, issues } = loadDataDir("data");
const world850 = loadWorld("data", "scn_sandbox_850");

describe("données de P3 (AC3-01)", () => {
  it("valides : 6 types d'unités, 4 classes de Titans, une liste de noms ; textes en français", () => {
    expect(issues).toEqual([]);
    expect(data.units.map((u) => u.code)).toEqual(["U-P01", "U-P02", "U-P03", "U-P04", "U-P12", "U-P13"]);
    expect(data.titans).toHaveLength(4);
    expect(data.titans.reduce((s, t) => s + t.weight, 0)).toBeCloseTo(1, 9);
    for (const k of [...data.units, ...data.titans].map((x) => x.name_key)) expect(k in fr, k).toBe(true);
    expect(data.names[0]?.canon).toBe("A");
  });

  it("aucun nom généré ne reprend un nom de personnage", () => {
    const words = new Set(data.characters.flatMap((c) => `${c.name} ${c.display_name ?? ""}`.toLowerCase().split(/\s+/)));
    const n = data.names[0];
    if (!n) throw new Error();
    expect([...n.given_m, ...n.given_f, ...n.family].filter((x) => words.has(x.toLowerCase()))).toEqual([]);
  });

  it("le graphe de routage est à jour avec la carte (régénérer : npm run map:generate)", () => {
    const map = MapSchema.parse(JSON.parse(readFileSync("data/map/paradis.json", "utf8")));
    const geo: unknown = JSON.parse(readFileSync("data/geo/paradis.json", "utf8"));
    expect(geo).toEqual(geoFromMap(map));
  });

  it("monde 850 : couche militaire chargée ; Maria perdue peuplée de Titans [A] ; départ de Karanes [C]", () => {
    const m = world850.military;
    if (!m) throw new Error("couche militaire absente");
    expect(world850.scenario.expedition_base).toBe("prov_karanes");
    const maria = [...m.geo.nodes].filter(([, n]) => n.zone === "maria").map(([id]) => id);
    expect(maria.length).toBe(20);
    for (const id of maria) expect(world850.scenario.titan_density[id], id).toBeGreaterThan(0);
    expect(m.geo.gates.has("prov_rose_est")).toBe(true);
    expect(m.geo.adj.get("prov_karanes")?.some((e) => e.to === "prov_rose_est")).toBe(true);
  });

  it("équilibrage : gaz par homme engagé selon la classe du Titan (R-gaz, D-77), réservoir 100 u (03 §3.2), mortalité cible notée", () => {
    const e = world850.military?.exp;
    // D-77 : la plage unique 3–8 u de 02 §15 est remplacée par une table par classe tirée du combat tactique [A].
    const table = e?.engagement.gas_per_engaged_by_class ?? {};
    for (const t of world850.military?.titans ?? []) expect(table[t.id], t.id).toBeDefined();
    const mid = (id: string): number => ((table[id]?.[0] ?? 0) + (table[id]?.[1] ?? 0)) / 2;
    expect(mid("titan_petit")).toBeLessThan(mid("titan_moyen"));
    expect(mid("titan_moyen")).toBeLessThan(mid("titan_grand"));
    expect(() => gasPerEngaged({ gas_per_engaged_by_class: table }, "titan_inconnu")).toThrow();
    expect(e?.odm_tank).toBe(100);
    expect(e?.notes_canon).toContain("25–40 %");
  });
});
