import { reducedMotion } from "../../motion";
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
import type { Object3D, Texture } from "three";
import type { BattleView, CameraMode, PickHit, ViewOptions, ViewOverlay } from "../../battleView";
import type { TacticalWorldMap } from "../../../sim/tactical/map";
import type { BattleState, SoldierUnit, TitanUnit, TroopUnit } from "../../../sim/tactical/types";
import { QUALITY, effectivePixelRatio } from "../quality";
import { buildSoldier, crowdGeometry, soldierMaterials } from "../soldier";
import type { Soldier, SoldierMaterials, SoldierPose } from "../soldier";
import { TITAN_LARGE, TITAN_SMALL, buildTitan, setSteamTexture } from "../titan";
import { puffTexture, skinTexture } from "../textures";
import type { Titan, TitanPose } from "../titan";
import { photoUrl } from "../photoTextures";
import { buildBattleWorld } from "./world";
import type { BattleWorld } from "./world";
import { LOD, SIDE_COLORS, UNIFORM_COLORS, cannonGeometry, markerGeometry, tierOf, troopGeometry } from "./units";
import { FigureDirector, SOLDIER_POSE, TITAN_POSE, TROOP_POSE } from "./figureState";
import { dressMaterials, loadBodyKit } from "../bodies";
import type { BodyKit } from "../bodies";
import { buildHumanSoldier } from "../humanSoldier";
import type { HumanSoldier } from "../humanSoldier";
import { buildHumanTitan } from "../humanTitan";
import type { HumanTitan } from "../humanTitan";
import type { HumanPose } from "../humanAnim";
import { outfit, outfitForFaction, r3TitanForUnit } from "../figuresR3";
import type { OutfitId } from "../figuresR3";
import { titanSkinTexture } from "../textures";

/**
 * Vue 3D de la bataille réelle (R2+). Lecture seule de l'état de la simulation : décor dérivé de la carte (`world.ts`),
 * soldats (figures complètes près de la caméra, foule instanciée au-delà, repères au loin), fantassins, Titans (figures
 * procédurales de R1 à la taille de la simulation), batteries, impacts, câbles des crochets, sang (violence réaliste).
 * Caméras : stratégique libre (orbite au-dessus du champ de bataille, zoom jusqu'aux soldats) et suivi à la troisième
 * personne. Chargée à la demande (three.js hors du bundle principal).
 * R3 : un directeur d'états (`figureState.ts`) lit la simulation à chaque pas ; « prêt » montre les figures de R1, puis le corps
 * de base (MakeHuman, CC0) est chargé : Titans de R3 (classe la plus proche de la hauteur simulée, corps et peau tirés de la
 * silhouette), soldats en tenue du Corps de Reconnaissance, fantassins en tenue de leur faction (officier en tête de section).
 * Les figures sont construites au fil des images (pas de gel), réattribuées aux unités les plus proches, avec un fondu d'état.
 */
/** Figures de R3 construites par image (second temps). */
const BUILD_SOLDIERS_PER_FRAME = 2;
const BUILD_TITANS_PER_FRAME = 1;

const UP = new Vector3(0, 1, 0);
const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpS = new Vector3();
const tmpP = new Vector3();

const alive = (m: { mode: string }): boolean => m.mode !== "mort" && m.mode !== "fui";

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
  crowd: InstancedMesh;
  troops: InstancedMesh | null;
  /** R3 : fantassins de Paradis (silhouette de la Garnison) ; `troops` garde l'autre camp. */
  troopsA: InstancedMesh | null;
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

/**
 * Matériaux des soldats de la bataille (dette n° 72) : les figures du premier temps (avant les corps détaillés) portent les
 * couleurs de l'uniforme commun du Corps de Reconnaissance ; les tenues de R3 teignent leurs propres copies.
 */
function battleMaterials(): SoldierMaterials {
  const m = soldierMaterials();
  const ex = outfit("exploration");
  m.jacket.color.set(ex.veste);
  m.trousers.color.set(ex.pantalon);
  m.boots.color.set(ex.bottes);
  if (ex.cape) m.cape.color.set(ex.cape);
  return m;
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
  private readonly mats: SoldierMaterials = battleMaterials();
  private readonly detail: Soldier[] = [];
  private readonly titans = new Map<number, Titan>();
  private readonly titanPrev = new Map<number, { x: number; y: number }>();
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
  /** Peau des Titans et bouffées de vapeur (toiles procédurales de R1, créées au premier Titan). */
  private skin: Texture | null = null;
  private puff: Texture | null = null;
  /** R3 : états montrés, corps de base (second temps), Titans et figures en tenue. */
  private readonly director = new FigureDirector();
  private kit: BodyKit | null = null;
  private kitState: "reperes" | "chargement" | "corps" | "repli" = "reperes";
  private readonly humanTitans = new Map<number, HumanTitan>();
  private readonly figs = new Map<string, HumanSoldier>();
  private readonly freeFigs = new Map<OutfitId, HumanSoldier[]>();
  private readonly skins = new Map<string, Texture>();
  private officers = new Set<number>();
  private builtFigs = 0;
  /** Pour les contrôles (smoke) : pose montrée par figure et état du directeur, au dernier dessin. */
  private shownLog: { key: string; state: string; pose: string; r3: boolean }[] = [];

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
    if (o.quality !== this.opts.quality) {
      for (const s of this.detail.splice(0)) this.scene.remove(s.group);
    }
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
    const ex = outfit("exploration");
    const crowd = new InstancedMesh(crowdGeometry({ veste: ex.veste, pantalon: ex.pantalon, bottes: ex.bottes, cape: ex.cape ?? "#355A3C" }), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), nS);
    crowd.name = "foule";
    crowd.castShadow = true;
    const troops = nT > 0 ? new InstancedMesh(troopGeometry("marley"), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), nT) : null;
    if (troops) {
      troops.name = "fantassins";
      troops.castShadow = true;
    }
    const troopsA = nT > 0 ? new InstancedMesh(troopGeometry("paradis"), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), nT) : null;
    if (troopsA) {
      troopsA.name = "fantassins-paradis";
      troopsA.castShadow = true;
    }
    // Officier figuré : le premier homme de chaque section (choix de rendu A).
    const first = new Map<string, number>();
    for (const t of st.troops ?? []) if (!first.has(t.section) || t.id < (first.get(t.section) as number)) first.set(t.section, t.id);
    this.officers = new Set(first.values());
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
    const list: Object3D[] = [crowd, markers, blood, rings, craters, cables, ...smoke, ...goals];
    if (troops) list.push(troops);
    if (troopsA) list.push(troopsA);
    if (flashes) list.push(flashes);
    if (cannons) list.push(cannons);
    for (const o of list) o.frustumCulled = false;
    this.scene.add(...list);
    this.layers = { crowd, troops, troopsA, markers, blood, rings, flashes, cannons, craters, cables, smoke, goals };
    return this.layers;
  }

  private titanOf(t: TitanUnit): Titan {
    let ti = this.titans.get(t.id);
    if (!ti) {
      const base = t.height < 8 ? TITAN_SMALL : TITAN_LARGE;
      this.skin ??= skinTexture(this.seed);
      this.puff ??= puffTexture();
      ti = buildTitan({ ...base, height: t.height, salt: base.salt + t.silhouette }, this.seed * 31 + t.id, this.skin, false);
      setSteamTexture(ti, this.puff);
      ti.group.traverse((o) => {
        o.castShadow = true;
      });
      this.scene.add(ti.group);
      this.titans.set(t.id, ti);
    }
    return ti;
  }

  /** Second temps (R3) : corps de base chargé après la première image ; repli sur les figures de R1 s'il manque. */
  private startBodies(): void {
    if (this.kitState !== "reperes") return;
    this.kitState = "chargement";
    void loadBodyKit(window.location.search).then((kit) => {
      if (!kit.template) {
        this.kitState = "repli";
        return;
      }
      if (kit.detail) dressMaterials(this.mats, kit.detail);
      this.kit = kit;
      this.kitState = "corps";
    });
  }

  private humanTitanOf(t: TitanUnit, budget: { titans: number }): HumanTitan | null {
    const hit = this.humanTitans.get(t.id);
    if (hit || !this.kit?.template || budget.titans <= 0) return hit ?? null;
    budget.titans--;
    const spec = r3TitanForUnit(t.height, t.silhouette, t.id);
    const sk = spec.r3?.skin;
    let map = sk ? this.skins.get(sk.id) : undefined;
    if (sk && !map) {
      map = titanSkinTexture(this.seed, sk);
      this.skins.set(sk.id, map);
    }
    const ti = buildHumanTitan(this.kit.template, spec, this.seed * 31 + t.id, { skinMap: map ?? null, eyeMap: this.kit.eyeMap, skinNormal: this.kit.detail?.skin ?? null });
    this.puff ??= puffTexture();
    setSteamTexture(ti, this.puff);
    ti.group.traverse((o) => {
      o.castShadow = true;
    });
    this.scene.add(ti.group);
    this.humanTitans.set(t.id, ti);
    // La figure de R1 laisse la place.
    const old = this.titans.get(t.id);
    if (old) {
      this.scene.remove(old.group);
      old.dispose();
      this.titans.delete(t.id);
    }
    return ti;
  }

  /** Figure en tenue pour une unité (réattribuée d'une image à l'autre ; construite au fil des images). */
  private figureFor(key: string, id: OutfitId, budget: { soldiers: number }): HumanSoldier | null {
    const hit = this.figs.get(key);
    if (hit) return hit;
    const free = this.freeFigs.get(id)?.pop();
    if (free) {
      this.figs.set(key, free);
      return free;
    }
    if (!this.kit?.template || budget.soldiers <= 0) return null;
    budget.soldiers--;
    const fig = buildHumanSoldier(this.kit.template, this.seed + 101 * this.builtFigs++, this.mats, { eyeMap: this.kit.eyeMap, outfit: outfit(id) });
    fig.group.traverse((o) => {
      o.castShadow = true;
    });
    this.scene.add(fig.group);
    this.figs.set(key, fig);
    return fig;
  }

  /** Pour les contrôles : pose montrée par chaque figure et état du directeur (dernier dessin), corps de base chargé ou non. */
  figures(): { corps: string; list: { key: string; state: string; pose: string; r3: boolean }[] } {
    return { corps: this.kitState, list: this.shownLog };
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
    this.director.update(st);
    this.startBodies();
    const r3 = this.kitState === "corps";
    const budget = { soldiers: BUILD_SOLDIERS_PER_FRAME, titans: BUILD_TITANS_PER_FRAME };
    const log: { key: string; state: string; pose: string; r3: boolean }[] = [];
    if (this.mode === "suivi") this.placeCamera(false);
    const camPos = this.cam.position;
    let crowdN = 0;
    let markerN = 0;
    let bloodN = 0;
    let ringN = 0;
    // Toujours une copie : la vue ne doit jamais écrire dans l'état de la simulation (la branche « saisi » déplace le point).
    const posOf = (s: SoldierUnit, i: number): { x: number; y: number; z: number } => {
      const p = prev?.[i];
      if (!p || s.mode === "mort") return { x: s.x, y: s.y, z: s.z };
      return { x: p.x + (s.x - p.x) * alpha, y: p.y + (s.y - p.y) * alpha, z: p.z + (s.z - p.z) * alpha };
    };
    const headingOf = (key: number, dx: number, dy: number): number => {
      const h0 = this.headings.get(key);
      if (Math.abs(dx) + Math.abs(dy) < 1e-3) return h0 ?? -Math.PI / 2;
      const h = Math.atan2(dy, dx);
      this.headings.set(key, h);
      return h;
    };
    // Soldats : figures complètes pour les plus proches (plafond par qualité), foule instanciée, repères au loin.
    // R3 : les fantassins proches deviennent aussi des figures (en tenue de leur faction) une fois le corps de base chargé.
    type Want = { key: string; d: number; dead: boolean; x: number; y: number; z: number; yaw: number; soldier: number; troop: TroopUnit | null };
    const want: Want[] = [];
    st.soldiers.forEach((s, i) => {
      const p = posOf(s, i);
      if (s.mode === "fui") return;
      if (s.mode === "saisi" && s.grabbedBy !== null) {
        const t = st.titans[s.grabbedBy];
        if (t) {
          p.x = t.x + Math.cos(t.heading) * t.height * 0.12;
          p.y = t.y + Math.sin(t.heading) * t.height * 0.12;
          p.z = t.height * 0.62;
        }
      }
      const dead = s.mode === "mort";
      const d = camPos.distanceTo(tmpP.set(p.x, p.z, p.y));
      const tier = tierOf(d, this.opts.quality);
      if (dead) {
        if (r3 && tier === "detail") want.push({ key: `s${i}`, d, dead, x: p.x, y: p.y, z: 0, yaw: yawOf(this.headings.get(i) ?? 0), soldier: i, troop: null });
        else {
          setInst(L.crowd, crowdN, p.x, 0, p.y, yawOf(this.headings.get(i) ?? 0), 1, true);
          L.crowd.setColorAt(crowdN++, SIDE_COLORS.mort);
        }
        if (realistic) setInst(L.blood, bloodN++, p.x + 0.3, 0.02, p.y, 0, 0.9);
        return;
      }
      const yaw = yawOf(headingOf(i, s.vx, s.vy));
      if (tier === "detail") want.push({ key: `s${i}`, d, dead, x: p.x, y: p.y, z: p.z, yaw, soldier: i, troop: null });
      else if (tier === "foule") {
        setInst(L.crowd, crowdN, p.x, p.z, p.y, yaw);
        L.crowd.setColorAt(crowdN++, s.wound === "grave" && realistic ? new Color(0xc79a8c) : new Color(1, 1, 1));
      } else {
        setInst(L.markers, markerN, p.x, p.z, p.y, 0, Math.min(3, d / 160));
        L.markers.setColorAt(markerN++, SIDE_COLORS.soldat);
      }
      if (overlay.soldiers.has(i)) setInst(L.rings, ringN++, p.x, Math.max(0.05, p.z - 0) + 0.05, p.y, 0, 1);
      if (realistic && s.wound === "grave") setInst(L.blood, bloodN++, p.x, 0.02, p.y, 0, 0.35);
    });
    // Fantassins : foule instanciée teintée par camp, repères au loin, lueur des tirs ; figures en tenue au plus près (R3).
    let troopN = 0;
    let troopAN = 0;
    let flashN = 0;
    const troopInst = (t: TroopUnit): void => {
      const paradis = t.faction === "fac_paradis";
      const mesh = paradis ? L.troopsA : L.troops;
      if (!mesh) return;
      const n = paradis ? troopAN++ : troopN++;
      const color = paradis ? UNIFORM_COLORS.paradis : UNIFORM_COLORS.marley;
      if (t.mode === "mort") {
        setInst(mesh, n, t.x, 0, t.y, yawOf(t.heading), 1, true);
        mesh.setColorAt(n, color.clone().multiplyScalar(0.55));
      } else {
        setInst(mesh, n, t.x, 0, t.y, yawOf(t.heading));
        mesh.setColorAt(n, t.wounded && realistic ? color.clone().lerp(new Color(0x8a2a22), 0.3) : color);
      }
    };
    if (L.troops && st.troops) {
      for (const t of st.troops) {
        if (t.mode === "fui") continue;
        const color = t.side === "allie" ? SIDE_COLORS.allie : SIDE_COLORS.ennemi;
        const d = camPos.distanceTo(tmpP.set(t.x, 0, t.y));
        if (t.mode === "mort") {
          if (realistic) setInst(L.blood, bloodN++, t.x + 0.3, 0.02, t.y, 0, 0.85);
          if (r3 && d <= lod.detailM) want.push({ key: `t${t.id}`, d, dead: true, x: t.x, y: t.y, z: 0, yaw: yawOf(t.heading), soldier: -1, troop: t });
          else troopInst(t);
          continue;
        }
        if (d > lod.markerM) {
          setInst(L.markers, markerN, t.x, 0, t.y, 0, Math.min(3, d / 160));
          L.markers.setColorAt(markerN++, color);
        } else if (r3 && d <= lod.detailM) want.push({ key: `t${t.id}`, d, dead: false, x: t.x, y: t.y, z: 0, yaw: yawOf(t.heading), soldier: -1, troop: t });
        else troopInst(t);
        if (L.flashes && !reducedMotion() && t.shot >= 0 && st.tick - t.shot <= 1) setInst(L.flashes, flashN++, t.x + Math.cos(t.heading) * 0.9, 1.45, t.y + Math.sin(t.heading) * 0.9, 0, 1);
        if (overlay.troops.has(t.id)) setInst(L.rings, ringN++, t.x, 0.05, t.y, 0, 1);
      }
    }
    // Figures complètes : les vivants d'abord, puis les plus proches, dans la limite de la qualité.
    want.sort((a, b) => Number(a.dead) - Number(b.dead) || a.d - b.d);
    const nDetail = Math.min(lod.detailMax, want.length);
    const chosen = want.slice(0, nDetail);
    const overflow = want.slice(nDetail);
    let shown = 0;
    const toCrowd = (w: Want): void => {
      if (w.troop) troopInst(w.troop);
      else if (w.dead) {
        setInst(L.crowd, crowdN, w.x, 0, w.y, w.yaw, 1, true);
        L.crowd.setColorAt(crowdN++, SIDE_COLORS.mort);
      } else {
        setInst(L.crowd, crowdN, w.x, w.z, w.y, w.yaw);
        L.crowd.setColorAt(crowdN++, new Color(1, 1, 1));
      }
    };
    if (r3) {
      // Figures en tenue : celles des unités sorties du lot retournent à la réserve de leur tenue.
      const keep = new Set(chosen.map((w) => w.key));
      for (const [key, fig] of this.figs) {
        if (keep.has(key)) continue;
        fig.group.visible = false;
        this.figs.delete(key);
        const id = fig.outfit?.id ?? "exploration";
        this.freeFigs.set(id, [...(this.freeFigs.get(id) ?? []), fig]);
      }
      for (const fig of this.detail) fig.group.visible = false;
      for (const w of chosen) {
        const officer = w.troop ? this.officers.has(w.troop.id) : false;
        const id: OutfitId = w.troop ? outfitForFaction(w.troop.faction, officer) : "exploration";
        const fig = this.figureFor(w.key, id, budget);
        if (!fig) {
          toCrowd(w);
          continue;
        }
        const sh = w.troop ? this.director.troop(w.troop.id) : this.director.soldier(w.soldier);
        const pose = (w.troop ? TROOP_POSE[sh.state as keyof typeof TROOP_POSE] : SOLDIER_POSE[sh.state as keyof typeof SOLDIER_POSE]) as HumanPose | null;
        if (!pose) {
          fig.group.visible = false;
          continue;
        }
        fig.group.visible = true;
        fig.group.position.set(w.x, w.z, w.y);
        fig.group.rotation.set(0, w.yaw, 0);
        const phase = (w.troop ? w.troop.id : w.soldier) * 0.37;
        fig.setPose(pose, this.time + phase, this.time);
        log.push({ key: w.key, state: sh.state, pose: fig.pose, r3: true });
        shown++;
      }
      for (const w of overflow) toCrowd(w);
    } else {
      // Premier temps : figures de R1 pour les soldats (les fantassins restent instanciés).
      const soldiersWanted = chosen.filter((w) => !w.troop);
      while (this.detail.length < soldiersWanted.length) {
        const fig = buildSoldier(this.seed + this.detail.length * 7, this.mats);
        fig.group.traverse((o) => {
          o.castShadow = true;
        });
        this.scene.add(fig.group);
        this.detail.push(fig);
      }
      for (let k = 0; k < this.detail.length; k++) {
        const fig = this.detail[k] as Soldier;
        const w = soldiersWanted[k];
        if (!w) {
          fig.group.visible = false;
          continue;
        }
        const s = st.soldiers[w.soldier] as SoldierUnit;
        fig.group.visible = true;
        fig.group.position.set(w.x, w.z, w.y);
        fig.group.rotation.set(0, w.yaw, 0);
        const pose: SoldierPose = s.mode === "sol" ? "sol" : s.mode === "crochet" ? "accroche" : "vol";
        fig.setPose(pose, this.time + w.soldier * 0.37);
        log.push({ key: w.key, state: this.director.soldier(w.soldier).state, pose, r3: false });
        shown++;
      }
      for (const w of [...chosen.filter((x) => x.troop), ...overflow]) toCrowd(w);
    }
    for (const [mesh, n] of [[L.troops, troopN], [L.troopsA, troopAN]] as const) {
      if (!mesh) continue;
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (L.flashes) {
      L.flashes.count = flashN;
      L.flashes.instanceMatrix.needsUpdate = true;
    }
    // Titans : figure à la hauteur de la simulation (R1 au « prêt », puis corps de base de R3) ; pose selon l'état montré.
    for (const t of st.titans) {
      const sh = this.director.titan(t.id);
      const human = r3 ? this.humanTitanOf(t, budget) : null;
      const ti: Titan = human ?? this.titanOf(t);
      ti.group.position.set(t.x, 0, t.y);
      ti.group.rotation.set(0, yawOf(t.heading), 0);
      const pose = TITAN_POSE[sh.state] as TitanPose;
      ti.setPose(pose, sh.state === "chute" ? sh.since : this.time + t.id, this.time);
      log.push({ key: `T${t.id}`, state: sh.state, pose: ti.pose, r3: human !== null });
      const d = camPos.distanceTo(tmpP.set(t.x, t.height / 2, t.y));
      if (t.alive && d > lod.markerM * 0.9) {
        setInst(L.markers, markerN, t.x, t.height + 2, t.y, 0, Math.min(5, d / 120));
        L.markers.setColorAt(markerN++, SIDE_COLORS.titan);
      }
      if (realistic && !t.alive) setInst(L.blood, bloodN++, t.x, 0.02, t.y, 0, t.height * 0.18);
    }
    this.shownLog = log;
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
    for (const [mesh, n] of [[L.crowd, crowdN], [L.markers, markerN], [L.blood, bloodN], [L.rings, ringN]] as const) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    L.blood.visible = realistic;
    this.counts = { detail: shown, crowd: crowdN + troopN + troopAN, markers: markerN };
  }

  render(): void {
    if (this.mode === "strategique") this.placeCamera(false);
    this.renderer.render(this.scene, this.cam);
  }

  stats(): { calls: number; triangles: number; detail: number; crowd: number; markers: number; corps: string; corpsDone: boolean } {
    const r = this.renderer.info.render;
    // Second temps (R3) : repères simplifiés, chargement du corps de base, puis Titans et figures en tenue construits.
    const nT = this.layers ? this.titans.size + this.humanTitans.size : 0;
    const corps = this.kitState === "corps" ? `corps de base · Titans ${this.humanTitans.size}/${nT} · figures ${this.figs.size}` : this.kitState === "repli" ? "figures de R1 (repli)" : this.kitState === "chargement" ? "chargement du corps de base" : "repères";
    return { calls: r.calls, triangles: r.triangles, ...this.counts, corps, corpsDone: this.kitState === "corps" && this.humanTitans.size === nT };
  }

  destroy(): void {
    this.ro.disconnect();
    this.world?.dispose();
    for (const t of this.titans.values()) t.dispose();
    this.scene.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      const mat = m.material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
      for (const x of mat ? (Array.isArray(mat) ? mat : [mat]) : []) x.dispose();
    });
    this.skin?.dispose();
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
