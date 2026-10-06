import { DepthTexture, HalfFloatType, WebGLRenderTarget } from "three";
import type { Camera, Scene, WebGLRenderer } from "three";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { Quality } from "./quality";

/**
 * Post-traitement de R1c (rendu réaliste) : occlusion ambiante (GTAO) puis sortie (tonalité, sRGB).
 * - La scène est rendue dans une cible flottante avec sa texture de profondeur ; l'occlusion se calcule depuis cette
 *   profondeur (normales reconstruites) : pas de second rendu de la scène, et les cartes de feuillage gardent leur découpe.
 * - La passe de sortie dessine à l'écran dans la fenêtre courante du moteur (les quatre vues d'une planche).
 * - Qualité « bas » : rien (rendu direct) ; « moyen » : 8 échantillons ; « haut » : 16.
 */
export interface PostChain {
  render(renderer: WebGLRenderer, width: number, height: number): void;
  /** Compteurs du rendu de la scène seule (les passes suivantes remettent ceux du moteur à zéro). */
  readonly sceneInfo: { calls: number; triangles: number };
  dispose(): void;
}

export function createPost(scene: Scene, camera: Camera, quality: Quality): PostChain | null {
  if (quality === "bas") return null;
  const depth = new DepthTexture(1, 1);
  const sceneRT = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthTexture: depth });
  const aoRT = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
  // Construite avec son propre G-buffer puis branchée sur notre profondeur : passée au constructeur, la profondeur externe fait
  // lire une cible de normales absente (three r186). La cible de normales reste allouée, inutilisée (aucun second rendu).
  const gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.setGBuffer(depth);
  // Rayon en mètres : l'ombre des recoins (pied des murs, rues étroites, sous les houppiers), pas d'assombrissement global.
  gtao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.6, thickness: 2, scale: 1.1, samples: quality === "haut" ? 16 : 8, distanceFallOff: 1 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 12 });
  gtao.blendIntensity = 0.85;
  const output = new OutputPass();
  output.renderToScreen = true;
  let w = 0;
  let h = 0;
  const sceneInfo = { calls: 0, triangles: 0 };
  return {
    sceneInfo,
    render(renderer, width, height) {
      const W = Math.max(1, Math.floor(width));
      const H = Math.max(1, Math.floor(height));
      if (W !== w || H !== h) {
        w = W;
        h = H;
        sceneRT.setSize(w, h);
        aoRT.setSize(w, h);
        gtao.setSize(w, h);
      }
      const before = renderer.getRenderTarget();
      renderer.setRenderTarget(sceneRT);
      renderer.clear();
      renderer.render(scene, camera);
      sceneInfo.calls = renderer.info.render.calls;
      sceneInfo.triangles = renderer.info.render.triangles;
      gtao.render(renderer, aoRT, sceneRT, 0, false);
      renderer.setRenderTarget(null);
      // Sortie à l'écran (renderToScreen) : la cible d'écriture n'est pas utilisée.
      output.render(renderer, sceneRT, aoRT, 0, false);
      renderer.setRenderTarget(before);
    },
    dispose() {
      sceneRT.dispose();
      aoRT.dispose();
      depth.dispose();
      gtao.dispose();
      output.dispose();
    },
  };
}
