/**
 * Atlas schématique du monde (P7) : provinces des nations en taches d'aquarelle cernées d'encre, mers hachurées,
 * routes et voies maritimes en traits, pions de forces, marques de front. Dessin 2D (canvas), déterministe.
 * Les esthétiques propres à Marley et Hizuru (04 §1.1) viendront en P8 ; ici, un seul atlas d'encre.
 */

export interface AtlasProvince {
  id: string;
  at: [number, number];
  sea: boolean;
  /** Couleur de la nation qui tient la province (ou de la mer). */
  fill: string;
  label: string;
  adjacent: readonly string[];
  /** Pions : nombre de formations par couleur de nation. */
  tokens: { color: string; count: number }[];
  front: boolean;
  titan: boolean;
  /** Toponyme toujours affiché (mers, capitales, lieux canon) ; les autres au survol ou à la sélection. */
  major: boolean;
}

export interface AtlasView {
  scale: number;
  ox: number;
  oy: number;
  radius: number;
}

const INK = "#1c1a17";
const PAPER = "#e8dcc0";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Contour irrégulier (tache) autour d'un centre, stable pour un identifiant donné. */
function blob(id: string, cx: number, cy: number, r: number, points = 11): [number, number][] {
  let h = hash(id);
  const out: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    const k = 0.78 + ((h % 1000) / 1000) * 0.4;
    const a = (i / points) * Math.PI * 2 + ((h >>> 10) % 100) / 400;
    out.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.85]);
  }
  return out;
}

function path(ctx: CanvasRenderingContext2D, pts: readonly [number, number][]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

export function atlasView(width: number, height: number): AtlasView {
  // Monde schématique : x de 20 à 1000, y de 40 à 980.
  const scale = Math.min(width / 1000, height / 960);
  return { scale, ox: (width - 1000 * scale) / 2 + 10 * scale, oy: (height - 960 * scale) / 2 - 20 * scale, radius: 26 * scale };
}

const toScreen = (v: AtlasView, [x, y]: readonly [number, number]): [number, number] => [v.ox + x * v.scale, v.oy + y * v.scale];

export function drawWorldAtlas(canvas: HTMLCanvasElement, provinces: readonly AtlasProvince[], selected: string | null): AtlasView {
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  const v = atlasView(w, h);
  if (!ctx) return v;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  const byId = new Map(provinces.map((p) => [p.id, p]));
  // Routes de terre (trait plein) et de mer (pointillé).
  ctx.lineWidth = 1;
  for (const p of provinces) {
    for (const a of p.adjacent) {
      if (a < p.id) continue;
      const q = byId.get(a);
      if (!q) continue;
      const [x1, y1] = toScreen(v, p.at);
      const [x2, y2] = toScreen(v, q.at);
      ctx.strokeStyle = p.sea || q.sea ? "rgba(42,58,92,0.45)" : "rgba(28,26,23,0.35)";
      ctx.setLineDash(p.sea || q.sea ? [3, 4] : []);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  // Mers : hachures horizontales dans une tache pâle.
  for (const p of provinces.filter((x) => x.sea)) {
    const [cx, cy] = toScreen(v, p.at);
    const pts = blob(p.id, cx, cy, v.radius * 1.6, 13);
    path(ctx, pts);
    ctx.fillStyle = "rgba(42,58,92,0.10)";
    ctx.fill();
    ctx.save();
    path(ctx, pts);
    ctx.clip();
    ctx.strokeStyle = "rgba(42,58,92,0.25)";
    for (let y = cy - v.radius * 2; y < cy + v.radius * 2; y += 4) {
      ctx.beginPath();
      ctx.moveTo(cx - v.radius * 2, y);
      ctx.lineTo(cx + v.radius * 2, y);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Terres : aquarelle de la nation, cerne d'encre.
  for (const p of provinces.filter((x) => !x.sea)) {
    const [cx, cy] = toScreen(v, p.at);
    const pts = blob(p.id, cx, cy, v.radius * (p.id === "wprov_paradis" ? 1.8 : 1));
    path(ctx, pts);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = p.fill;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK;
    ctx.lineWidth = p.id === selected ? 2.5 : 0.9;
    ctx.stroke();
  }
  // Marques de front (croix d'encre) et de Titan projeté (cercle rouge).
  for (const p of provinces) {
    const [cx, cy] = toScreen(v, p.at);
    if (p.front) {
      ctx.strokeStyle = "#9e2b25";
      ctx.lineWidth = 2;
      const r = v.radius * 0.45;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.moveTo(cx + r, cy - r);
      ctx.lineTo(cx - r, cy + r);
      ctx.stroke();
    }
    if (p.titan) {
      ctx.strokeStyle = "#9e2b25";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, v.radius * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Pions : petits carrés numérotés, un par nation présente.
    p.tokens.forEach((t, i) => {
      const s = Math.max(9, v.radius * 0.5);
      const x = cx - s / 2 + (i - (p.tokens.length - 1) / 2) * (s + 2);
      const y = cy + v.radius * 0.55;
      ctx.fillStyle = t.color;
      ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x, y, s, s);
      ctx.fillStyle = PAPER;
      ctx.font = `${Math.round(s * 0.75)}px "Special Elite", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(t.count), x + s / 2, y + s / 2 + 0.5);
    });
  }
  // Toponymes en petites capitales.
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.font = `${Math.max(8, Math.round(v.radius * 0.38))}px "IM Fell English", serif`;
  for (const p of provinces) {
    if (!p.major && p.id !== selected) continue;
    const [cx, cy] = toScreen(v, p.at);
    ctx.globalAlpha = p.sea ? 0.6 : 1;
    ctx.fillText(p.label, cx, cy - v.radius * (p.id === "wprov_paradis" ? 1.5 : 0.85));
  }
  ctx.globalAlpha = 1;
  return v;
}

/** Province sous un point (coordonnées CSS du canvas) : la plus proche, à moins d'un rayon et demi. */
export function atlasHit(v: AtlasView, provinces: readonly AtlasProvince[], x: number, y: number): string | null {
  let best: { id: string; d: number } | null = null;
  for (const p of provinces) {
    const [cx, cy] = toScreen(v, p.at);
    const d = Math.hypot(cx - x, cy - y);
    const lim = v.radius * (p.sea ? 1.6 : p.id === "wprov_paradis" ? 1.8 : 1.2);
    if (d <= lim && (!best || d < best.d)) best = { id: p.id, d };
  }
  return best?.id ?? null;
}
