import type { ResourceId } from "../sim/strategic/resources";

/**
 * Icônes de ressources dessinées pour le projet (aucun jeu d'icônes générique, 04 §2.3).
 * Chaque motif est tracé deux fois avec un léger décalage et des épaisseurs différentes : trait irrégulier d'encre.
 */
const PATHS: Record<ResourceId, string> = {
  food: "M12 21 L12 8 M12 11 C9 10 8 7 9 4 C11 5 12 8 12 11 M12 11 C15 10 16 7 15 4 C13 5 12 8 12 11 M12 15 C9 14 7 12 7 9 M12 15 C15 14 17 12 17 9 M9 21 L15 21",
  gas: "M9 4 L15 4 M10 4 L10 7 M14 4 L14 7 M8 8 C8 7 16 7 16 8 L16 19 C16 21 8 21 8 19 Z M10 12 L14 12 M10 15 L13 15",
  steel: "M5 19 L17 7 L19 5 L18 8 L7 20 Z M6 15 L9 18 M4 20 L6 18",
  iceburst: "M12 3 L17 9 L14 20 L10 20 L7 9 Z M7 9 L17 9 M12 3 L10 20 M12 3 L14 20",
  powder: "M7 6 C7 4 17 4 17 6 L17 18 C17 20 7 20 7 18 Z M7 9 L17 9 M7 15 L17 15 M17 6 L20 3",
  horses: "M7 20 C4 15 5 7 9 5 C11 4 13 4 15 5 C19 7 20 15 17 20 M14 20 C16 16 16 10 13 8 C12 7.6 11.6 7.6 11 8 C8 10 8 16 10 20 M8 9 L9 9 M15 9 L16 9",
  manpower: "M12 4 C10.5 4 10 5.5 10 6.5 C10 8 11 9 12 9 C13 9 14 8 14 6.5 C14 5.5 13.5 4 12 4 Z M8 20 L9 12 C9 10.5 15 10.5 15 12 L16 20 M10 15 L14 15",
  coal: "M5 16 L8 9 L13 7 L18 10 L19 16 L13 19 Z M8 9 L11 13 L13 7 M11 13 L19 16 M11 13 L13 19",
  gold: "M12 4 C16.5 4 19 7.5 19 12 C19 16.5 16.5 20 12 20 C7.5 20 5 16.5 5 12 C5 7.5 7.5 4 12 4 Z M12 7 L12 17 M9.5 9 C10 7.5 14.5 7.5 14.5 9.5 C14.5 11.5 9.5 11 9.5 13.5 C9.5 15.5 14 15.5 14.5 14",
};

export function resourceIcon(r: ResourceId): string {
  const d = PATHS[r];
  return (
    `<svg class="icone" viewBox="0 0 24 24" aria-hidden="true" focusable="false">` +
    `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="currentColor" stroke-width="0.7" stroke-linecap="square" stroke-linejoin="bevel" transform="translate(0.45 -0.35) rotate(0.8 12 12)" opacity="0.65"/>` +
    `</svg>`
  );
}

/** Icônes des registres (P8) : même trait d'encre irrégulier, motifs dessinés pour le projet. */
const REGISTER_PATHS: Record<string, string> = {
  personnages: "M12 4 C9.5 4 8.5 6 8.5 8 C8.5 10.5 10 12 12 12 C14 12 15.5 10.5 15.5 8 C15.5 6 14.5 4 12 4 Z M5 20 C5 15.5 8 13.5 12 13.5 C16 13.5 19 15.5 19 20",
  cabinet: "M4 11 L20 11 L20 13 L4 13 Z M6 13 L6 19 M18 13 L18 19 M8 8 L8 11 M12 7 L12 11 M16 8 L16 11 M7 7 L9 7 M11 6 L13 6 M15 7 L17 7",
  decrets: "M7 4 L17 4 C18 4 18 6 17 6 L17 19 C17 20 7 20 7 19 Z M9 9 L15 9 M9 12 L15 12 M9 15 L12 15 M15 17 C13.5 17 13.5 19.5 15 19.5 C16.5 19.5 16.5 17 15 17 Z",
  organisations: "M5 20 L5 5 L10 7 L5 9 M12 20 L12 4 L17 6 L12 8 M19 20 L19 7 L22 8.5 L19 10 M3 20 L21 20",
  conseil: "M12 4 C8 4 7 8 7 12 L5 16 L19 16 L17 12 C17 8 16 4 12 4 Z M10 18 C10 20 14 20 14 18",
  journal: "M4 5 L18 5 L18 19 C18 20 20 20 20 19 L20 8 L18 8 M4 5 L4 18 C4 19 5 20 6 20 L19 20 M7 8 L15 8 M7 11 L15 11 M7 14 L11 14",
  expeditions: "M12 3 C17 3 21 7 21 12 C21 17 17 21 12 21 C7 21 3 17 3 12 C3 7 7 3 12 3 Z M12 6 L14 12 L12 18 L10 12 Z M12 3 L12 5 M21 12 L19 12",
  chronique: "M7 3 L17 3 M7 21 L17 21 M8 3 C8 8 12 10 12 12 C12 14 8 16 8 21 M16 3 C16 8 12 10 12 12 C12 14 16 16 16 21 M10 18 L14 18",
  renseignement: "M2 12 C5 7 9 5 12 5 C15 5 19 7 22 12 C19 17 15 19 12 19 C9 19 5 17 2 12 Z M12 9 C13.8 9 15 10.2 15 12 C15 13.8 13.8 15 12 15 C10.2 15 9 13.8 9 12 C9 10.2 10.2 9 12 9 Z",
  recherche: "M9 3 L15 3 M10 3 L10 9 L5 19 C4.5 20 5 21 6 21 L18 21 C19 21 19.5 20 19 19 L14 9 L14 3 M7.5 15 L16.5 15",
  porteurs: "M12 3 C10 3 9 4.5 9 6 C9 7.5 10 9 12 9 C14 9 15 7.5 15 6 C15 4.5 14 3 12 3 Z M7 21 L8 12 L12 10 L16 12 L17 21 M6 13 C4 11 4 8 5 6 M18 13 C20 11 20 8 19 6",
  monde: "M12 3 C17 3 21 7 21 12 C21 17 17 21 12 21 C7 21 3 17 3 12 C3 7 7 3 12 3 Z M3 12 L21 12 M12 3 C9 6 9 18 12 21 M12 3 C15 6 15 18 12 21 M5 7 L19 7 M5 17 L19 17",
  diplomatie: "M5 19 L15 9 C17 7 19 5 20 4 C19 6 17 8 15 10 L5 20 Z M14 8 L16 10 M4 20 L8 20 M15 17 C13.5 17 13.5 19.5 15 19.5 C16.5 19.5 16.5 17 15 17 Z",
  archives: "M3 7 L21 7 L21 20 L3 20 Z M3 7 L5 4 L19 4 L21 7 M9 11 L15 11 M9 11 L9 13 L15 13 L15 11",
  gazette: "M3 6 L21 6 L21 19 L3 19 Z M5 9 L11 9 L11 14 L5 14 Z M13 9 L19 9 M13 11.5 L19 11.5 M13 14 L19 14 M5 16.5 L19 16.5",
  epilogue: "M6 3 L18 3 L18 21 L12 17 L6 21 Z M9 7 L15 7 M9 10 L15 10",
  menu: "M8 13 C5.8 13 4 11.2 4 9 C4 6.8 5.8 5 8 5 C10.2 5 12 6.8 12 9 C12 11.2 10.2 13 8 13 Z M11 11 L20 20 M16 16 L18 14 M18 18 L20 16",
};

function inked(d: string, cls: string, size = 24): string {
  return (
    `<svg class="${cls}" viewBox="0 0 ${size} ${size}" aria-hidden="true" focusable="false">` +
    `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="currentColor" stroke-width="0.7" stroke-linecap="square" stroke-linejoin="bevel" transform="translate(0.45 -0.35) rotate(0.8 ${size / 2} ${size / 2})" opacity="0.65"/>` +
    `</svg>`
  );
}

export function registerIcon(id: string): string {
  const d = REGISTER_PATHS[id];
  return d ? inked(d, "icone icone--registre") : "";
}

/** Blasons des nations, redessinés dans un style original (04 §8.5) : aucun emblème de l'œuvre n'est repris. */
const EMBLEMS: Record<string, string> = {
  // Paradis : trois enceintes concentriques et une porte.
  fac_paradis: "M24 4 C35 4 44 13 44 24 C44 35 35 44 24 44 C13 44 4 35 4 24 C4 13 13 4 24 4 Z M24 11 C31.2 11 37 16.8 37 24 C37 31.2 31.2 37 24 37 C16.8 37 11 31.2 11 24 C11 16.8 16.8 11 24 11 Z M24 18 C27.3 18 30 20.7 30 24 C30 27.3 27.3 30 24 30 C20.7 30 18 27.3 18 24 C18 20.7 20.7 18 24 18 Z M22 44 L22 40 L26 40 L26 44",
  // Marley : tour d'acier couronnée d'une étoile à huit branches.
  fac_marley: "M17 44 L17 18 L31 18 L31 44 Z M15 18 L33 18 L33 14 L15 14 Z M17 14 L17 11 L20 11 L20 14 M22.5 14 L22.5 11 L25.5 11 L25.5 14 M28 14 L28 11 L31 11 L31 14 M24 3 L25.2 6.8 L29 5 L27.2 8.8 L31 10 L27.2 11.2 M24 3 L22.8 6.8 L19 5 L20.8 8.8 L17 10 L20.8 11.2 M21 26 L27 26 M21 33 L27 33",
  // Hizuru : disque solaire au-dessus de trois vagues.
  fac_hizuru: "M24 8 C30 8 34 12 34 18 C34 24 30 28 24 28 C18 28 14 24 14 18 C14 12 18 8 24 8 Z M5 33 C9 30 13 30 17 33 C21 36 25 36 29 33 C33 30 37 30 43 33 M5 39 C9 36 13 36 17 39 C21 42 25 42 29 39 C33 36 37 36 43 39",
  // Forces Alliées : deux sabres croisés sous une étoile.
  fac_allies: "M9 41 L36 12 M39 41 L12 12 M33 15 L36 12 L37 16 M15 15 L12 12 L11 16 M7 39 L11 43 M41 39 L37 43 M24 3 L26 8 L31 8 L27 11 L28.5 16 L24 13 L19.5 16 L21 11 L17 8 L22 8 Z",
};

export function emblem(faction: string): string {
  const d = EMBLEMS[faction];
  return d ? inked(d, "blason", 48) : "";
}
