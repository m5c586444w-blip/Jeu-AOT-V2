import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fr from "../../src/i18n/fr.json";
import { contractFr, createTranslator, interpolate, setLocale, t } from "../../src/i18n";

/** Clés littérales utilisées dans src/ : appels t("…") / t('…'). */
const KEY_CALL = /\bt\(\s*["'`]([a-z0-9_.]+)["'`]/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

export function usedKeys(dir = "src"): { key: string; file: string }[] {
  return sourceFiles(dir).flatMap((file) => [...readFileSync(file, "utf8").matchAll(KEY_CALL)].map((m) => ({ key: m[1] as string, file })));
}

export function missingKeys(used: { key: string; file: string }[], dict: Record<string, string>): string[] {
  return used.filter((u) => !(u.key in dict)).map((u) => `${u.file} : ${u.key}`);
}

describe("i18n (AC-14)", () => {
  it("toutes les clés littérales de src/ existent dans fr.json", () => {
    const used = usedKeys();
    expect(used.length).toBeGreaterThan(0);
    expect(missingKeys(used, fr)).toEqual([]);
  });
  it("une clé manquante fait échouer le contrôle", () => {
    expect(missingKeys([{ key: "app.inexistante", file: "src/x.ts" }], fr)).toEqual(["src/x.ts : app.inexistante"]);
  });
  it("t() interpole les paramètres", () => {
    expect(t("date.format", { year: 850, day: 12 })).toBe("an 850, jour 12");
    expect(interpolate("{a} et {b}", { a: 1 })).toBe("1 et {b}");
  });
  it("repli : en → fr → clé", () => {
    const tr = createTranslator("en", { fr: { a: "A-fr", b: "B-fr" }, en: { a: "A-en" } });
    expect(tr("a")).toBe("A-en");
    expect(tr("b")).toBe("B-fr");
    expect(tr("c")).toBe("c");
    setLocale("en");
    expect(t("app.title")).toBe("Walls and Blood");
    setLocale("fr");
    expect(t("app.title")).toBe("Murs et Sang");
  });

  it("toponymes à nom commun : « au », « aux », « à la », « du », « des » (dette n° 31) ; noms de ville inchangés", () => {
    expect(t("field.depot_built", { province: t("prov.plateau_du_nord") })).toBe("Dépôt avancé installé au Plateau du Nord.");
    expect(t("field.depot_built", { province: t("prov.foret_morte") })).toBe("Dépôt avancé installé à la Forêt Morte.");
    expect(t("field.depot_built", { province: t("prov.hameaux_est") })).toBe("Dépôt avancé installé aux Hameaux de l'Est.");
    expect(t("field.depot_built", { province: t("prov.trost") })).toBe(`Dépôt avancé installé à ${t("prov.trost")}.`);
    expect(contractFr("Le convoi part de Camp d'entraînement.", ["Camp d'entraînement"], new Map([["Camp d'entraînement", "le"]]))).toBe("Le convoi part du Camp d'entraînement.");
    expect(contractFr("Retour de Collines minières.", ["Collines minières"], new Map([["Collines minières", "les"]]))).toBe("Retour des Collines minières.");
    // Un nom non inséré par paramètre n'est pas touché.
    expect(contractFr("à Forêt Morte", [], new Map([["Forêt Morte", "la"]]))).toBe("à Forêt Morte");
  });
});
