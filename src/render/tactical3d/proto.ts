import { ACESFilmicToneMapping, PCFShadowMap, PerspectiveCamera, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { WebGLProbe } from "./entry";
import { backTo2d } from "./entry";
import { LIGHT_PRESETS, createLighting } from "./lighting";
import type { LightPreset } from "./lighting";
import { TX, fill } from "./texts";
import { puffTexture, skinTexture } from "./textures";
import { TITAN_LARGE, TITAN_POSES, TITAN_SMALL, buildTitan, setSteamTexture } from "./titan";
import type { TitanPose } from "./titan";
import { generateTown } from "./town";
import { buildTownMeshes } from "./townMesh";

/**
 * Prototype de rendu 3D du combat (R1) : scène de démonstration, sans lien avec la simulation (`src/sim` n'est pas touché).
 * - Socle (R1.1) : moteur, caméra libre, boucle d'images, panneau et sonde de mesure.
 * - Ville (R1.2) : générée par graine (`?graine=N`, 850 par défaut).
 * - Lumière (R1.3) : jour, crépuscule, nuit (`?lumiere=nuit`).
 * - Titans (R1.4) : 5 m et 15 m sur la place, poses marche, saisie, abattu (`?poses=marche,saisie`).
 */
export interface ProtoProbe {
  ready: boolean;
  renderer: string;
  fps: number;
  frames: number;
  light: LightPreset;
  setLight(p: LightPreset): void;
  titanPoses: [TitanPose, TitanPose];
  setTitanPose(which: 0 | 1, p: TitanPose): void;
  /** Temps d'animation (s) ; `pause` le fige, pour des captures reproductibles. */
  time: number;
  setTime(t: number): void;
  pause(p: boolean): void;
  stats(): { calls: number; triangles: number; geometries: number; textures: number; width: number; height: number; pixelRatio: number; shadows: boolean };
  /** Rend une image tout de suite et attend la suivante (captures). */
  frame(): Promise<void>;
}

declare global {
  interface Window {
    __proto3d?: ProtoProbe;
  }
}

interface Choice<T extends string> {
  set(v: T): void;
}

/** Rangée de boutons exclusifs (aria-pressed), dans une légende. */
function choiceGroup<T extends string>(parent: HTMLElement, legend: string, name: string, options: readonly (readonly [T, string])[], current: T, onPick: (v: T) => void): Choice<T> {
  const fs = document.createElement("fieldset");
  fs.className = "p3d-groupe";
  fs.dataset["groupe"] = name;
  const lg = document.createElement("legend");
  lg.textContent = legend;
  const row = document.createElement("div");
  row.className = "p3d-rangee";
  const buttons = options.map(([v, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.dataset["choix"] = v;
    b.addEventListener("click", () => onPick(v));
    row.append(b);
    return b;
  });
  fs.append(lg, row);
  parent.append(fs);
  const set = (v: T): void => {
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset["choix"] === v));
  };
  set(current);
  return { set };
}

export async function startProto(root: HTMLElement, probe: WebGLProbe): Promise<void> {
  const params = new URLSearchParams(window.location.search);
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
  const camera = new PerspectiveCamera(50, 1, 0.5, 4000);
  camera.position.set(70, 45, 95);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 5, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.update();

  const seedParam = Number(params.get("graine"));
  const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : 850;
  const town = generateTown(seed);
  const townMeshes = buildTownMeshes(town, seed);
  scene.add(townMeshes.group);
  const center = new Vector3(town.plaza.center.x, 0, town.plaza.center.y);
  controls.target.copy(center).setY(5);
  // Repères de la place : A (fontaine, au nord), B (marché, au sud), et la perpendiculaire à l'axe A→B.
  const pcs = town.plaza.centers.map((c) => new Vector3(c.x, 0, c.y));
  const plazaA = pcs[0] ?? center;
  const plazaB = pcs[1] ?? center.clone().add(new Vector3(0, 0, 40));
  const axis = plazaB.clone().sub(plazaA);
  const perp = new Vector3(-axis.z, 0, axis.x).normalize();
  const along = (k: number, side = 0, y = 0): Vector3 => plazaA.clone().addScaledVector(axis, k).addScaledVector(perp, side).setY(y);
  if (params.get("cam") === "titan") {
    camera.fov = 45;
    camera.position.copy(along(1.16, 8, 2.5));
    controls.target.copy(along(0.5, 0, 8));
    controls.update();
  } else {
    camera.position.copy(along(1.25, 34, 38));
    controls.target.copy(along(0.3, 0, 4));
    controls.update();
  }

  const lighting = createLighting(scene, renderer, seed, { windowMaterials: townMeshes.windowMaterials, lanternMaterial: townMeshes.lanternMaterial, lamps: townMeshes.lamps, center });
  // Titans : le grand au milieu de la place, le petit dans l'angle.
  const skinMap = skinTexture(seed);
  const puff = puffTexture();
  const titans = [buildTitan(TITAN_SMALL, seed, skinMap), buildTitan(TITAN_LARGE, seed, skinMap)] as const;
  for (const t of titans) {
    setSteamTexture(t, puff);
    scene.add(t.group);
  }
  // Le grand sur la rue qui traverse la place, le petit dans le marché du sud ; tous deux tournés vers le sud.
  const face = (o: Vector3, to: Vector3): number => Math.atan2(to.x - o.x, to.z - o.z);
  titans[1].group.position.copy(along(0.5, 2));
  titans[1].group.rotation.y = face(titans[1].group.position, along(1.1, 8));
  titans[0].group.position.copy(along(0.84, -3));
  titans[0].group.rotation.y = face(titans[0].group.position, along(1.1, 6));
  const wantedPoses = (params.get("poses") ?? "").split(",");
  const titanPoses: [TitanPose, TitanPose] = [TITAN_POSES.find((p) => p === wantedPoses[0]) ?? "marche", TITAN_POSES.find((p) => p === wantedPoses[1]) ?? "marche"];
  // Planche des poses (`?vue=planche`) : chaque Titan dans ses trois poses, au sud de la ville, petits devant, grands derrière.
  const sheetOrigin = new Vector3((town.bounds.minX + town.bounds.maxX) / 2, 0, town.bounds.maxY + 110);
  const sheet: { t: ReturnType<typeof buildTitan>; pose: TitanPose }[] = [];
  if (params.get("vue") === "planche") {
    TITAN_POSES.forEach((pose, i) => {
      for (const [spec, row, gap, shift] of [[TITAN_SMALL, 0, 15, -5], [TITAN_LARGE, -38, 27, 7]] as const) {
        const t = buildTitan(spec, seed, skinMap);
        setSteamTexture(t, puff);
        t.group.position.copy(sheetOrigin).add(new Vector3((i - 1) * gap + shift - (pose === "abattu" ? spec.height * 0.5 : 0), 0, row));
        // De trois quarts, pour lire les bras tendus ; l'abattu de profil.
        t.group.rotation.y = pose === "abattu" ? Math.PI / 2 : 0.75;
        scene.add(t.group);
        sheet.push({ t, pose });
      }
    });
    camera.fov = 42;
    camera.position.copy(sheetOrigin).add(new Vector3(0, 6.5, 36));
    controls.target.copy(sheetOrigin).add(new Vector3(0, 5.5, -16));
    controls.update();
  }
  let time = Number(params.get("t") ?? "0") || 0;
  let paused = params.has("pause");

  const wantedLight = params.get("lumiere");
  let light: LightPreset = LIGHT_PRESETS.find((p) => p === wantedLight) ?? "jour";
  lighting.apply(light);

  // Panneau : titre, réglages, mesure, retour au jeu.
  const panel = document.createElement("aside");
  panel.className = "p3d-panneau";
  const h1 = document.createElement("h1");
  h1.textContent = TX.title;
  const sub = document.createElement("p");
  sub.className = "p3d-sous-titre";
  sub.textContent = TX.subtitle;
  panel.append(h1, sub);
  const lightChoice = choiceGroup(
    panel,
    TX.light,
    "lumiere",
    [
      ["jour", TX.lightJour],
      ["crepuscule", TX.lightCrepuscule],
      ["nuit", TX.lightNuit],
    ],
    light,
    (v) => setLight(v),
  );
  const measure = document.createElement("p");
  measure.className = "p3d-mesure";
  const help = document.createElement("p");
  help.className = "p3d-aide";
  help.textContent = TX.help;
  const links = document.createElement("p");
  links.className = "p3d-liens";
  const back = document.createElement("a");
  back.href = backTo2d(window.location.href);
  back.textContent = TX.back;
  back.dataset["action"] = "retour-2d";
  links.append(back);
  panel.append(measure, help, links);
  host.append(panel);
  if (params.get("panneau") === "0") panel.hidden = true;
  window.addEventListener("keydown", (ev) => {
    if (ev.code === "KeyH") panel.hidden = !panel.hidden;
  });

  const setLight = (p: LightPreset): void => {
    light = p;
    lighting.apply(p);
    lightChoice.set(p);
    state.light = p;
    document.documentElement.dataset["lumiere"] = p;
  };

  const resize = (): void => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);
  resize();

  const draw = (): void => {
    titans.forEach((t, i) => t.setPose(titanPoses[i as 0 | 1], time));
    for (const e of sheet) e.t.setPose(e.pose, time);
    controls.update();
    lighting.follow(camera.position);
    renderer.render(scene, camera);
    state.frames++;
  };
  const state: ProtoProbe = {
    ready: false,
    renderer: probe.renderer,
    fps: 0,
    frames: 0,
    light,
    setLight,
    titanPoses,
    setTitanPose(which, p) {
      titanPoses[which] = p;
    },
    time,
    setTime(t) {
      time = t;
      state.time = t;
    },
    pause(p) {
      paused = p;
    },
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
        shadows: renderer.shadowMap.enabled && lighting.sun.castShadow,
      };
    },
    frame: () =>
      new Promise((resolve) => {
        draw();
        requestAnimationFrame(() => resolve());
      }),
  };
  window.__proto3d = state;
  document.documentElement.dataset["lumiere"] = light;

  let fpsFrames = 0;
  let fpsSince = performance.now();
  let last = performance.now();
  const loop = (now: number): void => {
    if (!paused) time += Math.min(0.1, (now - last) / 1000);
    last = now;
    state.time = time;
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
