import { MeshStandardMaterial } from "three";
import type { Camera, Material, Mesh, Object3D, Scene, Texture, WebGLRenderer } from "three";

/**
 * R1d : compile les shaders des matériaux d'une scène avant d'y montrer de nouveaux corps. En parallèle quand le moteur le
 * permet (`KHR_parallel_shader_compile`), sinon d'un coup (WebGL logiciel).
 */
export async function precompile(renderer: WebGLRenderer, scene: Scene, camera: Camera): Promise<void> {
  if (renderer.extensions.has("KHR_parallel_shader_compile")) await renderer.compileAsync(scene, camera);
  else renderer.compile(scene, camera);
}

/**
 * Qualité basse allégée (R1d, décision de l'utilisateur) : sans cartes de relief (normales) ni cartes de feuilles. S'applique à
 * chaud à toute une scène, dans les deux sens : la carte de relief d'un matériau est gardée dans `userData.relief` et remise
 * quand on quitte la qualité basse ; les cartes de feuillage (`*-feuilles`) sont masquées. L'éclairage d'image et le ciel
 * physique se règlent dans `lighting.ts` (`setLite`).
 */
export function applyLite(root: Object3D, lite: boolean): void {
  root.traverse((o) => {
    if (o.name.endsWith("-feuilles")) o.visible = !lite;
    const m = (o as Mesh).material as Material | Material[] | undefined;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      if (!(mat instanceof MeshStandardMaterial)) continue;
      const ud = mat.userData as { relief?: Texture | null };
      if (ud.relief === undefined) {
        if (!mat.normalMap) continue;
        ud.relief = mat.normalMap;
      }
      const want = lite ? null : ud.relief;
      if (mat.normalMap !== want) {
        mat.normalMap = want;
        mat.needsUpdate = true;
      }
    }
  });
}

/** Nombre de matériaux avec relief et de cartes de feuillage visibles (contrôle de la qualité basse). */
export function liteCounts(root: Object3D): { relief: number; leafCards: number } {
  let relief = 0;
  let leafCards = 0;
  root.traverse((o) => {
    if (o.name.endsWith("-feuilles") && o.visible) leafCards++;
    const m = (o as Mesh).material as Material | Material[] | undefined;
    for (const mat of m ? (Array.isArray(m) ? m : [m]) : []) if (mat instanceof MeshStandardMaterial && mat.normalMap) relief++;
  });
  return { relief, leafCards };
}
