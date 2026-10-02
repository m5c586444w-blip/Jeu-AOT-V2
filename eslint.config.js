// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/** Globaux de navigateur interdits dans src/sim (la simulation doit rester pure). */
const BROWSER_GLOBALS = ["window", "document", "navigator", "localStorage", "sessionStorage", "indexedDB", "location", "requestAnimationFrame", "performance"];

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**", "tests/fixtures/**"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // Pureté de la simulation : pas de DOM, pas de Pixi, pas d'aléa ni d'horloge implicites.
    files: ["src/sim/**/*.ts"],
    rules: {
      "no-restricted-globals": ["error", ...BROWSER_GLOBALS.map((name) => ({ name, message: "src/sim ne doit pas dépendre du navigateur." }))],
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["pixi.js", "pixi.js/*", "@pixi/*"], message: "src/sim ne doit pas importer Pixi." },
          { group: ["**/render/**", "**/ui/**", "**/audio/**"], message: "src/sim ne dépend pas de la présentation." },
          { group: ["node:*", "fs", "path", "worker_threads"], message: "src/sim ne dépend pas de Node." },
        ],
      }],
      "no-restricted-properties": ["error",
        { object: "Math", property: "random", message: "Utiliser le Rng seedé injecté." },
        { object: "Date", property: "now", message: "Le temps est injecté (GameDate / horloge)." },
      ],
      "no-restricted-syntax": ["error",
        { selector: "NewExpression[callee.name='Date']", message: "Pas de Date dans src/sim : le temps est injecté." },
      ],
    },
  },
);
