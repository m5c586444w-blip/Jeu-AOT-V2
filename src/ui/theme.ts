/**
 * Accès aux jetons de style (tokens.css) depuis le code : pour les dessins sur canvas, qui ne lisent pas les variables CSS.
 * Aucune couleur n'est écrite ici (U1) : sans document (tests), la valeur est vide.
 */
export function tokenColor(name: string): string {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Nation jouée : accent de faction (U1) porté par `<html data-faction>` et `data-joueur`. */
export function setPlayerFaction(faction: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset["faction"] = faction;
  document.documentElement.dataset["joueur"] = faction;
}
