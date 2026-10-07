import { Box3, BufferAttribute, Color, DoubleSide, Frustum, Group, IcosahedronGeometry, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { BufferGeometry, Material, PerspectiveCamera, Texture } from "three";
import type { FrozenPlan, Place, PlaceView, RingProfile, Species, WallsParams } from "../../../data/placeSchema";
import { phys } from "../meshProps";
import { treeParts } from "../meshVegetation";
import { leafTex, wallStoneTex } from "../texturesEnv";
import { parementMaterial, parementTextures } from "../parement";
import { buildGround } from "./ground3d";
import type { GroundMeshes } from "./ground3d";
import { InstanceLayer } from "./instanceLayer";
import type { ChunkState, LayerPart } from "./instanceLayer";
import { addHouse, batchCounts, batchesHash, placeBatches } from "./instances";
import type { Batch, Batches } from "./instances";
import { CHUNK, chunkXY, layoutPlace } from "./layout";
import type { HouseInst, PlaceLayout } from "./layout";
import { createPlaceMaterials } from "./placeMaterials";
import type { FacadePart, PlaceMaterials } from "./placeMaterials";
import { boxGeometry, chimneyGeometry, dormerGeometry, dormerRoofGeometry, gableGeometry, roofGeometry, rubbleGeometry } from "./unitGeo";
import { buildWallGeometry } from "./wall3d";
import type { ExtrasResult } from "./extras";
import { frozenLayout, frozenPlace } from "./frozen";

/**
 * Chargeur unique des lieux N1 (R1e, consigne §2.3) : `loadPlace(id)` lit le plan validé (`/places3d/<id>.json`, servi hors du
 * bundle) et les murailles (`/places3d/_murs.json`), puis `buildPlaceScene` construit :
 * - maisons courantes et bâtiments repères en pièces instanciées par archétype (une seule géométrie unité par pièce, un
 *   `InstancedMesh` par lot), arbres instanciés par essence (trois niveaux de détail) ;
 * - sol, chaussées, eau, ponts et murailles en géométries fusionnées (statique), textures partagées ;
 * - tronçons de 64 m : à chaque mouvement de caméra, seuls les tronçons dans le champ sont recopiés, avec leur niveau de détail
 *   (cheminées, lucarnes et arbres détaillés de près seulement).
 */
export interface SceneView {
  eye: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface PlaceScene {
  group: Group;
  place: Place;
  layout: PlaceLayout;
  batches: Batches;
  /** Empreinte de rendu (CR1e-09) : même plan → même empreinte. */
  hash: string;
  counts: Record<string, number>;
  windowMaterials: MeshStandardMaterial[];
  lanternMaterial: MeshStandardMaterial;
  lamps: Vector3[];
  views: Record<string, SceneView>;
  /** Met à jour les tronçons visibles ; renvoie le nombre d'instances dessinées. */
  update(camera: PerspectiveCamera, force?: boolean): number;
  /** Distance au-delà de laquelle les tronçons ne sont plus dessinés (brouillard opaque) ; Infinity : aucune limite. */
  setFarLimit(m: number): void;
  /** Changement de vue (repères d'échelle des portes). */
  onView(view: string): void;
  chunkStats(): { total: number; visible: number; near: number };
  dispose(): void;
}

export const viewOf = (v: PlaceView): SceneView => ({ eye: [v.oeil[0], v.oeil[2], v.oeil[1]], target: [v.cible[0], v.cible[2], v.cible[1]], fov: v.fov });

/** Bâtiment repère sans constructeur propre : rendu comme une grande maison de son gabarit (toit, façade, teinte). */
export function landmarkHouse(b: PlaceLayout["landmarks"][number]): HouseInst {
  return {
    id: b.id,
    x: b.position[0],
    y: b.position[1],
    a: (b.angle_deg * Math.PI) / 180,
    w: b.emprise_m[0],
    d: b.emprise_m[1],
    floors: b.etages,
    fh: b.hauteur_m / b.etages,
    roof: b.toit,
    pitch: typeof b.params?.["pente"] === "number" ? b.params["pente"] : 48,
    cover: b.couverture,
    facade: b.facade,
    tint: b.teinte,
    shop: false,
    corner: false,
    chunk: b.chunk,
    ruin: b.ruin,
  };
}

/** Houppier lointain : icosaèdre (20 faces) aux dimensions du houppier simplifié, à sa couleur moyenne. */
function crownBlob(solid: BufferGeometry): BufferGeometry {
  solid.computeBoundingBox();
  const bb = solid.boundingBox as Box3;
  const c = bb.getCenter(new Vector3());
  const h = bb.getSize(new Vector3()).multiplyScalar(0.5);
  const g = new IcosahedronGeometry(1, 0);
  g.scale(h.x, h.y, h.z);
  g.translate(c.x, c.y, c.z);
  const col = solid.getAttribute("color");
  const avg = [0, 0, 0];
  if (col) for (let i = 0; i < col.count; i++) for (let k = 0; k < 3; k++) avg[k] = (avg[k] as number) + col.getComponent(i, k) / col.count;
  const n = g.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set(col ? avg : [1, 1, 1], i * 3);
  g.setAttribute("color", new BufferAttribute(arr, 3));
  return g;
}

const TREE_KIND = (sp: Species): "feuillu" | "conifere" | "fruitier" => (sp === "pin" ? "conifere" : sp === "fruitier" ? "fruitier" : "feuillu");
const BARK: Partial<Record<Species, string>> = { bouleau: "#d8d4c8", pin: "#7a5a44", geant: "#6e5642" };

export interface BuildOpts {
  seed: number;
  state?: string | null;
  /** Ouvrages à part (portes, repères à constructeur propre) : repères pris en charge, vues ajoutées, rappel de vue. */
  custom?: (scene: { place: Place; layout: PlaceLayout; ring: RingProfile | null; materials: PlaceMaterials; group: Group }) => ExtrasResult;
  /** Témoin de mesure (banc, CR1e-05) : parement de R1d, une texture répétée tous les 9,6 × 4,8 m. */
  r1dWall?: boolean;
  /** Lieu N2 figé : instances lues du plan (aucun générateur ni tracé d'îlots), champs au sol. */
  frozen?: FrozenPlan;
}

export function buildPlaceScene(place: Place, walls: WallsParams, opts: BuildOpts): PlaceScene {
  const layout = opts.frozen ? frozenLayout(opts.frozen, place) : layoutPlace(place, opts.state);
  const group = new Group();
  group.name = `lieu-${place.id}`;
  const mats = createPlaceMaterials(opts.seed);
  const ring = place.enceinte ? walls.anneaux[place.enceinte.mur] : null;
  const extras = opts.custom?.({ place, layout, ring, materials: mats, group }) ?? null;
  const handled = extras?.handled ?? new Set<string>();
  const batches = placeBatches(layout);
  for (const b of layout.landmarks) if (!handled.has(b.id)) addHouse(batches, landmarkHouse(b));
  const hash = batchesHash(batches);

  // Géométries unité (partagées) et résolution des lots en pièces dessinées.
  const geos = new Map<string, BufferGeometry>();
  const geo = (k: string, make: () => BufferGeometry): BufferGeometry => {
    let g = geos.get(k);
    if (!g) {
      g = make();
      geos.set(k, g);
    }
    return g;
  };
  const leaves = leafTex(opts.seed);
  const woodMat = new Map<Species, MeshStandardMaterial>();
  const foliage = new MeshStandardMaterial({ roughness: 0.9 });
  const leafMat = new MeshStandardMaterial({ map: leaves, alphaTest: 0.42, side: DoubleSide, roughness: 0.8 });
  const extraMats: Material[] = [foliage, leafMat];
  const ALL: readonly ChunkState[] = [1, 2, 3];
  const NEAR: readonly ChunkState[] = [2, 3];
  const resolve = (b: Batch): LayerPart[] => {
    switch (b.kind) {
      case "rdc":
      case "etages":
        return [{ geometry: geo("boite", boxGeometry), material: mats.facade(b.mat as never, b.kind as FacadePart), states: ALL, castShadow: true, tinted: true, info: true }];
      case "pignon":
        return [{ geometry: geo(b.geo, () => gableGeometry(b.geo as never)), material: mats.facade(b.mat as never, "pignon"), states: ALL, castShadow: true, tinted: true, info: true }];
      case "lucarne":
        return [{ geometry: geo("lucarne", dormerGeometry), material: mats.facade(b.mat as never, "lucarne"), states: NEAR, castShadow: false, tinted: true, info: true }];
      case "lucarne_toit": {
        const r = mats.roof(b.mat as never);
        return [{ geometry: geo("lucarne_toit", dormerRoofGeometry), material: r.mat, states: NEAR, castShadow: false, tinted: true, info: false }];
      }
      case "toit": {
        const r = mats.roof(b.mat as never);
        return [{ geometry: geo(`toit-${b.geo}`, () => roofGeometry(b.geo as never)), material: r.mat, depth: r.depth, states: ALL, castShadow: true, tinted: true, info: false }];
      }
      case "cheminee":
        return [{ geometry: geo("cheminee", chimneyGeometry), material: mats.chimney, states: NEAR, castShadow: false, tinted: true, info: false }];
      case "gravats":
        return [{ geometry: geo("gravats", rubbleGeometry), material: mats.rubble, states: ALL, castShadow: true, tinted: true, info: false }];
      case "arbre": {
        const sp = b.geo as Species;
        const kind = TREE_KIND(sp);
        let wm = woodMat.get(sp);
        if (!wm) {
          wm = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, color: BARK[sp] ? new Color(BARK[sp]) : phys("ecorce").multiplyScalar(1.9) });
          woodMat.set(sp, wm);
          extraMats.push(wm);
        }
        const near = treeParts(kind, true);
        const far = treeParts(kind, false);
        const parts: LayerPart[] = [];
        if (near.wood) parts.push({ geometry: near.wood, material: wm, states: [3], castShadow: true, tinted: false, info: false });
        parts.push({ geometry: near.solid, material: foliage, states: [3], castShadow: true, tinted: true, info: false });
        if (near.cards) parts.push({ geometry: near.cards, material: leafMat, states: [3], castShadow: false, tinted: true, info: false });
        if (far.wood) parts.push({ geometry: far.wood, material: wm, states: [2], castShadow: true, tinted: false, info: false });
        parts.push({ geometry: far.solid, material: foliage, states: [2], castShadow: true, tinted: true, info: false });
        // Au-delà de 480 m : houppier à 20 faces, sans ombre portée (budget de triangles des vues d'ensemble, consigne §4).
        parts.push({ geometry: geo(`arbre-lointain-${kind}`, () => crownBlob(far.solid)), material: foliage, states: [1], castShadow: false, tinted: true, info: false });
        return parts;
      }
    }
  };
  // Le bois et le feuillage utilisent les couleurs de sommet des géométries d'arbres.
  foliage.vertexColors = true;
  leafMat.vertexColors = true;
  const layer = new InstanceLayer(batches, resolve);
  for (const m of layer.meshes) group.add(m);

  // Statique : sol, eau, murailles.
  const ground: GroundMeshes = buildGround(place, layout, opts.seed, opts.frozen?.champs.map((c) => ({ polygone: c.polygone.map(([x, y]) => [x / 10, y / 10] as [number, number]), culture: c.culture })) ?? []);
  group.add(ground.group);
  const textures: Texture[] = [leaves];
  let wallMesh: Mesh | null = null;
  if (ring) {
    const g = buildWallGeometry(place, ring);
    if (g) {
      // Parement sans motif répété (R1e §3.1) : trois appareils mêlés, panneaux, coulures, pied moussu ; photos ensuite.
      let wm: MeshStandardMaterial;
      if (opts.r1dWall) {
        // Témoin : parement de R1d (une texture de pierre répétée tous les 4 × 4 blocs de 2,4 × 1,2 m).
        const st = wallStoneTex(opts.seed);
        st.repeat.set(1 / 9.6, 1 / 4.8);
        textures.push(st);
        wm = new MeshStandardMaterial({ map: st, roughness: 0.95, color: 0xeae4d8 });
      } else {
        const pt = parementTextures(opts.seed);
        textures.push(pt.A, pt.B, pt.C);
        wm = parementMaterial(pt, { uvToMeters: [1, 1], heightAttr: true, height: ring.hauteur_m.valeur, tint: new Color(0xeae4d8) });
      }
      extraMats.push(wm);
      wallMesh = new Mesh(g, wm);
      wallMesh.name = "murailles";
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      group.add(wallMesh);
    }
  }

  // Tronçons : boîte de chaque tronçon (hauteur des bâtiments les plus hauts), état selon le champ et la distance.
  const chunkBoxes = new Map<number, Box3>();
  for (const ck of layout.chunks) {
    const [x, z] = chunkXY(ck);
    chunkBoxes.set(ck, new Box3(new Vector3(x, -2, z), new Vector3(x + CHUNK, 70, z + CHUNK)));
  }
  const states = new Map<number, ChunkState>();
  const frustum = new Frustum();
  const pv = new Matrix4();
  const last = new Matrix4();
  let lastCount = 0;
  const center = new Vector3();
  let farLimit = Infinity;
  const update = (camera: PerspectiveCamera, force = false): number => {
    camera.updateMatrixWorld();
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (!force && pv.equals(last)) return lastCount;
    last.copy(pv);
    frustum.setFromProjectionMatrix(pv);
    const eye = camera.position;
    for (const [ck, box] of chunkBoxes) {
      if (!frustum.intersectsBox(box)) {
        states.set(ck, 0);
        continue;
      }
      box.getCenter(center);
      center.y = Math.min(Math.max(eye.y, 0), 20);
      const d = center.distanceTo(eye);
      states.set(ck, d > farLimit ? 0 : d < 170 ? 3 : d < 480 ? 2 : 1);
    }
    lastCount = layer.update((ck) => states.get(ck) ?? 0);
    return lastCount;
  };

  const views: Record<string, SceneView> = {};
  for (const v of place.points_de_vue) views[v.id] = viewOf(v);
  Object.assign(views, extras?.views ?? {});
  const counts: Record<string, number> = { ...batchCounts(batches), chunks: layout.chunks.length, ilots: place.ilots.length, rues: place.rues.length };
  const lanternMaterial = new MeshStandardMaterial({ color: 0x3a3226, emissive: 0xffc070, emissiveIntensity: 0, roughness: 0.5 });
  extraMats.push(lanternMaterial);
  return {
    group,
    place,
    layout,
    batches,
    hash,
    counts,
    windowMaterials: mats.windowMaterials,
    lanternMaterial,
    lamps: [],
    views,
    update,
    setFarLimit(m) {
      farLimit = m;
      last.identity().multiplyScalar(0);
    },
    onView: (v) => extras?.onView(v),
    chunkStats() {
      let visible = 0;
      let near = 0;
      for (const s of states.values()) {
        if (s > 0) visible++;
        if (s === 3) near++;
      }
      return { total: layout.chunks.length, visible, near };
    },
    dispose() {
      extras?.dispose();
      layer.dispose();
      ground.dispose();
      wallMesh?.geometry.dispose();
      mats.dispose();
      for (const m of extraMats) m.dispose();
      for (const t of textures) t.dispose();
      for (const g of geos.values()) g.dispose();
    },
  };
}

/** Murailles seules (`_murs.json`). */
export async function fetchWalls(base = "places3d/"): Promise<WallsParams> {
  const r = await fetch(`${base}_murs.json`);
  if (!r.ok) throw new Error(`_murs.json : ${r.status}`);
  return (await r.json()) as WallsParams;
}

/** Plan et murailles servis hors du bundle (`vite.config.ts`, greffon `places3d`). */
export async function fetchPlace(id: string, base = "places3d/"): Promise<{ place: Place; walls: WallsParams; frozen?: FrozenPlan }> {
  const get = async (f: string): Promise<unknown> => {
    const r = await fetch(`${base}${f}`);
    if (!r.ok) throw new Error(`lieu ${f} : ${r.status}`);
    return r.json();
  };
  const walls = (await get("_murs.json")) as WallsParams;
  // Lieu N1 (plan d'auteur), sinon lieu N2 figé.
  const r = await fetch(`${base}${id}.json`);
  if (r.ok) return { place: (await r.json()) as Place, walls };
  const frozen = (await get(`generated/${id}.json`)) as FrozenPlan;
  return { place: frozenPlace(frozen), walls, frozen };
}

export async function loadPlace(id: string, opts: BuildOpts): Promise<PlaceScene> {
  const { place, walls, frozen } = await fetchPlace(id);
  return buildPlaceScene(place, walls, frozen ? { ...opts, frozen } : opts);
}
