import { describe, expect, it } from "vitest";
import { applyCommand } from "../../../src/sim/core/commands";
import {
  addBond, appoint, bondBetween, createRegistry, enlistGenerated, enlistNamed, getSoldier, recordBattle, refuses, registerCharacterDeath, registerDeath, RegistryError, registryViolations, standing, stepRegistry, suggestSuccessor,
} from "../../../src/sim/registry";
import type { RegistryState } from "../../../src/sim/registry";
import { pol, start, world850 } from "../politics-helpers";
import { D0, FA, FB, rbal, rng, squad, withPath } from "./helpers";

const code = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    return e instanceof RegistryError ? e.code : `autre:${(e as Error).message}`;
  }
  return "aucune";
};
const kill = (s: RegistryState, id: string, o: Partial<{ cause: string; day: number; witnesses: string[]; b: typeof rbal; seed: number }> = {}): ReturnType<typeof registerDeath> =>
  registerDeath(s, { soldier: id, day: o.day ?? D0, cause: o.cause ?? "frappe", place: "Trost", circumstances: "Tombé en couvrant la retraite.", witnesses: o.witnesses ?? [] }, rng(o.seed ?? 3), o.b ?? rbal);

describe("P7 (a) chaque mort produit un dossier complet", () => {
  it("cause, lieu, escouade, circonstances, jour, rang, témoins : tout est renseigné et relié", () => {
    const q = squad();
    const r = kill(q.state, q.ami, { cause: "devore", witnesses: [q.plain] });
    expect(r.file).toMatchObject({ soldier: q.ami, faction: FA, name: "Bertram Brenner", named: true, rank: "soldat", squad: "sq1", day: D0, cause: "devore", place: "Trost", circumstances: "Tombé en couvrant la retraite.", witnesses: [q.plain] });
    expect(r.file.mourners.length).toBeGreaterThan(0);
    expect(getSoldier(r.state, q.ami)).toMatchObject({ status: "mort", death: r.file.id });
    expect(r.state.deaths).toEqual([r.file]);
    expect(registryViolations(r.state, rbal)).toEqual([]);
  });

  it("une recrue générée a aussi son dossier (matricule, pas de nom)", () => {
    const q = squad();
    const id = q.recruits[0] as string;
    const r = kill(q.state, id);
    expect(r.file).toMatchObject({ soldier: id, name: null, named: false, rank: rbal.ranks.generated_start });
  });

  it("(c) aucune mort sans cause : cause inconnue, lieu ou circonstances vides, double mort, mort avant l'engagement, faux témoin", () => {
    const q = squad();
    const base = { soldier: q.ami, day: D0, cause: "frappe", place: "Trost", circumstances: "x" };
    const go = (o: object): string => code(() => registerDeath(q.state, { ...base, ...o }, rng(1), rbal));
    expect(go({})).toBe("aucune");
    expect(go({ cause: "" })).toBe("cause_inconnue");
    expect(go({ cause: "ennui" })).toBe("cause_inconnue");
    expect(go({ place: "  " })).toBe("lieu_vide");
    expect(go({ circumstances: "" })).toBe("circonstances_vides");
    expect(go({ day: D0 - 1000 })).toBe("mort_avant_engagement");
    expect(go({ soldier: "mat_9999" })).toBe("soldat_inconnu");
    expect(go({ witnesses: [q.ami] })).toBe("temoin_invalide");
    const foe = enlistGenerated(q.state, { faction: FB, squad: "s", count: 1, day: D0 }, rbal);
    expect(code(() => registerDeath(foe.state, { ...base, witnesses: foe.ids }, rng(1), rbal))).toBe("temoin_invalide");
    const dead = kill(q.state, q.ami).state;
    expect(code(() => registerDeath(dead, base, rng(1), rbal))).toBe("deja_mort");
    expect(code(() => registerDeath(dead, { ...base, soldier: q.plain, witnesses: [q.ami] }, rng(1), rbal))).toBe("temoin_invalide");
  });

  it("le journal : chaque mort y figure avec sa cause et son dossier", () => {
    const q = squad();
    let s = q.state;
    for (const [id, cause] of [[q.ami, "devore"], [q.plain, "maladie"], [q.recruits[0] as string, "chute"]] as const) s = kill(s, id, { cause }).state;
    const deaths = s.events.filter((e) => e.type === "death");
    expect(deaths).toHaveLength(3);
    expect(deaths.map((e) => (e.type === "death" ? e.cause : ""))).toEqual(["devore", "maladie", "chute"]);
    expect(s.deaths.map((d) => d.id)).toEqual(deaths.map((e) => (e.type === "death" ? e.file : "")));
  });
});

describe("P7 (b) le deuil suit le graphe de relations", () => {
  const dm = (s: RegistryState, before: RegistryState, id: string): { m: number; st: number } => ({
    m: getSoldier(s, id).morale - getSoldier(before, id).morale,
    st: getSoldier(s, id).stress - getSoldier(before, id).stress,
  });

  it("un proche perd du moral et gagne du stress, plus qu'un camarade sans lien, qui en perd plus qu'un soldat d'une autre escouade ; l'autre faction ne bouge pas", () => {
    const q = squad();
    const withFoe = enlistGenerated(q.state, { faction: FB, squad: "sq1", count: 1, day: D0 - 200 }, rbal);
    const r = kill(withFoe.state, q.leader);
    const friend = dm(r.state, withFoe.state, q.ami);
    const plain = dm(r.state, withFoe.state, q.plain);
    const away = dm(r.state, withFoe.state, q.other);
    const stranger = dm(r.state, withFoe.state, withFoe.ids[0] as string);
    expect(friend.m).toBeLessThan(plain.m);
    expect(friend.st).toBeGreaterThan(plain.st);
    expect(plain.m).toBeLessThan(0);
    expect(plain.st).toBeGreaterThan(0);
    expect(away).toEqual({ m: 0, st: 0 });
    expect(stranger).toEqual({ m: 0, st: 0 });
    // l'amour pèse plus que la dette ; le détail suit exactement la formule de registry.json
    const k = rbal.bonds.kinds;
    expect(dm(r.state, withFoe.state, q.amour).m).toBeCloseTo((k["amour"]?.morale_delta ?? 0) * 0.8 * (rbal.causes["frappe"]?.grief ?? 1) * rbal.mourning.named_factor, 9);
    expect(dm(r.state, withFoe.state, q.amour).m).toBeLessThan(dm(r.state, withFoe.state, q.dette).m);
    // rival : soulagement ; haine : le moral monte, le stress baisse
    expect(dm(r.state, withFoe.state, q.rival).st).toBeLessThan(0);
    expect(dm(r.state, withFoe.state, q.haine).m).toBeGreaterThan(0);
    expect(dm(r.state, withFoe.state, q.haine).st).toBeLessThan(0);
    expect(r.file.mourners.find((m) => m.id === q.ami)).toMatchObject({ kind: "ami", outcome: "aucun" });
    expect(r.file.mourners.find((m) => m.id === q.plain)?.kind).toBeNull();
    expect(r.file.mourners.some((m) => m.id === q.other || m.id === withFoe.ids[0])).toBe(false);
  });

  it("la force du lien compte : lien fort > lien faible ; mort d'un nommé > mort d'un généré ; dévoré > maladie", () => {
    const q = squad();
    const weak = addBond(q.state, q.leader, q.ami, "ami", 10, D0, rbal);
    const strong = addBond(q.state, q.leader, q.ami, "ami", 90, D0, rbal);
    const lossOf = (s: RegistryState): number => getSoldier(s, q.ami).morale - rbal.troop.start_morale;
    expect(lossOf(kill(strong, q.leader).state)).toBeLessThan(lossOf(kill(weak, q.leader).state));
    expect(lossOf(kill(q.state, q.leader, { cause: "devore" }).state)).toBeLessThan(lossOf(kill(q.state, q.leader, { cause: "maladie" }).state));
    // même lien, mort d'un généré lié : moins fort que celle d'un nommé
    let s = enlistGenerated(q.state, { faction: FA, squad: "sq1", count: 1, day: D0 - 200 }, rbal);
    const g = s.ids[0] as string;
    s = { state: addBond(s.state, g, q.ami, "ami", 60, D0, rbal), ids: s.ids };
    const n = addBond(q.state, q.leader, q.ami, "ami", 60, D0, rbal);
    expect(lossOf(kill(s.state, g).state)).toBeGreaterThan(lossOf(kill(n, q.leader).state));
  });

  it("un témoin encaisse un choc de stress supplémentaire ; mort d'un chef : choc d'escouade plus fort", () => {
    const q = squad();
    const a = kill(q.state, q.ami, { witnesses: [q.plain] });
    const b = kill(q.state, q.ami);
    expect(getSoldier(a.state, q.plain).stress).toBeGreaterThan(getSoldier(b.state, q.plain).stress);
    expect(a.file.mourners.find((m) => m.id === q.plain)?.stressDelta).toBeCloseTo(rbal.mourning.squad_stress * (rbal.causes["frappe"]?.shock ?? 1) * rbal.mourning.named_factor + rbal.mourning.witness_stress, 9);
    // le chef (rang de chef) frappe plus fort qu'un soldat nommé, pour un camarade sans lien
    const lead = kill(q.state, q.leader);
    const pair = getSoldier(lead.state, q.recruits[0] as string).morale;
    const sold = kill(q.state, q.ami);
    expect(pair).toBeLessThan(getSoldier(sold.state, q.recruits[0] as string).morale);
  });

  it("le moral et le stress restent dans [0,100]", () => {
    const q = squad();
    const st = structuredClone(q.state);
    getSoldier(st, q.amour).morale = 3;
    getSoldier(st, q.rival).stress = 0;
    getSoldier(st, q.dette).stress = 99;
    const r = kill(st, q.leader, { cause: "devore" });
    for (const x of Object.values(r.state.soldiers)) {
      expect(x.morale).toBeGreaterThanOrEqual(0);
      expect(x.morale).toBeLessThanOrEqual(100);
      expect(x.stress).toBeGreaterThanOrEqual(0);
      expect(x.stress).toBeLessThanOrEqual(100);
    }
  });
});

describe("P7 refus d'ordres et désertion", () => {
  const fragile = (): { q: ReturnType<typeof squad>; st: RegistryState } => {
    const q = squad();
    const st = structuredClone(q.state);
    const d = getSoldier(st, q.dette);
    d.morale = 50;
    d.stress = 68;
    return { q, st };
  };

  it("un stress au-dessus du seuil fait refuser les ordres pendant refusal_days, puis cesse", () => {
    const { q, st } = fragile();
    const r = kill(st, q.leader);
    expect(r.file.mourners.find((m) => m.id === q.dette)?.outcome).toBe("refus");
    expect(refuses(r.state, q.dette, D0)).toBe(true);
    expect(refuses(r.state, q.dette, D0 + rbal.breaking.refusal_days - 1)).toBe(true);
    expect(refuses(r.state, q.dette, D0 + rbal.breaking.refusal_days)).toBe(false);
    expect(refuses(r.state, q.ami, D0)).toBe(false);
    expect(r.state.events.some((e) => e.type === "refusal")).toBe(true);
    // seuil relevé : plus de refus
    expect(refuses(kill(st, q.leader, { b: withPath(rbal, "breaking.refuse_stress", 100) }).state, q.dette, D0)).toBe(false);
  });

  it("un moral effondré peut mener à la désertion : le soldat devient disparu (ni vivant ni mort), jamais deux statuts", () => {
    const q = squad();
    const st = structuredClone(q.state);
    getSoldier(st, q.ami).morale = 20;
    const sure = withPath(rbal, "breaking.desert_chance", 1);
    const r = kill(st, q.leader, { b: sure });
    expect(getSoldier(r.state, q.ami)).toMatchObject({ status: "disparu", missingReason: "desertion", missingSince: D0, death: null });
    expect(r.file.mourners.find((m) => m.id === q.ami)?.outcome).toBe("desertion");
    expect(r.state.deaths.some((d) => d.soldier === q.ami)).toBe(false);
    expect(registryViolations(r.state, rbal)).toEqual([]);
    const never = kill(st, q.leader, { b: withPath(rbal, "breaking.desert_chance", 0) });
    expect(getSoldier(never.state, q.ami).status).toBe("vivant");
    // un disparu n'est pas compté parmi les vivants du pas de récupération, mais peut être retrouvé mort
    const later = stepRegistry(r.state, D0 + 30, rng(1), rbal);
    expect(getSoldier(later, q.ami).morale).toBe(getSoldier(r.state, q.ami).morale);
    const found = registerDeath(later, { soldier: q.ami, day: D0 + 40, cause: "inconnue", place: "Forêt", circumstances: "Dépouille retrouvée." }, rng(1), rbal);
    expect(getSoldier(found.state, q.ami).status).toBe("mort");
    expect(registryViolations(found.state, rbal)).toEqual([]);
  });

  it("le tirage de désertion est déterministe pour une graine donnée", () => {
    const q = squad();
    const st = structuredClone(q.state);
    getSoldier(st, q.ami).morale = 20;
    const a = kill(st, q.leader, { seed: 1 });
    const b = kill(st, q.leader, { seed: 1 });
    expect(a.state).toEqual(b.state);
  });
});

describe("P7 succession à la mort d'un chef", () => {
  it("un chef qui tombe ouvre une succession dont les candidats sont classés ; un rival ou ennemi du défunt a un intérêt propre", () => {
    const q = squad();
    const r = kill(q.state, q.leader);
    expect(r.file.succession).toBe("suc_001");
    const suc = r.state.successions[0];
    expect(suc?.candidates).toHaveLength(rbal.succession.max_candidates);
    const scores = suc?.candidates.map((c) => c.score) ?? [];
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    const interested = suc?.candidates.filter((c) => c.interested).map((c) => c.id).sort();
    expect(interested).toEqual([q.rival, q.haine].sort());
    // sans le rang de chef, pas de succession
    expect(kill(q.state, q.ami).file.succession).toBeNull();
    expect(kill(q.state, q.ami).state.successions).toHaveLength(0);
  });

  it("nommer un candidat lui donne le rang du défunt ; les autres perdent du moral (plus s'ils étaient intéressés) ; une seule nomination", () => {
    const q = squad();
    const r = kill(q.state, q.leader);
    const id = r.file.succession as string;
    const pick = suggestSuccessor(r.state, id) as string;
    const out = appoint(r.state, id, pick, D0 + 1, rbal);
    expect(getSoldier(out, pick).rank).toBe("chef_escouade");
    expect(out.successions[0]?.appointed).toBe(pick);
    for (const c of r.state.successions[0]?.candidates ?? []) {
      if (c.id === pick) continue;
      const before = getSoldier(r.state, c.id).morale;
      expect(before - getSoldier(out, c.id).morale).toBeCloseTo(rbal.succession.passed_over_morale * (c.interested ? rbal.succession.interest_factor : 1), 9);
    }
    expect(code(() => appoint(out, id, pick, D0 + 2, rbal))).toBe("succession_close");
    expect(code(() => appoint(r.state, id, q.other, D0 + 2, rbal))).toBe("candidat_invalide");
    expect(code(() => appoint(r.state, "suc_099", pick, D0 + 2, rbal))).toBe("succession_inconnue");
    expect(registryViolations(out, rbal)).toEqual([]);
  });

  it("un chef seul dans son escouade ne laisse aucune succession ; l'expérience (batailles, renommée) fait monter un candidat", () => {
    const solo = enlistNamed(createRegistry(), { faction: FA, squad: "x", rank: "officier", day: D0 - 100, name: "Solo Test" }, rng(1), rbal);
    const r = kill(solo.state, solo.id);
    expect(r.file.succession).toBeNull();
    const q = squad();
    let s = q.state;
    for (let d = 0; d < 12; d++) s = recordBattle(s, [q.plain], D0 - 100 + d, rbal);
    const suc = kill(s, q.leader).state.successions[0];
    expect(suc?.candidates.map((c) => c.id)).toContain(q.plain);
    const plain = suc?.candidates.find((c) => c.id === q.plain);
    expect(plain?.score).toBeCloseTo(2 * rbal.succession.rank_weight + 12 * rbal.renown.per_battle * rbal.succession.renown_weight + 12 * rbal.succession.battles_weight, 9);
  });
});

describe("P7 interaction avec le dossier de mort politique existant", () => {
  it("la cause, les circonstances et les clés de conséquences du DeathRecord sont reprises ; pas de double deuil de légitimité", () => {
    const s0 = start();
    const dead = applyCommand(s0, { type: "CharacterDies", character: "char_erwin_smith", cause: "combat", circumstances: "death.circumstances.test" }, undefined, world850);
    const record = pol(dead).characters["char_erwin_smith"]?.death;
    expect(record).toBeTruthy();
    if (!record) return;
    const q = squad();
    const named = enlistNamed(q.state, { faction: FA, squad: "sq1", rank: "officier", day: D0 - 200, name: "Chef Politique", character: "char_erwin_smith" }, rng(1), rbal);
    getSoldier(named.state, named.id).renown = 80;
    const r = registerCharacterDeath(named.state, { character: "char_erwin_smith", day: D0, place: "Shiganshina", record }, rng(2), rbal);
    expect(r.file).toMatchObject({ cause: "combat", circumstances: "death.circumstances.test", soldier: named.id, place: "Shiganshina" });
    expect(r.file.political?.divergence).toBe(record.divergence);
    expect(r.file.political?.consequences).toEqual(record.consequences.map((c) => c.key));
    expect(record.consequences.length).toBeGreaterThan(0);
    // légitimité : déjà traitée côté politique (mourning) → le registre ne la compte pas une seconde fois
    expect(standing(r.state, FA, D0, rbal).legitimacy).toBe(0);
    const plainDeath = kill(named.state, named.id).state;
    expect(standing(plainDeath, FA, D0, rbal).legitimacy).toBeLessThan(0);
    // l'opinion et le recrutement, eux, réagissent bien
    expect(standing(r.state, FA, D0, rbal).opinion).toBeLessThan(0);
    // un personnage sans soldat est refusé
    expect(code(() => registerCharacterDeath(q.state, { character: "char_inconnu", day: D0, place: "x", record }, rng(1), rbal))).toBe("personnage_sans_soldat");
    // un DeathRecord dont la cause est inconnue du registre est refusé : pas de mort sans cause
    expect(code(() => registerCharacterDeath(named.state, { character: "char_erwin_smith", day: D0, place: "x", record: { ...record, cause: "ennui" } }, rng(1), rbal))).toBe("cause_inconnue");
  });
});

describe("P7 déterminisme, pureté", () => {
  it("mêmes entrées : mêmes sorties ; l'état reçu n'est jamais modifié", () => {
    const q = squad();
    const before = JSON.stringify(q.state);
    const a = kill(q.state, q.leader, { witnesses: [q.plain] });
    const b = kill(q.state, q.leader, { witnesses: [q.plain] });
    expect(JSON.stringify(q.state)).toBe(before);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(bondBetween(a.state, q.leader, q.ami)).not.toBeNull();
  });
});
