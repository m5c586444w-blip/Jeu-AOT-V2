import { fnv1a } from "../core/hash";
import { Rng } from "../core/rng";
import { engagementMedian } from "../military/expedition";
import { lognormal, uniform } from "../military/random";
import type { World } from "../strategic/world";
import { tacticalWorld } from "./battle";
import type { BattleSetup } from "./types";

/**
 * Auto-résolution d'une bataille (F-CMB-28) : le modèle d'engagement de P3 (03 §12 : log-normale à queue épaisse,
 * rupture rare, morts de blessures), multiplié par le facteur de terrain. C'est la référence du combat joué (AC4-08).
 */
export function autoResolveDeaths(world: World, setup: BattleSetup, seed: number): number {
  const x = world.military?.exp;
  const tw = tacticalWorld(world);
  if (!x) throw new Error("équilibrage des expéditions absent");
  const rng = new Rng(fnv1a(`${seed}:auto`));
  const n = setup.soldiers.length;
  const skill = setup.soldiers.reduce((s, p) => s + p.odm, 0) / Math.max(1, n);
  const vets = setup.soldiers.reduce((s, p) => s + p.veteran, 0) / Math.max(1, n);
  const veteran = 1 - Math.min(x.experience.max_bonus, x.experience.survival_per_expedition * vets * x.engagement.veteran_k * 10);
  const terrain = tw.balance.terrain_mult[tw.maps.get(setup.map)?.terrain ?? "plaine"] ?? 1;
  let dead = 0;
  for (const g of setup.titans) {
    const tt = tw.titanTypes.get(g.type);
    const cls = tt ? tw.titanClasses.get(tt.class) : undefined;
    if (!cls) continue;
    const alive = n - dead;
    if (alive <= 0) break;
    const median = engagementMedian(x, { threat: cls.threat, group: g.count, skill, veteran, gasMult: 1, bladeMult: 1, morale: 70, exposure: x.formations.eventail.exposure, misread: false }) * terrain;
    let deaths = Math.min(alive, Math.floor(lognormal(rng, median, x.engagement.sigma)));
    const c = x.engagement.catastrophe;
    if (rng.next() < c.p_base * (cls.abnormal ? c.abnormal_mult : 1)) deaths = Math.min(alive, deaths + Math.round(uniform(rng, c.share[0], c.share[1]) * Math.min(alive, x.engagement.max_engaged)));
    const wounded = Math.min(alive - deaths, Math.round(deaths * x.engagement.wounded_per_death * uniform(rng, 0.5, 1.5)));
    let fromWounds = 0;
    for (let k = 0; k < wounded; k++) if (rng.next() < x.engagement.serious_share && rng.next() < x.medical.serious_death_without) fromWounds++;
    dead += deaths + fromWounds;
  }
  return Math.min(n, dead);
}
