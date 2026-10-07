import { BoxGeometry, Color, DodecahedronGeometry, IcosahedronGeometry, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import type { Texture } from "three";
import { gateSize } from "./envTypes";
import type { WallLayout, WallPath } from "./envTypes";
import { wallFrame } from "./envWall";
import { pathLength, v2 } from "./geom2";
import type { Vec2 } from "./geom2";
import { phys } from "./meshProps";
import { derive, range, seeded } from "./rng";
import { FaceBuilder } from "./townMesh";
import { normalOf } from "./texturesEnv";
import { PHOTO_MATIERES, tagPhoto } from "./photoTextures";

/**
 * Maillage des murs de R1b (R1b.4) : corps de 50 m (C), parement de pierre à joints (texture), chemin de ronde avec parapet
 * côté extérieur et deux rails continus, porte massive dans un passage voûté (ouverte, fermée, brisée, scellée, percée),
 * brèches aux bords en gradins avec éboulis. Les canons sont des accessoires posés sur les rails (`envWall.cannonsAlong`).
 */
type V3 = [number, number, number];

export interface WallMeshes {
  meshes: Mesh[];
  dispose(): void;
}

interface Span {
  s0: number;
  s1: number;
  kind: "mur" | "porte" | "breche";
  gate?: WallPath["gates"][number];
}

function spans(w: WallPath, L: number, gateWidth: (g: WallPath["gates"][number]) => number, step = 8): Span[] {
  const cuts = new Set<number>([0, L]);
  for (let s = step; s < L; s += step) cuts.add(s);
  for (const g of w.gates) {
    cuts.add(g.s - gateWidth(g) / 2);
    cuts.add(g.s + gateWidth(g) / 2);
  }
  for (const b of w.breaches) {
    cuts.add(b.s - b.width / 2);
    cuts.add(b.s + b.width / 2);
  }
  const xs = [...cuts].filter((s) => s >= 0 && s <= L).sort((a, b) => a - b);
  const out: Span[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const s0 = xs[i] as number;
    const s1 = xs[i + 1] as number;
    if (s1 - s0 < 0.05) continue;
    const mid = (s0 + s1) / 2;
    const gate = w.gates.find((g) => Math.abs(mid - g.s) < gateWidth(g) / 2);
    const breach = w.breaches.find((b) => Math.abs(mid - b.s) < b.width / 2);
    out.push({ s0, s1, kind: breach ? "breche" : gate ? "porte" : "mur", gate });
  }
  return out;
}

const m4 = (p: V3, ry: number, s: V3): Matrix4 => new Matrix4().compose(new Vector3(...p), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), ry), new Vector3(...s));

export function buildWallMeshes(layout: WallLayout, ground: (p: Vec2) => number, stoneMap: Texture | null, seed: number): WallMeshes {
  const rand = seeded(derive(seed, 3000));
  const body = new FaceBuilder();
  const trim = new FaceBuilder();
  const iron = new FaceBuilder();
  const wood = new FaceBuilder();
  const mass = new FaceBuilder();
  const T = layout.thickness;
  const H = layout.height;
  const tint = new Color(layout.tint);
  const walk = tint.clone().multiplyScalar(0.86);
  const [bu, bv] = [layout.block[0] * 4, layout.block[1] * 4];
  const uvA = (s: number, y: number): [number, number] => [s / bu, y / bv];
  for (const w of layout.paths) {
    const L = pathLength(w.path);
    const at = (s: number, off: number, y: number): V3 => {
      const f = wallFrame(w, s);
      return [f.p.x + f.out.x * off, y, f.p.y + f.out.y * off];
    };
    const g = (s: number): number => ground(wallFrame(w, s).p);
    const outN = (s: number, k = 1): V3 => {
      const f = wallFrame(w, s);
      return [f.out.x * k, 0, f.out.y * k];
    };
    const dirN = (s: number, k: number): V3 => {
      const f = wallFrame(w, s);
      return [f.dir.x * k, 0, f.dir.y * k];
    };
    const sp = spans(w, L, (gg) => gateSize(layout, gg).w);
    for (let i = 0; i < sp.length; i++) {
      const { s0, s1, kind, gate: spanGate } = sp[i] as Span;
      // Hauteur de l'ouverture : porte massive ou porte de rivière (R1c).
      const openH = spanGate ? gateSize(layout, spanGate).h : layout.gateHeight;
      const g0 = g(s0);
      const g1 = g(s1);
      const top0 = g0 + H;
      const top1 = g1 + H;
      if (kind === "breche") {
        // Brèche haute : le mur reste debout jusqu'à `floor`, arasé en haut ; brèche totale : rien.
        const br = w.breaches.find((b) => Math.abs((s0 + s1) / 2 - b.s) < b.width / 2);
        const fl = br?.floor ?? 0;
        if (fl > 0) {
          for (const side of [1, -1]) body.face([at(s0, (side * T) / 2, g0 - 3), at(s1, (side * T) / 2, g1 - 3), at(s1, (side * T) / 2, g1 + fl), at(s0, (side * T) / 2, g0 + fl)], [uvA(s0, 0), uvA(s1, 0), uvA(s1, fl + 3), uvA(s0, fl + 3)], tint, outN((s0 + s1) / 2, side));
          body.face([at(s0, T / 2, g0 + fl), at(s1, T / 2, g1 + fl), at(s1, -T / 2, g1 + fl), at(s0, -T / 2, g0 + fl)], [uvA(s0, 0), uvA(s1, 0), uvA(s1, T), uvA(s0, T)], tint.clone().multiplyScalar(0.8), [0, 1, 0]);
        }
        continue;
      }
      const bottom = kind === "porte" ? openH : -3;
      // Parements extérieur (+T/2) et intérieur (−T/2).
      for (const side of [1, -1]) {
        const y0a = side === 1 ? g0 + bottom : g0 + bottom;
        const y0b = g1 + bottom;
        body.face([at(s0, (side * T) / 2, y0a), at(s1, (side * T) / 2, y0b), at(s1, (side * T) / 2, top1), at(s0, (side * T) / 2, top0)], [uvA(s0, bottom + 3), uvA(s1, bottom + 3), uvA(s1, H + 3), uvA(s0, H + 3)], tint, outN((s0 + s1) / 2, side));
      }
      // Chemin de ronde.
      body.face([at(s0, T / 2, top0), at(s1, T / 2, top1), at(s1, -T / 2, top1), at(s0, -T / 2, top0)], [uvA(s0, 0), uvA(s1, 0), uvA(s1, T), uvA(s0, T)], walk, [0, 1, 0]);
      // Parapet côté extérieur, bordure basse côté intérieur.
      const pa = layout.parapet;
      body.face([at(s0, T / 2, top0), at(s1, T / 2, top1), at(s1, T / 2, top1 + pa), at(s0, T / 2, top0 + pa)], [uvA(s0, H + 3), uvA(s1, H + 3), uvA(s1, H + 3 + pa), uvA(s0, H + 3 + pa)], tint, outN((s0 + s1) / 2, 1));
      body.face([at(s0, T / 2 - 0.7, top0), at(s1, T / 2 - 0.7, top1), at(s1, T / 2 - 0.7, top1 + pa), at(s0, T / 2 - 0.7, top0 + pa)], [uvA(s0, 0), uvA(s1, 0), uvA(s1, pa), uvA(s0, pa)], walk, outN((s0 + s1) / 2, -1));
      trim.face([at(s0, T / 2, top0 + pa), at(s1, T / 2, top1 + pa), at(s1, T / 2 - 0.7, top1 + pa), at(s0, T / 2 - 0.7, top0 + pa)], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]], tint.clone().multiplyScalar(1.08), [0, 1, 0]);
      body.face([at(s0, -T / 2, top0), at(s1, -T / 2, top1), at(s1, -T / 2, top1 + 0.45), at(s0, -T / 2, top0 + 0.45)], [uvA(s0, H + 3), uvA(s1, H + 3), uvA(s1, H + 3.45), uvA(s0, H + 3.45)], tint, outN((s0 + s1) / 2, -1));
      // Rails continus du chemin de ronde.
      for (const r of [-layout.railGauge / 2, layout.railGauge / 2]) {
        for (const [o0, o1, y] of [
          [r - 0.08, r + 0.08, 0.16],
        ] as const) {
          iron.face([at(s0, o0, top0 + y), at(s1, o0, top1 + y), at(s1, o1, top1 + y), at(s0, o1, top0 + y)], [[0, 0], [1, 0], [1, 1], [0, 1]], phys("fer"), [0, 1, 0]);
          iron.face([at(s0, o1, top0), at(s1, o1, top1), at(s1, o1, top1 + y), at(s0, o1, top0 + y)], [[0, 0], [1, 0], [1, 1], [0, 1]], phys("fer"), outN((s0 + s1) / 2, 1));
        }
      }
      // Bords de passage et de brèche : faces en travers du mur.
      const prev = sp[i - 1];
      const next = sp[i + 1];
      for (const [s, nb, sign] of [
        [s0, prev, -1],
        [s1, next, 1],
      ] as const) {
        if (!nb || nb.kind === kind) continue;
        if (kind === "mur" && (nb.kind === "porte" || nb.kind === "breche")) {
          const gs = g(s);
          const yTop = nb.kind === "porte" && nb.gate ? gs + gateSize(layout, nb.gate).h : gs + H;
          const fl = nb.kind === "breche" ? (w.breaches.find((b) => Math.abs((nb.s0 + nb.s1) / 2 - b.s) < b.width / 2)?.floor ?? 0) : 0;
          const yBot = gs + (fl > 0 ? fl : -3);
          body.face([at(s, T / 2, yBot), at(s, -T / 2, yBot), at(s, -T / 2, yTop), at(s, T / 2, yTop)], [uvA(0, 0), uvA(T, 0), uvA(T, yTop - yBot), uvA(0, yTop - yBot)], tint.clone().multiplyScalar(0.92), dirN(s, sign));
          if (nb.kind === "breche") {
            // Gradins de blocs arrachés sur le bord de la brèche.
            for (let k = 0; k < 9; k++) {
              const y = gs + range(rand, Math.max(4, fl), H - 4);
              const c = at(s + sign * range(rand, 0.5, 3), range(rand, -T / 2, T / 2), y);
              body.geometry(new BoxGeometry(range(rand, 2, 4.5), range(rand, 1.2, 2.6), range(rand, 2, 4)), m4(c, range(rand, 0, 1), [1, 1, 1]), tint.clone().multiplyScalar(range(rand, 0.85, 1)));
            }
          }
        }
      }
      if (kind === "porte") {
        const gs = g(s0);
        body.face([at(s0, T / 2, gs + openH), at(s1, T / 2, gs + openH), at(s1, -T / 2, gs + openH), at(s0, -T / 2, gs + openH)], [[0, 0], [1, 0], [1, 1], [0, 1]], tint.clone().multiplyScalar(0.7), [0, -1, 0]);
      }
    }
    // Portes : encadrement saillant sur les deux faces, vantaux, ou masse durcie.
    for (const gate of w.gates) {
      const f = wallFrame(w, gate.s);
      const gs = ground(f.p);
      const ang = -Math.atan2(f.dir.y, f.dir.x);
      const { w: gw, h: gh } = gateSize(layout, gate);
      for (const side of [1, -1]) {
        const c = (u: number, off: number, y: number): V3 => [f.p.x + f.dir.x * u + f.out.x * off * side, gs + y, f.p.y + f.dir.y * u + f.out.y * off * side];
        for (const u of [-(gw / 2 + 1.8), gw / 2 + 1.8]) trim.geometry(new BoxGeometry(3.4, gh + 6, 1.4), m4(c(u, T / 2 + 0.6, (gh + 6) / 2), ang, [1, 1, 1]), tint.clone().multiplyScalar(0.94));
        trim.geometry(new BoxGeometry(gw + 7, 2.4, 1.6), m4(c(0, T / 2 + 0.7, gh + 4.6), ang, [1, 1, 1]), tint.clone().multiplyScalar(0.98));
        trim.geometry(new BoxGeometry(gw + 9, 1, 2), m4(c(0, T / 2 + 0.9, gh + 6.3), ang, [1, 1, 1]), tint.clone().multiplyScalar(1.04));
      }
      const mid: V3 = [f.p.x, gs + gh / 2, f.p.y];
      if (gate.kind === "eau") {
        // Porte de rivière : herse de fer, levée (le bas des barreaux dépasse sous l'arche) ou baissée jusqu'à l'eau.
        const down = gate.state === "fermee" ? gh : gh * 0.22;
        for (let k = 0; k <= 8; k++) iron.geometry(new BoxGeometry(0.28, down, 0.28), m4([f.p.x + f.dir.x * (-gw / 2 + (k * gw) / 8), gs + gh - down / 2, f.p.y + f.dir.y * (-gw / 2 + (k * gw) / 8)], ang, [1, 1, 1]), phys("fer"));
        for (let y = gh - 0.6; y > gh - down; y -= 2.2) iron.geometry(new BoxGeometry(gw, 0.25, 0.3), m4([f.p.x, gs + y, f.p.y], ang, [1, 1, 1]), phys("fer"));
      } else if (gate.state === "rocher") {
        // Rocher qui bouche la brèche de la porte (Trost, 850) : bloc de roche irrégulier, plus large que la porte (forme générique).
        const r = gw * 0.95;
        body.geometry(new DodecahedronGeometry(1, 1), m4([f.p.x + f.out.x * 2, gs + gh * 0.55, f.p.y + f.out.y * 2], 0.7, [r, gh * 0.75, T * 1.15]), tint.clone().multiplyScalar(0.72));
        for (let k = 0; k < 10; k++) {
          const u = range(rand, -gw, gw);
          const off = range(rand, -T, T);
          const q = range(rand, 1.5, 3.5);
          body.geometry(new DodecahedronGeometry(1, 0), m4([f.p.x + f.dir.x * u + f.out.x * off, gs + q * 0.5, f.p.y + f.dir.y * u + f.out.y * off], range(rand, 0, 6), [q * 1.3, q * 0.7, q]), tint.clone().multiplyScalar(range(rand, 0.65, 0.85)));
        }
      } else if (gate.state === "fermee") {
        wood.geometry(new BoxGeometry(gw - 0.4, gh - 0.2, 0.9), m4(mid, ang, [1, 1, 1]), phys("ecorce").multiplyScalar(1.4));
        for (let k = 1; k < 6; k++) iron.geometry(new BoxGeometry(gw - 0.2, 0.35, 1.05), m4([mid[0], gs + (k * gh) / 6, mid[2]], ang, [1, 1, 1]), phys("fer"));
      } else if (gate.state === "scellee" || gate.state === "passage") {
        // Masse durcie qui obstrue la porte (forme générique, sans design de l'œuvre), débordant sur les deux faces.
        for (let k = 0; k < 26; k++) {
          const u = range(rand, -gw / 2 - 3, gw / 2 + 3);
          const off = range(rand, -T / 2 - 4, T / 2 + 4);
          const y = range(rand, 0, gh + 8);
          const r = range(rand, 2.5, 6);
          mass.geometry(new IcosahedronGeometry(1, 0), m4([f.p.x + f.dir.x * u + f.out.x * off, gs + y, f.p.y + f.dir.y * u + f.out.y * off], range(rand, 0, 6), [r, r * range(rand, 0.8, 1.4), r]), phys("cristal").multiplyScalar(range(rand, 0.85, 1.05)));
        }
        if (gate.state === "passage") {
          for (const side of [1, -1]) {
            const c: V3 = [f.p.x + f.out.x * side * (T / 2 + 4.2), gs + 2.4, f.p.y + f.out.y * side * (T / 2 + 4.2)];
            iron.geometry(new BoxGeometry(4, 4.8, 0.3), m4(c, ang, [1, 1, 1]), phys("verre"));
          }
        }
      } else if (gate.state === "breche") {
        // Vantaux arrachés, couchés au sol devant la porte.
        for (const side of [1, -1]) {
          const c: V3 = [f.p.x + f.out.x * (T / 2 + 6) + f.dir.x * side * 4, gs + 0.5, f.p.y + f.out.y * (T / 2 + 6) + f.dir.y * side * 4];
          wood.geometry(new BoxGeometry(gw / 2, 0.9, gh * 0.8), m4(c, ang + side * 0.3, [1, 1, 1]), phys("ecorce").multiplyScalar(1.2));
        }
      }
    }
    // Brèches : éboulis de blocs qui débordent des deux côtés.
    for (const b of w.breaches) {
      const f = wallFrame(w, b.s);
      const gs = ground(f.p) + (b.floor ?? 0);
      for (let k = 0; k < (b.floor ? 18 : 70); k++) {
        const u = range(rand, -b.width / 2 - 4, b.width / 2 + 4);
        const off = range(rand, -T * 1.6, T * 1.6);
        const hgt = Math.max(0, (b.floor ? 3 : H * 0.28) * (1 - Math.abs(off) / (T * 1.7)) * (1 - (Math.abs(u) / (b.width / 2 + 6)) ** 2));
        const r = range(rand, 1.2, 3.4);
        body.geometry(new DodecahedronGeometry(1, 0), m4([f.p.x + f.dir.x * u + f.out.x * off, gs + hgt * range(rand, 0.3, 1), f.p.y + f.dir.y * u + f.out.y * off], range(rand, 0, 6), [r * 1.3, r * 0.8, r]), tint.clone().multiplyScalar(range(rand, 0.75, 0.95)));
      }
    }
  }
  const meshes: Mesh[] = [];
  const mk = (fb: FaceBuilder, mat: MeshStandardMaterial, name: string): void => {
    if (fb.pos.length === 0) return;
    const m = new Mesh(fb.build(), mat);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    meshes.push(m);
  };
  // R1d : parement en pierre de taille de Poly Haven après la première image. Une unité de texture = 4 × 4 blocs du profil
  // (`block`, `?` paramétrable) ; la photo y est posée une fois (elle montre environ quatre assises) : la taille des blocs reste
  // celle du profil, pas celle de la photo (2 m), qui ferait sur 50 m de mur une grille fine et répétée.
  const face = stoneMap ? tagPhoto(stoneMap.clone(), "pierre_taille", PHOTO_MATIERES.pierre_taille.taille) : null;
  if (face) face.needsUpdate = true;
  mk(body, new MeshStandardMaterial({ map: face, normalMap: normalOf(stoneMap, 2.2), vertexColors: true, roughness: 0.95 }), "mur-parement");
  mk(trim, new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), "mur-encadrements");
  mk(iron, new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.6 }), "mur-rails-et-ferrures");
  mk(wood, new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), "mur-vantaux");
  mk(mass, new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, flatShading: true }), "mur-masse-durcie");
  return {
    meshes,
    dispose() {
      for (const m of meshes) {
        m.geometry.dispose();
        (m.material as MeshStandardMaterial).dispose();
      }
    },
  };
}

export { v2 };
