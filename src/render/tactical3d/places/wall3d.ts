import { BufferAttribute, BufferGeometry } from "three";
import type { Gate, Place, RingProfile, WallTrace } from "../../../data/placeSchema";
import { sampleTrace, traceLength, wallFrameAt, wallSection } from "./walls";
import type { WallSection } from "./walls";

/**
 * Corps des murailles d'un lieu (R1e, consigne §3.1) : la coupe de `_murs.json` balayée le long de chaque tracé (talus, faces à
 * fruit, chemin de ronde, parapet, bordure intérieure), tous les 6 m au plus. Les portes laissent un passage (ouverture de leur
 * largeur et de leur hauteur, voûte au-dessus) ; leur ouvrage est construit à part (`gates3d.ts`).
 * Coordonnées de texture en mètres : u le long du mur (abscisse du tracé), v le long du profil (hauteur développée) ; attribut
 * `wz` : altitude (m), `wn` : 0 face extérieure, 1 dessus, 2 face intérieure (pour le parement, `wallMaterial.ts`).
 */
export type ProfilePt = [number, number, number];

/** Profil fermé de la coupe : (n, z, face) de l'intérieur au pied jusqu'à l'extérieur au pied. */
export function wallProfile(s: WallSection): ProfilePt[] {
  const curb = 0.5;
  return [
    [s.intFoot, 0, 2],
    [s.intTop, s.H, 2],
    [s.intTop, s.H + curb, 1],
    [s.intTop + curb, s.H + curb, 1],
    [s.intTop + curb, s.H, 1],
    [s.extTop - s.parapet.t, s.H, 1],
    [s.extTop - s.parapet.t, s.H + s.parapet.h, 1],
    [s.extTop, s.H + s.parapet.h, 0],
    [s.extTop, s.H, 0],
    [s.extAt(s.talus.h), s.talus.h, 0],
    [s.extFoot + s.talus.out, 0, 0],
  ];
}

interface Acc {
  pos: number[];
  nor: number[];
  uv: number[];
  wz: number[];
  wn: number[];
}

function pushTri(acc: Acc, v: [number, number, number][], uv: [number, number][], face: number): void {
  const [a, b, c] = v as [[number, number, number], [number, number, number], [number, number, number]];
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
  const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const l = Math.hypot(...n) || 1;
  for (let k = 0; k < 3; k++) {
    const p = v[k] as [number, number, number];
    acc.pos.push(...p);
    acc.nor.push((n[0] as number) / l, (n[1] as number) / l, (n[2] as number) / l);
    acc.uv.push(...(uv[k] as [number, number]));
    acc.wz.push(p[1]);
    acc.wn.push(face);
  }
}

/** Quadrilatère a b c d ; `flip` inverse le sens (tracé parcouru dans l'autre sens par rapport à son côté extérieur). */
function quad(acc: Acc, v: [number, number, number][], uv: [number, number][], face: number, flip: boolean): void {
  const o = flip ? [0, 3, 2, 1] : [0, 1, 2, 3];
  const V = o.map((i) => v[i]) as [number, number, number][];
  const U = o.map((i) => uv[i]) as [number, number][];
  pushTri(acc, [V[0], V[1], V[2]] as [number, number, number][], [U[0], U[1], U[2]] as [number, number][], face);
  pushTri(acc, [V[0], V[2], V[3]] as [number, number, number][], [U[0], U[2], U[3]] as [number, number][], face);
}

/** Intervalles d'abscisse ouverts par les portes d'un tracé : [s0, s1, hauteur du passage]. */
export function gateCuts(gates: readonly Gate[], traceId: string): [number, number, number][] {
  return gates.filter((g) => g.trace === traceId).map((g) => [g.s_m - g.passage.largeur_m / 2, g.s_m + g.passage.largeur_m / 2, g.passage.hauteur_m] as [number, number, number]);
}

export function buildWallGeometry(place: Place, ring: RingProfile, extraCuts: (t: WallTrace) => [number, number, number][] = () => []): BufferGeometry | null {
  const enc = place.enceinte;
  if (!enc) return null;
  const sec = wallSection(ring);
  const prof = wallProfile(sec);
  // Longueur développée du profil jusqu'à chaque point (v de texture).
  const vAt: number[] = [0];
  for (let i = 1; i < prof.length; i++) {
    const a = prof[i - 1] as ProfilePt;
    const b = prof[i] as ProfilePt;
    vAt.push((vAt[i - 1] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const acc: Acc = { pos: [], nor: [], uv: [], wz: [], wn: [] };
  for (const t of enc.traces) {
    const L = traceLength(t);
    const cuts = [...gateCuts(place.portes, t.id), ...extraCuts(t)].sort((a, b) => a[0] - b[0]);
    // Points d'échantillonnage : réguliers, plus les bords des ouvertures.
    const ss = new Set<number>(sampleTrace(t, 6).map((x) => x.s));
    for (const [a, b] of cuts) {
      ss.add(Math.max(0, a));
      ss.add(Math.min(L, b));
    }
    const xs = [...ss].filter((s) => s >= 0 && s <= L).sort((a, b) => a - b);
    // Sens des faces : (direction × verticale) doit pointer vers l'intérieur (côté ville) ; sinon on inverse.
    const f0 = wallFrameAt(t, Math.min(1, L / 2));
    const flip = -f0.d[1] * f0.out[0] + f0.d[0] * f0.out[1] > 0;
    const W = (s: number, n: number, z: number): [number, number, number] => {
      const f = wallFrameAt(t, s);
      return [f.p[0] + f.out[0] * n, z, f.p[1] + f.out[1] * n];
    };
    for (let i = 0; i + 1 < xs.length; i++) {
      const s0 = xs[i] as number;
      const s1 = xs[i + 1] as number;
      if (s1 - s0 < 0.01) continue;
      const mid = (s0 + s1) / 2;
      const cut = cuts.find(([a, b]) => mid > a && mid < b);
      const hClip = cut ? cut[2] : 0;
      for (let k = 0; k + 1 < prof.length; k++) {
        let a = prof[k] as ProfilePt;
        let b = prof[k + 1] as ProfilePt;
        let va = vAt[k] as number;
        let vb = vAt[k + 1] as number;
        if (hClip > 0) {
          // Au droit d'une porte : le profil est coupé sous la voûte (seule la partie au-dessus du passage reste).
          if (a[1] < hClip && b[1] < hClip) continue;
          const clip = (p: ProfilePt, q: ProfilePt, vp: number, vq: number): [ProfilePt, number] => {
            const r = (hClip - p[1]) / (q[1] - p[1]);
            return [[p[0] + (q[0] - p[0]) * r, hClip, p[2]], vp + (vq - vp) * r];
          };
          if (a[1] < hClip) [a, va] = clip(a, b, va, vb);
          else if (b[1] < hClip) [b, vb] = clip(b, a, vb, va);
        }
        quad(acc, [W(s0, a[0], a[1]), W(s1, a[0], a[1]), W(s1, b[0], b[1]), W(s0, b[0], b[1])], [[s0, va], [s1, va], [s1, vb], [s0, vb]], a[2], flip);
      }
      if (hClip > 0) {
        // Intrados plat du passage (la voûte de l'ouvrage le recouvre).
        quad(acc, [W(s0, sec.extAt(hClip), hClip), W(s1, sec.extAt(hClip), hClip), W(s1, sec.intAt(hClip), hClip), W(s0, sec.intAt(hClip), hClip)], [[s0, 0], [s1, 0], [s1, sec.base], [s0, sec.base]], 1, flip);
      }
    }
    // Tableaux des ouvertures (joues verticales du passage).
    for (const [a, b, h] of cuts) {
      for (const [s, sign] of [
        [a, 1],
        [b, -1],
      ] as const) {
        const pts: [number, number, number][] = [W(s, sec.extFoot + sec.talus.out, 0), W(s, sec.intFoot, 0), W(s, sec.intAt(h), h), W(s, sec.extAt(h), h)];
        // Joue au début de l'ouverture : face vers +direction ; à la fin, vers −direction.
        quad(acc, pts, [[0, 0], [sec.base, 0], [sec.base, h], [0, h]], 1, sign > 0 ? !flip : flip);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(acc.pos), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(acc.nor), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(acc.uv), 2));
  g.setAttribute("wz", new BufferAttribute(new Float32Array(acc.wz), 1));
  g.setAttribute("wn", new BufferAttribute(new Float32Array(acc.wn), 1));
  g.computeBoundingSphere();
  return g;
}
