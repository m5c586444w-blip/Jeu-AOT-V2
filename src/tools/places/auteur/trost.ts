import type { Gabarit, Place } from "../../../data/placeSchema";
import { pt } from "./kit";
import { BASE_GABARITS, baseViews, pts } from "./maria";
import { building, buildSaillie, cellKey, claimRect, lines, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * Trost (C15, tranche 1) — district sud du mur Rose, plan d'auteur. Établi [C] : district sud de Wall Rose, bâti dans une saillie du
 * mur à deux portes (fichiers 01 §3.1 et 11 §2, atlas 06 S01 et W05), quartier général de la Garnison et entrepôt de gaz (atlas 06 ;
 * `poi_qg_garnison_trost` [C], `poi_entrepot_gaz_trost` [A] dans `data/geo/paradis.json`), brèche de 850 et zone de bouchage à la porte
 * sud, canons de rempart sur rails (fichier 20, LC-B), garnison de 2 500 soldats au départ du scénario 845. Tout le reste est une
 * adaptation [A] : tracé, noms de rues, de places et de bâtiments, dimensions, quartiers, gabarits.
 *
 * Parti d'auteur [A] : ville de logistique et de garnison, premier verrou sud de l'intérieur après la chute de Maria (845) — damier
 * militaire de 100 m sur 105 m, Grand-Rue du Sud de la porte extérieure à la porte intérieure, place du Marché au tiers de l'axe,
 * place de la Porte Sud à son pied, quartier de la Garnison et du quartier général contre la porte sud, entrepôts (grenier, dépôt
 * de gaz) à l'est, rue de l'Évacuation (itinéraire de repli des civils vers la porte intérieure, 845 puis 850), vieux Trost autour de
 * l'église. Population : celle de `prov_trost` (95 652 au scénario 845), 90 % intra-muros, 10 % au faubourg de la porte intérieure.
 */
const S = lines(-1500, 1500, 100, 9, { 6: 12, 11: 14, 19: 14, 24: 12 });
const T = lines(25, 1500, 105, 9, { 2: 12, 5: 12, 8: 12, 11: 12 });

const GABARITS: Record<string, Gabarit> = {
  centre: BASE_GABARITS.centre as Gabarit,
  ouvrier: BASE_GABARITS.ouvrier as Gabarit,
  faubourg: { ...(BASE_GABARITS.faubourg as Gabarit), cour: { type: "jardin", arbres_par_ha: 60 } },
  garnison: BASE_GABARITS.garnison as Gabarit,
  marchand: { etages: [3, 3, 4, 3], hauteur_etage_m: 3.1, toits: ["pignon_rue", "croupe", "pignon_rue", "demi_croupe"], pente_deg: [44, 56], couvertures: ["tuile_plate", "ardoise", "tuile_plate", "tuile_plate"], facades: ["colombage", "enduit", "pierre_taillee", "enduit"], teintes: ["#EBDDC2", "#E4D0AC", "#EFD9C4", "#DFDBC8", "#E8DCBE"], parcelles_m: [7.5, 9, 6.5, 10], profondeur_m: 13, boutiques: true, passage_m: 40, cour: { type: "pavee", arbres_par_ha: 40 } },
  entrepots: { etages: [2, 3, 3, 2], hauteur_etage_m: 3.8, toits: ["croupe", "pignon", "demi_croupe", "pignon"], pente_deg: [34, 46], couvertures: ["ardoise", "tuile_plate", "ardoise", "tuile_plate"], facades: ["pierre_brute", "brique", "pierre_brute", "bois"], teintes: ["#CCC0A8", "#C3B79F", "#D2C6AE", "#BEB29A"], parcelles_m: [20, 26, 18, 24], profondeur_m: 20, boutiques: false, passage_m: 50, cour: { type: "pavee", arbres_par_ha: 30 } },
};

const Q = {
  vieux: quarter("vieux-trost", "Vieux Trost", "centre", "habitation"),
  marche: quarter("quartier-du-marche", "Quartier du Marché", "marchand", "marche", 0.95),
  garnison: quarter("quartier-de-la-garnison", "Quartier de la Garnison", "garnison", "caserne", 0.75),
  entrepots: quarter("quartier-des-entrepots", "Quartier des Entrepôts", "entrepots", "entrepot", 0.85),
  ouvrier: quarter("quartier-des-rives", "Quartier des Rives (ouvriers et familles de soldats)", "ouvrier", "habitation", 0.95),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, -200, 200, 760, 970, { kind: "place", id: "place-du-marche", nom: "Place du Marché", revetement: "paves", fontaine: true, marche: true });
claimRect(claims, S, T, -200, 200, 1285, 1495, { kind: "place", id: "place-de-la-porte-sud", nom: "Place de la Porte Sud", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, 100, 200, 340, 445, { kind: "place", id: "parvis-de-l-eglise", nom: "Parvis de l'église", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, -700, -500, 550, 655, { kind: "place", id: "place-des-casernes", nom: "Place des Casernes", revetement: "terre", fontaine: false, marche: false });
claimRect(claims, S, T, -900, -700, 340, 445, { kind: "parc", id: "jardin-des-tilleuls", nom: "Jardin des Tilleuls", essences: ["tilleul", "marronnier", "erable"], arbres_par_ha: 70 });
claimRect(claims, S, T, 700, 900, 235, 340, { kind: "parc", id: "promenade-des-rives", nom: "Promenade des Rives", essences: ["peuplier", "saule", "tilleul"], arbres_par_ha: 65 });
claimRect(claims, S, T, 900, 1100, 865, 970, { kind: "parc", id: "jardin-des-entrepots", nom: "Jardin des Entrepôts", essences: ["fruitier", "tilleul", "bouleau"], arbres_par_ha: 60 });
claimRect(claims, S, T, -1100, -900, 1075, 1180, { kind: "parc", id: "enclos-du-souvenir", nom: "Enclos du souvenir", essences: ["pin", "tilleul", "bouleau"], arbres_par_ha: 55 });
claims[cellKey(S, T, 100, 445)] = { kind: "ilot", fonction: "culte", densite: 0.55, quartier: Q.vieux.id, gabarit: "centre" };

/** Noms de rues de Trost : tous créés [A] (aucun nom de rue de Trost n'est établi). */
const NOMS_S = [
  "Rue des Fourriers", "Rue des Vivandiers", "Rue du Train", "Rue des Remontes", "Rue des Mulets", "Rue des Charretiers", "Rue des Selliers", "Rue des Bourreliers", "Rue des Maréchaux", "Rue des Armuriers",
  "Rue de la Poudre", "Rue du Gaz", "Rue des Lampistes", "Rue des Gabelous", "Rue des Fours", "Rue des Boulangers", "Rue des Meuniers", "Rue des Tonneliers", "Rue des Cordiers", "Rue des Brasseurs",
  "Rue des Hallebardiers", "Rue du Guet", "Rue de la Relève", "Rue des Sentinelles", "Rue du Pont-Levis", "Rue des Herses", "Rue des Créneaux", "Rue des Veilleurs", "Rue des Tambours", "Rue des Fifres",
];
const NOMS_T = [
  "Rue du Corps de garde", "Rue des Casernes", "Rue de la Caserne Neuve", "Rue du Marché", "Rue des Étals", "Rue des Halles", "Rue des Drapiers", "Rue des Merciers", "Rue de l'Église", "Rue des Chaudronniers",
  "Rue des Potiers", "Rue des Tuiliers", "Rue des Couvreurs", "Rue des Charpentiers", "Rue Basse", "Rue des Vignerons",
];

export function trost(): Place {
  const base = buildSaillie({
    id: "trost",
    nom: "Trost",
    libelle: "Trost",
    canon: "C",
    sources: [
      { ref: "docs/spec/01 §3.1 et docs/spec/11 §2 : Trost, district sud du mur Rose ; docs/spec/06 (S01, W05) : quartier général de la Garnison, brèche de 850, porte de Trost, zone de bouchage ; manga, 850 : bataille de Trost (104e promotion)", canon: "C" },
      { ref: "docs/spec/20 (LC-B) : porte sud, quartier général, rue des évacuations de 845 et de 850, canons de rempart sur rails, place du marché, rocher de 850 comme état", canon: "C" },
      { ref: "tracé de la saillie, noms de rues, de places et de bâtiments, dimensions, quartiers : adaptation (création C15, `docs/lore/creations.md`)", canon: "A" },
    ],
    province: "prov_trost",
    style: "E01",
    mur: "rose",
    population: { province: "prov_trost", part: 0.9, canon: "C", note: "90 % de la population de `prov_trost` au départ de scn_sandbox_845 (95 652 hab.) logés intra-muros ; la province existe [C], la part est adaptée [A]." },
    densite: { classe: "coeur", valeur: 250, canon: "A" },
    orientation: { valeur: "sud", canon: "C" },
    R: 1560,
    grid: { rot: 0, s: S, t: T },
    main: { nom: "Grand-Rue du Sud", largeur_m: 20 },
    names: {
      s: NOMS_S,
      t: NOMS_T,
      lanes: ["Ruelle du Guet", "Ruelle des Lampes"],
      placettes: ["Place du Corps de garde", "Placette des Fourriers", "Place de la Relève", "Placette du Puits", "Place des Charrois", "Placette des Tonneliers"],
    },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      const r = Math.hypot(c[0], c[1]);
      if (c[1] > 1150 && Math.abs(c[0]) < 700) return Q.garnison.id;
      if (Math.abs(c[0]) < 500 && c[1] > 700 && c[1] < 1150) return Q.marche.id;
      if (c[0] > 500 && c[1] > 600) return Q.entrepots.id;
      if (r < 620) return Q.vieux.id;
      if (Math.abs(c[0]) > 800) return Q.ouvrier.id;
      return Q.vieux.id;
    },
    claims,
    placettes: [cellKey(S, T, -600, 970), cellKey(S, T, 600, 445), cellKey(S, T, -300, 235), cellKey(S, T, 300, 1180), cellKey(S, T, -1200, 760), cellKey(S, T, 1200, 550)],
    faubourg: {
      nom: "Faubourg de la porte intérieure",
      population: { province: "prov_trost", part: 0.1, canon: "A", note: "10 % de la population de `prov_trost` au départ de scn_sandbox_845 logés au pied de la porte intérieure, côté intérieur des terres (adaptation)." },
      densite: { classe: "faubourg", valeur: 100, canon: "A" },
      xs: [-840, -630, -420, -210, 0, 210, 420, 630, 840],
      ys: [-30, -170, -310, -450, -590],
      gabarit: "faubourg",
      quarter: quarter("faubourg-de-la-porte-interieure", "Faubourg de la porte intérieure", "faubourg", "habitation", 0.55),
      names: ["Chemin des Prés", "Chemin du Lavoir", "Chemin des Haies", "Chemin des Ruches", "Chemin du Gué", "Chemin des Vergers", "Chemin de la Mare", "Chemin des Saules", "Chemin des Ormes", "Chemin du Glacis", "Chemin des Champs"],
    },
    canons_m: 24,
    batiments(ctx) {
      const c = (s: number, t: number): [number, number] => ctx.cell(S.findIndex(([v]) => v === s), T.findIndex(([v]) => v === t));
      return [
        building({ id: "quartier-general-garnison", nom: "Quartier général de la Garnison (emplacement)", canon: "C", archetype: "caserne", position: c(-400, 1180), emprise_m: [64, 48], angle_deg: 0, hauteur_m: 14, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#DAD4C6", params: { cour: true, pente: 38 }, reperes_canon: ["poi_qg_garnison_trost [C] (atlas 06 S01) : existence et ville établies, emplacement [A] ; plan intérieur : tranche C15 ultérieure"], sources: [{ ref: "docs/spec/06 : QG de la Garnison (Trost) [C] ; data/geo/paradis.json : poi_qg_garnison_trost", canon: "C" }, { ref: "emplacement et volumes : adaptation", canon: "A" }] }),
        building({ id: "caserne-de-la-porte-sud", nom: "Caserne de la Porte Sud", canon: "A", archetype: "caserne", position: c(400, 1180), emprise_m: [62, 54], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D6D0C2", params: { cour: true, pente: 36 }, reperes_canon: ["Garnison aux portes (fichiers 01 et 11) : bâtiment adapté"] }),
        building({ id: "caserne-des-rives", nom: "Caserne des Rives", canon: "A", archetype: "caserne", position: c(-800, 865), emprise_m: [62, 54], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "brique", teinte: "#CBB9A4", params: { cour: true, pente: 38 } }),
        building({ id: "entrepot-de-gaz", nom: "Entrepôt de gaz de Trost", canon: "A", archetype: "entrepot", position: c(700, 970), emprise_m: [58, 28], angle_deg: 0, hauteur_m: 11, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#BFB6A4", params: { pente: 34 }, reperes_canon: ["poi_entrepot_gaz_trost [A] (data/geo/paradis.json) : cible de sabotage (atlas 06)"] }),
        building({ id: "grenier-de-trost", nom: "Grenier de Trost", canon: "A", archetype: "grenier", position: c(500, 760), emprise_m: [44, 20], angle_deg: 0, hauteur_m: 14, etages: 4, toit: "croupe", couverture: "tuile_plate", facade: "pierre_brute", teinte: "#CFC2A8", params: { pente: 46 }, reperes_canon: ["bld_grenier dans prov_trost (data/scenarios/sandbox_845.json)"] }),
        building({ id: "halle-du-marche", nom: "Halle du Marché", canon: "A", archetype: "halle", position: pt(-100, 865), emprise_m: [44, 22], angle_deg: 0, hauteur_m: 12, etages: 1, toit: "croupe", couverture: "tuile_plate", facade: "bois", teinte: "#C8AE88", params: { piliers: 9, pente: 42 }, reperes_canon: ["bld_marche dans prov_trost (data/scenarios/sandbox_845.json)"] }),
        ...[[-150, 800], [-60, 800], [30, 800], [120, 800], [-150, 930], [-60, 930], [30, 930], [120, 930]].map(([x, y], k) =>
          building({ id: `etal-${k + 1}`, nom: `Étal couvert ${k + 1}`, canon: "A", archetype: "halle", position: pt(x as number, y as number), emprise_m: [14, 7], angle_deg: 0, hauteur_m: 5, etages: 1, toit: "appentis", couverture: "tuile_plate", facade: "bois", teinte: "#BFA37C", params: { piliers: 4, pente: 30 } }),
        ),
        building({ id: "eglise", nom: "Église de Trost", canon: "A", archetype: "eglise", position: c(100, 445), emprise_m: [22, 46], angle_deg: 0, hauteur_m: 19, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E2DACB", params: { clocher_m: 50, clocher_cote: 8.5, abside: true, pente: 50 } }),
        building({ id: "hotel-de-ville", nom: "Hôtel de ville de Trost", canon: "A", archetype: "hotel_de_ville", position: c(-100, 340), emprise_m: [30, 18], angle_deg: 0, hauteur_m: 14, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 48 } }),
        building({ id: "clinique-de-la-garnison", nom: "Infirmerie de la Garnison", canon: "A", archetype: "clinique", position: c(-600, 1180), emprise_m: [40, 20], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "enduit", teinte: "#EDE6D6", params: { pente: 40 } }),
        building({ id: "poste-porte-sud", nom: "Poste de garde de la porte sud", canon: "A", archetype: "caserne", position: pt(-70, 1500), emprise_m: [26, 12], angle_deg: 0, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { pente: 40 } }),
      ];
    },
    vegetation(ctx, parcs) {
      return {
        alignements: [
          { rue: "axe-principal", essence: "tilleul", intervalle_m: 12, cotes: "deux" },
          { rue: "rue-du-mur", essence: "marronnier", intervalle_m: 15, cotes: "droite" },
          { rue: "chemin-du-rempart-est", essence: "tilleul", intervalle_m: 16, cotes: "deux" },
          { rue: "chemin-du-rempart-ouest", essence: "tilleul", intervalle_m: 16, cotes: "deux" },
          { rue: "route-interieure", essence: "peuplier", intervalle_m: 12, cotes: "deux" },
          { rue: "route-exterieure", essence: "peuplier", intervalle_m: 14, cotes: "deux" },
          { rue: `s-${S.findIndex(([v]) => v === -400)}`, essence: "marronnier", intervalle_m: 13, cotes: "deux" },
          { rue: `s-${S.findIndex(([v]) => v === 400)}`, essence: "marronnier", intervalle_m: 13, cotes: "deux" },
          { rue: `t-${T.findIndex(([v]) => v === 550)}`, essence: "erable", intervalle_m: 14, cotes: "deux" },
        ],
        isoles: [
          { position: pt(-170, 940), essence: "tilleul", hauteur_m: 22, nom: "Tilleul de la place du Marché" },
          { position: pt(160, 1330), essence: "chene", hauteur_m: 24, nom: "Chêne de la porte sud" },
          { position: pt(-60, 60), essence: "marronnier", hauteur_m: 17 },
          { position: pt(60, 60), essence: "marronnier", hauteur_m: 17 },
        ],
        parcs,
        vergers: [
          { polygone: pts([[-820, -60], [-640, -60], [-640, -560], [-820, -560]]), espacement_m: 8 },
          { polygone: pts([[640, -60], [820, -60], [820, -560], [640, -560]]), espacement_m: 8 },
        ],
        haies: [{ trace: pts([[-850, -610], [850, -610]]) }],
        potagers: [{ polygone: pts([[220, -330], [620, -330], [620, -560], [220, -560]]) }],
        essences_cours: ["tilleul", "marronnier", "erable", "fruitier"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-1000, 300], [900, 520], [-250, 640], [250, 1060], [-1100, 1000]]), fontaines: pts([[0, 865], [150, 400]]) }),
    points_de_vue(ctx) {
      return baseViews(ctx, [
        { id: "place-du-marche", nom: "Place du Marché et halle", oeil: [60, 790, 2.4], cible: [-100, 865, 6], fov: 62 },
        { id: "porte-sud", nom: "Place de la Porte Sud et quartier de la Garnison", oeil: [-120, 1380, 4], cible: [-350, 1232, 10], fov: 60 },
        { id: "rue-de-l-evacuation", nom: "Rue de l'Évacuation vers la porte intérieure", oeil: [-400, 1100, 2], cible: [-400, 600, 7], fov: 60 },
        { id: "entrepots", nom: "Entrepôts et dépôt de gaz", oeil: [440, 1090, 6], cible: [700, 880, 8], fov: 60 },
      ]);
    },
    etats(ctx) {
      void ctx;
      const etats: Place["etats"] = [
        { id: "845-avant", nom: "845, Trost en garnison ordinaire", date: "845", canon: "A", sources: [{ ref: "état ordinaire du district ; garnison de 2 500 soldats (data/scenarios/sandbox_845.json)", canon: "A" }], portes: {}, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 1 },
        {
          id: "850-breche",
          nom: "850, la brèche de la porte sud",
          date: "850",
          canon: "C",
          sources: [
            { ref: "docs/spec/01 (850 : Trost, 104e promotion) ; docs/spec/06 W05 et S01 : brèche 850 à la porte de Trost [C]", canon: "C" },
            { ref: "étendue des ruines, incendies, débris : adaptation ; l'identifiant d'état de porte « brisee_845 » est historique (schéma de R1e) et vaut ici « brisée par la brèche de 850 »", canon: "A" },
          ],
          portes: { exterieure: "brisee_845" },
          ruines: [
            { polygone: pts([[-420, 1285], [420, 1285], [520, 1500], [-520, 1500]]), part: 0.5 },
            { polygone: pts([[-300, 970], [300, 970], [300, 1285], [-300, 1285]]), part: 0.2 },
          ],
          incendies: pts([[-120, 1400], [90, 1330], [-260, 1240], [230, 1210], [-40, 1100]]),
          rochers: [{ position: pt(35, 1470), rayon_m: 4.5, canon: "A" }, { position: pt(-90, 1390), rayon_m: 3.2, canon: "A" }, { position: pt(180, 1330), rayon_m: 2.8, canon: "A" }],
          abandon: 0,
          ciel: "enfume",
          habitants: 0.35,
        },
        {
          id: "850-bouchee",
          nom: "850, brèche bouchée par un rocher",
          date: "850",
          canon: "C",
          sources: [
            { ref: "docs/spec/06 W05 : porte de Trost, zone de bouchage [C] ; docs/spec/03 §Trost 850 : bouchage de brèche", canon: "C" },
            { ref: "taille et position du rocher, ruines restantes : adaptation", canon: "A" },
          ],
          portes: { exterieure: "bouchee" },
          ruines: [
            { polygone: pts([[-900, 900], [900, 900], [1000, 1500], [-1000, 1500]]), part: 0.6 },
            { polygone: pts([[-700, 380], [700, 380], [700, 900], [-700, 900]]), part: 0.25 },
          ],
          incendies: [],
          rochers: [{ position: pt(0, 1512), rayon_m: 11, canon: "A" }, { position: pt(-90, 1390), rayon_m: 3.2, canon: "A" }, { position: pt(150, 1350), rayon_m: 2.4, canon: "A" }],
          abandon: 0.35,
          ciel: "brumeux",
          habitants: 0.2,
        },
      ];
      return etats;
    },
    portes: (_ctx, gate) => [
      gate({
        id: "exterieure",
        nom: "Porte sud de Trost",
        role: "exterieure",
        trace: "saillie",
        s_m: Math.round(((1560 * 90 * Math.PI) / 180) * 10) / 10,
        canon: "C",
        sources: [{ ref: "docs/spec/06 W05 : porte de Trost [C], brèche de 850 [C]", canon: "C" }, { ref: "dimensions et mécanisme : aucune source (Q5)", canon: "A" }],
      }),
      gate({
        id: "interieure",
        nom: "Porte intérieure de Trost",
        role: "interieure",
        trace: "mur-centre",
        s_m: 1560,
        passage: { largeur_m: 12, hauteur_m: 17, voute: "plein_cintre", trous_assassin: 4, rainures: true, canon: "A" },
        vantail: { type: "battants", largeur_m: 12.4, hauteur_m: 16, epaisseur_m: 0.8, materiau: "chene_ferre", canon: "A" },
        structure: { huisserie: true, gonds: 4, treuils: 1, contrepoids: 0, herse: true, canon: "A" },
        tours: [
          { type: "poste_de_garde", cote: "gauche", hauteur_m: 6, canon: "A" },
          { type: "poste_de_garde", cote: "droite", hauteur_m: 6, canon: "A" },
        ],
        portail: "pilastres",
      }),
    ],
  });
  // L'axe d'évacuation (845, 850) : la rue du damier à x = -400 est élargie et nommée ; création [A].
  const evac = `s-${S.findIndex(([v]) => v === -400)}`;
  base.rues = base.rues.map((r) => (r.id.startsWith(evac) ? { ...r, nom: "Rue de l'Évacuation", canon: "A" as const } : r));
  return base;
}
