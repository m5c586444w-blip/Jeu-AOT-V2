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
  /** Décalage en pixels écran (le nom passe sous l'icône de ville ou de porte posée au même point). */
  offset?: Point;
  /** Nom écrit lettre à lettre dans la bande du mur, le long de l'anneau (segments de mur). */
  alongWall?: boolean;
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
  private ordered: { spec: LabelSpec; text: Text }[] = [];
  private readonly arcs: { name: string; radius: number; bearing: number; letters: Text[] }[] = [];
  private readonly bands: { spec: LabelSpec; letters: Text[] }[] = [];

  /** `onWall(x, y)` : vrai si le point tombe sur la bande d'un mur ; un nom de lieu n'y est pas posé. */
  constructor(
    specs: readonly LabelSpec[],
    walls: readonly { name: string; radius: number; bearing: number }[],
    private readonly onWall: (x: number, y: number) => boolean = () => false,
  ) {
    for (const spec of specs) {
      if (spec.alongWall) {
        const letters = [...spec.text].map((ch) => {
          const t = new Text({ text: ch, style: STYLES[spec.style], resolution: 2 });
          t.anchor.set(0.5);
          this.container.addChild(t);
          return t;
        });
        this.bands.push({ spec, letters });
        continue;
      }
      const text = new Text({ text: spec.text, style: STYLES[spec.style], resolution: 2 });
      text.anchor.set(0.5);
      text.position.set(spec.at[0], spec.at[1]);
      this.container.addChild(text);
      this.items.push({ spec, text });
    }
    const RANK = { capitale: 0, district: 1, province: 2, outre: 3 } as const;
    this.ordered = [...this.items].sort((a, b) => RANK[a.spec.style] - RANK[b.spec.style] || LOD_ORDER.indexOf(a.spec.minLod) - LOD_ORDER.indexOf(b.spec.minLod));
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
  /**
   * `icons` : icônes dessinées (villes, portes, pions) en coordonnées du monde, avec un rayon minimal facultatif ; un nom ne les couvre pas.
   * Chaque nom essaie sa place par défaut, puis au-dessus, au-dessous, à droite et à gauche ; s'il ne tient nulle part
   * sans couvrir un autre nom, il se cache (les plus importants sont placés d'abord).
   */
  update(zoom: number, lod: Lod, visible: boolean, icons: readonly (readonly number[])[] = [], view?: readonly [number, number, number, number]): void {
    this.container.visible = visible;
    const level = LOD_ORDER.indexOf(lod);
    const inv = 1 / zoom;
    type Box = [number, number, number, number];
    const hit = (a: Box, b: Box): boolean => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    const placed: Box[] = [];
    const iconR = 9 * inv;
    // Une icône peut porter son rayon minimal dans le monde (portes : 7 km), sinon 7 px à l'écran.
    const iconBoxes: Box[] = icons.map(([x = 0, y = 0, min = 0]) => {
      const r = Math.max(iconR, min * 1.15);
      return [x - r, y - r, x + r, y + r];
    });
    for (const arc of this.arcs) {
      // Noms posés sur la moitié nord de l'anneau (lecture sans retournement).
      // Espacement angulaire calculé pour ~15 px par lettre à l'écran ; le relèvement glisse (± 60°) jusqu'à
      // une place où aucune lettre ne couvre une icône (porte, ville, pion) ni un autre nom de mur.
      const step = (15 / (arc.radius * zoom + 16)) * (180 / Math.PI);
      const boxesAt = (center: number): { b: number; x: number; y: number; box: Box }[] => {
        const start = center - ((arc.letters.length - 1) * step) / 2;
        const r = 7 * inv;
        // Lettres à 16 px à l'écran au-delà du bord extérieur du mur : elles ne passent pas sur les pions posés sur le mur.
        const radius = arc.radius + 16 * inv;
        return arc.letters.map((_, i) => {
          const b = start + i * step;
          const [x, y] = polar(radius, b);
          return { b, x, y, box: [x - r, y - r, x + r, y + r] as Box };
        });
      };
      const shifts = [0];
      for (let d = 3; d <= 60; d += 3) shifts.push(d, -d);
      // Nombre de lettres qui couvrent quelque chose ; à défaut de place libre, le décalage le moins encombré l'emporte.
      const cost = (c: number): number => boxesAt(c).filter(({ box }) => placed.some((p) => hit(p, box)) || iconBoxes.some((p) => hit(p, box))).length;
      let best = 0;
      let bestCost = Infinity;
      for (const d of shifts) {
        const k = cost(arc.bearing + d);
        if (k < bestCost) [best, bestCost] = [d, k];
        if (k === 0) break;
      }
      const center = arc.bearing + best;
      boxesAt(center).forEach(({ b, x, y, box }, i) => {
        const t = arc.letters[i];
        if (!t) return;
        t.position.set(x, y);
        t.rotation = (b * Math.PI) / 180;
        t.scale.set(inv);
        placed.push(box);
      });
    }
    // Neuf points de la boîte (coins, milieux des côtés, centre) testés contre les bandes de murs.
    const crossesWall = ([x0, y0, x1, y1]: Box): boolean => {
      for (const fx of [0, 0.5, 1]) for (const fy of [0, 0.5, 1]) if (this.onWall(x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy)) return true;
      return false;
    };
    // Noms de segments dans la bande de leur mur : lus de gauche à droite (sens inversé sur la moitié sud de l'anneau),
    // glissés le long du mur jusqu'à ne couvrir ni porte, ni pion, ni autre nom ; cachés s'ils ne tiennent pas.
    for (const { spec, letters } of this.bands) {
      const show = LOD_ORDER.indexOf(spec.minLod) <= level;
      const radius = Math.hypot(spec.at[0], spec.at[1]);
      const home = (Math.atan2(spec.at[0], -spec.at[1]) * 180) / Math.PI;
      const south = Math.cos((home * Math.PI) / 180) < 0;
      const widths = letters.map((t) => (t.width / (t.scale.x || 1)) * inv);
      const total = widths.reduce((a, w) => a + w, 0);
      const span = ((total / radius) * 180) / Math.PI;
      const lay = (center: number): { b: number; x: number; y: number; box: Box }[] => {
        let acc = 0;
        return widths.map((w) => {
          const along = ((acc + w / 2) / radius) * (180 / Math.PI) - span / 2;
          acc += w;
          const b = south ? center - along : center + along;
          const [x, y] = polar(radius, b);
          const r = 6 * inv;
          return { b, x, y, box: [x - r, y - r, x + r, y + r] as Box };
        });
      };
      let spot: ReturnType<typeof lay> | undefined;
      if (show) {
        const step = Math.max(1, span / 4);
        for (let k = 0; k <= 12 && !spot; k++) {
          for (const sign of k === 0 ? [1] : [1, -1]) {
            const cand = lay(home + sign * k * step);
            if (cand.every(({ box }) => !placed.some((p) => hit(p, box)) && !iconBoxes.some((p) => hit(p, box)))) {
              spot = cand;
              break;
            }
          }
        }
      }
      letters.forEach((t, i) => {
        const c = spot?.[i];
        t.visible = c !== undefined;
        if (!c) return;
        t.scale.set(inv);
        t.position.set(c.x, c.y);
        t.rotation = ((south ? c.b + 180 : c.b) * Math.PI) / 180;
        placed.push(c.box);
      });
    }
    for (const { spec, text } of this.ordered) {
      text.scale.set(inv);
      if (LOD_ORDER.indexOf(spec.minLod) > level) {
        text.visible = false;
        continue;
      }
      const hw = (text.width / 2) * 1.08;
      const hh = (text.height / 2) * 1.1;
      const gapX = text.width / 2 / inv + 22;
      const base = spec.offset ?? [0, 0];
      const tries: Point[] = [base, [0, -19], [0, 17], [0, 28], [0, -30], [gapX, 0], [-gapX, 0], [0, 40], [0, -42]];
      const boxAt = ([dx, dy]: Point): Box => {
        const x = spec.at[0] + dx * inv;
        const y = spec.at[1] + dy * inv;
        return [x - hw, y - hh, x + hw, y + hh];
      };
      const clear = (b: Box): boolean => !placed.some((p) => hit(p, b)) && !iconBoxes.some((p) => hit(p, b));
      // Hors des murs d'abord ; une ville posée sur un mur (district, porte) garde son nom même s'il le touche.
      const onWallTown = spec.style === "district" || spec.style === "capitale";
      const inView = ([x0, y0, x1, y1]: Box): boolean => !view || (x0 >= view[0] && y0 >= view[1] && x1 <= view[2] && y1 <= view[3]);
      const free =
        tries.find((o) => clear(boxAt(o)) && !crossesWall(boxAt(o)) && inView(boxAt(o))) ??
        tries.find((o) => clear(boxAt(o)) && !crossesWall(boxAt(o))) ??
        (onWallTown ? tries.find((o) => clear(boxAt(o))) : undefined);
      const chosen = free ?? base;
      const box = boxAt(chosen);
      text.position.set(spec.at[0] + chosen[0] * inv, spec.at[1] + chosen[1] * inv);
      text.visible = free !== undefined || (!placed.some((p) => hit(p, box)) && (onWallTown || !crossesWall(box)));
      if (text.visible) placed.push(box);
    }
  }
}
