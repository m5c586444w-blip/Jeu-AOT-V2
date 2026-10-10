import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { skinnedBounds, templateFromBuffer } from "../../../src/render/tactical3d/humanBase";
import type { HumanTemplate } from "../../../src/render/tactical3d/humanBase";
import { buildHumanSoldier } from "../../../src/render/tactical3d/humanSoldier";
import type { HumanSoldier } from "../../../src/render/tactical3d/humanSoldier";
import { OUTFIT_IDS, outfit, outfitForFaction } from "../../../src/render/tactical3d/figuresR3";
import type { OutfitId } from "../../../src/render/tactical3d/figuresR3";
import { worldPoint } from "../../../src/render/tactical3d/rig";
import { coverage, overlap, silhouettePair } from "../../../src/render/tactical3d/silhouette";
import { soldierMaterials } from "../../../src/render/tactical3d/soldier";

/**
 * Soldats de R3 (CR3-05 ; fichier 21 §8), revus par la dette n° 72 (D-163, D-165) : six tenues sur le corps de base de R1c —
 * Paradis (Corps de Reconnaissance, Garnison, Brigade Militaire, Corps d'Entraînement : l'uniforme commun de l'œuvre, distingués
 * par l'emblème et la cape) et Marley (infanterie, officier). Silhouettes distinctes entre familles de tenues (D-165), taille
 * 1,7 m ± 5 %, équipement porté par les os, emblèmes au dos, aux manches et à la poitrine, arme dans les mains au tir.
 */
/** Familles de silhouettes (D-165) : même uniforme et même équipement visibles de loin. */
const FAMILY: Record<OutfitId, string> = { exploration: "cape", garnison: "uniforme-fusil", police: "uniforme-fusil", recrues: "uniforme", marley_infanterie: "marley", marley_officier: "marley-officier" };
let t: HumanTemplate;
const mats = soldierMaterials();
const soldiers = new Map<OutfitId, HumanSoldier>();
const named = (s: HumanSoldier, name: string): { parent: unknown; name: string }[] => {
  const out: { parent: unknown; name: string }[] = [];
  s.group.traverse((o) => {
    if (o.name === name) out.push(o);
  });
  return out;
};
/** Nom de l'os qui porte un objet (premier ancêtre qui est un os), ou du groupe. */
const carrier = (o: { parent: unknown }): string => {
  let p = o.parent as { name: string; parent: unknown; type?: string } | null;
  while (p && p.type !== "Bone" && p.parent) p = p.parent as { name: string; parent: unknown; type?: string };
  return p?.name ?? "";
};

beforeAll(async () => {
  const buf = readFileSync("docs/art/assets/derives/humain.glb");
  t = await templateFromBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  for (const id of OUTFIT_IDS) soldiers.set(id, buildHumanSoldier(t, 7, mats, { outfit: outfit(id), height: 1.7, gender: 1 }));
}, 120_000);

describe("soldats de R3 : six tenues (R3.2, dette n° 72)", () => {
  it("six tenues : quatre corps de Paradis (uniforme commun de l'œuvre), deux de Marley", () => {
    expect(OUTFIT_IDS).toEqual(["exploration", "garnison", "police", "recrues", "marley_infanterie", "marley_officier"]);
    expect(OUTFIT_IDS.map((id) => outfit(id).camp)).toEqual(["paradis", "paradis", "paradis", "paradis", "marley", "marley"]);
    // Uniforme commun (C) : même veste, même pantalon, mêmes bottes ; un emblème par corps ; plus d'écharpe, de manteau ni de képi.
    const paradis = (["exploration", "garnison", "police", "recrues"] as const).map(outfit);
    for (const o of paradis) {
      expect([o.veste, o.pantalon, o.bottes], o.id).toEqual([paradis[0]?.veste, paradis[0]?.pantalon, paradis[0]?.bottes]);
      expect(o.echarpe ?? o.manteau ?? o.coiffe, o.id).toBeUndefined();
      expect(o.canon, o.id).toBe("C");
    }
    expect(paradis.map((o) => o.embleme)).toEqual(["ailes", "roses", "licorne", "epees"]);
    expect(outfit("exploration").cape).toBeDefined();
    expect(outfitForFaction("fac_paradis", false)).toBe("garnison");
    expect(outfitForFaction("fac_marley", false)).toBe("marley_infanterie");
    expect(outfitForFaction("fac_marley", true)).toBe("marley_officier");
  });

  it("silhouettes distinctes entre familles (D-165) : recouvrement (face + profil, même corps, repos de la tenue) < 85 %", () => {
    const masks = OUTFIT_IDS.map((id) => {
      const s = soldiers.get(id) as HumanSoldier;
      s.setPose("attente", 0.6);
      const m = silhouettePair(s.group, { half: 0.75, top: 2.0 }, 120, 160);
      expect(coverage(m), id).toBeGreaterThan(0.03);
      return m;
    });
    const lines: string[] = [];
    let worst = 0;
    for (let i = 0; i < masks.length; i++)
      for (let j = i + 1; j < masks.length; j++) {
        const o = overlap(masks[i] as ReturnType<typeof silhouettePair>, masks[j] as ReturnType<typeof silhouettePair>);
        worst = Math.max(worst, o);
        lines.push(`${OUTFIT_IDS[i]}/${OUTFIT_IDS[j]} ${o.toFixed(2)}`);
        // Garnison et Brigade Militaire portent le même uniforme dans l'œuvre (et ici le même fusil) : seul l'emblème les distingue (D-165).
        if (FAMILY[OUTFIT_IDS[i] as OutfitId] === FAMILY[OUTFIT_IDS[j] as OutfitId]) continue;
        expect(o, `${OUTFIT_IDS[i]} / ${OUTFIT_IDS[j]}`).toBeLessThan(0.85);
      }
    console.log(`silhouettes de soldats : maximum ${worst.toFixed(3)} ; ${lines.join(" | ")}`);
  });

  it("taille 1,7 m ± 5 % pour chaque tenue (peau mesurée, coiffe exclue) ; pieds au sol à ±2 cm au repos", () => {
    for (const id of OUTFIT_IDS) {
      const s = soldiers.get(id) as HumanSoldier;
      s.setPose("attente", 0);
      const b = skinnedBounds(s.body);
      expect(Math.abs((b.max.y - b.min.y) / 1.7 - 1), id).toBeLessThanOrEqual(0.05);
      expect(Math.abs(b.min.y), id).toBeLessThanOrEqual(0.02);
    }
  });

  it("équipement porté par les os : coiffe à la tête, fusil et sac au dos, manteau au bassin et aux cuisses, étui à la hanche", () => {
    const has = (id: OutfitId, name: string): string[] => named(soldiers.get(id) as HumanSoldier, name).map(carrier);
    // Équipement tridimensionnel : Paradis seulement ; une bonbonne de gaz sur chaque boîtier (dette n° 72).
    for (const id of ["exploration", "garnison", "police", "recrues"] as const) {
      expect(has(id, "reservoir"), id).toEqual(["pelvis"]);
      expect(has(id, "bonbonne").sort(), id).toEqual(["thigh_l", "thigh_r"]);
    }
    // Emblèmes (dette n° 72) : au dos (sur la cape pour le Corps de Reconnaissance), aux deux manches, à la poitrine.
    const EMB = { exploration: "ailes", garnison: "roses", police: "licorne", recrues: "epees" } as const;
    for (const [id, em] of Object.entries(EMB) as [keyof typeof EMB, string][]) {
      const where = has(id, `embleme-${em}`).sort();
      expect(where, id).toEqual(["spine_03", "spine_03", "upperarm_l", "upperarm_r"]);
      for (const other of Object.values(EMB)) if (other !== em) expect(has(id, `embleme-${other}`), `${id} ne porte pas ${other}`).toEqual([]);
    }
    // Brassard à étoile des Eldiens de Marley (C ; couleurs ?) au bras gauche ; aucun emblème de Paradis chez Marley.
    expect(has("marley_infanterie", "etoile-brassard")).toEqual(["upperarm_l"]);
    for (const id of ["marley_infanterie", "marley_officier"] as const) expect(named(soldiers.get(id) as HumanSoldier, "embleme-ailes")).toHaveLength(0);
    for (const id of ["marley_infanterie", "marley_officier"] as const) expect(has(id, "reservoir"), id).toEqual([]);
    expect(has("exploration", "cape")).toContain("spine_03");
    expect(has("garnison", "cape")).toEqual(["spine_03"]); // pivot seul, sans étoffe
    expect(named(soldiers.get("garnison") as HumanSoldier, "cape").every((o) => (o as unknown as { children: unknown[] }).children.length === 0)).toBe(true);
    for (const id of ["exploration", "garnison", "police", "recrues"] as const) expect(has(id, "coiffe"), id).toEqual([]);
    expect(has("marley_infanterie", "coiffe")).toEqual(["head"]);
    expect(has("marley_officier", "coiffe")).toEqual(["head"]);
    expect(has("marley_officier", "bandeau")).toEqual(["head"]);
    expect(has("police", "fusil-dos")).toEqual(["spine_03"]);
    expect(has("garnison", "fusil-dos")).toEqual(["spine_03"]);
    expect(has("recrues", "fusil-dos")).toEqual([]);
    expect(has("marley_infanterie", "sac")).toEqual(["spine_03"]);
    expect(has("marley_officier", "etui")).toEqual(["pelvis"]);
    expect(has("police", "manteau")).toEqual([]);
    expect(has("marley_officier", "manteau").sort()).toEqual(["pelvis", "thigh_l", "thigh_r"]);
    expect(has("exploration", "manteau")).toEqual([]);
  });

  it("sous la pluie (A) : capuche de la cape levée sur la tête, ouverte sur le visage ; aucun effet sans cape", () => {
    const wet = buildHumanSoldier(t, 7, mats, { outfit: outfit("exploration"), height: 1.7, gender: 1, pluie: true });
    const dry = soldiers.get("exploration") as HumanSoldier;
    expect(named(wet, "capuche").map(carrier)).toEqual(["head"]);
    expect(named(dry, "capuche")).toHaveLength(0);
    wet.setPose("attente", 0);
    const head = wet.body.bones["head"];
    const hood = named(wet, "capuche")[0] as unknown as Parameters<typeof worldPoint>[0];
    // La capuche couvre le sommet du crâne, et le visage reste découvert (aucun sommet devant les yeux).
    const eye = worldPoint(wet.body.bones["eye_l"] as Parameters<typeof worldPoint>[0]);
    const pos = (hood as unknown as { geometry: { getAttribute(n: string): { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } } }).geometry.getAttribute("position");
    let top = -Infinity;
    let front = -Infinity;
    const v = worldPoint(hood).clone();
    for (let i = 0; i < pos.count; i++) {
      (hood as unknown as { localToWorld(x: typeof v): typeof v }).localToWorld(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)));
      top = Math.max(top, v.y);
      if (Math.abs(v.y - eye.y) < 0.03 && Math.abs(v.x - eye.x) < 0.03) front = Math.max(front, v.z);
    }
    expect(head).toBeDefined();
    expect(top).toBeGreaterThan(eye.y + 0.08);
    expect(front).toBeLessThan(eye.z);
    const plain = buildHumanSoldier(t, 7, mats, { outfit: outfit("garnison"), height: 1.7, gender: 1, pluie: true });
    expect(named(plain, "capuche")).toHaveLength(0);
    wet.dispose();
    plain.dispose();
  });

  it("au tir, le fusil est dans les mains (crosse à la main droite, canon vers la main gauche) ; pieds au sol", () => {
    // Fantassins de Paradis (Garnison, dette n° 72) : le fusil passe du dos aux mains pour tirer.
    const g = soldiers.get("garnison") as HumanSoldier;
    g.setPose("tir", 0.3);
    expect((named(g, "fusil-mains")[0] as unknown as { visible: boolean }).visible, "garnison au tir").toBe(true);
    expect((named(g, "fusil-dos")[0] as unknown as { visible: boolean }).visible, "garnison au tir").toBe(false);
    const gr = worldPoint(g.body.bones["hand_r"] as Parameters<typeof worldPoint>[0]);
    expect(worldPoint(named(g, "fusil-mains")[0] as unknown as Parameters<typeof worldPoint>[0]).distanceTo(gr)).toBeLessThan(0.1);
    const s = soldiers.get("marley_infanterie") as HumanSoldier;
    s.setPose("tir", 0.3);
    const rifle = named(s, "fusil-mains")[0] as unknown as Parameters<typeof worldPoint>[0];
    expect((rifle as unknown as { visible: boolean }).visible).toBe(true);
    const r = worldPoint(s.body.bones["hand_r"] as Parameters<typeof worldPoint>[0]);
    const l = worldPoint(s.body.bones["hand_l"] as Parameters<typeof worldPoint>[0]);
    const p = worldPoint(rifle);
    expect(p.distanceTo(r)).toBeLessThan(0.1);
    // Le canon (axe +y de l'arme) pointe vers la main gauche.
    const tip = worldPoint(rifle).clone();
    (rifle as unknown as { localToWorld(v: typeof tip): typeof tip }).localToWorld(tip.set(0, 0.5, 0));
    expect(tip.distanceTo(l)).toBeLessThan(p.distanceTo(l));
    // L'arme vise droit devant (cap de l'unité : +z), à ±15° près, presque à l'horizontale.
    const dir = tip.clone().sub(p).normalize();
    expect(Math.abs((Math.atan2(dir.x, dir.z) * 180) / Math.PI), "azimut du tir").toBeLessThan(15);
    expect(Math.abs((Math.asin(dir.y) * 180) / Math.PI), "hausse du tir").toBeLessThan(20);
    const b = skinnedBounds(s.body);
    expect(Math.abs(b.min.y)).toBeLessThanOrEqual(0.02);
    // Hors du tir et du port d'arme, il retourne à l'épaule.
    s.setPose("marche", 0.3);
    expect((named(s, "fusil-mains")[0] as unknown as { visible: boolean }).visible).toBe(false);
    expect((named(s, "fusil-dos")[0] as unknown as { visible: boolean }).visible).toBe(true);
  });

  it("même graine, même soldat ; sans tenue, le soldat de R1c (cape verte, équipement tridimensionnel)", () => {
    const a = buildHumanSoldier(t, 11, mats, { outfit: outfit("police") });
    const b = buildHumanSoldier(t, 11, mats, { outfit: outfit("police") });
    a.setPose("attente", 0);
    b.setPose("attente", 0);
    expect(skinnedBounds(a.body).max.y).toBeCloseTo(skinnedBounds(b.body).max.y, 6);
    const plain = buildHumanSoldier(t, 11, mats);
    expect(plain.outfit).toBeNull();
    expect(named(plain, "reservoir")).toHaveLength(1);
    expect(named(plain, "coiffe")).toHaveLength(0);
    for (const x of [a, b, plain]) x.dispose();
  });
});
