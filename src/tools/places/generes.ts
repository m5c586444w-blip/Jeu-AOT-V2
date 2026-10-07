import type { FrozenPlan } from "../../data/placeSchema";

/** Générateurs des lieux N2 (R1e, consigne §4) : relancés seulement sur demande (`npm run places:regenerer -- <id>`). */
export const GENERATED: Record<string, () => FrozenPlan> = {};
