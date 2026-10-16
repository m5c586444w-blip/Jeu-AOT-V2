import type { Place } from "../../../data/placeSchema";
import { pt } from "./kit";
import { baseViews, pts } from "./maria";
import { building, buildSaillie, cellKey, claimRect, lines, quarter } from "./saillie";
import type { Claim } from "./saillie";
import { GABARIT_ENTREPOTS, GABARIT_HOTELS, GABARIT_NEGOCE, NOMS_CHEMINS, etat845, faubourgPopulation, gabaritsSina, populationSina, portesSina, sourceSina, vegetationSina } from "./sina";

/**
 * Stohess (C16, tranche 1) — district est du mur Sina, plan d'auteur. Établi [C] : district est de Wall Sina, siège de la Brigade militaire
 * (Police militaire), « rues et canaux » (atlas 06 I03 et T09), prison souterraine de la Brigade (existence C, localisation ? : atlas T10),
 * combat de 850 contre la femelle Titan (01). Tout le reste est une adaptation [A] : tracé, noms, dimensions, quartiers, gabarits.
 *
 * Parti d'auteur [A] : ville administrative et marchande coupée par un grand canal d'est en ouest (quai bordé de ponts), damier de 100 m
 * sur 96 m, Avenue de la Brigade de la porte extérieure à la porte intérieure, place d'armes de la Brigade et hôtel de la Brigade au
 * nord-ouest de l'axe, place du Commerce et halle au sud-est (côté intérieur), entrepôts le long des quais, hôtels particuliers
 * autour du parc du Canal. Population : celle de `prov_stohess` (60 870 au scénario 845), 90 % intra-muros, 10 % au faubourg.
 */
const R = 1300;
const S = lines(-1300, 1300, 100, 9, { 2: 5, 4: 14, 7: 5, 9: 14, 17: 14, 19: 5, 22: 14, 24: 5 });
const T = lines(25, 1273, 96, 9, { 3: 20, 7: 14, 10: 14, 5: 5 });
const sv = (k: number): number => -1300 + 100 * k;
const tv = (k: number): number => 25 + 96 * k;
const si = (k: number): string => `s-${k}`;

const GABARITS = gabaritsSina({ negoce: GABARIT_NEGOCE, hotels: GABARIT_HOTELS, entrepots: GABARIT_ENTREPOTS });
const Q = {
  centre: quarter("vieux-stohess", "Vieux Stohess", "centre", "habitation"),
  brigade: quarter("quartier-de-la-brigade", "Quartier de la Brigade", "garnison", "caserne", 0.75),
  negoce: quarter("quartier-du-commerce", "Quartier du Commerce", "negoce", "marche", 0.95),
  quais: quarter("quartier-des-quais", "Quartier des Quais et des Entrepôts", "entrepots", "entrepot", 0.85),
  hotels: quarter("quartier-des-hotels", "Quartier des Hôtels", "hotels", "noble", 0.7),
  ouvrier: quarter("quartier-des-eclusiers", "Quartier des Éclusiers et des Haleurs", "ouvrier", "habitation", 0.95),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(14), sv(17), tv(5), tv(7), { kind: "place", id: "place-du-commerce", nom: "Place du Commerce", revetement: "paves", fontaine: true, marche: true });
claimRect(claims, S, T, sv(9), sv(12), tv(8), tv(10), { kind: "place", id: "place-de-la-brigade", nom: "Place d'armes de la Brigade", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, sv(14), sv(15), tv(2), tv(3), { kind: "place", id: "parvis-de-l-eglise", nom: "Parvis de l'église", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, sv(9), sv(12), tv(3), tv(4), { kind: "parc", id: "parc-du-canal", nom: "Parc du Canal", essences: ["tilleul", "marronnier", "saule"], arbres_par_ha: 70 });
claimRect(claims, S, T, sv(18), sv(20), tv(8), tv(9), { kind: "parc", id: "jardin-des-eclusiers", nom: "Jardin des Éclusiers", essences: ["saule", "peuplier", "tilleul"], arbres_par_ha: 58 });
claimRect(claims, S, T, sv(3), sv(5), tv(5), tv(6), { kind: "parc", id: "promenade-des-haleurs", nom: "Promenade des Haleurs", essences: ["peuplier", "tilleul", "erable"], arbres_par_ha: 62 });
claimRect(claims, S, T, sv(6), sv(8), tv(10), tv(11), { kind: "parc", id: "jardin-de-la-porte-est", nom: "Jardin de la Porte Est", essences: ["pin", "tilleul", "bouleau"], arbres_par_ha: 55 });
claims[cellKey(S, T, sv(15), tv(2))] = { kind: "ilot", fonction: "culte", densite: 0.55, quartier: Q.centre.id, gabarit: "centre" };

const NOMS_S = [
  "Rue des Haleurs", "Rue des Éclusiers", "Rue des Bateliers", "Rue des Calfats", "Rue des Cordiers", "Rue des Sergents", "Rue des Archivistes", "Rue des Huissiers", "Rue des Greffiers", "Rue des Procureurs",
  "Rue des Notaires", "Rue des Banquiers", "Rue des Drapiers", "Rue des Merciers", "Rue des Gantiers", "Rue des Horlogers", "Rue des Relieurs", "Rue des Papetiers", "Rue des Imprimeurs", "Rue des Chapeliers",
  "Rue des Passementiers", "Rue des Parfumeurs", "Rue des Confiseurs", "Rue des Lampistes",
];
const NOMS_T = ["Rue de la Brigade", "Rue des Gardes", "Rue du Commerce", "Rue des Comptoirs", "Rue des Assureurs", "Rue des Armateurs", "Rue des Courtiers", "Rue des Négociants", "Rue des Écluses", "Rue des Péniches", "Rue des Quais", "Rue du Mur"];

export function stohess(): Place {
  const base = buildSaillie({
    id: "stohess",
    nom: "Stohess",
    libelle: "Stohess",
    canon: "C",
    sources: [
      ...sourceSina("I03 (Stohess : district est de Sina, Brigade militaire, rang 4), T09 (rues et canaux), T10 (prison souterraine : localisation ?)", "Stohess (est)", "tracé de la saillie, noms de rues, de places, de bâtiments et du canal, dimensions, quartiers"),
      { ref: "docs/spec/01 (850 : femelle Titan, Stohess) : le combat de 850 a lieu à Stohess [C] ; étendue des ruines : adaptation", canon: "C" },
    ],
    province: "prov_stohess",
    style: "E05",
    mur: "sina",
    population: populationSina("prov_stohess", 60870, 0.9),
    densite: { classe: "coeur", valeur: 230, canon: "A" },
    orientation: { valeur: "est", canon: "C" },
    R,
    grid: { rot: 0, s: S, t: T },
    main: { nom: "Avenue de la Brigade", largeur_m: 20 },
    names: {
      s: NOMS_S,
      t: NOMS_T,
      lanes: ["Ruelle des Écluses", "Ruelle du Halage", "Ruelle des Lanternes", "Ruelle des Cordes"],
      placettes: ["Place des Bateliers", "Placette des Cordiers", "Place des Éclusiers", "Placette du Gué", "Place des Horlogers"],
    },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      const r = Math.hypot(c[0], c[1]);
      if (c[0] < 0 && c[0] > -500 && c[1] > 650 && c[1] < 1150) return Q.brigade.id;
      if (c[1] > 1100 && Math.abs(c[0]) < 400) return Q.brigade.id;
      if (c[0] > 0 && c[0] < 700 && c[1] > 400 && c[1] < 900) return Q.negoce.id;
      if (c[1] > 300 && c[1] < 420 && Math.abs(c[0]) < 1000) return Q.quais.id;
      if (c[0] < -500 && c[1] > 150 && c[1] < 700) return Q.quais.id;
      if (c[0] > 200 && c[1] < 400) return Q.hotels.id;
      if (r < 520) return Q.centre.id;
      if (Math.abs(c[0]) > 750) return Q.ouvrier.id;
      return Q.centre.id;
    },
    claims,
    placettes: [cellKey(S, T, sv(1), tv(3)), cellKey(S, T, sv(24), tv(4)), cellKey(S, T, sv(5), tv(8)), cellKey(S, T, sv(21), tv(9))],
    faubourg: {
      nom: "Faubourg de la porte intérieure",
      population: faubourgPopulation("prov_stohess", 60870, 0.1),
      densite: { classe: "faubourg", valeur: 70, canon: "A" },
      xs: [-750, -540, -330, -120, 0, 120, 330, 540, 750],
      ys: [-30, -170, -310, -450, -590],
      gabarit: "faubourg",
      quarter: quarter("faubourg-de-la-porte-interieure", "Faubourg de la porte intérieure", "faubourg", "habitation", 0.55),
      names: NOMS_CHEMINS,
    },
    canons_m: 30,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      return [
        building({ id: "hotel-de-la-brigade", nom: "Hôtel de la Brigade militaire", canon: "A", archetype: "caserne", position: c(10, 7), emprise_m: [70, 52], angle_deg: 0, hauteur_m: 14, etages: 3, toit: "mansarde", couverture: "ardoise", facade: "pierre_taillee", teinte: "#DDD6C6", params: { cour: true, pente: 44 }, reperes_canon: ["Stohess : Brigade militaire (Police militaire) [C] (atlas 06 I03) ; plan de l'hôtel : adaptation"] }),
        building({ id: "prison-de-la-brigade", nom: "Prison de la Brigade (accès de surface)", canon: "?", archetype: "caserne", position: c(12, 7), emprise_m: [46, 36], angle_deg: 0, hauteur_m: 10, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#BDB6A8", params: { cour: true, pente: 38 }, reperes_canon: ["prison souterraine de la Brigade [C], localisation exacte [?] (atlas 06 T10) : seul le bâtiment d'accès de surface est posé, adaptation"] }),
        building({ id: "caserne-de-la-porte-est", nom: "Caserne de la porte est", canon: "A", archetype: "caserne", position: c(12, 11), emprise_m: [60, 50], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D6D0C2", params: { cour: true, pente: 36 }, reperes_canon: ["Garnison aux portes (fichiers 01 et 11) : bâtiment adapté"] }),
        building({ id: "halle-du-commerce", nom: "Halle du commerce", canon: "A", archetype: "halle", position: pt(sv(15) + 50, tv(6)), emprise_m: [56, 26], angle_deg: 0, hauteur_m: 13, etages: 1, toit: "croupe", couverture: "tuile_plate", facade: "bois", teinte: "#C8B088", params: { piliers: 10, pente: 40 }, reperes_canon: ["Stohess, ressource clé : commerce [C] (atlas 06 I03) : la halle est une adaptation"] }),
        ...[[-100, 0], [30, 0], [-100, 36], [30, 36], [130, 0], [130, 36]].map(([dx, dz], k) =>
          building({ id: `etal-${k + 1}`, nom: `Étal du commerce ${k + 1}`, canon: "A", archetype: "halle", position: pt(sv(15) + 50 + (dx as number), tv(6) + (dz as number) + 40), emprise_m: [14, 7], angle_deg: 0, hauteur_m: 5, etages: 1, toit: "appentis", couverture: "tuile_canal", facade: "bois", teinte: "#C2A57E", params: { piliers: 4, pente: 30 } }),
        ),
        building({ id: "bourse-du-commerce", nom: "Bourse du commerce", canon: "A", archetype: "hotel_de_ville", position: c(18, 6), emprise_m: [36, 20], angle_deg: 0, hauteur_m: 15, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 48 } }),
        building({ id: "hotel-de-ville", nom: "Hôtel de ville de Stohess", canon: "A", archetype: "hotel_de_ville", position: c(12, 2), emprise_m: [32, 18], angle_deg: 0, hauteur_m: 14, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E6DFD0", params: { pente: 48 } }),
        building({ id: "eglise", nom: "Église de Stohess", canon: "A", archetype: "eglise", position: c(15, 2), emprise_m: [22, 44], angle_deg: 0, hauteur_m: 18, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E2DACB", params: { clocher_m: 48, clocher_cote: 8.5, abside: true, pente: 50 } }),
        building({ id: "entrepot-des-quais", nom: "Grand entrepôt des quais", canon: "A", archetype: "entrepot", position: c(7, 3), emprise_m: [58, 24], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "brique", teinte: "#C8B8A0", params: { pente: 40 } }),
        building({ id: "magasin-des-bateliers", nom: "Magasin des bateliers", canon: "A", archetype: "entrepot", position: c(5, 3), emprise_m: [50, 22], angle_deg: 0, hauteur_m: 10, etages: 2, toit: "pignon", couverture: "tuile_plate", facade: "pierre_brute", teinte: "#CBBFA5", params: { pente: 38 } }),
        building({ id: "grue-du-canal", nom: "Grue du canal", canon: "A", archetype: "quai_grue", position: pt(-420, tv(3) - 12), emprise_m: [10, 10], angle_deg: 0, hauteur_m: 14, etages: 1, toit: "pavillon", couverture: "bardeau", facade: "bois", teinte: "#B79F7A" }),
        building({ id: "clinique-de-stohess", nom: "Clinique de Stohess", canon: "A", archetype: "clinique", position: c(21, 3), emprise_m: [40, 24], angle_deg: 0, hauteur_m: 12, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E1DACB", params: { pente: 44 } }),
        building({ id: "poste-porte-est", nom: "Poste de garde de la porte est", canon: "A", archetype: "caserne", position: c(12, 12), emprise_m: [26, 12], angle_deg: 0, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { pente: 40 } }),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return vegetationSina(parcs, {
        xs: [-750, -540, -330, -120, 0, 120, 330, 540, 750],
        ys: [-30, -170, -310, -450, -590],
        alignements: [
          { rue: si(4), essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: si(22), essence: "erable", intervalle_m: 14, cotes: "deux" },
          { rue: "t-3", essence: "tilleul", intervalle_m: 12, cotes: "deux" },
          { rue: "t-7", essence: "marronnier", intervalle_m: 14, cotes: "deux" },
        ],
        isoles: [
          { position: pt(-170, tv(9) + 20), essence: "tilleul", hauteur_m: 23, nom: "Tilleul de la place d'armes" },
          { position: pt(520, tv(2) + 40), essence: "chene", hauteur_m: 24, nom: "Chêne du parvis" },
        ],
      });
    },
    eau: () => ({
      voies: [{ id: "grand-canal", nom: "Grand Canal de Stohess", canon: "A", type: "canal", trace: pts([[-1150, tv(3)], [-600, tv(3)], [0, tv(3)], [600, tv(3)], [1150, tv(3)]]), largeur_m: 10, quais: true }],
      ponts: [sv(4), sv(9), sv(14), sv(17), sv(22)].map((x, k) => ({ id: `pont-${k + 1}`, position: pt(x, tv(3)), angle_deg: 90, longueur_m: 16, largeur_m: 10, type: k % 2 ? ("bois" as const) : ("pierre" as const) })),
      puits: pts([[-700, 300], [700, 250], [-300, 650], [350, 1000], [-900, 800]]),
      fontaines: pts([[sv(15) + 50, tv(6) - 20], [-250, 900]]),
    }),
    points_de_vue(ctx) {
      return baseViews(ctx, [
        { id: "place-du-commerce", nom: "Place du Commerce et halle", oeil: [sv(17) + 40, tv(5) + 20, 2.4], cible: [sv(15) + 50, tv(6) + 40, 7], fov: 62 },
        { id: "grand-canal", nom: "Quai du Grand Canal", oeil: [-300, tv(3) + 30, 4], cible: [300, tv(3), 3], fov: 62 },
        { id: "place-de-la-brigade", nom: "Place d'armes et hôtel de la Brigade", oeil: [-480, tv(10) + 40, 3], cible: [-420, tv(7) + 40, 10], fov: 60 },
        { id: "porte-est", nom: "Caserne et poste de la porte est", oeil: [190, 1130, 3.5], cible: [-60, 1260, 10], fov: 62 },
      ]);
    },
    etats(ctx) {
      void ctx;
      return [
        etat845("845, Stohess en temps ordinaire"),
        {
          id: "850-combat-de-stohess",
          nom: "850, combat dans les rues de Stohess",
          date: "850",
          canon: "A",
          sources: [
            { ref: "docs/spec/01 (850 : femelle Titan ; Stohess) et docs/spec/20 : combat dans les rues de Stohess [C]", canon: "C" },
            { ref: "étendue des ruines, incendies, débris : adaptation (le mur et les portes ne sont pas touchés)", canon: "A" },
          ],
          portes: {},
          ruines: [{ polygone: pts([[-700, 450], [500, 450], [500, 1000], [-700, 1000]]), part: 0.28 }],
          incendies: pts([[-300, 620], [-120, 760], [-420, 840], [60, 900], [-250, 980]]),
          rochers: [{ position: pt(-200, 700), rayon_m: 3.5, canon: "A" }, { position: pt(-330, 840), rayon_m: 2.6, canon: "A" }],
          abandon: 0.15,
          ciel: "enfume",
          habitants: 0.4,
        },
      ];
    },
    portes: (_ctx, gate) => portesSina(R, "Porte de Stohess (porte est)", "Porte intérieure de Stohess", gate),
  });
  // Le canal borde la rue du damier à y = tv(3) : voie de quai nommée ; création [A].
  base.rues = base.rues.map((r) => (r.id.startsWith("t-3") ? { ...r, nom: "Quai du Grand Canal", type: "quai" as const } : r));
  return base;
}
