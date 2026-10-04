import type { Character } from "../../data/schemas";
import type { GameDate } from "../core/time";
import { pushLog } from "../strategic/economy";
import type { StrategicState } from "../strategic/economy";
import type { PoliticsWorld, World } from "../strategic/world";
import { absDay, allTraits, clamp, effectiveAttributes, isPresent, politicsWorld } from "./state";
import type { CharacterState, Consequence, DeathRecord, PoliticalState } from "./state";
import { WARM_RELATIONS } from "./vocabulary";

export const DEATH_CAUSES = ["combat", "maladie", "assassinat", "accident", "execution", "suicide", "inconnue", "devore", "malediction"] as const;
export type DeathCause = (typeof DEATH_CAUSES)[number];

const TRAIT_EXHAUSTED = "trait_epuise";
const TRAIT_TRAUMA = "trait_blessure_psychique";

/** Multiplicateur de stress d'un personnage (traits de naissance et acquis). */
export function stressGain(pw: PoliticsWorld, c: Character, cs: CharacterState): number {
  return allTraits(c, cs).reduce((m, t) => m * (pw.traits.get(t)?.stress_gain ?? 1), 1);
}

function addStress(pw: PoliticsWorld, c: Character, cs: CharacterState, amount: number): number {
  const gained = amount * stressGain(pw, c, cs);
  cs.stress = clamp(cs.stress + gained);
  return gained;
}

/** Relations du personnage `a` envers `b`, dans les deux sens (une relation déclarée d'un côté vaut des deux). */
export function relationBetween(pw: PoliticsWorld, a: string, b: string): { type: string; strength: number } | null {
  const direct = pw.characters.get(a)?.relations.find((r) => r.to === b);
  if (direct) return direct;
  const reverse = pw.characters.get(b)?.relations.find((r) => r.to === a);
  return reverse ?? null;
}

/** Postes tenus par un personnage. */
export function postsOf(pol: PoliticalState, id: string): { kind: "role" | "org"; id: string }[] {
  const out: { kind: "role" | "org"; id: string }[] = [];
  for (const [role, who] of Object.entries(pol.roles)) if (who === id) out.push({ kind: "role", id: role });
  for (const [org, s] of Object.entries(pol.orgs)) if (s.leader === id) out.push({ kind: "org", id: org });
  return out;
}

/** Candidats à un poste (F-POL-04) : présents, vivants, hors recrues, classés par aptitude. */
export function shortlist(world: World, pol: PoliticalState, post: { kind: "role" | "org"; id: string }, year: number): string[] {
  const pw = politicsWorld(world);
  const n = pw.balance.nominations.candidates;
  const holders = new Set(Object.values(pol.roles).filter(Boolean) as string[]);
  const scored: { id: string; score: number }[] = [];
  for (const c of pw.characters.values()) {
    const cs = pol.characters[c.id];
    if (!cs?.alive || !isPresent(c, cs, year) || (c.active_until !== undefined && c.active_until < year)) continue;
    if (c.rank_key === "rank.cadet" || c.faction !== "paradis" || c.id === pol.player || holders.has(c.id)) continue;
    if (post.kind === "org" && c.org !== post.id) continue;
    const a = effectiveAttributes(pw, c, cs);
    const score = post.kind === "org" ? a.command + a.charisma : a.intellect + a.command * 0.5 + a.charisma * 0.5 + cs.loyalty * 0.3;
    scored.push({ id: c.id, score });
  }
  return scored.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id)).slice(0, n).map((x) => x.id);
}

/** Ouvre une nomination pour un poste vacant. */
export function openNomination(world: World, pol: PoliticalState, post: { kind: "role" | "org"; id: string }, date: GameDate): void {
  if (pol.nominations.some((n) => n.post.kind === post.kind && n.post.id === post.id)) return;
  pol.nominationSeq += 1;
  pol.nominations.push({ id: pol.nominationSeq, post, candidates: shortlist(world, pol, post, date.year), opened: absDay(date) });
}

/** Libère les postes d'un personnage et ouvre les nominations correspondantes. */
export function vacatePosts(world: World, pol: PoliticalState, id: string, date: GameDate): { kind: "role" | "org"; id: string }[] {
  const posts = postsOf(pol, id);
  for (const p of posts) {
    if (p.kind === "role") pol.roles[p.id] = null;
    else {
      const org = pol.orgs[p.id];
      if (org) org.leader = null;
    }
  }
  pol.cabinetExtra = pol.cabinetExtra.filter((x) => x !== id);
  for (const p of posts) openNomination(world, pol, p, date);
  return posts;
}

/**
 * Mort définitive (F-CHR-04) : dossier, deuil des proches (stress), deuil politique (légitimité selon la notoriété),
 * perte de loyauté de l'organisation qu'il dirigeait, postes vacants → nominations, avertissement de divergence (F-LOR-09).
 */
export function characterDies(world: World, pol: PoliticalState, st: StrategicState, date: GameDate, id: string, cause: DeathCause, circumstances: string): { state: PoliticalState; strategic: StrategicState } {
  const pw = politicsWorld(world);
  const c = pw.characters.get(id);
  if (!c || !pol.characters[id]) throw new Error(`Personnage inconnu : ${id}`);
  if (!pol.characters[id].alive) throw new Error("Ce personnage est déjà mort.");
  const next = structuredClone(pol);
  const strat = structuredClone(st);
  const cs = next.characters[id] as CharacterState;
  cs.alive = false;
  const consequences: Consequence[] = [];
  const today = absDay(date);
  const db = pw.balance.deaths;

  // Proches : stress et colère contre le pouvoir ; rivaux : soulagement.
  for (const other of pw.characters.values()) {
    if (other.id === id) continue;
    const os = next.characters[other.id];
    if (!os?.alive) continue;
    const rel = relationBetween(pw, other.id, id);
    if (!rel) continue;
    if ((WARM_RELATIONS as readonly string[]).includes(rel.type) && rel.strength > 0) {
      const gained = addStress(pw, other, os, pw.balance.stress.friend_death * (rel.strength / 100));
      os.loyalty = clamp(os.loyalty + db.friend_loyalty);
      consequences.push({ key: "death.csq_grief", params: { who: other.name, stress: Math.round(gained) } });
    } else if (rel.strength < 0) {
      os.stress = clamp(os.stress - 5);
      consequences.push({ key: "death.csq_relief", params: { who: other.name } });
    }
  }
  // Deuil politique.
  const legitimacyHit = -c.fame * db.legitimacy_per_fame;
  if (legitimacyHit < 0) {
    next.mourning.push({ target: "legitimacy", key: "why.mourning", params: { name: c.name }, start: today, value: legitimacyHit, days: db.mourning.days });
    consequences.push({ key: "death.csq_legitimacy", params: { n: Math.round(legitimacyHit) } });
  }
  for (const [orgId, org] of Object.entries(next.orgs)) {
    if (org.leader !== id) continue;
    next.mourning.push({ target: `org_loyalty:${orgId}`, key: "why.mourning_leader", params: { name: c.name }, start: today, value: db.org_leader.value, days: db.org_leader.days });
    consequences.push({ key: "death.csq_org", params: { org: pw.organisations.get(orgId)?.name_key ?? orgId, n: db.org_leader.value } });
  }
  const posts = vacatePosts(world, next, id, date);
  for (const p of posts) consequences.push({ key: "death.csq_vacancy", params: { post: p.kind === "role" ? (pw.roles.find((r) => r.id === p.id)?.name_key ?? p.id) : (pw.organisations.get(p.id)?.name_key ?? p.id) } });
  // Fenêtre de présence : toute mort hors d'un événement canon est une divergence assumée.
  const divergence = !(c.active_until !== undefined && c.active_until === date.year && c.death_event === undefined);
  if (divergence) {
    consequences.push({ key: c.death_event ? "death.csq_divergence_event" : "death.csq_divergence_alive", params: { event: c.death_event ?? "", year: c.active_until ?? "" } });
    pushLog(strat, date, "alert.divergence_death", { name: c.name }, true);
  }
  const record: DeathRecord = { date: { ...date }, cause, circumstances, consequences, divergence };
  cs.death = record;
  pushLog(strat, date, "alert.character_died", { name: c.name, cause: `death.cause.${cause}` }, true);
  return { state: next, strategic: strat };
}

/** Nomination (F-POL-04) : le candidat prend le poste ; les autres gardent une rancœur. */
export function nominate(world: World, pol: PoliticalState, st: StrategicState, date: GameDate, nominationId: number, candidate: string): { state: PoliticalState; strategic: StrategicState } {
  const pw = politicsWorld(world);
  const nom = pol.nominations.find((n) => n.id === nominationId);
  if (!nom) throw new Error("Nomination inconnue.");
  if (!nom.candidates.includes(candidate)) throw new Error("Ce personnage ne figure pas sur la liste.");
  const next = structuredClone(pol);
  const strat = structuredClone(st);
  if (nom.post.kind === "role") next.roles[nom.post.id] = candidate;
  else {
    const org = next.orgs[nom.post.id];
    if (org) org.leader = candidate;
  }
  for (const other of nom.candidates) {
    if (other === candidate) continue;
    const os = next.characters[other];
    if (os) os.loyalty = clamp(os.loyalty + pw.balance.nominations.resentment);
  }
  const chosen = next.characters[candidate];
  if (chosen) chosen.loyalty = clamp(chosen.loyalty + 5);
  next.nominations = next.nominations.filter((n) => n.id !== nominationId);
  const postKey = nom.post.kind === "role" ? (pw.roles.find((r) => r.id === nom.post.id)?.name_key ?? nom.post.id) : (pw.organisations.get(nom.post.id)?.name_key ?? nom.post.id);
  pushLog(strat, date, "alert.nominated", { name: pw.characters.get(candidate)?.name ?? candidate, post: postKey }, false);
  return { state: next, strategic: strat };
}

/** Démission d'un titulaire (stress extrême, refus répétés) : postes vacants, journal. */
export function resign(world: World, pol: PoliticalState, st: StrategicState, date: GameDate, id: string, reason: string): void {
  const pw = politicsWorld(world);
  const posts = vacatePosts(world, pol, id, date);
  if (posts.length > 0) pushLog(st, date, "alert.resigned", { name: pw.characters.get(id)?.name ?? id, reason }, true);
}

/** Tick quotidien des personnages : stress (02 §9.3), seuils, fenêtres de présence (F-LOR-09). */
export function tickCharacters(world: World, pol: PoliticalState, st: StrategicState, date: GameDate): void {
  const pw = politicsWorld(world);
  const sb = pw.balance.stress;
  const famine = st.shortages.includes("food");
  const advisors = new Set(Object.values(pol.roles).filter(Boolean) as string[]);
  for (const c of pw.characters.values()) {
    const cs = pol.characters[c.id];
    if (!cs?.alive) continue;
    cs.stress = clamp(cs.stress - sb.decay_per_day);
    if (famine && advisors.has(c.id)) addStress(pw, c, cs, sb.famine_per_day);
    const has = (t: string): boolean => cs.acquired.includes(t);
    if (cs.stress >= sb.exhausted && !has(TRAIT_EXHAUSTED)) {
      cs.acquired.push(TRAIT_EXHAUSTED);
      pushLog(st, date, "alert.exhausted", { name: c.name }, false);
    } else if (cs.stress < sb.exhausted - 10 && has(TRAIT_EXHAUSTED)) {
      cs.acquired = cs.acquired.filter((t) => t !== TRAIT_EXHAUSTED);
    }
    if (cs.stress >= sb.trauma && !has(TRAIT_TRAUMA)) {
      cs.acquired.push(TRAIT_TRAUMA);
      pushLog(st, date, "alert.trauma", { name: c.name }, true);
    }
    if (cs.stress >= sb.breakdown && postsOf(pol, c.id).length > 0) resign(world, pol, st, date, c.id, "resign.breakdown");
    if (!cs.divergenceReported && c.active_until !== undefined && date.year > c.active_until) {
      cs.divergenceReported = true;
      pushLog(st, date, "alert.divergence_alive", { name: c.name, year: c.active_until }, false);
    }
  }
}

/** Ajoute du stress à un personnage (événements, refus, défaites de vote). */
export function stressCharacter(world: World, pol: PoliticalState, id: string, amount: number): void {
  const pw = politicsWorld(world);
  const c = pw.characters.get(id);
  const cs = pol.characters[id];
  if (c && cs?.alive) addStress(pw, c, cs, amount);
}
