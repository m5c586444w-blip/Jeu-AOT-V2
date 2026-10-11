import { describe, expect, it } from "vitest";
import en from "../../src/i18n/en.json";
import fr from "../../src/i18n/fr.json";

/** E-07 (24 §2.5 : « anglais en second ») : au moins 90 % des clés françaises traduites, paramètres identiques. */
describe("traduction anglaise", () => {
  const PH = /\{(\w+)(?:\|[^{}]*)?\}/g;
  const params = (s: string): string[] => [...s.matchAll(PH)].map((m) => m[1] as string).sort();
  const frD = fr as Record<string, string>;
  const enD = en as Record<string, string>;

  it("au moins 90 % des clés françaises ont leur anglais", () => {
    const keys = Object.keys(frD);
    const done = keys.filter((k) => k in enD).length;
    expect(done / keys.length).toBeGreaterThanOrEqual(0.9);
  });

  it("chaque texte anglais garde les paramètres du français (mêmes noms, même nombre) ; aucune clé inconnue", () => {
    const bad = Object.keys(enD).filter((k) => !(k in frD) || params(enD[k] as string).join(",") !== params(frD[k] as string).join(","));
    expect(bad).toEqual([]);
  });
});
