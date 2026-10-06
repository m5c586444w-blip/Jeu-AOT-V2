import { ACESFilmicToneMapping, Color, Mesh, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, SRGBColorSpace, Scene, TextureLoader, Vector3, WebGLRenderer } from "three";
import type { Material } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { WebGLProbe } from "./entry";
import { EYE_TEXTURE_URL, buildHumanBody, loadHumanTemplate, skinnedBounds } from "./humanBase";
import type { HumanBody, HumanShape } from "./humanBase";
import { createLighting } from "./lighting";
import { MATERIALS } from "./styles";

/**
 * Page de contrôle du corps de base de R1c (`?proto3d=humain`) : le corps MakeHuman CC0 façonné par paramètres, en rang.
 * Sonde `window.__humain3d` : prêt, hauteurs mesurées après pose, temps de chargement et de façonnage.
 */
export interface HumanProbe {
  ready: boolean;
  loadMs: number;
  bodies: { id: string; nominal: number; measured: number; minY: number; buildMs: number }[];
}

declare global {
  interface Window {
    __humain3d?: HumanProbe;
  }
}

const LINEUP: { id: string; shape: HumanShape }[] = [
  { id: "défaut", shape: { macro: { gender: 0.5, age: 0.5, muscle: 0.5, weight: 0.5 }, height: 1.7 } },
  { id: "homme", shape: { macro: { gender: 1, age: 0.5, muscle: 0.5, weight: 0.5 }, height: 1.78 } },
  { id: "femme", shape: { macro: { gender: 0, age: 0.5, muscle: 0.5, weight: 0.5 }, height: 1.64 } },
  { id: "musclé", shape: { macro: { gender: 1, age: 0.5, muscle: 1, weight: 0.6 }, height: 1.82 } },
  { id: "lourde", shape: { macro: { gender: 0.1, age: 0.6, muscle: 0.3, weight: 1 }, height: 1.6 } },
  { id: "âgé", shape: { macro: { gender: 0.9, age: 1, muscle: 0.4, weight: 0.4 }, height: 1.7 } },
  { id: "proportions de Titan", shape: { macro: { gender: 0.7, age: 0.5, muscle: 0.3, weight: 0.9 }, details: { stomach_pregnant_incr: 1.2 }, proportions: { head: 1.9, legs: 0.66, arms: 0.85, neck: 0.6 }, height: 2.4 } },
];

export async function startHumanViewer(root: HTMLElement, probe: WebGLProbe): Promise<void> {
  const html = document.documentElement;
  const t0 = performance.now();
  const template = await loadHumanTemplate();
  const loadMs = performance.now() - t0;
  const host = document.createElement("div");
  host.className = "p3d";
  root.replaceChildren(host);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  host.append(renderer.domElement);
  const scene = new Scene();
  const ground = new Mesh(new PlaneGeometry(60, 30), new MeshStandardMaterial({ color: new Color(MATERIALS.sols.route.base), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const eyeTex = await new TextureLoader().loadAsync(EYE_TEXTURE_URL);
  eyeTex.colorSpace = SRGBColorSpace;
  const skin = new MeshStandardMaterial({ color: new Color(MATERIALS.physiques.cire).lerp(new Color(MATERIALS.physiques.braise), 0.18), roughness: 0.55 });
  const eyes = new MeshStandardMaterial({ map: eyeTex, roughness: 0.15 });
  const teeth = new MeshStandardMaterial({ color: new Color(MATERIALS.physiques.toile_claire), roughness: 0.35 });
  const mat = (p: string): Material => (p === "yeux" ? eyes : p === "dents" ? teeth : skin);
  const state: HumanProbe = { ready: false, loadMs, bodies: [] };
  const bodies: HumanBody[] = [];
  LINEUP.forEach((e, i) => {
    const s = performance.now();
    const b = buildHumanBody(template, e.shape, mat, (p) => p !== "pantalon");
    const buildMs = performance.now() - s;
    b.group.position.set((i - (LINEUP.length - 1) / 2) * 1.25, 0, 0);
    scene.add(b.group);
    const bb = skinnedBounds(b);
    state.bodies.push({ id: e.id, nominal: e.shape.height, measured: bb.max.y - bb.min.y, minY: bb.min.y, buildMs });
    bodies.push(b);
  });
  const camera = new PerspectiveCamera(32, 1, 0.1, 4000);
  const q = new URLSearchParams(window.location.search);
  const close = q.get("vue") === "visage";
  camera.position.set(close ? 0.25 : 0, close ? 1.62 : 1.3, close ? 0.9 : 11);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(close ? -0.0 : 0, close ? 1.55 : 1.0, 0);
  if (close) {
    camera.position.x += (0 - (LINEUP.length - 1) / 2) * 1.25 + 1.25;
    controls.target.x = (1 - (LINEUP.length - 1) / 2) * 1.25;
  }
  controls.update();
  const lighting = createLighting(scene, 850, { windowMaterials: [], lanternMaterial: new MeshStandardMaterial(), lamps: [], center: new Vector3(0, 0, 0), shadowExtent: 20, fogScale: 0.2 });
  lighting.apply("jour");
  const resize = (): void => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();
  const loop = (): void => {
    controls.update();
    lighting.follow(camera.position);
    renderer.toneMappingExposure = lighting.exposure;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  window.__humain3d = state;
  requestAnimationFrame(() => {
    loop();
    state.ready = true;
    html.dataset["proto3d"] = "pret";
  });
  void probe;
}
