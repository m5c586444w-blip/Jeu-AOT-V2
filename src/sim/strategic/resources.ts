/** Les 9 ressources du fichier 02 §3.1 (F-ECO-01). */
export const RESOURCE_IDS = ["food", "gas", "steel", "iceburst", "powder", "horses", "manpower", "coal", "gold"] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];
export type ResourceMap = Record<ResourceId, number>;

export function emptyResources(): ResourceMap {
  return { food: 0, gas: 0, steel: 0, iceburst: 0, powder: 0, horses: 0, manpower: 0, coal: 0, gold: 0 };
}

/** Ressources clés des provinces (fichier 06) : vocabulaire descriptif, converti en production par data/balance/economy.json. */
export const KEY_RESOURCES = [
  "none", "nourriture", "peche", "chasse", "main_oeuvre", "acier", "bois", "pierre", "chevaux", "commerce",
  "information", "recrues", "equipement", "poudre", "artisanat", "pierre_glace", "logistique",
] as const;
export type KeyResource = (typeof KEY_RESOURCES)[number];

export const RATIONING_LEVELS = ["normal", "reduit", "strict"] as const;
export type RationingLevel = (typeof RATIONING_LEVELS)[number];
