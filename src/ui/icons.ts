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
