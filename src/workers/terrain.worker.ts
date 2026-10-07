/// <reference lib="webworker" />
import type { TerrainData } from "../data/terrain";
import { renderTerrain } from "../render/terrainRaster";

/**
 * Image fine du relief (MAP.7) : calculée hors du fil principal après la première image de la carte,
 * puis substituée à l'image de départ ; le jeu reste réactif pendant le calcul.
 */
export interface TerrainJob {
  terrain: Pick<TerrainData, "grid" | "height" | "biome">;
  size: number;
}

self.onmessage = (e: MessageEvent<TerrainJob>): void => {
  const img = renderTerrain(e.data.terrain, e.data.size);
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(img, [img.pixels.buffer]);
};
