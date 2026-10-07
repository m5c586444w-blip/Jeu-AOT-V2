import type { Canon, Gate, Place, RingProfile, WallsParams } from "../../../data/placeSchema";
import type { P2 } from "./geom";
import { area, centroid, polylineLength, rad, rectPoly } from "./geom";
import type { PlaceLayout, PlaceMetrics } from "./layout";
import { traceLength, wallFrameAt, wallSection } from "./walls";
import type { WallSection } from "./walls";

/**
 * Plans SVG générés depuis les données (R1e, consigne §2 et §3) : plan coté d'un lieu, coupe de son mur, élévations de ses
 * portes. Texte pur (pas de DOM) ; mêmes données → même fichier (test de fraîcheur des fichiers de `docs/places/`).
 */
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f1 = (x: number): string => (Math.round(x * 10) / 10).toString();
const pts = (ps: readonly P2[]): string => ps.map((p) => `${f1(p[0])},${f1(p[1])}`).join(" ");
const tag = (c: Canon): string => `[${c}]`;
/** Nombre à la française (espace fine insécable des milliers, virgule décimale). */
export const fr = (x: number, digits = 0): string => {
  const s = x.toFixed(digits);
  const [i, d] = s.split(".");
  const int = (i ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return d ? `${int},${d}` : int;
};

const FUNCTION_FILL: Record<string, string> = {
  habitation: "#e9dcc3",
  marche: "#f0cf9a",
  atelier: "#d9c4a8",
  caserne: "#c9b6a6",
  entrepot: "#cdbb9b",
  culte: "#e8d4e0",
  jardin: "#cfe0b4",
  noble: "#ead9b8",
  administration: "#dccfb8",
};
const SPECIES_FILL: Record<string, string> = { fruitier: "#8fae5a", pin: "#3f6b4a", saule: "#7fa86a", peuplier: "#5f8f4f", geant: "#2f5a3a" };

/** Ligne de cote : segment, flèches, texte au milieu (décalé de `off` selon la normale). */
function cote(a: P2, b: P2, label: string, size: number, off = 0): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const n: P2 = [-dy / L, dx / L];
  const A: P2 = [a[0] + n[0] * off, a[1] + n[1] * off];
  const B: P2 = [b[0] + n[0] * off, b[1] + n[1] * off];
  const m: P2 = [(A[0] + B[0]) / 2 + n[0] * size * 0.6, (A[1] + B[1]) / 2 + n[1] * size * 0.6];
  let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (ang > 90) ang -= 180;
  if (ang < -90) ang += 180;
  return `<g class="cote"><line x1="${f1(A[0])}" y1="${f1(A[1])}" x2="${f1(B[0])}" y2="${f1(B[1])}" marker-start="url(#fl)" marker-end="url(#fl)"/><text x="${f1(m[0])}" y="${f1(m[1])}" font-size="${f1(size)}" transform="rotate(${f1(ang)} ${f1(m[0])} ${f1(m[1])})" text-anchor="middle">${esc(label)}</text></g>`;
}

const DEFS = (stroke: number): string =>
  `<defs><marker id="fl" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="${f1(stroke * 3)}" markerHeight="${f1(stroke * 3)}" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#3a2f25"/></marker></defs>`;

/** Plan coté d'un lieu N1. */
export function placePlanSvg(place: Place, L: PlaceLayout, walls: WallsParams, metrics: PlaceMetrics | null): string {
  const E = place.etendue_m;
  const half = E / 2;
  const fs = E / 110;
  const sw = E / 2500;
  const out: string[] = [];
  const W = 1800;
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Math.round(W * 1.12)}" viewBox="${f1(-half)} ${f1(-half)} ${f1(E)} ${f1(E * 1.12)}" font-family="EB Garamond, Georgia, serif">`);
  out.push(DEFS(sw * 4));
  out.push(`<style>.cote line{stroke:#3a2f25;stroke-width:${f1(sw * 1.5)}}.cote text{fill:#3a2f25}.nom{fill:#2b241d;paint-order:stroke;stroke:#f6f0e2;stroke-width:${f1(fs * 0.25)}}</style>`);
  out.push(`<rect x="${f1(-half)}" y="${f1(-half)}" width="${f1(E)}" height="${f1(E * 1.12)}" fill="#e6e8d2"/>`);
  for (const z of place.zones) out.push(`<polygon points="${pts(z.polygone)}" fill="#dfe3c4" stroke="#9aa078" stroke-width="${f1(sw * 2)}" stroke-dasharray="${f1(sw * 12)} ${f1(sw * 8)}"/>`);
  out.push(`<polygon points="${pts(place.perimetre)}" fill="#efe6d2" stroke="none"/>`);
  for (const k of place.vegetation.parcs) out.push(`<polygon points="${pts(k.polygone)}" fill="#c4d7a4" stroke="#7d9a5a" stroke-width="${f1(sw * 2)}"/>`);
  for (const v of place.vegetation.vergers) out.push(`<polygon points="${pts(v.polygone)}" fill="#d6e2b0" stroke="#8fae5a" stroke-width="${f1(sw)}"/>`);
  for (const v of place.vegetation.potagers) out.push(`<polygon points="${pts(v.polygone)}" fill="#dbd3a2" stroke="none"/>`);
  for (const b of place.ilots) out.push(`<polygon points="${pts(b.polygone)}" fill="${FUNCTION_FILL[b.fonction] ?? "#e9dcc3"}" stroke="#b9a98d" stroke-width="${f1(sw)}"/>`);
  for (const s of place.places_publiques) out.push(`<polygon points="${pts(s.polygone)}" fill="#f4ecd8" stroke="#a89878" stroke-width="${f1(sw * 1.5)}"/>`);
  for (const w of place.eau.voies) out.push(`<polyline points="${pts(w.trace)}" fill="none" stroke="#7fa3b8" stroke-width="${f1(w.largeur_m)}" stroke-linejoin="round"/>`);
  for (const r of place.rues) out.push(`<polyline points="${pts(r.trace)}" fill="none" stroke="${r.revetement === "terre" || r.revetement === "gravier" ? "#d9c9a3" : "#f7f2e6"}" stroke-width="${f1(r.largeur_m)}" stroke-linejoin="round" stroke-linecap="round"/>`);
  for (const p of place.eau.ponts) {
    const a = rad(p.angle_deg);
    out.push(`<polygon points="${pts(rectPoly(p.position, [Math.cos(a), Math.sin(a)], p.longueur_m / 2, p.largeur_m / 2))}" fill="#c9bfae" stroke="#6b5f50" stroke-width="${f1(sw * 1.5)}"/>`);
  }
  // Maisons courantes (emprises), bâtiments repères (emprises cernées).
  const houses = L.houses.map((h) => pts(rectPoly([h.x, h.y], [Math.cos(h.a), Math.sin(h.a)], h.w / 2, h.d / 2)));
  out.push(`<g fill="#b8a588" stroke="#7d6a52" stroke-width="${f1(sw * 0.6)}">${houses.map((p) => `<polygon points="${p}"/>`).join("")}</g>`);
  for (const b of place.batiments) {
    const a = rad(b.angle_deg);
    out.push(`<polygon points="${pts(rectPoly(b.position, [Math.cos(a), Math.sin(a)], b.emprise_m[0] / 2, b.emprise_m[1] / 2))}" fill="#8f6f55" stroke="#3a2f25" stroke-width="${f1(sw * 2)}"/>`);
  }
  // Arbres.
  const trees = L.trees.map((t) => `<circle cx="${f1(t.x)}" cy="${f1(t.y)}" r="${f1(Math.max(1.5, t.h * 0.18))}" fill="${SPECIES_FILL[t.sp] ?? "#6f9a52"}"/>`);
  out.push(`<g opacity="0.85">${trees.join("")}</g>`);
  // Enceinte : bande de l'épaisseur de base, portes en noir.
  if (place.enceinte) {
    const ring = walls.anneaux[place.enceinte.mur];
    const sec = wallSection(ring);
    for (const t of place.enceinte.traces) {
      const L2 = traceLength(t);
      const n = Math.max(2, Math.ceil(L2 / 20));
      const line: P2[] = [];
      for (let i = 0; i <= n; i++) line.push(wallFrameAt(t, (L2 * i) / n).p);
      out.push(`<polyline points="${pts(line)}" fill="none" stroke="#6d6458" stroke-width="${f1(sec.base)}" stroke-linejoin="round"/>`);
      out.push(`<polyline points="${pts(line)}" fill="none" stroke="#9c9284" stroke-width="${f1(sec.walkway)}" stroke-linejoin="round"/>`);
    }
    for (const g of place.portes) {
      const t = place.enceinte.traces.find((x) => x.id === g.trace);
      if (!t) continue;
      const fr0 = wallFrameAt(t, g.s_m);
      const poly = rectPoly(fr0.p, fr0.d, g.passage.largeur_m / 2, sec.base / 2 + 1);
      out.push(`<polygon points="${pts(poly)}" fill="#1d1a17"/>`);
      const lp: P2 = [fr0.p[0] + fr0.out[0] * fs * 3, fr0.p[1] + fr0.out[1] * fs * 3];
      out.push(`<text class="nom" x="${f1(lp[0])}" y="${f1(lp[1])}" font-size="${f1(fs * 1.05)}" text-anchor="middle" font-weight="bold">${esc(`${g.nom} ${tag(g.canon)}`)}</text>`);
      const cp: P2 = [fr0.p[0] - fr0.out[0] * fs * 2.2, fr0.p[1] - fr0.out[1] * fs * 2.2];
      out.push(cote([cp[0] - fr0.d[0] * (g.passage.largeur_m / 2), cp[1] - fr0.d[1] * (g.passage.largeur_m / 2)], [cp[0] + fr0.d[0] * (g.passage.largeur_m / 2), cp[1] + fr0.d[1] * (g.passage.largeur_m / 2)], `${fr(g.passage.largeur_m)} m ${tag(g.passage.canon)}`, fs * 0.7));
    }
    // Rayon de l'arc principal.
    const arc = place.enceinte.traces.find((t) => t.type === "arc");
    if (arc && arc.type === "arc") {
      const mid = wallFrameAt(arc, traceLength(arc) * 0.36).p;
      out.push(cote(arc.centre, mid, `R = ${fr(arc.rayon_m)} m ${tag(arc.canon)}`, fs * 0.9));
      out.push(`<text class="nom" x="${f1(arc.centre[0])}" y="${f1(arc.centre[1] - fs * 0.6)}" font-size="${f1(fs * 0.8)}" text-anchor="middle">${esc(`Mur ${place.enceinte.mur} ${tag("C")} : ${fr(sec.H)} m de haut ; ${fr(sec.base)} m à la base ${tag("?")}`)}</text>`);
    }
  }
  // Noms de rues (le long du tracé), places, repères, quartiers.
  place.rues.forEach((r, i) => {
    if (r.type === "ruelle" || polylineLength(r.trace) < fs * 6) return;
    const id = `r${i}`;
    const tr = [...r.trace];
    const a = tr[0] as P2;
    const b = tr[tr.length - 1] as P2;
    if (b[0] < a[0]) tr.reverse();
    out.push(`<path id="${id}" d="M${pts(tr).replace(/ /g, " L")}" fill="none"/>`);
    out.push(`<text class="nom" font-size="${f1(fs * (r.type === "principale" ? 0.95 : 0.7))}" dy="${f1(fs * 0.25)}"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(`${r.nom} ${tag(r.canon)}`)}</textPath></text>`);
  });
  for (const s of place.places_publiques) {
    const c = centroid(s.polygone);
    out.push(`<text class="nom" x="${f1(c[0])}" y="${f1(c[1])}" font-size="${f1(fs * 0.8)}" text-anchor="middle" font-style="italic">${esc(`${s.nom} ${tag(s.canon)}`)}</text>`);
  }
  for (const b of place.batiments) {
    out.push(`<text class="nom" x="${f1(b.position[0])}" y="${f1(b.position[1] - b.emprise_m[1] / 2 - fs * 0.4)}" font-size="${f1(fs * 0.62)}" text-anchor="middle">${esc(`${b.nom} ${tag(b.canon)}`)}</text>`);
  }
  for (const w of place.eau.voies) {
    const m = w.trace[Math.floor(w.trace.length / 2)] as P2;
    out.push(`<text class="nom" x="${f1(m[0] + w.largeur_m)}" y="${f1(m[1])}" font-size="${f1(fs * 0.75)}" fill="#2f5a75" font-style="italic">${esc(`${w.nom} ${tag(w.canon)}`)}</text>`);
  }
  // Rose des vents, échelle, cartouche.
  const nx = half - fs * 4;
  const ny = -half + fs * 5;
  out.push(`<g><polygon points="${f1(nx)},${f1(ny - fs * 3)} ${f1(nx + fs)},${f1(ny + fs)} ${f1(nx)},${f1(ny)} ${f1(nx - fs)},${f1(ny + fs)}" fill="#3a2f25"/><text x="${f1(nx)}" y="${f1(ny - fs * 3.4)}" font-size="${f1(fs * 1.2)}" text-anchor="middle">N</text></g>`);
  const bar = E > 3000 ? 1000 : E > 1200 ? 500 : E > 500 ? 200 : 100;
  const bx = -half + fs * 3;
  const by = half - fs * 3;
  out.push(`<g><rect x="${f1(bx)}" y="${f1(by)}" width="${f1(bar / 2)}" height="${f1(fs * 0.5)}" fill="#3a2f25"/><rect x="${f1(bx + bar / 2)}" y="${f1(by)}" width="${f1(bar / 2)}" height="${f1(fs * 0.5)}" fill="#f6f0e2" stroke="#3a2f25" stroke-width="${f1(sw * 2)}"/><text x="${f1(bx)}" y="${f1(by - fs * 0.4)}" font-size="${f1(fs * 0.8)}">0</text><text x="${f1(bx + bar)}" y="${f1(by - fs * 0.4)}" font-size="${f1(fs * 0.8)}" text-anchor="middle">${fr(bar)} m</text></g>`);
  const ty = half + fs * 1.5;
  const zl = metrics?.zones.map((z) => `${z.zone} : ${fr(z.population)} hab. ÷ ${fr(z.densite)} hab/ha = ${fr(z.cible_ha, 1)} ha ; bâti mesuré ${fr(z.batie_ha, 1)} ha (${z.ecart >= 0 ? "+" : ""}${fr(z.ecart * 100, 1)} %) ; ${fr(z.arbres_par_ha_bati, 1)} arbres/ha bâti`) ?? [];
  const lines = [`${place.libelle} ${tag(place.canon)} — plan d'auteur (R1e) ; ${fr(L.houses.length)} maisons, ${fr(place.batiments.length)} bâtiments repères, ${fr(L.trees.length)} arbres`, ...zl, `Légende : [C] établi, [A] adaptation assumée, [?] incertain (docs/lore/questions-ouvertes.md). Plan généré depuis data/places/${place.id}.json.`];
  lines.forEach((l, i) => out.push(`<text x="${f1(-half + fs * 2)}" y="${f1(ty + i * fs * 1.25)}" font-size="${f1(fs * (i === 0 ? 1.05 : 0.8))}" fill="#2b241d">${esc(l)}</text>`));
  out.push("</svg>");
  return out.join("\n");
}

/** Coupe d'un mur : sol, fondation, talus, parements à fruit, chemin de ronde, parapet ; cotes et statuts. */
export function wallSectionSvg(ring: RingProfile, title: string): string {
  const s: WallSection = wallSection(ring);
  const pad = 14;
  const minX = s.intFoot - pad - 6;
  const maxX = s.extFoot + s.talus.out + pad + 10;
  const minY = -(s.H + 8);
  const maxY = s.foundation + 10;
  const sw = 0.12;
  const fs = 1.6;
  const Y = (z: number): number => -z;
  const o: string[] = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${Math.round((1000 * (maxY - minY)) / (maxX - minX))}" viewBox="${f1(minX)} ${f1(minY)} ${f1(maxX - minX)} ${f1(maxY - minY)}" font-family="EB Garamond, Georgia, serif">`);
  o.push(DEFS(0.5));
  o.push(`<style>.cote line{stroke:#3a2f25;stroke-width:${sw}}.cote text{fill:#3a2f25}</style>`);
  o.push(`<rect x="${f1(minX)}" y="${f1(minY)}" width="${f1(maxX - minX)}" height="${f1(maxY - minY)}" fill="#f6f0e2"/>`);
  // Sol (coupe hachurée), fondation.
  o.push(`<rect x="${f1(minX)}" y="0" width="${f1(maxX - minX)}" height="${f1(maxY)}" fill="#d8c9a6"/>`);
  o.push(`<line x1="${f1(minX)}" y1="0" x2="${f1(maxX)}" y2="0" stroke="#5b4a35" stroke-width="${sw * 2}"/>`);
  const fw = s.base + 3;
  o.push(`<rect x="${f1(-fw / 2)}" y="0" width="${f1(fw)}" height="${f1(s.foundation)}" fill="#9a8f80" stroke="#3a2f25" stroke-width="${sw}"/>`);
  // Corps du mur : talus extérieur, faces à fruit, sommet.
  const body: P2[] = [
    [s.intFoot, Y(0)],
    [s.extFoot + s.talus.out, Y(0)],
    [s.extAt(s.talus.h), Y(s.talus.h)],
    [s.extTop, Y(s.H)],
    [s.intTop, Y(s.H)],
  ];
  o.push(`<polygon points="${pts(body)}" fill="#cfc6b6" stroke="#3a2f25" stroke-width="${sw * 2}"/>`);
  // Assises (parement) : quelques lignes, plus serrées en bas.
  for (let z = 2.4; z < s.H; z += z < 10 ? 1.6 : 2.4) o.push(`<line x1="${f1(s.intAt(z))}" y1="${f1(Y(z))}" x2="${f1(s.extAt(Math.max(z, s.talus.h)))}" y2="${f1(Y(z))}" stroke="#a89e8f" stroke-width="${sw * 0.6}"/>`);
  // Parapet extérieur, bordure intérieure, chemin de ronde.
  const pp: P2[] = [
    [s.extTop - s.parapet.t, Y(s.H)],
    [s.extTop, Y(s.H)],
    [s.extTop, Y(s.H + s.parapet.h)],
    [s.extTop - s.parapet.t, Y(s.H + s.parapet.h)],
  ];
  o.push(`<polygon points="${pts(pp)}" fill="#bfb5a4" stroke="#3a2f25" stroke-width="${sw * 2}"/>`);
  const curb: P2[] = [
    [s.intTop, Y(s.H)],
    [s.intTop + 0.5, Y(s.H)],
    [s.intTop + 0.5, Y(s.H + 0.5)],
    [s.intTop, Y(s.H + 0.5)],
  ];
  o.push(`<polygon points="${pts(curb)}" fill="#bfb5a4" stroke="#3a2f25" stroke-width="${sw}"/>`);
  // Escalier d'accès (côté intérieur), schématique.
  const stairs: P2[] = [];
  for (let i = 0; i <= 10; i++) stairs.push([s.intAt((s.H * i) / 10) - 4 + (4 * i) / 10, Y((s.H * i) / 10)]);
  o.push(`<polyline points="${pts(stairs)}" fill="none" stroke="#6b5f50" stroke-width="${sw * 2}" stroke-dasharray="0.6 0.4"/>`);
  // Silhouette humaine (1,7 m) pour l'échelle.
  o.push(`<rect x="${f1(s.extFoot + s.talus.out + 4)}" y="${f1(-1.7)}" width="0.5" height="1.7" fill="#3a2f25"/>`);
  // Cotes.
  const xr = s.extFoot + s.talus.out + 7;
  o.push(cote([xr, Y(0)], [xr, Y(s.H)], `${fr(s.H)} m ${tag(ring.hauteur_m.canon)}`, fs, 0));
  o.push(cote([s.intFoot, 4], [s.extFoot, 4], `base ${fr(s.base)} m ${tag(ring.epaisseur_base_m.canon)} (${fr(ring.epaisseur_base_m.plage?.[0] ?? s.base)}–${fr(ring.epaisseur_base_m.plage?.[1] ?? s.base)})`, fs * 0.9));
  o.push(cote([s.intTop, Y(s.H) - 4.5], [s.extTop, Y(s.H) - 4.5], `sommet ${fr(s.top)} m ${tag(ring.epaisseur_sommet_m.canon)}`, fs * 0.9));
  o.push(cote([s.intTop + 0.5, Y(s.H) - 2], [s.extTop - s.parapet.t, Y(s.H) - 2], `chemin de ronde ${fr(s.walkway)} m ${tag(ring.chemin_de_ronde_m.canon)}`, fs * 0.75));
  o.push(cote([s.extTop + 1.2, Y(s.H)], [s.extTop + 1.2, Y(s.H + s.parapet.h)], `parapet ${fr(s.parapet.h, 1)} m ${tag(ring.parapet_hauteur_m.canon)}`, fs * 0.7, -0.4));
  o.push(cote([s.extFoot + s.talus.out + 1, Y(0)], [s.extFoot + s.talus.out + 1, Y(s.talus.h)], `talus ${fr(s.talus.h)} m ${tag(ring.talus_hauteur_m.canon)}`, fs * 0.7, 0));
  o.push(cote([fw / 2 + 1, 0], [fw / 2 + 1, s.foundation], `fondation ${fr(s.foundation)} m ${tag(ring.fondation_profondeur_m.canon)}`, fs * 0.75, 0));
  const tx = minX + 2;
  const lines = [
    `${title} — coupe (R1e) ; données : data/places/_murs.json`,
    `Fruit extérieur ${fr(s.fruitExt * 100, 1)} %, intérieur ${fr(s.fruitInt * 100, 1)} % ${tag(ring.fruit_part_exterieure.canon)} ; créneaux : ${ring.creneaux.valeur ? "oui" : "non"} ${tag(ring.creneaux.canon)}`,
    "Extérieur à droite, ville à gauche. [C] établi, [A] adaptation, [?] incertain (plage plausible entre parenthèses).",
  ];
  lines.forEach((l, i) => o.push(`<text x="${f1(tx)}" y="${f1(minY + 2.5 + i * 2)}" font-size="${f1(fs * (i === 0 ? 1.1 : 0.85))}" fill="#2b241d">${esc(l)}</text>`));
  o.push(`<text x="${f1(s.intFoot - 2)}" y="${f1(-2)}" font-size="${f1(fs)}" text-anchor="end" fill="#2b241d">ville</text>`);
  o.push(`<text x="${f1(s.extFoot + s.talus.out + 5)}" y="${f1(-4)}" font-size="${f1(fs)}" fill="#2b241d">extérieur</text>`);
  o.push("</svg>");
  return o.join("\n");
}

/** Élévation d'une porte vue de face (côté `face`), avec cotes du passage, du vantail et du mur. */
export function gateElevationSvg(g: Gate, ring: RingProfile, face: "exterieure" | "interieure"): string {
  const s = wallSection(ring);
  const W = Math.max(70, g.passage.largeur_m * 4.5);
  const minX = -W / 2;
  const minY = -(s.H + 10);
  const fs = 1.8;
  const sw = 0.14;
  const o: string[] = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${Math.round((1000 * (s.H + 16)) / W)}" viewBox="${f1(minX)} ${f1(minY)} ${f1(W)} ${f1(s.H + 16)}" font-family="EB Garamond, Georgia, serif">`);
  o.push(DEFS(0.6));
  o.push(`<style>.cote line{stroke:#3a2f25;stroke-width:${sw}}.cote text{fill:#3a2f25}</style>`);
  o.push(`<rect x="${f1(minX)}" y="${f1(minY)}" width="${f1(W)}" height="${f1(s.H + 16)}" fill="#f6f0e2"/>`);
  o.push(`<rect x="${f1(minX)}" y="${f1(-s.H)}" width="${f1(W)}" height="${f1(s.H)}" fill="#d6cdbd" stroke="#3a2f25" stroke-width="${sw * 2}"/>`);
  o.push(`<rect x="${f1(minX)}" y="${f1(-s.H - s.parapet.h)}" width="${f1(W)}" height="${f1(s.parapet.h)}" fill="#c9bfae" stroke="#3a2f25" stroke-width="${sw}"/>`);
  for (let z = 2; z < s.H; z += 2.2) o.push(`<line x1="${f1(minX)}" y1="${f1(-z)}" x2="${f1(-minX)}" y2="${f1(-z)}" stroke="#bfb5a4" stroke-width="${sw * 0.5}"/>`);
  const w = g.passage.largeur_m;
  const h = g.passage.hauteur_m;
  const arch = g.passage.voute === "linteau" ? 0 : g.passage.voute === "surbaisse" ? w * 0.22 : w / 2;
  const hs = h - arch;
  // Encadrement (huisserie, voussures) puis ouverture.
  const frame = 1.6;
  o.push(`<path d="M${f1(-w / 2 - frame)},0 L${f1(-w / 2 - frame)},${f1(-hs)} Q${f1(-w / 2 - frame)},${f1(-h - frame)} 0,${f1(-h - frame)} Q${f1(w / 2 + frame)},${f1(-h - frame)} ${f1(w / 2 + frame)},${f1(-hs)} L${f1(w / 2 + frame)},0 z" fill="#b9ae9b" stroke="#3a2f25" stroke-width="${sw * 2}"/>`);
  o.push(`<path d="M${f1(-w / 2)},0 L${f1(-w / 2)},${f1(-hs)} Q${f1(-w / 2)},${f1(-h)} 0,${f1(-h)} Q${f1(w / 2)},${f1(-h)} ${f1(w / 2)},${f1(-hs)} L${f1(w / 2)},0 z" fill="#4a3a2c" stroke="#3a2f25" stroke-width="${sw}"/>`);
  // Vantail ou herse.
  const vw = g.vantail.largeur_m;
  const vh = Math.min(g.vantail.hauteur_m, h);
  if (g.vantail.type === "battants") {
    o.push(`<rect x="${f1(-vw / 2)}" y="${f1(-vh)}" width="${f1(vw / 2 - 0.1)}" height="${f1(vh)}" fill="#6a4a2e" stroke="#2b1f14" stroke-width="${sw}"/><rect x="0.1" y="${f1(-vh)}" width="${f1(vw / 2 - 0.1)}" height="${f1(vh)}" fill="#6a4a2e" stroke="#2b1f14" stroke-width="${sw}"/>`);
  } else {
    o.push(`<rect x="${f1(-vw / 2)}" y="${f1(-vh)}" width="${f1(vw)}" height="${f1(vh)}" fill="#5b4330" stroke="#2b1f14" stroke-width="${sw}"/>`);
  }
  for (let i = 1; i < 6; i++) o.push(`<line x1="${f1(-vw / 2)}" y1="${f1((-vh * i) / 6)}" x2="${f1(vw / 2)}" y2="${f1((-vh * i) / 6)}" stroke="#2b2b2b" stroke-width="${sw * 2}"/>`);
  // Tours et maison du treuil.
  for (const t of g.tours) {
    if (t.cote === "dessus") {
      o.push(`<rect x="${f1(-w * 0.7)}" y="${f1(-s.H - t.hauteur_m)}" width="${f1(w * 1.4)}" height="${f1(t.hauteur_m)}" fill="#c2b7a5" stroke="#3a2f25" stroke-width="${sw * 2}"/>`);
      o.push(`<polygon points="${f1(-w * 0.78)},${f1(-s.H - t.hauteur_m)} 0,${f1(-s.H - t.hauteur_m - w * 0.35)} ${f1(w * 0.78)},${f1(-s.H - t.hauteur_m)}" fill="#6d5a4a" stroke="#3a2f25" stroke-width="${sw}"/>`);
    } else {
      const x0 = (t.cote === "gauche" ? -1 : 1) * (w / 2 + frame + 5);
      o.push(`<rect x="${f1(x0 - 3)}" y="${f1(-t.hauteur_m)}" width="6" height="${f1(t.hauteur_m)}" fill="#c9bfae" stroke="#3a2f25" stroke-width="${sw * 2}"/>`);
    }
  }
  o.push(`<rect x="${f1(w / 2 + frame + 12)}" y="-1.7" width="0.5" height="1.7" fill="#3a2f25"/>`);
  o.push(cote([-w / 2, 2.5], [w / 2, 2.5], `passage ${fr(w)} m ${tag(g.passage.canon)}`, fs * 0.85));
  o.push(cote([-w / 2 - frame - 2.5, 0], [-w / 2 - frame - 2.5, -h], `${fr(h)} m`, fs * 0.8));
  o.push(cote([W / 2 - 3, 0], [W / 2 - 3, -s.H], `mur ${fr(s.H)} m ${tag(ring.hauteur_m.canon)}`, fs * 0.8));
  const title = `${g.nom} ${tag(g.canon)} — élévation, face ${face === "exterieure" ? "extérieure" : "intérieure"} ; vantail ${g.vantail.type} ${fr(vw)} × ${fr(g.vantail.hauteur_m)} m ${tag(g.vantail.canon)} ; état ${g.etat}`;
  o.push(`<text x="${f1(minX + 1.5)}" y="${f1(minY + 3)}" font-size="${f1(fs)}" fill="#2b241d">${esc(title)}</text>`);
  o.push(`<text x="${f1(minX + 1.5)}" y="${f1(minY + 5.5)}" font-size="${f1(fs * 0.8)}" fill="#2b241d">${esc(`${g.structure.treuils} treuils, ${g.structure.contrepoids} contrepoids, herse : ${g.structure.herse ? "oui" : "non"}, ${g.passage.trous_assassin} trous d'assassin ${tag(g.structure.canon)} — données : portes[] du lieu`)}</text>`);
  o.push("</svg>");
  return o.join("\n");
}

/** Aire d'un polygone de plan en hectares (rapports). */
export const ha = (poly: readonly P2[]): number => area(poly) / 10000;

