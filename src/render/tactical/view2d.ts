import type { BattleView, CameraMode, PickHit, ViewOptions, ViewOverlay } from "../battleView";
import type { TacticalWorldMap } from "../../sim/tactical/map";
import type { BattleState, SoldierUnit } from "../../sim/tactical/types";
import type { SoldierLook } from "./figures";
import { TacticalScene } from "./scene";

/** Apparence d'un soldat (8 types, 04 §10) d'après son rôle (même règle que l'écran classique). */
function lookOf(s: SoldierUnit): SoldierLook {
  if (s.ackerman) return "ackerman";
  if (s.named) return "officier";
  if (s.leader) return "chef";
  const id = Number(s.id.replace(/\D/g, "")) || 0;
  return (["tueur", "eclaireur", "soutien", "cavalier", "medecin", "tueur"] as const)[id % 6] ?? "tueur";
}

/**
 * Vue 2D de la bataille temps réel (R2+) : la scène Pixi de P4 derrière l'interface commune `BattleView`.
 * Repli quand WebGL 2 manque pour la 3D, ou au choix du joueur (options). Pas de rotation ; « suivi » recentre la caméra.
 */
export class View2D implements BattleView {
  readonly kind = "2d" as const;
  private mode: CameraMode = "strategique";
  private lastSel: ReadonlySet<number> | null = null;

  private constructor(private readonly scene: TacticalScene) {}

  static async create(host: HTMLElement): Promise<View2D> {
    return new View2D(await TacticalScene.create(host));
  }

  get canvas(): HTMLCanvasElement {
    return this.scene.canvas;
  }

  get camera(): CameraMode {
    return this.mode;
  }

  get zoomLevel(): number {
    return this.scene.zoomLevel;
  }

  setMap(m: TacticalWorldMap): void {
    this.scene.setMap(m);
  }

  frame(points: readonly { x: number; y: number; z: number }[]): void {
    this.scene.frame(points.map((p) => ({ x: p.x, y: p.y, z: p.z, own: p.z === 0 })));
  }

  draw(st: BattleState, prev: readonly { x: number; y: number; z: number }[] | null, alpha: number, overlay: ViewOverlay): void {
    if (overlay.soldiers !== this.lastSel) {
      this.scene.selected = new Set(overlay.soldiers);
      this.lastSel = overlay.soldiers;
    }
    this.scene.draw(st, prev, alpha, lookOf);
    this.scene.drawRt(st, overlay);
  }

  render(): void {
    this.scene.render();
  }

  toScreen(x: number, y: number, z: number): [number, number] | null {
    return this.scene.toScreen(x, y, z);
  }

  groundAt(sx: number, sy: number): { x: number; y: number } | null {
    return this.scene.groundAt(sx, sy);
  }

  pick(st: BattleState, sx: number, sy: number): PickHit | null {
    const hit = this.scene.pick(st, sx, sy);
    if (hit?.kind === "soldat") return hit;
    let best: PickHit | null = null;
    let bd = 12;
    for (const tr of st.troops ?? []) {
      if (tr.mode === "mort" || tr.mode === "fui") continue;
      const [x, y] = this.scene.toScreen(tr.x, tr.y, 1);
      const d = Math.hypot(x - sx, y - sy);
      if (d < bd) {
        bd = d;
        best = { kind: "troupe", index: tr.id };
      }
    }
    return best ?? hit;
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    this.scene.zoomAt(sx, sy, factor);
  }

  panBy(dx: number, dy: number): void {
    this.scene.panBy(dx, dy);
  }

  rotateBy(): void {
    // Vue de dessus en 2,5D : pas de rotation.
  }

  setCamera(mode: CameraMode): void {
    this.mode = mode;
  }

  follow(x: number, y: number, z: number): void {
    if (this.mode === "suivi") this.scene.follow(x, y, z);
  }

  setOptions(o: ViewOptions): void {
    void o;
  }

  stats(): { calls: number; triangles: number; detail: number; crowd: number; markers: number } {
    return { calls: 0, triangles: 0, detail: 0, crowd: 0, markers: this.scene.markers };
  }

  destroy(): void {
    this.scene.destroy();
  }
}
