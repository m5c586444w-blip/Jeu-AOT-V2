import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  Quaternion,
  Raycaster,
  RepeatWrapping,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Group, Object3D, Texture } from "three";
import type { BattleView, CameraMode, PickHit, ViewOptions, ViewOverlay } from "../../battleView";
import type { TacticalWorldMap } from "../../../sim/tactical/map";
import type { BattleState, SoldierUnit, TitanUnit, TroopUnit } from "../../../sim/tactical/types";
import { QUALITY, effectivePixelRatio } from "../quality";
import { buildSoldier, soldierMaterials } from "../soldier";
import type { SoldierMaterials } from "../soldier";
import { puffTexture } from "../textures";
import { loadEyeTexture, loadHumanTemplate } from "../humanBase";
import type { HumanTemplate } from "../humanBase";
import { buildHumanSoldier } from "../humanSoldier";
import type { HumanPose } from "../humanAnim";
import { bodyDetailNormals } from "../texturesEnv";
import { dressMaterials } from "../bodies";
import { gearOf, outfitOfSoldier, outfitOfTroop, titanLook } from "../figures/catalog";
import type { GearRole, OutfitId } from "../figures/catalog";
import { crowdFigure, crowdPoseOf } from "../figures/crowd";
import type { CrowdPose } from "../figures/crowd";
import { outfitMaterials, outfitOptions } from "../figures/soldier3";
import { soldierShow, titanShow, troopShow } from "../figures/states";
import type { ShowMemory, SoldierShow, TitanShow, TroopShow } from "../figures/states";
import { buildFigureTitan, titanSkinTexture } from "../figures/titan3";
import type { FigureTitan } from "../figures/titan3";
import { photoUrl } from "../photoTextures";
import { buildBattleWorld } from "./world";
import type { BattleWorld } from "./world";
import { LOD, SIDE_COLORS, cannonGeometry, markerGeometry, tierOf } from "./units";

/**
 * Vue 3D de la bataille réelle (R2+). Lecture seule de l'état de la simulation : décor dérivé de la carte (`world.ts`),
 * soldats (figures complètes près de la caméra, foule instanciée au-delà, repères au loin), fantassins, Titans (figures
 * procédurales de R1 à la taille de la simulation), batteries, impacts, câbles des crochets, sang (violence réaliste).
 * Caméras : stratégique libre (orbite au-dessus du champ de bataille, zoom jusqu'aux soldats) et suivi à la troisième
 * personne. Chargée à la demande (three.js hors du bundle principal).
 */

const UP = new Vector3(0, 1, 0);
const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpS = new Vector3();
const tmpP = new Vector3();

const alive = (m: { mode: string }): boolean => m.mode !== "mort" && m.mode !== "fui";
/** Cadence de la simulation tactique (pas par seconde, `data/balance/tactical.json`). */
const TICK_HZ = 20;
/** R3 : pose d'une figure complète pour un état montré (soldat, fantassin). */
const SOLDIER_POSE: Record<SoldierShow, HumanPose> = { garde: "sol", marche: "marche", course: "course", coupe: "frappe", vol: "vol", accroche: "accroche", saisi: "saisi", chute: "chute", mort: "mort" };
const TROOP_POSE: Record<TroopShow, HumanPose> = { attente: "attente", marche: "marche", tir: "tir", mort: "mort" };

/** Figure complète de R3 : corps de base en tenue (ou soldat en primitives de R1 avant le chargement). */
interface DetailFigure {
  group: Group;
  setPose(p: HumanPose, t: number): void;
  human: boolean;
  dispose(): void;
}

function setInst(mesh: InstancedMesh, i: number, x: number, y: number, z: number, rotY: number, scale = 1, lying = false): void {
  tmpQ.setFromAxisAngle(UP, rotY);
  if (lying) tmpQ.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2));
  tmpM.compose(tmpP.set(x, y + (lying ? 0.18 : 0), z), tmpQ, tmpS.set(scale, scale, scale));
  mesh.setMatrixAt(i, tmpM);
}

/** Orientation d'une figure (modèle tourné vers +Z) pour un cap de la carte (rad, x vers l'est, y vers le sud). */
const yawOf = (heading: number): number => Math.PI / 2 - heading;
/** Azimuts essayés par la caméra de suivi quand la vue de derrière est masquée (du plus proche au plus éloigné). */
const FOLLOW_OFFSETS = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, (-3 * Math.PI) / 4, Math.PI];

interface UnitLayers {
  markers: InstancedMesh;
  blood: InstancedMesh;
  rings: InstancedMesh;
  flashes: InstancedMesh | null;
  cannons: InstancedMesh | null;
  craters: InstancedMesh;
  cables: LineSegments;
  smoke: Mesh[];
  goals: Mesh[];
}

export class View3D implements BattleView {
  readonly kind = "3d" as const;
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly cam = new PerspectiveCamera(50, 1, 0.5, 6000);
  private readonly sun: DirectionalLight;
  private readonly hemi: HemisphereLight;
  private map: TacticalWorldMap | null = null;
  private world: BattleWorld | null = null;
  private layers: UnitLayers | null = null;
  private readonly mats: SoldierMaterials = soldierMaterials();
  /** R3 : corps de base (MakeHuman, CC0) chargé après la première image (« prêt » : repères simplifiés, R1d). */
  private kit: { template: HumanTemplate; eyeMap: Texture } | null = null;
  private kitState: "repere" | "chargement" | "corps" | "primitives" = "repere";
  private kitMs = 0;
  private readonly figTitans = new Map<number, { fig: FigureTitan; human: boolean }>();
  private readonly tMem = new Map<number, ShowMemory<TitanShow>>();
  private readonly sMem = new Map<number, ShowMemory<SoldierShow>>();
  private lastTick = -1;
  private readonly skins = new Map<string, Texture>();
  private readonly outfitMats = new Map<OutfitId, SoldierMaterials>();
  private readonly pools = new Map<string, DetailFigure[]>();
  private readonly batches = new Map<string, { mesh: InstancedMesh; n: number }>();
  private readonly troopLead = new Set<number>();
  private readonly headings = new Map<number, number>();
  private opts: ViewOptions;
  private mode: CameraMode = "strategique";
  /** Orbite stratégique : cible au sol, distance, lacet, tangage. */
  private target = new Vector3(200, 0, 150);
  private dist = 300;
  private yaw = 0;
  private pitch = 0.95;
  private openDist = 300;
  private followGoal: { x: number; y: number; z: number; heading: number; height: number } | null = null;
  /** Décalage d'azimut retenu pour la caméra de suivi (0 : derrière la cible). */
  private followOff = 0;
  private readonly eye = new Vector3();
  private readonly look = new Vector3();
  private counts = { detail: 0, crowd: 0, markers: 0 };
  private readonly ro: ResizeObserver;
  private readonly raycaster = new Raycaster();
  private readonly groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  private time = 0;
  private snapNext = false;
  /** Bouffées de vapeur (toile procédurale de R1, créée au premier Titan) ; peaux des variantes de R3 dans `skins`. */
  private puff: Texture | null = null;

  constructor(private readonly host: HTMLElement, opts: ViewOptions, private readonly seed: number, private readonly night: boolean) {
    this.opts = opts;
    const q = QUALITY[opts.quality];
    this.renderer = new WebGLRenderer({ antialias: q.antialias, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = night ? 0.7 : 1.05;
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.setPixelRatio(effectivePixelRatio(opts.quality, window.devicePixelRatio || 1));
    const canvas = this.renderer.domElement;
    canvas.className = "tactique__toile tactique__toile--3d";
    host.append(canvas);
    const sky = night ? 0x1b2333 : 0xaebfcc;
    this.scene.background = new Color(sky);
    this.scene.fog = new Fog(sky, night ? 120 : 450, night ? 700 : 2200);
    this.hemi = new HemisphereLight(night ? 0x46557a : 0xdfe8f0, night ? 0x1c1a14 : 0x6b6350, night ? 0.5 : 1.5);
    this.scene.add(this.hemi);
    this.sun = new DirectionalLight(night ? 0x9fb1d6 : 0xfff1dc, night ? 0.5 : 2.4);
    this.sun.castShadow = q.shadows;
    this.sun.shadow.mapSize.set(q.shadowMap * 2, q.shadowMap * 2);
    this.scene.add(this.sun, this.sun.target);
    this.cam.up.copy(UP);
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  get camera(): CameraMode {
    return this.mode;
  }

  get zoomLevel(): number {
    return this.openDist / this.dist;
  }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, true);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  setOptions(o: ViewOptions): void {
    const q = QUALITY[o.quality];
    this.renderer.setPixelRatio(effectivePixelRatio(o.quality, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = q.shadows;
    this.sun.castShadow = q.shadows;
    if (o.quality !== this.opts.quality) this.clearPools();
    this.opts = o;
    this.resize();
  }

  setMap(m: TacticalWorldMap): void {
    this.map = m;
    this.world?.dispose();
    if (this.world) this.scene.remove(this.world.group);
    this.world = buildBattleWorld(m, this.seed);
    this.scene.add(this.world.group);
    // Soleil oblique (matin, sud-est), ombre sur toute la carte.
    const c = new Vector3(m.width / 2, 0, m.height / 2);
    this.sun.position.set(c.x + 260, 420, c.z + 180);
    this.sun.target.position.copy(c);
    const ext = Math.max(m.width, m.height) * 0.75;
    const sc = this.sun.shadow.camera;
    sc.left = -ext;
    sc.right = ext;
    sc.top = ext;
    sc.bottom = -ext;
    sc.near = 50;
    sc.far = 1400;
    sc.updateProjectionMatrix();
    this.target.copy(c);
    // Texture de sol (photo CC0 de Poly Haven), chargée après la première image ; la teinte procédurale reste le repli.
    const world = this.world;
    new TextureLoader().load(photoUrl("forrest_ground_01", "diff"), (tex) => {
      if (this.world !== world) {
        tex.dispose();
        return;
      }
      tex.colorSpace = SRGBColorSpace;
      tex.wrapS = RepeatWrapping;
      tex.wrapT = RepeatWrapping;
      tex.repeat.set((m.width + 800) / 4, (m.height + 800) / 4);
      tex.anisotropy = QUALITY[this.opts.quality].anisotropy;
      world.materials.ground.map = tex;
      world.materials.ground.color.multiplyScalar(1.6);
      world.materials.ground.needsUpdate = true;
    });
  }

  /** Couches d'unités, créées au premier dessin (les effectifs sont alors connus). */
  private ensureLayers(st: BattleState): UnitLayers {
    if (this.layers) return this.layers;
    const nS = Math.max(1, st.soldiers.length);
    const nT = st.troops?.length ?? 0;
    // Premier homme de chaque section : officier (tenue de R3).
    const seen = new Set<string>();
    for (const t of st.troops ?? []) {
      if (!seen.has(t.section)) this.troopLead.add(t.id);
      seen.add(t.section);
    }
    const nM = nS + nT + st.titans.length + 8;
    const markers = new InstancedMesh(markerGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: 0x222222 }), nM);
    markers.name = "reperes";
    const blood = new InstancedMesh(new CircleGeometry(1, 14).rotateX(-Math.PI / 2), new MeshStandardMaterial({ color: 0x4a0d0a, roughness: 0.35, transparent: true, opacity: 0.85, depthWrite: false }), nS + nT + st.titans.length);
    blood.name = "sang";
    const rings = new InstancedMesh(new RingGeometry(0.75, 1.0, 20).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0xf2d06b, transparent: true, opacity: 0.9, depthWrite: false }), nS + nT);
    rings.name = "selection";
    const flashes = nT > 0 ? new InstancedMesh(new SphereGeometry(0.22, 6, 4), new MeshBasicMaterial({ color: 0xffd27a }), nT) : null;
    const pieces = (st.batteries ?? []).reduce((n, b) => n + b.count, 0);
    const cannons = pieces > 0 ? new InstancedMesh(cannonGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }), pieces) : null;
    if (cannons) {
      cannons.name = "canons";
      cannons.castShadow = true;
    }
    const craters = new InstancedMesh(new CircleGeometry(1, 16).rotateX(-Math.PI / 2), new MeshStandardMaterial({ color: 0x2e2a24, roughness: 1, transparent: true, opacity: 0.7, depthWrite: false }), 40);
    craters.name = "cratères";
    const cables = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0x1d1d1d }));
    cables.geometry.setAttribute("position", new BufferAttribute(new Float32Array(nS * 6), 3));
    cables.frustumCulled = false;
    const smoke: Mesh[] = [];
    const smokeMat = new MeshStandardMaterial({ color: 0x8c877e, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false });
    for (let i = 0; i < 24; i++) {
      const m = new Mesh(new SphereGeometry(1, 10, 8), smokeMat.clone());
      m.visible = false;
      smoke.push(m);
    }
    const goals: Mesh[] = [];
    for (let i = 0; i < 24; i++) {
      const m = new Mesh(new RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: 0xf2d06b, transparent: true, opacity: 0.8, depthWrite: false }));
      m.visible = false;
      goals.push(m);
    }
    const list: Object3D[] = [markers, blood, rings, craters, cables, ...smoke, ...goals];
    if (flashes) list.push(flashes);
    if (cannons) list.push(cannons);
    for (const o of list) o.frustumCulled = false;
    this.scene.add(...list);
    this.layers = { markers, blood, rings, flashes, cannons, craters, cables, smoke, goals };
    return this.layers;
  }

  /** Titan de R3 : variante tirée de la simulation ; figure en primitives tant que le corps de base n'est pas chargé. */
  private titanFig(t: TitanUnit, mayBuild: boolean): { fig: FigureTitan; built: boolean } {
    const cur = this.figTitans.get(t.id);
    const wantHuman = !!this.kit;
    if (cur && (cur.human || !wantHuman || !mayBuild)) return { fig: cur.fig, built: false };
    const spec = titanLook(t);
    let skin = this.skins.get(spec.skinId);
    if (!skin) {
      skin = titanSkinTexture(spec.skinId, this.seed);
      this.skins.set(spec.skinId, skin);
    }
    this.puff ??= puffTexture();
    const fig = buildFigureTitan(spec, this.seed * 31 + t.id, { template: this.kit?.template ?? null, eyeMap: this.kit?.eyeMap ?? null, skinMap: skin });
    fig.setSteamMap(this.puff);
    fig.inner.group.traverse((o) => {
      o.castShadow = true;
    });
    if (cur) {
      this.scene.remove(cur.fig.inner.group);
      cur.fig.dispose();
    }
    this.scene.add(fig.inner.group);
    this.figTitans.set(t.id, { fig, human: wantHuman });
    return { fig, built: true };
  }

  /** Lot de foule d'une tenue, d'un équipement et d'une pose (créé au premier besoin, capacité : toutes les unités). */
  private batch(o: OutfitId, g: GearRole, pose: CrowdPose, st: BattleState): { mesh: InstancedMesh; n: number } {
    const key = `${o}|${g}|${pose}`;
    let b = this.batches.get(key);
    if (!b) {
      const mesh = new InstancedMesh(crowdFigure(o, g, pose), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), Math.max(1, st.soldiers.length + (st.troops?.length ?? 0)));
      mesh.name = `foule:${key}`;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      b = { mesh, n: 0 };
      this.batches.set(key, b);
    }
    return b;
  }

  /** Figure complète d'une tenue : corps de base habillé, ou soldat de R1 (Bataillon seulement) avant le chargement. */
  private makeFigure(o: OutfitId, g: GearRole, n: number): DetailFigure | undefined {
    let mats = this.outfitMats.get(o);
    if (!mats) {
      mats = outfitMaterials(this.mats, o);
      this.outfitMats.set(o, mats);
    }
    const seed = this.seed + n * 7 + o.length * 101;
    let fig: DetailFigure | undefined;
    if (this.kit) {
      const h = buildHumanSoldier(this.kit.template, seed, mats, { eyeMap: this.kit.eyeMap, outfit: outfitOptions(o, g) });
      fig = { group: h.group, setPose: (p, t) => h.setPose(p, t), human: true, dispose: () => h.dispose() };
    } else if (g === "odm") {
      const r = buildSoldier(seed, mats);
      fig = { group: r.group, setPose: (p, t) => r.setPose(p === "vol" || p === "chute" || p === "saisi" ? "vol" : p === "accroche" ? "accroche" : "sol", t), human: false, dispose: () => undefined };
    }
    if (!fig) return undefined;
    fig.group.traverse((x) => {
      x.castShadow = true;
    });
    this.scene.add(fig.group);
    return fig;
  }

  private clearPools(): void {
    for (const pool of this.pools.values())
      for (const f of pool) {
        this.scene.remove(f.group);
        f.dispose();
      }
    this.pools.clear();
  }

  /** Corps de base chargé après la première image ; figures de R1 et repères en attendant (ou en repli). */
  private startKit(): void {
    if (this.kitState !== "repere") return;
    this.kitState = "chargement";
    const t0 = performance.now();
    void Promise.all([loadHumanTemplate(), loadEyeTexture()])
      .then(([template, eyeMap]) => {
        const detail = bodyDetailNormals(850);
        for (const m of this.outfitMats.values()) dressMaterials(m, detail);
        this.kit = { template, eyeMap };
        this.kitState = "corps";
        this.kitMs = performance.now() - t0;
        this.clearPools();
      })
      .catch(() => {
        this.kitState = "primitives";
      });
  }

  frame(points: readonly { x: number; y: number; z: number }[]): void {
    if (points.length === 0) return;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let zMax = 0;
    for (const p of points) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
      zMax = Math.max(zMax, p.z);
    }
    const pad = 20;
    this.target.set((x0 + x1) / 2, 0, (y0 + y1) / 2 + 10);
    const span = Math.max(x1 - x0 + 2 * pad, ((y1 - y0 + 2 * pad) * 1.1) / Math.max(0.5, Math.sin(this.pitch)), zMax * 2);
    const vfov = (this.cam.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.cam.aspect);
    this.dist = Math.min(1200, Math.max(40, (span / 2 / Math.tan(Math.min(vfov, hfov) / 2)) * 1.05));
    this.openDist = this.dist;
    this.mode = "strategique";
    this.followGoal = null;
    this.placeCamera(true);
  }

  private placeCamera(snapAsked: boolean): void {
    // Au basculement de caméra, la nouvelle vue est prise d'un coup (lisible même à quelques images par seconde).
    const snap = snapAsked || this.snapNext;
    if (this.mode === "suivi" && this.followGoal) this.snapNext = false;
    if (this.mode === "suivi" && this.followGoal) {
      const g = this.followGoal;
      const back = Math.max(16, g.height * 1.8);
      const base = Math.max(9, g.height * 0.95);
      // Ligne de vue dégagée : la caméra se place derrière la cible, ou de biais si un bâtiment la masque de là,
      // assez haut pour voir par-dessus les toits (sans collision réelle : dette n° 50).
      const need = (off: number): number => {
        const a = g.heading + off;
        return Math.max(base, this.sightHeight(g.x, g.y, g.z, g.x - Math.cos(a) * back, g.y - Math.sin(a) * back));
      };
      let off = this.followOff;
      let up = need(off);
      if (up > base + 0.5) {
        for (const o of FOLLOW_OFFSETS) {
          const h = need(o);
          if (h < up - 3) {
            up = h;
            off = o;
          }
        }
      } else if (off !== 0 && need(0) <= base + 0.5) {
        off = 0;
        up = base;
      }
      // Changement de côté : coupe franche (un fondu passerait à travers les maisons).
      const cut = off !== this.followOff;
      this.followOff = off;
      up = Math.min(up, back * 3);
      const dx = Math.cos(g.heading + off);
      const dz = Math.sin(g.heading + off);
      const wantEye = new Vector3(g.x - dx * back, up + g.z, g.y - dz * back);
      // Regard porté devant la cible quand la caméra est basse ; sur la cible quand elle a dû monter au-dessus des toits.
      const ahead = back * 0.6 * Math.max(0, Math.min(1, 1 - (up - base) / (back * 1.5)));
      const wantLook = new Vector3(g.x + dx * ahead, Math.max(1.5, g.z + g.height * 0.45), g.y + dz * ahead);
      if (snap || cut) {
        this.eye.copy(wantEye);
        this.look.copy(wantLook);
      } else {
        this.eye.lerp(wantEye, 0.2);
        this.look.lerp(wantLook, 0.25);
      }
      // Pendant le fondu aussi, la caméra reste au-dessus de ce qui la sépare des hommes suivis.
      const now = Math.min(back * 3, this.sightHeight(g.x, g.y, g.z, this.eye.x, this.eye.z));
      if (now > this.eye.y - g.z) this.eye.y = g.z + now;
    } else {
      const cp = Math.cos(this.pitch);
      const wantEye = new Vector3(this.target.x + Math.sin(this.yaw) * cp * this.dist, Math.sin(this.pitch) * this.dist, this.target.z + Math.cos(this.yaw) * cp * this.dist);
      if (snap) {
        this.eye.copy(wantEye);
        this.look.copy(this.target);
      } else {
        this.eye.lerp(wantEye, 0.35);
        this.look.lerp(this.target, 0.35);
      }
    }
    this.cam.position.copy(this.eye);
    this.cam.lookAt(this.look);
    this.cam.updateMatrixWorld();
  }

  /**
   * Hauteur de caméra (au-dessus de la cible) pour que la ligne de vue de la caméra, placée en (x1, y1), jusqu'aux hommes
   * en (x0, y0, z0) passe au-dessus de chaque volume (bâtiment avec son toit, mur, rocher) qu'elle traverse.
   */
  private sightHeight(x0: number, y0: number, z0: number, x1: number, y1: number): number {
    let up = 0;
    for (const s of this.map?.structures ?? []) {
      if (s.shape !== "box") continue;
      const top = s.h + (s.kind === "batiment" ? Math.min(s.w, s.d) * 0.34 : 0) + 1;
      if (top <= z0) continue;
      for (let k = 1; k <= 12; k++) {
        const f = k / 12;
        const x = x0 + (x1 - x0) * f;
        const y = y0 + (y1 - y0) * f;
        if (x >= s.x - 1 && x <= s.x + s.w + 1 && y >= s.y - 1 && y <= s.y + s.d + 1) {
          // Point de la ligne à la fraction f : z0 + 1 + (up − 1) · f ≥ sommet du volume (marge comprise).
          up = Math.max(up, 1 + (top - z0 - 1) / f);
          break;
        }
      }
    }
    return up;
  }

  setCamera(mode: CameraMode): void {
    if (mode === "strategique" && this.mode === "suivi") {
      // Retour à la vue stratégique au-dessus de ce qu'on suivait.
      this.target.set(this.look.x, 0, this.look.z);
      this.dist = Math.min(this.dist, 220);
    }
    this.mode = mode;
    this.snapNext = true;
    this.followOff = 0;
    if (mode === "strategique") {
      this.followGoal = null;
      this.placeCamera(true);
      this.snapNext = false;
    }
  }

  follow(x: number, y: number, z: number, heading: number, height: number): void {
    this.followGoal = { x, y, z, heading, height };
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    if (this.mode === "suivi") return;
    const p = this.groundAt(sx, sy);
    const next = Math.min(1400, Math.max(12, this.dist / factor));
    const k = 1 - next / this.dist;
    if (p) {
      this.target.x += (p.x - this.target.x) * k;
      this.target.z += (p.y - this.target.z) * k;
    }
    this.dist = next;
    // Plus près du sol, la vue se couche un peu (on voit les hommes de trois quarts).
    this.pitch = Math.max(0.42, Math.min(1.25, 0.42 + (this.dist / 600) * 0.8));
    this.placeCamera(true);
  }

  panBy(dx: number, dy: number): void {
    if (this.mode === "suivi") return;
    const h = Math.max(1, this.host.clientHeight);
    const k = (2 * this.dist * Math.tan(((this.cam.fov / 2) * Math.PI) / 180)) / h;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    this.target.x += (-dx * Math.cos(this.yaw) - dy * fx) * k;
    this.target.z += (dx * Math.sin(this.yaw) - dy * fz) * k;
    if (this.map) {
      this.target.x = Math.max(-100, Math.min(this.map.width + 100, this.target.x));
      this.target.z = Math.max(-100, Math.min(this.map.height + 100, this.target.z));
    }
    this.placeCamera(true);
  }

  rotateBy(rad: number): void {
    this.yaw += rad;
    this.placeCamera(true);
  }

  toScreen(x: number, y: number, z: number): [number, number] | null {
    const v = new Vector3(x, z, y).project(this.cam);
    if (v.z > 1 || v.z < -1) return null;
    return [((v.x + 1) / 2) * this.host.clientWidth, ((1 - v.y) / 2) * this.host.clientHeight];
  }

  groundAt(sx: number, sy: number): { x: number; y: number } | null {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.raycaster.setFromCamera(new Vector2((sx / w) * 2 - 1, -(sy / h) * 2 + 1), this.cam);
    const p = new Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, p)) return null;
    const m = this.map;
    if (m && (p.x < -50 || p.z < -50 || p.x > m.width + 50 || p.z > m.height + 50)) return null;
    return { x: m ? Math.max(0, Math.min(m.width, p.x)) : p.x, y: m ? Math.max(0, Math.min(m.height, p.z)) : p.z };
  }

  pick(st: BattleState, sx: number, sy: number): PickHit | null {
    let best: PickHit | null = null;
    let bd = Infinity;
    const px = (d: number): number => {
      // Rayon de prise : 0,9 m à la distance de l'unité, au moins 9 px.
      const f = this.host.clientHeight / (2 * Math.tan(((this.cam.fov / 2) * Math.PI) / 180));
      return Math.max(9, (0.9 * f) / Math.max(1, d));
    };
    const consider = (kind: PickHit["kind"], index: number, x: number, y: number, z: number, radiusM = 0.9): void => {
      const p = this.toScreen(x, y, z);
      if (!p) return;
      const d = Math.hypot(p[0] - sx, p[1] - sy);
      const dist = this.cam.position.distanceTo(new Vector3(x, z, y));
      const r = px(dist) * (radiusM / 0.9);
      if (d <= r && d / r < bd) {
        bd = d / r;
        best = { kind, index };
      }
    };
    st.soldiers.forEach((s, i) => {
      if (alive(s)) consider("soldat", i, s.x, s.y, s.z + 0.9);
    });
    (st.troops ?? []).forEach((t, i) => {
      if (alive(t)) consider("troupe", i, t.x, t.y, 0.9);
    });
    st.titans.forEach((t, i) => {
      if (!t.alive) return;
      for (const k of [0.25, 0.5, 0.8]) consider("titan", i, t.x, t.y, t.height * k, t.height * 0.22);
    });
    return best;
  }

  draw(st: BattleState, prev: readonly { x: number; y: number; z: number }[] | null, alpha: number, overlay: ViewOverlay): void {
    const L = this.ensureLayers(st);
    const lod = LOD[this.opts.quality];
    const realistic = this.opts.violence === "realiste";
    this.time = st.tick / 20 + alpha / 20;
    if (this.mode === "suivi") this.placeCamera(false);
    const camPos = this.cam.position;
    let markerN = 0;
    let bloodN = 0;
    let ringN = 0;
    const posOf = (s: SoldierUnit, i: number): { x: number; y: number; z: number } => {
      const p = prev?.[i];
      if (!p || s.mode === "mort") return s;
      return { x: p.x + (s.x - p.x) * alpha, y: p.y + (s.y - p.y) * alpha, z: p.z + (s.z - p.z) * alpha };
    };
    const headingOf = (key: number, dx: number, dy: number): number => {
      const h0 = this.headings.get(key);
      if (Math.abs(dx) + Math.abs(dy) < 1e-3) return h0 ?? -Math.PI / 2;
      const h = Math.atan2(dy, dx);
      this.headings.set(key, h);
      return h;
    };
    // R3 : états montrés, lus sur la simulation une fois par pas (mémoire par figure : chute, coup de lame, fondu).
    const newTick = st.tick !== this.lastTick;
    const dtS = this.lastTick < 0 ? 0 : Math.max(0, st.tick - this.lastTick) / TICK_HZ;
    const nowS = st.tick / TICK_HZ;
    if (newTick) {
      for (const t of st.titans) this.tMem.set(t.id, titanShow(this.tMem.get(t.id) ?? null, t, nowS, dtS));
      st.soldiers.forEach((s, i) => this.sMem.set(i, soldierShow(this.sMem.get(i) ?? null, s, nowS, dtS)));
      this.lastTick = st.tick;
    }
    // Titans d'abord (la main d'un Titan porte l'homme qu'il a saisi).
    let titanBudget = 1;
    for (const t of st.titans) {
      const entry = this.titanFig(t, titanBudget > 0);
      if (entry.built) titanBudget--;
      const fig = entry.fig;
      fig.inner.group.position.set(t.x, 0, t.y);
      fig.inner.group.rotation.set(0, yawOf(t.heading), 0);
      const mem = this.tMem.get(t.id) ?? titanShow(null, t, nowS, 0);
      fig.show(mem, this.time + (t.id % 7) * 0.31, { armL: t.armL, armR: t.armR, legs: t.legs }, t.killedBy !== null);
      const d = camPos.distanceTo(tmpP.set(t.x, t.height / 2, t.y));
      if (t.alive && d > lod.markerM * 0.9) {
        setInst(L.markers, markerN, t.x, t.height + 2, t.y, 0, Math.min(5, d / 120));
        L.markers.setColorAt(markerN++, SIDE_COLORS.titan);
      }
      if (realistic && !t.alive) setInst(L.blood, bloodN++, t.x, 0.02, t.y, 0, t.height * 0.18);
    }
    const handOf = (titan: number | null): Vector3 | null => {
      const t = titan === null ? undefined : st.titans[titan];
      const e = t ? this.figTitans.get(t.id) : undefined;
      return e ? e.fig.hand(new Vector3()) : null;
    };
    // Soldats et fantassins : figures complètes (tenue de R3) pour les plus proches, foule par lots (tenue × pose), repères au loin.
    const want: { kind: "soldat" | "troupe"; i: number; d: number; outfit: OutfitId; gear: GearRole }[] = [];
    const crowdAdd = (o: OutfitId, g: GearRole, pose: CrowdPose, x: number, y: number, z: number, rot: number, color: Color): void => {
      const b = this.batch(o, g, pose, st);
      setInst(b.mesh, b.n, x, z, y, rot);
      b.mesh.setColorAt(b.n++, color);
    };
    const WHITE = new Color(1, 1, 1);
    const WOUND = new Color(0xd9a89c);
    for (const b of this.batches.values()) b.n = 0;
    const soldierOutfit = outfitOfSoldier();
    st.soldiers.forEach((s, i) => {
      if (s.mode === "fui") return;
      const p = posOf(s, i);
      const show = this.sMem.get(i)?.state ?? "garde";
      if (s.mode === "mort") {
        crowdAdd(soldierOutfit, "odm", "mort", p.x, p.y, 0, yawOf(this.headings.get(i) ?? 0), WHITE);
        if (realistic) setInst(L.blood, bloodN++, p.x + 0.3, 0.02, p.y, 0, 0.9);
        return;
      }
      if (s.mode === "saisi") {
        const h = handOf(s.grabbedBy);
        if (h) {
          p.x = h.x;
          p.y = h.z;
          p.z = Math.max(0, h.y - 1.1);
        }
      }
      const d = camPos.distanceTo(tmpP.set(p.x, p.z, p.y));
      const tier = tierOf(d, this.opts.quality);
      if (tier === "detail") want.push({ kind: "soldat", i, d, outfit: soldierOutfit, gear: "odm" });
      else if (tier === "foule") crowdAdd(soldierOutfit, "odm", crowdPoseOf(show, this.time + i * 0.37), p.x, p.y, p.z, yawOf(headingOf(i, s.vx, s.vy)), s.wound === "grave" && realistic ? WOUND : WHITE);
      else {
        setInst(L.markers, markerN, p.x, p.z, p.y, 0, Math.min(3, d / 160));
        L.markers.setColorAt(markerN++, SIDE_COLORS.soldat);
      }
      if (overlay.soldiers.has(i)) setInst(L.rings, ringN++, p.x, Math.max(0.05, p.z - 0) + 0.05, p.y, 0, 1);
      if (realistic && s.wound === "grave") setInst(L.blood, bloodN++, p.x, 0.02, p.y, 0, 0.35);
    });
    let flashN = 0;
    (st.troops ?? []).forEach((t, k) => {
      if (t.mode === "fui") return;
      const o = outfitOfTroop(t, this.troopLead.has(t.id));
      const g = gearOf(o, true);
      const show = troopShow(t, st.tick, TICK_HZ);
      if (t.mode === "mort") {
        crowdAdd(o, g, "mort", t.x, t.y, 0, yawOf(t.heading), WHITE);
        if (realistic) setInst(L.blood, bloodN++, t.x + 0.3, 0.02, t.y, 0, 0.85);
        return;
      }
      const d = camPos.distanceTo(tmpP.set(t.x, 0, t.y));
      const tier = tierOf(d, this.opts.quality);
      if (tier === "repere") {
        setInst(L.markers, markerN, t.x, 0, t.y, 0, Math.min(3, d / 160));
        L.markers.setColorAt(markerN++, t.side === "allie" ? SIDE_COLORS.allie : SIDE_COLORS.ennemi);
      } else if (tier === "detail" && this.kit) want.push({ kind: "troupe", i: k, d, outfit: o, gear: g });
      else crowdAdd(o, g, crowdPoseOf(show, this.time + t.id * 0.29), t.x, t.y, 0, yawOf(t.heading), t.wounded && realistic ? WOUND : WHITE);
      if (L.flashes && t.shot >= 0 && st.tick - t.shot <= 1) setInst(L.flashes, flashN++, t.x + Math.cos(t.heading) * 0.9, 1.45, t.y + Math.sin(t.heading) * 0.9, 0, 1);
      if (overlay.troops.has(t.id)) setInst(L.rings, ringN++, t.x, 0.05, t.y, 0, 1);
    });
    if (L.flashes) {
      L.flashes.count = flashN;
      L.flashes.instanceMatrix.needsUpdate = true;
    }
    // Figures complètes : les plus proches, plafond par qualité ; deux corps de base construits au plus par image.
    want.sort((a, b) => a.d - b.d);
    const used = new Map<string, number>();
    let build = 2;
    let nDetail = 0;
    for (const w of want) {
      const key = `${w.outfit}|${w.gear}`;
      const pool = this.pools.get(key) ?? [];
      this.pools.set(key, pool);
      const k = used.get(key) ?? 0;
      let fig = pool[k];
      if (nDetail < lod.detailMax && !fig && build > 0) {
        fig = this.makeFigure(w.outfit, w.gear, pool.length);
        build--;
        if (fig) pool.push(fig);
      }
      if (!fig || nDetail >= lod.detailMax) {
        // Au-delà du plafond, ou corps pas encore construit : la foule.
        if (w.kind === "soldat") {
          const s = st.soldiers[w.i] as SoldierUnit;
          const p = posOf(s, w.i);
          crowdAdd(w.outfit, w.gear, crowdPoseOf(this.sMem.get(w.i)?.state ?? "garde", this.time + w.i * 0.37), p.x, p.y, p.z, yawOf(headingOf(w.i, s.vx, s.vy)), WHITE);
        } else {
          const t = (st.troops ?? [])[w.i] as TroopUnit;
          crowdAdd(w.outfit, w.gear, crowdPoseOf(troopShow(t, st.tick, TICK_HZ), this.time + t.id * 0.29), t.x, t.y, 0, yawOf(t.heading), WHITE);
        }
        continue;
      }
      used.set(key, k + 1);
      nDetail++;
      fig.group.visible = true;
      if (w.kind === "soldat") {
        const s = st.soldiers[w.i] as SoldierUnit;
        const p = posOf(s, w.i);
        if (s.mode === "saisi") {
          const h = handOf(s.grabbedBy);
          if (h) {
            p.x = h.x;
            p.y = h.z;
            p.z = Math.max(0, h.y - 1.1);
          }
        }
        fig.group.position.set(p.x, p.z, p.y);
        fig.group.rotation.set(0, yawOf(headingOf(w.i, s.vx, s.vy)), 0);
        fig.setPose(SOLDIER_POSE[this.sMem.get(w.i)?.state ?? "garde"], this.time + w.i * 0.37);
      } else {
        const t = (st.troops ?? [])[w.i] as TroopUnit;
        fig.group.position.set(t.x, 0, t.y);
        fig.group.rotation.set(0, yawOf(t.heading), 0);
        fig.setPose(TROOP_POSE[troopShow(t, st.tick, TICK_HZ)], this.time + t.id * 0.29);
      }
    }
    for (const [key, pool] of this.pools) for (let k = used.get(key) ?? 0; k < pool.length; k++) (pool[k] as DetailFigure).group.visible = false;
    let crowdN = 0;
    for (const b of this.batches.values()) {
      b.mesh.count = b.n;
      b.mesh.visible = b.n > 0;
      b.mesh.instanceMatrix.needsUpdate = true;
      if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
      crowdN += b.n;
    }
    // Batteries : une pièce par canon, en ligne ; les pièces réduites au silence sont renversées.
    if (L.cannons && st.batteries) {
      let n = 0;
      for (const b of st.batteries) {
        for (let k = 0; k < b.count; k++) {
          const x = b.x + (k - (b.count - 1) / 2) * 5;
          const rot = b.side === "allie" ? Math.PI : 0;
          if (k < b.alive) setInst(L.cannons, n++, x, 0, b.y, rot);
          else setInst(L.cannons, n++, x, 0, b.y, rot + 0.6, 1, true);
        }
      }
      L.cannons.count = n;
      L.cannons.instanceMatrix.needsUpdate = true;
    }
    // Impacts : fumée des trois dernières secondes, cratères des 40 derniers coups.
    const imp = st.impacts ?? [];
    let smokeN = 0;
    imp.forEach((p, k) => {
      setInst(L.craters, k, p.x, 0.03, p.y, 0, Math.max(1, p.r * 0.35));
      const age = this.time - p.t;
      if (age >= 0 && age < 3 && smokeN < L.smoke.length) {
        const m = L.smoke[smokeN++] as Mesh;
        m.visible = true;
        const r = p.r * (0.4 + age * 0.45);
        m.position.set(p.x, r * 0.6, p.y);
        m.scale.set(r, r * 0.8, r);
        (m.material as MeshStandardMaterial).opacity = 0.6 * (1 - age / 3);
      }
    });
    for (let k = smokeN; k < L.smoke.length; k++) (L.smoke[k] as Mesh).visible = false;
    L.craters.count = imp.length;
    L.craters.instanceMatrix.needsUpdate = true;
    // Câbles : du lanceur du soldat au point d'ancrage (crochet tiré ou tendu).
    const pos = L.cables.geometry.getAttribute("position") as BufferAttribute;
    let cableN = 0;
    st.soldiers.forEach((s, i) => {
      if ((s.mode !== "crochet" && s.mode !== "rail") || !s.anchor) return;
      const p = posOf(s, i);
      let a: { x: number; y: number; z: number } | null = null;
      if (s.anchor.kind === "fixe") a = { x: s.anchor.x, y: s.anchor.y, z: s.anchor.z };
      else {
        const t = st.titans[s.anchor.titan];
        if (t?.alive) a = { x: t.x, y: t.y, z: t.height * 0.8 };
      }
      if (!a) return;
      pos.setXYZ(cableN * 2, p.x, p.z + 1.0, p.y);
      pos.setXYZ(cableN * 2 + 1, a.x, a.z, a.y);
      cableN++;
    });
    pos.needsUpdate = true;
    L.cables.geometry.setDrawRange(0, cableN * 2);
    // Destinations et zones (interface).
    let g = 0;
    const goal = (x: number, y: number, r: number, color: number): void => {
      const m = L.goals[g++];
      if (!m) return;
      m.visible = true;
      m.position.set(x, 0.08, y);
      m.scale.set(r, 1, r);
      (m.material as MeshBasicMaterial).color.setHex(color);
    };
    for (const d of overlay.dests) goal(d.x, d.y, 3, 0xf2d06b);
    for (const z of overlay.zones) goal(z.x, z.y, z.r, z.kind === "tir" ? 0xd9634a : 0x7fb3d5);
    for (; g < L.goals.length; g++) (L.goals[g] as Mesh).visible = false;
    for (const [mesh, n] of [[L.markers, markerN], [L.blood, bloodN], [L.rings, ringN]] as const) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    L.blood.visible = realistic;
    this.counts = { detail: nDetail, crowd: crowdN, markers: markerN };
  }

  render(): void {
    if (this.mode === "strategique") this.placeCamera(false);
    this.renderer.render(this.scene, this.cam);
    this.startKit();
  }

  stats(): { calls: number; triangles: number; detail: number; crowd: number; markers: number; bodies: string } {
    const r = this.renderer.info.render;
    const human = [...this.figTitans.values()].filter((e) => e.human).length;
    const bodies = this.kitState === "corps" ? `corps de base ${(this.kitMs / 1000).toFixed(1)} s, Titans ${human}/${this.figTitans.size}, lots ${this.batches.size}` : this.kitState;
    return { calls: r.calls, triangles: r.triangles, ...this.counts, bodies };
  }

  destroy(): void {
    this.ro.disconnect();
    this.world?.dispose();
    for (const e of this.figTitans.values()) e.fig.dispose();
    this.clearPools();
    for (const t of this.skins.values()) t.dispose();
    this.scene.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      const mat = m.material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
      for (const x of mat ? (Array.isArray(mat) ? mat : [mat]) : []) x.dispose();
    });
    this.puff?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}

/** Entrée chargée à la demande par l'écran de bataille (import dynamique : three.js n'entre jamais dans le bundle principal). */
export function createView3d(host: HTMLElement, opts: ViewOptions, seed: number, night: boolean): BattleView {
  return new View3D(host, opts, seed, night);
}
