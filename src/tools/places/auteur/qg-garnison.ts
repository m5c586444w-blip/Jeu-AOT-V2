import type { Gabarit, Place } from "../../../data/placeSchema";
import { pt } from "./kit";
import { BASE_GABARITS, pts } from "./maria";
import { buildEnclos } from "./enclos";
import { building, claimRect, lines, quarter } from "./saillie";
import type { Claim } from "./saillie";

/**
 * Quartier général de la Garnison, à Trost (C15, tranche 2) — plan d'auteur du complexe, sans enceinte propre dans le schéma. Établi
 * [C] : la Garnison a son quartier général à Trost (atlas 06 S01, `poi_qg_garnison_trost` dans `data/geo/paradis.json`) ; il est
 * posé dans `trost.ts` comme repère `quartier-general-garnison` (64 m × 48 m, trois étages, pierre taillée, toit en croupe, ardoise),
 * au sud de la ville, dans le quartier de la Garnison, entre la rue de l'Évacuation (à l'ouest) et la place de la Porte Sud (au sud).
 * Ce plan en est le détail : le bâtiment principal reprend exactement ce repère, et le complexe (cour d'honneur, casernement de la
 * garde, chancellerie, infirmerie, écuries, magasins, remise des canons) occupe l'emprise de plusieurs îlots du quartier de la Garnison
 * que le plan de Trost ne détaille pas. Tout le reste est une adaptation [A] : tracé, noms, dimensions, quartiers, bâtiments.
 *
 * Parti d'auteur [A] : un complexe fortifié sur 3 × 4 cellules, cour d'honneur au centre, bâtiment principal au sud (face à la place de
 * la Porte Sud), écuries et remises au nord, casernements et chancellerie de chaque côté. Population : 1,2 % de celle de `prov_trost`
 * (95 652 au scénario 845), soit l'état-major, le régiment de service et le personnel du quartier général ; ces soldats sont des
 * éléments de la garnison de 2 500 soldats du scénario, non des habitants des deux zones civiles de Trost (adaptation).
 */
const S = lines(-120, 120, 80, 9, { 0: 10, 3: 10 });
const T = lines(-132, 132, 66, 9);
const sv = (i: number): number => -120 + 80 * i;
const tv = (j: number): number => -132 + 66 * j;

const GABARITS: Record<string, Gabarit> = {
  casernement: { ...(BASE_GABARITS.garnison as Gabarit), etages: [3, 3], cour: { type: "pavee", arbres_par_ha: 30 } },
  administration: { ...(BASE_GABARITS.garnison as Gabarit), teintes: ["#DDD6C6", "#D2CBB9"], profondeur_m: 13, cour: { type: "plantee", arbres_par_ha: 60 } },
  ecuries: { etages: [1, 2], hauteur_etage_m: 3.8, toits: ["pignon", "croupe"], pente_deg: [32, 42], couvertures: ["ardoise", "tuile_plate"], facades: ["pierre_brute", "brique"], teintes: ["#C9BDA3", "#BFB399", "#CFC3AB"], parcelles_m: [18, 24, 16], profondeur_m: 14, boutiques: false, passage_m: 0, cour: { type: "pavee", arbres_par_ha: 35 } },
};

const Q = {
  honneur: quarter("etat-major", "État-major et cour d'honneur", "administration", "administration", 0.8),
  casernement: quarter("casernement-de-la-garde", "Casernement de la garde et du régiment de service", "casernement", "caserne", 0.85),
  services: quarter("ecuries-et-remises", "Écuries, ateliers et remises", "ecuries", "entrepot", 0.85),
};

const claims: Record<string, Claim> = {};
// Cour d'honneur : la cellule centrale des deux rangées du milieu (80 m × 132 m).
claimRect(claims, S, T, sv(1), sv(2), tv(1), tv(3), { kind: "place", id: "cour-d-honneur", nom: "Cour d'honneur", revetement: "dalles", fontaine: false, marche: false });
claimRect(claims, S, T, sv(0), sv(1), tv(3), tv(4), { kind: "parc", id: "jardin-du-commandement", nom: "Jardin du commandement", essences: ["tilleul", "marronnier", "fruitier"], arbres_par_ha: 60 });

/** Noms de rues du quartier général : tous créés [A] ; la rue de l'ouest est celle de l'Évacuation de Trost. */
const NOMS_S = ["Rue de l'Évacuation", "Allée des Ordonnances", "Allée de la Garde", "Allée de l'Escadron"];
const NOMS_T = ["Rue des Remises", "Rue du Guet", "Rue des Estafettes", "Rue de l'État-major", "Rue de la Grille d'honneur"];

export function qgGarnison(): Place {
  return buildEnclos({
    id: "qg-garnison",
    nom: "Quartier général de la Garnison",
    libelle: "Quartier général de la Garnison (Trost)",
    canon: "C",
    sources: [
      { ref: "docs/spec/06 S01 : quartier général de la Garnison à Trost [C] ; data/geo/paradis.json : poi_qg_garnison_trost [C]", canon: "C" },
      { ref: "emplacement dans Trost, bâtiment principal : data/places/trost.json (repère quartier-general-garnison, 64 m × 48 m) ; plan intérieur du bâtiment : non modélisé par le schéma de lieu", canon: "A" },
      { ref: "tracé du complexe, noms, dimensions, quartiers, bâtiments annexes : adaptation (création C15, `docs/lore/creations.md`)", canon: "A" },
    ],
    province: "prov_trost",
    style: "E02",
    population: { province: "prov_trost", part: 0.012, canon: "A", note: "1,2 % de la population de `prov_trost` au départ de scn_sandbox_845 (95 652 hab.) : état-major, régiment de service et personnel du quartier général, soldats de la garnison de 2 500 soldats du scénario ; la province existe [C], la part est adaptée [A]." },
    densite: { classe: "coeur", valeur: 220, canon: "A" },
    orientation: { valeur: "sud", canon: "C" },
    s: S,
    t: T,
    names: { s: NOMS_S, t: NOMS_T, lanes: ["Ruelle du Fourrage"] },
    gabarits: GABARITS,
    quarters: Q,
    quarterAt(c) {
      if (c[1] < -60) return Q.services.id;
      if (Math.abs(c[0]) > 50) return Q.casernement.id;
      return Q.honneur.id;
    },
    claims,
    marge_m: 30,
    etendue_m: 700,
    batiments(ctx) {
      const c = (i: number, j: number): [number, number] => ctx.cell(i, j);
      return [
        // Même identifiant, mêmes dimensions et mêmes matériaux que le repère de `trost.ts`.
        building({ id: "quartier-general-garnison", nom: "Quartier général de la Garnison", canon: "C", archetype: "caserne", position: c(1, 3), emprise_m: [64, 48], angle_deg: 0, hauteur_m: 14, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#DAD4C6", params: { cour: true, pente: 38 }, reperes_canon: ["poi_qg_garnison_trost [C] (atlas 06 S01) : existence et ville établies, emplacement et volumes [A]"], sources: [{ ref: "docs/spec/06 : QG de la Garnison (Trost) [C] ; data/geo/paradis.json : poi_qg_garnison_trost", canon: "C" }, { ref: "volumes : repère de data/places/trost.json (adaptation)", canon: "A" }] }),
        building({ id: "chancellerie", nom: "Chancellerie du quartier général", canon: "A", archetype: "hotel_de_ville", position: c(2, 1), emprise_m: [30, 18], angle_deg: 0, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E0D9C8", params: { pente: 44 } }),
        building({ id: "casernement-de-la-garde", nom: "Casernement de la garde du quartier général", canon: "A", archetype: "caserne", position: c(2, 2), emprise_m: [56, 24], angle_deg: 0, hauteur_m: 10, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D6D0C2", params: { cour: false, pente: 36 } }),
        building({ id: "casernement-du-regiment-de-service", nom: "Casernement du régiment de service", canon: "A", archetype: "caserne", position: c(0, 1), emprise_m: [56, 24], angle_deg: 0, hauteur_m: 10, etages: 3, toit: "croupe", couverture: "ardoise", facade: "brique", teinte: "#CBB9A4", params: { cour: false, pente: 38 } }),
        building({ id: "infirmerie-du-quartier-general", nom: "Infirmerie du quartier général", canon: "A", archetype: "clinique", position: c(0, 2), emprise_m: [40, 18], angle_deg: 0, hauteur_m: 9, etages: 2, toit: "croupe", couverture: "ardoise", facade: "enduit", teinte: "#EDE6D6", params: { pente: 40 } }),
        building({ id: "ecuries-du-quartier-general", nom: "Écuries du quartier général", canon: "A", archetype: "ecurie", position: c(0, 0), emprise_m: [56, 20], angle_deg: 0, hauteur_m: 8, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_brute", teinte: "#B9A37F", params: { pente: 38 } }),
        building({ id: "magasin-de-munitions", nom: "Magasin de munitions", canon: "A", archetype: "arsenal", position: c(1, 0), emprise_m: [46, 22], angle_deg: 0, hauteur_m: 9, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#BFB6A4", params: { pente: 36 } }),
        building({ id: "remise-des-canons", nom: "Remise des canons de rempart", canon: "A", archetype: "entrepot", position: c(2, 0), emprise_m: [60, 22], angle_deg: 0, hauteur_m: 9, etages: 1, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#C3B79F", params: { pente: 34 }, reperes_canon: ["canons de rempart sur rails à Trost [C] (fichier 20, Q11) : la remise est une adaptation ; les rails ne sont pas modélisés"] }),
        building({ id: "corps-de-garde-de-la-grille", nom: "Corps de garde de la grille d'honneur", canon: "A", archetype: "caserne", position: pt(-70, 152), emprise_m: [24, 12], angle_deg: 0, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { pente: 40 } }),
      ];
    },
    vegetation(ctx, parcs) {
      void ctx;
      return {
        alignements: [{ rue: `s-${S.findIndex(([v]) => v === sv(2))}`, essence: "tilleul", intervalle_m: 12, cotes: "deux" }],
        isoles: [
          { position: pt(0, 60), essence: "tilleul", hauteur_m: 20, nom: "Tilleul de la cour d'honneur" },
          { position: pt(60, 120), essence: "marronnier", hauteur_m: 17 },
        ],
        parcs,
        vergers: [],
        haies: [{ trace: pts([[-150, 165], [150, 165]]) }],
        potagers: [],
        essences_cours: ["tilleul", "marronnier", "erable"],
      };
    },
    eau: () => ({ voies: [], ponts: [], puits: pts([[-90, -100], [90, 90]]), fontaines: [] }),
    points_de_vue() {
      return [
        { id: "cour-d-honneur", nom: "Cour d'honneur et bâtiment principal", oeil: [0, -90, 3], cible: [0, 99, 10], fov: 62 },
        { id: "facade-sud", nom: "Façade sud sur la place de la Porte Sud", oeil: [90, 215, 3], cible: [0, 110, 8], fov: 60 },
        { id: "ecuries-et-remises", nom: "Écuries, magasin et remise des canons", oeil: [-60, -30, 3.5], cible: [20, -100, 6], fov: 60 },
        { id: "casernement", nom: "Casernement de la garde", oeil: [-30, 60, 3], cible: [90, 0, 6], fov: 60 },
      ];
    },
    etats() {
      const etats: Place["etats"] = [
        { id: "845-avant", nom: "845, le quartier général en temps ordinaire", date: "845", canon: "A", sources: [{ ref: "état ordinaire du complexe ; garnison de 2 500 soldats à Trost (data/scenarios/sandbox_845.json)", canon: "A" }], portes: {}, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 1 },
        {
          id: "850-alerte",
          nom: "850, alerte de la brèche de Trost",
          date: "850",
          canon: "A",
          sources: [
            { ref: "docs/spec/01 (850 : Trost, 104e promotion) et atlas 06 W05 : brèche de la porte sud de Trost [C] ; ce que devient le quartier général pendant la bataille : adaptation", canon: "A" },
            { ref: "fumée de la place de la Porte Sud, affluence : adaptation (pas de destruction du complexe)", canon: "A" },
          ],
          portes: {},
          ruines: [],
          incendies: pts([[40, 215]]),
          rochers: [],
          abandon: 0,
          ciel: "enfume",
          habitants: 1,
        },
      ];
      return etats;
    },
  });
}
