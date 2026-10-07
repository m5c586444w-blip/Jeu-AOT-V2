import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import type { Texture } from "three";
import type { Facade, RoofCover } from "../../../data/placeSchema";
import { seeded } from "../rng";
import type { Rand } from "../rng";

/**
 * Textures des lieux (R1e), dessinées au canevas, sans image externe. Teintes neutres et claires : la teinte de chaque maison
 * (gabarit d'îlot) vient de la couleur d'instance, qui les multiplie.
 * - Façade d'étages : 4 travées × 2 étages (travée de `BAY_M`), fenêtres à croisillons, encadrements, volets et jardinières
 *   variés d'une travée à l'autre ; carte d'émission (fenêtres éclairées) de même mise en page.
 * - Rez-de-chaussée : deux rangées d'un niveau, boutiques (haut) et logis (bas : porte, fenêtres, soubassement).
 * - Pignon : une petite fenêtre de comble centrée par tuile de `GABLE_W` × `ATTIC_H` m.
 * - Couvertures en niveaux de gris, tuile de `ROOF_TILE_M` m : tuile plate (queue de castor), tuile canal, ardoise, bardeau,
 *   chaume, cuivre (joints debout), terrasse.
 */
export const BAY_M = 2.6;
export const GABLE_W = 4;
export const ATTIC_H = 2.7;
export const ROOF_TILE_M = 3;

const B = 256;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas 2D indisponible");
  return [c, g];
}

function tex(c: HTMLCanvasElement, color = true): CanvasTexture {
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  if (color) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const rgb = (r: number, g: number, b: number, a = 1): string => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;

function mottle(g: CanvasRenderingContext2D, r: Rand, w: number, h: number, n: number, dark: number, light: number): void {
  for (let i = 0; i < n; i++) {
    const v = r() < 0.5 ? 0 : 255;
    g.fillStyle = rgb(v, v, v, (v === 0 ? dark : light) * r());
    g.beginPath();
    g.ellipse(r() * w, r() * h, 4 + r() * 26, 3 + r() * 14, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
}

/** Coulures de pluie sous les appuis et au pied des murs. */
function streaks(g: CanvasRenderingContext2D, r: Rand, w: number, h: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h * 0.6;
    const len = 20 + r() * 80;
    const grd = g.createLinearGradient(0, y, 0, y + len);
    grd.addColorStop(0, rgb(60, 55, 50, 0.12));
    grd.addColorStop(1, rgb(60, 55, 50, 0));
    g.fillStyle = grd;
    g.fillRect(x, y, 2 + r() * 5, len);
  }
}

/** Fond d'une matière de façade (tons clairs, neutres). */
function wallBase(g: CanvasRenderingContext2D, r: Rand, m: Facade, w: number, h: number, floorPx: number): void {
  if (m === "enduit" || m === "colombage") {
    g.fillStyle = rgb(236, 230, 218);
    g.fillRect(0, 0, w, h);
    mottle(g, r, w, h, (w * h) / 900, 0.05, 0.06);
    for (let i = 0; i < (w * h) / 60; i++) {
      const v = 200 + r() * 55;
      g.fillStyle = rgb(v, v, v, 0.12);
      g.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
  } else if (m === "pierre_taillee" || m === "pierre_brute") {
    g.fillStyle = rgb(206, 200, 188);
    g.fillRect(0, 0, w, h);
    const ch = m === "pierre_taillee" ? floorPx / 6 : floorPx / 9;
    for (let y = 0, row = 0; y < h; y += ch, row++) {
      let x = -r() * ch * 2;
      while (x < w) {
        const bw = m === "pierre_taillee" ? ch * (1.6 + r() * 1.4) : ch * (0.8 + r() * 1.6);
        const v = 190 + r() * 40;
        g.fillStyle = rgb(v, v - 3, v - 9);
        if (m === "pierre_taillee") g.fillRect(x + 1.5, y + 1.5, bw - 3, ch - 3);
        else {
          g.beginPath();
          g.ellipse(x + bw / 2, y + ch / 2, bw / 2 - 1.5, ch / 2 - 1, (r() - 0.5) * 0.3, 0, Math.PI * 2);
          g.fill();
        }
        x += bw;
      }
      void row;
    }
    mottle(g, r, w, h, (w * h) / 1400, 0.07, 0.04);
  } else if (m === "brique") {
    g.fillStyle = rgb(196, 180, 166);
    g.fillRect(0, 0, w, h);
    const ch = floorPx / 14;
    for (let y = 0, row = 0; y < h; y += ch, row++) {
      for (let x = row % 2 ? -ch : 0; x < w; x += ch * 2.1) {
        const v = 0.85 + r() * 0.2;
        g.fillStyle = rgb(218 * v, 168 * v, 146 * v);
        g.fillRect(x + 1, y + 1, ch * 2.1 - 2, ch - 2);
      }
    }
  } else {
    g.fillStyle = rgb(170, 140, 108);
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 14 + r() * 8) {
      const v = 0.8 + r() * 0.3;
      g.fillStyle = rgb(160 * v, 128 * v, 96 * v);
      g.fillRect(x, 0, 12, h);
      g.fillStyle = rgb(70, 52, 36, 0.5);
      g.fillRect(x + 12, 0, 2, h);
    }
  }
  streaks(g, r, w, h, Math.round(w / 40));
}

/** Pans de bois d'un étage : poteaux, sablières, décharges (en croix de Saint-André ou en mi-homme). */
function timber(g: CanvasRenderingContext2D, r: Rand, x0: number, y0: number, w: number, h: number, bays: number, windowBox: (b: number) => [number, number, number, number]): void {
  const t = 10;
  const wood = (k: number): string => rgb(92 * k, 64 * k, 44 * k);
  g.fillStyle = wood(1);
  g.fillRect(x0, y0, w, t);
  g.fillRect(x0, y0 + h - t, w, t);
  for (let b = 0; b <= bays; b++) g.fillRect(x0 + (b * w) / bays - t / 2, y0, t, h);
  for (let b = 0; b < bays; b++) {
    const [wx, wy, ww, wh] = windowBox(b);
    // Poteaux de fenêtre, appui et linteau.
    g.fillStyle = wood(0.9 + r() * 0.2);
    g.fillRect(wx - t, y0, t * 0.8, h);
    g.fillRect(wx + ww + t * 0.2, y0, t * 0.8, h);
    g.fillRect(x0 + (b * w) / bays, wy + wh + 4, w / bays, t * 0.8);
    g.fillRect(x0 + (b * w) / bays, wy - t, w / bays, t * 0.8);
    // Décharges sous l'appui : une croix ou deux écharpes.
    g.strokeStyle = wood(0.95);
    g.lineWidth = t * 0.8;
    const bx = x0 + (b * w) / bays;
    const sy = wy + wh + 4 + t;
    g.beginPath();
    if ((b + Math.floor(r() * 2)) % 2) {
      g.moveTo(bx + 4, sy);
      g.lineTo(wx - t, y0 + h - t);
      g.moveTo(wx + ww + t, sy);
      g.lineTo(bx + w / bays - 4, y0 + h - t);
    } else {
      g.moveTo(bx + 4, sy);
      g.lineTo(bx + w / bays - 4, y0 + h - t);
      g.moveTo(bx + w / bays - 4, sy);
      g.lineTo(bx + 4, y0 + h - t);
    }
    g.stroke();
  }
}

const SHUTTERS = [rgb(78, 104, 82), rgb(122, 58, 44), rgb(70, 88, 110), rgb(150, 120, 70), rgb(96, 70, 52)];

/** Fenêtre à croisillons : encadrement, vitrage sombre à reflet, volets éventuels, jardinière. Renvoie la vitre (pour l'émission). */
function windowAt(g: CanvasRenderingContext2D, r: Rand, x: number, y: number, w: number, h: number, m: Facade, opts: { shutter: string | null; box: boolean; arch: boolean }): [number, number, number, number] {
  const stone = m === "pierre_taillee" || m === "pierre_brute" || m === "enduit";
  const f = 9;
  g.fillStyle = stone ? rgb(214, 206, 190) : rgb(226, 220, 206);
  g.fillRect(x - f, y - f, w + 2 * f, h + 2 * f);
  if (stone) {
    g.fillStyle = rgb(190, 182, 166);
    g.fillRect(x - f - 4, y + h + f - 2, w + 2 * f + 8, 8);
  }
  const grd = g.createLinearGradient(x, y, x + w, y + h);
  grd.addColorStop(0, rgb(58, 66, 74));
  grd.addColorStop(0.45, rgb(34, 40, 48));
  grd.addColorStop(0.55, rgb(70, 80, 88));
  grd.addColorStop(1, rgb(30, 34, 40));
  g.fillStyle = grd;
  if (opts.arch) {
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x, y + w / 2);
    g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    g.lineTo(x + w, y + h);
    g.fill();
  } else g.fillRect(x, y, w, h);
  // Rideau clair dans le haut d'une fenêtre sur deux.
  if (r() < 0.5) {
    g.fillStyle = rgb(220, 214, 200, 0.55);
    g.fillRect(x + 2, y + 2, w - 4, h * (0.15 + r() * 0.2));
  }
  g.fillStyle = rgb(236, 232, 222);
  g.fillRect(x + w / 2 - 2.5, y, 5, h);
  for (let k = 1; k < 3; k++) g.fillRect(x, y + (h * k) / 3 - 2, w, 4);
  if (opts.shutter) {
    const sw = w / 2 + 2;
    for (const sx of [x - f - sw - 2, x + w + f + 2]) {
      g.fillStyle = opts.shutter;
      g.fillRect(sx, y - 4, sw, h + 8);
      g.fillStyle = rgb(0, 0, 0, 0.25);
      for (let k = 6; k < h + 4; k += 7) g.fillRect(sx + 3, y - 4 + k, sw - 6, 2);
    }
  }
  if (opts.box) {
    g.fillStyle = rgb(110, 76, 50);
    g.fillRect(x - 4, y + h + 2, w + 8, 12);
    for (let k = 0; k < 9; k++) {
      g.fillStyle = r() < 0.5 ? rgb(170, 50, 50) : rgb(80, 120, 60);
      g.beginPath();
      g.arc(x + (w * k) / 8, y + h + 1, 4 + r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  return [x + 3, y + 3, w - 6, h - 6];
}

export interface FacadeTextures {
  upper: Texture;
  upperLit: Texture;
  ground: Texture;
  groundLit: Texture;
  gable: Texture;
}

const FACADE_SALT: Record<Facade, number> = { enduit: 1, colombage: 2, pierre_taillee: 3, pierre_brute: 4, brique: 5, bois: 6 };

export function facadeTextures(m: Facade, seed: number): FacadeTextures {
  const r = seeded(seed * 31 + FACADE_SALT[m]);
  const W = B * 4;
  // Étages : 4 travées × 2 étages.
  const [cu, gu] = canvas(W, B * 2);
  const [cl, gl] = canvas(W, B * 2);
  wallBase(gu, r, m, W, B * 2, B);
  gl.fillStyle = "#000";
  gl.fillRect(0, 0, W, B * 2);
  const winW = m === "pierre_brute" || m === "bois" ? 70 : 88;
  const winH = m === "pierre_brute" || m === "bois" ? 100 : 128;
  const box = (b: number, fl: number): [number, number, number, number] => [b * B + (B - winW) / 2, fl * B + 54 + (fl === 0 ? 0 : 6), winW, winH - (fl === 0 ? 0 : 10)];
  if (m === "colombage") for (let fl = 0; fl < 2; fl++) timber(gu, r, 0, fl * B, W, B, 4, (b) => box(b, fl));
  for (let fl = 0; fl < 2; fl++) {
    for (let b = 0; b < 4; b++) {
      const [x, y, w, h] = box(b, fl);
      const shutter = m === "pierre_taillee" || m === "brique" ? null : r() < 0.7 ? (SHUTTERS[(b + fl * 2 + Math.floor(r() * 2)) % SHUTTERS.length] as string) : null;
      const glass = windowAt(gu, r, x, y, w, h, m, { shutter, box: r() < 0.3, arch: m === "pierre_taillee" && fl === 1 && b % 2 === 0 });
      if (r() < 0.38) {
        gl.fillStyle = rgb(255, 196 + r() * 30, 120 + r() * 40);
        gl.fillRect(...glass);
      }
    }
    // Bandeau d'étage (corniche légère) en haut de l'étage, sauf pans de bois.
    if (m !== "colombage" && m !== "bois") {
      gu.fillStyle = rgb(190, 184, 172, 0.8);
      gu.fillRect(0, fl * B + 2, W, 7);
      gu.fillStyle = rgb(0, 0, 0, 0.12);
      gu.fillRect(0, fl * B + 9, W, 3);
    }
  }
  // Rez-de-chaussée : boutiques (moitié haute de l'image) et logis (moitié basse).
  const [cg, gg] = canvas(W, B * 2);
  const [cgl, ggl] = canvas(W, B * 2);
  wallBase(gg, r, m === "colombage" ? "enduit" : m, W, B * 2, B);
  ggl.fillStyle = "#000";
  ggl.fillRect(0, 0, W, B * 2);
  for (const row of [0, 1]) {
    const y0 = row * B;
    // Soubassement de pierre.
    gg.fillStyle = rgb(176, 170, 158);
    gg.fillRect(0, y0 + B - 26, W, 26);
    gg.fillStyle = rgb(0, 0, 0, 0.18);
    gg.fillRect(0, y0 + B - 27, W, 2);
    for (let b = 0; b < 4; b++) {
      const x0 = b * B;
      if (row === 0) {
        // Boutique : vitrine à petits bois, porte vitrée, enseigne (planche) au-dessus.
        const shopWood = SHUTTERS[(b * 3 + 1) % SHUTTERS.length] as string;
        gg.fillStyle = shopWood;
        gg.fillRect(x0 + 14, y0 + 30, B - 28, B - 56);
        gg.fillStyle = rgb(226, 214, 186);
        gg.fillRect(x0 + 24, y0 + 36, B - 48, 22);
        gg.fillStyle = rgb(70, 58, 44);
        for (let k = 0; k < 6; k++) gg.fillRect(x0 + 34 + k * 30, y0 + 44, 18, 6);
        const glass = windowAt(gg, r, x0 + 26, y0 + 66, b % 2 ? B - 52 : B - 120, B - 104, "bois", { shutter: null, box: false, arch: false });
        if (b % 2 === 0) {
          gg.fillStyle = rgb(78, 60, 42);
          gg.fillRect(x0 + B - 86, y0 + 66, 56, B - 92);
          gg.fillStyle = rgb(48, 54, 60);
          gg.fillRect(x0 + B - 78, y0 + 74, 40, 70);
        }
        if (r() < 0.75) {
          ggl.fillStyle = rgb(255, 200, 130);
          ggl.fillRect(...glass);
        }
      } else if (b === 1 || (b === 3 && r() < 0.5)) {
        // Porte cintrée de bois, encadrement de pierre.
        const dw = 74;
        const dx = x0 + (B - dw) / 2;
        gg.fillStyle = rgb(196, 188, 172);
        gg.fillRect(dx - 12, y0 + 40, dw + 24, B - 66);
        gg.fillStyle = SHUTTERS[(b + 3) % SHUTTERS.length] as string;
        gg.beginPath();
        gg.moveTo(dx, y0 + B - 26);
        gg.lineTo(dx, y0 + 40 + dw / 2);
        gg.arc(dx + dw / 2, y0 + 40 + dw / 2 + 6, dw / 2, Math.PI, 0);
        gg.lineTo(dx + dw, y0 + B - 26);
        gg.fill();
        gg.fillStyle = rgb(0, 0, 0, 0.25);
        for (let k = 1; k < 4; k++) gg.fillRect(dx + (dw * k) / 4 - 1, y0 + 50, 2, B - 80);
      } else {
        const glass = windowAt(gg, r, x0 + (B - 76) / 2, y0 + 60, 76, 104, m, { shutter: m === "enduit" ? (SHUTTERS[b % SHUTTERS.length] as string) : null, box: false, arch: false });
        if (r() < 0.3) {
          ggl.fillStyle = rgb(255, 205, 140);
          ggl.fillRect(...glass);
        }
      }
    }
  }
  // Pignon : une tuile de GABLE_W × ATTIC_H, une petite fenêtre centrée.
  const GW = 384;
  const GH = Math.round((GW * ATTIC_H) / GABLE_W);
  const [cgb, ggb] = canvas(GW, GH);
  wallBase(ggb, r, m, GW, GH, (GH * 3) / ATTIC_H);
  if (m === "colombage") {
    ggb.fillStyle = rgb(92, 64, 44);
    ggb.fillRect(0, GH - 9, GW, 9);
    for (const x of [GW / 2 - 70, GW / 2 + 62]) ggb.fillRect(x, 0, 9, GH);
    ggb.strokeStyle = rgb(92, 64, 44);
    ggb.lineWidth = 8;
    ggb.beginPath();
    ggb.moveTo(0, GH);
    ggb.lineTo(GW / 2 - 70, GH * 0.2);
    ggb.moveTo(GW, GH);
    ggb.lineTo(GW / 2 + 70, GH * 0.2);
    ggb.stroke();
  }
  windowAt(ggb, r, GW / 2 - 26, GH * 0.28, 52, 78, m, { shutter: null, box: false, arch: m === "pierre_taillee" });
  return { upper: tex(cu), upperLit: tex(cl), ground: tex(cg), groundLit: tex(cgl), gable: tex(cgb) };
}

/** Couverture en niveaux de gris (tuile de ROOF_TILE_M m). */
export function roofCoverTexture(cover: RoofCover, seed: number): Texture {
  const r = seeded(seed * 17 + ["ardoise", "tuile_plate", "tuile_canal", "bardeau", "chaume", "cuivre", "terrasse"].indexOf(cover) + 3);
  const S = 512;
  const px = S / ROOF_TILE_M;
  const [c, g] = canvas(S, S);
  g.fillStyle = rgb(150, 150, 150);
  g.fillRect(0, 0, S, S);
  if (cover === "tuile_plate") {
    const tw = 0.18 * px;
    const th = 0.15 * px;
    for (let y = S + th, row = 0; y > -th; y -= th, row++) {
      for (let x = row % 2 ? -tw / 2 : 0; x < S + tw; x += tw) {
        const v = 170 + r() * 70;
        g.fillStyle = rgb(v, v, v);
        g.beginPath();
        g.moveTo(x + 1, y - th * 1.6);
        g.lineTo(x + tw - 1, y - th * 1.6);
        g.lineTo(x + tw - 1, y - tw * 0.45);
        g.arc(x + tw / 2, y - tw * 0.45, tw / 2 - 1, 0, Math.PI);
        g.fill();
        g.fillStyle = rgb(0, 0, 0, 0.3);
        g.fillRect(x + 2, y - 1.5, tw - 4, 2);
      }
    }
  } else if (cover === "tuile_canal") {
    const tw = 0.22 * px;
    const th = 0.36 * px;
    for (let x = 0, col = 0; x < S; x += tw, col++) {
      for (let y = 0; y < S; y += th) {
        const v = 160 + r() * 70;
        const grd = g.createLinearGradient(x, 0, x + tw, 0);
        const top = col % 2 === 0;
        grd.addColorStop(0, rgb(v * (top ? 0.7 : 1.05), v * (top ? 0.7 : 1.05), v * (top ? 0.7 : 1.05)));
        grd.addColorStop(0.5, rgb(v * (top ? 1.15 : 0.75), v * (top ? 1.15 : 0.75), v * (top ? 1.15 : 0.75)));
        grd.addColorStop(1, rgb(v * (top ? 0.7 : 1.05), v * (top ? 0.7 : 1.05), v * (top ? 0.7 : 1.05)));
        g.fillStyle = grd;
        g.fillRect(x, y, tw, th - 2);
        g.fillStyle = rgb(0, 0, 0, 0.35);
        g.fillRect(x, y + th - 3, tw, 3);
      }
    }
  } else if (cover === "ardoise") {
    const tw = 0.2 * px;
    const th = 0.12 * px;
    for (let y = 0, row = 0; y < S; y += th, row++) {
      for (let x = row % 2 ? -tw / 2 : 0; x < S; x += tw) {
        const v = 160 + r() * 55;
        g.fillStyle = rgb(v, v, v + 5);
        g.fillRect(x + 1, y + 1, tw - 2, th - 1);
      }
      g.fillStyle = rgb(0, 0, 0, 0.32);
      g.fillRect(0, y + th - 1.5, S, 1.5);
    }
  } else if (cover === "bardeau") {
    const th = 0.14 * px;
    for (let y = 0, row = 0; y < S; y += th, row++) {
      let x = -r() * 20;
      while (x < S) {
        const tw = (0.08 + r() * 0.12) * px;
        const v = 150 + r() * 70;
        g.fillStyle = rgb(v, v, v);
        g.fillRect(x + 1, y, tw - 2, th - 1);
        g.fillStyle = rgb(0, 0, 0, 0.12);
        for (let k = 0; k < 3; k++) g.fillRect(x + 2 + r() * (tw - 4), y + 1, 1, th - 3);
        x += tw;
      }
      g.fillStyle = rgb(0, 0, 0, 0.3);
      g.fillRect(0, y + th - 2, S, 2);
      void row;
    }
  } else if (cover === "chaume") {
    g.fillStyle = rgb(185, 185, 185);
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 16000; i++) {
      const v = 110 + r() * 130;
      g.strokeStyle = rgb(v, v, v, 0.45);
      g.lineWidth = 1;
      const x = r() * S;
      const y = r() * S;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 3, y + 8 + r() * 14);
      g.stroke();
    }
    for (let y = 0; y < S; y += 0.45 * px) {
      g.fillStyle = rgb(0, 0, 0, 0.14);
      g.fillRect(0, y, S, 5);
    }
  } else if (cover === "cuivre") {
    const pw = 0.6 * px;
    for (let x = 0; x < S; x += pw) {
      const v = 175 + r() * 40;
      g.fillStyle = rgb(v, v, v);
      g.fillRect(x, 0, pw, S);
      g.fillStyle = rgb(255, 255, 255, 0.35);
      g.fillRect(x + pw - 4, 0, 3, S);
      g.fillStyle = rgb(0, 0, 0, 0.25);
      g.fillRect(x + pw - 1, 0, 2, S);
    }
    mottle(g, r, S, S, 90, 0.18, 0.12);
  } else {
    for (let i = 0; i < 9000; i++) {
      const v = 110 + r() * 100;
      g.fillStyle = rgb(v, v, v, 0.6);
      g.fillRect(r() * S, r() * S, 2, 2);
    }
  }
  // Usure : lichens et mousses (plus sombres), traînées.
  for (let i = 0; i < 22; i++) {
    g.fillStyle = rgb(40, 50, 30, 0.05 + r() * 0.08);
    g.beginPath();
    g.ellipse(r() * S, r() * S, 10 + r() * 50, 6 + r() * 20, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c, true);
}

/** Chaussée : pavés (gros), dalles, terre battue, gravier ; tuile de 4 m, niveaux clairs (teinte de sommet). */
export function pavingTexture(kind: "paves" | "dalles" | "terre" | "gravier", seed: number): Texture {
  const r = seeded(seed * 13 + ["paves", "dalles", "terre", "gravier"].indexOf(kind) + 7);
  const S = 512;
  const [c, g] = canvas(S, S);
  if (kind === "paves") {
    g.fillStyle = rgb(110, 106, 100);
    g.fillRect(0, 0, S, S);
    const cell = S / 22;
    for (let y = 0, row = 0; y < S + cell; y += cell, row++) {
      for (let x = row % 2 ? -cell / 2 : 0; x < S + cell; x += cell) {
        const v = 150 + r() * 70;
        g.fillStyle = rgb(v, v - 2, v - 6);
        g.beginPath();
        g.ellipse(x + (r() - 0.5) * 2, y + (r() - 0.5) * 2, cell * 0.46, cell * 0.42, r(), 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (kind === "dalles") {
    g.fillStyle = rgb(120, 116, 110);
    g.fillRect(0, 0, S, S);
    const ch = S / 8;
    for (let y = 0; y < S; y += ch) {
      let x = -r() * ch;
      while (x < S) {
        const w = ch * (0.9 + r() * 1.2);
        const v = 170 + r() * 50;
        g.fillStyle = rgb(v, v - 3, v - 8);
        g.fillRect(x + 2, y + 2, w - 4, ch - 4);
        x += w;
      }
    }
  } else {
    g.fillStyle = kind === "terre" ? rgb(176, 158, 128) : rgb(178, 172, 160);
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 14000; i++) {
      const v = kind === "terre" ? 120 + r() * 90 : 130 + r() * 110;
      g.fillStyle = rgb(v, v * 0.95, v * 0.85, 0.5);
      const s = kind === "terre" ? 1.5 : 2 + r() * 3;
      g.fillRect(r() * S, r() * S, s, s);
    }
  }
  mottle(g, r, S, S, 60, 0.12, 0.05);
  return tex(c, true);
}
