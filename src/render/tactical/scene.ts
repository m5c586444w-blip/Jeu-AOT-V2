import { Application, Container, Graphics, GraphicsContext, Text, TilingSprite } from "pixi.js";
import type { TacticalWorldMap } from "../../sim/tactical/map";
import type { BattleState, SoldierUnit } from "../../sim/tactical/types";
import { INK, OCHRE, PAPER, PAPER_DARK, STONE, VERDIGRIS } from "../palette";
import { paperTexture } from "../paperTexture";
import { drawFlare, drawSoldier, drawTitan } from "./figures";
import type { SoldierLook } from "./figures";

/** Facteur de projection oblique (vue de gravure, 04 §4 ; 0,8 depuis la revue de P4 : la carte de 400 × 300 m remplit une scène 16:10, D-63) : y écrasé, la hauteur z monte à l'écran. */
const TILT = 0.8;
/** Taille minimale à l'écran des figures (pixels). */
const MIN_SOLDIER_PX = 9;
const MIN_TITAN_PX = 22;
/** Sous ce zoom (px/m), vue d'ensemble : pastilles d'escouade, soldats en points, Titans agrandis (revue de P4). */
export const OVERVIEW_ZOOM = 4;
const BRICK_TINT = 0xd98a76;
const OVERVIEW_TITAN_PX = 42;
const OVERVIEW_DOT_PX = 3;
const PASTILLE_PX = 11;
/** Zoom maximal du cadrage initial (la bataille remplit l'écran, sans plan trop serré). */
const FRAME_MAX_ZOOM = 6;
/** Teintes de toits (tuile, ardoise, chaume) : villes moins régulières (revue de P4, reporté à P8). */
const ROOF_TINTS = [0x8a3b2a, 0x6b4a2f, 0x5a5f66, 0x9b6a3c, 0x7a4a3a];

export interface UnitPose {
  x: number;
  y: number;
  z: number;
}

/** Scène tactique 2.5D (Pixi, `src/render` seulement) : décor statique, unités interpolées, câbles, fusées, caméra. */
export class TacticalScene {
  private readonly worldLayer = new Container();
  private readonly gGround = new Graphics();
  private readonly gStatic = new Graphics();
  private readonly gDynamic = new Graphics();
  /** Figures construites une fois par apparence (GraphicsContext partagé), puis seulement déplacées et mises à l'échelle. */
  private readonly titanLayer = new Container({ sortableChildren: true });
  private readonly soldierLayer = new Container();
  private readonly gOverlay = new Graphics();
  private readonly contexts = new Map<string, GraphicsContext>();
  private readonly titanFigs: Graphics[] = [];
  private readonly soldierFigs: Graphics[] = [];
  private readonly markerLayer = new Container();
  private readonly pastilles = new Map<string, { ring: Graphics; label: Text }>();
  /** Vue courante et nombre de pastilles affichées (lus par l'interface et les contrôles). */
  view: "ensemble" | "detail" = "detail";
  markers = 0;
  private map: TacticalWorldMap | null = null;
  /** Effets dessinés (P8) : contrôles de l'écran de bataille et de smoke:p8. */
  readonly fx = { roofs: new Set<number>(), steam: 0, flashes: 0, occluded: 0 };
  /** Volumes des bâtiments par colonne de 20 m (occlusion des unités qui passent derrière). */
  private occluders = new Map<number, { x0: number; x1: number; y0: number; y1: number; front: number }[]>();
  private zoom = 1;
  private fitZoom = 1;
  /** Cadrage initial à refaire au redimensionnement tant que le joueur n'a pas bougé la caméra. */
  private framing: (() => void) | null = null;
  selected: Set<number> = new Set();

  private constructor(private readonly app: Application) {
    this.worldLayer.addChild(this.gGround, this.gStatic, this.gDynamic, this.titanLayer, this.soldierLayer, this.gOverlay, this.markerLayer);
    app.stage.addChild(this.worldLayer);
  }

  static async create(host: HTMLElement): Promise<TacticalScene> {
    const app = new Application();
    await app.init({ autoStart: false, resizeTo: host, background: PAPER, antialias: true, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1), preference: "webgl" });
    app.canvas.classList.add("tactique__toile");
    host.append(app.canvas);
    const scene = new TacticalScene(app);
    const grain = new TilingSprite({ texture: paperTexture(850), width: app.screen.width, height: app.screen.height });
    grain.blendMode = "multiply";
    grain.alpha = 0.5;
    app.stage.addChild(grain);
    app.renderer.on("resize", (w: number, h: number) => {
      grain.width = w;
      grain.height = h;
      scene.framing?.();
    });
    return scene;
  }

  /** Rendu d'une image : appelé par la boucle de l'écran de bataille (pas de ticker propre), pour mesurer tout le temps JS. */
  render(): void {
    this.app.render();
  }

  /** Part de la scène couverte par le sol de la carte (0–1) : contrôle du cadrage « la bataille remplit l'écran ». */
  coverage(): number {
    if (!this.map) return 0;
    const { width, height } = this.app.screen;
    const { x, y } = this.worldLayer.position;
    const w = Math.max(0, Math.min(width, x + this.map.width * this.zoom) - Math.max(0, x));
    const h = Math.max(0, Math.min(height, y + this.map.height * TILT * this.zoom) - Math.max(0, y));
    return (w * h) / (width * height);
  }

  /** Pixels par mètre. */
  get zoomLevel(): number {
    return this.zoom;
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  /** Projection monde → écran (avant caméra). */
  project(x: number, y: number, z: number): [number, number] {
    return [x, y * TILT - z];
  }

  toScreen(x: number, y: number, z: number): [number, number] {
    const [px, py] = this.project(x, y, z);
    return [px * this.zoom + this.worldLayer.position.x, py * this.zoom + this.worldLayer.position.y];
  }

  fit(): void {
    if (!this.map) return;
    const { width, height } = this.app.screen;
    this.fitZoom = Math.min(width / (this.map.width + 40), height / (this.map.height * TILT + 120));
    this.zoom = this.fitZoom;
    this.worldLayer.scale.set(this.zoom);
    this.worldLayer.position.set((width - this.map.width * this.zoom) / 2, (height - this.map.height * TILT * this.zoom) / 2 + 30 * this.zoom);
  }

  /**
   * Cadre la caméra sur des points (les unités au début de la bataille), à l'échelle de lecture au plus :
   * des hommes de 1,8 m et des Titans de 3 à 15 m restent lisibles côte à côte.
   */
  frame(points: readonly UnitPose[]): void {
    this.framing = () => {
      if (!this.map || points.length === 0) return;
      const { width, height } = this.app.screen;
      this.fit();
      // Emprise au sol des unités (les hauteurs feraient remonter la vue vers le ciel).
      const proj = points.map((p) => this.project(p.x, p.y, 0));
      const xs = proj.map((p) => p[0]);
      const ys = proj.map((p) => p[1]);
      // Marges, puis emprise rognée à la carte : « couvrir » remplit alors l'écran de sol, pas de vide.
      const mapW = this.map.width;
      const mapH = this.map.height * TILT;
      const [x0, x1, y0, y1] = [Math.max(0, Math.min(...xs) - 12), Math.min(mapW, Math.max(...xs) + 12), Math.max(0, Math.min(...ys) - 25), Math.min(mapH, Math.max(...ys) + 12)];
      // La bataille remplit l'écran : on couvre la zone des unités (au plus 30 % au-delà du cadrage « tout voir »).
      const contain = Math.min(width / (x1 - x0), height / (y1 - y0));
      const cover = Math.max(width / (x1 - x0), height / (y1 - y0));
      const z = Math.max(this.fitZoom, Math.min(FRAME_MAX_ZOOM, cover, contain * 1.3));
      this.zoom = z;
      this.worldLayer.scale.set(z);
      this.worldLayer.position.set(width / 2 - ((x0 + x1) / 2) * z, height / 2 - ((y0 + y1) / 2) * z);
      this.clampToMap();
    };
    this.framing();
  }

  /** Garde la carte sous la vue quand elle est plus grande que l'écran (pas de bande vide inutile). */
  private clampToMap(): void {
    if (!this.map) return;
    const { width, height } = this.app.screen;
    const z = this.zoom;
    const left = 0;
    const right = this.map.width * z;
    const top = -15 * z;
    const bottom = this.map.height * TILT * z;
    const pos = this.worldLayer.position;
    const cx = right - left > width ? Math.min(-left, Math.max(width - right, pos.x)) : pos.x;
    const cy = bottom - top > height ? Math.min(-top, Math.max(height - bottom, pos.y)) : pos.y;
    pos.set(cx, cy);
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    this.framing = null;
    const z = Math.max(this.fitZoom * 0.7, Math.min(Math.max(this.fitZoom * 6, 10), this.zoom * factor));
    const wx = (sx - this.worldLayer.position.x) / this.zoom;
    const wy = (sy - this.worldLayer.position.y) / this.zoom;
    this.zoom = z;
    this.worldLayer.scale.set(z);
    this.worldLayer.position.set(sx - wx * z, sy - wy * z);
    this.clampToMap();
  }

  panBy(dx: number, dy: number): void {
    this.framing = null;
    this.worldLayer.position.set(this.worldLayer.position.x + dx, this.worldLayer.position.y + dy);
    this.clampToMap();
  }

  /** Caméra qui suit une position (escouade ou individu, 03 §13). */
  follow(x: number, y: number, z: number): void {
    this.framing = null;
    const { width, height } = this.app.screen;
    const [px, py] = this.project(x, y, z);
    this.worldLayer.position.set(width / 2 - px * this.zoom, height / 2 - py * this.zoom);
  }

  /** Décor statique : sol, puis structures du fond vers l'avant (volumes à l'encre). */
  setMap(m: TacticalWorldMap): void {
    this.map = m;
    const g = this.gGround;
    g.clear();
    g.rect(0, 0, m.width, m.height * TILT).fill({ color: m.terrain === "foret" ? 0x7f8a62 : m.terrain === "ville" ? 0xbfae8a : 0xb6ad84, alpha: 0.55 });
    for (let x = 0; x <= m.width; x += 50) g.moveTo(x, 0).lineTo(x, m.height * TILT).stroke({ width: 0.3, color: INK, alpha: 0.15 });
    const s = this.gStatic;
    s.clear();
    const sorted = [...m.structures].sort((a, b) => (a.shape === "box" ? a.y + a.d : a.y) - (b.shape === "box" ? b.y + b.d : b.y));
    for (const st of sorted) {
      if (st.shape === "box") {
        const [x0, yb] = this.project(st.x, st.y + st.d, 0);
        const [, yt] = this.project(st.x, st.y + st.d, st.h);
        const [, ybk] = this.project(st.x, st.y, st.h);
        const fill = st.kind === "mur" ? STONE : st.kind === "rocher" ? 0x9b927e : PAPER_DARK;
        // Façade avant, puis toit (plan écrasé), traits d'encre. Bâtiments variés (revue de P4) : teinte de toit,
        // faîtage ou toit plat, cheminée, rangées de fenêtres, tirés de la position (même emprise, même simulation).
        const v = ((Math.imul(Math.round(st.x * 7 + st.y * 13), 2654435761) >>> 0) % 1000) / 1000;
        s.rect(x0, yt, st.w, yb - yt).fill({ color: fill }).stroke({ width: 0.6, color: INK, alpha: 0.9 });
        const roof = st.kind === "batiment" ? ROOF_TINTS[Math.floor(v * ROOF_TINTS.length)] ?? 0x8a3b2a : fill;
        s.rect(x0, ybk, st.w, yt - ybk).fill({ color: roof, alpha: st.kind === "batiment" ? 0.55 + v * 0.25 : 0.8 }).stroke({ width: 0.6, color: INK, alpha: 0.9 });
        if (st.kind === "batiment") {
          this.fx.roofs.add(Math.floor(v * ROOF_TINTS.length) * 3 + Math.floor(v * 7) % 3);
          const style = Math.floor(v * 7) % 3;
          if (style === 0) s.moveTo(x0 + 1, (ybk + yt) / 2).lineTo(x0 + st.w - 1, (ybk + yt) / 2).stroke({ width: 0.6, color: INK, alpha: 0.8 });
          else if (style === 1) s.moveTo(x0, yt).lineTo(x0 + st.w / 2, ybk).lineTo(x0 + st.w, yt).stroke({ width: 0.5, color: INK, alpha: 0.7 });
          if (v > 0.35) s.rect(x0 + st.w * (0.2 + v * 0.5), ybk - 2.5, 1.4, 3).fill({ color: STONE }).stroke({ width: 0.3, color: INK });
          for (let wy = yt + 2.2; wy < yb - 1.5; wy += 3.4) for (let wx = x0 + 1.6 + (v * 2) % 1.4; wx < x0 + st.w - 1.6; wx += 3.1) s.rect(wx, wy, 1, 1.4).fill({ color: INK, alpha: 0.45 });
        } else for (let hx = x0 + 3; hx < x0 + st.w; hx += 4) s.moveTo(hx, yt + 1).lineTo(hx - 2, yb).stroke({ width: 0.25, color: INK, alpha: 0.25 });
      } else {
        const [x, yb] = this.project(st.x, st.y, 0);
        const [, yt] = this.project(st.x, st.y, st.h);
        s.rect(x - st.r, yt, st.r * 2, yb - yt).fill({ color: 0x6b4a2f }).stroke({ width: 0.5, color: INK });
        const crown = st.kind === "arbre_geant" ? st.r * 4 : st.r * 5 + 3;
        s.ellipse(x, yt, crown, crown * 0.6).fill({ color: VERDIGRIS, alpha: 0.75 }).stroke({ width: 0.5, color: INK, alpha: 0.7 });
      }
    }
    // Index d'occlusion : emprise à l'écran de chaque volume de bâtiment ou de mur, par colonne de 20 m.
    this.occluders = new Map();
    for (const st of m.structures) {
      if (st.shape !== "box" || st.kind === "rocher") continue;
      const box = { x0: st.x, x1: st.x + st.w, y0: st.y * TILT - st.h, y1: (st.y + st.d) * TILT, front: st.y + st.d };
      for (let c = Math.floor(st.x / 20); c <= Math.floor((st.x + st.w) / 20); c++) this.occluders.set(c, [...(this.occluders.get(c) ?? []), box]);
    }
    for (const a of m.anchors) {
      const [x, y] = this.project(a.x, a.y, a.z);
      s.circle(x, y, 0.6).fill({ color: OCHRE, alpha: 0.8 });
    }
    this.fit();
  }

  /** Unités interpolées entre l'état précédent (`prev`) et l'état courant, avec câbles, traînées et fusées. */
  draw(st: BattleState, prev: readonly UnitPose[] | null, alpha: number, look: (s: SoldierUnit) => SoldierLook): void {
    const g = this.gDynamic;
    g.clear();
    // Figures à l'échelle réelle, avec une taille minimale à l'écran (sinon un homme fait moins d'un pixel en vue large).
    const k = Math.max(1.8, MIN_SOLDIER_PX / this.zoom) / 2.85;
    const overview = this.zoom < OVERVIEW_ZOOM;
    this.view = overview ? "ensemble" : "detail";
    const t = st.tick / 20;
    for (const f of st.signals) {
      const age = t - f.t;
      if (age < 0 || age > 8) continue;
      const [x, y] = this.project(f.x, f.y, 6);
      drawFlare(g.context, x, y, 1, f.color, age);
    }
    // Titans : figure de hauteur 100 mise à l'échelle, du fond vers l'avant (zIndex = profondeur).
    st.titans.forEach((tt, i) => {
      const f = this.fig(this.titanFigs, this.titanLayer, i);
      const facing = Math.cos(tt.heading) >= 0 ? 1 : -1;
      const crawl = tt.behavior === "rampant";
      const key = `t:${tt.silhouette}:${facing}:${tt.alive}:${crawl}:${tt.armL > 0}:${tt.armR > 0}:${tt.legs > 0}`;
      const ctx = this.context(key, (c) => drawTitan(c, 0, 0, 100, tt.silhouette, facing, tt.alive, crawl, { armL: tt.armL > 0, armR: tt.armR > 0, legs: tt.legs > 0 }));
      // Réassigner le même contexte reconstruirait la figure : seulement s'il change.
      if (f.context !== ctx) f.context = ctx;
      const [x, y] = this.project(tt.x, tt.y, 0);
      f.position.set(x, y);
      f.scale.set(Math.max(tt.height, (overview ? OVERVIEW_TITAN_PX : MIN_TITAN_PX) / this.zoom) / 100);
      f.zIndex = tt.y;
    });
    const o = this.gOverlay;
    o.clear();
    let occluded = 0;
    // Vapeur des Titans abattus (revue de P4) : bouffées qui montent et se défont, en boucle.
    let steam = 0;
    st.titans.forEach((tt, i) => {
      if (tt.alive) return;
      const [x, y] = this.project(tt.x, tt.y, 0);
      const h = Math.max(tt.height, MIN_TITAN_PX / this.zoom);
      for (let k2 = 0; k2 < 4; k2++) {
        const ph = (t * 0.35 + k2 / 4 + i * 0.37) % 1;
        o.circle(x + Math.sin((ph + k2) * 5) * h * 0.12, y - h * 0.15 - ph * h * 0.6, h * (0.06 + ph * 0.12)).fill({ color: 0xf2ece0, alpha: 0.5 * (1 - ph) });
        steam++;
      }
    });
    // Porteurs (P6) : éclair de transformation, cercle de camp au pied du corps.
    let flashes = 0;
    for (const u of st.shifters ?? []) {
      const [x, y] = this.project(u.x, u.y, 0);
      if (u.phase === "transformation") {
        o.circle(x, y - 6, 9 + (t * 40) % 6).fill({ color: 0xfff1b8, alpha: 0.55 });
        o.moveTo(x, y - 40).lineTo(x - 3, y - 26).lineTo(x + 2, y - 22).lineTo(x - 2, y - 6).stroke({ width: 1.4, color: 0xc58a2b });
        flashes++;
      } else if (u.phase === "titan" && u.body !== null) {
        const b = st.titans[u.body];
        if (b?.alive) {
          const [bx, by] = this.project(b.x, b.y, 0);
          o.ellipse(bx, by, b.height * 0.35, b.height * 0.12).stroke({ width: 0.8, color: u.side === "allie" ? VERDIGRIS : 0x9e2b25, alpha: 0.9 });
        }
      }
    }
    this.fx.steam = steam;
    this.fx.flashes += flashes;
    const centroids = new Map<string, { x: number; y: number; n: number; top: number }>();
    st.soldiers.forEach((s, i) => {
      const f = this.fig(this.soldierFigs, this.soldierLayer, i);
      const shown = s.mode !== "mort" && s.mode !== "fui";
      if (f.visible !== shown) f.visible = shown;
      if (!shown) return;
      const p = prev?.[i];
      const ix = p ? p.x + (s.x - p.x) * alpha : s.x;
      const iy = p ? p.y + (s.y - p.y) * alpha : s.y;
      const iz = p ? p.z + (s.z - p.z) * alpha : s.z;
      const [x, y] = this.project(ix, iy, iz);
      // Câble tendu vers l'ancrage (03 §13 : câbles, traînées de gaz).
      if (s.anchor && (s.mode === "rail" || s.mode === "crochet")) {
        const a = s.anchor.kind === "fixe" ? s.anchor : st.titans[s.anchor.titan];
        if (a) {
          const az = s.anchor.kind === "fixe" ? s.anchor.z : (st.titans[s.anchor.titan]?.height ?? 0) * 0.8;
          const [ax, ay] = this.project(a.x, a.y, az);
          g.moveTo(x, y - 3).lineTo(ax, ay).stroke({ width: 0.4, color: INK, alpha: 0.7 });
        }
        if (s.mode === "rail" && p) {
          const [px, py] = this.project(p.x, p.y, p.z);
          g.moveTo(px, py - 2).lineTo(x, y - 2).stroke({ width: 1.6, color: PAPER, alpha: 0.6 });
        }
      }
      const lk = look(s);
      const ground = s.mode === "sol";
      const sel = this.selected.has(i);
      const hurt = s.wound !== "aucune";
      // Vue d'ensemble : un point par homme (la pastille d'escouade porte la lecture) ; sinon la figure complète.
      const ctx = overview
        ? this.context(`d:${sel}`, (c) => c.circle(0, -1, 1).fill({ color: sel ? OCHRE : VERDIGRIS }).stroke({ width: 0.3, color: INK }))
        : this.context(`s:${lk}:${ground}:${sel}:${hurt}`, (c) => drawSoldier(c, 0, 0, 1, lk, ground, sel, hurt));
      if (f.context !== ctx) f.context = ctx;
      f.position.set(x, y);
      f.scale.set(overview ? OVERVIEW_DOT_PX / 2 / this.zoom : k);
      // Occlusion (revue de P4) : un homme derrière un bâtiment est estompé, comme vu à travers le décor.
      const hidden = !overview && (this.occluders.get(Math.floor(ix / 20)) ?? []).some((b) => iy < b.front && ix > b.x0 && ix < b.x1 && y > b.y0 && y < b.y1);
      const a = hidden ? 0.35 : 1;
      if (f.alpha !== a) f.alpha = a;
      if (hidden) occluded++;
      if (overview) {
        const c = centroids.get(s.squad) ?? { x: 0, y: 0, n: 0, top: Infinity };
        c.x += x;
        c.y += y;
        c.n += 1;
        c.top = Math.min(c.top, y);
        centroids.set(s.squad, c);
      }
    });
    this.fx.occluded = occluded;
    if (st.wagon) {
      const [x, y] = this.project(st.wagon.x, st.wagon.y, 0);
      o.rect(x - 4, y - 4, 8, 4).fill({ color: OCHRE }).stroke({ width: 0.6, color: INK });
    }
    this.drawPastilles(st, centroids);
  }

  /** Pastilles d'escouade (vue d'ensemble) : numéro au centre des hommes debout, taille constante à l'écran. */
  private drawPastilles(st: BattleState, centroids: ReadonlyMap<string, { x: number; y: number; n: number; top: number }>): void {
    this.markers = 0;
    for (const [id, p] of this.pastilles) {
      const c = centroids.get(id);
      p.ring.visible = p.label.visible = !!c;
    }
    for (const sq of st.squads) {
      const c = centroids.get(sq.id);
      if (!c) continue;
      let p = this.pastilles.get(sq.id);
      if (!p) {
        const ring = new Graphics(this.context(`pastille:${sq.id === "officiers" ? "o" : "e"}`, (g) => g.circle(0, 0, PASTILLE_PX).fill({ color: sq.id === "officiers" ? OCHRE : PAPER }).stroke({ width: 2, color: INK })));
        const label = new Text({ text: sq.id === "officiers" ? "O" : String(Number(sq.id.replace(/\D/g, "")) || ""), style: { fontFamily: "Special Elite, serif", fontSize: 12, fill: INK } });
        label.anchor.set(0.5);
        this.markerLayer.addChild(ring, label);
        p = { ring, label };
        this.pastilles.set(sq.id, p);
      }
      const x = c.x / c.n;
      const y = c.top - (PASTILLE_PX + 6) / this.zoom;
      p.ring.position.set(x, y);
      p.label.position.set(x, y);
      p.ring.scale.set(1 / this.zoom);
      p.label.scale.set(1 / this.zoom);
      // Escouade qui se replie : liseré brique.
      p.ring.tint = sq.order === "repli" ? BRICK_TINT : 0xffffff;
      this.markers += 1;
    }
  }

  /** Unité sous un point de l'écran (soldat de préférence), pour la sélection. */
  pick(st: BattleState, sx: number, sy: number): { kind: "soldat" | "titan"; index: number } | null {
    let best: { kind: "soldat" | "titan"; index: number } | null = null;
    let bestD = 14;
    st.soldiers.forEach((s, i) => {
      const f = this.fig(this.soldierFigs, this.soldierLayer, i);
      const shown = s.mode !== "mort" && s.mode !== "fui";
      if (f.visible !== shown) f.visible = shown;
      if (!shown) return;
      const [x, y] = this.toScreen(s.x, s.y, s.z + 2);
      const d = Math.hypot(x - sx, y - sy);
      if (d < bestD) {
        bestD = d;
        best = { kind: "soldat", index: i };
      }
    });
    if (best) return best;
    st.titans.forEach((t, i) => {
      if (!t.alive) return;
      const [x, y] = this.toScreen(t.x, t.y, t.height / 2);
      const d = Math.hypot(x - sx, y - sy);
      if (d < t.height * this.zoom * 0.5 + 6 && d < bestD + t.height * this.zoom) {
        best = { kind: "titan", index: i };
        bestD = d;
      }
    });
    return best;
  }

  private context(key: string, draw: (g: GraphicsContext) => void): GraphicsContext {
    let c = this.contexts.get(key);
    if (!c) {
      c = new GraphicsContext();
      draw(c);
      this.contexts.set(key, c);
    }
    return c;
  }

  private fig(pool: Graphics[], layer: Container, i: number): Graphics {
    let g = pool[i];
    if (!g) {
      g = new Graphics();
      pool[i] = g;
      layer.addChild(g);
    }
    return g;
  }

  destroy(): void {
    for (const c of this.contexts.values()) c.destroy();
    this.app.destroy(true, { children: true });
  }
}
