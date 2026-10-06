import { BackSide, BufferAttribute, BufferGeometry, Color, DirectionalLight, FogExp2, Group, HemisphereLight, Mesh, MeshBasicMaterial, PointLight, Points, PointsMaterial, SphereGeometry, Vector3 } from "three";
import type { MeshStandardMaterial, Scene } from "three";
import { derive, seeded } from "./rng";

/**
 * Éclairage de l'essai 3D (R1.3) : jour, crépuscule, nuit. Soleil ou lune à ombres portées, ciel en dôme, brume
 * exponentielle, fenêtres et réverbères allumés au crépuscule et la nuit. Teintes sourdes (04 §1.2 : pas de néon).
 */
export type LightPreset = "jour" | "crepuscule" | "nuit";
export const LIGHT_PRESETS: readonly LightPreset[] = ["jour", "crepuscule", "nuit"];

interface PresetDef {
  /** Élévation et azimut de l'astre (degrés ; azimut 0 = nord, 90 = est). */
  elevation: number;
  azimuth: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  horizon: number;
  zenith: number;
  /** Halo autour de l'astre, dans le ciel. */
  glow: number;
  glowStrength: number;
  fog: number;
  fogDensity: number;
  exposure: number;
  windows: number;
  lanterns: number;
  lampIntensity: number;
  stars: boolean;
}

const PRESETS: Record<LightPreset, PresetDef> = {
  jour: { elevation: 52, azimuth: 215, sunColor: 0xfff1dc, sunIntensity: 3.1, hemiSky: 0xcfdbe2, hemiGround: 0x6b604f, hemiIntensity: 1.15, horizon: 0xc8d0cf, zenith: 0x7d98ab, glow: 0xfff3dc, glowStrength: 0.25, fog: 0xbfc6c4, fogDensity: 0.0014, exposure: 1.0, windows: 0, lanterns: 0, lampIntensity: 0, stars: false },
  crepuscule: { elevation: 6, azimuth: 255, sunColor: 0xffa060, sunIntensity: 2.6, hemiSky: 0x9a8f9c, hemiGround: 0x3b3029, hemiIntensity: 0.65, horizon: 0xe0a070, zenith: 0x3c4862, glow: 0xffb070, glowStrength: 0.85, fog: 0xa88470, fogDensity: 0.0021, exposure: 1.05, windows: 0.55, lanterns: 1.2, lampIntensity: 18, stars: false },
  nuit: { elevation: 38, azimuth: 140, sunColor: 0x9db2d8, sunIntensity: 0.5, hemiSky: 0x2a3550, hemiGround: 0x101215, hemiIntensity: 0.4, horizon: 0x1d2536, zenith: 0x06090f, glow: 0x8fa3c8, glowStrength: 0.35, fog: 0x121822, fogDensity: 0.0026, exposure: 1.15, windows: 1.5, lanterns: 3, lampIntensity: 60, stars: true },
};

export interface LightRig {
  readonly sun: DirectionalLight;
  readonly preset: LightPreset;
  /** Exposition du rendu pour l'heure choisie (le moteur la lit à chaque image). */
  readonly exposure: number;
  /** Nombre de réverbères qui éclairent vraiment (qualité). */
  setLampLimit(n: number): void;
  apply(preset: LightPreset): void;
  /** Le dôme du ciel suit la caméra. */
  follow(camera: Vector3): void;
  /** Taille de la carte d'ombre (qualité). */
  setShadow(enabled: boolean, size: number): void;
  dispose(): void;
}

export function createLighting(scene: Scene, seed: number, opts: { windowMaterials: MeshStandardMaterial[]; lanternMaterial: MeshStandardMaterial; lamps: Vector3[]; center: Vector3 }): LightRig {
  const group = new Group();
  group.name = "eclairage";
  scene.add(group);
  const hemi = new HemisphereLight(0xffffff, 0x444444, 1);
  group.add(hemi);
  const sun = new DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, near: 10, far: 900 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.5;
  sun.target.position.copy(opts.center);
  group.add(sun, sun.target);

  // Dôme du ciel, coloré par sommet : horizon → zénith, halo autour de l'astre.
  const skyGeo = new SphereGeometry(1800, 48, 24);
  skyGeo.setAttribute("color", new BufferAttribute(new Float32Array(skyGeo.getAttribute("position").count * 3), 3));
  const sky = new Mesh(skyGeo, new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false }));
  sky.name = "ciel";
  sky.renderOrder = -1;
  group.add(sky);

  // Étoiles, pour la nuit seulement.
  const rand = seeded(derive(seed, 700));
  const starPos: number[] = [];
  for (let i = 0; i < 900; i++) {
    const az = rand() * Math.PI * 2;
    const el = Math.asin(0.08 + rand() * 0.92);
    starPos.push(Math.cos(el) * Math.sin(az) * 1700, Math.sin(el) * 1700, Math.cos(el) * Math.cos(az) * 1700);
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute("position", new BufferAttribute(new Float32Array(starPos), 3));
  const stars = new Points(starGeo, new PointsMaterial({ color: 0xdfe6f0, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
  stars.name = "etoiles";
  group.add(stars);

  const fog = new FogExp2(0xffffff, 0.002);
  scene.fog = fog;

  // Réverbères : les lumières ponctuelles coûtent cher ; seules les 8 lanternes les plus proches de l'action éclairent.
  const near = [...opts.lamps].sort((a, b) => a.distanceToSquared(opts.center) - b.distanceToSquared(opts.center)).slice(0, 8);
  const lamps = near.map((p) => {
    const l = new PointLight(0xffb468, 0, 32, 2);
    l.position.copy(p).add(new Vector3(0, -0.3, 0));
    group.add(l);
    return l;
  });

  let current: LightPreset = "jour";
  let exposure = 1;
  let lampLimit = lamps.length;
  const showLamps = (): void => {
    const d = PRESETS[current];
    lamps.forEach((l, i) => {
      l.intensity = d.lampIntensity;
      // Une lumière éteinte mais visible est quand même calculée par chaque pixel : on la retire du rendu.
      l.visible = d.lampIntensity > 0 && i < lampLimit;
    });
  };
  const tmp = new Vector3();
  const dirOf = (d: PresetDef): Vector3 => {
    const el = (d.elevation * Math.PI) / 180;
    const az = (d.azimuth * Math.PI) / 180;
    // x vers l'est, z vers le sud : azimut 0 = nord = -z.
    return new Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az));
  };

  const rig: LightRig = {
    sun,
    get preset() {
      return current;
    },
    get exposure() {
      return exposure;
    },
    setLampLimit(n) {
      lampLimit = n;
      showLamps();
    },
    apply(preset) {
      current = preset;
      const d = PRESETS[preset];
      const dir = dirOf(d);
      sun.color.set(d.sunColor);
      sun.intensity = d.sunIntensity;
      sun.position.copy(opts.center).addScaledVector(dir, 420);
      hemi.color.set(d.hemiSky);
      hemi.groundColor.set(d.hemiGround);
      hemi.intensity = d.hemiIntensity;
      fog.color.set(d.fog);
      fog.density = d.fogDensity;
      exposure = d.exposure;
      const pos = skyGeo.getAttribute("position");
      const col = skyGeo.getAttribute("color");
      const hz = new Color(d.horizon);
      const ze = new Color(d.zenith);
      const glow = new Color(d.glow);
      const c = new Color();
      for (let i = 0; i < pos.count; i++) {
        tmp.fromBufferAttribute(pos, i).normalize();
        const h = Math.max(0, tmp.y);
        c.copy(hz).lerp(ze, Math.pow(h, 0.55));
        const g = Math.pow(Math.max(0, tmp.dot(dir)), 10) * d.glowStrength;
        c.lerp(glow, Math.min(1, g));
        // Sous l'horizon : la couleur de la brume, pour fondre le sol au loin.
        if (tmp.y < 0) c.copy(hz).lerp(new Color(d.fog), Math.min(1, -tmp.y * 6));
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
      stars.visible = d.stars;
      for (const m of opts.windowMaterials) m.emissiveIntensity = d.windows;
      opts.lanternMaterial.emissiveIntensity = d.lanterns;
      showLamps();
    },
    follow(camera) {
      sky.position.copy(camera);
      stars.position.copy(camera);
    },
    setShadow(enabled, size) {
      sun.castShadow = enabled;
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    },
    dispose() {
      scene.remove(group);
      skyGeo.dispose();
      starGeo.dispose();
      (sky.material as MeshBasicMaterial).dispose();
      (stars.material as PointsMaterial).dispose();
      sun.shadow.map?.dispose();
    },
  };
  rig.apply("jour");
  return rig;
}
