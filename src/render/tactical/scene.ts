import { Application, Container, Graphics, TilingSprite } from "pixi.js";
import type { TacticalWorldMap } from "../../sim/tactical/map";
import type { BattleState, SoldierUnit } from "../../sim/tactical/types";
import { INK, OCHRE, PAPER, PAPER_DARK, STONE, VERDIGRIS } from "../palette";
import { paperTexture } from "../paperTexture";
import { drawFlare, drawSoldier, drawTitan } from "./figures";
import type { SoldierLook } from "./figures";

/** Facteur de projection oblique (vue de gravure, 04 §4) : y écrasé, la hauteur z monte à l'écran. */
const TILT = 0.62;
/** Échelle de lecture par défaut (pixels par mètre) et taille minimale à l'écran des figures. */
const READ_ZOOM = 3;
const MIN_SOLDIER_PX = 9;
const MIN_TITAN_PX = 22;

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
  private map: TacticalWorldMap | null = null;
  private zoom = 1;
  private fitZoom = 1;
  /** Cadrage initial à refaire au redimensionnement tant que le joueur n'a pas bougé la caméra. */
  private framing: (() => void) | null = null;
  selected: Set<number> = new Set();

  private constructor(private readonly app: Application) {
    this.worldLayer.addChild(this.gGround, this.gStatic, this.gDynamic);
    app.stage.addChild(this.worldLayer);
  }

  static async create(host: HTMLElement): Promise<TacticalScene> {
    const app = new Application();
    await app.init({ resizeTo: host, background: PAPER, antialias: true, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1), preference: "webgl" });
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
      const proj = points.map((p) => this.project(p.x, p.y, p.z));
      const xs = proj.map((p) => p[0]);
      const ys = proj.map((p) => p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys) - 20, Math.max(...ys)];
      const z = Math.max(this.fitZoom, Math.min(READ_ZOOM, width / (x1 - x0 + 60), height / (y1 - y0 + 60)));
      this.zoom = z;
      this.worldLayer.scale.set(z);
      this.worldLayer.position.set(width / 2 - ((x0 + x1) / 2) * z, height / 2 - ((y0 + y1) / 2) * z);
    };
    this.framing();
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    this.framing = null;
    const z = Math.max(this.fitZoom * 0.7, Math.min(Math.max(this.fitZoom * 6, 10), this.zoom * factor));
    const wx = (sx - this.worldLayer.position.x) / this.zoom;
    const wy = (sy - this.worldLayer.position.y) / this.zoom;
    this.zoom = z;
    this.worldLayer.scale.set(z);
    this.worldLayer.position.set(sx - wx * z, sy - wy * z);
  }

  panBy(dx: number, dy: number): void {
    this.framing = null;
    this.worldLayer.position.set(this.worldLayer.position.x + dx, this.worldLayer.position.y + dy);
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
        // Façade avant, puis toit (plan écrasé), traits d'encre.
        s.rect(x0, yt, st.w, yb - yt).fill({ color: fill }).stroke({ width: 0.6, color: INK, alpha: 0.9 });
        s.rect(x0, ybk, st.w, yt - ybk).fill({ color: st.kind === "batiment" ? 0x8a3b2a : fill, alpha: st.kind === "batiment" ? 0.55 : 0.8 }).stroke({ width: 0.6, color: INK, alpha: 0.9 });
        for (let hx = x0 + 3; hx < x0 + st.w; hx += 4) s.moveTo(hx, yt + 1).lineTo(hx - 2, yb).stroke({ width: 0.25, color: INK, alpha: 0.25 });
      } else {
        const [x, yb] = this.project(st.x, st.y, 0);
        const [, yt] = this.project(st.x, st.y, st.h);
        s.rect(x - st.r, yt, st.r * 2, yb - yt).fill({ color: 0x6b4a2f }).stroke({ width: 0.5, color: INK });
        const crown = st.kind === "arbre_geant" ? st.r * 4 : st.r * 5 + 3;
        s.ellipse(x, yt, crown, crown * 0.6).fill({ color: VERDIGRIS, alpha: 0.75 }).stroke({ width: 0.5, color: INK, alpha: 0.7 });
      }
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
    const t = st.tick / 20;
    for (const f of st.signals) {
      const age = t - f.t;
      if (age < 0 || age > 8) continue;
      const [x, y] = this.project(f.x, f.y, 6);
      drawFlare(g, x, y, k, f.color, age);
    }
    // Titans : du fond vers l'avant.
    const titans = [...st.titans].sort((a, b) => a.y - b.y);
    for (const tt of titans) {
      const [x, y] = this.project(tt.x, tt.y, 0);
      drawTitan(g, x, y, Math.max(tt.height, MIN_TITAN_PX / this.zoom), tt.silhouette, Math.cos(tt.heading), tt.alive, tt.behavior === "rampant", { armL: tt.armL > 0, armR: tt.armR > 0, legs: tt.legs > 0 });
    }
    st.soldiers.forEach((s, i) => {
      if (s.mode === "mort" || s.mode === "fui") return;
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
      drawSoldier(g, x, y, k, look(s), s.mode === "sol", this.selected.has(i), s.wound !== "aucune");
    });
    if (st.wagon) {
      const [x, y] = this.project(st.wagon.x, st.wagon.y, 0);
      g.rect(x - 4, y - 4, 8, 4).fill({ color: OCHRE }).stroke({ width: 0.6, color: INK });
    }
  }

  /** Unité sous un point de l'écran (soldat de préférence), pour la sélection. */
  pick(st: BattleState, sx: number, sy: number): { kind: "soldat" | "titan"; index: number } | null {
    let best: { kind: "soldat" | "titan"; index: number } | null = null;
    let bestD = 14;
    st.soldiers.forEach((s, i) => {
      if (s.mode === "mort" || s.mode === "fui") return;
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

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
