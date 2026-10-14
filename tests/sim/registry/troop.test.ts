import { describe, expect, it } from "vitest";
import {
  addBond, bondBetween, createRegistry, enlistGenerated, enlistNamed, generateName, getSoldier, markFound, markMissing, namedCount, recordBattle, reassign, refuses, registerDeath, RegistryError, stepRegistry,
} from "../../../src/sim/registry";
import { D0, FA, FB, rbal, rng, squad, withPath } from "./helpers";

const code = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    return e instanceof RegistryError ? e.code : `autre:${(e as Error).message}`;
  }
  return "aucune";
};

describe("P7 troupe générée", () => {
  it("une recrue générée n'a qu'un matricule : pas de nom, rang de départ, moral et stress d'engagement, comptée dans les engagés", () => {
    const r = enlistGenerated(createRegistry(), { faction: FA, squad: "sq1", count: 3, day: D0 }, rbal);
    expect(r.ids).toEqual(["mat_0001", "mat_0002", "mat_0003"]);
    for (const id of r.ids) {
      const x = getSoldier(r.state, id);
      expect(x).toMatchObject({ named: false, name: null, rank: rbal.ranks.generated_start, status: "vivant", morale: rbal.troop.start_morale, stress: rbal.troop.start_stress, death: null });
    }
    expect(r.state.enlisted[FA]).toBe(3);
    expect(code(() => enlistGenerated(createRegistry(), { faction: FA, squad: "s", count: 0, day: D0 }, rbal))).toBe("effectif_invalide");
    expect(code(() => enlistGenerated(createRegistry(), { faction: "", squad: "s", count: 1, day: D0 }, rbal))).toBe("faction_ou_escouade_vide");
  });

  it("l'entrée ne modifie jamais l'état reçu", () => {
    const s0 = createRegistry();
    const before = JSON.stringify(s0);
    enlistGenerated(s0, { faction: FA, squad: "s", count: 2, day: D0 }, rbal);
    enlistNamed(s0, { faction: FA, squad: "s", rank: "soldat", day: D0 }, rng(1), rbal);
    expect(JSON.stringify(s0)).toBe(before);
  });
});

describe("P7 troupe nommée et plafond", () => {
  it("un nommé a un nom ; fourni ou généré d'après la table de sa faction ; un rang inconnu et un nom pris sont refusés", () => {
    const a = enlistNamed(createRegistry(), { faction: FA, squad: "s", rank: "caporal", day: D0, name: "Anton Albrecht" }, rng(1), rbal);
    expect(getSoldier(a.state, a.id)).toMatchObject({ named: true, name: "Anton Albrecht", rank: "caporal" });
    expect(a.id.startsWith(rbal.ids.named_prefix)).toBe(true);
    expect(code(() => enlistNamed(a.state, { faction: FA, squad: "s", rank: "soldat", day: D0, name: "Anton Albrecht" }, rng(1), rbal))).toBe("nom_deja_pris");
    expect(code(() => enlistNamed(a.state, { faction: FA, squad: "s", rank: "maréchal", day: D0 }, rng(1), rbal))).toBe("rang_inconnu");
    // même nom dans une autre faction : permis
    expect(code(() => enlistNamed(a.state, { faction: FB, squad: "s", rank: "soldat", day: D0, name: "Anton Albrecht" }, rng(1), rbal))).toBe("aucune");
    const g = enlistNamed(createRegistry(), { faction: FA, squad: "s", rank: "soldat", day: D0 }, rng(1), rbal);
    const set = rbal.names.sets[rbal.names.faction_set[FA] ?? rbal.names.default_set];
    const name = getSoldier(g.state, g.id).name ?? "";
    const [given, family] = name.split(" ");
    expect([...(set?.given_m ?? []), ...(set?.given_f ?? [])]).toContain(given);
    expect(set?.family).toContain(family);
  });

  it("plafond de nommés par faction : refus au-delà ; un mort libère une place ; l'autre faction n'est pas touchée", () => {
    let s = createRegistry();
    const ids: string[] = [];
    for (let i = 0; i < rbal.troop.named_cap; i++) {
      const r = enlistNamed(s, { faction: FA, squad: "s", rank: "soldat", day: D0, name: `N${i}` }, rng(1), rbal);
      s = r.state;
      ids.push(r.id);
    }
    expect(namedCount(s, FA)).toBe(64);
    expect(code(() => enlistNamed(s, { faction: FA, squad: "s", rank: "soldat", day: D0, name: "Z" }, rng(1), rbal))).toBe("plafond_nommes");
    expect(code(() => enlistNamed(s, { faction: FB, squad: "s", rank: "soldat", day: D0, name: "Z" }, rng(1), rbal))).toBe("aucune");
    s = registerDeath(s, { soldier: ids[0] as string, day: D0 + 1, cause: "frappe", place: "Trost", circumstances: "x" }, rng(1), rbal).state;
    expect(code(() => enlistNamed(s, { faction: FA, squad: "s", rank: "soldat", day: D0, name: "Z" }, rng(1), rbal))).toBe("aucune");
    expect(code(() => enlistNamed(s, { faction: FA, squad: "s", rank: "soldat", day: D0, name: "Z2" }, rng(1), withPath(rbal, "troop.named_cap", 10)))).toBe("plafond_nommes");
  });
});

describe("P7 noms générés déterministes", () => {
  it("même graine, même nom ; indépendant de l'ordre des appels ; autre graine ou autre identifiant, autre nom", () => {
    const s = createRegistry();
    const a = generateName(s, FA, "mat_0007", rng(5), rbal);
    expect(generateName(s, FA, "mat_0007", rng(5), rbal)).toBe(a);
    const r = rng(5);
    generateName(s, FA, "mat_0001", r, rbal);
    generateName(s, FA, "mat_0002", r, rbal);
    expect(generateName(s, FA, "mat_0007", r, rbal)).toBe(a);
    const many = new Set<string>();
    for (let i = 0; i < 40; i++) many.add(generateName(s, FA, `mat_${i}`, rng(5), rbal));
    expect(many.size).toBeGreaterThan(25);
    const other = new Set<string>();
    for (let i = 0; i < 40; i++) other.add(generateName(s, FA, `mat_${i}`, rng(6), rbal));
    expect([...many].join()).not.toBe([...other].join());
  });

  it("la table dépend de la faction (faction_set puis default_set)", () => {
    const s = createRegistry();
    const fam = (faction: string): string[] => {
      const out = new Set<string>();
      for (let i = 0; i < 60; i++) out.add(generateName(s, faction, `n${i}`, rng(1), rbal).split(" ")[1] as string);
      return [...out];
    };
    const set = (id: string): readonly string[] => rbal.names.sets[id]?.family ?? [];
    expect(fam(FA).every((f) => set("paradis").includes(f))).toBe(true);
    expect(fam(FB).every((f) => set("marley").includes(f))).toBe(true);
    expect(fam("fac_inconnue").every((f) => set(rbal.names.default_set).includes(f))).toBe(true);
  });

  it("unicité dans la faction : 60 nommés, 60 noms distincts ; repli par sobriquet ; table épuisée = erreur", () => {
    let s = createRegistry();
    for (let i = 0; i < 60; i++) s = enlistNamed(s, { faction: FA, squad: "s", rank: "soldat", day: D0 }, rng(3), rbal).state;
    const names = Object.values(s.soldiers).map((x) => x.name);
    expect(new Set(names).size).toBe(60);
    const short = withPath(rbal, "names.unique_retries", 1);
    let t = createRegistry();
    for (let i = 0; i < 60; i++) t = enlistNamed(t, { faction: FA, squad: "s", rank: "soldat", day: D0 }, rng(3), short).state;
    const all = Object.values(t.soldiers).map((x) => x.name ?? "");
    expect(new Set(all).size).toBe(60);
    expect(all.some((n) => n.includes(" dit "))).toBe(true);
    const tiny = { ...rbal, names: { ...rbal.names, female_ratio: 0, unique_retries: 1, sets: { ...rbal.names.sets, commun: { given_m: ["A"], given_f: ["B"], family: ["C"], nicknames: ["D"] } } } };
    let u = createRegistry();
    u = enlistNamed(u, { faction: "f", squad: "s", rank: "soldat", day: D0 }, rng(1), tiny).state;
    u = enlistNamed(u, { faction: "f", squad: "s", rank: "soldat", day: D0 }, rng(1), tiny).state;
    expect(code(() => enlistNamed(u, { faction: "f", squad: "s", rank: "soldat", day: D0 }, rng(1), tiny))).toBe("noms_epuises");
  });
});

describe("P7 batailles, promotion", () => {
  const recruits = (n: number, joinedAgo: number[] = []): { s: ReturnType<typeof createRegistry>; ids: string[] } => {
    let s = createRegistry();
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const r = enlistGenerated(s, { faction: FA, squad: "sq", count: 1, day: D0 - (joinedAgo[i] ?? 400) }, rbal);
      s = r.state;
      ids.push(...r.ids);
    }
    return { s, ids };
  };
  const fought = (s: ReturnType<typeof createRegistry>, id: string, n: number): ReturnType<typeof createRegistry> => {
    let t = s;
    for (let i = 0; i < n; i++) t = recordBattle(t, [id], D0 - 50 + i, rbal);
    return t;
  };

  it("une bataille par jour et par soldat ; renommée plafonnée ; seul un vivant combat", () => {
    const { s, ids } = recruits(1);
    const id = ids[0] as string;
    let t = recordBattle(recordBattle(s, [id], D0, rbal), [id], D0, rbal);
    expect(getSoldier(t, id)).toMatchObject({ battles: 1, renown: rbal.renown.per_battle, lastBattle: D0 });
    for (let d = 1; d < 60; d++) t = recordBattle(t, [id], D0 + d, rbal);
    expect(getSoldier(t, id).renown).toBe(rbal.renown.max);
    const dead = registerDeath(t, { soldier: id, day: D0 + 70, cause: "frappe", place: "T", circumstances: "x" }, rng(1), rbal).state;
    expect(code(() => recordBattle(dead, [id], D0 + 71, rbal))).toBe("soldat_non_vivant");
  });

  it("une recrue qui a survécu assez longtemps devient nommée avec un nom, garde son identifiant et son historique ; les autres restent générées", () => {
    const { s, ids } = recruits(4, [400, 400, 50, 400]);
    let t = fought(s, ids[0] as string, 3);
    t = fought(t, ids[2] as string, 3); // trop récent
    t = fought(t, ids[3] as string, 1); // pas assez de batailles
    // ids[1] : ancien mais aucune bataille
    const after = stepRegistry(t, D0, rng(2), { ...rbal, promotion: { ...rbal.promotion, chance: 1 } });
    expect(getSoldier(after, ids[0] as string)).toMatchObject({ named: true, rank: rbal.ranks.promoted, promotedDay: D0, battles: 3 });
    expect(getSoldier(after, ids[0] as string).name).toMatch(/^\S+ \S+/);
    expect(getSoldier(after, ids[0] as string).renown).toBe(3 * rbal.renown.per_battle + rbal.promotion.renown);
    for (const k of [1, 2, 3]) expect(getSoldier(after, ids[k] as string).named).toBe(false);
    expect(after.events.filter((e) => e.type === "promoted")).toHaveLength(1);
  });

  it("promotion : chance 0 = aucune ; max_per_step et plafond de nommés respectés ; les plus expérimentés d'abord", () => {
    const { s, ids } = recruits(6);
    let t = s;
    ids.forEach((id, i) => (t = fought(t, id, 2 + i)));
    const sure = { ...rbal, promotion: { ...rbal.promotion, chance: 1, max_per_step: 2 } };
    expect(Object.values(stepRegistry(t, D0, rng(2), { ...rbal, promotion: { ...rbal.promotion, chance: 0 } }).soldiers).filter((x) => x.named)).toHaveLength(0);
    const two = stepRegistry(t, D0, rng(2), sure);
    expect(Object.values(two.soldiers).filter((x) => x.named).map((x) => x.id).sort()).toEqual([ids[4], ids[5]].sort());
    const capped = stepRegistry(t, D0, rng(2), { ...sure, troop: { ...sure.troop, named_cap: 1 } });
    expect(Object.values(capped.soldiers).filter((x) => x.named)).toHaveLength(1);
    // chaque promu a un nom distinct
    const three = stepRegistry(t, D0, rng(2), { ...sure, promotion: { ...sure.promotion, max_per_step: 6 } });
    expect(new Set(Object.values(three.soldiers).map((x) => x.name)).size).toBe(6);
  });
});

describe("P7 pas quotidien", () => {
  it("idempotent : un jour déjà traité renvoie le même état", () => {
    const q = squad();
    const a = stepRegistry(q.state, D0, rng(1), rbal);
    expect(stepRegistry(a, D0, rng(2), rbal)).toBe(a);
    expect(stepRegistry(a, D0 - 1, rng(2), rbal)).toBe(a);
  });

  it("récupération vers l'engagement, jamais au-dessus ; le refus s'éteint", () => {
    const q = squad();
    const st = structuredClone(q.state);
    const x = getSoldier(st, q.plain);
    x.morale = 50;
    x.stress = 40;
    x.refusingUntil = D0 + 3;
    const hi = getSoldier(st, q.ami);
    hi.morale = 95;
    hi.stress = 0;
    let s = stepRegistry(st, D0, rng(1), rbal);
    expect(getSoldier(s, q.plain)).toMatchObject({ morale: 50 + rbal.recovery.morale_per_day, stress: 40 - rbal.recovery.stress_per_day });
    expect(getSoldier(s, q.ami)).toMatchObject({ morale: 95, stress: 0 });
    expect(refuses(s, q.plain, D0 + 2)).toBe(true);
    expect(refuses(s, q.plain, D0 + 3)).toBe(false);
    s = stepRegistry(s, D0 + 3, rng(1), rbal);
    expect(getSoldier(s, q.plain).refusingUntil).toBeNull();
    for (let d = 4; d < 80; d++) s = stepRegistry(s, D0 + d, rng(1), rbal);
    expect(getSoldier(s, q.plain)).toMatchObject({ morale: rbal.troop.start_morale, stress: rbal.troop.start_stress });
  });

  it("les liens naissent entre camarades d'escouade après assez de jours, jamais entre escouades ni entre factions", () => {
    let s = enlistGenerated(createRegistry(), { faction: FA, squad: "sq1", count: 5, day: D0 - 100 }, rbal).state;
    s = enlistGenerated(s, { faction: FA, squad: "sq2", count: 1, day: D0 - 100 }, rbal).state;
    s = enlistGenerated(s, { faction: FB, squad: "sq1", count: 5, day: D0 - 100 }, rbal).state;
    for (let d = 0; d < 60; d++) s = stepRegistry(s, D0 + d, rng(5), rbal);
    expect(s.bonds.length).toBeGreaterThan(3);
    for (const l of s.bonds) {
      const a = getSoldier(s, l.a);
      const b = getSoldier(s, l.b);
      expect([a.faction, a.squad]).toEqual([b.faction, b.squad]);
      expect(l.strength).toBeGreaterThanOrEqual(rbal.bonds.form.strength_min);
      expect(l.strength).toBeLessThanOrEqual(rbal.bonds.form.strength_max);
    }
    const fresh = enlistGenerated(createRegistry(), { faction: FA, squad: "sq1", count: 8, day: D0 }, rbal).state;
    let t = fresh;
    for (let d = 0; d < rbal.bonds.form.min_shared_days; d++) t = stepRegistry(t, D0 + d, rng(5), rbal);
    expect(t.bonds).toHaveLength(0);
  });
});

describe("P7 liens, disparus", () => {
  it("addBond : une paire, deux factions interdites, un mort ne se lie plus, type et force valides", () => {
    const q = squad();
    expect(bondBetween(q.state, q.leader, q.ami)?.kind).toBe("ami");
    const re = addBond(q.state, q.ami, q.leader, "rival", 30, D0, rbal);
    expect(bondBetween(re, q.leader, q.ami)).toMatchObject({ kind: "rival", strength: 30 });
    expect(re.bonds.filter((l) => [l.a, l.b].includes(q.ami) && [l.a, l.b].includes(q.leader))).toHaveLength(1);
    const x = enlistGenerated(q.state, { faction: FB, squad: "s", count: 1, day: D0 }, rbal);
    expect(code(() => addBond(x.state, q.leader, x.ids[0] as string, "ami", 10, D0, rbal))).toBe("lien_entre_factions");
    expect(code(() => addBond(q.state, q.leader, q.leader, "ami", 10, D0, rbal))).toBe("lien_sur_soi");
    expect(code(() => addBond(q.state, q.leader, q.ami, "cousin", 10, D0, rbal))).toBe("lien_inconnu");
    expect(code(() => addBond(q.state, q.leader, q.ami, "ami", 0, D0, rbal))).toBe("force_invalide");
    const dead = registerDeath(q.state, { soldier: q.plain, day: D0, cause: "frappe", place: "T", circumstances: "x" }, rng(1), rbal).state;
    expect(code(() => addBond(dead, q.plain, q.ami, "ami", 10, D0, rbal))).toBe("soldat_mort");
  });

  it("disparu ↔ vivant ; un disparu peut être déclaré mort ; un mort ne revient jamais", () => {
    const q = squad();
    const m = markMissing(q.state, q.plain, D0, "patrouille sans nouvelles");
    expect(getSoldier(m, q.plain)).toMatchObject({ status: "disparu", missingSince: D0, missingReason: "patrouille sans nouvelles" });
    expect(code(() => markMissing(m, q.plain, D0, "x"))).toBe("soldat_non_vivant");
    expect(code(() => markMissing(q.state, q.plain, D0, ""))).toBe("raison_vide");
    const f = markFound(m, q.plain, D0 + 5);
    expect(getSoldier(f, q.plain)).toMatchObject({ status: "vivant", missingSince: null, missingReason: null });
    const d = registerDeath(m, { soldier: q.plain, day: D0 + 9, cause: "inconnue", place: "Forêt", circumstances: "Corps retrouvé." }, rng(1), rbal).state;
    expect(getSoldier(d, q.plain)).toMatchObject({ status: "mort", missingSince: null });
    expect(code(() => markFound(d, q.plain, D0 + 10))).toBe("soldat_non_disparu");
    expect(code(() => reassign(d, q.plain, { squad: "sq9" }, rbal))).toBe("soldat_mort");
  });
});
