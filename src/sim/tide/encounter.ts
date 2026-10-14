import type { TideBalance } from "../../data/balance";
import type { GameState } from "../core/state";
import type { SeatId } from "../core/seat";
import type { Rng } from "../core/rng";
import { factionOfSeat } from "../knowledge/knowledge";
import { activityOf, isNight, localActivity } from "./activity";
import { sizeOf, signature } from "./footprint";
import { attentionField, cellOf, localDensity } from "./grid";
import type { Conditions, EncounterView, FactionView, Hostility, HumanEncounter, Pile, SeenPile, TideGrid, TitanEncounter, WallPost } from "./types";

/** Facteur de visibilité de la météo et de l'heure pour la détection humaine, dans (0, 1]. */
export function conditionMult(visibility: number, hour: number, b: TideBalance): number {
  const d = b.detection;
  const v = Math.min(1, Math.max(0, visibility));
  return (d.vis_floor + (1 - d.vis_floor) * v) * (isNight(hour, b) ? d.night_mult : 1);
}

/**
 * Taux de rencontre avec des Titans (par heure) : λ = base × densité locale × empreinte × activité × visibilité (spec 26 §3).
 * Un Titan immobile (nuit, hiver) reste rencontrable (plancher `immobile_floor`) ; l'attention de la pile le réveille (`localActivity`).
 */
export function titanLambda(pile: Pile, grid: TideGrid, cond: Conditions, posts: readonly WallPost[], b: TideBalance): number {
  const e = b.encounter;
  const rho = localDensity(grid, pile.x, pile.y, b);
  if (rho <= 0) return 0;
  const att = attentionField(grid, [pile], posts, b)[Math.max(0, cellOf(grid, pile.x, pile.y))] ?? 0;
  const act = activityOf(cond.hour, cond.season, b);
  const activity = Math.max(localActivity(act, att, b), e.immobile_floor);
  const vis = e.vis_floor + (1 - e.vis_floor) * Math.min(1, Math.max(0, cond.visibility));
  return e.base_per_h * rho * signature(pile, b) * activity * vis;
}

/**
 * Rencontres avec Titans d'un pas de `dtH` heures. Un tirage par pile (fork par pile et par tick : l'ordre des piles ne compte pas).
 * Densité nulle partout → aucune rencontre.
 */
export function scanTitanEncounters(grid: TideGrid, piles: readonly Pile[], posts: readonly WallPost[], cond: Conditions, dtH: number, tick: number, rng: Rng, b: TideBalance): TitanEncounter[] {
  const out: TitanEncounter[] = [];
  for (const p of [...piles].sort((a, z) => (a.id < z.id ? -1 : 1))) {
    const lambda = titanLambda(p, grid, cond, posts, b);
    if (lambda <= 0) continue;
    const draw = rng.fork(`tide:titan:${tick}:${p.id}`).next();
    if (draw < 1 - Math.exp(-lambda * dtH)) {
      const rho = localDensity(grid, p.x, p.y, b);
      out.push({ id: `tenc_${tick}_${p.id}`, pile: p.id, faction: p.faction, titans: Math.max(1, Math.round(rho * b.encounter.group_k)), lambdaPerH: lambda });
    }
  }
  return out;
}

/** Portée à laquelle `observer` repère `target` : éclaireurs, renseignement, météo, nuit, empreinte de la cible et son couvert. */
export function detectionRange(observer: Pile, target: Pile, cond: Conditions, b: TideBalance): number {
  const d = b.detection;
  const own = 1 + d.scout_k * observer.scouts + d.intel_k * observer.intel;
  const conspicuity = 1 + d.footprint_k * (signature(target, b) - 1);
  return d.base_m * own * conditionMult(cond.visibility, cond.hour, b) * conspicuity * (1 - d.concealment_k * target.concealment);
}

/** Portée de tir maximale d'une pile (armes présentes, munitions ou gaz restants), réduite par la visibilité. */
export function reachOf(p: Pile, cond: Conditions, b: TideBalance): number {
  let r = 0;
  for (const [w, n] of Object.entries(p.troops)) {
    const spec = b.weapons[w];
    if (!spec || n <= 0) continue;
    const supplied = spec.ammo_per_shot === 0 ? (spec.gas_per_min === 0 || p.gas > 0) : (p.ammo[w] ?? 0) > 0;
    if (supplied) r = Math.max(r, spec.range_m);
  }
  return r * (b.detection.vis_floor + (1 - b.detection.vis_floor) * Math.min(1, Math.max(0, cond.visibility)));
}

const dist = (a: Pile, z: Pile): number => Math.hypot(a.x - z.x, a.y - z.y);

/**
 * Moteur de rencontres humaines (spec 26 §3 bis) : deux piles hostiles entrent en contact quand l'une VOIT l'autre et que
 * celle-ci est à portée de tir. Aucun Titan, aucune densité requise. Déterministe, trié par identifiants.
 */
export function scanHumanEncounters(piles: readonly Pile[], hostile: Hostility, cond: Conditions, tick: number, b: TideBalance): HumanEncounter[] {
  const sorted = [...piles].sort((a, z) => (a.id < z.id ? -1 : 1));
  const out: HumanEncounter[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i] as Pile;
      const z = sorted[j] as Pile;
      if (!hostile(a.faction, z.faction) || a.routed && z.routed) continue;
      const d = dist(a, z);
      const aSees = d <= detectionRange(a, z, cond, b);
      const zSees = d <= detectionRange(z, a, cond, b);
      const aFires = aSees && d <= reachOf(a, cond, b);
      const zFires = zSees && d <= reachOf(z, cond, b);
      if (!aFires && !zFires) continue;
      out.push({ id: `henc_${tick}_${a.id}_${z.id}`, a: a.id, b: z.id, distanceM: d, seen: { a: aSees, b: zSees }, ambusher: aSees && !zSees ? "a" : zSees && !aSees ? "b" : null });
    }
  }
  return out;
}

/**
 * Vue d'une faction : ses piles exactes, et les autres piles SEULEMENT si l'une des siennes les repère (position, effectif arrondi).
 * Si un prédicat `hostile` est fourni, les piles d'une faction NON hostile (coalition) sont toujours visibles (même estimation arrondie) ;
 * sans prédicat, aucune distinction d'alliance n'est faite (toute autre faction est soumise à la détection).
 */
export function viewForFaction(faction: string, piles: readonly Pile[], cond: Conditions, b: TideBalance, hostile?: Hostility): FactionView {
  const own = piles.filter((p) => p.faction === faction).sort((a, z) => (a.id < z.id ? -1 : 1));
  const seen: SeenPile[] = [];
  for (const t of [...piles].sort((a, z) => (a.id < z.id ? -1 : 1))) {
    if (t.faction === faction) continue;
    const ally = hostile !== undefined && !hostile(faction, t.faction);
    if (!ally && !own.some((o) => dist(o, t) <= detectionRange(o, t, cond, b))) continue;
    const bucket = b.detection.size_bucket;
    seen.push({ id: t.id, faction: t.faction, x: t.x, y: t.y, sizeEstimate: Math.max(bucket, Math.round(sizeOf(t) / bucket) * bucket) });
  }
  return { faction, own, seen };
}

/** Vue par siège (27 §1) : la connaissance reste par faction ; un siège sans faction ne voit rien. */
export function viewForSeat(state: GameState, seat: SeatId, piles: readonly Pile[], cond: Conditions, b: TideBalance, hostile?: Hostility): FactionView {
  const f = factionOfSeat(state, seat);
  return f === null ? { faction: "", own: [], seen: [] } : viewForFaction(f, piles, cond, b, hostile);
}

/**
 * Projection d'une rencontre pour une faction : seulement ce qu'elle a vu. Jamais `seen` ni `ambusher` de l'adversaire :
 * `spotted` est ce que SA pile a repéré ; l'identité et la distance de l'autre pile ne sont révélées que si elle l'a repéré
 * (sinon elle subit le feu sans savoir d'où : `other` et `distanceM` valent `null`). `null` si la faction n'est pas partie
 * prenante de la rencontre (ou si les piles sont inconnues).
 */
export function projectEncounterForFaction(encounter: HumanEncounter, faction: string, piles: readonly Pile[]): EncounterView | null {
  const pa = piles.find((p) => p.id === encounter.a);
  const pb = piles.find((p) => p.id === encounter.b);
  if (!pa || !pb) return null;
  const side = pa.faction === faction ? "a" : pb.faction === faction ? "b" : null;
  if (side === null) return null;
  const mine = side === "a" ? pa : pb;
  const spotted = encounter.seen[side];
  const other = side === "a" ? pb : pa;
  return { id: encounter.id, own: mine.id, spotted, other: spotted ? other.id : null, otherFaction: spotted ? other.faction : null, distanceM: spotted ? encounter.distanceM : null };
}
