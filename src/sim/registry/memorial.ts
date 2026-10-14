import type { RegistryBalance } from "../../data/balance";
import type { Rng } from "../core/rng";
import { cloneRegistry } from "./troop";
import { RegistryError } from "./types";
import type { DeathFile, RegistryState, Stele } from "./types";

const pad = (n: number): string => String(n).padStart(3, "0");

/** Érige une stèle pour une faction à un lieu. Titre et épitaphe tirés d'un fork du Rng d'après l'identifiant ; le coût (capital) est renvoyé à l'appelant. */
export function raiseStele(s: RegistryState, faction: string, place: string, day: number, rng: Rng, b: RegistryBalance): { state: RegistryState; id: string; cost: number } {
  if (!faction || !place) throw new RegistryError("faction_ou_lieu_vide");
  if (s.steles.filter((x) => x.faction === faction).length >= b.stele.max_per_faction) throw new RegistryError("trop_de_steles");
  const out = cloneRegistry(s);
  out.seq.stele += 1;
  const id = `ste_${pad(out.seq.stele)}`;
  const r = rng.fork(`stele:${id}`);
  const stele: Stele = { id, faction, place, title: r.pick(b.stele.titles).replace("{place}", place), epitaph: r.pick(b.stele.epitaphs), day, inscribed: [] };
  out.steles.push(stele);
  out.events.push({ type: "stele", day, stele: id });
  return { state: out, id, cost: b.stele.cost };
}

function put(out: RegistryState, stele: Stele, file: DeathFile, day: number): void {
  stele.inscribed.push(file.soldier);
  file.inscribed = stele.id;
  out.events.push({ type: "inscribed", day, stele: stele.id, soldier: file.soldier });
}

/** Grave un mort (nommé ou généré) sur une stèle de sa faction : une fois, dans la limite de la capacité. */
export function inscribe(s: RegistryState, steleId: string, soldierId: string, day: number, b: RegistryBalance): RegistryState {
  const out = cloneRegistry(s);
  const stele = out.steles.find((x) => x.id === steleId);
  if (!stele) throw new RegistryError("stele_inconnue");
  const file = out.deaths.find((d) => d.soldier === soldierId);
  if (!file) throw new RegistryError("pas_de_dossier_de_mort");
  if (file.faction !== stele.faction) throw new RegistryError("stele_autre_faction");
  if (file.inscribed !== null) throw new RegistryError("deja_grave");
  if (stele.inscribed.length >= b.stele.capacity) throw new RegistryError("stele_pleine");
  put(out, stele, file, day);
  return out;
}

/** Gravure automatique d'un nommé (si `stele.auto_named`) : stèle du lieu de sa mort si elle a de la place, sinon la première stèle de la faction avec de la place. Modifie `out`. */
export function autoInscribe(out: RegistryState, file: DeathFile, day: number, b: RegistryBalance): void {
  if (!b.stele.auto_named || !file.named) return;
  const open = out.steles.filter((x) => x.faction === file.faction && x.inscribed.length < b.stele.capacity);
  const target = open.find((x) => x.place === file.place) ?? open[0];
  if (target) put(out, target, file, day);
}

/** Effet d'un mort sur la mémoire publique (poids 1, avant décroissance et stèle). */
export function deathImpact(f: DeathFile, b: RegistryBalance): { opinion: number; legitimacy: number; recruit: number } {
  const cause = b.causes[f.cause];
  if (!cause) throw new RegistryError("cause_inconnue");
  const opinion = (f.named ? b.opinion.per_named + f.renown * b.opinion.renown_scale : b.opinion.per_generated) * cause.opinion;
  // Un personnage politique a déjà subi son deuil de légitimité (characterDies) : pas de double compte.
  const legitimacy = f.named && f.political === null ? (b.legitimacy.named_base + f.renown * b.legitimacy.per_renown) * cause.opinion : 0;
  return { opinion, legitimacy, recruit: f.named ? b.recruitment.per_named_loss : b.recruitment.per_loss };
}

/** Poids de mémoire d'un mort à `today` : décroissance par demi-vie, nul hors de la fenêtre ou avant la mort. */
export function memoryWeight(deathDay: number, today: number, b: RegistryBalance): number {
  const age = today - deathDay;
  if (age < 0 || age > b.memory.window_days) return 0;
  return Math.pow(0.5, age / b.memory.half_life_days);
}

/**
 * Réaction d'une faction à ses pertes : décalage d'opinion publique (≤ 0) et de légitimité (≤ 0), facteur de recrutement.
 * Les morts gravés pèsent moins (soulagement de stèle) et chaque nom gravé aide le recrutement. Ne regarde que les morts de la faction.
 */
export function standing(s: RegistryState, faction: string, today: number, b: RegistryBalance): { opinion: number; legitimacy: number; recruitment: number } {
  let opinion = 0;
  let legitimacy = 0;
  let loss = 0;
  let engraved = 0;
  for (const f of s.deaths) {
    if (f.faction !== faction) continue;
    if (f.inscribed !== null) engraved += 1;
    const w = memoryWeight(f.day, today, b);
    if (w === 0) continue;
    const imp = deathImpact(f, b);
    const on = f.inscribed !== null;
    opinion += imp.opinion * w * (on ? 1 - b.stele.opinion_relief : 1);
    legitimacy += imp.legitimacy * w * (on ? 1 - b.stele.legitimacy_relief : 1);
    loss += imp.recruit * w;
  }
  const bonus = b.stele.recruit_bonus * Math.min(engraved, b.stele.bonus_cap);
  return {
    opinion: 0 - Math.min(b.opinion.cap, opinion),
    legitimacy: 0 - Math.min(b.legitimacy.cap, legitimacy),
    recruitment: Math.max(b.recruitment.min_factor, Math.min(b.recruitment.max_factor, 1 - loss + bonus)),
  };
}
