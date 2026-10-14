import type { RegistryBalance } from "../../data/balance";
import type { Rng } from "../core/rng";
import { RegistryError } from "./types";
import type { Bond, RegistryState, Soldier } from "./types";

export const cloneRegistry = (s: RegistryState): RegistryState => structuredClone(s);

export const clamp100 = (v: number): number => Math.max(0, Math.min(100, v));

export function createRegistry(): RegistryState {
  return { soldiers: {}, bonds: [], deaths: [], steles: [], successions: [], enlisted: {}, events: [], seq: { soldier: 0, file: 0, stele: 0, succession: 0 }, lastDay: -1 };
}

export const rankOrder = (rank: string, b: RegistryBalance): number => {
  const r = b.ranks.list.find((x) => x.id === rank);
  if (!r) throw new RegistryError("rang_inconnu");
  return r.order;
};
export const isLeaderRank = (rank: string, b: RegistryBalance): boolean => b.ranks.list.find((x) => x.id === rank)?.leader === true;

const soldierOf = (s: RegistryState, id: string): Soldier => {
  const x = s.soldiers[id];
  if (!x) throw new RegistryError("soldat_inconnu");
  return x;
};
export const getSoldier = soldierOf;

const pad = (n: number, width: number): string => String(n).padStart(width, "0");

/** Libellé d'un soldat : son nom s'il est nommé, sinon son matricule. */
export const labelOf = (x: Pick<Soldier, "id" | "name">): string => x.name ?? x.id;

/**
 * Nom déterministe : tiré d'un fork du Rng d'après l'identifiant (indépendant de l'ordre des appels). Table choisie d'après la faction
 * (`names.faction_set`, sinon `default_set`). Unique dans la faction : nouveaux tirages, puis sobriquet, sinon erreur.
 */
export function generateName(s: RegistryState, faction: string, id: string, rng: Rng, b: RegistryBalance): string {
  const setId = b.names.faction_set[faction] ?? b.names.default_set;
  const set = b.names.sets[setId];
  if (!set) throw new RegistryError("table_noms_inconnue");
  const taken = new Set<string>();
  for (const x of Object.values(s.soldiers)) if (x.faction === faction && x.name !== null) taken.add(x.name);
  const draw = (label: string): string => {
    const r = rng.fork(label);
    const given = r.next() < b.names.female_ratio ? r.pick(set.given_f) : r.pick(set.given_m);
    return `${given} ${r.pick(set.family)}`;
  };
  let last = "";
  for (let i = 0; i < b.names.unique_retries; i++) {
    last = draw(`name:${id}:${i}`);
    if (!taken.has(last)) return last;
  }
  for (const nick of set.nicknames) {
    const cand = `${last} dit ${nick}`;
    if (!taken.has(cand)) return cand;
  }
  throw new RegistryError("noms_epuises");
}

function enlist(s: RegistryState, faction: string, squad: string, day: number, rank: string, named: boolean, name: string | null, character: string | null, b: RegistryBalance): { state: RegistryState; id: string } {
  rankOrder(rank, b);
  if (!faction || !squad) throw new RegistryError("faction_ou_escouade_vide");
  const out = cloneRegistry(s);
  out.seq.soldier += 1;
  const id = `${named ? b.ids.named_prefix : b.ids.generated_prefix}${pad(out.seq.soldier, b.ids.pad)}`;
  out.soldiers[id] = {
    id, faction, named, name, rank, squad, status: "vivant", joined: day, battles: 0, lastBattle: null, renown: 0,
    morale: b.troop.start_morale, stress: b.troop.start_stress, refusingUntil: null, missingSince: null, missingReason: null, character, promotedDay: null, death: null,
  };
  out.enlisted[faction] = (out.enlisted[faction] ?? 0) + 1;
  out.events.push({ type: "enlisted", day, soldier: id, named });
  return { state: out, id };
}

export const namedCount = (s: RegistryState, faction: string): number => Object.values(s.soldiers).filter((x) => x.faction === faction && x.named && x.status !== "mort").length;

/** Engage un soldat nommé (gradé, escouade d'élite, personnage connu). Nom fourni, sinon généré. Plafond `troop.named_cap` par faction (vivants et disparus). */
export function enlistNamed(s: RegistryState, o: { faction: string; squad: string; rank: string; day: number; name?: string; character?: string }, rng: Rng, b: RegistryBalance): { state: RegistryState; id: string } {
  if (namedCount(s, o.faction) >= b.troop.named_cap) throw new RegistryError("plafond_nommes");
  const r = enlist(s, o.faction, o.squad, o.day, o.rank, true, o.name ?? null, o.character ?? null, b);
  const x = r.state.soldiers[r.id] as Soldier;
  if (x.name === null) x.name = generateName(s, o.faction, r.id, rng, b);
  else if (Object.values(s.soldiers).some((y) => y.faction === o.faction && y.name === o.name)) throw new RegistryError("nom_deja_pris");
  return r;
}

/** Engage `count` recrues générées dans une escouade : identifiants seulement, aucun nom, rang de départ `ranks.generated_start`. */
export function enlistGenerated(s: RegistryState, o: { faction: string; squad: string; count: number; day: number }, b: RegistryBalance): { state: RegistryState; ids: string[] } {
  if (!Number.isInteger(o.count) || o.count < 1) throw new RegistryError("effectif_invalide");
  let state = s;
  const ids: string[] = [];
  for (let i = 0; i < o.count; i++) {
    const r = enlist(state, o.faction, o.squad, o.day, b.ranks.generated_start, false, null, null, b);
    state = r.state;
    ids.push(r.id);
  }
  return { state, ids };
}

/** Changement d'escouade ou de rang (jamais d'un mort). */
export function reassign(s: RegistryState, id: string, o: { squad?: string; rank?: string }, b: RegistryBalance): RegistryState {
  const x = soldierOf(s, id);
  if (x.status === "mort") throw new RegistryError("soldat_mort");
  if (o.rank !== undefined) rankOrder(o.rank, b);
  const out = cloneRegistry(s);
  const y = out.soldiers[id] as Soldier;
  if (o.squad !== undefined) y.squad = o.squad;
  if (o.rank !== undefined) y.rank = o.rank;
  return out;
}

/** Participation à une bataille : compte les batailles survécues et la renommée (une fois par jour et par soldat). */
export function recordBattle(s: RegistryState, ids: readonly string[], day: number, b: RegistryBalance): RegistryState {
  const out = cloneRegistry(s);
  for (const id of ids) {
    const x = soldierOf(out, id);
    if (x.status !== "vivant") throw new RegistryError("soldat_non_vivant");
    if (x.lastBattle === day) continue;
    x.battles += 1;
    x.lastBattle = day;
    x.renown = Math.min(b.renown.max, x.renown + b.renown.per_battle);
  }
  return out;
}

/** Lien entre deux soldats vivants ou disparus de la même faction ; remplace le lien existant de la paire. */
export function addBond(s: RegistryState, a: string, c: string, kind: string, strength: number, day: number, b: RegistryBalance): RegistryState {
  const x = soldierOf(s, a);
  const y = soldierOf(s, c);
  if (a === c) throw new RegistryError("lien_sur_soi");
  if (x.faction !== y.faction) throw new RegistryError("lien_entre_factions");
  if (x.status === "mort" || y.status === "mort") throw new RegistryError("soldat_mort");
  if (!(kind in b.bonds.kinds)) throw new RegistryError("lien_inconnu");
  if (!Number.isInteger(strength) || strength < 1 || strength > 100) throw new RegistryError("force_invalide");
  const out = cloneRegistry(s);
  out.bonds = out.bonds.filter((l) => !samePair(l, a, c));
  const [p, q] = a < c ? [a, c] : [c, a];
  out.bonds.push({ a: p, b: q, kind, strength, since: day });
  out.bonds.sort((l, m) => (l.a < m.a ? -1 : l.a > m.a ? 1 : l.b < m.b ? -1 : l.b > m.b ? 1 : 0));
  out.events.push({ type: "bond", day, a: p, b: q, kind });
  return out;
}

export const samePair = (l: Bond, a: string, c: string): boolean => (l.a === a && l.b === c) || (l.a === c && l.b === a);
export const bondBetween = (s: RegistryState, a: string, c: string): Bond | null => s.bonds.find((l) => samePair(l, a, c)) ?? null;

/** Disparition (déserteur, patrouille sans nouvelles) : le soldat n'est ni vivant ni mort. */
export function markMissing(s: RegistryState, id: string, day: number, reason: string): RegistryState {
  const x = soldierOf(s, id);
  if (x.status !== "vivant") throw new RegistryError("soldat_non_vivant");
  if (!reason) throw new RegistryError("raison_vide");
  const out = cloneRegistry(s);
  const y = out.soldiers[id] as Soldier;
  y.status = "disparu";
  y.missingSince = day;
  y.missingReason = reason;
  y.refusingUntil = null;
  out.events.push({ type: "missing", day, soldier: id, reason });
  return out;
}

/** Retrouvé vivant : un disparu redevient vivant (un mort ne revient jamais). */
export function markFound(s: RegistryState, id: string, day: number): RegistryState {
  const x = soldierOf(s, id);
  if (x.status !== "disparu") throw new RegistryError("soldat_non_disparu");
  const out = cloneRegistry(s);
  const y = out.soldiers[id] as Soldier;
  y.status = "vivant";
  y.missingSince = null;
  y.missingReason = null;
  out.events.push({ type: "found", day, soldier: id });
  return out;
}

/** Le soldat refuse-t-il les ordres ce jour-là ? (deuil excessif) */
export const refuses = (s: RegistryState, id: string, day: number): boolean => {
  const u = soldierOf(s, id).refusingUntil;
  return u !== null && day < u;
};

/** Poids relatif d'un tirage pondéré par `form_weight`, kinds triés par identifiant (déterministe). */
function pickKind(r: Rng, b: RegistryBalance): string | null {
  const kinds = Object.keys(b.bonds.kinds).sort();
  const total = kinds.reduce((t, k) => t + (b.bonds.kinds[k]?.form_weight ?? 0), 0);
  if (total <= 0) return null;
  let x = r.next() * total;
  for (const k of kinds) {
    x -= b.bonds.kinds[k]?.form_weight ?? 0;
    if (x < 0) return k;
  }
  return kinds[kinds.length - 1] ?? null;
}

/**
 * Un pas de vie de la troupe, au plus une fois par jour : récupération du moral et du stress (vers la valeur d'engagement), fin des refus,
 * liens qui naissent entre camarades d'escouade (assez de jours partagés, tirage), promotion des recrues généreuses en nommées.
 */
export function stepRegistry(s: RegistryState, day: number, rng: Rng, b: RegistryBalance): RegistryState {
  if (day <= s.lastDay) return s;
  const gap = s.lastDay < 0 ? 1 : Math.min(day - s.lastDay, b.recovery.max_gap_days);
  let out = cloneRegistry(s);
  out.lastDay = day;
  const living = Object.values(out.soldiers).filter((x) => x.status === "vivant").sort((x, y) => (x.id < y.id ? -1 : 1));
  for (const x of living) {
    if (x.morale < b.troop.start_morale) x.morale = Math.min(b.troop.start_morale, x.morale + b.recovery.morale_per_day * gap);
    if (x.stress > b.troop.start_stress) x.stress = Math.max(b.troop.start_stress, x.stress - b.recovery.stress_per_day * gap);
    if (x.refusingUntil !== null && day >= x.refusingUntil) x.refusingUntil = null;
  }
  // Liens entre camarades d'escouade.
  const groups = new Map<string, Soldier[]>();
  for (const x of living) {
    const key = `${x.faction}\u0000${x.squad}`;
    groups.set(key, [...(groups.get(key) ?? []), x]);
  }
  for (const g of [...groups.keys()].sort()) {
    const members = groups.get(g) as Soldier[];
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const x = members[i] as Soldier;
        const y = members[j] as Soldier;
        if (bondBetween(out, x.id, y.id)) continue;
        if (day - Math.max(x.joined, y.joined) < b.bonds.form.min_shared_days) continue;
        const r = rng.fork(`bond:${x.id}:${y.id}:${day}`);
        if (r.next() >= b.bonds.form.chance) continue;
        const kind = pickKind(r, b);
        if (kind === null) continue;
        out = addBond(out, x.id, y.id, kind, r.int(b.bonds.form.strength_min, b.bonds.form.strength_max), day, b);
      }
    }
  }
  // Promotions : recrues générées qui ont survécu assez longtemps, jusqu'au plafond de nommés.
  for (const faction of [...new Set(living.map((x) => x.faction))].sort()) {
    let count = namedCount(out, faction);
    let promoted = 0;
    const eligible = Object.values(out.soldiers)
      .filter((x) => x.faction === faction && x.status === "vivant" && !x.named && day - x.joined >= b.promotion.min_days && x.battles >= b.promotion.min_battles)
      .sort((x, y) => y.battles - x.battles || (x.id < y.id ? -1 : 1));
    for (const c of eligible) {
      if (count >= b.troop.named_cap || promoted >= b.promotion.max_per_step) break;
      if (rng.fork(`promo:${c.id}:${day}`).next() >= b.promotion.chance) continue;
      const name = generateName(out, faction, c.id, rng, b);
      const x = out.soldiers[c.id] as Soldier;
      x.named = true;
      x.name = name;
      x.promotedDay = day;
      x.renown = Math.min(b.renown.max, x.renown + b.promotion.renown);
      if (rankOrder(x.rank, b) < rankOrder(b.ranks.promoted, b)) x.rank = b.ranks.promoted;
      out.events.push({ type: "promoted", day, soldier: x.id, name });
      count += 1;
      promoted += 1;
    }
  }
  return out;
}
