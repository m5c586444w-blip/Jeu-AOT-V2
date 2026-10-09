import type { TacticalBalance } from "../../data/balance";
import { fnv1a } from "../core/hash";
import { Rng } from "../core/rng";
import type { TacticalWorld } from "../strategic/world";
import type { Battle } from "./battle";
import type { TacticalWorldMap } from "./map";
import { segmentBlocked, walkStep } from "./map";
import { hookDelay, pickAnchor } from "./odm";
import { destinationOf, effectiveOrder, formationSlot, walkSoldier } from "./realtime";
import type { BattleDeathCause, BattleSetup, SoldierUnit, SquadState, TitanUnit, TroopUnit } from "./types";

/**
 * Compagnies (R2+, dette n° 33) : sections d'infanterie des deux camps. Les fantassins tirent à portée (fusils à
 * répétition, mitrailleuses, fusils anti-Titans), les troupes d'assaut et la cavalerie chargent ; les soldats à équipement
 * tridimensionnel les attaquent à la lame ; les Titans et les porteurs les frappent ; l'artillerie les touche. Chaque section a
 * un moral : au-delà de ses pertes, elle se débande. Tirage propre (`trRng`) : rien ne change pour une bataille sans troupe.
 */

export type RtBalance = NonNullable<TacticalBalance["rt"]>;

export interface TroopHooks {
  log(key: string, params: Record<string, string | number>): void;
  killSoldier(s: SoldierUnit, cause: BattleDeathCause): void;
}

const alive = (s: { mode: string }): boolean => s.mode !== "mort" && s.mode !== "fui";
const d2 = (ax: number, ay: number, bx: number, by: number): number => (ax - bx) ** 2 + (ay - by) ** 2;

export function rtBalance(bt: Battle): RtBalance {
  const r = bt.world.balance.rt;
  if (!r) throw new Error("équilibrage des compagnies absent (data/balance/tactical.json, section rt)");
  return r;
}

export function troopHooksOf(bt: Battle, log: TroopHooks["log"], killSoldier?: TroopHooks["killSoldier"]): TroopHooks {
  return { log, killSoldier: killSoldier ?? ((s, cause) => killSoldierPlain(bt, s, cause)) };
}

/** Repli quand le crochet de mort du combat n'est pas fourni (tests) : même effet sur l'état. */
function killSoldierPlain(bt: Battle, s: SoldierUnit, cause: BattleDeathCause): void {
  const t = Math.round((bt.state.tick / bt.world.balance.tick_hz) * 10) / 10;
  s.mode = "mort";
  s.anchor = null;
  s.death = { t, cause, titan: null, x: Math.round(s.x), y: Math.round(s.y) };
  bt.state.stats.deathsByCause[cause] = (bt.state.stats.deathsByCause[cause] ?? 0) + 1;
}

/** Déploiement : sections de Paradis au sud (devant les escouades), sections ennemies au nord ; en ligne sur deux rangs. */
export function deployTroops(tw: TacticalWorld, setup: BattleSetup, map: TacticalWorldMap): { troops: TroopUnit[]; sections: SquadState[]; trRng: number } | null {
  const specs = setup.troops ?? [];
  if (specs.length === 0) return null;
  const rb = tw.balance.rt;
  if (!rb) throw new Error("équilibrage des compagnies absent (data/balance/tactical.json, section rt)");
  const rng = new Rng(fnv1a(`${setup.seed}:troupes`));
  const troops: TroopUnit[] = [];
  const sections: SquadState[] = [];
  const margin = tw.balance.battle.deploy_margin_m;
  for (const side of ["allie", "ennemi"] as const) {
    const list = specs.filter((s) => s.side === side);
    list.forEach((sp, i) => {
      const cx = ((i + 0.5) / list.length) * map.width + (rng.next() - 0.5) * 8;
      // Paradis : en avant des escouades (bord sud) ; ennemi : bord nord.
      const cy = side === "allie" ? map.height - margin - 6 : margin * 0.5 + 6;
      const heading = side === "allie" ? -Math.PI / 2 : Math.PI / 2;
      sections.push({ id: sp.id, order: side === "allie" ? "tenir" : "tuer", known: [], rally: { x: cx, y: side === "allie" ? map.height - 2 : 2 }, side, morale: 100, size: sp.count, formation: "ligne", heading });
      const rows = sp.count > 16 ? 2 : 1;
      const perRow = Math.ceil(sp.count / rows);
      for (let k = 0; k < sp.count; k++) {
        const slot = formationSlot("ligne", k % perRow, perRow, { x: cx, y: cy + (side === "allie" ? 1 : -1) * Math.floor(k / perRow) * rb.spacing_m }, heading, rb.spacing_m);
        troops.push({
          id: troops.length,
          section: sp.id,
          side,
          kind: sp.kind,
          faction: sp.faction,
          x: Math.max(1, Math.min(map.width - 1, slot.x + (rng.next() - 0.5))),
          y: Math.max(1, Math.min(map.height - 1, slot.y + (rng.next() - 0.5))),
          mode: "ligne",
          wounded: false,
          reload: rng.next() * (rb.weapons[sp.kind]?.reload_s ?? 3),
          target: null,
          heading,
          kills: 0,
          shot: -1,
          death: null,
        });
      }
    });
  }
  return { troops, sections, trRng: rng.serialize().state };
}

export function enemyTroopsStanding(bt: Battle): boolean {
  return (bt.state.troops ?? []).some((t) => t.side === "ennemi" && alive(t));
}

export function alliedTroopsStanding(bt: Battle): number {
  return (bt.state.troops ?? []).filter((t) => t.side === "allie" && alive(t)).length;
}

function stats(bt: Battle): NonNullable<Battle["state"]["stats"]["troops"]> {
  return (bt.state.stats.troops ??= { shots: 0, hits: 0, deadAllied: 0, deadEnemy: 0, melee: 0, routs: 0, byTitans: 0, byArtillery: 0 });
}

/** Mort d'un fantassin (balle, lame, Titan, éclat) : moral de sa section. */
export function killTroop(bt: Battle, tr: TroopUnit, cause: BattleDeathCause): void {
  if (!alive(tr)) return;
  tr.mode = "mort";
  tr.target = null;
  tr.death = { t: Math.round((bt.state.tick / bt.world.balance.tick_hz) * 10) / 10, cause, x: Math.round(tr.x), y: Math.round(tr.y) };
  const s = stats(bt);
  if (tr.side === "allie") s.deadAllied += 1;
  else s.deadEnemy += 1;
  if (cause === "devore" || cause === "frappe") s.byTitans += 1;
  if (cause === "eclat") s.byArtillery += 1;
  const sq = bt.state.squads.find((x) => x.id === tr.section);
  const rb = bt.world.balance.rt;
  if (sq && rb) sq.morale = Math.max(0, (sq.morale ?? 100) - rb.morale_loss_per_death);
}

/** Une balle (ou un coup de mêlée) atteint un fantassin : mort ou blessure ; un blessé touché de nouveau meurt. */
function hitTroop(bt: Battle, tr: TroopUnit, lethal: number, rng: Rng, cause: BattleDeathCause): boolean {
  if (tr.wounded || rng.next() < lethal) {
    killTroop(bt, tr, cause);
    return true;
  }
  tr.wounded = true;
  return false;
}

/** Une balle atteint un soldat : mort, ou blessure grave (hémorragie, comme les coups des Titans). */
function hitSoldier(bt: Battle, s: SoldierUnit, lethal: number, rng: Rng, h: TroopHooks): boolean {
  if (rng.next() < lethal) {
    h.killSoldier(s, "balle");
    return true;
  }
  if (s.wound !== "grave") {
    s.wound = "grave";
    const [w0, w1] = bt.world.balance.soldiers.bleed_death_s;
    s.bleedTimer = w0 + (w1 - w0) * rng.next();
  }
  s.stress += bt.world.balance.soldiers.stress_per_death_seen;
  return false;
}

type Target = NonNullable<TroopUnit["target"]>;

function posOf(bt: Battle, t: Target): { x: number; y: number; z: number; up: boolean } | null {
  const st = bt.state;
  if (t.kind === "soldat") {
    const s = st.soldiers[t.index];
    return s ? { x: s.x, y: s.y, z: s.z, up: alive(s) && s.mode !== "saisi" } : null;
  }
  if (t.kind === "troupe") {
    const u = st.troops?.[t.index];
    return u ? { x: u.x, y: u.y, z: 0, up: alive(u) } : null;
  }
  const ti = st.titans[t.index];
  return ti ? { x: ti.x, y: ti.y, z: ti.height * 0.6, up: ti.alive } : null;
}

/** Hauteur de tir d'un fantassin (épaule) et hauteur visée sur un homme debout (m). */
const SHOOTER_Z = 1.5;
const CHEST_Z = 1.2;
/** Nombre de cibles proches essayées pour trouver une ligne de tir dégagée. */
const SIGHT_TRIES = 6;

/** Ligne de tir dégagée entre un fantassin et un point visé (aucun bâtiment, mur ni rocher entre eux). */
function clearShot(bt: Battle, tr: TroopUnit, p: { x: number; y: number; z: number }): boolean {
  return !segmentBlocked(bt.map, tr.x, tr.y, SHOOTER_Z, p.x, p.y, p.z + CHEST_Z);
}

/**
 * Cible d'un fantassin : soldats et fantassins adverses ; Titans pour les fusils anti-Titans. La plus proche qu'il voit
 * (parmi les plus proches) ; s'il n'en voit aucune, la plus proche (il marche vers elle quand il attaque).
 */
function pickTarget(bt: Battle, tr: TroopUnit, preferSection: string | null): Target | null {
  const st = bt.state;
  // Les SIGHT_TRIES plus proches, dans l'ordre d'un tri stable (à distance égale, l'ordre d'ajout) : même tirage d'une partie à l'autre.
  const cands: { t: Target; d: number }[] = [];
  const consider = (t: Target, x: number, y: number, bonus = 1): void => {
    const d = d2(tr.x, tr.y, x, y) * bonus;
    let i = cands.length;
    while (i > 0 && (cands[i - 1] as { d: number }).d > d) i--;
    if (i >= SIGHT_TRIES) return;
    cands.splice(i, 0, { t, d });
    if (cands.length > SIGHT_TRIES) cands.pop();
  };
  for (const u of st.troops ?? []) {
    if (u.side === tr.side || !alive(u)) continue;
    consider({ kind: "troupe", index: u.id }, u.x, u.y, preferSection && u.section === preferSection ? 0.05 : 1);
  }
  if (tr.side === "ennemi") st.soldiers.forEach((s, i) => {
    if (alive(s) && s.mode !== "saisi") consider({ kind: "soldat", index: i }, s.x, s.y);
  });
  if (tr.kind === "antititan") for (const t of st.titans) {
    if (!t.alive) continue;
    const hostile = tr.side === "allie" ? !t.ally && (t.commanded ?? 0) <= 0 : t.ally === true || t.shifter === undefined;
    if (hostile) consider({ kind: "titan", index: t.id }, t.x, t.y, 0.5);
  }
  if (cands.length === 0) return null;
  for (const c of cands) {
    const p = posOf(bt, c.t);
    if (p && clearShot(bt, tr, p)) return c.t;
  }
  return (cands[0] as { t: Target }).t;
}

/** Pas d'un fantassin vers un point : il contourne les bâtiments et glisse le long des murs (`walkStep`). */
function moveToward(bt: Battle, tr: TroopUnit, x: number, y: number, v: number): void {
  const p = walkStep(bt.map, tr.x, tr.y, 0, x, y, v);
  const dx = p.x - tr.x;
  const dy = p.y - tr.y;
  if (Math.abs(dx) + Math.abs(dy) < 1e-9) return;
  tr.x = p.x;
  tr.y = p.y;
  tr.heading = Math.atan2(dy, dx);
}

/** Les Titans sans soldat à portée s'en prennent aux fantassins (les purs frappent tous les humains). */
function titansOnTroops(bt: Battle, rng: Rng, dt: number, rb: RtBalance): void {
  const st = bt.state;
  const b = bt.world.balance;
  const vision = bt.setup.night ? b.titans.vision_night_m : b.titans.vision_day_m;
  const activity = bt.setup.night ? b.titans.night_activity : 1;
  for (const t of st.titans) {
    if (!t.alive || t.shifter !== undefined || t.grabbing !== null || (t.commanded ?? 0) > 0 || t.target !== null || t.lure) continue;
    let best: TroopUnit | null = null;
    let bd = vision * vision;
    for (const u of st.troops ?? []) {
      if (!alive(u)) continue;
      const d = d2(t.x, t.y, u.x, u.y);
      if (d < bd) {
        bd = d;
        best = u;
      }
    }
    if (!best) continue;
    const d = Math.sqrt(bd);
    t.heading = Math.atan2(best.y - t.y, best.x - t.x);
    const reach = t.height * b.titans.reach_ratio + 2;
    if (d > reach * 0.8 && t.legs === 0) {
      // Par les rues : un Titan contourne les maisons (marge à la mesure de sa carrure).
      const v = Math.min(t.speed * activity * dt, d);
      const p = walkStep(bt.map, t.x, t.y, 0, best.x, best.y, v, Math.min(1.8, Math.max(1, t.height * 0.12)));
      t.x = p.x;
      t.y = p.y;
    }
    t.attackCooldown -= dt;
    if (d <= reach && t.attackCooldown <= 0 && (t.armL === 0 || t.armR === 0)) {
      const [c0, c1] = b.titans.attack_cooldown_s;
      t.attackCooldown = (c0 + (c1 - c0) * rng.next()) / activity / Math.pow(t.threat, b.titans.threat_attack_exponent);
      if (rng.next() < rb.titan_vs_troop_kill) killTroop(bt, best, rng.next() < 0.5 ? "devore" : "frappe");
    }
  }
}

/** Moral des sections : déroute au-delà des pertes ou sous le seuil ; la section se replie vers son bord. */
function sectionsMorale(bt: Battle, rb: RtBalance, h: TroopHooks): void {
  const st = bt.state;
  for (const sq of st.squads) {
    if (!sq.side || sq.order === "repli") continue;
    const all = (st.troops ?? []).filter((t) => t.section === sq.id);
    const up = all.filter(alive).length;
    if (up === 0) continue;
    const lost = 1 - up / Math.max(1, sq.size ?? all.length);
    if ((sq.morale ?? 100) < rb.rout_morale || lost >= rb.rout_losses_share) {
      sq.order = "repli";
      sq.dest = null;
      sq.queue = [];
      for (const t of all) delete t.rt;
      stats(bt).routs += 1;
      h.log(sq.side === "ennemi" ? "battle.rt.enemy_routs" : "battle.rt.section_routs", { squad: sq.id });
    } else if ((sq.morale ?? 100) < 100) sq.morale = Math.min(100, (sq.morale ?? 100) + 0.5);
  }
}

/** Un pas des fantassins (après les soldats). */
export function stepTroops(bt: Battle, dt: number, h: TroopHooks): void {
  const st = bt.state;
  const list = st.troops;
  if (!list || st.trRng === undefined) return;
  const rb = rtBalance(bt);
  const rng = Rng.fromState({ seed: fnv1a(`${bt.setup.seed}:troupes`), state: st.trRng });
  const s = stats(bt);
  if (st.tick % 20 === 0) sectionsMorale(bt, rb, h);
  titansOnTroops(bt, rng, dt, rb);
  const sections = new Map(st.squads.filter((x) => x.side).map((x) => [x.id, x]));
  for (const tr of list) {
    if (!alive(tr)) continue;
    const sq = sections.get(tr.section);
    if (!sq) continue;
    const w = rb.weapons[tr.kind];
    if (!w) continue;
    const speed = w.speed_m_s * (tr.wounded ? 0.5 : 1);
    const order = effectiveOrder(tr, sq);
    tr.reload -= dt;
    if (order === "repli") {
      tr.mode = "marche";
      const [x0, y0] = [tr.x, tr.y];
      moveToward(bt, tr, tr.x, sq.rally.y, speed * 1.3 * dt);
      // Arrivé au bord, ou arrêté par un mur tout près du bord (carte du mur) : hors du champ de bataille.
      const stuck = tr.x === x0 && tr.y === y0;
      if (Math.abs(tr.y - sq.rally.y) <= 1 || (stuck && Math.abs(tr.y - sq.rally.y) < 40)) tr.mode = "fui";
      continue;
    }
    const dest = destinationOf(bt, tr, sq);
    if (dest && Math.hypot(dest.x - tr.x, dest.y - tr.y) > 1) {
      tr.mode = "marche";
      moveToward(bt, tr, dest.x, dest.y, speed * dt);
      continue;
    }
    const prefer = order === "tuer" ? (tr.rt?.foe !== undefined ? (st.troops?.[tr.rt.foe]?.section ?? null) : sq.foe !== null && sq.foe !== undefined ? (st.troops?.[sq.foe]?.section ?? null) : null) : null;
    if (tr.target === null || st.tick % 10 === tr.id % 10) tr.target = pickTarget(bt, tr, prefer);
    const p = tr.target ? posOf(bt, tr.target) : null;
    if (!p || !p.up) {
      tr.target = null;
      // Sans cible : l'ennemi avance vers le bord de Paradis ; Paradis tient.
      if (tr.side === "ennemi" && order === "tuer") {
        tr.mode = "marche";
        moveToward(bt, tr, tr.x, bt.map.height - 2, speed * 0.5 * dt);
      } else tr.mode = "ligne";
      continue;
    }
    const d = Math.hypot(p.x - tr.x, p.y - tr.y);
    tr.heading = Math.atan2(p.y - tr.y, p.x - tr.x);
    const melee = d <= rb.melee_reach_m;
    const engage = w.range_m * rb.engage_share;
    // Pas de tir à travers une maison, un mur ou un rocher : on attend, ou on va chercher la ligne de tir.
    const sight = melee || clearShot(bt, tr, p);
    // « Attaquer » : marcher à portée de tir (ou au contact pour l'assaut et la cavalerie) ; « tenir », « couvrir » : sur place.
    const closeIn = order === "tuer" && (d > engage || !sight || ((tr.kind === "assaut" || tr.kind === "cavalier") && !melee));
    if (closeIn) {
      tr.mode = "marche";
      moveToward(bt, tr, p.x, p.y, speed * dt);
    } else tr.mode = "ligne";
    if (!sight) continue;
    if (tr.reload > 0 || (closeIn && !melee && tr.kind !== "assaut")) continue;
    if (d > w.range_m && !melee) continue;
    tr.reload = w.reload_s * (0.85 + 0.3 * rng.next());
    tr.shot = st.tick;
    const target = tr.target as Target;
    if (melee && target.kind !== "titan") {
      s.melee += 1;
      if (rng.next() >= w.melee) continue;
    } else {
      s.shots += 1;
      const air = p.z > 2 ? rb.air_hit_mult : 1;
      const morale = 0.5 + ((sq.morale ?? 100) / 100) * 0.5;
      const pHit = w.hit * (1 - (0.85 * d) / w.range_m) * air * (tr.wounded ? rb.wounded_hit_mult : 1) * morale;
      if (rng.next() >= pHit) continue;
      s.hits += 1;
    }
    if (target.kind === "soldat") {
      const v = st.soldiers[target.index];
      if (v && hitSoldier(bt, v, w.lethal, rng, h)) tr.kills += 1;
    } else if (target.kind === "troupe") {
      const v = st.troops?.[target.index];
      if (v && hitTroop(bt, v, w.lethal, rng, melee ? "lame" : "balle")) tr.kills += 1;
    } else {
      const ti = st.titans[target.index];
      // Fusil anti-Titan : membres immobilisés (régénération), comme un coup de canon léger.
      if (ti && w.vs_titan > 0) {
        ti.legs = Math.max(ti.legs, w.vs_titan);
        if (rng.next() < 0.5) ti.armL = Math.max(ti.armL, w.vs_titan / 2);
      }
    }
  }
  st.trRng = rng.serialize().state;
}

/**
 * Soldat de Paradis sans Titan à frapper (R2+) : il charge le fantassin ennemi le plus proche (ou celui de la section
 * désignée) et le frappe à la lame. Renvoie vrai si le pas est employé (au sol) ; en l'air, le soldat redescend.
 */
export function soldierVsTroops(bt: Battle, s: SoldierUnit, sq: SquadState, dt: number, h: TroopHooks): boolean {
  const st = bt.state;
  const list = st.troops;
  if (!list || st.trRng === undefined) return false;
  const rb = rtBalance(bt);
  const b = bt.world.balance;
  if (sq.order === "tenir" || sq.order === "suivre") {
    // Tenir : seulement les fantassins arrivés au contact (40 m).
    if (!list.some((u) => u.side === "ennemi" && alive(u) && d2(u.x, u.y, s.x, s.y) <= 1600)) return false;
  }
  const want = s.rt?.foe ?? sq.foe ?? null;
  const wanted = want !== null ? list[want] : undefined;
  const section = wanted && alive(wanted) ? wanted.section : null;
  let best: TroopUnit | null = null;
  let bd = Infinity;
  for (const u of list) {
    if (u.side !== "ennemi" || !alive(u)) continue;
    const d = d2(u.x, u.y, s.x, s.y) * (section && u.section === section ? 0.05 : 1);
    if (d < bd) {
      bd = d;
      best = u;
    }
  }
  if (!best) return false;
  const d = Math.hypot(best.x - s.x, best.y - s.y);
  const strike = d <= rb.melee_reach_m + (s.mode === "sol" ? 0 : 1.5) && s.z <= 3.5;
  if (!strike) {
    // En l'air : le vol continue (pas d'ODM ordinaire) ; au sol : crochet vers un ancrage qui rapproche (ville, forêt),
    // sinon à cheval ou à pied.
    if (s.mode !== "sol") return false;
    if (d > 20 && s.gas >= b.soldiers.gas_reserve) {
      const a = pickAnchor(s, bt.map, b, { x: best.x, y: best.y, z: 3 }, null);
      if (a) {
        s.anchor = a;
        s.mode = "crochet";
        s.hookTimer = hookDelay(s, b, s.stress >= b.soldiers.panic_threshold);
        return false;
      }
    }
    const v = Math.min(b.squads.flee_speed * dt * (s.wound === "aucune" ? 1 : 0.5), d - rb.melee_reach_m * 0.5);
    walkSoldier(bt, s, best.x, best.y, v);
    return true;
  }
  if (s.cutCooldown > 0 || s.changeTimer > 0 || s.pairs < 1) return s.mode === "sol";
  const rng = Rng.fromState({ seed: fnv1a(`${bt.setup.seed}:troupes`), state: st.trRng });
  const panic = s.stress >= b.soldiers.panic_threshold;
  const p = Math.max(0.05, Math.min(0.95, (rb.melee_base + rb.melee_skill_k * (s.melee - 50)) * (s.ackerman ? 1.5 : 1) * (panic ? 0.6 : 1) * (best.wounded ? 1.2 : 1)));
  s.cutCooldown = b.cut.cooldown_s * 2;
  const [w0, w1] = b.cut.wear_per_cut;
  s.wear += (w0 + (w1 - w0) * rng.next()) * 0.5;
  if (s.wear >= 1) {
    s.pairs -= 1;
    s.wear = 0;
    s.changeTimer = b.cut.change_blades_s;
    st.stats.bladesBroken += 1;
  }
  stats(bt).melee += 1;
  if (rng.next() < p && hitTroop(bt, best, 0.8, rng, "lame")) s.kills += 1;
  st.trRng = rng.serialize().state;
  void h;
  return s.mode === "sol";
}

/** Les fantassins d'un camp dans un disque (artillerie, capacités des porteurs). */
export function troopsIn(bt: Battle, side: "allie" | "ennemi" | null, x: number, y: number, r: number): TroopUnit[] {
  return (bt.state.troops ?? []).filter((u) => alive(u) && (side === null || u.side === side) && d2(u.x, u.y, x, y) <= r * r);
}

/** Le Titan visé par un fantassin anti-Titan existe-t-il encore ? (utilisé par l'affichage) */
export function troopTargetTitan(bt: Battle, tr: TroopUnit): TitanUnit | null {
  return tr.target?.kind === "titan" ? (bt.state.titans[tr.target.index] ?? null) : null;
}
