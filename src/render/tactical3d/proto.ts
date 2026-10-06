import { ACESFilmicToneMapping, Color, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, SRGBColorSpace, Scene, Vector2, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { WebGLProbe } from "./entry";
import { backTo2d } from "./entry";
import { TX, fill } from "./texts";

/**
 * Prototype de rendu 3D du combat (R1) : scène de démonstration, sans lien avec la simulation (`src/sim` n'est pas touché).
 * Socle (R1.1) : moteur, caméra libre, boucle d'images, panneau et sonde de mesure.
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
  host.append(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(0xa9b4b8);
  const camera = new PerspectiveCamera(50, 1, 0.5, 4000);
  camera.position.set(90, 70, 120);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 5, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.update();

  scene.add(new HemisphereLight(0xdfe6e8, 0x6b604f, 2.2));
  const ground = new Mesh(new PlaneGeometry(1200, 1200), new MeshStandardMaterial({ color: 0x8d8670, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

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
