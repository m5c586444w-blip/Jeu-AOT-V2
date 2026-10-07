import { Application, Container, Graphics } from "pixi.js";
import type { Sprite } from "pixi.js";
import type { MapData } from "../data/map";
import type { TerrainData } from "../data/terrain";
import { pointInPolygon } from "../sim/strategic/geometry";
import type { Point } from "../sim/strategic/geometry";
import { drawDepot, drawExpeditionMarker, drawPawn, drawRoute } from "./atlasLayers";
import type { ProvinceShape } from "./atlasLayers";
import { flat } from "./ink";
import { LabelLayer, LOD_ORDER } from "./labels";
import type { LabelSpec, Lod } from "./labels";
import { BRICK, UNKNOWN } from "./palette";
import type { TerrainImage } from "./terrainRaster";
import { drawCoast, drawOpenSea, drawRivers, drawRoads, drawTowns, drawVeil, drawWalls, MAP_INK, TERRAIN_TEXTURE_FINE, terrainSprite, terrainTexture, wallRadiusAt } from "./terrainLayers";

export type { Lod } from "./labels";

export interface MapProvince extends ProvinceShape {
  name: string;
  canon: string;
  visibility: "connue" | "partielle" | "inexplore";
}

/** État variable affiché sur la carte (fourni par l'interface à partir de l'état de simulation). */
export interface MapDynamic {
  provinces: Record<string, { structure: number | null; garrisonOrg: string | null; control: string }>;
}

/** Itinéraires, positions et dépôts de la couche militaire (P3), en coordonnées de carte (km). */
export interface MapRoutes {
  routes: { points: Point[]; style: "plan" | "aller" | "retour" | "convoi" }[];
  markers: { at: Point; kind: "expedition" | "convoi" }[];
  depots: { at: Point; radius: number }[];
}

export interface MapFilters {
  pawns: boolean;
  labels: boolean;
  walls: boolean;
  fog: boolean;
}

export interface MapCallbacks {
  hover(id: string | null, screen: Point): void;
  click(id: string | null): void;
  doubleClick(id: string | null): void;
  camera(): void;
}

const WALL_LABELS: Record<string, { name: string; bearing: number }> = {
  maria: { name: "MUR MARIA", bearing: 338 },
  rose: { name: "MUR ROSE", bearing: 20 },
  sina: { name: "MUR SINA", bearing: 340 },
};

/**
 * Carte stratégique réaliste de l'île (MAP, E-UX-3) : terrain figé (data/map/terrain), provinces, murs, villes,
 * routes ; rendu Pixi, caméra, niveaux de détail, sélection.
 */
export class StrategicMap {
  private readonly world = new Container();
  private readonly gSea = new Graphics();
  private readonly terrainImage: Sprite;
  private readonly gWash = new Graphics();
  private readonly gBorders = new Graphics();
  private readonly gRivers = new Graphics();
  private readonly gRoads = new Graphics();
  private readonly gWalls = new Graphics();
  private readonly gTowns = new Graphics();
  private readonly gFog = new Graphics();
  private readonly gPawns = new Graphics();
  private readonly gRoutes = new Graphics();
  private readonly gHighlight = new Graphics();
  private readonly labels: LabelLayer;
  private zoom = 1;
  private fitZoom = 1;
  private bucket = Number.NaN;
  private overlay: ReadonlyMap<string, number> | null = null;
  private dynamic: MapDynamic = { provinces: {} };
  private routes: MapRoutes = { routes: [], markers: [], depots: [] };
  private filters: MapFilters = { pawns: true, labels: true, walls: true, fog: true };
  private hovered: string | null = null;
  private selected: string | null = null;
  private readonly byId: Map<string, MapProvince>;
  /** Appelé après chaque mouvement de caméra (affichage du niveau de détail, tests). */
  onCamera: (() => void) | null = null;

  private constructor(
    private readonly app: Application,
    private readonly map: MapData,
    private readonly provinces: readonly MapProvince[],
    labelSpecs: readonly LabelSpec[],
    private readonly terrain: TerrainData,
  ) {
    this.byId = new Map(provinces.map((p) => [p.id, p]));
    this.labels = new LabelLayer(
      labelSpecs,
      terrain.walls.map((w) => {
        const bearing = WALL_LABELS[w.wall]?.bearing ?? 0;
        return { name: WALL_LABELS[w.wall]?.name ?? w.wall, radius: wallRadiusAt(terrain, w.wall, bearing) + w.band_km / 2 + 9, bearing };
      }),
    );
    drawOpenSea(this.gSea, terrain.bounds);
    this.terrainImage = terrainSprite(terrain);
    this.world.addChild(this.gSea, this.terrainImage, this.gWash, this.gRivers, this.gBorders, this.gRoads, this.gWalls, this.gTowns, this.gFog, this.gPawns, this.gRoutes, this.gHighlight, this.labels.container);
    app.stage.addChild(this.world);
  }

  static async create(host: HTMLElement, map: MapData, provinces: readonly MapProvince[], labels: readonly LabelSpec[], terrain: TerrainData): Promise<StrategicMap> {
    const app = new Application();
    await app.init({ resizeTo: host, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1), preference: "webgl" });
    app.canvas.classList.add("carte__toile");
    app.canvas.setAttribute("role", "img");
    host.append(app.canvas);
    const m = new StrategicMap(app, map, provinces, labels, terrain);
    m.fit();
    m.refineTerrain();
    // Les tailles des noms changent quand les polices auto-hébergées finissent de charger : on replace les noms.
    void document.fonts?.ready.then(() => m.labels.update(m.zoom / m.uiScale, m.lod, m.filters.labels, m.iconPoints()));
    return m;
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  get lod(): Lod {
    const r = this.zoom / this.fitZoom;
    return r < 1.6 ? "monde" : r < 3.2 ? "region" : "province";
  }

  /** Échelle des traits, icônes et noms selon la taille de l'écran : lisibles en 4K comme en 1366×768. */
  get uiScale(): number {
    return Math.max(1, Math.min(2.4, this.app.screen.height / 900));
  }

  /** Icônes visibles au niveau courant (villes, portes, pions) : les noms se placent à côté. */
  private iconPoints(): number[][] {
    const RANK = { hameau: 0, bourg: 1, fort: 1, ville: 2, district: 3, capitale: 4 } as const;
    const minRank = [2, 1, 0][LOD_ORDER.indexOf(this.lod)] ?? 0;
    const pts: number[][] = this.terrain.towns.filter((t) => RANK[t.size] >= minRank).map((t) => [...t.at]);
    if (this.filters.walls) for (const g of this.terrain.gates) pts.push([g.at[0], g.at[1], 7]);
    if (this.filters.pawns) {
      for (const p of this.provinces) if (this.dynamic.provinces[p.id]?.garrisonOrg) pts.push([...(this.terrain.provinces[p.id]?.pawn ?? p.anchor)]);
    }
    return pts;
  }

  get zoomLevel(): number {
    return this.zoom;
  }

  /** Cadre toute l'île dans la vue. */
  /** Suspend (true) ou reprend le rendu de la carte, masquée par l'écran de bataille (P4). */
  setSuspended(on: boolean): void {
    if (on) this.app.stop();
    else this.app.start();
  }

  fit(): void {
    const [x0, y0, x1, y1] = this.map.bounds;
    const { width, height } = this.app.screen;
    this.fitZoom = Math.min(width / (x1 - x0), height / (y1 - y0)) * 0.98;
    this.setCamera(this.fitZoom, width / 2, height / 2);
  }

  private setCamera(zoom: number, x: number, y: number): void {
    this.zoom = Math.max(this.fitZoom * 0.8, Math.min(this.fitZoom * 8, zoom));
    this.world.scale.set(this.zoom);
    this.world.position.set(x, y);
    this.redrawIfNeeded();
    this.labels.update(this.zoom / this.uiScale, this.lod, this.filters.labels, this.iconPoints());
    this.onCamera?.();
  }

  /** Zoom autour d'un point de l'écran (molette). */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    const before = this.toWorld(screenX, screenY);
    const zoom = Math.max(this.fitZoom * 0.8, Math.min(this.fitZoom * 8, this.zoom * factor));
    this.setCamera(zoom, screenX - before[0] * zoom, screenY - before[1] * zoom);
  }

  panBy(dx: number, dy: number): void {
    this.setCamera(this.zoom, this.world.position.x + dx, this.world.position.y + dy);
  }

  /** Centre la vue sur une province (double-clic), en rapprochant au niveau « région » au moins. */
  centerOn(id: string): void {
    const p = this.byId.get(id);
    if (!p) return;
    const zoom = Math.max(this.zoom, this.fitZoom * 2);
    const { width, height } = this.app.screen;
    this.setCamera(zoom, width / 2 - p.anchor[0] * zoom, height / 2 - p.anchor[1] * zoom);
  }

  /** Passe directement à un niveau de détail (raccourcis). */
  setLod(lod: Lod): void {
    const factor = [1, 2.2, 4.5][LOD_ORDER.indexOf(lod)] ?? 1;
    const { width, height } = this.app.screen;
    const center = this.toWorld(width / 2, height / 2);
    const zoom = this.fitZoom * factor;
    this.setCamera(zoom, width / 2 - center[0] * zoom, height / 2 - center[1] * zoom);
  }

  toWorld(screenX: number, screenY: number): Point {
    return [(screenX - this.world.position.x) / this.zoom, (screenY - this.world.position.y) / this.zoom];
  }

  toScreen([x, y]: Point): Point {
    return [x * this.zoom + this.world.position.x, y * this.zoom + this.world.position.y];
  }

  /** Province sous un point de l'écran (test point-dans-polygone, les segments de mur en priorité). */
  provinceAt(screenX: number, screenY: number): string | null {
    const p = this.toWorld(screenX, screenY);
    const hits = this.provinces.filter((pr) => pointInPolygon(p, pr.polygon));
    return (hits.find((h) => h.kind === "segment") ?? hits[0])?.id ?? null;
  }

  setDynamic(d: MapDynamic): void {
    this.dynamic = d;
    this.bucket = Number.NaN;
    this.redrawIfNeeded();
    this.labels.update(this.zoom / this.uiScale, this.lod, this.filters.labels, this.iconPoints());
  }

  /** Itinéraires et positions des expéditions, convois et dépôts. */
  setRoutes(r: MapRoutes): void {
    this.routes = r;
    this.drawRoutesLayer();
  }

  private drawRoutesLayer(): void {
    const px = this.uiScale / 2 ** (this.bucket / 2);
    this.gRoutes.clear();
    for (const d of this.routes.depots) drawDepot(this.gRoutes, d.at, d.radius, px);
    for (const r of this.routes.routes) drawRoute(this.gRoutes, r.points, px, r.style);
    for (const m of this.routes.markers) drawExpeditionMarker(this.gRoutes, m.at, px, m.kind);
  }

  /** Couleur d'overlay par province (null = lavis par région). */
  setOverlay(colors: ReadonlyMap<string, number> | null): void {
    this.overlay = colors;
    this.drawWashLayer();
  }

  setFilters(f: MapFilters): void {
    this.filters = f;
    this.gPawns.visible = f.pawns;
    this.gRoutes.visible = f.pawns;
    this.gWalls.visible = f.walls;
    this.gFog.visible = f.fog;
    this.labels.update(this.zoom / this.uiScale, this.lod, f.labels, this.iconPoints());
  }

  setHover(id: string | null): void {
    this.hovered = id;
    this.drawHighlight();
  }

  setSelected(id: string | null): void {
    this.selected = id;
    this.drawHighlight();
  }

  /** Les traits sont exprimés en pixels : on redessine quand le zoom change de palier (×√2). */
  private redrawIfNeeded(): void {
    const bucket = Math.round(Math.log2(this.zoom) * 2);
    if (bucket === this.bucket) return;
    this.bucket = bucket;
    const px = this.uiScale / 2 ** (bucket / 2);
    const level = LOD_ORDER.indexOf(this.lod);
    this.drawWashLayer();
    this.gRivers.clear();
    drawRivers(this.gRivers, this.terrain, px);
    drawCoast(this.gRivers, this.terrain, px);
    this.gBorders.clear();
    for (const p of this.provinces) if (p.kind !== "segment") this.gBorders.poly(flat(p.polygon));
    this.gBorders.stroke({ width: (level === 0 ? 0.8 : 1) * px, color: MAP_INK, alpha: 0.42, join: "round" });
    this.gRoads.clear();
    drawRoads(this.gRoads, this.terrain, px, level >= 1, level >= 2);
    this.gWalls.clear();
    const segments = this.provinces
      .filter((p) => p.kind === "segment")
      .map((p) => ({ polygon: p.polygon, structure: this.dynamic.provinces[p.id]?.structure ?? 100 }));
    drawWalls(this.gWalls, this.terrain, segments, px, level >= 2);
    this.gTowns.clear();
    drawTowns(this.gTowns, this.terrain, px, [2, 1, 0][level] ?? 0);
    this.gFog.clear();
    for (const p of this.provinces) if (p.visibility !== "connue") drawVeil(this.gFog, p.polygon, p.visibility);
    this.gPawns.clear();
    for (const p of this.provinces) {
      const org = this.dynamic.provinces[p.id]?.garrisonOrg;
      if (org) drawPawn(this.gPawns, this.terrain.provinces[p.id]?.pawn ?? p.anchor, org, px);
    }
    this.drawRoutesLayer();
    this.drawHighlight();
  }

  private drawWashLayer(): void {
    this.gWash.clear();
    for (const p of this.provinces) {
      if (p.kind === "segment") continue;
      // Calque actif : aplat transparent par province, le relief reste lisible ; sans valeur, gris « inconnu » de la légende.
      if (!this.overlay) continue;
      const value = this.overlay.get(p.id);
      this.gWash.poly(flat(p.polygon)).fill({ color: value ?? UNKNOWN, alpha: value === undefined ? 0.45 : 0.55 });
    }
  }

  private drawHighlight(): void {
    const px = this.uiScale / this.zoom;
    this.gHighlight.clear();
    const sel = this.selected ? this.byId.get(this.selected) : undefined;
    if (sel) {
      this.gHighlight.poly(flat(sel.polygon)).fill({ color: 0xffffff, alpha: 0.12 }).stroke({ width: 3.2 * px, color: BRICK, alpha: 0.95, join: "round" });
      this.gHighlight.poly(flat(sel.polygon)).stroke({ width: 1 * px, color: MAP_INK, alpha: 0.9, join: "round" });
    }
    const hov = this.hovered && this.hovered !== this.selected ? this.byId.get(this.hovered) : undefined;
    if (hov) this.gHighlight.poly(flat(hov.polygon)).fill({ color: 0xffffff, alpha: 0.1 }).stroke({ width: 2.2 * px, color: 0xffffff, alpha: 0.9, join: "round" });
  }

  /** Remplace l'image de départ du relief par l'image fine calculée dans un worker (sans bloquer le jeu). */
  private refineTerrain(): void {
    if (typeof Worker === "undefined") return;
    const worker = new Worker(new URL("../workers/terrain.worker.ts", import.meta.url), { type: "module" });
    const { grid, height, biome } = this.terrain;
    worker.onmessage = (e: MessageEvent<TerrainImage>): void => {
      worker.terminate();
      if (this.app.renderer === null) return;
      const old = this.terrainImage.texture;
      const [x0, y0, x1, y1] = this.terrain.bounds;
      this.terrainImage.texture = terrainTexture(e.data);
      this.terrainImage.position.set(x0, y0);
      this.terrainImage.width = x1 - x0;
      this.terrainImage.height = y1 - y0;
      old.destroy(true);
      performance.mark("carte:relief-fin");
    };
    worker.onerror = () => worker.terminate();
    worker.postMessage({ terrain: { grid, height, biome }, size: TERRAIN_TEXTURE_FINE });
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
