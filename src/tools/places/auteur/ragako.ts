import type { Gabarit, Place } from "../../../data/placeSchema";
import { buildEnclos } from "./enclos";
import { bat, etat, GAB_FERME, GAB_VILLAGE } from "./horsmurs";
import { pt } from "./kit";
import { pts } from "./maria";
import { authored, claimRect, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * Ragako (C17, tranche 1) — village du sud de l'intérieur de Rose, plan d'auteur N1. Établi [C] : Ragako est un village du sud de
 * l'intérieur de Rose, détruit en 850 (fichiers 01 §3.1 et 11 §2, atlas 06 S05 et T20 « Ragako — Village », `prov_ragako`).
 * La cause et le détail de la destruction ne sont pas posés ici (état 850 : étendue des ruines et des incendies [A], aucun secret
 * montré). Tout le reste est une adaptation [A] : tracé, noms, quartiers, bâtiments, part de population.
 *
 * Parti d'auteur [A] : un bourg de 600 m de côté entouré d'une ceinture de prés et de vergers (800 m de côté en tout) ; Grand-Rue
 * nord-sud et rue de l'Église est-ouest, place du village (puits, lavoir) au centre, église et son clos à l'ouest, maison commune et
 * école à l'est, auberge et forge au sud de la place, moulin sur le ruisseau à l'est, fermes en bordure. Population : 12 % de
 * `prov_ragako` (8 696 au scénario 845), le reste de la province vivant en hameaux et fermes isolées (adaptation) ; densité 30 hab/ha.
 */
const XS = [-400, -300, -190, -90, 10, 105, 210, 300, 400];
const YS = [-400, -300, -205, -105, -5, 95, 200, 300, 400];
const S = authored(XS, 5, { 10: 9, [-300]: 6, 300: 6, [-90]: 6, 210: 6 });
const T = authored(YS, 5, { [-5]: 9, [-300]: 6, 300: 6, [-205]: 6, 200: 6 });
const sv = (i: number): number => XS[i] as number;
const tv = (j: number): number => YS[j] as number;

const GABARITS: Record<string, Gabarit> = { bourg: GAB_VILLAGE, ferme: GAB_FERME };
const Q = {
  bourg: quarter("bourg", "Bourg de Ragako", "bourg", "habitation", 0.85),
  ecarts: quarter("ecarts-et-fermes", "Écarts et fermes", "ferme", "habitation", 0.6),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(3), sv(5), tv(3), tv(4), { kind: "place", id: "place-du-village", nom: "Place du village", revetement: "terre", fontaine: false, marche: false });
claimRect(claims, S, T, sv(2), sv(3), tv(2), tv(3), { kind: "parc", id: "clos-de-l-eglise", nom: "Clos de l'église", essences: ["tilleul", "pin", "fruitier"], arbres_par_ha: 45 });
const PRES: [string, string, number, number, number, number][] = [
  ["pres-du-nord", "Prés et vergers du Nord", 0, 8, 0, 1],
  ["pres-du-sud", "Prés et vergers du Sud", 0, 8, 7, 8],
  ["pres-de-l-ouest", "Prés et vergers de l'Ouest", 0, 1, 1, 7],
  ["pres-de-l-est", "Prés du Ruisseau", 7, 8, 1, 7],
];
for (const [id, nom, i0, i1, j0, j1] of PRES) claimRect(claims, S, T, sv(i0), sv(i1), tv(j0), tv(j1), { kind: "parc", id, nom, essences: ["fruitier", "saule", "peuplier", "fruitier"], arbres_par_ha: 34 });

const NOMS_S = ["Chemin de l'Ouest", "Rue du Clos", "Rue des Chaumes", "Grand-Rue", "Rue des Tisserands", "Rue du Four", "Rue des Vignes", "Chemin de l'Est", "Chemin du Ruisseau"];
const NOMS_T = ["Chemin du Nord", "Rue des Laboureurs", "Rue de la Mare", "Rue de l'Église", "Rue des Charrons", "Rue des Granges", "Rue des Prés", "Chemin du Sud", "Chemin des Haies"];

export function ragako(): Place {
  return buildEnclos({
    id: "ragako",
    nom: "Ragako",
    libelle: "Ragako (village du sud de l'intérieur de Rose)",
    canon: "C",
    sources: [
      { ref: "docs/spec/01 §3.1 et docs/spec/11 §2 : Ragako, village du sud de l'intérieur de Rose, détruit en 850 [C] ; docs/spec/06 S05, T20 ; data/provinces/paradis.json : prov_ragako [C]", canon: "C" },
      { ref: "cause et détail de la destruction : non posés (aucun secret montré) ; étendue des ruines et des incendies de l'état 850 : adaptation", canon: "A" },
      { ref: "tracé, noms, quartiers, bâtiments, part de population : adaptation (création C17, `docs/lore/creations.md`)", canon: "A" },
    ],
    province: "prov_ragako",
    style: "E11",
    population: { province: "prov_ragako", part: 0.12, canon: "A", note: "12 % de la population de `prov_ragako` au départ de scn_sandbox_845 (8 696 hab.) logés dans le bourg ; le reste de la province vit en hameaux et fermes isolées ; la province existe [C], la part est adaptée [A]." },
    densite: { classe: "village", valeur: 30, canon: "A" },
    orientation: { valeur: "sud", canon: "C" },
    s: S,
    t: T,
    names: { s: NOMS_S, t: NOMS_T, lanes: ["Ruelle des Poules", "Ruelle du Lavoir", "Sentier des Chaumes", "Sentier de la Mare", "Sentier des Granges", "Sentier du Four", "Sentier des Haies", "Sentier du Verger"] },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      return Math.abs(c[0]) < 230 && Math.abs(c[1]) < 230 ? Q.bourg.id : Q.ecarts.id;
    },
    claims,
    marge_m: 30,
    etendue_m: 1000,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      return [
        bat("eglise", "Église de Ragako", "eglise", c(2, 3), [16, 32], 14, 1, "pignon", "ardoise", "pierre_brute", "#DAD2C0", { params: { clocher_m: 30, clocher_cote: 6, abside: true, pente: 50 } }),
        bat("presbytere", "Presbytère", "maison", c(1, 3), [16, 11], 7, 2, "croupe", "tuile_plate", "enduit", "#E0D4BB", { params: { pente: 42 } }),
        bat("maison-commune", "Maison commune", "hotel_de_ville", c(5, 3), [22, 13], 9, 2, "croupe", "tuile_plate", "pierre_brute", "#DDD2BA", { params: { pente: 44 } }),
        bat("ecole-du-village", "École du village", "ecole", c(5, 4), [24, 12], 7, 1, "pignon", "tuile_plate", "enduit", "#E2D6BF", { params: { pente: 40 } }),
        bat("auberge-du-carrefour", "Auberge du Carrefour", "maison", c(3, 4), [26, 14], 8, 2, "croupe", "chaume", "colombage", "#D6C6A6", { params: { pente: 46 } }),
        bat("forge", "Forge de Ragako", "atelier", c(4, 4), [20, 12], 6, 1, "appentis", "tuile_plate", "pierre_brute", "#C3B79F", { params: { pente: 30 } }),
        bat("lavoir-du-village", "Lavoir du village", "fontaine", [0, -55], [8, 5], 3, 1, "appentis", "tuile_plate", "pierre_brute", "#C9C1AE"),
        bat("grange-de-la-dime", "Grange de la Dîme", "grange", c(1, 4), [26, 14], 9, 1, "pignon", "chaume", "bois", "#BDB197", { params: { pente: 40 } }),
        bat("moulin-du-ruisseau", "Moulin du Ruisseau", "moulin", [352, -160], [14, 14], 14, 3, "pavillon", "bardeau", "bois", "#CDBE9E", { params: { roue: true } }),
        bat("ferme-du-nord-ouest", "Ferme du Nord-Ouest", "ferme", c(1, 1), [28, 15], 8, 2, "pignon", "chaume", "pierre_brute", "#CDBF9F", { params: { pente: 40 } }),
        bat("ferme-de-la-mare", "Ferme de la Mare", "ferme", c(6, 5), [28, 15], 8, 2, "pignon", "chaume", "pierre_brute", "#C9BB9B", { params: { pente: 40 } }),
        bat("ferme-du-sud", "Ferme du Sud", "ferme", c(2, 6), [30, 15], 8, 2, "demi_croupe", "tuile_plate", "colombage", "#D2C6A8", { params: { pente: 38 } }),
        bat("bergerie-communale", "Bergerie communale", "grange", c(6, 2), [24, 12], 7, 1, "pignon", "chaume", "bois", "#B8AC92", { params: { pente: 36 } }),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return {
        alignements: [{ rue: "s-4", essence: "tilleul", intervalle_m: 14, cotes: "deux" }],
        isoles: [
          { position: pt(-20, -45), essence: "tilleul", hauteur_m: 20, nom: "Tilleul de la place" },
          { position: pt(60, -70), essence: "chene", hauteur_m: 22 },
        ],
        parcs,
        vergers: [{ polygone: pts([[-380, -380], [-330, -380], [-330, -310], [-380, -310]]), espacement_m: 8 }],
        haies: [{ trace: pts([[-420, 420], [420, 420]]) }, { trace: pts([[-420, -420], [420, -420]]) }],
        potagers: [{ polygone: pts([[-175, 40], [-110, 40], [-110, 80], [-175, 80]]) }],
        essences_cours: ["fruitier", "tilleul", "chene"],
      };
    },
    eau: () => ({ voies: [{ id: "ruisseau-du-moulin", nom: "Ruisseau du Moulin", canon: "A", type: "riviere", trace: pts([[322, -400], [330, -250], [322, -120], [330, 20], [322, 150], [330, 400]]), largeur_m: 4, quais: false }], ponts: [{ id: "pont-du-moulin", position: pt(326, 20), angle_deg: 0, longueur_m: 8, largeur_m: 4, type: "bois" }], puits: pts([[-40, -80], [150, 150]]), fontaines: [] }),
    points_de_vue() {
      return [
        { id: "place-du-village", nom: "Place du village, église et auberge", oeil: [40, 70, 3], cible: [-60, -60, 8], fov: 62 },
        { id: "moulin-et-ruisseau", nom: "Moulin sur le ruisseau", oeil: [250, -60, 3], cible: [352, -160, 6], fov: 60 },
        { id: "grand-rue", nom: "Grand-Rue vers le nord", oeil: [10, 220, 2.2], cible: [10, -150, 7], fov: 58 },
        { id: "fermes-du-sud", nom: "Fermes du sud", oeil: [20, 190, 3], cible: [-150, 255, 6], fov: 60 },
      ];
    },
    etats() {
      return [
        etat({ id: "845-intact", nom: "845, le village en temps ordinaire", date: "845", sources: [{ ref: "état ordinaire du village (adaptation)", canon: "A" }], ruines: [], incendies: [], abandon: 0, ciel: "clair", habitants: 1 }),
        etat({
          id: "850-detruit",
          nom: "850, le village détruit",
          date: "850",
          canon: "C",
          sources: [
            { ref: "docs/spec/01 §3.1 et docs/spec/11 §2, atlas 06 S05 : Ragako détruit en 850 [C]", canon: "C" },
            { ref: "étendue des ruines, des incendies, abandon, effectif nul : adaptation ; cause non posée", canon: "A" },
          ],
          ruines: [{ polygone: pts([[-320, -320], [320, -320], [320, 320], [-320, 320]]), part: 0.92 }],
          incendies: pts([[-120, -60], [40, -90], [-30, 120], [150, 40], [-200, 150], [230, -120]]),
          abandon: 0.35,
          ciel: "enfume",
          habitants: 0,
        }),
      ];
    },
  });
}
