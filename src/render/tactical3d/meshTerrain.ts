import { BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3 } from "three";
import type { Material, Texture } from "three";
import type { Paving, Canal } from "./envTypes";
import { centroid, norm2, sub2, v2 } from "./geom2";
import type { Vec2 } from "./geom2";
import { MATERIALS } from "./styles";
import { heightAt } from "./terrain";
import type { Bridge, Heightfield, Road, TerrainData } from "./terrain";
import { FaceBuilder } from "./townMesh";

/**
 * Maillage du terrain de R1b (R1b.2) : sol (grille d'altitude), eau (rivière en ruban au niveau décroissant, lacs, mer, marais),
 * routes de terre (rubans posés sur le relief), pavages, ponts de pierre. Le détail du sol (parcelles, sillons, ornières, berges)
 * est dans la texture de sol dessinée par `texturesEnv.ts` (navigateur) ; sans elle, le sol prend la teinte `sol` du profil.
 */
export interface TerrainMeshes {
  group: Group;
  ground: Mesh;
  water: Mesh[];
  materials: Material[];
  dispose(): void;
}

export function groundGeometry(hf: Heightfield, color: Color): BufferGeometry {
  const n = hf.n;
  const half = hf.size / 2;
  const pos = new Float32Array(n * n * 3);
  const uv = new Float32Array(n * n * 2);
  const col = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      pos[k * 3] = -half + i * hf.cell;
      pos[k * 3 + 1] = hf.h[k] as number;
      pos[k * 3 + 2] = -half + j * hf.cell;
      uv[k * 2] = i / (n - 1);
      uv[k * 2 + 1] = 1 - j / (n - 1);
      col[k * 3] = color.r;
      col[k * 3 + 1] = color.g;
      col[k * 3 + 2] = color.b;
    }
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let p = 0;
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      idx.set([a, c, b, b, c, d], p);
      p += 6;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  g.setAttribute("color", new BufferAttribute(col, 3));
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Ruban le long d'une polyligne : demi-largeur `w`, hauteur par point (fonction). */
export function ribbon(path: readonly Vec2[], w: number, y: (p: Vec2, i: number) => number, color: Color, vScale = 0.1): BufferGeometry {
  const fb = new FaceBuilder();
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i] as Vec2;
    const b = path[i + 1] as Vec2;
    const prev = path[Math.max(0, i - 1)] as Vec2;
    const next = path[Math.min(path.length - 1, i + 2)] as Vec2;
    const na = norm2(sub2(b, prev));
    const nb = norm2(sub2(next, a));
    const pa = v2(-na.y * w, na.x * w);
    const pb = v2(-nb.y * w, nb.x * w);
    const ya = y(a, i);
    const yb = y(b, i + 1);
    fb.face(
      [
        [a.x - pa.x, ya, a.y - pa.y],
        [a.x + pa.x, ya, a.y + pa.y],
        [b.x + pb.x, yb, b.y + pb.y],
        [b.x - pb.x, yb, b.y - pb.y],
      ],
      [[0, i * vScale], [1, i * vScale], [1, (i + 1) * vScale], [0, (i + 1) * vScale]],
      color,
      [0, 1, 0],
    );
  }
  return fb.build();
}

/** Ruban posé sur le relief : chaque bord prend l'altitude du terrain sous lui (routes de terre). */
export function drapedRibbon(path: readonly Vec2[], w: number, hf: Heightfield, offset: number, color: Color): BufferGeometry {
  const fb = new FaceBuilder();
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i] as Vec2;
    const b = path[i + 1] as Vec2;
    const prev = path[Math.max(0, i - 1)] as Vec2;
    const next = path[Math.min(path.length - 1, i + 2)] as Vec2;
    const na = norm2(sub2(b, prev));
    const nb = norm2(sub2(next, a));
    const pa = v2(-na.y * w, na.x * w);
    const pb = v2(-nb.y * w, nb.x * w);
    const P = (q: Vec2): [number, number, number] => [q.x, heightAt(hf, q.x, q.y) + offset, q.y];
    fb.face([P(v2(a.x - pa.x, a.y - pa.y)), P(v2(a.x + pa.x, a.y + pa.y)), P(v2(b.x + pb.x, b.y + pb.y)), P(v2(b.x - pb.x, b.y - pb.y))], [[0, i * 0.1], [1, i * 0.1], [1, (i + 1) * 0.1], [0, (i + 1) * 0.1]], color, [0, 1, 0]);
  }
  return fb.build();
}

/** Polygone plan (pavage, place) en éventail depuis son centre. */
export function flatPolygon(fb: FaceBuilder, poly: readonly Vec2[], y: number, color: Color, uvScale = 4): void {
  const c = centroid(poly);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Vec2;
    const b = poly[(i + 1) % poly.length] as Vec2;
    fb.face(
      [
        [c.x, y, c.y],
        [a.x, y, a.y],
        [b.x, y, b.y],
      ],
      [[c.x / uvScale, c.y / uvScale], [a.x / uvScale, a.y / uvScale], [b.x / uvScale, b.y / uvScale]],
      color,
      [0, 1, 0],
    );
  }
}

const mat4 = (x: number, y: number, z: number, ry = 0, s: [number, number, number] = [1, 1, 1]): Matrix4 => new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), ry), new Vector3(...s));

/** Pont de pierre : tablier, parapets, piles du lit au tablier, culées. */
export function addBridge(fb: FaceBuilder, br: Bridge, color: Color, hf: Heightfield | null): void {
  const ang = -br.angle;
  const c = Math.cos(br.angle);
  const s = Math.sin(br.angle);
  const at = (u: number, v: number): Vec2 => v2(br.at.x + u * c - v * s, br.at.y + u * s + v * c);
  const L = br.length;
  const deck = br.deck;
  const block = (p: Vec2, y: number, w: number, h: number, d: number, k: number): void => fb.geometry(new BoxGeometry(w, h, d), mat4(p.x, y, p.y, ang), color.clone().multiplyScalar(k));
  block(br.at, deck, L, 0.7, br.width, 1);
  for (const side of [-1, 1]) block(at(0, (side * br.width) / 2), deck + 0.75, L, 0.9, 0.35, 0.95);
  const nPiers = Math.max(1, Math.round(L / 9) - 1);
  for (let k = 1; k <= nPiers; k++) {
    const p = at(-L / 2 + (k * L) / (nPiers + 1), 0);
    const bottom = hf ? heightAt(hf, p.x, p.y) - 1 : deck - 4;
    const h = Math.max(0.5, deck - bottom);
    block(p, bottom + h / 2, 1.6, h, br.width, 0.9);
  }
  for (const e of [-1, 1]) {
    const p = at((e * L) / 2, 0);
    const bottom = hf ? heightAt(hf, p.x, p.y) - 0.5 : deck - 2;
    const h = Math.max(0.5, deck - bottom);
    block(p, bottom + h / 2, 3, h, br.width + 1, 0.92);
  }
}

export interface TerrainMeshOpts {
  groundMap: Texture | null;
  sol: string;
  /** Teinte de l'eau (déjà mêlée au profil). */
  water: string;
  bridgeColor: string;
  roadColor: string;
  /** Pavés (navigateur) : texture claire en niveaux de gris, teintée par le sommet. */
  paveMap: Texture | null;
}

export function buildTerrainMeshes(t: TerrainData, paving: readonly Paving[], canals: readonly Canal[], extraBridges: readonly Bridge[], o: TerrainMeshOpts): TerrainMeshes {
  const group = new Group();
  group.name = "terrain";
  const materials: Material[] = [];
  const hf = t.heights;
  const textured = o.groundMap !== null;
  const groundMat = new MeshStandardMaterial({ map: o.groundMap, vertexColors: true, roughness: 1 });
  materials.push(groundMat);
  const ground = new Mesh(groundGeometry(hf, textured ? new Color(1, 1, 1) : new Color(o.sol)), groundMat);
  ground.name = "sol";
  ground.receiveShadow = true;
  group.add(ground);

  // Eau.
  const waterMat = new MeshStandardMaterial({ color: new Color(o.water), roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.9, side: DoubleSide });
  materials.push(waterMat);
  const water: Mesh[] = [];
  const addWater = (g: BufferGeometry, name: string): void => {
    const m = new Mesh(g, waterMat);
    m.name = name;
    m.receiveShadow = true;
    group.add(m);
    water.push(m);
  };
  for (const r of t.rivers) addWater(ribbon(r.path, r.width / 2 + 1.2, (_, i) => r.level[Math.min(r.level.length - 1, i)] as number, new Color(1, 1, 1)), "riviere");
  for (const l of t.lakes) {
    const fb = new FaceBuilder();
    flatPolygon(fb, l.shape, l.level, new Color(1, 1, 1));
    addWater(fb.build(), "lac");
  }
  for (const c of canals) addWater(ribbon(c.path, c.width / 2, () => c.level, new Color(1, 1, 1)), "canal");
  const sheet = (level: number, name: string): void => {
    const g = new PlaneGeometry(t.spec.size * 3, t.spec.size * 3, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, level, 0);
    addWater(g, name);
  };
  if (t.seaLevel !== null) sheet(t.seaLevel, "mer");
  if (t.marshLevel !== null) sheet(t.marshLevel, "marais");

  // Routes de terre : rubans posés sur le relief (décalage de profondeur contre le scintillement).
  const roadMat = new MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  materials.push(roadMat);
  const roadColor = new Color(o.roadColor);
  for (const r of t.roads as Road[]) {
    const m = new Mesh(drapedRibbon(r.path, r.width / 2, hf, 0.12, roadColor.clone().multiplyScalar(r.kind === "route" ? 1 : 1.06)), roadMat);
    m.name = r.kind === "route" ? "route" : "chemin";
    m.receiveShadow = true;
    group.add(m);
  }

  // Pavages : rues pavées et dalles de cour (texture de pavés), terre battue (cours de ferme, jardins).
  const byKind = new Map<Paving["kind"], FaceBuilder>();
  for (const pv of paving) {
    const fb = byKind.get(pv.kind) ?? new FaceBuilder();
    byKind.set(pv.kind, fb);
    const k = pv.kind === "terre" ? 0.85 : pv.kind === "dalle" ? 1.08 : 1;
    flatPolygon(fb, pv.poly, pv.y, new Color(pv.color).multiplyScalar(k), pv.kind === "pave" ? 3 : 6);
  }
  for (const [kind, fb] of byKind) {
    const pm = new MeshStandardMaterial({ map: kind === "terre" ? null : o.paveMap, vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: kind === "dalle" ? -4 : -3, polygonOffsetUnits: kind === "dalle" ? -4 : -3 });
    materials.push(pm);
    const m = new Mesh(fb.build(), pm);
    m.name = `pavage-${kind}`;
    m.receiveShadow = true;
    group.add(m);
  }

  // Murs de quai des canaux : parement de pierre de part et d'autre, du lit au niveau des rues, avec margelle.
  if (canals.length > 0) {
    const fb = new FaceBuilder();
    const stone = new Color(o.bridgeColor);
    for (const c of canals) {
      for (const side of [-1, 1]) {
        for (let i = 0; i + 1 < c.path.length; i++) {
          const a = c.path[i] as Vec2;
          const b = c.path[i + 1] as Vec2;
          const d = norm2(sub2(b, a));
          const n = v2(-d.y * side, d.x * side);
          const pa = v2(a.x + (n.x * c.width) / 2 - d.x * 4, a.y + (n.y * c.width) / 2 - d.y * 4);
          const pb = v2(b.x + (n.x * c.width) / 2 + d.x * 4, b.y + (n.y * c.width) / 2 + d.y * 4);
          const L = Math.hypot(pb.x - pa.x, pb.y - pa.y);
          fb.face([[pa.x, c.level - 1.5, pa.y], [pb.x, c.level - 1.5, pb.y], [pb.x, 0.45, pb.y], [pa.x, 0.45, pa.y]], [[0, 0], [L / 3, 0], [L / 3, 1.2], [0, 1.2]], stone, [-n.x, 0, -n.y]);
          fb.face([[pa.x, 0.45, pa.y], [pb.x, 0.45, pb.y], [pb.x + n.x * 0.6, 0.45, pb.y + n.y * 0.6], [pa.x + n.x * 0.6, 0.45, pa.y + n.y * 0.6]], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]], stone.clone().multiplyScalar(1.1), [0, 1, 0]);
        }
      }
    }
    const qm = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: DoubleSide });
    materials.push(qm);
    const m = new Mesh(fb.build(), qm);
    m.name = "quais";
    m.receiveShadow = true;
    m.castShadow = true;
    group.add(m);
  }

  // Ponts.
  const bridges = [...t.bridges, ...extraBridges];
  if (bridges.length > 0) {
    const fb = new FaceBuilder();
    for (const br of bridges) addBridge(fb, br, new Color(o.bridgeColor), hf);
    const bm = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
    materials.push(bm);
    const m = new Mesh(fb.build(), bm);
    m.name = "ponts";
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  return {
    group,
    ground,
    water,
    materials,
    dispose() {
      group.traverse((x) => {
        if (x instanceof Mesh) (x.geometry as BufferGeometry).dispose();
      });
      for (const m of materials) m.dispose();
    },
  };
}

/** Teinte de l'eau : teinte de base de `materiaux.json`, mêlée à une teinte du profil (rôle choisi par le générateur). */
export function waterColor(profileHex: string, share = 0.35): string {
  return `#${new Color(MATERIALS.sols.eau.base).lerp(new Color(profileHex), share).getHexString()}`;
}
