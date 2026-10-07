import type { Gabarit, Place, Street } from "../../../data/placeSchema";
import { pt, r1 } from "./kit";
import { BASE_GABARITS, LIBELLE, SOURCES_MARIA, baseViews, mariaStates, pts } from "./maria";
import { authored, buildSaillie, building, cellKey, claimRect, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * District 4 du mur Maria (nom non établi, Q1) — identité d'auteur [A] : district de marché et de rivière. Damier oblique
 * (33°), recoupé par l'axe principal en îlots triangulaires, comme une ville marchande qui a grandi le long d'une route plus
 * ancienne que ses rues ; grand marché et halle, marché aux draps, maison du Change, hôtel de ville. La rivière coule à
 * l'intérieur du mur Maria, parallèle au mur, à 340 m derrière la porte intérieure : port, quais et entrepôts dans le
 * faubourg. Aucune porte de rivière (règle : il n'y en a qu'à Shiganshina).
 */
const VALUES = [-1360, -1275, -1190, -1110, -1020, -935, -850, -765, -680, -595, -510, -425, -340, -255, -170, -85, 0, 85, 170, 255, 340, 425, 510, 595, 680, 765, 850, 935, 1020, 1110, 1190, 1275, 1360];
const S = authored(VALUES, 8, { [-510]: 11, 0: 11, 510: 11, 1020: 11, [-1020]: 11, [-425]: 4.5, 425: 4.5, 935: 4.5 });
const T = authored(VALUES, 8, { 340: 12, 765: 12, [-340]: 12, 1110: 11, 85: 4.5, 595: 4.5 });

const GABARITS: Record<string, Gabarit> = {
  centre: BASE_GABARITS.centre as Gabarit,
  marchand: { etages: [3, 4, 3, 4, 2], hauteur_etage_m: 3.1, toits: ["pignon_rue", "pignon_rue", "pignon", "croupe", "pignon_rue", "demi_croupe"], pente_deg: [48, 60], couvertures: ["tuile_plate", "tuile_canal", "ardoise", "tuile_plate", "bardeau"], facades: ["colombage", "enduit", "colombage", "brique", "enduit", "pierre_taillee"], teintes: ["#EAD7B6", "#E3CFAE", "#EFE0C6", "#DCC7A4", "#E8D2BC", "#F1E3CB", "#E6C9A8", "#DDD0B2"], parcelles_m: [6.5, 8, 6, 9, 7, 7.5], profondeur_m: 13, boutiques: true, passage_m: 38, cour: { type: "plantee", arbres_par_ha: 70 } },
  drapiers: { etages: [3, 3, 4, 2], hauteur_etage_m: 3.2, toits: ["pignon_rue", "pignon", "mansarde", "pignon_rue"], pente_deg: [46, 58], couvertures: ["ardoise", "tuile_plate", "ardoise", "bardeau"], facades: ["colombage", "pierre_taillee", "enduit", "colombage", "brique"], teintes: ["#E5D6BA", "#DCCCAE", "#EADCC5", "#D6C6A8", "#E9D2B4", "#E0D7C0"], parcelles_m: [8, 10, 7, 11], profondeur_m: 14, boutiques: true, passage_m: 45, cour: { type: "plantee", arbres_par_ha: 75 } },
  bourgeois: { etages: [3, 4, 4, 3], hauteur_etage_m: 3.3, toits: ["croupe", "mansarde", "pignon", "croupe"], pente_deg: [42, 55], couvertures: ["ardoise", "tuile_plate", "ardoise"], facades: ["pierre_taillee", "enduit", "enduit", "brique"], teintes: ["#EDE6D6", "#E6DCC6", "#F0E9DD", "#DCD3C0", "#E9DFCD"], parcelles_m: [10, 13, 9, 14], profondeur_m: 14, boutiques: false, passage_m: 60, cour: { type: "plantee", arbres_par_ha: 95 } },
  ouvrier: BASE_GABARITS.ouvrier as Gabarit,
  garnison: BASE_GABARITS.garnison as Gabarit,
  port: { etages: [2, 3, 2, 3], hauteur_etage_m: 3.6, toits: ["croupe", "pignon", "pignon_rue", "croupe"], pente_deg: [32, 44], couvertures: ["tuile_canal", "ardoise", "tuile_plate", "bardeau"], facades: ["pierre_brute", "bois", "brique", "colombage"], teintes: ["#D6CBB6", "#C9B79E", "#BFB4A2", "#D2C4AA"], parcelles_m: [14, 20, 12, 22], profondeur_m: 15, boutiques: true, passage_m: 45, cour: { type: "pavee", arbres_par_ha: 35 } },
};

const Q = {
  marchand: quarter("quartier-du-grand-marche", "Quartier du Grand Marché", "marchand", "marche"),
  drapiers: quarter("quartier-des-drapiers", "Quartier des Drapiers", "drapiers", "atelier"),
  bourgeois: quarter("quartier-du-change", "Quartier du Change", "bourgeois", "habitation", 0.95),
  centre: quarter("vieille-ville", "Vieille ville", "centre", "habitation"),
  ouvrier: quarter("quartier-des-portefaix", "Quartier des Portefaix", "ouvrier", "habitation"),
  garnison: quarter("quartier-de-la-porte", "Quartier de la Porte", "garnison", "caserne", 0.75),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, 170, 340, 595, 765, { kind: "place", id: "grand-marche", nom: "Grand Marché", revetement: "paves", fontaine: true, marche: true });
claimRect(claims, S, T, -255, -85, 680, 850, { kind: "place", id: "marche-aux-draps", nom: "Marché aux Draps", revetement: "dalles", fontaine: false, marche: true });
claimRect(claims, S, T, 255, 340, 340, 425, { kind: "place", id: "place-du-change", nom: "Place du Change", revetement: "dalles", fontaine: true, marche: false });
claimRect(claims, S, T, 510, 680, 85, 255, { kind: "parc", id: "jardin-des-marchands", nom: "Jardin des Marchands", essences: ["tilleul", "marronnier", "erable"], arbres_par_ha: 70 });
claimRect(claims, S, T, -680, -510, 935, 1110, { kind: "parc", id: "verger-du-rempart", nom: "Verger du Rempart", essences: ["fruitier", "fruitier", "tilleul"], arbres_par_ha: 85 });
claims[cellKey(S, T, 340, 425)] = { kind: "ilot", fonction: "culte", densite: 0.55, gabarit: "centre" };

/** Rivière [A] : parallèle au mur, côté de l'intérieur du mur Maria, de part en part du faubourg. */
const RIVER_Y = -340;
const RIVER_W = 42;

export function mariaDistrict4(): Place {
  return buildSaillie({
    id: "maria-district-4",
    nom: "maria-district-4",
    libelle: LIBELLE,
    canon: "?",
    sources: SOURCES_MARIA,
    province: null,
    style: "E01",
    mur: "maria",
    population: { province: null, part: 1, valeur: 50000, canon: "?", note: "Valeur paramétrable (Q8) : aucun district de ce nom dans les données de simulation." },
    densite: { classe: "coeur", valeur: 240, canon: "A" },
    orientation: { valeur: "nord", canon: "?" },
    R: 1250,
    grid: { rot: 33, s: S, t: T },
    main: { nom: "Grand-Chemin", largeur_m: 16 },
    names: {
      s: ["Rue des Changeurs", "Rue des Peseurs", "Rue des Courtiers", "Rue des Épiciers", "Rue des Merciers", "Rue de la Laine", "Rue des Foulons", "Rue des Teinturiers", "Rue des Tondeurs", "Rue de la Soie", "Rue des Marchands", "Rue des Balances", "Rue du Poids-Public", "Rue des Halles", "Rue des Fripiers", "Rue des Chapeliers", "Rue des Gantiers", "Rue des Pelletiers", "Rue des Cordonniers", "Rue des Savetiers", "Rue des Orfèvres", "Rue de la Monnaie", "Rue des Lombards", "Rue des Banquiers"],
      t: ["Rue de la Rivière", "Rue des Bateliers", "Rue du Port", "Rue des Tonneaux", "Rue du Sel", "Rue des Épices", "Rue du Vin", "Rue des Harengs", "Rue du Grand-Marché", "Rue des Étals", "Rue des Boutiques", "Rue des Enseignes", "Rue des Lanternes", "Rue des Comptoirs", "Rue des Facteurs", "Rue des Douanes", "Rue des Péages", "Rue des Rouliers", "Rue des Voituriers", "Rue des Postes", "Rue des Relais", "Rue de la Grande-Porte"],
      lanes: ["Passage des Merciers", "Passage du Poids", "Ruelle des Chandelles", "Ruelle du Panier", "Passage Couvert", "Ruelle des Sacs", "Ruelle de l'Aune", "Ruelle du Denier"],
      placettes: ["Place aux Herbes", "Place du Poids-Public", "Placette des Merciers", "Place des Fripiers", "Placette des Lanternes", "Place du Pilori"],
    },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      const r = Math.hypot(c[0], c[1]);
      if (r > 1020 && Math.abs(c[0]) < 330) return Q.garnison.id;
      if (Math.hypot(c[0] + 160, c[1] - 720) < 330) return Q.marchand.id;
      if (Math.hypot(c[0] + 330, c[1] - 820) < 380 && c[0] < -200) return Q.drapiers.id;
      if (r < 420) return Q.centre.id;
      if (c[0] > 200 && r < 900) return Q.bourgeois.id;
      if (c[0] < -500) return Q.drapiers.id;
      return Q.ouvrier.id;
    },
    claims,
    placettes: [cellKey(S, T, -595, 425), cellKey(S, T, 425, 510), cellKey(S, T, -170, 340), cellKey(S, T, 595, 850), cellKey(S, T, -425, 1020), cellKey(S, T, 85, 1020)],
    faubourg: {
      nom: "Faubourg du Port",
      population: { province: null, part: 1, valeur: 5000, canon: "?", note: "Valeur paramétrable (Q8)." },
      densite: { classe: "faubourg", valeur: 90, canon: "A" },
      xs: [-945, -735, -525, -315, -105, 0, 105, 315, 525, 735, 945],
      ys: [-30, -165, -300],
      gabarit: "port",
      quarter: quarter("faubourg-du-port", "Faubourg du Port", "port", "entrepot", 0.7),
      names: ["Chemin du Halage", "Chemin des Pêcheurs", "Chemin des Saules", "Chemin des Barques", "Chemin du Bac", "Chemin des Filets", "Chemin des Joncs", "Chemin des Lavandières", "Chemin du Glacis", "Chemin du Port", "Chemin des Écluses", "Chemin des Rives"],
    },
    extraStreets(): Street[] {
      const q = RIVER_W / 2 + 4;
      return [
        { id: "quai-du-port", nom: "Quai du Port", canon: "A", type: "quai", trace: [pt(-1500, RIVER_Y + q), pt(1500, RIVER_Y + q)], largeur_m: 8, revetement: "dalles" },
        { id: "quai-d-en-face", nom: "Quai d'en face", canon: "A", type: "quai", trace: [pt(-1500, RIVER_Y - q), pt(1500, RIVER_Y - q)], largeur_m: 8, revetement: "dalles" },
      ];
    },
    batiments(ctx) {
      const c = (s: number, t: number): [number, number] => ctx.cell(S.findIndex(([v]) => v === s), T.findIndex(([v]) => v === t));
      const mid = (a: [number, number], b: [number, number]): [number, number] => pt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      const a = ctx.rot;
      return [
        building({ id: "grande-halle", nom: "Grande halle du marché", canon: "A", archetype: "halle", position: mid(c(170, 595), c(255, 680)), emprise_m: [60, 26], angle_deg: a, hauteur_m: 13, etages: 1, toit: "croupe", couverture: "tuile_plate", facade: "bois", teinte: "#C7AC86", params: { piliers: 10, pente: 42 } }),
        building({ id: "halle-aux-draps", nom: "Halle aux draps", canon: "A", archetype: "halle", position: mid(c(-255, 680), c(-170, 765)), emprise_m: [44, 22], angle_deg: a, hauteur_m: 12, etages: 1, toit: "croupe", couverture: "ardoise", facade: "bois", teinte: "#CBB896", params: { piliers: 8, pente: 44 } }),
        building({ id: "hotel-de-ville", nom: "Hôtel de ville", canon: "A", archetype: "hotel_de_ville", position: c(170, 510), emprise_m: [40, 20], angle_deg: a, hauteur_m: 16, etages: 4, toit: "mansarde", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E8E0CF", params: { pente: 56 } }),
        building({ id: "maison-du-change", nom: "Maison du Change", canon: "A", archetype: "hotel_de_ville", position: c(340, 340), emprise_m: [26, 16], angle_deg: a, hauteur_m: 13, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#EDE4D2", params: { pente: 50 } }),
        building({ id: "eglise", nom: "Église du marché", canon: "A", archetype: "eglise", position: c(340, 425), emprise_m: [22, 48], angle_deg: a, hauteur_m: 19, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E4DCCB", params: { clocher_m: 52, clocher_cote: 9, abside: true, pente: 52 } }),
        building({ id: "caserne-de-la-porte", nom: "Caserne de la Porte", canon: "A", archetype: "caserne", position: c(425, 935), emprise_m: [56, 50], angle_deg: a, hauteur_m: 10, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D6D0C2", params: { cour: true, pente: 38 }, reperes_canon: ["Garnison aux portes (fichiers 01 et 11) : bâtiment adapté"] }),
        building({ id: "poste-porte-exterieure", nom: "Poste de garde de la porte extérieure", canon: "A", archetype: "caserne", position: pt(-58, 1150), emprise_m: [24, 12], angle_deg: 0, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { pente: 40 } }),
        building({ id: "entrepot-du-port-ouest", nom: "Entrepôt du port (ouest)", canon: "A", archetype: "entrepot", position: pt(-420, -245), emprise_m: [70, 22], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "tuile_canal", facade: "pierre_brute", teinte: "#CFC3AD", params: { pente: 34 } }),
        building({ id: "entrepot-du-port-est", nom: "Entrepôt du port (est)", canon: "A", archetype: "entrepot", position: pt(420, -245), emprise_m: [70, 22], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "brique", teinte: "#C2A88E", params: { pente: 34 } }),
        building({ id: "moulin-du-port", nom: "Moulin du port", canon: "A", archetype: "moulin", position: pt(860, RIVER_Y + RIVER_W / 2 + 7.6), emprise_m: [14, 18], angle_deg: 0, hauteur_m: 9, etages: 2, toit: "pignon", couverture: "bardeau", facade: "pierre_brute", teinte: "#CFC6B4", params: { roue: true, pente: 45 } }),
      ];
    },
    vegetation(ctx, parcs) {
      return {
        alignements: [
          { rue: "axe-principal", essence: "tilleul", intervalle_m: 11, cotes: "deux" },
          { rue: "rue-du-mur", essence: "marronnier", intervalle_m: 15, cotes: "droite" },
          { rue: "chemin-du-rempart-est", essence: "tilleul", intervalle_m: 16, cotes: "deux" },
          { rue: "chemin-du-rempart-ouest", essence: "tilleul", intervalle_m: 16, cotes: "deux" },
          { rue: "quai-du-port", essence: "saule", intervalle_m: 13, cotes: "droite" },
          { rue: "quai-d-en-face", essence: "peuplier", intervalle_m: 13, cotes: "gauche" },
          { rue: "route-interieure", essence: "peuplier", intervalle_m: 12, cotes: "deux" },
          { rue: "route-exterieure", essence: "peuplier", intervalle_m: 14, cotes: "deux" },
          { rue: `t-${T.findIndex(([v]) => v === 765)}`, essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: `s-${S.findIndex(([v]) => v === 510)}`, essence: "marronnier", intervalle_m: 14, cotes: "deux" },
        ],
        isoles: [
          { position: ctx.at(300, 640), essence: "tilleul", hauteur_m: 21, nom: "Tilleul du Grand Marché" },
          { position: pt(-60, 60), essence: "marronnier", hauteur_m: 17 },
          { position: pt(60, 60), essence: "marronnier", hauteur_m: 17 },
          { position: pt(0, RIVER_Y + 40), essence: "saule", hauteur_m: 15, nom: "Saule du Bac" },
        ],
        parcs,
        vergers: [{ polygone: pts([[-1300, -60], [-965, -60], [-965, -290], [-1300, -290]]), espacement_m: 8 }],
        haies: [{ trace: pts([[-1500, RIVER_Y - 40], [1500, RIVER_Y - 40]]) }],
        potagers: [{ polygone: pts([[965, -60], [1300, -60], [1300, -290], [965, -290]]) }],
        essences_cours: ["tilleul", "marronnier", "fruitier", "erable", "bouleau"],
      };
    },
    eau: () => ({
      voies: [{ id: "riviere", nom: "Rivière", canon: "?", type: "riviere", trace: [pt(-1700, RIVER_Y - 6), pt(0, RIVER_Y), pt(1700, RIVER_Y + 8)], largeur_m: RIVER_W, quais: true }],
      ponts: [{ id: "pont-du-port", position: pt(0, RIVER_Y), angle_deg: 90, longueur_m: RIVER_W + 14, largeur_m: 12, type: "pierre" }, { id: "passerelle-est", position: pt(630, r1(RIVER_Y + 3)), angle_deg: 90, longueur_m: RIVER_W + 12, largeur_m: 5, type: "bois" }],
      puits: pts([[-420, 560], [540, 760], [-780, 300], [200, 1000]]),
      fontaines: pts([[-160, 720], [140, 420]]),
    }),
    points_de_vue(ctx) {
      const gm = ctx.at(255, 680);
      const dr = ctx.at(-170, 765);
      return baseViews(ctx, [
        { id: "grand-marche", nom: "Grand Marché et grande halle", oeil: [r1(gm[0] + 90), r1(gm[1] + 70), 9], cible: [gm[0], gm[1], 6], fov: 60 },
        { id: "marche-aux-draps", nom: "Marché aux Draps", oeil: [r1(dr[0] - 80), r1(dr[1] + 60), 8], cible: [dr[0], dr[1], 6], fov: 60 },
        { id: "port", nom: "Port de la rivière", oeil: [-160, r1(RIVER_Y - 60), 10], cible: [120, -220, 4], fov: 60 },
      ]);
    },
    etats(ctx) {
      return mariaStates(ctx, [pts([[-250, 1000], [250, 1000], [250, 1200], [-250, 1200]])]);
    },
  });
}
