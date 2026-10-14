import type { RegistryBalance } from "../../../src/data/balance";
import {
  addBond, appoint, createRegistry, enlistGenerated, enlistNamed, generateName, inscribe, raiseStele, recordBattle, registerDeath, standing, stepRegistry, suggestSuccessor,
} from "../../../src/sim/registry";
import type { RegistryState } from "../../../src/sim/registry";
import { D0, FA, FB, rbal, rng, squad, withPath } from "./helpers";

type Soldiers = RegistryState["soldiers"];
const vitals = (s: Soldiers): unknown => Object.values(s).map((x) => [x.id, x.status, x.rank, x.morale, x.stress, x.refusingUntil, x.name]);

/** Squad avec une carrière : l'ami du chef a des batailles et de la renommée (candidat à la succession). */
function veteran(): ReturnType<typeof squad> {
  const q = squad();
  let st = q.state;
  for (let d = 0; d < 3; d++) st = recordBattle(st, [q.ami, q.plain], D0 - 150 + d, rbal);
  return { ...q, state: st };
}

/** Mort du chef pour chaque cause : deuil par type de lien, choc d'escouade, témoin, succession, récupération, réaction publique. */
export function death(b: RegistryBalance): unknown {
  const out: Record<string, unknown> = {};
  for (const cause of Object.keys(rbal.causes).sort()) {
    const q = veteran();
    let st = raiseStele(q.state, FA, "Trost", D0 - 5, rng(2), rbal).state;
    const r = registerDeath(st, { soldier: q.leader, day: D0, cause, place: "Trost", circumstances: "Tombé en couvrant la retraite.", witnesses: [q.plain] }, rng(3), b);
    st = stepRegistry(r.state, D0 + 2, rng(4), b);
    const sug = r.file.succession ? suggestSuccessor(st, r.file.succession) : null;
    if (r.file.succession && sug) st = appoint(st, r.file.succession, sug, D0 + 3, b);
    out[cause] = { file: r.file, v: vitals(st.soldiers), suc: st.successions, standing: standing(st, FA, D0 + 30, b) };
  }
  return out;
}

/** Seuils de rupture : un soldat fragile près de la désertion, un autre près du refus d'ordres. */
export function breaking(b: RegistryBalance): unknown {
  const q = squad();
  const st = structuredClone(q.state);
  const f = st.soldiers[q.ami];
  const g = st.soldiers[q.dette];
  if (!f || !g) throw new Error("scénario");
  f.morale = 20;
  f.stress = 65;
  g.morale = 50;
  g.stress = 68;
  const r = registerDeath(st, { soldier: q.leader, day: D0, cause: "frappe", place: "Trost", circumstances: "Brèche.", witnesses: [] }, rng(1), b);
  const later = stepRegistry(r.state, D0 + 40, rng(4), b);
  return { file: r.file, v: vitals(r.state.soldiers), later: vitals(later.soldiers), events: r.state.events };
}

/** Récupération du moral et du stress, fin d'un refus, écart de plusieurs jours plafonné. */
export function recovery(b: RegistryBalance): unknown {
  const q = squad();
  const st = structuredClone(q.state);
  const x = st.soldiers[q.plain];
  if (!x) throw new Error("scénario");
  x.morale = 10;
  x.stress = 95;
  x.refusingUntil = D0 + 50;
  let s = stepRegistry(st, D0, rng(4), b);
  const first = vitals(s.soldiers);
  s = stepRegistry(s, D0 + 100, rng(4), b);
  return { first, second: vitals(s.soldiers) };
}

/** Plafond des nommés, identifiants, rangs de départ. */
export function enlisting(b: RegistryBalance): unknown {
  let s = createRegistry();
  let ok = 0;
  for (let i = 0; i < 90; i++) {
    try {
      s = enlistNamed(s, { faction: FA, squad: "sq1", rank: "soldat", day: D0, name: `N${i}` }, rng(1), b).state;
      ok += 1;
    } catch {
      /* plafond atteint */
    }
  }
  const g = enlistGenerated(s, { faction: FB, squad: "sq1", count: 3, day: D0 }, b);
  return { ok, ids: [...Object.keys(g.state.soldiers).slice(-3), Object.keys(s.soldiers)[0]], ranks: Object.values(g.state.soldiers).slice(-3).map((x) => x.rank) };
}

/** Noms : trois tables (deux factions mappées, une par défaut), avec peu d'essais pour atteindre les sobriquets. */
export function names(b: RegistryBalance): unknown {
  const out: Record<string, string[]> = {};
  for (const [label, retries] of [["base", b.names.unique_retries], ["court", 1]] as const) {
    const bb = withPath(b, "names.unique_retries", retries);
    for (const faction of [FA, FB, "fac_autre"]) {
      let s = createRegistry();
      const list: string[] = [];
      for (let i = 0; i < 60; i++) {
        const name = generateName(s, faction, `n${i}`, rng(9), bb);
        list.push(name);
        s = enlistNamed(s, { faction, squad: "sq", rank: "soldat", day: D0, name }, rng(1), bb).state;
      }
      out[`${label}:${faction}`] = list;
    }
  }
  return out;
}

/** Promotions : recrues d'ancienneté et de batailles variées, une très expérimentée (plafond de renommée). */
export function promotion(b: RegistryBalance): unknown {
  let s = createRegistry();
  const ids: string[] = [];
  for (let i = 0; i < 16; i++) {
    const r = enlistGenerated(s, { faction: FA, squad: `sq${i % 3}`, count: 1, day: D0 - i * 20 }, b);
    s = r.state;
    ids.push(...r.ids);
  }
  ids.forEach((id, i) => {
    for (let k = 0; k < i % 4; k++) s = recordBattle(s, [id], D0 + k, b);
  });
  for (let d = 0; d < 40; d++) s = recordBattle(s, [ids[0] as string], D0 + 100 + d, b);
  s = stepRegistry(s, D0 + 60, rng(5), b);
  s = stepRegistry(s, D0 + 61, rng(5), b);
  return { s: Object.values(s.soldiers).map((x) => [x.id, x.named, x.name, x.rank, x.renown, x.promotedDay]), ev: s.events.filter((e) => e.type === "promoted") };
}

/** Naissance des liens entre camarades d'escouade. */
export function bonding(b: RegistryBalance): unknown {
  let s = enlistGenerated(createRegistry(), { faction: FA, squad: "sq", count: 10, day: D0 - 20 }, b).state;
  for (let d = 0; d < 45; d++) s = stepRegistry(s, D0 + d, rng(5), b);
  return s.bonds;
}

/** Réaction publique : mélange de morts nommés et générés, étalés dans le temps, avec et sans stèle. */
export function publicReaction(b: RegistryBalance): unknown {
  const bb = b;
  const results: unknown[] = [];
  let s = createRegistry();
  const named: string[] = [];
  for (let i = 0; i < 12; i++) {
    const r = enlistNamed(s, { faction: FA, squad: "sq", rank: "soldat", day: D0 - 500 }, rng(1), bb);
    s = recordBattle(r.state, [r.id], D0 - 400, bb);
    named.push(r.id);
  }
  const gen = enlistGenerated(s, { faction: FA, squad: "sq", count: 30, day: D0 - 500 }, bb);
  s = gen.state;
  const st1 = raiseStele(s, FA, "Trost", D0 - 300, rng(2), bb);
  s = st1.state;
  results.push(st1.cost);
  for (let i = 0; i < 5; i++) {
    try {
      s = raiseStele(s, FA, `Lieu${i}`, D0 - 290, rng(2), bb).state;
    } catch {
      results.push("max");
    }
  }
  [...named, ...gen.ids].forEach((id, i) => {
    s = registerDeath(s, { soldier: id, day: D0 - 380 + i * 8, cause: i % 2 ? "frappe" : "devore", place: i % 3 ? "Trost" : "Lieu1", circumstances: "x" }, rng(3), bb).state;
  });
  for (const id of gen.ids.slice(0, 20)) s = inscribe(s, "ste_001", id, D0, bb);
  for (const today of [D0 - 100, D0, D0 + 60, D0 + 200, D0 + 600]) results.push(standing(s, FA, today, bb));
  results.push(s.steles.map((x) => [x.title, x.epitaph, x.inscribed.length]));
  return results;
}

/** Pertes massives : plafonds d'opinion et de légitimité, plancher de recrutement ; bonus de stèle plafonné (hors fenêtre de mémoire). */
export function massLoss(b: RegistryBalance): unknown {
  const bb = b;
  let s = createRegistry();
  const ids: string[] = [];
  for (let i = 0; i < 60; i++) {
    const r = enlistNamed(s, { faction: FA, squad: "sq", rank: "soldat", day: D0 - 900 }, rng(1), bb);
    s = r.state;
    ids.push(r.id);
  }
  for (let k = 0; k < 17; k++) s = recordBattle(s, ids, D0 - 800 + k, bb);
  s = raiseStele(s, FA, "Trost", D0 - 700, rng(2), bb).state;
  const gens = enlistGenerated(s, { faction: FA, squad: "sq", count: 45, day: D0 - 900 }, bb);
  s = gens.state;
  const errors: string[] = [];
  for (const id of ids) s = registerDeath(s, { soldier: id, day: D0 - 20, cause: "devore", place: "Trost", circumstances: "x" }, rng(3), bb).state;
  for (const id of gens.ids) {
    s = registerDeath(s, { soldier: id, day: D0 - 700, cause: "frappe", place: "Trost", circumstances: "x" }, rng(3), bb).state;
  }
  s = raiseStele(s, FA, "Autre", D0 - 600, rng(2), bb).state;
  const open = s.steles[1];
  for (const id of gens.ids) {
    try {
      s = inscribe(s, (open?.id ?? "ste_002"), id, D0 - 600, bb);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  return { now: standing(s, FA, D0, bb), later: standing(s, FA, D0 + 2000, bb), engraved: s.steles.map((x) => x.inscribed.length), errors };
}

/** Succession : pour chaque type de lien, un chef et un seul candidat lié par ce type ; le score du candidat dépend de l'intérêt propre. */
export function successionByKind(b: RegistryBalance): unknown {
  const out: Record<string, unknown> = {};
  for (const kind of Object.keys(rbal.bonds.kinds).sort()) {
    let s = createRegistry();
    const l = enlistNamed(s, { faction: FA, squad: "sq", rank: "chef_escouade", day: D0 - 100, name: "Anton Albrecht" }, rng(1), rbal);
    const c = enlistNamed(l.state, { faction: FA, squad: "sq", rank: "soldat", day: D0 - 100, name: "Bertram Brenner" }, rng(1), rbal);
    s = addBond(c.state, l.id, c.id, kind, 50, D0 - 50, rbal);
    const r = registerDeath(s, { soldier: l.id, day: D0, cause: "frappe", place: "Trost", circumstances: "x" }, rng(3), b);
    out[kind] = r.state.successions;
  }
  return out;
}

export const SCENARIOS: Record<string, (b: RegistryBalance) => unknown> = { death, breaking, recovery, enlisting, names, promotion, bonding, publicReaction, massLoss, successionByKind };

/** Lien unique de plus : réutilisé par les tests de lien. */
export const bondAll = addBond;
