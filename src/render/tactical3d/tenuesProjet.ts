import { Vector3 } from "three";
import type { Group, Object3D } from "three";
import type { HumanBody } from "./humanBase";

/**
 * Tenues par institution créées par le projet (C10, `tools/blender/tenues.py`) : pièces rigides, un nœud glTF par os de
 * `humain.glb` (aucune transformation de nœud : la géométrie est dans la pose de repos du corps de base de 1,66 m).
 * Le chargeur les rattache aux os du même nom (comme les accessoires de `humanSoldier`) et pose le décalque d'emblème
 * (`decalque_<emblem_id>.glb`) à l'endroit donné par les extras de la tenue. `GLTFLoader` est importé à la demande ;
 * rien de ce module n'est dans le bundle principal. Les fichiers sont servis sous `assets3d/projet/` (manifeste : `execution`).
 */
export const TENUES_URL = "assets3d/projet/";
/** Hauteur du corps de base (m) pour laquelle les tenues sont ajustées. */
export const HAUTEUR_BASE_M = 1.66;
/** Largeur du décalque tel que modélisé (m) ; la tenue donne la largeur voulue (`emblem_largeur_m`). */
export const DECALQUE_LARGEUR_M = 0.09;
/** Au-delà de cette distance (m), le niveau de détail 1 (≤ 2 000 triangles) remplace le niveau 0. */
export const LOD_DISTANCE_M = 25;

export type TenueId = "bataillon_exploration" | "garnison" | "police_militaire" | "corps_entrainement" | "police_interieure" | "marley_soldat" | "marley_officier";
export type TenueLod = 0 | 1;

export interface TenueDef {
  id: TenueId;
  nom: string;
  /** Institutions (identifiants de `data/`) qui la portent ; `role` précise la variante. */
  institution: string;
  role?: "officier" | "anti_personnel";
  emblem: string;
}

export const TENUES: readonly TenueDef[] = [
  { id: "bataillon_exploration", nom: "Bataillon d'exploration", institution: "org_survey_corps", emblem: "emb_org_survey_corps" },
  { id: "garnison", nom: "Garnison", institution: "org_garrison", emblem: "emb_org_garrison" },
  { id: "police_militaire", nom: "Police militaire", institution: "org_military_police", emblem: "emb_org_military_police" },
  { id: "corps_entrainement", nom: "Corps d'entraînement", institution: "org_training_corps", emblem: "emb_org_training_corps" },
  { id: "police_interieure", nom: "Police intérieure (anti-personnel)", institution: "org_military_police", role: "anti_personnel", emblem: "emb_org_military_police" },
  { id: "marley_soldat", nom: "Soldat de Marley", institution: "fac_marley", emblem: "emb_fac_marley" },
  { id: "marley_officier", nom: "Officier de Marley", institution: "fac_marley", role: "officier", emblem: "emb_fac_marley" },
];

export const TENUE_IDS: readonly TenueId[] = TENUES.map((t) => t.id);

/** Tenue d'une institution (avec variante éventuelle) ; `null` si le projet n'en a pas encore (Paradis civil, Hizuru, alliés). */
export function tenuePourInstitution(institution: string, role?: "officier" | "anti_personnel"): TenueId | null {
  const meme = TENUES.filter((t) => t.institution === institution);
  const exacte = meme.find((t) => t.role === role);
  return (exacte ?? meme.find((t) => t.role === undefined) ?? null)?.id ?? null;
}

export const fichierTenue = (id: TenueId, lod: TenueLod): string => `tenue_${id}_lod${lod}.glb`;
export const fichierDecalque = (emblemId: string): string => `decalque_${emblemId}.glb`;

/** Niveau de détail selon la distance à la caméra (m) : 0 de près, 1 au-delà de `LOD_DISTANCE_M` (hystérésis de 10 % si `actuel`). */
export function choisirLod(distance: number, actuel?: TenueLod): TenueLod {
  const seuil = actuel === 1 ? LOD_DISTANCE_M * 0.9 : actuel === 0 ? LOD_DISTANCE_M * 1.1 : LOD_DISTANCE_M;
  return distance > seuil ? 1 : 0;
}

export interface EmblemeRef {
  id: string;
  os: string;
  pos: [number, number, number];
  largeur: number;
  rotYDeg: number;
}

/** Lit les extras d'un nœud de tenue (`emblem_*`) ; `null` si le nœud ne porte pas d'emblème. */
export function emblemeDepuisExtras(extras: Record<string, unknown>): EmblemeRef | null {
  const { emblem_id: id, emblem_os: os, emblem_pos: pos, emblem_largeur_m: largeur, emblem_rot_y_deg: rot } = extras;
  if (typeof id !== "string" || typeof os !== "string" || typeof largeur !== "number") return null;
  if (!Array.isArray(pos) || pos.length !== 3 || !pos.every((v) => typeof v === "number")) return null;
  return { id, os, pos: [pos[0] as number, pos[1] as number, pos[2] as number], largeur, rotYDeg: typeof rot === "number" ? rot : 0 };
}

export interface TenueChargee {
  id: TenueId;
  lod: TenueLod;
  /** Un nœud par os (nom du nœud = nom de l'os) : un maillage, ou un groupe de maillages s'il y a plusieurs matériaux. */
  pieces: Map<string, Object3D>;
  emblem: EmblemeRef | null;
  decalque: Object3D | null;
}

const cache = new Map<string, Promise<unknown>>();

async function charger(fichier: string): Promise<Group> {
  let p = cache.get(fichier) as Promise<Group> | undefined;
  if (!p) {
    p = import("three/examples/jsm/loaders/GLTFLoader.js").then(async ({ GLTFLoader }) => (await new GLTFLoader().loadAsync(`${TENUES_URL}${fichier}`)).scene);
    cache.set(fichier, p);
    p.catch(() => cache.delete(fichier));
  }
  return p;
}

/** Charge à la demande une tenue (et son décalque d'emblème si elle en porte un) ; mise en cache par fichier. */
export async function chargerTenue(id: TenueId, lod: TenueLod): Promise<TenueChargee> {
  const scene = await charger(fichierTenue(id, lod));
  const pieces = new Map<string, Object3D>();
  let emblem: EmblemeRef | null = null;
  for (const o of scene.children) {
    pieces.set(o.name, o);
    emblem ??= emblemeDepuisExtras(o.userData as Record<string, unknown>);
  }
  if (pieces.size === 0) throw new Error(`${fichierTenue(id, lod)} : aucun maillage`);
  let decalque: Object3D | null = null;
  if (emblem) decalque = (await charger(fichierDecalque((emblem as EmblemeRef).id))).clone(true);
  return { id, lod, pieces, emblem, decalque };
}

export interface TenueSurCorps {
  tenue: TenueChargee;
  /** Retire les pièces du squelette (la géométrie et les matériaux restent en cache). */
  retirer(): void;
}

/**
 * Rattache la tenue aux os du corps par nom de nœud. Les pièces sont dans le repère de repos du corps de base : position =
 * repos − articulation de l'os, échelle = hauteur du corps / 1,66.
 */
export function habiller(body: HumanBody, tenue: TenueChargee): TenueSurCorps {
  const k = body.height / HAUTEUR_BASE_M;
  const ajoutes: Object3D[] = [];
  const poser = (os: string, obj: Object3D, reposBase: Vector3): boolean => {
    const bone = body.bones[os];
    const j = body.joints.get(os);
    if (!bone || !j) return false;
    obj.scale.multiplyScalar(k);
    obj.position.copy(reposBase).multiplyScalar(k).sub(j);
    bone.add(obj);
    ajoutes.push(obj);
    return true;
  };
  for (const [os, noeud] of tenue.pieces) {
    const m = noeud.clone(true);
    m.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    m.scale.set(1, 1, 1);
    if (!poser(os, m, new Vector3())) console.warn(`tenue ${tenue.id} : os absent du corps (${os})`);
  }
  if (tenue.emblem && tenue.decalque) {
    const e = tenue.emblem;
    const d = tenue.decalque.clone(true);
    d.scale.setScalar(e.largeur / DECALQUE_LARGEUR_M);
    d.rotation.y = (e.rotYDeg * Math.PI) / 180;
    poser(e.os, d, new Vector3(e.pos[0], e.pos[1], e.pos[2]));
  }
  return {
    tenue,
    retirer: () => {
      for (const o of ajoutes) o.parent?.remove(o);
      ajoutes.length = 0;
    },
  };
}

/** Charge puis rattache en une étape. */
export async function habillerCorps(body: HumanBody, id: TenueId, lod: TenueLod): Promise<TenueSurCorps> {
  return habiller(body, await chargerTenue(id, lod));
}
