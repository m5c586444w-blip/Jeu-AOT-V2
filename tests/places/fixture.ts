import type { Place } from "../../src/data/placeSchema";

/**
 * Lieu d'essai (tests R1e) : bourg circulaire de 230 m de rayon, quadrillage de rues de 60 m, une place, un parc, un canal et
 * un pont, une porte. Population paramétrable (sans province) : 2 000 habitants à 200 hab/ha.
 */
export function testPlace(): Place {
  const R = 230;
  const step = 60;
  const streets: Place["rues"] = [];
  const blocks: Place["ilots"] = [];
  const lines = [-150, -90, -30, 30, 90, 150];
  lines.forEach((x, i) => {
    const h = Math.sqrt(Math.max(0, (R - 30) ** 2 - x * x));
    streets.push({ id: `nord-sud-${i}`, nom: `Rue ${i + 1}`, canon: "A", type: i === 2 ? "principale" : "rue", trace: [[x, -h], [x, h]], largeur_m: i === 2 ? 12 : 8, revetement: "paves" });
    streets.push({ id: `est-ouest-${i}`, nom: `Ruelle ${i + 1}`, canon: "A", type: "rue", trace: [[-h, x], [h, x]], largeur_m: 8, revetement: i % 2 ? "paves" : "terre" });
  });
  for (let i = 0; i + 1 < lines.length; i++) {
    for (let j = 0; j + 1 < lines.length; j++) {
      const x0 = (lines[i] as number) + 4;
      const x1 = (lines[i + 1] as number) - 4;
      const y0 = (lines[j] as number) + 4;
      const y1 = (lines[j + 1] as number) - 4;
      const far = Math.max(...[x0, x1].flatMap((x) => [y0, y1].map((y) => Math.hypot(x, y))));
      if (far > R - 25) continue;
      if ((i === 2 && j === 2) || (i === 3 && j === 3)) continue;
      blocks.push({ id: `b${i}${j}`, quartier: i < 2 ? "ouest" : "est", fonction: i === 3 && j === 1 ? "jardin" : "habitation", polygone: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], densite_bati: j === 3 ? 0.8 : 1, gabarit: i % 2 ? "serre" : "lache" });
    }
  }
  void step;
  return {
    id: "bourg-test",
    nom: "Bourg d'essai",
    libelle: "Bourg d'essai (fixture)",
    canon: "?",
    niveau: "N1",
    sources: [{ ref: "aucune", canon: "?" }],
    province: null,
    style: "E01",
    population: { province: null, part: 1, valeur: 2000, canon: "?" },
    densite: { classe: "coeur", valeur: 200, canon: "A" },
    perimetre: Array.from({ length: 24 }, (_, k) => [Math.cos((k / 24) * Math.PI * 2) * (R - 8), Math.sin((k / 24) * Math.PI * 2) * (R - 8)] as [number, number]),
    zones: [],
    orientation: { valeur: "aucune", canon: "?" },
    etendue_m: 700,
    enceinte: {
      mur: "maria",
      canon: "A",
      traces: [{ id: "anneau", type: "arc", centre: [0, 0], rayon_m: R, debut_deg: 0, fin_deg: 360, exterieur: "dehors", canon: "A" }],
      escaliers: [{ trace: "anneau", s_m: 100, canon: "A" }],
      canons: { espacement_m: 40, canon: "A", traces: ["anneau"] },
      glacis_m: 10,
      pied_vegetal: false,
    },
    portes: [
      {
        id: "sud",
        nom: "Porte sud",
        role: "exterieure",
        canon: "A",
        sources: [{ ref: "aucune", canon: "A" }],
        trace: "anneau",
        s_m: (Math.PI / 2) * R,
        passage: { largeur_m: 12, hauteur_m: 18, voute: "plein_cintre", trous_assassin: 6, rainures: true, canon: "A" },
        vantail: { type: "levant", largeur_m: 13, hauteur_m: 19, epaisseur_m: 0.8, materiau: "chene_ferre", canon: "A" },
        structure: { huisserie: true, gonds: 0, treuils: 2, contrepoids: 2, herse: false, canon: "A" },
        tours: [{ type: "maison_du_treuil", cote: "dessus", hauteur_m: 8, canon: "A" }],
        portail: "sobre",
        etat: "intacte",
      },
    ],
    rues: streets,
    places_publiques: [{ id: "place", nom: "Place d'essai", canon: "A", polygone: [[-26, -26], [26, -26], [26, 26], [-26, 26]], revetement: "dalles", fontaine: [0, 0], marche: true }],
    gabarits: {
      serre: { etages: [3, 4, 3, 5], hauteur_etage_m: 3, toits: ["pignon_rue", "pignon", "pignon_rue", "demi_croupe"], pente_deg: [48, 58], couvertures: ["tuile_plate", "tuile_plate", "ardoise"], facades: ["enduit", "colombage", "enduit", "pierre_taillee", "enduit"], teintes: ["#efe2c8", "#e8d2b0", "#dfe6d8", "#f0d8cc", "#e6e0d0", "#d8c8a8", "#efe8dc"], parcelles_m: [7, 6, 8.5, 6.5, 9, 7.5], profondeur_m: 12, boutiques: true, passage_m: 40, cour: { type: "plantee", arbres_par_ha: 90 } },
      lache: { etages: [2, 3, 2], hauteur_etage_m: 2.9, toits: ["pignon", "croupe", "pignon"], pente_deg: [40, 52], couvertures: ["tuile_canal", "bardeau"], facades: ["enduit", "bois"], teintes: ["#e8dcc4", "#d9c7a5", "#efe6d6"], parcelles_m: [9, 11, 8], profondeur_m: 10, boutiques: false, passage_m: 0, cour: { type: "jardin", arbres_par_ha: 120 } },
    },
    quartiers: [
      { id: "ouest", nom: "Quartier ouest", canon: "A" },
      { id: "est", nom: "Quartier est", canon: "A" },
    ],
    ilots: blocks,
    batiments: [{ id: "eglise", nom: "Église", canon: "A", archetype: "eglise", position: [0, -60], emprise_m: [18, 30], angle_deg: 0, hauteur_m: 16, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#e0d8c8", reperes_canon: [] }],
    vegetation: {
      alignements: [{ rue: "nord-sud-2", essence: "tilleul", intervalle_m: 10, cotes: "deux" }],
      isoles: [{ position: [12, 12], essence: "marronnier", hauteur_m: 16, nom: "Marronnier de la place" }],
      parcs: [{ id: "parc", nom: "Parc d'essai", canon: "A", polygone: [[34, 34], [86, 34], [86, 86], [34, 86]], essences: ["chene", "erable", "bouleau"], arbres_par_ha: 60 }],
      vergers: [],
      haies: [],
      potagers: [],
      essences_cours: ["tilleul", "erable", "fruitier"],
    },
    eau: { voies: [{ id: "canal", nom: "Canal d'essai", canon: "A", type: "canal", trace: [[200, -60], [-200, -60]], largeur_m: 10, quais: true }], ponts: [{ id: "pont", position: [-30, -60], angle_deg: 90, longueur_m: 16, largeur_m: 8, type: "pierre" }], puits: [], fontaines: [[0, 0]] },
    points_de_vue: [
      { id: "ensemble", nom: "Vue d'ensemble", oeil: [300, 300, 260], cible: [0, 0, 0], fov: 50 },
      { id: "place", nom: "Place", oeil: [20, 40, 1.7], cible: [0, 0, 6], fov: 60 },
      { id: "porte", nom: "Porte", oeil: [0, 300, 1.7], cible: [0, 230, 18], fov: 55 },
      { id: "rue", nom: "Rue", oeil: [-30, 150, 1.7], cible: [-30, 0, 8], fov: 60 },
      { id: "canal", nom: "Canal", oeil: [100, -60, 3], cible: [0, -60, 2], fov: 60 },
      { id: "mur", nom: "Mur", oeil: [0, -260, 5], cible: [0, -230, 30], fov: 60 },
    ],
    etats: [
      { id: "avant", nom: "Avant", date: "845", canon: "A", sources: [{ ref: "aucune", canon: "A" }], portes: { sud: "intacte" }, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 1 },
      { id: "apres", nom: "Après", date: "850", canon: "A", sources: [{ ref: "aucune", canon: "A" }], portes: { sud: "brisee_845" }, ruines: [{ polygone: [[-200, 0], [200, 0], [200, 220], [-200, 220]], part: 0.5 }], incendies: [], rochers: [], abandon: 0.5, ciel: "brumeux", habitants: 0 },
    ],
    etat_defaut: "avant",
  };
}
