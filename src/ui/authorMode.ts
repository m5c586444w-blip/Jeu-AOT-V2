/**
 * Mode auteur (E-UX-1, UX0) : touche F10, désactivé par défaut. Il fait apparaître, en pastilles discrètes, ce que le
 * joueur ne voit jamais : statuts canon (établi, interprété, non confirmé), codes internes, années planchers, phases.
 * Ces éléments portent la classe `auteur-seul` ; la feuille de style les masque tant que `<html>` n'a pas `mode-auteur`.
 */
export const AUTHOR_ONLY = "auteur-seul";
const ROOT_CLASS = "mode-auteur";

let active = false;

export function isAuthorMode(): boolean {
  return active;
}

export function setAuthorMode(on: boolean): void {
  active = on;
  if (typeof document !== "undefined") document.documentElement.classList.toggle(ROOT_CLASS, on);
}

/** Marque un élément comme réservé au mode auteur et le renvoie. */
export function authorOnly<T extends HTMLElement>(e: T): T {
  e.classList.add(AUTHOR_ONLY);
  return e;
}
