import type { EventDef } from "../data/schemas";
import { themeOf } from "./timeline";

/**
 * Illustrations d'archétype des dossiers d'événements (CHR.4) : cinq vignettes au trait, dessinées pour le projet
 * (aucun fichier externe), qui évoquent le thème de l'événement sans prétendre le montrer. Couleurs par jetons CSS.
 */
export type Archetype = "mur" | "conseil" | "camp" | "foyer" | "horizon";
export const ARCHETYPES: readonly Archetype[] = ["mur", "conseil", "camp", "foyer", "horizon"];

const OF_THEME: Readonly<Record<string, Archetype>> = { titans: "mur", politique: "conseil", militaire: "camp", famille: "foyer", monde: "horizon" };

export const archetypeOf = (e: EventDef): Archetype => OF_THEME[themeOf(e)] ?? "horizon";

const SHAPES: Readonly<Record<Archetype, string>> = {
  // Un pan de mur crénelé, sa porte, une silhouette de guetteur au sommet.
  mur: `<path class="art__sol" d="M0 66h120"/><path class="art__forme" d="M6 66V28h12v-6h10v6h10v-6h10v6h10v-6h10v6h10v-6h10v6h10v-6h10v6h6v38"/><path class="art__trait" d="M6 40h108 M6 52h108 M44 66V50a16 16 0 0 1 32 0v16"/><path class="art__accent" d="M92 22v-8 M89 14h6 M92 14l3 4"/><circle class="art__accent" cx="92" cy="10" r="2.2"/>`,
  // Une colonnade sous un fronton, quelques marches.
  conseil: `<path class="art__sol" d="M0 66h120"/><path class="art__forme" d="M14 24 60 8l46 16Z"/><path class="art__trait" d="M20 24h80 M24 26v34 M44 26v34 M64 26v34 M84 26v34 M100 26v34 M16 60h88 M12 64h96"/><path class="art__accent" d="M52 12h16"/>`,
  // Deux tentes, un mât et sa bannière, un feu.
  camp: `<path class="art__sol" d="M0 66h120"/><path class="art__forme" d="M10 66 34 30l24 36Z M52 66 78 36l26 30Z"/><path class="art__trait" d="M34 30V24 M78 36V30 M34 66V50l-7 16 M78 66V54l-8 12"/><path class="art__accent" d="M104 66V10l16 6-16 6 M96 66h16"/><path class="art__accent" d="M16 66c0-4 3-5 3-8 2 2 4 4 3 8"/>`,
  // Une maison, sa cheminée qui fume, une fenêtre allumée.
  foyer: `<path class="art__sol" d="M0 66h120"/><path class="art__forme" d="M22 66V38L60 14l38 24v28Z"/><path class="art__trait" d="M22 38h76 M48 66V50h14v16 M72 44h14v12H72Z M79 44v12 M72 50h14"/><path class="art__accent" d="M82 24V14h8v14 M86 10c-3-3 3-5 0-9"/>`,
  // Une route qui file vers l'horizon, un soleil bas, une silhouette de voyageur.
  horizon: `<path class="art__sol" d="M0 46h120"/><path class="art__forme" d="M8 66 50 46h20l42 20Z"/><path class="art__trait" d="M60 46 40 66 M60 46l20 20 M60 52v4 M60 60v6"/><path class="art__accent" d="M78 46a18 18 0 0 1 36 0 M84 34l-3-6 M96 30V22 M108 34l3-6"/><circle class="art__accent" cx="56" cy="38" r="2.2"/><path class="art__accent" d="M56 40v8 M53 44h6 M56 48l-3 6 M56 48l3 6"/>`,
};

/** Vignette SVG en ligne (décorative : `aria-hidden`). */
export function archetypeSvg(a: Archetype): string {
  return `<svg class="art art--${a}" viewBox="0 0 120 72" aria-hidden="true" focusable="false">${SHAPES[a]}</svg>`;
}
