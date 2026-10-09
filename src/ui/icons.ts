import type { ResourceId } from "../sim/strategic/resources";

/**
 * Jeu d'icônes de l'interface (U6) : dessinées pour le projet sur une grille de 24 px (marge de 2 px), trait unique de
 * 1,6 px à bouts ronds, aucun remplissage ; deux tailles d'affichage (`.ico--s` 1 em, `.ico` 1,25 em, `.ico--l` 1,6 em).
 * Aucune bibliothèque, aucune police d'icônes, aucun emoji. Page de contrôle : /ui-kit.html.
 */
export const ICONS: Readonly<Record<string, string>> = {
  // — Ressources —
  nourriture: "M12 21V9 M12 12c-3-1-4.5-3.5-4-7 2.5.6 4 3 4 7 M12 12c3-1 4.5-3.5 4-7-2.5.6-4 3-4 7 M12 16c-3-.5-5-2.5-5-5.5 2.6.4 4.6 2.4 5 5.5 M12 16c3-.5 5-2.5 5-5.5-2.6.4-4.6 2.4-5 5.5",
  gaz: "M9 3h6 M10 3v3 M14 3v3 M7.5 8.5C7.5 7 9 6 12 6s4.5 1 4.5 2.5V19a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2Z M7.5 12h9 M7.5 16h9",
  acier: "M2.5 18.5 5 13h14l2.5 5.5Z M7 13l1.5-4h7l1.5 4 M9.5 9l1-3h3l1 3",
  pierre: "M12 2.5 17.5 9 12 21.5 6.5 9Z M6.5 9h11 M12 2.5 10 9l2 12.5 2-12.5Z",
  poudre: "M6 5.5C6 4 18 4 18 5.5v13c0 1.5-12 1.5-12 0Z M6 9.5c3 1 9 1 12 0 M6 14.5c3 1 9 1 12 0",
  chevaux: "M7 20c-2.5-3-3.5-7-2-10.5S9.5 4 12 4s5.5 2 7 5.5S19.5 17 17 20 M9.5 20c-1.5-2-2-5-1-7.5S10.5 8 12 8s3 2 3.5 4.5-.5 5.5-2 7.5 M5.5 13h1.5 M17 13h1.5",
  hommes: "M9 5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z M15.5 6.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z M3.5 19c0-3.3 2.4-6 5.5-6s5.5 2.7 5.5 6 M13.5 13.2c.6-.2 1.3-.2 2-.2 2.8 0 5 2.4 5 5.5",
  or: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z M12 6.5v11 M14.5 9c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2 0 2.7 5 1.6 5 4.3 0 1.2-1.1 2-2.6 2-1.1 0-2-.5-2.6-1.4",
  charbon: "M4 16l3.5-7 5-2 6 3 1.5 6-6 3.5Z M7.5 9 11 13l1.5-6 M11 13l9 3 M11 13l1.5 6.5",
  // — Grandeurs nationales —
  ville: "M3 21V11l4-3 4 3v10 M11 21V7l5-3.5L21 7v14 M2 21h20 M14 10h4 M14 14h4 M5.5 15h3",
  moral: "M12 20s-7-4.3-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.7 12 20 12 20Z",
  legitimite: "M4 18 3 7l5 4 4-6 4 6 5-4-1 11Z M4 21h16",
  sceau: "M12 3a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z M9 14l-2 7 5-2.5 5 2.5-2-7 M12 6.5v5 M9.5 9h5",
  rationnement: "M3.5 11h17a8.5 8.5 0 0 1-17 0Z M8 7c0-1 1-1.5 1-2.5 M12 7c0-1 1-1.5 1-2.5 M16 7c0-1 1-1.5 1-2.5",
  // — Domaines et écrans —
  gouvernement: "M3 9.5 12 4l9 5.5 M5 10v8 M9.5 10v8 M14.5 10v8 M19 10v8 M3 20.5h18",
  armee: "M5 13.5 12 9l7 4.5 M5 18 12 13.5l7 4.5 M12 3v3.5 M9.5 4.5h5",
  personnages: "M12 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z M4 20.5c.5-4.5 3.8-7.5 8-7.5s7.5 3 8 7.5Z M10 13l2 3 2-3",
  cabinet: "M3 10h18 M5 10v8 M19 10v8 M8 10V7 M12 10V6 M16 10V7 M3 13h18",
  decrets: "M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H5a2 2 0 0 1 0-4h1V6a2 2 0 0 1 1-2Z M9.5 9h5 M9.5 12h5 M6 16h9",
  organisations: "M5 21V4l5 2-5 2 M12 21V4l5 2-5 2 M19 21V8l2.5 1.2L19 10.4 M3 21h18",
  conseil: "M4 5h11v8H9l-3 3v-3H4Z M15 9h5v8h-2v3l-3-3h-4v-4",
  journal: "M3 5.5c3-1 6-1 9 .5v14c-3-1.5-6-1.5-9-.5Z M21 5.5c-3-1-6-1-9 .5v14c3-1.5 6-1.5 9-.5Z M5.5 9h4 M5.5 12h4 M14.5 9h4 M14.5 12h4",
  missions: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z M12 11.2a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Z M12 12l7-7 M16.5 5H19v2.5",
  armees: "M6 21V3 M6 4h12l-3 3.5 3 3.5H6 M3 21h6 M10 6.5h3",
  expeditions: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z M15.5 8.5l-2 5-5 2 2-5Z",
  chronique: "M7 3h10 M7 21h10 M8 3c0 5 4 6 4 9s-4 4-4 9 M16 3c0 5-4 6-4 9s4 4 4 9",
  renseignement: "M2.5 12C5 7.5 8.3 5.5 12 5.5s7 2 9.5 6.5C19 16.5 15.7 18.5 12 18.5S5 16.5 2.5 12Z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z",
  recherche: "M9.5 3h5 M10.5 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5.5-10V3 M7.5 15h9",
  porteurs: "M13.5 2.5 6 13.5h5.5L10 21.5 18 10h-5.5Z",
  monde: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z M3 12h18 M12 3c-2.8 3-2.8 15 0 18 M12 3c2.8 3 2.8 15 0 18",
  diplomatie: "M5 4h12v10H5Z M5 4c-1.5 0-2 1-2 2s.5 2 2 2 M15 14a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z M14 19.5l-1 2.5 M16 19.5l1 2.5 M8 7.5h6 M8 10.5h4",
  gazette: "M4 5h13v14H5.5A1.5 1.5 0 0 1 4 17.5Z M17 9h3v8.5a1.5 1.5 0 0 1-3 0 M7 8.5h7 M7 11.5h3 M7 14.5h7 M12 11h2v1.5h-2Z",
  archives: "M3 5h18v4H3Z M4.5 9v10h15V9 M9.5 13h5",
  epilogue: "M6 3h10.5A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4Z M9 8h6",
  economie: "M12 4v16 M8 20h8 M5 7h14 M5 7l-3 6c1 1.5 5 1.5 6 0Z M19 7l-3 6c1 1.5 5 1.5 6 0Z",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  // — Unités et forces —
  soldat: "M12 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z M9 21l1-6-2-5 4-1.5 4 1.5-2 5 1 6 M8 10 3 14 M16 10l5 4",
  cavalerie: "M8 21v-5c-2-1-3-3-2.5-5.5L9 4l1.5 2.5L13 4c4 1 6.5 4.5 6.5 8.5 0 1.5-1 2.5-2.5 2.5-1 0-2-.8-3.5-.8L13 21 M9.5 8.5h.01",
  artillerie: "M3 12.5 17 8l1.5 4.5-14 4.5Z M17.5 10.3 21 9.5 M8 15a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z M8 18.5h.01",
  garnison: "M6 21V8h12v13 M5 8V4h2.5v2h3V4h3v2h3V4H19v4 M10 21v-4a2 2 0 0 1 4 0v4 M4 21h16",
  police: "M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6Z M12 8l1.2 2.6 2.8.3-2.1 1.9.6 2.8L12 14.2l-2.5 1.4.6-2.8L8 10.9l2.8-.3Z",
  eclaireur: "M3 17l11-6.5 1.8 3L4.8 20Z M14 10.5l4.5-2.6 1.8 3-4.5 2.6 M20.3 10.9l1.2-.7 M7 21h6",
  titan: "M12 2.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z M7 21l1.5-7L6 10l6-1.5 6 1.5-2.5 4 1.5 7 M12 8.5V14",
  colosse: "M12 5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z M8 22l1-6.5-2.5-4 5.5-1.5 5.5 1.5-2.5 4 1 6.5 M8 4c0-1 1-1.5 1-2.5 M16 4c0-1-1-1.5-1-2.5 M12 3V1.5",
  navire: "M3 15h18l-2.5 5h-13Z M12 15V3 M12 4l6 8h-6 M12 6l-5 6h5",
  fusil: "M3 15 18.5 5.5l1.5 2L5 17 M5.5 13.5 7 18H4.5L3.5 15 M14 8.5l1.5 2.5",
  lance: "M4 20 16 8 M14.5 6.5 20 4l-2.5 5.5Z M6.5 14.5l3 3 M8 13l3 3",
  odm: "M12 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z M12 8v7 M9 21l3-6 3 6 M12 11 4 6 M12 11l8-5 M4 6 2.5 3 M20 6l1.5-3",
  // — Lieux —
  mur: "M3 21V9h3V6h3v3h3V6h3v3h3V6h3v15 M3 13h18 M3 17h18 M9 13v4 M15 13v4 M6 17v4 M12 17v4 M18 17v4",
  porte: "M4 21V6h16v15 M2.5 6h19 M9 21v-6a3 3 0 0 1 6 0v6 M4 10h16",
  foret: "M7 21v-4 M17 21v-3 M7 3 3 11h2.5L3 16h8l-2.5-5H11Z M17 6l-3.5 6h2L13 16.5h8L18.5 12h2Z",
  // — Événements —
  politique: "M13.5 3.5l7 7 M11 6l7 7 M12.2 4.8 7 10l7 7 5.2-5.2 M8.5 15.5 3 21 M14 21h7",
  militaire: "M5 21V3 M5 4h12l-2.5 4L17 12H5",
  empreinte: "M8 13c-1.5 2-2 4.5-.5 6.5s4.5 2 6-.5 1-6-1-7.5-3-.5-4.5 1.5Z M8 7.5a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z M11 5.5a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z M14.5 5.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z M17 8a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z",
  famille: "M3 11 12 4l9 7 M5 9.5V20h14V9.5 M12 17.5s-3-1.8-3-4a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2.2-3 4-3 4Z",
  rumeur: "M4 5h16v10H10l-4 4v-4H4Z M8.5 10h.01 M12 10h.01 M15.5 10h.01",
  recolte: "M12 21v-9 M8 21l4-9 4 9 M12 12c-2-1-3-3-3-6 2 .8 3 3 3 6 M12 12c2-1 3-3 3-6-2 .8-3 3-3 6 M9 15h6",
  deuil: "M12 3c-2.5 0-4 1.8-4 4 0 3 4 6.5 4 6.5S16 10 16 7c0-2.2-1.5-4-4-4Z M10 12.5 6.5 21l3-1.5 1 2.5 1.5-8 M14 12.5l3.5 8.5-3-1.5-1 2.5-1.5-8",
  religion: "M10 10h4v11h-4Z M12 3c-1.5 2-2 3.2-2 4.2a2 2 0 0 0 4 0c0-1-.5-2.2-2-4.2Z M7 21h10",
  breche: "M3 21V5h18v16 M3 21h18 M12 5l-2 4 3 3-2.5 4 1.5 5",
  hiver: "M12 3v18 M4.2 7.5l15.6 9 M4.2 16.5l15.6-9 M9.5 4.5 12 6.5l2.5-2 M9.5 19.5 12 17.5l2.5 2",
  fusee: "M12 21v-9 M12 12c-2 0-3.5-1.5-3.5-3.5S12 3 12 3s3.5 3.5 3.5 5.5S14 12 12 12Z M8 21h8",
  // — Commandes de l'interface —
  pause: "M8 5v14 M16 5v14",
  lecture: "M7 4.5v15L19.5 12Z",
  vitesse: "M4 5.5v13L12 12Z M12 5.5v13L20 12Z",
  fermer: "M6 6l12 12 M18 6 6 18",
  plus: "M12 5v14 M5 12h14",
  moins: "M5 12h14",
  chercher: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Z M15.5 15.5 20.5 20.5",
  filtre: "M3.5 5h17l-6.5 7.5V19l-4 2v-8.5Z",
  reglages: "M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1",
  alerte: "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z M10 20.5a2 2 0 0 0 4 0",
  info: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z M12 11v6 M12 7.5h.01",
  verifie: "M4.5 12.5l5 5 10-11",
  cadenas: "M6 11h12v10H6Z M8.5 11V8a3.5 3.5 0 0 1 7 0v3 M12 15v2.5",
  droite: "M5 12h14 M13 6l6 6-6 6",
  gauche: "M19 12H5 M11 6l-6 6 6 6",
  lieu: "M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z M12 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z",
  horloge: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z M12 7v5l3.5 2",
  signer: "M20 4c-6 0-11 5-12.5 11.5L6 20 M20 4c0 6-4.5 10-10.5 11.5 M10 10h4 M4 21h5",
  etoile: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.8Z",
  carte: "M3 6l6-2.5 6 2.5 6-2.5v14.5l-6 2.5-6-2.5-6 2.5Z M9 3.5V18 M15 6v14.5",
  calques: "M12 3.5 21 8l-9 4.5L3 8Z M3 12l9 4.5 9-4.5 M3 16l9 4.5 9-4.5",
  historique: "M3.5 12a8.5 8.5 0 1 0 2.5-6 M3.5 4v4h4 M12 8v4.5l3 2",
  continuer: "M14 4h5v16h-5 M3 12h11 M10 8l4 4-4 4",
  quitter: "M10 4H5v16h5 M21 12H10 M17 8l4 4-4 4",
  nouvelle: "M5 21 12 9l7 12 M12 9V3l5 2-5 2 M2 21h20",
  son: "M4 9.5h4L13 5v14l-5-4.5H4Z M16.5 9a4 4 0 0 1 0 6 M19 6.5a7.5 7.5 0 0 1 0 11",
  liste: "M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01",
  arbre: "M5 4h5v4H5Z M14 10h5v4h-5Z M14 17h5v4h-5Z M7.5 8v4h6.5 M7.5 12v7h6.5",
  vote: "M4 11h16v9H4Z M8 11V4h8v7 M10 7.5l1.5 1.5 3-3",
  epees: "M4 4l9.5 9.5 M20 4l-9.5 9.5 M6.5 16.5l-3 3 M17.5 16.5l3 3 M4.5 14.5l5 5 M19.5 14.5l-5 5 M4 4h3v3 M20 4h-3v3",
};

/** Icône SVG en ligne (`aria-hidden`) ; chaîne vide si l'identifiant est inconnu. */
export function icon(id: string, cls = "ico"): string {
  const d = ICONS[id];
  return d
    ? `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : "";
}

/** Icône d'une ressource. */
export const RESOURCE_ICON: Readonly<Record<ResourceId, string>> = { food: "nourriture", gas: "gaz", steel: "acier", iceburst: "pierre", powder: "poudre", horses: "chevaux", manpower: "hommes", coal: "charbon", gold: "or" };

export function resourceIcon(r: ResourceId): string {
  return icon(RESOURCE_ICON[r], "ico icone");
}

/** Icône d'un registre (écran) : même identifiant que le registre. */
export function registerIcon(id: string): string {
  return icon(id, "ico icone icone--registre");
}

/** Icône d'une famille d'événements (data/events : civil, militaire, politique, personnage, titans, monde, etranger). */
export const EVENT_ICON: Readonly<Record<string, string>> = { civil: "recolte", militaire: "militaire", politique: "politique", personnage: "famille", titans: "empreinte", monde: "monde", etranger: "navire" };

/** Icône d'une entrée de journal, d'après sa clé de texte. */
export function alertIcon(key: string): string {
  if (/mission/.test(key)) return "missions";
  if (/died|death|deces|mort/.test(key)) return "deuil";
  if (/breach|wall|mur|breche/.test(key)) return "breche";
  if (/titan/.test(key)) return "empreinte";
  if (/shortage|famine|food|ration/.test(key)) return "nourriture";
  if (/gas/.test(key)) return "gaz";
  if (/law|decree|vote|cabinet/.test(key)) return "politique";
  if (/expedition|battle|bataille|army|war|guerre/.test(key)) return "militaire";
  if (/intel|agent|spy|report|mole/.test(key)) return "renseignement";
  if (/research|tech/.test(key)) return "recherche";
  if (/riot|unrest|revolt|strata|org/.test(key)) return "rumeur";
  if (/winter|season|harvest/.test(key)) return "hiver";
  if (/event/.test(key)) return "journal";
  return "alerte";
}

/** Blasons des nations, redessinés dans un style original (04 §8.5) : aucun emblème de l'œuvre n'est repris. */
const EMBLEMS: Record<string, string> = {
  // Paradis : trois enceintes concentriques et une porte.
  fac_paradis: "M24 4a20 20 0 1 1 0 40 20 20 0 0 1 0-40Z M24 11a13 13 0 1 1 0 26 13 13 0 0 1 0-26Z M24 18a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z M22 44v-4h4v4",
  // Marley : tour d'acier couronnée d'une étoile à huit branches.
  fac_marley: "M17 44V18h14v26Z M15 18h18v-4H15Z M17 14v-3h3v3 M22.5 14v-3h3v3 M28 14v-3h3v3 M24 3l1.2 3.8L29 5l-1.8 3.8L31 10l-3.8 1.2 M24 3l-1.2 3.8L19 5l1.8 3.8L17 10l3.8 1.2 M21 26h6 M21 33h6",
  // Hizuru : disque solaire au-dessus de trois vagues.
  fac_hizuru: "M24 8a10 10 0 1 1 0 20 10 10 0 0 1 0-20Z M5 33c4-3 8-3 12 0s8 3 12 0 8-3 14 0 M5 39c4-3 8-3 12 0s8 3 12 0 8-3 14 0",
  // Forces Alliées : deux sabres croisés sous une étoile.
  fac_allies: "M9 41 36 12 M39 41 12 12 M33 15l3-3 1 4 M15 15l-3-3-1 4 M7 39l4 4 M41 39l-4 4 M24 3l2 5h5l-4 3 1.5 5-4.5-3-4.5 3 1.5-5-4-3h5Z",
};

export function emblem(faction: string): string {
  const d = EMBLEMS[faction];
  return d ? `<svg class="blason" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : "";
}
