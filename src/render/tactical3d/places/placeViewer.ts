import { ACESFilmicToneMapping, PCFShadowMap, PerspectiveCamera, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { WebGLProbe } from "../entry";
import { backTo2d } from "../entry";
import type { MeanColor } from "../envViewer";
import { rgbToLab } from "../styles";
import { LIGHT_PRESETS, createLighting } from "../lighting";
import type { LightPreset } from "../lighting";
import { applyLite, precompile } from "../lite";
import { applyPhotoTextures, loadPhotoTextures, photoCounts } from "../photoTextures";
import type { Matiere } from "../photoTextures";
import { createPost } from "../post";
import type { PostChain } from "../post";
import { QUALITIES, QUALITY, effectivePixelRatio } from "../quality";
import type { Quality } from "../quality";
import { fetchPlace, buildPlaceScene } from "./loadPlace";
import type { SceneView } from "./loadPlace";
import { placeExtras } from "./extras";

/**
 * Visionneuse des lieux N1 (R1e) : `?proto3d&lieu=shiganshina` ; `?proto3d&env=E01` charge aussi Shiganshina (la scène E01 de
 * R1b est remplacée par le lieu, consigne §2.3).
 * - `&etat=` : variante datée ; `&vue=` : point de vue nommé du lieu ou vue de porte (`porte-<id>-<vue>`) ; `&lumiere=`,
 *   `&qualite=`, `&oeil=x,y,z&cible=x,y,z` (vue libre, y = altitude), `&panneau=0`.
 * - Sonde `window.__place3d` : prêt, vues, empreinte de rendu, statistiques (appels, triangles, tronçons), couleur moyenne d'une
 *   vue rendue hors écran (pour ΔE), image suivante.
 */
/** Moyennes d'un tampon RGBA de `readPixels` (lignes de bas en haut) : image entière et grille gx × gy (du haut). */
export function labGrid(px: Uint8Array, w: number, h: number, gx: number, gy: number): MeanColor {
  const cells = Array.from({ length: gx * gy }, () => [0, 0, 0, 0]);
  const tot = [0, 0, 0];
  for (let y = 0; y < h; y++) {
    const row = gy - 1 - Math.min(gy - 1, Math.floor((y / h) * gy));
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const c = cells[row * gx + Math.min(gx - 1, Math.floor((x / w) * gx))] as number[];
      for (let k = 0; k < 3; k++) {
        const v = px[i + k] as number;
        tot[k] = (tot[k] as number) + v;
        c[k] = (c[k] as number) + v;
      }
      c[3] = (c[3] as number) + 1;
    }
  }
  const n = w * h;
  const rgb = tot.map((v) => v / n) as [number, number, number];
  return { rgb, lab: rgbToLab(...rgb), grid: cells.map((c) => rgbToLab((c[0] as number) / (c[3] as number), (c[1] as number) / (c[3] as number), (c[2] as number) / (c[3] as number))) };
}

export const ENV_TO_PLACE: Record<string, string> = { E01: "shiganshina" };

export interface PlaceProbe {
  ready: boolean;
  id: string;
  state: string;
  view: string;
  views: string[];
  hash: string;
  counts: Record<string, number>;
  timings: { fetch: number; build: number; pret: number; photos: number };
  photos: Partial<Record<Matiere, number>>;
  setView(v: string): void;
  setLight(l: LightPreset): void;
  stats(): { calls: number; triangles: number; instances: number; chunks: { total: number; visible: number; near: number } };
  /** Couleur moyenne d'une vue rendue hors écran (w × h), grille CIELAB de gx × gy cases (ligne par ligne, du haut). */
  meanColor(view: string, w: number, h: number, gx: number, gy: number): MeanColor;
  frame(): Promise<void>;
}

declare global {
  interface Window {
    __place3d?: PlaceProbe;
  }
}

export async function startPlaceViewer(root: HTMLElement, probe: WebGLProbe): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const envId = (params.get("env") ?? "").toUpperCase();
  const id = params.get("lieu") ?? ENV_TO_PLACE[envId] ?? "shiganshina";
  const seedParam = Number(params.get("graine"));
  const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : 845;
  const quality: Quality = QUALITIES.find((q) => q === params.get("qualite")) ?? "moyen";
  let light: LightPreset = LIGHT_PRESETS.find((p) => p === params.get("lumiere")) ?? "jour";
  const html = document.documentElement;
  html.dataset["lieu"] = id;

  const t0 = performance.now();
  const { place, walls } = await fetchPlace(id);
  const t1 = performance.now();
  const stateId = params.get("etat") ?? place.etat_defaut;
  const scene3 = buildPlaceScene(place, walls, { seed, state: stateId, custom: (s) => placeExtras(s, stateId) });
  const t2 = performance.now();
  html.dataset["etat"] = scene3.layout.state.id;

  const host = document.createElement("div");
  host.className = "p3d";
  root.replaceChildren(host);
  const renderer = new WebGLRenderer({ antialias: QUALITY[quality].antialias, powerPreference: "high-performance" });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.domElement.dataset["moteur"] = "three";
  host.append(renderer.domElement);
  const scene = new Scene();
  scene.add(scene3.group);
  const camera = new PerspectiveCamera(55, 16 / 9, 0.5, 12000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  const views = scene3.views;
  const viewIds = Object.keys(views);
  const firstView = views[viewIds[0] ?? ""] as SceneView;
  const sky = scene3.layout.state.ciel;
  const lighting = createLighting(scene, seed, { windowMaterials: scene3.windowMaterials, lanternMaterial: scene3.lanternMaterial, lamps: scene3.lamps, center: new Vector3(...firstView.target), shadowExtent: 420, fogScale: sky === "enfume" ? 2.6 : sky === "brumeux" ? 1.8 : 0.7 });
  lighting.setLite(quality === "bas");
  lighting.useEnvironment(renderer);
  if (sky === "enfume") lighting.setSunFactor(0.6);
  const post: PostChain | null = createPost(scene, camera, quality);
  renderer.setPixelRatio(effectivePixelRatio(quality, window.devicePixelRatio));
  renderer.shadowMap.enabled = QUALITY[quality].shadows;
  lighting.setShadow(QUALITY[quality].shadows, QUALITY[quality].shadowMap);
  lighting.setLampLimit(QUALITY[quality].lamps);
  applyLite(scene, quality === "bas");
  html.dataset["qualite"] = quality;

  const triple = (k: string): [number, number, number] | null => {
    const v = (params.get(k) ?? "").split(",").map(Number);
    return v.length === 3 && v.every((x) => Number.isFinite(x)) ? [v[0] as number, v[1] as number, v[2] as number] : null;
  };
  const freeEye = triple("oeil");
  const freeTarget = triple("cible");
  let view = params.get("vue") ?? viewIds[0] ?? "";
  const setCam = (cam: PerspectiveCamera, v: SceneView, aspect: number): void => {
    cam.fov = v.fov;
    cam.aspect = aspect;
    cam.position.set(...v.eye);
    cam.lookAt(new Vector3(...v.target));
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  };
  const viewDef = (v: string): SceneView => (v === "libre" && freeEye && freeTarget ? { eye: freeEye, target: freeTarget, fov: 55 } : (views[v] ?? firstView));
  const setView = (v: string): void => {
    view = v;
    const d = viewDef(v);
    setCam(camera, d, camera.aspect || 16 / 9);
    controls.target.set(...d.target);
    lighting.setCenter(new Vector3(...d.target));
    controls.update();
    html.dataset["vue"] = v;
  };

  // Panneau : nom, statut, état, vues.
  const panel = document.createElement("aside");
  panel.className = "p3d-panneau";
  const h1 = document.createElement("h1");
  h1.textContent = place.libelle;
  const sub = document.createElement("p");
  sub.className = "p3d-sous-titre";
  sub.textContent = `canon : ${place.canon} · ${scene3.layout.state.nom} (${scene3.layout.state.date})`;
  panel.append(h1, sub);
  const urlWith = (k: string, v: string | null): string => {
    const u = new URL(window.location.href);
    if (v === null) u.searchParams.delete(k);
    else u.searchParams.set(k, v);
    return u.toString();
  };
  const row = (label: string, items: [string, string][]): void => {
    const p = document.createElement("p");
    p.className = "p3d-liens";
    const b = document.createElement("strong");
    b.textContent = `${label} : `;
    p.append(b);
    for (const [text, href] of items) {
      const a = document.createElement("a");
      a.href = href;
      a.textContent = text;
      p.append(a, " ");
    }
    panel.append(p);
  };
  row("États", place.etats.map((s) => [s.id, urlWith("etat", s.id)] as [string, string]));
  row("Vues", place.points_de_vue.map((v) => [v.nom, urlWith("vue", v.id)] as [string, string]));
  row("Lumière", LIGHT_PRESETS.map((l) => [l, urlWith("lumiere", l)] as [string, string]));
  row("Qualité", QUALITIES.map((q) => [q, urlWith("qualite", q)] as [string, string]));
  const measure = document.createElement("p");
  measure.className = "p3d-mesure";
  const back = document.createElement("a");
  back.href = backTo2d(window.location.href);
  back.textContent = "Retour au jeu (2D)";
  panel.append(measure, back);
  host.append(panel);
  if (params.get("panneau") === "0") panel.hidden = true;

  const resize = (): void => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();

  let photoPending = false;
  const draw = (): void => {
    controls.update();
    camera.updateMatrixWorld();
    scene3.update(camera);
    lighting.follow(camera.position);
    renderer.toneMappingExposure = lighting.exposure;
    const size = renderer.getSize(new Vector2());
    const pr = renderer.getPixelRatio();
    if (post) post.render(renderer, size.x * pr, size.y * pr);
    else renderer.render(scene, camera);
    if (photoPending) {
      photoPending = false;
      state.timings.photos = performance.now();
      html.dataset["photo3d"] = "pret";
    }
  };

  let off: WebGLRenderer | null = null;
  const offCam = new PerspectiveCamera(55, 16 / 9, 0.5, 12000);
  const meanColor = (v: string, w: number, h: number, gx: number, gy: number): MeanColor => {
    if (!off) {
      off = new WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, canvas: document.createElement("canvas") });
      off.outputColorSpace = SRGBColorSpace;
      off.toneMapping = ACESFilmicToneMapping;
      off.shadowMap.enabled = false;
    }
    off.setPixelRatio(1);
    off.setSize(w, h, false);
    const d = viewDef(v);
    setCam(offCam, d, w / h);
    scene3.update(offCam, true);
    lighting.setCenter(new Vector3(...d.target));
    lighting.follow(offCam.position);
    off.toneMappingExposure = lighting.exposure;
    lighting.useEnvironment(off);
    off.render(scene, offCam);
    const gl = off.getContext();
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    lighting.useEnvironment(renderer);
    setView(view);
    scene3.update(camera, true);
    return labGrid(px, w, h, gx, gy);
  };

  const state: PlaceProbe = {
    ready: false,
    id,
    state: scene3.layout.state.id,
    view,
    views: viewIds,
    hash: scene3.hash,
    counts: scene3.counts,
    timings: { fetch: t1 - t0, build: t2 - t1, pret: 0, photos: 0 },
    photos: {},
    setView(v) {
      setView(v);
      state.view = v;
    },
    setLight(l) {
      light = l;
      lighting.apply(l);
      html.dataset["lumiere"] = l;
    },
    stats() {
      const ri = post?.sceneInfo ?? renderer.info.render;
      let instances = 0;
      scene.traverse((o) => {
        if ((o as { isInstancedMesh?: boolean }).isInstancedMesh) instances += (o as unknown as { count: number }).count;
      });
      return { calls: ri.calls, triangles: ri.triangles, instances, chunks: scene3.chunkStats() };
    },
    meanColor,
    frame: () =>
      new Promise((resolve) => {
        draw();
        requestAnimationFrame(() => resolve());
      }),
  };
  window.__place3d = state;
  state.setLight(light);
  setView(view);

  let frames = 0;
  let since = performance.now();
  const loop = (now: number): void => {
    draw();
    frames++;
    if (now - since >= 1000) {
      const ri = post?.sceneInfo ?? renderer.info.render;
      measure.textContent = `${((frames * 1000) / (now - since)).toFixed(1)} img/s · ${ri.calls} appels · ${Math.round(ri.triangles / 1000)} k triangles · ${scene3.chunkStats().visible}/${scene3.chunkStats().total} tronçons`;
      frames = 0;
      since = now;
    }
    requestAnimationFrame(loop);
  };
  const startPhotos = async (): Promise<void> => {
    if (params.get("textures") === "procedurales") {
      html.dataset["photo3d"] = "procedurales";
      return;
    }
    try {
      const photos = await loadPhotoTextures();
      applyPhotoTextures(scene, photos, quality === "bas");
      state.photos = photoCounts(scene);
      await precompile(renderer, scene, camera);
      photoPending = true;
    } catch {
      state.timings.photos = -1;
      html.dataset["photo3d"] = "repli";
    }
  };
  requestAnimationFrame((now) => {
    loop(now);
    state.timings.pret = performance.now();
    state.ready = true;
    html.dataset["proto3d"] = "pret";
    requestAnimationFrame(() => setTimeout(() => void startPhotos(), 0));
  });
  void probe;
}
