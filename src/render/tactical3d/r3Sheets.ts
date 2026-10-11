import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PointLight, Vector3 } from "three";
import type { PointsMaterial, Scene, Texture } from "three";
import type { LightPreset } from "./lighting";
import { skinnedBounds } from "./humanBase";
import type { HumanTemplate } from "./humanBase";
import { buildEmblem } from "./emblems";
import type { EmblemId } from "./emblems";
import { buildHumanSoldier, regionBounds } from "./humanSoldier";
import type { HumanSoldier } from "./humanSoldier";
import { buildHumanTitan } from "./humanTitan";
import type { HumanTitan } from "./humanTitan";
import type { HumanPose } from "./humanAnim";
import { FIGURES_R3, OUTFIT_IDS, R3_CLASS_IDS, outfit, r3TitanSpec, troopLook } from "./figuresR3";
import type { Outfit, SkinId, TitanVariantId } from "./figuresR3";
import { dressMaterials } from "./bodies";
import { soldierMaterials } from "./soldier";
import { setSteamTexture } from "./titan";
import type { TitanPose } from "./titan";
import { puffTexture, titanSkinTexture } from "./textures";

/**
 * Planches de contrôle de R3 (`?proto3d=humain&planche=r3-titans|r3-visages|r3-soldats|r3-poses`) :
 * - r3-titans : les 15 corps à l'échelle (3 à 15 m), peaux alternées, un soldat de 1,7 m pour l'échelle ;
 * - r3-visages : six têtes de Titans de près (dents, yeux, expressions, deux peaux) ;
 * - r3-soldats : les sept tenues de face, puis de dos ;
 * - r3-uniformes (dette n° 72) : les quatre corps de Paradis de dos et de trois quarts, emblèmes agrandis au-dessus, et la
 *   cape sous la pluie (capuche levée), et la tenue de 854 (lances de foudre, équipement anti-personnel) ;
 * - r3-ceremonie (dette n° 72) : recrues en rangs au salut, un instructeur face à elles ;
 * - r3-fantassins (dette n° 62) : officiers de Paradis (Garnison, Brigade Militaire), Marley, Alliés et Hizuru ;
 * - r3-medailles (dette n° 72) : remise des médailles par la reine Historia dans la salle d'audience du palais ;
 * - r3-poses : soldats (marche, course, chute, coupe, tir, recharge, commandement, mort) et Titans ramenés à 2,4 m (marche, course, attaque,
 *   effondrement, abattu).
 * Les étiquettes sont des points 3D que la page projette à l'écran.
 */
export interface R3Sheet {
  soldiers: HumanSoldier[];
  titans: HumanTitan[];
  labels: { text: string; at: Vector3 }[];
  eye: Vector3;
  target: Vector3;
  fov: number;
  ground: number;
  bodies: { id: string; nominal: number; measured: number }[];
  /** Heure de la scène (cérémonies : discours de nuit) ; jour par défaut. */
  preset?: LightPreset;
  /**
   * Décor (cérémonies, dette n° 72) : environnement de `data/art/styles.json` construit autour de la scène ; `at` est le point
   * de l'environnement (x, y au sol) placé à l'origine de la planche.
   */
  backdrop?: { env: string; at: { x: number; y: number } };
}

export const R3_SHEETS = ["r3-titans", "r3-visages", "r3-soldats", "r3-poses", "r3-uniformes", "r3-ceremonie", "r3-discours", "r3-fantassins", "r3-medailles"] as const;

type SoldierMaker = (id: (typeof OUTFIT_IDS)[number] | Outfit, seed: number, height?: number, pluie?: boolean, extra?: { gender?: number; hair?: string }) => HumanSoldier;

/**
 * Remise des médailles par la reine Historia (dette n° 72 ; fait : C ; mise en scène : A, `ceremonie_medailles`) : salle
 * d'audience du palais (sol de pierre, tapis, colonnes, trône sur une estrade, bannières sans armoiries), éclairée par des
 * chandeliers ; les survivants du Corps de part et d'autre du tapis, au salut, la médaille sur la poitrine ; la reine devant
 * l'un d'eux ; deux gardes de la Brigade Militaire au pied de l'estrade.
 */
function buildMedalCeremony(scene: Scene, soldier: SoldierMaker, time: number, out: R3Sheet): void {
  const cfg = FIGURES_R3.ceremonie_medailles;
  const mat = (hex: string, rough = 0.85, emissive?: string): MeshStandardMaterial =>
    new MeshStandardMaterial({ color: new Color(hex), roughness: rough, ...(emissive ? { emissive: new Color(emissive), emissiveIntensity: 1.1 } : {}) });
  const stone = mat("#8C877C", 0.9);
  const wall = mat("#B3AA98", 0.95);
  const gold = mat("#B8923A", 0.45);
  const red = mat("#7A1C1C", 0.9);
  const box = (w: number, h: number, d: number, m: MeshStandardMaterial, x: number, y: number, z: number, cast = true): Mesh => {
    const b = new Mesh(new BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = cast;
    b.receiveShadow = true;
    scene.add(b);
    return b;
  };
  // Salle : sol, murs et plafond (sans ombre portée, pour que les chandeliers éclairent), tapis, estrade et trône.
  box(9.6, 0.1, 18, stone, 0, -0.048, -1.5, false);
  box(0.4, 8, 18, wall, -4.6, 4, -1.5, false);
  box(0.4, 8, 18, wall, 4.6, 4, -1.5, false);
  box(9.6, 8, 0.4, wall, 0, 4, -8, false);
  box(9.6, 0.3, 18, mat("#4A3A2A"), 0, 8.1, -1.5, false);
  box(1.8, 0.012, 13, red, 0, 0.008, -1.2, false);
  box(4.4, 0.42, 2.4, stone, 0, 0.21, -6.6);
  box(4.8, 0.2, 0.6, stone, 0, 0.1, -5.15);
  box(1.0, 0.5, 0.8, gold, 0, 0.67, -7.0);
  box(0.9, 0.12, 0.7, red, 0, 0.98, -6.98);
  box(1.0, 2.0, 0.16, gold, 0, 1.42, -7.42);
  for (const x of [-3.4, 3.4])
    for (const z of [1.5, -1.5, -4.5]) {
      const col = new Mesh(new CylinderGeometry(0.28, 0.32, 8, 16).translate(0, 4, 0), wall);
      col.position.set(x, 0, z);
      col.receiveShadow = true;
      scene.add(col);
    }
  for (const x of [-2.6, 2.6]) {
    box(1.1, 3.2, 0.03, red, x, 4.6, -7.78, false);
    box(1.1, 0.12, 0.05, gold, x, 6.2, -7.76, false);
  }
  // Chandeliers : couronne dorée, flammes, lumière chaude.
  const flame = mat("#E8742A", 0.5, "#D9581A");
  for (const z of [0.5, -3.0]) {
    const ring = new Mesh(new CylinderGeometry(0.7, 0.7, 0.08, 20, 1, true), gold);
    ring.position.set(0, 5.2, z);
    scene.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const f = new Mesh(new CylinderGeometry(0.0, 0.05, 0.16, 6), flame);
      f.position.set(Math.cos(a) * 0.7, 5.33, z + Math.sin(a) * 0.7);
      scene.add(f);
    }
    const light = new PointLight(new Color("#FFE2BE"), 24, 16, 1.4);
    light.position.set(0, 5.0, z);
    light.castShadow = z > 0;
    scene.add(light);
  }
  for (const x of [-1.9, 1.9]) {
    const stand = new Mesh(new CylinderGeometry(0.04, 0.08, 1.6, 8).translate(0, 0.8 + 0.42, 0), gold);
    stand.position.set(x, 0, -6.0);
    scene.add(stand);
    const f = new Mesh(new CylinderGeometry(0.0, 0.07, 0.2, 8), flame);
    f.position.set(x, 2.15, -6.0);
    scene.add(f);
    const light = new PointLight(new Color("#FFCF9A"), 8, 9, 1.6);
    light.position.set(x, 2.3, -6.0);
    scene.add(light);
  }
  // Médaille ronde à ruban sur la poitrine, côté gauche (A).
  const medalGeo = new CylinderGeometry(0.022, 0.022, 0.006, 16).rotateX(Math.PI / 2);
  const ribbonGeo = new BoxGeometry(0.03, 0.04, 0.004);
  const ribbon = mat("#2E4E8A", 0.8);
  const pin = (s: HumanSoldier): void => {
    const bone = s.body.bones["spine_03"];
    const j = s.body.joints.get("spine_03");
    const front = regionBounds(s.body).get("peau_torse")?.maxZ;
    if (!bone || !j || front === undefined) return;
    const k = s.body.height / 1.8;
    const medal = new Group();
    medal.name = "medaille";
    const disc = new Mesh(medalGeo, gold);
    const band = new Mesh(ribbonGeo, ribbon);
    band.position.y = 0.035;
    medal.add(disc, band);
    medal.scale.setScalar(k);
    medal.position.set(0.075 * k, -0.03 * k, front - j.z + 0.006);
    bone.add(medal);
  };
  // Survivants du Corps : cinq à gauche du tapis, quatre à droite, tournés vers le tapis, au salut.
  const zs = [-0.6, -1.7, -2.8, -3.9, -5.0];
  zs.forEach((z, i) => {
    const s = soldier("exploration", 180 + i);
    s.group.position.set(-1.45, 0, z);
    s.group.rotation.y = Math.PI / 2;
    s.setPose("salut", time + i * 0.11);
    pin(s);
  });
  zs.slice(0, 4).forEach((z, i) => {
    const s = soldier("exploration", 190 + i);
    s.group.position.set(1.45, 0, z);
    s.group.rotation.y = -Math.PI / 2;
    s.setPose("salut", time + i * 0.13);
    pin(s);
  });
  // La reine, devant le troisième soldat de droite (robe longue, cape de cérémonie, cheveux blonds : `?`).
  const q = cfg.reine;
  const queen = soldier({ ...outfit("recrues"), nom: "Reine Historia", veste: q.robe, pantalon: q.robe, bottes: q.souliers, cape: q.cape, manteau: { teinte: q.robe, longueur: 0.9 }, odm: false, repos: "bras", corpulence: { age: [0.2, 0.3], muscle: [0.3, 0.4], weight: [0.3, 0.4] } }, 200, q.taille, false, { gender: 0, hair: q.cheveux });
  queen.group.position.set(0.55, 0, -2.8);
  queen.group.rotation.y = Math.PI / 2;
  queen.setPose("attente", time);
  // Gardes de la Brigade Militaire au pied de l'estrade, arme au pied.
  for (const [x, seed] of [
    [-2.3, 210],
    [2.3, 211],
  ] as const) {
    const g = soldier("police", seed);
    g.group.position.set(x, 0, -5.3);
    g.setPose("attente", time);
  }
  out.labels.push({ text: "remise des médailles par la reine Historia", at: new Vector3(0, 3.2, -6.6) });
  out.target.set(0, 1.15, -3.2);
  out.eye.set(0.4, 2.1, 5.2);
  out.fov = 42;
  out.ground = 30;
  out.preset = "nuit";
}

export function buildR3Sheet(sheet: string, scene: Scene, t: HumanTemplate, eyeMap: Texture | null, detail: { skin: Texture; cloth: Texture } | null, time: number): R3Sheet {
  const out: R3Sheet = { soldiers: [], titans: [], labels: [], eye: new Vector3(0, 2, 10), target: new Vector3(0, 1, 0), fov: 32, ground: 60, bodies: [] };
  const mats = soldierMaterials();
  if (detail) dressMaterials(mats, detail);
  const puff = puffTexture();
  const skins = new Map<SkinId, Texture>();
  const titan = (cls: string, v: TitanVariantId, skin: SkinId, seed: number): HumanTitan => {
    const spec = r3TitanSpec(cls, v, skin);
    let map = skins.get(skin);
    if (!map) {
      map = titanSkinTexture(850, spec.r3?.skin ?? { id: skin, marbling: 0.5 });
      skins.set(skin, map);
    }
    const ti = buildHumanTitan(t, spec, seed, { skinMap: map, eyeMap, skinNormal: detail?.skin ?? null });
    setSteamTexture(ti, puff);
    ti.group.traverse((o) => {
      o.castShadow = true;
    });
    scene.add(ti.group);
    out.titans.push(ti);
    return ti;
  };
  const soldier = (id: (typeof OUTFIT_IDS)[number] | Outfit, seed: number, height?: number, pluie = false, extra: { gender?: number; hair?: string } = {}): HumanSoldier => {
    const s = buildHumanSoldier(t, seed, mats, { eyeMap, outfit: typeof id === "string" ? outfit(id) : id, pluie, ...(height ? { height, gender: 1 } : {}), ...extra });
    s.group.traverse((o) => {
      o.castShadow = true;
    });
    scene.add(s.group);
    out.soldiers.push(s);
    return s;
  };
  const nameOf = (cls: string, v: TitanVariantId): string => FIGURES_R3.titans.find((x) => x.classe === cls)?.variantes.find((x) => x.id === v)?.nom ?? v;

  if (sheet === "r3-titans") {
    // À l'échelle : classes de gauche à droite, trois corps chacune, peaux alternées ; un soldat de 1,7 m à gauche.
    let x = 0;
    const ref = soldier("exploration", 3, 1.7);
    ref.group.position.set(x, 0, 2);
    ref.setPose("attente", time);
    out.labels.push({ text: "soldat 1,7 m", at: new Vector3(x, -0.6, 2) });
    x += 3;
    R3_CLASS_IDS.forEach((cls, ci) => {
      const H = r3TitanSpec(cls, "a", "pale").height;
      (["a", "b", "c"] as const).forEach((v, vi) => {
        const ti = titan(cls, v, (ci + vi) % 2 ? "rougeaude" : "pale", 850 + ci * 3 + vi);
        x += H * 0.28;
        ti.group.position.set(x, 0, 0);
        ti.group.rotation.y = -0.25;
        ti.setPose("debout", time);
        // Étiquettes décalées d'une ligne sur deux (petits Titans serrés).
        out.labels.push({ text: `${H} m · ${v}`, at: new Vector3(x, vi % 2 ? -2.6 : -0.8, 0) });
        const b = skinnedBounds(ti.human);
        out.bodies.push({ id: `${cls}_${v}`, nominal: H, measured: b.max.y - b.min.y });
        x += H * 0.28;
      });
      x += 1.5;
    });
    const mid = x / 2;
    out.target.set(mid, 8, 0);
    out.eye.set(mid, 5, 72);
    out.fov = 40;
    out.ground = 320;
  } else if (sheet === "r3-visages") {
    // Têtes de près : six Titans (deux peaux), regard vers la caméra.
    const picks: [string, TitanVariantId, SkinId][] = [
      ["classe_3", "b", "rougeaude"],
      ["classe_5", "c", "pale"],
      ["classe_8", "a", "rougeaude"],
      ["classe_8", "c", "pale"],
      ["classe_12", "b", "rougeaude"],
      ["classe_15", "c", "pale"],
    ];
    picks.forEach(([cls, v, skin], i) => {
      const ti = titan(cls, v, skin, 900 + i);
      ti.setPose("debout", time);
      // Ramené à 2,4 m, tête à hauteur commune.
      const k = 2.4 / ti.spec.height;
      ti.group.scale.setScalar(k);
      (ti.steam.material as PointsMaterial).size *= k;
      ti.group.updateMatrixWorld(true);
      const head = ti.joints.tete.getWorldPosition(new Vector3());
      ti.group.position.set((i - 2.5) * 0.62, 2.0 - head.y, 0);
      out.labels.push({ text: `${ti.spec.height} m · ${v}\n${nameOf(cls, v)}`, at: new Vector3((i - 2.5) * 0.62, 1.6, 0.2) });
    });
    out.target.set(0, 2.0, 0);
    out.eye.set(0, 2.05, 4.2);
    out.fov = 42;
  } else if (sheet === "r3-soldats") {
    // Sept tenues de face, puis les mêmes de dos.
    OUTFIT_IDS.forEach((id, i) => {
      for (const back of [false, true]) {
        const s = soldier(id, 40 + i, 1.7);
        const x = back ? 0.48 + i * 0.82 : -5.4 + i * 0.82;
        s.group.position.set(x, 0, 0);
        s.group.rotation.y = back ? Math.PI : 0;
        s.setPose("attente", time);
        if (!back) out.labels.push({ text: outfit(id).nom.replace(" de ", "\nde ").replace(" d'", "\nd'").replace(" militaire", "\nmilitaire").replace(" (", "\n("), at: new Vector3(x, -0.12, 0) });
      }
    });
    out.labels.push({ text: "de face", at: new Vector3(-2.94, 2.05, 0) }, { text: "de dos", at: new Vector3(2.94, 2.05, 0) });
    out.target.set(0, 1.0, 0);
    out.eye.set(0, 1.2, 10.8);
    out.fov = 38;
  } else if (sheet === "r3-fantassins") {
    // Dette n° 62 : fantassins tels que la bataille les habille (`troopLook`) ; l'officier de la Garnison au tir (pistolet).
    const row: [string, boolean, string | undefined, string, HumanPose][] = [
      ["fac_paradis", true, undefined, "Officier\nde la Garnison", "tir"],
      ["fac_paradis", true, "interieur_sina", "Officier de la\nBrigade Militaire", "attente"],
      ["fac_paradis", false, "interieur_sina", "Brigade Militaire\n(Sina)", "attente"],
      ["fac_marley", false, undefined, "Infanterie\nde Marley", "attente"],
      ["fac_allies", false, undefined, "Fantassin\nallié", "attente"],
      ["fac_allies", true, undefined, "Officier\nallié", "attente"],
      ["fac_hizuru", false, undefined, "Garde\nd'Hizuru", "attente"],
      ["fac_hizuru", true, undefined, "Officier\nd'Hizuru", "attente"],
    ];
    row.forEach(([faction, officer, region, text, pose], i) => {
      const s = soldier(troopLook(faction, officer, region).outfit, 60 + i, 1.7);
      const x = -4.9 + i * 1.4;
      s.group.position.set(x, 0, 0);
      s.group.rotation.y = pose === "tir" ? -0.6 : 0.25;
      s.setPose(pose, time);
      out.labels.push({ text, at: new Vector3(x, -0.12, 0) });
    });
    out.target.set(0, 0.95, 0);
    out.eye.set(0, 1.25, 9.6);
    out.fov = 38;
  } else if (sheet === "r3-medailles") {
    buildMedalCeremony(scene, soldier, time, out);
  } else if (sheet === "r3-uniformes") {
    // Quatre corps de Paradis : de dos (emblème au dos ou sur la cape) puis de trois quarts (manche, poitrine) ; emblèmes agrandis.
    const corps: [(typeof OUTFIT_IDS)[number], EmblemId][] = [
      ["exploration", "ailes"],
      ["garnison", "roses"],
      ["police", "licorne"],
      ["recrues", "epees"],
    ];
    corps.forEach(([id, em], i) => {
      const x = -3.75 + i * 1.5;
      const backView = soldier(id, 60 + i, 1.7);
      backView.group.position.set(x - 0.32, 0, 0);
      backView.group.rotation.y = Math.PI;
      backView.setPose("attente", time);
      const three = soldier(id, 60 + i, 1.7);
      three.group.position.set(x + 0.32, 0, 0);
      three.group.rotation.y = 0.7;
      three.setPose("attente", time);
      const big = buildEmblem(em, 0.5);
      big.position.set(x, 2.25, 0);
      scene.add(big);
      out.labels.push({ text: outfit(id).nom.replace(" de ", "\nde ").replace(" d'", "\nd'"), at: new Vector3(x, -0.12, 0) });
    });
    // Sous la pluie : la capuche de la cape rabattue sur la tête (A), de dos et de face.
    for (const [dx, ry] of [
      [-0.32, Math.PI * 0.8],
      [0.32, 0.35],
    ] as const) {
      const s = soldier("exploration", 70, 1.7, true);
      s.group.position.set(2.25 + dx, 0, 0);
      s.group.rotation.y = ry;
      s.setPose("attente", time);
    }
    out.labels.push({ text: "sous la pluie\n(capuche levée)", at: new Vector3(2.25, -0.12, 0) });
    // 854 (dette n° 72) : tenue sombre, lances de foudre le long des avant-bras et canons anti-personnel sur les poignées, de
    // trois quarts et en vol.
    for (const [dx, ry, pose] of [
      [-0.32, 0.6, "attente"],
      [0.32, -0.5, "frappe"],
    ] as const) {
      const s = soldier("exploration_854", 71, 1.7);
      s.group.position.set(3.75 + dx, 0, 0);
      s.group.rotation.y = ry;
      s.setPose(pose, time);
      s.setSpears(2);
    }
    out.labels.push({ text: "854 : lances de foudre,\nanti-personnel", at: new Vector3(3.75, -0.12, 0) });
    out.target.set(0, 1.3, 0);
    out.eye.set(0, 1.5, 7.6);
    out.fov = 40;
  } else if (sheet === "r3-ceremonie") {
    // Remise des diplômes : trois rangs de recrues au salut, un instructeur du Corps de Reconnaissance face à elles (mise en
    // scène : A ; salut : C).
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 7; c++) {
        const s = soldier("recrues", 100 + r * 7 + c);
        s.group.position.set((c - 3) * 0.75, 0, -r * 0.9);
        s.setPose("salut", time + c * 0.17);
      }
    const chief = soldier("exploration", 99, 1.78);
    chief.group.position.set(0, 0, 2.4);
    chief.group.rotation.y = Math.PI;
    chief.setPose("salut", time);
    out.labels.push({ text: "Corps d'Entraînement : salut, poing droit sur le cœur", at: new Vector3(0, 2.15, -0.9) });
    out.target.set(0, 1.0, 0);
    out.eye.set(2.2, 2.0, 6.4);
    out.fov = 42;
    // Sur la place d'armes d'un camp militaire (E24, A) : drapeau derrière les rangs, donjon et caserne au loin.
    out.backdrop = { env: "E24", at: { x: 0, y: -20 } };
  } else if (sheet === "r3-discours") {
    // Choix du corps après l'assemblée d'Erwin (C) : de nuit, Erwin sur une estrade entre deux officiers, éclairé par des
    // torches ; les recrues en rangs face à lui, celles du premier rang au salut (mise en scène : A).
    const wood = new MeshStandardMaterial({ color: new Color("#5A4632"), roughness: 0.9 });
    const stage = new Mesh(new BoxGeometry(6, 1.2, 2.6).translate(0, 0.6, 0), wood);
    stage.position.set(0, 0, 4.2);
    stage.receiveShadow = true;
    stage.castShadow = true;
    scene.add(stage);
    const erwin = soldier("exploration", 120, 1.86);
    erwin.group.position.set(0, 1.2, 4.0);
    erwin.group.rotation.y = Math.PI;
    erwin.setPose("attente", time);
    for (const [x, seed] of [
      [-1.6, 121],
      [1.6, 122],
    ] as const) {
      const o = soldier("exploration", seed, 1.76);
      o.group.position.set(x, 1.2, 4.4);
      o.group.rotation.y = Math.PI;
      o.setPose("attente", time);
    }
    const flameMat = new MeshStandardMaterial({ color: new Color("#E8742A"), emissive: new Color("#D9581A"), emissiveIntensity: 1.1 });
    for (const x of [-3.6, 3.6]) {
      const post = new Mesh(new CylinderGeometry(0.05, 0.06, 2.6, 8).translate(0, 1.3, 0), wood);
      post.position.set(x, 0, 3.4);
      scene.add(post);
      const flame = new Mesh(new CylinderGeometry(0.0, 0.12, 0.35, 8).translate(0, 2.8, 0), flameMat);
      flame.position.set(x, 0, 3.4);
      scene.add(flame);
      const light = new PointLight(new Color("#FF9A48"), 14, 18, 1.6);
      light.position.set(x, 2.9, 3.4);
      scene.add(light);
    }
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 8; c++) {
        const s = soldier("recrues", 130 + r * 8 + c);
        s.group.position.set((c - 3.5) * 0.8, 0, -r * 0.95);
        s.setPose(r === 0 ? "salut" : "attente", time + c * 0.13);
      }
    out.labels.push({ text: "assemblée d'Erwin : choix du corps", at: new Vector3(0, 3.6, 4.2) });
    out.target.set(0, 1.2, 1.6);
    out.eye.set(-2.6, 3.0, -6.6);
    out.fov = 42;
    out.preset = "nuit";
    out.backdrop = { env: "E24", at: { x: 0, y: -14 } };
  } else if (sheet === "r3-poses") {
    // Rangée de devant : soldats ; rangée du fond : Titans ramenés à 2,4 m (le corps abattu couché vers la caméra).
    const sPoses: [(typeof OUTFIT_IDS)[number], HumanPose, string][] = [
      ["exploration", "marche", "marche"],
      ["exploration", "course", "course"],
      ["exploration", "chute", "chute"],
      ["exploration", "frappe", "attaque (coupe)"],
      ["marley_infanterie", "tir", "attaque (tir)"],
      ["garnison", "recharge", "recharge"],
      ["marley_officier", "commandement", "commandement"],
      ["garnison", "mort", "mort"],
    ];
    sPoses.forEach(([id, pose, label], i) => {
      const s = soldier(id, 60 + i);
      const x = (i - 3.5) * 1.1;
      s.group.position.set(x, pose === "chute" ? 0.6 : 0, 1.6);
      // Tireur, soldat qui recharge et officier, de trois quarts : de face, le fusil ou le bras levé se verraient de bout.
      if (pose === "tir") s.group.rotation.y = -1.0;
      if (pose === "recharge") s.group.rotation.y = -0.7;
      if (pose === "commandement") s.group.rotation.y = 0.9;
      s.setPose(pose, time);
      out.labels.push({ text: label, at: new Vector3(x, -0.05, 2.3) });
    });
    const tPoses: [TitanPose, number, string][] = [
      ["marche", time, "marche"],
      ["course", time, "course"],
      ["attaque", time, "attaque"],
      ["effondre", 1.1, "chute (1,1 s)"],
      ["abattu", 0, "mort"],
    ];
    tPoses.forEach(([pose, tt, label], i) => {
      const ti = titan("classe_8", "b", i % 2 ? "pale" : "rougeaude", 70);
      const k = 2.4 / ti.spec.height;
      ti.group.scale.setScalar(k);
      (ti.steam.material as PointsMaterial).size *= k;
      const x = (i - 2) * 1.8;
      ti.group.position.set(x, 0, pose === "abattu" ? -3.4 : -2.2);
      ti.setPose(pose, tt);
      out.labels.push({ text: `Titan · ${label}`, at: new Vector3(x, 2.75, -2.2) });
    });
    out.target.set(0, 1.0, -0.4);
    out.eye.set(0, 3.0, 9.6);
    out.fov = 44;
  }
  return out;
}
