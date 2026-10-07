import { BufferAttribute, BufferGeometry, ConeGeometry, DoubleSide, Group, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Points, PointsMaterial, Quaternion, Vector3 } from "three";
import type { Texture , Object3D} from "three";
import { derive, range, seeded } from "./rng";
import { buildSoldier } from "./soldier";
import type { SoldierLike, SoldierMaterials, SoldierPose } from "./soldier";
import type { Town } from "./town";

/**
 * Manœuvre tridimensionnelle de l'essai 3D (R1.5) : 20 soldats en 4 escouades de 5.
 * - Escouade 1 : en vol, balancés au bout d'un câble ancré en haut d'une façade (pendule : période 2π√(R/g)).
 * - Escouade 2 : accrochés, pieds contre un mur, câble tendu vers un ancrage plus haut.
 * - Escouade 3 : au sol, en garde, face au petit Titan ; l'un vient de tirer un câble sur une façade.
 * - Escouade 4 : en vol autour du grand Titan, câbles plantés dans ses épaules, vers la nuque.
 * Câbles droits (tendus) du lanceur à l'ancrage, crochet à l'ancrage ; traînées de gaz le long de la trajectoire passée.
 * R1e (§6, point 5) : la traînée est un filet fin et effilé (deux rubans croisés, de 0,2 m au lanceur à presque rien en queue),
 * qui pâlit et se disperse en vieillissant (dérive latérale croissante, fixe par soldat), avec quelques bouffées éparses ; plus
 * de « boudins » blancs.
 */
const G = 9.81;
const TRAIL = 28;
const TRAIL_DT = 0.07;
/** Largeur de la traînée au lanceur et en queue (m), dérive latérale maximale (m), opacité au lanceur. */
export const TRAIL_STYLE = { head: 0.2, tail: 0.03, drift: 0.9, alpha: 0.42 } as const;

/** Largeur et opacité de la traînée au rang k (0 au lanceur, TRAIL − 1 en queue). */
export function trailProfile(k: number): { width: number; alpha: number } {
  const u = k / (TRAIL - 1);
  return { width: TRAIL_STYLE.head + (TRAIL_STYLE.tail - TRAIL_STYLE.head) * Math.pow(u, 0.7), alpha: TRAIL_STYLE.alpha * Math.pow(1 - u, 1.6) };
}

interface Anchor {
  p: Vector3;
  /** Normale sortante du mur. */
  n: Vector3;
}

interface Unit {
  s: SoldierLike;
  squad: number;
  mode: SoldierPose;
  /** Point d'ancrage (fixe) ou fonction (ancrage sur un Titan qui bouge). */
  anchor: () => Vector3 | null;
  /** Position et orientation au temps t. */
  place(t: number): { pos: Vector3; up: Vector3; fwd: Vector3 };
  flying: boolean;
}

export interface OdmScene {
  group: Group;
  units: { soldier: SoldierLike; squad: number; mode: SoldierPose }[];
  squadCount: number;
  squadCenter(i: number): Vector3;
  /** Met à jour poses, positions, câbles et traînées ; `force` impose une pose à tous (planche, contrôles). */
  update(t: number, force: SoldierPose | null): void;
  /** Câbles après la dernière mise à jour : du lanceur à l'ancrage, et distance de l'ancrage au soldat. */
  cableSegments(): { unit: number; from: Vector3; to: Vector3; root: Vector3 }[];
  /** Points des traînées de gaz (après la dernière mise à jour), par soldat en vol. */
  trailPoints(): Vector3[][];
  /** R1e (§6, point 7) : pieds et tête de chaque soldat d'une escouade (après la dernière mise à jour). */
  squadPoints(i: number): Vector3[];
  dispose(): void;
}

/** Ancrages en haut des façades tournées vers un point (la place). */
function facadeAnchors(town: Town, toward: Vector3, maxDist: number): Anchor[] {
  const out: Anchor[] = [];
  for (const b of town.buildings) {
    const c = new Vector3(b.x, 0, b.y);
    if (c.distanceTo(toward) > maxDist) continue;
    const u = new Vector3(Math.cos(b.angle), 0, Math.sin(b.angle));
    const v = new Vector3(-u.z, 0, u.x);
    const wallTop = b.floors * b.floorHeight;
    for (const [n, half] of [
      [v.clone().negate(), b.depth / 2],
      [v.clone(), b.depth / 2],
      [u.clone(), b.width / 2],
      [u.clone().negate(), b.width / 2],
    ] as const) {
      const face = c.clone().addScaledVector(n, half);
      const toP = toward.clone().sub(face).setY(0).normalize();
      if (n.dot(toP) < 0.55) continue;
      out.push({ p: face.clone().addScaledVector(n, 0.05).setY(wallTop * 0.9), n });
    }
  }
  return out.sort((a, b) => a.p.distanceTo(toward) - b.p.distanceTo(toward));
}

const basis = (up: Vector3, fwd: Vector3): Quaternion => {
  const y = up.clone().normalize();
  const z = fwd.clone().sub(y.clone().multiplyScalar(fwd.dot(y)));
  if (z.lengthSq() < 1e-6) z.set(0, 0, 1).sub(y.clone().multiplyScalar(y.z));
  z.normalize();
  const x = new Vector3().crossVectors(y, z).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
};

export function buildOdm(town: Town, seed: number, mats: SoldierMaterials, puff: Texture | null, opts: { plaza: Vector3; market: Vector3; titanLarge: Object3D; titanSmall: Vector3; largeShoulders: [Object3D, Object3D]; makeSoldier?: (seed: number) => SoldierLike }): OdmScene {
  const rand = seeded(derive(seed, 900));
  const group = new Group();
  group.name = "odm";
  const units: Unit[] = [];
  const mid = opts.plaza.clone().lerp(opts.market, 0.5);
  const anchors = facadeAnchors(town, mid, 70);
  const up = new Vector3(0, 1, 0);
  let k = 0;
  const nextAnchor = (): Anchor => {
    const a = anchors[k % Math.max(1, anchors.length)] ?? { p: mid.clone().setY(12), n: new Vector3(1, 0, 0) };
    k += 2;
    return a;
  };
  const make = (): SoldierLike => {
    const sd = derive(seed, 50 + units.length);
    const s = opts.makeSoldier ? opts.makeSoldier(sd) : buildSoldier(sd, mats);
    group.add(s.group);
    return s;
  };

  // Escouade 1 : pendules accrochés aux façades, balancés vers la place.
  for (let i = 0; i < 5; i++) {
    const a = nextAnchor();
    const R = Math.min(a.p.y - 2.5, range(rand, 9, 16));
    const dir = mid.clone().sub(a.p).setY(0).normalize();
    const side = new Vector3(-dir.z, 0, dir.x).multiplyScalar(range(rand, -0.25, 0.25));
    const d = dir.add(side).normalize();
    const w = Math.sqrt(G / R);
    const phase = rand() * 6;
    const center = range(rand, 0.45, 0.65);
    const amp = range(rand, 0.35, 0.55);
    const pos = (t: number): Vector3 => {
      const th = center + amp * Math.sin(w * t + phase);
      return a.p.clone().addScaledVector(d, R * Math.sin(th)).addScaledVector(up, -R * Math.cos(th));
    };
    units.push({
      s: make(),
      squad: 0,
      mode: "vol",
      anchor: () => a.p,
      flying: true,
      place: (t) => {
        const p = pos(t);
        const vel = pos(t + 0.05).sub(p);
        return { pos: p, up: a.p.clone().sub(p).normalize(), fwd: vel };
      },
    });
  }
  // Escouade 2 : accrochés aux murs, pieds contre la façade.
  for (let i = 0; i < 5; i++) {
    const a = nextAnchor();
    const drop = range(rand, 4, 7);
    const at = a.p.clone().addScaledVector(a.n, -0.05).setY(Math.max(2.5, a.p.y - drop));
    const lateral = new Vector3(-a.n.z, 0, a.n.x).multiplyScalar(range(rand, -1.5, 1.5));
    at.add(lateral);
    units.push({
      s: make(),
      squad: 1,
      mode: "accroche",
      anchor: () => a.p,
      flying: false,
      place: () => ({ pos: at.clone(), up: a.n.clone(), fwd: up.clone() }),
    });
  }
  // Escouade 3 : au sol, en garde face au petit Titan.
  for (let i = 0; i < 5; i++) {
    const ang = (i - 2) * 0.35;
    const toT = opts.titanSmall.clone().sub(opts.market).setY(0).normalize();
    const base = opts.titanSmall.clone().addScaledVector(toT, -range(rand, 9, 12));
    const lat = new Vector3(-toT.z, 0, toT.x);
    const p = base.addScaledVector(lat, Math.sin(ang) * 9).setY(0);
    // L'un d'eux vient de tirer un câble sur la façade la plus proche.
    const a = i === 2 ? ([...anchors].sort((x, y) => x.p.distanceTo(p) - y.p.distanceTo(p))[0] ?? null) : null;
    units.push({
      s: make(),
      squad: 2,
      mode: "sol",
      anchor: () => (a ? a.p : null),
      flying: false,
      place: () => ({ pos: p.clone(), up: up.clone(), fwd: opts.titanSmall.clone().sub(p).setY(0) }),
    });
  }
  // Escouade 4 : autour du grand Titan, câbles dans ses épaules ; ils passent derrière la nuque.
  for (let i = 0; i < 5; i++) {
    const shoulder = opts.largeShoulders[i % 2] as Object3D;
    const R = range(rand, 7, 11);
    const w = Math.sqrt(G / R);
    const phase = rand() * 6;
    const yaw = range(rand, -1.2, 1.2);
    const amp = range(rand, 0.6, 0.9);
    const anchorOf = (): Vector3 => shoulder.getWorldPosition(new Vector3());
    const pos = (t: number): Vector3 => {
      const a = anchorOf();
      const back = new Vector3(0, 0, -1).applyQuaternion(opts.titanLarge.quaternion);
      const d = back.applyAxisAngle(up, yaw);
      const th = 0.35 + amp * Math.sin(w * t + phase);
      // Ancrage trop bas (Titan abattu, épaules près du sol) : le soldat passe au-dessus du corps, jamais sous le sol.
      const below = a.y - R * 0.6 < 1;
      return a.addScaledVector(d, R * Math.sin(th)).addScaledVector(up, (below ? 1 : -1) * R * Math.cos(th) * 0.6);
    };
    units.push({
      s: make(),
      squad: 3,
      mode: "vol",
      anchor: anchorOf,
      flying: true,
      place: (t) => {
        const p = pos(t);
        const vel = pos(t + 0.05).sub(p);
        return { pos: p, up: anchorOf().sub(p).normalize(), fwd: vel };
      },
    });
  }

  // Câbles : un segment par soldat ancré ; crochets à l'ancrage.
  const cableGeo = new BufferGeometry();
  const cablePos = new Float32Array(units.length * 6);
  cableGeo.setAttribute("position", new BufferAttribute(cablePos, 3));
  const cables = new LineSegments(cableGeo, new LineBasicMaterial({ color: 0x3d4042 }));
  cables.name = "cables";
  cables.frustumCulled = false;
  group.add(cables);
  const hookGeo = new ConeGeometry(0.12, 0.35, 6);
  const hookMat = new MeshStandardMaterial({ color: 0x2b2d2e, metalness: 0.7, roughness: 0.4 });
  const hooks = new InstancedMesh(hookGeo, hookMat, units.length);
  hooks.name = "crochets";
  hooks.frustumCulled = false;
  group.add(hooks);
  // Traînées de gaz : axe de chaque traînée (pour les contrôles), rubans croisés effilés, bouffées éparses.
  const flyers = units.filter((u) => u.flying);
  const trailPos = new Float32Array(flyers.length * TRAIL * 3);
  // Deux rubans par traînée (horizontal et vertical), deux sommets par rang.
  const ribbonGeo = new BufferGeometry();
  const ribbonPos = new Float32Array(flyers.length * 2 * TRAIL * 2 * 3);
  const ribbonCol = new Float32Array(flyers.length * 2 * TRAIL * 2 * 4);
  const ribbonIdx: number[] = [];
  for (let f = 0; f < flyers.length; f++)
    for (let r = 0; r < 2; r++) {
      const base = (f * 2 + r) * TRAIL * 2;
      for (let k = 0; k + 1 < TRAIL; k++) {
        const a = base + k * 2;
        ribbonIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  ribbonGeo.setAttribute("position", new BufferAttribute(ribbonPos, 3));
  ribbonGeo.setAttribute("color", new BufferAttribute(ribbonCol, 4));
  ribbonGeo.setIndex(ribbonIdx);
  const trails = new Mesh(ribbonGeo, new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide }));
  trails.name = "gaz";
  trails.frustumCulled = false;
  group.add(trails);
  const PUFFS = 5;
  const puffGeo = new BufferGeometry();
  const puffPos = new Float32Array(flyers.length * PUFFS * 3);
  const puffCol = new Float32Array(flyers.length * PUFFS * 4);
  puffGeo.setAttribute("position", new BufferAttribute(puffPos, 3));
  puffGeo.setAttribute("color", new BufferAttribute(puffCol, 4));
  const puffs = new Points(puffGeo, new PointsMaterial({ map: puff, size: 0.55, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false }));
  puffs.name = "gaz-bouffees";
  puffs.frustumCulled = false;
  group.add(puffs);
  // Dérive fixe par soldat et par rang (pas d'aléa à l'image) : la traînée s'élargit et se défait en vieillissant.
  const driftRand = seeded(derive(seed, 990));
  const drift = flyers.map(() => Array.from({ length: TRAIL }, () => new Vector3(range(driftRand, -1, 1), range(driftRand, -0.6, 0.6), range(driftRand, -1, 1))));

  const m4 = new Matrix4();
  const tmp = new Vector3();
  const centers: Vector3[] = [0, 1, 2, 3].map(() => new Vector3());

  const scene: OdmScene = {
    group,
    units: units.map((u) => ({ soldier: u.s, squad: u.squad, mode: u.mode })),
    squadCount: 4,
    squadCenter: (i) => (centers[i] ?? centers[0] ?? new Vector3()).clone(),
    update(t, force) {
      for (const c of centers) c.set(0, 0, 0);
      const counts = [0, 0, 0, 0];
      units.forEach((u, i) => {
        const { pos, up: uUp, fwd } = u.place(t);
        u.s.group.position.copy(pos);
        u.s.group.quaternion.copy(basis(uUp, fwd));
        u.s.setPose(force ?? u.mode, t);
        (centers[u.squad] as Vector3).add(pos);
        counts[u.squad] = (counts[u.squad] ?? 0) + 1;
        const a = u.anchor();
        u.s.group.updateMatrixWorld(true);
        if (a) {
          u.s.launcher.getWorldPosition(tmp);
          cablePos.set([tmp.x, tmp.y, tmp.z, a.x, a.y, a.z], i * 6);
          const dir = a.clone().sub(tmp).normalize();
          m4.compose(a, new Quaternion().setFromUnitVectors(up, dir), new Vector3(1, 1, 1));
          hooks.setMatrixAt(i, m4);
        } else {
          cablePos.fill(0, i * 6, i * 6 + 6);
          hooks.setMatrixAt(i, m4.makeScale(0, 0, 0));
        }
      });
      centers.forEach((c, i) => c.multiplyScalar(1 / Math.max(1, counts[i] ?? 1)));
      const pts: Vector3[] = Array.from({ length: TRAIL }, () => new Vector3());
      const dir = new Vector3();
      const side = new Vector3();
      const vert = new Vector3();
      flyers.forEach((u, f) => {
        for (let k2 = 0; k2 < TRAIL; k2++) {
          const p = (pts[k2] as Vector3).copy(u.place(t - (k2 + 1) * TRAIL_DT).pos);
          p.y -= 0.4;
          const o = (f * TRAIL + k2) * 3;
          trailPos[o] = p.x;
          trailPos[o + 1] = p.y;
          trailPos[o + 2] = p.z;
          // Dispersion : le gaz dérive de plus en plus loin de la trajectoire.
          const age = k2 / (TRAIL - 1);
          p.addScaledVector((drift[f] as Vector3[])[k2] as Vector3, TRAIL_STYLE.drift * age * age);
        }
        for (let k2 = 0; k2 < TRAIL; k2++) {
          const p = pts[k2] as Vector3;
          dir.copy(pts[Math.min(TRAIL - 1, k2 + 1)] as Vector3).sub(pts[Math.max(0, k2 - 1)] as Vector3);
          if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0);
          dir.normalize();
          side.crossVectors(dir, up);
          if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
          side.normalize();
          vert.crossVectors(side, dir).normalize();
          const { width, alpha } = trailProfile(k2);
          for (let r = 0; r < 2; r++) {
            const off = r === 0 ? side : vert;
            const vi = ((f * 2 + r) * TRAIL + k2) * 2;
            ribbonPos.set([p.x + off.x * width * 0.5, p.y + off.y * width * 0.5, p.z + off.z * width * 0.5, p.x - off.x * width * 0.5, p.y - off.y * width * 0.5, p.z - off.z * width * 0.5], vi * 3);
            ribbonCol.set([0.9, 0.91, 0.92, alpha, 0.9, 0.91, 0.92, alpha], vi * 4);
          }
        }
        // Bouffées éparses, de plus en plus pâles, le long de la moitié arrière.
        for (let k = 0; k < PUFFS; k++) {
          const rank = Math.min(TRAIL - 1, 6 + k * 4);
          const p = pts[rank] as Vector3;
          puffPos.set([p.x, p.y, p.z], (f * PUFFS + k) * 3);
          puffCol.set([0.9, 0.9, 0.91, 0.16 * (1 - k / PUFFS)], (f * PUFFS + k) * 4);
        }
      });
      (cableGeo.getAttribute("position") as BufferAttribute).needsUpdate = true;
      (ribbonGeo.getAttribute("position") as BufferAttribute).needsUpdate = true;
      (ribbonGeo.getAttribute("color") as BufferAttribute).needsUpdate = true;
      (puffGeo.getAttribute("position") as BufferAttribute).needsUpdate = true;
      (puffGeo.getAttribute("color") as BufferAttribute).needsUpdate = true;
      ribbonGeo.computeBoundingSphere();
      hooks.instanceMatrix.needsUpdate = true;
    },
    cableSegments() {
      const out: { unit: number; from: Vector3; to: Vector3; root: Vector3 }[] = [];
      units.forEach((u, i) => {
        if (!u.anchor()) return;
        out.push({ unit: i, from: new Vector3().fromArray(cablePos, i * 6), to: new Vector3().fromArray(cablePos, i * 6 + 3), root: u.s.group.position.clone() });
      });
      return out;
    },
    squadPoints(i) {
      return units.filter((u) => u.squad === i).flatMap((u) => {
        const p = u.s.group.position.clone();
        return [p, new Vector3(0, 1.85, 0).applyQuaternion(u.s.group.quaternion).add(p)];
      });
    },
    trailPoints() {
      return flyers.map((_, f) => Array.from({ length: TRAIL }, (_2, k2) => new Vector3().fromArray(trailPos, (f * TRAIL + k2) * 3)));
    },
    dispose() {
      cableGeo.dispose();
      ribbonGeo.dispose();
      puffGeo.dispose();
      (puffs.material as PointsMaterial).dispose();
      hookGeo.dispose();
      hookMat.dispose();
      (cables.material as LineBasicMaterial).dispose();
      (trails.material as MeshBasicMaterial).dispose();
    },
  };
  return scene;
}

