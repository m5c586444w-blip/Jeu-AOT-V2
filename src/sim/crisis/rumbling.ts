import type { RumblingBalance } from "../../data/endingSchemas";
import { Rng } from "../core/rng";
import type { GameDate } from "../core/time";
import { toAbsoluteDay } from "../core/time";
import type { PoliticalState } from "../politics/state";
import type { StrategicState } from "../strategic/economy";
import { pushLog } from "../strategic/economy";
import type { World } from "../strategic/world";
import type { NationsState } from "../world/nations";

/**
 * Grondement (P9.4 ; 12 E59–E60 ; 01 §9 : « crise systémique à conséquences réelles », jamais un « mode ultime » ; 03 §8 : pas
 * de bataille classique). Couche facultative de l'état : absente hors du scénario du Grondement (aucune empreinte existante ne
 * bouge). Paramètres `?` : `data/balance/rumbling.json`.
 * - Le front avance de province en province du monde, à partir des côtes de Paradis (ordre de passage en largeur, fixe) ;
 *   chaque province touchée compte dans la part du monde ravagée (poids : industrie + vivres + effectifs) et ruine en partie la
 *   nation qui la tenait.
 * - Posture du joueur (E59) : empêcher (préparer l'assaut contre le Fondateur), retarder (ralentir, évacuer), laisser faire.
 * - Assaut : quand la préparation est complète, le joueur le lance ; il réussit au hasard (chance qui croît après chaque
 *   échec) ; l'échec coûte des effectifs et fait reculer la préparation. Réussi : la crise s'arrête.
 */
export type RumblingStance = "empecher" | "retarder" | "laisser";

export interface RumblingState {
  /** Jours depuis le déclenchement. */
  day: number;
  /** Part du monde ravagée (0–1). */
  ravaged: number;
  /** Provinces du monde touchées, dans l'ordre de passage. */
  provinces: string[];
  /** Avancée vers la prochaine province (0–1). */
  front: number;
  /** Arrêté (Fondateur neutralisé). */
  stopped: boolean;
  /** Posture du joueur ; null avant le choix. */
  stance: RumblingStance | null;
  /** Assaut contre le Fondateur : préparation (0–100), tentatives. */
  assault: number;
  attempts: number;
  /** Morts estimés hors de l'île et évacués (ordres de grandeur `?`). */
  dead: number;
  evacuated: number;
}

/** Données du Grondement pour un monde (ordre de passage et poids des provinces). */
export interface RumblingWorld {
  balance: RumblingBalance;
  /** Provinces de terre hors de Paradis, dans l'ordre de passage. */
  order: readonly string[];
  weight: ReadonlyMap<string, number>;
  /** Clé du nom de chaque province (alertes). */
  label: ReadonlyMap<string, string>;
  total: number;
}

const PARADIS = "wprov_paradis";

/** Ordre de passage : parcours en largeur depuis Paradis, voisins triés ; les mers se traversent sans être ravagées. */
export function rumblingWorld(world: Pick<World, "nations">, balance: RumblingBalance): RumblingWorld | null {
  const nw = world.nations;
  if (!nw) return null;
  const seen = new Set<string>([PARADIS]);
  const queue = [PARADIS];
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const p = nw.provinces.get(id);
    if (!p) continue;
    if (id !== PARADIS && p.type !== "mer" && p.faction !== "fac_paradis") order.push(id);
    for (const a of [...p.adjacent].sort()) {
      if (seen.has(a)) continue;
      seen.add(a);
      queue.push(a);
    }
  }
  const weight = new Map(order.map((id) => {
    const p = nw.provinces.get(id);
    return [id, p ? p.industry + p.food + p.manpower : 0] as const;
  }));
  const total = [...weight.values()].reduce((a, b) => a + b, 0);
  const label = new Map(order.map((id) => [id, nw.provinces.get(id)?.name_key ?? id] as const));
  return { balance, order, weight, label, total };
}

export function createRumblingState(): RumblingState {
  return { day: 0, ravaged: 0, provinces: [], front: 0, stopped: false, stance: null, assault: 0, attempts: 0, dead: 0, evacuated: 0 };
}

export interface RumblingCtx {
  rw: RumblingWorld;
  rb: RumblingState;
  ns: NationsState | null;
  st: StrategicState;
  pol: PoliticalState | null;
  date: GameDate;
}

/** Un jour de crise (copies modifiables). */
export function tickRumbling(ctx: RumblingCtx): void {
  const { rw, rb } = ctx;
  const b = rw.balance;
  rb.day += 1;
  if (rb.stopped) return;
  const pace = rb.stance ? b.posture[rb.stance] : 1;
  rb.front += pace / b.jours_par_province;
  while (rb.front >= 1 && rb.provinces.length < rw.order.length) {
    rb.front -= 1;
    const id = rw.order[rb.provinces.length] as string;
    rb.provinces.push(id);
    const w = rw.weight.get(id) ?? 0;
    rb.dead += Math.round(w * b.morts_par_poids);
    // La nation qui tenait la province perd une part de son industrie et de ses effectifs.
    const owner = ctx.ns?.control[id];
    const n = owner ? ctx.ns?.nations[owner] : undefined;
    if (n && rw.total > 0) {
      const k = 1 - b.ruine_nation * (w / rw.total) * 4;
      n.industry = Math.max(0, n.industry * k);
      n.manpower = Math.max(0, n.manpower * k);
    }
    pushLog(ctx.st, ctx.date, "alert.rumbling_province", { province: rw.label.get(id) ?? id, part: Math.round(((rb.provinces.reduce((a, x) => a + (rw.weight.get(x) ?? 0), 0)) / Math.max(1, rw.total)) * 100) }, false);
  }
  if (rb.provinces.length >= rw.order.length) rb.front = 0;
  rb.ravaged = rw.total > 0 ? rb.provinces.reduce((a, x) => a + (rw.weight.get(x) ?? 0), 0) / rw.total : 0;
  if (rb.stance === "empecher") {
    const allied = (ctx.ns?.treaties ?? []).some((t) => t.a === "fac_paradis" || t.b === "fac_paradis");
    rb.assault = Math.min(100, rb.assault + b.assaut.par_jour * (1 + (allied ? b.assaut.bonus_traite : 0)));
    for (const p of Object.values(ctx.st.provinces)) if (p.control === "paradis") p.stability = Math.max(0, p.stability + b.paradis.stabilite_par_jour_empecher);
  } else if (rb.stance === "retarder" && rb.provinces.length < rw.order.length) rb.evacuated += b.evacues_par_jour;
  else if (rb.stance === "laisser" && ctx.pol) ctx.pol.legitimacy = Math.max(0, ctx.pol.legitimacy + b.paradis.legitimite_par_jour_laisser);
}

/** Choix de posture (E59). */
export function setStance(rb: RumblingState, stance: RumblingStance): void {
  rb.stance = stance;
}

/** Raison de refus d'un assaut, ou null s'il peut partir. */
export function assaultProblem(rb: RumblingState): string | null {
  if (rb.stopped) return "rumbling.already_stopped";
  if (rb.stance !== "empecher") return "rumbling.not_preventing";
  if (rb.assault < 100) return "rumbling.not_ready";
  return null;
}

/** Assaut contre le Fondateur (tirage déterministe : graine, jour, tentative). Renvoie la réussite. */
export function launchAssault(rw: RumblingWorld, rb: RumblingState, st: StrategicState, seed: number, date: GameDate): boolean {
  const b = rw.balance.assaut;
  const rng = new Rng(((seed >>> 0) ^ Math.imul(toAbsoluteDay(date) + 977, 2654435761) ^ Math.imul(rb.attempts + 1, 40503)) >>> 0);
  const chance = Math.min(0.95, b.chance + b.chance_par_echec * rb.attempts);
  rb.attempts += 1;
  if (rng.next() < chance) {
    rb.stopped = true;
    pushLog(st, date, "alert.rumbling_stopped", { part: Math.round(rb.ravaged * 100) }, true);
    return true;
  }
  rb.assault = Math.max(0, 100 - b.recul_echec);
  st.stocks.manpower = Math.max(0, st.stocks.manpower * (1 - b.effectifs_perdus_echec));
  pushLog(st, date, "alert.rumbling_assault_failed", { n: rb.attempts }, true);
  return false;
}
