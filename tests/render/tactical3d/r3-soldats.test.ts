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
 * Soldats de R3 (CR3-05 ; fichier 21 §8) : cinq tenues sur le corps de base de R1c — Paradis (Bataillon d'exploration, Garnison,
 * Police militaire) et Marley (infanterie, officier). Silhouettes distinctes (même corps, même taille, pose de repos propre à la
 * tenue), taille 1,7 m ± 5 %, équipement porté par les os, arme dans les mains au tir.
 */
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

describe("soldats de R3 : cinq tenues (R3.2)", () => {
  it("cinq tenues : trois de Paradis, deux de Marley", () => {
    expect(OUTFIT_IDS).toEqual(["exploration", "garnison", "police", "marley_infanterie", "marley_officier"]);
    expect(OUTFIT_IDS.map((id) => outfit(id).camp)).toEqual(["paradis", "paradis", "paradis", "marley", "marley"]);
    expect(outfitForFaction("fac_paradis", false)).toBe("garnison");
    expect(outfitForFaction("fac_marley", false)).toBe("marley_infanterie");
    expect(outfitForFaction("fac_marley", true)).toBe("marley_officier");
  });

  it("silhouettes distinctes : recouvrement (face + profil, même corps, repos de la tenue) < 85 % deux à deux", () => {
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
    // Équipement tridimensionnel : Paradis seulement.
    for (const id of ["exploration", "garnison", "police"] as const) expect(has(id, "reservoir"), id).toEqual(["pelvis"]);
    for (const id of ["marley_infanterie", "marley_officier"] as const) expect(has(id, "reservoir"), id).toEqual([]);
    expect(has("exploration", "cape")).toContain("spine_03");
    expect(has("garnison", "cape")).toEqual(["spine_03"]); // pivot seul, sans étoffe
    expect(named(soldiers.get("garnison") as HumanSoldier, "cape").every((o) => (o as unknown as { children: unknown[] }).children.length === 0)).toBe(true);
    expect(has("police", "coiffe")).toEqual(["head"]);
    expect(has("marley_infanterie", "coiffe")).toEqual(["head"]);
    expect(has("marley_officier", "coiffe")).toEqual(["head"]);
    expect(has("marley_officier", "bandeau")).toEqual(["head"]);
    expect(has("garnison", "fusil-dos")).toEqual(["spine_03"]);
    expect(has("marley_infanterie", "sac")).toEqual(["spine_03"]);
    expect(has("marley_officier", "etui")).toEqual(["pelvis"]);
    expect(has("police", "manteau").sort()).toEqual(["pelvis", "thigh_l", "thigh_r"]);
    expect(has("marley_officier", "manteau").sort()).toEqual(["pelvis", "thigh_l", "thigh_r"]);
    expect(has("exploration", "manteau")).toEqual([]);
  });

  it("au tir, le fusil est dans les mains (crosse à la main droite, canon vers la main gauche) ; pieds au sol", () => {
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
