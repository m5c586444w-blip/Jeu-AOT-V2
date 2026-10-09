import { CanvasTexture, Color, SRGBColorSpace, Vector3 } from "three";
import type { MeshStandardMaterial, Object3D, Texture } from "three";
import { skinnedBounds } from "../humanBase";
import type { HumanTemplate } from "../humanBase";
import { blendHuman } from "../humanAnim";
import type { Gait, HumanPose } from "../humanAnim";
import { buildHumanTitan, titanGait } from "../humanTitan";
import type { HumanTitan } from "../humanTitan";
import { derive, range, seeded } from "../rng";
import { buildTitan, titanSteam } from "../titan";
import type { Titan, TitanPose, TitanSteam } from "../titan";
import { FIGURES } from "./catalog";
import type { R3TitanSpec } from "./catalog";
import { blendWeight, fallProgress } from "./states";
import type { ShowMemory, TitanShow } from "./states";

/**
 * Titan de R3 dans une scène : corps de base MakeHuman (CC0) déformé par sa variante (proportions, peau, expression), ou, tant
 * que le corps de base n'est pas chargé, la figure en primitives de R1 avec la même variante (repère simplifié, R1d).
 * L'état montré vient de la machine d'états (`states.ts`) ; le passage d'un état à l'autre est un fondu des rotations des os ;
 * la chute passe par « à genoux » ; jambes coupées : moignons et reptation ; nuque tranchée : entaille et vapeur.
 */
export interface FigureTitan {
  spec: R3TitanSpec;
  /** Corps de base (null : figure en primitives). */
  human: HumanTitan | null;
  inner: Titan;
  show(mem: ShowMemory<TitanShow>, time: number, cuts: { armL: number; armR: number; legs: number }, napeCut: boolean): void;
  /** Main droite (dans le monde) : un homme saisi y est tenu. */
  hand(out?: Vector3): Vector3;
  dispose(): void;
}

/** Pose du corps de base pour un état montré. */
export const HUMAN_POSE: Record<TitanShow, HumanPose> = { repos: "debout", marche: "marche", course: "course", saisie: "saisie", devore: "devore", rampant: "rampant", chute: "agenouille", abattu: "abattu" };
/** Pose de la figure en primitives (sans fondu) pour un état montré. */
export const PRIMITIVE_POSE: Record<TitanShow, TitanPose> = { repos: "debout", marche: "marche", course: "course", saisie: "saisie", devore: "saisie", rampant: "allonge", chute: "abattu", abattu: "abattu" };

const ease = (x: number): number => x * x * (3 - 2 * x);

/** Allure de R3 : celle de R1b, plus la boiterie et le roulis de la variante. */
export function r3Gait(spec: R3TitanSpec): Gait {
  return { ...titanGait(spec), limp: spec.limp, sway: spec.sway };
}

/** Peau d'une variante (navigateur) : marbrures, veines, rougeurs, sur fond clair (la teinte vient du matériau). */
export function titanSkinTexture(skinId: string, seed: number): Texture {
  const v = FIGURES.titans.peaux.find((p) => p.id === skinId) ?? FIGURES.titans.peaux[0];
  const rand = seeded(derive(seed, 3300));
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.fillStyle = "rgb(238,236,234)";
  g.fillRect(0, 0, S, S);
  const m = v?.marbrure ?? 0.3;
  for (let i = 0; i < 140; i++) {
    const l = 190 + rand() * 60;
    g.fillStyle = `rgba(${l},${l * 0.95},${l * 0.92},${0.12 + 0.35 * m})`;
    g.beginPath();
    g.ellipse(rand() * S, rand() * S, 8 + rand() * 50, 6 + rand() * 30, rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const red = v?.rougeur ?? 0.2;
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(200,110,100,${0.08 + 0.25 * red * rand()})`;
    g.beginPath();
    g.ellipse(rand() * S, rand() * S, 10 + rand() * 40, 8 + rand() * 28, rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const veins = v?.veines ?? 0.1;
  g.lineWidth = 1.4;
  for (let i = 0; i < 20 + 60 * veins; i++) {
    g.strokeStyle = `rgba(110,105,150,${0.06 + 0.3 * veins})`;
    let x = rand() * S;
    let y = rand() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 9; k++) {
      x += range(rand, -14, 14);
      y += range(rand, 4, 18);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Grain (pores) : points sombres et clairs.
  for (let i = 0; i < 9000; i++) {
    const d = rand() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${d},${d},${d},0.05)`;
    g.fillRect(rand() * S, rand() * S, 1.2, 1.2);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function buildFigureTitan(spec: R3TitanSpec, seed: number, kit: { template: HumanTemplate | null; eyeMap?: Texture | null; skinMap?: Texture | null; skinNormal?: Texture | null }): FigureTitan {
  const human = kit.template ? buildHumanTitan(kit.template, spec, seed, { skinMap: kit.skinMap ?? null, eyeMap: kit.eyeMap ?? null, skinNormal: kit.skinNormal ?? null }) : null;
  const inner: Titan = human ?? buildTitan(spec, seed, kit.skinMap ?? null);
  const skinDef = FIGURES.titans.peaux.find((p) => p.id === spec.skinId);
  if (human) {
    for (const [name, mesh] of human.human.meshes) {
      if (!name.startsWith("peau_")) continue;
      const mat = mesh.material as MeshStandardMaterial;
      if (skinDef) mat.roughness = skinDef.rugosite;
    }
  }
  const gait = r3Gait(spec);
  const rand = seeded(derive(seed, 3301));
  const phase = rand() * 6;
  const steam: TitanSteam = titanSteam(spec.height, rand);
  inner.group.add(steam.points);
  const napeMat = inner.nape.material as MeshStandardMaterial;
  const napeColor = napeMat.color.clone();
  const napeScale = inner.nape.scale.clone();
  const gash = new Color(0x3a0b08);
  const bone = (n: string): Object3D | undefined => human?.human.bones[n];
  const fig: FigureTitan = {
    spec,
    human,
    inner,
    show(mem, time, cuts, napeCut) {
      const st = mem.state;
      if (human) {
        const body = human.human;
        // Membres coupés : l'os du segment perdu est ramené à un moignon (la peau suit le squelette).
        const stump = (n: string, cut: boolean, k: number): void => {
          const b = bone(n);
          if (b) b.scale.setScalar(cut ? k : 1);
        };
        stump("lowerarm_l", cuts.armL > 0, 0.08);
        stump("lowerarm_r", cuts.armR > 0, 0.08);
        stump("calf_l", cuts.legs > 0, 0.12);
        stump("calf_r", cuts.legs > 0, 0.12);
        if (st === "chute") {
          const p = fallProgress(mem, time);
          if (p < 0.45) blendHuman(body, HUMAN_POSE[mem.prev === "chute" ? "repos" : mem.prev], time, "agenouille", time, ease(p / 0.45), gait, phase);
          else blendHuman(body, "agenouille", time, "abattu", time, ease((p - 0.45) / 0.55), gait, phase);
        } else if (st === "abattu") blendHuman(body, "abattu", time, "abattu", time, 1, gait, phase);
        else blendHuman(body, HUMAN_POSE[mem.prev === "chute" || mem.prev === "abattu" ? st : mem.prev], time, HUMAN_POSE[st], time, blendWeight(mem, time), gait, phase);
        body.skeleton.update();
      } else {
        inner.setPose(PRIMITIVE_POSE[st], time);
      }
      // Nuque : marque rouge vive tant qu'il vit ; tranchée, une entaille sombre plus large.
      const dead = st === "chute" || st === "abattu";
      if (dead && napeCut) {
        napeMat.color.copy(gash);
        napeMat.emissiveIntensity = 0.05;
        inner.nape.scale.set(napeScale.x * 1.5, napeScale.y * 1.1, napeScale.z * 1.4);
      } else {
        napeMat.color.copy(napeColor);
        napeMat.emissiveIntensity = dead ? 0.1 : 0.55;
        inner.nape.scale.copy(napeScale);
      }
      // Vapeur : le corps abattu se dissout ; un Titan blessé fume de ses moignons (régénération).
      inner.steam.visible = false;
      if (dead) {
        inner.group.updateMatrixWorld(true);
        steam.fall(time, -spec.height * 0.15, spec.height * 0.95);
      } else if (cuts.armL > 0 || cuts.armR > 0 || cuts.legs > 0) steam.heat(time);
      else steam.points.visible = false;
    },
    hand(out = new Vector3()) {
      const h = bone("hand_r");
      if (h) return h.getWorldPosition(out);
      const j = inner.joints.poignetD;
      return j.getWorldPosition(out);
    },
    dispose() {
      steam.dispose();
      inner.dispose();
    },
  };
  // Étalonnage : la hauteur debout MESURÉE sur la peau posée (voussure, boiterie comprises) est ramenée à celle de la variante.
  if (human) {
    fig.show({ state: "repos", prev: "repos", since: -100, x: 0, y: 0, still: 9, speed: 0, deadAt: null, cutAt: null, cut: 0 }, 0, { armL: 0, armR: 0, legs: 0 }, false);
    const b = skinnedBounds(human.human);
    const h = b.max.y - b.min.y;
    if (h > 0) human.body.scale.multiplyScalar(spec.height / h);
  }
  return fig;
}
