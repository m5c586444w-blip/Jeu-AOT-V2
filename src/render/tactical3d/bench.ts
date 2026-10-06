import { ACESFilmicToneMapping, BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, PCFShadowMap, PerspectiveCamera, PlaneGeometry, SRGBColorSpace, Scene, Vector2, Vector3, WebGLRenderer } from "three";
import type { WebGLProbe } from "./entry";
import { straightWall, wallLayout } from "./envWall";
import { createLighting } from "./lighting";
import { phys } from "./meshProps";
import { buildWallMeshes } from "./meshWall";
import { measureBox, measureHeight } from "./rig";
import { buildSoldier, soldierHeight, soldierMaterials, SOLDIER_HEIGHT_M } from "./soldier";
import { MATERIALS, WALLS } from "./styles";
import { TX } from "./texts";
import { puffTexture, skinTexture } from "./textures";
import { wallStoneTex } from "./texturesEnv";
import { buildTitan, setSteamTexture } from "./titan";
import type { Titan } from "./titan";
import { SOLDIER_BENCH_M, TITAN_CLASS_IDS, defaultPose, titanSpec, variantSpec } from "./titanGallery";

/**
 * Banc d'échelle (R1b.6) : `?proto3d&env=banc`. Soldat de 1,7 m, Titans de 3, 5, 8, 12 et 15 m, les cinq variantes, Colossal
 * 60 m, un pan de mur de 50 m avec le Titan-Mur en buste dans une brèche, Titan de Rod Reiss 120 m allongé, et une toise
 * graduée tous les 5 m. Deux vues : l'alignement complet en haut, les petites tailles en bas. Les étiquettes donnent les
 * hauteurs MESURÉES sur la géométrie posée.
 */
export interface BenchProbe {
  ready: boolean;
  figures: { id: string; nominal: number; measured: number }[];
  hold(h: boolean): void;
  frame(): Promise<void>;
}

declare global {
  interface Window {
    __banc3d?: BenchProbe;
  }
}

interface Fig {
  id: string;
  label: string;
  nominal: number;
  measured: number;
  x: number;
  top: number;
}

export async function startBench(root: HTMLElement, probe: WebGLProbe): Promise<void> {
  const host = document.createElement("div");
  host.className = "p3d";
  root.replaceChildren(host);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  host.append(renderer.domElement);
  const scene = new Scene();
  const skin = skinTexture(850);
  const puff = puffTexture();

  // Sol clair quadrillé tous les 5 m (lignes en relief très léger).
  const ground = new Mesh(new PlaneGeometry(1400, 500), new MeshStandardMaterial({ color: new Color(MATERIALS.sols.route.base).multiplyScalar(1.25), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(260, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);
  const gridMat = new MeshStandardMaterial({ color: new Color(MATERIALS.physiques.suie), roughness: 1 });
  for (let x = -20; x <= 560; x += 5) {
    const l = new Mesh(new BoxGeometry(0.12, 0.02, 120), gridMat);
    l.position.set(x, 0.01, 0);
    scene.add(l);
  }

  const figs: Fig[] = [];
  const titans: Titan[] = [];
  const place = (t: Titan, x: number, z: number, pose: Parameters<Titan["setPose"]>[0], label: string, nominal: number, rotY = 0.6): void => {
    t.group.position.set(x, 0, z);
    t.group.rotation.y = rotY;
    scene.add(t.group);
    t.group.updateMatrixWorld(true);
    t.setPose("debout", 0);
    const measured = measureHeight(t.body);
    t.setPose(pose, 0.6);
    setSteamTexture(t, puff);
    titans.push(t);
    figs.push({ id: t.spec.id, label, nominal, measured, x, top: Math.max(measureBox(t.body).max.y, 2) });
  };
  // Soldat de 1,7 m (même modèle que R1, ramené à 1,7 m).
  const smats = soldierMaterials();
  const soldier = buildSoldier(3, smats);
  soldier.group.scale.setScalar(SOLDIER_BENCH_M / SOLDIER_HEIGHT_M);
  soldier.group.position.set(-6, 0, 6);
  soldier.group.rotation.y = 0.5;
  soldier.setPose("sol", 0);
  scene.add(soldier.group);
  figs.push({ id: "soldat", label: "soldat", nominal: SOLDIER_BENCH_M, measured: soldierHeight(soldier), x: -6, top: 2 });
  let x = 0;
  for (const id of TITAN_CLASS_IDS) {
    const spec = titanSpec(id);
    x += Math.max(4, spec.height * 0.55);
    place(buildTitan(spec, 850, skin), x, 0, "debout", `${spec.height} m`, spec.height);
    x += Math.max(4, spec.height * 0.55);
  }
  x += 8;
  for (const v of ["anormal", "sentinelle", "chasseur", "nocturne"]) {
    const spec = variantSpec(v);
    x += spec.height * 0.6;
    place(buildTitan(spec, 851, skin), x, 0, defaultPose("", v), v, spec.height);
    x += spec.height * 0.6;
  }
  // Meute : cinq Titans de 5 m, graines différentes.
  x += 6;
  for (let k = 0; k < 5; k++) {
    const t = buildTitan(variantSpec("meute"), 900 + k, skin);
    place(t, x + k * 4.5, (k % 2) * 6 - 3, "marche", k === 2 ? "meute" : "", 5, 0.3 * k);
    if (k !== 2) figs.pop();
  }
  x += 40;
  const col = buildTitan(titanSpec("colossal"), 852, skin);
  place(col, x + 20, 0, "debout", "Colossal", 60, 0.3);
  x += 70;
  // Pan de mur de 50 m avec une brèche ; le Titan-Mur en buste, dans l'épaisseur du mur.
  const wallX = x + 40;
  const layout = wallLayout([straightWall(45, 0, 1, [], [{ s: 45, width: 22, face: true, floor: WALLS.hauteur_m.valeur - 22 }])]);
  const wm = buildWallMeshes(layout, () => 0, wallStoneTex(850), 850);
  const wallGroup = new Group();
  for (const m of wm.meshes) wallGroup.add(m);
  wallGroup.position.set(wallX, 0, 0);
  scene.add(wallGroup);
  figs.push({ id: "mur", label: "mur", nominal: WALLS.hauteur_m.valeur, measured: (wm.meshes[0] ? measureBox(wm.meshes[0]).max.y : 0) - WALLS.parapet_m.valeur, x: wallX - 30, top: 52 });
  const mur = buildTitan(titanSpec("titan_mur"), 853, skin);
  place(mur, wallX, 0, "buste", "Titan-Mur (buste)", 50, Math.PI);
  mur.group.rotation.y = 0;
  mur.setPose("buste", 0);
  x = wallX + 70;
  const rod = buildTitan(titanSpec("rod_reiss"), 854, skin);
  place(rod, x, -20, "allonge", "Titan de Rod Reiss (allongé)", 120, Math.PI / 2);
  // Toise : bandes alternées tous les 5 m, jusqu'à 125 m.
  const pole = new Group();
  for (let y = 0; y < 125; y += 5) {
    const band = new Mesh(new BoxGeometry(1.2, 5, 1.2), new MeshStandardMaterial({ color: (y / 5) % 2 ? phys("toile_claire") : new Color(MATERIALS.accents[1] ?? MATERIALS.physiques.braise), roughness: 0.8 }));
    band.position.set(0, y + 2.5, 0);
    pole.add(band);
  }
  pole.position.set(-14, 0, -6);
  scene.add(pole);

  const lighting = createLighting(scene, 850, { windowMaterials: [], lanternMaterial: new MeshStandardMaterial(), lamps: [], center: new Vector3(220, 0, 0), shadowExtent: 340, fogScale: 0.15 });
  lighting.apply("jour");
  lighting.setShadow(true, 2048);
  for (const t of [...titans]) t.group.traverse((o) => {
    o.castShadow = true;
  });

  const camTop = new PerspectiveCamera(30, 2, 1, 6000);
  camTop.position.set(245, 55, 455);
  camTop.lookAt(new Vector3(245, 32, 0));
  const camLow = new PerspectiveCamera(30, 2, 0.5, 4000);
  camLow.position.set(28, 9, 92);
  camLow.lookAt(new Vector3(26, 6, 0));

  // Étiquettes (hauteur mesurée), projetées dans chaque vue.
  const labels = figs.filter((f) => f.label).map((f) => {
    const el = document.createElement("div");
    el.className = "p3d-planche-etiquette";
    el.style.margin = "0";
    el.style.transform = "translate(-50%, -100%)";
    el.textContent = `${f.label} : ${f.measured.toFixed(2)} m`;
    host.append(el);
    return { f, el, el2: ((): HTMLElement => {
      const e2 = el.cloneNode(true) as HTMLElement;
      host.append(e2);
      return e2;
    })() };
  });
  const title = document.createElement("div");
  title.className = "p3d-planche-titre";
  title.textContent = `${TX.benchTitle} — soldat ${SOLDIER_BENCH_M} m · Titans 3–15 m, variantes, Colossal 60 m, mur 50 m et Titan-Mur, Rod Reiss 120 m · toise : bandes de 5 m`;
  host.append(title);

  const resize = (): void => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
  };
  new ResizeObserver(resize).observe(host);
  resize();
  let held = false;
  const project = (cam: PerspectiveCamera, p: Vector3, x0: number, y0: number, w: number, h: number): [number, number, boolean] => {
    const v = p.clone().project(cam);
    return [x0 + ((v.x + 1) / 2) * w, y0 + ((1 - v.y) / 2) * h, v.z < 1 && Math.abs(v.x) <= 1.05 && Math.abs(v.y) <= 1.05];
  };
  const draw = (): void => {
    const size = renderer.getSize(new Vector2());
    const w = size.x;
    const h = Math.floor(size.y / 2);
    renderer.setScissorTest(true);
    for (const [cam, y] of [
      [camTop, h],
      [camLow, 0],
    ] as const) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      renderer.setViewport(0, y, w, h);
      renderer.setScissor(0, y, w, h);
      lighting.follow(cam.position);
      renderer.toneMappingExposure = lighting.exposure;
      renderer.render(scene, cam);
    }
    renderer.setScissorTest(false);
    const rect = renderer.domElement.getBoundingClientRect();
    const sx = rect.width / w;
    for (const { f, el, el2 } of labels) {
      const p = new Vector3(f.x, f.top + 1.5, 0);
      const [ax, ay, av] = project(camTop, p, 0, 0, w, h);
      const [bx, by, bv] = project(camLow, p, 0, h, w, h);
      el.style.left = `${ax * sx}px`;
      el.style.top = `${ay * sx}px`;
      el.hidden = !av || f.nominal < 20;
      el2.style.left = `${bx * sx}px`;
      el2.style.top = `${by * sx}px`;
      el2.hidden = !bv || f.nominal >= 20;
    }
  };
  const state: BenchProbe = {
    ready: false,
    figures: figs.map((f) => ({ id: f.id, nominal: f.nominal, measured: f.measured })),
    hold(hh) {
      held = hh;
    },
    frame: () =>
      new Promise((resolve) => {
        draw();
        requestAnimationFrame(() => resolve());
      }),
  };
  window.__banc3d = state;
  const loop = (): void => {
    if (!held) draw();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(() => {
    loop();
    state.ready = true;
    document.documentElement.dataset["proto3d"] = "pret";
  });
  void probe;
}
