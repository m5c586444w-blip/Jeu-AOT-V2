import type { GameDate } from "../core/time";
import { toAbsoluteDay } from "../core/time";
import type { PoliticalState } from "../politics/state";
import type { ShiftersState } from "../shifters/shifters";
import type { World } from "../strategic/world";
import { accepts, declareWar, makePeace, proposeTreaty } from "./diplomacy";
import { atWar, buildProblem, hasTreaty, moveForces, moveProblem, nationIncome, nationsWorld, nationUpkeep, orderBuild, pushAi } from "./nations";
import type { StrategicState } from "../strategic/economy";
import type { NationsState } from "./nations";
import { projectProblem, projectTitan, SIDE_TO_FACTION } from "./war";

/**
 * IA des nations (02 §14) : modèle d'utilité simple et règles. Personnalités (prudent, agressif…) et attracteurs canon
 * (Marley veut le Fondateur ; Hizuru cherche des garanties) orientent sans scénariser. Chaque décision est consignée
 * avec ses raisons (journal de raisonnement, visible en débogage).
 */

export interface AiCtx {
  world: World;
  date: GameDate;
  ns: NationsState;
  sh: ShiftersState | null;
  pol: PoliticalState | null;
  st: StrategicState | null;
}

function weights(ctx: AiCtx, faction: string): { attack: number; build: number; diplomacy: number; caution: number } {
  const nw = nationsWorld(ctx.world);
  const p = nw.factions.get(faction)?.personality ?? "pragmatique";
  return nw.balance.ai.personality[p] ?? { attack: 1, build: 1, diplomacy: 1, caution: 1 };
}

function landPower(ctx: AiCtx, province: string, faction: string, role: "attack" | "defense"): number {
  const nw = nationsWorld(ctx.world);
  let p = 0;
  for (const [id, s] of Object.entries(ctx.ns.forces[province] ?? {})) {
    const f = nw.formations.get(id);
    if (f && f.faction === faction && f.domain === "terre") p += s.count * s.strength * f[role];
  }
  return p;
}

/** Décisions mensuelles d'une nation non jouée : guerre, paix, traités, levées, Titans. */
export function monthlyAi(ctx: AiCtx): void {
  const nw = nationsWorld(ctx.world);
  const day = toAbsoluteDay(ctx.date);
  for (const f of [...nw.factions.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (f.id === ctx.ns.player) continue;
    const n = ctx.ns.nations[f.id];
    if (!n) continue;
    const w = weights(ctx, f.id);
    // Paix : lassitude et rapport de force.
    for (const war of ctx.ns.wars.filter((x) => x.split("|").includes(f.id))) {
      const other = war.split("|").find((x) => x !== f.id) ?? "";
      const u = (50 - n.warSupport) * w.caution + (n.stability < 30 ? 20 : 0);
      if (u > 15) {
        const res = makePeace(ctx.world, ctx.ns, f.id, other, ctx.date);
        pushAi(ctx.ns, { day, faction: f.id, action: `paix:${other}:${res.ok ? "oui" : "non"}`, utility: u, reasons: [{ key: "ai.weariness", value: 50 - n.warSupport }, { key: "ai.caution", value: w.caution }] });
      }
    }
    // Guerre : attracteur canon (Marley et le Fondateur), soutien populaire, guerres en cours.
    if (f.attractors.includes("fondateur") && !atWar(ctx.ns, f.id, "fac_paradis")) {
      const busy = ctx.ns.wars.filter((x) => x.split("|").includes(f.id)).length;
      const u = nw.balance.ai.attractor_bonus * w.attack + (n.warSupport - 50) / 2 - busy * 30;
      pushAi(ctx.ns, { day, faction: f.id, action: u > 20 ? "guerre:fac_paradis" : "attendre:fac_paradis", utility: u, reasons: [{ key: "ai.attractor_fondateur", value: nw.balance.ai.attractor_bonus * w.attack }, { key: "ai.war_support", value: (n.warSupport - 50) / 2 }, { key: "ai.other_wars", value: -busy * 30 }] });
      if (u > 20) declareWar(ctx.world, ctx.ns, f.id, "fac_paradis", ctx.date);
    }
    // Traités : commerce avec qui y trouve intérêt ; Hizuru cherche des garanties.
    for (const o of nw.factions.keys()) {
      if (o === f.id || atWar(ctx.ns, f.id, o) || hasTreaty(ctx.ns, "commerce", f.id, o)) continue;
      const r = ctx.ns.relations[f.id]?.[o];
      if (!r || r.interest < 30) continue;
      const u = r.interest * w.diplomacy - 20;
      if (u > 10 && accepts(ctx.world, ctx.ns, f.id, o, "commerce").ok) {
        proposeTreaty(ctx.world, ctx.ns, f.id, o, "commerce", ctx.date);
        pushAi(ctx.ns, { day, faction: f.id, action: `commerce:${o}`, utility: u, reasons: [{ key: "ai.interest", value: r.interest }, { key: "ai.diplomacy", value: w.diplomacy }] });
      }
    }
    // Levées : garder une réserve ; renforcer la province frontière la plus menacée.
    const reserve = nw.balance.ai.min_reserve_industry;
    const front = frontProvince(ctx, f.id);
    const inf = [...nw.formations.values()].filter((x) => x.faction === f.id && x.enabled && x.domain === "terre" && x.attack + x.defense > 0).sort((a, b) => (b.attack + b.defense) / (b.cost.industry + 1) - (a.attack + a.defense) / (a.cost.industry + 1) || a.id.localeCompare(b.id))[0];
    // On ne lève que ce que le revenu peut entretenir (sinon pénurie et usure de toutes les formations).
    const margin = nationIncome(ctx.world, ctx.ns, f.id, ctx.st).industry.value * 0.8 - nationUpkeep(ctx.world, ctx.ns, f.id).value;
    if (front && inf && n.industry - inf.cost.industry * 2 > reserve * w.caution && margin > inf.upkeep) {
      const count = Math.max(1, Math.min(4, Math.floor((n.industry - reserve) / Math.max(1, inf.cost.industry) / 2), Math.floor(margin / Math.max(1, inf.upkeep))));
      if (!buildProblem(ctx.world, ctx.ns, f.id, inf.id, front, count)) {
        orderBuild(ctx.world, ctx.ns, f.id, inf.id, front, count, ctx.date);
        pushAi(ctx.ns, { day, faction: f.id, action: `lever:${inf.id}:${count}:${front}`, utility: count * w.build, reasons: [{ key: "ai.industry", value: Math.round(n.industry) }, { key: "ai.build", value: w.build }] });
      }
    }
  }
}

/** Province tenue la plus exposée (voisine d'un ennemi en guerre), sinon la mieux défendue. */
function frontProvince(ctx: AiCtx, faction: string): string | null {
  const nw = nationsWorld(ctx.world);
  let best: { id: string; score: number } | null = null;
  for (const p of nw.order) {
    if (ctx.ns.control[p.id] !== faction) continue;
    const threat = p.adjacent.reduce((a, x) => {
      const o = ctx.ns.control[x];
      return a + (o && o !== faction && atWar(ctx.ns, o, faction) ? 10 + landPower(ctx, x, o, "attack") : 0);
    }, 0);
    const score = threat * 10 + landPower(ctx, p.id, faction, "defense") * 0.01 + (p.type === "urbain" ? 0.1 : 0);
    if (!best || score > best.score || (score === best.score && p.id < best.id)) best = { id: p.id, score };
  }
  return best?.id ?? null;
}

/** Mouvements hebdomadaires : attaquer une province ennemie voisine quand le rapport de force le permet ; projeter un Titan. */
export function weeklyAi(ctx: AiCtx): void {
  const nw = nationsWorld(ctx.world);
  const day = toAbsoluteDay(ctx.date);
  for (const f of [...nw.factions.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (f.id === ctx.ns.player) continue;
    const w = weights(ctx, f.id);
    for (const p of nw.order) {
      if (ctx.ns.control[p.id] !== f.id) continue;
      const mine = landPower(ctx, p.id, f.id, "attack");
      if (mine <= 0) continue;
      for (const target of [...p.adjacent].sort()) {
        const owner = ctx.ns.control[target];
        if (!owner || owner === f.id || !atWar(ctx.ns, owner, f.id)) continue;
        const def = landPower(ctx, target, owner, "defense") * (1 + (nw.provinces.get(target)?.fort ?? 0)) + 1;
        const ratio = (mine * 0.7) / def;
        const u = ratio * w.attack - w.caution;
        if (u <= 0.3) continue;
        // Avance des formations de terre (on garde un tiers en place).
        for (const [id, s] of Object.entries(ctx.ns.forces[p.id] ?? {})) {
          const fd = nw.formations.get(id);
          if (!fd || fd.faction !== f.id || fd.domain !== "terre") continue;
          const k = Math.floor((s.count * 2) / 3);
          if (k >= 1 && !moveProblem(ctx.world, ctx.ns, f.id, id, p.id, target, k)) moveForces(ctx.world, ctx.ns, id, p.id, target, k);
        }
        pushAi(ctx.ns, { day, faction: f.id, action: `attaquer:${target}`, utility: u, reasons: [{ key: "ai.ratio", value: Math.round(ratio * 100) / 100 }, { key: "ai.attack", value: w.attack }, { key: "ai.caution", value: -w.caution }] });
        break;
      }
    }
    // Titans : projeter un porteur libre là où l'on se bat (Marley : armes stratégiques, 02 §11).
    for (const [shifter, slot] of Object.entries(ctx.sh?.titans ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
      if (SIDE_TO_FACTION[slot.faction] !== f.id) continue;
      const contested = [...new Set(ctx.ns.fronts.filter((x) => x.day > day - 8 && (x.attacker === f.id || x.defender === f.id)).map((x) => x.province))].sort()[0];
      if (!contested) continue;
      if (projectProblem(ctx.world, ctx.ns, ctx.sh, ctx.pol, f.id, shifter, contested, ctx.date)) continue;
      projectTitan(ctx.world, ctx.ns, ctx.pol, f.id, shifter, contested, ctx.date);
      pushAi(ctx.ns, { day, faction: f.id, action: `titan:${shifter}:${contested}`, utility: w.attack, reasons: [{ key: "ai.front", value: 1 }] });
      break;
    }
  }
}
