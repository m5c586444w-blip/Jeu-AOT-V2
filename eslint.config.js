// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/** Globaux de navigateur interdits dans src/sim (la simulation doit rester pure). */
const BROWSER_GLOBALS = ["window", "document", "navigator", "localStorage", "sessionStorage", "indexedDB", "location", "requestAnimationFrame", "performance"];

const PIXI = ["pixi.js", "pixi.js/*", "@pixi/*"];
const PIXI_ONLY_RENDER = { group: PIXI, message: "Pixi uniquement dans src/render." };
/** three.js : chargé à la demande, seulement par l'essai de rendu 3D (R1, D-81). */
const THREE_ONLY_3D = { group: ["three", "three/*", "three/**"], message: "three.js uniquement dans src/render/tactical3d." };

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**", "tests/fixtures/**", ".probe.*"] },
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
    // Pixi n'est autorisé que dans la couche de rendu (P1) ; three.js que dans l'essai 3D (R1, D-81).
    files: ["**/*.ts"],
    ignores: ["src/render/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [PIXI_ONLY_RENDER, THREE_ONLY_3D] }],
    },
  },
  {
    // Dans src/render, hors de l'essai 3D : Pixi oui, three.js non.
    files: ["src/render/**/*.ts"],
    ignores: ["src/render/tactical3d/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [THREE_ONLY_3D] }],
    },
  },
  {
    // Essai 3D (R1) : three.js seulement, pas de second moteur ; variations visuelles tirées d'une graine locale.
    files: ["src/render/tactical3d/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: PIXI, message: "Pas de Pixi dans src/render/tactical3d : un seul moteur par vue." },
          // R1b : les schémas Zod des données de rendu ne servent qu'à la validation ; le morceau 3D n'en lit que les types.
          { group: ["zod", "**/data/artSchemas", "**/data/schemas", "**/data/placeSchema"], allowTypeImports: true, message: "Morceau 3D : types seulement (Zod reste hors du rendu)." },
        ],
      }],
      "no-restricted-properties": ["error", { object: "Math", property: "random", message: "Variations visuelles : graine locale (rng.ts), jamais Math.random." }],
    },
  },
  {
    // Pureté de la simulation : pas de DOM, pas de Pixi, pas d'aléa ni d'horloge implicites.
    files: ["src/sim/**/*.ts"],
    rules: {
      "no-restricted-globals": ["error", ...BROWSER_GLOBALS.map((name) => ({ name, message: "src/sim ne doit pas dépendre du navigateur." }))],
      "no-restricted-imports": ["error", {
        patterns: [
          { group: PIXI, message: "src/sim ne doit pas importer Pixi." },
          THREE_ONLY_3D,
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
