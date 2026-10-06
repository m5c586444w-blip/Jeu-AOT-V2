import "./proto3d.css";
import { TX, fill } from "./texts";

/**
 * Entrée de l'essai 3D (R1), chargée à la demande par `src/main.ts`. Elle n'importe pas three.js : elle vérifie d'abord
 * que WebGL 2 existe (three.js l'exige), puis charge le prototype par import dynamique. Sans WebGL, three.js n'est jamais
 * téléchargé : message clair et retour au rendu 2D.
 */
export interface WebGLProbe {
  ok: boolean;
  version: 0 | 1 | 2;
  renderer: string;
  detail: string;
}

export function probeWebGL(doc: Document): WebGLProbe {
  const canvas = doc.createElement("canvas");
  let gl2: WebGL2RenderingContext | null = null;
  let detail = "";
  try {
    gl2 = canvas.getContext("webgl2");
  } catch (e) {
    detail = String(e);
  }
  if (!gl2) {
    let v1 = false;
    try {
      v1 = canvas.getContext("webgl") !== null;
    } catch (e) {
      detail = String(e);
    }
    return { ok: false, version: v1 ? 1 : 0, renderer: "", detail: detail || (v1 ? "WebGL 1 seulement" : "aucun contexte WebGL") };
  }
  const ext = gl2.getExtension("WEBGL_debug_renderer_info");
  const renderer = String(gl2.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl2.RENDERER));
  gl2.getExtension("WEBGL_lose_context")?.loseContext();
  return { ok: true, version: 2, renderer, detail };
}

/** Adresse du jeu en rendu 2D : la même page, sans `proto3d`. */
export function backTo2d(href: string): string {
  const u = new URL(href);
  u.searchParams.delete("proto3d");
  if (u.pathname.endsWith("/proto3d")) u.pathname = u.pathname.slice(0, -"proto3d".length);
  return u.toString();
}

const AUTO_BACK_S = 12;

function showFallback(root: HTMLElement, detail: string): void {
  document.documentElement.dataset["proto3d"] = "sans-webgl";
  const sheet = document.createElement("main");
  sheet.className = "p3d-repli";
  sheet.setAttribute("role", "alert");
  const h = document.createElement("h1");
  h.textContent = TX.noWebglTitle;
  const p = document.createElement("p");
  p.textContent = TX.noWebglBody;
  const d = document.createElement("p");
  d.className = "p3d-repli__detail";
  d.textContent = fill(TX.noWebglDetail, { detail });
  const a = document.createElement("a");
  a.className = "p3d-bouton";
  a.href = backTo2d(window.location.href);
  a.textContent = TX.noWebglBack;
  a.dataset["action"] = "retour-2d";
  const auto = document.createElement("p");
  auto.className = "p3d-repli__auto";
  let left = AUTO_BACK_S;
  auto.textContent = fill(TX.noWebglAuto, { s: left });
  sheet.append(h, p, a, auto, d);
  root.replaceChildren(sheet);
  a.focus();
  const timer = window.setInterval(() => {
    left -= 1;
    auto.textContent = fill(TX.noWebglAuto, { s: left });
    if (left <= 0) {
      window.clearInterval(timer);
      window.location.href = a.href;
    }
  }, 1000);
}

export async function openProto3d(root: HTMLElement): Promise<void> {
  document.title = TX.pageTitle;
  document.documentElement.dataset["proto3d"] = "chargement";
  const probe = probeWebGL(document);
  document.documentElement.dataset["webgl"] = probe.ok ? "webgl2" : probe.version === 1 ? "webgl1" : "absent";
  // Option de contrôle : `?proto3d&sanswebgl` force le repli, pour le vérifier sur une machine qui a WebGL.
  const forced = new URLSearchParams(window.location.search).has("sanswebgl");
  if (!probe.ok || forced) {
    showFallback(root, forced ? "repli forcé (?sanswebgl)" : probe.detail);
    return;
  }
  const loading = document.createElement("p");
  loading.className = "p3d-chargement";
  loading.textContent = TX.loading;
  root.replaceChildren(loading);
  try {
    // R1b : galerie des environnements (`?proto3d=galerie`, ou `/proto3d/galerie` par la page de redirection), visionneuse
    // d'un environnement (`?proto3d&env=E13`) ; sinon, la scène de combat de R1.
    const q = new URLSearchParams(window.location.search);
    if (q.get("proto3d") === "humain") {
      // R1c : page de contrôle du corps de base (MakeHuman, CC0).
      const m = await import("./humanViewer");
      await m.startHumanViewer(root, probe);
    } else if (q.get("proto3d") === "galerie" || q.has("galerie")) {
      const m = await import("./gallery");
      await m.startGallery(root, probe);
    } else if (q.get("env") === "banc") {
      const m = await import("./bench");
      await m.startBench(root, probe);
    } else if (q.has("env")) {
      const m = await import("./envViewer");
      await m.startEnvViewer(root, probe);
    } else {
      const m = await import("./proto");
      await m.startProto(root, probe);
    }
  } catch (e) {
    showFallback(root, `${TX.startError} ${String(e)}`);
  }
}
