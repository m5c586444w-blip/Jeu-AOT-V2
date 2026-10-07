import { ACESFilmicToneMapping, Color, PCFShadowMap, PerspectiveCamera, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import type { Texture } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { RoofMaterial, WallMaterial } from "../../data/artSchemas";
import type { WebGLProbe } from "./entry";
import { backTo2d } from "./entry";
import type { EnvData, View } from "./envTypes";
import { loadBodyKit, titanFactory } from "./bodies";
import { buildEnvironmentMeshes, makeEnvTitan } from "./envMesh";
import type { Titan } from "./titan";
import { applyLite, precompile } from "./lite";
import { createPost } from "./post";
import type { PostChain } from "./post";
import type { EnvScene, EnvTextures } from "./envMesh";
import { generateEnvironment } from "./environment";
import { LIGHT_PRESETS, createLighting } from "./lighting";
import type { LightPreset, LightRig, UndergroundLight } from "./lighting";
import { QUALITIES, QUALITY, effectivePixelRatio } from "./quality";
import type { Quality } from "./quality";
import { MATERIALS, rgbToLab } from "./styles";
import { TX, fill } from "./texts";
import { cobbleTex, facadeSet, groundDetailTex, groundTex, leafTex, mistTex, roofTex, waterNormalTex, wallStoneTex } from "./texturesEnv";
import { WEATHERS, createFires, createWeather } from "./weather";
import type { WeatherKind } from "./weather";
import { puffTexture, skinTexture } from "./textures";
import { applyPhotoTextures, loadPhotoTextures, photoCounts } from "./photoTextures";
import { parementTextures } from "./parement";
import type { ParementTextures } from "./parement";
import type { Matiere } from "./photoTextures";

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
  /**
   * Temps (ms) : génération, textures, assemblage ; `pret` : première image depuis la navigation (Titans en repères).
   * R1d, second temps (scènes avec Titans) : `bodies` (corps de base chargé et Titans détaillés façonnés), `corps` : première image
   * avec les Titans détaillés, depuis la navigation (0 sans Titans ou tant qu'ils ne sont pas là, −1 en repli).
   * Textures de Poly Haven : `photos`, instant de la première image qui les montre (−1 en repli).
   */
  timings: { generate: number; bodies: number; textures: number; build: number; pret: number; corps: number; photos: number };
  /** R1d : matériaux passés aux textures de Poly Haven, par matière. */
  photos: Partial<Record<Matiere, number>>;
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
  let par: ParementTextures | null = null;
  let mist: Texture | null = null;
  let skin: Texture | null = null;
  let puff: Texture | null = null;
  let leaves: Texture | null = null;
  let detail: { albedo: Texture; normal: Texture } | null = null;
  let ripples: Texture | null = null;
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
        t = roofTex(env.seed, c, env.profile.atmosphere?.suie ?? 0);
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
    parement() {
      par ??= parementTextures(env.seed);
      return par;
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
    leaves() {
      leaves ??= leafTex(env.seed);
      return leaves;
    },
    groundDetail() {
      detail ??= groundDetailTex(env.seed);
      return detail;
    },
    waterNormal() {
      ripples ??= waterNormalTex(env.seed);
      return ripples;
    },
    all() {
      return [...[...facades.values()].flatMap((f) => [f.upper, f.upperLit, f.ground, f.groundLit, f.plain]), ...roofs.values(), ...(ground ? [ground] : []), ...(cobble ? [cobble] : []), ...(stone ? [stone] : []), ...(par ? [par.A, par.B, par.C] : []), ...(mist ? [mist] : []), ...(skin ? [skin] : []), ...(puff ? [puff] : []), ...(leaves ? [leaves] : []), ...(detail ? [detail.albedo, detail.normal] : []), ...(ripples ? [ripples] : [])];
    },
  };
}

/** Densité de brume d'une scène : éclaircie pour les grands terrains, épaissie par la brume au sol (forêt, marais). */
export function fogScaleOf(env: EnvData): number {
  // R1e (§6, point 6) : sous les Arbres Géants, brouillard plus mince (la brume au sol reste dessinée par ses nappes).
  return (env.terrain ? 0.5 : 1) * (1 + 3 * env.mist.density) * (env.giants.length > 0 ? 0.55 : 1);
}

/** Éclairage souterrain d'une scène sous voûte (null à l'air libre) : ambiance du profil, glace en teinte de cristal. */
export function undergroundOf(env: EnvData): UndergroundLight | null {
  if (!env.cave) return null;
  const p = env.profile.palette;
  // Ville souterraine : lanternes partout, l'ambiance mêle la lumière des lanternes à la teinte chaude du lieu ; glace : cristal ;
  // crypte : la teinte des bougies seule.
  const ambient = env.cave.kind === "glace" ? MATERIALS.physiques.cristal : env.cave.kind === "ville" ? `#${new Color(MATERIALS.physiques.lumiere).lerp(new Color(p.toit_2), 0.5).getHexString()}` : p.toit_2;
  return { ambient, ground: env.cave.kind === "ville" ? p.facade : p.sol, fog: p.toit, openings: env.cave.openings.length > 0 };
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
  const cycleSheet = params.get("planche") === "cycle";
  const weatherKind: WeatherKind = WEATHERS.find((w) => w === params.get("meteo")) ?? "aucune";
  let time = Number(params.get("t") ?? "0") || 0;
  const paused = params.has("pause");
  const html = document.documentElement;
  html.dataset["env"] = id;

  const t0 = performance.now();
  const env = generateEnvironment(id, seed, variantId);
  const t1 = performance.now();
  // R1d : la première image montre les Titans en repères (figures de R1) ; le corps de base est chargé ensuite.
  const tk = performance.now();
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
  const lighting: LightRig = createLighting(scene, seed, { windowMaterials: meshes.windowMaterials, lanternMaterial: meshes.lanternMaterial, lamps: meshes.lamps, center: target0.clone(), shadowExtent: Math.max(280, env.cave?.radius ?? 0), fogScale: fogScaleOf(env), underground: undergroundOf(env), smoke: env.cave ? 0 : (env.profile.atmosphere?.fumee ?? 0), fill: env.giants.length > 0 ? 2.1 : 1, exposureScale: env.giants.length > 0 ? 1.3 : 1 });

  // Qualité basse allégée (R1d) : réglée avant la première carte d'environnement.
  lighting.setLite(quality === "bas");
  lighting.useEnvironment(renderer);
  const weather = createWeather(scene, weatherKind, { seed, particles: QUALITY[quality].particles, mistMap: tex.mist(), groundY: env.terrain ? 0 : 0, size: env.terrain?.spec.size ?? 900 });
  lighting.setFogBoost(weather.fogBoost);
  lighting.setSunFactor(weather.sunFactor);
  const fires = createFires(scene, env.fires, { lights: QUALITY[quality].fireLights, puff: tex.puff(), seed });
  for (const t of meshes.titans) t.setPose(t.pose, time);
  html.dataset["meteo"] = weatherKind;

  // R1c : occlusion ambiante et sortie (post-traitement), selon la qualité.
  let post: PostChain | null = createPost(scene, camera, quality);
  const drawScene = (w: number, h: number): void => {
    const pr = renderer.getPixelRatio();
    if (post) post.render(renderer, w * pr, h * pr);
    else renderer.render(scene, camera);
  };
  const applyQuality = (q: Quality): void => {
    if (q !== quality || !post) {
      post?.dispose();
      post = createPost(scene, camera, q);
    }
    quality = q;
    const d = QUALITY[q];
    renderer.setPixelRatio(effectivePixelRatio(q, window.devicePixelRatio));
    renderer.shadowMap.enabled = d.shadows;
    lighting.setShadow(d.shadows, d.shadowMap);
    lighting.setLampLimit(d.lamps);
    lighting.setLite(q === "bas");
    applyLite(scene, q === "bas");
    for (const lod of meshes.vegetation?.lods ?? []) {
      const levels = lod.levels;
      if (levels[1]) levels[1].distance = d.lodNear;
      if (levels[2]) levels[2].distance = d.lodFar;
    }
    html.dataset["qualite"] = q;
    resize();
  };
  // Vue libre placée par l'adresse (R1c, comparaisons) : `&oeil=x,y,z&cible=x,y,z` (m ; y = altitude).
  const triple = (k: string): [number, number, number] | null => {
    const v = (params.get(k) ?? "").split(",").map(Number);
    return v.length === 3 && v.every((x) => Number.isFinite(x)) ? [v[0] as number, v[1] as number, v[2] as number] : null;
  };
  const freeEye = triple("oeil");
  const freeTarget = triple("cible");
  const setView = (v: ViewName): void => {
    view = v;
    if (v !== "libre") {
      const vv = env.views[v];
      setCam(camera, vv, camera.aspect || 16 / 9);
      controls.target.set(...vv.target);
      lighting.setCenter(new Vector3(...vv.target));
    } else if (freeEye && freeTarget) {
      setCam(camera, { eye: freeEye, target: freeTarget, fov: 55 }, camera.aspect || 16 / 9);
      controls.target.set(...freeTarget);
      lighting.setCenter(new Vector3(...freeTarget));
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
  // Planche de contrôle : vue principale et vue seconde, de jour et au crépuscule ; planche « cycle » : aube, jour,
  // crépuscule, nuit sur la vue principale.
  const QUADS: { view: "principale" | "seconde"; light: LightPreset; x: number; y: number }[] = cycleSheet
    ? [
        { view: "principale", light: "aube", x: 0, y: 0 },
        { view: "principale", light: "jour", x: 1, y: 0 },
        { view: "principale", light: "crepuscule", x: 0, y: 1 },
        { view: "principale", light: "nuit", x: 1, y: 1 },
      ]
    : [
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
      const lightName = { jour: TX.lightJour, aube: TX.lightAube, crepuscule: TX.lightCrepuscule, nuit: TX.lightNuit }[qd.light];
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
        camera.updateMatrixWorld();
        weather.update(time, camera.position, camera.matrixWorldInverse);
        meshes.animate(time);
        renderer.toneMappingExposure = lighting.exposure;
        drawScene(w, h);
      }
      renderer.setScissorTest(false);
    } else {
      controls.update();
      camera.updateMatrixWorld();
      weather.update(time, camera.position, camera.matrixWorldInverse);
      meshes.animate(time);
      lighting.follow(camera.position);
      renderer.toneMappingExposure = lighting.exposure;
      drawScene(size.x, size.y);
    }
    frames++;
    if (corpsPending) {
      corpsPending = false;
      state.timings.corps = performance.now();
      html.dataset["corps3d"] = "pret";
    }
    if (photoPending) {
      photoPending = false;
      state.timings.photos = performance.now();
      html.dataset["photo3d"] = "pret";
    }
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
    offCam.updateMatrixWorld();
    weather.update(time, offCam.position, offCam.matrixWorldInverse);
    off.toneMappingExposure = lighting.exposure;
    // La carte d'environnement appartient au contexte qui l'a calculée : on la recalcule pour le moteur hors écran.
    lighting.useEnvironment(off);
    off.render(scene, offCam);
    const gl = off.getContext();
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    lighting.useEnvironment(renderer);
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
    timings: { generate: t1 - t0, bodies: 0, textures: t2 - tk, build: t3 - t2, pret: 0, corps: 0, photos: 0 },
    photos: {},
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
      const ri = post?.sceneInfo ?? renderer.info.render;
      return { calls: ri.calls, triangles: ri.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, width: size.x, height: size.y, pixelRatio: renderer.getPixelRatio(), instances, lods };
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
  if (view === "libre" && !(freeEye && freeTarget)) {
    camera.position.set(...env.views.principale.eye);
    controls.target.set(...env.views.principale.target);
  }
  setView(view);

  let fpsFrames = 0;
  let since = performance.now();
  let last = performance.now();
  const loop = (now: number): void => {
    if (!paused) time += Math.min(0.1, (now - last) / 1000);
    last = now;
    fires.update(time);
    if (!paused) for (const t of meshes.titans) t.setPose(t.pose, time);
    if (!held) draw();
    fpsFrames++;
    if (now - since >= 1000) {
      const fps = (fpsFrames * 1000) / (now - since);
      fpsFrames = 0;
      since = now;
      const s = post?.sceneInfo ?? renderer.info.render;
      measure.textContent = fill(TX.stats, { fps: fps.toFixed(1), calls: s.calls, tris: Math.round(s.triangles / 1000) });
    }
    requestAnimationFrame(loop);
  };
  /** R1d, second temps : Titans détaillés façonnés un par un, puis échangés d'un coup avec les repères. */
  let corpsPending = false;
  /**
   * R1d : textures de Poly Haven posées en dernier, après les Titans détaillés s'il y en a (repli : textures procédurales ;
   * `?textures=procedurales` : pas de photos).
   */
  const startPhotos = (): void => {
    if (params.get("textures") === "procedurales") html.dataset["photo3d"] = "procedurales";
    else void upgradePhotos();
  };
  let photoPending = false;
  const upgradePhotos = async (): Promise<void> => {
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
  const upgradeTitans = async (): Promise<void> => {
    const s0 = performance.now();
    const kit = await loadBodyKit(window.location.search);
    const make = titanFactory(kit).titan;
    if (!make) {
      state.timings.corps = -1;
      html.dataset["corps3d"] = "repli";
      startPhotos();
      return;
    }
    const next: Titan[] = [];
    for (let i = 0; i < env.titans.length; i++) {
      next.push(makeEnvTitan(env, i, make, tex));
      await new Promise((r) => setTimeout(r, 0));
    }
    meshes.titans.forEach((t, i) => {
      const n = next[i];
      if (!n) return;
      meshes.group.remove(t.group);
      t.dispose();
      meshes.group.add(n.group);
      meshes.titans[i] = n;
    });
    applyLite(scene, quality === "bas");
    await precompile(renderer, scene, camera);
    state.timings.bodies = performance.now() - s0;
    corpsPending = true;
    startPhotos();
  };

  requestAnimationFrame((now) => {
    loop(now);
    state.timings.pret = performance.now();
    state.ready = true;
    html.dataset["proto3d"] = "pret";
    if (env.titans.length === 0 || params.get("corps") === "primitives") {
      if (env.titans.length > 0) html.dataset["corps3d"] = "primitives";
      // Sans Titans détaillés à attendre : après l'image suivante, pour ne pas retarder « prêt ».
      requestAnimationFrame(() => setTimeout(startPhotos, 0));
      return;
    }
    upgradeTitans().catch((e: unknown) => {
      state.timings.corps = -1;
      html.dataset["corps3d"] = "repli";
      html.dataset["corpsErreur"] = String(e).slice(0, 200);
      startPhotos();
    });
  });
  void frames;
  void probe;
}
