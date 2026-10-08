import { CanvasTexture, Color, DodecahedronGeometry, Matrix4, Mesh, MeshStandardMaterial, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3 } from "three";
import type { Group, Texture } from "three";
import type { Place, RingProfile } from "../../../data/placeSchema";
import { seeded } from "../rng";
import { buildGate, gateMaterials, gateViews } from "./gates3d";
import type { GateMeshes } from "./gates3d";
import type { PlaceLayout } from "./layout";
import type { SceneView } from "./loadPlace";
import type { PlaceMaterials } from "./placeMaterials";
import { buildLandmarks } from "./landmarks3d";
import { buildRampart } from "./rampart3d";
import { scaleFigures } from "./scaleFigures";
import { ROOF_TILE_M, roofCoverTexture } from "./textures";
import { PAREMENT_SIZES, parementTextures } from "../parement";
import { FaceBuilder } from "../townMesh";
import { puffTexture } from "../textures";
import { createFires } from "../weather";

/**
 * Ouvrages construits à part (R1e) : portes (dans l'état du lieu), repères d'échelle (montrés seulement dans la vue
 * « échelle » de leur porte), bâtiments repères à constructeur propre (église, halle, caserne à cour, roue du moulin :
 * `landmarks3d`). Renvoie les identifiants des repères pris en charge, les vues ajoutées et un rappel de changement de vue.
 * Coordonnées de texture en mètres : parement (6,4 × 4,8 m), chêne (2 × 4 m), ardoise et tuile (3 m).
 */
export interface ExtrasResult {
  handled: Set<string>;
  views: Record<string, SceneView>;
  onView(view: string): void;
  dispose(): void;
}

/** Bois de chêne : planches à fil (niveaux clairs, teinte de sommet). */
function oakTexture(seed: number): Texture {
  const r = seeded(seed * 5 + 11);
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas 2D indisponible");
  g.fillStyle = "rgb(200,190,180)";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const v = 140 + r() * 90;
    g.strokeStyle = `rgba(${v},${v * 0.95},${v * 0.9},0.5)`;
    g.lineWidth = 0.6 + r() * 1.2;
    const x = r() * 256;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + (r() - 0.5) * 6, 80, x + (r() - 0.5) * 6, 170, x + (r() - 0.5) * 4, 256);
    g.stroke();
  }
  for (let k = 0; k < 6; k++) {
    g.fillStyle = "rgba(60,40,25,0.35)";
    g.beginPath();
    g.ellipse(r() * 256, r() * 256, 2 + r() * 3, 5 + r() * 6, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function placeExtras(scene: { place: Place; layout: PlaceLayout; ring: RingProfile | null; materials: PlaceMaterials; group: Group }, stateId: string, seed = 845): ExtrasResult {
  const { place, ring, group } = scene;
  const views: Record<string, SceneView> = {};
  const disposers: (() => void)[] = [];
  const scaleGroups = new Map<string, Group>();
  const state = place.etats.find((s) => s.id === stateId) ?? place.etats[0];
  const custom = place.batiments.some((b) => ["eglise", "halle", "caserne", "moulin"].includes(b.archetype));
  const gates = ring !== null && place.enceinte !== null && (place.portes.length > 0 || place.enceinte.escaliers.length > 0 || place.enceinte.canons.espacement_m > 0);
  let handled = new Set<string>();
  if (gates || custom) {
    const par = parementTextures(seed);
    par.A.repeat.set(1 / PAREMENT_SIZES.A[0], 1 / PAREMENT_SIZES.A[1]);
    const oak = oakTexture(seed);
    oak.repeat.set(1 / 2, 1 / 4);
    const slate = roofCoverTexture("ardoise", seed);
    slate.repeat.set(1 / ROOF_TILE_M, 1 / ROOF_TILE_M);
    const tileTex = roofCoverTexture("tuile_plate", seed);
    tileTex.repeat.set(1 / ROOF_TILE_M, 1 / ROOF_TILE_M);
    const mats = gateMaterials(par.A, oak, slate);
    const tile = new MeshStandardMaterial({ map: tileTex, vertexColors: true, roughness: 0.72 });
    disposers.push(() => {
      mats.dispose();
      tile.dispose();
      for (const t of [par.A, par.B, par.C, oak, slate, tileTex]) t.dispose();
    });
    if (custom) {
      const lm = buildLandmarks(scene.layout.landmarks, { ...mats, tile }, -1.7, seed);
      group.add(lm.group);
      handled = lm.handled;
      disposers.push(() => lm.dispose());
    }
    // Canons et escaliers du rempart (consigne §5).
    if (ring && place.enceinte) {
      const rp = buildRampart(place, ring, mats.stone);
      group.add(rp.group);
      disposers.push(() => rp.dispose());
    }
    for (const g of gates && place.enceinte && ring ? place.portes : []) {
      const t = place.enceinte?.traces.find((x) => x.id === g.trace);
      if (!t || !ring) continue;
      const gm: GateMeshes = buildGate(g, t, { state: state?.portes[g.id] ?? g.etat, ring }, mats);
      group.add(gm.group);
      disposers.push(() => gm.dispose());
      Object.assign(views, gateViews(g, gm.frame));
      // Repères d'échelle devant la face extérieure (cachés hors de la vue « échelle »).
      const fr = gm.frame;
      const at: [number, number, number] = [fr.p[0] + fr.out[0] * fr.ext, 0, fr.p[1] + fr.out[1] * fr.ext];
      const sf = scaleFigures(at, fr.d, fr.out);
      sf.group.visible = false;
      group.add(sf.group);
      scaleGroups.set(`porte-${g.id}-echelle`, sf.group);
      disposers.push(() => sf.dispose());
    }
  }
  // État du lieu : rochers projetés (845 : sur la maison des Jaeger, [C]) et incendies (flammes et fumée, image figée).
  if (state && state.rochers.length > 0) {
    const fb = new FaceBuilder();
    const g = new DodecahedronGeometry(1, 1);
    const r = seeded(seed * 13 + 5);
    for (const rk of state.rochers) {
      for (let k = 0; k < 3; k++) {
        const s = rk.rayon_m * (k === 0 ? 1 : 0.35 + 0.2 * r());
        const off = k === 0 ? [0, 0] : [(r() - 0.5) * rk.rayon_m * 2.4, (r() - 0.5) * rk.rayon_m * 2.4];
        const m = new Matrix4().compose(new Vector3(rk.position[0] + (off[0] as number), s * 0.62, rk.position[1] + (off[1] as number)), new Quaternion().setFromAxisAngle(new Vector3(r(), 1, r()).normalize(), r() * 6), new Vector3(s * (1 + 0.25 * r()), s * (0.8 + 0.2 * r()), s));
        fb.geometry(g, m, new Color(0xa49d92).multiplyScalar(0.8 + 0.2 * r()));
      }
    }
    g.dispose();
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    const mesh = new Mesh(fb.build(), mat);
    mesh.name = "rochers";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    disposers.push(() => {
      mesh.geometry.dispose();
      mat.dispose();
    });
  }
  if (state && state.incendies.length > 0) {
    const puff = puffTexture();
    const fires = createFires(group, state.incendies.map((p) => ({ x: p[0], y: 0.5, z: p[1], size: 7 })), { lights: 3, puff, seed });
    fires.update(1.5);
    disposers.push(() => {
      fires.dispose();
      puff.dispose();
    });
  }
  return {
    handled,
    views,
    onView(view) {
      for (const [k, g] of scaleGroups) g.visible = k === view;
    },
    dispose() {
      for (const d of disposers) d();
    },
  };
}
