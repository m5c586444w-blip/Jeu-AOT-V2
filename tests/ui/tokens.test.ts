import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// UI.1 (U1) : jetons de style dans src/ui/styles/tokens.css, aucune couleur en dur ailleurs dans l'interface.
const ROOT = "src/ui";
const TOKENS = "src/ui/styles/tokens.css";
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
const sources = files(ROOT).filter((f) => /\.(css|ts)$/.test(f) && f.replace(/\\/g, "/") !== TOKENS);
/** Couleur littérale : #rgb à #rrggbbaa (hors entités HTML), rgb()/rgba()/hsl()/hsla(), 0xRRGGBB. */
const COLOR = /(?<![&\w])#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|\b0x[0-9a-fA-F]{6}\b/g;
/** Variables posées par le code à l'exécution (textures, hauteurs mesurées, position des sous-titres). */
const RUNTIME = new Set(["--grain-fond", "--grain-cadre", "--fibres", "--masque-tampon", "--taches", "--bandeau-h", "--gestion-h", "--hauteur-utile", "--sous-titres-x", "--sous-titres-y", "--ui-echelle"]);

describe("jetons de style (UI.1, U1)", () => {
  const tokens = readFileSync(TOKENS, "utf8");
  const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] as string));

  it("aucune couleur en dur hors de tokens.css (CSS et TypeScript de src/ui)", () => {
    const found = sources.flatMap((f) => [...readFileSync(f, "utf8").matchAll(COLOR)].map((m) => `${f} : ${m[0]}`));
    expect(found).toEqual([]);
    expect(sources.length).toBeGreaterThan(40);
  });

  it("toute variable utilisée est définie dans tokens.css (ou posée à l'exécution)", () => {
    const missing = new Set<string>();
    for (const f of sources) for (const m of readFileSync(f, "utf8").matchAll(/var\((--[a-z0-9-]+)/g)) {
      const v = m[1] as string;
      // Nom composé à l'exécution (`var(--peau-${n})`) : le préfixe doit exister.
      const ok = v.endsWith("-") ? [...defined].some((d) => d.startsWith(v)) : defined.has(v) || RUNTIME.has(v);
      if (!ok) missing.add(`${f} : ${v}`);
    }
    expect([...missing]).toEqual([]);
  });

  it("palette : fond anthracite, panneaux, accent laiton, danger, état, et un accent par nation", () => {
    for (const v of ["--fond", "--panneau", "--filet", "--accent", "--danger", "--succes", "--texte", "--nation-paradis", "--nation-marley", "--nation-hizuru", "--nation-allies"]) expect(defined.has(v), v).toBe(true);
    for (const f of ["fac_paradis", "fac_marley", "fac_hizuru", "fac_allies"]) expect(tokens).toContain(`[data-faction="${f}"]`);
  });

  it("aucun rayon de coin supérieur à 3 px ni dégradé violet (U11)", () => {
    const css = sources.filter((f) => f.endsWith(".css")).map((f) => readFileSync(f, "utf8")).join("\n");
    const radii = [...css.matchAll(/border-radius:\s*([0-9.]+)(px|rem)/g)].filter((m) => (m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1])) > 3 && !/scrollbar|::-webkit/.test(css.slice(Math.max(0, (m.index ?? 0) - 120), m.index)));
    expect(radii.map((m) => m[0])).toEqual([]);
    expect(/violet|purple|#8a2be2/i.test(css)).toBe(false);
  });
});
