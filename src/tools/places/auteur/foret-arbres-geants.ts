import type { Gabarit, Place } from "../../../data/placeSchema";
import { buildEnclos } from "./enclos";
import { bat, etat, GAB_CHASSE } from "./horsmurs";
import { pt } from "./kit";
import { pts } from "./maria";
import { authored, claimRect, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * Forêt des Arbres Géants (C17, tranche 1) — grande forêt de Wall Maria, plan d'auteur N1. Établi [C] : la forêt des Arbres Géants
 * existe, avec des troncs d'environ 80 m (fichiers 01 §3.1 et 03 §2, atlas 06 R06, T06 « Corridor » et T07 « Clairière »,
 * `prov_foret_arbres_geants`, `poi_foret_arbres_geants`) ; sa localisation exacte est [?] (fichiers 01 §10 et 11 §9 ;
 * `data/geo/paradis.json` la place dans l'anneau de Maria, à l'est de la province de Shiganshina [A]). Tout le reste est une
 * adaptation [A] : plan, poste forestier, noms, effectif.
 *
 * Modèles de végétation : l'essence `geant` du schéma (hauteur 70 à 90 m) est réutilisée pour les futaies ; aucun nouveau modèle.
 * Écart : l'essence `geant` n'a pas de variante propre (pas de ramure en voûte, pas de troncs à ancrages) ; le « corridor » est un
 * layon, la « clairière » est une place de terre au poste forestier (Q32).
 *
 * Parti d'auteur [A] : un carré de 2 000 m de côté ; futaies en quatre massifs, layon du Corridor nord-sud et laie de l'Est, au centre
 * un poste forestier (quatre îlots, quatre jardins, clairière). Population : `prov_foret_arbres_geants` vaut 0 : effectif `?` de
 * 27 personnes (garde-forestier, bûcherons, charbonniers et familles), densité « ferme » 9,5 hab/ha. La zone bâtie est le poste seul.
 */
const XS = [-1000, -600, -250, -120, -40, 40, 120, 250, 600, 1000];
const S = authored(XS, 4);
const T = authored(XS, 4);
const sv = (i: number): number => XS[i] as number;

const GABARITS: Record<string, Gabarit> = { poste: { ...GAB_CHASSE, cour: { type: "jardin", arbres_par_ha: 60 } } };
const Q = { poste: quarter("poste-forestier", "Poste forestier des Futaies", "poste", "habitation", 0.7) };

const FUTAIE = { essences: ["geant", "geant", "geant", "chene", "pin"] as ("geant" | "chene" | "pin")[], arbres_par_ha: 26 };
const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(3), sv(6), sv(0), sv(3), { kind: "parc", id: "futaie-du-nord", nom: "Futaie du Nord", ...FUTAIE });
claimRect(claims, S, T, sv(3), sv(6), sv(6), sv(9), { kind: "parc", id: "futaie-du-sud", nom: "Futaie du Sud", ...FUTAIE });
claimRect(claims, S, T, sv(0), sv(3), sv(0), sv(9), { kind: "parc", id: "futaie-de-l-ouest", nom: "Futaie de l'Ouest", ...FUTAIE });
claimRect(claims, S, T, sv(6), sv(9), sv(0), sv(9), { kind: "parc", id: "futaie-de-l-est", nom: "Futaie de l'Est", ...FUTAIE });
claimRect(claims, S, T, sv(4), sv(5), sv(4), sv(5), { kind: "place", id: "clairiere", nom: "Clairière du poste", revetement: "terre", fontaine: false, marche: false });
const JARDIN = { essences: ["fruitier", "bouleau"] as ("fruitier" | "bouleau")[], arbres_par_ha: 40 };
claimRect(claims, S, T, sv(4), sv(5), sv(3), sv(4), { kind: "parc", id: "verger-du-poste", nom: "Verger du poste", ...JARDIN });
claimRect(claims, S, T, sv(3), sv(4), sv(4), sv(5), { kind: "parc", id: "potager-du-poste", nom: "Potager du poste", ...JARDIN });
claimRect(claims, S, T, sv(5), sv(6), sv(4), sv(5), { kind: "parc", id: "pre-des-attelages", nom: "Pré des attelages", ...JARDIN });
claimRect(claims, S, T, sv(4), sv(5), sv(5), sv(6), { kind: "parc", id: "parc-a-bois", nom: "Parc à bois", ...JARDIN });

export function foretArbresGeants(): Place {
  const p = buildEnclos({
    id: "foret-arbres-geants",
    nom: "Forêt des Arbres Géants",
    libelle: "Forêt des Arbres Géants (grande forêt de Wall Maria)",
    canon: "C",
    sources: [
      { ref: "docs/spec/01 §3.1 et docs/spec/06 R06, T06, T07 : forêt des Arbres Géants, arbres d'environ 80 m [C] (docs/spec/03 §2) ; data/provinces/paradis.json : prov_foret_arbres_geants, poi_foret_arbres_geants [C]", canon: "C" },
      { ref: "localisation exacte : non établie [?] (docs/spec/01 §10, docs/spec/11 §9) ; data/geo/paradis.json : anneau de Maria [A]", canon: "?" },
      { ref: "plan des futaies, layons, poste forestier, noms, effectif : adaptation (création C17, `docs/lore/creations.md`)", canon: "A" },
    ],
    province: "prov_foret_arbres_geants",
    style: "E14",
    population: { province: null, part: 1, valeur: 27, canon: "?", note: "`prov_foret_arbres_geants` existe [C] mais sa population de simulation est nulle (forêt, atlas R06) ; effectif du poste forestier (garde-forestier, bûcherons, charbonniers et familles) : valeur paramétrable `?`." },
    densite: { classe: "ferme", valeur: 9.5, canon: "A" },
    orientation: { valeur: "aucune", canon: "?" },
    s: S,
    t: T,
    names: { s: [], t: [], lanes: ["Layon du Corridor", "Layon de l'Écorce", "Layon de la Résine", "Layon de la Cognée", "Layon de la Sève", "Layon de la Mousse"] },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt: () => Q.poste.id,
    claims,
    marge_m: 30,
    etendue_m: 2200,
    extraStreets: () => [
      { id: "layon-du-corridor", nom: "Layon du Corridor", canon: "A", type: "chemin", trace: pts([[0, -1000], [20, -700], [-10, -400], [0, -130]]), largeur_m: 7, revetement: "terre" },
      { id: "laie-de-l-est", nom: "Laie de l'Est", canon: "A", type: "chemin", trace: pts([[130, 0], [450, 30], [700, -20], [1000, 10]]), largeur_m: 6, revetement: "terre" },
      { id: "layon-du-sud", nom: "Layon du Sud", canon: "A", type: "chemin", trace: pts([[0, 130], [-30, 500], [20, 800], [0, 1000]]), largeur_m: 6, revetement: "terre" },
    ],
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      const [ax, ay] = c(5, 3);
      const [bx, by] = c(3, 5);
      const [cx, cy] = c(5, 5);
      return [
        bat("maison-du-garde-forestier", "Maison du garde-forestier", "maison", c(3, 3), [18, 12], 7, 2, "croupe", "bardeau", "bois", "#C9B993", { params: { pente: 44 } }),
        bat("scierie-des-futaies", "Scierie des Futaies", "atelier", pt(ax, ay - 14), [30, 16], 9, 1, "pignon", "bardeau", "bois", "#B4A47E", { params: { pente: 32 } }),
        bat("hangar-a-grumes", "Hangar à grumes", "grange", pt(ax, ay + 18), [26, 10], 7, 1, "pignon", "bardeau", "bois", "#B8A882", { params: { pente: 30 } }),
        bat("logis-des-bucherons", "Logis des bûcherons", "maison", pt(bx, by - 12), [26, 12], 6, 1, "pignon", "bardeau", "bois", "#BEAE88", { params: { pente: 40 } }),
        bat("ecurie-des-attelages", "Écurie des attelages", "ecurie", pt(bx, by + 16), [22, 10], 5, 1, "pignon", "bardeau", "bois", "#BCAD88", { params: { pente: 34 } }),
        bat("chapelle-du-poste", "Chapelle du poste", "chapelle", pt(cx - 14, cy - 8), [10, 16], 8, 1, "pignon", "bardeau", "pierre_brute", "#D8CFBA", { params: { clocher_m: 12, clocher_cote: 3, abside: false, pente: 48 } }),
        bat("magasin-d-outils", "Magasin d'outils et de cordages", "entrepot", pt(cx + 4, cy + 18), [24, 12], 6, 1, "pignon", "bardeau", "bois", "#B7A883", { params: { pente: 32 } }),
        bat("auvent-de-la-clairiere", "Auvent de la clairière", "halle", [0, 0], [16, 8], 5, 1, "appentis", "bardeau", "bois", "#C2A57E", { params: { piliers: 4, pente: 30 } }),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return {
        alignements: [],
        isoles: [
          { position: pt(-26, -22), essence: "geant", hauteur_m: 82, nom: "Géant de la clairière" },
          { position: pt(30, 24), essence: "geant", hauteur_m: 78 },
        ],
        parcs,
        vergers: [],
        haies: [],
        potagers: [{ polygone: pts([[-36, 46], [-6, 46], [-6, 66], [-36, 66]]) }],
        essences_cours: ["fruitier", "bouleau"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-60, -60]]), fontaines: [] }),
    points_de_vue() {
      return [
        { id: "corridor", nom: "Corridor : le layon entre les géants", oeil: [0, -140, 2.2], cible: [0, -900, 30], fov: 62 },
        { id: "clairiere", nom: "Clairière du poste forestier", oeil: [0, 100, 2.5], cible: [0, -20, 25], fov: 64 },
        { id: "sous-les-geants", nom: "Sous les géants, regard vers la cime", oeil: [-60, -260, 2], cible: [-60, -320, 80], fov: 70 },
        { id: "scierie", nom: "Scierie et hangar à grumes", oeil: [30, -20, 3], cible: [80, -90, 6], fov: 60 },
      ];
    },
    etats() {
      return [
        etat({ id: "845-ordinaire", nom: "845, la forêt en temps ordinaire", date: "845", sources: [{ ref: "état ordinaire de la forêt et du poste (adaptation)", canon: "A" }], ruines: [], incendies: [], abandon: 0, ciel: "clair", habitants: 1 }),
        etat({ id: "845-brume", nom: "845, la forêt sous la brume", date: "845", sources: [{ ref: "forêt à visibilité faible [C] (data/tactical_maps/maps.json : « visibilité faible ») : brume sous les cimes, effectif réduit, adaptation", canon: "A" }], ruines: [], incendies: [], abandon: 0, ciel: "brumeux", habitants: 0.6 }),
      ];
    },
  });
  // Zone habitée : le poste forestier seul ; les futaies (près de 400 ha) sont des parcs hors de la zone bâtie.
  return { ...p, perimetre: pts([[-100, -100], [100, -100], [100, 100], [-100, 100]]) };
}
