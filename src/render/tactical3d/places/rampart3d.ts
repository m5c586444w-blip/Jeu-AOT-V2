import { Color, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import type { BufferGeometry, Material } from "three";
import type { Place, RingProfile } from "../../../data/placeSchema";
import { propGeometry } from "../meshProps";
import { FaceBuilder } from "../townMesh";
import { traceLength, wallFrameAt, wallSection } from "./walls";

/**
 * Ouvrages du rempart (R1e, consigne §5 : « escaliers de mur, canons de rempart ») :
 * - canons sur le chemin de ronde, au pas de `enceinte.canons.espacement_m`, tournés vers l'extérieur, sur une plate-forme
 *   qui les hisse au-dessus du parapet ; aucun à moins de 30 m d'une porte ;
 * - escaliers contre la face côté ville : volées droites en lacet (5 volées de 10 m de haut, 18 m de long, 3,5 m de large),
 *   marches de 25 cm, paliers, mur d'échiffre plein du côté de la ville.
 * Repère local d'un ouvrage : u le long du mur, n vers l'extérieur (0 = ligne médiane), y vers le haut.
 */
const STONE = new Color(0xcfc7b8);
const STEP = new Color(0xd9d2c4);

export interface RampartMeshes {
  group: Group;
  cannons: number;
  stairs: number;
  dispose(): void;
}

export function buildRampart(place: Place, ring: RingProfile, stone: Material): RampartMeshes {
  const group = new Group();
  group.name = "rempart";
  const enc = place.enceinte;
  const sec = wallSection(ring);
  const H = sec.H;
  let cannons = 0;
  let stairs = 0;
  const disposers: (() => void)[] = [];
  if (!enc) return { group, cannons, stairs, dispose: () => undefined };

  // ——— Canons ———
  const geo = propGeometry("canons");
  if (geo && enc.canons.espacement_m > 0) {
    const mats: Matrix4[] = [];
    for (const id of enc.canons.traces) {
      const t = enc.traces.find((x) => x.id === id);
      if (!t) continue;
      const L = traceLength(t);
      const gates = place.portes.filter((g) => g.trace === id).map((g) => g.s_m);
      for (let s = enc.canons.espacement_m / 2; s < L; s += enc.canons.espacement_m) {
        if (gates.some((gs) => Math.abs(gs - s) < 30)) continue;
        const f = wallFrameAt(t, s);
        const n = sec.extTop - sec.parapet.t - 2.2;
        const pos = new Vector3(f.p[0] + f.out[0] * n, H + 0.9, f.p[1] + f.out[1] * n);
        const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(f.out[0], f.out[1]));
        mats.push(new Matrix4().compose(pos, q, new Vector3(1.15, 1.15, 1.15)));
      }
    }
    if (mats.length > 0) {
      const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 });
      const inst = new InstancedMesh(geo, mat, mats.length);
      mats.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.instanceMatrix.needsUpdate = true;
      inst.name = "canons-du-rempart";
      inst.castShadow = true;
      inst.frustumCulled = false;
      group.add(inst);
      cannons = mats.length;
      // Plates-formes de pierre sous les canons (au niveau du parapet).
      const fb = new FaceBuilder();
      for (const m of mats) {
        const p = new Vector3();
        const q = new Quaternion();
        m.decompose(p, q, new Vector3());
        fb.geometry(boxGeo(), new Matrix4().compose(new Vector3(p.x, H + 0.45, p.z), q, new Vector3(2.6, 0.9, 3.6)), STONE);
      }
      const plat = new Mesh(fb.build(), stone);
      plat.name = "plates-formes-des-canons";
      plat.receiveShadow = true;
      group.add(plat);
      disposers.push(() => {
        mat.dispose();
        plat.geometry.dispose();
      });
    }
  }

  // ——— Escaliers ———
  const fb = new FaceBuilder();
  for (const e of enc.escaliers) {
    const t = enc.traces.find((x) => x.id === e.trace);
    if (!t) continue;
    const f = wallFrameAt(t, e.s_m);
    const W = (u: number, n: number, y: number): [number, number, number] => [f.p[0] + f.d[0] * u + f.out[0] * n, y, f.p[1] + f.d[1] * u + f.out[1] * n];
    const D = (u: number, n: number, y: number): [number, number, number] => [f.d[0] * u + f.out[0] * n, y, f.d[1] * u + f.out[1] * n];
    const quadBox = (u0: number, u1: number, n0: number, n1: number, y0: number, y1: number, c: Color): void => {
      const P = W;
      fb.face([P(u0, n0, y1), P(u1, n0, y1), P(u1, n1, y1), P(u0, n1, y1)], [[u0, n0], [u1, n0], [u1, n1], [u0, n1]], c, [0, 1, 0]);
      fb.face([P(u0, n0, y0), P(u1, n0, y0), P(u1, n0, y1), P(u0, n0, y1)], [[u0, y0], [u1, y0], [u1, y1], [u0, y1]], c, D(0, -1, 0));
      fb.face([P(u0, n1, y0), P(u1, n1, y0), P(u1, n1, y1), P(u0, n1, y1)], [[u0, y0], [u1, y0], [u1, y1], [u0, y1]], c, D(0, 1, 0));
      fb.face([P(u0, n0, y0), P(u0, n1, y0), P(u0, n1, y1), P(u0, n0, y1)], [[n0, y0], [n1, y0], [n1, y1], [n0, y1]], c, D(-1, 0, 0));
      fb.face([P(u1, n0, y0), P(u1, n1, y0), P(u1, n1, y1), P(u1, n0, y1)], [[n0, y0], [n1, y0], [n1, y1], [n0, y1]], c, D(1, 0, 0));
    };
    const nIn = sec.intFoot - 0.2;
    const nOut = nIn - 3.5;
    const flights = Math.round(H / 10);
    const rise = H / flights;
    const run = 18;
    for (let k = 0; k < flights; k++) {
      const dir = k % 2 === 0 ? 1 : -1;
      const uStart = -dir * (run / 2);
      const steps = Math.round(rise / 0.25);
      for (let i = 0; i < steps; i++) {
        const a = uStart + dir * (run * i) / steps;
        const b = uStart + dir * (run * (i + 1)) / steps;
        const top = k * rise + (i + 1) * (rise / steps);
        quadBox(Math.min(a, b), Math.max(a, b), nOut, nIn, top - 0.45, top, STEP);
      }
      // Palier en haut de la volée, puis mur d'échiffre côté ville (plein, du sol à la ligne des marches).
      const uEnd = dir * (run / 2);
      quadBox(Math.min(uEnd, uEnd + dir * 3.5), Math.max(uEnd, uEnd + dir * 3.5), nOut, nIn, (k + 1) * rise - 0.5, (k + 1) * rise, STEP);
      const y0 = k * rise;
      const y1 = (k + 1) * rise;
      const ua = uStart;
      const ub = uEnd;
      const nW = nOut - 0.7;
      fb.face([W(ua, nW, 0), W(ub, nW, 0), W(ub, nW, y1), W(ua, nW, y0)], [[ua, 0], [ub, 0], [ub, y1], [ua, y0]], STONE, D(0, -1, 0));
      fb.face([W(ua, nOut, y0), W(ub, nOut, y1), W(ub, nW, y1), W(ua, nW, y0)], [[ua, 0], [ub, 0], [ub, 0.7], [ua, 0.7]], STONE, [0, 1, 0]);
    }
    stairs++;
  }
  if (fb.pos.length > 0) {
    const mesh = new Mesh(fb.build(), stone);
    mesh.name = "escaliers-du-rempart";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    disposers.push(() => mesh.geometry.dispose());
  }
  return {
    group,
    cannons,
    stairs,
    dispose() {
      for (const d of disposers) d();
    },
  };
}

let unitBox: BufferGeometry | null = null;
function boxGeo(): BufferGeometry {
  if (!unitBox) {
    const fb = new FaceBuilder();
    const c = new Color(1, 1, 1);
    const P = (x: number, y: number, z: number): [number, number, number] => [x, y, z];
    const h = 0.5;
    fb.face([P(-h, h, -h), P(h, h, -h), P(h, h, h), P(-h, h, h)], [[0, 0], [1, 0], [1, 1], [0, 1]], c, [0, 1, 0]);
    fb.face([P(-h, -h, -h), P(h, -h, -h), P(h, h, -h), P(-h, h, -h)], [[0, 0], [1, 0], [1, 1], [0, 1]], c, [0, 0, -1]);
    fb.face([P(-h, -h, h), P(h, -h, h), P(h, h, h), P(-h, h, h)], [[0, 0], [1, 0], [1, 1], [0, 1]], c, [0, 0, 1]);
    fb.face([P(-h, -h, -h), P(-h, -h, h), P(-h, h, h), P(-h, h, -h)], [[0, 0], [1, 0], [1, 1], [0, 1]], c, [-1, 0, 0]);
    fb.face([P(h, -h, -h), P(h, -h, h), P(h, h, h), P(h, h, -h)], [[0, 0], [1, 0], [1, 1], [0, 1]], c, [1, 0, 0]);
    unitBox = fb.build();
  }
  return unitBox;
}
