import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { skinnedBounds, templateFromBuffer } from "../../../src/render/tactical3d/humanBase";
import type { HumanTemplate } from "../../../src/render/tactical3d/humanBase";
import { PROPORTION_IDS, SKIN_IDS, STATES, TITAN_SIZES, allR3Specs, classOfHeight, r3TitanSpec, titanLook } from "../../../src/render/tactical3d/figures/catalog";
import { buildFigureTitan } from "../../../src/render/tactical3d/figures/titan3";
import type { FigureTitan } from "../../../src/render/tactical3d/figures/titan3";
import type { ShowMemory, TitanShow } from "../../../src/render/tactical3d/figures/states";
import { TITANS } from "../../../src/render/tactical3d/titanGallery";
import { overlap, silhouette, trisOfBody } from "../../../src/render/tactical3d/figures/raster";

/**
 * Titans de R3 (CR3-03 à CR3-05) : 5 classes × 3 variantes de proportions × 3 peaux sur le corps de base ; hauteur mesurée sur
 * la peau ; silhouettes distinctes (rendu hors écran par tramage, face et profil, même hauteur) ; contact au sol pour chaque
 * pose et chaque fondu (dont la chute et la reptation, jambes coupées).
 */
let t: HumanTemplate;
const figs = new Map<string, FigureTitan>();
const CLASSES = TITANS.classes.map((c) => c.id);
const key = (c: string, p: string): string => `${c}_${p}`;
const mem = (state: TitanShow, prev: TitanShow = state, since = -100, deadAt: number | null = null): ShowMemory<TitanShow> => ({ state, prev, since, x: 0, y: 0, still: 0, speed: 0, deadAt, cutAt: null, cut: 0 });
const NO_CUT = { armL: 0, armR: 0, legs: 0 };

beforeAll(async () => {
  const buf = readFileSync("docs/art/assets/derives/humain.glb");
  t = await templateFromBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  for (const c of CLASSES) for (const p of PROPORTION_IDS) figs.set(key(c, p), buildFigureTitan(r3TitanSpec(c, p, "chair"), 850, { template: t }));
}, 240_000);

describe("Titans de R3 : catalogue et variantes", () => {
  it("5 classes (3 à 15 m) × 3 proportions × 3 peaux ; variante d'un Titan de la simulation déterministe, à sa hauteur", () => {
    expect(TITAN_SIZES).toEqual([3, 5, 8, 12, 15]);
    expect(PROPORTION_IDS).toHaveLength(3);
    expect(SKIN_IDS.length).toBeGreaterThanOrEqual(3);
    const all = allR3Specs();
    expect(all).toHaveLength(45);
    expect(new Set(all.map((s) => `${s.id}/${s.skinId}`)).size).toBe(45);
    for (const s of all) expect(Math.abs(s.legs + s.torso + s.neck + s.head - 1)).toBeLessThan(1e-9);
    const seen = new Set<string>();
    for (let id = 0; id < 60; id++) {
      const k = { id, type: "ttype_moyen_errant", height: 6 + (id % 4), silhouette: id % 2, abnormal: false };
      const a = titanLook(k);
      expect(a).toEqual(titanLook(k));
      expect(a.height).toBe(k.height);
      expect(a.classId).toBe(classOfHeight(k.height));
      seen.add(`${a.proportion}/${a.skinId}`);
    }
    expect(seen.size, "variantes tirées sur 60 Titans").toBeGreaterThanOrEqual(6);
    expect(titanLook({ id: 1, type: "ttype_anormal_coureur", height: 11, silhouette: 7, abnormal: true }).proportion).toBe("echalas");
  });

  it("hauteur debout mesurée sur la peau à ±5 % : 15 corps aux hauteurs des classes, et à une hauteur de simulation (6,4 m)", () => {
    const lines: string[] = [];
    for (const [k, f] of figs) {
      f.show(mem("repos"), 0, NO_CUT, false);
      const b = skinnedBounds(f.human?.human ?? (undefined as never));
      const h = b.max.y - b.min.y;
      lines.push(`${k} ${h.toFixed(2)}/${f.spec.height}`);
      expect(Math.abs(h / f.spec.height - 1), `${k} : ${h.toFixed(2)} m pour ${f.spec.height} m`).toBeLessThanOrEqual(0.05);
    }
    const odd = buildFigureTitan(titanLook({ id: 3, type: "ttype_moyen_errant", height: 6.4, silhouette: 2, abnormal: false }), 9, { template: t });
    odd.show(mem("repos"), 0, NO_CUT, false);
    const b = skinnedBounds(odd.human?.human ?? (undefined as never));
    expect(Math.abs((b.max.y - b.min.y) / 6.4 - 1)).toBeLessThanOrEqual(0.05);
    odd.dispose();
    console.log(`hauteurs : ${lines.join(" | ")}`);
  });

  it("silhouettes distinctes (< 85 %) : chaque paire de variantes d'une classe, chaque paire de classes d'une même variante", () => {
    const sil = new Map<string, Int32Array>();
    for (const [k, f] of figs) {
      f.show(mem("repos"), 0, NO_CUT, false);
      sil.set(k, silhouette(trisOfBody(f.human?.human ?? (undefined as never))));
    }
    const pairs: [string, string][] = [];
    for (const c of CLASSES) for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) pairs.push([key(c, PROPORTION_IDS[i] as string), key(c, PROPORTION_IDS[j] as string)]);
    for (const p of PROPORTION_IDS) for (let i = 0; i < CLASSES.length; i++) for (let j = i + 1; j < CLASSES.length; j++) pairs.push([key(CLASSES[i] as string, p), key(CLASSES[j] as string, p)]);
    let worst = 0;
    const out: string[] = [];
    for (const [a, b] of pairs) {
      const o = overlap(sil.get(a) as Int32Array, sil.get(b) as Int32Array);
      worst = Math.max(worst, o);
      out.push(`${a}~${b} ${(o * 100).toFixed(0)}`);
    }
    console.log(`recouvrements (%) : ${out.join(" | ")} ; pire ${(worst * 100).toFixed(1)} %`);
    expect(worst).toBeLessThan(0.85);
  });

  it("contact au sol pour chaque pose et chaque fondu (pieds ±0,5 % ; couché ±1 % ; rien sous −1 %)", () => {
    type Case = { label: string; m: ShowMemory<TitanShow>; time: number; cuts?: typeof NO_CUT; lying: boolean };
    const cases: Case[] = [];
    for (const s of ["repos", "saisie", "devore"] as const) cases.push({ label: s, m: mem(s), time: 0.5, lying: false });
    for (const s of ["marche", "course"] as const) for (const time of [0, 0.35, 0.8, 1.3]) cases.push({ label: `${s} ${time}`, m: mem(s), time, lying: false });
    cases.push({ label: "fondu marche → saisie", m: mem("saisie", "marche", 0.3 - STATES.fondu_s / 2), time: 0.3, lying: false });
    cases.push({ label: "fondu repos → course", m: mem("course", "repos", 1 - STATES.fondu_s / 3), time: 1, lying: false });
    for (const time of [0.2, 1.1]) cases.push({ label: `rampant ${time}`, m: mem("rampant"), time, cuts: { armL: 0, armR: 0, legs: 5 }, lying: true });
    for (const p of [0.2, 0.45, 0.7, 1]) cases.push({ label: `chute ${p}`, m: mem("chute", "marche", 0, 0), time: p * STATES.chute_s, lying: true });
    cases.push({ label: "abattu", m: mem("abattu", "chute", 0, 0), time: 4, lying: true });
    const bad: string[] = [];
    for (const [k, f] of figs) {
      const body = f.human?.human ?? (undefined as never);
      const H = f.spec.height;
      for (const c of cases) {
        f.show(c.m, c.time, c.cuts ?? NO_CUT, c.label === "abattu");
        const all = skinnedBounds(body).min.y;
        const low = c.lying ? all : skinnedBounds(body, "peau_pieds").min.y;
        const tol = c.lying ? 0.01 : 0.005;
        if (Math.abs(low) > tol * H || all < -0.01 * H) bad.push(`${k} ${c.label} : bas ${low.toFixed(3)} m, peau ${all.toFixed(3)} m`);
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("dévoration : la main droite monte à la bouche ; nuque tranchée : entaille sombre ; moignons ; vapeur", () => {
    const f = figs.get(key("classe_8", "trapu")) as FigureTitan;
    const head = () => f.human?.human.bones["head"]?.getWorldPosition(f.hand().set(0, 0, 0)) ?? f.hand().set(0, 0, 0);
    f.show(mem("marche"), 0.4, NO_CUT, false);
    const far = f.hand().distanceTo(head());
    f.show(mem("devore"), 0.4, NO_CUT, false);
    const near = f.hand().distanceTo(head());
    console.log(`main → tête : marche ${far.toFixed(2)} m, dévoration ${near.toFixed(2)} m (hauteur ${f.spec.height} m)`);
    expect(near).toBeLessThan(far * 0.5);
    expect(near).toBeLessThan(0.2 * f.spec.height);
    f.show(mem("abattu", "chute", 0, 0), 5, NO_CUT, true);
    const nape = f.inner.nape.material as unknown as { color: { getHex(): number } };
    expect(nape.color.getHex()).toBe(0x3a0b08);
    expect(f.inner.group.children.some((c) => c.name === "vapeur" && c.visible)).toBe(true);
    f.show(mem("rampant"), 1, { armL: 0, armR: 0, legs: 4 }, false);
    expect(f.human?.human.bones["calf_l"]?.scale.x).toBeLessThan(0.2);
    f.show(mem("repos"), 1, NO_CUT, false);
    expect(f.human?.human.bones["calf_l"]?.scale.x).toBe(1);
  });
});
