import type { FrozenPlan, Place, PlaceState, RoofForm } from "../../../data/placeSchema";
import { batchesHash, placeBatches } from "./instances";
import { chunkOf } from "./layout";
import type { HouseInst, PlaceLayout, TreeInst2 } from "./layout";

/**
 * Lieux N2 (R1e, consigne §4) : rendu d'un plan figé (`data/places/generated/<id>.json`) sans relancer aucun générateur.
 * Les lignes compactes deviennent directement les instances du rendu (maisons, arbres) ; le reste (rues, champs) devient un
 * lieu minimal pour le sol. L'empreinte de rendu (`frozenHash`) est écrite dans le plan au gel : un test vérifie qu'elle ne
 * change pas, quelle que soit l'évolution des générateurs.
 * `b` : [x, y, angle, largeur, profondeur, hauteur, archétype, toit, couverture, façade, teinte] (positions et dimensions × 10,
 * hauteur × 4, angle en degrés) ; `t` : [x, y, essence, hauteur × 4].
 */
export const Q_POS = 10;
export const Q_H = 4;
const PITCH: Record<RoofForm, number> = { pignon: 50, pignon_rue: 50, croupe: 42, demi_croupe: 52, mansarde: 55, plat: 0, appentis: 25, pavillon: 45 };

export function frozenState(): PlaceState {
  return { id: "actuel", nom: "État figé", date: "—", canon: "A", sources: [{ ref: "plan figé", canon: "A" }], portes: {}, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 1 };
}

/** Lieu minimal (sol, rues, champs, vues) d'un plan figé : jamais validé comme un N1, seulement rendu. */
export function frozenPlace(plan: FrozenPlan): Place {
  const E = plan.etendue_m;
  const c = (p: [number, number]): [number, number] => [p[0] / Q_POS, p[1] / Q_POS];
  const r = E * 0.18;
  const views: Place["points_de_vue"] = [
    { id: "ensemble", nom: "Vue d'ensemble", oeil: [-r * 2.2, r * 2.6, r * 1.3], cible: [0, 0, 0], fov: 50 },
    { id: "rue", nom: "Rue du village", oeil: [-r * 0.5, 6, 1.7], cible: [r * 0.3, 0, 4], fov: 60 },
    { id: "centre", nom: "Centre du village", oeil: [40, 50, 12], cible: [0, 0, 4], fov: 60 },
    { id: "champs", nom: "Champs", oeil: [r * 1.4, -r * 1.2, 14], cible: [0, 0, 4], fov: 58 },
    { id: "haut", nom: "Vue haute", oeil: [0, 1, r * 2.4], cible: [0, 0, 0], fov: 55 },
    { id: "lointaine", nom: "Vue lointaine", oeil: [r * 3.2, r * 0.4, 30], cible: [0, 0, 6], fov: 45 },
  ];
  return {
    id: plan.id,
    nom: plan.nom,
    libelle: plan.libelle,
    canon: plan.canon,
    niveau: "N1",
    sources: [{ ref: `plan figé (${plan.generateur.nom} v${plan.generateur.version}, graine ${plan.generateur.graine})`, canon: "A" }],
    province: plan.province,
    style: plan.style,
    population: plan.province ? { province: plan.province, part: 1, canon: "A" } : { province: null, part: 1, valeur: Math.max(1, plan.population), canon: "?" },
    densite: { classe: "village", valeur: 30, canon: "A" },
    perimetre: [[-E / 2, -E / 2], [E / 2, -E / 2], [E / 2, E / 2], [-E / 2, E / 2]],
    zones: [],
    orientation: { valeur: "aucune", canon: "A" },
    etendue_m: E,
    enceinte: null,
    portes: [],
    rues: plan.rues.map((s, i) => ({ id: `r-${i}`, nom: `Chemin ${i + 1}`, canon: "A" as const, type: "chemin" as const, trace: s.trace.map(c), largeur_m: s.largeur, revetement: s.revetement })),
    places_publiques: [],
    gabarits: {},
    quartiers: [],
    ilots: [],
    batiments: [],
    vegetation: { alignements: [], isoles: [], parcs: [], vergers: [], haies: [], potagers: [], essences_cours: ["fruitier"] },
    eau: { voies: [], ponts: [], puits: [], fontaines: [] },
    points_de_vue: views,
    etats: [frozenState()],
    etat_defaut: "actuel",
  };
}

export function frozenLayout(plan: FrozenPlan, place: Place = frozenPlace(plan)): PlaceLayout {
  const houses: HouseInst[] = plan.b.map((row, k) => {
    const [x, y, ang, w, d, h, , roof, cover, facade, tint] = row as [number, number, number, number, number, number, number, number, number, number, number];
    const H = h / Q_H;
    const floors = Math.max(1, Math.round(H / 3));
    const form = plan.toits[roof] ?? "pignon";
    return {
      id: `${plan.id}:${k}`,
      x: x / Q_POS,
      y: y / Q_POS,
      a: (ang * Math.PI) / 180,
      w: w / Q_POS,
      d: d / Q_POS,
      floors,
      fh: H / floors,
      roof: form,
      pitch: PITCH[form],
      cover: plan.couvertures[cover] ?? "tuile_plate",
      facade: plan.facades[facade] ?? "enduit",
      tint: plan.teintes[tint] ?? "#D8CCB4",
      shop: false,
      corner: false,
      chunk: chunkOf(x / Q_POS, y / Q_POS),
      ruin: 0,
    };
  });
  const trees: TreeInst2[] = plan.t.map((row, k) => {
    const [x, y, sp, h] = row as [number, number, number, number];
    return { x: x / Q_POS, y: y / Q_POS, sp: plan.essences[sp] ?? "tilleul", h: h / Q_H, rot: (k * 0.618034) % 1 * Math.PI * 2, src: "campagne", chunk: chunkOf(x / Q_POS, y / Q_POS) };
  });
  const chunks = [...new Set([...houses.map((h) => h.chunk), ...trees.map((t) => t.chunk)])].sort((a, b) => a - b);
  return { place, state: frozenState(), blocks: [], houses, trees, landmarks: [], chunks };
}

/** Empreinte de rendu d'un plan figé (même calcul que les lieux N1). */
export function frozenHash(plan: FrozenPlan): string {
  return batchesHash(placeBatches(frozenLayout(plan)));
}
