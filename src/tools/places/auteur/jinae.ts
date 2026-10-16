import type { Gabarit, Place } from "../../../data/placeSchema";
import { buildEnclos } from "./enclos";
import { bat, etat, GAB_VILLE_RURALE } from "./horsmurs";
import { pt } from "./kit";
import { BASE_GABARITS, pts } from "./maria";
import { claimRect, lines, quarter } from "./saillie";
import type { Claim } from "./saillie";
import { GABARIT_ENTREPOTS } from "./sina";

/**
 * Jinae (C17, tranche 1) — ville du sud de l'intérieur de Rose, plan d'auteur de niveau N1. Établi [C] : Jinae est une ville du sud
 * de l'intérieur de Rose, de ressource clé « nourriture » (fichiers 01 §3.1 et 11 §2, atlas 06 S13, `prov_jinae` de
 * `data/provinces/paradis.json`, niveau de peuplement 2). Tout le reste est une adaptation [A] : tracé, noms, quartiers, bâtiments,
 * états. La ville n'a pas d'enceinte propre dans le schéma (le mur Rose est loin au sud ; lieu sans mur comme Mitras).
 *
 * Parti d'auteur [A] : une ville marchande de 1 400 m × 1 200 m, damier de 100 m, avenue des Moissons (nord-sud) et rue du Marché
 * (est-ouest) ; place du Marché et sa halle à l'est de l'avenue, hôtel de ville et beffroi au centre, église sur sa place à l'ouest,
 * poste de la Garnison au nord, quartier des Grains (greniers, entrepôts) au sud, quartier des Moulins et des tanneries à l'est,
 * faubourg des jardins à l'ouest et au nord. Population : celle de `prov_jinae` (17 391 au scénario 845), densité 110 hab/ha
 * (classe faubourg : ville de marché, maisons à cour plantée).
 */
const S = lines(-700, 700, 100, 8, { 7: 16, 3: 11, 11: 11, 1: 5, 5: 5, 9: 5, 13: 5 });
const T = lines(-600, 600, 100, 8, { 6: 14, 2: 10, 10: 10, 1: 5, 4: 5, 8: 5, 11: 5 });
const sv = (k: number): number => -700 + 100 * k;
const tv = (k: number): number => -600 + 100 * k;

const GABARITS: Record<string, Gabarit> = {
  centre: { ...(BASE_GABARITS.centre as Gabarit), cour: { type: "plantee", arbres_par_ha: 95 } },
  ouvrier: BASE_GABARITS.ouvrier as Gabarit,
  faubourg: { ...(BASE_GABARITS.faubourg as Gabarit), cour: { type: "jardin", arbres_par_ha: 80 } },
  negoce: { ...GAB_VILLE_RURALE },
  entrepots: { ...GABARIT_ENTREPOTS, cour: { type: "plantee", arbres_par_ha: 70 } },
};

const Q = {
  vieille: quarter("vieille-ville", "Vieille ville", "centre", "habitation"),
  grains: quarter("quartier-des-grains", "Quartier des Grains", "entrepots", "entrepot", 0.85),
  moulins: quarter("quartier-des-moulins", "Quartier des Moulins et des Tanneries", "ouvrier", "atelier", 0.9),
  jardins: quarter("faubourg-des-jardins", "Faubourg des Jardins", "faubourg", "habitation", 0.8),
  marche: quarter("quartier-du-marche", "Quartier du Marché", "negoce", "marche", 0.95),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(7), sv(9), tv(5), tv(7), { kind: "place", id: "place-du-marche", nom: "Place du Marché", revetement: "paves", fontaine: false, marche: true });
claimRect(claims, S, T, sv(4), sv(5), tv(4), tv(5), { kind: "place", id: "place-de-l-eglise", nom: "Place de l'Église", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, sv(10), sv(12), tv(1), tv(3), { kind: "parc", id: "mail-des-tilleuls", nom: "Mail des Tilleuls", essences: ["tilleul", "marronnier", "erable"], arbres_par_ha: 60 });
claimRect(claims, S, T, sv(5), sv(6), tv(2), tv(3), { kind: "parc", id: "jardin-de-l-hotel-de-ville", nom: "Jardin de l'Hôtel de ville", essences: ["tilleul", "fruitier", "marronnier"], arbres_par_ha: 62 });
claimRect(claims, S, T, sv(0), sv(2), tv(8), tv(10), { kind: "parc", id: "prairie-des-lavoirs", nom: "Prairie des Lavoirs", essences: ["saule", "peuplier", "fruitier"], arbres_par_ha: 52 });

const NOMS_S = ["Rue des Meuniers", "Rue des Boulangers", "Rue des Grainetiers", "Rue des Laboureurs", "Avenue des Moissons", "Rue des Fermiers", "Rue des Vanniers", "Rue des Charrons", "Rue des Tonneliers", "Rue des Bourreliers", "Rue des Sabotiers"];
const NOMS_T = ["Rue du Marché", "Rue des Messagers", "Rue de l'Hôtel de ville", "Rue des Halles", "Rue des Greniers", "Rue des Remises", "Rue des Cultures", "Rue du Pressoir", "Rue des Foins"];
const LANES = ["Ruelle du Pain", "Ruelle des Gerbes", "Ruelle du Grain", "Ruelle des Vignes", "Ruelle du Four", "Ruelle de la Paille", "Ruelle des Mesures"];

export function jinae(): Place {
  return buildEnclos({
    id: "jinae",
    nom: "Jinae",
    libelle: "Jinae (ville du sud de l'intérieur de Rose)",
    canon: "C",
    sources: [
      { ref: "docs/spec/01 §3.1 et docs/spec/11 §2 : Jinae, ville du sud de l'intérieur de Rose [C] ; docs/spec/06 S13 (ressource clé : nourriture) ; data/provinces/paradis.json : prov_jinae [C]", canon: "C" },
      { ref: "ville sans enceinte propre (le schéma ne modélise que les murs Maria, Rose et Sina) : adaptation", canon: "A" },
      { ref: "tracé, noms de rues, de places, de quartiers et de bâtiments, états : adaptation (création C17, `docs/lore/creations.md`)", canon: "A" },
    ],
    province: "prov_jinae",
    style: "E10",
    population: { province: "prov_jinae", part: 1, canon: "C", note: "100 % de la population de `prov_jinae` au départ de scn_sandbox_845 (17 391 hab.) ; la province existe [C], la ville la porte entière (adaptation)." },
    densite: { classe: "faubourg", valeur: 110, canon: "A" },
    orientation: { valeur: "sud", canon: "C" },
    s: S,
    t: T,
    names: { s: NOMS_S, t: NOMS_T, lanes: LANES },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      if (c[1] > 250 && c[0] > -400) return Q.grains.id;
      if (c[0] > 350) return Q.moulins.id;
      if (Math.abs(c[0]) < 350 && Math.abs(c[1]) < 250) return Q.vieille.id;
      if (c[0] > -150 && c[0] < 350 && Math.abs(c[1]) < 350) return Q.marche.id;
      return Q.jardins.id;
    },
    claims,
    marge_m: 30,
    etendue_m: 1700,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      return [
        bat("eglise", "Église de Jinae", "eglise", c(4, 4), [22, 44], 18, 1, "pignon", "ardoise", "pierre_taillee", "#E2DACB", { params: { clocher_m: 46, clocher_cote: 8.5, abside: true, pente: 50 } }),
        bat("hotel-de-ville", "Hôtel de ville de Jinae", "hotel_de_ville", c(6, 5), [36, 20], 14, 3, "croupe", "ardoise", "pierre_taillee", "#E6DFD0", { params: { pente: 46 } }),
        bat("beffroi", "Beffroi de Jinae", "tour", c(5, 5), [12, 12], 30, 6, "pavillon", "cuivre", "pierre_taillee", "#DCD3C0"),
        bat("halle-du-marche", "Halle du marché", "halle", [100, 0], [50, 22], 12, 1, "croupe", "tuile_plate", "bois", "#C8B088", { params: { piliers: 8, pente: 40 } }),
        bat("halle-aux-grains", "Halle aux grains", "halle", c(7, 7), [58, 26], 13, 1, "croupe", "tuile_plate", "bois", "#C4AD84", { params: { piliers: 10, pente: 40 }, reperes_canon: ["Jinae, ressource clé : nourriture [C] (atlas 06 S13) : la halle est une adaptation"] }),
        bat("grenier-communal", "Grenier communal", "grenier", c(9, 8), [50, 24], 15, 4, "croupe", "tuile_plate", "pierre_brute", "#CFC2A8", { params: { pente: 46 } }),
        bat("grenier-de-la-dime", "Grenier de la Dîme", "grenier", c(3, 9), [46, 24], 14, 4, "croupe", "tuile_plate", "pierre_brute", "#C9BCA2", { params: { pente: 44 } }),
        bat("entrepot-des-messageries", "Entrepôt des messageries", "entrepot", c(5, 8), [54, 24], 10, 2, "pignon", "tuile_plate", "brique", "#C7B08E", { params: { pente: 36 } }),
        bat("relais-de-poste", "Relais de poste", "ecurie", c(6, 7), [40, 16], 8, 2, "pignon", "tuile_plate", "enduit", "#D8CBAE", { params: { pente: 38 } }),
        bat("poste-de-la-garnison", "Poste de la Garnison de Jinae", "caserne", c(7, 3), [44, 30], 11, 3, "croupe", "ardoise", "pierre_taillee", "#D6D0C2", { params: { cour: true, pente: 40 } }),
        bat("clinique-de-jinae", "Clinique de Jinae", "clinique", c(2, 3), [36, 22], 11, 3, "croupe", "ardoise", "pierre_taillee", "#E1DACB", { params: { pente: 44 } }),
        bat("ecole-communale", "École communale de Jinae", "ecole", c(3, 6), [40, 22], 10, 3, "croupe", "ardoise", "brique", "#D9CDB6", { params: { pente: 42 } }),
        bat("moulin-de-la-butte", "Moulin de la Butte", "moulin", c(11, 8), [16, 16], 16, 4, "pavillon", "bardeau", "bois", "#CDBE9E"),
        bat("moulin-des-pres", "Moulin des Prés", "moulin", c(12, 9), [16, 16], 16, 4, "pavillon", "bardeau", "bois", "#C9BA9A"),
        bat("forge-du-quartier", "Forge du quartier des Moulins", "atelier", c(11, 6), [28, 16], 8, 1, "appentis", "tuile_plate", "pierre_brute", "#C3B79F", { params: { pente: 30 } }),
        bat("brasserie", "Brasserie de la rue du Pressoir", "atelier", c(10, 5), [32, 18], 9, 2, "pignon", "tuile_plate", "brique", "#C9AE8E", { params: { pente: 38 } }),
        bat("tannerie", "Tannerie des Prés", "atelier", c(12, 6), [30, 18], 8, 1, "appentis", "tuile_canal", "bois", "#B9A27E", { params: { pente: 28 } }),
        bat("ferme-du-faubourg", "Ferme du faubourg des Jardins", "ferme", c(1, 2), [30, 16], 9, 2, "pignon", "tuile_plate", "pierre_brute", "#CDBF9F", { params: { pente: 40 } }),
        bat("kiosque-du-jardin", "Kiosque du Jardin de l'Hôtel de ville", "kiosque", c(5, 2), [8, 8], 6, 1, "pavillon", "cuivre", "bois", "#D9D0BC"),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return {
        alignements: [
          { rue: "s-7", essence: "tilleul", intervalle_m: 12, cotes: "deux" },
          { rue: "t-4", essence: "marronnier", intervalle_m: 14, cotes: "deux" },
          { rue: "s-3", essence: "tilleul", intervalle_m: 14, cotes: "deux" },
          { rue: "s-11", essence: "peuplier", intervalle_m: 14, cotes: "deux" },
        ],
        isoles: [
          { position: pt(-250, -110), essence: "tilleul", hauteur_m: 21, nom: "Tilleul de la place de l'Église" },
          { position: pt(100, -75), essence: "marronnier", hauteur_m: 18 },
          { position: pt(160, 60), essence: "marronnier", hauteur_m: 18 },
        ],
        parcs,
        vergers: [{ polygone: pts([[-880, -500], [-740, -500], [-740, 400], [-880, 400]]), espacement_m: 8 }, { polygone: pts([[740, -560], [880, -560], [880, 300], [740, 300]]), espacement_m: 8 }],
        haies: [{ trace: pts([[-720, 640], [720, 640]]) }, { trace: pts([[-720, -640], [720, -640]]) }],
        potagers: [{ polygone: pts([[-880, 420], [-740, 420], [-740, 600], [-880, 600]]) }],
        essences_cours: ["tilleul", "marronnier", "erable", "fruitier"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-420, -310], [310, 190], [-170, 260], [480, -150]]), fontaines: pts([[-250, -75]]) }),
    points_de_vue() {
      return [
        { id: "place-du-marche", nom: "Place du Marché et halle", oeil: [20, 140, 3], cible: [100, -20, 7], fov: 60 },
        { id: "eglise-et-beffroi", nom: "Église, beffroi et hôtel de ville", oeil: [-160, 20, 3], cible: [-130, -100, 14], fov: 62 },
        { id: "quartier-des-grains", nom: "Greniers et halle aux grains", oeil: [-60, 300, 3.5], cible: [150, 220, 8], fov: 60 },
        { id: "quartier-des-moulins", nom: "Moulins et tanneries", oeil: [330, 150, 4], cible: [520, 250, 8], fov: 60 },
      ];
    },
    etats() {
      return [
        etat({ id: "845-ordinaire", nom: "845, un jour de marché", date: "845", sources: [{ ref: "état ordinaire de la ville (adaptation)", canon: "A" }], ruines: [], incendies: [], abandon: 0, ciel: "clair", habitants: 1 }),
        etat({
          id: "850-evacuation",
          nom: "850, l'évacuation du sud de Rose",
          date: "850",
          sources: [
            { ref: "docs/spec/01 (850 : invasion de Wall Rose) [C] : les villes du sud de l'intérieur de Rose sont touchées ; ce qui arrive à Jinae n'est pas établi : effectif réduit, fumée, adaptation", canon: "A" },
          ],
          ruines: [],
          incendies: pts([[-300, 420], [250, 500]]),
          abandon: 0.1,
          ciel: "enfume",
          habitants: 0.35,
        }),
      ];
    },
  });
}
