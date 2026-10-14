import { describe, expect, it } from "vitest";
import { createRegistry, enlistGenerated, enlistNamed, getSoldier, inscribe, raiseStele, refuses, registerDeath, standing, stepRegistry } from "../../../src/sim/registry";
import type { RegistryState } from "../../../src/sim/registry";
import { D0, FA, rbal, rng, squad, withPath } from "./helpers";

/**
 * Assertions DIRECTIONNELLES sur les paramètres clés de registry.json : augmenter le paramètre doit pousser le résultat dans le sens attendu
 * (et pas seulement « changer quelque chose », ce que prouve `levers.test.ts`). Chaque test compare un réglage faible et un réglage fort,
 * à graines et scénario identiques.
 */

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

/** Nombre de désertions sur toutes les graines : l'ami du chef a un moral effondré quand le chef meurt. */
function deserters(chance: number): number {
  const b = withPath(rbal, "breaking.desert_chance", chance);
  let n = 0;
  for (const seed of SEEDS) {
    const q = squad();
    const st = structuredClone(q.state);
    getSoldier(st, q.ami).morale = 20;
    const r = registerDeath(st, { soldier: q.leader, day: D0, cause: "frappe", place: "Trost", circumstances: "c" }, rng(seed), b);
    if (getSoldier(r.state, q.ami).status === "disparu") n++;
  }
  return n;
}

/** Mort de `n` généraux anonymes de la faction FA (avec ou sans gravure sur une stèle), mesure à `today`. */
function loss(b: typeof rbal, o: { engrave?: boolean; named?: boolean; n?: number; today?: number } = {}): ReturnType<typeof standing> {
  const n = o.n ?? 20;
  let s: RegistryState = createRegistry();
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    if (o.named) {
      const r = enlistNamed(s, { faction: FA, squad: "sq", rank: "soldat", day: D0 - 300 }, rng(i + 1), b);
      s = r.state;
      ids.push(r.id);
    } else {
      const g = enlistGenerated(s, { faction: FA, squad: "sq", count: 1, day: D0 - 300 }, b);
      s = g.state;
      ids.push(...g.ids);
    }
  }
  const stele = raiseStele(s, FA, "Trost", D0 - 50, rng(2), b);
  s = stele.state;
  ids.forEach((id, i) => {
    s = registerDeath(s, { soldier: id, day: D0 - 40 + i, cause: "frappe", place: "Forêt", circumstances: "c" }, rng(3), b).state;
    if (o.engrave && getSoldier(s, id).named === false) s = inscribe(s, stele.id, id, D0, b);
  });
  return standing(s, FA, o.today ?? D0, b);
}

/** Nombre de soldats nommés acceptés avant le refus de plafond. */
function namedAccepted(b: typeof rbal): number {
  let s = createRegistry();
  let n = 0;
  for (let i = 0; i < b.troop.named_cap + 20; i++) {
    try {
      s = enlistNamed(s, { faction: FA, squad: "sq", rank: "soldat", day: D0 }, rng(i + 1), b).state;
      n++;
    } catch {
      break;
    }
  }
  return n;
}

describe("registry.json : effet directionnel des paramètres clés", () => {
  it("breaking.desert_chance : plus de chance, plus de désertions sur 40 graines (0 : aucune ; 1 : toutes)", () => {
    const [none, low, high, all] = [deserters(0), deserters(0.1), deserters(0.7), deserters(1)];
    expect(none).toBe(0);
    expect(low).toBeLessThan(high);
    expect(high).toBeLessThan(all);
    expect(all).toBe(SEEDS.length);
  });

  it("breaking.refuse_stress : un seuil plus bas fait refuser davantage de soldats ; breaking.refusal_days allonge le refus", () => {
    const refusers = (b: typeof rbal): number => {
      const q = squad(b);
      const st = structuredClone(q.state);
      for (const id of [q.ami, q.rival, q.amour, q.dette, q.haine, q.plain]) getSoldier(st, id).stress = 60;
      const r = registerDeath(st, { soldier: q.leader, day: D0, cause: "frappe", place: "Trost", circumstances: "c", witnesses: [q.plain] }, rng(3), b);
      return Object.keys(r.state.soldiers).filter((id) => refuses(r.state, id, D0)).length;
    };
    const lowBar = refusers(withPath(rbal, "breaking.refuse_stress", 62));
    const highBar = refusers(withPath(rbal, "breaking.refuse_stress", 90));
    expect(lowBar).toBeGreaterThan(highBar);
    expect(highBar).toBe(0);
    const q = squad();
    const st = structuredClone(q.state);
    getSoldier(st, q.dette).stress = 68;
    const until = (days: number): number | null =>
      getSoldier(registerDeath(st, { soldier: q.leader, day: D0, cause: "frappe", place: "Trost", circumstances: "c" }, rng(3), withPath(rbal, "breaking.refusal_days", days)).state, q.dette).refusingUntil;
    expect(until(3)).toBe(D0 + 3);
    expect(until(12)).toBe(D0 + 12);
    expect(refuses(registerDeath(st, { soldier: q.leader, day: D0, cause: "frappe", place: "Trost", circumstances: "c" }, rng(3), withPath(rbal, "breaking.refusal_days", 12)).state, q.dette, D0 + 8)).toBe(true);
  });

  it("stele.opinion_relief : un soulagement plus grand rend l'opinion moins négative (gravés seulement) ; stele.legitimacy_relief idem pour la légitimité", () => {
    const o = (v: number): number => loss(withPath(rbal, "stele.opinion_relief", v), { engrave: true }).opinion;
    expect(o(0)).toBeLessThan(o(0.5));
    expect(o(0.5)).toBeLessThan(o(0.9));
    expect(o(0.9)).toBeLessThan(0);
    const l = (v: number): number => loss(withPath(rbal, "stele.legitimacy_relief", v), { engrave: true, named: true }).legitimacy;
    // les nommés sont gravés automatiquement (auto_named) : le soulagement de légitimité s'applique
    expect(l(0)).toBeLessThan(l(0.8));
    // sans gravure, le soulagement n'a aucun effet
    expect(loss(withPath(rbal, "stele.opinion_relief", 0.9)).opinion).toBe(loss(withPath(rbal, "stele.opinion_relief", 0)).opinion);
  });

  it("opinion.per_generated et opinion.per_named : plus de poids par mort, opinion plus négative ; opinion.cap borne la perte", () => {
    const g = (v: number): number => loss(withPath(rbal, "opinion.per_generated", v)).opinion;
    expect(g(0.4)).toBeLessThan(g(0.1));
    const n = (v: number): number => loss(withPath(rbal, "opinion.per_named", v), { named: true, n: 10 }).opinion;
    expect(n(2)).toBeLessThan(n(1));
    const capped = loss(withPath(withPath(rbal, "opinion.per_generated", 5), "opinion.cap", 3)).opinion;
    expect(capped).toBe(-3);
    expect(loss(withPath(withPath(rbal, "opinion.per_generated", 5), "opinion.cap", 10)).opinion).toBe(-10);
  });

  it("memory.half_life_days : une demi-vie plus longue garde l'opinion plus négative après le temps ; memory.window_days efface au-delà", () => {
    const o = (h: number): number => loss(withPath(rbal, "memory.half_life_days", h), { today: D0 + 150 }).opinion;
    expect(o(300)).toBeLessThan(o(60));
    const w = (days: number): number => loss(withPath(rbal, "memory.window_days", days), { today: D0 + 150 }).opinion;
    expect(w(100)).toBe(0);
    expect(w(400)).toBeLessThan(0);
  });

  it("recruitment.per_loss et stele.recruit_bonus : plus de perte, recrutement plus bas ; plus de bonus de stèle, recrutement plus haut", () => {
    const r = (b: typeof rbal, o = {}): number => loss(b, { n: 30, ...o }).recruitment;
    expect(r(withPath(rbal, "recruitment.per_loss", 0.02))).toBeLessThan(r(withPath(rbal, "recruitment.per_loss", 0.004)));
    expect(r(withPath(rbal, "stele.recruit_bonus", 0.02), { engrave: true })).toBeGreaterThan(r(withPath(rbal, "stele.recruit_bonus", 0), { engrave: true }));
    expect(r(withPath(rbal, "recruitment.min_factor", 0.9), { n: 30 })).toBeGreaterThanOrEqual(0.9);
  });

  it("troop.named_cap : le plafond de nommés est exactement respecté, et un plafond plus haut accepte plus de nommés", () => {
    expect(namedAccepted(withPath(rbal, "troop.named_cap", 50))).toBe(50);
    expect(namedAccepted(rbal)).toBe(rbal.troop.named_cap);
    expect(namedAccepted(withPath(rbal, "troop.named_cap", 70))).toBe(70);
  });

  it("mourning.squad_stress et mourning.squad_morale : un camarade sans lien gagne plus de stress / perd plus de moral quand ils augmentent", () => {
    const delta = (path: string, v: number): { m: number; s: number } => {
      const b = withPath(rbal, path, v);
      const q = squad(b);
      const r = registerDeath(q.state, { soldier: q.leader, day: D0, cause: "frappe", place: "Trost", circumstances: "c" }, rng(3), b);
      const x = getSoldier(r.state, q.plain);
      const y = getSoldier(q.state, q.plain);
      return { m: x.morale - y.morale, s: x.stress - y.stress };
    };
    expect(delta("mourning.squad_stress", 9).s).toBeGreaterThan(delta("mourning.squad_stress", 2).s);
    expect(delta("mourning.squad_morale", 10).m).toBeLessThan(delta("mourning.squad_morale", 2).m);
  });

  it("recovery.morale_per_day et recovery.stress_per_day : récupération plus rapide, moral plus haut et stress plus bas après quelques jours", () => {
    const after = (path: string, v: number): { m: number; s: number } => {
      const b = withPath(rbal, path, v);
      const q = squad(b);
      const st = structuredClone(q.state);
      getSoldier(st, q.plain).morale = 20;
      getSoldier(st, q.plain).stress = 60;
      const out = stepRegistry(stepRegistry(st, D0, rng(1), b), D0 + 5, rng(1), b);
      const x = getSoldier(out, q.plain);
      return { m: x.morale, s: x.stress };
    };
    expect(after("recovery.morale_per_day", 4).m).toBeGreaterThan(after("recovery.morale_per_day", 1).m);
    expect(after("recovery.stress_per_day", 6).s).toBeLessThan(after("recovery.stress_per_day", 1).s);
  });
});
