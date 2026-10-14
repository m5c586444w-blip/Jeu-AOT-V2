import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cb } from "./helpers";

const code = readdirSync("src/sim/clock")
  .filter((f) => f.endsWith(".ts"))
  .map((f) => readFileSync(`src/sim/clock/${f}`, "utf8"))
  .join("\n");

describe("clock.json : aucune donnée morte", () => {
  it("chaque paramètre numérique de chaque section est lu par le code de src/sim/clock", () => {
    const dead: string[] = [];
    for (const [section, v] of Object.entries(cb)) {
      if (section === "canon" || section === "notes_canon") continue;
      if (typeof v !== "object" || v === null || Array.isArray(v)) {
        if (!new RegExp(`\\b(b\\.${section}|${section})\\b`).test(code)) dead.push(section);
        continue;
      }
      // Tables indexées par identifiants de données (preuves, rôles, modèles) : lues par clé dynamique.
      if (["models", "cover"].includes(section) === false && section !== "suspicion") {
        for (const key of Object.keys(v)) if (!code.includes(`${section}.${key}`) && !new RegExp(`\\.${key}\\b`).test(code)) dead.push(`${section}.${key}`);
      }
    }
    for (const key of Object.keys(cb.suspicion)) if (!code.includes(`suspicion.${key}`)) dead.push(`suspicion.${key}`);
    for (const key of Object.keys(cb.cover)) if (!code.includes(`cover.${key}`)) dead.push(`cover.${key}`);
    expect(dead).toEqual([]);
  });
});
