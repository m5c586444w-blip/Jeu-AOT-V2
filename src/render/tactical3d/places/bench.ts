import type { Gate, Place } from "../../../data/placeSchema";

/**
 * Banc d'essai des murailles et des portes (R1e.3, consigne §8 : « bancs de test sur un mur et une porte isolés avant de les
 * poser ») : 600 m de mur Maria rectiligne (extérieur au sud), une porte extérieure, une porte intérieure et une porte de
 * rivière sur un canal, aucun bâtiment. Vue « mur-face » : élévation de face d'un pan nu de 120 m (caméra lointaine, champ
 * étroit, presque orthographique) pour la mesure d'autocorrélation du parement (CR1e-05).
 * Lieu fabriqué en code (pas de fichier `data/places`) : `?proto3d&lieu=_banc` ; `&etat=brise` montre les portes brisées.
 */
export const BENCH_FACE = { s0: 455, s1: 575, width: 120, distance: 160 } as const;

function gate(id: string, role: Gate["role"], s: number, over: Partial<Gate>): Gate {
  return {
    id,
    nom: id,
    role,
    canon: "A",
    sources: [{ ref: "banc d'essai", canon: "A" }],
    trace: "mur",
    s_m: s,
    passage: { largeur_m: 14, hauteur_m: 20, voute: "plein_cintre", trous_assassin: 8, rainures: true, canon: "A" },
    vantail: { type: "levant", largeur_m: 15, hauteur_m: 20, epaisseur_m: 1.1, materiau: "chene_ferre", canon: "A" },
    structure: { huisserie: true, gonds: 0, treuils: 2, contrepoids: 2, herse: false, canon: "A" },
    tours: [
      { type: "maison_du_treuil", cote: "dessus", hauteur_m: 7, canon: "A" },
      { type: "tourelle", cote: "gauche", hauteur_m: 9, canon: "A" },
      { type: "tourelle", cote: "droite", hauteur_m: 9, canon: "A" },
    ],
    portail: "bossage",
    etat: "intacte",
    ...over,
  };
}

export function benchPlace(): Place {
  const portes: Gate[] = [
    gate("exterieure", "exterieure", 120, {}),
    gate("interieure", "interieure", 260, {
      passage: { largeur_m: 12, hauteur_m: 16, voute: "plein_cintre", trous_assassin: 4, rainures: true, canon: "A" },
      vantail: { type: "battants", largeur_m: 12.4, hauteur_m: 15, epaisseur_m: 0.7, materiau: "chene_ferre", canon: "A" },
      structure: { huisserie: true, gonds: 4, treuils: 1, contrepoids: 0, herse: true, canon: "A" },
      tours: [
        { type: "poste_de_garde", cote: "gauche", hauteur_m: 5, canon: "A" },
        { type: "poste_de_garde", cote: "droite", hauteur_m: 5, canon: "A" },
      ],
      portail: "pilastres",
    }),
    gate("riviere", "riviere", 380, {
      passage: { largeur_m: 16, hauteur_m: 11, voute: "surbaisse", trous_assassin: 0, rainures: true, canon: "A" },
      vantail: { type: "herse", largeur_m: 16, hauteur_m: 11, epaisseur_m: 0.3, materiau: "fer", canon: "A" },
      structure: { huisserie: true, gonds: 0, treuils: 1, contrepoids: 0, herse: true, canon: "A" },
      tours: [{ type: "maison_du_treuil", cote: "dessus", hauteur_m: 5, canon: "A" }],
      portail: "sobre",
    }),
  ];
  const mid = (BENCH_FACE.s0 + BENCH_FACE.s1) / 2;
  return {
    id: "_banc",
    nom: "Banc d'essai des murailles",
    libelle: "Banc d'essai : mur Maria et portes",
    canon: "A",
    niveau: "N1",
    sources: [{ ref: "banc d'essai (R1e.3)", canon: "A" }],
    province: null,
    style: "E22",
    population: { province: null, part: 1, valeur: 1, canon: "?" },
    densite: { classe: "ferme", valeur: 1, canon: "A" },
    perimetre: [[0, -10], [600, -10], [600, -200], [0, -200]],
    zones: [],
    orientation: { valeur: "aucune", canon: "A" },
    etendue_m: 1400,
    enceinte: {
      mur: "maria",
      canon: "C",
      // Tracé d'ouest en est, extérieur au sud (à droite en suivant le tracé, nord en haut).
      traces: [{ id: "mur", type: "ligne", points: [[0, 0], [600, 0]], exterieur: "droite", canon: "A" }],
      escaliers: [{ trace: "mur", s_m: 200, canon: "A" }],
      canons: { espacement_m: 32, canon: "A", traces: ["mur"] },
      glacis_m: 10,
      pied_vegetal: true,
    },
    portes,
    rues: [
      { id: "route-sud", nom: "Route", canon: "A", type: "route", trace: [[120, 12], [120, 400]], largeur_m: 10, revetement: "terre" },
      { id: "route-nord", nom: "Rue", canon: "A", type: "rue", trace: [[120, -12], [120, -200], [260, -200], [260, -12]], largeur_m: 10, revetement: "paves" },
    ],
    places_publiques: [],
    gabarits: {},
    quartiers: [{ id: "banc", nom: "Banc", canon: "A" }],
    ilots: [],
    batiments: [],
    vegetation: { alignements: [], isoles: [{ position: [200, 60], essence: "tilleul", hauteur_m: 18 }, { position: [330, -40], essence: "chene", hauteur_m: 20 }], parcs: [], vergers: [], haies: [], potagers: [], essences_cours: ["tilleul"] },
    eau: { voies: [{ id: "canal", nom: "Canal", canon: "A", type: "canal", trace: [[380, -260], [380, 260]], largeur_m: 14, quais: true }], ponts: [], puits: [], fontaines: [] },
    points_de_vue: [
      { id: "mur-face", nom: "Élévation de face (120 m)", oeil: [mid, BENCH_FACE.distance, 26], cible: [mid, 0, 26], fov: (2 * Math.atan((BENCH_FACE.width * 9) / 16 / 2 / BENCH_FACE.distance) * 180) / Math.PI },
      { id: "ensemble", nom: "Ensemble", oeil: [-120, 260, 140], cible: [260, 0, 20], fov: 50 },
      { id: "mur-pied", nom: "Pied du mur", oeil: [520, 40, 1.7], cible: [470, 7, 22], fov: 60 },
      { id: "mur-ville", nom: "Côté ville", oeil: [520, -60, 1.7], cible: [500, -8, 25], fov: 60 },
      { id: "mur-chemin", nom: "Chemin de ronde", oeil: [520, 0, 52], cible: [380, 0, 50], fov: 60 },
      { id: "mur-loin", nom: "Vue lointaine", oeil: [300, 1200, 40], cible: [300, 0, 25], fov: 40 },
    ],
    etats: [
      { id: "intact", nom: "Intact", date: "—", canon: "A", sources: [{ ref: "banc", canon: "A" }], portes: {}, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 0 },
      { id: "brise", nom: "Portes brisées", date: "845", canon: "A", sources: [{ ref: "banc", canon: "A" }], portes: { exterieure: "brisee_845", interieure: "brisee_845" }, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 0 },
      { id: "bouche", nom: "Portes bouchées", date: "850", canon: "?", sources: [{ ref: "banc", canon: "?" }], portes: { exterieure: "bouchee", interieure: "bouchee" }, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 0 },
    ],
    etat_defaut: "intact",
  };
}
