/**
 * PORTÉE DE CE TEST : il ne prouve QU'UN EFFET QUELCONQUE. Pour chaque feuille de registry.json, remplacer la valeur doit changer la sortie sérialisée
 * d'au moins un scénario associé ; il ne dit rien du SENS de l'effet (un paramètre inversé passerait). Le sens des paramètres clés est vérifié par
 * `directional.test.ts` (plus de `desert_chance` : plus de désertions, plus de `stele.opinion_relief` : opinion moins négative, plafond de nommés, etc.).
 */
import { describe, expect, it } from "vitest";
import { getPath, leaves, rbal, withPath } from "./helpers";
import { SCENARIOS } from "./scenarios";

/** Valeurs de remplacement d'une feuille ; un remplacement qui fait lever une erreur dans un scénario ne compte pas comme un effet. */
function alternatives(path: string, v: unknown): unknown[] {
  if (typeof v === "number") return [v * 2 + 1, 0, v / 2, Number.isInteger(v) ? v + 3 : v + 0.4];
  if (typeof v === "boolean") return [!v];
  if (path === "ranks.generated_start") return ["soldat"];
  if (path === "ranks.promoted") return ["caporal"];
  if (path === "ranks.list") return [rbal.ranks.list.map((r) => ({ ...r, leader: !r.leader })), [...rbal.ranks.list].reverse().map((r, i) => ({ ...r, order: i + 1 }))];
  if (path === "names.default_set") return ["marley"];
  if (path.startsWith("names.faction_set.")) return ["commun", "marley", "paradis"];
  if (path === "ids.generated_prefix" || path === "ids.named_prefix") return ["zz_"];
  if (path.endsWith(".titles")) return [["Pierre de {place}"]];
  if (Array.isArray(v)) return [["Zz"], [...(v as string[])].reverse(), (v as string[]).slice(0, 2)];
  return [];
}

/** Scénarios qui exercent chaque groupe de paramètres. */
const GROUPS: [string, string[]][] = [
  ["names.", ["names"]], ["ids.", ["enlisting"]], ["troop.named_cap", ["enlisting", "promotion"]], ["troop.", ["death", "recovery"]],
  ["ranks.", ["death", "enlisting", "promotion"]], ["promotion.", ["promotion"]], ["renown.", ["promotion"]], ["bonds.form.", ["bonding"]], ["bonds.kinds.", ["death", "bonding", "successionByKind"]],
  ["mourning.", ["death", "breaking"]], ["breaking.", ["breaking"]], ["recovery.", ["recovery", "breaking"]],
  ["memory.", ["publicReaction", "massLoss"]], ["opinion.", ["publicReaction", "massLoss"]], ["legitimacy.", ["publicReaction", "massLoss"]],
  ["recruitment.", ["publicReaction", "massLoss"]], ["stele.", ["publicReaction", "massLoss", "death"]], ["succession.", ["death"]], ["causes.", ["death"]],
];
const scenariosOf = (path: string): string[] => GROUPS.find(([p]) => path.startsWith(p))?.[1] ?? [];

const run = (b: typeof rbal, only: string[]): Record<string, string | null> => {
  const out: Record<string, string | null> = {};
  for (const [k, f] of Object.entries(SCENARIOS)) {
    if (!only.includes(k)) continue;
    try {
      out[k] = JSON.stringify(f(b));
    } catch {
      out[k] = null;
    }
  }
  return out;
};

describe("registry.json : chaque paramètre a un effet réel (levier)", () => {
  const base = run(rbal, Object.keys(SCENARIOS));
  it("tous les scénarios de base s'exécutent", () => {
    expect(Object.entries(base).filter(([, v]) => v === null)).toEqual([]);
  });

  const all = leaves(rbal).filter((p) => !p.startsWith("names.sets.") || p.split(".").length === 4);
  it("la liste des feuilles couvre bien tout le fichier (plus de 120 paramètres)", () => {
    expect(all.length).toBeGreaterThan(120);
  });

  for (const path of all) {
    it(`levier : ${path}`, () => {
      const v = getPath(rbal, path);
      const alts = alternatives(path, v);
      const only = scenariosOf(path);
      expect(only.length, "aucun scénario associé").toBeGreaterThan(0);
      expect(alts.length, "aucun remplacement défini").toBeGreaterThan(0);
      let effect = false;
      for (const alt of alts) {
        const r = run(withPath(rbal, path, alt), only);
        for (const k of Object.keys(r)) if (r[k] !== null && r[k] !== base[k]) effect = true;
        if (effect) break;
      }
      expect(effect, `${path} : aucun scénario ne réagit`).toBe(true);
    });
  }
});
