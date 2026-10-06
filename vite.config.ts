import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

/**
 * R1b : `/proto3d/galerie` mène à la galerie des environnements 3D (`?proto3d=galerie`) sans toucher `src/main.ts`.
 * En production, c'est la page statique `public/proto3d/galerie.html` ; en développement, cette redirection.
 */
const galerie3d = (): Plugin => ({
  name: "galerie-3d",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url ?? "";
      if (/^\/proto3d\/galerie\/?(\?.*)?$/.test(url)) {
        res.statusCode = 302;
        res.setHeader("Location", "/?proto3d=galerie");
        res.end();
        return;
      }
      next();
    });
  },
});

export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: "es2022", sourcemap: false },
  worker: { format: "es" },
  plugins: [galerie3d()],
});
