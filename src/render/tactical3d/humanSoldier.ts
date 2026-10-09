import { BoxGeometry, BufferAttribute, BufferGeometry, CapsuleGeometry, Color, CylinderGeometry, Euler, Group, Matrix4, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry, Quaternion, SkinnedMesh, SphereGeometry, TorusGeometry, Vector3 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Material, Texture } from "three";
import { buildHumanBody } from "./humanBase";
import type { HumanBody, HumanTemplate } from "./humanBase";
import { SOLDIER_GAIT, poseHuman } from "./humanAnim";
import type { HumanPose } from "./humanAnim";
import { derive, range, seeded } from "./rng";
import type { SoldierMaterials } from "./soldier";

/**
 * Soldat de R1c : corps de base MakeHuman (CC0) animé par le projet, et l'équipement du projet (R1.5) porté par les os.
 * - Forme tirée de la graine : homme ou femme (les deux servent dans les régiments), âge, musculature, corpulence, taille.
 * - Uniforme du projet par région du corps : veste gris pierre (torse, bras), pantalon sombre (bassin, cuisses), bottes
 *   (jambes, pieds lissés : plus d'orteils), peau du visage et des mains ; cheveux en coque sur le crâne.
 * - Équipement de R1 : réservoir de gaz au bas du dos, lanceurs aux hanches (le droit est le départ du câble), fourreaux de
 *   lames aux cuisses, bretelles et ceinture, lames tenues en main, cape aux épaules (elle flotte en vol).
 * Aucun uniforme ni emblème de l'œuvre n'est reproduit.
 */
export interface HumanSoldier {
  group: Group;
  body: HumanBody;
  /** Départ du câble (lanceur de la hanche droite). */
  launcher: Object3D;
  pose: HumanPose;
  setPose(p: HumanPose, t: number): void;
  dispose(): void;
}

/**
 * R3 : tenue et équipement d'une figure (`data/art/figures.json`). Couleurs : veste, pantalon, et `cape` du jeu de matériaux
 * pour la cape, le manteau ou l'écharpe ; `hat` pour le couvre-chef. Équipement : appareil et lames (odm), fusil (avec
 * havresac), ou baudrier et pistolet (officier).
 */
export interface SoldierOutfit {
  cape: boolean;
  gear: "odm" | "fusil" | "officier";
  headgear: "aucun" | "kepi" | "casque" | "casquette";
  coat: boolean;
  scarf: boolean;
}
export const BATTALION_OUTFIT: SoldierOutfit = { cape: true, gear: "odm", headgear: "aucun", coat: false, scarf: false };

export interface SoldierLook {
  skin: Material;
  eyes: Material;
  teeth: Material;
  hair: Material;
}

/** Hauteur demandée par le banc (1,7 m) ou tirée de la graine. */
export function buildHumanSoldier(t: HumanTemplate, seed: number, mats: SoldierMaterials, opts: { height?: number; eyeMap?: Texture | null; gender?: number; outfit?: SoldierOutfit } = {}): HumanSoldier {
  const rand = seeded(derive(seed, 61));
  const outfit = opts.outfit ?? BATTALION_OUTFIT;
  const odm = outfit.gear === "odm";
  const female = opts.gender !== undefined ? opts.gender < 0.5 : rand() < 0.3;
  const gender = opts.gender ?? (female ? range(rand, 0, 0.2) : range(rand, 0.8, 1));
  const height = opts.height ?? (female ? range(rand, 1.58, 1.72) : range(rand, 1.68, 1.86));
  const tone = range(rand, 0.78, 1.06);
  const skin = (mats.skin.clone() as MeshStandardMaterial);
  skin.color.multiplyScalar(tone);
  const eyes = new MeshStandardMaterial({ map: opts.eyeMap ?? null, color: opts.eyeMap ? new Color(1, 1, 1) : mats.steel.color.clone().multiplyScalar(0.4), roughness: 0.12 });
  const teeth = mats.steel.clone();
  teeth.color.copy(mats.skin.color).lerp(new Color(1, 1, 1), 0.75);
  teeth.metalness = 0;
  teeth.roughness = 0.35;
  const hair = mats.hair[Math.floor(rand() * mats.hair.length)] ?? mats.hair[0] ?? mats.skin;
  const owned: Material[] = [skin, eyes, teeth];
  const head = skin.clone();
  head.vertexColors = true;
  owned.push(head);
  const REGION: Record<string, Material> = {
    peau_tete: head,
    peau_mains: skin,
    peau_torse: mats.jacket,
    peau_bras: mats.jacket,
    peau_bassin: mats.trousers,
    peau_cuisses: mats.trousers,
    peau_jambes: mats.boots,
    peau_pieds: mats.boots,
    yeux: eyes,
    dents: teeth,
    langue: skin,
  };
  const body = buildHumanBody(
    t,
    {
      macro: { gender, age: range(rand, 0.5, 0.62), muscle: range(rand, 0.55, 0.85), weight: range(rand, 0.35, 0.58) },
      height,
      // Bottes : orteils fondus, tige un peu plus épaisse que la jambe.
      // Vêtements : le relief anatomique s'estompe sous l'étoffe (bords de région fixes : pas de fente).
      smooth: [
        { region: "pieds", iterations: 8, inflate: 0.006 },
        { region: "jambes", iterations: 2, inflate: 0.004 },
        { region: "torse", iterations: 4, inflate: 0.004 },
        { region: "bras", iterations: 2, inflate: 0.003 },
        { region: "bassin", iterations: 3, inflate: 0.003 },
        { region: "cuisses", iterations: 2, inflate: 0.003 },
      ],
    },
    (p) => REGION[p] ?? skin,
    (p) => p !== "pantalon",
  );
  const group = new Group();
  group.name = "soldat-r1c";
  group.add(body.group);
  const k = height / 1.8;
  const J = (n: string): Vector3 => body.joints.get(n)?.clone() ?? new Vector3();
  const attach = (bone: string, obj: Object3D, worldRest: Vector3): void => {
    const b = body.bones[bone];
    if (!b) return;
    obj.position.copy(worldRest.sub(J(bone)));
    b.add(obj);
  };
  const piece = (g: BufferGeometry, m: Material, name: string, scale = k): Mesh => {
    const mesh = new Mesh(g, m);
    mesh.name = name;
    mesh.scale.setScalar(scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };
  // Mesures du corps façonné : demi-largeur et arrière du bassin, avant de la poitrine.
  const bounds = regionBounds(body);
  const pelvis = J("pelvis");
  const back = bounds.get("peau_bassin")?.minZ ?? pelvis.z - 0.12;
  const hipHalf = Math.max(bounds.get("peau_bassin")?.maxX ?? 0.17, 0.12);
  const chestBack = bounds.get("peau_torse")?.minZ ?? -0.12;
  const neck = J("neck_01");
  // Harnais : sangles qui épousent le corps (anneaux de peau décalés), articulées comme la peau qu'elles touchent.
  const straps: SkinnedMesh[] = [];
  const band = (prims: string[], point: Vector3, normal: Vector3, width: number, side = 0): void => {
    const m = bodyBand(body, prims, point, normal, width * k, 0.004 * k, mats.leather, side);
    if (m) {
      body.group.add(m);
      straps.push(m);
    }
  };
  const torsoPrims = ["peau_torse", "peau_bassin"];
  band(torsoPrims, new Vector3(0, pelvis.y + 0.03 * k, 0), new Vector3(0, 1, 0), 0.045);
  // Harnais de l'appareil (poitrine, bretelles croisées, cuisses) : soldats à équipement tridimensionnel seulement (R3).
  if (odm) {
    band(["peau_torse"], new Vector3(0, J("spine_03").y - 0.02 * k, 0), new Vector3(0, 1, 0), 0.035);
    for (const s of [1, -1]) band(["peau_torse"], new Vector3(s * 0.08 * k, (neck.y + pelvis.y) / 2 + 0.06 * k, 0), new Vector3(s * 0.62, 1, 0).normalize(), 0.032);
    for (const [side, s] of [
      ["l", 1],
      ["r", -1],
    ] as const) {
      const hip = J(`thigh_${side}`);
      for (const dy of [0.1, 0.24]) band(["peau_cuisses"], new Vector3(hip.x, hip.y - dy * k, hip.z), new Vector3(0, 1, 0), 0.028, s);
    }
  }
  // Col, poignets, revers des bottes, ourlet de la veste : bandes posées sur la couture entre deux régions (elles couvrent le
  // raccord en dents de scie des triangles).
  const seam = (a: string, b: string, width: number, mat: Material, off: number, up: number, side = 0): void => {
    const m = seamBand(body, a, b, width * k, off * k, up * k, mat, side);
    if (m) {
      body.group.add(m);
      straps.push(m);
    }
  };
  seam("peau_torse", "peau_tete", 0.035, mats.jacket, 0.009, 0.004);
  seam("peau_torse", "peau_bassin", 0.03, mats.jacket, 0.008, 0);
  for (const s of [1, -1]) {
    seam("peau_bras", "peau_mains", 0.035, mats.jacket, 0.007, 0, s);
    seam("peau_jambes", "peau_cuisses", 0.045, mats.boots, 0.008, 0, s);
  }
  const launcher = new Object3D();
  launcher.name = "lanceur";
  attach("pelvis", launcher, new Vector3(-hipHalf - 0.045 * k, pelvis.y + 0.01 * k, pelvis.z + 0.02 * k));
  const blades: Object3D[] = [];
  if (odm) {
  // Réservoir de gaz au bas du dos, lanceurs aux hanches.
  const tank = piece(gear("reservoir"), mats.steel, "reservoir");
  attach("pelvis", tank, new Vector3(0, pelvis.y + 0.07 * k, back - 0.065 * k));
  launcher.add(piece(gear("lanceur"), mats.steel, "lanceur"));
  const left = piece(gear("lanceur"), mats.steel, "lanceur");
  left.scale.x *= -1;
  attach("pelvis", left, new Vector3(hipHalf + 0.045 * k, pelvis.y + 0.01 * k, pelvis.z + 0.02 * k));
  // Fourreaux de lames sur l'extérieur des cuisses ; lames dans le prolongement de l'avant-bras.
  for (const [side, s] of [
    ["l", 1],
    ["r", -1],
  ] as const) {
    const hip = J(`thigh_${side}`);
    const thighHalf = Math.abs((bounds.get("peau_cuisses")?.maxX ?? 0.2) - Math.abs(hip.x));
    const sh = piece(gear("fourreau"), mats.leather, "fourreau");
    sh.rotation.set(0.18, 0, s * 0.06);
    attach(`thigh_${side}`, sh, new Vector3(hip.x + s * (thighHalf + 0.035 * k), hip.y - 0.22 * k, hip.z - 0.01 * k));
    const hand = J(`hand_${side}`);
    const dir = hand.clone().sub(J(`lowerarm_${side}`)).normalize();
    const holder = new Object3D();
    holder.name = "lame";
    holder.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
    attach(`hand_${side}`, holder, hand.clone().addScaledVector(dir, 0.07 * k));
    holder.add(piece(gear("lame"), mats.steel, "lame"));
    blades.push(holder);
  }
  }
  // Cape drapée aux épaules : un pivot sous la nuque, qu'on tourne selon la pose (elle flotte en vol).
  const capePivot = new Object3D();
  capePivot.name = "cape";
  attach("spine_03", capePivot, new Vector3(0, neck.y - 0.01 * k, chestBack - 0.02 * k));
  const shoulderHalf = Math.max(Math.abs(J("upperarm_l").x), 0.15) + 0.04 * k;
  const extras: BufferGeometry[] = [];
  let cape: Mesh | null = null;
  if (outfit.cape) {
    cape = new Mesh(capeGeometry(shoulderHalf, (neck.y - pelvis.y) * 1.55, 0.09 * k, seed), mats.cape);
    cape.name = "cape";
    cape.castShadow = true;
    capePivot.add(cape);
  }
  // R3 : couvre-chef, manteau, écharpe, fusil et havresac, baudrier et pistolet (pièces rigides portées par les os).
  const headTop = bounds.get("peau_tete")?.maxY ?? J("head").y + 0.2 * k;
  const headB = bounds.get("peau_tete");
  const headHalfW = headB ? (headB.maxX - headB.minX) / 2 : 0.08 * k;
  const headMidZ = headB ? (headB.maxZ + headB.minZ) / 2 : J("head").z;
  const own = (g: BufferGeometry): BufferGeometry => {
    extras.push(g);
    return g;
  };
  const hatMat = mats.hat ?? mats.boots;
  if (outfit.headgear !== "aucun") {
    const hat = new Group();
    hat.name = `couvre-chef-${outfit.headgear}`;
    const r = headHalfW * 1.12;
    if (outfit.headgear === "casque") {
      // Casque d'acier : calotte et bord étroit.
      const dome = new Mesh(own(new SphereGeometry(r * 1.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), hatMat);
      dome.scale.set(1, 0.85, 1.12);
      const brim = new Mesh(own(new CylinderGeometry(r * 1.32, r * 1.38, 0.012 * k, 18)), hatMat);
      hat.add(dome, brim);
      hat.position.set(0, headTop - 0.075 * k, headMidZ);
    } else {
      // Képi (haut, droit) ou casquette (plate, large) : fût, dessus, visière.
      const kepi = outfit.headgear === "kepi";
      const hH = kepi ? 0.1 * k : 0.06 * k;
      const top = kepi ? r * 0.92 : r * 1.25;
      const band = new Mesh(own(new CylinderGeometry(top, r * 1.02, hH, 18)), hatMat);
      band.position.y = hH / 2;
      const visor = new Mesh(own(new CylinderGeometry(r * 0.75, r * 0.75, 0.008 * k, 14, 1, false, -Math.PI / 2, Math.PI)), mats.leather);
      visor.position.set(0, 0.006 * k, r * 0.55);
      visor.scale.set(1, 1, 0.75);
      hat.add(band, visor);
      hat.position.set(0, headTop - 0.05 * k, headMidZ);
    }
    attach("head", hat, hat.position.clone());
  }
  if (outfit.coat) {
    // Manteau long : pans ouverts de la taille aux genoux (au-dessus de la veste).
    const hip = hipHalf + 0.03 * k;
    const len = (pelvis.y - J("calf_l").y) * 1.05;
    const coat = new Mesh(own(new CylinderGeometry(hip, hip * 1.45, len, 20, 1, true)), mats.cape);
    coat.name = "manteau";
    coat.material = mats.cape;
    coat.castShadow = true;
    attach("pelvis", coat, new Vector3(0, pelvis.y + 0.04 * k - len / 2, pelvis.z - 0.01 * k));
  }
  if (outfit.scarf) {
    const scarf = new Mesh(own(new TorusGeometry(0.075 * k, 0.025 * k, 8, 18)), mats.cape);
    scarf.name = "echarpe";
    scarf.rotation.x = Math.PI / 2 - 0.25;
    attach("neck_01", scarf, new Vector3(0, neck.y + 0.02 * k, neck.z + 0.01 * k));
  }
  const rifleHeld = new Group();
  const rifleSlung = new Group();
  if (outfit.gear === "fusil") {
    // Fusil (crosse, fût, canon) : à la bretelle dans le dos, ou épaulé (orienté de la main droite vers la main gauche).
    const rifle = (): BufferGeometry => merge([at(new BoxGeometry(0.045, 0.1, 0.32), 0, -0.02, -0.16), at(new BoxGeometry(0.04, 0.05, 0.55), 0, 0.01, 0.27), at(new CylinderGeometry(0.009, 0.009, 0.42, 8), 0, 0.03, 0.75, Math.PI / 2, 0, 0)]);
    const g = own(rifle());
    const held = new Mesh(g, mats.leather);
    held.scale.setScalar(k);
    rifleHeld.add(held);
    rifleHeld.name = "fusil";
    group.add(rifleHeld);
    const slung = new Mesh(g, mats.leather);
    slung.scale.setScalar(k);
    slung.rotation.set(-Math.PI / 2 + 0.1, 0, 0.5);
    rifleSlung.add(slung);
    rifleSlung.name = "fusil-bretelle";
    attach("spine_03", rifleSlung, new Vector3(0, J("spine_03").y, chestBack - 0.06 * k));
    const pack = new Mesh(own(new RoundedBoxGeometry(0.3, 0.32, 0.14, 2, 0.03)), mats.leather);
    pack.name = "havresac";
    pack.scale.setScalar(k);
    attach("spine_03", pack, new Vector3(0, J("spine_03").y - 0.04 * k, chestBack - 0.1 * k));
  } else if (outfit.gear === "officier") {
    band(["peau_torse"], new Vector3(0, (neck.y + pelvis.y) / 2 + 0.03 * k, 0), new Vector3(0.55, 1, 0).normalize(), 0.035);
    const holster = new Mesh(own(new RoundedBoxGeometry(0.06, 0.14, 0.09, 2, 0.015)), mats.leather);
    holster.name = "pistolet";
    holster.scale.setScalar(k);
    attach("pelvis", holster, new Vector3(-hipHalf - 0.02 * k, pelvis.y - 0.04 * k, pelvis.z + 0.04 * k));
  }
  // Cheveux : couleur sur le crâne avec une lisière fondue, et une coque d'épaisseur au centre.
  paintHair(body, hair, skin);
  const hairMesh = buildHairCap(body, hair, 0.006 * k, 0.012);
  if (hairMesh) body.group.add(hairMesh);
  const phase = rand() * 6;
  const soldier: HumanSoldier = {
    group,
    body,
    launcher,
    pose: "sol",
    setPose(p, time) {
      soldier.pose = p;
      poseHuman(body, p, time, SOLDIER_GAIT, phase);
      const w = Math.sin(time * 3 + phase);
      // Le soldat regarde vers +z : la cape s'écarte vers l'arrière par une rotation positive autour de x.
      capePivot.rotation.x = p === "vol" || p === "chute" ? 0.95 + 0.12 * w : p === "accroche" ? 0.3 + 0.05 * w : p === "course" ? 0.5 + 0.08 * w : 0.06 + 0.02 * w;
      // Lames tirées pour le combat et le vol ; au fourreau à l'arrêt et en marche.
      for (const b of blades) b.visible = p !== "attente" && p !== "marche" && p !== "mort" && p !== "saisi";
      group.updateMatrixWorld(true);
      if (outfit.gear === "fusil") {
        const aim = p === "tir";
        rifleHeld.visible = aim;
        rifleSlung.visible = !aim;
        if (aim) {
          const r = body.bones["hand_r"]?.getWorldPosition(new Vector3());
          const l = body.bones["hand_l"]?.getWorldPosition(new Vector3());
          if (r && l) {
            group.worldToLocal(r);
            group.worldToLocal(l);
            rifleHeld.position.copy(r);
            rifleHeld.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), l.sub(r).normalize());
            rifleHeld.updateMatrixWorld(true);
          }
        }
      }
      // Matrices d'os à jour : les mesures sur la peau (boîtes englobantes) suivent la pose.
      body.skeleton.update();
    },
    dispose() {
      body.dispose();
      hairMesh?.geometry.dispose();
      cape?.geometry.dispose();
      for (const g of extras) g.dispose();
      for (const m of straps) m.geometry.dispose();
      for (const m of owned) m.dispose();
    },
  };
  soldier.setPose("sol", 0);
  return soldier;
}

/** Étendue (repos) des sommets de chaque primitive de peau. */
export function regionBounds(body: HumanBody): Map<string, { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }> {
  const out = new Map<string, { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }>();
  for (const [name, m] of body.meshes) {
    const a = m.geometry.getAttribute("position").array as Float32Array;
    const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (let i = 0; i < a.length; i += 3) {
      b.minX = Math.min(b.minX, a[i] as number);
      b.maxX = Math.max(b.maxX, a[i] as number);
      b.minY = Math.min(b.minY, a[i + 1] as number);
      b.maxY = Math.max(b.maxY, a[i + 1] as number);
      b.minZ = Math.min(b.minZ, a[i + 2] as number);
      b.maxZ = Math.max(b.maxZ, a[i + 2] as number);
    }
    out.set(name, b);
  }
  return out;
}

/**
 * Coque de cheveux : les triangles du crâne (sommets liés à la tête, au-dessus d'une ligne qui passe au front, aux tempes et
 * sous l'occiput), décalés le long de la normale. Articulée par les mêmes os que la tête.
 */
/** Poids de chevelure d'un sommet de la tête (0 : peau, 1 : cheveux), lisse : front, tempes, nuque ; jamais les oreilles. */
export function hairWeight(body: HumanBody, p: Vector3, inset = 0, nape = 0, scale = body.height / 1.7): number {
  const eye = body.joints.get("eye_l") ?? new Vector3();
  const hj = body.joints.get("head") ?? new Vector3();
  // Échelle de la tête (un soldat : sa taille / 1,7 m ; un Titan : la taille de sa tête, qui ne suit pas sa hauteur).
  const s = scale;
  const front = Math.max(0, Math.min(1, (p.z - hj.z) / (0.09 * s)));
  const limit = eye.y + (0.045 - nape) * s * front + (-0.055 - nape) * s * (1 - front) + inset * s;
  const ear = Math.abs(p.x) > 0.062 * s && p.y < eye.y + 0.02 * s && p.z > hj.z - 0.05 * s;
  if (ear) return 0;
  return Math.max(0, Math.min(1, (p.y - limit) / (0.012 * s)));
}

/** Teinte des cheveux portée par la couleur de sommet de la tête (le matériau de la tête est en couleurs de sommet). */
export function paintHair(body: HumanBody, hair: Material, skin: MeshStandardMaterial, scale = body.height / 1.7): void {
  const head = body.meshes.get("peau_tete");
  const hc = (hair as MeshStandardMaterial).color;
  if (!head || !hc) return;
  const pos = head.geometry.getAttribute("position");
  const col = new Float32Array(pos.count * 3);
  const ratio = new Color(hc.r / Math.max(0.05, skin.color.r), hc.g / Math.max(0.05, skin.color.g), hc.b / Math.max(0.05, skin.color.b));
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    const w = hairWeight(body, v.set(pos.getX(i), pos.getY(i), pos.getZ(i)), 0, 0, scale);
    col[i * 3] = 1 + (ratio.r - 1) * w;
    col[i * 3 + 1] = 1 + (ratio.g - 1) * w;
    col[i * 3 + 2] = 1 + (ratio.b - 1) * w;
  }
  head.geometry.setAttribute("color", new BufferAttribute(col, 3));
}

export function buildHairCap(body: HumanBody, mat: Material, thickness: number, inset = 0, nape = 0, scale = body.height / 1.7): SkinnedMesh | null {
  const head = body.meshes.get("peau_tete");
  if (!head) return null;
  const pos = head.geometry.getAttribute("position");
  const nor = head.geometry.getAttribute("normal");
  const si = head.geometry.getAttribute("skinIndex");
  const sw = head.geometry.getAttribute("skinWeight");
  const idx = head.geometry.getIndex();
  if (!idx) return null;
  const headBones = new Set(["head", "jaw", "eye_l", "eye_r"].map((n) => body.skeleton.bones.findIndex((b) => b.name === n)));
  const v = new Vector3();
  const inCap = (i: number): boolean => {
    let w = 0;
    for (let k = 0; k < 4; k++) if (headBones.has(si.getComponent(i, k))) w += sw.getComponent(i, k);
    if (w < 0.95) return false;
    return hairWeight(body, v.set(pos.getX(i), pos.getY(i), pos.getZ(i)), inset, nape, scale) >= 1;
  };
  const keep: number[] = [];
  for (let k = 0; k < idx.count; k += 3) {
    const a = idx.getX(k);
    const b = idx.getX(k + 1);
    const c = idx.getX(k + 2);
    if (inCap(a) && inCap(b) && inCap(c)) keep.push(a, b, c);
  }
  if (keep.length === 0) return null;
  const n = pos.count;
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // L'épaisseur s'amincit vers le bord de la coque : pas de marche visible à la lisière.
    const w = Math.min(1, hairWeight(body, v.set(pos.getX(i), pos.getY(i), pos.getZ(i)), inset - 0.03, nape, scale));
    for (let k = 0; k < 3; k++) p[i * 3 + k] = pos.getComponent(i, k) + nor.getComponent(i, k) * thickness * w;
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(p, 3));
  g.setAttribute("normal", nor);
  for (const key of ["uv", "skinIndex", "skinWeight"]) {
    const a = head.geometry.getAttribute(key);
    if (a) g.setAttribute(key, a);
  }
  g.setIndex(keep);
  g.computeBoundingSphere();
  const m = new SkinnedMesh(g, mat);
  m.name = "cheveux";
  m.castShadow = true;
  m.frustumCulled = false;
  m.bind(body.skeleton, head.bindMatrix.clone());
  return m;
}

// ——— Équipement du projet (formes de R1, refaites plus fines) ———

type Gear = "reservoir" | "lanceur" | "fourreau" | "lame";
const gearCache = new Map<Gear, BufferGeometry>();
const at = (g: BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): BufferGeometry =>
  g.applyMatrix4(new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz)), new Vector3(1, 1, 1)));

/** Fusion de géométries hétérogènes : non indexées, position seule (les normales sont recalculées). */
function merge(list: BufferGeometry[]): BufferGeometry {
  const plain = list.map((g) => {
    const x = g.index ? g.toNonIndexed() : g;
    const out = new BufferGeometry();
    out.setAttribute("position", x.getAttribute("position"));
    return out;
  });
  const m = mergeGeometries(plain);
  if (!m) throw new Error("fusion de géométries impossible");
  m.computeVertexNormals();
  return m;
}

/** Pièces d'équipement, à l'échelle d'un soldat de 1,80 m (mises à l'échelle du corps à l'attache). */
export function gear(k: Gear): BufferGeometry {
  let g = gearCache.get(k);
  if (g) return g;
  switch (k) {
    case "reservoir":
      // Deux bouteilles de gaz couchées en travers du dos, un détendeur entre elles.
      g = merge([at(new CapsuleGeometry(0.06, 0.3, 6, 14), -0.0, 0.05, 0, 0, 0, Math.PI / 2), at(new CapsuleGeometry(0.06, 0.3, 6, 14), 0, -0.07, 0, 0, 0, Math.PI / 2), at(new CylinderGeometry(0.03, 0.03, 0.14, 10), 0, -0.01, 0.03)]);
      break;
    case "lanceur":
      // Boîtier à bords arrondis, tambour du câble, buse vers l'avant.
      g = merge([new RoundedBoxGeometry(0.09, 0.11, 0.2, 3, 0.02), at(new CylinderGeometry(0.05, 0.05, 0.05, 16), 0.05, 0, -0.02, 0, 0, Math.PI / 2), at(new CylinderGeometry(0.014, 0.018, 0.08, 10), 0, 0.02, 0.13, Math.PI / 2, 0, 0)]);
      break;
    case "fourreau":
      // Étui à lames : boîte longue, arêtes adoucies, poignées en tête.
      g = merge([new RoundedBoxGeometry(0.075, 0.44, 0.15, 3, 0.015), at(new BoxGeometry(0.03, 0.08, 0.04), 0, 0.25, 0.03), at(new BoxGeometry(0.03, 0.08, 0.04), 0, 0.25, -0.03)]);
      break;
    case "lame": {
      // Lame mince à pointe oblique, montée sur une poignée.
      const blade = new PlaneGeometry(0.034, 0.86, 1, 8);
      const p = blade.getAttribute("position");
      for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.4) p.setY(i, p.getY(i) - (p.getX(i) > 0 ? 0.05 : 0));
      blade.translate(0, 0.5, 0);
      const handle = new CylinderGeometry(0.014, 0.016, 0.11, 10);
      handle.translate(0, 0.02, 0);
      g = merge([blade, handle]);
      break;
    }
  }
  g.computeVertexNormals();
  gearCache.set(k, g);
  return g;
}

/**
 * Cape : demi-cylindre souple accroché sous la nuque, qui tombe jusqu'aux cuisses en s'évasant ; plis le long de la chute et
 * capuche roulée au col. Repère : le pivot (sous la nuque, dans le dos), le soldat regardant vers +z.
 */
export function capeGeometry(halfWidth: number, length: number, depth: number, seed: number): BufferGeometry {
  const rand = seeded(derive(seed, 62));
  const nu = 18;
  const nv = 14;
  const pos: number[] = [];
  const idx: number[] = [];
  const folds = 5 + Math.floor(rand() * 3);
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const w = halfWidth * (0.75 + 0.55 * v);
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const a = (u - 0.5) * Math.PI;
      const fold = 0.018 * v * Math.sin(u * folds * Math.PI * 2 + v * 2);
      // Haut : épouse les épaules (arc) ; bas : tombe presque plat, plis plus marqués.
      const x = Math.sin(a) * w;
      const z = -Math.cos(a) * depth * (1 - 0.4 * v) - 0.02 * v + fold;
      const y = -v * length + 0.05 * (1 - Math.cos(a)) * (1 - v);
      pos.push(x, y, z);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i;
    idx.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2);
  }
  const sheet = new BufferGeometry();
  sheet.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  sheet.setIndex(idx);
  // Capuche roulée au col.
  const hood = new CapsuleGeometry(0.05, halfWidth * 1.2, 4, 10);
  hood.rotateZ(Math.PI / 2);
  hood.scale(1, 0.8, 1.1);
  hood.translate(0, 0.0, -depth * 0.9);
  const g = merge([sheet.index ? sheet.toNonIndexed() : sheet, hood.toNonIndexed()]);
  g.computeVertexNormals();
  return g;
}

/**
 * Sangle qui épouse le corps : coupe des sommets de peau dans une tranche autour d'un plan, contour extérieur par secteurs
 * d'angle, décalé vers l'extérieur ; chaque point prend les poids du sommet de peau le plus proche (la sangle suit la peau).
 * `side` (1 ou −1) ne garde que les sommets de ce côté (cuisse gauche ou droite).
 */
export function bodyBand(body: HumanBody, prims: string[], point: Vector3, normal: Vector3, width: number, offset: number, mat: Material, side = 0): SkinnedMesh | null {
  const n = normal.clone().normalize();
  const u = Math.abs(n.y) < 0.9 ? new Vector3(0, 1, 0).cross(n).normalize() : new Vector3(1, 0, 0).cross(n).normalize();
  const v = n.clone().cross(u).normalize();
  const slab = Math.max(0.012, width * 0.4);
  const pts: { p: Vector3; si: number[]; sw: number[] }[] = [];
  for (const name of prims) {
    const m = body.meshes.get(name);
    if (!m) continue;
    const pa = m.geometry.getAttribute("position");
    const si = m.geometry.getAttribute("skinIndex");
    const sw = m.geometry.getAttribute("skinWeight");
    for (let i = 0; i < pa.count; i++) {
      const p = new Vector3(pa.getX(i), pa.getY(i), pa.getZ(i));
      if (side !== 0 && Math.sign(p.x) !== side) continue;
      if (Math.abs(p.clone().sub(point).dot(n)) > slab) continue;
      pts.push({ p, si: [0, 1, 2, 3].map((k) => si.getComponent(i, k)), sw: [0, 1, 2, 3].map((k) => sw.getComponent(i, k)) });
    }
  }
  if (pts.length < 12) return null;
  const c = pts.reduce((acc, q) => acc.add(q.p), new Vector3()).multiplyScalar(1 / pts.length);
  const sectors = 40;
  const best: ({ r: number; q: (typeof pts)[number] } | null)[] = new Array(sectors).fill(null);
  for (const q of pts) {
    const d = q.p.clone().sub(c);
    const a = Math.atan2(d.dot(v), d.dot(u));
    const s = Math.min(sectors - 1, Math.floor(((a + Math.PI) / (Math.PI * 2)) * sectors));
    const r = Math.hypot(d.dot(u), d.dot(v));
    if (!best[s] || r > (best[s] as { r: number }).r) best[s] = { r, q };
  }
  // Secteurs vides : interpolés entre voisins.
  const ring: { r: number; q: (typeof pts)[number] }[] = [];
  for (let s = 0; s < sectors; s++) {
    let k = 0;
    while (!best[(s + k) % sectors] && k < sectors) k++;
    const b = best[(s + k) % sectors];
    if (b) ring.push(b);
  }
  if (ring.length < sectors) return null;
  const pos: number[] = [];
  const skI: number[] = [];
  const skW: number[] = [];
  for (let s = 0; s < sectors; s++) {
    const a = ((s + 0.5) / sectors) * Math.PI * 2 - Math.PI;
    const rs = [-1, 0, 1].map((o) => (ring[(s + o + sectors) % sectors] as { r: number }).r);
    const r = (rs[0] as number) * 0.25 + (rs[1] as number) * 0.5 + (rs[2] as number) * 0.25 + offset;
    const dir = u.clone().multiplyScalar(Math.cos(a)).add(v.clone().multiplyScalar(Math.sin(a)));
    const q = (ring[s] as { q: (typeof pts)[number] }).q;
    for (const e of [-0.5, 0.5]) {
      const p = c.clone().addScaledVector(dir, r).addScaledVector(n, e * width);
      pos.push(p.x, p.y, p.z);
      skI.push(...q.si);
      skW.push(...q.sw);
    }
  }
  const idx: number[] = [];
  for (let s = 0; s < sectors; s++) {
    const a = s * 2;
    const b = ((s + 1) % sectors) * 2;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("skinIndex", new BufferAttribute(new Uint16Array(skI), 4));
  g.setAttribute("skinWeight", new BufferAttribute(new Float32Array(skW), 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new SkinnedMesh(g, mat);
  m.name = "sangle";
  m.castShadow = true;
  m.frustumCulled = false;
  m.bind(body.skeleton, new Matrix4());
  return m;
}

/**
 * Bande sur une couture : les sommets communs à deux régions (même sommet d'origine), triés par angle autour de leur centre,
 * décalés vers l'extérieur et étirés de `width` le long de la couture (`up` : décalage le long de l'axe). Articulée comme la peau.
 */
export function seamBand(body: HumanBody, a: string, b: string, width: number, offset: number, up: number, mat: Material, side = 0): SkinnedMesh | null {
  const ma = body.meshes.get(a);
  const mb = body.meshes.get(b);
  if (!ma || !mb) return null;
  const origB = new Set(mb.geometry.getAttribute("_orig").array as Float32Array);
  const pa = ma.geometry.getAttribute("position");
  const oa = ma.geometry.getAttribute("_orig").array as Float32Array;
  const si = ma.geometry.getAttribute("skinIndex");
  const sw = ma.geometry.getAttribute("skinWeight");
  const seen = new Set<number>();
  const pts: { p: Vector3; si: number[]; sw: number[] }[] = [];
  for (let i = 0; i < pa.count; i++) {
    const o = oa[i] as number;
    if (!origB.has(o) || seen.has(o)) continue;
    const p = new Vector3(pa.getX(i), pa.getY(i), pa.getZ(i));
    if (side !== 0 && Math.sign(p.x) !== side) continue;
    seen.add(o);
    pts.push({ p, si: [0, 1, 2, 3].map((k) => si.getComponent(i, k)), sw: [0, 1, 2, 3].map((k) => sw.getComponent(i, k)) });
  }
  if (pts.length < 6) return null;
  const c = pts.reduce((acc, q) => acc.add(q.p), new Vector3()).multiplyScalar(1 / pts.length);
  // Axe de la couture : normale du plan moyen (plus petite variance des points).
  let best = new Vector3(0, 1, 0);
  let bestVar = Infinity;
  for (let k = 0; k < 64; k++) {
    const th = (k / 64) * Math.PI;
    for (let j = 0; j < 8; j++) {
      const ph = (j / 8) * Math.PI * 2;
      const n = new Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      let vv = 0;
      for (const q of pts) vv += q.p.clone().sub(c).dot(n) ** 2;
      if (vv < bestVar) {
        bestVar = vv;
        best = n;
      }
    }
  }
  // L'axe pointe de la région b vers la région a (la bande déborde sur a).
  const ca = new Vector3();
  for (let i = 0; i < pa.count; i += 7) ca.add(new Vector3(pa.getX(i), pa.getY(i), pa.getZ(i)));
  ca.multiplyScalar(7 / pa.count);
  if (ca.sub(c).dot(best) < 0) best.negate();
  const n = best;
  const u = Math.abs(n.y) < 0.9 ? new Vector3(0, 1, 0).cross(n).normalize() : new Vector3(1, 0, 0).cross(n).normalize();
  const v = n.clone().cross(u).normalize();
  const ang = (q: Vector3): number => Math.atan2(q.clone().sub(c).dot(v), q.clone().sub(c).dot(u));
  pts.sort((x, y) => ang(x.p) - ang(y.p));
  // Couture lissée : moyenne glissante le long de l'anneau, puis rapprochée du plan moyen (pas de dents de scie).
  const ring = pts.map((_, i) => {
    const acc = new Vector3();
    for (let o = -3; o <= 3; o++) acc.add((pts[(i + o + pts.length) % pts.length] as (typeof pts)[number]).p);
    acc.multiplyScalar(1 / 7);
    return acc.addScaledVector(n, -acc.clone().sub(c).dot(n) * 0.8);
  });
  pts.forEach((q, i) => q.p.copy(ring[i] as Vector3));
  const pos: number[] = [];
  const skI: number[] = [];
  const skW: number[] = [];
  for (const q of pts) {
    const radial = q.p.clone().sub(c);
    radial.addScaledVector(n, -radial.dot(n)).normalize();
    for (const e of [-0.35, 0.65]) {
      const p = q.p.clone().addScaledVector(radial, offset).addScaledVector(n, e * width + up);
      pos.push(p.x, p.y, p.z);
      skI.push(...q.si);
      skW.push(...q.sw);
    }
  }
  const idx: number[] = [];
  const m = pts.length;
  for (let s = 0; s < m; s++) {
    const i0 = s * 2;
    const i1 = ((s + 1) % m) * 2;
    idx.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("skinIndex", new BufferAttribute(new Uint16Array(skI), 4));
  g.setAttribute("skinWeight", new BufferAttribute(new Float32Array(skW), 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new SkinnedMesh(g, mat);
  mesh.name = "couture";
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.bind(body.skeleton, new Matrix4());
  return mesh;
}
