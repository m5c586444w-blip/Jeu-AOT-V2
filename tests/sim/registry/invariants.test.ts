import { describe, expect, it } from "vitest";
import { Rng } from "../../../src/sim/core/rng";
import {
  addBond, appoint, createRegistry, enlistGenerated, enlistNamed, getSoldier, inscribe, markFound, markMissing, raiseStele, recordBattle, registerDeath, registryViolations, stepRegistry, suggestSuccessor,
} from "../../../src/sim/registry";
import type { RegistryState } from "../../../src/sim/registry";
import { D0, FA, FB, rbal, rng, squad } from "./helpers";

/** Programme aléatoire (graine du test) d'opérations valides ou refusées : l'état doit rester sain après chacune. */
function fuzz(seed: number, steps: number): { s: RegistryState; log: string[] } {
  const r = new Rng(seed);
  let s = createRegistry();
  let day = D0;
  const log: string[] = [];
  const causes = Object.keys(rbal.causes);
  for (let i = 0; i < steps; i++) {
    const faction = r.pick([FA, FB]);
    const ids = Object.keys(s.soldiers);
    const pickId = (): string | null => (ids.length ? r.pick(ids) : null);
    const op = r.int(0, 13);
    const before = s;
    try {
      if (op === 0) s = enlistGenerated(s, { faction, squad: `sq${r.int(1, 3)}`, count: r.int(1, 4), day }, rbal).state;
      else if (op === 1) s = enlistNamed(s, { faction, squad: `sq${r.int(1, 3)}`, rank: r.pick(rbal.ranks.list).id, day }, r, rbal).state;
      else if (op === 2) s = recordBattle(s, ids.filter((x) => s.soldiers[x]?.status === "vivant" && r.next() < 0.5), day, rbal);
      else if (op === 3 || op === 4 || op === 5) {
        const id = pickId();
        if (id) {
          const w = ids.filter((x) => s.soldiers[x]?.status === "vivant" && s.soldiers[x]?.faction === s.soldiers[id]?.faction && x !== id && r.next() < 0.3);
          s = registerDeath(s, { soldier: id, day, cause: r.pick(causes), place: r.pick(["Trost", "Forêt", "Mur"]), circumstances: "c", witnesses: w }, r, rbal).state;
        }
      } else if (op === 6) {
        const id = pickId();
        if (id) s = markMissing(s, id, day, "patrouille");
      } else if (op === 7) {
        const id = pickId();
        if (id) s = markFound(s, id, day);
      } else if (op === 8) s = raiseStele(s, faction, r.pick(["Trost", "Forêt", "Mur"]), day, r, rbal).state;
      else if (op === 9) {
        const f = s.deaths.length ? r.pick(s.deaths) : null;
        if (f && s.steles.length) s = inscribe(s, r.pick(s.steles).id, f.soldier, day, rbal);
      } else if (op === 10) {
        const a = pickId();
        const b = pickId();
        if (a && b) s = addBond(s, a, b, r.pick(Object.keys(rbal.bonds.kinds)), r.int(1, 100), day, rbal);
      } else if (op === 12) {
        // crise : une partie des vivants est au bord de la rupture (les morts suivants provoquent refus d'ordres et désertions)
        s = structuredClone(s);
        for (const x of Object.values(s.soldiers)) {
          if (x.status === "vivant" && r.next() < 0.4) {
            x.stress = r.int(68, 100);
            x.morale = r.int(5, 40);
          }
        }
      } else if (op === 13) {
        // disparition ciblée d'un soldat en refus d'ordres s'il y en a un (régression : refus conservé après disparition)
        const refusing = ids.filter((x) => s.soldiers[x]?.status === "vivant" && s.soldiers[x]?.refusingUntil !== null);
        const id = refusing.length ? r.pick(refusing) : pickId();
        if (id) s = markMissing(s, id, day, "patrouille");
      } else {
        day += r.int(1, 40);
        s = stepRegistry(s, day, r, rbal);
        const open = s.successions.find((x) => x.appointed === null);
        const pick = open ? suggestSuccessor(s, open.id) : null;
        if (open && pick) s = appoint(s, open.id, pick, day, rbal);
      }
    } catch {
      s = before; // refus propre : l'état n'a pas bougé
    }
    const v = registryViolations(s, rbal);
    log.push(`${i}:${op}:${v.join(";")}`);
    if (v.length) return { s, log };
  }
  return { s, log };
}

describe("P7 invariants de conservation", () => {
  it("fuzz : 5 graines × 300 opérations, aucune violation à aucun pas ; un soldat est vivant, mort ou disparu, jamais deux", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { s, log } = fuzz(seed, 300);
      expect(log.filter((l) => l.split(":")[2] !== ""), `graine ${seed}`).toEqual([]);
      const all = Object.values(s.soldiers);
      expect(all.length).toBeGreaterThan(40);
      for (const f of [FA, FB]) {
        const mine = all.filter((x) => x.faction === f);
        const by = (st: string): number => mine.filter((x) => x.status === st).length;
        expect(by("vivant") + by("mort") + by("disparu")).toBe(s.enlisted[f] ?? 0);
        expect(by("mort")).toBe(s.deaths.filter((d) => d.faction === f).length);
      }
      expect(s.deaths.length).toBeGreaterThan(5);
      expect(s.steles.length).toBeGreaterThan(0);
      expect(new Set(s.deaths.map((d) => d.soldier)).size).toBe(s.deaths.length);
    }
  });

  it("le fuzz passe par toutes les familles d'événements (le test n'est pas vide)", () => {
    const kinds = new Set<string>();
    for (const seed of [1, 2, 3]) for (const e of fuzz(seed, 300).s.events) kinds.add(e.type);
    for (const k of ["enlisted", "death", "missing", "found", "stele", "inscribed", "bond", "succession_open", "appointed", "refusal", "desertion"]) expect([...kinds], k).toContain(k);
  });

  it("le même programme donne exactement le même état (déterminisme)", () => {
    expect(JSON.stringify(fuzz(7, 200).s)).toBe(JSON.stringify(fuzz(7, 200).s));
    expect(JSON.stringify(fuzz(7, 200).s)).not.toBe(JSON.stringify(fuzz(8, 200).s));
  });
});

describe("P7 le détecteur d'invariants détecte chaque corruption (mutations manuelles)", () => {
  const base = (): { s: RegistryState; q: ReturnType<typeof squad> } => {
    const q = squad();
    let s = raiseStele(q.state, FA, "Trost", D0, rng(2), rbal).state;
    s = registerDeath(s, { soldier: q.ami, day: D0, cause: "frappe", place: "Trost", circumstances: "x" }, rng(1), rbal).state;
    s = registerDeath(s, { soldier: q.recruits[0] as string, day: D0, cause: "chute", place: "Trost", circumstances: "x" }, rng(1), rbal).state;
    s = markMissing(s, q.plain, D0, "patrouille");
    return { s, q };
  };
  const first = <T>(a: T[]): T => {
    const x = a[0];
    if (x === undefined) throw new Error("vide");
    return x;
  };
  const has = (s: RegistryState, part: string): boolean => registryViolations(s, rbal).some((v) => v.includes(part));

  it("état sain de départ", () => {
    expect(registryViolations(base().s, rbal)).toEqual([]);
  });

  const cases: [string, (s: RegistryState, q: ReturnType<typeof squad>) => void, string][] = [
    ["un mort sans dossier", (s, q) => void (s.deaths = s.deaths.filter((d) => d.soldier !== q.ami)), "mort avec 0 dossier"],
    ["un mort avec deux dossiers", (s) => void s.deaths.push({ ...(s.deaths[0] as RegistryState["deaths"][number]), id: "dos_9999" }), "mort avec 2 dossier"],
    ["un vivant qui a un dossier de mort", (s, q) => void (getSoldier(s, q.ami).status = "vivant"), "mais mort"],
    ["un disparu et mort à la fois", (s, q) => void (getSoldier(s, q.ami).status = "disparu"), "mais mort"],
    ["un effectif décrémenté", (s) => void (s.enlisted[FA] = (s.enlisted[FA] ?? 0) - 1), "engagés"],
    ["un soldat effacé", (s, q) => void Reflect.deleteProperty(s.soldiers, q.other), "engagés"],
    ["un disparu sans raison", (s, q) => void (getSoldier(s, q.plain).missingReason = null), "sans date ni raison"],
    ["un généré qui porte un nom", (s, q) => void (getSoldier(s, q.recruits[1] as string).name = "Intrus Nom"), "généré mais nommé"],
    ["deux nommés au même nom", (s, q) => void (getSoldier(s, q.other).name = getSoldier(s, q.leader).name ?? ""), "nom en double"],
    ["un lien entre factions", (s, q) => {
      const foe = enlistGenerated(s, { faction: FB, squad: "x", count: 1, day: D0 }, rbal);
      Object.assign(s, foe.state);
      s.bonds.push({ a: q.leader, b: foe.ids[0] as string, kind: "ami", strength: 5, since: D0 });
    }, "entre factions"],
    ["un lien en double", (s) => void s.bonds.push({ ...(s.bonds[0] as RegistryState["bonds"][number]) }), "doublon"],
    ["une cause inconnue", (s) => void (first(s.deaths).cause = "ennui"), "cause inconnue"],
    ["un dossier sans lieu", (s) => void (first(s.deaths).place = ""), "lieu ou circonstances vides"],
    ["une gravure absente de la stèle", (s) => void (first(s.steles).inscribed = []), "gravure absente"],
    ["un nom gravé deux fois", (s) => void first(s.steles).inscribed.push(first(s.deaths).soldier, first(s.deaths).soldier), "gravé"],
    ["une gravure d'un vivant", (s, q) => void first(s.steles).inscribed.push(q.other), "gravé sans être mort"],
    ["un moral hors bornes", (s, q) => void (getSoldier(s, q.other).morale = 140), "hors [0,100]"],
    ["un refus d'ordres chez un mort", (s, q) => void (getSoldier(s, q.ami).refusingUntil = D0 + 3), "refus d'ordres hors statut vivant"],
    ["un rang inconnu", (s, q) => void (getSoldier(s, q.other).rank = "maréchal"), "rang inconnu"],
  ];
  for (const [name, mutate, expected] of cases) {
    it(`détecte : ${name}`, () => {
      const { s, q } = base();
      const t = structuredClone(s);
      mutate(t, q);
      expect(has(t, expected), registryViolations(t, rbal).join(" | ")).toBe(true);
    });
  }

  it("détecte le dépassement du plafond de nommés et de la capacité d'une stèle", () => {
    let s = createRegistry();
    const small = { ...rbal, troop: { ...rbal.troop, named_cap: 2 } };
    for (let i = 0; i < 2; i++) s = enlistNamed(s, { faction: FA, squad: "s", rank: "soldat", day: D0, name: `N${i}` }, rng(1), small).state;
    expect(registryViolations(s, small)).toEqual([]);
    expect(registryViolations(s, { ...small, troop: { ...small.troop, named_cap: 1 } }).join()).toContain("plafond");
    const { s: t } = base();
    expect(registryViolations(t, { ...rbal, stele: { ...rbal.stele, capacity: 0 } }).join()).toContain("capacité dépassée");
  });
});
