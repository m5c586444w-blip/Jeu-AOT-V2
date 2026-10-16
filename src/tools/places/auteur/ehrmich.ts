import type { Place } from "../../../data/placeSchema";
import { pt } from "./kit";
import { baseViews, pts } from "./maria";
import { building, buildSaillie, cellKey, claimRect, lines, quarter } from "./saillie";
import type { Claim } from "./saillie";
import { GABARIT_ENTREPOTS, GABARIT_HOTELS, GABARIT_NEGOCE, NOMS_CHEMINS, etat845, faubourgPopulation, gabaritsSina, populationSina, portesSina, sourceSina, vegetationSina } from "./sina";

/**
 * Ehrmich (C16, tranche 1) — district sud du mur Sina, plan d'auteur. Établi [C] : district sud de Wall Sina (atlas 06 I08, rang 3, ressource
 * clé « commerce »). L'atlas fait du « quartier des nobles » un point d'intérêt de Mitras, non d'Ehrmich : le district est donc ici
 * bourgeois ([A], négociants et théâtre), sans quartier noble. Tout le reste est une adaptation [A] : tracé, noms, dimensions, gabarits.
 *
 * Parti d'auteur [A] : ville de négoce et de loisirs — damier de 118 m sur 98 m, Avenue du Midi de la porte extérieure à la porte intérieure,
 * place du Théâtre et théâtre à l'est de l'axe, halles centrales et leur place à l'ouest, hôtels de négociants autour des jardins, bourse,
 * galerie marchande, caserne de la porte sud. Densité modérée (175 hab/ha) : jardins et hôtels. Population : celle de `prov_ehrmich`
 * (34 783 au scénario 845), 92 % intra-muros, 8 % au faubourg.
 */
const R = 1180;
const S = lines(-1180, 1180, 118, 9, { 3: 5, 5: 14, 8: 5, 12: 5, 15: 14, 17: 5 });
const T = lines(25, 1103, 98, 9, { 3: 14, 7: 14, 5: 5, 9: 5 });
const sv = (k: number): number => -1180 + 118 * k;
const tv = (k: number): number => 25 + 98 * k;

const GABARITS = gabaritsSina({ negoce: GABARIT_NEGOCE, hotels: GABARIT_HOTELS, entrepots: GABARIT_ENTREPOTS });
const Q = {
  centre: quarter("vieil-ehrmich", "Vieil Ehrmich", "centre", "habitation"),
  hotels: quarter("quartier-des-negociants", "Quartier des Négociants", "hotels", "noble", 0.7),
  negoce: quarter("quartier-des-halles", "Quartier des Halles", "negoce", "marche", 0.95),
  entrepots: quarter("quartier-des-magasins", "Quartier des Magasins", "entrepots", "entrepot", 0.85),
  garnison: quarter("quartier-de-la-porte-sud", "Quartier de la Porte Sud", "garnison", "caserne", 0.7),
  ouvrier: quarter("quartier-des-commis", "Quartier des Commis et des Colporteurs", "ouvrier", "habitation", 0.95),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(6), sv(9), tv(6), tv(8), { kind: "place", id: "place-des-halles", nom: "Place des Halles centrales", revetement: "paves", fontaine: true, marche: true });
claimRect(claims, S, T, sv(11), sv(13), tv(4), tv(6), { kind: "place", id: "place-du-theatre", nom: "Place du Théâtre", revetement: "dalles", fontaine: true, marche: false });
claimRect(claims, S, T, sv(11), sv(12), tv(1), tv(2), { kind: "place", id: "parvis-de-l-eglise", nom: "Parvis de l'église", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, sv(14), sv(16), tv(4), tv(5), { kind: "parc", id: "jardin-du-theatre", nom: "Jardin du Théâtre", essences: ["tilleul", "marronnier", "fruitier"], arbres_par_ha: 75 });
claimRect(claims, S, T, sv(2), sv(4), tv(2), tv(4), { kind: "parc", id: "parc-des-negociants", nom: "Parc des Négociants", essences: ["tilleul", "erable", "marronnier"], arbres_par_ha: 68 });
claimRect(claims, S, T, sv(16), sv(18), tv(7), tv(8), { kind: "parc", id: "promenade-du-midi", nom: "Promenade du Midi", essences: ["peuplier", "tilleul", "erable"], arbres_par_ha: 62 });
claimRect(claims, S, T, sv(7), sv(9), tv(9), tv(10), { kind: "parc", id: "jardin-de-la-porte-sud", nom: "Jardin de la Porte Sud", essences: ["pin", "tilleul", "bouleau"], arbres_par_ha: 55 });
claims[cellKey(S, T, sv(12), tv(1))] = { kind: "ilot", fonction: "culte", densite: 0.55, quartier: Q.centre.id, gabarit: "centre" };

const NOMS_S = [
  "Rue des Négociants", "Rue des Armateurs", "Rue des Assureurs", "Rue des Banquiers", "Rue des Orfèvres", "Rue des Joailliers", "Rue des Modistes", "Rue des Couturiers", "Rue des Parfumeurs", "Rue des Libraires",
  "Rue des Musiciens", "Rue des Comédiens", "Rue des Peintres", "Rue des Facteurs d'Orgues", "Rue des Fleuristes", "Rue des Confiseurs", "Rue des Pâtissiers", "Rue des Traiteurs", "Rue des Cochers", "Rue des Maîtres d'Hôtel",
  "Rue des Couteliers", "Rue des Horlogers",
];
const NOMS_T = ["Rue du Midi", "Rue du Théâtre", "Rue de la Bourse", "Rue des Galeries", "Rue des Jardins", "Rue des Halles", "Rue des Magasins", "Rue des Remises", "Rue des Cochers de Place", "Rue de la Porte", "Rue du Sud", "Rue du Mur"];

export function ehrmich(): Place {
  return buildSaillie({
    id: "ehrmich",
    nom: "Ehrmich",
    libelle: "Ehrmich",
    canon: "C",
    sources: sourceSina("I08 (Ehrmich : district sud de Sina, rang 3 ; le « quartier des nobles » devient un POI de Mitras)", "Ehrmich (sud)", "tracé de la saillie, noms de rues, de places et de bâtiments, dimensions, quartiers"),
    province: "prov_ehrmich",
    style: "E07",
    mur: "sina",
    population: populationSina("prov_ehrmich", 34783, 0.92),
    densite: { classe: "coeur", valeur: 175, canon: "A" },
    orientation: { valeur: "sud", canon: "C" },
    R,
    grid: { rot: 0, s: S, t: T },
    main: { nom: "Avenue du Midi", largeur_m: 20 },
    names: {
      s: NOMS_S,
      t: NOMS_T,
      lanes: ["Ruelle des Fiacres", "Ruelle des Lanternes", "Ruelle des Partitions", "Ruelle du Gantier"],
      placettes: ["Place des Fleuristes", "Placette des Musiciens", "Place des Cochers", "Placette des Peintres"],
    },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      const r = Math.hypot(c[0], c[1]);
      if (c[1] > 920 && Math.abs(c[0]) < 520) return Q.garnison.id;
      if (c[0] < 0 && c[0] > -600 && c[1] > 500 && c[1] < 900) return Q.negoce.id;
      if (c[0] < -600 && c[1] > 500 && c[1] < 900) return Q.entrepots.id;
      if (c[0] > 150 && c[1] > 250 && c[1] < 850) return Q.hotels.id;
      if (c[0] < 0 && c[0] > -600 && c[1] > 100 && c[1] < 400) return Q.hotels.id;
      if (r < 520) return Q.centre.id;
      if (Math.abs(c[0]) > 800) return Q.ouvrier.id;
      return Q.centre.id;
    },
    claims,
    placettes: [cellKey(S, T, sv(1), tv(4)), cellKey(S, T, sv(18), tv(3)), cellKey(S, T, sv(3), tv(8)), cellKey(S, T, sv(17), tv(9))],
    faubourg: {
      nom: "Faubourg de la porte intérieure",
      population: faubourgPopulation("prov_ehrmich", 34783, 0.08),
      densite: { classe: "faubourg", valeur: 62, canon: "A" },
      xs: [-450, -300, -150, 0, 150, 300, 450],
      ys: [-30, -155, -280, -405, -530],
      gabarit: "faubourg",
      quarter: quarter("faubourg-de-la-porte-interieure", "Faubourg de la porte intérieure", "faubourg", "habitation", 0.55),
      names: NOMS_CHEMINS,
    },
    canons_m: 30,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      const hx = (sv(6) + sv(9)) / 2;
      return [
        building({ id: "halles-centrales", nom: "Halles centrales", canon: "A", archetype: "halle", position: pt(hx, tv(7)), emprise_m: [62, 28], angle_deg: 0, hauteur_m: 14, etages: 1, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#CDBE9E", params: { piliers: 12, pente: 40 }, reperes_canon: ["Ehrmich, ressource clé : commerce [C] (atlas 06 I08) : les halles sont une adaptation"] }),
        ...[[-110, -36], [0, -36], [110, -36], [-110, 38], [0, 38], [110, 38]].map(([dx, dy], k) =>
          building({ id: `etal-${k + 1}`, nom: `Étal des halles ${k + 1}`, canon: "A", archetype: "halle", position: pt(hx + (dx as number), tv(7) + (dy as number)), emprise_m: [14, 7], angle_deg: 0, hauteur_m: 5, etages: 1, toit: "appentis", couverture: "tuile_canal", facade: "bois", teinte: "#C2A57E", params: { piliers: 4, pente: 30 } }),
        ),
        building({ id: "theatre-d-ehrmich", nom: "Théâtre d'Ehrmich", canon: "A", archetype: "palais", position: c(13, 5), emprise_m: [58, 42], angle_deg: 0, hauteur_m: 20, etages: 4, toit: "croupe", couverture: "cuivre", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 38 } }),
        building({ id: "bourse-d-ehrmich", nom: "Bourse d'Ehrmich", canon: "A", archetype: "hotel_de_ville", position: c(14, 3), emprise_m: [38, 20], angle_deg: 0, hauteur_m: 15, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 48 } }),
        building({ id: "hotel-de-ville", nom: "Hôtel de ville d'Ehrmich", canon: "A", archetype: "hotel_de_ville", position: c(8, 1), emprise_m: [34, 18], angle_deg: 0, hauteur_m: 14, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 48 } }),
        building({ id: "eglise", nom: "Église d'Ehrmich", canon: "A", archetype: "eglise", position: c(12, 1), emprise_m: [22, 44], angle_deg: 0, hauteur_m: 18, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E2DACB", params: { clocher_m: 48, clocher_cote: 8.5, abside: true, pente: 50 } }),
        building({ id: "galerie-des-negociants", nom: "Galerie des Négociants", canon: "A", archetype: "halle", position: c(12, 7), emprise_m: [60, 24], angle_deg: 0, hauteur_m: 12, etages: 2, toit: "croupe", couverture: "cuivre", facade: "pierre_taillee", teinte: "#DCD3C0", params: { piliers: 10, pente: 36 } }),
        building({ id: "magasins-des-negociants", nom: "Magasins des négociants", canon: "A", archetype: "entrepot", position: c(4, 7), emprise_m: [60, 26], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "tuile_plate", facade: "brique", teinte: "#C8B8A0", params: { pente: 40 } }),
        building({ id: "clinique-d-ehrmich", nom: "Clinique d'Ehrmich", canon: "A", archetype: "clinique", position: c(3, 5), emprise_m: [40, 24], angle_deg: 0, hauteur_m: 12, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E1DACB", params: { pente: 44 } }),
        building({ id: "ecole-des-commis", nom: "École des commis", canon: "A", archetype: "ecole", position: c(16, 2), emprise_m: [44, 24], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "brique", teinte: "#D9CDB6", params: { pente: 42 } }),
        building({ id: "caserne-de-la-porte-sud", nom: "Caserne de la porte sud", canon: "A", archetype: "caserne", position: c(9, 9), emprise_m: [60, 50], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D6D0C2", params: { cour: true, pente: 36 }, reperes_canon: ["Garnison aux portes (fichiers 01 et 11) : bâtiment adapté"] }),
        building({ id: "poste-porte-sud", nom: "Poste de garde de la porte sud", canon: "A", archetype: "caserne", position: c(9, 10), emprise_m: [26, 12], angle_deg: 0, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { pente: 40 } }),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return vegetationSina(parcs, {
        xs: [-450, -300, -150, 0, 150, 300, 450],
        ys: [-30, -155, -280, -405, -530],
        alignements: [
          { rue: "s-5", essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: "s-15", essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: "t-3", essence: "marronnier", intervalle_m: 12, cotes: "deux" },
          { rue: "t-7", essence: "tilleul", intervalle_m: 14, cotes: "deux" },
        ],
        isoles: [
          { position: pt(150, tv(5) + 40), essence: "tilleul", hauteur_m: 23, nom: "Tilleul du Théâtre" },
          { position: pt(-170, 1040), essence: "chene", hauteur_m: 24, nom: "Chêne de la porte sud" },
        ],
      });
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-800, 300], [800, 300], [-420, 880], [420, 880], [-950, 700]]), fontaines: pts([[hxFountain(), tv(7)], [(sv(11) + sv(13)) / 2, (tv(4) + tv(6)) / 2]]) }),
    points_de_vue(ctx) {
      return baseViews(ctx, [
        { id: "place-du-theatre", nom: "Place du Théâtre", oeil: [sv(13) - 30, tv(4) + 20, 2.6], cible: [sv(13) + 40, tv(5) + 10, 10], fov: 62 },
        { id: "halles-centrales", nom: "Place et halles centrales", oeil: [sv(9) - 20, tv(6) + 20, 2.4], cible: [hxFountain(), tv(7) + 30, 7], fov: 60 },
        { id: "quartier-des-negociants", nom: "Rue des Négociants", oeil: [sv(5), tv(5), 1.7], cible: [sv(5), tv(9), 6], fov: 62 },
        { id: "porte-sud", nom: "Caserne et poste de la porte sud", oeil: [190, 1000, 3.5], cible: [-60, 1120, 10], fov: 62 },
      ]);
    },
    etats(ctx) {
      void ctx;
      return [
        etat845("845, Ehrmich en temps ordinaire"),
        {
          id: "850-afflux-des-evacues",
          nom: "850, afflux des évacués du sud",
          date: "850",
          canon: "A",
          sources: [
            { ref: "docs/spec/01 (850 : Trost, 104e promotion) : l'évacuation du sud vers l'intérieur [C] ; accueil des évacués à Ehrmich : adaptation", canon: "A" },
            { ref: "affluence, brume : adaptation (aucune destruction : le district n'est pas touché)", canon: "A" },
          ],
          portes: {},
          ruines: [],
          incendies: [],
          rochers: [],
          abandon: 0,
          ciel: "brumeux",
          habitants: 1,
        },
      ];
    },
    portes: (_ctx, gate) => portesSina(R, "Porte d'Ehrmich (porte sud)", "Porte intérieure d'Ehrmich", gate),
  });
}
const hxFountain = (): number => (-1180 + 118 * 6 + (-1180 + 118 * 9)) / 2;
