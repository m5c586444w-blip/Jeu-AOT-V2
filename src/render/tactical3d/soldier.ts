import { BoxGeometry, Color, CylinderGeometry, DoubleSide, Group, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3 } from "three";
import type { BufferGeometry, Mesh } from "three";
import { FaceBuilder } from "./townMesh";
import { joint, limb, measureHeight, part, unitSphere } from "./rig";
import { derive, range, seeded } from "./rng";

/**
 * Soldats de l'essai 3D (R1.5) : figure articulée de 1,80 m (même hauteur que le cadrage 2D, `framing.ts`), uniforme du
 * projet (veste gris pierre, pantalon sombre, cape vert-de-gris de la palette 04 §1.2, sans emblème), harnais, réservoir
 * de gaz, lanceurs de crochets aux hanches, fourreaux de lames aux cuisses. Aucun uniforme de l'œuvre n'est reproduit.
 * Trois poses : vol (balancé au bout du câble), accroché (pieds au mur, câble tendu), au sol (lames tirées).
 */
export const SOLDIER_HEIGHT_M = 1.8;
export type SoldierPose = "vol" | "accroche" | "sol";
export const SOLDIER_POSES: readonly SoldierPose[] = ["vol", "accroche", "sol"];

const H = SOLDIER_HEIGHT_M;
const LEG = 0.47 * H;
const THIGH = 0.46 * LEG;
const SHIN = 0.46 * LEG;
const ANKLE = 0.08 * LEG;
const TORSO = 0.3 * H;
const NECK = 0.05 * H;
const HEAD = 0.13 * H;

export interface SoldierMaterials {
  jacket: MeshStandardMaterial;
  trousers: MeshStandardMaterial;
  boots: MeshStandardMaterial;
  leather: MeshStandardMaterial;
  cape: MeshStandardMaterial;
  skin: MeshStandardMaterial;
  steel: MeshStandardMaterial;
  hair: MeshStandardMaterial[];
  all: MeshStandardMaterial[];
}

export function soldierMaterials(): SoldierMaterials {
  const jacket = new MeshStandardMaterial({ color: 0x6d6a60, roughness: 0.85 });
  const trousers = new MeshStandardMaterial({ color: 0x3a3730, roughness: 0.9 });
  const boots = new MeshStandardMaterial({ color: 0x241d17, roughness: 0.6 });
  const leather = new MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.7 });
  const cape = new MeshStandardMaterial({ color: 0x4f6b5a, roughness: 0.9, side: DoubleSide });
  const skin = new MeshStandardMaterial({ color: 0xd9b49a, roughness: 0.6 });
  const steel = new MeshStandardMaterial({ color: 0xa9b0b3, roughness: 0.3, metalness: 0.8 });
  const hair = [0x2b211a, 0x5a3d24, 0xa58a5c, 0x1b1714].map((c) => new MeshStandardMaterial({ color: c, roughness: 0.85 }));
  return { jacket, trousers, boots, leather, cape, skin, steel, hair, all: [jacket, trousers, boots, leather, cape, skin, steel, ...hair] };
}

type SJoint = "bassin" | "torse" | "cou" | "tete" | "epauleG" | "coudeG" | "epauleD" | "coudeD" | "hancheG" | "genouG" | "hancheD" | "genouD" | "cape";

export interface Soldier {
  group: Group;
  joints: Record<SJoint, Group>;
  /** Lanceur de crochet (hanche droite) : départ du câble. */
  launcher: Group;
  pose: SoldierPose;
  setPose(p: SoldierPose, t: number): void;
}

/** Géométries partagées par tous les soldats (une seule copie en mémoire). */
const GEO = {
  thigh: (): BufferGeometry => limb(THIGH, 0.075, 0.055, 0.12, 0.3, 10),
  shin: (): BufferGeometry => limb(SHIN, 0.055, 0.045, 0.15, 0.3, 10),
  upper: (): BufferGeometry => limb(0.29, 0.05, 0.042, 0.1, 0.35, 10),
  fore: (): BufferGeometry => limb(0.26, 0.042, 0.034, 0.08, 0.3, 10),
  torso: (): BufferGeometry => limb(TORSO, 0.15, 0.13, 0.1, 0.3, 14),
  neck: (): BufferGeometry => limb(NECK + 0.04, 0.05, 0.05, 0, 0.5, 8),
  blade: (): BufferGeometry => new BoxGeometry(0.035, 0.9, 0.01),
  tank: (): BufferGeometry => new CylinderGeometry(0.075, 0.075, 0.42, 10),
  launcher: (): BufferGeometry => new BoxGeometry(0.12, 0.1, 0.2),
  sheath: (): BufferGeometry => new BoxGeometry(0.1, 0.42, 0.16),
  strap: (): BufferGeometry => new BoxGeometry(0.03, 0.42, 0.02),
  cape: (): BufferGeometry => {
    const g = new PlaneGeometry(0.62, 0.72, 4, 6);
    g.translate(0, -0.36, 0);
    // Pli : les bords reviennent vers l'avant.
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) p.setZ(i, -(Math.abs(p.getX(i)) ** 2) * 0.8);
    g.computeVertexNormals();
    return g;
  },
};
type GeoKey = keyof typeof GEO;
const cache = new Map<GeoKey, BufferGeometry>();
const geo = (k: GeoKey): BufferGeometry => {
  let g = cache.get(k);
  if (!g) {
    g = GEO[k]();
    cache.set(k, g);
  }
  return g;
};

export function buildSoldier(seed: number, mats: SoldierMaterials): Soldier {
  const rand = seeded(derive(seed, 31));
  const S = unitSphere(12);
  const group = new Group();
  group.name = "soldat";
  const j = {} as Record<SJoint, Group>;
  j.bassin = joint("bassin", group, [0, LEG, 0]);
  j.bassin.add(part(S, mats.trousers, "bassin", [0, -0.02, 0], [0.16, 0.1, 0.11]));
  j.torse = joint("torse", j.bassin, [0, 0.02, 0]);
  j.torse.add(part(geo("torso"), mats.jacket, "veste", [0, TORSO + 0.02, 0], [1, 1, 0.68]));
  // Harnais : bretelles croisées et ceinture.
  for (const s of [1, -1]) j.torse.add(part(geo("strap"), mats.leather, "bretelle", [s * 0.06, TORSO * 0.55, 0.1], [1, 1, 1], [0, 0, s * 0.35]));
  j.torse.add(part(S, mats.leather, "ceinture", [0, 0.02, 0], [0.155, 0.03, 0.115]));
  // Réservoir de gaz au bas du dos, lanceurs aux hanches.
  j.torse.add(part(geo("tank"), mats.steel, "reservoir", [0, 0.1, -0.15], [1, 1, 1], [0, 0, Math.PI / 2]));
  const launcher = joint("lanceur", j.torse, [-0.17, 0.02, 0.02]);
  launcher.add(part(geo("launcher"), mats.steel, "lanceur"));
  j.torse.add(part(geo("launcher"), mats.steel, "lanceur", [0.17, 0.02, 0.02]));
  j.cou = joint("cou", j.torse, [0, TORSO, 0]);
  j.cou.add(part(geo("neck"), mats.skin, "cou", [0, NECK + 0.04, 0]));
  j.tete = joint("tete", j.cou, [0, NECK, 0]);
  j.tete.add(part(S, mats.skin, "tete", [0, HEAD * 0.5, 0.01], [0.095, HEAD * 0.5, 0.11]));
  const hair = mats.hair[Math.floor(rand() * mats.hair.length)] ?? mats.hair[0] ?? mats.skin;
  j.tete.add(part(S, hair, "cheveux", [0, HEAD * 0.66, -0.015], [0.1, HEAD * 0.4, 0.115]));
  // Cape, accrochée aux épaules : elle flotte en vol.
  j.cape = joint("cape", j.torse, [0, TORSO - 0.02, -0.13]);
  j.cape.add(part(geo("cape"), mats.cape, "cape"));
  for (const [s, side] of [[1, "G"], [-1, "D"]] as const) {
    const sh = joint(`epaule${side}`, j.torse, [s * 0.19, TORSO - 0.04, 0]);
    sh.add(part(geo("upper"), mats.jacket, "bras"));
    const el = joint(`coude${side}`, sh, [0, -0.29, 0]);
    el.add(part(geo("fore"), mats.jacket, "avant-bras"));
    el.add(part(S, mats.skin, "main", [0, -0.3, 0.01], [0.045, 0.06, 0.035]));
    // Lame tenue dans le prolongement de la main.
    el.add(part(geo("blade"), mats.steel, "lame", [0, -0.3, 0.42], [1, 1, 1], [Math.PI / 2, 0, 0]));
    const hp = joint(`hanche${side}`, j.bassin, [s * 0.09, -0.03, 0]);
    hp.add(part(geo("thigh"), mats.trousers, "cuisse"));
    hp.add(part(geo("sheath"), mats.steel, "fourreau", [s * 0.11, -0.2, 0], [1, 1, 1], [0, 0, s * 0.1]));
    const kn = joint(`genou${side}`, hp, [0, -THIGH, 0]);
    kn.add(part(geo("shin"), mats.boots, "botte"));
    kn.add(part(S, mats.boots, "pied", [0, -SHIN - ANKLE * 0.5, 0.06], [0.055, ANKLE * 0.55, 0.13]));
    j[`epaule${side}`] = sh;
    j[`coude${side}`] = el;
    j[`hanche${side}`] = hp;
    j[`genou${side}`] = kn;
  }
  const rest = new Map<Group, [number, number, number]>();
  for (const g of Object.values(j)) rest.set(g, [g.rotation.x, g.rotation.y, g.rotation.z]);
  const phase = rand() * 6;

  const soldier: Soldier = {
    group,
    joints: j,
    launcher,
    pose: "sol",
    setPose(p, t) {
      soldier.pose = p;
      for (const [g, r] of rest) g.rotation.set(...r);
      j.bassin.position.y = LEG;
      const w = Math.sin(t * 3 + phase);
      if (p === "vol") {
        // Corps penché vers l'avant, jambes jointes repliées, lames en arrière, cape au vent.
        j.torse.rotation.x = 0.35;
        j.hancheG.rotation.x = 0.35 + 0.1 * w;
        j.hancheD.rotation.x = 0.45 + 0.1 * w;
        j.genouG.rotation.x = 0.9;
        j.genouD.rotation.x = 0.7;
        j.epauleG.rotation.set(0.9, 0, 0.35);
        j.epauleD.rotation.set(0.9, 0, -0.35);
        j.coudeG.rotation.x = -0.4;
        j.coudeD.rotation.x = -0.4;
        j.cape.rotation.x = -0.85 - 0.12 * w;
        j.cou.rotation.x = -0.5;
      } else if (p === "accroche") {
        // Pieds contre le mur (le groupe est tourné pour que « haut » sorte du mur), genoux fléchis, prêt à s'élancer.
        j.hancheG.rotation.x = -0.75;
        j.hancheD.rotation.x = -0.55;
        j.genouG.rotation.x = 1.2;
        j.genouD.rotation.x = 0.95;
        j.bassin.position.y = LEG * 0.82;
        j.torse.rotation.x = 0.5;
        j.epauleG.rotation.set(-0.3, 0, 0.5);
        j.epauleD.rotation.set(-1.2, 0, -0.2);
        j.coudeG.rotation.x = -0.9;
        j.coudeD.rotation.x = -0.3;
        j.cape.rotation.x = -0.25 + 0.05 * w;
        j.cou.rotation.x = -0.6;
      } else {
        // Au sol : en garde, genoux souples, lames tirées vers l'avant.
        j.hancheG.rotation.x = -0.25;
        j.hancheD.rotation.x = 0.15;
        j.genouG.rotation.x = 0.35;
        j.genouD.rotation.x = 0.2;
        j.bassin.position.y = LEG * 0.97 + 0.01 * w;
        j.torse.rotation.x = 0.12;
        j.epauleG.rotation.set(-0.7, 0, 0.3);
        j.epauleD.rotation.set(-0.9, 0, -0.3);
        j.coudeG.rotation.x = -0.7;
        j.coudeD.rotation.x = -0.5;
        j.cape.rotation.x = -0.12 - 0.04 * w;
      }
    },
  };
  soldier.setPose("sol", 0);
  return soldier;
}

/**
 * Soldat simplifié pour l'instanciation (R1.5, 300 soldats) : une seule géométrie à couleurs de sommet,
 * debout, même hauteur (1,80 m).
 */
export function crowdGeometry(): BufferGeometry {
  const fb = new FaceBuilder();
  const at = (x: number, y: number, z: number, s: [number, number, number] = [1, 1, 1], rx = 0): Matrix4 => new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rx), new Vector3(...s));
  const S = unitSphere(8);
  const c = (h: number): Color => new Color(h);
  for (const s of [1, -1]) {
    fb.geometry(new CylinderGeometry(0.065, 0.05, LEG, 6), at(s * 0.09, LEG / 2, 0), c(0x3a3730));
    fb.geometry(new CylinderGeometry(0.05, 0.038, 0.56, 6), at(s * 0.2, LEG + TORSO - 0.3, 0.03, [1, 1, 1], -0.3), c(0x6d6a60));
  }
  fb.geometry(new CylinderGeometry(0.15, 0.13, TORSO, 8), at(0, LEG + TORSO / 2, 0, [1, 1, 0.7]), c(0x6d6a60));
  fb.geometry(S, at(0, LEG + TORSO + NECK + HEAD * 0.5, 0.01, [0.095, HEAD * 0.5, 0.11]), c(0xd9b49a));
  fb.geometry(S, at(0, LEG + TORSO + NECK + HEAD * 0.66, -0.015, [0.1, HEAD * 0.4, 0.115]), c(0x3b2c20));
  fb.geometry(new BoxGeometry(0.6, 0.75, 0.04), at(0, LEG + TORSO - 0.38, -0.14), c(0x4f6b5a));
  fb.geometry(new CylinderGeometry(0.075, 0.075, 0.42, 6), at(0, LEG + 0.1, -0.15, [1, 1, 1]).multiply(new Matrix4().makeRotationZ(Math.PI / 2)), c(0xa9b0b3));
  return fb.build();
}

/** Variation de teinte d'un soldat de la foule (graine). */
export function crowdTint(seed: number, i: number): Color {
  const r = seeded(derive(seed, 4000 + i));
  return new Color(1, 1, 1).multiplyScalar(range(r, 0.85, 1.05));
}

export function disposeSoldierGeometries(): void {
  for (const g of cache.values()) g.dispose();
  cache.clear();
}

/** Les maillages d'un soldat (contrôles). */
export function soldierMeshes(s: Soldier): Mesh[] {
  const out: Mesh[] = [];
  s.group.traverse((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
}

/** Taille d'un soldat : du talon au sommet du crâne, sans les lames tenues à la main (en garde, elles dépassent la tête). */
export function soldierHeight(s: Soldier): number {
  return measureHeight(s.group, (o) => o.name === "lame");
}
