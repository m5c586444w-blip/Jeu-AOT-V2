import type { Gabarit, Place } from "../../../data/placeSchema";
import { pt } from "./kit";
import { BASE_GABARITS, LIBELLE, SOURCES_MARIA, baseViews, mariaStates, pts } from "./maria";
import { buildSaillie, building, cellKey, claimRect, lines, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * District 3 du mur Maria (nom non établi, Q1) — identité d'auteur [A] : district de garnison et d'artillerie. Damier serré et
 * régulier de 80 m (plan de ville militaire), place d'Armes à l'ouest de l'axe, arsenal, fonderie de canons et école
 * d'artillerie à l'est, trois casernes à cour, champ de la poudrière isolé contre le rempart, canons de rempart tous les
 * 20 m (au lieu de 32). Faubourg des charrons et des selliers derrière la porte intérieure.
 */
const S = lines(-1280, 1280, 80, 8, { 4: 12, 8: 12, 12: 12, 20: 12, 24: 12, 28: 12 });
const T = lines(25, 1305, 80, 8, { 3: 12, 6: 12, 9: 12, 12: 12 });

const GABARITS: Record<string, Gabarit> = {
  centre: BASE_GABARITS.centre as Gabarit,
  garnison: { etages: [2, 3, 3], hauteur_etage_m: 3.4, toits: ["croupe", "pignon", "croupe", "mansarde"], pente_deg: [34, 46], couvertures: ["ardoise", "tuile_plate", "ardoise"], facades: ["pierre_taillee", "pierre_brute", "pierre_taillee", "brique"], teintes: ["#D9D3C6", "#CFC8B9", "#D4CCBC", "#C8C0B0"], parcelles_m: [16, 20, 14, 24], profondeur_m: 13, boutiques: false, passage_m: 70, cour: { type: "plantee", arbres_par_ha: 40 } },
  officiers: { etages: [3, 3, 4, 2], hauteur_etage_m: 3.3, toits: ["mansarde", "croupe", "croupe", "pavillon"], pente_deg: [40, 55], couvertures: ["ardoise", "ardoise", "tuile_plate"], facades: ["pierre_taillee", "enduit", "pierre_taillee", "brique"], teintes: ["#EDE6D6", "#E6DCC6", "#F0E9DD", "#DCD3C0", "#E3D8C4"], parcelles_m: [12, 14, 10, 16], profondeur_m: 14, boutiques: false, passage_m: 55, cour: { type: "plantee", arbres_par_ha: 100 } },
  armuriers: { etages: [2, 2, 3, 2], hauteur_etage_m: 3.2, toits: ["pignon", "appentis", "pignon_rue", "croupe"], pente_deg: [36, 48], couvertures: ["tuile_canal", "ardoise", "tuile_plate", "bardeau"], facades: ["brique", "pierre_brute", "bois", "enduit"], teintes: ["#C9B8A0", "#BFAE96", "#D3C3AA", "#B8A68C"], parcelles_m: [9, 12, 8, 14], profondeur_m: 12, boutiques: true, passage_m: 35, cour: { type: "pavee", arbres_par_ha: 35 } },
  ouvrier: BASE_GABARITS.ouvrier as Gabarit,
  faubourg: { ...(BASE_GABARITS.faubourg as Gabarit), cour: { type: "jardin", arbres_par_ha: 60 } },
};

const Q = {
  garnison: quarter("quartier-de-la-garnison", "Quartier de la garnison", "garnison", "caserne", 0.75),
  officiers: quarter("quartier-des-officiers", "Quartier des officiers", "officiers", "habitation", 0.9),
  armuriers: quarter("quartier-des-armuriers", "Quartier des armuriers", "armuriers", "atelier", 0.95),
  civil: quarter("ville-civile", "Ville civile", "centre", "habitation"),
  ouvrier: quarter("quartier-des-soldats-maries", "Quartier des familles de soldats", "ouvrier", "habitation"),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, -400, -80, 505, 745, { kind: "place", id: "place-d-armes", nom: "Place d'Armes", revetement: "terre", fontaine: false, marche: false });
claimRect(claims, S, T, -80, 0, 585, 665, { kind: "place", id: "parvis-de-l-etat-major", nom: "Parvis de l'État-major", revetement: "dalles", fontaine: true, marche: false });
claimRect(claims, S, T, 560, 720, 825, 985, { kind: "place", id: "champ-de-la-poudriere", nom: "Champ de la Poudrière", revetement: "terre", fontaine: false, marche: false });
claimRect(claims, S, T, -160, 0, 185, 265, { kind: "place", id: "place-civile", nom: "Place de la Ville", revetement: "paves", fontaine: true, marche: true });
claimRect(claims, S, T, -720, -560, 345, 505, { kind: "parc", id: "jardin-des-officiers", nom: "Jardin des Officiers", essences: ["marronnier", "tilleul", "erable"], arbres_par_ha: 75 });
claimRect(claims, S, T, 320, 480, 105, 185, { kind: "parc", id: "cimetiere-militaire", nom: "Enclos du souvenir", essences: ["pin", "tilleul", "bouleau"], arbres_par_ha: 60 });
claims[cellKey(S, T, 80, 185)] = { kind: "ilot", fonction: "culte", densite: 0.55, quartier: Q.civil.id, gabarit: "centre" };

export function mariaDistrict3(): Place {
  return buildSaillie({
    id: "maria-district-3",
    nom: "maria-district-3",
    libelle: LIBELLE,
    canon: "?",
    sources: SOURCES_MARIA,
    province: null,
    style: "E01",
    mur: "maria",
    population: { province: null, part: 1, valeur: 36000, canon: "?", note: "Valeur paramétrable (Q8) : aucun district de ce nom dans les données de simulation." },
    densite: { classe: "coeur", valeur: 190, canon: "A" },
    orientation: { valeur: "est", canon: "?" },
    R: 1180,
    grid: { rot: 0, s: S, t: T },
    main: { nom: "Rue de l'Artillerie", largeur_m: 20 },
    names: {
      s: ["Rue des Gabions", "Rue des Affûts", "Rue des Boulets", "Rue des Mèches", "Rue des Écouvillons", "Rue de la Mitraille", "Rue des Canonniers", "Rue des Sapeurs", "Rue des Fourriers", "Rue des Cantinières", "Rue du Train", "Rue des Pionniers", "Rue de la Fonderie", "Rue des Fondeurs", "Rue du Polygone", "Rue des Artificiers", "Rue des Bombardiers", "Rue des Armuriers", "Rue de la Poudrière", "Rue des Salpêtriers", "Rue des Tambours", "Rue des Clairons", "Rue des Sentinelles", "Rue de la Relève", "Rue du Guet", "Rue de la Patrouille", "Rue du Bastion", "Rue de la Courtine", "Rue de l'Escarpe", "Rue de la Contrescarpe"],
      t: ["Rue des Casernes", "Rue de la Garde", "Rue des Recrues", "Rue de l'Intendance", "Rue de l'Exercice", "Rue de la Parade", "Rue des Drapeaux", "Rue de la Revue", "Rue des Manœuvres", "Rue du Magasin", "Rue des Vivres", "Rue des Chevaux", "Rue des Forges", "Rue de la Batterie", "Rue Haute", "Rue du Rempart"],
      lanes: ["Ruelle du Corps de garde", "Ruelle des Bidons"],
      placettes: ["Place du Corps de garde", "Placette des Tambours", "Place de la Relève", "Placette du Guet", "Place de l'Intendance"],
    },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      const r = Math.hypot(c[0], c[1]);
      if (c[0] > 80 && c[1] > 420 && c[1] < 1000 && c[0] < 700) return Q.armuriers.id;
      if (r > 900) return Q.garnison.id;
      if (c[0] < -440 && c[1] > 260 && c[1] < 800) return Q.officiers.id;
      if (r < 330) return Q.civil.id;
      if (c[0] < 0 && c[1] > 760) return Q.garnison.id;
      return Q.ouvrier.id;
    },
    claims,
    placettes: [cellKey(S, T, -880, 665), cellKey(S, T, 640, 345), cellKey(S, T, -480, 985), cellKey(S, T, 160, 905), cellKey(S, T, -1040, 265)],
    faubourg: {
      nom: "Faubourg des Charrons",
      population: { province: null, part: 1, valeur: 4000, canon: "?", note: "Valeur paramétrable (Q8)." },
      densite: { classe: "faubourg", valeur: 80, canon: "A" },
      xs: [-630, -420, -210, 0, 210, 420, 630],
      ys: [-30, -170, -310, -450],
      gabarit: "faubourg",
      quarter: quarter("faubourg-des-charrons", "Faubourg des Charrons", "faubourg", "atelier", 0.6),
      names: ["Chemin des Charrons", "Chemin des Selliers", "Chemin du Manège", "Chemin des Fourrages", "Chemin des Écuries", "Chemin du Polygone", "Chemin du Glacis", "Chemin des Remontes", "Chemin des Bourreliers", "Chemin de la Butte"],
    },
    canons_m: 20,
    batiments(ctx) {
      const c = (s: number, t: number): [number, number] => ctx.cell(S.findIndex(([v]) => v === s), T.findIndex(([v]) => v === t));
      return [
        building({ id: "etat-major", nom: "État-major de la garnison", canon: "A", archetype: "hotel_de_ville", position: c(-80, 505), emprise_m: [34, 18], angle_deg: 0, hauteur_m: 15, etages: 3, toit: "mansarde", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E4DDCE", params: { pente: 55 }, reperes_canon: ["Garnison aux portes (fichiers 01 et 11) : bâtiment adapté"] }),
        building({ id: "caserne-du-rempart", nom: "Caserne du Rempart", canon: "A", archetype: "caserne", position: c(-400, 985), emprise_m: [62, 56], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D6D0C2", params: { cour: true, pente: 36 } }),
        building({ id: "caserne-de-l-artillerie", nom: "Caserne de l'Artillerie", canon: "A", archetype: "caserne", position: c(160, 1065), emprise_m: [62, 56], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D2CBBD", params: { cour: true, pente: 36 } }),
        building({ id: "caserne-neuve", nom: "Caserne Neuve", canon: "A", archetype: "caserne", position: c(-400, 425), emprise_m: [62, 56], angle_deg: 0, hauteur_m: 12, etages: 3, toit: "croupe", couverture: "ardoise", facade: "brique", teinte: "#C9B7A2", params: { cour: true, pente: 38 } }),
        building({ id: "arsenal", nom: "Arsenal", canon: "A", archetype: "arsenal", position: c(160, 505), emprise_m: [62, 40], angle_deg: 0, hauteur_m: 13, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#C8C0B2", params: { pente: 34 } }),
        building({ id: "fonderie-de-canons", nom: "Fonderie de canons", canon: "A", archetype: "usine", position: c(400, 665), emprise_m: [48, 30], angle_deg: 0, hauteur_m: 14, etages: 1, toit: "pignon", couverture: "tuile_plate", facade: "brique", teinte: "#B79C84", params: { pente: 32 } }),
        building({ id: "ecole-d-artillerie", nom: "École d'artillerie", canon: "A", archetype: "ecole", position: c(400, 425), emprise_m: [46, 18], angle_deg: 0, hauteur_m: 12, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E1D9C8", params: { pente: 46 } }),
        building({ id: "poudriere", nom: "Poudrière", canon: "A", archetype: "arsenal", position: pt(640, 880), emprise_m: [22, 14], angle_deg: 0, hauteur_m: 7, etages: 1, toit: "pignon", couverture: "tuile_plate", facade: "pierre_brute", teinte: "#BDB4A4", params: { pente: 40 } }),
        building({ id: "eglise", nom: "Église de la garnison", canon: "A", archetype: "eglise", position: c(80, 185), emprise_m: [20, 42], angle_deg: 0, hauteur_m: 17, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E0D8C8", params: { clocher_m: 44, clocher_cote: 8, abside: true, pente: 50 } }),
        building({ id: "magasin-aux-vivres", nom: "Magasin aux vivres", canon: "A", archetype: "entrepot", position: c(-640, 825), emprise_m: [60, 20], angle_deg: 0, hauteur_m: 10, etages: 2, toit: "croupe", couverture: "tuile_plate", facade: "pierre_brute", teinte: "#CEC4B0", params: { pente: 38 } }),
        building({ id: "poste-porte-exterieure", nom: "Poste de garde de la porte extérieure", canon: "A", archetype: "caserne", position: pt(-62, 1080), emprise_m: [26, 12], angle_deg: 0, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { pente: 40 } }),
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
          { rue: `t-${T.findIndex(([v]) => v === 265)}`, essence: "marronnier", intervalle_m: 13, cotes: "deux" },
          { rue: `t-${T.findIndex(([v]) => v === 745)}`, essence: "tilleul", intervalle_m: 13, cotes: "deux" },
          { rue: `s-${S.findIndex(([v]) => v === -640)}`, essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: `s-${S.findIndex(([v]) => v === 640)}`, essence: "erable", intervalle_m: 14, cotes: "deux" },
        ],
        isoles: [
          { position: pt(-240, 520), essence: "tilleul", hauteur_m: 20, nom: "Tilleul de la place d'Armes" },
          { position: pt(-120, 210), essence: "marronnier", hauteur_m: 18 },
          { position: pt(-60, 60), essence: "marronnier", hauteur_m: 17 },
          { position: pt(60, 60), essence: "marronnier", hauteur_m: 17 },
          { position: pt(600, 960), essence: "chene", hauteur_m: 22 },
        ],
        parcs,
        vergers: [{ polygone: pts([[-900, -60], [-660, -60], [-660, -460], [-900, -460]]), espacement_m: 8 }],
        haies: [{ trace: pts([[-900, -470], [900, -470]]) }],
        potagers: [{ polygone: pts([[660, -60], [900, -60], [900, -460], [660, -460]]) }],
        essences_cours: ["tilleul", "marronnier", "erable", "fruitier"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-560, 300], [520, 280], [-200, 900], [700, 760]]), fontaines: pts([[-40, 625], [-80, 225]]) }),
    points_de_vue(ctx) {
      return baseViews(ctx, [
        { id: "place-d-armes", nom: "Place d'Armes et État-major", oeil: [-380, 760, 10], cible: [-120, 560, 8], fov: 62 },
        { id: "arsenal", nom: "Arsenal et fonderie", oeil: [80, 700, 7], cible: [300, 540, 8], fov: 60 },
        { id: "rempart-canons", nom: "Batterie du rempart", oeil: [...[Math.cos((60 * Math.PI) / 180) * (ctx.R - 1), Math.sin((60 * Math.PI) / 180) * (ctx.R - 1)].map((v) => Math.round(v * 10) / 10), 52.5] as [number, number, number], cible: [...[Math.cos((80 * Math.PI) / 180) * (ctx.R - 1), Math.sin((80 * Math.PI) / 180) * (ctx.R - 1)].map((v) => Math.round(v * 10) / 10), 50] as [number, number, number], fov: 60 },
      ]);
    },
    etats(ctx) {
      return mariaStates(ctx, [pts([[-200, 900], [250, 900], [250, 1120], [-200, 1120]])]);
    },
  });
}
