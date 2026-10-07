import { BackSide, BufferAttribute, BufferGeometry, Color, DirectionalLight, FogExp2, Group, HemisphereLight, Mesh, MeshBasicMaterial, PMREMGenerator, PointLight, Points, PointsMaterial, Scene as SceneClass, SphereGeometry, Vector3 } from "three";
import type { MeshStandardMaterial, Scene, ShaderMaterial, Texture, WebGLRenderer } from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { derive, seeded } from "./rng";

/**
 * Éclairage de l'essai 3D (R1.3) : jour, crépuscule, nuit. Soleil ou lune à ombres portées, ciel en dôme, brume
 * exponentielle, fenêtres et réverbères allumés au crépuscule et la nuit. Teintes sourdes (04 §1.2 : pas de néon).
 */
export type LightPreset = "jour" | "aube" | "crepuscule" | "nuit";
export const LIGHT_PRESETS: readonly LightPreset[] = ["jour", "aube", "crepuscule", "nuit"];

export interface PresetDef {
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
  /**
   * R1c : ciel physique (modèle de Preetham, nuages procéduraux) du plein jour : trouble de l'air, diffusion de Rayleigh et de
   * Mie, couverture nuageuse, gain (la luminance du modèle ramenée à l'exposition de la scène). Absent (aube, crépuscule, nuit,
   * sous terre) : dôme peint, dont l'horizon se fond dans la brume ; le modèle, au soleil bas, assombrit l'horizon opposé.
   */
  physical?: { turbidity: number; rayleigh: number; mie: number; mieG: number; clouds: number; gain: number };
  /** R1c : part de l'éclairage d'image (le ciel) ; l'hémisphère est réduite d'autant quand la carte d'environnement est active. */
  envIntensity?: number;
}

/** Part de l'hémisphère gardée quand le ciel éclaire la scène (éclairage d'image). */
const HEMI_WITH_ENV = 0.85;
/** Luminance du ciel physique dans la carte d'environnement, rapportée au ciel montré. */
const ENV_SKY_GAIN = 0.45;
/**
 * Côté de la carte d'environnement (texels par face). Le ciel est lisse et la carte ne sert qu'aux reflets flous et à la
 * lumière diffuse : 64 suffit. À 256 (défaut de three.js), le filtrage de la carte coûtait près de 4 s au chargement sans GPU
 * (R1c.6, latence de la scène tactique).
 */
const ENV_MAP_SIZE = 64;
/**
 * R1d : sol de la carte d'environnement (lumière renvoyée par le sol, teinte `hemiGround` de l'heure), rapporté à cette teinte.
 * Sans lui, la moitié basse de la carte prolongeait le ciel : les façades recevaient une lumière bleue de tous côtés.
 */
const ENV_GROUND_GAIN = 0.6;
/**
 * R1d : saturation du ciel physique dans la carte d'environnement. À pleine saturation, la lumière diffuse du ciel bleuissait
 * et blanchissait façades, sols et ombres (revue de R1c, D-88) ; mesuré : b* moyen de la scène tactique 6,1 contre 12,2 en R1b.
 */
const ENV_SKY_SATURATION = 0.35;

export const PRESETS: Record<LightPreset, PresetDef> = {
  jour: { elevation: 52, azimuth: 215, sunColor: 0xfff1dc, sunIntensity: 3.1, hemiSky: 0xcfdbe2, hemiGround: 0x6b604f, hemiIntensity: 1.15, horizon: 0xc8d0cf, zenith: 0x7d98ab, glow: 0xfff3dc, glowStrength: 0.25, fog: 0xbfc6c4, fogDensity: 0.0014, exposure: 1.1, windows: 0, lanterns: 0, lampIntensity: 0, stars: false, physical: { turbidity: 3, rayleigh: 1.1, mie: 0.004, mieG: 0.8, clouds: 0.38, gain: 0.5 }, envIntensity: 0.18 },
  // Aube (R1b.6) : soleil bas à l'est, lumière rosée et froide, brume plus dense que le jour.
  aube: { elevation: 9, azimuth: 95, sunColor: 0xffc4a0, sunIntensity: 2.4, hemiSky: 0xb2b8cc, hemiGround: 0x4a443e, hemiIntensity: 1.2, horizon: 0xeab4a2, zenith: 0x56668e, glow: 0xffd2ac, glowStrength: 0.75, fog: 0xb4a8b2, fogDensity: 0.0024, exposure: 1.2, windows: 0.25, lanterns: 0.6, lampIntensity: 10, stars: false, envIntensity: 0.3 },
  crepuscule: { elevation: 6, azimuth: 255, sunColor: 0xffa060, sunIntensity: 2.9, hemiSky: 0xa898a4, hemiGround: 0x4a3d33, hemiIntensity: 1.35, horizon: 0xe0a070, zenith: 0x3c4862, glow: 0xffb070, glowStrength: 0.85, fog: 0xa88470, fogDensity: 0.0021, exposure: 1.2, windows: 0.55, lanterns: 1.2, lampIntensity: 18, stars: false, envIntensity: 0.3 },
  nuit: { elevation: 38, azimuth: 140, sunColor: 0x9db2d8, sunIntensity: 0.5, hemiSky: 0x2a3550, hemiGround: 0x101215, hemiIntensity: 0.4, horizon: 0x1d2536, zenith: 0x06090f, glow: 0x8fa3c8, glowStrength: 0.35, fog: 0x121822, fogDensity: 0.0026, exposure: 1.15, windows: 1.5, lanterns: 3, lampIntensity: 60, stars: true, envIntensity: 0.3 },
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
  /** R1b : déplace le centre éclairé (cible du soleil, zone d'ombres) vers la vue courante. */
  setCenter(c: Vector3): void;
  /** R1b : brume supplémentaire (météo), multiplicateur de densité. */
  setFogBoost(k: number): void;
  /** R1b : soleil voilé (météo), multiplicateur d'intensité. */
  setSunFactor(k: number): void;
  /**
   * R1c : éclairage d'image. Le dôme du ciel de l'heure courante devient la carte d'environnement de la scène (reflets des
   * métaux, de l'eau, lumière diffuse du ciel) ; une carte par heure, calculée une fois. Rien sous terre.
   */
  useEnvironment(renderer: WebGLRenderer): void;
  /**
   * R1d : qualité basse allégée. Sans éclairage d'image (l'hémisphère reprend toute sa part) et avec le dôme peint au lieu du
   * ciel physique (moins de calcul par pixel, pas de carte d'environnement à filtrer).
   */
  setLite(lite: boolean): void;
  readonly lite: boolean;
  dispose(): void;
}

/**
 * R1b (lot 2) : lieu souterrain. Le jour n'entre que par les puits (soleil presque vertical, ombres de la voûte) ; lumière
 * d'ambiance et brume de la teinte du lieu, lanternes et fenêtres toujours allumées.
 */
export interface UndergroundLight {
  /** Teintes (« #RRGGBB », du profil ou de `materiaux.json`) : ambiance, sol, brume. */
  ambient: string;
  ground: string;
  fog: string;
  /** Puits de jour ouverts dans la voûte. */
  openings: boolean;
}

/**
 * R1e (§6, point 1) : ciel de fumée (ville-usine). À `smoke` = 1 : ciel peint gris-brun (plus de ciel physique bleu), voile de
 * brume dense et brun, soleil plus faible et plus rouge, ambiance plus sombre.
 */
const SMOKE = { sun: 0xd2845a, sky: 0x8a7b70, ground: 0x3a3028, horizon: 0x9c8b7d, zenith: 0x5f5751, glow: 0xd09868, fog: 0x86786c };

export function smoky(d: PresetDef, s: number): PresetDef {
  if (s <= 0) return d;
  const mix = (a: number, b: number, k: number): number => new Color(a).lerp(new Color(b), Math.min(1, k)).getHex();
  return {
    ...d,
    sunColor: mix(d.sunColor, SMOKE.sun, 0.6 * s),
    sunIntensity: d.sunIntensity * (1 - 0.5 * s),
    hemiSky: mix(d.hemiSky, SMOKE.sky, 0.75 * s),
    hemiGround: mix(d.hemiGround, SMOKE.ground, 0.5 * s),
    hemiIntensity: d.hemiIntensity * (1 - 0.18 * s),
    horizon: mix(d.horizon, SMOKE.horizon, s),
    zenith: mix(d.zenith, SMOKE.zenith, 0.9 * s),
    glow: mix(d.glow, SMOKE.glow, s),
    glowStrength: d.glowStrength * (1 - 0.4 * s),
    fog: mix(d.fog, SMOKE.fog, 0.9 * s),
    fogDensity: d.fogDensity * (1 + 2.6 * s),
    exposure: d.exposure * (1 - 0.06 * s),
    physical: s > 0.3 ? undefined : d.physical,
  };
}

export function createLighting(scene: Scene, seed: number, opts: { windowMaterials: MeshStandardMaterial[]; lanternMaterial: MeshStandardMaterial; lamps: Vector3[]; center: Vector3; shadowExtent?: number; fogScale?: number; underground?: UndergroundLight | null; smoke?: number; fill?: number; exposureScale?: number }): LightRig {
  const group = new Group();
  group.name = "eclairage";
  scene.add(group);
  const hemi = new HemisphereLight(0xffffff, 0x444444, 1);
  group.add(hemi);
  const sun = new DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const ext = opts.shadowExtent ?? 230;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: Math.max(900, ext * 4) });
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
  // R1c : ciel physique (three.js, `Sky` : diffusion atmosphérique et nuages calculés, aucune image), gain ajouté au shader.
  const phys = new Sky();
  phys.name = "ciel-physique";
  phys.scale.setScalar(6000);
  phys.renderOrder = -1;
  const physMat = phys.material as ShaderMaterial;
  physMat.uniforms["skyGain"] = { value: 0.5 };
  // R1d : saturation du ciel (1 à l'écran ; réduite pour la carte d'environnement, voir ENV_SKY_SATURATION).
  physMat.uniforms["skySat"] = { value: 1 };
  physMat.fragmentShader = physMat.fragmentShader
    .replace("uniform float time;", "uniform float time;\n\t\tuniform float skyGain;\n\t\tuniform float skySat;")
    .replace("gl_FragColor = vec4( texColor, 1.0 );", "vec3 skyC = texColor * skyGain;\n\t\t\tgl_FragColor = vec4( mix( vec3( dot( skyC, vec3( 0.2126, 0.7152, 0.0722 ) ) ), skyC, skySat ), 1.0 );");
  group.add(phys);
  const envSky = new Sky();
  envSky.material.dispose();
  envSky.material = physMat;
  envSky.scale.setScalar(1000);
  // R1d : demi-sphère basse de la carte d'environnement (le sol), de la teinte du sol de l'heure.
  const envGroundMat = new MeshBasicMaterial({ color: 0x000000, side: BackSide, fog: false });
  const envGround = new Mesh(new SphereGeometry(400, 32, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), envGroundMat);

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
  let envOn = false;
  let pmrem: PMREMGenerator | null = null;
  let pmremOwner: WebGLRenderer | null = null;
  const envMaps = new Map<LightPreset, Texture>();
  let lite = false;
  const updateEnv = (): void => {
    if (lite) {
      scene.environment = null;
      envOn = false;
      hemi.intensity = hemiFor(effective(current));
      return;
    }
    if (!pmrem || opts.underground) return;
    let tex = envMaps.get(current);
    if (!tex) {
      // La carte d'environnement vient du ciel montré : physique le jour, dôme peint la nuit.
      // Le ciel physique éclaire avec une luminance réduite : son horizon blanc, reflété en incidence rasante par tous les
      // matériaux, délavait le sol.
      const skyScene = new SceneClass();
      skyScene.add(phys.visible ? envSky : new Mesh(skyGeo, sky.material));
      envGroundMat.color.set(effective(current).hemiGround).multiplyScalar(ENV_GROUND_GAIN);
      skyScene.add(envGround);
      const gain = physMat.uniforms["skyGain"];
      const sat = physMat.uniforms["skySat"];
      const shown = gain?.value as number;
      if (gain && phys.visible) gain.value = shown * ENV_SKY_GAIN;
      if (sat) sat.value = ENV_SKY_SATURATION;
      tex = pmrem.fromScene(skyScene, 0, 0.5, 4000, { size: ENV_MAP_SIZE }).texture;
      if (gain) gain.value = shown;
      if (sat) sat.value = 1;
      envMaps.set(current, tex);
    }
    scene.environment = tex;
    envOn = true;
    scene.environmentIntensity = effective(current).envIntensity ?? 0.45;
    hemi.intensity = hemiFor(effective(current));
  };
  /**
   * Avec l'éclairage d'image du ciel physique, le ciel éclaire déjà les ombres : l'hémisphère est réduite. Le dôme peint (aube,
   * crépuscule, nuit) éclaire peu : l'hémisphère garde son intensité de R1b.
   */
  // R1e (§6, point 6) : `fill` éclaire les ombres sous une voûte épaisse (forêt des Arbres Géants), sans toucher au soleil.
  const hemiFor = (d: PresetDef): number => d.hemiIntensity * (opts.fill ?? 1) * (0.75 + 0.25 * sunK) * (envOn && d.physical && !opts.underground ? HEMI_WITH_ENV : 1);
  /** Multiplicateur de brume et voile du soleil posés par la météo (R1b.7). */
  let extraFog = 1;
  let sunK = 1;
  let exposure = 1;
  let lampLimit = lamps.length;
  /**
   * Réglages effectifs d'une heure : sous terre (R1b, lot 2), le soleil n'entre que par les puits, presque vertical ; l'ambiance
   * prend la teinte du lieu et porte presque tout l'éclairage (sans soleil, l'hémisphère seule doit être bien plus forte) ;
   * lanternes et fenêtres restent allumées.
   */
  const effective = (preset: LightPreset): PresetDef => {
    const d0 = smoky(PRESETS[preset], opts.smoke ?? 0);
    const ug = opts.underground ?? null;
    if (!ug) return d0;
    const day = preset === "jour" ? 1 : preset === "nuit" ? 0 : 0.45;
    return {
      ...d0,
      elevation: 80,
      sunIntensity: ug.openings ? d0.sunIntensity * 0.8 * day : 0,
      hemiSky: new Color(ug.ambient).getHex(),
      hemiGround: new Color(ug.ground).getHex(),
      hemiIntensity: 3.4 + 1.2 * day,
      fog: new Color(ug.fog).getHex(),
      fogDensity: 0.0026,
      exposure: d0.exposure + 0.2,
      windows: Math.max(d0.windows, 0.8),
      lanterns: Math.max(d0.lanterns, 2.2),
      lampIntensity: Math.max(d0.lampIntensity, 40),
      stars: false,
    };
  };
  const showLamps = (): void => {
    const d = effective(current);
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
      const d = effective(preset);
      const dir = dirOf(d);
      sun.color.set(d.sunColor);
      sun.intensity = d.sunIntensity * sunK;
      sun.position.copy(opts.center).addScaledVector(dir, Math.max(420, ext * 1.6));
      hemi.color.set(d.hemiSky);
      hemi.groundColor.set(d.hemiGround);
      hemi.intensity = hemiFor(d);
      fog.color.set(d.fog);
      fog.density = d.fogDensity * (opts.fogScale ?? 1) * extraFog;
      exposure = d.exposure * (opts.exposureScale ?? 1);
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
      const ph = opts.underground || lite ? undefined : d.physical;
      phys.visible = ph !== undefined;
      sky.visible = !phys.visible;
      if (ph) {
        const u = physMat.uniforms;
        (u["sunPosition"]?.value as Vector3).copy(dir);
        Object.assign(u["turbidity"] ?? {}, { value: ph.turbidity * (0.7 + 0.3 * extraFog) });
        Object.assign(u["rayleigh"] ?? {}, { value: ph.rayleigh });
        Object.assign(u["mieCoefficient"] ?? {}, { value: ph.mie });
        Object.assign(u["mieDirectionalG"] ?? {}, { value: ph.mieG });
        // Météo : ciel plus couvert quand la brume monte ou que le soleil est voilé.
        Object.assign(u["cloudCoverage"] ?? {}, { value: Math.min(0.95, ph.clouds + 0.25 * (extraFog - 1) + 0.4 * (1 - sunK)) });
        Object.assign(u["skyGain"] ?? {}, { value: ph.gain });
        Object.assign(u["showSunDisc"] ?? {}, { value: 1 });
      }
      stars.visible = d.stars;
      for (const m of opts.windowMaterials) m.emissiveIntensity = d.windows;
      opts.lanternMaterial.emissiveIntensity = d.lanterns;
      showLamps();
      updateEnv();
    },
    follow(camera) {
      sky.position.copy(camera);
      phys.position.copy(camera);
      stars.position.copy(camera);
    },
    get lite() {
      return lite;
    },
    setLite(on) {
      if (on === lite) return;
      lite = on;
      rig.apply(current);
    },
    setCenter(c) {
      opts.center.copy(c);
      sun.target.position.copy(c);
      rig.apply(current);
    },
    setFogBoost(k) {
      extraFog = k;
      rig.apply(current);
    },
    setSunFactor(k) {
      sunK = k;
      rig.apply(current);
    },
    useEnvironment(renderer) {
      // Un nouveau moteur (qualité changée) : les cartes de l'ancien contexte ne valent plus rien.
      if (pmremOwner !== renderer) {
        for (const t of envMaps.values()) t.dispose();
        envMaps.clear();
        pmrem?.dispose();
        pmrem = new PMREMGenerator(renderer);
        pmremOwner = renderer;
      }
      updateEnv();
    },
    setShadow(enabled, size) {
      sun.castShadow = enabled;
      // R1c : pénombre (échantillons PCF répartis sur un disque de quelques texels), plus large pour une carte fine.
      sun.shadow.radius = size >= 2048 ? 4 : 3;
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
      phys.geometry.dispose();
      envSky.geometry.dispose();
      envGround.geometry.dispose();
      envGroundMat.dispose();
      physMat.dispose();
      (stars.material as PointsMaterial).dispose();
      sun.shadow.map?.dispose();
      for (const t of envMaps.values()) t.dispose();
      pmrem?.dispose();
      if (envMaps.size > 0) scene.environment = null;
    },
  };
  rig.apply("jour");
  return rig;
}
