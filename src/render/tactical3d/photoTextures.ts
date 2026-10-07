import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader } from "three";
import type { Material, Mesh, Object3D, Texture } from "three";
import type { ParementUniforms } from "./parement";

/**
 * R1d (décision de l'utilisateur) : textures d'environnement de Poly Haven (CC0) — pavés, sol naturel, pierre de taille, pierre
 * brute, tuiles, ardoise ; couleur et relief en WebP 1K (`docs/art/assets/polyhaven/`, servis sous `assets3d/`).
 * - Les maillages gardent leurs textures procédurales : la scène est « prête » sans elles, et elles restent le repli si le
 *   chargement échoue. Une texture procédurale qui peut être remplacée porte une étiquette (`tagPhoto`) : sa matière et la taille
 *   d'une unité de coordonnée de texture (m), pour mettre la photo à l'échelle réelle.
 * - Après la première image, `loadPhotoTextures` charge les 12 fichiers et `applyPhotoTextures` les met à la place : la couleur
 *   du matériau est corrigée pour que la teinte moyenne reste celle de la texture procédurale (la teinte du profil est
 *   conservée), le relief de la photo remplace le relief dérivé ; en qualité basse allégée, il est gardé à part
 *   (`userData.relief`, voir `lite.ts`).
 */
export type Matiere = "pave" | "sol" | "pierre_taille" | "pierre_brute" | "tuiles" | "ardoise";
/** Fichiers et côté réel (m) de chaque matière ; même table que `POLYHAVEN_TEXTURES` (`src/tools/assetsSources.ts`, test). */
export const PHOTO_MATIERES: Record<Matiere, { id: string; taille: number }> = {
  pave: { id: "cobblestone_floor_08", taille: 2 },
  sol: { id: "forrest_ground_01", taille: 2 },
  pierre_taille: { id: "medieval_blocks_03", taille: 2 },
  pierre_brute: { id: "castle_wall_slates", taille: 2.5 },
  tuiles: { id: "roof_tiles_14", taille: 1.5 },
  ardoise: { id: "roof_slates_02", taille: 3 },
};
export const photoUrl = (id: string, carte: "diff" | "nor_gl", base = "assets3d/"): string => `${base}polyhaven/${id}_${carte}_1k.webp`;

export interface PhotoTag {
  matiere: Matiere;
  /** Mètres par unité de coordonnée de texture (u, v). */
  metres: [number, number];
}
/** Étiquette une texture procédurale remplaçable (renvoie la même texture). */
export function tagPhoto<T extends Texture | null>(t: T, matiere: Matiere, metres: number | [number, number]): T {
  if (t) (t.userData as { photo?: PhotoTag }).photo = { matiere, metres: typeof metres === "number" ? [metres, metres] : metres };
  return t;
}

/** Couleur moyenne linéaire (r, g, b) d'une image. */
export type MeanOf = (image: unknown) => [number, number, number];
export interface PhotoSet {
  map: Texture;
  normal: Texture;
  /** Couleur moyenne linéaire de la photo. */
  mean: [number, number, number];
}
export type PhotoTextures = Map<Matiere, PhotoSet>;

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const means = new WeakMap<object, [number, number, number]>();
/** Moyenne linéaire d'une image (toile ou image décodée), sur une réduction de 32 × 32. */
export const canvasMean: MeanOf = (image) => {
  const key = image as object;
  const hit = means.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return [0.5, 0.5, 0.5];
  g.drawImage(image as CanvasImageSource, 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data;
  const s = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] = (s[k] as number) + toLinear((d[i + k] as number) / 255);
  const out: [number, number, number] = [(s[0] as number) / 1024, (s[1] as number) / 1024, (s[2] as number) / 1024];
  means.set(key, out);
  return out;
};

/** Charge les 12 textures (couleur et relief des 6 matières). Rejette si l'une manque : la scène garde alors ses textures. */
export async function loadPhotoTextures(base = "assets3d/", meanOf: MeanOf = canvasMean): Promise<PhotoTextures> {
  const loader = new TextureLoader();
  const load = async (url: string, srgb: boolean): Promise<Texture> => {
    const t = await loader.loadAsync(url);
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = SRGBColorSpace;
    return t;
  };
  const entries = await Promise.all(
    (Object.entries(PHOTO_MATIERES) as [Matiere, { id: string }][]).map(async ([m, { id }]) => {
      const [map, normal] = await Promise.all([load(photoUrl(id, "diff", base), true), load(photoUrl(id, "nor_gl", base), false)]);
      return [m, { map, normal, mean: meanOf(map.image) }] as const;
    }),
  );
  return new Map(entries);
}

/** Copie d'une texture chargée (même image), répétée pour une unité de coordonnée de `metres` mètres. */
function scaled(t: Texture, metres: [number, number], taille: number): Texture {
  const c = t.clone();
  c.wrapS = RepeatWrapping;
  c.wrapT = RepeatWrapping;
  c.repeat.set(metres[0] / taille, metres[1] / taille);
  c.needsUpdate = true;
  return c;
}

/** Détail du sol (terrain des environnements) : texture et gain du shader, relief ; voir `meshTerrain.ts`. */
export interface PhotoDetail {
  uniforms: { detailMap: { value: Texture | null }; detailRepeat: { value: number }; detailGain: { value: number } };
  /** Côté du terrain (m) : l'unité de coordonnée du sol. */
  size: number;
}

/**
 * Met les photos à la place des textures étiquetées d'une scène (une fois par matériau). Renvoie le nombre de matériaux
 * changés. `lite` : qualité basse allégée en cours (relief gardé à part).
 */
export function applyPhotoTextures(root: Object3D, photos: PhotoTextures, lite: boolean, meanOf: MeanOf = canvasMean): number {
  let changed = 0;
  const seen = new Set<Material>();
  root.traverse((o) => {
    const m = (o as Mesh).material as Material | Material[] | undefined;
    for (const mat of m ? (Array.isArray(m) ? m : [m]) : []) {
      if (!(mat instanceof MeshStandardMaterial) || seen.has(mat)) continue;
      seen.add(mat);
      const ud = mat.userData as { photo?: Matiere; relief?: Texture | null; photoDetail?: PhotoDetail; parement?: ParementUniforms; parementPhoto?: boolean };
      if (ud.photo || ud.parementPhoto) continue;
      if (ud.parement && mat.map) {
        // R1e : parement sans motif répété — la pierre de taille et la pierre brute de Poly Haven deviennent les appareils A et
        // C, à leur taille réelle ; le gain garde la teinte moyenne des appareils procéduraux qu'elles remplacent.
        const pa = photos.get("pierre_taille");
        const pc = photos.get("pierre_brute");
        if (!pa || !pc) continue;
        const u = ud.parement;
        const gain = (target: [number, number, number], ph: [number, number, number]): [number, number, number] => [ratio(target[0], ph[0]), ratio(target[1], ph[1]), ratio(target[2], ph[2])];
        // Les deux photos ramenées à la moyenne de l'appareil A procédural (comme l'appareil B), pas de taches.
        const target = u.parTarget[0] > 0 ? u.parTarget : meanOf(mat.map.image);
        u.parGainA.value = gain(target, pa.mean);
        u.parGainC.value = gain(target, pc.mean);
        mat.map = pa.map;
        u.parC.value = pc.map;
        u.parSizeA.value = [PHOTO_MATIERES.pierre_taille.taille, PHOTO_MATIERES.pierre_taille.taille];
        u.parSizeC.value = [PHOTO_MATIERES.pierre_brute.taille, PHOTO_MATIERES.pierre_brute.taille];
        mat.needsUpdate = true;
        // Pas de relief photo (ses coordonnées ne suivent pas celles du shader) : marque propre, hors de `photo`.
        ud.parementPhoto = true;
        changed++;
        continue;
      }
      const tag = (mat.map?.userData as { photo?: PhotoTag } | undefined)?.photo;
      if (tag && mat.map) {
        const p = photos.get(tag.matiere);
        if (!p) continue;
        const { taille } = PHOTO_MATIERES[tag.matiere];
        // Teinte du profil conservée : la moyenne (couleur du matériau × texture) reste celle de la texture procédurale.
        const proc = meanOf(mat.map.image);
        mat.color.setRGB(mat.color.r * ratio(proc[0], p.mean[0]), mat.color.g * ratio(proc[1], p.mean[1]), mat.color.b * ratio(proc[2], p.mean[2]));
        mat.map = scaled(p.map, tag.metres, taille);
        setRelief(mat, scaled(p.normal, tag.metres, taille), lite);
        ud.photo = tag.matiere;
        changed++;
      } else if (ud.photoDetail) {
        const p = photos.get("sol");
        if (!p) continue;
        const d = ud.photoDetail;
        const rep = d.size / PHOTO_MATIERES.sol.taille;
        d.uniforms.detailMap.value = p.map;
        d.uniforms.detailRepeat.value = rep;
        // Le shader module la teinte du sol peint par (détail × gain) : moyenne ramenée à 1.
        d.uniforms.detailGain.value = 1 / Math.max(0.02, p.mean[0]);
        setRelief(mat, scaled(p.normal, [d.size, d.size], PHOTO_MATIERES.sol.taille), lite);
        ud.photo = "sol";
        changed++;
      }
    }
  });
  return changed;
}

/** Correction de teinte d'un canal (bornée : une photo très sombre peut demander × 10). */
const ratio = (proc: number, photo: number): number => Math.min(16, Math.max(1 / 16, proc / Math.max(0.002, photo)));

function setRelief(mat: MeshStandardMaterial, normal: Texture, lite: boolean): void {
  (mat.userData as { relief?: Texture | null }).relief = normal;
  mat.normalMap = lite ? null : normal;
  mat.needsUpdate = true;
}

/** Nombre de matériaux passés aux photos, par matière (contrôle). */
export function photoCounts(root: Object3D): Partial<Record<Matiere, number>> {
  const out: Partial<Record<Matiere, number>> = {};
  const seen = new Set<Material>();
  root.traverse((o) => {
    const m = (o as Mesh).material as Material | Material[] | undefined;
    for (const mat of m ? (Array.isArray(m) ? m : [m]) : []) {
      if (seen.has(mat)) continue;
      seen.add(mat);
      const ud = mat.userData as { photo?: Matiere; parementPhoto?: boolean };
      const k = ud.photo ?? (ud.parementPhoto ? "pierre_taille" : undefined);
      if (k) out[k] = (out[k] ?? 0) + 1;
    }
  });
  return out;
}
