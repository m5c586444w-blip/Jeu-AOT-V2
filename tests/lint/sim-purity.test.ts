import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// AC-02 / AC-03 : prouve que les règles de pureté de src/sim échouent réellement.
const eslint = new ESLint({ cwd: process.cwd() });

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? "fatal");
}

describe("pureté de src/sim", () => {
  it("interdit Math.random", async () => {
    expect(await ruleIds("export const x = Math.random();\n", "src/sim/core/__probe__.ts")).toContain("no-restricted-properties");
  });
  it("interdit Date.now et new Date", async () => {
    const ids = await ruleIds("export const a = Date.now();\nexport const b = new Date();\n", "src/sim/core/__probe__.ts");
    expect(ids.filter((id) => id === "no-restricted-properties" || id === "no-restricted-syntax")).toHaveLength(2);
  });
  it("interdit l'import de Pixi", async () => {
    expect(await ruleIds('import { Application } from "pixi.js";\nexport { Application };\n', "src/sim/core/__probe__.ts")).toContain("no-restricted-imports");
  });
  it("interdit le DOM", async () => {
    expect(await ruleIds("export const el = document.body;\n", "src/sim/core/__probe__.ts")).toContain("no-restricted-globals");
  });
  it("interdit any partout", async () => {
    expect(await ruleIds("export const v: any = 1;\n", "src/ui/__probe__.ts")).toContain("@typescript-eslint/no-explicit-any");
  });
  it("autorise Math.random hors de src/sim (contrôle)", async () => {
    expect(await ruleIds("export const x = Math.random();\n", "src/ui/__probe__.ts")).toEqual([]);
  });
});
