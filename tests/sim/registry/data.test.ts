import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RegistryBalanceSchema } from "../../../src/data/balance";
import type { RegistryBalance } from "../../../src/data/balance";
import { BATTLE_DEATH_CAUSES } from "../../../src/sim/tactical/types";
import { DEATH_CAUSES } from "../../../src/sim/politics/characters";
import { createRegistry, enlistGenerated, enlistNamed, generateName, markFound, markMissing, reassign, registerCharacterDeath, viewForFaction, viewForSeat } from "../../../src/sim/registry";
import { D0, FA, FB, leaves, rbal, rng, squad } from "./helpers";
import { SCENARIOS } from "./scenarios";

/** Proxy profond : enregistre le chemin de chaque feuille (primitive ou tableau) réellement lue. */
function spy(root: object, seen: Set<string>): object {
  const wrap = (o: object, path: string): object =>
    new Proxy(o, {
      get(target, key, recv) {
        const v = Reflect.get(target, key, recv) as unknown;
        if (typeof key !== "string") return v;
        const p = path ? `${path}.${key}` : key;
        if (v !== null && typeof v === "object" && !Array.isArray(v)) return wrap(v, p);
        seen.add(p);
        return v;
      },
    });
  return wrap(root, "");
}

/** Atteint les noms de repli (sobriquets) : les `unique_retries` premiers tirages d'un identifiant sont déjà pris. */
function exhaustNames(b: RegistryBalance): void {
  for (const faction of [FA, FB, "fac_autre"]) {
    let s = createRegistry();
    for (let k = 0; k <= b.names.unique_retries; k++) {
      const name = generateName(s, faction, "x", rng(1), b);
      s = enlistNamed(s, { faction, squad: "sq", rank: "soldat", day: D0, name }, rng(1), b).state;
    }
  }
}

function exercise(b: RegistryBalance): void {
  for (const [k, f] of Object.entries(SCENARIOS)) if (k !== "names") f(b);
  exhaustNames(b);
  // Vues, disparitions, réaffectation, dossier de mort politique.
  const q = squad();
  const v = viewForFaction(q.state, FA, D0, b);
  viewForSeat(q.state, "seat_1", undefined, FA, D0, b);
  expect(v.counts.enlisted).toBeGreaterThan(0);
  markFound(markMissing(q.state, q.plain, D0, "patrouille"), q.plain, D0 + 1);
  reassign(q.state, q.plain, { squad: "sq9", rank: "caporal" }, b);
  const x = enlistNamed(enlistGenerated(q.state, { faction: FA, squad: "sq1", count: 2, day: D0 }, b).state, { faction: FA, squad: "sq1", rank: "soldat", day: D0, character: "pers_x" }, rng(1), b);
  registerCharacterDeath(x.state, { character: "pers_x", day: D0 + 1, place: "Trost", record: { cause: "combat", circumstances: "c", divergence: false, consequences: [{ key: "k" }] } }, rng(2), b);
}

describe("registry.json : aucune donnée morte", () => {
  it("le fichier respecte son schéma strict (cohérences croisées comprises)", () => {
    const raw = JSON.parse(readFileSync("data/balance/registry.json", "utf8")) as Record<string, unknown>;
    expect(() => RegistryBalanceSchema.parse(raw)).not.toThrow();
    expect(() => RegistryBalanceSchema.parse({ ...raw, extra: 1 })).toThrow();
    const troop = raw["troop"] as object;
    expect(() => RegistryBalanceSchema.parse({ ...raw, troop: { ...troop, named_cap: 49 } })).toThrow();
    expect(() => RegistryBalanceSchema.parse({ ...raw, troop: { ...troop, named_cap: 81 } })).toThrow();
    const ranks = raw["ranks"] as object;
    expect(() => RegistryBalanceSchema.parse({ ...raw, ranks: { ...ranks, promoted: "inconnu" } })).toThrow();
    const names = raw["names"] as { faction_set: object };
    expect(() => RegistryBalanceSchema.parse({ ...raw, names: { ...names, default_set: "inconnue" } })).toThrow();
    expect(() => RegistryBalanceSchema.parse({ ...raw, names: { ...names, faction_set: { ...names.faction_set, fac_x: "inconnue" } } })).toThrow();
    const st = raw["stele"] as object;
    expect(() => RegistryBalanceSchema.parse({ ...raw, stele: { ...st, titles: ["sans lieu"] } })).toThrow();
  });

  it("chaque feuille de registry.json est lue à l'exécution (proxy), et le détecteur signale bien un paramètre non exercé", () => {
    const seen = new Set<string>();
    exercise(spy(rbal, seen) as RegistryBalance);
    const want = leaves(rbal);
    expect(want.length).toBeGreaterThan(120);
    expect(want.filter((p) => !seen.has(p))).toEqual([]);
    const none = new Set<string>();
    spy(rbal, none);
    expect(want.filter((p) => !none.has(p)).length).toBe(want.length);
  });

  it("les causes de mort du jeu (politique et bataille) sont toutes connues du registre : aucune mort sans cause", () => {
    for (const c of [...DEATH_CAUSES, ...BATTLE_DEATH_CAUSES]) expect(Object.keys(rbal.causes), c).toContain(c);
  });

  it("tables de noms : créations A, sans doublon, sans nom de l'œuvre", () => {
    expect(rbal.names.default_set in rbal.names.sets).toBe(true);
    const banned = [
      "eren", "mikasa", "armin", "levi", "erwin", "hange", "jean", "connie", "sasha", "reiner", "bertholdt", "annie", "ymir", "historia", "krista", "pieck", "zeke", "falco", "gabi", "porco", "marcel",
      "grisha", "carla", "hannes", "keith", "pixis", "nile", "marlo", "hitch", "floch", "kenny", "rod", "uri", "kruger", "eld", "gunther", "petra", "oluo", "auruo", "moblit", "nanaba", "mike",
      "thomas", "mina", "franz", "marco", "berner", "ral", "magath", "willy", "lara", "kiyomi", "braun", "leonhart", "jaeger", "yeager", "ackerman", "arlert", "springer", "blouse", "kirstein",
      "zacharias", "reiss", "fritz", "tybur", "galliard", "hoover", "finger", "smith", "zoe", "zackly", "braus",
    ];
    for (const [id, set] of Object.entries(rbal.names.sets)) {
      for (const [list, items] of Object.entries(set)) {
        expect(new Set(items).size, `${id}.${list}`).toBe(items.length);
        for (const n of items) expect(banned, `${id}.${list} ${n}`).not.toContain(n.toLowerCase());
      }
    }
    expect(JSON.parse(readFileSync("data/balance/registry.json", "utf8")).canon).toBe("A");
  });

  it("source du module : ni aléa ni horloge, ni identifiant de faction en dur, ni any", () => {
    for (const f of readdirSync("src/sim/registry").filter((x) => x.endsWith(".ts"))) {
      const src = readFileSync(`src/sim/registry/${f}`, "utf8");
      expect(src, f).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now/);
      expect(src, f).not.toMatch(/\bfac_[a-z]+/);
      expect(src, f).not.toMatch(/: any\b|as any\b|<any>/);
    }
  });
});
