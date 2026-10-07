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
import { loadBodyKit, makeSoldier, makeTitan } from "./bodies";
import type { BodyKit } from "./bodies";
import { applyLite, precompile } from "./lite";
import { applyPhotoTextures, loadPhotoTextures, photoCounts } from "./photoTextures";
import type { Matiere } from "./photoTextures";
import { createPost } from "./post";
import type { PostChain } from "./post";
import { TX, fill } from "./texts";
import { puffTexture, skinTexture } from "./textures";
import { TITAN_LARGE, TITAN_POSES, TITAN_SMALL, setSteamTexture } from "./titan";
import type { Titan, TitanPose } from "./titan";
import { generateTown } from "./town";
import { buildTownMeshes } from "./townMesh";
import { buildVegetation } from "./meshVegetation";
import { MATERIALS } from "./styles";
import { leafTex } from "./texturesEnv";

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
 * R1d, latence en deux temps : la première image (« prêt », `data-proto3d="pret"`) montre la ville avec les soldats et les
 * Titans en repères simplifiés (figures en primitives de R1) ; le corps de base est ensuite chargé, les corps détaillés façonnés
 * par morceaux puis échangés (« corps », `data-corps3d="pret"`). `?corps=primitives` : les repères restent.
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
  stats(): { calls: number; triangles: number; geometries: number; textures: number; programs: number; width: number; height: number; pixelRatio: number; shadows: boolean; antialias: boolean; lamps: number };
  /**
   * Temps de mise en place (ms) : début (de la navigation à l'entrée dans la page), ville et lumière, Titans et soldats en
   * repères, réglages (qualité, caméra, panneau) ; puis la première image : poses, rendu (compilation des shaders comprise) ;
   * `pret` : instant « prêt » depuis la navigation.
   * R1d, second temps : `chargementCorps` (corps de base téléchargé et préparé), `faconnage` (corps détaillés), `corps` : instant
   * de la première image avec les corps détaillés, depuis la navigation (0 tant qu'ils ne sont pas là, −1 en repli).
   * Textures de Poly Haven : `chargementPhotos` (chargées et posées), `photos` : instant de la première image qui les montre
   * (−1 en repli : les textures procédurales restent).
   */
  timings: { debut: number; ville: number; titans: number; soldats: number; reglages: number; poses: number; premiereImage: number; pret: number; chargementCorps: number; faconnage: number; corps: number; chargementPhotos: number; photos: number };
  /** R1d : matériaux passés aux textures de Poly Haven, par matière. */
  photos: Partial<Record<Matiere, number>>;
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
  const t0 = performance.now();
  const host = document.createElement("div");
  host.className = "p3d";
  root.replaceChildren(host);
  const html = document.documentElement;
  // R1d : repères simplifiés (figures de R1) pour la première image ; corps de base MakeHuman (CC0) ensuite.
  let kit: BodyKit = { template: null, eyeMap: null, reason: "reperes" };
  html.dataset["corps"] = "reperes";

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
  let post: PostChain | null = null;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;

  // ——— Ville, lumière ———
  const seedParam = Number(params.get("graine"));
  const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : 850;
  const town = generateTown(seed);
  const townMeshes = buildTownMeshes(town, seed);
  scene.add(townMeshes.group);
  // R1d : arbres réalistes des environnements (bois, massifs, cartes de feuilles) à la place des icosaèdres de R1 ; les cartes
  // de feuilles sont cachées en qualité basse (`applyLite`).
  const townTrees = buildVegetation(
    townMeshes.trees,
    null,
    { leaf: [MATERIALS.physiques.feuillage, MATERIALS.physiques.feuillage_clair], conifer: MATERIALS.physiques.conifere, bush: MATERIALS.physiques.feuillage },
    { near: 400, far: 4000, density: 1, shadows: true },
    leafTex(seed),
  );
  scene.add(townTrees.group);
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
  // Qualité basse allégée (R1d) : réglée avant la première carte d'environnement, pour ne pas la calculer pour rien.
  lighting.setLite(quality === "bas");
  lighting.useEnvironment(renderer);
  lighting.apply(light);
  const tTown = performance.now();

  // ——— Titans ———
  const skinMap = skinTexture(seed);
  const puff = puffTexture();
  // Le grand sur la rue qui traverse la place, le petit dans le marché du sud ; tous deux tournés vers le sud.
  const face = (o: Vector3, to: Vector3): number => Math.atan2(to.x - o.x, to.z - o.z);
  const placeTitans = (ts: [Titan, Titan]): void => {
    for (const t of ts) {
      setSteamTexture(t, puff);
      scene.add(t.group);
    }
    ts[1].group.position.copy(along(0.5, 2));
    // Tourné de trois quarts vers le sud-est de la place : la saisie se lit de côté depuis la vue Titan.
    ts[1].group.rotation.y = face(ts[1].group.position, along(1.0, 26));
    ts[0].group.position.copy(along(0.84, -3));
    ts[0].group.rotation.y = face(ts[0].group.position, along(1.1, 6));
  };
  let titans: [Titan, Titan] = [makeTitan(kit, TITAN_SMALL, seed, skinMap), makeTitan(kit, TITAN_LARGE, seed, skinMap)];
  placeTitans(titans);
  const tTitans = performance.now();
  const wantedPoses = (params.get("poses") ?? "").split(",");
  const titanPoses: [TitanPose, TitanPose] = [TITAN_POSES.find((p) => p === wantedPoses[0]) ?? "marche", TITAN_POSES.find((p) => p === wantedPoses[1]) ?? "marche"];

  // ——— Soldats : 4 escouades autour des Titans ; foule de 300 au sud-est, hors de la ville ———
  const smats = soldierMaterials();
  /** Les 20 soldats et leurs câbles : repères (figures de R1), ou corps détaillés tirés d'un lot préparé par morceaux. */
  const makeOdm = (k: BodyKit, ready: Map<number, SoldierLike> | null) =>
    buildOdm(town, seed, smats, puff, {
      plaza: along(0, 0),
      market: along(1, 0),
      titanLarge: titans[1].group,
      titanSmall: titans[0].group.position.clone(),
      largeShoulders: [titans[1].joints.epauleG, titans[1].joints.epauleD],
      ...(k.template ? { makeSoldier: (sd: number) => ready?.get(sd) ?? makeSoldier(k, sd, smats) } : {}),
    });
  let odm = makeOdm(kit, null);
  scene.add(odm.group);
  const tSoldiers = performance.now();
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
  const sheet: { t: Titan; pose: TitanPose }[] = [];
  const sheetSoldiers: { s: SoldierLike; pose: SoldierPose }[] = [];
  const sheetWalls: Mesh[] = [];
  /** R1d : la planche est refaite avec les corps détaillés quand ils arrivent. */
  const clearSheet = (): void => {
    for (const e of sheet) {
      scene.remove(e.t.group);
      e.t.dispose();
    }
    for (const e of sheetSoldiers) scene.remove(e.s.group);
    for (const w of sheetWalls) scene.remove(w);
    sheet.length = 0;
    sheetSoldiers.length = 0;
    sheetWalls.length = 0;
  };
  const buildSheet = (): void => {
    if (sheet.length > 0) return;
    TITAN_POSES.forEach((pose, i) => {
      for (const [spec, row, gap, shift] of [[TITAN_SMALL, 0, 15, -5], [TITAN_LARGE, -38, 27, 7]] as const) {
        const t = makeTitan(kit, spec, seed, skinMap);
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
        sheetWalls.push(wall);
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
    if (q !== quality || !post) {
      post?.dispose();
      post = createPost(scene, camera, q);
    }
    quality = q;
    renderer.setPixelRatio(effectivePixelRatio(q, window.devicePixelRatio));
    renderer.shadowMap.enabled = d.shadows;
    lighting.setShadow(d.shadows, d.shadowMap);
    // R1d : qualité basse allégée (sans éclairage d'image, ciel peint, sans relief ni cartes de feuilles).
    lighting.setLite(q === "bas");
    applyLite(scene, q === "bas");
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
  let posed = 0;
  /** R1d : les corps détaillés viennent d'être échangés ; la prochaine image dessinée marque l'instant « corps ». */
  let corpsPending = false;
  /** R1d : les textures de Poly Haven viennent d'être posées ; la prochaine image marque l'instant « photos ». */
  let photoPending = false;
  const draw = (): void => {
    titans.forEach((t, i) => t.setPose(titanPoses[i as 0 | 1], time));
    for (const e of sheet) e.t.setPose(e.pose, time);
    odm.update(time, soldierPose);
    for (const e of sheetSoldiers) e.s.setPose(e.pose, time);
    updateCrowd(time);
    posed = performance.now();
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
    // R1c : occlusion ambiante et sortie (post-traitement) selon la qualité ; rendu direct en qualité basse.
    if (post) {
      const size = renderer.getDrawingBufferSize(new Vector2());
      post.render(renderer, size.x, size.y);
    } else renderer.render(scene, camera);
    state.frames++;
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
        calls: (post?.sceneInfo ?? renderer.info.render).calls,
        triangles: (post?.sceneInfo ?? renderer.info.render).triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
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
    timings: { debut: t0, ville: tTown - t0, titans: tTitans - tTown, soldats: tSoldiers - tTitans, reglages: 0, poses: 0, premiereImage: 0, pret: 0, chargementCorps: 0, faconnage: 0, corps: 0, chargementPhotos: 0, photos: 0 },
    photos: {},
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
      const s = post?.sceneInfo ?? renderer.info.render;
      measure.textContent = fill(TX.stats, { fps: state.fps.toFixed(1), calls: s.calls, tris: Math.round(s.triangles / 1000) });
    }
    requestAnimationFrame(loop);
  };
  /**
   * R1d, second temps : corps de base chargé, Titans puis soldats façonnés par morceaux (l'image continue entre deux
   * morceaux), puis échangés d'un coup avec les repères ; les câbles sont refaits sur les nouveaux corps (mêmes graines, mêmes
   * places). Les shaders des nouveaux matériaux sont compilés avant l'échange.
   */
  const upgradeBodies = async (): Promise<void> => {
    const s0 = performance.now();
    const full = await loadBodyKit(window.location.search);
    state.timings.chargementCorps = performance.now() - s0;
    if (!full.template) {
      state.timings.corps = -1;
      html.dataset["corps3d"] = "repli";
      startPhotos();
      return;
    }
    const s1 = performance.now();
    const breathe = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
    const small = makeTitan(full, TITAN_SMALL, seed, skinMap);
    await breathe();
    const large = makeTitan(full, TITAN_LARGE, seed, skinMap);
    await breathe();
    const ready = new Map<number, SoldierLike>();
    for (let i = 0; i < 20; i++) {
      const sd = derive(seed, 50 + i);
      ready.set(sd, makeSoldier(full, sd, smats));
      if (i % 4 === 3) await breathe();
    }
    for (const t of titans) {
      scene.remove(t.group);
      t.dispose();
    }
    titans = [small, large];
    placeTitans(titans);
    scene.remove(odm.group);
    odm.dispose();
    kit = full;
    odm = makeOdm(kit, ready);
    scene.add(odm.group);
    html.dataset["corps"] = kit.reason.split(" ")[0] ?? "";
    if (sheet.length > 0) {
      clearSheet();
      buildSheet();
    }
    if (camMode === "suivi") setCamera("suivi", squad);
    applyLite(scene, quality === "bas");
    await precompile(renderer, scene, camera);
    state.timings.faconnage = performance.now() - s1;
    corpsPending = true;
    startPhotos();
  };

  /**
   * R1d : textures de Poly Haven (pavés, sol, enceinte, tuiles, ardoise) chargées en dernier — après les corps détaillés, pour ne
   * retarder ni « prêt » ni « corps » (décodage et envoi des images occupent le fil principal) — et posées à la place des
   * textures procédurales étiquetées ; en cas d'échec, celles-ci restent (repli). `?textures=procedurales` : pas de photos.
   */
  const startPhotos = (): void => {
    if (params.get("textures") === "procedurales") html.dataset["photo3d"] = "procedurales";
    else void upgradePhotos();
  };
  const upgradePhotos = async (): Promise<void> => {
    const s0 = performance.now();
    try {
      const photos = await loadPhotoTextures();
      applyPhotoTextures(scene, photos, quality === "bas");
      state.photos = photoCounts(scene);
      await precompile(renderer, scene, camera);
      state.timings.chargementPhotos = performance.now() - s0;
      photoPending = true;
    } catch {
      state.timings.photos = -1;
      html.dataset["photo3d"] = "repli";
    }
  };

  requestAnimationFrame((now) => {
    const t = performance.now();
    state.timings.reglages = t - tSoldiers;
    loop(now);
    state.timings.poses = posed - t;
    state.timings.premiereImage = performance.now() - t;
    state.timings.pret = performance.now();
    state.ready = true;
    html.dataset["proto3d"] = "pret";
    if (params.get("corps") === "primitives") {
      html.dataset["corps"] = "primitives";
      html.dataset["corps3d"] = "primitives";
      startPhotos();
    } else void upgradeBodies();
  });
}
