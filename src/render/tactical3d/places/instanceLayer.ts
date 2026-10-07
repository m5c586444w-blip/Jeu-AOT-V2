import { BufferGeometry, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh } from "three";
import type { Material } from "three";
import type { Batch, Batches } from "./instances";

/**
 * Couche d'instances par tronçons (R1e, consigne §2.3 et §4) : un `InstancedMesh` par lot et par niveau de détail ; à chaque
 * mouvement de caméra, les tronçons visibles (et à la bonne distance) sont recopiés dans les tampons, les autres omis.
 * État d'un tronçon : 0 caché (hors champ ou déchargé), 1 loin, 2 moyen, 3 proche.
 */
export type ChunkState = 0 | 1 | 2 | 3;

export interface LayerPart {
  geometry: BufferGeometry;
  material: Material | Material[];
  depth?: Material;
  /** États de tronçon où la pièce est dessinée. */
  states: readonly ChunkState[];
  castShadow: boolean;
  /** Teinte d'instance (sinon la couleur du matériau seule). */
  tinted: boolean;
  /** Valeurs d'information (`iInfo`) passées au shader. */
  info: boolean;
}

interface Slot {
  batch: Batch;
  part: LayerPart;
  mesh: InstancedMesh;
  color: InstancedBufferAttribute | null;
  info: InstancedBufferAttribute | null;
  states: Set<ChunkState>;
}

const lin = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export class InstanceLayer {
  readonly meshes: InstancedMesh[] = [];
  private readonly slots: Slot[] = [];
  /** Teintes converties en linéaire une fois (lot → tronçon → tampon). */
  private readonly linColors = new Map<Batch, Map<number, Float32Array>>();

  constructor(batches: Batches, resolve: (b: Batch) => LayerPart[]) {
    for (const key of [...batches.keys()].sort()) {
      const batch = batches.get(key) as Batch;
      const lc = new Map<number, Float32Array>();
      for (const [ck, ch] of batch.chunks) lc.set(ck, Float32Array.from(ch.c, lin));
      this.linColors.set(batch, lc);
      for (const part of resolve(batch)) {
        // Géométrie propre à la pièce (attributs partagés) : elle porte ses attributs d'instance.
        const g = new BufferGeometry();
        for (const [name, a] of Object.entries(part.geometry.attributes)) g.setAttribute(name, a);
        g.boundingSphere = part.geometry.boundingSphere;
        const mesh = new InstancedMesh(g, part.material, Math.max(1, batch.count));
        mesh.name = `${batch.key}|${part.states.join("")}`;
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.castShadow = part.castShadow;
        mesh.receiveShadow = true;
        if (part.depth) mesh.customDepthMaterial = part.depth;
        let color: InstancedBufferAttribute | null = null;
        if (part.tinted) {
          color = new InstancedBufferAttribute(new Float32Array(Math.max(1, batch.count) * 3), 3);
          color.setUsage(DynamicDrawUsage);
          mesh.instanceColor = color;
        }
        let info: InstancedBufferAttribute | null = null;
        if (part.info) {
          info = new InstancedBufferAttribute(new Float32Array(Math.max(1, batch.count) * 4), 4);
          info.setUsage(DynamicDrawUsage);
          g.setAttribute("iInfo", info);
        }
        mesh.count = 0;
        this.slots.push({ batch, part, mesh, color, info, states: new Set(part.states) });
        this.meshes.push(mesh);
      }
    }
  }

  /** Recopie les tronçons selon leur état ; renvoie le nombre d'instances dessinées. */
  update(stateOf: (chunk: number) => ChunkState): number {
    let total = 0;
    for (const s of this.slots) {
      const m = s.mesh.instanceMatrix.array as Float32Array;
      const c = s.color?.array as Float32Array | undefined;
      const inf = s.info?.array as Float32Array | undefined;
      const lc = this.linColors.get(s.batch);
      let n = 0;
      for (const [ck, ch] of s.batch.chunks) {
        const st = stateOf(ck);
        if (!s.states.has(st)) continue;
        const k = ch.m.length / 16;
        m.set(ch.m, n * 16);
        if (c) c.set(lc?.get(ck) ?? ch.c, n * 3);
        if (inf) inf.set(ch.i, n * 4);
        n += k;
      }
      s.mesh.count = n;
      s.mesh.instanceMatrix.needsUpdate = true;
      if (s.color) s.color.needsUpdate = true;
      if (s.info) s.info.needsUpdate = true;
      total += n;
    }
    return total;
  }

  dispose(): void {
    for (const s of this.slots) {
      s.mesh.geometry.dispose();
      s.mesh.dispose();
    }
  }
}
