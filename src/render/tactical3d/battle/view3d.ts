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
import type { Object3D } from "three";
import type { BattleView, CameraMode, PickHit, ViewOptions, ViewOverlay } from "../../battleView";
import type { TacticalWorldMap } from "../../../sim/tactical/map";
import type { BattleState, SoldierUnit, TitanUnit } from "../../../sim/tactical/types";
import { QUALITY, effectivePixelRatio } from "../quality";
import { buildSoldier, crowdGeometry, soldierMaterials } from "../soldier";
import type { Soldier, SoldierMaterials, SoldierPose } from "../soldier";
import { TITAN_LARGE, TITAN_SMALL, buildTitan } from "../titan";
import type { Titan, TitanPose } from "../titan";
import { photoUrl } from "../photoTextures";
import { buildBattleWorld } from "./world";
import type { BattleWorld } from "./world";
import { LOD, SIDE_COLORS, cannonGeometry, markerGeometry, tierOf, troopGeometry } from "./units";

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

function setInst(mesh: InstancedMesh, i: number, x: number, y: number, z: number, rotY: number, scale = 1, lying = false): void {
  tmpQ.setFromAxisAngle(UP, rotY);
  if (lying) tmpQ.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2));
  tmpM.compose(tmpP.set(x, y + (lying ? 0.18 : 0), z), tmpQ, tmpS.set(scale, scale, scale));
  mesh.setMatrixAt(i, tmpM);
}

/** Orientation d'une figure (modèle tourné vers +Z) pour un cap de la carte (rad, x vers l'est, y vers le sud). */
const yawOf = (heading: number): number => Math.PI / 2 - heading;

interface UnitLayers {
  crowd: InstancedMesh;
  troops: InstancedMesh | null;
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
  private readonly eye = new Vector3();
  private readonly look = new Vector3();
  private counts = { detail: 0, crowd: 0, markers: 0 };
  private readonly ro: ResizeObserver;
  private readonly raycaster = new Raycaster();
  private readonly groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  private time = 0;
  private snapNext = false;

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
    this.hemi = new HemisphereLight(night ? 0x46557a : 0xdfe8f0, night ? 0x1c1a14 : 0x5b5340, night ? 0.45 : 1.1);
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
    const crowd = new InstancedMesh(crowdGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), nS);
    crowd.name = "foule";
    crowd.castShadow = true;
    const troops = nT > 0 ? new InstancedMesh(troopGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), nT) : null;
    if (troops) {
      troops.name = "fantassins";
      troops.castShadow = true;
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
    const list: Object3D[] = [crowd, markers, blood, rings, craters, cables, ...smoke, ...goals];
    if (troops) list.push(troops);
    if (flashes) list.push(flashes);
    if (cannons) list.push(cannons);
    for (const o of list) o.frustumCulled = false;
    this.scene.add(...list);
    this.layers = { crowd, troops, markers, blood, rings, flashes, cannons, craters, cables, smoke, goals };
    return this.layers;
  }

  private titanOf(t: TitanUnit): Titan {
    let ti = this.titans.get(t.id);
    if (!ti) {
      const base = t.height < 8 ? TITAN_SMALL : TITAN_LARGE;
      ti = buildTitan({ ...base, height: t.height, salt: base.salt + t.silhouette }, this.seed * 31 + t.id, null, false);
      ti.group.traverse((o) => {
        o.castShadow = true;
      });
      this.scene.add(ti.group);
      this.titans.set(t.id, ti);
    }
    return ti;
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
      const back = Math.max(14, g.height * 1.8);
      const up = Math.max(7, g.height * 0.95);
      const dx = Math.cos(g.heading);
      const dz = Math.sin(g.heading);
      const wantEye = new Vector3(g.x - dx * back, up + g.z, g.y - dz * back);
      const wantLook = new Vector3(g.x + dx * back * 0.6, Math.max(1.5, g.z + g.height * 0.45), g.y + dz * back * 0.6);
      if (snap) {
        this.eye.copy(wantEye);
        this.look.copy(wantLook);
      } else {
        this.eye.lerp(wantEye, 0.12);
        this.look.lerp(wantLook, 0.18);
      }
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

  setCamera(mode: CameraMode): void {
    if (mode === "strategique" && this.mode === "suivi") {
      // Retour à la vue stratégique au-dessus de ce qu'on suivait.
      this.target.set(this.look.x, 0, this.look.z);
      this.dist = Math.min(this.dist, 220);
    }
    this.mode = mode;
    this.snapNext = true;
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
    let crowdN = 0;
    let markerN = 0;
    let bloodN = 0;
    let ringN = 0;
    const want: { i: number; d: number }[] = [];
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
    // Soldats : figures complètes pour les plus proches (plafond par qualité), foule instanciée, repères au loin.
    st.soldiers.forEach((s, i) => {
      const p = posOf(s, i);
      if (s.mode === "fui") return;
      if (s.mode === "mort") {
        setInst(L.crowd, crowdN, p.x, 0, p.y, yawOf(this.headings.get(i) ?? 0), 1, true);
        L.crowd.setColorAt(crowdN++, SIDE_COLORS.mort);
        if (realistic) setInst(L.blood, bloodN++, p.x + 0.3, 0.02, p.y, 0, 0.9);
        return;
      }
      if (s.mode === "saisi" && s.grabbedBy !== null) {
        const t = st.titans[s.grabbedBy];
        if (t) {
          p.x = t.x + Math.cos(t.heading) * t.height * 0.12;
          p.y = t.y + Math.sin(t.heading) * t.height * 0.12;
          p.z = t.height * 0.62;
        }
      }
      const d = camPos.distanceTo(tmpP.set(p.x, p.z, p.y));
      const tier = tierOf(d, this.opts.quality);
      if (tier === "detail") want.push({ i, d });
      else if (tier === "foule") {
        setInst(L.crowd, crowdN, p.x, p.z, p.y, yawOf(headingOf(i, s.vx, s.vy)));
        L.crowd.setColorAt(crowdN++, s.wound === "grave" && realistic ? new Color(0xc79a8c) : new Color(1, 1, 1));
      } else {
        setInst(L.markers, markerN, p.x, p.z, p.y, 0, Math.min(3, d / 160));
        L.markers.setColorAt(markerN++, SIDE_COLORS.soldat);
      }
      if (overlay.soldiers.has(i)) setInst(L.rings, ringN++, p.x, Math.max(0.05, p.z - 0) + 0.05, p.y, 0, 1);
      if (realistic && s.wound === "grave") setInst(L.blood, bloodN++, p.x, 0.02, p.y, 0, 0.35);
    });
    want.sort((a, b) => a.d - b.d);
    const nDetail = Math.min(lod.detailMax, want.length);
    while (this.detail.length < nDetail) {
      const fig = buildSoldier(this.seed + this.detail.length * 7, this.mats);
      fig.group.traverse((o) => {
        o.castShadow = true;
      });
      this.scene.add(fig.group);
      this.detail.push(fig);
    }
    for (let k = 0; k < this.detail.length; k++) {
      const fig = this.detail[k] as Soldier;
      const w = want[k];
      if (!w || k >= nDetail) {
        fig.group.visible = false;
        continue;
      }
      const s = st.soldiers[w.i] as SoldierUnit;
      const p = posOf(s, w.i);
      if (s.mode === "saisi" && s.grabbedBy !== null) {
        const t = st.titans[s.grabbedBy];
        if (t) {
          p.x = t.x + Math.cos(t.heading) * t.height * 0.12;
          p.y = t.y + Math.sin(t.heading) * t.height * 0.12;
          p.z = t.height * 0.62;
        }
      }
      fig.group.visible = true;
      fig.group.position.set(p.x, p.z, p.y);
      fig.group.rotation.set(0, yawOf(headingOf(w.i, s.vx, s.vy)), 0);
      const pose: SoldierPose = s.mode === "sol" ? "sol" : s.mode === "crochet" ? "accroche" : "vol";
      fig.setPose(pose, this.time + w.i * 0.37);
    }
    // Les unités sans figure complète au-delà du plafond passent dans la foule.
    for (let k = nDetail; k < want.length; k++) {
      const w = want[k] as { i: number; d: number };
      const s = st.soldiers[w.i] as SoldierUnit;
      const p = posOf(s, w.i);
      setInst(L.crowd, crowdN, p.x, p.z, p.y, yawOf(headingOf(w.i, s.vx, s.vy)));
      L.crowd.setColorAt(crowdN++, new Color(1, 1, 1));
    }
    // Fantassins : foule instanciée teintée par camp, repères au loin, lueur des tirs.
    let troopN = 0;
    let flashN = 0;
    if (L.troops && st.troops) {
      for (const t of st.troops) {
        if (t.mode === "fui") continue;
        const color = t.side === "allie" ? SIDE_COLORS.allie : SIDE_COLORS.ennemi;
        if (t.mode === "mort") {
          setInst(L.troops, troopN, t.x, 0, t.y, yawOf(t.heading), 1, true);
          L.troops.setColorAt(troopN++, color.clone().multiplyScalar(0.55));
          if (realistic) setInst(L.blood, bloodN++, t.x + 0.3, 0.02, t.y, 0, 0.85);
          continue;
        }
        const d = camPos.distanceTo(tmpP.set(t.x, 0, t.y));
        if (d > lod.markerM) {
          setInst(L.markers, markerN, t.x, 0, t.y, 0, Math.min(3, d / 160));
          L.markers.setColorAt(markerN++, color);
        } else {
          setInst(L.troops, troopN, t.x, 0, t.y, yawOf(t.heading));
          L.troops.setColorAt(troopN++, t.wounded && realistic ? color.clone().lerp(new Color(0x8a2a22), 0.3) : color);
        }
        if (L.flashes && t.shot >= 0 && st.tick - t.shot <= 1) setInst(L.flashes, flashN++, t.x + Math.cos(t.heading) * 0.9, 1.45, t.y + Math.sin(t.heading) * 0.9, 0, 1);
        if (overlay.troops.has(t.id)) setInst(L.rings, ringN++, t.x, 0.05, t.y, 0, 1);
      }
      L.troops.count = troopN;
      L.troops.instanceMatrix.needsUpdate = true;
      if (L.troops.instanceColor) L.troops.instanceColor.needsUpdate = true;
    }
    if (L.flashes) {
      L.flashes.count = flashN;
      L.flashes.instanceMatrix.needsUpdate = true;
    }
    // Titans : figure procédurale à la hauteur de la simulation ; pose selon l'état ; vapeur des corps abattus.
    for (const t of st.titans) {
      const ti = this.titanOf(t);
      const pr = this.titanPrev.get(t.id);
      const moving = !!pr && Math.hypot(pr.x - t.x, pr.y - t.y) > 0.01;
      this.titanPrev.set(t.id, { x: t.x, y: t.y });
      ti.group.position.set(t.x, 0, t.y);
      ti.group.rotation.set(0, yawOf(t.heading), 0);
      const pose: TitanPose = !t.alive ? "abattu" : t.grabbing !== null ? "saisie" : moving ? "marche" : "debout";
      ti.setPose(pose, this.time + t.id);
      const d = camPos.distanceTo(tmpP.set(t.x, t.height / 2, t.y));
      if (t.alive && d > lod.markerM * 0.9) {
        setInst(L.markers, markerN, t.x, t.height + 2, t.y, 0, Math.min(5, d / 120));
        L.markers.setColorAt(markerN++, SIDE_COLORS.titan);
      }
      if (realistic && !t.alive) setInst(L.blood, bloodN++, t.x, 0.02, t.y, 0, t.height * 0.18);
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
    for (const [mesh, n] of [[L.crowd, crowdN], [L.markers, markerN], [L.blood, bloodN], [L.rings, ringN]] as const) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    L.blood.visible = realistic;
    this.counts = { detail: nDetail, crowd: crowdN + troopN, markers: markerN };
  }

  render(): void {
    if (this.mode === "strategique") this.placeCamera(false);
    this.renderer.render(this.scene, this.cam);
  }

  stats(): { calls: number; triangles: number; detail: number; crowd: number; markers: number } {
    const r = this.renderer.info.render;
    return { calls: r.calls, triangles: r.triangles, ...this.counts };
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
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}

/** Entrée chargée à la demande par l'écran de bataille (import dynamique : three.js n'entre jamais dans le bundle principal). */
export function createView3d(host: HTMLElement, opts: ViewOptions, seed: number, night: boolean): BattleView {
  return new View3D(host, opts, seed, night);
}
