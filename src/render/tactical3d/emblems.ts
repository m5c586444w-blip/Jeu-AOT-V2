import { Color, Group, Mesh, MeshStandardMaterial, Shape, ShapeGeometry } from "three";
import type { BufferGeometry } from "three";

/**
 * Emblèmes des quatre corps (dette n° 72, `CLAUDE.md` § Style des soldats, D-163) : formes vectorielles **redessinées par le
 * projet** d'après les descriptions de l'œuvre (aucun fichier, aucun décalque). Présence et motif : C ; tracé, proportions et
 * couleurs de fond : A ou ? (Q18).
 * - Corps de Reconnaissance : Ailes de la liberté, une aile blanche et une aile bleue qui se chevauchent ;
 * - Garnison : deux roses, une rouge et une blanche ;
 * - Brigade Militaire : tête de licorne de profil ;
 * - Corps d'Entraînement : deux épées croisées.
 * Chaque emblème est posé sur un écu à liseré sombre. Repère : écu de 1 unité de large, centré, face vers +z ; géométries
 * plates (aucune texture), partagées entre soldats.
 */
export type EmblemId = "ailes" | "roses" | "licorne" | "epees";
export const EMBLEM_IDS: readonly EmblemId[] = ["ailes", "roses", "licorne", "epees"];

/** Couleurs (A ; teintes exactes : ? , Q18). */
const PALETTE = {
  liseré: "#2B2620",
  fond: "#D9CFB6",
  blanc: "#FBFAF6",
  bleu: "#2F5D9A",
  rouge: "#A3262A",
  rose_blanche: "#EFE9DC",
  coeur: "#C9A14A",
  tige: "#3F5E35",
  licorne: "#3E6B4A",
  acier: "#B9BEC4",
  garde: "#7A5A2E",
} as const;

const mats = new Map<string, MeshStandardMaterial>();
const mat = (hex: string): MeshStandardMaterial => {
  let m = mats.get(hex);
  if (!m) {
    m = new MeshStandardMaterial({ color: new Color(hex), roughness: 0.85 });
    mats.set(hex, m);
  }
  return m;
};

/** Écu : haut droit, flancs, pointe arrondie en bas (largeur 1, hauteur 1,15). */
function shieldShape(scale = 1): Shape {
  const s = new Shape();
  const w = 0.5 * scale;
  const top = 0.55 * scale;
  s.moveTo(-w, top);
  s.lineTo(w, top);
  s.lineTo(w, 0.02 * scale);
  s.quadraticCurveTo(w * 0.95, -0.42 * scale, 0, -0.6 * scale);
  s.quadraticCurveTo(-w * 0.95, -0.42 * scale, -w, 0.02 * scale);
  s.closePath();
  return s;
}

/** Aile déployée vers +x (miroir pour −x) : bord d'attaque courbe, quatre rémiges en festons au bord de fuite. */
function wingShape(dir: 1 | -1): Shape {
  const s = new Shape();
  const X = (x: number): number => dir * x;
  s.moveTo(X(-0.02), -0.2);
  s.quadraticCurveTo(X(0.08), 0.32, X(0.4), 0.42);
  // Rémiges : du bout de l'aile vers la base, chaque plume pointe vers le bas et l'extérieur.
  const tips: [number, number, number, number][] = [
    [0.36, 0.14, 0.3, 0.2],
    [0.28, -0.02, 0.22, 0.06],
    [0.2, -0.16, 0.14, -0.08],
    [0.11, -0.28, 0.05, -0.2],
  ];
  let [px, py] = [0.4, 0.42];
  for (const [tx, ty, nx, ny] of tips) {
    s.quadraticCurveTo(X((px + tx) / 2 + 0.03), (py + ty) / 2, X(tx), ty);
    s.lineTo(X(nx), ny);
    [px, py] = [nx, ny];
  }
  s.lineTo(X(-0.02), -0.2);
  return s;
}

function circle(x: number, y: number, r: number): Shape {
  const s = new Shape();
  s.absarc(x, y, r, 0, Math.PI * 2, false);
  return s;
}

function rect(cx: number, cy: number, w: number, h: number, angle = 0): Shape {
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  const pts: [number, number][] = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];
  const s = new Shape();
  pts.forEach(([x, y], i) => {
    const X = cx + x * c - y * sn;
    const Y = cy + x * sn + y * c;
    if (i === 0) s.moveTo(X, Y);
    else s.lineTo(X, Y);
  });
  s.closePath();
  return s;
}

/** Rose vue de face : cinq pétales en couronne, un cœur. */
function rose(cx: number, cy: number, r: number): Shape[] {
  const out: Shape[] = [];
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + (i * Math.PI * 2) / 5;
    out.push(circle(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.5));
  }
  return out;
}

/** Tête de licorne de profil, tournée vers la gauche : chanfrein, naseau, ganache, encolure, crinière, corne. */
function unicornHead(): Shape {
  const pts: [number, number][] = [
    [-0.34, 0.02],
    [-0.36, -0.06],
    [-0.3, -0.1],
    [-0.16, -0.06],
    [-0.04, -0.12],
    [0.06, -0.3],
    [0.24, -0.32],
    [0.2, -0.12],
    [0.26, 0.04],
    [0.22, 0.16],
    [0.14, 0.24],
    [0.06, 0.26],
    [-0.02, 0.22],
    [-0.12, 0.18],
  ];
  const s = new Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return s;
}

const cache = new Map<EmblemId, { parts: [BufferGeometry, string, number][] }>();

/** Pièces d'un emblème : (géométrie, couleur, couche) ; la couche décale vers l'avant pour éviter le scintillement. */
function emblemParts(id: EmblemId): [BufferGeometry, string, number][] {
  const hit = cache.get(id);
  if (hit) return hit.parts;
  const parts: [BufferGeometry, string, number][] = [
    [new ShapeGeometry(shieldShape(1.1), 6), PALETTE.liseré, 0],
    [new ShapeGeometry(shieldShape(1), 6), PALETTE.fond, 1],
  ];
  const add = (shapes: Shape | Shape[], color: string, layer: number): void => {
    parts.push([new ShapeGeometry(shapes, 8), color, layer]);
  };
  switch (id) {
    case "ailes":
      // L'aile blanche derrière, à gauche ; l'aile bleue devant, à droite (elles se chevauchent au centre).
      add(wingShape(-1).clone(), PALETTE.blanc, 2);
      parts[parts.length - 1]?.[0].translate(0.04, 0.02, 0);
      add(wingShape(1), PALETTE.bleu, 3);
      parts[parts.length - 1]?.[0].translate(-0.04, 0, 0);
      // Liseré des plumes : l'aile blanche cernée pour rester lisible sur le fond clair.
      add(wingShape(-1), PALETTE.liseré, 1.5);
      parts[parts.length - 1]?.[0].scale(1.09, 1.07, 1).translate(0.04, 0.02, 0);
      break;
    case "roses":
      add([rect(-0.16, -0.24, 0.025, 0.36, 0.25), rect(0.16, -0.24, 0.025, 0.36, -0.25)], PALETTE.tige, 2);
      add(rose(-0.18, 0.12, 0.2), PALETTE.rouge, 3);
      add(rose(0.18, 0.12, 0.2), PALETTE.rose_blanche, 3);
      add(rose(0.18, 0.12, 0.21), PALETTE.liseré, 2.5);
      add([circle(-0.18, 0.12, 0.06), circle(0.18, 0.12, 0.06)], PALETTE.coeur, 4);
      break;
    case "licorne": {
      add(unicornHead(), PALETTE.licorne, 2);
      // Corne torsadée vers le haut et l'avant ; crinière en mèches le long de l'encolure.
      const horn = new Shape();
      horn.moveTo(-0.08, 0.2);
      horn.lineTo(-0.3, 0.48);
      horn.lineTo(-0.02, 0.24);
      horn.closePath();
      add(horn, PALETTE.coeur, 3);
      add([rect(0.24, 0.0, 0.05, 0.16, -0.5), rect(0.22, -0.16, 0.05, 0.16, -0.4), rect(0.18, 0.14, 0.05, 0.14, -0.7)], PALETTE.liseré, 3);
      add(circle(-0.14, 0.08, 0.025), PALETTE.liseré, 3);
      break;
    }
    case "epees":
      for (const a of [Math.PI / 4, -Math.PI / 4]) {
        const c = Math.cos(a + Math.PI / 2);
        const sn = Math.sin(a + Math.PI / 2);
        add(rect(0, 0, 0.06, 0.82, a), PALETTE.acier, 2);
        add(rect(-0.3 * c, -0.3 * sn, 0.22, 0.04, a), PALETTE.garde, 3);
        add(rect(-0.37 * c, -0.37 * sn, 0.05, 0.12, a), PALETTE.garde, 3);
      }
      break;
  }
  cache.set(id, { parts });
  return parts;
}

/**
 * Emblème posé sur l'étoffe : groupe plat de `width` mètres de large, face vers +z, couches décalées de 0,4 mm.
 * Nommé `embleme-<id>` (contrôles et planches).
 */
export function buildEmblem(id: EmblemId, width: number): Group {
  const g = new Group();
  g.name = `embleme-${id}`;
  for (const [geo, color, layer] of emblemParts(id)) {
    const m = new Mesh(geo, mat(color));
    m.position.z = layer * 0.0004;
    m.scale.setScalar(width);
    g.add(m);
  }
  return g;
}

/** Corps de chaque emblème (pour l'interface et les contrôles). */
export const EMBLEM_OF: Readonly<Record<EmblemId, string>> = {
  ailes: "Corps de Reconnaissance",
  roses: "Garnison",
  licorne: "Brigade Militaire",
  epees: "Corps d'Entraînement",
};

/** Étoile à neuf branches du brassard des Eldiens de Marley (C ; couleurs ? , Q18) : `width` mètres, face vers +z. */
export function buildStar(width: number, hex: string): Mesh {
  const s = new Shape();
  for (let i = 0; i < 18; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 9;
    const r = i % 2 === 0 ? 0.5 : 0.24;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const m = new Mesh(new ShapeGeometry(s, 4), mat(hex));
  m.name = "etoile-brassard";
  m.scale.setScalar(width);
  return m;
}
