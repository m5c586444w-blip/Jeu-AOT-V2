import type { RegistryBalance } from "../../data/balance";
import { clamp100, cloneRegistry, bondBetween, rankOrder } from "./troop";
import { RegistryError } from "./types";
import type { RegistryState, Soldier, Succession } from "./types";

/** Score d'un candidat : rang, renommée, batailles ; `interested` : un lien de rivalité ou de haine avec le défunt lui donne un intérêt propre (bonus). */
export function candidateScore(s: RegistryState, c: Soldier, vacated: string, b: RegistryBalance): { score: number; interested: boolean } {
  const bond = bondBetween(s, c.id, vacated);
  const interested = bond !== null && b.bonds.kinds[bond.kind]?.succession_interest === true;
  const score = rankOrder(c.rank, b) * b.succession.rank_weight + c.renown * b.succession.renown_weight + c.battles * b.succession.battles_weight + (interested ? b.succession.interest_bonus : 0);
  return { score, interested };
}

/** Ouvre une succession dans l'escouade du chef mort (modifie `out`) ; renvoie son identifiant, ou null si personne ne reste. */
export function openSuccession(out: RegistryState, dead: Soldier, day: number, b: RegistryBalance): string | null {
  const pool = Object.values(out.soldiers)
    .filter((x) => x.faction === dead.faction && x.squad === dead.squad && x.status === "vivant")
    .map((x) => ({ id: x.id, ...candidateScore(out, x, dead.id, b) }))
    .sort((p, q) => q.score - p.score || (p.id < q.id ? -1 : 1))
    .slice(0, b.succession.max_candidates);
  if (pool.length === 0) return null;
  out.seq.succession += 1;
  const id = `suc_${String(out.seq.succession).padStart(3, "0")}`;
  const entry: Succession = { id, faction: dead.faction, squad: dead.squad, vacated: dead.id, rank: dead.rank, day, candidates: pool, appointed: null };
  out.successions.push(entry);
  out.events.push({ type: "succession_open", day, succession: id });
  return id;
}

/** Choix de l'IA : le meilleur score (égalité : plus petit identifiant). */
export function suggestSuccessor(s: RegistryState, successionId: string): string | null {
  const x = s.successions.find((y) => y.id === successionId);
  if (!x) throw new RegistryError("succession_inconnue");
  return x.candidates.filter((c) => s.soldiers[c.id]?.status === "vivant")[0]?.id ?? null;
}

/**
 * Nomme un candidat : il prend le rang du défunt ; les autres candidats écartés perdent du moral (davantage s'ils avaient un intérêt propre).
 */
export function appoint(s: RegistryState, successionId: string, soldierId: string, day: number, b: RegistryBalance): RegistryState {
  const out = cloneRegistry(s);
  const suc = out.successions.find((x) => x.id === successionId);
  if (!suc) throw new RegistryError("succession_inconnue");
  if (suc.appointed !== null) throw new RegistryError("succession_close");
  const pick = suc.candidates.find((c) => c.id === soldierId);
  const chosen = out.soldiers[soldierId];
  if (!pick || !chosen || chosen.status !== "vivant") throw new RegistryError("candidat_invalide");
  chosen.rank = suc.rank;
  suc.appointed = soldierId;
  for (const c of suc.candidates) {
    if (c.id === soldierId) continue;
    const x = out.soldiers[c.id];
    if (x?.status !== "vivant") continue;
    x.morale = clamp100(x.morale - b.succession.passed_over_morale * (c.interested ? b.succession.interest_factor : 1));
  }
  out.events.push({ type: "appointed", day, succession: successionId, soldier: soldierId });
  return out;
}
