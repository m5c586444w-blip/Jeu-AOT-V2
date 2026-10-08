import { Rng } from "../sim/core/rng";

/**
 * Portrait peint procédural (U7, 04 §8.4 ; décision « peinture stylisée », fichier 23 §1) : buste éclairé de trois quarts,
 * dégradés de carnation et de tenue, chevelure, regard, rides selon l'âge apparent ; tiré d'une graine et d'un archétype
 * (déterministe, local, aucune image externe). Jamais de silhouette vide. Couleurs : jetons de tokens.css (classes et
 * variables CSS), aucune couleur en dur.
 */
export const ARCHETYPES = ["officier", "soldat", "cadet", "civil", "clerc", "noble", "ombre"] as const;

let uid = 0;

export interface PortraitOptions {
  /** Âge apparent : « jeune », « adulte », « mur », « age » ; tiré de la graine et de l'archétype par défaut. */
  age?: "jeune" | "adulte" | "mur" | "age";
}

/** Âge apparent d'un archétype (paramètre visuel seulement, aucune donnée de lore). */
export function apparentAge(seed: number, archetype: string): NonNullable<PortraitOptions["age"]> {
  if (archetype === "cadet") return "jeune";
  const r = new Rng(seed ^ 0x51ed).next();
  if (archetype === "noble" || archetype === "clerc") return r < 0.5 ? "mur" : "age";
  if (archetype === "officier") return r < 0.35 ? "adulte" : r < 0.8 ? "mur" : "age";
  return r < 0.3 ? "jeune" : r < 0.8 ? "adulte" : "mur";
}

export function portraitSvg(seed: number, archetype: string, dead = false, opts: PortraitOptions = {}): string {
  const rng = new Rng(seed);
  const r = (a: number, b: number): number => a + (b - a) * rng.next();
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng.next() * xs.length) % xs.length] as T;
  const id = `pt${++uid}`;
  const arch = (ARCHETYPES as readonly string[]).includes(archetype) ? archetype : "civil";
  const age = opts.age ?? apparentAge(seed, arch);
  const skin = Math.floor(r(1, 4.999));
  const hairTone = age === "age" ? 7 : age === "mur" && rng.next() < 0.6 ? 6 : pick([1, 1, 2, 2, 3, 3, 4, 5]);
  const hairStyle = Math.floor(r(0, 5));
  const headW = r(15.5, 18.5);
  const headH = r(21, 24);
  const jaw = r(0.72, 0.95);
  const cx = 50 + r(-1.5, 1.5);
  const eyeY = 52 + r(-1, 1);
  const top = 30;
  const hair = `var(--cheveux-${hairTone})`;
  const hairLight = `var(--cheveux-${Math.min(7, hairTone + 1)})`;
  const s: string[] = [];
  s.push(`<svg class="portrait${dead ? " portrait--mort" : ""}" viewBox="0 0 100 120" role="img" aria-hidden="true">`);
  s.push(
    `<defs>` +
      `<radialGradient id="${id}f" cx="32%" cy="28%" r="85%"><stop offset="0" class="pt-fond-1"/><stop offset="1" class="pt-fond-2"/></radialGradient>` +
      `<linearGradient id="${id}p" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" style="stop-color:var(--peau-${skin})"/><stop offset="1" style="stop-color:var(--peau-${skin + 1})"/></linearGradient>` +
      `<linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="0.2"><stop offset="0" style="stop-color:var(--tenue-${arch})"/><stop offset="1" style="stop-color:var(--tenue-ombre)"/></linearGradient>` +
      `</defs>`,
  );
  s.push(`<rect width="100" height="120" fill="url(#${id}f)"/>`);
  // Épaules et tenue.
  s.push(`<path d="M8 120 C10 98 26 88 ${cx} 86 C74 88 90 98 92 120 Z" fill="url(#${id}t)"/>`);
  s.push(`<path d="M${cx - 9} 80 L${cx - 10} 92 L${cx + 10} 92 L${cx + 9} 80 Z" fill="var(--peau-${skin + 1})"/>`);
  s.push(`<path d="M${cx - 9} 84 C${cx - 4} 88 ${cx + 4} 88 ${cx + 9} 84 L${cx + 9} 88 C${cx + 4} 92 ${cx - 4} 92 ${cx - 9} 88 Z" fill="var(--peau-ombre)"/>`);
  const dress: Record<string, string> = {
    officier:
      `<path d="M${cx - 12} 88 L${cx} 104 L${cx + 12} 88" fill="none" stroke="var(--chemise)" stroke-width="2.2"/>` +
      `<path d="M${cx - 2} 96 L${cx + 2} 96 L${cx} 120 Z" fill="var(--tenue-clerc)"/>` +
      `<circle cx="${cx - 20}" cy="104" r="3.2" class="pt-insigne"/><path d="M${cx + 16} 100 L${cx + 26} 100" class="pt-galon"/>`,
    soldat:
      `<path d="M${cx - 10} 88 L${cx} 99 L${cx + 10} 88" fill="none" stroke="var(--chemise)" stroke-width="1.8"/>` +
      `<path d="M${cx - 26} 98 L${cx - 14} 120 M${cx + 26} 98 L${cx + 14} 120" class="pt-sangle"/>` +
      `<circle cx="${cx - 20}" cy="106" r="2.6" class="pt-insigne"/>`,
    cadet: `<path d="M${cx - 10} 88 L${cx} 98 L${cx + 10} 88" fill="none" stroke="var(--chemise)" stroke-width="1.8"/><path d="M${cx - 24} 100 L${cx + 24} 114" class="pt-sangle"/>`,
    civil: `<path d="M${cx - 9} 88 L${cx} 102 L${cx + 9} 88 Z" fill="var(--chemise)"/><path d="M${cx - 1.5} 92 L${cx + 1.5} 92 L${cx} 104 Z" fill="var(--tenue-noble)"/>`,
    clerc: `<rect x="${cx - 4}" y="87" width="8" height="5" fill="var(--chemise)"/>`,
    noble: `<path d="M${cx - 10} 88 C${cx - 4} 98 ${cx + 4} 98 ${cx + 10} 88 L${cx + 6} 104 L${cx} 99 L${cx - 6} 104 Z" fill="var(--chemise)"/><circle cx="${cx}" cy="100" r="2" class="pt-insigne"/>`,
    ombre: `<path d="M${cx - 30} 120 C${cx - 30} 60 ${cx - 24} 24 ${cx} 22 C${cx + 24} 24 ${cx + 30} 60 ${cx + 30} 120 Z" fill="var(--tenue-ombre)" opacity="0.92"/>`,
  };
  if (arch !== "ombre") s.push(dress[arch] ?? "");
  // Tête : ovale, mâchoire, oreilles.
  const face = `M${cx - headW} ${top + 18} C${cx - headW} ${top} ${cx + headW} ${top} ${cx + headW} ${top + 18} C${cx + headW} ${top + 18 + headH * 0.62} ${cx + headW * jaw * 0.62} ${top + 22 + headH} ${cx} ${top + 24 + headH} C${cx - headW * jaw * 0.62} ${top + 22 + headH} ${cx - headW} ${top + 18 + headH * 0.62} ${cx - headW} ${top + 18} Z`;
  s.push(`<ellipse cx="${cx - headW + 0.5}" cy="${eyeY + 3}" rx="2.6" ry="4.5" fill="var(--peau-${skin})"/><ellipse cx="${cx + headW - 0.5}" cy="${eyeY + 3}" rx="2.6" ry="4.5" fill="var(--peau-${skin + 1})"/>`);
  s.push(`<path d="${face}" fill="url(#${id}p)"/>`);
  // Ombre portée de la lumière (droite du visage), pommettes.
  s.push(`<path d="M${cx + headW * 0.35} ${top + 6} C${cx + headW + 1} ${top + 14} ${cx + headW} ${top + 18 + headH * 0.6} ${cx + 2} ${top + 24 + headH} C${cx + headW * 0.5} ${top + 30} ${cx + headW * 0.55} ${top + 16} ${cx + headW * 0.35} ${top + 6} Z" fill="var(--peau-ombre)"/>`);
  // Regard, sourcils, nez, bouche.
  const brow = r(-0.8, 1.2);
  s.push(`<path d="M${cx - 11} ${eyeY - 5 + brow} C${cx - 8} ${eyeY - 7} ${cx - 4} ${eyeY - 7} ${cx - 2.5} ${eyeY - 5.5}" fill="none" stroke="${hair}" stroke-width="1.6" stroke-linecap="round"/>`);
  s.push(`<path d="M${cx + 2.5} ${eyeY - 5.5} C${cx + 4} ${eyeY - 7} ${cx + 8} ${eyeY - 7} ${cx + 11} ${eyeY - 5 - brow}" fill="none" stroke="${hair}" stroke-width="1.6" stroke-linecap="round"/>`);
  for (const ex of [cx - 6.5, cx + 6.5]) {
    s.push(`<ellipse cx="${ex}" cy="${eyeY}" rx="3" ry="1.5" fill="var(--chemise)" opacity="0.85"/><circle cx="${ex + 0.4}" cy="${eyeY}" r="1.35" fill="var(--oeil)"/><circle cx="${ex - 0.1}" cy="${eyeY - 0.5}" r="0.4" fill="var(--chemise)"/>`);
    s.push(`<path d="M${ex - 3.4} ${eyeY - 0.6} C${ex - 1} ${eyeY - 2.4} ${ex + 1.5} ${eyeY - 2.4} ${ex + 3.4} ${eyeY - 0.4}" fill="none" stroke="var(--oeil)" stroke-width="0.8" opacity="0.8"/>`);
  }
  s.push(`<path d="M${cx + 0.5} ${eyeY + 1} C${cx + 1} ${eyeY + 6} ${cx + 3} ${eyeY + 9} ${cx + 1.5} ${eyeY + 11} C${cx} ${eyeY + 11.8} ${cx - 2} ${eyeY + 11.4} ${cx - 3} ${eyeY + 10.6}" fill="none" stroke="var(--peau-5)" stroke-width="1" opacity="0.7"/>`);
  const smile = r(-0.6, 0.9);
  s.push(`<path d="M${cx - 5} ${eyeY + 16} C${cx - 2} ${eyeY + 17 + smile} ${cx + 2} ${eyeY + 17 + smile} ${cx + 5} ${eyeY + 16 - smile * 0.3}" fill="none" stroke="var(--levres)" stroke-width="1.5" stroke-linecap="round"/>`);
  if (age === "mur" || age === "age") {
    s.push(`<path d="M${cx - 8} ${top + 9} C${cx - 3} ${top + 7.6} ${cx + 3} ${top + 7.6} ${cx + 8} ${top + 9} M${cx - 7} ${eyeY + 9} C${cx - 8.5} ${eyeY + 12} ${cx - 8} ${eyeY + 15} ${cx - 6.5} ${eyeY + 17} M${cx + 7} ${eyeY + 9} C${cx + 8.5} ${eyeY + 12} ${cx + 8} ${eyeY + 15} ${cx + 6.5} ${eyeY + 17}" fill="none" stroke="var(--peau-5)" stroke-width="0.6" opacity="${age === "age" ? 0.75 : 0.45}"/>`);
  }
  if (arch === "soldat" || arch === "officier") if (rng.next() < 0.25) s.push(`<path d="M${cx - 6} ${eyeY + 20} C${cx - 2} ${eyeY + 23} ${cx + 2} ${eyeY + 23} ${cx + 6} ${eyeY + 20}" fill="none" stroke="${hair}" stroke-width="2.2" opacity="0.55"/>`);
  // Chevelure (cinq coupes), reflet du côté de la lumière.
  const H = [
    `M${cx - headW - 1} ${top + 20} C${cx - headW - 2} ${top - 4} ${cx + headW + 2} ${top - 4} ${cx + headW + 1} ${top + 20} C${cx + headW - 2} ${top + 8} ${cx + 4} ${top + 5} ${cx - 6} ${top + 8} C${cx - 11} ${top + 10} ${cx - headW + 1} ${top + 13} ${cx - headW - 1} ${top + 20} Z`,
    `M${cx - headW - 1} ${top + 22} C${cx - headW - 3} ${top - 6} ${cx + headW + 3} ${top - 6} ${cx + headW + 1} ${top + 22} L${cx + headW - 1} ${top + 12} C${cx + 4} ${top + 2} ${cx - 8} ${top + 6} ${cx - headW + 2} ${top + 14} Z`,
    `M${cx - headW} ${top + 16} C${cx - headW + 1} ${top + 1} ${cx + headW - 1} ${top + 1} ${cx + headW} ${top + 16} C${cx + 6} ${top + 9} ${cx - 6} ${top + 9} ${cx - headW} ${top + 16} Z`,
    `M${cx - headW - 3} ${top + 44} C${cx - headW - 5} ${top - 6} ${cx + headW + 5} ${top - 6} ${cx + headW + 3} ${top + 44} L${cx + headW - 1} ${top + 40} L${cx + headW - 1} ${top + 14} C${cx + 4} ${top + 6} ${cx - 6} ${top + 6} ${cx - headW + 1} ${top + 14} L${cx - headW + 1} ${top + 40} Z`,
    `M${cx - headW} ${top + 18} C${cx - headW} ${top + 4} ${cx - 8} ${top + 1} ${cx - 2} ${top + 1} C${cx + 8} ${top + 1} ${cx + headW} ${top + 4} ${cx + headW} ${top + 18} C${cx + headW - 4} ${top + 12} ${cx + headW - 6} ${top + 9} ${cx + headW - 8} ${top + 9} C${cx} ${top + 8} ${cx - headW + 6} ${top + 9} ${cx - headW} ${top + 18} Z`,
  ];
  if (arch === "ombre") s.push(dress["ombre"] ?? "");
  else {
    s.push(`<path d="${H[hairStyle] ?? H[0]}" fill="${hair}"/>`);
    s.push(`<path d="M${cx - headW + 3} ${top + 12} C${cx - 8} ${top + 3} ${cx - 2} ${top + 2} ${cx + 4} ${top + 3}" fill="none" stroke="${hairLight}" stroke-width="1.2" opacity="0.55" stroke-linecap="round"/>`);
  }
  if (dead) s.push(`<path d="M70 0 L100 0 L100 30 Z" class="pt-deuil"/>`);
  s.push(`</svg>`);
  return s.join("");
}
