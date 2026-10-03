import { Rng } from "../sim/core/rng";

/**
 * Portrait gravé procédural (04 §8.4 : dessin original par archétype, non photoréaliste) :
 * buste en silhouette, hachures d'ombre, variantes de coiffure et de col tirées de la graine.
 */
export function portraitSvg(seed: number, archetype: string, dead = false): string {
  const rng = new Rng(seed);
  const r = (a: number, b: number): number => a + (b - a) * rng.next();
  const headW = r(17, 21);
  const headH = r(22, 26);
  const jaw = r(0.8, 1);
  const hair = Math.floor(r(0, 4));
  const ink = "#1c1a17";
  const lines: string[] = [];
  // Hachures obliques sur la moitié droite du visage et des épaules (lumière à gauche).
  for (let i = 0; i < 14; i++) {
    const x = 50 + i * 2.2;
    lines.push(`<path d="M${x} ${34 + i * 0.6} L${x + 6} ${44 + i * 0.6}" stroke="${ink}" stroke-width="0.5" opacity="0.45"/>`);
  }
  for (let i = 0; i < 12; i++) {
    const x = 52 + i * 3;
    lines.push(`<path d="M${x} 88 L${x + 9} 108" stroke="${ink}" stroke-width="0.6" opacity="0.4"/>`);
  }
  const hairPaths = [
    `<path d="M${50 - headW} 36 C${50 - headW} 16 ${50 + headW} 16 ${50 + headW} 36 C${48 + headW / 2} 26 ${52 - headW / 2} 26 ${50 - headW} 36 Z" fill="${ink}" opacity="0.85"/>`,
    `<path d="M${50 - headW - 1} 40 C${48 - headW} 14 ${52 + headW} 14 ${51 + headW} 40 L${49 + headW} 30 C${45} 24 ${40} 26 ${50 - headW + 2} 34 Z" fill="${ink}" opacity="0.8"/>`,
    `<path d="M${50 - headW} 34 C${52 - headW} 20 ${50 + headW} 18 ${50 + headW} 32" fill="none" stroke="${ink}" stroke-width="3" opacity="0.8"/>`,
    `<path d="M${50 - headW - 2} 44 C${46 - headW} 12 ${54 + headW} 12 ${52 + headW} 44 L${50 + headW} 58 L${50 + headW - 3} 36 C${50} 28 ${44} 28 ${50 - headW + 2} 38 L${50 - headW} 58 Z" fill="${ink}" opacity="0.8"/>`,
  ];
  const collar: Record<string, string> = {
    officier: `<path d="M24 120 C26 96 38 88 50 86 C62 88 74 96 76 120 Z" fill="#8a8577" stroke="${ink}" stroke-width="1.2"/><path d="M42 88 L50 102 L58 88" fill="none" stroke="${ink}" stroke-width="1.2"/><circle cx="36" cy="104" r="2.6" fill="none" stroke="${ink}"/>`,
    soldat: `<path d="M24 120 C26 98 38 89 50 87 C62 89 74 98 76 120 Z" fill="#4f6b5a" fill-opacity="0.55" stroke="${ink}" stroke-width="1.2"/><path d="M44 88 L50 96 L56 88" fill="none" stroke="${ink}"/>`,
    cadet: `<path d="M26 120 C28 99 39 90 50 88 C61 90 72 99 74 120 Z" fill="#b5873a" fill-opacity="0.45" stroke="${ink}" stroke-width="1.2"/>`,
    civil: `<path d="M24 120 C26 98 38 89 50 87 C62 89 74 98 76 120 Z" fill="#cdbf9f" stroke="${ink}" stroke-width="1.2"/><path d="M46 88 L50 100 L54 88" fill="${ink}" opacity="0.7"/>`,
    clerc: `<path d="M22 120 C24 96 38 88 50 86 C62 88 76 96 78 120 Z" fill="${ink}" fill-opacity="0.8" stroke="${ink}"/><rect x="47" y="88" width="6" height="5" fill="#e8dcc0"/>`,
    noble: `<path d="M24 120 C26 97 38 89 50 87 C62 89 74 97 76 120 Z" fill="#8a3b2a" fill-opacity="0.55" stroke="${ink}" stroke-width="1.2"/><path d="M40 90 C45 96 55 96 60 90" fill="none" stroke="${ink}" stroke-width="2"/>`,
    ombre: `<path d="M20 120 C22 94 36 86 50 84 C64 86 78 94 80 120 Z" fill="${ink}" fill-opacity="0.85"/><path d="M28 40 L72 40 L66 30 L34 30 Z" fill="${ink}"/>`,
  };
  return (
    `<svg class="portrait${dead ? " portrait--mort" : ""}" viewBox="0 0 100 120" role="img" aria-hidden="true">` +
    `<rect x="2" y="2" width="96" height="116" fill="#e8dcc0" stroke="${ink}" stroke-width="1.5"/>` +
    `<rect x="6" y="6" width="88" height="108" fill="none" stroke="${ink}" stroke-width="0.6"/>` +
    (collar[archetype] ?? collar["civil"]) +
    `<path d="M${50 - 6} 70 L${50 - 7} 88 L${50 + 7} 88 L${50 + 6} 70 Z" fill="#e8dcc0" stroke="${ink}" stroke-width="1"/>` +
    `<path d="M${50 - headW} 40 C${50 - headW} 18 ${50 + headW} 18 ${50 + headW} 40 C${50 + headW} ${40 + headH * 0.7} ${50 + headW * jaw * 0.6} ${44 + headH} 50 ${46 + headH} C${50 - headW * jaw * 0.6} ${44 + headH} ${50 - headW} ${40 + headH * 0.7} ${50 - headW} 40 Z" fill="#efe6cf" stroke="${ink}" stroke-width="1.3"/>` +
    lines.join("") +
    (hairPaths[hair] ?? "") +
    `<path d="M${43} 47 L${47} 47 M${53} 47 L${57} 47" stroke="${ink}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M50 50 L48.5 58 L51 58.5" fill="none" stroke="${ink}" stroke-width="0.9"/>` +
    `<path d="M45.5 63 C48 64 52 64 54.5 63" fill="none" stroke="${ink}" stroke-width="1"/>` +
    (dead ? `<path d="M4 114 L96 6" stroke="#1c1a17" stroke-width="2.5" opacity="0.75"/>` : "") +
    `</svg>`
  );
}
