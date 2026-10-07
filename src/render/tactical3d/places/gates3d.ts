import { BoxGeometry, Color, CylinderGeometry, DodecahedronGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, TorusGeometry, Vector3 } from "three";
import type { BufferGeometry, Material, Texture } from "three";
import type { Gate, GateState, RingProfile, WallTrace } from "../../../data/placeSchema";
import { FaceBuilder } from "../townMesh";
import { seeded } from "../rng";
import type { Rand } from "../rng";
import { wallFrameAt, wallSection } from "./walls";
import type { WallSection } from "./walls";
import { hashStr } from "./geom";

/**
 * Portes des murailles (R1e, consigne §3.2) — ouvrages paramétriques, construits à la main d'après la fiche de chaque porte :
 * - porte extérieure (porte de front, `levant`) : passage voûté profond à travers toute l'épaisseur du mur, vantail massif de
 *   chêne ferré qui coulisse dans des rainures près du parement extérieur, maison du treuil sur le chemin de ronde (tambours,
 *   chaînes qui plongent par des fentes), contrepoids suspendus côté ville dans des cadres de poutres, trous d'assassin dans la
 *   voûte, tourelles de part et d'autre, encadrement à bossages et claveaux ;
 * - porte intérieure (`battants`) : deux vantaux sur gonds géants, herse de fer dans le passage, portail à pilastres et
 *   entablement côté ville (aucun emblème), postes de garde au pied ;
 * - porte de rivière (`herse`) : arche au-dessus de l'eau, herse qui descend dans l'eau.
 * États : intacte, brisée (845 : vantail éclaté en planches et ferrures tordues, claveaux arrachés, gravats — jamais un trou
 * rectangulaire), réparée, bouchée (masse irrégulière qui obstrue le passage).
 * Repère local : u le long du mur, z vers l'extérieur (0 = ligne médiane), y vers le haut (0 = sol).
 */
type V3 = [number, number, number];

interface Kit {
  stone: FaceBuilder;
  dark: FaceBuilder;
  wood: FaceBuilder;
  iron: FaceBuilder;
  roof: FaceBuilder;
  W(u: number, z: number, y: number): V3;
  /** Direction monde d'un vecteur local (u, z, y). */
  D(u: number, z: number, y: number): V3;
  /** Matrice monde d'une primitive posée en (u, z, y), tournée de `ry` autour de la verticale (0 : alignée sur le mur). */
  M(u: number, z: number, y: number, ry?: number, s?: V3, rx?: number): Matrix4;
}

const STONE = new Color(0xd6cebe);
const STONE_DARK = new Color(0x8e877b);
const OAK = new Color(0x6b4a30);
const IRON = new Color(0x34363a);
const SLATE = new Color(0x4e555c);

function kitAt(t: WallTrace, s: number): Kit {
  const f = wallFrameAt(t, s);
  const d = f.d;
  const o = f.out;
  const ang = Math.atan2(d[1], d[0]);
  return {
    stone: new FaceBuilder(),
    dark: new FaceBuilder(),
    wood: new FaceBuilder(),
    iron: new FaceBuilder(),
    roof: new FaceBuilder(),
    W: (u, z, y) => [f.p[0] + d[0] * u + o[0] * z, y, f.p[1] + d[1] * u + o[1] * z],
    D: (u, z, y) => [d[0] * u + o[0] * z, y, d[1] * u + o[1] * z],
    M(u, z, y, ry = 0, sc = [1, 1, 1], rx = 0) {
      const p = this.W(u, z, y);
      // Repère : x local le long du mur ; la primitive est tournée de −angle (plan → monde), puis de ry et rx locaux.
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -ang - ry).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rx));
      return new Matrix4().compose(new Vector3(...p), q, new Vector3(...sc));
    },
  };
}

/** Boîte alignée sur le repère local, uv en mètres. */
function box(k: Kit, fb: FaceBuilder, u0: number, u1: number, z0: number, z1: number, y0: number, y1: number, c: Color): void {
  const P = (u: number, z: number, y: number): V3 => k.W(u, z, y);
  const faces: [V3[], [number, number][], V3][] = [
    [[P(u0, z1, y0), P(u1, z1, y0), P(u1, z1, y1), P(u0, z1, y1)], [[u0, y0], [u1, y0], [u1, y1], [u0, y1]], k.D(0, 1, 0)],
    [[P(u1, z0, y0), P(u0, z0, y0), P(u0, z0, y1), P(u1, z0, y1)], [[u1, y0], [u0, y0], [u0, y1], [u1, y1]], k.D(0, -1, 0)],
    [[P(u1, z1, y0), P(u1, z0, y0), P(u1, z0, y1), P(u1, z1, y1)], [[z1, y0], [z0, y0], [z0, y1], [z1, y1]], k.D(1, 0, 0)],
    [[P(u0, z0, y0), P(u0, z1, y0), P(u0, z1, y1), P(u0, z0, y1)], [[z0, y0], [z1, y0], [z1, y1], [z0, y1]], k.D(-1, 0, 0)],
    [[P(u0, z0, y1), P(u1, z0, y1), P(u1, z1, y1), P(u0, z1, y1)], [[u0, z0], [u1, z0], [u1, z1], [u0, z1]], [0, 1, 0]],
    [[P(u0, z1, y0), P(u1, z1, y0), P(u1, z0, y0), P(u0, z0, y0)], [[u0, z1], [u1, z1], [u1, z0], [u0, z0]], [0, -1, 0]],
  ];
  for (const [v, uv, out] of faces) fb.face(v, uv, c, out);
}

/** Voûte en plein cintre (ou surbaissée) du passage : intrados, de z0 à z1, largeur w, naissance à `spring`, flèche `rise`. */
function vault(k: Kit, fb: FaceBuilder, w: number, spring: number, rise: number, z0: number, z1: number, c: Color, seg = 14): void {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI;
    const a1 = ((i + 1) / seg) * Math.PI;
    const p0: [number, number] = [-Math.cos(a0) * (w / 2), spring + Math.sin(a0) * rise];
    const p1: [number, number] = [-Math.cos(a1) * (w / 2), spring + Math.sin(a1) * rise];
    // Normale vers l'axe du passage (intrados).
    const mid: [number, number] = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    const inward = k.D(-mid[0], 0, spring - mid[1]);
    fb.face([k.W(p0[0], z0, p0[1]), k.W(p1[0], z0, p1[1]), k.W(p1[0], z1, p1[1]), k.W(p0[0], z1, p0[1])], [[(i * w) / seg, z0], [((i + 1) * w) / seg, z0], [((i + 1) * w) / seg, z1], [(i * w) / seg, z1]], c, inward);
  }
}

/** Claveaux de l'arc (bloc par bloc) et bossages autour de l'ouverture, sur une face (z = face, `side` = ±1 vers l'extérieur de la face). */
function archSurround(k: Kit, w: number, spring: number, rise: number, face: number, side: number, rand: Rand, broken: number, deep = 1.4): void {
  const n = 17;
  const ring = Math.max(1.6, w * 0.13);
  for (let i = 0; i < n; i++) {
    if (broken > 0 && rand() < broken * (1 - Math.abs(i - n / 2) / n)) continue;
    const a0 = (i / n) * Math.PI;
    const a1 = ((i + 1) / n) * Math.PI;
    const inner = (a: number): [number, number] => [-Math.cos(a) * (w / 2), spring + Math.sin(a) * rise];
    const outer = (a: number): [number, number] => [-Math.cos(a) * (w / 2 + ring), spring + Math.sin(a) * (rise + ring)];
    const [i0, i1, o0, o1] = [inner(a0), inner(a1), outer(a0), outer(a1)];
    const shade = STONE.clone().multiplyScalar(0.92 + 0.12 * rand());
    const z = face + side * (0.25 + (i % 2) * 0.12);
    // Face avant du claveau, puis son épaisseur visible (joint en creux).
    k.stone.face([k.W(i0[0], z, i0[1]), k.W(o0[0], z, o0[1]), k.W(o1[0], z, o1[1]), k.W(i1[0], z, i1[1])], [[i0[0], i0[1]], [o0[0], o0[1]], [o1[0], o1[1]], [i1[0], i1[1]]], shade, k.D(0, side, 0));
    k.stone.face([k.W(o0[0], face, o0[1]), k.W(o1[0], face, o1[1]), k.W(o1[0], z, o1[1]), k.W(o0[0], z, o0[1])], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]], shade.clone().multiplyScalar(0.85), k.D(-(o0[0] + o1[0]) / 2, 0, (o0[1] + o1[1]) / 2 - spring));
  }
  // Bossages : blocs saillants à joints marqués, de part et d'autre de l'ouverture jusqu'à la naissance de l'arc.
  for (const s of [-1, 1]) {
    for (let y = 0, row = 0; y < spring + rise * 0.6; y += 1.25, row++) {
      if (broken > 0 && rand() < broken * 0.5 && y > spring * 0.4) continue;
      const u0 = s * (w / 2);
      const len = row % 2 ? 2.2 : 3.4;
      const u1 = s * (w / 2 + len);
      const z0 = face;
      const z1 = face + side * (0.35 + 0.1 * rand());
      box(k, k.stone, Math.min(u0, u1), Math.max(u0, u1), Math.min(z0, z1), Math.max(z0, z1), y + 0.06, y + 1.19, STONE.clone().multiplyScalar(0.88 + 0.1 * rand()));
    }
  }
  void deep;
}

/** Vantail de chêne ferré (levant ou battant) : planches verticales, bandes de fer, clous ; brisé : planches éclatées. */
function oakLeaf(k: Kit, u0: number, u1: number, y0: number, y1: number, zc: number, thick: number, rand: Rand, broken: boolean, bend = 0): void {
  const plank = 0.45;
  for (let u = u0; u < u1 - 0.01; u += plank) {
    const ue = Math.min(u1, u + plank);
    let top = y1;
    let bot = y0;
    if (broken) {
      // Trou irrégulier au centre-bas : les planches s'arrêtent à des hauteurs déchiquetées, certaines manquent.
      const x = ((u + ue) / 2 - (u0 + u1) / 2) / ((u1 - u0) / 2);
      const hole = Math.max(0, 1 - x * x) * (y1 - y0) * (0.55 + 0.3 * rand());
      if (rand() < 0.18) continue;
      bot = y0 + hole * (0.4 + 0.6 * rand());
      top = Math.max(bot + 0.6, top - rand() * 0.8);
      // Moignons de planches arrachées vers l'intérieur.
      if (bot > y0 + 1 && rand() < 0.7) {
        const len = 1 + rand() * 3;
        k.wood.geometry(new BoxGeometry(plank * 0.9, len, thick * 0.6), k.M((u + ue) / 2, zc - len * 0.35, bot - len * 0.3, 0, [1, 1, 1], -0.9 - rand() * 0.5), OAK.clone().multiplyScalar(0.75 + 0.2 * rand()));
      }
    }
    box(k, k.wood, u + 0.02, ue - 0.02, zc - thick / 2, zc + thick / 2 + bend * rand(), bot, top, OAK.clone().multiplyScalar(0.82 + 0.25 * rand()));
  }
  // Bandes de fer horizontales et clous.
  const nb = Math.max(4, Math.round((y1 - y0) / 2.6));
  for (let i = 0; i <= nb; i++) {
    const y = y0 + ((y1 - y0) * (i + 0.5)) / (nb + 1);
    if (broken && y < y0 + (y1 - y0) * 0.62 && rand() < 0.7) {
      // Bande tordue : deux tronçons pliés.
      for (const s of [-1, 1]) k.iron.geometry(new BoxGeometry((u1 - u0) * 0.3, 0.32, 0.12), k.M((u0 + u1) / 2 + s * (u1 - u0) * 0.33, zc + thick / 2 + 0.3, y, s * 0.5, [1, 1, 1], 0.6 * s), IRON);
      continue;
    }
    box(k, k.iron, u0, u1, zc + thick / 2, zc + thick / 2 + 0.08, y - 0.18, y + 0.18, IRON);
    for (let u = u0 + 0.4; u < u1 - 0.2; u += 0.9) k.iron.geometry(new CylinderGeometry(0.07, 0.09, 0.12, 6), k.M(u, zc + thick / 2 + 0.12, y, 0, [1, 1, 1], Math.PI / 2), IRON);
  }
}

/** Herse de fer : barreaux verticaux et traverses, pointes en bas ; tordue si brisée. */
function portcullis(k: Kit, w: number, y0: number, h: number, z: number, rand: Rand, bent: boolean): void {
  const n = Math.max(6, Math.round(w / 0.9));
  for (let i = 0; i <= n; i++) {
    const u = -w / 2 + (i * w) / n;
    const lean = bent && Math.abs(u) < w * 0.3 ? (rand() - 0.5) * 0.6 : 0;
    k.iron.geometry(new BoxGeometry(0.16, h, 0.16), k.M(u, z, y0 + h / 2, 0, [1, 1, 1], lean), IRON);
    k.iron.geometry(new CylinderGeometry(0, 0.12, 0.5, 4), k.M(u, z, y0 - 0.2, 0, [1, 1, 1], Math.PI), IRON);
  }
  for (let y = y0 + 0.8; y < y0 + h; y += 1.4) box(k, k.iron, -w / 2, w / 2, z - 0.09, z + 0.09, y - 0.07, y + 0.07, IRON);
}

/** Toit en pavillon (quatre pans) d'une maison de garde ou du treuil. */
function hipRoof(k: Kit, u0: number, u1: number, z0: number, z1: number, y: number, rise: number): void {
  const cu = (u0 + u1) / 2;
  const cz = (z0 + z1) / 2;
  const o = 0.5;
  const c: V3[] = [k.W(u0 - o, z0 - o, y), k.W(u1 + o, z0 - o, y), k.W(u1 + o, z1 + o, y), k.W(u0 - o, z1 + o, y)];
  const ridge = Math.max(0, (u1 - u0 - (z1 - z0)) / 2);
  const r0 = k.W(cu - ridge, cz, y + rise);
  const r1 = k.W(cu + ridge, cz, y + rise);
  // Coordonnées de texture en mètres (ardoises à leur taille).
  const L = u1 - u0 + 2 * o;
  const sl = Math.hypot(rise, (z1 - z0) / 2 + o);
  const t = (a: V3, b: V3, out: V3): void => k.roof.face([a, b, r1, r0], [[0, 0], [L, 0], [L / 2 + ridge, sl], [L / 2 - ridge, sl]], SLATE, out);
  t(c[0] as V3, c[1] as V3, k.D(0, -1, 1));
  t(c[2] as V3, c[3] as V3, k.D(0, 1, 1));
  const Z = z1 - z0 + 2 * o;
  k.roof.face([c[1] as V3, c[2] as V3, r1], [[0, 0], [Z, 0], [Z / 2, sl]], SLATE, k.D(1, 0, 1));
  k.roof.face([c[3] as V3, c[0] as V3, r0], [[0, 0], [Z, 0], [Z / 2, sl]], SLATE, k.D(-1, 0, 1));
}

/** Tourelle ronde à toit conique. */
function turret(k: Kit, u: number, z: number, y0: number, h: number, r: number): void {
  k.stone.geometry(new CylinderGeometry(r, r * 1.08, h, 14), k.M(u, z, y0 + h / 2), STONE.clone().multiplyScalar(0.95));
  k.stone.geometry(new CylinderGeometry(r * 1.12, r * 1.12, 0.5, 14), k.M(u, z, y0 + h), STONE);
  k.roof.geometry(new CylinderGeometry(0, r * 1.3, r * 2.2, 14), k.M(u, z, y0 + h + r * 1.1), SLATE);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.dark.geometry(new BoxGeometry(0.25, 1.2, 0.3), k.M(u + Math.cos(a) * r * 0.98, z + Math.sin(a) * r * 0.98, y0 + h * 0.65, a), new Color(0x1c1a18));
  }
}

/** Gravats : blocs de pierre et éclats, en tas autour de (u, z). */
function rubble(k: Kit, u: number, z: number, spread: number, n: number, rand: Rand, wood: boolean): void {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * spread;
    const s = 0.5 + rand() * 1.8;
    const y = Math.max(0, (1 - r / spread) * spread * 0.25 * rand());
    k.stone.geometry(new DodecahedronGeometry(1, 0), k.M(u + Math.cos(a) * r, z + Math.sin(a) * r * 0.7, y + s * 0.3, rand() * 6, [s * 1.3, s * 0.7, s]), STONE.clone().multiplyScalar(0.7 + 0.25 * rand()));
    if (wood && rand() < 0.35) k.wood.geometry(new BoxGeometry(0.45, 0.2, 2 + rand() * 4), k.M(u + Math.cos(a) * r * 0.8, z + Math.sin(a) * r * 0.5, y + 0.3, rand() * 6, [1, 1, 1], (rand() - 0.5) * 0.6), OAK.clone().multiplyScalar(0.7));
  }
}

/** Masse qui bouche un passage (état « bouchée », `?`) : blocs irréguliers serrés, débordant sur les deux faces. */
function plug(k: Kit, w: number, h: number, zFrom: number, zTo: number, rand: Rand): void {
  for (let i = 0; i < 46; i++) {
    const u = (rand() - 0.5) * (w + 4);
    const z = zFrom + rand() * (zTo - zFrom);
    const y = rand() * (h + 4);
    const s = 2 + rand() * 3.5;
    k.stone.geometry(new DodecahedronGeometry(1, 0), k.M(u, z, y, rand() * 6, [s, s * (0.8 + 0.5 * rand()), s]), new Color(0xbfc3c2).multiplyScalar(0.8 + 0.25 * rand()));
  }
}

export interface GateOpts {
  state: GateState;
  ring: RingProfile;
}

export interface GateMeshes {
  group: Group;
  /** Repères pour les vues : centre au sol, direction du mur, extérieur, faces, hauteur du mur. */
  frame: { p: [number, number]; d: [number, number]; out: [number, number]; ext: number; int: number; H: number; walk: number };
  dispose(): void;
}

/** Ouvrage complet d'une porte, dans son état. */
export function buildGate(g: Gate, t: WallTrace, o: GateOpts, mats: GateMaterials): GateMeshes {
  const sec: WallSection = wallSection(o.ring);
  const k = kitAt(t, g.s_m);
  const rand = seeded(hashStr(`${g.id}|${o.state}`));
  const w = g.passage.largeur_m;
  const h = g.passage.hauteur_m;
  const rise = g.passage.voute === "linteau" ? 0 : g.passage.voute === "surbaisse" ? w * 0.22 : w / 2;
  const spring = h - rise;
  const zExt = sec.extAt(h * 0.5) + 0.05;
  const zInt = sec.intAt(h * 0.5) - 0.05;
  const zExtFoot = sec.extFoot + sec.talus.out;
  const H = sec.H;
  const broken = o.state === "brisee_845";
  const blocked = o.state === "bouchee";
  const repaired = o.state === "reparee";
  // Passage : voûte (intrados), joues de pierre sombre avec rainures, sol dallé.
  vault(k, k.dark, w, spring, rise, zInt - 0.3, zExtFoot + 0.3, STONE_DARK);
  for (const s of [-1, 1]) k.dark.face([k.W((s * w) / 2, zInt - 0.3, 0), k.W((s * w) / 2, zExtFoot + 0.3, 0), k.W((s * w) / 2, zExtFoot + 0.3, spring), k.W((s * w) / 2, zInt - 0.3, spring)], [[zInt, 0], [zExtFoot, 0], [zExtFoot, spring], [zInt, spring]], STONE_DARK.clone().multiplyScalar(1.05), k.D(-s, 0, 0));
  k.stone.face([k.W(-w / 2, zInt - 0.3, 0.05), k.W(w / 2, zInt - 0.3, 0.05), k.W(w / 2, zExtFoot + 0.3, 0.05), k.W(-w / 2, zExtFoot + 0.3, 0.05)], [[0, 0], [w, 0], [w, 10], [0, 10]], STONE_DARK.clone().multiplyScalar(0.95), [0, 1, 0]);
  // Trous d'assassin : ouvertures sombres dans la voûte, réparties sur la longueur du passage.
  const nHoles = g.passage.trous_assassin;
  for (let i = 0; i < nHoles; i++) {
    const z = zInt + ((zExtFoot - zInt) * (i + 0.5)) / nHoles;
    const u = (i % 2 ? 1 : -1) * w * 0.15;
    box(k, k.iron, u - 0.45, u + 0.45, z - 0.45, z + 0.45, h - 0.02, h + 0.4, new Color(0x0d0c0b));
  }
  // Rainures du vantail levant ou de la herse : fentes verticales dans les joues.
  const grooveZ = g.vantail.type === "levant" ? zExt - 2.2 : g.structure.herse ? zExt - 3.4 : NaN;
  if (g.passage.rainures && Number.isFinite(grooveZ)) for (const s of [-1, 1]) box(k, k.iron, s * (w / 2) - 0.35, s * (w / 2) + 0.35, grooveZ - 0.5, grooveZ + 0.5, 0, spring + rise * 0.9, new Color(0x141312));
  // Encadrements : extérieur à bossages et claveaux ; intérieur selon le portail.
  archSurround(k, w, spring, rise, zExt, 1, rand, broken ? 0.55 : 0);
  if (g.portail === "pilastres") {
    // Portail côté ville : pilastres, entablement, fronton (sans emblème).
    for (const s of [-1, 1]) {
      box(k, k.stone, s * (w / 2 + 1.2) - 1.1, s * (w / 2 + 1.2) + 1.1, zInt - 1.2, zInt, 0, h + 3, STONE.clone().multiplyScalar(1.02));
      box(k, k.stone, s * (w / 2 + 1.2) - 1.4, s * (w / 2 + 1.2) + 1.4, zInt - 1.5, zInt, 0, 1.2, STONE.clone().multiplyScalar(0.9));
    }
    box(k, k.stone, -w / 2 - 3, w / 2 + 3, zInt - 1.6, zInt, h + 3, h + 5, STONE.clone().multiplyScalar(1.05));
    box(k, k.stone, -w / 2 - 3.4, w / 2 + 3.4, zInt - 1.9, zInt, h + 5, h + 5.6, STONE);
    const top = h + 5.6;
    const span = w / 2 + 3.4;
    k.stone.face([k.W(-span, zInt - 1.4, top), k.W(span, zInt - 1.4, top), k.W(0, zInt - 1.4, top + span * 0.32)], [[0, 0], [1, 0], [0.5, 0.3]], STONE, k.D(0, -1, 0));
    for (const s of [-1, 1]) k.stone.face([k.W(s * span, zInt - 1.4, top), k.W(s * span, zInt, top), k.W(0, zInt, top + span * 0.32), k.W(0, zInt - 1.4, top + span * 0.32)], [[0, 0], [1, 0], [1, 1], [0, 1]], STONE.clone().multiplyScalar(0.92), k.D(s * 0.3, 0, 1));
  } else archSurround(k, w, spring, rise, zInt, -1, rand, broken ? 0.4 : 0);
  // Vantaux, herse, mécanisme.
  const leafW = g.vantail.largeur_m;
  const leafH = Math.min(g.vantail.hauteur_m, spring + rise * 0.9);
  if (blocked) {
    plug(k, w, h, zInt - 6, zExtFoot + 6, rand);
  } else if (g.vantail.type === "levant") {
    oakLeaf(k, -leafW / 2, leafW / 2, broken ? 0.4 : 0, leafH, grooveZ, g.vantail.epaisseur_m, rand, broken, broken ? 0.3 : 0);
    if (repaired) for (let y = 3; y < leafH; y += 4) box(k, k.wood, -leafW / 2 + 1, leafW / 2 - 1, grooveZ + g.vantail.epaisseur_m / 2, grooveZ + g.vantail.epaisseur_m / 2 + 0.3, y, y + 0.6, OAK.clone().multiplyScalar(1.15));
  } else if (g.vantail.type === "battants") {
    const z = zInt + 1.2;
    if (broken) {
      // Vantaux arrachés : l'un couché sur le pavé côté ville, l'autre pendu à un gond, de travers.
      const half = leafW / 2;
      const leafA = new Group();
      void leafA;
      k.wood.geometry(new BoxGeometry(half, g.vantail.epaisseur_m, leafH * 0.85), k.M(-half * 0.6, zInt - leafH * 0.45, 0.6, 0.35), OAK.clone().multiplyScalar(0.8));
      k.wood.geometry(new BoxGeometry(half, leafH * 0.8, g.vantail.epaisseur_m), k.M(half * 0.55, z - 2.5, leafH * 0.42, 0.9, [1, 1, 1], 0.12), OAK.clone().multiplyScalar(0.85));
      rubble(k, 0, zInt - 8, 9, 34, rand, true);
    } else {
      for (const s of [-1, 1]) {
        const u0 = s < 0 ? -leafW / 2 : 0.05;
        const u1 = s < 0 ? -0.05 : leafW / 2;
        oakLeaf(k, u0, u1, 0, leafH, z, g.vantail.epaisseur_m, rand, false);
        // Gonds : pentures (bandes de fer) et gonds (cylindres) sur le chant extérieur du vantail.
        for (let i = 0; i < g.structure.gonds; i++) {
          const y = 1.5 + (i * (leafH - 3)) / Math.max(1, g.structure.gonds - 1);
          box(k, k.iron, s < 0 ? -leafW / 2 - 0.3 : leafW * 0.05, s < 0 ? -leafW * 0.05 : leafW / 2 + 0.3, z - g.vantail.epaisseur_m / 2 - 0.12, z - g.vantail.epaisseur_m / 2, y - 0.35, y + 0.35, IRON);
          k.iron.geometry(new CylinderGeometry(0.35, 0.35, 1.4, 10), k.M(s * (leafW / 2 + 0.35), z, y), IRON);
        }
      }
    }
  }
  if (g.structure.herse && !blocked) portcullis(k, w - 0.4, broken ? 2.5 : g.vantail.type === "herse" ? 0.3 : spring * 0.72, broken ? spring * 0.7 : g.vantail.type === "herse" ? spring + rise * 0.8 : spring * 0.3 + rise * 0.7, zExt - 3.4, rand, broken);
  // Tête de l'ouvrage : maison du treuil sur le chemin de ronde, tambours, chaînes, contrepoids côté ville.
  const walkMid = (sec.intTop + 0.5 + sec.extTop - sec.parapet.t) / 2;
  const walkHalf = (sec.extTop - sec.parapet.t - (sec.intTop + 0.5)) / 2;
  for (const tw of g.tours) {
    if (tw.type === "maison_du_treuil") {
      const hw = w * 0.7;
      // Piliers et murs ajourés : le mécanisme se voit du chemin de ronde.
      for (const s of [-1, 1]) {
        box(k, k.stone, s * hw - 1, s * hw + 1, walkMid - walkHalf + 0.2, walkMid + walkHalf - 0.2, H, H + tw.hauteur_m, STONE.clone().multiplyScalar(0.94));
        box(k, k.stone, -hw, hw, s > 0 ? walkMid + walkHalf - 1 : walkMid - walkHalf, s > 0 ? walkMid + walkHalf : walkMid - walkHalf + 1, H + tw.hauteur_m - 1.6, H + tw.hauteur_m, STONE.clone().multiplyScalar(0.97));
      }
      hipRoof(k, -hw - 1, hw + 1, walkMid - walkHalf, walkMid + walkHalf, H + tw.hauteur_m, w * 0.35);
      // Tambours (un par treuil), axe le long du mur, rayons ; chaînes vers les fentes du vantail.
      for (let i = 0; i < g.structure.treuils; i++) {
        const u = g.structure.treuils === 1 ? 0 : (i / (g.structure.treuils - 1) - 0.5) * w * 0.7;
        const y = H + 2.4;
        k.wood.geometry(new CylinderGeometry(1.6, 1.6, 2.6, 16), k.M(u, walkMid, y, 0, [1, 1, 1], 0).multiply(new Matrix4().makeRotationZ(Math.PI / 2)), OAK.clone().multiplyScalar(0.9));
        for (let r = 0; r < 4; r++) k.wood.geometry(new BoxGeometry(0.25, 4.6, 0.25), k.M(u + 1.45, walkMid, y, 0, [1, 1, 1], (r * Math.PI) / 4), OAK);
        k.iron.geometry(new CylinderGeometry(0.22, 0.22, w * 0.6, 8), k.M(u, walkMid, y).multiply(new Matrix4().makeRotationZ(Math.PI / 2)), IRON);
        // Chaîne : anneaux le long de la descente, dans une fente du chemin de ronde.
        if (g.vantail.type === "levant" && !blocked) {
          box(k, k.iron, u - 0.4, u + 0.4, grooveZ - 0.4, grooveZ + 0.4, H - 0.02, H + 0.1, new Color(0x0a0a0a));
          for (let yy = H + 1.5; yy > leafH + 0.5; yy -= 1.1) k.iron.geometry(new TorusGeometry(0.22, 0.06, 4, 8), k.M(u, grooveZ, yy, (Math.round(yy) % 2) * (Math.PI / 2)), IRON);
        }
      }
      // Contrepoids côté ville : cadres de poutres contre le parement intérieur, blocs ferrés suspendus.
      for (let i = 0; i < g.structure.contrepoids; i++) {
        const s = i % 2 ? 1 : -1;
        const u = s * (w / 2 + 6 + Math.floor(i / 2) * 5);
        const zf = sec.intAt(20) - 1.2;
        for (const du of [-1.4, 1.4]) box(k, k.wood, u + du - 0.3, u + du + 0.3, zf - 0.6, zf, 0, H, OAK.clone().multiplyScalar(0.85));
        for (let yy = 4; yy < H; yy += 7) box(k, k.wood, u - 1.7, u + 1.7, zf - 0.6, zf, yy, yy + 0.4, OAK.clone().multiplyScalar(0.8));
        const yW = broken ? 3 : 22;
        box(k, k.stone, u - 1.1, u + 1.1, zf - 2.4, zf - 0.7, yW, yW + 3.2, STONE_DARK);
        for (const yy of [yW + 0.4, yW + 2.8]) box(k, k.iron, u - 1.15, u + 1.15, zf - 2.45, zf - 0.65, yy - 0.12, yy + 0.12, IRON);
        for (let yy = yW + 3.6; yy < H - 0.5; yy += 1.1) k.iron.geometry(new TorusGeometry(0.2, 0.055, 4, 8), k.M(u, zf - 1.55, yy, (Math.round(yy) % 2) * (Math.PI / 2)), IRON);
      }
    } else if (tw.type === "tourelle") {
      const s = tw.cote === "gauche" ? -1 : 1;
      turret(k, s * (w / 2 + 9), walkMid, H, tw.hauteur_m, 3.2);
    } else {
      // Poste de garde au pied, côté ville : maisonnette de pierre, toit en pavillon, porte et fenêtre sombres.
      const s = tw.cote === "gauche" ? -1 : 1;
      const u0 = s * (w / 2 + 4);
      const u1 = s * (w / 2 + 11);
      const z1 = zInt - 1.8;
      const z0 = z1 - 7;
      box(k, k.stone, Math.min(u0, u1), Math.max(u0, u1), z0, z1, 0, tw.hauteur_m, STONE.clone().multiplyScalar(0.93));
      hipRoof(k, Math.min(u0, u1), Math.max(u0, u1), z0, z1, tw.hauteur_m, 2.6);
      box(k, k.dark, (u0 + u1) / 2 - 0.7, (u0 + u1) / 2 + 0.7, z0 - 0.05, z0 + 0.1, 0, 2.3, new Color(0x2a2016));
    }
  }
  // État brisé : brèche dans le parement autour de l'arc, gravats des deux côtés.
  if (broken) {
    rubble(k, 0, zExtFoot + 6, 12, 60, rand, true);
    rubble(k, 0, zInt - 4, 8, 30, rand, true);
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * (0.15 + 0.7 * rand());
      const r = w / 2 + 2 + rand() * 6;
      k.dark.geometry(new DodecahedronGeometry(1, 0), k.M(-Math.cos(a) * r, zExt + 0.4, spring + Math.sin(a) * r * 0.9, rand() * 6, [1.6 + rand() * 2, 1 + rand() * 1.5, 0.8]), new Color(0x5b554c));
    }
  }
  // Maillages par matière.
  const group = new Group();
  group.name = `porte-${g.id}`;
  const add = (fb: FaceBuilder, m: Material, name: string): void => {
    if (fb.pos.length === 0) return;
    const mesh = new Mesh(fb.build(), m);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(k.stone, mats.stone, `porte-${g.id}-pierre`);
  add(k.dark, mats.dark, `porte-${g.id}-passage`);
  add(k.wood, mats.wood, `porte-${g.id}-vantaux`);
  add(k.iron, mats.iron, `porte-${g.id}-fer`);
  add(k.roof, mats.roof, `porte-${g.id}-toits`);
  const f = wallFrameAt(t, g.s_m);
  return {
    group,
    frame: { p: f.p, d: f.d, out: f.out, ext: zExtFoot, int: sec.intFoot, H, walk: walkMid },
    dispose() {
      group.traverse((x) => {
        if (x instanceof Mesh) (x.geometry as BufferGeometry).dispose();
      });
    },
  };
}

export interface GateMaterials {
  stone: Material;
  dark: Material;
  wood: Material;
  iron: Material;
  roof: Material;
  dispose(): void;
}

export function gateMaterials(stoneMap: Texture | null, woodMap: Texture | null, roofMap: Texture | null): GateMaterials {
  const stone = new MeshStandardMaterial({ map: stoneMap, vertexColors: true, roughness: 0.92 });
  const dark = new MeshStandardMaterial({ map: stoneMap, vertexColors: true, roughness: 0.96 });
  const wood = new MeshStandardMaterial({ map: woodMap, vertexColors: true, roughness: 0.82 });
  const iron = new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.65 });
  const roof = new MeshStandardMaterial({ map: roofMap, vertexColors: true, roughness: 0.6 });
  return {
    stone,
    dark,
    wood,
    iron,
    roof,
    dispose() {
      for (const m of [stone, dark, wood, iron, roof]) m.dispose();
    },
  };
}

/**
 * Vues d'une porte (consigne §3.2) : extérieure de face (60 m, hauteur d'homme) et de détail (8 m, ferrures et mécanisme),
 * intérieure de face et de détail, passage voûté, haut (chemin de ronde, mécanisme), échelle (soldat, cheval, charrette, Titan
 * de 15 m). Coordonnées monde : (x, altitude, y du plan).
 */
export function gateViews(g: Gate, fr: GateMeshes["frame"]): Record<string, { eye: V3; target: V3; fov: number }> {
  const P = (u: number, z: number, y: number): V3 => [fr.p[0] + fr.d[0] * u + fr.out[0] * z, y, fr.p[1] + fr.d[1] * u + fr.out[1] * z];
  const w = g.passage.largeur_m;
  const h = g.passage.hauteur_m;
  const base = `porte-${g.id}`;
  return {
    [`${base}-exterieure-face`]: { eye: P(4, fr.ext + 60, 1.7), target: P(0, fr.ext, h * 0.85), fov: 58 },
    [`${base}-exterieure-detail`]: { eye: P(w * 0.42, fr.ext + 8, 3.2), target: P(w * 0.2, fr.ext - 2.5, h * 0.42), fov: 60 },
    [`${base}-interieure-face`]: { eye: P(-4, fr.int - 60, 1.7), target: P(0, fr.int, h * 0.85), fov: 58 },
    [`${base}-interieure-detail`]: { eye: P(-w * 0.6, fr.int - 8, 3.5), target: P(-w / 2 - 6, fr.int, 14), fov: 62 },
    [`${base}-passage`]: { eye: P(w * 0.15, fr.int + 2, 2.2), target: P(-w * 0.05, fr.ext - 2, h * 0.62), fov: 66 },
    [`${base}-haut`]: { eye: P(w / 2 + 24, fr.walk, fr.H + 3.2), target: P(0, fr.walk, fr.H + 4), fov: 62 },
    [`${base}-echelle`]: { eye: P(-46, fr.ext + 105, 9), target: P(6, fr.ext + 14, 16), fov: 50 },
  };
}
