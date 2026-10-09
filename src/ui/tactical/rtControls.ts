import type { BattleState, Formation, Restraint, ShifterObjective, SquadOrder, SquadState, TimedOrder } from "../../sim/tactical/types";
import { FORMATIONS } from "../../sim/tactical/types";
import type { PickHit } from "../../render/battleView";

/**
 * Commandement de la bataille temps réel (R2+), sans DOM : sélection (clic, unité seule, rectangle, groupes numérotés),
 * ordres par escouade et par unité, ordre par défaut du clic droit, file d'ordres, tir sur zone, ordres des porteurs.
 * Tout ordre devient un `TimedOrder` daté du pas courant : il passe par le journal, la bataille rejouée est la même.
 */

/** Sélection : escouades et sections (identifiants), ou une unité seule (soldat ou fantassin), ou une batterie, ou un porteur. */
export interface Selection {
  squads: string[];
  unit: { squad: string; index: number; troop: boolean } | null;
  battery: string | null;
  shifter: number | null;
}

export const EMPTY: Selection = { squads: [], unit: null, battery: null, shifter: null };

const up = (m: { mode: string }): boolean => m.mode !== "mort" && m.mode !== "fui";

/** Escouades et sections que le joueur commande : escouades de soldats et sections alliées encore debout. */
export function commandable(st: BattleState): SquadState[] {
  return st.squads.filter((sq) => sq.side !== "ennemi" && membersOf(st, sq.id).length > 0);
}

export function isAllied(st: BattleState, squad: string): boolean {
  const sq = st.squads.find((x) => x.id === squad);
  return !!sq && sq.side !== "ennemi";
}

/** Membres debout d'une escouade (soldats) ou d'une section (fantassins), avec leur indice dans l'état. */
export function membersOf(st: BattleState, squad: string): { index: number; troop: boolean; x: number; y: number; z: number }[] {
  const sq = st.squads.find((x) => x.id === squad);
  if (!sq) return [];
  if (sq.side) return (st.troops ?? []).filter((t) => t.section === squad && up(t)).map((t) => ({ index: t.id, troop: true, x: t.x, y: t.y, z: 0 }));
  const out: { index: number; troop: boolean; x: number; y: number; z: number }[] = [];
  st.soldiers.forEach((s, i) => {
    if (s.squad === squad && up(s)) out.push({ index: i, troop: false, x: s.x, y: s.y, z: s.z });
  });
  return out;
}

export function centerOf(st: BattleState, squad: string): { x: number; y: number } | null {
  const m = membersOf(st, squad);
  if (m.length === 0) return null;
  return { x: m.reduce((a, p) => a + p.x, 0) / m.length, y: m.reduce((a, p) => a + p.y, 0) / m.length };
}

/** Escouade (ou section) d'une unité désignée ; null pour un Titan. */
export function squadOfHit(st: BattleState, hit: PickHit): string | null {
  if (hit.kind === "soldat") return st.soldiers[hit.index]?.squad ?? null;
  if (hit.kind === "troupe") return st.troops?.[hit.index]?.section ?? null;
  return null;
}

/** Clic gauche : escouade de l'unité (Alt : l'unité seule) ; Maj : ajoute à la sélection. Unités adverses : rien. */
export function clickSelect(st: BattleState, cur: Selection, hit: PickHit | null, mods: { alt: boolean; shift: boolean }): Selection {
  if (!hit || hit.kind === "titan") return mods.shift ? cur : EMPTY;
  const squad = squadOfHit(st, hit);
  if (!squad || !isAllied(st, squad)) return mods.shift ? cur : EMPTY;
  if (mods.alt) return { ...EMPTY, squads: [squad], unit: { squad, index: hit.index, troop: hit.kind === "troupe" } };
  if (mods.shift) {
    const has = cur.squads.includes(squad);
    return { ...EMPTY, squads: has ? cur.squads.filter((x) => x !== squad) : [...cur.squads, squad] };
  }
  return { ...EMPTY, squads: [squad] };
}

/** Rectangle de sélection (pixels) : toute escouade alliée dont au moins un homme debout est dedans. */
export function rectSelect(st: BattleState, toScreen: (x: number, y: number, z: number) => [number, number] | null, r: { x0: number; y0: number; x1: number; y1: number }, add: Selection | null = null): Selection {
  const x0 = Math.min(r.x0, r.x1);
  const x1 = Math.max(r.x0, r.x1);
  const y0 = Math.min(r.y0, r.y1);
  const y1 = Math.max(r.y0, r.y1);
  const found = new Set(add?.squads ?? []);
  for (const sq of commandable(st)) {
    if (found.has(sq.id)) continue;
    for (const m of membersOf(st, sq.id)) {
      const p = toScreen(m.x, m.y, m.z + 0.9);
      if (p && p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1) {
        found.add(sq.id);
        break;
      }
    }
  }
  return { ...EMPTY, squads: [...found] };
}

/** Groupes numérotés 1–9 : Ctrl + chiffre enregistre la sélection, le chiffre la rappelle (escouades encore debout). */
export function recallGroup(st: BattleState, groups: ReadonlyMap<number, readonly string[]>, n: number): Selection {
  const list = (groups.get(n) ?? []).filter((id) => membersOf(st, id).length > 0);
  return { ...EMPTY, squads: [...list] };
}

/** Ordres que l'interface propose aux escouades (stances de P4 et ordres temps réel). */
export const RT_SQUAD_ORDERS = ["deplacer", "tuer", "couvrir", "repli", "tenir", "suivre"] as const;
export type RtSquadOrder = (typeof RT_SQUAD_ORDERS)[number];

/** Ordres datés pour la sélection : un par escouade (ou un ordre d'unité). Déplacement groupé : escouades côte à côte. */
export function ordersFor(st: BattleState, sel: Selection, order: SquadOrder, extra: { x?: number; y?: number; target?: number; troop?: number; follow?: string; queue?: boolean } = {}): TimedOrder[] {
  const tick = st.tick;
  const q = extra.queue ? { queue: true } : {};
  if (sel.unit) {
    const u = sel.unit;
    const o: TimedOrder = { tick, squad: u.squad, order, unit: u.index };
    if (order === "deplacer") {
      if (extra.x === undefined || extra.y === undefined) return [];
      o.x = extra.x;
      o.y = extra.y;
    }
    if (extra.target !== undefined) o.target = extra.target;
    if (extra.troop !== undefined) o.troop = extra.troop;
    if (order === "suivre") return [];
    return [o];
  }
  const list = sel.squads.filter((id) => isAllied(st, id));
  if (order === "deplacer") {
    if (extra.x === undefined || extra.y === undefined) return [];
    const ex = extra.x;
    const ey = extra.y;
    // Escouades côte à côte, perpendiculairement à la marche, chacune à sa largeur.
    const centers = list.map((id) => centerOf(st, id)).filter((c): c is { x: number; y: number } => !!c);
    const gc = centers.length ? { x: centers.reduce((a, c) => a + c.x, 0) / centers.length, y: centers.reduce((a, c) => a + c.y, 0) / centers.length } : { x: ex, y: ey };
    const h = Math.atan2(ey - gc.y, ex - gc.x);
    const px = -Math.sin(h);
    const py = Math.cos(h);
    const widths = list.map((id) => Math.max(12, Math.min(90, membersOf(st, id).length * 3)));
    const total = widths.reduce((a, b) => a + b, 0) + 6 * Math.max(0, list.length - 1);
    let off = -total / 2;
    return list.map((id, k) => {
      const w = widths[k] ?? 12;
      const mid = off + w / 2;
      off += w + 6;
      return { tick, squad: id, order, x: ex + px * mid, y: ey + py * mid, ...q };
    });
  }
  if (order === "suivre") {
    const follow = extra.follow;
    if (!follow) return [];
    return list.filter((id) => id !== follow).map((id) => ({ tick, squad: id, order, follow, ...q }));
  }
  return list.map((id) => {
    const o: TimedOrder = { tick, squad: id, order, ...q };
    if (extra.target !== undefined) o.target = extra.target;
    if (extra.troop !== undefined) o.troop = extra.troop;
    return o;
  });
}

/** Clic droit : sur un Titan ou un fantassin adverse, attaquer ; sur une escouade alliée, la suivre ; au sol, s'y rendre. */
export function defaultOrders(st: BattleState, sel: Selection, hit: PickHit | null, ground: { x: number; y: number } | null, queue: boolean): TimedOrder[] {
  if (hit?.kind === "titan") {
    const t = st.titans[hit.index];
    // Un porteur allié n'est pas une cible : le clic droit sur lui vaut un clic au sol.
    if (t?.alive && !t.ally) return ordersFor(st, sel, "tuer", { target: hit.index, queue });
  }
  if (hit && hit.kind !== "titan") {
    const squad = squadOfHit(st, hit);
    if (squad && !isAllied(st, squad) && hit.kind === "troupe") return ordersFor(st, sel, "tuer", { troop: hit.index, queue });
    if (squad && isAllied(st, squad) && !sel.squads.includes(squad) && !sel.unit) return ordersFor(st, sel, "suivre", { follow: squad, queue });
  }
  if (ground) return ordersFor(st, sel, "deplacer", { x: ground.x, y: ground.y, queue });
  return [];
}

/** Formation suivante (touche) et ordre de formation pour la sélection. */
export function nextFormation(f: Formation | undefined): Formation {
  const i = FORMATIONS.indexOf(f ?? "ligne");
  return FORMATIONS[(i + 1) % FORMATIONS.length] ?? "ligne";
}

export function formationOrders(st: BattleState, sel: Selection, formation: Formation): TimedOrder[] {
  return sel.squads.filter((id) => isAllied(st, id)).map((id) => ({ tick: st.tick, squad: id, order: "formation", formation }));
}

/** Artillerie : tir sur zone (point, rayon) ou cessez-le-feu, pour une batterie alliée. */
export function batteryOrder(st: BattleState, battery: string, zone: { x: number; y: number; r: number } | null): TimedOrder | null {
  const b = st.batteries?.find((x) => x.id === battery && x.side === "allie");
  if (!b) return null;
  return zone ? { tick: st.tick, squad: battery, order: "tir_zone", x: zone.x, y: zone.y, r: zone.r } : { tick: st.tick, squad: battery, order: "cessez_feu" };
}

/** Porteur allié : ordre général (objectif, zone, retenue) ; l'IA le mène, le joueur ne le pilote jamais. */
export function shifterOrder(st: BattleState, index: number, d: { objective: ShifterObjective; restraint: Restraint; zone: { x: number; y: number; r: number } | null }): TimedOrder | null {
  const u = st.shifters?.[index];
  if (!u || u.side !== "allie") return null;
  const o: TimedOrder = { tick: st.tick, squad: `porteur_${index}`, order: "porteur", unit: index, objective: d.objective, restraint: d.restraint };
  if (d.zone) {
    o.x = d.zone.x;
    o.y = d.zone.y;
    o.r = d.zone.r;
  }
  return o;
}

/** Ordre affiché d'une escouade : le dernier donné pour ce pas (pas encore appliqué) ou son ordre courant. */
export function shownOrder(st: BattleState, pending: readonly TimedOrder[], squad: string): string {
  const p = pending.filter((o) => o.squad === squad && o.tick >= st.tick && o.unit === undefined && !o.queue).at(-1);
  if (p) return p.order;
  return st.squads.find((x) => x.id === squad)?.order ?? "tenir";
}

/** File d'ordres d'une escouade : ordres en attente dans l'état, puis ordres mis en file en pause (pas encore appliqués). */
export function queueOf(st: BattleState, pending: readonly TimedOrder[], squad: string): string[] {
  const sq = st.squads.find((x) => x.id === squad);
  const inState = (sq?.queue ?? []).map((o) => o.order as string);
  const waiting = pending.filter((o) => o.squad === squad && o.tick >= st.tick && o.queue).map((o) => o.order as string);
  return [...inState, ...waiting];
}

/** Repères de l'interface : destinations des escouades sélectionnées (ou toutes en marche), zones de tir et de porteurs. */
export function overlayOf(st: BattleState, sel: Selection): { soldiers: Set<number>; troops: Set<number>; dests: { x: number; y: number }[]; zones: { x: number; y: number; r: number; kind: "tir" | "porteur" }[] } {
  const soldiers = new Set<number>();
  const troops = new Set<number>();
  const dests: { x: number; y: number }[] = [];
  const ids = new Set(sel.squads);
  if (sel.unit) (sel.unit.troop ? troops : soldiers).add(sel.unit.index);
  else
    for (const id of ids)
      for (const m of membersOf(st, id)) (m.troop ? troops : soldiers).add(m.index);
  for (const sq of st.squads) {
    if (sq.side === "ennemi" || !sq.dest || sq.order !== "deplacer") continue;
    if (ids.size === 0 || ids.has(sq.id)) dests.push({ x: sq.dest.x, y: sq.dest.y });
  }
  const zones: { x: number; y: number; r: number; kind: "tir" | "porteur" }[] = [];
  for (const b of st.batteries ?? []) if (b.side === "allie" && b.zone) zones.push({ ...b.zone, kind: "tir" });
  for (const u of st.shifters ?? []) if (u.side === "allie" && u.directive?.zone) zones.push({ ...u.directive.zone, kind: "porteur" });
  return { soldiers, troops, dests, zones };
}
