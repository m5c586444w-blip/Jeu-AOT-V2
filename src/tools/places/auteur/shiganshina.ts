import type { Block, Building, Gabarit, Gate, Place, Street } from "../../../data/placeSchema";
import type { P2 } from "../../../render/tactical3d/places/geom";
import { area, centroid, dist, polylineDist } from "../../../render/tactical3d/places/geom";
import { insetBy, outsideStrip, polar, pt, r1, radialCells, ringLine, roundPoly, touchesSegment } from "./kit";
import type { Cell } from "./kit";

/**
 * Shiganshina (R1e.4) — plan d'auteur. Ce qui est établi [C] : district sud du mur Maria, bâti dans une saillie du mur, porte
 * extérieure et porte intérieure (fichiers 01, 11, ERRATA ; manga, chap. 1–2) ; maison des Jaeger, le Dr Jaeger médecin du
 * district, Armin y habite ; la porte extérieure brisée par le Titan Colossal et la porte intérieure par le Cuirassé en 845 ;
 * la reprise en 850. Tout le reste est une adaptation [A] (tracé, noms de rues, dimensions, quartiers) ou incertain [?]
 * (épaisseur du mur, voie d'eau, état des portes en 850 : `docs/lore/questions-ouvertes.md`).
 *
 * Parti d'auteur [A] : une saillie en demi-cercle de 1 350 m de rayon (ligne médiane du mur), dont la surface vient de la
 * population de la simulation (60 870 habitants ÷ 230 hab/ha). Plan rayonnant et concentrique (inspiration : Nördlingen,
 * `docs/places/shiganshina/inspirations.md`) : des anneaux de rues tous les 76 m et des rues rayonnantes qui convergent vers la
 * porte intérieure, de plus en plus serrées vers le rempart ; la Grand-Rue relie en ligne droite la porte intérieure à la porte
 * extérieure ; place centrale et église à mi-chemin, marché devant la porte extérieure, canal et entrepôts à l'est, quartier
 * ouvrier à l'ouest, garnison près de la porte extérieure, faubourg au nord de la porte intérieure.
 */
export const R = 1350;
const RING_STEP = 76;
/** Anneaux de rues (rayons, m) ; le dernier est le chemin du rempart, au pied du glacis. */
export const RINGS = [110, 186, 262, 338, 414, 490, 566, 642, 718, 794, 870, 946, 1022, 1098, 1174, 1250, 1325];
const RAMPART_R = 1325;
/** Rue du Mur, le long du mur Maria côté district (y), et bord des îlots. */
const MUR_Y = 25;

/** Angles des rues rayonnantes par bande (chaque bande reprend ceux de la précédente) : choix d'auteur, légers décalages. */
const BAND_A = [0, 30, 60, 90, 120, 150, 180];
const BAND_B = [0, 15, 30, 44, 60, 75, 90, 105, 120, 136, 150, 165, 180];
const BAND_C = [0, 7.5, 15, 22, 30, 37.5, 44, 52, 60, 67.5, 75, 82, 90, 98, 105, 112.5, 120, 128, 136, 143, 150, 157.5, 165, 172.5, 180];
const BAND_D = [0, 3.5, 7.5, 11, 15, 18.5, 22, 26, 30, 34, 37.5, 41, 44, 48, 52, 56, 60, 64, 67.5, 71, 75, 78.5, 82, 86, 90, 94, 98, 101.5, 105, 109, 112.5, 116, 120, 124, 128, 132, 136, 139.5, 143, 147, 150, 154, 157.5, 161, 165, 168.5, 172.5, 176, 180];
const anglesFor = (r0: number): readonly number[] => (r0 < 262 ? BAND_A : r0 < 490 ? BAND_B : r0 < 946 ? BAND_C : BAND_D);
const bandOf = (a: number): number => (BAND_A.includes(a) ? 0 : BAND_B.includes(a) ? 1 : BAND_C.includes(a) ? 2 : 3);
const startOf = (a: number): number => [RINGS[0], 262, 490, 946][bandOf(a)] as number;

/** Largeurs (m) : Grand-Rue, rayonnantes par bande, anneaux. */
const MAIN_W = 18;
const radialW = (a: number): number => (a === 90 ? MAIN_W : [11, 9, 7, 5][bandOf(a)] as number);
const ringW = (r: number): number => (r === RAMPART_R ? 10 : r === 566 || r === 642 || r === 110 ? 10 : r <= 490 ? 9 : 8);

/** Canal [A] (Q9) : de la porte de rivière de la saillie (52°) à celle du mur Maria (x = 470), en droite ligne. */
export const CANAL_A: [number, number] = [470, 0];
export const CANAL_B: [number, number] = polar(R, 52);
const CANAL_W = 16;
const QUAY_W = 7;

// ——— Noms de rues [A] (aucun nom canon connu) ———
const RING_NAMES: Record<number, [string, string]> = {
  110: ["Rue du Parvis", "Rue du Parvis"],
  186: ["Rue des Orfèvres", "Rue des Chaudronniers"],
  262: ["Rue Haute", "Rue Haute"],
  338: ["Rue des Drapiers", "Rue des Cardeurs"],
  414: ["Rue des Tisserands", "Rue des Fileuses"],
  490: ["Rue des Chandeliers", "Rue des Vanniers"],
  566: ["Rue de la Place", "Rue de la Place"],
  642: ["Rue de l'Église", "Rue des Jardins"],
  718: ["Rue des Boulangers", "Rue des Meuniers"],
  794: ["Rue des Charrons", "Rue du Puits"],
  870: ["Rue des Potiers", "Rue des Lavandières"],
  946: ["Rue des Tanneurs", "Rue des Teinturiers"],
  1022: ["Rue des Cordiers", "Rue des Tonneliers"],
  1098: ["Rue du Marché", "Rue du Marché"],
  1174: ["Rue des Halles", "Rue des Forgerons"],
  1250: ["Rue Basse", "Rue des Remparts"],
  1325: ["Chemin du Rempart", "Chemin du Rempart"],
};
const RADIAL_NAMES = [
  "Rue du Levant", "Rue des Bateliers", "Rue du Pont-Neuf", "Rue des Écluses", "Rue des Moulins", "Rue de la Clinique", "Rue des Pharmaciens", "Rue de la Fontaine",
  "Rue du Couchant", "Rue des Fondeurs", "Rue de la Garnison", "Rue des Écuries", "Rue des Selliers", "Rue des Maréchaux", "Rue des Briquetiers", "Rue des Charpentiers",
  "Rue des Menuisiers", "Rue des Tuiliers", "Rue des Couvreurs", "Rue des Barbiers", "Rue des Bouchers", "Rue des Fromagers", "Rue des Épiciers", "Rue des Merciers",
];
const LANE_NAMES = ["Ruelle des Chats", "Ruelle du Four", "Ruelle de l'Âne", "Ruelle des Lilas", "Ruelle du Lavoir", "Ruelle Étroite", "Ruelle des Pigeons", "Ruelle du Grenier", "Ruelle des Seaux", "Ruelle de la Corde", "Ruelle du Coq", "Ruelle des Escaliers"];

// ——— Gabarits (choisis par quartier) ———
const T_CORE = ["#EFE4CC", "#E9D3B0", "#F1DCCB", "#E2E0CF", "#EADFC2", "#D9C6A2", "#F2E8D6", "#E7CDB8", "#DCD8C4", "#E9D9BB", "#F0D9C2"];
const GABARITS: Record<string, Gabarit> = {
  vieux_centre: { etages: [3, 4, 3, 4, 5, 3, 4], hauteur_etage_m: 3, toits: ["pignon_rue", "pignon_rue", "pignon", "pignon_rue", "demi_croupe", "pignon_rue", "croupe"], pente_deg: [50, 60], couvertures: ["tuile_plate", "tuile_plate", "tuile_plate", "ardoise", "tuile_plate", "bardeau"], facades: ["colombage", "enduit", "colombage", "colombage", "enduit", "pierre_taillee", "colombage"], teintes: T_CORE, parcelles_m: [6.5, 7.5, 6, 8.5, 7, 9, 6.5, 8], profondeur_m: 13, boutiques: true, passage_m: 45, cour: { type: "plantee", arbres_par_ha: 80 } },
  bourgeois: { etages: [3, 4, 4, 3, 5], hauteur_etage_m: 3.3, toits: ["croupe", "mansarde", "pignon", "croupe", "demi_croupe"], pente_deg: [42, 55], couvertures: ["ardoise", "tuile_plate", "ardoise", "tuile_plate"], facades: ["pierre_taillee", "enduit", "enduit", "pierre_taillee", "brique"], teintes: ["#EDE6D6", "#E6DCC6", "#F0E9DD", "#DCD3C0", "#E9DFCD", "#D8CDB8", "#EFE3D0"], parcelles_m: [10, 12, 9, 14, 11, 13], profondeur_m: 14, boutiques: false, passage_m: 60, cour: { type: "plantee", arbres_par_ha: 95 } },
  marchand: { etages: [3, 3, 4, 2, 3, 4], hauteur_etage_m: 3.1, toits: ["pignon_rue", "pignon", "pignon_rue", "croupe", "pignon_rue"], pente_deg: [45, 58], couvertures: ["tuile_plate", "tuile_canal", "tuile_plate", "bardeau", "ardoise"], facades: ["enduit", "colombage", "enduit", "bois", "enduit", "colombage"], teintes: ["#EAD7B6", "#E3CFAE", "#EFE0C6", "#DCC7A4", "#E8D2BC", "#F1E3CB"], parcelles_m: [7, 8, 6.5, 9, 7.5, 10], profondeur_m: 12, boutiques: true, passage_m: 40, cour: { type: "plantee", arbres_par_ha: 70 } },
  ouvrier: { etages: [2, 3, 2, 2, 3], hauteur_etage_m: 2.8, toits: ["pignon", "pignon", "appentis", "pignon_rue", "pignon"], pente_deg: [38, 50], couvertures: ["tuile_canal", "tuile_plate", "bardeau", "tuile_canal", "chaume"], facades: ["enduit", "bois", "enduit", "pierre_brute", "colombage"], teintes: ["#D9CCB2", "#CFC2A6", "#E0D4BC", "#C9BBA0", "#D4C7AE", "#DDCFB5"], parcelles_m: [5.5, 6, 5, 6.5, 5.5, 7], profondeur_m: 10, boutiques: false, passage_m: 30, cour: { type: "jardin", arbres_par_ha: 110 } },
  artisans: { etages: [2, 3, 3, 2], hauteur_etage_m: 3, toits: ["pignon_rue", "pignon", "demi_croupe", "pignon"], pente_deg: [44, 56], couvertures: ["tuile_plate", "bardeau", "tuile_canal", "tuile_plate"], facades: ["colombage", "enduit", "bois", "colombage", "pierre_brute"], teintes: ["#E5D6BA", "#DCCCAE", "#EADCC5", "#D6C6A8", "#E9D2B4"], parcelles_m: [7, 8, 6, 9, 7.5], profondeur_m: 11, boutiques: true, passage_m: 35, cour: { type: "jardin", arbres_par_ha: 95 } },
  entrepots: { etages: [2, 3, 2], hauteur_etage_m: 3.6, toits: ["croupe", "pignon", "croupe"], pente_deg: [30, 40], couvertures: ["tuile_canal", "ardoise", "tuile_plate"], facades: ["pierre_brute", "brique", "bois"], teintes: ["#D6CBB6", "#C9B79E", "#BFB4A2"], parcelles_m: [18, 22, 16, 24], profondeur_m: 16, boutiques: false, passage_m: 50, cour: { type: "pavee", arbres_par_ha: 30 } },
  garnison: { etages: [2, 3], hauteur_etage_m: 3.4, toits: ["croupe", "pignon"], pente_deg: [35, 45], couvertures: ["ardoise", "tuile_plate"], facades: ["pierre_taillee", "pierre_brute"], teintes: ["#D9D3C6", "#CFC8B9"], parcelles_m: [14, 18, 12], profondeur_m: 12, boutiques: false, passage_m: 0, cour: { type: "pavee", arbres_par_ha: 25 } },
  faubourg: { etages: [1, 2, 1, 2, 1], hauteur_etage_m: 2.8, toits: ["pignon", "croupe", "pignon", "demi_croupe"], pente_deg: [42, 55], couvertures: ["chaume", "bardeau", "chaume", "tuile_canal", "tuile_plate"], facades: ["bois", "colombage", "enduit", "pierre_brute"], teintes: ["#D8CCB4", "#CDBF9F", "#E2D6BF", "#C7B898", "#D9C9AA"], parcelles_m: [11, 14, 9, 16, 12], profondeur_m: 10, boutiques: false, passage_m: 0, cour: { type: "jardin", arbres_par_ha: 45 } },
};

// ——— Quartiers : par secteur (angle, rayon) ———
interface Quarter {
  id: string;
  nom: string;
  gabarit: string;
  fonction: Block["fonction"];
  densite: number;
}
const Q = (id: string, nom: string, gabarit: string, fonction: Block["fonction"], densite = 1): Quarter => ({ id, nom, gabarit, fonction, densite });
const QUARTERS = {
  vieille: Q("vieille-ville", "Vieille ville", "vieux_centre", "habitation"),
  bourgeois: Q("quartier-bourgeois", "Quartier des négociants", "bourgeois", "habitation", 0.95),
  marchand: Q("quartier-marchand", "Quartier du marché", "marchand", "marche"),
  ouvrier: Q("quartier-ouvrier", "Quartier ouvrier", "ouvrier", "habitation"),
  artisans: Q("quartier-artisans", "Quartier des artisans", "artisans", "atelier"),
  canal: Q("quartier-canal", "Quartier du canal (entrepôts)", "entrepots", "entrepot", 0.9),
  garnison: Q("quartier-garnison", "Quartier de la garnison", "garnison", "caserne", 0.8),
  faubourg: Q("faubourg", "Faubourg de la porte intérieure", "faubourg", "habitation", 0.6),
};

function quarterOf(c: Cell, mid: P2): Quarter {
  const a = (c.a0 + c.a1) / 2;
  const r = (c.r0 + c.r1) / 2;
  if (polylineDist(mid, [CANAL_A, CANAL_B]) < 90) return QUARTERS.canal;
  if (r < 490) return QUARTERS.vieille;
  if (a >= 98 && a <= 120 && r >= 1022) return QUARTERS.garnison;
  if (a >= 68 && a <= 112 && r >= 870) return QUARTERS.marchand;
  if (a >= 124) return QUARTERS.ouvrier;
  if (a <= 66 && r >= 946) return QUARTERS.artisans;
  if (a <= 70) return QUARTERS.bourgeois;
  return QUARTERS.vieille;
}

const inRange = (c: Cell, a0: number, a1: number, r0: number): boolean => c.a0 === a0 && c.a1 === a1 && c.r0 === r0;

export function shiganshina(): Place {
  const rues: Street[] = [];
  // Rayonnantes : chaque angle (sauf 0 et 180, sur le mur) de son anneau de départ au chemin du rempart.
  let radialName = 0;
  let laneName = 0;
  const allAngles = [...new Set([...BAND_A, ...BAND_B, ...BAND_C, ...BAND_D])].filter((a) => a > 0 && a < 180).sort((x, y) => x - y);
  for (const a of allAngles) {
    if (a === 90) continue;
    const w = radialW(a);
    const lane = w <= 5;
    const nom = lane ? (LANE_NAMES[laneName++ % LANE_NAMES.length] as string) : (RADIAL_NAMES[radialName++ % RADIAL_NAMES.length] as string);
    const s = Math.max(startOf(a), 0);
    rues.push({ id: `rayon-${String(a).replace(".", "-")}`, nom, canon: "A", type: lane ? "ruelle" : "rue", trace: [polar(s, a), polar(RAMPART_R, a)], largeur_m: w, revetement: lane ? "terre" : "paves" });
  }
  // Grand-Rue : de la porte intérieure à la porte extérieure.
  rues.push({ id: "grand-rue", nom: "Grand-Rue", canon: "A", type: "principale", trace: [pt(0, 12), pt(0, R - 8)], largeur_m: MAIN_W, revetement: "paves" });
  // Anneaux : deux moitiés (est, ouest de la Grand-Rue), sommets aux angles de la bande la plus fine qui les touche.
  for (const r of RINGS) {
    const fine = anglesFor(r === RAMPART_R ? 1250 : r);
    const as = [...new Set([...fine, ...anglesFor(Math.max(110, r - RING_STEP))])].sort((x, y) => x - y);
    const names = RING_NAMES[r] as [string, string];
    const east = as.filter((a) => a <= 90);
    const west = as.filter((a) => a >= 90);
    // Les anneaux commencent sur la rue du Mur (y = 25) : angle de départ relevé d'autant.
    const lift = (Math.asin(Math.min(1, MUR_Y / r)) * 180) / Math.PI;
    const clip = (xs: number[], lo: number, hi: number): number[] => [lo, ...xs.filter((a) => a > lo && a < hi), hi];
    const ring = r === RAMPART_R;
    rues.push({ id: `anneau-${r}-est`, nom: names[0], canon: "A", type: ring ? "rue" : "rue", trace: ringLine(r, clip(east, lift, 90)), largeur_m: ringW(r), revetement: ring ? "gravier" : "paves" });
    rues.push({ id: `anneau-${r}-ouest`, nom: names[1], canon: "A", type: "rue", trace: ringLine(r, clip(west, 90, 180 - lift)), largeur_m: ringW(r), revetement: ring ? "gravier" : "paves" });
  }
  // Rue du Mur, le long du mur Maria côté district.
  rues.push({ id: "rue-du-mur", nom: "Rue du Mur", canon: "A", type: "rue", trace: [pt(-RAMPART_R, MUR_Y), pt(RAMPART_R, MUR_Y)], largeur_m: 10, revetement: "paves" });
  // Quais du canal (de part et d'autre de l'eau).
  const cd = [CANAL_B[0] - CANAL_A[0], CANAL_B[1] - CANAL_A[1]];
  const cl = Math.hypot(cd[0] as number, cd[1] as number);
  const cn: P2 = [-(cd[1] as number) / cl, (cd[0] as number) / cl];
  const quayOff = CANAL_W / 2 + QUAY_W / 2;
  const qA = (s: number): [number, number] => pt(CANAL_A[0] + cn[0] * s, CANAL_A[1] + cn[1] * s + 31);
  const qB = (s: number): [number, number] => pt(CANAL_B[0] + cn[0] * s - (cd[0] as number) / cl * 30, CANAL_B[1] + cn[1] * s - (cd[1] as number) / cl * 30);
  rues.push({ id: "quai-ouest", nom: "Quai des Bateliers", canon: "A", type: "quai", trace: [qA(-quayOff), qB(-quayOff)], largeur_m: QUAY_W, revetement: "dalles" });
  rues.push({ id: "quai-est", nom: "Quai des Sauniers", canon: "A", type: "quai", trace: [qA(quayOff), qB(quayOff)], largeur_m: QUAY_W, revetement: "dalles" });

  // ——— Îlots : cellules entre anneaux et rayonnantes, retranchées des rues, découpées par le canal ———
  const ringIndex = new Map(RINGS.map((r, i) => [r, i] as const));
  const dOf = (a: P2, b: P2): number => {
    const ra = Math.hypot(a[0], a[1]);
    const rb = Math.hypot(b[0], b[1]);
    const aa = (Math.atan2(a[1], a[0]) * 180) / Math.PI;
    const ab = (Math.atan2(b[1], b[0]) * 180) / Math.PI;
    if (Math.abs(aa - ab) < 0.05) return radialW(Math.round(aa * 2) / 2) / 2 + 1.2;
    const rr = (ra + rb) / 2;
    const ring = RINGS.reduce((best, r) => (Math.abs(r - rr) < Math.abs(best - rr) ? r : best), RINGS[0] as number);
    return ringW(ring) / 2 + 1.2;
  };
  void ringIndex;
  const cells = radialCells(RINGS, anglesFor);
  const ilots: Block[] = [];
  const places: Place["places_publiques"] = [];
  const parcs: Place["vegetation"]["parcs"] = [];
  let placette = 0;
  const PLACETTES = ["Place aux Herbes", "Place du Puits", "Placette des Tanneurs", "Place du Pilori", "Placette des Lilas", "Place de la Fontaine-Ronde", "Placette du Four", "Place des Cordiers"];
  for (const c of cells) {
    const mid = centroid(c.poly);
    // Bord nord : rue du Mur.
    let poly: [number, number][] = insetBy(c.poly, dOf);
    poly = poly.length >= 3 ? (poly.filter(() => true) as [number, number][]) : poly;
    if (poly.length < 3) continue;
    const yCut = MUR_Y + 5 + 1.2;
    if (Math.min(...poly.map((q) => q[1])) < yCut) {
      poly = poly.filter((q) => q[1] >= yCut - 1e6) as [number, number][];
      const clipped: [number, number][] = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i] as [number, number];
        const q = poly[(i + 1) % poly.length] as [number, number];
        if (p[1] >= yCut) clipped.push(p);
        if (p[1] >= yCut !== q[1] >= yCut) {
          const t = (yCut - p[1]) / (q[1] - p[1]);
          clipped.push([p[0] + (q[0] - p[0]) * t, yCut]);
        }
      }
      poly = clipped;
      if (poly.length < 3 || area(poly) < 400) continue;
    }
    // Place centrale, marché, jardins, église, caserne : cellules d'auteur.
    if (c.r0 === 566 && (inRange(c, 82, 90, 566) || inRange(c, 90, 98, 566))) continue;
    if (c.r0 === 1098 && (inRange(c, 86, 90, 1098) || inRange(c, 90, 94, 1098))) continue;
    if (inRange(c, 98, 105, 566)) {
      parcs.push({ id: "jardin-des-tilleuls", nom: "Jardin des Tilleuls", canon: "A", polygone: roundPoly(poly), essences: ["tilleul", "marronnier", "erable"], arbres_par_ha: 70 });
      continue;
    }
    if (inRange(c, 75, 82, 642)) {
      parcs.push({ id: "enclos-de-l-eglise", nom: "Enclos de l'église", canon: "A", polygone: roundPoly(poly), essences: ["tilleul", "chene", "bouleau"], arbres_par_ha: 55 });
      continue;
    }
    if (inRange(c, 161, 165, 1174) || inRange(c, 15, 18.5, 1174)) {
      parcs.push({ id: c.a0 > 90 ? "verger-du-rempart-ouest" : "verger-du-rempart-est", nom: c.a0 > 90 ? "Verger du Rempart (ouest)" : "Verger du Rempart (est)", canon: "A", polygone: roundPoly(poly), essences: ["fruitier", "fruitier", "tilleul"], arbres_par_ha: 90 });
      continue;
    }
    // Canal : l'îlot est coupé par l'eau et ses quais.
    const pieces = touchesSegment(poly, CANAL_A, CANAL_B, CANAL_W / 2 + QUAY_W + 2) ? outsideStrip(poly, CANAL_A, CANAL_B, CANAL_W / 2 + QUAY_W + 1.2) : [poly];
    pieces.forEach((pc, k) => {
      if (area(pc) < 500) return;
      const q = quarterOf(c, mid);
      const id = `i-${c.r0}-${String(c.a0).replace(".", "-")}${pieces.length > 1 ? `-${k}` : ""}`;
      const isChurch = inRange(c, 75, 82, 566);
      const isBarracks = inRange(c, 101.5, 105, 1174) || inRange(c, 105, 109, 1174);
      // Placettes : une demi-cellule de la bande extérieure sur onze devient une petite place pavée (< 0,5 ha).
      if (!isChurch && !isBarracks && c.r0 >= 718 && pieces.length === 1 && (Math.round(c.a0 * 2) + c.r0) % 11 === 3 && placette < PLACETTES.length) {
        const v = pc as P2[];
        const mid2 = (a: P2, b: P2): P2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const half: P2[] = v.length === 4 ? [v[0] as P2, v[1] as P2, mid2(v[1] as P2, v[2] as P2), mid2(v[0] as P2, v[3] as P2)] : v;
        const rest: P2[] | null = v.length === 4 ? [half[3] as P2, half[2] as P2, v[2] as P2, v[3] as P2] : null;
        const hp = roundPoly(half);
        if (area(hp) < 5000) {
          places.push({ id: `placette-${placette}`, nom: PLACETTES[placette] as string, canon: "A", polygone: hp, revetement: "paves", fontaine: placette % 2 ? centroid(hp) : null, marche: false });
          placette++;
          if (rest) ilots.push({ id, quartier: q.id, fonction: q.fonction, polygone: roundPoly(rest), densite_bati: q.densite, gabarit: q.gabarit });
          return;
        }
      }
      ilots.push({ id, quartier: isBarracks ? QUARTERS.garnison.id : q.id, fonction: isChurch ? "culte" : isBarracks ? "caserne" : q.fonction, polygone: roundPoly(pc), densite_bati: isChurch ? 0.6 : isBarracks ? 0.45 : q.densite, gabarit: isBarracks ? "garnison" : q.gabarit });
    });
  }

  // ——— Places ———
  const parvis: [number, number][] = [];
  for (let a = 180; a >= 0; a -= 10) {
    const p = polar(110 - ringW(110) / 2 - 1.2, a);
    parvis.push([p[0], Math.max(MUR_Y + 6, p[1])]);
  }
  places.push({ id: "parvis-porte-interieure", nom: "Parvis de la Porte intérieure", canon: "A", polygone: roundPoly(parvis.filter((p, i, arr) => i === 0 || dist(p, arr[i - 1] as P2) > 0.5)), revetement: "dalles", fontaine: null, marche: false });
  const sq = (r0: number, r1: number, a0: number, a1: number): [number, number][] => roundPoly([polar(r0 + ringW(r0) / 2 + 1, a0 + 0.6), polar(r0 + ringW(r0) / 2 + 1, a1 - 0.6), polar(r1 - ringW(r1) / 2 - 1, a1 - 0.6), polar(r1 - ringW(r1) / 2 - 1, a0 + 0.6)]);
  places.push({ id: "place-centrale", nom: "Place Centrale", canon: "A", polygone: sq(566, 642, 82, 98), revetement: "dalles", fontaine: pt(-30, 604), marche: false });
  places.push({ id: "place-du-marche", nom: "Place du Marché", canon: "A", polygone: sq(1098, 1174, 86, 94), revetement: "paves", fontaine: pt(-45, 1136), marche: true });

  // ——— Faubourg (zone annexe), au nord de la porte intérieure ———
  const FX = [-420, -210, 0, 210, 420];
  const FY = [-30, -150, -280, -410, -530];
  rues.push({ id: "route-de-maria", nom: "Route de Maria", canon: "A", type: "route", trace: [pt(0, -14), pt(0, -1740)], largeur_m: 12, revetement: "gravier" });
  for (const x of [-210, 210]) rues.push({ id: `ruelle-faubourg-${x < 0 ? "ouest" : "est"}`, nom: x < 0 ? "Chemin des Jardins" : "Chemin du Lavoir", canon: "A", type: "chemin", trace: [pt(x, -30), pt(x, -530)], largeur_m: 6, revetement: "terre" });
  ["Chemin des Vergers", "Chemin du Moulin", "Chemin des Haies"].forEach((nom, i) => rues.push({ id: `chemin-faubourg-${i}`, nom, canon: "A", type: "chemin", trace: [pt(-420, FY[i + 1] as number), pt(420, FY[i + 1] as number)], largeur_m: 7, revetement: "terre" }));
  rues.push({ id: "chemin-du-glacis-nord", nom: "Chemin du Glacis", canon: "A", type: "chemin", trace: [pt(-420, -30), pt(420, -30)], largeur_m: 7, revetement: "terre" });
  for (let i = 0; i + 1 < FX.length; i++) {
    for (let j = 0; j + 1 < FY.length; j++) {
      const x0 = (FX[i] as number) + (FX[i] === 0 ? 7 : 4.2);
      const x1 = (FX[i + 1] as number) - (FX[i + 1] === 0 ? 7 : 4.2);
      const y0 = (FY[j] as number) - 4.7;
      const y1 = (FY[j + 1] as number) + 4.7;
      ilots.push({ id: `f-${i}-${j}`, quartier: QUARTERS.faubourg.id, zone: "faubourg", fonction: "habitation", polygone: [pt(x0, y1), pt(x1, y1), pt(x1, y0), pt(x0, y0)], densite_bati: QUARTERS.faubourg.densite, gabarit: "faubourg" });
    }
  }
  // Route du sud, hors de la porte extérieure.
  rues.push({ id: "route-du-sud", nom: "Route du Sud", canon: "A", type: "route", trace: [pt(0, R + 10), pt(0, 1740)], largeur_m: 10, revetement: "terre" });

  // ——— Bâtiments repères ———
  const b = (o: Omit<Building, "reperes_canon"> & { reperes_canon?: string[] }): Building => ({ reperes_canon: [], ...o });
  const batiments: Building[] = [
    b({ id: "eglise", nom: "Église du district", canon: "A", archetype: "eglise", position: polar(604, 78.6), emprise_m: [22, 46], angle_deg: -11.4, hauteur_m: 19, etages: 1, toit: "pignon", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E4DDCF", params: { clocher_m: 54, clocher_cote: 9, abside: true, pente: 52 }, sources: [{ ref: "aucune (édifice religieux adapté)", canon: "A" }] }),
    b({ id: "halle", nom: "Halle aux grains", canon: "A", archetype: "halle", position: pt(52, 1136), emprise_m: [42, 22], angle_deg: 0, hauteur_m: 11, etages: 1, toit: "croupe", couverture: "tuile_plate", facade: "bois", teinte: "#C9B08C", params: { piliers: 8, pente: 40 } }),
    b({ id: "caserne", nom: "Caserne de la Garnison", canon: "A", archetype: "caserne", position: polar(1212, 105.2), emprise_m: [64, 44], angle_deg: 15.2, hauteur_m: 11, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#D8D2C5", params: { cour: true, pente: 38 }, reperes_canon: ["Garnison (Brigade stationnaire) : présence établie, bâtiment adapté"], sources: [{ ref: "docs/spec/01 et 11 (Garnison aux portes)", canon: "C" }] }),
    b({ id: "maison-jaeger", nom: "Maison des Jaeger", canon: "C", archetype: "maison", position: polar(806, 100.6), emprise_m: [9.5, 11], angle_deg: 10.6, hauteur_m: 6.4, etages: 2, toit: "pignon", couverture: "tuile_plate", facade: "enduit", teinte: "#E8DCC4", params: { cave: true, pente: 48 }, reperes_canon: ["maison de la famille Jaeger (existence C ; position A, Q6)", "sous-sol de Grisha (C)"], sources: [{ ref: "Manga, chap. 1–2 (an 845)", canon: "C" }, { ref: "position : aucune (Q6)", canon: "A" }] }),
    b({ id: "clinique-jaeger", nom: "Cabinet du Dr Jaeger", canon: "C", archetype: "clinique", position: polar(653, 94.6), emprise_m: [11, 10], angle_deg: 4.6, hauteur_m: 7.2, etages: 2, toit: "croupe", couverture: "tuile_plate", facade: "enduit", teinte: "#EFE6D4", params: { pente: 45 }, reperes_canon: ["Grisha Jaeger, médecin du district (C) ; cabinet : position A (Q6)"], sources: [{ ref: "Manga, chap. 1 (Grisha médecin)", canon: "C" }, { ref: "position : aucune (Q6)", canon: "A" }] }),
    b({ id: "maison-arlert", nom: "Maison d'Armin Arlert", canon: "C", archetype: "maison", position: polar(732, 63.6), emprise_m: [8, 10], angle_deg: -26.4, hauteur_m: 6, etages: 2, toit: "pignon", couverture: "tuile_canal", facade: "colombage", teinte: "#E6D9C0", params: { pente: 46 }, reperes_canon: ["Armin et son grand-père vivent à Shiganshina (C) ; position A (Q6)"], sources: [{ ref: "Manga, chap. 1–2", canon: "C" }, { ref: "position : aucune (Q6)", canon: "A" }] }),
    b({ id: "maison-commune", nom: "Maison commune", canon: "A", archetype: "hotel_de_ville", position: polar(536, 90), emprise_m: [30, 18], angle_deg: 0, hauteur_m: 14, etages: 3, toit: "croupe", couverture: "ardoise", facade: "pierre_taillee", teinte: "#E8E1D2", params: { pente: 48 } }),
    b({ id: "poste-porte-exterieure", nom: "Poste de garde de la porte extérieure", canon: "A", archetype: "caserne", position: polar(1262, 96.5), emprise_m: [26, 12], angle_deg: 6.5, hauteur_m: 7, etages: 2, toit: "croupe", couverture: "ardoise", facade: "pierre_brute", teinte: "#D2CBBE", params: { pente: 40 } }),
    b({ id: "moulin-du-canal", nom: "Moulin du canal", canon: "A", archetype: "moulin", position: pt(611.4, 470), emprise_m: [14, 18], angle_deg: 71.3, hauteur_m: 9, etages: 2, toit: "pignon", couverture: "bardeau", facade: "pierre_brute", teinte: "#CFC6B4", params: { roue: true, pente: 45 } }),
  ];
  void r1;

  // ——— Murailles et portes ———
  const sArc = (deg: number): number => r1((R * deg * Math.PI) / 180);
  const gate = (o: Partial<Gate> & Pick<Gate, "id" | "nom" | "role" | "trace" | "s_m">): Gate => ({
    canon: "C",
    sources: [{ ref: "docs/spec/11 et ERRATA : saillie avec porte extérieure et porte intérieure", canon: "C" }, { ref: "dimensions et mécanisme : aucune (Q5)", canon: "A" }],
    passage: { largeur_m: 14, hauteur_m: 20, voute: "plein_cintre", trous_assassin: 8, rainures: true, canon: "A" },
    vantail: { type: "levant", largeur_m: 15, hauteur_m: 20, epaisseur_m: 1.2, materiau: "chene_ferre", canon: "A" },
    structure: { huisserie: true, gonds: 0, treuils: 2, contrepoids: 2, herse: false, canon: "A" },
    tours: [],
    portail: "bossage",
    etat: "intacte",
    ...o,
  });
  const portes: Gate[] = [
    gate({ id: "exterieure", nom: "Porte extérieure", role: "exterieure", trace: "saillie", s_m: sArc(90), tours: [
      { type: "maison_du_treuil", cote: "dessus", hauteur_m: 7, canon: "A" },
      { type: "tourelle", cote: "gauche", hauteur_m: 10, canon: "A" },
      { type: "tourelle", cote: "droite", hauteur_m: 10, canon: "A" },
    ] }),
    gate({
      id: "interieure",
      nom: "Porte intérieure",
      role: "interieure",
      trace: "maria-centre",
      s_m: R,
      passage: { largeur_m: 12, hauteur_m: 17, voute: "plein_cintre", trous_assassin: 4, rainures: true, canon: "A" },
      vantail: { type: "battants", largeur_m: 12.4, hauteur_m: 16, epaisseur_m: 0.8, materiau: "chene_ferre", canon: "A" },
      structure: { huisserie: true, gonds: 4, treuils: 1, contrepoids: 0, herse: true, canon: "A" },
      tours: [
        { type: "poste_de_garde", cote: "gauche", hauteur_m: 6, canon: "A" },
        { type: "poste_de_garde", cote: "droite", hauteur_m: 6, canon: "A" },
        { type: "maison_du_treuil", cote: "dessus", hauteur_m: 5, canon: "A" },
      ],
      portail: "pilastres",
    }),
    gate({
      id: "riviere-saillie",
      nom: "Porte de rivière de la saillie",
      role: "riviere",
      canon: "A",
      sources: [{ ref: "consigne R1e §5 ; annexe R1c (extraits non officiels de l'anime) — Q9", canon: "A" }],
      trace: "saillie",
      s_m: sArc(52),
      passage: { largeur_m: 18, hauteur_m: 11, voute: "surbaisse", trous_assassin: 0, rainures: true, canon: "A" },
      vantail: { type: "herse", largeur_m: 18, hauteur_m: 11, epaisseur_m: 0.3, materiau: "fer", canon: "A" },
      structure: { huisserie: true, gonds: 0, treuils: 1, contrepoids: 0, herse: true, canon: "A" },
      tours: [{ type: "maison_du_treuil", cote: "dessus", hauteur_m: 5, canon: "A" }],
      portail: "sobre",
    }),
    gate({
      id: "riviere-maria",
      nom: "Porte de rivière du mur Maria",
      role: "riviere",
      canon: "A",
      sources: [{ ref: "consigne R1e §5 ; annexe R1c (extraits non officiels de l'anime) — Q9", canon: "A" }],
      trace: "maria-centre",
      s_m: R + CANAL_A[0],
      passage: { largeur_m: 18, hauteur_m: 11, voute: "surbaisse", trous_assassin: 0, rainures: true, canon: "A" },
      vantail: { type: "herse", largeur_m: 18, hauteur_m: 11, epaisseur_m: 0.3, materiau: "fer", canon: "A" },
      structure: { huisserie: true, gonds: 0, treuils: 1, contrepoids: 0, herse: true, canon: "A" },
      tours: [{ type: "maison_du_treuil", cote: "dessus", hauteur_m: 5, canon: "A" }],
      portail: "sobre",
    }),
  ];

  // ——— Végétation ———
  const vegetation: Place["vegetation"] = {
    alignements: [
      { rue: "grand-rue", essence: "tilleul", intervalle_m: 11, cotes: "deux" },
      { rue: "rue-du-mur", essence: "marronnier", intervalle_m: 15, cotes: "droite" },
      { rue: "anneau-1325-est", essence: "tilleul", intervalle_m: 16, cotes: "deux" },
      { rue: "anneau-1325-ouest", essence: "tilleul", intervalle_m: 16, cotes: "deux" },
      { rue: "anneau-642-est", essence: "erable", intervalle_m: 14, cotes: "deux" },
      { rue: "anneau-642-ouest", essence: "erable", intervalle_m: 14, cotes: "deux" },
      { rue: "anneau-110-est", essence: "marronnier", intervalle_m: 12, cotes: "deux" },
      { rue: "anneau-110-ouest", essence: "marronnier", intervalle_m: 12, cotes: "deux" },
      { rue: "quai-ouest", essence: "saule", intervalle_m: 13, cotes: "deux" },
      { rue: "quai-est", essence: "saule", intervalle_m: 13, cotes: "deux" },
      { rue: "route-de-maria", essence: "peuplier", intervalle_m: 12, cotes: "deux" },
      { rue: "route-du-sud", essence: "peuplier", intervalle_m: 14, cotes: "deux" },
    ],
    isoles: [
      { position: pt(36, 590), essence: "tilleul", hauteur_m: 22, nom: "Tilleul de la Place Centrale" },
      { position: pt(-48, 618), essence: "marronnier", hauteur_m: 18 },
      { position: pt(-70, 1150), essence: "tilleul", hauteur_m: 19, nom: "Tilleul du Marché" },
      { position: pt(-60, 60), essence: "marronnier", hauteur_m: 17 },
      { position: pt(60, 60), essence: "marronnier", hauteur_m: 17 },
    ],
    parcs,
    vergers: [
      { polygone: [pt(-760, -60), pt(-460, -60), pt(-460, -520), pt(-760, -520)], espacement_m: 8 },
      { polygone: [pt(520, -60), pt(740, -60), pt(740, -520), pt(520, -520)], espacement_m: 8 },
      { polygone: [pt(-420, -560), pt(-30, -560), pt(-30, -820), pt(-420, -820)], espacement_m: 9 },
    ],
    haies: [{ trace: [pt(-760, -540), pt(760, -540)] }],
    potagers: [{ polygone: [pt(30, -560), pt(420, -560), pt(420, -820), pt(30, -820)] }],
    essences_cours: ["tilleul", "erable", "marronnier", "bouleau", "fruitier", "chene"],
  };

  const zoneFaubourg: [number, number][] = [pt(-430, -24), pt(430, -24), pt(430, -540), pt(-430, -540)];
  const perimetre: [number, number][] = [];
  for (let a = 0; a <= 180; a += 3) perimetre.push(polar(R - 7.5, a));
  const per = perimetre.map((p) => pt(p[0], Math.max(p[1], 7.5)));

  const P = (x: number, y: number, z: number): [number, number, number] => [r1(x), r1(y), r1(z)];
  const jaeger = polar(806, 100.6);
  const canalMid: P2 = [(CANAL_A[0] + CANAL_B[0]) / 2, (CANAL_A[1] + CANAL_B[1]) / 2];
  const wallView = polar(R - 1, 122);

  const place: Place = {
    id: "shiganshina",
    nom: "Shiganshina",
    libelle: "Shiganshina — district sud du mur Maria",
    canon: "C",
    niveau: "N1",
    sources: [
      { ref: "docs/spec/01_LORE_MONDE_CANON.md et 11_AUDIT_LORE_ET_CORRECTIONS.md : district sud du mur Maria, saillie, deux portes", canon: "C" },
      { ref: "docs/spec/ERRATA.md : 845 (porte extérieure brisée par le Colossal, porte intérieure par le Cuirassé), 850 (reprise)", canon: "C" },
      { ref: "Manga, chap. 1–2 (an 845)", canon: "C" },
      { ref: "plan, tracé des rues, noms, dimensions : adaptation (aucune source officielle chiffrée)", canon: "A" },
    ],
    province: "prov_shiganshina",
    style: "E01",
    population: { province: "prov_shiganshina", part: 1, canon: "C", note: "Population de la simulation au départ du scénario 845 (scn_sandbox_845)." },
    densite: { classe: "coeur", valeur: 230, canon: "A" },
    perimetre: per,
    zones: [{ id: "faubourg", nom: "Faubourg de la porte intérieure", canon: "A", polygone: zoneFaubourg, population: { province: "prov_faubourgs_shiganshina", part: 0.12, canon: "A", note: "Part de la province « Faubourgs de Shiganshina » logée au pied de la porte intérieure (adaptation)." }, densite: { classe: "faubourg", valeur: 100, canon: "A" } }],
    orientation: { valeur: "sud", canon: "C" },
    etendue_m: 3500,
    enceinte: {
      mur: "maria",
      canon: "C",
      traces: [
        { id: "saillie", type: "arc", centre: [0, 0], rayon_m: R, debut_deg: 0, fin_deg: 180, exterieur: "dehors", canon: "C" },
        { id: "maria-centre", type: "ligne", points: [[-R, 0], [R, 0]], exterieur: "gauche", canon: "C" },
        { id: "maria-ouest", type: "ligne", points: [[-1750, 0], [-R, 0]], exterieur: "droite", canon: "C" },
        { id: "maria-est", type: "ligne", points: [[R, 0], [1750, 0]], exterieur: "droite", canon: "C" },
      ],
      escaliers: [
        { trace: "saillie", s_m: 260, canon: "A" },
        { trace: "saillie", s_m: 900, canon: "A" },
        { trace: "saillie", s_m: 1560, canon: "A" },
        { trace: "saillie", s_m: sArc(90) - 70, canon: "A" },
        { trace: "saillie", s_m: sArc(90) + 70, canon: "A" },
        { trace: "saillie", s_m: 2900, canon: "A" },
        { trace: "saillie", s_m: 3700, canon: "A" },
        { trace: "maria-centre", s_m: R - 60, canon: "A" },
        { trace: "maria-centre", s_m: R + 60, canon: "A" },
        { trace: "maria-centre", s_m: 500, canon: "A" },
        { trace: "maria-centre", s_m: 2200, canon: "A" },
      ],
      canons: { espacement_m: 32, canon: "A", traces: ["saillie"] },
      glacis_m: 12,
      pied_vegetal: true,
    },
    portes,
    rues,
    places_publiques: places,
    gabarits: GABARITS,
    quartiers: Object.values(QUARTERS).map((q) => ({ id: q.id, nom: q.nom, canon: "A" as const })),
    ilots,
    batiments,
    vegetation,
    eau: {
      voies: [{ id: "canal", nom: "Canal de Shiganshina", canon: "?", type: "canal", trace: [pt(CANAL_A[0] - 40, -900), CANAL_A, CANAL_B, polar(R + 420, 52)], largeur_m: CANAL_W, quais: true }],
      ponts: [262, 490, 718, 946, 1174].map((r, i) => {
        // Ponts : là où l'anneau croise le canal (point du canal le plus proche de l'anneau).
        const t = (() => {
          let best = 0;
          let bd = Infinity;
          for (let k = 0; k <= 200; k++) {
            const u = k / 200;
            const q: P2 = [CANAL_A[0] + (CANAL_B[0] - CANAL_A[0]) * u, CANAL_A[1] + (CANAL_B[1] - CANAL_A[1]) * u];
            const d = Math.abs(Math.hypot(q[0], q[1]) - r);
            if (d < bd) {
              bd = d;
              best = u;
            }
          }
          return best;
        })();
        const q = pt(CANAL_A[0] + (CANAL_B[0] - CANAL_A[0]) * t, CANAL_A[1] + (CANAL_B[1] - CANAL_A[1]) * t);
        const ang = (Math.atan2(CANAL_B[1] - CANAL_A[1], CANAL_B[0] - CANAL_A[0]) * 180) / Math.PI + 90;
        return { id: `pont-${i}`, position: q, angle_deg: r1(ang), longueur_m: CANAL_W + 10, largeur_m: 9, type: i % 2 ? "bois" : "pierre" };
      }),
      puits: [pt(-120, 300), pt(380, 840), pt(-600, 900)],
      fontaines: [pt(-30, 604), pt(-45, 1136)],
    },
    points_de_vue: [
      { id: "ensemble", nom: "Vue d'ensemble (sud-ouest)", oeil: P(-1450, 2250, 980), cible: P(40, 640, 0), fov: 50 },
      { id: "grand-rue", nom: "Grand-Rue vers la porte intérieure", oeil: P(5, 905, 1.8), cible: P(0, 300, 16), fov: 58 },
      { id: "place-centrale", nom: "Place Centrale et église", oeil: P(-62, 650, 9), cible: P(48, 590, 12), fov: 60 },
      { id: "canal", nom: "Canal et quais", oeil: P(canalMid[0] - 40, canalMid[1] - 110, 6), cible: P(canalMid[0] + 40, canalMid[1] + 120, 2), fov: 58 },
      { id: "marche", nom: "Place du Marché", oeil: P(-80, 1090, 10), cible: P(50, 1150, 4), fov: 60 },
      { id: "quartier-ouvrier", nom: "Ruelle du quartier ouvrier", oeil: [...polar(905, 150), 1.7] as [number, number, number], cible: [...polar(780, 152), 6] as [number, number, number], fov: 62 },
      { id: "maison-jaeger", nom: "Maison des Jaeger", oeil: [...polar(792, 98.6), 1.7] as [number, number, number], cible: [jaeger[0], jaeger[1], 5], fov: 55 },
      { id: "rempart", nom: "Chemin de ronde de la saillie", oeil: [wallView[0], wallView[1], 52.5], cible: [...polar(R - 1, 100), 50] as [number, number, number], fov: 60 },
      { id: "faubourg", nom: "Faubourg et porte intérieure", oeil: P(260, -620, 28), cible: P(0, -40, 18), fov: 55 },
      { id: "porte-depuis-la-ville", nom: "Porte extérieure depuis la ville", oeil: P(14, 1190, 2), cible: P(0, R, 22), fov: 58 },
    ],
    etats: [
      { id: "845-avant", nom: "845, avant la brèche", date: "845", canon: "C", sources: [{ ref: "Manga, chap. 1", canon: "C" }], portes: {}, ruines: [], incendies: [], rochers: [], abandon: 0, ciel: "clair", habitants: 1 },
      {
        id: "845-breche",
        nom: "845, la brèche",
        date: "845",
        canon: "C",
        sources: [{ ref: "ERRATA.md (845) ; manga, chap. 1–2 : porte extérieure brisée par le Colossal, porte intérieure par le Cuirassé, débris projetés sur la ville", canon: "C" }, { ref: "étendue des ruines, incendies : adaptation", canon: "A" }],
        portes: { exterieure: "brisee_845", interieure: "brisee_845" },
        ruines: [
          { polygone: [polar(1000, 66), polar(1000, 114), polar(R, 114), polar(R, 66)], part: 0.45 },
          { polygone: [polar(700, 80), polar(700, 112), polar(1000, 112), polar(1000, 80)], part: 0.18 },
          { polygone: [pt(-140, 30), pt(140, 30), pt(140, 260), pt(-140, 260)], part: 0.2 },
        ],
        incendies: [polar(1150, 84), polar(1080, 97), polar(930, 92), polar(820, 103), pt(60, 120)],
        rochers: [
          { position: polar(806, 100.6), rayon_m: 3.6, canon: "C" },
          { position: polar(1120, 88), rayon_m: 4.5, canon: "A" },
          { position: polar(980, 95), rayon_m: 3.2, canon: "A" },
          { position: polar(1210, 80), rayon_m: 5, canon: "A" },
          { position: polar(870, 86), rayon_m: 2.8, canon: "A" },
        ],
        abandon: 0,
        ciel: "enfume",
        habitants: 0.4,
      },
      {
        id: "850-reprise",
        nom: "850, la reprise de Shiganshina",
        date: "850",
        canon: "C",
        sources: [{ ref: "ERRATA.md (850, Retour à Shiganshina)", canon: "C" }, { ref: "état des portes (Q10), ruines et végétation : incertain ou adapté", canon: "?" }],
        portes: { exterieure: "bouchee", interieure: "bouchee" },
        ruines: [
          { polygone: [polar(0, 0), polar(R, 0), polar(R, 180), polar(0, 180)].map((p) => pt(p[0], Math.max(p[1], 0))), part: 0.22 },
          { polygone: [polar(1000, 66), polar(1000, 114), polar(R, 114), polar(R, 66)], part: 0.5 },
          { polygone: [pt(-260, 30), pt(260, 30), pt(260, 380), pt(-260, 380)], part: 0.55 },
        ],
        incendies: [],
        rochers: [{ position: polar(806, 100.6), rayon_m: 3.6, canon: "C" }],
        abandon: 0.85,
        ciel: "brumeux",
        habitants: 0,
      },
    ],
    etat_defaut: "845-avant",
  };
  return place;
}
