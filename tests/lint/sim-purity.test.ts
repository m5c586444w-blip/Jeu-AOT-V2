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
  it("interdit Pixi hors de src/render (AC1-08)", async () => {
    const code = 'import { Graphics } from "pixi.js";\nexport { Graphics };\n';
    expect(await ruleIds(code, "src/ui/__probe__.ts")).toContain("no-restricted-imports");
    expect(await ruleIds(code, "src/tools/__probe__.ts")).toContain("no-restricted-imports");
    expect(await ruleIds(code, "src/render/__probe__.ts")).toEqual([]);
  });
  it("three.js uniquement dans src/render/tactical3d (R1, D-81)", async () => {
    const codes = ['import { Scene } from "three";\nexport { Scene };\n', 'import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";\nexport { OrbitControls };\n'];
    for (const code of codes) {
      for (const file of ["src/sim/core/__probe__.ts", "src/ui/__probe__.ts", "src/render/__probe__.ts", "src/render/tactical/__probe__.ts", "src/tools/__probe__.ts", "src/__probe__.ts"]) {
        expect(await ruleIds(code, file), file).toContain("no-restricted-imports");
      }
      expect(await ruleIds(code, "src/render/tactical3d/__probe__.ts")).toEqual([]);
    }
  });
  it("Pixi reste interdit hors de src/render quand three.js l'est aussi, et dans l'essai 3D (un seul moteur)", async () => {
    const code = 'import { Graphics } from "pixi.js";\nexport { Graphics };\n';
    expect(await ruleIds(code, "src/ui/__probe__.ts")).toContain("no-restricted-imports");
    expect(await ruleIds(code, "src/render/tactical3d/__probe__.ts")).toContain("no-restricted-imports");
    expect(await ruleIds(code, "src/render/tactical/__probe__.ts")).toEqual([]);
  });
  it("Math.random interdit dans l'essai 3D : variations tirées d'une graine locale (R1)", async () => {
    expect(await ruleIds("export const x = Math.random();\n", "src/render/tactical3d/__probe__.ts")).toContain("no-restricted-properties");
  });
  it("morceau 3D : Zod et les schémas de données en types seulement (R1b : Zod reste hors du rendu)", async () => {
    const runtime = 'import { StylesFileSchema } from "../../data/artSchemas";\nexport const s = StylesFileSchema;\n';
    const typesOnly = 'import type { StyleProfile } from "../../data/artSchemas";\nexport type P = StyleProfile;\n';
    expect(await ruleIds(runtime, "src/render/tactical3d/__probe__.ts")).toContain("no-restricted-imports");
    expect(await ruleIds('import { z } from "zod";\nexport const a = z.string();\n', "src/render/tactical3d/__probe__.ts")).toContain("no-restricted-imports");
    expect(await ruleIds(typesOnly, "src/render/tactical3d/__probe__.ts")).toEqual([]);
    expect(await ruleIds(runtime, "src/tools/__probe__.ts")).toEqual([]);
  });
  it("autorise Math.random hors de src/sim (contrôle)", async () => {
    expect(await ruleIds("export const x = Math.random();\n", "src/ui/__probe__.ts")).toEqual([]);
  });
});
