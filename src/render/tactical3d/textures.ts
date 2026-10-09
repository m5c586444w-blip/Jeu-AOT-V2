import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import type { Texture } from "three";
import { derive, range, seeded } from "./rng";
import type { Rand } from "./rng";

/**
 * Textures procédurales de l'essai 3D (R1) : dessinées sur canvas à l'exécution, à partir d'une graine. Aucune image externe.
 * Façades : une tuile couvre 4 travées sur 2 étages (étages) ou 4 travées sur 1 étage (rez-de-chaussée). La carte
 * d'émission (fenêtres éclairées la nuit) suit exactement la même mise en page.
 */
export type WallKind = 0 | 1 | 2;
const BAY_PX = 128;

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
  t.anisotropy = 4;
  return t;
}

const rgb = (r: number, g: number, b: number, a = 1): string => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;

/** Grain : petites taches claires et sombres. */
function speckle(g: CanvasRenderingContext2D, rand: Rand, w: number, h: number, n: number, alpha: number): void {
  for (let i = 0; i < n; i++) {
    const v = rand() < 0.5 ? 0 : 255;
    g.fillStyle = rgb(v, v, v, alpha * rand());
    const s = 1 + rand() * 2.5;
    g.fillRect(rand() * w, rand() * h, s, s);
  }
}

/** Coulures verticales discrètes (pluie, suie). */
function streaks(g: CanvasRenderingContext2D, rand: Rand, w: number, h: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const x = rand() * w;
    const y = rand() * h * 0.5;
    const len = h * (0.2 + rand() * 0.5);
    const grad = g.createLinearGradient(x, y, x, y + len);
    grad.addColorStop(0, "rgba(40,36,30,0.10)");
    grad.addColorStop(1, "rgba(40,36,30,0)");
    g.fillStyle = grad;
    g.fillRect(x, y, 2 + rand() * 5, len);
  }
}

/** Fond de mur : enduit, pierre de taille ou brique. */
function wallBase(g: CanvasRenderingContext2D, rand: Rand, kind: WallKind, w: number, h: number): void {
  if (kind === 0) {
    g.fillStyle = rgb(214, 202, 176);
    g.fillRect(0, 0, w, h);
    speckle(g, rand, w, h, w * h * 0.02, 0.12);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = rgb(150 + rand() * 60, 140 + rand() * 50, 110 + rand() * 40, 0.07);
      g.beginPath();
      g.ellipse(rand() * w, rand() * h, 20 + rand() * 60, 10 + rand() * 40, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 1) {
    g.fillStyle = rgb(120, 116, 106);
    g.fillRect(0, 0, w, h);
    const rowH = 16;
    for (let y = 0, row = 0; y < h; y += rowH, row++) {
      let x = row % 2 ? -18 : 0;
      while (x < w) {
        const bw = 30 + rand() * 22;
        const v = 140 + rand() * 40;
        g.fillStyle = rgb(v, v * 0.97, v * 0.9);
        g.fillRect(x + 1.5, y + 1.5, bw - 3, rowH - 3);
        x += bw;
      }
    }
    speckle(g, rand, w, h, w * h * 0.03, 0.14);
  } else {
    g.fillStyle = rgb(150, 140, 128);
    g.fillRect(0, 0, w, h);
    const rowH = 8;
    for (let y = 0, row = 0; y < h; y += rowH, row++) {
      for (let x = row % 2 ? -8 : 0; x < w; x += 16) {
        const r = 128 + rand() * 30;
        g.fillStyle = rgb(r, r * 0.5, r * 0.38);
        g.fillRect(x + 1, y + 1, 14, rowH - 2);
      }
    }
    speckle(g, rand, w, h, w * h * 0.02, 0.12);
  }
  streaks(g, rand, w, h, 10);
}

interface WindowStyle {
  frame: string;
  shutter: string | null;
}

/** Une fenêtre : encadrement, vitres à croisillons, appui ; volets ouverts parfois. Renvoie le rectangle vitré. */
function drawWindow(g: CanvasRenderingContext2D, rand: Rand, x: number, y: number, w: number, h: number, s: WindowStyle): [number, number, number, number] {
  // Encadrement de pierre claire et linteau.
  g.fillStyle = "rgba(226,218,198,0.95)";
  g.fillRect(x - 5, y - 8, w + 10, h + 14);
  g.fillStyle = s.frame;
  g.fillRect(x, y, w, h);
  // Vitres : sombres, avec un reflet de ciel en haut.
  const grad = g.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, "rgb(120,136,146)");
  grad.addColorStop(0.45, "rgb(48,56,62)");
  grad.addColorStop(1, "rgb(30,33,36)");
  g.fillStyle = grad;
  const gx = x + 3;
  const gy = y + 3;
  const gw = w - 6;
  const gh = h - 6;
  g.fillRect(gx, gy, gw, gh);
  // Croisillons.
  g.fillStyle = s.frame;
  g.fillRect(x + w / 2 - 1.5, y, 3, h);
  for (let k = 1; k < 3; k++) g.fillRect(x, y + (h * k) / 3 - 1, w, 2.5);
  // Appui.
  g.fillStyle = "rgb(200,192,172)";
  g.fillRect(x - 7, y + h + 2, w + 14, 5);
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(x - 7, y + h + 7, w + 14, 3);
  if (s.shutter && rand() < 0.75) {
    g.fillStyle = s.shutter;
    const sw = w * 0.48;
    g.fillRect(x - sw - 4, y, sw, h);
    g.fillRect(x + w + 4, y, sw, h);
    g.fillStyle = "rgba(0,0,0,0.22)";
    for (let k = 0; k < h; k += 5) {
      g.fillRect(x - sw - 4, y + k, sw, 1.5);
      g.fillRect(x + w + 4, y + k, sw, 1.5);
    }
  }
  return [gx, gy, gw, gh];
}

export interface FacadeSet {
  upper: Texture;
  upperLit: Texture;
  ground: Texture;
  groundLit: Texture;
  plain: Texture;
}

/** Façades d'une matière : étages, rez-de-chaussée, mur aveugle ; cartes d'émission pour la nuit. */
export function facadeTextures(seed: number, kind: WallKind): FacadeSet {
  const rand = seeded(derive(seed, 100 + kind));
  const frames = ["rgb(74,58,42)", "rgb(58,62,58)", "rgb(220,214,198)"];
  const shutters = ["rgb(79,107,90)", "rgb(96,72,52)", "rgb(70,80,92)", null];
  const style: WindowStyle = { frame: frames[Math.floor(rand() * frames.length)] ?? "rgb(74,58,42)", shutter: shutters[Math.floor(rand() * shutters.length)] ?? null };
  const W = BAY_PX * 4;
  // Étages : 4 travées × 2 étages.
  const [cu, gu] = canvas(W, BAY_PX * 2);
  const [cl, gl] = canvas(W, BAY_PX * 2);
  wallBase(gu, rand, kind, W, BAY_PX * 2);
  gl.fillStyle = "#000";
  gl.fillRect(0, 0, W, BAY_PX * 2);
  for (let fl = 0; fl < 2; fl++) {
    const y0 = fl * BAY_PX;
    // Bandeau d'étage.
    gu.fillStyle = "rgba(230,222,204,0.55)";
    gu.fillRect(0, y0 + BAY_PX - 7, W, 5);
    gu.fillStyle = "rgba(0,0,0,0.18)";
    gu.fillRect(0, y0 + BAY_PX - 2, W, 2);
    for (let b = 0; b < 4; b++) {
      const ww = 44;
      const wh = 72;
      const glass = drawWindow(gu, rand, b * BAY_PX + (BAY_PX - ww) / 2, y0 + 26, ww, wh, style);
      if (rand() < 0.4) {
        const warm = 200 + rand() * 55;
        gl.fillStyle = rgb(warm, warm * 0.78, warm * 0.42);
        gl.fillRect(...glass);
        gl.fillStyle = "rgba(0,0,0,0.55)";
        gl.fillRect(glass[0] + glass[2] / 2 - 1.5, glass[1], 3, glass[3]);
      }
    }
  }
  // Rez-de-chaussée : portes cintrées et vitrines, soubassement.
  const [cg, gg] = canvas(W, BAY_PX);
  const [cgl, ggl] = canvas(W, BAY_PX);
  wallBase(gg, rand, kind, W, BAY_PX);
  ggl.fillStyle = "#000";
  ggl.fillRect(0, 0, W, BAY_PX);
  gg.fillStyle = "rgb(128,122,110)";
  gg.fillRect(0, BAY_PX - 16, W, 16);
  for (let b = 0; b < 4; b++) {
    const x0 = b * BAY_PX;
    const r = rand();
    if (r < 0.35) {
      // Porte de bois cintrée.
      const dw = 42;
      const dx = x0 + (BAY_PX - dw) / 2;
      gg.fillStyle = "rgb(222,214,196)";
      gg.fillRect(dx - 6, 30, dw + 12, BAY_PX - 30);
      gg.fillStyle = `rgb(${70 + rand() * 30},${48 + rand() * 20},${32 + rand() * 10})`;
      gg.beginPath();
      gg.moveTo(dx, BAY_PX - 4);
      gg.lineTo(dx, 52);
      gg.arc(dx + dw / 2, 52, dw / 2, Math.PI, 0);
      gg.lineTo(dx + dw, BAY_PX - 4);
      gg.fill();
      gg.fillStyle = "rgba(0,0,0,0.3)";
      gg.fillRect(dx + dw / 2 - 1, 40, 2, BAY_PX - 44);
    } else if (r < 0.65) {
      // Vitrine.
      const vw = 96;
      const vx = x0 + (BAY_PX - vw) / 2;
      gg.fillStyle = "rgb(60,52,44)";
      gg.fillRect(vx - 4, 22, vw + 8, BAY_PX - 38);
      const glass = drawWindow(gg, rand, vx, 28, vw, BAY_PX - 52, { frame: "rgb(60,52,44)", shutter: null });
      if (rand() < 0.7) {
        ggl.fillStyle = "rgb(255,196,110)";
        ggl.fillRect(...glass);
      }
      // Enseigne sans texte.
      gg.fillStyle = ["rgb(79,107,90)", "rgb(138,59,42)", "rgb(42,58,92)", "rgb(181,135,58)"][Math.floor(rand() * 4)] ?? "rgb(79,107,90)";
      gg.fillRect(vx - 4, 8, vw + 8, 12);
    } else {
      const glass = drawWindow(gg, rand, x0 + (BAY_PX - 44) / 2, 30, 44, 60, style);
      if (rand() < 0.45) {
        ggl.fillStyle = "rgb(240,180,100)";
        ggl.fillRect(...glass);
      }
    }
  }
  // Mur aveugle (pignons, acrotères, souches).
  const [cp, gp] = canvas(256, 256);
  wallBase(gp, rand, kind, 256, 256);
  return { upper: tex(cu), upperLit: tex(cl), ground: tex(cg), groundLit: tex(cgl), plain: tex(cp) };
}

/** Tuiles ou ardoises en rangs, en niveaux de gris : la couleur vient du sommet (une teinte par maison). */
export function roofTexture(seed: number): Texture {
  const rand = seeded(derive(seed, 200));
  const [c, g] = canvas(256, 256);
  g.fillStyle = "rgb(150,150,150)";
  g.fillRect(0, 0, 256, 256);
  const rowH = 16;
  for (let y = 0, row = 0; y < 256; y += rowH, row++) {
    for (let x = row % 2 ? -10 : 0; x < 256; x += 20) {
      const v = 165 + rand() * 60;
      g.fillStyle = rgb(v, v, v);
      g.beginPath();
      g.moveTo(x + 1, y);
      g.lineTo(x + 19, y);
      g.lineTo(x + 19, y + rowH - 4);
      g.quadraticCurveTo(x + 10, y + rowH + 2, x + 1, y + rowH - 4);
      g.fill();
      g.fillStyle = "rgba(0,0,0,0.28)";
      g.fillRect(x + 1, y + rowH - 3, 18, 3);
    }
  }
  speckle(g, rand, 256, 256, 1500, 0.15);
  // Mousse et salissures.
  for (let i = 0; i < 18; i++) {
    g.fillStyle = `rgba(70,80,50,${0.05 + rand() * 0.08})`;
    g.beginPath();
    g.ellipse(rand() * 256, rand() * 256, 8 + rand() * 30, 4 + rand() * 12, 0, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c);
}

/** Pavés de rue : pierres arrondies irrégulières. */
export function cobbleTexture(seed: number): Texture {
  const rand = seeded(derive(seed, 300));
  const S = 512;
  const [c, g] = canvas(S, S);
  g.fillStyle = "rgb(84,78,68)";
  g.fillRect(0, 0, S, S);
  const cell = 21;
  for (let y = 0, row = 0; y < S + cell; y += cell * 0.8, row++) {
    for (let x = row % 2 ? -cell / 2 : 0; x < S + cell; x += cell) {
      const v = 120 + rand() * 50;
      g.fillStyle = rgb(v, v * 0.95, v * 0.86);
      g.beginPath();
      g.ellipse(x + range(rand, -2, 2), y + range(rand, -2, 2), cell * 0.44, cell * 0.36, rand(), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.08)";
      g.beginPath();
      g.ellipse(x - 2, y - 2, cell * 0.25, cell * 0.18, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  speckle(g, rand, S, S, 4000, 0.12);
  return tex(c);
}

/** Dalles de la place et des cours. */
export function flagTexture(seed: number): Texture {
  const rand = seeded(derive(seed, 400));
  const S = 512;
  const [c, g] = canvas(S, S);
  g.fillStyle = "rgb(110,104,94)";
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 64) {
    let x = rand() * -40;
    while (x < S) {
      const w = 50 + rand() * 50;
      const v = 150 + rand() * 40;
      g.fillStyle = rgb(v, v * 0.96, v * 0.9);
      g.fillRect(x + 2, y + 2, w - 4, 60);
      x += w;
    }
  }
  speckle(g, rand, S, S, 5000, 0.12);
  return tex(c);
}

/**
 * Herbe rase et terre battue, hors de la ville. Pas de grandes taches : vue de haut, une tache se reconnaît à chaque
 * répétition de la tuile (04 §2.4). Beaucoup de petites touches, raccordées aux bords (tuile sans couture).
 */
export function grassTexture(seed: number): Texture {
  const rand = seeded(derive(seed, 500));
  const S = 1024;
  const [c, g] = canvas(S, S);
  g.fillStyle = "rgb(104,108,72)";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rand() < 0.5 ? `rgba(128,118,80,${0.05 + rand() * 0.08})` : `rgba(72,86,52,${0.05 + rand() * 0.08})`;
    const x = rand() * S;
    const y = rand() * S;
    const rx = 6 + rand() * 22;
    const ry = 4 + rand() * 12;
    const a = rand() * 3;
    // Copies décalées d'une tuile : les touches qui débordent reviennent de l'autre côté.
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        g.beginPath();
        g.ellipse(x + dx, y + dy, rx, ry, a, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  for (let i = 0; i < 30000; i++) {
    const v = rand();
    g.strokeStyle = v < 0.5 ? "rgba(60,72,40,0.5)" : "rgba(150,150,96,0.45)";
    const x = rand() * S;
    const y = rand() * S;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + range(rand, -1.5, 1.5), y - 2 - rand() * 4);
    g.stroke();
  }
  return tex(c);
}

/** Bouffée de vapeur ou de gaz : disque doux, blanc, en alpha. */
export function puffTexture(): Texture {
  const [c, g] = canvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Peau de Titan : marbrures et veines très discrètes, en niveaux clairs (la teinte vient du matériau). */
/**
 * Peau de Titan de R3 (choix de design A) : la toile de R1, plus des marbrures (veines bleutées sous une peau pâle) ou des taches
 * (plaques rougeâtres sur une peau rougeaude), d'intensité `marbling` (0–1). Jamais lisse : c'est ce qui éloigne du mannequin.
 */
export function titanSkinTexture(seed: number, skin: { id: "pale" | "rougeaude"; marbling: number }): Texture {
  const rand = seeded(derive(seed, skin.id === "pale" ? 611 : 612));
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = "rgb(236,236,236)";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const v = 200 + rand() * 50;
    g.fillStyle = rgb(v, v * 0.97, v * 0.95, 0.25);
    g.beginPath();
    g.ellipse(rand() * S, rand() * S, 6 + rand() * 26, 4 + rand() * 18, rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  if (skin.id === "pale") {
    // Veines ramifiées, bleu-violet, sous une peau cireuse.
    g.lineCap = "round";
    for (let i = 0; i < Math.round(40 * skin.marbling); i++) {
      let x = rand() * S;
      let y = rand() * S;
      g.strokeStyle = rgb(120 + rand() * 30, 125 + rand() * 25, 165 + rand() * 30, 0.1 + 0.18 * skin.marbling);
      g.lineWidth = 0.6 + rand() * 1.6;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        x += range(rand, -14, 14);
        y += range(rand, 3, 15);
        g.lineTo(x, y);
      }
      g.stroke();
    }
  } else {
    // Plaques rougeâtres irrégulières et pores sombres.
    for (let i = 0; i < Math.round(55 * (0.5 + skin.marbling)); i++) {
      g.fillStyle = rgb(190 + rand() * 40, 110 + rand() * 40, 100 + rand() * 30, 0.08 + 0.12 * skin.marbling);
      g.beginPath();
      g.ellipse(rand() * S, rand() * S, 3 + rand() * 20, 2 + rand() * 14, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  speckle(g, rand, S, S, 3200, 0.035);
  return tex(c);
}

export function skinTexture(seed: number): Texture {
  const rand = seeded(derive(seed, 600));
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = "rgb(236,236,236)";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const v = 200 + rand() * 50;
    g.fillStyle = rgb(v, v * 0.97, v * 0.95, 0.25);
    g.beginPath();
    g.ellipse(rand() * S, rand() * S, 6 + rand() * 26, 4 + rand() * 18, rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = "rgba(150,140,150,0.10)";
  for (let i = 0; i < 26; i++) {
    let x = rand() * S;
    let y = rand() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += range(rand, -12, 12);
      y += range(rand, 4, 16);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  speckle(g, rand, S, S, 2500, 0.025);
  return tex(c);
}
