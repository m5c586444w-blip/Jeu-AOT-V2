import { ACESFilmicToneMapping, BoxGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PCFShadowMap, PerspectiveCamera, Quaternion, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { WebGLProbe } from "./entry";
import { backTo2d } from "./entry";
import { LIGHT_PRESETS, createLighting } from "./lighting";
import type { LightPreset } from "./lighting";
import { buildOdm } from "./odm";
import { QUALITIES, QUALITY, effectivePixelRatio } from "./quality";
import type { Quality } from "./quality";
import { derive } from "./rng";
import { SOLDIER_POSES, crowdGeometry, crowdTint, soldierMaterials } from "./soldier";
import type { SoldierLike, SoldierPose } from "./soldier";
import { loadBodyKit, makeSoldier } from "./bodies";
import { TX, fill } from "./texts";
import { puffTexture, skinTexture } from "./textures";
import { TITAN_LARGE, TITAN_POSES, TITAN_SMALL, buildTitan, setSteamTexture } from "./titan";
import type { TitanPose } from "./titan";
import { generateTown } from "./town";
import { buildTownMeshes } from "./townMesh";

/**
 * Prototype de rendu 3D du combat (R1) : scène de démonstration, sans lien avec la simulation (`src/sim` n'est pas touché).
 * - Socle (R1.1) : moteur, boucle d'images, panneau et sonde de mesure (`window.__proto3d`).
 * - Ville (R1.2) : générée par graine (`?graine=N`, 850 par défaut).
 * - Lumière (R1.3) : jour, crépuscule, nuit (`?lumiere=nuit`).
 * - Titans (R1.4) : 5 m et 15 m sur la place, poses marche, saisie, abattu (`?poses=marche,saisie`).
 * - Soldats (R1.5) : 20 soldats en 4 escouades (câbles, gaz), 300 soldats instanciés (`?foule=0` les masque).
 * - Caméras et qualité (R1.6) : libre, suivi d'escouade, vue Titan, vue de dessus, planche (`?cam=suivi2`) ;
 *   qualité basse, moyenne, haute (`?qualite=bas`).
 * Autres paramètres : `?pause`, `?t=1.5` (temps d'animation), `?panneau=0`, `?soldats=vol`.
 */
export type CameraMode = "libre" | "suivi" | "titan" | "dessus" | "planche";
export const CAMERA_MODES: readonly CameraMode[] = ["libre", "suivi", "titan", "dessus", "planche"];

export interface ProtoProbe {
  ready: boolean;
  renderer: string;
  fps: number;
  frames: number;
  light: LightPreset;
  setLight(p: LightPreset): void;
  quality: Quality;
  setQuality(q: Quality): void;
  camera: CameraMode;
  squad: number;
  setCamera(m: CameraMode, squad?: number): void;
  titanPoses: [TitanPose, TitanPose];
  setTitanPose(which: 0 | 1, p: TitanPose): void;
  /** Pose imposée aux 20 soldats (null : chacun la sienne). */
  soldierPose: SoldierPose | null;
  setSoldierPose(p: SoldierPose | null): void;
  crowd: boolean;
  setCrowd(on: boolean): void;
  /** Temps d'animation (s) ; `pause` le fige, pour des captures reproductibles. */
  time: number;
  setTime(t: number): void;
  pause(p: boolean): void;
  /** Gèle le dessin (la dernière image reste affichée) : captures lentes en 4K logiciel. */
  hold(h: boolean): void;
  /** Position de la caméra et centre de l'escouade suivie (contrôle du suivi). */
  view(): { camera: [number, number, number]; target: [number, number, number]; squadCenter: [number, number, number] };
  stats(): { calls: number; triangles: number; geometries: number; textures: number; width: number; height: number; pixelRatio: number; shadows: boolean; antialias: boolean; lamps: number };
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

const v3 = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];

export async function startProto(root: HTMLElement, probe: WebGLProbe): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  // R1c : corps de base MakeHuman (CC0) pour les soldats et les Titans ; figures de R1 en repli (`?corps=primitives`).
  const kit = await loadBodyKit(window.location.search);
  const host = document.createElement("div");
  host.className = "p3d";
  root.replaceChildren(host);
  const html = document.documentElement;

  // ——— Moteur (recréé si l'anticrénelage change) ———
  let quality: Quality = QUALITIES.find((q) => q === params.get("qualite")) ?? "moyen";
  const makeRenderer = (q: Quality): WebGLRenderer => {
    const r = new WebGLRenderer({ antialias: QUALITY[q].antialias, powerPreference: "high-performance" });
    r.outputColorSpace = SRGBColorSpace;
    r.toneMapping = ACESFilmicToneMapping;
    r.shadowMap.type = PCFShadowMap;
    r.domElement.dataset["moteur"] = "three";
    return r;
  };
  let renderer = makeRenderer(quality);
  host.append(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.5, 4000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;

  // ——— Ville, lumière ———
  const seedParam = Number(params.get("graine"));
  const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : 850;
  const town = generateTown(seed);
  const townMeshes = buildTownMeshes(town, seed);
  scene.add(townMeshes.group);
  const center = new Vector3(town.plaza.center.x, 0, town.plaza.center.y);
  // Repères de la place : A (fontaine, au nord), B (marché, au sud), et la perpendiculaire à l'axe A→B.
  const pcs = town.plaza.centers.map((c) => new Vector3(c.x, 0, c.y));
  const plazaA = pcs[0] ?? center;
  const plazaB = pcs[1] ?? center.clone().add(new Vector3(0, 0, 40));
  const axis = plazaB.clone().sub(plazaA);
  const perp = new Vector3(-axis.z, 0, axis.x).normalize();
  const along = (k: number, side = 0, y = 0): Vector3 => plazaA.clone().addScaledVector(axis, k).addScaledVector(perp, side).setY(y);
  const lighting = createLighting(scene, seed, { windowMaterials: townMeshes.windowMaterials, lanternMaterial: townMeshes.lanternMaterial, lamps: townMeshes.lamps, center: along(0.5) });
  let light: LightPreset = LIGHT_PRESETS.find((p) => p === params.get("lumiere")) ?? "jour";
  lighting.useEnvironment(renderer);
  lighting.apply(light);

  // ——— Titans ———
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
  // Tourné de trois quarts vers le sud-est de la place : la saisie se lit de côté depuis la vue Titan.
  titans[1].group.rotation.y = face(titans[1].group.position, along(1.0, 26));
  titans[0].group.position.copy(along(0.84, -3));
  titans[0].group.rotation.y = face(titans[0].group.position, along(1.1, 6));
  const wantedPoses = (params.get("poses") ?? "").split(",");
  const titanPoses: [TitanPose, TitanPose] = [TITAN_POSES.find((p) => p === wantedPoses[0]) ?? "marche", TITAN_POSES.find((p) => p === wantedPoses[1]) ?? "marche"];

  // ——— Soldats : 4 escouades autour des Titans ; foule de 300 au sud-est, hors de la ville ———
  const smats = soldierMaterials();
  const odm = buildOdm(town, seed, smats, puff, {
    plaza: along(0, 0),
    market: along(1, 0),
    titanLarge: titans[1].group,
    titanSmall: titans[0].group.position.clone(),
    largeShoulders: [titans[1].joints.epauleG, titans[1].joints.epauleD],
    ...(kit.template ? { makeSoldier: (sd: number) => makeSoldier(kit, sd, smats) } : {}),
  });
  scene.add(odm.group);
  let soldierPose: SoldierPose | null = SOLDIER_POSES.find((p) => p === params.get("soldats")) ?? null;
  const CROWD = 300;
  const crowd = new InstancedMesh(crowdGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), CROWD);
  crowd.name = "foule-300";
  crowd.castShadow = true;
  crowd.receiveShadow = true;
  const crowdOrigin = new Vector3(town.bounds.maxX - 35, 0, town.bounds.maxY + 70);
  const crowdBase: Vector3[] = [];
  for (let i = 0; i < CROWD; i++) {
    // 12 sections de 25 (5 × 5), en 4 colonnes et 3 rangs.
    const block = Math.floor(i / 25);
    const r = i % 25;
    crowdBase.push(new Vector3(crowdOrigin.x + ((block % 4) - 1.5) * 13 + ((r % 5) - 2) * 1.7, 0, crowdOrigin.z + (Math.floor(block / 4) - 1) * 13 + (Math.floor(r / 5) - 2) * 1.7));
    crowd.setColorAt(i, crowdTint(seed, i));
  }
  scene.add(crowd);
  crowd.visible = params.get("foule") !== "0";
  const crowdM = new Matrix4();
  const crowdQ = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
  const crowdS = new Vector3(1, 1, 1);
  const crowdP = new Vector3();
  const updateCrowd = (t: number): void => {
    if (!crowd.visible) return;
    crowdBase.forEach((b, i) => {
      // Marche au pas sur place, rang par rang.
      crowdP.copy(b).setY(0.04 * Math.abs(Math.sin(t * 4 + (i % 25) * 0.4)));
      crowd.setMatrixAt(i, crowdM.compose(crowdP, crowdQ, crowdS));
    });
    crowd.instanceMatrix.needsUpdate = true;
    crowd.computeBoundingSphere();
  };

  // ——— Planche des poses : construite à la première demande ———
  const sheetOrigin = new Vector3((town.bounds.minX + town.bounds.maxX) / 2, 0, town.bounds.maxY + 110);
  const sheet: { t: ReturnType<typeof buildTitan>; pose: TitanPose }[] = [];
  const sheetSoldiers: { s: SoldierLike; pose: SoldierPose }[] = [];
  const buildSheet = (): void => {
    if (sheet.length > 0) return;
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
    SOLDIER_POSES.forEach((pose, i) => {
      const s = makeSoldier(kit, derive(seed, 700 + i), smats);
      s.group.position.copy(sheetOrigin).add(new Vector3(-9 + i * 3, pose === "vol" ? 2.5 : 0, 16));
      s.group.rotation.y = 0.75;
      if (pose === "vol") s.group.rotation.set(0.5, 0.75, 0, "YXZ");
      if (pose === "accroche") {
        // Pieds contre un pan de mur à sa gauche, « haut » du soldat sortant du mur, regard vers le ciel.
        const wall = new Mesh(new BoxGeometry(0.6, 3.6, 1.6), new MeshStandardMaterial({ color: 0xa39d90, roughness: 0.95 }));
        wall.position.copy(s.group.position).add(new Vector3(-0.3, 1.8, 0));
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);
        s.group.position.add(new Vector3(0, 1.6, 0));
        s.group.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 1, 0)));
      }
      scene.add(s.group);
      sheetSoldiers.push({ s, pose });
    });
  };

  // ——— Caméras ———
  let camMode: CameraMode = "libre";
  let squad = 0;
  const followOffset = new Vector3();
  const followTarget = new Vector3();
  const setCamera = (m: CameraMode, sq = squad): void => {
    camMode = m;
    squad = Math.max(0, Math.min(odm.squadCount - 1, sq));
    camera.fov = 50;
    if (m === "titan") {
      camera.fov = 45;
      camera.position.copy(along(1.22, 7, 3));
      controls.target.copy(along(0.52, 0, 7));
    } else if (m === "dessus") {
      camera.position.copy(crowdOrigin).add(new Vector3(0, 46, 12));
      controls.target.copy(crowdOrigin);
    } else if (m === "planche") {
      buildSheet();
      camera.fov = 42;
      camera.position.copy(sheetOrigin).add(new Vector3(0, 6.5, 36));
      controls.target.copy(sheetOrigin).add(new Vector3(0, 5.5, -16));
    } else if (m === "suivi") {
      // Derrière l'escouade, du côté de la place, légèrement au-dessus : la caméra garde ce décalage et suit le centre.
      odm.update(time, soldierPose);
      const c = odm.squadCenter(squad);
      // Escouade autour du grand Titan : la caméra se place à l'extérieur, dos au Titan. Sinon, côté place, face à l'escouade.
      const tl = titans[1].group.position.clone().setY(c.y);
      const nearTitan = c.distanceTo(tl) < 16;
      const dir = (nearTitan ? c.clone().sub(tl) : along(0.5).setY(c.y).sub(c)).setY(0);
      if (dir.lengthSq() < 1) dir.set(1, 0, 0);
      dir.normalize();
      followTarget.copy(c);
      followOffset.copy(dir).multiplyScalar(nearTitan ? 17 : 14).add(new Vector3(0, nearTitan ? 5 : 6, 0));
      camera.position.copy(c).add(followOffset);
      controls.target.copy(c);
    } else if (camera.position.lengthSq() === 0) {
      camera.position.copy(along(1.25, 34, 38));
      controls.target.copy(along(0.3, 0, 4));
    }
    camera.updateProjectionMatrix();
    controls.update();
    cameraChoice?.set(m);
    squadChoice?.set(String(squad + 1));
    html.dataset["camera"] = m === "suivi" ? `suivi${squad + 1}` : m;
    if (state) {
      state.camera = m;
      state.squad = squad;
    }
  };

  // ——— Qualité ———
  const applyQuality = (q: Quality): void => {
    const d = QUALITY[q];
    if (d.antialias !== QUALITY[quality].antialias || !renderer.domElement.isConnected) {
      // L'anticrénelage se choisit à la création du contexte : on recrée le moteur et on y rebranche les contrôles.
      const old = renderer;
      renderer = makeRenderer(q);
      old.domElement.replaceWith(renderer.domElement);
      controls.disconnect();
      controls.connect(renderer.domElement);
      old.dispose();
      old.forceContextLoss();
      lighting.useEnvironment(renderer);
    }
    quality = q;
    renderer.setPixelRatio(effectivePixelRatio(q, window.devicePixelRatio));
    renderer.shadowMap.enabled = d.shadows;
    lighting.setShadow(d.shadows, d.shadowMap);
    lighting.setLampLimit(d.lamps);
    resize();
    qualityChoice?.set(q);
    html.dataset["qualite"] = q;
    if (state) state.quality = q;
  };

  // ——— Panneau ———
  const panel = document.createElement("aside");
  panel.className = "p3d-panneau";
  const h1 = document.createElement("h1");
  h1.textContent = TX.title;
  const sub = document.createElement("p");
  sub.className = "p3d-sous-titre";
  sub.textContent = TX.subtitle;
  panel.append(h1, sub);
  let cameraChoice: Choice<CameraMode> | null = null;
  let squadChoice: Choice<string> | null = null;
  let qualityChoice: Choice<Quality> | null = null;
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
  cameraChoice = choiceGroup(
    panel,
    TX.camera,
    "camera",
    [
      ["libre", TX.camLibre],
      ["suivi", TX.camSuivi],
      ["titan", TX.camTitan],
      ["dessus", TX.camDessus],
      ["planche", TX.camPlanche],
    ],
    camMode,
    (v) => setCamera(v),
  );
  squadChoice = choiceGroup(
    panel,
    TX.camSuivi,
    "escouade",
    [1, 2, 3, 4].map((n) => [String(n), fill(TX.squad, { n })] as const),
    "1",
    (v) => setCamera("suivi", Number(v) - 1),
  );
  qualityChoice = choiceGroup(
    panel,
    TX.quality,
    "qualite",
    [
      ["bas", TX.qBas],
      ["moyen", TX.qMoyen],
      ["haut", TX.qHaut],
    ],
    quality,
    (v) => applyQuality(v),
  );
  const titanChoices = ([0, 1] as const).map((which) =>
    choiceGroup(
      panel,
      fill(which === 0 ? TX.titanSmall : TX.titanLarge, { h: which === 0 ? TITAN_SMALL.height : TITAN_LARGE.height }),
      `titan${which}`,
      [
        ["marche", TX.poseMarche],
        ["saisie", TX.poseSaisie],
        ["abattu", TX.poseAbattu],
      ],
      titanPoses[which],
      (v) => setTitanPose(which, v),
    ),
  );
  const soldierChoice = choiceGroup(
    panel,
    TX.soldiers,
    "soldats",
    [
      ["auto", "—"],
      ["vol", TX.poseVol],
      ["accroche", TX.poseAccroche],
      ["sol", TX.poseSol],
    ],
    soldierPose ?? "auto",
    (v) => setSoldierPose(v === "auto" ? null : v),
  );
  const crowdChoice = choiceGroup(
    panel,
    TX.crowd,
    "foule",
    [
      ["oui", TX.crowdOn],
      ["non", TX.crowdOff],
    ],
    crowd.visible ? "oui" : "non",
    (v) => setCrowd(v === "oui"),
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
  const seedLink = document.createElement("a");
  const nextSeed = new URL(window.location.href);
  nextSeed.searchParams.set("graine", String(seed + 1));
  seedLink.href = nextSeed.toString();
  seedLink.textContent = `${TX.regenerate} (${TX.seed} ${seed + 1})`;
  seedLink.dataset["action"] = "nouvelle-ville";
  links.append(back, seedLink);
  panel.append(measure, help, links);
  host.append(panel);
  if (params.get("panneau") === "0") panel.hidden = true;

  const setLight = (p: LightPreset): void => {
    light = p;
    lighting.apply(p);
    lightChoice.set(p);
    html.dataset["lumiere"] = p;
    if (state) state.light = p;
  };
  const setTitanPose = (which: 0 | 1, p: TitanPose): void => {
    titanPoses[which] = p;
    titanChoices[which]?.set(p);
  };
  const setSoldierPose = (p: SoldierPose | null): void => {
    soldierPose = p;
    soldierChoice.set(p ?? "auto");
    if (state) state.soldierPose = p;
  };
  const setCrowd = (on: boolean): void => {
    crowd.visible = on;
    crowdChoice.set(on ? "oui" : "non");
    if (state) state.crowd = on;
  };
  window.addEventListener("keydown", (ev) => {
    if (ev.target instanceof HTMLInputElement) return;
    if (ev.code === "KeyH") panel.hidden = !panel.hidden;
    else if (ev.code === "KeyP") paused = !paused;
    else if (ev.code === "KeyF") setCamera("libre");
    else if (ev.code === "KeyT") setCamera("titan");
    else if (ev.code === "KeyD") setCamera("dessus");
    else if (ev.code === "KeyL") setLight(LIGHT_PRESETS[(LIGHT_PRESETS.indexOf(light) + 1) % LIGHT_PRESETS.length] ?? "jour");
    else if (ev.code === "KeyQ") applyQuality(QUALITIES[(QUALITIES.indexOf(quality) + 1) % QUALITIES.length] ?? "moyen");
    else if (/^Digit[1-4]$/.test(ev.code)) setCamera("suivi", Number(ev.code.slice(5)) - 1);
  });

  const resize = (): void => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(host);

  let time = Number(params.get("t") ?? "0") || 0;
  let paused = params.has("pause");
  let held = false;
  const draw = (): void => {
    titans.forEach((t, i) => t.setPose(titanPoses[i as 0 | 1], time));
    for (const e of sheet) e.t.setPose(e.pose, time);
    odm.update(time, soldierPose);
    for (const e of sheetSoldiers) e.s.setPose(e.pose, time);
    updateCrowd(time);
    if (camMode === "suivi") {
      // Suivi : la cible glisse vers le centre de l'escouade, la caméra garde son décalage (l'orbite reste possible).
      const c = odm.squadCenter(squad);
      const delta = c.clone().sub(followTarget).multiplyScalar(0.25);
      followTarget.add(delta);
      camera.position.add(delta);
      controls.target.add(delta);
    }
    controls.update();
    lighting.follow(camera.position);
    renderer.toneMappingExposure = lighting.exposure;
    renderer.render(scene, camera);
    state.frames++;
  };
  const wantedCam = params.get("cam") ?? (params.get("vue") === "planche" ? "planche" : "libre");
  const camMatch = /^suivi([1-4])$/.exec(wantedCam);
  const state: ProtoProbe = {
    ready: false,
    renderer: probe.renderer,
    fps: 0,
    frames: 0,
    light,
    setLight,
    quality,
    setQuality: applyQuality,
    camera: camMode,
    squad,
    setCamera,
    titanPoses,
    setTitanPose,
    soldierPose,
    setSoldierPose,
    crowd: crowd.visible,
    setCrowd,
    time,
    setTime(t) {
      time = t;
      state.time = t;
    },
    pause(p) {
      paused = p;
    },
    hold(h) {
      held = h;
    },
    view: () => ({ camera: v3(camera.position), target: v3(controls.target), squadCenter: v3(odm.squadCenter(squad)) }),
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
        antialias: renderer.getContextAttributes()?.antialias ?? false,
        lamps: QUALITY[quality].lamps,
      };
    },
    frame: () =>
      new Promise((resolve) => {
        draw();
        requestAnimationFrame(() => resolve());
      }),
  };
  window.__proto3d = state;
  html.dataset["lumiere"] = light;
  applyQuality(quality);
  // Vue de départ : au-dessus du marché, vers la place ; puis la caméra demandée.
  camera.position.copy(along(1.25, 34, 38));
  controls.target.copy(along(0.3, 0, 4));
  setCamera(camMatch ? "suivi" : (CAMERA_MODES.find((m) => m === wantedCam) ?? "libre"), camMatch ? Number(camMatch[1]) - 1 : 0);

  let fpsFrames = 0;
  let fpsSince = performance.now();
  let last = performance.now();
  const loop = (now: number): void => {
    if (!paused) time += Math.min(0.1, (now - last) / 1000);
    last = now;
    state.time = time;
    if (!held) draw();
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
    html.dataset["proto3d"] = "pret";
  });
}
