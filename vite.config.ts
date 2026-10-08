import { existsSync, readFileSync, readdirSync } from "node:fs";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { listUserMusic, readUserMusic, userMusicIndex } from "./src/tools/userMusic";

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

/**
 * R1c : fichiers externes servis au rendu 3D sous `/assets3d/` — ceux du manifeste `docs/art/assets/manifest.json` marqués
 * `execution`. Développement : intergiciel ; construction : copiés dans `dist/assets3d/`. Le bundle JS n'en contient rien.
 */
const assets3d = (): Plugin => {
  const root = "docs/art/assets";
  const served = (): Set<string> => {
    const path = `${root}/manifest.json`;
    if (!existsSync(path)) return new Set();
    const m = JSON.parse(readFileSync(path, "utf8")) as { fichiers: { fichier: string; execution?: boolean }[] };
    return new Set(m.fichiers.filter((e) => e.execution).map((e) => e.fichier));
  };
  const types: Record<string, string> = { glb: "model/gltf-binary", png: "image/png", jpg: "image/jpeg", webp: "image/webp" };
  return {
    name: "assets-3d",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/assets3d\/([^?#]+)/.exec(req.url ?? "");
        const f = m?.[1] ? decodeURIComponent(m[1]) : "";
        if (!f || !served().has(f)) {
          next();
          return;
        }
        res.setHeader("Content-Type", types[f.split(".").pop() ?? ""] ?? "application/octet-stream");
        res.end(readFileSync(`${root}/${f}`));
      });
    },
    generateBundle() {
      for (const f of served()) this.emitFile({ type: "asset", fileName: `assets3d/${f}`, source: readFileSync(`${root}/${f}`) });
    },
  };
};

/**
 * R1e : plans des lieux (`data/places/*.json`, `data/places/generated/*.json`) servis sous `/places3d/` à la visionneuse 3D,
 * lus par `fetch` : jamais dans le bundle JS. Développement : intergiciel ; construction : copiés dans `dist/places3d/`.
 */
const places3d = (): Plugin => {
  const files = (): string[] => {
    const out: string[] = [];
    for (const d of ["data/places", "data/places/generated"]) {
      if (!existsSync(d)) continue;
      for (const f of readdirSync(d)) if (f.endsWith(".json")) out.push(d === "data/places" ? f : `generated/${f}`);
    }
    return out;
  };
  return {
    name: "places-3d",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/places3d\/([^?#]+)/.exec(req.url ?? "");
        const f = m?.[1] ? decodeURIComponent(m[1]) : "";
        if (!f || !files().includes(f)) {
          next();
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(readFileSync(`data/places/${f}`));
      });
    },
    generateBundle() {
      for (const f of files()) this.emitFile({ type: "asset", fileName: `places3d/${f}`, source: readFileSync(`data/places/${f}`) });
    },
  };
};

/**
 * AUD.4 : musique de l'utilisateur. Les fichiers mp3 et ogg de `assets_user/musique/` sont servis sous `/musique-utilisateur/`
 * avec un index `index.json` (développement : intergiciel, lu à chaque requête ; construction : copiés dans
 * `dist/musique-utilisateur/`). Le dossier est facultatif ; rien n'entre dans le bundle JS.
 */
const musiqueUtilisateur = (): Plugin => {
  const types: Record<string, string> = { mp3: "audio/mpeg", ogg: "audio/ogg" };
  return {
    name: "musique-utilisateur",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/musique-utilisateur\/([^?#]+)/.exec(req.url ?? "");
        if (!m?.[1]) {
          next();
          return;
        }
        const f = decodeURIComponent(m[1]);
        if (f === "index.json") {
          res.setHeader("Content-Type", "application/json");
          res.end(userMusicIndex());
          return;
        }
        const data = readUserMusic(f);
        if (!data) {
          next();
          return;
        }
        res.setHeader("Content-Type", types[f.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream");
        res.end(data);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "musique-utilisateur/index.json", source: userMusicIndex() });
      for (const f of listUserMusic()) {
        const data = readUserMusic(f.fichier);
        if (data) this.emitFile({ type: "asset", fileName: `musique-utilisateur/${f.fichier}`, source: data });
      }
    },
  };
};

export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: "es2022", sourcemap: false },
  worker: { format: "es" },
  plugins: [galerie3d(), assets3d(), places3d(), musiqueUtilisateur()],
});
