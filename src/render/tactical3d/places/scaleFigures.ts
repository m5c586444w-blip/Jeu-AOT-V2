import { Color, CylinderGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from "three";
import { propGeometry } from "../meshProps";
import { buildSoldier, soldierMaterials } from "../soldier";
import { TITAN_LARGE, buildTitan } from "../titan";
import { FaceBuilder } from "../townMesh";

/**
 * Repères d'échelle d'une porte (consigne §3.2, vue « échelle ») : un soldat (1,8 m), un cheval (1,6 m au garrot), une
 * charrette, un Titan de 15 m. Figures du projet (R1 : soldat et Titan en volumes simples, cheval et charrette paramétriques) ;
 * aucun modèle externe.
 */
function horse(): Mesh {
  const fb = new FaceBuilder();
  const coat = new Color(0x6a4a32);
  const dark = new Color(0x2d2119);
  const m = (x: number, y: number, z: number, s: [number, number, number], rx = 0, rz = 0): Matrix4 =>
    new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rx).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rz)), new Vector3(...s));
  const sphere = new SphereGeometry(1, 12, 8);
  const leg = new CylinderGeometry(0.06, 0.08, 1, 6);
  // Corps (tronc ovale), encolure inclinée, tête, croupe, queue, quatre jambes ; 1,6 m au garrot.
  fb.geometry(sphere, m(0, 1.3, 0, [0.38, 0.4, 0.95]), coat);
  fb.geometry(sphere, m(0, 1.36, -0.55, [0.36, 0.38, 0.45]), coat);
  fb.geometry(new CylinderGeometry(0.16, 0.26, 0.9, 8), m(0, 1.78, 0.75, [1, 1, 1], 0.75), coat);
  fb.geometry(new CylinderGeometry(0.09, 0.14, 0.62, 8), m(0, 2.0, 1.15, [1, 1, 1], 1.75), coat);
  fb.geometry(sphere, m(0, 2.06, 1.02, [0.1, 0.12, 0.1]), dark);
  fb.geometry(new CylinderGeometry(0.05, 0.11, 0.8, 6), m(0, 1.15, -1.05, [1, 1, 1], -0.5), dark);
  for (const [x, z] of [
    [-0.2, 0.62],
    [0.2, 0.62],
    [-0.2, -0.6],
    [0.2, -0.6],
  ] as const) {
    fb.geometry(leg, m(x, 0.5, z, [1, 1.0, 1]), coat);
    fb.geometry(new CylinderGeometry(0.07, 0.07, 0.08, 6), m(x, 0.04, z, [1, 1, 1]), dark);
  }
  const mesh = new Mesh(fb.build(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  mesh.name = "cheval";
  mesh.castShadow = true;
  sphere.dispose();
  leg.dispose();
  return mesh;
}

/** Groupe de repères d'échelle posé devant une porte : `at` (monde), `face` (angle de la façade de la porte). */
export function scaleFigures(at: [number, number, number], along: [number, number], out: [number, number]): { group: Group; dispose(): void } {
  const group = new Group();
  group.name = "reperes-echelle";
  const P = (u: number, z: number): Vector3 => new Vector3(at[0] + along[0] * u + out[0] * z, at[1], at[2] + along[1] * u + out[1] * z);
  const face = Math.atan2(-out[0], -out[1]);
  const soldier = buildSoldier(7, soldierMaterials());
  soldier.setPose("sol", 0);
  soldier.group.position.copy(P(-3, 6));
  soldier.group.rotation.y = face;
  group.add(soldier.group);
  const h = horse();
  h.position.copy(P(2, 9));
  h.rotation.y = face + Math.PI / 2;
  group.add(h);
  const cartGeo = propGeometry("charrettes");
  if (cartGeo) {
    const cart = new Mesh(cartGeo, new MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.85, vertexColors: true }));
    cart.name = "charrette";
    cart.castShadow = true;
    cart.position.copy(P(5.5, 9.5));
    cart.rotation.y = face + Math.PI / 2;
    group.add(cart);
  }
  const titan = buildTitan(TITAN_LARGE, 850);
  titan.setPose("debout", 0);
  titan.group.position.copy(P(16, 24));
  titan.group.rotation.y = face + 0.4;
  group.add(titan.group);
  return {
    group,
    dispose() {
      group.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          const mm = o.material;
          for (const x of Array.isArray(mm) ? mm : [mm]) x.dispose();
        }
      });
    },
  };
}
