import { ACESFilmicToneMapping, Box3, Color, DirectionalLight, HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PCFShadowMap, PerspectiveCamera, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Scene, TextureLoader, Vector3, WebGLRenderer } from "three";
import type { Object3D } from "three";
import type { WebGLProbe } from "../entry";
import { loadEyeTexture, loadHumanTemplate } from "../humanBase";
import type { HumanPose } from "../humanAnim";
import { buildHumanSoldier } from "../humanSoldier";
import { soldierMaterials } from "../soldier";
import { dressMaterials } from "../bodies";
import { bodyDetailNormals } from "../texturesEnv";
import { puffTexture } from "../textures";
import { photoUrl } from "../photoTextures";
import { TITANS } from "../titanGallery";
import { OUTFITS, PROPORTION_IDS, SKIN_IDS, STATES, gearOf, r3TitanSpec } from "./catalog";
import type { OutfitId } from "./catalog";
import { crowdFigure } from "./crowd";
import type { CrowdPose } from "./crowd";
import { outfitMaterials, outfitOptions } from "./soldier3";
import { buildFigureTitan, titanSkinTexture } from "./titan3";
import type { FigureTitan } from "./titan3";
import type { ShowMemory, TitanShow } from "./states";

/**
 * Planches de R3 (`?proto3d=figures&planche=titans|soldats|poses`) : Titans de 3 à 15 m (3 variantes de proportions, peaux
 * alternées), 5 tenues (figure complète et figure de foule), poses et états. Sonde `<html data-ready="true">` et
 * `data-figures` (nombre de figures) pour `smoke:r3`.
 */
const mem = (state: TitanShow, prev: TitanShow = state, deadAt: number | null = null): ShowMemory<TitanShow> => ({ state, prev, since: -100, x: 0, y: 0, still: 0, speed: 0, deadAt, cutAt: null, cut: 0 });
const NO_CUT = { armL: 0, armR: 0, legs: 0 };

interface Label {
  text: string;
  at: Vector3;
}

export async function startPlanche(root: HTMLElement, probe: WebGLProbe): Promise<void> {
  const html = document.documentElement;
  const which = new URLSearchParams(window.location.search).get("planche") ?? "titans";
  const [template, eyeMap] = await Promise.all([loadHumanTemplate(), loadEyeTexture()]);
  const host = document.createElement("div");
  host.className = "p3d";
  host.style.position = "fixed";
  host.style.inset = "0";
  root.replaceChildren(host);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setPixelRatio(1);
  host.append(renderer.domElement);
  const scene = new Scene();
  scene.background = new Color(0xb9c6cf);
  scene.add(new HemisphereLight(0xe2ebf2, 0x6b6350, 1.4));
  const sun = new DirectionalLight(0xfff1dc, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun, sun.target);
  const groundMat = new MeshStandardMaterial({ color: 0x8a8070, roughness: 1 });
  const ground = new Mesh(new PlaneGeometry(400, 200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  new TextureLoader().load(photoUrl("forrest_ground_01", "diff"), (tex) => {
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(100, 50);
    groundMat.map = tex;
    groundMat.color.set(0xc8c0b0);
    groundMat.needsUpdate = true;
  });
  const detail = bodyDetailNormals(850);
  const labels: Label[] = [];
  const add = (o: Object3D): void => {
    o.traverse((x) => {
      x.castShadow = true;
    });
    scene.add(o);
  };
  const puff = puffTexture();
  const skins = new Map(SKIN_IDS.map((id) => [id, titanSkinTexture(id, 850)]));
  const titan = (cls: string, prop: string, skin: string, seed: number): FigureTitan => {
    const f = buildFigureTitan(r3TitanSpec(cls, prop, skin), seed, { template, eyeMap, skinMap: skins.get(skin) ?? null, skinNormal: detail.skin });
    f.setSteamMap(puff);
    add(f.inner.group);
    return f;
  };
  const mats = new Map<OutfitId, ReturnType<typeof soldierMaterials>>();
  const soldier = (o: OutfitId, troop: boolean, seed: number): ReturnType<typeof buildHumanSoldier> => {
    let m = mats.get(o);
    if (!m) {
      m = outfitMaterials(soldierMaterials(), o);
      dressMaterials(m, detail);
      mats.set(o, m);
    }
    const s = buildHumanSoldier(template, seed, m, { eyeMap, outfit: outfitOptions(o, gearOf(o, troop)), height: 1.76, gender: 1 });
    add(s.group);
    return s;
  };
  const crowd = (o: OutfitId, troop: boolean, pose: CrowdPose, x: number, z: number): void => {
    const g = crowdFigure(o, gearOf(o, troop), pose);
    const m = new InstancedMesh(g, new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), 1);
    m.setMatrixAt(0, new Matrix4().makeTranslation(x, 0, z));
    m.castShadow = true;
    scene.add(m);
  };
  const cam = new PerspectiveCamera(32, 1, 0.5, 2000);
  let look = new Vector3();
  /** Cadre de la planche (figures seules). */
  const fit = new Box3();
  let count = 0;
  const T = 0.6;
  if (which === "titans") {
    // 5 classes × 3 variantes de proportions ; peaux alternées (chaque taille montre les 3 peaux) ; un soldat pour l'échelle.
    let x = 0;
    TITANS.classes.forEach((c, ci) => {
      PROPORTION_IDS.forEach((p, pi) => {
        const skin = SKIN_IDS[(ci + pi) % SKIN_IDS.length] as string;
        const f = titan(c.id, p, skin, 850 + ci * 3 + pi);
        const w = Math.max(1.6, c.hauteur_m * 0.42);
        x += w / 2;
        f.inner.group.position.set(x, 0, 0);
        f.inner.group.rotation.y = 0.35;
        f.show(mem(pi === 1 ? "marche" : "repos"), T + pi, NO_CUT, false);
        if (pi === 1) labels.push({ text: `${c.hauteur_m} m`, at: new Vector3(x, -0.6, 2) });
        x += w / 2 + 0.3;
        count++;
      });
      x += 1.2;
    });
    labels.push({ text: "de gauche à droite, à chaque taille : trapu, échalas, difforme ; peaux chair, cireuse, tannée en alternance", at: new Vector3(x / 2, -3.2, 2) });
    fit.set(new Vector3(-2.5, -3, -1), new Vector3(x, 15.5, 1));
    const s = soldier("bataillon", false, 5);
    s.group.position.set(-1.4, 0, 1.5);
    s.setPose("attente", 0);
    labels.push({ text: "soldat", at: new Vector3(-1.6, -1.6, 2) });
  } else if (which === "soldats") {
    // Les 5 tenues : figure complète au repos, en action, et figure de foule (niveau de détail lointain).
    OUTFITS.forEach((o, i) => {
      const troop = o.id !== "bataillon";
      const x = i * 3.2;
      const a = soldier(o.id, troop, 20 + i);
      a.group.position.set(x - 0.6, 0, 0);
      a.group.rotation.y = 0.45;
      a.setPose("attente", 0.2);
      const b = soldier(o.id, troop, 40 + i);
      b.group.position.set(x + 0.6, 0, -0.4);
      b.group.rotation.y = troop ? 0.9 : 0.3;
      b.setPose(troop ? (o.id === "marley_officier" ? "marche" : "tir") : "sol", 0.4);
      crowd(o.id, troop, "attente", x, -3.2);
      labels.push({ text: OUTFIT_LABEL[o.id], at: new Vector3(x, -0.15, 1.2) });
      count += 3;
    });
    fit.set(new Vector3(-1.4, -0.4, -3.5), new Vector3(14.4, 2.1, 0.5));
  } else {
    // Poses et états : un Titan de 8 m (« trapu »), puis soldats et fantassins.
    const states: [TitanShow, string, ShowMemory<TitanShow>, number, typeof NO_CUT, boolean][] = [
      ["repos", "repos", mem("repos"), T, NO_CUT, false],
      ["marche", "marche", mem("marche"), T, NO_CUT, false],
      ["course", "course", mem("course"), T, NO_CUT, false],
      ["saisie", "saisie", mem("saisie"), T, NO_CUT, false],
      ["devore", "dévoration", mem("devore"), T, NO_CUT, false],
      ["rampant", "jambes coupées", mem("rampant"), T, { armL: 0, armR: 0, legs: 5 }, false],
      ["chute", "chute", mem("chute", "marche", 0), STATES.chute_s * 0.4, NO_CUT, true],
      ["abattu", "nuque tranchée", mem("abattu", "chute", 0), 6, NO_CUT, true],
    ];
    states.forEach(([, text, m, time, cuts, nape], i) => {
      const f = titan("classe_8", i % 2 === 0 ? "trapu" : "difforme", SKIN_IDS[i % SKIN_IDS.length] as string, 900 + i);
      const lying = m.state === "abattu" || m.state === "chute" || m.state === "rampant";
      const x = i * 7 + (i > 5 ? (i - 5) * 3 : 0);
      f.inner.group.position.set(x, 0, lying ? -4 : 0);
      f.inner.group.rotation.y = lying ? 0.35 : 0.5;
      f.show(m, time, cuts, nape);
      labels.push({ text, at: new Vector3(x, -0.6, 3) });
      count++;
    });
    const men: [OutfitId, boolean, HumanPose, string][] = [
      ["bataillon", false, "sol", "garde"],
      ["bataillon", false, "frappe", "coupe"],
      ["bataillon", false, "vol", "vol"],
      ["bataillon", false, "chute", "chute"],
      ["bataillon", false, "mort", "mort"],
      ["marley_infanterie", true, "marche", "marche"],
      ["marley_infanterie", true, "tir", "tir"],
      ["marley_infanterie", true, "mort", "mort"],
    ];
    men.forEach(([o, troop, pose, text], i) => {
      const s = soldier(o, troop, 60 + i);
      const x = 8 + i * 4.2;
      s.group.position.set(x, pose === "vol" || pose === "chute" ? 1.2 : 0, 16);
      s.group.rotation.y = 0.5;
      s.setPose(pose, 0.3);
      labels.push({ text: `${o === "bataillon" ? "Bataillon" : "Marley"} : ${text}`, at: new Vector3(x, -0.1, 17) });
      count++;
    });
    fit.set(new Vector3(-4, -1, -4), new Vector3(62, 9, 17));
  }
  sun.position.set(look.x + 30, 60, 50);
  sun.target.position.copy(look);
  const sc = sun.shadow.camera;
  sc.left = -80;
  sc.right = 80;
  sc.top = 60;
  sc.bottom = -60;
  sc.updateProjectionMatrix();
  // Étiquettes en surimpression.
  const layer = document.createElement("div");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;font:600 13px/1.2 system-ui,sans-serif;color:#1f1d1a";
  host.append(layer);
  // Cadrage : toutes les figures (boîte englobante, sol exclu) tiennent dans l'image, vues de face, un peu d'en haut.
  const box = fit;
  const draw = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    const size = box.getSize(new Vector3());
    const c = box.getCenter(new Vector3());
    const vf = (cam.fov * Math.PI) / 360;
    const hf = Math.atan(Math.tan(vf) * cam.aspect);
    const dist = Math.max(size.x / 2 / Math.tan(hf), (size.y * 0.62) / Math.tan(vf)) * 1.08 + size.z / 2;
    look = new Vector3(c.x, c.y * 0.92, c.z);
    cam.position.set(c.x, c.y + dist * 0.16, c.z + dist);
    cam.lookAt(look);
    renderer.render(scene, cam);
    layer.replaceChildren(
      ...labels.map((l) => {
        const v = l.at.clone().project(cam);
        const d = document.createElement("div");
        d.textContent = l.text;
        d.style.cssText = `position:absolute;left:${((v.x + 1) / 2) * w}px;top:${((1 - v.y) / 2) * h}px;transform:translate(-50%,0);background:rgba(240,236,228,.82);padding:2px 6px;border-radius:3px;white-space:nowrap`;
        return d;
      }),
    );
  };
  window.addEventListener("resize", draw);
  draw();
  // Deuxième image (texture du sol chargée).
  window.setTimeout(() => {
    draw();
    html.dataset["figures"] = String(count);
    html.dataset["webgl"] = probe.renderer || "webgl2";
    html.dataset["ready"] = "true";
  }, 1200);
}

const OUTFIT_LABEL: Record<OutfitId, string> = {
  bataillon: "Bataillon d'exploration",
  garnison: "Garnison",
  brigade: "Brigades spéciales",
  marley_infanterie: "Infanterie de Marley",
  marley_officier: "Officier de Marley",
};

