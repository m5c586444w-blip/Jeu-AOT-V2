import { BoxGeometry, BufferAttribute, BufferGeometry, CapsuleGeometry, Color, CylinderGeometry, DoubleSide, Euler, LatheGeometry, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector2, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Outfit, OutfitId } from "./figuresR3";
import type { SoldierMaterials } from "./soldier";

/**
 * Équipement des tenues de R3 (choix de design A ; aucun uniforme ni emblème de l'œuvre) : coiffes (képi, casque, casquette à
 * bandeau), fusil (avec baïonnette pour l'infanterie), pistolet et étui, sac, pans de manteau. Géométries à l'échelle d'un
 * soldat de 1,80 m, mises à l'échelle du corps à l'attache, partagées entre soldats (cache).
 */
export type OutfitGear = "kepi" | "casque" | "casquette" | "bandeau" | "fusil" | "fusil_baionnette" | "pistolet" | "etui" | "sac" | "noeud";

const cache = new Map<OutfitGear, BufferGeometry>();
const at = (g: BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: [number, number, number] = [1, 1, 1]): BufferGeometry =>
  g.applyMatrix4(new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz)), new Vector3(...s)));

function merge(list: BufferGeometry[]): BufferGeometry {
  const plain = list.map((g) => {
    const x = g.index ? g.toNonIndexed() : g;
    const out = new BufferGeometry();
    out.setAttribute("position", x.getAttribute("position"));
    return out;
  });
  const m = mergeGeometries(plain);
  if (!m) throw new Error("fusion de géométries impossible");
  m.computeVertexNormals();
  return m;
}

/** Profil tourné (rayon, hauteur) autour de l'axe y. */
const lathe = (pts: [number, number][], seg = 20): BufferGeometry => new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), seg);

/** Pièce d'équipement (origine : base de la coiffe ; poignée de l'arme, canon vers +y ; dos du sac). */
export function outfitGear(k: OutfitGear): BufferGeometry {
  let g = cache.get(k);
  if (g) return g;
  switch (k) {
    case "kepi":
      // Képi : fût un peu évasé, dessus plat incliné vers l'avant, visière courte.
      g = merge([lathe([[0, 0.085], [0.094, 0.082], [0.097, 0.07], [0.094, 0.0], [0, 0.0]]), at(new CylinderGeometry(0.075, 0.08, 0.012, 16, 1, false, -Math.PI / 2, Math.PI), 0, 0.005, 0.04, 0, 0, 0, [1, 1, 1.1])]);
      break;
    case "casque":
      // Casque d'acier : calotte arrondie, bord évasé tout autour, un peu plus long derrière.
      g = merge([at(new SphereGeometry(0.135, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, -0.01, -0.005, 0, 0, 0, [1, 0.95, 1.08]), lathe([[0.128, -0.006], [0.165, -0.03], [0.168, -0.036], [0.13, -0.014]])]);
      break;
    case "casquette":
      // Casquette d'officier : bandeau, calotte large et haute, plateau tendu, visière.
      g = merge([lathe([[0, 0.1], [0.115, 0.097], [0.12, 0.088], [0.1, 0.05], [0.096, 0.0], [0, 0]]), at(new CylinderGeometry(0.08, 0.085, 0.012, 16, 1, false, -Math.PI / 2, Math.PI), 0, 0.006, 0.045, -0.15, 0, 0, [1, 1, 1.15])]);
      break;
    case "bandeau":
      g = lathe([[0.1, 0.05], [0.1, 0.015], [0.097, 0.012]], 20);
      break;
    case "fusil":
    case "fusil_baionnette": {
      // Fusil à verrou : crosse, garde, canon ; baïonnette au bout pour l'infanterie. Poignée à l'origine, canon vers +y.
      const parts = [
        at(new BoxGeometry(0.045, 0.32, 0.11), 0, -0.22, -0.02, 0.12, 0, 0),
        at(new BoxGeometry(0.042, 0.5, 0.06), 0, 0.18, 0.0),
        at(new CylinderGeometry(0.011, 0.012, 0.36, 8), 0, 0.6, 0.012),
        at(new BoxGeometry(0.02, 0.06, 0.03), 0, 0.05, 0.04),
      ];
      if (k === "fusil_baionnette") parts.push(at(new BoxGeometry(0.006, 0.34, 0.02), 0, 0.92, 0.03));
      g = merge(parts);
      break;
    }
    case "pistolet":
      g = merge([at(new BoxGeometry(0.03, 0.11, 0.035), 0, -0.02, 0, 0.3, 0, 0), at(new BoxGeometry(0.028, 0.16, 0.03), 0, 0.07, 0.025), at(new CylinderGeometry(0.007, 0.007, 0.06, 6), 0, 0.17, 0.03)]);
      break;
    case "etui":
      g = merge([at(new BoxGeometry(0.06, 0.17, 0.1), 0, -0.06, 0, 0, 0, 0.1), at(new BoxGeometry(0.065, 0.05, 0.11), 0, 0.03, 0)]);
      break;
    case "sac":
      // Havresac carré, rouleau de couverture dessus, gamelle sur le côté.
      g = merge([at(new BoxGeometry(0.32, 0.34, 0.13), 0, 0, -0.065), at(new CapsuleGeometry(0.05, 0.3, 4, 10), 0, 0.2, -0.07, 0, 0, Math.PI / 2), at(new CylinderGeometry(0.05, 0.05, 0.1, 10), 0.19, -0.08, -0.06)]);
      break;
    case "noeud":
      // Nœud d'écharpe sur la hanche gauche : deux pans qui pendent.
      g = merge([at(new BoxGeometry(0.06, 0.05, 0.05), 0, 0, 0), at(new BoxGeometry(0.05, 0.2, 0.012), -0.015, -0.12, 0, 0, 0, 0.12), at(new BoxGeometry(0.045, 0.16, 0.012), 0.02, -0.1, 0.01, 0, 0, -0.15)]);
      break;
  }
  g.computeVertexNormals();
  cache.set(k, g);
  return g;
}

/**
 * Pan de manteau : portion de cylindre évasé, d'angle a0 à a1 (0 : devant, +z ; π/2 : côté gauche, +x), de la taille (y = 0)
 * jusqu'à `length` plus bas ; ellipse de demi-axes rx (côtés) et rz (avant-arrière) en haut, évasée de `flare` en bas.
 */
export function coatPanel(rx: number, rz: number, length: number, a0: number, a1: number, flare: number): BufferGeometry {
  const nu = 10;
  const nv = 8;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const f = 1 + (flare - 1) * v;
    for (let i = 0; i <= nu; i++) {
      const a = a0 + ((a1 - a0) * i) / nu;
      pos.push(Math.sin(a) * rx * f, -v * length, Math.cos(a) * rz * f);
    }
  }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      idx.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2);
    }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Matériaux d'une tenue, partagés par tous les soldats d'un même jeu de matériaux. */
export interface OutfitMaterials {
  jacket: MeshStandardMaterial;
  trousers: MeshStandardMaterial;
  boots: MeshStandardMaterial;
  puttees: MeshStandardMaterial | null;
  cape: MeshStandardMaterial | null;
  coat: MeshStandardMaterial | null;
  hat: MeshStandardMaterial | null;
  band: MeshStandardMaterial | null;
  sash: MeshStandardMaterial | null;
  pack: MeshStandardMaterial | null;
  wood: MeshStandardMaterial;
}

const byMats = new WeakMap<SoldierMaterials, Map<OutfitId, OutfitMaterials>>();

export function outfitMaterials(mats: SoldierMaterials, o: Outfit): OutfitMaterials {
  let m = byMats.get(mats);
  if (!m) {
    m = new Map();
    byMats.set(mats, m);
  }
  const hit = m.get(o.id);
  if (hit) return hit;
  const tint = (base: MeshStandardMaterial, hex: string): MeshStandardMaterial => {
    const x = base.clone();
    x.color = new Color(hex);
    return x;
  };
  const cloth = (hex: string, rough = 0.9): MeshStandardMaterial => {
    const x = mats.jacket.clone();
    x.color = new Color(hex);
    x.roughness = rough;
    return x;
  };
  const out: OutfitMaterials = {
    jacket: tint(mats.jacket, o.veste),
    trousers: tint(mats.trousers, o.pantalon),
    boots: tint(mats.boots, o.bottes),
    puttees: o.molletieres ? cloth(o.molletieres) : null,
    cape: o.cape ? tint(mats.cape, o.cape) : null,
    coat: o.manteau ? Object.assign(cloth(o.manteau.teinte, 0.88), { side: DoubleSide }) : null,
    hat: o.coiffe ? new MeshStandardMaterial({ color: new Color(o.coiffe.teinte), roughness: o.coiffe.forme === "casque" ? 0.55 : 0.8, metalness: o.coiffe.forme === "casque" ? 0.35 : 0 }) : null,
    band: o.coiffe?.bandeau ? new MeshStandardMaterial({ color: new Color(o.coiffe.bandeau), roughness: 0.75 }) : null,
    sash: o.echarpe ? cloth(o.echarpe, 0.8) : null,
    pack: o.sac ? cloth(o.sac, 0.85) : null,
    wood: new MeshStandardMaterial({ color: new Color(0x5a3f26), roughness: 0.6 }),
  };
  m.set(o.id, out);
  mats.all.push(...([out.jacket, out.trousers, out.boots, out.puttees, out.cape, out.coat, out.hat, out.band, out.sash, out.pack, out.wood].filter((x) => x !== null) as MeshStandardMaterial[]));
  return out;
}
