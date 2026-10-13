// Coordination des deux sessions automatiques (docs/coord/PROTOCOLE.md) : fenêtres horaires de Paris et verrou.
// Fonctions pures (l'heure est passée en argument) ; l'écriture et git sont dans coord.ts.
import { z } from "zod";

export type Session = "A" | "B";
export type Phase = "hors-fenetre" | "travail" | "plus-de-nouvelle-tache" | "cloture";

/** Fenêtres (heure de Paris) : A de 00:00 à 08:00, B de 08:00 à 16:00 ; 16:00–24:00 : aucune session automatique. */
export const FENETRES: Record<Session, { debut: number; fin: number }> = {
  A: { debut: 0, fin: 8 * 60 },
  B: { debut: 8 * 60, fin: 16 * 60 },
};
/** Plus de nouvelle tâche à partir de T−45 min ; clôture obligatoire à partir de T−20 min. */
export const MINUTES_SANS_NOUVELLE_TACHE = 45;
export const MINUTES_CLOTURE = 20;
/**
 * Un verrou sans battement depuis plus de 75 min est périmé (le titulaire pousse un battement au moins toutes les
 * 30 min) ; 30 min si la fenêtre de son titulaire est terminée. Cela vaut aussi pour une même lettre : un
 * déclenchement de relais est toujours une instance neuve, qui ne peut pas supposer que le verrou est « le sien ».
 */
export const PEREMPTION_MIN = 75;
export const PEREMPTION_FENETRE_TERMINEE_MIN = 30;
/** Un verrou posé à la main par Gabriel est respecté 6 h. */
export const PEREMPTION_GABRIEL_MIN = 360;

export interface Fenetre {
  heureParis: string;
  session: Session | null;
  /** Minutes restantes avant la fin de la fenêtre courante (null hors fenêtre). */
  minutesRestantes: number | null;
  phase: Phase;
}

/** Heure et minute civiles à Paris (gère l'heure d'été), sans dépendre du fuseau de la machine. */
export function heureParis(date: Date): { heure: number; minute: number; texte: string } {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "00";
  const heure = Number(get("hour"));
  const minute = Number(get("minute"));
  return { heure, minute, texte: `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}` };
}

export function fenetre(date: Date): Fenetre {
  const { heure, minute, texte } = heureParis(date);
  const t = heure * 60 + minute;
  for (const s of ["A", "B"] as const) {
    const w = FENETRES[s];
    if (t >= w.debut && t < w.fin) {
      const reste = w.fin - t;
      const phase: Phase = reste <= MINUTES_CLOTURE ? "cloture" : reste <= MINUTES_SANS_NOUVELLE_TACHE ? "plus-de-nouvelle-tache" : "travail";
      return { heureParis: texte, session: s, minutesRestantes: reste, phase };
    }
  }
  return { heureParis: texte, session: null, minutesRestantes: null, phase: "hors-fenetre" };
}

export const VerrouSchema = z.object({
  proprietaire: z.enum(["A", "B", "GABRIEL"]).nullable(),
  tache: z.string(),
  depuis: z.string(),
  battement: z.string(),
});
export type Verrou = z.infer<typeof VerrouSchema>;

export const VERROU_LIBRE: Verrou = { proprietaire: null, tache: "", depuis: "", battement: "" };

export interface DecisionVerrou {
  decision: "prendre" | "occupe";
  raison: string;
}

/** Décide si une instance neuve de `demandeur` peut prendre le verrou à l'instant `now`. */
export function evaluerVerrou(verrou: Verrou, demandeur: Session, now: Date): DecisionVerrou {
  const { proprietaire } = verrou;
  if (proprietaire === null) return { decision: "prendre", raison: "verrou libre" };
  const battement = Date.parse(verrou.battement);
  if (Number.isNaN(battement)) return { decision: "prendre", raison: "verrou sans battement lisible : considéré périmé" };
  const age = (now.getTime() - battement) / 60000;
  if (proprietaire === "GABRIEL") {
    return age > PEREMPTION_GABRIEL_MIN
      ? { decision: "prendre", raison: `verrou de Gabriel périmé (${Math.round(age)} min)` }
      : { decision: "occupe", raison: `verrou posé par Gabriel il y a ${Math.round(age)} min (respecté ${PEREMPTION_GABRIEL_MIN} min)` };
  }
  const courante = fenetre(now).session;
  if (courante === demandeur && courante !== proprietaire && age > PEREMPTION_FENETRE_TERMINEE_MIN) {
    return { decision: "prendre", raison: `fenêtre de ${proprietaire} terminée, dernier battement il y a ${Math.round(age)} min` };
  }
  if (age > PEREMPTION_MIN) return { decision: "prendre", raison: `verrou de ${proprietaire} périmé (${Math.round(age)} min sans battement)` };
  return { decision: "occupe", raison: `${proprietaire} travaille sur « ${verrou.tache} » (dernier battement il y a ${Math.round(age)} min)` };
}
