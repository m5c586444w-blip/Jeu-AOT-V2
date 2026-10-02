import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fr from "../../src/i18n/fr.json";
import { createTranslator, interpolate, setLocale, t } from "../../src/i18n";

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
});
