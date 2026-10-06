import { ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, PCFShadowMap, PerspectiveCamera, SRGBColorSpace, Scene, Vector2, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { WebGLProbe } from "./entry";
import { backTo2d } from "./entry";
import { TX, fill } from "./texts";
import { generateTown } from "./town";
import { buildTownMeshes } from "./townMesh";

/**
 * Prototype de rendu 3D du combat (R1) : scène de démonstration, sans lien avec la simulation (`src/sim` n'est pas touché).
 * Socle (R1.1) : moteur, caméra libre, boucle d'images, panneau et sonde de mesure.
 * Ville (R1.2) : générée par graine (`?graine=N`, 850 par défaut).
 */
export interface ProtoProbe {
  ready: boolean;
  renderer: string;
  fps: number;
  frames: number;
  stats(): { calls: number; triangles: number; geometries: number; textures: number; width: number; height: number; pixelRatio: number };
  /** Rend une image tout de suite et attend la suivante (captures). */
  frame(): Promise<void>;
}

declare global {
  interface Window {
    __proto3d?: ProtoProbe;
  }
}

export async function startProto(root: HTMLElement, probe: WebGLProbe): Promise<void> {
  const host = document.createElement("div");
  host.className = "p3d";
  root.replaceChildren(host);

  const renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  host.append(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(0xa9b4b8);
  const camera = new PerspectiveCamera(50, 1, 0.5, 4000);
  camera.position.set(70, 45, 95);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 5, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.update();

  scene.fog = new Fog(0xa9b4b8, 200, 1100);
  scene.add(new HemisphereLight(0xdfe6e8, 0x6b604f, 1.2));
  const sun = new DirectionalLight(0xfff2dc, 2.6);
  sun.position.set(-160, 220, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -220, right: 220, top: 220, bottom: -220, near: 10, far: 700 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);

  const seedParam = Number(new URLSearchParams(window.location.search).get("graine"));
  const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : 850;
  const town = generateTown(seed);
  const townMeshes = buildTownMeshes(town, seed);
  scene.add(townMeshes.group);

  // Panneau : titre, mesure, retour au jeu.
  const panel = document.createElement("aside");
  panel.className = "p3d-panneau";
  const h1 = document.createElement("h1");
  h1.textContent = TX.title;
  const sub = document.createElement("p");
  sub.className = "p3d-sous-titre";
  sub.textContent = TX.subtitle;
  const measure = document.createElement("p");
  measure.className = "p3d-mesure";
  const links = document.createElement("p");
  links.className = "p3d-liens";
  const back = document.createElement("a");
  back.href = backTo2d(window.location.href);
  back.textContent = TX.back;
  back.dataset["action"] = "retour-2d";
  links.append(back);
  panel.append(h1, sub, measure, links);
  host.append(panel);

  const resize = (): void => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();

  const state: ProtoProbe = {
    ready: false,
    renderer: probe.renderer,
    fps: 0,
    frames: 0,
    stats: () => {
      const size = renderer.getDrawingBufferSize(new Vector2());
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        width: size.x,
        height: size.y,
        pixelRatio: renderer.getPixelRatio(),
      };
    },
    frame: () =>
      new Promise((resolve) => {
        draw();
        requestAnimationFrame(() => resolve());
      }),
  };
  window.__proto3d = state;

  let fpsFrames = 0;
  let fpsSince = performance.now();
  const draw = (): void => {
    controls.update();
    renderer.render(scene, camera);
    state.frames++;
  };
  const loop = (now: number): void => {
    draw();
    fpsFrames++;
    if (now - fpsSince >= 1000) {
      state.fps = (fpsFrames * 1000) / (now - fpsSince);
      fpsFrames = 0;
      fpsSince = now;
      const s = renderer.info.render;
      measure.textContent = fill(TX.stats, { fps: state.fps.toFixed(1), calls: s.calls, tris: Math.round(s.triangles / 1000) });
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame((now) => {
    loop(now);
    state.ready = true;
    document.documentElement.dataset["proto3d"] = "pret";
  });
}
