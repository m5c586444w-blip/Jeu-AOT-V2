import { Vector3 } from "three";
import type { PointsMaterial, Scene, Texture } from "three";
import { skinnedBounds } from "./humanBase";
import type { HumanTemplate } from "./humanBase";
import { buildEmblem } from "./emblems";
import type { EmblemId } from "./emblems";
import { buildHumanSoldier } from "./humanSoldier";
import type { HumanSoldier } from "./humanSoldier";
import { buildHumanTitan } from "./humanTitan";
import type { HumanTitan } from "./humanTitan";
import type { HumanPose } from "./humanAnim";
import { FIGURES_R3, OUTFIT_IDS, R3_CLASS_IDS, outfit, r3TitanSpec } from "./figuresR3";
import type { SkinId, TitanVariantId } from "./figuresR3";
import { dressMaterials } from "./bodies";
import { soldierMaterials } from "./soldier";
import { setSteamTexture } from "./titan";
import type { TitanPose } from "./titan";
import { puffTexture, titanSkinTexture } from "./textures";

/**
 * Planches de contrôle de R3 (`?proto3d=humain&planche=r3-titans|r3-visages|r3-soldats|r3-poses`) :
 * - r3-titans : les 15 corps à l'échelle (3 à 15 m), peaux alternées, un soldat de 1,7 m pour l'échelle ;
 * - r3-visages : six têtes de Titans de près (dents, yeux, expressions, deux peaux) ;
 * - r3-soldats : les six tenues de face, puis de dos ;
 * - r3-uniformes (dette n° 72) : les quatre corps de Paradis de dos et de trois quarts, emblèmes agrandis au-dessus, et la
 *   cape sous la pluie (capuche levée) ;
 * - r3-ceremonie (dette n° 72) : recrues en rangs au salut, un instructeur face à elles ;
 * - r3-poses : soldats (marche, course, chute, coupe, tir, mort) et Titans ramenés à 2,4 m (marche, course, attaque,
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
}

export const R3_SHEETS = ["r3-titans", "r3-visages", "r3-soldats", "r3-poses", "r3-uniformes", "r3-ceremonie"] as const;

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
  const soldier = (id: (typeof OUTFIT_IDS)[number], seed: number, height?: number, pluie = false): HumanSoldier => {
    const s = buildHumanSoldier(t, seed, mats, { eyeMap, outfit: outfit(id), pluie, ...(height ? { height, gender: 1 } : {}) });
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
    // Six tenues de face, puis les mêmes de dos.
    OUTFIT_IDS.forEach((id, i) => {
      for (const back of [false, true]) {
        const s = soldier(id, 40 + i, 1.7);
        const x = back ? 0.8 + i * 0.82 : -4.9 + i * 0.82;
        s.group.position.set(x, 0, 0);
        s.group.rotation.y = back ? Math.PI : 0;
        s.setPose("attente", time);
        if (!back) out.labels.push({ text: outfit(id).nom.replace(" de ", "\nde ").replace(" d'", "\nd'").replace(" militaire", "\nmilitaire"), at: new Vector3(x, -0.12, 0) });
      }
    });
    out.labels.push({ text: "de face", at: new Vector3(-2.85, 2.05, 0) }, { text: "de dos", at: new Vector3(2.85, 2.05, 0) });
    out.target.set(0, 1.0, 0);
    out.eye.set(0, 1.2, 9.8);
    out.fov = 38;
  } else if (sheet === "r3-uniformes") {
    // Quatre corps de Paradis : de dos (emblème au dos ou sur la cape) puis de trois quarts (manche, poitrine) ; emblèmes agrandis.
    const corps: [(typeof OUTFIT_IDS)[number], EmblemId][] = [
      ["exploration", "ailes"],
      ["garnison", "roses"],
      ["police", "licorne"],
      ["recrues", "epees"],
    ];
    corps.forEach(([id, em], i) => {
      const x = -3 + i * 1.5;
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
      s.group.position.set(3 + dx, 0, 0);
      s.group.rotation.y = ry;
      s.setPose("attente", time);
    }
    out.labels.push({ text: "sous la pluie\n(capuche levée)", at: new Vector3(3, -0.12, 0) });
    out.target.set(0, 1.3, 0);
    out.eye.set(0, 1.5, 6.8);
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
  } else if (sheet === "r3-poses") {
    // Rangée de devant : soldats ; rangée du fond : Titans ramenés à 2,4 m (le corps abattu couché vers la caméra).
    const sPoses: [(typeof OUTFIT_IDS)[number], HumanPose, string][] = [
      ["exploration", "marche", "marche"],
      ["exploration", "course", "course"],
      ["exploration", "chute", "chute"],
      ["exploration", "frappe", "attaque (coupe)"],
      ["marley_infanterie", "tir", "attaque (tir)"],
      ["garnison", "mort", "mort"],
    ];
    sPoses.forEach(([id, pose, label], i) => {
      const s = soldier(id, 60 + i);
      const x = (i - 2.5) * 1.25;
      s.group.position.set(x, pose === "chute" ? 0.6 : 0, 1.6);
      // Le tireur, de trois quarts : face à la caméra, le fusil ne se verrait que de bout.
      if (pose === "tir") s.group.rotation.y = -1.0;
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
