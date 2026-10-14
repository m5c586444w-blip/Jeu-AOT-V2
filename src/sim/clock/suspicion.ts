import type { ClockBalance } from "../../data/balance";
import type { Bearer, BearerInput, ClockEvent, ClockState, EvidenceKind, SuspectRecord, SuspicionLevel } from "./types";

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Copie d'un registre sans la clé donnée. */
export const without = <T>(rec: Record<string, T>, key: string): Record<string, T> => Object.fromEntries(Object.entries(rec).filter(([k]) => k !== key));

export const cloneClock = (s: ClockState): ClockState => structuredClone(s);

export function createClockState(): ClockState {
  return { bearers: {}, suspects: {}, events: [] };
}

/**
 * Enregistre un porteur (nouvel héritier compris). Sa couverture vient de son rôle ; sa faction connaît son identité.
 * Les soupçons antérieurs sur ce personnage sont effacés : c'est une nouvelle identité secrète (héritage).
 */
export function registerBearer(s: ClockState, input: BearerInput, b: ClockBalance): ClockState {
  const cover = b.cover.initial[input.role];
  if (cover === undefined) throw new RangeError(`clock : rôle de couverture inconnu « ${input.role} »`);
  const out = cloneClock(s);
  const bearer: Bearer = {
    id: input.id,
    faction: input.faction,
    role: input.role,
    cover,
    will: clamp(input.will, 0, 100),
    stress: clamp(input.stress, 0, 100),
    bonds: clamp(input.bonds, 0, 100),
    convictions: { ...(input.convictions ?? {}) },
    wearYears: 0,
    exposedTo: [input.faction],
  };
  out.bearers[input.id] = bearer;
  out.suspects = without(out.suspects, input.id);
  return out;
}

/** Met à jour l'état d'esprit d'un porteur (volonté, stress, liens, convictions) ; borné à 0..100. */
export function updateMind(s: ClockState, id: string, patch: Partial<Pick<Bearer, "will" | "stress" | "bonds" | "convictions">>): ClockState {
  const cur = s.bearers[id];
  if (!cur) return s;
  const out = cloneClock(s);
  const t = out.bearers[id] as Bearer;
  if (patch.will !== undefined) t.will = clamp(patch.will, 0, 100);
  if (patch.stress !== undefined) t.stress = clamp(patch.stress, 0, 100);
  if (patch.bonds !== undefined) t.bonds = clamp(patch.bonds, 0, 100);
  if (patch.convictions !== undefined) t.convictions = { ...patch.convictions };
  return out;
}

export function levelOf(value: number, b: ClockBalance): SuspicionLevel {
  if (value >= b.suspicion.strong_threshold) return "fort";
  if (value >= b.suspicion.suspect_threshold) return "soupcon";
  return "aucun";
}

export const isExposedTo = (bearer: Bearer, observer: string): boolean => bearer.exposedTo.includes(observer);

/**
 * Une preuve s'ajoute à la suspicion de `observer` envers `target`. Gain = poids × (1 − cover_k × couverture/100) pour un porteur ;
 * la couverture s'érode de `cover_loss_per_point` par point de gain. Au seuil de démasquage : un porteur est démasqué pour cet
 * observateur (couverture à `after_unmask`) ; un innocent déclenche une fausse accusation. Dans les deux cas le dossier est clos.
 * Sans effet : la propre faction du porteur, un observateur qui sait déjà, un dossier clos.
 * Biais de couverture évité : le niveau affiché (`shown`) somme les poids bruts, sans couverture ; seul `value` (interne) en dépend et
 * déclenche le démasquage. Un porteur couvert et un innocent ont donc la même suite de niveaux visibles à preuves égales.
 * Limite assumée [A] : à l'observateur qui sait déjà, l'état interne reste inchangé (aucun dossier) alors qu'un innocent en reçoit un ;
 * ni la vue ni les événements de l'observateur ne diffèrent (testé).
 */
export function addEvidence(s: ClockState, target: string, observer: string, kind: EvidenceKind, day: number, b: ClockBalance): ClockState {
  const weight = b.suspicion.evidence[kind];
  if (weight === undefined) throw new RangeError(`clock : preuve inconnue « ${kind} »`);
  const bearer = s.bearers[target];
  if (bearer && isExposedTo(bearer, observer)) return s;
  const prev = s.suspects[target]?.[observer];
  if (prev?.closed) return s;
  const out = cloneClock(s);
  const gain = bearer ? weight * (1 - (b.suspicion.cover_k * bearer.cover) / 100) : weight;
  const rec: SuspectRecord = { value: Math.min(100, (prev?.value ?? 0) + gain), shown: Math.min(100, (prev?.shown ?? 0) + weight), lastEvidenceDay: day, closed: false };
  const row = (out.suspects[target] ??= {});
  row[observer] = rec;
  const ob = out.bearers[target];
  if (ob) ob.cover = Math.max(0, ob.cover - b.suspicion.cover_loss_per_point * gain);
  if (rec.value >= b.suspicion.unmask_threshold) {
    rec.closed = true;
    let ev: ClockEvent;
    if (ob) {
      ob.exposedTo = [...ob.exposedTo, observer].sort();
      ob.cover = b.cover.after_unmask;
      ev = { type: "unmasked", day, bearer: target, observer };
    } else ev = { type: "false_accusation", day, target, observer };
    out.events.push(ev);
  }
  return out;
}

/** Jour sans preuve : après `quiet_days` jours de calme, chaque suspicion ouverte décroît de `decay_per_day`. */
export function stepSuspicionDay(s: ClockState, day: number, b: ClockBalance): ClockState {
  const out = cloneClock(s);
  for (const target of Object.keys(out.suspects).sort()) {
    const row = out.suspects[target] as Record<string, SuspectRecord>;
    for (const obs of Object.keys(row).sort()) {
      const r = row[obs] as SuspectRecord;
      if (r.closed || (r.value <= 0 && r.shown <= 0) || day - r.lastEvidenceDay < b.suspicion.quiet_days) continue;
      r.value = Math.max(0, r.value - b.suspicion.decay_per_day);
      r.shown = Math.max(0, r.shown - b.suspicion.decay_per_day);
    }
  }
  return out;
}

/** Événements visibles par une faction : ceux dont elle est l'observatrice. Ni le porteur ni l'observateur d'autrui n'y figurent. */
export const eventsForFaction = (s: ClockState, faction: string): ClockEvent[] => s.events.filter((e) => e.observer === faction);
