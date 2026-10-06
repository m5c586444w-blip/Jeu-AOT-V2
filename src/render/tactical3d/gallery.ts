import { ACESFilmicToneMapping, PCFShadowMap, PerspectiveCamera, SRGBColorSpace, Scene, Vector3, WebGLRenderer } from "three";
import type { WebGLProbe } from "./entry";
import { backTo2d } from "./entry";
import { loadBodyKit, titanFactory } from "./bodies";
import type { BodyKit } from "./bodies";
import { buildEnvironmentMeshes } from "./envMesh";
import { generateEnvironment, supportedGenerators } from "./environment";
import { envTextures, fogScaleOf, undergroundOf } from "./envViewer";
import { createLighting } from "./lighting";
import type { LightPreset } from "./lighting";
import { PROFILES } from "./styles";
import { TX, fill } from "./texts";

/**
 * Galerie des environnements de R1b (`/proto3d/galerie`, ou `?proto3d=galerie`) : une carte par environnement du catalogue,
 * avec deux vignettes, jour et crépuscule (vue principale), rendues l'une après l'autre par un seul moteur hors écran. Chaque
 * carte ouvre la planche de contrôle de l'environnement.
 */
export interface GalleryProbe {
  ready: boolean;
  done: number;
  total: number;
  seconds: number;
}

declare global {
  interface Window {
    __galerie3d?: GalleryProbe;
  }
}

const W = 480;
const H = 270;

export async function startGallery(root: HTMLElement, probe: WebGLProbe): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const seedParam = Number(params.get("graine"));
  const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : 850;
  document.title = `Murs et Sang — ${TX.galleryTitle}`;
  const page = document.createElement("main");
  page.className = "p3d-galerie";
  const h1 = document.createElement("h1");
  h1.textContent = TX.galleryTitle;
  const intro = document.createElement("p");
  intro.textContent = TX.galleryIntro;
  const status = document.createElement("p");
  status.className = "p3d-mesure";
  const back = document.createElement("a");
  back.href = backTo2d(window.location.href);
  back.textContent = TX.back;
  page.append(h1, intro, status, back);
  root.replaceChildren(page);
  const supported = new Set(supportedGenerators());
  const jobs: { id: string; imgs: HTMLImageElement[] }[] = [];
  for (const lot of [1, 2] as const) {
    const h2 = document.createElement("h2");
    h2.textContent = fill(TX.galleryLot, { n: lot });
    const grid = document.createElement("div");
    grid.className = "p3d-galerie-grille";
    for (const p of PROFILES.filter((x) => x.lot === lot)) {
      const card = document.createElement("a");
      card.className = "p3d-carte";
      card.dataset["env"] = p.id;
      card.href = `${window.location.pathname}?proto3d&env=${p.id}&planche`;
      const h3 = document.createElement("h3");
      h3.textContent = fill(TX.envLabel, { id: p.id, nom: p.nom });
      const thumbs = document.createElement("div");
      thumbs.className = "p3d-vignettes";
      const imgs: HTMLImageElement[] = [];
      for (const l of ["jour", "crepuscule"] as const) {
        if (supported.has(p.generateur)) {
          const img = document.createElement("img");
          img.alt = `${p.nom} — ${l === "jour" ? TX.lightJour : TX.lightCrepuscule}`;
          img.width = W;
          img.height = H;
          thumbs.append(img);
          imgs.push(img);
        } else {
          const d = document.createElement("div");
          d.className = "p3d-vide";
          thumbs.append(d);
        }
      }
      const meta = document.createElement("p");
      meta.textContent = `${fill(TX.envCanon, { canon: p.canon, style: p.canon_style })} · ${p.lieu.position}${supported.has(p.generateur) ? "" : ` · ${TX.galleryMissing}`}`;
      card.append(h3, thumbs, meta);
      if (p.interprete) {
        const stamp = document.createElement("span");
        stamp.className = "p3d-tampon";
        stamp.textContent = TX.envInterprete;
        card.append(stamp);
      }
      grid.append(card);
      if (imgs.length > 0) jobs.push({ id: p.id, imgs });
    }
    page.append(h2, grid);
  }

  const state: GalleryProbe = { ready: false, done: 0, total: jobs.length, seconds: 0 };
  window.__galerie3d = state;
  const renderer = new WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, canvas: document.createElement("canvas") });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const camera = new PerspectiveCamera(55, W / H, 0.5, 9000);
  const t0 = performance.now();
  let bodyKit: BodyKit | null = null;
  for (const job of jobs) {
    status.textContent = fill(TX.galleryRendering, { i: state.done + 1, n: jobs.length });
    // Laisse le navigateur peindre la page entre deux environnements.
    await new Promise((r) => setTimeout(r, 0));
    const env = generateEnvironment(job.id, seed);
    const tex = envTextures(env, "bas");
    const kit = env.titans.length > 0 ? (bodyKit ??= await loadBodyKit(window.location.search)) : null;
    const meshes = buildEnvironmentMeshes(env, { quality: "bas", textures: tex, ...titanFactory(kit) });
    const scene = new Scene();
    scene.add(meshes.group);
    const v = env.views.principale;
    const lighting = createLighting(scene, seed, { windowMaterials: meshes.windowMaterials, lanternMaterial: meshes.lanternMaterial, lamps: meshes.lamps, center: new Vector3(...v.target), shadowExtent: Math.max(280, env.cave?.radius ?? 0), fogScale: fogScaleOf(env), underground: undergroundOf(env) });
    lighting.setShadow(true, 1024);
    lighting.useEnvironment(renderer);
    camera.fov = v.fov;
    camera.position.set(...v.eye);
    camera.lookAt(new Vector3(...v.target));
    camera.updateProjectionMatrix();
    lighting.follow(camera.position);
    (["jour", "crepuscule"] as LightPreset[]).forEach((l, i) => {
      lighting.apply(l);
      renderer.toneMappingExposure = lighting.exposure;
      renderer.render(scene, camera);
      const img = job.imgs[i];
      if (img) img.src = renderer.domElement.toDataURL("image/jpeg", 0.86);
    });
    lighting.dispose();
    meshes.dispose();
    for (const t of tex.all()) t.dispose();
    renderer.renderLists.dispose();
    state.done++;
  }
  state.seconds = (performance.now() - t0) / 1000;
  status.textContent = fill(TX.galleryDone, { n: state.done * 2, s: state.seconds.toFixed(0) });
  renderer.dispose();
  state.ready = true;
  document.documentElement.dataset["proto3d"] = "pret";
  void probe;
}
