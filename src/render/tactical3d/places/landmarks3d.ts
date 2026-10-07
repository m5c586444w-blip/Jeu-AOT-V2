import { BoxGeometry, Color, CylinderGeometry, DodecahedronGeometry, Group, Matrix4, Mesh, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from "three";
import type { BufferGeometry, Material } from "three";
import type { Building } from "../../../data/placeSchema";
import { FaceBuilder } from "../townMesh";
import { seeded } from "../rng";
import type { Rand } from "../rng";
import { hashStr } from "./geom";

/**
 * Bâtiments repères à constructeur propre (R1e.4, consigne §4 : « église, halle, caserne… reconnaissables ») — volumes
 * construits à la main d'après la fiche du bâtiment (`data/places/<id>.json`, `batiments`), sans aucun modèle externe :
 * - église (`eglise`) : nef haute à pignon, bas-côtés à appentis contrebutés, fenêtres hautes, abside polygonale, clocher-porche
 *   carré avec beffroi ajouré et flèche d'ardoise octogonale (aucun emblème religieux : l'édifice est adapté, [A]) ;
 * - halle (`halle`) : charpente ouverte de poteaux de chêne, liens obliques, grand toit à croupes de tuile ;
 * - caserne (`caserne` avec `cour`) : quatre ailes autour d'une cour, porche voûté, fenêtres par étage, cordons, cheminées ;
 * - moulin (`moulin` avec `roue`) : la maison reste celle de son gabarit ; seule la roue à aubes est ajoutée, côté canal.
 * Les autres repères gardent le rendu d'une grande maison de leur gabarit (`landmarkHouse`).
 * Ruines (état du lieu) : murs arasés irrégulièrement, toits effondrés, gravats.
 * Repère local : u le long de la façade (`angle_deg`), v en profondeur (normale à gauche), y vers le haut.
 */
type V3 = [number, number, number];

export interface LandmarkMaterials {
  stone: Material;
  dark: Material;
  wood: Material;
  iron: Material;
  roof: Material;
  tile: Material;
}

interface Kit {
  stone: FaceBuilder;
  dark: FaceBuilder;
  wood: FaceBuilder;
  iron: FaceBuilder;
  roof: FaceBuilder;
  W(u: number, v: number, y: number): V3;
  D(u: number, v: number, y: number): V3;
  M(u: number, v: number, y: number, ry?: number, s?: V3): Matrix4;
}

const GLASS = new Color(0x262c33);
const OAK = new Color(0x6b4a30);
const IRON = new Color(0x3a3c40);
const SLATE = new Color(0x5a626a);
const SHADOW = new Color(0x2a2522);

function kitFor(b: Building): Kit {
  const a = (b.angle_deg * Math.PI) / 180;
  const U: [number, number] = [Math.cos(a), Math.sin(a)];
  const N: [number, number] = [-Math.sin(a), Math.cos(a)];
  const [cx, cy] = b.position;
  return {
    stone: new FaceBuilder(),
    dark: new FaceBuilder(),
    wood: new FaceBuilder(),
    iron: new FaceBuilder(),
    roof: new FaceBuilder(),
    W: (u, v, y) => [cx + U[0] * u + N[0] * v, y, cy + U[1] * u + N[1] * v],
    D: (u, v, y) => [U[0] * u + N[0] * v, y, U[1] * u + N[1] * v],
    M(u, v, y, ry = 0, sc = [1, 1, 1]) {
      // x local de la primitive → U, z local → N (rotation de −a autour de la verticale), puis ry local.
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -a - ry);
      return new Matrix4().compose(new Vector3(...this.W(u, v, y)), q, new Vector3(...sc));
    },
  };
}

/** Boîte alignée sur le repère local, coordonnées de texture en mètres. */
function box(k: Kit, fb: FaceBuilder, u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, c: Color, top = true): void {
  const P = k.W;
  fb.face([P(u0, v1, y0), P(u1, v1, y0), P(u1, v1, y1), P(u0, v1, y1)], [[u0, y0], [u1, y0], [u1, y1], [u0, y1]], c, k.D(0, 1, 0));
  fb.face([P(u1, v0, y0), P(u0, v0, y0), P(u0, v0, y1), P(u1, v0, y1)], [[u1, y0], [u0, y0], [u0, y1], [u1, y1]], c, k.D(0, -1, 0));
  fb.face([P(u1, v1, y0), P(u1, v0, y0), P(u1, v0, y1), P(u1, v1, y1)], [[v1, y0], [v0, y0], [v0, y1], [v1, y1]], c, k.D(1, 0, 0));
  fb.face([P(u0, v0, y0), P(u0, v1, y0), P(u0, v1, y1), P(u0, v0, y1)], [[v0, y0], [v1, y0], [v1, y1], [v0, y1]], c, k.D(-1, 0, 0));
  if (top) fb.face([P(u0, v0, y1), P(u1, v0, y1), P(u1, v1, y1), P(u0, v1, y1)], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], c, [0, 1, 0]);
}

/** Toit à deux pans, faîtage le long de v (`axis` "v") ou de u ; pignons dans le matériau des murs. */
function gable(k: Kit, wall: FaceBuilder, u0: number, u1: number, v0: number, v1: number, y: number, rise: number, axis: "u" | "v", wallColor: Color, o = 0.6): void {
  if (axis === "v") {
    const cu = (u0 + u1) / 2;
    const slope = Math.hypot(rise, (u1 - u0) / 2 + o);
    for (const s of [-1, 1]) {
      const ue = s < 0 ? u0 - o : u1 + o;
      k.roof.face([k.W(ue, v0 - o, y - o * 0.6), k.W(ue, v1 + o, y - o * 0.6), k.W(cu, v1 + o, y + rise), k.W(cu, v0 - o, y + rise)], [[v0, 0], [v1, 0], [v1, slope], [v0, slope]], SLATE, k.D(s, 0, (u1 - u0) / 2 / rise));
    }
    for (const [vv, s] of [[v0, -1], [v1, 1]] as const) wall.face([k.W(u0, vv, y), k.W(u1, vv, y), k.W(cu, vv, y + rise)], [[u0, y], [u1, y], [cu, y + rise]], wallColor, k.D(0, s, 0));
  } else {
    const cv = (v0 + v1) / 2;
    const slope = Math.hypot(rise, (v1 - v0) / 2 + o);
    for (const s of [-1, 1]) {
      const ve = s < 0 ? v0 - o : v1 + o;
      k.roof.face([k.W(u0 - o, ve, y - o * 0.6), k.W(u1 + o, ve, y - o * 0.6), k.W(u1 + o, cv, y + rise), k.W(u0 - o, cv, y + rise)], [[u0, 0], [u1, 0], [u1, slope], [u0, slope]], SLATE, k.D(0, s, (v1 - v0) / 2 / rise));
    }
    for (const [uu, s] of [[u0, -1], [u1, 1]] as const) wall.face([k.W(uu, v0, y), k.W(uu, v1, y), k.W(uu, cv, y + rise)], [[v0, y], [v1, y], [cv, y + rise]], wallColor, k.D(s, 0, 0));
  }
}

/** Toit à quatre croupes sur un rectangle (u0..u1 × v0..v1), avancée `o`, coordonnées de texture en mètres. */
function hip(k: Kit, fb: FaceBuilder, u0: number, u1: number, v0: number, v1: number, y: number, rise: number, c: Color, o = 0.7): void {
  const cu = (u0 + u1) / 2;
  const cv = (v0 + v1) / 2;
  const lu = u1 - u0;
  const lv = v1 - v0;
  const c0 = k.W(u0 - o, v0 - o, y - o * 0.5);
  const c1 = k.W(u1 + o, v0 - o, y - o * 0.5);
  const c2 = k.W(u1 + o, v1 + o, y - o * 0.5);
  const c3 = k.W(u0 - o, v1 + o, y - o * 0.5);
  if (lu >= lv) {
    const r = (lu - lv) / 2;
    const r0 = k.W(cu - r, cv, y + rise);
    const r1 = k.W(cu + r, cv, y + rise);
    const sl = Math.hypot(rise, lv / 2 + o);
    fb.face([c0, c1, r1, r0], [[u0 - o, 0], [u1 + o, 0], [cu + r, sl], [cu - r, sl]], c, k.D(0, -1, lv / 2 / rise));
    fb.face([c2, c3, r0, r1], [[u1 + o, 0], [u0 - o, 0], [cu - r, sl], [cu + r, sl]], c, k.D(0, 1, lv / 2 / rise));
    fb.face([c1, c2, r1], [[v0 - o, 0], [v1 + o, 0], [cv, sl]], c, k.D(1, 0, lv / 2 / rise));
    fb.face([c3, c0, r0], [[v1 + o, 0], [v0 - o, 0], [cv, sl]], c, k.D(-1, 0, lv / 2 / rise));
  } else {
    const r = (lv - lu) / 2;
    const r0 = k.W(cu, cv - r, y + rise);
    const r1 = k.W(cu, cv + r, y + rise);
    const sl = Math.hypot(rise, lu / 2 + o);
    fb.face([c3, c0, r0, r1], [[v1 + o, 0], [v0 - o, 0], [cv - r, sl], [cv + r, sl]], c, k.D(-1, 0, lu / 2 / rise));
    fb.face([c1, c2, r1, r0], [[v0 - o, 0], [v1 + o, 0], [cv + r, sl], [cv - r, sl]], c, k.D(1, 0, lu / 2 / rise));
    fb.face([c0, c1, r0], [[u0 - o, 0], [u1 + o, 0], [cu, sl]], c, k.D(0, -1, lu / 2 / rise));
    fb.face([c2, c3, r1], [[u1 + o, 0], [u0 - o, 0], [cu, sl]], c, k.D(0, 1, lu / 2 / rise));
  }
}

/**
 * Ouverture (fenêtre, porte, baie) posée sur une face : rectangle à tête cintrée (`arch` > 0 : flèche de l'arc) légèrement en
 * avant du mur, vitrage ou vide sombre, encadrement de pierre. `face` : "u+" | "u-" | "v+" | "v-" et position du plan du mur.
 */
function opening(k: Kit, face: "u+" | "u-" | "v+" | "v-", plane: number, along: number, y0: number, w: number, h: number, arch: number, fill: FaceBuilder, c: Color, frame: Color | null): void {
  const sgn = face.endsWith("+") ? 1 : -1;
  const onU = face.startsWith("u");
  const P = (t: number, y: number, d: number): V3 => (onU ? k.W(plane + sgn * d, along + t, y) : k.W(along + t, plane + sgn * d, y));
  const out = onU ? k.D(sgn, 0, 0) : k.D(0, sgn, 0);
  const pts: [number, number][] = [[-w / 2, y0], [w / 2, y0], [w / 2, y0 + h - arch]];
  const seg = arch > 0 ? 8 : 0;
  for (let i = 1; i < seg; i++) {
    const t = (i / seg) * Math.PI;
    pts.push([(Math.cos(t) * w) / 2, y0 + h - arch + Math.sin(t) * arch]);
  }
  pts.push([-w / 2, y0 + h - arch]);
  fill.face(pts.map(([t, y]) => P(t, y, 0.06)), pts.map(([t, y]) => [t, y]), c, out);
  if (frame) {
    const f = 0.22;
    // Appui saillant et jambages.
    box2(k, P, -w / 2 - f, w / 2 + f, y0 - 0.25, y0, 0.18, frame, out);
    for (const s of [-1, 1]) box2(k, P, s * (w / 2) - (s < 0 ? f : 0), s * (w / 2) + (s > 0 ? f : 0), y0, y0 + h - arch, 0.1, frame, out);
  }
}

/** Petite boîte saillante (encadrement) dans le repère d'une face. */
function box2(k: Kit, P: (t: number, y: number, d: number) => V3, t0: number, t1: number, y0: number, y1: number, d: number, c: Color, out: V3): void {
  k.stone.face([P(t0, y0, d), P(t1, y0, d), P(t1, y1, d), P(t0, y1, d)], [[t0, y0], [t1, y0], [t1, y1], [t0, y1]], c, out);
  k.stone.face([P(t0, y1, 0), P(t1, y1, 0), P(t1, y1, d), P(t0, y1, d)], [[t0, 0], [t1, 0], [t1, d], [t0, d]], c, [0, 1, 0]);
}

/** Gravats (ruines). */
function rubble(k: Kit, u: number, v: number, spread: number, n: number, rand: Rand, c: Color): void {
  const g = new DodecahedronGeometry(1, 0);
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * spread;
    const s = 0.4 + rand() * 1.4;
    k.stone.geometry(g, k.M(u + Math.cos(a) * r, v + Math.sin(a) * r, s * 0.25 + rand() * (1 - r / spread) * 1.5, rand() * 6, [s * 1.3, s * 0.7, s]), c.clone().multiplyScalar(0.7 + 0.25 * rand()));
  }
  g.dispose();
}

/** Hauteur d'arase d'un mur ruiné (crête irrégulière) : `full` si intact. */
const ruinTop = (full: number, ruin: number, rand: Rand): number => (ruin > 0.15 ? full * (1 - ruin * (0.45 + 0.4 * rand())) : full);

function church(k: Kit, b: Building, rand: Rand): void {
  const [W, D] = b.emprise_m;
  const P = b.params ?? {};
  const wall = new Color(b.teinte);
  const plinth = wall.clone().multiplyScalar(0.82);
  const ts = typeof P["clocher_cote"] === "number" ? P["clocher_cote"] : 9;
  const spireTop = typeof P["clocher_m"] === "number" ? P["clocher_m"] : 50;
  const pente = ((typeof P["pente"] === "number" ? P["pente"] : 50) * Math.PI) / 180;
  const nw = Math.min(13, W * 0.56);
  const aw = (W - nw) / 2;
  const eave = Math.min(b.hauteur_m * 0.78, 16);
  const aisleH = eave * 0.5;
  const apseR = nw / 2;
  const vT0 = -D / 2;
  const vT1 = vT0 + ts;
  const vN0 = vT1 - 0.5;
  const vN1 = D / 2 - apseR;
  const ruin = (b as Building & { ruin?: number }).ruin ?? 0;
  const roofOn = ruin < 0.4;
  // Soubassement, nef, bas-côtés à appentis.
  box(k, k.stone, -W / 2 - 0.3, W / 2 + 0.3, vT1, vN1, 0, 0.8, plinth);
  box(k, k.stone, -nw / 2, nw / 2, vN0, vN1, 0, ruinTop(eave, ruin, rand), wall, !roofOn);
  const rise = (nw / 2) * Math.tan(pente);
  if (roofOn) gable(k, k.stone, -nw / 2, nw / 2, vN0, vN1, eave, rise, "v", wall, 0.5);
  for (const s of [-1, 1]) {
    const uo = s * (W / 2);
    const ui = s * (nw / 2);
    const top = ruinTop(aisleH, ruin, rand);
    box(k, k.stone, Math.min(uo, ui), Math.max(uo, ui), vT1 + 0.6, vN1 - 1.5, 0, top, wall, !roofOn);
    if (roofOn) {
      // Appentis : du haut du bas-côté contre la nef jusqu'à l'égout extérieur.
      const hi = aisleH + aw * 0.55;
      const a0 = k.W(uo + s * 0.6, vT1 + 0.1, aisleH - 0.3);
      const a1 = k.W(uo + s * 0.6, vN1 - 1.0, aisleH - 0.3);
      const b1 = k.W(ui, vN1 - 1.0, hi);
      const b0 = k.W(ui, vT1 + 0.1, hi);
      const sl = Math.hypot(aw + 0.6, hi - aisleH + 0.3);
      k.roof.face([a0, a1, b1, b0], [[vT1, 0], [vN1, 0], [vN1, sl], [vT1, sl]], SLATE, k.D(s, 0, 1.6));
      for (const vv of [vT1 + 0.6, vN1 - 1.5]) k.stone.face([k.W(uo, vv, aisleH), k.W(ui, vv, aisleH), k.W(ui, vv, hi)], [[uo, aisleH], [ui, aisleH], [ui, hi]], wall, k.D(0, vv > 0 ? 1 : -1, 0));
    }
    // Contreforts entre les baies, fenêtres en arc brisé des bas-côtés, fenêtres hautes de la nef.
    const bays = Math.max(3, Math.floor((vN1 - vT1 - 2) / 5.4));
    const step = (vN1 - 1.5 - (vT1 + 0.6)) / bays;
    for (let i = 0; i <= bays; i++) {
      const v = vT1 + 0.6 + i * step;
      const bh = Math.min(top, aisleH * 0.95);
      box(k, k.stone, s > 0 ? uo : uo - 1.1, s > 0 ? uo + 1.1 : uo, v - 0.55, v + 0.55, 0, bh, plinth.clone().multiplyScalar(1.08));
      if (i < bays) {
        const vm = v + step / 2;
        if (top > 3) opening(k, s > 0 ? "u+" : "u-", uo, vm, 1.9, 1.7, Math.min(4.2, top - 2.4), 0.85, k.iron, GLASS, wall.clone().multiplyScalar(0.92));
        if (roofOn) opening(k, s > 0 ? "u+" : "u-", ui, vm, aisleH + aw * 0.55 + 1.0, 1.5, Math.max(1.5, eave - aisleH - aw * 0.55 - 2), 0.75, k.iron, GLASS, null);
      }
    }
  }
  // Abside polygonale et son toit en demi-cône.
  const apseH = ruinTop(eave - 1.5, ruin, rand);
  k.stone.geometry(new CylinderGeometry(apseR, apseR, apseH, 9, 1, true, -Math.PI / 2, Math.PI), k.M(0, vN1, apseH / 2), wall);
  if (roofOn) k.roof.geometry(new CylinderGeometry(0.2, apseR + 0.6, rise * 0.85, 9, 1, true, -Math.PI / 2, Math.PI), k.M(0, vN1, apseH + (rise * 0.85) / 2 - 0.4), SLATE);
  for (let i = 1; i < 5; i++) {
    const t = -Math.PI / 2 + (i / 5) * Math.PI;
    const du = Math.sin(t) * apseR;
    const dv = Math.cos(t) * apseR;
    if (apseH > 6) k.iron.geometry(new BoxGeometry(1.3, 3.8, 0.1), k.M(du * 1.01, vN1 + dv * 1.01, apseH * 0.48, t), GLASS);
    k.stone.geometry(new BoxGeometry(0.9, apseH * 0.72, 0.9), k.M(Math.sin(t + Math.PI / 10) * (apseR + 0.3), vN1 + Math.cos(t + Math.PI / 10) * (apseR + 0.3), apseH * 0.36, t + Math.PI / 10), plinth);
  }
  // Clocher-porche : fût, cordons, beffroi ajouré, flèche octogonale, clochetons d'angle.
  const towerH = ruinTop(spireTop * 0.6, ruin * 1.2, rand);
  box(k, k.stone, -ts / 2 - 0.4, ts / 2 + 0.4, vT0 - 0.4, vT1 + 0.4, 0, 1.2, plinth);
  box(k, k.stone, -ts / 2, ts / 2, vT0, vT1, 0, towerH, wall, ruin > 0.4);
  for (const y of [eave * 0.55, eave + 1.5, towerH - 7.5].filter((y) => y < towerH - 1)) box(k, k.stone, -ts / 2 - 0.25, ts / 2 + 0.25, vT0 - 0.25, vT1 + 0.25, y, y + 0.45, plinth.clone().multiplyScalar(1.1), true);
  // Portail : baie en plein cintre, voussures, vantaux de chêne.
  opening(k, "v-", vT0, 0, 0, 3.6, 6.4, 1.8, k.wood, OAK, null);
  for (let r = 0; r < 3; r++) opening(k, "v-", vT0 - 0.12 * (r + 1), 0, 0, 3.6 + r * 0.7, 6.4 + r * 0.35, 1.8 + r * 0.35, k.stone, plinth.clone().multiplyScalar(1 - r * 0.04), null);
  opening(k, "v-", vT0, 0, 6.4 + 3, 1.4, 4.2, 0.7, k.iron, GLASS, wall.clone().multiplyScalar(0.9));
  if (ruin <= 0.4) {
    for (const face of ["u+", "u-", "v+", "v-"] as const) {
      const plane = face === "u+" ? ts / 2 : face === "u-" ? -ts / 2 : face === "v+" ? vT1 : vT0;
      const along = face.startsWith("u") ? (vT0 + vT1) / 2 : 0;
      for (const o of [-1.5, 1.5]) opening(k, face, plane, along + o, towerH - 6.6, 1.4, 5.2, 0.7, k.dark, SHADOW, null);
      // Abat-sons de bois dans les baies.
      for (let j = 0; j < 5; j++) opening(k, face, plane + (face.endsWith("+") ? 0.02 : -0.02), along, towerH - 6.0 + j * 0.85, 4.2, 0.18, 0, k.wood, OAK.clone().multiplyScalar(0.8), null);
    }
    box(k, k.stone, -ts / 2 - 0.45, ts / 2 + 0.45, vT0 - 0.45, vT1 + 0.45, towerH, towerH + 0.7, plinth.clone().multiplyScalar(1.12));
    const spireH = spireTop - towerH - 0.7;
    const sp = new CylinderGeometry(0.15, ts * 0.52, spireH, 8, 1);
    k.roof.geometry(sp, k.M(0, (vT0 + vT1) / 2, towerH + 0.7 + spireH / 2, Math.PI / 8), SLATE);
    sp.dispose();
    for (const [du, dv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const pu = (du * ts) / 2 - du * 0.5;
      const pv = (vT0 + vT1) / 2 + (dv * ts) / 2 - dv * 0.5;
      k.stone.geometry(new BoxGeometry(1.0, 2.2, 1.0), k.M(pu, pv, towerH + 1.8), plinth);
      k.roof.geometry(new CylinderGeometry(0, 0.72, 3.2, 4), k.M(pu, pv, towerH + 4.5, Math.PI / 4), SLATE);
    }
    // Épi de faîtage : boule et tige de fer (pas d'emblème).
    k.iron.geometry(new SphereGeometry(0.35, 10, 8), k.M(0, (vT0 + vT1) / 2, spireTop + 0.2), IRON);
    k.iron.geometry(new CylinderGeometry(0.06, 0.06, 2.4, 6), k.M(0, (vT0 + vT1) / 2, spireTop + 1.3), IRON);
  }
  if (ruin > 0.15) rubble(k, 0, 0, Math.max(W, D) * 0.5, Math.round(50 * ruin), rand, wall);
}

function hall(k: Kit, b: Building, rand: Rand): void {
  const [W, D] = b.emprise_m;
  const P = b.params ?? {};
  const n = typeof P["piliers"] === "number" ? P["piliers"] : 8;
  const pente = ((typeof P["pente"] === "number" ? P["pente"] : 40) * Math.PI) / 180;
  const eave = 4.6;
  const rise = Math.min((D / 2) * Math.tan(pente), b.hauteur_m - eave);
  const ruin = (b as Building & { ruin?: number }).ruin ?? 0;
  const stone = new Color(0xb9b0a2);
  box(k, k.stone, -W / 2 - 0.6, W / 2 + 0.6, -D / 2 - 0.6, D / 2 + 0.6, 0, 0.35, stone);
  const post = (u: number, v: number, h: number, s = 0.5): void => {
    box(k, k.stone, u - s * 0.9, u + s * 0.9, v - s * 0.9, v + s * 0.9, 0.35, 0.95, stone.clone().multiplyScalar(0.92));
    box(k, k.wood, u - s / 2, u + s / 2, v - s / 2, v + s / 2, 0.95, h, OAK.clone().multiplyScalar(0.9 + 0.15 * rand()));
  };
  const us = Array.from({ length: n }, (_, i) => -W / 2 + (i * W) / (n - 1));
  const vs = [-D / 2, -D / 6, D / 6, D / 2];
  for (const u of us) for (const v of [-D / 2, D / 2]) post(u, v, eave);
  for (const v of vs.slice(1, -1)) for (const u of [-W / 2, W / 2]) post(u, v, eave);
  // Poteaux intérieurs (portée du grand toit) et entraits.
  for (const u of us.slice(1, -1)) for (const v of [-D / 6, D / 6]) post(u, v, eave + rise * 0.45, 0.42);
  if (ruin > 0.4) {
    rubble(k, 0, 0, Math.max(W, D) * 0.45, 40, rand, OAK);
    return;
  }
  for (const v of [-D / 2, D / 2]) box(k, k.wood, -W / 2 - 0.3, W / 2 + 0.3, v - 0.3, v + 0.3, eave, eave + 0.55, OAK);
  for (const u of [-W / 2, W / 2]) box(k, k.wood, u - 0.3, u + 0.3, -D / 2, D / 2, eave, eave + 0.55, OAK);
  for (const u of us) box(k, k.wood, u - 0.18, u + 0.18, -D / 2, D / 2, eave + 0.55, eave + 0.9, OAK.clone().multiplyScalar(0.85));
  // Liens obliques poteau → sablière.
  for (const u of us)
    for (const v of [-D / 2, D / 2]) {
      for (const s of [-1, 1]) {
        if ((u <= -W / 2 + 0.1 && s < 0) || (u >= W / 2 - 0.1 && s > 0)) continue;
        const g = new BoxGeometry(1.7, 0.2, 0.2);
        const m = k.M(u + s * 0.62, v, eave - 0.55).multiply(new Matrix4().makeRotationZ(s * 0.7));
        k.wood.geometry(g, m, OAK.clone().multiplyScalar(0.8));
        g.dispose();
      }
    }
  hip(k, k.roof, -W / 2, W / 2, -D / 2, D / 2, eave + 0.9, rise, new Color(b.teinte).lerp(new Color(0xa0644a), 0.55), 1.4);
  // Sacs et caisses sous la halle (échelle humaine).
  for (let i = 0; i < 14; i++) {
    const u = -W / 2 + 3 + rand() * (W - 6);
    const v = -D / 2 + 3 + rand() * (D - 6);
    const s = 0.6 + rand() * 0.6;
    box(k, k.wood, u - s, u + s, v - s * 0.7, v + s * 0.7, 0.35, 0.35 + s * 1.1, OAK.clone().multiplyScalar(1.1 + rand() * 0.3));
  }
}

function barracks(k: Kit, b: Building, rand: Rand): void {
  const [W, D] = b.emprise_m;
  const P = b.params ?? {};
  const pente = ((typeof P["pente"] === "number" ? P["pente"] : 38) * Math.PI) / 180;
  const court = P["cour"] === true && Math.min(W, D) > 30;
  const wd = court ? Math.min(12, Math.min(W, D) * 0.28) : D;
  const H = b.hauteur_m;
  const fh = H / b.etages;
  const wall = new Color(b.teinte);
  const trim = wall.clone().multiplyScalar(0.84);
  const ruin = (b as Building & { ruin?: number }).ruin ?? 0;
  const rise = (wd / 2) * Math.tan(pente);
  const wings: [number, number, number, number][] = court
    ? [
        [-W / 2, W / 2, -D / 2, -D / 2 + wd],
        [-W / 2, W / 2, D / 2 - wd, D / 2],
        [-W / 2, -W / 2 + wd, -D / 2 + wd, D / 2 - wd],
        [W / 2 - wd, W / 2, -D / 2 + wd, D / 2 - wd],
      ]
    : [[-W / 2, W / 2, -D / 2, D / 2]];
  wings.forEach(([u0, u1, v0, v1], wi) => {
    const top = ruinTop(H, ruin, rand);
    box(k, k.stone, u0 - 0.25, u1 + 0.25, v0 - 0.25, v1 + 0.25, 0, 0.9, trim);
    box(k, k.stone, u0, u1, v0, v1, 0, top, wall, ruin > 0.4);
    // Cordons entre étages.
    for (let f = 1; f < b.etages; f++) if (f * fh < top) box(k, k.stone, u0 - 0.15, u1 + 0.15, v0 - 0.15, v1 + 0.15, f * fh - 0.1, f * fh + 0.2, trim, true);
    if (ruin <= 0.4) {
      box(k, k.stone, u0 - 0.35, u1 + 0.35, v0 - 0.35, v1 + 0.35, H - 0.1, H + 0.35, trim, true);
      if (wi < 2) hip(k, k.roof, u0, u1, v0, v1, H + 0.35, rise, SLATE, 0.6);
      else gable(k, k.stone, u0, u1, v0 - wd / 2, v1 + wd / 2, H + 0.35, rise, "v", wall, 0.6);
      // Cheminées.
      const long = u1 - u0 > v1 - v0;
      for (let c = 1; c <= 3; c++) {
        const t = c / 4;
        const cu = long ? u0 + (u1 - u0) * t : (u0 + u1) / 2 + (wd / 4) * (c % 2 ? 1 : -1);
        const cv = long ? (v0 + v1) / 2 + (wd / 4) * (c % 2 ? 1 : -1) : v0 + (v1 - v0) * t;
        box(k, k.stone, cu - 0.6, cu + 0.6, cv - 0.45, cv + 0.45, H, H + rise + 1.4, trim);
      }
    }
    // Fenêtres sur les faces extérieures (et sur cour), par étage.
    const faces: ["u+" | "u-" | "v+" | "v-", number, number, number][] = [
      ["v-", v0, u0, u1],
      ["v+", v1, u0, u1],
      ["u-", u0, v0, v1],
      ["u+", u1, v0, v1],
    ];
    for (const [face, plane, a0, a1] of faces) {
      const len = a1 - a0;
      if (len < 6) continue;
      const nwin = Math.floor(len / 3.4);
      for (let f = 0; f < b.etages; f++) {
        const y0 = f * fh + (f === 0 ? 1.4 : 0.95);
        if (y0 + 1.8 > top) continue;
        for (let i = 0; i < nwin; i++) {
          const along = a0 + ((i + 0.5) * len) / nwin;
          // Porche de la cour au milieu de l'aile avant (rez-de-chaussée).
          if (court && wi === 0 && f === 0 && Math.abs(along) < 3.5) continue;
          opening(k, face, plane, along, y0, 1.15, Math.min(1.9, fh - 1.3), 0.12, k.iron, GLASS, trim);
        }
      }
    }
  });
  if (court) {
    // Porche voûté sur les deux faces de l'aile avant.
    for (const [face, plane] of [["v-", -D / 2], ["v+", -D / 2 + wd]] as const) {
      opening(k, face, plane, 0, 0, 4.4, 5.2, 2.2, k.dark, SHADOW, null);
      opening(k, face, plane - (face === "v-" ? 0.1 : -0.1), 0, 0, 5.6, 5.9, 2.8, k.stone, trim, null);
    }
  }
  if (ruin > 0.15) rubble(k, 0, -D / 2, W * 0.4, Math.round(70 * ruin), rand, wall);
}

/** Roue à aubes du moulin, côté canal (v négatif), à demi plongée. */
function millWheel(k: Kit, b: Building, waterY: number): void {
  const D = b.emprise_m[1];
  const R = 3.3;
  const vW = -D / 2 - 1.3;
  const yC = waterY + R - 1.1;
  for (const off of [-0.75, 0.75]) {
    const rim = new TorusGeometry(R, 0.12, 6, 28);
    k.wood.geometry(rim, k.M(0, vW + off, yC, Math.PI / 2), OAK.clone().multiplyScalar(0.75));
    rim.dispose();
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const pu = Math.cos(a) * (R - 0.35);
    const py = Math.sin(a) * (R - 0.35);
    const pad = new BoxGeometry(0.12, 0.75, 1.7);
    k.wood.geometry(pad, k.M(pu, vW, yC + py).multiply(new Matrix4().makeRotationZ(a)), OAK.clone().multiplyScalar(0.7));
    pad.dispose();
    if (i % 2 === 0) {
      const sp = new BoxGeometry(R * 2, 0.14, 0.14);
      k.wood.geometry(sp, k.M(0, vW, yC).multiply(new Matrix4().makeRotationZ(a)), OAK.clone().multiplyScalar(0.65));
      sp.dispose();
    }
  }
  const axle = new CylinderGeometry(0.28, 0.28, 3.4, 10);
  k.iron.geometry(axle, k.M(0, vW + 0.9, yC).multiply(new Matrix4().makeRotationX(Math.PI / 2)), IRON);
  axle.dispose();
}

export const CUSTOM_ARCHETYPES = ["eglise", "halle", "caserne"] as const;

export interface LandmarkMeshes {
  group: Group;
  /** Identifiants des repères construits ici en entier (exclus du rendu « grande maison »). */
  handled: Set<string>;
  dispose(): void;
}

export function buildLandmarks(list: readonly (Building & { ruin?: number })[], mats: LandmarkMaterials, waterY: number, seed: number): LandmarkMeshes {
  const group = new Group();
  group.name = "batiments-reperes";
  const handled = new Set<string>();
  for (const b of list) {
    const k = kitFor(b);
    const rand = seeded(seed * 31 + hashStr(b.id));
    if (b.archetype === "eglise") church(k, b, rand);
    else if (b.archetype === "halle") hall(k, b, rand);
    else if (b.archetype === "caserne" && b.params?.["cour"] === true) barracks(k, b, rand);
    else if (b.archetype === "moulin" && b.params?.["roue"] === true) {
      millWheel(k, b, waterY);
    } else continue;
    if (b.archetype !== "moulin") handled.add(b.id);
    const add = (fb: FaceBuilder, m: Material, part: string): void => {
      if (fb.pos.length === 0) return;
      const mesh = new Mesh(fb.build(), m);
      mesh.name = `repere-${b.id}-${part}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    };
    add(k.stone, mats.stone, "murs");
    add(k.dark, mats.dark, "baies");
    add(k.wood, mats.wood, "bois");
    add(k.iron, mats.iron, "vitres");
    add(k.roof, b.couverture === "ardoise" ? mats.roof : mats.tile, "toit");
  }
  return {
    group,
    handled,
    dispose() {
      group.traverse((x) => {
        if (x instanceof Mesh) (x.geometry as BufferGeometry).dispose();
      });
    },
  };
}
