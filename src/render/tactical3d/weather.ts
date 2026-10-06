import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ConeGeometry, DoubleSide, Group, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, PointLight, Points, PointsMaterial, Quaternion, Vector3 } from "three";
import type { Material, MeshStandardMaterial, Object3D, Texture } from "three";
import type { Fire } from "./envTypes";
import { phys } from "./meshProps";
import { derive, range, seeded } from "./rng";
import { MATERIALS } from "./styles";

/**
 * Météo et incendies de R1b (R1b.7) :
 * - brume : brouillard épaissi, nappes basses, soleil voilé ;
 * - pluie : traits qui tombent en biais autour de la caméra, ciel bas ;
 * - neige d'hiver : flocons qui dérivent, et neige posée sur ce qui regarde le ciel (toits, sol, chemin de ronde) par une
 *   retouche des matériaux (mélange vers la teinte « neige » de `materiaux.json` selon la normale) ;
 * - ruines et incendies : flammes vacillantes, fumées, lumières de feu (nombre limité par la qualité).
 * Les particules sont générées d'une graine locale et animées par le temps injecté (pas d'aléa à l'image).
 */
export type WeatherKind = "aucune" | "brume" | "pluie" | "neige";
export const WEATHERS: readonly WeatherKind[] = ["aucune", "brume", "pluie", "neige"];

export interface WeatherRig {
  kind: WeatherKind;
  /** Multiplicateur de brouillard et de lumière du soleil. */
  fogBoost: number;
  sunFactor: number;
  update(t: number, camera: Vector3, cameraMatrixInverse: Matrix4): void;
  dispose(): void;
}

/** Neige posée : retouche des matériaux standard de la scène (normale tournée vers le ciel → teinte neige). */
function snowCover(root: Object3D, amount: number): { update(viewInv: Matrix4): void; dispose(): void } {
  const up = { value: new Vector3(0, 1, 0) };
  const snow = { value: new Color(MATERIALS.sols.neige.base) };
  const k = { value: amount };
  const patched = new Set<MeshStandardMaterial>();
  root.traverse((o) => {
    const m = (o as Mesh).material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
      if (!(mat as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial || patched.has(mat)) continue;
      patched.add(mat);
      mat.onBeforeCompile = (sh) => {
        sh.uniforms["uSnowUp"] = up;
        sh.uniforms["uSnowColor"] = snow;
        sh.uniforms["uSnow"] = k;
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform vec3 uSnowUp;\nuniform vec3 uSnowColor;\nuniform float uSnow;")
          .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nfloat snowK = smoothstep(0.45, 0.85, dot(normal, uSnowUp)) * uSnow;\ndiffuseColor.rgb = mix(diffuseColor.rgb, uSnowColor, snowK);");
      };
      mat.customProgramCacheKey = () => "neige";
      mat.needsUpdate = true;
    }
  });
  return {
    update(viewInv) {
      // La normale du fragment est en repère caméra : le « haut » du monde y est la deuxième colonne de la matrice de vue.
      up.value.set(0, 1, 0).transformDirection(viewInv);
    },
    dispose() {
      for (const mat of patched) {
        mat.onBeforeCompile = () => undefined;
        mat.customProgramCacheKey = () => "";
        mat.needsUpdate = true;
      }
    },
  };
}

export function createWeather(scene: Group | Object3D, kind: WeatherKind, opts: { seed: number; particles: number; mistMap: Texture | null; groundY: number; size: number }): WeatherRig {
  const group = new Group();
  group.name = `meteo-${kind}`;
  scene.add(group);
  const disposables: { dispose(): void }[] = [];
  const rand = seeded(derive(opts.seed, 4000));
  const R = 140;
  const Hh = 90;
  let update: WeatherRig["update"] = () => undefined;
  let fogBoost = 1;
  let sunFactor = 1;
  if (kind === "brume") {
    fogBoost = 3.6;
    sunFactor = 0.45;
    for (let k = 0; k < 5; k++) {
      const g = new PlaneGeometry(opts.size, opts.size, 1, 1);
      g.rotateX(-Math.PI / 2);
      const mat = new MeshBasicMaterial({ color: phys("lumiere"), map: opts.mistMap, transparent: true, opacity: 0.16 - k * 0.022, depthWrite: false, side: DoubleSide });
      const m = new Mesh(g, mat);
      m.position.y = opts.groundY + 2 + k * 5;
      m.rotation.y = k * 0.9;
      m.renderOrder = 3;
      group.add(m);
      disposables.push(g, mat);
    }
  } else if (kind === "pluie") {
    fogBoost = 1.9;
    sunFactor = 0.3;
    const n = opts.particles;
    const base = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      base[i * 3] = range(rand, -R, R);
      base[i * 3 + 1] = rand() * Hh;
      base[i * 3 + 2] = range(rand, -R, R);
    }
    const pos = new Float32Array(n * 6);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    const mat = new LineBasicMaterial({ color: phys("fumee").multiplyScalar(1.5), transparent: true, opacity: 0.38, depthWrite: false });
    const lines = new LineSegments(g, mat);
    lines.frustumCulled = false;
    lines.name = "pluie";
    group.add(lines);
    disposables.push(g, mat);
    update = (t, cam) => {
      for (let i = 0; i < n; i++) {
        const y = ((base[i * 3 + 1] as number) - t * 11) % Hh;
        const yy = y < 0 ? y + Hh : y;
        const x = cam.x + (base[i * 3] as number) + yy * 0.12;
        const z = cam.z + (base[i * 3 + 2] as number);
        const y0 = cam.y - Hh * 0.4 + yy;
        pos.set([x, y0, z, x - 0.12, y0 - 1.1, z], i * 6);
      }
      (g.getAttribute("position") as BufferAttribute).needsUpdate = true;
    };
  } else if (kind === "neige") {
    fogBoost = 2.2;
    sunFactor = 0.55;
    const n = opts.particles;
    const base = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) base.set([range(rand, -R, R), rand() * Hh, range(rand, -R, R), rand() * 6.28], i * 4);
    const pos = new Float32Array(n * 3);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    const mat = new PointsMaterial({ color: new Color(MATERIALS.sols.neige.base), size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false });
    const pts = new Points(g, mat);
    pts.frustumCulled = false;
    pts.name = "neige";
    group.add(pts);
    disposables.push(g, mat);
    const cover = snowCover(scene, 0.85);
    disposables.push(cover);
    update = (t, cam, viewInv) => {
      cover.update(viewInv);
      for (let i = 0; i < n; i++) {
        const ph = base[i * 4 + 3] as number;
        const y = ((base[i * 4 + 1] as number) - t * 1.3) % Hh;
        const yy = y < 0 ? y + Hh : y;
        pos.set([cam.x + (base[i * 4] as number) + Math.sin(t * 0.7 + ph) * 1.5, cam.y - Hh * 0.4 + yy, cam.z + (base[i * 4 + 2] as number) + Math.cos(t * 0.5 + ph) * 1.2], i * 3);
      }
      (g.getAttribute("position") as BufferAttribute).needsUpdate = true;
    };
  }
  return {
    kind,
    fogBoost,
    sunFactor,
    update,
    dispose() {
      scene.remove(group);
      for (const d of disposables) d.dispose();
    },
  };
}

/** Feux : flammes vacillantes (cônes additifs), colonnes de fumée, lumières de feu (les `lights` plus grands). */
export function createFires(scene: Object3D, fires: readonly Fire[], opts: { lights: number; puff: Texture | null; seed: number }): { update(t: number): void; dispose(): void; lights: PointLight[]; count: number } {
  const group = new Group();
  group.name = "incendies";
  scene.add(group);
  if (fires.length === 0) return { update: () => undefined, dispose: () => scene.remove(group), lights: [], count: 0 };
  const flameGeo = new ConeGeometry(1, 2.4, 7, 1, true);
  flameGeo.translate(0, 1.2, 0);
  const flameMat = new MeshBasicMaterial({ color: phys("braise").lerp(phys("flamme"), 0.35), transparent: true, opacity: 0.62, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  const perFire = 4;
  const flames = new InstancedMesh(flameGeo, flameMat, fires.length * perFire);
  flames.name = "flammes";
  flames.frustumCulled = false;
  group.add(flames);
  const rand = seeded(derive(opts.seed, 4100));
  const offs = fires.flatMap(() => Array.from({ length: perFire }, () => [range(rand, -0.6, 0.6), range(rand, -0.6, 0.6), rand() * 6.28, range(rand, 0.6, 1.1)] as const));
  // Fumée : bouffées qui montent, grossissent et pâlissent.
  const PER = 40;
  const N = fires.length * PER;
  const sPos = new Float32Array(N * 3);
  const sCol = new Float32Array(N * 4);
  const sGeo = new BufferGeometry();
  sGeo.setAttribute("position", new BufferAttribute(sPos, 3));
  sGeo.setAttribute("color", new BufferAttribute(sCol, 4));
  const smokeMat = new PointsMaterial({ size: 22, map: opts.puff, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
  const smoke = new Points(sGeo, smokeMat);
  smoke.name = "fumees";
  smoke.frustumCulled = false;
  group.add(smoke);
  const smokeSeeds = Array.from({ length: N }, () => [rand(), rand(), rand()] as const);
  const big = [...fires].map((f, i) => ({ f, i })).sort((a, b) => b.f.size - a.f.size).slice(0, opts.lights);
  const lights = big.map(({ f }) => {
    const l = new PointLight(phys("braise"), 60, f.size * 9, 2);
    l.position.set(f.x, f.z + f.size * 0.6, f.y);
    group.add(l);
    return l;
  });
  const m = new Matrix4();
  const q = new Quaternion();
  const soot = phys("fumee");
  const update = (t: number): void => {
    fires.forEach((f, fi) => {
      for (let k = 0; k < perFire; k++) {
        const [ox, oz, ph, sc] = offs[fi * perFire + k] as readonly [number, number, number, number];
        const flick = 0.75 + 0.25 * Math.sin(t * 9 + ph) * Math.sin(t * 5.3 + ph * 2);
        const s = f.size * 0.35 * sc;
        m.compose(new Vector3(f.x + ox * f.size, f.z, f.y + oz * f.size), q, new Vector3(s, s * 1.4 * flick, s));
        flames.setMatrixAt(fi * perFire + k, m);
      }
    });
    flames.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < N; i++) {
      const f = fires[Math.floor(i / PER)] as Fire;
      const [a, b, c] = smokeSeeds[i] as readonly [number, number, number];
      const k = (t * (0.06 + 0.05 * c) + a) % 1;
      sPos.set([f.x + (b - 0.5) * f.size * (1 + k * 3) + k * 18, f.z + f.size + k * 55, f.y + (c - 0.5) * f.size * (1 + k * 3) + k * 8], i * 3);
      sCol.set([soot.r, soot.g, soot.b, 0.22 * (1 - k) * Math.min(1, k * 6)], i * 4);
    }
    (sGeo.getAttribute("position") as BufferAttribute).needsUpdate = true;
    (sGeo.getAttribute("color") as BufferAttribute).needsUpdate = true;
    lights.forEach((l, i) => {
      l.intensity = 45 + 20 * Math.sin(t * 7 + i * 1.3) * Math.sin(t * 3.1 + i);
    });
  };
  update(0);
  const mats: Material[] = [flameMat, smokeMat];
  return {
    update,
    lights,
    count: fires.length,
    dispose() {
      scene.remove(group);
      flameGeo.dispose();
      sGeo.dispose();
      for (const x of mats) x.dispose();
      flames.dispose();
    },
  };
}
