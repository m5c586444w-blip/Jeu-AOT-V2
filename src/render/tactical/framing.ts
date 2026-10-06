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
  /** Marge haute retenue au-dessus des porteurs (px). */
  topMarginPx?: number;
}

export const project = (x: number, y: number, z: number): [number, number] => [x, y * TILT - z];

/** Rapport de la scène à la scène de référence : les seuils d'échelle réglés à 1366×768 le suivent (R0.3). */
export const sceneScale = (width: number, height: number): number => Math.max(1, Math.min(width / FRAME_REF_W, height / FRAME_REF_H));

/** Sous ce zoom (px/m, × `sceneScale`), vue d'ensemble : pastilles d'escouade, soldats en points, Titans agrandis (revue de P4). */
export const OVERVIEW_ZOOM = 4;
/** Hauteur minimale d'un Titan à l'écran (px) : en vue d'ensemble, puis en vue détaillée. */
export const OVERVIEW_TITAN_PX = 42;
export const MIN_TITAN_PX = 22;
/** Halo de l'éclair de transformation d'un porteur (P6) : 15 m de rayon au plus. */
export const TRANSFORM_HALO_M = 15;
/**
 * Zigzags des éclairs (transformation, puis corps qui surgit, R0.2f) : ils tombent du ciel depuis 1,4 × la hauteur dessinée
 * du Titan. Leur moitié basse reste sous la tête, donc dans le champ (D-85).
 */
export const BODY_BOLT = 1.4;

/** Hauteur DESSINÉE d'un Titan (m) : sa taille, ou la taille minimale à l'écran si elle est plus grande. */
export function drawnTitanHeight(height: number, zoom: number, width: number, sceneH: number): number {
  const overview = zoom < OVERVIEW_ZOOM * sceneScale(width, sceneH);
  return Math.max(height, (overview ? OVERVIEW_TITAN_PX : MIN_TITAN_PX) / zoom);
}

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

/**
 * Marge de cadrage haute (px) au-dessus de la tête des porteurs (R0, critère f rouvert) : 10 px visés. Elle se réduit par
 * paliers de 2 px, jusqu'à 2 px au moins, seulement si le sol doit garder 85 % de la scène (D-78) — cas d'un porteur collé au
 * bord nord avec les hommes au bord sud (D-85).
 */
export const FRAME_TOP_MARGIN_PX = 10;
export const FRAME_TOP_MARGIN_MIN_PX = 2;
/** Part de la scène couverte par le sol de la carte, visée au cadrage (D-78). */
export const GROUND_SHARE_MIN = 0.85;

/** Taille d'un homme (m) : sa tête doit être dans le champ comme ses pieds. */
const MAN_HEIGHT = 1.8;
/** Marge (m) autour de l'emprise « à voir absolument » : côtés, sous les pieds (au-dessus des têtes : FRAME_TOP_MARGIN_PX). */
const MUST_SIDE = 6;
const MUST_FOOT = 4;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Cadrage d'ouverture (R0, critère f, décision de l'utilisateur ; rouvert à la revue de R0) :
 * - « à voir absolument » : les hommes du joueur (pieds et tête) et, pour les porteurs, la figure que la scène dessine (à sa
 *   hauteur dessinée, tête comprise : `shifterExtent`), avec une marge haute de FRAME_TOP_MARGIN_PX pixels (réduite jusqu'à
 *   FRAME_TOP_MARGIN_MIN_PX si le sol tomberait sous 85 % de la scène) ;
 * - l'échelle est la plus grande qui remplit l'écran autour des unités (couvrir, au plus 30 % au-delà de « tout voir »),
 *   plafonnée par la taille de la scène, sans jamais dépasser celle qui contient l'emprise « à voir absolument »,
 *   ni descendre sous l'échelle « carte entière », sauf si cette emprise l'exige ;
 * - le cadre est centré sur les unités, puis ramené sur l'emprise « à voir absolument » (y compris après le recalage sur la
 *   carte) ; les marges au-delà des bords nord et sud suivent cette emprise ;
 * - les Titans qui ne tiennent pas dans le champ sont signalés par des flèches de bord (`edgeArrows`).
 */
export function computeFrame(input: FrameInput): Frame {
  let f = solveFrame(input, FRAME_TOP_MARGIN_PX);
  for (let m = FRAME_TOP_MARGIN_PX - 2; m >= FRAME_TOP_MARGIN_MIN_PX && groundShare(f, input) < GROUND_SHARE_MIN; m -= 2) f = solveFrame(input, m);
  return f;
}

/** Part de la scène couverte par le sol de la carte (0 à 1). */
export function groundShare(f: Pick<Frame, "zoom" | "x" | "y">, s: Pick<FrameInput, "width" | "height" | "mapW" | "mapH">): number {
  const gx = Math.max(0, Math.min(s.width, s.mapW * f.zoom + f.x) - Math.max(0, f.x));
  const gy = Math.max(0, Math.min(s.height, s.mapH * TILT * f.zoom + f.y) - Math.max(0, f.y));
  return (gx * gy) / (s.width * s.height);
}

/** Cadre pour une marge haute donnée (px). */
function solveFrame(input: FrameInput, marginPx: number): Frame {
  // La taille DESSINÉE d'un porteur dépend de l'échelle (figure agrandie en vue d'ensemble) : on cherche le point fixe en
  // partant de l'échelle maximale ; la suite des échelles décroît et se stabilise en quelques tours.
  let z = FRAME_MAX_ZOOM * sceneScale(input.width, input.height);
  let f = frameAt(input, z, marginPx);
  for (let i = 0; i < 24 && Math.abs(f.zoom - z) > 1e-6; i++) {
    z = f.zoom;
    f = frameAt(input, z, marginPx);
  }
  return { ...f, topMarginPx: marginPx };
}

/**
 * Étendue DESSINÉE d'un porteur autour de ses pieds (m), à l'échelle `zoom` (R0, critère f rouvert) : la figure du Titan
 * telle que la scène la trace (figures.ts), à sa hauteur dessinée (agrandie en vue d'ensemble) : tête jusqu'à 1,05 × cette
 * hauteur (mesuré : 1,041 au plus sur les 10 silhouettes), largeur ±0,36, pieds 0,06 sous le sol.
 * Les éclairs (halos, zigzags qui tombent du ciel depuis 1,4 × la hauteur) ne sont garantis qu'au pied et sur leur moitié
 * basse : les garder entiers obligerait à montrer du vide au-dessus d'un porteur placé au bord nord, et le sol tomberait
 * sous 85 % de la scène (D-85).
 */
export function shifterExtent(reach: number, zoom: number, width: number, height: number): { up: number; down: number; side: number } {
  const dh = drawnTitanHeight(reach, zoom, width, height);
  return { up: dh * 1.05, down: dh * 0.07, side: dh * 0.37 };
}

function frameAt(input: FrameInput, z: number, marginPx: number): Frame {
  const { width, height, mapW: mw, mapH: mh, points } = input;
  const fz = fitZoom(width, height, mw, mh);
  const mapH = mh * TILT;
  // Emprise au sol de toutes les unités, rognée à la carte : « couvrir » remplit l'écran de sol.
  const feet = points.map((p) => project(p.x, p.y, 0));
  const xs = feet.map((p) => p[0]);
  const ys = feet.map((p) => p[1]);
  const all: Box = { x0: Math.max(0, Math.min(...xs) - 12), x1: Math.min(mw, Math.max(...xs) + 12), y0: Math.max(0, Math.min(...ys) - 25), y1: Math.min(mapH, Math.max(...ys) + 12) };
  // Emprise « à voir absolument » : pieds et têtes des hommes ; tout ce qui est dessiné pour les porteurs (figure, éclairs).
  const must = points.filter((p) => p.own || (p.reach ?? 0) > 0);
  // Marge de cadrage haute, en pixels à l'écran, au-dessus de ce qui est dessiné (têtes des hommes et des porteurs).
  const top = marginPx / z;
  // Côtés : 6 m autour des hommes ; autour d'un porteur, la largeur réelle de sa figure et 4 px (pas 6 m de plus : un porteur
  // au bord de la carte ferait montrer 6 m de vide au-delà, D-85).
  const mustBoxes = must.map((p): Box => {
    const [px, py] = project(p.x, p.y, 0);
    if (p.own) return { x0: px - MUST_SIDE, x1: px + MUST_SIDE, y0: py - MAN_HEIGHT - top, y1: py + MUST_FOOT };
    const e = shifterExtent(p.reach ?? 0, z, width, height);
    return { x0: px - e.side - 4 / z, x1: px + e.side + 4 / z, y0: py - e.up - top, y1: py + Math.max(e.down, MUST_FOOT) };
  });
  const mb: Box | null = mustBoxes.length
    ? { x0: Math.min(...mustBoxes.map((q) => q.x0)), x1: Math.max(...mustBoxes.map((q) => q.x1)), y0: Math.min(...mustBoxes.map((q) => q.y0)), y1: Math.max(...mustBoxes.map((q) => q.y1)) }
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
