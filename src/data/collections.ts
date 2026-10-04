/** Sous-dossiers de /data (sans dépendance à Zod, pour rester léger côté navigateur). */
export const COLLECTION_NAMES = ["provinces", "characters", "techs", "events", "placements", "buildings", "scenarios", "traits", "strata", "organisations", "laws", "roles", "units", "titans", "names", "titan_types", "tactical_maps", "shifters"] as const;
export type CollectionName = (typeof COLLECTION_NAMES)[number];
