import type { FrozenPlan } from "../../data/placeSchema";
import { simPopulations } from "./population";
import { generateVillage } from "./village";

/** Générateurs des lieux N2 (R1e, consigne §4) : relancés seulement sur demande (`npm run places:regenerer -- <id>`). */
export const GENERATED: Record<string, () => FrozenPlan> = {
  // Village de démonstration [A] : une part (6 %) de la province « hameaux de l'ouest de Maria ».
  "village-des-saules": () =>
    generateVillage({
      id: "village-des-saules",
      nom: "Village des Saules",
      libelle: "Village des Saules (hameaux de l'ouest du mur Maria)",
      canon: "A",
      province: "prov_hameaux_ouest_maria",
      style: "E11",
      graine: 4101,
      population: Math.round((simPopulations()["prov_hameaux_ouest_maria"] ?? 0) * 0.06),
    }),
};
