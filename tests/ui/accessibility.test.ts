import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadWorld } from "../../src/data/worldNode";
import { stateHash } from "../../src/sim/core/canonical";
import { deserialize, serialize } from "../../src/sim/core/serialize";
import { createInitialState, tickDay } from "../../src/sim/core/state";
import { customDifficultyParam, DEFAULT_CUSTOM, parseCustomDifficulty } from "../../src/ui/customDifficulty";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../../src/ui/settings";

/**
 * P10.1 (CP10-02 ; 09 §20) : couleurs pour daltoniens, mouvements et flashs réduits, aide à la lecture (préférences locales,
 * jamais dans l'état) ; difficulté personnalisée (F-ACC-08), portée par l'état et la sauvegarde.
 */
function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

/** Couleur perçue par un deutéranope (matrice de Viénot et al., 1999, sur les composantes linéarisées). */
function deutan(hex: string): [number, number, number] {
  const lin = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255)) as [number, number, number];
  return [0.29275 * r + 0.70725 * g, 0.29275 * r + 0.70725 * g, -0.02234 * r + 0.02234 * g + b];
}
const dist = (a: [number, number, number], b: [number, number, number]): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe("accessibilité (P10.1)", () => {
  it("préférences : désactivées par défaut, gardées, valeurs invalides ignorées", () => {
    const s = memory();
    expect(DEFAULT_SETTINGS.colorblind || DEFAULT_SETTINGS.reduceMotion || DEFAULT_SETTINGS.readingAid).toBe(false);
    saveSettings(s, { ...DEFAULT_SETTINGS, colorblind: true, reduceMotion: true, readingAid: true });
    const back = loadSettings(s);
    expect([back.colorblind, back.reduceMotion, back.readingAid]).toEqual([true, true, true]);
    s.setItem("murs-et-sang:preferences", JSON.stringify({ colorblind: "oui", reduceMotion: 1 }));
    expect([loadSettings(s).colorblind, loadSettings(s).reduceMotion]).toEqual([false, false]);
  });

  it("palette pour daltoniens : quatre nations et les états danger / succès restent distincts pour un deutéranope", () => {
    const css = readFileSync("src/ui/styles/tokens.css", "utf8");
    const block = css.slice(css.indexOf(':root[data-daltonien="1"]'));
    const color = (name: string): string => (block.match(new RegExp(`--${name}: (#[0-9a-f]{6})`))?.[1] ?? "") as string;
    const nations = ["nation-paradis", "nation-marley", "nation-hizuru", "nation-allies"].map(color);
    expect(nations.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
    for (let i = 0; i < nations.length; i++) for (let j = i + 1; j < nations.length; j++) expect(dist(deutan(nations[i] as string), deutan(nations[j] as string)), `${nations[i]} / ${nations[j]}`).toBeGreaterThan(0.08);
    expect(dist(deutan(color("danger")), deutan(color("succes")))).toBeGreaterThan(0.08);
    // Mouvements réduits et aide à la lecture : règles présentes, aucune police nouvelle.
    expect(css).toContain(':root[data-mouvement="reduit"] *');
    expect(css.slice(css.indexOf(':root[data-lecture="aide"]'))).not.toMatch(/@font-face|url\(/);
  });

  it("difficulté personnalisée : lecture validée, monde transformé, état et sauvegarde fidèles, déterminisme", () => {
    expect(parseCustomDifficulty(customDifficultyParam(DEFAULT_CUSTOM))).toEqual(DEFAULT_CUSTOM);
    expect(parseCustomDifficulty("2,1,1,1,0,0")).toBeNull();
    expect(parseCustomDifficulty("1,1,1")).toBeNull();
    const custom = { production: 0.8, titans: 1.3, ia_attaque: 1.1, pertes: 1.2, moral: -10, stabilite: 5 };
    const base = loadWorld("data", "scn_sandbox_850");
    const w = loadWorld("data", "scn_sandbox_850", custom);
    expect(w.difficulty).toBe("personnalise");
    expect(w.scenario.production_mult.food ?? 1).toBeCloseTo((base.scenario.production_mult.food ?? 1) * 0.8, 6);
    expect(w.scenario.morale).toBe(base.scenario.morale - 10);
    const s0 = createInitialState(7, w);
    expect(s0.difficulty).toBe("personnalise");
    expect(s0.difficultyCustom).toEqual(custom);
    const back = deserialize(serialize(s0));
    expect(back.difficultyCustom).toEqual(custom);
    let a = s0;
    let b = createInitialState(7, loadWorld("data", "scn_sandbox_850", { ...custom }));
    for (let d = 0; d < 30; d++) {
      a = tickDay(a, w);
      b = tickDay(b, w);
    }
    expect(stateHash(a)).toBe(stateHash(b));
    // « Normal » : pas de champ, empreinte du monde des données.
    expect(createInitialState(7, base).difficultyCustom).toBeUndefined();
  });
});
