import { Color, DoubleSide, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking } from "three";
import type { Texture } from "three";
import type { Facade, RoofCover } from "../../../data/placeSchema";
import { tagPhoto } from "../photoTextures";
import { ATTIC_H, BAY_M, GABLE_W, ROOF_TILE_M, facadeTextures, roofCoverTexture } from "./textures";
import type { FacadeTextures } from "./textures";

/**
 * Matériaux des maisons instanciées (R1e) : `MeshStandardMaterial` dont le shader de sommets recale les coordonnées de texture
 * sur la taille réelle de chaque instance (échelle lue dans `instanceMatrix`) :
 * - façades : nombre entier de travées de `BAY_M` m par face, variante de départ par maison, rangée boutique ou logis au
 *   rez-de-chaussée (face sur rue et maison à boutique), étages répétés ;
 * - pignons : fenêtre de comble centrée, tuiles de `GABLE_W` × `ATTIC_H` m ;
 * - toits : coordonnées en mètres le long du faîtage et de la pente (tuile de `ROOF_TILE_M` m), extrémités de faîtage des
 *   croupes recalées selon les proportions de l'instance (pente égale sur les quatre pans), normales des croupes recalculées ;
 *   même recalage dans le matériau d'ombre (`customDepthMaterial`).
 */
export type FacadePart = "rdc" | "etages" | "pignon" | "lucarne";
const KIND: Record<FacadePart, number> = { rdc: 0, etages: 1, pignon: 2, lucarne: 3 };

const SCALE = /* glsl */ `
#ifdef USE_INSTANCING
  float isx = length(instanceMatrix[0].xyz);
  float isy = length(instanceMatrix[1].xyz);
  float isz = length(instanceMatrix[2].xyz);
#else
  float isx = 1.0;
  float isy = 1.0;
  float isz = 1.0;
#endif
`;

function facadeMaterial(t: FacadeTextures, part: FacadePart): MeshStandardMaterial {
  const map = part === "rdc" ? t.ground : part === "pignon" ? t.gable : t.upper;
  const lit = part === "rdc" ? t.groundLit : part === "pignon" ? null : t.upperLit;
  const m = new MeshStandardMaterial({ map, roughness: 0.92, emissiveMap: lit, emissive: lit ? new Color(0xffffff) : new Color(0), emissiveIntensity: 0 });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", `#include <common>\nattribute vec3 fa;\n#ifdef USE_INSTANCING\nattribute vec4 iInfo;\n#else\nvec4 iInfo = vec4(0.0);\n#endif`)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
${SCALE}
  float span = fa.x < 0.5 ? isx : isz;
  float nb = max(1.0, floor(span / ${BAY_M.toFixed(2)} + 0.5));
  vec2 fuv;
  float kind = ${KIND[part].toFixed(1)};
  if (kind < 0.5) {
    float row = (fa.y > 0.5 && iInfo.z > 0.5) ? 1.0 : 0.0;
    fuv = vec2(uv.x * nb * 0.25 + iInfo.x * 0.25, (uv.y + row) * 0.5);
  } else if (kind < 1.5) {
    fuv = vec2(uv.x * nb * 0.25 + iInfo.x * 0.25, uv.y * iInfo.y * 0.5);
  } else if (kind < 2.5) {
    fuv = vec2(uv.x * span / ${GABLE_W.toFixed(2)} + 0.5, uv.y * isy / ${ATTIC_H.toFixed(2)});
  } else {
    fuv = vec2(iInfo.x * 0.25 + uv.x * 0.25, 0.5 + uv.y * 0.5);
  }
  if (fa.x > 1.5) fuv = vec2(0.02, 0.02);
#ifdef USE_MAP
  vMapUv = fuv;
#endif
#ifdef USE_EMISSIVEMAP
  vEmissiveMapUv = fuv;
#endif
`,
      );
  };
  m.customProgramCacheKey = () => `place-facade-${part}`;
  return m;
}

const HIP_POS = /* glsl */ `
  float hipR = max(0.0, 0.5 - hip.w * 0.5 * (hip.x < 0.5 ? isz / isx : isx / isz));
  if (hip.y != 0.0) {
    if (hip.x < 0.5) transformed.x = hip.y * hipR;
    else transformed.z = hip.y * hipR;
  }
`;

function roofMaterial(cover: RoofCover, map: Texture): { mat: MeshStandardMaterial; depth: MeshDepthMaterial } {
  const mat = new MeshStandardMaterial({ map, roughness: cover === "ardoise" ? 0.6 : cover === "cuivre" ? 0.45 : 0.85, metalness: cover === "cuivre" ? 0.25 : 0, side: DoubleSide });
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", `#include <common>\nattribute vec4 hip;\nattribute float rax;`)
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
${SCALE}
  float hipN = max(0.0, 0.5 - hip.w * 0.5 * (hip.x < 0.5 ? isz / isx : isx / isz));
  if (hip.z != 0.0) objectNormal = normalize(hip.x < 0.5 ? vec3(hip.z * hip.w, 0.5 - hipN, 0.0) : vec3(0.0, 0.5 - hipN, hip.z * hip.w));
`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
${HIP_POS}
  vec2 ruv;
  if (rax < 0.5) ruv = vec2(transformed.x * isx, transformed.y * length(vec2(isz * 0.5, isy)));
  else if (rax < 1.5) ruv = vec2(transformed.z * isz, transformed.y * length(vec2(isx * 0.5, isy)));
  else ruv = vec2(transformed.x * isx, transformed.z * isz);
  ruv /= ${ROOF_TILE_M.toFixed(2)};
#ifdef USE_MAP
  vMapUv = (mapTransform * vec3(ruv, 1.0)).xy;
#endif
#ifdef USE_NORMALMAP
  vNormalMapUv = (normalMapTransform * vec3(ruv, 1.0)).xy;
#endif
`,
      );
  };
  mat.customProgramCacheKey = () => "place-roof";
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide });
  depth.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace("#include <common>", `#include <common>\nattribute vec4 hip;`).replace("#include <begin_vertex>", `#include <begin_vertex>\n${SCALE}\n${HIP_POS}`);
  };
  depth.customProgramCacheKey = () => "place-roof-depth";
  return { mat, depth };
}

export interface PlaceMaterials {
  facade(m: Facade, part: FacadePart): MeshStandardMaterial;
  roof(c: RoofCover): { mat: MeshStandardMaterial; depth: MeshDepthMaterial };
  chimney: MeshStandardMaterial;
  rubble: MeshStandardMaterial;
  /** Matériaux à fenêtres (émission de nuit, réglée par l'éclairage). */
  windowMaterials: MeshStandardMaterial[];
  textures(): Texture[];
  dispose(): void;
}

export function createPlaceMaterials(seed: number): PlaceMaterials {
  const ftex = new Map<Facade, FacadeTextures>();
  const fmat = new Map<string, MeshStandardMaterial>();
  const rmat = new Map<RoofCover, { mat: MeshStandardMaterial; depth: MeshDepthMaterial }>();
  const rtex: Texture[] = [];
  const windowMaterials: MeshStandardMaterial[] = [];
  const chimney = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  const rubble = new MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  return {
    facade(m, part) {
      const key = `${m}|${part}`;
      let mat = fmat.get(key);
      if (!mat) {
        let t = ftex.get(m);
        if (!t) {
          t = facadeTextures(m, seed);
          ftex.set(m, t);
        }
        mat = facadeMaterial(t, part);
        fmat.set(key, mat);
        if (part !== "pignon") windowMaterials.push(mat);
      }
      return mat;
    },
    roof(c) {
      let r = rmat.get(c);
      if (!r) {
        const t = roofCoverTexture(c, seed);
        // Tuiles et ardoise : remplacées par les textures de Poly Haven après la première image (R1d).
        if (c === "tuile_plate" || c === "tuile_canal") tagPhoto(t, "tuiles", ROOF_TILE_M);
        else if (c === "ardoise") tagPhoto(t, "ardoise", ROOF_TILE_M);
        rtex.push(t);
        r = roofMaterial(c, t);
        rmat.set(c, r);
      }
      return r;
    },
    chimney,
    rubble,
    windowMaterials,
    textures() {
      return [...[...ftex.values()].flatMap((t) => [t.upper, t.upperLit, t.ground, t.groundLit, t.gable]), ...rtex];
    },
    dispose() {
      for (const m of fmat.values()) m.dispose();
      for (const r of rmat.values()) {
        r.mat.dispose();
        r.depth.dispose();
      }
      chimney.dispose();
      rubble.dispose();
      for (const t of this.textures()) t.dispose();
    },
  };
}
