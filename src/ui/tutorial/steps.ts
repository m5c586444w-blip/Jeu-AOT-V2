/**
 * Tutoriel guidé (TUT.1) : étapes, conditions de passage et machine à états. Logique pure (aucun DOM) :
 * le contrôleur (`controller.ts`) lit l'écran, fournit les faits et dessine la bulle.
 *
 * Une étape se déroule en deux temps : l'ACTION demandée au joueur (bulle ancrée au bouton ou à la zone à utiliser,
 * élément mis en évidence), puis l'EXPLICATION (bulle ancrée à ce qui vient de s'ouvrir). La condition de passage à
 * l'étape suivante est le bouton « Suivant » (verrouillé tant que `leave` n'est pas vrai) ; « Passer » saute l'étape.
 */

/** Ce que le contrôleur observe de l'écran à chaque instant. */
export interface TutorialFacts {
  /** Registre ouvert (identifiant du panneau), ou null. */
  panel: string | null;
  /** Dossier de province ouvert. */
  provinceOpen: boolean;
  /** La carte a été déplacée ou zoomée. */
  mapMoved: boolean;
  /** Jours écoulés depuis le début du tutoriel. */
  daysPassed: number;
  /** Écran de bataille ouvert. */
  battle: boolean;
}

export interface TutorialStep {
  id: string;
  /** Élément à utiliser (sélecteur CSS ; « a || b » : le premier qui existe)  : mis en évidence pendant l'action. */
  anchor: string;
  /** Élément expliqué une fois l'action faite ; par défaut `anchor`. */
  after?: string;
  /** Action demandée ; absente : l'étape est une simple explication. */
  action?: (f: TutorialFacts) => boolean;
  /** Le bouton « Suivant » reste verrouillé tant que ceci est faux. */
  leave?: (f: TutorialFacts) => boolean;
  /** Met le temps en pause quand l'explication apparaît. */
  pause?: boolean;
  /** Pour un élément plein écran : coin où la bulle se range (hors des commandes). */
  dock?: "bas-droite";
  /** L'étape est sautée si l'élément n'existe pas dans ce scénario. */
  optional?: boolean;
  /** Registre à ouvrir/montrer : sert au texte (touche du raccourci). */
  panel?: string;
}

const panelStep = (id: string, panel: string, optional = false): TutorialStep => ({
  id,
  panel,
  anchor: `.bandeau__registre-bouton[data-panel='${panel}']`,
  after: `.registre-panneau[data-panel='${panel}']:not([hidden])`,
  action: (f) => f.panel === panel,
  optional,
});

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: "accueil", anchor: ".bandeau" },
  { id: "carte", anchor: ".carte", action: (f) => f.mapMoved },
  { id: "province", anchor: ".carte", after: ".dossier:not([hidden])", action: (f) => f.provinceOpen },
  { id: "ressources", anchor: ".bandeau__groupe--ressources" },
  { id: "temps", anchor: ".bandeau__temps", action: (f) => f.daysPassed >= 1, pause: true },
  panelStep("economie", "economie"),
  panelStep("armees", "armees", true),
  panelStep("cabinet", "cabinet"),
  panelStep("recherche", "recherche", true),
  panelStep("missions", "missions", true),
  panelStep("evenements", "chronique", true),
  panelStep("expeditions", "expeditions", true),
  {
    id: "bataille",
    anchor: ".registre-panneau[data-panel='expeditions'] [data-action='essai'] || .bandeau__registre-bouton[data-panel='expeditions']",
    after: ".bataille",
    action: (f) => f.battle,
    leave: (f) => !f.battle,
    dock: "bas-droite",
    optional: true,
  },
  { id: "fin", anchor: ".bandeau" },
];

export type TutorialPhase = "action" | "explain";

export interface TutorialCursor {
  /** Indice de l'étape en cours, ou TUTORIAL_STEPS.length quand le tutoriel est fini. */
  index: number;
  phase: TutorialPhase;
}

/** Premier élément existant d'une liste de sélecteurs séparés par « || ». */
export function resolveAnchor(selector: string, query: (s: string) => Element | null): Element | null {
  for (const part of selector.split("||")) {
    const found = query(part.trim());
    if (found) return found;
  }
  return null;
}

export const START: TutorialCursor = { index: 0, phase: "explain" };

/** Phase de départ d'une étape : action si elle en demande une, explication sinon. */
export const enter = (index: number, steps: readonly TutorialStep[] = TUTORIAL_STEPS): TutorialCursor => ({ index, phase: steps[index]?.action ? "action" : "explain" });

/** Fait avancer le curseur selon les faits : l'action accomplie ouvre l'explication. */
export function settle(cur: TutorialCursor, f: TutorialFacts, steps: readonly TutorialStep[] = TUTORIAL_STEPS): TutorialCursor {
  const step = steps[cur.index];
  if (step?.action && cur.phase === "action" && step.action(f)) return { index: cur.index, phase: "explain" };
  return cur;
}

/** « Suivant » est-il permis ? (jamais pendant l'action : il faut la faire, ou passer l'étape). */
export function canContinue(cur: TutorialCursor, f: TutorialFacts, steps: readonly TutorialStep[] = TUTORIAL_STEPS): boolean {
  const step = steps[cur.index];
  if (!step) return false;
  return cur.phase === "explain" && (step.leave?.(f) ?? true);
}

/** Étape suivante, en sautant les étapes facultatives dont l'élément est absent ; `present` dit si un sélecteur existe. */
export function next(cur: TutorialCursor, present: (selector: string) => boolean, steps: readonly TutorialStep[] = TUTORIAL_STEPS): TutorialCursor {
  let i = cur.index + 1;
  while (i < steps.length) {
    const s = steps[i] as TutorialStep;
    if (!s.optional || present(s.anchor)) break;
    i += 1;
  }
  return i >= steps.length ? { index: steps.length, phase: "explain" } : enter(i, steps);
}

export const isFinished = (cur: TutorialCursor, steps: readonly TutorialStep[] = TUTORIAL_STEPS): boolean => cur.index >= steps.length;
