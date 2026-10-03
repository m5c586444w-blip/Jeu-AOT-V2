import { Container, Text } from "pixi.js";
import type { TextStyleOptions } from "pixi.js";
import { polar } from "../sim/strategic/geometry";
import type { Point } from "../sim/strategic/geometry";
import { INK } from "./palette";

/** Niveaux de détail de la carte (F-STR-01). */
export type Lod = "monde" | "region" | "province";
export const LOD_ORDER: readonly Lod[] = ["monde", "region", "province"];

export interface LabelSpec {
  id: string;
  text: string;
  at: Point;
  /** Niveau à partir duquel l'étiquette apparaît. */
  minLod: Lod;
  style: "capitale" | "district" | "province" | "outre";
}

const STYLES: Record<LabelSpec["style"], TextStyleOptions> = {
  capitale: { fontFamily: "IM Fell English", fontSize: 19, fill: INK, letterSpacing: 1.5 },
  district: { fontFamily: "IM Fell English", fontSize: 15, fill: INK, letterSpacing: 1 },
  province: { fontFamily: "EB Garamond", fontSize: 12.5, fill: INK, fontVariant: "small-caps", letterSpacing: 0.8 },
  outre: { fontFamily: "EB Garamond", fontSize: 12.5, fill: 0x4a4339, fontStyle: "italic", letterSpacing: 0.6 },
};

/**
 * Toponymes : taille constante à l'écran (échelle inverse du zoom), affichage selon le niveau de détail.
 * Les noms de murs sont posés lettre à lettre le long de l'anneau (toponymes courbés, 04 §3).
 */
export class LabelLayer {
  readonly container = new Container();
  private readonly items: { spec: LabelSpec; text: Text }[] = [];
  private readonly arcs: { name: string; radius: number; bearing: number; letters: Text[] }[] = [];

  constructor(specs: readonly LabelSpec[], walls: readonly { name: string; radius: number; bearing: number }[]) {
    for (const spec of specs) {
      const text = new Text({ text: spec.text, style: STYLES[spec.style], resolution: 2 });
      text.anchor.set(0.5);
      text.position.set(spec.at[0], spec.at[1]);
      this.container.addChild(text);
      this.items.push({ spec, text });
    }
    for (const w of walls) {
      const letters = [...w.name].map((ch) => {
        const t = new Text({ text: ch, style: { fontFamily: "IM Fell English", fontSize: 14, fill: INK, letterSpacing: 0 }, resolution: 2 });
        t.anchor.set(0.5);
        this.container.addChild(t);
        return t;
      });
      this.arcs.push({ ...w, letters });
    }
  }

  /** Met à jour l'échelle (taille constante à l'écran), la visibilité par niveau, et la courbure des noms de murs. */
  update(zoom: number, lod: Lod, visible: boolean): void {
    this.container.visible = visible;
    const level = LOD_ORDER.indexOf(lod);
    const inv = 1 / zoom;
    for (const { spec, text } of this.items) {
      text.visible = LOD_ORDER.indexOf(spec.minLod) <= level;
      text.scale.set(inv);
    }
    for (const arc of this.arcs) {
      // Noms posés sur la moitié nord de l'anneau (lecture sans retournement).
      // Espacement angulaire calculé pour ~15 px par lettre à l'écran, centré sur le relèvement choisi.
      const step = (15 / (arc.radius * zoom)) * (180 / Math.PI);
      const start = arc.bearing - ((arc.letters.length - 1) * step) / 2;
      arc.letters.forEach((t, i) => {
        const b = start + i * step;
        const [x, y] = polar(arc.radius, b);
        t.position.set(x, y);
        t.rotation = (b * Math.PI) / 180;
        t.scale.set(inv);
      });
    }
  }
}
