import type { Gabarit, Place } from "../../../data/placeSchema";
import { buildEnclos } from "./enclos";
import { bat, etat } from "./horsmurs";
import { pt } from "./kit";
import { pts } from "./maria";
import { authored, claimRect, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * Fort du Front (C17, tranche 2) — Fort Avancé de Maria (atlas 06 R15, « Dépôt de gaz avancé »), plan d'auteur N1. Établi : l'atlas liste le
 * Fort Avancé de Maria comme province de type « fort » de l'anneau de Maria, dépôt de gaz avancé, sans lui donner de nom propre, de plan ni
 * de position ; l'entrée est elle-même `A` (`prov_fort_avance_maria`) : ce lieu n'est donc pas `C`. Position sur la carte [?] ; tout le
 * reste (nom « Fort du Front », plan, noms, dimensions, garnison, états) est une adaptation [A].
 *
 * Écarts de schéma (documentés, `docs/places/fort-du-front/lore.md`) : l'enceinte propre d'un fort n'est pas modélisable (le schéma ne connaît
 * que les murs Maria, Rose et Sina), comme au château d'Utgard : quatre tours d'angle, bastions et châtelet sont posés comme bâtiments, les
 * courtines manquent (dette) ; pas de fossé (voie d'eau de type canal seulement).
 *
 * Parti d'auteur [A] : un carré de 280 m de côté autour d'une cour d'armes de 100 m : donjon-caserne au nord, casernements à l'ouest et à
 * l'est, écuries au sud-ouest, dépôt de gaz au sud-est, magasin d'armes, infirmerie, cuisines et corps de garde ; tours aux angles, bastions
 * au milieu des côtés ; route de ravitaillement au sud. Population : 300 soldats de la garnison (part de `prov_fort_avance_maria`,
 * 8 696 au scénario 845) ; densité « village » 50 hab/ha (casernement serré).
 */
const XS = [-140, -100, -50, 50, 100, 140];
const S = authored(XS, 5, { [-50]: 8, 50: 8 });
const T = authored(XS, 5, { [-50]: 8, 50: 8 });
const sv = (i: number): number => XS[i] as number;

const GAB_FORT: Gabarit = { etages: [2, 3, 2], hauteur_etage_m: 3.3, toits: ["pignon", "croupe", "pignon"], pente_deg: [34, 44], couvertures: ["ardoise", "tuile_plate", "ardoise"], facades: ["pierre_brute", "pierre_taillee", "enduit"], teintes: ["#BDB4A0", "#B2A994", "#C6BDA8"], parcelles_m: [14, 18, 12], profondeur_m: 10, boutiques: false, passage_m: 0, cour: { type: "plantee", arbres_par_ha: 50 } };
const GABARITS: Record<string, Gabarit> = { fort: GAB_FORT };
const Q = {
  fort: quarter("enceinte-du-fort", "Enceinte du fort", "fort", "caserne", 0.5),
};

const claims: Record<string, Claim> = {};
claimRect(claims, S, T, sv(2), sv(3), sv(2), sv(3), { kind: "place", id: "cour-d-armes", nom: "Cour d'armes", revetement: "gravier", fontaine: false, marche: false });
// Cases du pourtour qui ne sont ni angles ni milieux de côté : glacis herbeux (non bâtis).
for (const [i, j] of [[1, 0], [3, 0], [0, 1], [0, 3], [4, 1], [4, 3], [1, 4], [3, 4]] as [number, number][]) claims[`${i},${j}`] = { kind: "vide" };

export function fortDuFront(): Place {
  return buildEnclos({
    id: "fort-du-front",
    nom: "Fort du Front",
    libelle: "Fort du Front (Fort Avancé de Maria, dépôt de gaz avancé)",
    canon: "A",
    sources: [
      { ref: "docs/spec/06 R15 : Fort Avancé de Maria, fort, dépôt de gaz avancé [A] ; data/provinces/paradis.json : prov_fort_avance_maria [A]", canon: "A" },
      { ref: "position exacte sur la carte : non établie [?]", canon: "?" },
      { ref: "nom « Fort du Front », plan, noms, dimensions, garnison, états : adaptation (création C17, `docs/lore/creations.md`)", canon: "A" },
    ],
    province: "prov_fort_avance_maria",
    style: "E24",
    population: { province: "prov_fort_avance_maria", part: 0.0345, canon: "A", note: "300 soldats de la garnison : part de `prov_fort_avance_maria` (8 696 au départ de scn_sandbox_845) ; la province existe [A] (atlas R15), l'effectif est adapté [A]." },
    densite: { classe: "village", valeur: 50, canon: "A" },
    orientation: { valeur: "aucune", canon: "?" },
    s: S,
    t: T,
    names: { s: ["Rue du Rempart ouest", "Rue du Rempart est"], t: ["Rue des Gardes", "Rue du Dépôt"], lanes: ["Ruelle de la Courtine", "Ruelle du Guet", "Ruelle des Écuries", "Ruelle de la Citerne", "Ruelle des Palefreniers", "Ruelle du Chemin de ronde", "Ruelle du Puits", "Ruelle des Magasins", "Ruelle de l'Infirmerie", "Ruelle de la Herse"] },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt: () => Q.fort.id,
    claims,
    marge_m: 25,
    etendue_m: 700,
    extraStreets: () => [{ id: "route-de-ravitaillement", nom: "Route de ravitaillement", canon: "A", type: "route", trace: pts([[0, 164], [0, 150], [0, 142]]), largeur_m: 7, revetement: "gravier" }],
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      const o = (i: number, j: number, dx: number, dy: number): [number, number] => {
        const [x, y] = c(i, j);
        return [x + dx, y + dy];
      };
      const pierre = "pierre_brute" as const;
      return [
        bat("donjon-caserne", "Donjon-caserne", "donjon", o(2, 1, -25, 0), [26, 26], 26, 5, "plat", "terrasse", pierre, "#B6AD99", { reperes_canon: ["fort avancé de Maria (atlas 06 R15) : donjon-caserne [A], plan et volumes adaptés"] }),
        bat("logement-des-officiers", "Logement des officiers", "maison", o(2, 1, 26, 0), [32, 16], 9, 2, "croupe", "ardoise", "pierre_taillee", "#C6BDA8", { params: { pente: 38 } }),
        bat("casernement-de-l-ouest", "Casernement de l'ouest", "caserne", c(1, 2), [30, 76], 10, 2, "pignon", "ardoise", pierre, "#BDB4A0", { params: { pente: 36 } }),
        bat("casernement-de-l-est", "Casernement de l'est", "caserne", c(3, 2), [30, 76], 10, 2, "pignon", "ardoise", pierre, "#BAB19D", { params: { pente: 36 } }),
        bat("magasin-d-armes", "Magasin d'armes", "arsenal", c(1, 1), [32, 28], 8, 2, "croupe", "ardoise", pierre, "#B9B09B", { params: { pente: 34 } }),
        bat("infirmerie-du-fort", "Infirmerie du fort", "clinique", c(3, 1), [32, 26], 8, 2, "croupe", "tuile_plate", "enduit", "#CFC6B0", { params: { pente: 38 } }),
        bat("ecuries-du-fort", "Écuries du fort", "ecurie", c(1, 3), [34, 28], 7, 1, "pignon", "ardoise", pierre, "#B9B09B", { params: { pente: 34 } }),
        bat("depot-de-gaz-avance", "Dépôt de gaz avancé", "entrepot", c(3, 3), [34, 28], 8, 1, "pignon", "ardoise", pierre, "#B2A994", { params: { pente: 30 } }),
        bat("cuisines-et-refectoire", "Cuisines et réfectoire", "atelier", o(2, 3, -26, 0), [36, 18], 8, 1, "pignon", "ardoise", pierre, "#B8AF9B", { params: { pente: 34 } }),
        bat("corps-de-garde", "Corps de garde", "maison", o(2, 3, 26, 0), [28, 14], 7, 1, "croupe", "ardoise", pierre, "#BDB4A0", { params: { pente: 36 } }),
        bat("tour-du-nord-ouest", "Tour du nord-ouest", "tour", c(0, 0), [14, 14], 20, 4, "pavillon", "ardoise", pierre, "#BAB19D"),
        bat("tour-du-nord-est", "Tour du nord-est", "tour", c(4, 0), [14, 14], 20, 4, "pavillon", "ardoise", pierre, "#BAB19D"),
        bat("tour-du-sud-ouest", "Tour du sud-ouest", "tour", c(0, 4), [14, 14], 20, 4, "pavillon", "ardoise", pierre, "#B7AE9A"),
        bat("tour-du-sud-est", "Tour du sud-est", "tour", c(4, 4), [14, 14], 20, 4, "pavillon", "ardoise", pierre, "#BAB19D"),
        bat("bastion-du-nord", "Bastion du nord", "fort", c(2, 0), [64, 22], 12, 2, "plat", "terrasse", pierre, "#B4AB97"),
        bat("bastion-du-sud", "Bastion du sud et poterne", "fort", c(2, 4), [64, 22], 12, 2, "plat", "terrasse", pierre, "#B4AB97"),
        bat("bastion-de-l-ouest", "Bastion de l'ouest", "fort", c(0, 2), [22, 64], 12, 2, "plat", "terrasse", pierre, "#B4AB97"),
        bat("bastion-de-l-est", "Bastion de l'est", "fort", c(4, 2), [22, 64], 12, 2, "plat", "terrasse", pierre, "#B4AB97"),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return {
        alignements: [{ rue: "route-de-ravitaillement", essence: "peuplier", intervalle_m: 14, cotes: "deux" }],
        isoles: [{ position: pt(-30, 30), essence: "tilleul", hauteur_m: 18, nom: "Tilleul de la cour d'armes" }],
        parcs,
        vergers: [],
        haies: [],
        potagers: [],
        essences_cours: ["tilleul", "erable", "bouleau"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-20, -20]]), fontaines: [] }),
    points_de_vue() {
      return [
        { id: "cour-d-armes-et-donjon", nom: "Cour d'armes et donjon-caserne", oeil: [20, 40, 3], cible: [-25, -75, 14], fov: 62 },
        { id: "depot-de-gaz", nom: "Dépôt de gaz avancé et corps de garde", oeil: [0, 20, 3], cible: [75, 75, 5], fov: 60 },
        { id: "porte-et-route", nom: "Poterne et route de ravitaillement", oeil: [10, 260, 3], cible: [0, 125, 8], fov: 58 },
        { id: "casernements", nom: "Casernements de l'ouest", oeil: [20, 0, 3], cible: [-75, 0, 6], fov: 60 },
      ];
    },
    etats() {
      return [
        etat({ id: "845-ordinaire", nom: "845, le fort en service", date: "845", sources: [{ ref: "état ordinaire du fort avant la chute de Maria (adaptation)", canon: "A" }], ruines: [], incendies: [], abandon: 0, ciel: "clair", habitants: 1 }),
        etat({ id: "845-evacue", nom: "845, le fort évacué après la brèche", date: "845", sources: [{ ref: "anneau de Maria évacué après la chute de Maria (atlas 06, note « scénario 845+ ») ; degré d'abandon : adaptation", canon: "A" }], ruines: [], incendies: [], abandon: 0.35, ciel: "brumeux", habitants: 0.15 }),
      ];
    },
  });
}
