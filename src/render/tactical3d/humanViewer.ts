import { ACESFilmicToneMapping, Color, Mesh, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import type { Material, PointsMaterial } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { WebGLProbe } from "./entry";
import { buildHumanBody, loadEyeTexture, loadHumanTemplate, skinnedBounds } from "./humanBase";
import type { HumanBody, HumanShape } from "./humanBase";
import { SOLDIER_ANIMS } from "./humanAnim";
import { buildHumanSoldier } from "./humanSoldier";
import type { HumanSoldier } from "./humanSoldier";
import { buildHumanTitan } from "./humanTitan";
import type { HumanTitan } from "./humanTitan";
import { TITAN_CLASS_IDS, TITAN_SPECIAL_IDS, TITAN_VARIANT_IDS, titanSpec, variantSpec } from "./titanGallery";
import { ALL_TITAN_POSES, setSteamTexture } from "./titan";
import type { TitanPose } from "./titan";
import { puffTexture, skinTexture } from "./textures";
import { dressMaterials } from "./bodies";
import { createLighting } from "./lighting";
import { bodyDetailNormals } from "./texturesEnv";
import { createPost } from "./post";
import type { PostChain } from "./post";
import { soldierMaterials } from "./soldier";
import { MATERIALS } from "./styles";

/**
 * Page de contrôle du corps de base de R1c (`?proto3d=humain`) : le corps MakeHuman CC0 façonné par paramètres, en rang.
 * `&planche=soldats` : les animations du soldat ; `&planche=titans` : classes, variantes et Titans spéciaux ramenés à la même
 * hauteur (formes comparables, `&pose=`) ; `&planche=poses&id=classe_15` : les animations d'un Titan. `&vue=visage` : de près.
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
  const eyeTex = await loadEyeTexture();
  const detail = bodyDetailNormals(850);
  const skin = new MeshStandardMaterial({ color: new Color(MATERIALS.physiques.cire).lerp(new Color(MATERIALS.physiques.braise), 0.18), roughness: 0.55 });
  const eyes = new MeshStandardMaterial({ map: eyeTex, roughness: 0.15 });
  const teeth = new MeshStandardMaterial({ color: new Color(MATERIALS.physiques.toile_claire), roughness: 0.35 });
  const mat = (p: string): Material => (p === "yeux" ? eyes : p === "dents" ? teeth : skin);
  const state: HumanProbe = { ready: false, loadMs, bodies: [] };
  const bodies: HumanBody[] = [];
  const q = new URLSearchParams(window.location.search);
  const sheet = q.get("planche") ?? "corps";
  const t = Number(q.get("t") ?? "0.6") || 0.6;
  const soldiers: HumanSoldier[] = [];
  if (sheet === "soldats") {
    // Les animations du soldat, côte à côte (même instant) ; la vue « visage » cadre le premier de près.
    const mats = soldierMaterials();
    dressMaterials(mats, detail);
    SOLDIER_ANIMS.forEach((a, i) => {
      const s0 = performance.now();
      const s = buildHumanSoldier(template, 300 + i, mats, { eyeMap: eyeTex });
      s.group.position.set((i - (SOLDIER_ANIMS.length - 1) / 2) * 1.4, a === "vol" ? 1.2 : 0, 0);
      s.setPose(a, t);
      scene.add(s.group);
      const bb = skinnedBounds(s.body);
      state.bodies.push({ id: a, nominal: s.body.height, measured: bb.max.y - bb.min.y, minY: bb.min.y, buildMs: performance.now() - s0 });
      soldiers.push(s);
    });
  }
  const titans: HumanTitan[] = [];
  if (sheet === "titans" || sheet === "poses") {
    // Ramenés à 2,4 m (échelle du groupe) : les proportions se comparent d'un coup d'œil.
    const skinMap = skinTexture(850);
    const puff = puffTexture();
    const id = q.get("id") ?? "classe_15";
    const wanted = ALL_TITAN_POSES.find((p) => p === q.get("pose")) ?? "debout";
    const items: { spec: ReturnType<typeof titanSpec>; pose: TitanPose }[] =
      sheet === "titans"
        ? [...TITAN_CLASS_IDS.map((c) => titanSpec(c)), ...TITAN_VARIANT_IDS.map(variantSpec), ...TITAN_SPECIAL_IDS.map((c) => titanSpec(c))].map((spec) => ({ spec, pose: wanted }))
        : ALL_TITAN_POSES.map((pose) => ({ spec: titanSpec(id), pose }));
    items.forEach(({ spec, pose }, i) => {
      const s0 = performance.now();
      const ti = buildHumanTitan(template, spec, 850 + i, { skinMap, eyeMap: eyeTex, skinNormal: detail.skin });
      const k = 2.4 / spec.height;
      ti.group.scale.setScalar(k);
      // La taille des points de vapeur ne suit pas l'échelle du groupe.
      (ti.steam.material as PointsMaterial).size *= k;
      setSteamTexture(ti, puff);
      ti.group.position.set((i - (items.length - 1) / 2) * 1.5, 0, pose === "abattu" || pose === "allonge" ? -3 : 0);
      if (pose === "abattu" || pose === "allonge") ti.group.rotation.y = Math.PI / 2;
      scene.add(ti.group);
      ti.group.updateMatrixWorld(true);
      ti.setPose(pose, t);
      const bb = skinnedBounds(ti.human);
      state.bodies.push({ id: `${spec.id}:${pose}`, nominal: spec.height * k, measured: bb.max.y - bb.min.y, minY: bb.min.y, buildMs: performance.now() - s0 });
      titans.push(ti);
    });
  }
  (sheet === "corps" ? LINEUP : []).forEach((e, i) => {
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
  const close = q.get("vue") === "visage";
  const wide = titans.length > 8;
  camera.position.set(close ? 0.25 : 0, close ? 1.62 : 1.3, close ? 0.9 : wide ? 26 : 11);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(close ? -0.0 : 0, close ? 1.55 : 1.0, 0);
  if (close && titans.length > 0) {
    // Visages de Titans : deux têtes côte à côte, à partir de `&cadre=` (indice), de trois quarts.
    const f = Math.max(0, Math.min(titans.length - 2, Number(q.get("cadre") ?? "0") || 0));
    const head = (i: number): Vector3 => titans[i]?.joints.tete.getWorldPosition(new Vector3()) ?? new Vector3();
    const c = head(f).add(head(f + 1)).multiplyScalar(0.5).add(new Vector3(0, 0.08, 0));
    controls.target.copy(c);
    const d = Number(q.get("recul") ?? "2.4") || 2.4;
    camera.position.copy(c).add(new Vector3(0.5 * (d / 2.4), 0.05, d));
  } else if (close) {
    camera.position.x += (0 - (LINEUP.length - 1) / 2) * 1.25 + 1.25;
    controls.target.x = (1 - (LINEUP.length - 1) / 2) * 1.25;
  }
  controls.update();
  const lighting = createLighting(scene, 850, { windowMaterials: [], lanternMaterial: new MeshStandardMaterial(), lamps: [], center: new Vector3(0, 0, 0), shadowExtent: 20, fogScale: 0.2 });
  lighting.useEnvironment(renderer);
  lighting.apply("jour");
  lighting.setShadow(true, 2048);
  // Occlusion ambiante (R1c) : plis du corps, aisselles, dessous du menton.
  const post = createPost(scene, camera, "haut") as PostChain;
  const resize = (): void => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();
  const animate = q.has("anime");
  let last = performance.now();
  let time = t;
  const loop = (): void => {
    const now = performance.now();
    if (animate) {
      time += (now - last) / 1000;
      for (const s of soldiers) s.setPose(s.pose, time);
      for (const ti of titans) ti.setPose(ti.pose, time);
    }
    last = now;
    controls.update();
    lighting.follow(camera.position);
    renderer.toneMappingExposure = lighting.exposure;
    const size = renderer.getDrawingBufferSize(new Vector2());
    post.render(renderer, size.x, size.y);
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
