import { ACESFilmicToneMapping, PCFShadowMap, PerspectiveCamera, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import type { Texture } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { RoofMaterial, WallMaterial } from "../../data/artSchemas";
import type { WebGLProbe } from "./entry";
import { backTo2d } from "./entry";
import type { EnvData, View } from "./envTypes";
import { buildEnvironmentMeshes } from "./envMesh";
import type { EnvScene, EnvTextures } from "./envMesh";
import { generateEnvironment } from "./environment";
import { LIGHT_PRESETS, createLighting } from "./lighting";
import type { LightPreset, LightRig } from "./lighting";
import { QUALITIES, QUALITY, effectivePixelRatio } from "./quality";
import type { Quality } from "./quality";
import { rgbToLab } from "./styles";
import { TX, fill } from "./texts";
import { cobbleTex, facadeSet, groundTex, mistTex, roofTex, wallStoneTex } from "./texturesEnv";
import { puffTexture, skinTexture } from "./textures";

/**
 * Visionneuse des environnements de R1b : `?proto3d&env=E13` (variante `&variante=hiver`, graine `&graine=850`).
 * - `&lumiere=` : jour, aube, crépuscule, nuit ; `&vue=` : principale, seconde, libre ; `&qualite=` : bas, moyen, haut.
 * - `&planche` : planche de contrôle 2 × 2 (vue principale et vue seconde, de jour et au crépuscule).
 * - Sonde `window.__env3d` : mesures, rendus hors écran (couleur moyenne), contrôle des captures.
 */
export type ViewName = "principale" | "seconde" | "libre";

export interface MeanColor {
  /** Moyenne sRGB (0–255) et CIELAB de l'image, puis CIELAB de chaque case d'une grille g × g (ligne par ligne). */
  rgb: [number, number, number];
  lab: [number, number, number];
  grid: [number, number, number][];
}

export interface EnvProbe {
  ready: boolean;
  env: string;
  variant: string | null;
  light: LightPreset;
  view: ViewName;
  quality: Quality;
  timings: { generate: number; textures: number; build: number };
  counts: Record<string, number>;
  setLight(p: LightPreset): void;
  setView(v: ViewName): void;
  setQuality(q: Quality): void;
  stats(): { calls: number; triangles: number; geometries: number; textures: number; width: number; height: number; pixelRatio: number; instances: number; lods: number };
  meanColor(view: Exclude<ViewName, "libre">, light: LightPreset, w: number, h: number, grid: number): MeanColor;
  hold(h: boolean): void;
  frame(): Promise<void>;
}

declare global {
  interface Window {
    __env3d?: EnvProbe;
  }
}

/** Textures d'un environnement, dessinées à la demande puis gardées. */
export function envTextures(env: EnvData, q: Quality): EnvTextures & { all(): Texture[] } {
  const facades = new Map<WallMaterial, ReturnType<typeof facadeSet>>();
  const roofs = new Map<RoofMaterial, Texture>();
  let ground: Texture | null | undefined;
  let cobble: Texture | null = null;
  let stone: Texture | null = null;
  let mist: Texture | null = null;
  let skin: Texture | null = null;
  let puff: Texture | null = null;
  return {
    facade(m) {
      let f = facades.get(m);
      if (!f) {
        f = facadeSet(env.seed, m, env.profile);
        facades.set(m, f);
      }
      return f;
    },
    roof(c) {
      let t = roofs.get(c);
      if (!t) {
        t = roofTex(env.seed, c);
        roofs.set(c, t);
      }
      return t;
    },
    ground() {
      if (ground === undefined) ground = groundTex(env, QUALITY[q].groundTex);
      return ground;
    },
    cobble() {
      cobble ??= cobbleTex(env.seed);
      return cobble;
    },
    wallStone() {
      stone ??= wallStoneTex(env.seed);
      return stone;
    },
    mist() {
      mist ??= mistTex(env.seed);
      return mist;
    },
    skin() {
      skin ??= skinTexture(env.seed);
      return skin;
    },
    puff() {
      puff ??= puffTexture();
      return puff;
    },
    all() {
      return [...[...facades.values()].flatMap((f) => [f.upper, f.upperLit, f.ground, f.groundLit, f.plain]), ...roofs.values(), ...(ground ? [ground] : []), ...(cobble ? [cobble] : []), ...(stone ? [stone] : []), ...(mist ? [mist] : []), ...(skin ? [skin] : []), ...(puff ? [puff] : [])];
    },
  };
}

/** Densité de brume d'une scène : éclaircie pour les grands terrains, épaissie par la brume au sol (forêt, marais). */
export function fogScaleOf(env: EnvData): number {
  return (env.terrain ? 0.5 : 1) * (1 + 3 * env.mist.density);
}

function setCam(camera: PerspectiveCamera, v: View, aspect: number): void {
  camera.fov = v.fov;
  camera.aspect = aspect;
  camera.position.set(...v.eye);
  camera.lookAt(new Vector3(...v.target));
  camera.updateProjectionMatrix();
}

/** Teintes moyennes d'un tampon RGBA lu par `readPixels` (lignes de bas en haut). */
export function pixelStats(px: Uint8Array, w: number, h: number, g: number): MeanColor {
  const cells = Array.from({ length: g * g }, () => [0, 0, 0, 0]);
  const tot = [0, 0, 0];
  for (let y = 0; y < h; y++) {
    const row = g - 1 - Math.min(g - 1, Math.floor((y / h) * g));
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const c = cells[row * g + Math.min(g - 1, Math.floor((x / w) * g))] as number[];
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

export async function startEnvViewer(root: HTMLElement, probe: WebGLProbe): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const id = (params.get("env") ?? "E13").toUpperCase();
  const variantId = params.get("variante");
  const seedParam = Number(params.get("graine"));
  const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : 850;
  let quality: Quality = QUALITIES.find((q) => q === params.get("qualite")) ?? "moyen";
  let light: LightPreset = LIGHT_PRESETS.find((p) => p === params.get("lumiere")) ?? "jour";
  let view: ViewName = (["principale", "seconde", "libre"] as const).find((v) => v === params.get("vue")) ?? "principale";
  const sheet = params.has("planche");
  const html = document.documentElement;
  html.dataset["env"] = id;

  const t0 = performance.now();
  const env = generateEnvironment(id, seed, variantId);
  const t1 = performance.now();
  const tex = envTextures(env, quality);
  // Dessin des textures avant l'assemblage, pour mesurer son coût à part.
  tex.ground();
  const t2 = performance.now();
  const meshes: EnvScene = buildEnvironmentMeshes(env, { quality, textures: tex });
  const t3 = performance.now();

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
  scene.add(meshes.group);
  const camera = new PerspectiveCamera(55, 1, 0.5, 9000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  const target0 = new Vector3(...env.views.principale.target);
  const lighting: LightRig = createLighting(scene, seed, { windowMaterials: meshes.windowMaterials, lanternMaterial: meshes.lanternMaterial, lamps: meshes.lamps, center: target0.clone(), shadowExtent: 280, fogScale: fogScaleOf(env) });

  const applyQuality = (q: Quality): void => {
    quality = q;
    const d = QUALITY[q];
    renderer.setPixelRatio(effectivePixelRatio(q, window.devicePixelRatio));
    renderer.shadowMap.enabled = d.shadows;
    lighting.setShadow(d.shadows, d.shadowMap);
    lighting.setLampLimit(d.lamps);
    for (const lod of meshes.vegetation?.lods ?? []) {
      const levels = lod.levels;
      if (levels[1]) levels[1].distance = d.lodNear;
      if (levels[2]) levels[2].distance = d.lodFar;
    }
    html.dataset["qualite"] = q;
    resize();
  };
  const setView = (v: ViewName): void => {
    view = v;
    if (v !== "libre") {
      const vv = env.views[v];
      setCam(camera, vv, camera.aspect || 16 / 9);
      controls.target.set(...vv.target);
      lighting.setCenter(new Vector3(...vv.target));
    }
    controls.update();
    html.dataset["vue"] = v;
  };
  const setLight = (p: LightPreset): void => {
    light = p;
    lighting.apply(p);
    html.dataset["lumiere"] = p;
  };

  // Panneau.
  const panel = document.createElement("aside");
  panel.className = "p3d-panneau";
  const h1 = document.createElement("h1");
  h1.textContent = fill(TX.envLabel, { id: env.id, nom: env.profile.nom });
  const sub = document.createElement("p");
  sub.className = "p3d-sous-titre";
  sub.textContent = `${fill(TX.envCanon, { canon: env.profile.canon, style: env.profile.canon_style })}${env.profile.interprete ? ` · ${TX.envInterprete}` : ""}${env.variant ? ` · ${env.variant.nom}` : ""}`;
  panel.append(h1, sub);
  const linkRow = (label: string, items: [string, string][]): void => {
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
  const urlWith = (k: string, v: string | null): string => {
    const u = new URL(window.location.href);
    if (v === null) u.searchParams.delete(k);
    else u.searchParams.set(k, v);
    return u.toString();
  };
  linkRow(TX.envVariant, [[TX.envDefault, urlWith("variante", null)], ...env.profile.variantes.map((v) => [v.id, urlWith("variante", v.id)] as [string, string])]);
  linkRow(TX.light, LIGHT_PRESETS.map((l) => [l, urlWith("lumiere", l)] as [string, string]));
  linkRow(TX.envView, (["principale", "seconde", "libre"] as const).map((v) => [v, urlWith("vue", v)] as [string, string]));
  linkRow(TX.quality, QUALITIES.map((q) => [q, urlWith("qualite", q)] as [string, string]));
  const measure = document.createElement("p");
  measure.className = "p3d-mesure";
  const back = document.createElement("a");
  back.href = backTo2d(window.location.href);
  back.textContent = TX.back;
  const gal = document.createElement("a");
  gal.href = `${window.location.pathname}?proto3d=galerie`;
  gal.textContent = TX.galleryTitle;
  const links = document.createElement("p");
  links.className = "p3d-liens";
  links.append(back, " · ", gal);
  panel.append(measure, links);
  host.append(panel);
  if (params.get("panneau") === "0" || sheet) panel.hidden = true;

  // Étiquettes de la planche.
  const labels: HTMLElement[] = [];
  const QUADS: { view: "principale" | "seconde"; light: LightPreset; x: number; y: number }[] = [
    { view: "principale", light: "jour", x: 0, y: 0 },
    { view: "principale", light: "crepuscule", x: 1, y: 0 },
    { view: "seconde", light: "jour", x: 0, y: 1 },
    { view: "seconde", light: "crepuscule", x: 1, y: 1 },
  ];
  if (sheet) {
    const title = document.createElement("div");
    title.className = "p3d-planche-titre";
    title.textContent = `${fill(TX.envLabel, { id: env.id, nom: env.profile.nom })} — ${fill(TX.envCanon, { canon: env.profile.canon, style: env.profile.canon_style })}${env.profile.interprete ? ` — ${TX.envInterprete}` : ""}${env.variant ? ` — ${env.variant.nom}` : ""} — graine ${seed}`;
    host.append(title);
    for (const qd of QUADS) {
      const l = document.createElement("div");
      l.className = "p3d-planche-etiquette";
      l.style.left = `${qd.x * 50}%`;
      l.style.top = `${qd.y * 50}%`;
      const lightName = qd.light === "jour" ? TX.lightJour : TX.lightCrepuscule;
      l.textContent = fill(TX.panelLight, { light: lightName, view: qd.view });
      host.append(l);
      labels.push(l);
    }
  }

  const resize = (): void => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = sheet ? w / h : w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);

  let held = false;
  let frames = 0;
  const draw = (): void => {
    const size = renderer.getSize(new Vector2());
    if (sheet) {
      renderer.setScissorTest(true);
      const w = Math.floor(size.x / 2);
      const h = Math.floor(size.y / 2);
      for (const qd of QUADS) {
        const x = qd.x * w;
        const y = (1 - qd.y) * h;
        renderer.setViewport(x, y, w, h);
        renderer.setScissor(x, y, w, h);
        lighting.apply(qd.light);
        const v = env.views[qd.view];
        setCam(camera, v, w / h);
        lighting.setCenter(new Vector3(...v.target));
        lighting.follow(camera.position);
        renderer.toneMappingExposure = lighting.exposure;
        renderer.render(scene, camera);
      }
      renderer.setScissorTest(false);
    } else {
      controls.update();
      lighting.follow(camera.position);
      renderer.toneMappingExposure = lighting.exposure;
      renderer.render(scene, camera);
    }
    frames++;
  };

  // Rendu hors écran : un second moteur sur un canvas détaché, mêmes réglages de sortie (tonalité, sRGB).
  let off: WebGLRenderer | null = null;
  const offCam = new PerspectiveCamera(55, 16 / 9, 0.5, 9000);
  const meanColor = (v: "principale" | "seconde", l: LightPreset, w: number, h: number, g: number): MeanColor => {
    if (!off) {
      off = new WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, canvas: document.createElement("canvas") });
      off.outputColorSpace = SRGBColorSpace;
      off.toneMapping = ACESFilmicToneMapping;
      off.shadowMap.enabled = false;
    }
    off.setPixelRatio(1);
    off.setSize(w, h, false);
    const before = light;
    lighting.apply(l);
    const vv = env.views[v];
    setCam(offCam, vv, w / h);
    lighting.setCenter(new Vector3(...vv.target));
    lighting.follow(offCam.position);
    off.toneMappingExposure = lighting.exposure;
    off.render(scene, offCam);
    const gl = off.getContext();
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    lighting.apply(before);
    setView(view);
    return pixelStats(px, w, h, g);
  };

  const state: EnvProbe = {
    ready: false,
    env: id,
    variant: variantId,
    light,
    view,
    quality,
    timings: { generate: t1 - t0, textures: t2 - t1, build: t3 - t2 },
    counts: meshes.counts,
    setLight(p) {
      setLight(p);
      state.light = p;
    },
    setView(v) {
      setView(v);
      state.view = v;
    },
    setQuality(q) {
      applyQuality(q);
      state.quality = q;
    },
    stats() {
      const size = renderer.getDrawingBufferSize(new Vector2());
      let instances = 0;
      let lods = 0;
      scene.traverse((o) => {
        if ((o as { isInstancedMesh?: boolean }).isInstancedMesh) instances += (o as unknown as { count: number }).count;
        if ((o as { isLOD?: boolean }).isLOD) lods++;
      });
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, width: size.x, height: size.y, pixelRatio: renderer.getPixelRatio(), instances, lods };
    },
    meanColor,
    hold(h) {
      held = h;
    },
    frame: () =>
      new Promise((resolve) => {
        draw();
        requestAnimationFrame(() => resolve());
      }),
  };
  window.__env3d = state;
  applyQuality(quality);
  setLight(light);
  setView(view);
  if (view === "libre") {
    camera.position.set(...env.views.principale.eye);
    controls.target.set(...env.views.principale.target);
  }

  let fpsFrames = 0;
  let since = performance.now();
  const loop = (now: number): void => {
    if (!held) draw();
    fpsFrames++;
    if (now - since >= 1000) {
      const fps = (fpsFrames * 1000) / (now - since);
      fpsFrames = 0;
      since = now;
      const s = renderer.info.render;
      measure.textContent = fill(TX.stats, { fps: fps.toFixed(1), calls: s.calls, tris: Math.round(s.triangles / 1000) });
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame((now) => {
    loop(now);
    state.ready = true;
    html.dataset["proto3d"] = "pret";
  });
  void frames;
  void probe;
}
