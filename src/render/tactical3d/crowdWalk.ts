import { BufferAttribute, InstancedBufferAttribute } from "three";
import type { BufferGeometry, InstancedMesh, MeshStandardMaterial } from "three";
import type { FaceBuilder } from "./townMesh";

/**
 * Dette n° 61 : la foule instanciée (soldats et fantassins au-delà de la distance de détail) marche et court. Chaque sommet
 * porte son membre (`aLimb` : 1 / −1 jambe gauche / droite, 2 / −2 bras gauche / droit, 0 le reste) ; chaque instance son
 * pas (`aWalk` : phase, amplitude en radians, cadence en rad/s). Le shader fait pivoter jambes et bras autour de la hanche et
 * de l'épaule, bras opposés aux jambes. Amplitudes et cadences : choix de rendu (A).
 */
export type Limb = 0 | 1 | -1 | 2 | -2;

/** Repère des sommets ajoutés par `fn` comme membre `limb` (plages de sommets du constructeur de faces). */
export class LimbMarks {
  private readonly ranges: [number, number, Limb][] = [];
  mark(fb: FaceBuilder, limb: Limb, fn: () => void): void {
    const start = fb.pos.length / 3;
    fn();
    this.ranges.push([start, fb.pos.length / 3, limb]);
  }
  /** Pose l'attribut `aLimb` sur la géométrie construite. */
  apply(geo: BufferGeometry): BufferGeometry {
    const n = geo.getAttribute("position").count;
    const a = new Float32Array(n);
    for (const [s, e, l] of this.ranges) a.fill(l, s, Math.min(e, n));
    geo.setAttribute("aLimb", new BufferAttribute(a, 1));
    return geo;
  }
}

/** Pas montré selon l'état d'une figure (directeur) : amplitude et cadence ; immobile sinon. */
export function walkParams(state: string): { amp: number; rate: number } {
  if (state === "course") return { amp: 0.75, rate: 11 };
  if (state === "marche") return { amp: 0.42, rate: 6.5 };
  return { amp: 0, rate: 0 };
}

/** Attribut d'instance `aWalk` d'une foule (créé à la première demande). */
export function walkAttribute(mesh: InstancedMesh): InstancedBufferAttribute {
  let a = mesh.geometry.getAttribute("aWalk") as InstancedBufferAttribute | undefined;
  if (!a) {
    a = new InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 3), 3);
    mesh.geometry.setAttribute("aWalk", a);
  }
  return a;
}

/** Shader de marche : pivot des membres marqués autour de la hanche (`hipY`) et de l'épaule (`shoulderY`). */
export function patchWalk(mat: MeshStandardMaterial, time: { value: number }, hipY: number, shoulderY: number): void {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms["uWalkTime"] = time;
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float aLimb;
attribute vec3 aWalk;
uniform float uWalkTime;
vec3 walkLimb(vec3 p) {
  float limb = abs(aLimb);
  if (limb < 0.5 || aWalk.y <= 0.0) return p;
  float side = sign(aLimb);
  float sw = sin(uWalkTime * aWalk.z + aWalk.x) * aWalk.y;
  float a = limb < 1.5 ? sw * side : -0.8 * sw * side;
  float pivot = limb < 1.5 ? ${hipY.toFixed(4)} : ${shoulderY.toFixed(4)};
  vec2 q = vec2(p.y - pivot, p.z);
  float c = cos(a);
  float s = sin(a);
  return vec3(p.x, pivot + q.x * c - q.y * s, q.x * s + q.y * c);
}`,
      )
      .replace("#include <begin_vertex>", "vec3 transformed = walkLimb(vec3(position));");
  };
  mat.customProgramCacheKey = () => `walk:${hipY.toFixed(4)}:${shoulderY.toFixed(4)}`;
}
