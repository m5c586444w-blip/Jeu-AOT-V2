/**
 * Réduction des mouvements et des flashs (P10.1, F-ACC-03) : préférence posée sur la racine du document par l'interface
 * (`data-mouvement="reduit"`). Les vues la lisent à chaque image : éclairs sans scintillement, lueurs de tir retirées.
 */
export function reducedMotion(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset["mouvement"] === "reduit";
}
