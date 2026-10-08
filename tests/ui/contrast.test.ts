import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// CUI-09 : contrastes WCAG 2.1 des paires texte / fond de l'interface (AA : 4,5 pour le texte, 3 pour les éléments
// graphiques et le texte large), calculés sur les jetons de tokens.css, thème de base et thèmes de nation.
const css = readFileSync("src/ui/styles/tokens.css", "utf8");

function block(selector: string): Record<string, string> {
  const i = css.indexOf(`${selector} {`);
  if (i < 0) throw new Error(`bloc absent : ${selector}`);
  const body = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
  return Object.fromEntries([...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1] as string, (m[2] as string).trim()]));
}
const base = block(":root");

function resolve(name: string, theme: Record<string, string>): string {
  let v = theme[name] ?? base[name];
  for (let i = 0; i < 10 && v?.startsWith("var("); i++) {
    const ref = /var\((--[a-z0-9-]+)\)/.exec(v)?.[1] ?? "";
    v = theme[ref] ?? base[ref];
  }
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${name} : couleur opaque attendue, trouvé ${v}`);
  return v;
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0);
}
export function ratio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

/** [texte, fond, minimum] : texte courant 4,5 ; icônes, filets d'accent et grands titres 3. */
const PAIRS: [string, string, number][] = [
  ...["--fond", "--fond-profond", "--panneau", "--panneau-haut", "--panneau-creux", "--champ"].flatMap((bg): [string, string, number][] => [
    ["--texte", bg, 4.5],
    ["--texte-fort", bg, 4.5],
    ["--texte-second", bg, 4.5],
    ["--accent-clair", bg, 4.5],
    ["--danger-clair", bg, 4.5],
    ["--succes", bg, 4.5],
    ["--alerte", bg, 4.5],
    ["--info", bg, 4.5],
    ["--accent", bg, 3],
    ["--danger", bg, 3],
  ]),
  ...["--fond", "--fond-profond", "--panneau", "--panneau-creux"].map((bg): [string, string, number] => ["--texte-discret", bg, 4.5]),
  ["--texte-fort", "--accent-fond", 4.5],
  ["--accent-clair", "--accent-fond", 4.5],
  ["--texte-fort", "--danger-fond", 4.5],
  ["--danger-clair", "--danger-fond", 4.5],
  ["--texte-fort", "--succes-fond", 4.5],
  ["--succes-clair", "--succes-fond", 4.5],
  ["--alerte", "--alerte-fond", 4.5],
  ["--info", "--info-fond", 4.5],
  ["--accent-texte", "--accent", 4.5],
  ["--accent-texte", "--accent-clair", 4.5],
  ["--texte-fort", "--danger-plein", 4.5],
  ["--encre", "--papier", 7],
  ["--encre-douce", "--papier", 4.5],
];

describe("contrastes AA (CUI-09)", () => {
  for (const theme of [":root", ':root[data-faction="fac_marley"]', ':root[data-faction="fac_hizuru"]']) {
    it(`thème ${theme} : toutes les paires atteignent le seuil AA`, () => {
      const th = theme === ":root" ? {} : block(theme);
      const fails = PAIRS.map(([fg, bg, min]) => ({ fg, bg, min, r: ratio(resolve(fg, th), resolve(bg, th)) })).filter((p) => p.r < p.min);
      expect(fails.map((p) => `${p.fg} sur ${p.bg} : ${p.r.toFixed(2)} < ${p.min}`)).toEqual([]);
    });
  }

  it("calcul de référence : noir sur blanc = 21, gris moyen ≈ 4,5", () => {
    expect(ratio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(ratio("#767676", "#ffffff")).toBeGreaterThan(4.5);
  });
});
