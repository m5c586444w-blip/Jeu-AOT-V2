import type { Battle } from "./battle";
import { FORMATIONS, RESTRAINTS, RT_ORDERS, SHIFTER_OBJECTIVES, TACTICAL_ORDERS } from "./types";
import type { Formation, QueuedOrder, SoldierUnit, SquadOrder, SquadState, TacticalOrder, TimedOrder, TroopUnit, UnitOrder } from "./types";

/**
 * Temps réel fin (R2+) : ordres par escouade et par unité, déplacements en formation, suivi, file d'ordres, tir de
 * l'artillerie sur zone, ordres généraux des porteurs. Tout ordre passe par le journal (`TimedOrder`) : même graine et mêmes
 * ordres donnent la même bataille. Une bataille qui ne reçoit aucun ordre temps réel ni aucune troupe ne passe jamais ici
 * (`state.rt` absent) : son déroulement est celui d'avant R2.
 */

/** Écart entre deux hommes d'une formation (m) [A] et rayon d'arrivée (m). */
export const FORMATION_SPACING_M = 3;
export const ARRIVAL_M = 2.5;
/** Distance au-delà de laquelle une escouade qui suit se remet en marche (m). */
export const FOLLOW_GAP_M = 14;
/** Rayon par défaut d'un tir sur zone (m) et d'une zone de porteur (m). */
export const FIRE_ZONE_R = 30;
export const SHIFTER_ZONE_R = 60;

type Log = (key: string, params: Record<string, string | number>) => void;

const alive = (s: { mode: string }): boolean => s.mode !== "mort" && s.mode !== "fui";
const isStance = (o: string): o is TacticalOrder => (TACTICAL_ORDERS as readonly string[]).includes(o);

/** Ordre de forme valide (journal, commandes `ResolveBattle` et `ResolveEncounter`). */
export function validTimedOrder(o: unknown): boolean {
  if (typeof o !== "object" || o === null) return false;
  const r = o as Record<string, unknown>;
  const int = (k: string): boolean => r[k] === undefined || (Number.isInteger(r[k]) && (r[k] as number) >= 0);
  const num = (k: string): boolean => r[k] === undefined || (typeof r[k] === "number" && Number.isFinite(r[k]));
  const inList = (k: string, list: readonly string[]): boolean => r[k] === undefined || list.includes(String(r[k]));
  return (
    Number.isInteger(r["tick"]) &&
    (r["tick"] as number) >= 0 &&
    typeof r["squad"] === "string" &&
    ([...TACTICAL_ORDERS, ...RT_ORDERS] as readonly string[]).includes(String(r["order"])) &&
    int("target") &&
    int("unit") &&
    int("troop") &&
    num("x") &&
    num("y") &&
    num("r") &&
    (r["follow"] === undefined || typeof r["follow"] === "string") &&
    (r["queue"] === undefined || typeof r["queue"] === "boolean") &&
    inList("formation", FORMATIONS) &&
    inList("objective", SHIFTER_OBJECTIVES) &&
    inList("restraint", RESTRAINTS)
  );
}

/** Vrai si l'ordre relève du temps réel (champ ou ordre nouveau, ou escouade déjà menée en temps réel). */
export function isRtOrder(bt: Battle, o: Omit<TimedOrder, "tick">): boolean {
  if ((RT_ORDERS as readonly string[]).includes(o.order)) return true;
  if (o.unit !== undefined || o.x !== undefined || o.y !== undefined || o.follow !== undefined || o.formation !== undefined || o.queue !== undefined || o.troop !== undefined) return true;
  if (!bt.state.rt) return false;
  const sq = bt.state.squads.find((x) => x.id === o.squad);
  return !!sq;
}

/** Position d'un homme dans une formation, dans le repère de l'escouade (x à droite, y vers l'avant). */
export function formationOffset(f: Formation, k: number, n: number, spacing = FORMATION_SPACING_M): { x: number; y: number } {
  switch (f) {
    case "ligne":
      return { x: (k - (n - 1) / 2) * spacing, y: 0 };
    case "colonne": {
      const rows = Math.ceil(n / 2);
      return { x: ((k % 2) - 0.5) * spacing, y: ((rows - 1) / 2 - Math.floor(k / 2)) * spacing };
    }
    case "coin": {
      const row = Math.ceil(k / 2);
      const side = k === 0 ? 0 : k % 2 === 1 ? -1 : 1;
      const depth = Math.ceil((n - 1) / 2);
      return { x: side * row * spacing, y: (depth / 2 - row) * spacing };
    }
    case "carre": {
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      return { x: ((k % cols) - (cols - 1) / 2) * spacing, y: ((rows - 1) / 2 - Math.floor(k / cols)) * spacing };
    }
  }
}

/** Point du monde d'un homme dans la formation : centre `c`, cap `heading` (rad, sens de la marche). */
export function formationSlot(f: Formation, k: number, n: number, c: { x: number; y: number }, heading: number, spacing = FORMATION_SPACING_M): { x: number; y: number } {
  const o = formationOffset(f, k, n, spacing);
  const fx = Math.cos(heading);
  const fy = Math.sin(heading);
  // Droite de la marche : (−fy, fx) dans le repère de la carte (y vers le sud).
  return { x: c.x - fy * o.x + fx * o.y, y: c.y + fx * o.x + fy * o.y };
}

/** Membres vivants d'une escouade (soldats) ou d'une section (troupes), dans l'ordre stable de l'état. */
export function squadMembers(bt: Battle, sq: SquadState): (SoldierUnit | TroopUnit)[] {
  if (sq.side) return (bt.state.troops ?? []).filter((t) => t.section === sq.id && alive(t));
  return bt.state.soldiers.filter((s) => s.squad === sq.id && alive(s));
}

export function centroid(list: readonly { x: number; y: number }[]): { x: number; y: number } | null {
  if (list.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const p of list) {
    x += p.x;
    y += p.y;
  }
  return { x: x / list.length, y: y / list.length };
}

const clampTo = (bt: Battle, x: number, y: number): { x: number; y: number } => ({ x: Math.max(1, Math.min(bt.map.width - 1, x)), y: Math.max(1, Math.min(bt.map.height - 1, y)) });

/** Exécute un ordre d'escouade (sans file) : l'ordre d'escouade efface les ordres propres de ses hommes. */
function execute(bt: Battle, sq: SquadState, o: QueuedOrder, log: Log): void {
  const st = bt.state;
  const members = squadMembers(bt, sq);
  for (const m of members) {
    delete m.rt;
    // Une nouvelle posture efface la cible d'avant (sauf « attaquer » avec une cible désignée).
    if ("squad" in m && !(o.order === "tuer" && o.target !== undefined) && o.order !== "formation") m.target = null;
  }
  const c = centroid(members);
  switch (o.order) {
    case "formation": {
      sq.formation = o.formation ?? "ligne";
      // L'escouade se reforme sur place, puis reprend son ordre.
      if (!sq.dest && c && sq.order !== "suivre") {
        if (sq.order !== "deplacer") sq.stance = isStance(sq.order) ? sq.order : (sq.stance ?? "tenir");
        sq.dest = c;
        sq.order = "deplacer";
      }
      log("battle.rt.formation", { squad: sq.id, formation: `formation.${sq.formation}` });
      return;
    }
    case "deplacer": {
      if (o.x === undefined || o.y === undefined) return;
      const d = clampTo(bt, o.x, o.y);
      sq.dest = d;
      if (c) sq.heading = Math.atan2(d.y - c.y, d.x - c.x);
      sq.follow = null;
      if (isStance(sq.order)) sq.stance = sq.order;
      sq.order = "deplacer";
      sq.foe = null;
      log("battle.rt.move", { squad: sq.id });
      return;
    }
    case "suivre": {
      if (!o.follow || o.follow === sq.id || !st.squads.some((x) => x.id === o.follow)) return;
      sq.follow = o.follow;
      if (isStance(sq.order)) sq.stance = sq.order;
      sq.order = "suivre";
      sq.dest = null;
      log("battle.rt.follow", { squad: sq.id, other: o.follow });
      return;
    }
    case "tuer":
    case "tenir":
    case "couvrir":
    case "repli": {
      sq.order = o.order;
      sq.stance = o.order === "repli" ? sq.stance : o.order;
      sq.dest = null;
      sq.follow = null;
      sq.foe = o.order === "tuer" && o.troop !== undefined ? o.troop : null;
      if (o.order === "tuer" && o.target !== undefined) for (const s of st.soldiers) if (s.squad === sq.id) s.target = o.target;
      log("battle.order", { squad: sq.id, order: `order.${o.order}` });
      const leader = members[0];
      if (o.order === "repli" && leader && !sq.side) st.signals.push({ t: st.tick / bt.world.balance.tick_hz, squad: sq.id, color: "vert", x: leader.x, y: leader.y, misread: false });
      return;
    }
    default:
      return;
  }
}

/** Applique un ordre temps réel (au pas où il est journalisé). */
export function applyRtOrder(bt: Battle, o: Omit<TimedOrder, "tick">, log: Log): void {
  const st = bt.state;
  st.rt = true;
  if (o.order === "tir_zone" || o.order === "cessez_feu") {
    const bat = st.batteries?.find((b) => b.id === o.squad && b.side === "allie");
    if (!bat) return;
    if (o.order === "cessez_feu") {
      bat.hold = true;
      bat.zone = null;
      bat.aim = null;
      log("battle.rt.cease_fire", { battery: bat.id });
    } else if (o.x !== undefined && o.y !== undefined) {
      bat.hold = false;
      const p = clampTo(bt, o.x, o.y);
      bat.zone = { x: p.x, y: p.y, r: Math.max(5, Math.min(120, o.r ?? FIRE_ZONE_R)) };
      log("battle.rt.fire_zone", { battery: bat.id });
    } else {
      // Tir sur zone sans point : feu libre (la batterie reprend ses cibles).
      bat.hold = false;
      bat.zone = null;
      log("battle.rt.free_fire", { battery: bat.id });
    }
    return;
  }
  if (o.order === "porteur") {
    const u = o.unit !== undefined ? st.shifters?.[o.unit] : undefined;
    if (!u || u.side !== "allie") return;
    const zone = o.x !== undefined && o.y !== undefined ? { ...clampTo(bt, o.x, o.y), r: Math.max(10, Math.min(300, o.r ?? SHIFTER_ZONE_R)) } : null;
    u.directive = { objective: o.objective ?? "libre", zone, restraint: o.restraint ?? "mesuree" };
    log("battle.rt.shifter_order", { name: u.name, objective: `rt.objective.${u.directive.objective}`, restraint: `rt.restraint.${u.directive.restraint}` });
    return;
  }
  const sq = st.squads.find((x) => x.id === o.squad);
  // Les sections ennemies n'obéissent qu'à leur IA.
  if (!sq || sq.side === "ennemi") return;
  if (o.unit !== undefined) {
    // Ordre propre à une unité (soldat d'une escouade ou fantassin d'une section).
    const m: SoldierUnit | TroopUnit | undefined = sq.side ? st.troops?.[o.unit] : st.soldiers[o.unit];
    if (!m || !alive(m) || ("squad" in m ? m.squad : m.section) !== sq.id) return;
    if (o.order === "formation") return;
    const order = o.order as SquadOrder;
    const u: UnitOrder = { order };
    if (order === "deplacer") {
      if (o.x === undefined || o.y === undefined) return;
      const p = clampTo(bt, o.x, o.y);
      u.x = p.x;
      u.y = p.y;
    }
    if (o.target !== undefined) u.target = o.target;
    if (o.troop !== undefined) u.foe = o.troop;
    m.rt = u;
    if ("squad" in m && o.target !== undefined) m.target = o.target;
    log("battle.rt.unit_order", { squad: sq.id, order: `order.${order}` });
    return;
  }
  const busy = sq.order === "deplacer" || sq.order === "suivre" || (sq.order === "tuer" && (sq.foe ?? null) !== null) || (sq.queue?.length ?? 0) > 0;
  const q: QueuedOrder = { ...o };
  delete (q as { queue?: boolean }).queue;
  if (o.queue && busy) {
    (sq.queue ??= []).push(q);
    log("battle.rt.queued", { squad: sq.id, order: `order.${o.order}`, n: sq.queue.length });
    return;
  }
  sq.queue = [];
  execute(bt, sq, q, log);
}

/** Section ennemie visée encore debout ? */
const foeStanding = (bt: Battle, i: number | null | undefined): boolean => {
  if (i === null || i === undefined) return false;
  const t = bt.state.troops?.[i];
  return !!t && alive(t);
};

/** Pas temps réel (avant les soldats) : suivi, arrivée, file d'ordres. */
export function stepRealtime(bt: Battle, log: Log): void {
  const st = bt.state;
  for (const sq of st.squads) {
    const members = squadMembers(bt, sq);
    if (members.length === 0) continue;
    if (sq.order === "suivre") {
      const other = st.squads.find((x) => x.id === sq.follow);
      const oc = other ? centroid(squadMembers(bt, other)) : null;
      if (!oc) {
        sq.order = sq.stance ?? "tenir";
        sq.follow = null;
        sq.dest = null;
        continue;
      }
      const c = centroid(members) as { x: number; y: number };
      const d = Math.hypot(oc.x - c.x, oc.y - c.y);
      // L'escouade se tient derrière celle qu'elle suit (côté de son point de repli), à la distance de suivi.
      if (d > FOLLOW_GAP_M) {
        const k = (d - FOLLOW_GAP_M * 0.6) / d;
        sq.dest = { x: c.x + (oc.x - c.x) * k, y: c.y + (oc.y - c.y) * k };
        sq.heading = Math.atan2(oc.y - c.y, oc.x - c.x);
      } else if (sq.dest && d < FOLLOW_GAP_M * 0.7) sq.dest = null;
    } else if (sq.order === "deplacer" && sq.dest) {
      const f = sq.formation ?? "carre";
      const heading = sq.heading ?? -Math.PI / 2;
      let arrived = 0;
      members.forEach((m, k) => {
        const slot = formationSlot(f, k, members.length, sq.dest as { x: number; y: number }, heading);
        if (Math.hypot(m.x - slot.x, m.y - slot.y) <= ARRIVAL_M + ("z" in m ? m.z : 0)) arrived++;
      });
      // Arrivée : tous les hommes libres à leur place (un homme saisi par un Titan ne bloque pas la file).
      const free = members.filter((m) => !("squad" in m) || m.mode !== "saisi").length;
      if (arrived >= free) {
        sq.dest = null;
        log("battle.rt.arrived", { squad: sq.id });
        next(bt, sq, log);
      }
    } else if (sq.order === "tuer" && sq.foe !== null && sq.foe !== undefined && !foeStanding(bt, sq.foe)) {
      sq.foe = null;
      next(bt, sq, log);
    } else if (sq.queue && sq.queue.length > 0 && sq.order !== "deplacer" && !(sq.order === "tuer" && foeStanding(bt, sq.foe))) {
      next(bt, sq, log);
    }
  }
  // Ordres propres : arrivée d'une unité → elle tient sa place.
  const done = (m: SoldierUnit | TroopUnit): void => {
    if (m.rt?.order === "deplacer" && m.rt.x !== undefined && m.rt.y !== undefined && Math.hypot(m.x - m.rt.x, m.y - m.rt.y) <= ARRIVAL_M + ("z" in m ? m.z : 0)) m.rt = { order: "tenir" };
    if (m.rt?.order === "tuer" && m.rt.foe !== undefined && !foeStanding(bt, m.rt.foe)) m.rt = { order: "tuer" };
  };
  for (const s of st.soldiers) if (s.rt && alive(s)) done(s);
  for (const t of st.troops ?? []) if (t.rt && alive(t)) done(t);
}

/** Ordre suivant de la file, sinon l'ordre de posture d'avant le mouvement. */
function next(bt: Battle, sq: SquadState, log: Log): void {
  const q = sq.queue?.shift();
  if (q) execute(bt, sq, q, log);
  else if (sq.order === "deplacer" || sq.order === "tuer") sq.order = sq.order === "deplacer" ? (sq.stance ?? "tenir") : sq.order;
}

/** Ordre effectif d'un homme : le sien s'il en a un, sinon celui de son escouade. */
export function effectiveOrder(m: { rt?: UnitOrder }, sq: SquadState): SquadOrder {
  return m.rt?.order ?? sq.order;
}

/** Destination d'un homme (place dans la formation, point de son ordre propre, ou rien). */
export function destinationOf(bt: Battle, m: SoldierUnit | TroopUnit, sq: SquadState): { x: number; y: number } | null {
  if (m.rt) return m.rt.order === "deplacer" && m.rt.x !== undefined && m.rt.y !== undefined ? { x: m.rt.x, y: m.rt.y } : null;
  if ((sq.order !== "deplacer" && sq.order !== "suivre") || !sq.dest) return null;
  const members = squadMembers(bt, sq).filter((x) => !x.rt);
  const k = members.indexOf(m);
  if (k < 0) return null;
  return formationSlot(sq.formation ?? "carre", k, members.length, sq.dest, sq.heading ?? -Math.PI / 2);
}

/**
 * Soldat en marche (R2+) : au sol, il marche vers sa place ; en l'air, il lâche son crochet et redescend (le pas d'ODM
 * continue). Renvoie vrai si le soldat est en marche (aucune attaque ce pas-ci).
 */
export function soldierMarch(bt: Battle, s: SoldierUnit, sq: SquadState, dt: number): { moving: boolean; walked: boolean } {
  const dest = destinationOf(bt, s, sq);
  if (!dest) return { moving: false, walked: false };
  const dx = dest.x - s.x;
  const dy = dest.y - s.y;
  const d = Math.hypot(dx, dy);
  if (d <= ARRIVAL_M * 0.5) return { moving: false, walked: false };
  if (s.mode !== "sol") {
    if (s.mode === "crochet" || s.mode === "rail") {
      s.anchor = null;
      s.mode = "vol";
    }
    return { moving: true, walked: false };
  }
  const v = Math.min(bt.world.balance.squads.flee_speed * dt * (s.wound === "aucune" ? 1 : 0.5), d);
  s.x += (dx / d) * v;
  s.y += (dy / d) * v;
  return { moving: true, walked: true };
}
