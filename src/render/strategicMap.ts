import { Application, Container, Graphics, TilingSprite } from "pixi.js";
import type { MapData } from "../data/map";
import { pointInPolygon } from "../sim/strategic/geometry";
import type { Point } from "../sim/strategic/geometry";
import { drawBorder, drawFog, drawLand, drawPawn, drawSea, drawTerrain, drawWall, drawWash } from "./atlasLayers";
import type { ProvinceShape } from "./atlasLayers";
import { LabelLayer, LOD_ORDER } from "./labels";
import type { LabelSpec, Lod } from "./labels";
import { BRICK, INK, REGION_WASH } from "./palette";
import { paperTexture } from "./paperTexture";

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

/** Carte stratégique d'atlas (04 §3) : rendu Pixi, caméra, niveaux de détail, sélection. */
export class StrategicMap {
  private readonly world = new Container();
  private readonly gSea = new Graphics();
  private readonly gLand = new Graphics();
  private readonly gWash = new Graphics();
  private readonly gTerrain = new Graphics();
  private readonly gBorders = new Graphics();
  private readonly gWalls = new Graphics();
  private readonly gFog = new Graphics();
  private readonly gPawns = new Graphics();
  private readonly gHighlight = new Graphics();
  private readonly labels: LabelLayer;
  private grain: TilingSprite | null = null;
  private zoom = 1;
  private fitZoom = 1;
  private bucket = Number.NaN;
  private overlay: ReadonlyMap<string, number> | null = null;
  private dynamic: MapDynamic = { provinces: {} };
  private filters: MapFilters = { pawns: true, labels: true, walls: true, fog: true };
  private hovered: string | null = null;
  private selected: string | null = null;
  private readonly byId: Map<string, MapProvince>;

  private constructor(
    private readonly app: Application,
    private readonly map: MapData,
    private readonly provinces: readonly MapProvince[],
    labelSpecs: readonly LabelSpec[],
  ) {
    this.byId = new Map(provinces.map((p) => [p.id, p]));
    this.labels = new LabelLayer(
      labelSpecs,
      map.wall_rings.map((r) => ({ name: WALL_LABELS[r.wall]?.name ?? r.wall, radius: r.r_outer + 9, bearing: WALL_LABELS[r.wall]?.bearing ?? 0 })),
    );
    this.world.addChild(this.gSea, this.gLand, this.gWash, this.gTerrain, this.gBorders, this.gWalls, this.gFog, this.gPawns, this.gHighlight, this.labels.container);
    app.stage.addChild(this.world);
  }

  static async create(host: HTMLElement, map: MapData, provinces: readonly MapProvince[], labels: readonly LabelSpec[]): Promise<StrategicMap> {
    const app = new Application();
    await app.init({ resizeTo: host, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1), preference: "webgl" });
    app.canvas.classList.add("carte__toile");
    app.canvas.setAttribute("role", "img");
    host.append(app.canvas);
    const m = new StrategicMap(app, map, provinces, labels);
    m.addGrain();
    m.fit();
    return m;
  }

  /** Grain de papier multiplié sur toute la carte (04 §2.4). */
  private addGrain(): void {
    const grain = new TilingSprite({ texture: paperTexture(), width: this.app.screen.width, height: this.app.screen.height });
    grain.blendMode = "multiply";
    grain.alpha = 0.55;
    this.app.stage.addChild(grain);
    this.grain = grain;
    this.app.renderer.on("resize", (w: number, h: number) => {
      grain.width = w;
      grain.height = h;
    });
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  get lod(): Lod {
    const r = this.zoom / this.fitZoom;
    return r < 1.6 ? "monde" : r < 3.2 ? "region" : "province";
  }

  get zoomLevel(): number {
    return this.zoom;
  }

  /** Cadre toute l'île dans la vue. */
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
    this.labels.update(this.zoom, this.lod, this.filters.labels);
    if (this.grain) this.grain.tilePosition.set(x, y);
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
  }

  /** Couleur d'overlay par province (null = lavis par région). */
  setOverlay(colors: ReadonlyMap<string, number> | null): void {
    this.overlay = colors;
    this.drawWashLayer();
  }

  setFilters(f: MapFilters): void {
    this.filters = f;
    this.gPawns.visible = f.pawns;
    this.gWalls.visible = f.walls;
    this.gFog.visible = f.fog;
    this.labels.update(this.zoom, this.lod, f.labels);
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
    const px = 1 / 2 ** (bucket / 2);
    this.gSea.clear();
    drawSea(this.gSea, this.map.bounds, px);
    this.gLand.clear();
    drawLand(this.gLand, this.map.coast, px);
    this.drawWashLayer();
    this.gTerrain.clear();
    this.gBorders.clear();
    for (const p of this.provinces) {
      drawTerrain(this.gTerrain, p, px);
      if (p.kind !== "segment") drawBorder(this.gBorders, p, px);
    }
    this.gWalls.clear();
    for (const ring of this.map.wall_rings) {
      const segments = this.provinces
        .filter((p) => p.kind === "segment" && p.region === `mur_${ring.wall}`)
        .map((p) => {
          const b = this.map.provinces[p.id]?.bearing ?? [0, 0];
          return { from: b[0], to: b[1], structure: this.dynamic.provinces[p.id]?.structure ?? 100 };
        });
      const gates = this.map.gates.filter((g) => this.byId.get(g.province)?.region === `mur_${ring.wall}`).map((g) => g.bearing);
      drawWall(this.gWalls, ring, segments, gates, px);
    }
    this.gFog.clear();
    for (const p of this.provinces) if (p.visibility !== "connue") drawFog(this.gFog, p, p.visibility, px);
    this.gPawns.clear();
    for (const p of this.provinces) {
      const org = this.dynamic.provinces[p.id]?.garrisonOrg;
      if (org) drawPawn(this.gPawns, p.kind === "segment" ? p.anchor : [p.anchor[0] + 14, p.anchor[1] - 10], org, px);
    }
    this.drawHighlight();
  }

  private drawWashLayer(): void {
    const px = 1 / 2 ** (this.bucket / 2);
    this.gWash.clear();
    for (const p of this.provinces) {
      if (p.kind === "segment") continue;
      const color = this.overlay?.get(p.id) ?? REGION_WASH[p.region] ?? INK;
      drawWash(this.gWash, p, color, this.overlay ? 0.62 : 0.3, px);
    }
  }

  private drawHighlight(): void {
    const px = 1 / this.zoom;
    this.gHighlight.clear();
    const sel = this.selected ? this.byId.get(this.selected) : undefined;
    if (sel) {
      drawBorder(this.gHighlight, sel, px, 3.2, 0.95, BRICK);
      drawBorder(this.gHighlight, sel, px, 1, 0.9, INK);
    }
    const hov = this.hovered && this.hovered !== this.selected ? this.byId.get(this.hovered) : undefined;
    if (hov) drawBorder(this.gHighlight, hov, px, 2.4, 0.85, INK);
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
