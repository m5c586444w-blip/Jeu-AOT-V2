import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace } from "three";
import type { Texture } from "three";
import type { RoofMaterial, StyleProfile, WallMaterial } from "../../data/artSchemas";
import type { EnvData } from "./envTypes";
import { centroid } from "./geom2";
import { derive, range, seeded } from "./rng";
import type { Rand } from "./rng";
import { MATERIALS, facadeColor } from "./styles";
import { slopeAt } from "./terrain";

/**
 * Textures procédurales des environnements de R1b (navigateur seulement : canvas). Toutes les teintes viennent de la palette
 * du profil ou de `data/art/materiaux.json` ; aucune image externe.
 * - Façades par matière : enduit, colombage (pans de bois de la teinte `bois`), pierre de taille, pierre brute, brique, bois.
 *   Une tuile d'étage couvre 4 travées sur 2 étages ; la carte d'émission (fenêtres éclairées) suit la même mise en page.
 * - Toits par couverture, en niveaux de gris (la teinte vient du sommet).
 * - Sol : parcelles et sillons, vergers, sous-bois, berges, routes et ornières, cours, sable, roche des pentes.
 */
const BAY = 128;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas 2D indisponible");
  return [c, g];
}

function tex(c: HTMLCanvasElement, color = true, aniso = 4): CanvasTexture {
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  if (color) t.colorSpace = SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

/** Teinte CSS d'une teinte hex éclaircie ou assombrie (k > 1 éclaircit), avec alpha. */
/**
 * Teinte « #RRGGBB » nuancée par `k`, en `rgba()` pour le canevas. Les composantes sont lues en sRGB : `Color` les garde en
 * linéaire, et les écrire telles quelles dans un canevas sRGB (décodé ensuite comme sRGB) assombrissait deux fois les teintes
 * du profil (défaut trouvé en R1b, lot 2, sur les sols souterrains presque noirs).
 */
function shade(hex: string, k: number, a = 1): string {
  const c = new Color(hex).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const f = (v: number): number => Math.round(Math.min(255, Math.max(0, v * 255 * k)));
  return `rgba(${f(c.r)},${f(c.g)},${f(c.b)},${a})`;
}

function speckle(g: CanvasRenderingContext2D, rand: Rand, w: number, h: number, n: number, alpha: number): void {
  for (let i = 0; i < n; i++) {
    const v = rand() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${alpha * rand()})`;
    const s = 1 + rand() * 2.5;
    g.fillRect(rand() * w, rand() * h, s, s);
  }
}

/** Fond de mur d'une matière, aux teintes du profil. */
function wallBase(g: CanvasRenderingContext2D, rand: Rand, m: WallMaterial, p: StyleProfile, w: number, h: number, floorPx: number): void {
  const base = facadeColor(p, m);
  if (m === "enduit" || m === "colombage") {
    g.fillStyle = shade(base, 1);
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = shade(base, range(rand, 0.86, 1.08), 0.12);
      g.beginPath();
      g.ellipse(rand() * w, rand() * h, 20 + rand() * 60, 10 + rand() * 40, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
    speckle(g, rand, w, h, w * h * 0.02, 0.1);
  } else if (m === "pierre_taillee" || m === "brique") {
    const rowH = m === "brique" ? 8 : 16;
    g.fillStyle = shade(base, m === "brique" ? 0.62 : 0.78);
    g.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += rowH, row++) {
      let x = row % 2 ? -(m === "brique" ? 8 : 18) : 0;
      while (x < w) {
        const bw = m === "brique" ? 16 : 30 + rand() * 22;
        g.fillStyle = shade(base, range(rand, 0.88, 1.08));
        g.fillRect(x + 1.2, y + 1.2, bw - 2.4, rowH - 2.4);
        x += bw;
      }
    }
    speckle(g, rand, w, h, w * h * 0.025, 0.12);
  } else if (m === "pierre_brute") {
    g.fillStyle = shade(base, 0.6);
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < (w * h) / 260; i++) {
      g.fillStyle = shade(base, range(rand, 0.8, 1.12));
      g.beginPath();
      g.ellipse(rand() * w, rand() * h, 6 + rand() * 11, 4 + rand() * 7, rand() * 0.6, 0, Math.PI * 2);
      g.fill();
    }
    speckle(g, rand, w, h, w * h * 0.02, 0.12);
  } else {
    // Bois : planches verticales.
    g.fillStyle = shade(base, 0.7);
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 14) {
      g.fillStyle = shade(base, range(rand, 0.85, 1.12));
      g.fillRect(x + 1, 0, 12, h);
      g.fillStyle = shade(base, 0.6, 0.35);
      for (let k = 0; k < 3; k++) g.fillRect(x + 2 + rand() * 9, rand() * h, 1.5, 6 + rand() * 20);
    }
  }
  if (m === "colombage") {
    // Pans de bois : poteaux aux travées, sablières aux étages, décharges en diagonale.
    g.fillStyle = shade(p.palette.bois, 0.9);
    for (let x = 0; x <= w; x += BAY) g.fillRect(x - 5, 0, 10, h);
    for (let y = floorPx; y <= h + 1; y += floorPx) g.fillRect(0, y - 8, w, 10);
    g.fillRect(0, 0, w, 7);
    g.strokeStyle = shade(p.palette.bois, 0.9);
    g.lineWidth = 7;
    for (let x = 0; x < w; x += BAY) {
      for (let y = 0; y < h; y += floorPx) {
        g.beginPath();
        if ((x / BAY + y / floorPx) % 2 === 0) {
          g.moveTo(x + 6, y + floorPx - 8);
          g.lineTo(x + 34, y + 10);
        } else {
          g.moveTo(x + BAY - 6, y + floorPx - 8);
          g.lineTo(x + BAY - 34, y + 10);
        }
        g.stroke();
      }
    }
  }
}

function drawWindow(g: CanvasRenderingContext2D, rand: Rand, x: number, y: number, w: number, h: number, p: StyleProfile, shutter: string | null, small: boolean): [number, number, number, number] {
  const glass = MATERIALS.physiques.verre;
  g.fillStyle = shade(p.palette.pierre, 1.25, 0.95);
  if (!small) g.fillRect(x - 5, y - 8, w + 10, h + 14);
  g.fillStyle = shade(p.palette.bois, 0.9);
  g.fillRect(x, y, w, h);
  const grad = g.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, shade(MATERIALS.physiques.lumiere, 0.5));
  grad.addColorStop(0.45, shade(glass, 2.2));
  grad.addColorStop(1, shade(glass, 1.4));
  g.fillStyle = grad;
  g.fillRect(x + 3, y + 3, w - 6, h - 6);
  g.fillStyle = shade(p.palette.bois, 0.9);
  g.fillRect(x + w / 2 - 1.5, y, 3, h);
  g.fillRect(x, y + h / 2 - 1, w, 2.5);
  g.fillStyle = shade(p.palette.pierre, 1.15);
  g.fillRect(x - 7, y + h + 2, w + 14, 5);
  if (shutter && rand() < 0.7) {
    g.fillStyle = shutter;
    const sw = w * 0.48;
    g.fillRect(x - sw - 4, y, sw, h);
    g.fillRect(x + w + 4, y, sw, h);
    g.fillStyle = "rgba(0,0,0,0.22)";
    for (let k = 0; k < h; k += 5) {
      g.fillRect(x - sw - 4, y + k, sw, 1.5);
      g.fillRect(x + w + 4, y + k, sw, 1.5);
    }
  }
  return [x + 3, y + 3, w - 6, h - 6];
}

export interface FacadeSet {
  upper: Texture;
  upperLit: Texture;
  ground: Texture;
  groundLit: Texture;
  plain: Texture;
}

/** Façades d'une matière pour un profil. Les villes ont des boutiques au rez-de-chaussée ; la campagne, des portes et de petites fenêtres. */
export function facadeSet(seed: number, m: WallMaterial, p: StyleProfile): FacadeSet {
  const rand = seeded(derive(seed, 1000 + ["colombage", "enduit", "pierre_taillee", "pierre_brute", "brique", "bois"].indexOf(m)));
  const urban = p.categorie === "ville";
  const small = m === "pierre_brute" || m === "bois" || !urban;
  const accents = MATERIALS.accents;
  const shutter = m === "pierre_taillee" && urban ? null : shade(accents[Math.floor(rand() * accents.length)] ?? p.palette.bois, 1);
  const W = BAY * 4;
  const [cu, gu] = canvas(W, BAY * 2);
  const [cl, gl] = canvas(W, BAY * 2);
  wallBase(gu, rand, m, p, W, BAY * 2, BAY);
  gl.fillStyle = "#000";
  gl.fillRect(0, 0, W, BAY * 2);
  const lit = MATERIALS.physiques.flamme;
  for (let fl = 0; fl < 2; fl++) {
    const y0 = fl * BAY;
    for (let b = 0; b < 4; b++) {
      const ww = small ? 34 : 44;
      const wh = small ? 46 : 72;
      const glass = drawWindow(gu, rand, b * BAY + (BAY - ww) / 2, y0 + (small ? 38 : 26), ww, wh, p, shutter, small);
      if (rand() < 0.4) {
        gl.fillStyle = shade(lit, range(rand, 0.75, 1));
        gl.fillRect(...glass);
      }
    }
  }
  const [cg, gg] = canvas(W, BAY);
  const [cgl, ggl] = canvas(W, BAY);
  wallBase(gg, rand, m, p, W, BAY, BAY);
  ggl.fillStyle = "#000";
  ggl.fillRect(0, 0, W, BAY);
  gg.fillStyle = shade(p.palette.pierre, 0.85);
  gg.fillRect(0, BAY - 14, W, 14);
  for (let b = 0; b < 4; b++) {
    const x0 = b * BAY;
    const r = rand();
    if (r < 0.35) {
      const dw = 40;
      const dx = x0 + (BAY - dw) / 2;
      gg.fillStyle = shade(p.palette.pierre, 1.2);
      gg.fillRect(dx - 6, 30, dw + 12, BAY - 30);
      gg.fillStyle = shade(p.palette.bois, range(rand, 0.8, 1.1));
      gg.beginPath();
      gg.moveTo(dx, BAY - 4);
      gg.lineTo(dx, 52);
      gg.arc(dx + dw / 2, 52, dw / 2, Math.PI, 0);
      gg.lineTo(dx + dw, BAY - 4);
      gg.fill();
    } else if (r < 0.65 && urban) {
      const vw = 96;
      const vx = x0 + (BAY - vw) / 2;
      gg.fillStyle = shade(p.palette.bois, 0.8);
      gg.fillRect(vx - 4, 22, vw + 8, BAY - 38);
      const glass = drawWindow(gg, rand, vx, 28, vw, BAY - 52, p, null, false);
      if (rand() < 0.7) {
        ggl.fillStyle = shade(lit, 1);
        ggl.fillRect(...glass);
      }
      gg.fillStyle = shade(accents[Math.floor(rand() * accents.length)] ?? p.palette.toit, 1);
      gg.fillRect(vx - 4, 8, vw + 8, 12);
    } else {
      const glass = drawWindow(gg, rand, x0 + (BAY - 36) / 2, 34, 36, 50, p, shutter, true);
      if (rand() < 0.45) {
        ggl.fillStyle = shade(lit, 0.9);
        ggl.fillRect(...glass);
      }
    }
  }
  const [cp, gp] = canvas(256, 256);
  wallBase(gp, rand, m, p, 256, 256, 256);
  return { upper: tex(cu), upperLit: tex(cl), ground: tex(cg), groundLit: tex(cgl), plain: tex(cp) };
}

/** Couvertures en niveaux de gris : tuiles, ardoises, chaume, terrasse, toile. */
export function roofTex(seed: number, cover: RoofMaterial): Texture {
  const rand = seeded(derive(seed, 1100 + ["tuiles_rouges", "ardoise", "chaume", "plat", "toile", "aucun"].indexOf(cover)));
  const [c, g] = canvas(256, 256);
  g.fillStyle = "rgb(150,150,150)";
  g.fillRect(0, 0, 256, 256);
  if (cover === "tuiles_rouges") {
    for (let y = 0, row = 0; y < 256; y += 16, row++) {
      for (let x = row % 2 ? -10 : 0; x < 256; x += 20) {
        const v = 165 + rand() * 60;
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.beginPath();
        g.moveTo(x + 1, y);
        g.lineTo(x + 19, y);
        g.lineTo(x + 19, y + 12);
        g.quadraticCurveTo(x + 10, y + 18, x + 1, y + 12);
        g.fill();
        g.fillStyle = "rgba(0,0,0,0.28)";
        g.fillRect(x + 1, y + 13, 18, 3);
      }
    }
  } else if (cover === "ardoise") {
    for (let y = 0, row = 0; y < 256; y += 10, row++) {
      for (let x = row % 2 ? -7 : 0; x < 256; x += 14) {
        const v = 170 + rand() * 50;
        g.fillStyle = `rgb(${v},${v},${v + 4})`;
        g.fillRect(x + 0.8, y + 0.8, 12.4, 8.4);
      }
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(0, y + 8.5, 256, 1.5);
    }
  } else if (cover === "chaume") {
    g.fillStyle = "rgb(190,190,190)";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) {
      const v = 120 + rand() * 120;
      g.strokeStyle = `rgba(${v},${v},${v},0.5)`;
      const x = rand() * 256;
      const y = rand() * 256;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + range(rand, -1.5, 1.5), y + 6 + rand() * 10);
      g.stroke();
    }
    for (let y = 0; y < 256; y += 32) {
      g.fillStyle = "rgba(0,0,0,0.12)";
      g.fillRect(0, y + 28, 256, 4);
    }
  } else if (cover === "toile") {
    for (let y = 0; y < 256; y += 3) {
      g.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.04})`;
      g.fillRect(0, y, 256, 1);
    }
    for (let x = 0; x < 256; x += 3) {
      g.fillStyle = `rgba(255,255,255,${0.03 + rand() * 0.04})`;
      g.fillRect(x, 0, 1, 256);
    }
  } else {
    speckle(g, rand, 256, 256, 6000, 0.25);
  }
  speckle(g, rand, 256, 256, 1500, 0.12);
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(60,70,50,${0.04 + rand() * 0.07})`;
    g.beginPath();
    g.ellipse(rand() * 256, rand() * 256, 8 + rand() * 30, 4 + rand() * 12, 0, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c, true);
}

/** Pavés et dalles, en niveaux de gris clairs (la teinte vient du sommet). */
export function cobbleTex(seed: number): Texture {
  const rand = seeded(derive(seed, 1200));
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = "rgb(120,120,120)";
  g.fillRect(0, 0, S, S);
  const cell = 16;
  for (let y = 0, row = 0; y < S + cell; y += cell * 0.8, row++) {
    for (let x = row % 2 ? -cell / 2 : 0; x < S + cell; x += cell) {
      const v = 175 + rand() * 60;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath();
      g.ellipse(x + range(rand, -1.5, 1.5), y + range(rand, -1.5, 1.5), cell * 0.44, cell * 0.36, rand(), 0, Math.PI * 2);
      g.fill();
    }
  }
  speckle(g, rand, S, S, 2500, 0.12);
  return tex(c);
}

const sol = (k: keyof typeof MATERIALS.sols, p: StyleProfile, share = 0.25): string => `#${new Color(MATERIALS.sols[k].base).lerp(new Color(p.palette.sol), share).getHexString()}`;

/** Texture de sol d'un environnement à terrain, `S` pixels de côté pour tout le carré de terrain. */
export function groundTex(env: EnvData, S: number): Texture | null {
  const t = env.terrain;
  if (!t) return null;
  const p = env.profile;
  const rand = seeded(derive(env.seed, 1300));
  const [c, g] = canvas(S, S);
  const size = t.spec.size;
  const k = S / size;
  const X = (x: number): number => (x + size / 2) * k;
  const Y = (y: number): number => (y + size / 2) * k;
  // Prairie : teinte `sol` du profil, taches et touches.
  g.fillStyle = shade(p.palette.sol, 1);
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < S * 1.2; i++) {
    g.fillStyle = shade(p.palette.sol, range(rand, 0.84, 1.14), 0.18);
    g.beginPath();
    g.ellipse(rand() * S, rand() * S, 4 + rand() * S * 0.02, 3 + rand() * S * 0.012, rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // Roche sur les pentes fortes, sable sur la côte.
  const cells = 160;
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const x = -size / 2 + ((i + 0.5) / cells) * size;
      const y = -size / 2 + ((j + 0.5) / cells) * size;
      const sl = slopeAt(t.heights, x, y);
      if (sl > 0.45) {
        g.fillStyle = shade(sol("roche", p, 0.15), range(rand, 0.85, 1.1), Math.min(1, (sl - 0.45) * 2.2));
        g.fillRect((i * S) / cells, (j * S) / cells, S / cells + 1, S / cells + 1);
      }
    }
  }
  if (t.seaLevel !== null && t.coast.length > 1) {
    g.fillStyle = shade(sol("sable", p, 0.1), 1);
    g.beginPath();
    g.moveTo(X(t.coast[0]?.x ?? 0), Y(t.coast[0]?.y ?? 0) - 40 * k);
    for (const q of t.coast) g.lineTo(X(q.x), Y(q.y) - 40 * k);
    g.lineTo(S, S);
    g.lineTo(0, S);
    g.fill();
  }
  // Parcelles : teinte de culture, sillons, bordure plus sombre.
  for (const pc of t.parcels) {
    const crop = pc.crop === "prairie" ? null : pc.crop;
    const base = crop ? sol(crop, p) : shade(p.palette.sol, 1.06);
    g.save();
    g.beginPath();
    pc.poly.forEach((q, i) => (i === 0 ? g.moveTo(X(q.x), Y(q.y)) : g.lineTo(X(q.x), Y(q.y))));
    g.closePath();
    g.fillStyle = crop ? shade(base, range(rand, 0.9, 1.08)) : base;
    g.fill();
    g.clip();
    if (crop && crop !== "verger") {
      const cc = centroid(pc.poly);
      g.translate(X(cc.x), Y(cc.y));
      g.rotate(pc.furrow);
      g.strokeStyle = shade(base, crop === "labour" ? 0.7 : 0.82, 0.55);
      g.lineWidth = Math.max(1, 0.8 * k);
      const step = Math.max(2, (crop === "labour" ? 1.6 : 2.4) * k);
      for (let d = -100 * k; d < 100 * k; d += step) {
        g.beginPath();
        g.moveTo(-120 * k, d);
        g.lineTo(120 * k, d);
        g.stroke();
      }
    }
    g.restore();
    g.strokeStyle = shade(p.palette.sol, 0.78, 0.6);
    g.lineWidth = Math.max(1, 1.5 * k);
    g.beginPath();
    pc.poly.forEach((q, i) => (i === 0 ? g.moveTo(X(q.x), Y(q.y)) : g.lineTo(X(q.x), Y(q.y))));
    g.closePath();
    g.stroke();
  }
  // Sous-bois : ombre douce sous les arbres de forêt.
  g.fillStyle = shade(sol("sous_bois", p, 0.4), 1, 0.35);
  for (const tr of t.trees) {
    if (tr.kind !== "feuillu" && tr.kind !== "conifere") continue;
    g.beginPath();
    g.arc(X(tr.x), Y(tr.y), 4.5 * k * tr.s, 0, Math.PI * 2);
    g.fill();
  }
  // Berges.
  const strokePath = (path: readonly { x: number; y: number }[], width: number, style: string): void => {
    g.strokeStyle = style;
    g.lineWidth = width * k;
    g.lineJoin = "round";
    g.lineCap = "round";
    g.beginPath();
    path.forEach((q, i) => (i === 0 ? g.moveTo(X(q.x), Y(q.y)) : g.lineTo(X(q.x), Y(q.y))));
    g.stroke();
  };
  for (const r of t.rivers) strokePath(r.path, r.width + 10, shade(sol("berge", p), 1));
  for (const l of t.lakes) {
    g.fillStyle = shade(sol("berge", p), 1);
    g.beginPath();
    l.shape.forEach((q, i) => {
      const cx = l.center.x + (q.x - l.center.x) * 1.12;
      const cy = l.center.y + (q.y - l.center.y) * 1.12;
      if (i === 0) g.moveTo(X(cx), Y(cy));
      else g.lineTo(X(cx), Y(cy));
    });
    g.fill();
  }
  // Routes et chemins : terre battue, ornières.
  for (const r of t.roads) {
    strokePath(r.path, r.width + 1.5, shade(sol("route", p), 0.85));
    strokePath(r.path, r.width, shade(sol("route", p), 1.02));
    if (r.kind === "route") strokePath(r.path, 0.8, shade(sol("route", p), 0.8, 0.5));
  }
  return tex(c, true, 8);
}

/**
 * Pierre de taille à joints du mur (niveaux de gris clairs : la teinte « ? » du mur vient du sommet). Une tuile couvre 4 × 4 blocs
 * (`bloc_m` de `murs.json`) ; coulures et taches de lichen discrètes.
 */
export function wallStoneTex(seed: number): Texture {
  const rand = seeded(derive(seed, 1400));
  const W = 512;
  const H = 256;
  const [c, g] = canvas(W, H);
  g.fillStyle = "rgb(150,148,142)";
  g.fillRect(0, 0, W, H);
  const bw = W / 4;
  const bh = H / 4;
  for (let r = 0; r < 4; r++) {
    for (let k = -1; k < 5; k++) {
      const x = k * bw + (r % 2 ? bw / 2 : 0);
      const v = 200 + rand() * 40;
      g.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
      g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
      // Arêtes adoucies : biseau clair en haut, ombre en bas.
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fillRect(x + 2, r * bh + 2, bw - 4, 3);
      g.fillStyle = "rgba(0,0,0,0.12)";
      g.fillRect(x + 2, r * bh + bh - 5, bw - 4, 3);
    }
  }
  speckle(g, rand, W, H, 9000, 0.1);
  for (let i = 0; i < 26; i++) {
    const x = rand() * W;
    const grad = g.createLinearGradient(x, 0, x, H);
    grad.addColorStop(0, "rgba(40,38,34,0.10)");
    grad.addColorStop(1, "rgba(40,38,34,0)");
    g.fillStyle = grad;
    g.fillRect(x, 0, 2 + rand() * 6, H * (0.4 + rand() * 0.6));
  }
  for (let i = 0; i < 18; i++) {
    g.fillStyle = `rgba(80,96,60,${0.04 + rand() * 0.06})`;
    g.beginPath();
    g.ellipse(rand() * W, rand() * H, 6 + rand() * 24, 4 + rand() * 10, 0, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c, true, 8);
}

/** Brume : nappes douces en alpha (blanc), sans bord visible, pour les couches de brume au sol. */
export function mistTex(seed: number): Texture {
  const rand = seeded(derive(seed, 1500));
  const S = 512;
  const [c, g] = canvas(S, S);
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < 220; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 20 + rand() * 90;
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        grad.addColorStop(0, `rgba(255,255,255,${0.12 + rand() * 0.1})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
      }
    }
  }
  const t = tex(c, true);
  t.repeat.set(3, 3);
  return t;
}
