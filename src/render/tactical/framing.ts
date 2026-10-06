/**
 * Cadrage de la caméra tactique, en pur calcul (aucun Pixi) : testable par tableau de scénarios
 * (tests/render/framing.test.ts). La scène applique le résultat (échelle, position, marges au-delà des bords).
 */

/** Inclinaison de la vue (projection y → y × TILT − z). */
export const TILT = 0.8;
/** Échelle maximale du cadrage (px/m) pour la scène de référence (1014×588, soit 1366×768) ; elle suit la taille de la scène. */
export const FRAME_MAX_ZOOM = 6;
export const FRAME_REF_W = 1014;
export const FRAME_REF_H = 588;

export interface UnitPose {
  x: number;
  y: number;
  z: number;
  /** Hauteur à garder dans le champ au cadrage (m) : un porteur qui va se transformer (R0.2f). */
  reach?: number;
  /** Homme du joueur : toujours dans le champ au cadrage (R0.4). */
  own?: boolean;
}

export interface FrameInput {
  /** Taille de la scène (px). */
  width: number;
  height: number;
  /** Taille de la carte (m), avant inclinaison. */
  mapW: number;
  mapH: number;
  points: readonly UnitPose[];
}

export interface Frame {
  zoom: number;
  /** Position du calque du monde (px) : écran = monde projeté × zoom + (x, y). */
  x: number;
  y: number;
  fitZoom: number;
  /** Marges (m) au-delà des bords nord et sud que la caméra peut montrer. */
  topMargin: number;
  bottomMargin: number;
}

export const project = (x: number, y: number, z: number): [number, number] => [x, y * TILT - z];

/** Rapport de la scène à la scène de référence : les seuils d'échelle réglés à 1366×768 le suivent (R0.3). */
export const sceneScale = (width: number, height: number): number => Math.max(1, Math.min(width / FRAME_REF_W, height / FRAME_REF_H));

/** Échelle « carte entière » (marges comprises). */
export const fitZoom = (width: number, height: number, mapW: number, mapH: number): number => Math.min(width / (mapW + 40), height / (mapH * TILT + 120));

/** Garde la carte sous la vue quand elle est plus grande que l'écran (pas de bande vide inutile). */
export function clampToMap(f: Frame, width: number, height: number, mapW: number, mapH: number): { x: number; y: number } {
  const z = f.zoom;
  const right = mapW * z;
  const top = -f.topMargin * z;
  const bottom = (mapH * TILT + f.bottomMargin) * z;
  const x = right > width ? Math.min(0, Math.max(width - right, f.x)) : f.x;
  const y = bottom - top > height ? Math.min(-top, Math.max(height - bottom, f.y)) : f.y;
  return { x, y };
}

/** Taille d'un homme (m) : sa tête doit être dans le champ comme ses pieds. */
const MAN_HEIGHT = 1.8;
/** Marge (m) autour de l'emprise « à voir absolument » : côtés, au-dessus des têtes, sous les pieds. */
const MUST_SIDE = 6;
const MUST_TOP = 3;
const MUST_FOOT = 4;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Cadrage d'ouverture (R0, critère f, décision de l'utilisateur) :
 * - « à voir absolument » : les hommes du joueur (pieds et tête) et les porteurs (pieds et tête du Titan à venir) ;
 * - l'échelle est la plus grande qui remplit l'écran autour des unités (couvrir, au plus 30 % au-delà de « tout voir »),
 *   plafonnée par la taille de la scène, sans jamais dépasser celle qui contient l'emprise « à voir absolument »,
 *   ni descendre sous l'échelle « carte entière », sauf si cette emprise l'exige ;
 * - le cadre est centré sur les unités, puis ramené sur l'emprise « à voir absolument » (y compris après le recalage sur la
 *   carte) ; les marges au-delà des bords nord et sud suivent cette emprise ;
 * - les Titans qui ne tiennent pas dans le champ sont signalés par des flèches de bord (`edgeArrows`).
 */
export function computeFrame(input: FrameInput): Frame {
  const { width, height, mapW: mw, mapH: mh, points } = input;
  const fz = fitZoom(width, height, mw, mh);
  const mapH = mh * TILT;
  // Emprise au sol de toutes les unités, rognée à la carte : « couvrir » remplit l'écran de sol.
  const feet = points.map((p) => project(p.x, p.y, 0));
  const xs = feet.map((p) => p[0]);
  const ys = feet.map((p) => p[1]);
  const all: Box = { x0: Math.max(0, Math.min(...xs) - 12), x1: Math.min(mw, Math.max(...xs) + 12), y0: Math.max(0, Math.min(...ys) - 25), y1: Math.min(mapH, Math.max(...ys) + 12) };
  // Emprise « à voir absolument » : pieds et têtes des hommes et des porteurs, avec marges.
  const must = points.filter((p) => p.own || (p.reach ?? 0) > 0);
  const mustPts = must.flatMap((p) => [project(p.x, p.y, 0), project(p.x, p.y, p.own ? MAN_HEIGHT : (p.reach ?? 0))]);
  const mb: Box | null = mustPts.length
    ? { x0: Math.min(...mustPts.map((q) => q[0])) - MUST_SIDE, x1: Math.max(...mustPts.map((q) => q[0])) + MUST_SIDE, y0: Math.min(...mustPts.map((q) => q[1])) - MUST_TOP, y1: Math.max(...mustPts.map((q) => q[1])) + MUST_FOOT }
    : null;
  const box: Box = mb ? { x0: Math.min(all.x0, mb.x0), x1: Math.max(all.x1, mb.x1), y0: Math.min(all.y0, mb.y0), y1: Math.max(all.y1, mb.y1) } : all;
  const contain = Math.min(width / (box.x1 - box.x0), height / (box.y1 - box.y0));
  const cover = Math.max(width / (box.x1 - box.x0), height / (box.y1 - box.y0));
  const containMust = mb ? Math.min(width / (mb.x1 - mb.x0), height / (mb.y1 - mb.y0)) : Infinity;
  const zoom = Math.max(Math.min(fz, containMust), Math.min(FRAME_MAX_ZOOM * sceneScale(width, height), cover, contain * 1.3, containMust));
  const topMargin = Math.max(15, mb ? -mb.y0 : 0);
  const bottomMargin = Math.max(0, mb ? mb.y1 - mapH : 0);
  // Ramène le cadre sur l'emprise « à voir absolument » (elle tient : l'échelle la contient).
  const keep = (x: number, y: number): { x: number; y: number } =>
    // Écran = monde × zoom + décalage : le haut de l'emprise voit si y ≥ −y0·zoom, le bas si y ≤ hauteur − y1·zoom.
    mb ? { x: Math.min(Math.max(x, -mb.x0 * zoom), width - mb.x1 * zoom), y: Math.min(Math.max(y, -mb.y0 * zoom), height - mb.y1 * zoom) } : { x, y };
  const centred = keep(width / 2 - ((box.x0 + box.x1) / 2) * zoom, height / 2 - ((box.y0 + box.y1) / 2) * zoom);
  const f: Frame = { zoom, x: centred.x, y: centred.y, fitZoom: fz, topMargin, bottomMargin };
  const clamped = clampToMap(f, width, height, mw, mh);
  return { ...f, ...keep(clamped.x, clamped.y) };
}

export interface EdgeArrow {
  /** Position de la flèche dans la scène (px), au bord du champ. */
  x: number;
  y: number;
  /** Direction vers le Titan hors champ (radians, repère écran). */
  angle: number;
  /** Index du Titan. */
  titan: number;
}

/** Retrait des flèches depuis le bord du champ (px). */
export const ARROW_INSET = 22;

/**
 * Flèches de bord (R0, critère f) : chaque Titan vivant dont les pieds et la tête sont hors champ est signalé par une flèche
 * posée au bord du champ, sur la droite qui joint le centre de la scène au Titan, et tournée vers lui.
 */
export function edgeArrows(f: Pick<Frame, "zoom" | "x" | "y">, titans: readonly { x: number; y: number; height: number; alive: boolean }[], width: number, height: number): EdgeArrow[] {
  const out: EdgeArrow[] = [];
  const cx = width / 2;
  const cy = height / 2;
  const scr = (x: number, y: number, z: number): [number, number] => {
    const [px, py] = project(x, y, z);
    return [px * f.zoom + f.x, py * f.zoom + f.y];
  };
  const inView = ([x, y]: [number, number]): boolean => x >= 0 && x <= width && y >= 0 && y <= height;
  titans.forEach((t, i) => {
    if (!t.alive || inView(scr(t.x, t.y, 0)) || inView(scr(t.x, t.y, t.height))) return;
    const [tx, ty] = scr(t.x, t.y, t.height / 2);
    const dx = tx - cx;
    const dy = ty - cy;
    // Intersection du rayon centre → Titan avec le rectangle du champ, rentré de ARROW_INSET.
    const hx = Math.max(1, cx - ARROW_INSET);
    const hy = Math.max(1, cy - ARROW_INSET);
    const k = Math.min(dx !== 0 ? hx / Math.abs(dx) : Infinity, dy !== 0 ? hy / Math.abs(dy) : Infinity);
    out.push({ x: cx + dx * k, y: cy + dy * k, angle: Math.atan2(dy, dx), titan: i });
  });
  return out;
}
