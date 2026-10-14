import type { RegistryBalance } from "../../data/balance";
import type { Rng } from "../core/rng";
import { autoInscribe } from "./memorial";
import { openSuccession } from "./succession";
import { bondBetween, clamp100, cloneRegistry, getSoldier, isLeaderRank } from "./troop";
import { RegistryError } from "./types";
import type { DeathFile, DeathInput, Mourner, RegistryState, Soldier } from "./types";

/**
 * Enregistre une mort (02 §9.3 : pas de mort propre). Refuse toute mort sans cause connue de `registry.json › causes`, sans lieu ni circonstances.
 * Produit un dossier complet, applique le deuil (liens → moral et stress ; camarades d'escouade ; témoins), refus d'ordres et désertion
 * (tirage d'un fork du Rng), ouvre la succession si un chef tombe, grave un nommé sur une stèle (`stele.auto_named`).
 * Un mort ne meurt qu'une fois ; un disparu dont la mort est confirmée passe à « mort ».
 */
export function registerDeath(s: RegistryState, input: DeathInput, rng: Rng, b: RegistryBalance): { state: RegistryState; file: DeathFile } {
  const dead0 = getSoldier(s, input.soldier);
  if (dead0.status === "mort") throw new RegistryError("deja_mort");
  const cause = b.causes[input.cause];
  if (!cause) throw new RegistryError("cause_inconnue");
  if (!input.place.trim()) throw new RegistryError("lieu_vide");
  if (!input.circumstances.trim()) throw new RegistryError("circonstances_vides");
  if (input.day < dead0.joined) throw new RegistryError("mort_avant_engagement");
  const witnesses = [...new Set(input.witnesses ?? [])].sort();
  for (const w of witnesses) {
    const x = s.soldiers[w];
    if (!x || x.status !== "vivant" || x.faction !== dead0.faction || w === input.soldier) throw new RegistryError("temoin_invalide");
  }
  const out = cloneRegistry(s);
  const dead = out.soldiers[input.soldier] as Soldier;
  const day = input.day;
  const namedF = dead.named ? b.mourning.named_factor : 1;
  const shockF = cause.shock * namedF * (isLeaderRank(dead.rank, b) ? b.mourning.leader_factor : 1);

  const mourners: Mourner[] = [];
  const living = Object.values(out.soldiers).filter((x) => x.faction === dead.faction && x.status === "vivant" && x.id !== dead.id).sort((p, q) => (p.id < q.id ? -1 : 1));
  for (const m of living) {
    const bond = bondBetween(out, m.id, dead.id);
    const kind = bond ? (b.bonds.kinds[bond.kind] ?? null) : null;
    const witness = witnesses.includes(m.id);
    let dm = 0;
    let ds = 0;
    if (bond && kind) {
      dm += kind.morale_delta * (bond.strength / 100) * cause.grief * namedF;
      ds += kind.stress_delta * (bond.strength / 100) * cause.grief * namedF;
    } else if (m.squad === dead.squad) {
      dm -= b.mourning.squad_morale * shockF;
      ds += b.mourning.squad_stress * shockF;
    }
    if (witness) {
      dm -= b.mourning.witness_morale * cause.shock;
      ds += b.mourning.witness_stress * cause.shock;
    }
    if (dm === 0 && ds === 0 && !witness) continue;
    m.morale = clamp100(m.morale + dm);
    m.stress = clamp100(m.stress + ds);
    let outcome: Mourner["outcome"] = "aucun";
    if (m.morale <= b.breaking.desert_morale && rng.fork(`desert:${m.id}:${day}`).next() < b.breaking.desert_chance) {
      m.status = "disparu";
      m.missingSince = day;
      m.missingReason = "desertion";
      outcome = "desertion";
      out.events.push({ type: "desertion", day, soldier: m.id });
    } else if (m.stress >= b.breaking.refuse_stress && !(m.refusingUntil !== null && day < m.refusingUntil)) {
      m.refusingUntil = day + b.breaking.refusal_days;
      outcome = "refus";
      out.events.push({ type: "refusal", day, soldier: m.id, until: m.refusingUntil });
    }
    mourners.push({ id: m.id, kind: bond?.kind ?? null, moraleDelta: dm, stressDelta: ds, outcome });
  }

  out.seq.file += 1;
  const file: DeathFile = {
    id: `dos_${String(out.seq.file).padStart(4, "0")}`,
    soldier: dead.id, faction: dead.faction, name: dead.name, named: dead.named, renown: dead.renown, rank: dead.rank, squad: dead.squad,
    day, cause: input.cause, place: input.place, circumstances: input.circumstances, witnesses, mourners, succession: null, inscribed: null, political: null,
  };
  dead.status = "mort";
  dead.death = file.id;
  dead.missingSince = null;
  dead.missingReason = null;
  dead.refusingUntil = null;
  out.deaths.push(file);
  out.events.push({ type: "death", day, soldier: dead.id, cause: input.cause, file: file.id });
  if (isLeaderRank(dead.rank, b)) file.succession = openSuccession(out, dead, day, b);
  autoInscribe(out, file, day, b);
  return { state: out, file };
}

/**
 * Interaction avec le dossier de mort politique (`characterDies` de `politics/characters.ts`) : enregistre la mort du soldat lié au personnage,
 * avec la cause et les circonstances de son `DeathRecord`, dont les clés de conséquences sont reprises sans être rejouées (le stress des
 * personnages, la légitimité et les postes vacants restent traités côté politique ; ici seulement la troupe, l'opinion et le recrutement).
 */
export function registerCharacterDeath(
  s: RegistryState,
  input: { character: string; day: number; place: string; witnesses?: string[]; record: { cause: string; circumstances: string; divergence: boolean; consequences: readonly { key: string }[] } },
  rng: Rng,
  b: RegistryBalance,
): { state: RegistryState; file: DeathFile } {
  const dead = Object.values(s.soldiers).find((x) => x.character === input.character && x.status !== "mort");
  if (!dead) throw new RegistryError("personnage_sans_soldat");
  const r = registerDeath(s, { soldier: dead.id, day: input.day, cause: input.record.cause, place: input.place, circumstances: input.record.circumstances, ...(input.witnesses ? { witnesses: input.witnesses } : {}) }, rng, b);
  const file = r.state.deaths[r.state.deaths.length - 1] as DeathFile;
  file.political = { divergence: input.record.divergence, consequences: input.record.consequences.map((c) => c.key) };
  return { state: r.state, file };
}
