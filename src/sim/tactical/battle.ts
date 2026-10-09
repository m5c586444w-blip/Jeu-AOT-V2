import type { TacticalBalance } from "../../data/balance";
import { fnv1a } from "../core/hash";
import { Rng } from "../core/rng";
import type { ShifterWorld, TacticalWorld, World } from "../strategic/world";
import { generateMap } from "./map";
import { deployBatteries, enemyBatteriesActive, stepBatteries } from "./artillery";
import type { TacticalWorldMap } from "./map";
import { hookDelay, napeOf, pickAnchor, stepOdm } from "./odm";
import { bodyName, cutShifter, deployShifters, enemyShifterStanding, stepLuredTitan, stepShifter, throwSpear } from "./shifters";
import type { ShifterHooks } from "./shifters";
import { applyRtOrder, effectiveOrder, isRtOrder, soldierMarch, stepRealtime } from "./realtime";
import { deployTroops, enemyTroopsStanding, alliedTroopsStanding, soldierVsTroops, stepTroops, troopHooksOf } from "./troops";
import type { BattleDeathCause, BattleSetup, BattleState, SoldierUnit, SquadState, TimedOrder, TitanUnit } from "./types";

/**
 * Bataille tactique (03) : simulation à pas fixe (20 Hz) entièrement déterministe.
 * Même configuration + même graine + mêmes ordres → même bataille (AC4-06). La carte se régénère depuis la graine.
 */

export interface Battle {
  world: TacticalWorld;
  setup: BattleSetup;
  map: TacticalWorldMap;
  state: BattleState;
  /** Titans-porteurs (P6) ; null sans données des Neuf. */
  shiftersWorld: ShifterWorld | null;
  /** Monde complet quand la bataille a des batteries (PA.5 : pièces et munitions). */
  artillery?: World;
}

export function tacticalWorld(world: World): TacticalWorld {
  if (!world.tactical) throw new Error("monde sans couche tactique (P4)");
  return world.tactical;
}

const LOG_CAP = 400;

function log(st: BattleState, b: TacticalBalance, key: string, params: Record<string, string | number>): void {
  st.log.push({ t: Math.round((st.tick / b.tick_hz) * 10) / 10, key, params });
  if (st.log.length > LOG_CAP) st.log.splice(0, st.log.length - LOG_CAP);
}

/** Crochets donnés au module des porteurs (journal, mort d'un soldat). */
function hooks(bt: Battle, rng: Rng): ShifterHooks {
  return { log: (key, params) => log(bt.state, bt.world.balance, key, params), killSoldier: (s, titan) => kill(bt, s, "frappe", titan, rng) };
}

function rngOf(st: BattleState, seed: number): Rng {
  return Rng.fromState({ seed, state: st.rng });
}

/** Déploiement : les soldats au sud (escouades côte à côte), les Titans au nord, positions tirées par la graine. */
export function createBattle(world: World, setup: BattleSetup): Battle {
  const tw = tacticalWorld(world);
  const b = tw.balance;
  const def = tw.maps.get(setup.map);
  if (!def) throw new Error(`carte tactique inconnue : ${setup.map}`);
  const map = generateMap(def, setup.seed, b.battle.deploy_margin_m);
  const rng = new Rng(fnv1a(`${setup.seed}:bataille`));
  const squadIds = [...new Set(setup.soldiers.map((s) => s.squad))];
  const squads: SquadState[] = squadIds.map((id, i) => ({ id, order: "tuer", known: [], rally: { x: ((i + 0.5) / squadIds.length) * map.width, y: map.height - 5 } }));
  const soldiers: SoldierUnit[] = setup.soldiers.map((sp) => {
    const sq = squads.find((x) => x.id === sp.squad) as SquadState;
    return {
      ...sp,
      x: Math.max(1, Math.min(map.width - 1, sq.rally.x + (rng.next() - 0.5) * b.squads.spacing_m * 4)),
      y: map.height - 2 - rng.next() * (b.battle.deploy_margin_m - 4),
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      mode: "sol",
      anchor: null,
      hookTimer: 0,
      gas: b.odm.tank,
      wear: 0,
      pairs: 2,
      changeTimer: 0,
      cutCooldown: 0,
      target: null,
      wound: "aucune",
      bleedTimer: 0,
      stress: Math.max(0, 40 - sp.courage / 3 - sp.veteran * 3),
      grabbedBy: null,
      apex: 0,
      kills: 0,
      death: null,
      ...(setup.thunderSpears && world.shifters ? { spears: world.shifters.balance.soldiers.spears_per_soldier } : {}),
    };
  });
  const titans: TitanUnit[] = [];
  for (const g of setup.titans) {
    const tt = tw.titanTypes.get(g.type);
    if (!tt) throw new Error(`type de Titan inconnu : ${g.type}`);
    const cls = tw.titanClasses.get(tt.class);
    for (let k = 0; k < g.count; k++) {
      titans.push({
        id: titans.length,
        type: tt.id,
        behavior: tt.behavior,
        cls: tt.class,
        abnormal: cls?.abnormal ?? false,
        threat: cls?.threat ?? 1,
        height: tt.height_m[0] + (tt.height_m[1] - tt.height_m[0]) * rng.next(),
        speed: tt.speed_m_s,
        x: 20 + rng.next() * (map.width - 40),
        // De nuit, la bataille naît d'un contact à courte portée (D-62) : Titans déployés à portée de vue nocturne
        // des escouades (sinon personne ne se rencontre en 240 s). De jour, déploiement au bord opposé.
        y: setup.night ? map.height - b.battle.deploy_margin_m - b.titans.vision_night_m * (1 + rng.next()) : 4 + rng.next() * b.battle.deploy_margin_m,
        heading: Math.PI / 2,
        target: null,
        alive: true,
        armL: 0,
        armR: 0,
        legs: 0,
        attackCooldown: 1 + rng.next() * 2,
        grabbing: null,
        grabTimer: 0,
        silhouette: tt.silhouettes[Math.floor(rng.next() * tt.silhouettes.length)] ?? 0,
        killedBy: null,
      });
    }
  }
  const wagon = setup.wagon ? { x: map.width / 2, y: map.height - 8 } : null;
  // Porteurs (P6) : tirés après le reste, pour que les batailles sans porteur restent identiques.
  const shifters = deployShifters({ world: tw, setup, map, state: null as unknown as BattleState, shiftersWorld: world.shifters ?? null }, rng);
  // Batteries (PA.5) : tirage propre, après tout le reste.
  const art = deployBatteries(world, setup, map.width, map.height);
  // Troupes (R2+) : tirage propre (`trRng`), après les batteries ; sections ajoutées à la liste des escouades.
  const troops = deployTroops(tw, setup, map);
  const state: BattleState = {
    setupHash: fnv1a(JSON.stringify(setup)),
    tick: 0,
    rng: rng.serialize().state,
    soldiers,
    titans,
    squads: troops ? [...squads, ...troops.sections] : squads,
    wagon,
    ...(shifters.length > 0 ? { shifters } : {}),
    ...(art ? { batteries: art.batteries, artRng: art.artRng, impacts: [] } : {}),
    ...(troops ? { rt: true, troops: troops.troops, trRng: troops.trRng } : {}),
    log: [],
    signals: [],
    stats: { cuts: 0, napes: 0, limbs: 0, misses: 0, bladesBroken: 0, gasUsed: 0, dodges: 0, grabs: 0, rescues: 0, falls: 0, deathsByCause: {}, titansKilled: {} },
    ended: null,
  };
  log(state, b, "battle.start", { map: def.name_key, soldiers: soldiers.length, titans: titans.length, light: setup.night ? "battle.night" : "battle.day" });
  return { world: tw, setup, map, state, shiftersWorld: world.shifters ?? null, ...(art ? { artillery: world } : {}) };
}

const alive = (s: SoldierUnit): boolean => s.mode !== "mort" && s.mode !== "fui";
const dist2 = (ax: number, ay: number, bx: number, by: number): number => (ax - bx) ** 2 + (ay - by) ** 2;

function kill(bt: Battle, s: SoldierUnit, cause: BattleDeathCause, titan: TitanUnit | null, rng: Rng): void {
  const st = bt.state;
  const b = bt.world.balance;
  s.mode = "mort";
  s.anchor = null;
  s.death = { t: Math.round((st.tick / b.tick_hz) * 10) / 10, cause, titan: titan?.id ?? null, x: Math.round(s.x), y: Math.round(s.y) };
  st.stats.deathsByCause[cause] = (st.stats.deathsByCause[cause] ?? 0) + 1;
  log(st, b, `battle.death.${cause}`, { name: s.name, squad: s.squad, titan: titan ? bodyName(bt, titan) : "", n: titan ? titan.id + 1 : 0 });
  // Stress des témoins (03 §10) : mort d'un camarade, plus encore d'un chef.
  for (const o of st.soldiers) {
    if (!alive(o) || o.squad !== s.squad) continue;
    o.stress += s.leader ? b.soldiers.stress_leader_death : b.soldiers.stress_per_death_seen;
  }
  void rng;
}

/** Applique un ordre à une escouade (F-CMB-05) ; un repli lance une fusée verte (03 §7). */
export function applyOrder(bt: Battle, o: Omit<TimedOrder, "tick">): void {
  const st = bt.state;
  // R2+ : ordres temps réel (champs nouveaux, ou escouade déjà menée en temps réel).
  if (isRtOrder(bt, o)) {
    applyRtOrder(bt, o, (key, params) => log(st, bt.world.balance, key, params));
    return;
  }
  const sq = st.squads.find((x) => x.id === o.squad);
  if (!sq || o.order === "formation" || o.order === "tir_zone" || o.order === "cessez_feu" || o.order === "porteur" || o.order === "deplacer" || o.order === "suivre") return;
  sq.order = o.order;
  const leader = st.soldiers.find((s) => s.squad === sq.id && alive(s));
  if (o.target !== undefined) {
    for (const s of st.soldiers) if (s.squad === sq.id) s.target = o.target;
  }
  log(st, bt.world.balance, "battle.order", { squad: sq.id, order: `order.${o.order}` });
  if (o.order === "repli" && leader) st.signals.push({ t: st.tick / bt.world.balance.tick_hz, squad: sq.id, color: "vert", x: leader.x, y: leader.y, misread: false });
}

/** Cible d'un Titan selon son comportement (03 §5.1, §5.3 ; variantes [A]). */
function titanTarget(bt: Battle, t: TitanUnit, night: boolean): number | null {
  const b = bt.world.balance;
  const vision = night ? b.titans.vision_night_m : b.titans.vision_day_m;
  const cands: { s: SoldierUnit; d: number; crowd: number }[] = [];
  for (const s of bt.state.soldiers) {
    if (!alive(s) || s.mode === "saisi") continue;
    const d = Math.sqrt(dist2(t.x, t.y, s.x, s.y));
    const heard = s.mode === "rail" && d <= b.titans.hearing_m;
    if (d > vision * (t.behavior === "coureur" ? 2 : 1) && !heard) continue;
    cands.push({ s, d, crowd: 0 });
  }
  if (cands.length === 0) return null;
  for (const c of cands) for (const o of cands) if (o !== c && dist2(c.s.x, c.s.y, o.s.x, o.s.y) < 400) c.crowd++;
  let best = cands[0] as (typeof cands)[number];
  const score = (c: (typeof cands)[number]): number => {
    switch (t.behavior) {
      case "coureur":
        return -c.crowd * 30 + c.d * 0.2;
      case "ignorant":
        return -c.d;
      case "sauteur":
        return c.d - c.s.z * 3;
      default:
        return c.d / (1 + b.titans.group_attraction_k * c.crowd);
    }
  };
  for (const c of cands) if (score(c) < score(best)) best = c;
  if (t.behavior === "meute") {
    const pack = bt.state.titans.find((o) => o !== t && o.alive && o.target !== null && dist2(o.x, o.y, t.x, t.y) < 6400);
    if (pack?.target !== null && pack?.target !== undefined) return pack.target;
  }
  return bt.state.soldiers.indexOf(best.s);
}

function stepTitan(bt: Battle, t: TitanUnit, rng: Rng, dt: number): void {
  const b = bt.world.balance;
  const st = bt.state;
  const night = bt.setup.night;
  const activity = night ? b.titans.night_activity : 1;
  // Corps de porteur : mû par stepShifter. Pur rallié par le Fondateur : immobile. Pur attiré par un cri : vers l'appel.
  if (t.shifter !== undefined) return;
  if ((t.commanded ?? 0) > 0) {
    t.commanded = Math.max(0, (t.commanded ?? 0) - dt);
    return;
  }
  for (const k of ["armL", "armR", "legs"] as const) if (t[k] > 0) t[k] = Math.max(0, t[k] - dt);
  if (t.lure && t.grabbing === null && stepLuredTitan(bt, t, dt, rng, hooks(bt, rng))) return;
  if (t.grabbing !== null) {
    const v = st.soldiers[t.grabbing];
    t.grabTimer -= dt;
    if (!v || v.mode !== "saisi") t.grabbing = null;
    else if (t.grabTimer <= 0) {
      kill(bt, v, "devore", t, rng);
      t.grabbing = null;
    }
    return;
  }
  if (st.tick % 10 === t.id % 10 || t.target === null) t.target = titanTarget(bt, t, night);
  const target = t.target !== null ? st.soldiers[t.target] : undefined;
  if (!target || !alive(target)) {
    t.target = null;
    return;
  }
  const dx = target.x - t.x;
  const dy = target.y - t.y;
  const d = Math.hypot(dx, dy);
  t.heading = Math.atan2(dy, dx);
  const reach = t.height * b.titans.reach_ratio + 2;
  if (d > reach * 0.8 && t.legs === 0) {
    const v = t.speed * activity * dt;
    t.x += (dx / d) * Math.min(v, d);
    t.y += (dy / d) * Math.min(v, d);
  }
  t.attackCooldown -= dt;
  const reachZ = t.height * (t.behavior === "sauteur" ? 1.6 : t.behavior === "rampant" ? 0.5 : 1.1);
  const hand = t.armL === 0 || t.armR === 0;
  if (t.attackCooldown > 0 || !hand) return;
  // Frappe le soldat le plus proche à portée (sa cible de préférence) : s'accrocher à un Titan, c'est entrer dans sa portée.
  let victim: SoldierUnit | null = null;
  let best = Infinity;
  for (const s of st.soldiers) {
    if (!alive(s) || s.mode === "saisi" || s.z > reachZ) continue;
    const dd = Math.hypot(s.x - t.x, s.y - t.y) - (s === target ? 3 : 0);
    if (dd <= reach && dd < best) {
      best = dd;
      victim = s;
    }
  }
  if (!victim) return;
  const [c0, c1] = b.titans.attack_cooldown_s;
  t.attackCooldown = (c0 + (c1 - c0) * rng.next()) / activity / Math.pow(t.threat, b.titans.threat_attack_exponent);
  const sb = b.soldiers;
  const panic = victim.stress >= sb.panic_threshold;
  const pDodge = Math.max(0.05, Math.min(0.97, sb.dodge_base + sb.dodge_reaction_k * (victim.reaction - 50) + (victim.mode === "sol" ? 0 : sb.dodge_air_bonus) - (panic ? 0.2 : 0) + (victim.ackerman ? 0.3 : 0)));
  if (rng.next() < pDodge) {
    st.stats.dodges += 1;
    return;
  }
  if (rng.next() < 0.5) {
    victim.mode = "saisi";
    victim.grabbedBy = t.id;
    victim.anchor = null;
    t.grabbing = st.soldiers.indexOf(victim);
    t.grabTimer = b.titans.grab_hold_s;
    st.stats.grabs += 1;
    log(st, b, "battle.grabbed", { name: victim.name, titan: bodyName(bt, t), n: t.id + 1 });
  } else if (rng.next() < sb.swat_lethal) {
    kill(bt, victim, "frappe", t, rng);
  } else if (victim.wound !== "grave") {
    victim.wound = "grave";
    const [w0, w1] = sb.bleed_death_s;
    victim.bleedTimer = w0 + (w1 - w0) * rng.next();
    log(st, b, "battle.wounded", { name: victim.name });
  }
}

/** Escouade : cible commune (Titan connu le plus proche), fusée à chaque nouveau Titan repéré (03 §7, F-CMB-06). */
function updateSquads(bt: Battle, rng: Rng): void {
  const b = bt.world.balance;
  const st = bt.state;
  const night = bt.setup.night;
  for (const sq of st.squads) {
    const members = st.soldiers.filter((s) => s.squad === sq.id && alive(s));
    const leader = members.find((s) => s.leader) ?? members[0];
    if (!leader) continue;
    const sight = night ? b.titans.vision_night_m * 2 : b.signals.visibility_m;
    for (const t of st.titans) {
      if (!t.alive || t.ally || sq.known.includes(t.id)) continue;
      if (members.some((s) => dist2(s.x, s.y, t.x, t.y) <= sight * sight)) {
        sq.known.push(t.id);
        const misread = rng.next() < (night ? b.signals.error_night : b.signals.error_day);
        st.signals.push({ t: st.tick / b.tick_hz, squad: sq.id, color: t.abnormal ? "noir" : "rouge", x: leader.x, y: leader.y, misread });
        if (t.abnormal) for (const s of members) s.stress += b.soldiers.stress_abnormal_seen;
        // Fusée vue par les autres escouades, sauf erreur de lecture.
        if (!misread) for (const o of st.squads) if (o !== sq && !o.known.includes(t.id)) o.known.push(t.id);
      }
    }
    // Repli automatique quand l'escouade a perdu la moitié de ses hommes (règle de formation, 03 §6).
    const total = st.soldiers.filter((s) => s.squad === sq.id).length;
    if (sq.order !== "repli" && members.length <= total * (1 - b.squads.retreat_losses_share)) {
      sq.order = "repli";
      st.signals.push({ t: st.tick / b.tick_hz, squad: sq.id, color: "vert", x: leader.x, y: leader.y, misread: false });
      log(st, b, "battle.squad_retreats", { squad: sq.id });
    }
  }
}

function chooseTarget(bt: Battle, s: SoldierUnit, sq: SquadState): TitanUnit | null {
  const st = bt.state;
  const current = s.target !== null ? st.titans[s.target] : undefined;
  if (current?.alive && !current.ally && sq.order !== "couvrir") return current;
  let best: TitanUnit | null = null;
  let bestD = Infinity;
  for (const id of sq.known) {
    const t = st.titans[id];
    if (!t?.alive || t.ally) continue;
    // Couvrir : le Titan qui menace (vise) un camarade ; sinon le plus proche.
    const threat = sq.order === "couvrir" && t.target !== null && st.soldiers[t.target]?.squad === sq.id ? 0.3 : 1;
    const d = Math.sqrt(dist2(s.x, s.y, t.x, t.y)) * threat;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  if ((sq.order === "tenir" || sq.order === "suivre" || sq.order === "deplacer") && best && bestD > 40) return null;
  s.target = best?.id ?? null;
  return best;
}

/** Tentative de coupe (03 §4.2) : nuque = mort ; sinon membre coupé (repousse) ou échec. Use et casse des lames. */
export function tryCut(bt: Battle, s: SoldierUnit, t: TitanUnit, rng: Rng): void {
  const b = bt.world.balance;
  const c = b.cut;
  const st = bt.state;
  st.stats.cuts += 1;
  const speed = Math.hypot(s.vx, s.vy, s.vz);
  // Angle : approche par l'arrière de la nuque (opposée au regard du Titan).
  const back = Math.cos(t.heading) * (s.x - t.x) + Math.sin(t.heading) * (s.y - t.y);
  const angle = back < 0 ? 1 : 0.4;
  const p = Math.max(0.03, Math.min(0.95, c.base * (1 + c.speed_k * (Math.min(speed, c.speed_ref * 1.5) / c.speed_ref - 1)) * (1 + c.angle_k * (angle - 0.7)) * (1 + c.skill_k * (s.odm - 50)) * (1 - s.wear * 0.5) * (s.ackerman ? 1.5 : 1) * (s.stress >= b.soldiers.panic_threshold ? 0.6 : 1) * Math.pow(t.threat, -c.threat_exponent)));
  const roll = rng.next();
  const [w0, w1] = c.wear_per_cut;
  s.wear += w0 + (w1 - w0) * rng.next();
  s.cutCooldown = c.cooldown_s;
  if (t.shifter !== undefined) {
    // Porteur (P6) : la coupe entame une zone (armure, durcissement, onde de chaleur) au lieu de tuer d'un coup.
    cutShifter(bt, s, t, roll < p ? "nape" : roll < p + c.limb_share * (1 - p) ? "limb" : "miss", rng, hooks(bt, rng));
  } else if (roll < p) {
    t.alive = false;
    t.grabbing = null;
    t.killedBy = st.soldiers.indexOf(s);
    s.kills += 1;
    st.stats.napes += 1;
    st.stats.cutsLanded = (st.stats.cutsLanded ?? 0) + 1;
    st.stats.killedBy = { ...st.stats.killedBy, lame: (st.stats.killedBy?.lame ?? 0) + 1 };
    st.stats.titansKilled[t.type] = (st.stats.titansKilled[t.type] ?? 0) + 1;
    for (const v of st.soldiers) if (v.mode === "saisi" && v.grabbedBy === t.id) {
      v.mode = "vol";
      v.grabbedBy = null;
    }
    log(st, b, "battle.nape", { name: s.name, titan: bodyName(bt, t), n: t.id + 1 });
  } else if (roll < p + c.limb_share * (1 - p)) {
    st.stats.limbs += 1;
    st.stats.cutsLanded = (st.stats.cutsLanded ?? 0) + 1;
    const limb = t.legs === 0 && rng.next() < 0.4 ? "legs" : t.armL === 0 ? "armL" : "armR";
    t[limb] = b.titans.limb_regen_s;
    // Un bras coupé libère le camarade saisi (sauvetage, 03 §4.3, F-CMB-18).
    if (limb !== "legs" && t.grabbing !== null) {
      const v = st.soldiers[t.grabbing];
      if (v && v.mode === "saisi") {
        v.mode = "vol";
        v.grabbedBy = null;
        st.stats.rescues += 1;
        log(st, b, "battle.rescued", { name: v.name, by: s.name });
      }
      t.grabbing = null;
    }
  } else st.stats.misses += 1;
  if (s.wear >= 1) {
    s.pairs -= 1;
    s.wear = 0;
    s.changeTimer = c.change_blades_s;
    st.stats.bladesBroken += 1;
  }
}

function stepSoldier(bt: Battle, s: SoldierUnit, rng: Rng, dt: number): void {
  const b = bt.world.balance;
  const st = bt.state;
  const sq = st.squads.find((x) => x.id === s.squad) as SquadState;
  s.stress = Math.max(0, s.stress - b.soldiers.stress_decay_per_s * dt);
  const panic = s.stress >= b.soldiers.panic_threshold;
  if (s.wound === "grave") {
    s.bleedTimer -= dt;
    if (s.bleedTimer <= 0) return kill(bt, s, "hemorragie", null, rng);
  }
  if (s.mode === "saisi") return;
  if (s.changeTimer > 0) s.changeTimer -= dt;
  if (s.cutCooldown > 0) s.cutCooldown -= dt;
  // R2+ : ordre propre du soldat, marche en formation (sans attaque pendant la marche).
  const march = st.rt ? soldierMarch(bt, s, sq, dt) : null;
  const order = st.rt ? effectiveOrder(s, sq) : sq.order;
  const sqe: SquadState = order === sq.order ? sq : { ...sq, order };
  if (march?.walked) return;
  // Chariot de soutien : gaz et lames au sol, à proximité (F-CMB-14).
  if (st.wagon && s.mode === "sol" && dist2(s.x, s.y, st.wagon.x, st.wagon.y) <= b.resupply.radius_m ** 2) {
    s.gas = Math.min(b.odm.tank, s.gas + b.resupply.gas_per_s * dt);
    if (s.pairs < 2) s.pairs = Math.min(2, s.pairs + b.resupply.blades_per_s * dt);
  }
  const before = s.gas;
  // Repli : vers le point de ralliement au sud, puis hors de la carte.
  // Réserve de gaz : en dessous, plus de nouveau crochet ; on se pose (descente freinée) puis on se replie.
  const lowGas = s.gas < b.soldiers.gas_reserve;
  if (sqe.order === "repli" || (lowGas && s.mode === "sol") || (s.pairs < 1 && s.mode === "sol")) {
    if (s.mode === "sol") {
      const dx = sq.rally.x - s.x;
      const dy = bt.map.height - s.y;
      const d = Math.hypot(dx, dy) || 1;
      const v = b.squads.flee_speed * dt;
      s.x += (dx / d) * Math.min(v, d);
      s.y += (dy / d) * Math.min(v, d);
      if (s.y >= bt.map.height - 1) {
        s.mode = "fui";
        log(st, b, "battle.fled", { name: s.name });
      }
      return;
    }
  }
  const t = sqe.order === "repli" || march?.moving ? null : chooseTarget(bt, s, sqe);
  // R2+ : sans Titan à frapper, un soldat s'en prend aux fantassins ennemis (mêlée).
  if (!t && !march?.moving && st.troops && sqe.order !== "repli" && soldierVsTroops(bt, s, sqe, dt, troopHooksOf(bt, (key, params) => log(st, b, key, params)))) return;
  // Lance de foudre (T-ANT-08) : tirée à portée sur un porteur, avant toute coupe.
  if (t?.shifter !== undefined && (s.spears ?? 0) > 0 && s.cutCooldown <= 0 && s.changeTimer <= 0) throwSpear(bt, s, t, rng, hooks(bt, rng));
  if (s.mode === "sol" || s.mode === "vol") {
    if (t && !lowGas && s.pairs >= 1) {
      const nape = napeOf(t, b);
      const dNape = Math.hypot(nape.x - s.x, nape.y - s.y, nape.z - s.z);
      if (dNape <= b.cut.reach_m && s.cutCooldown <= 0 && s.changeTimer <= 0) tryCut(bt, s, t, rng);
      else if (s.mode === "sol" && Math.hypot(t.x - s.x, t.y - s.y) > b.odm.hook_range_m * 0.9) {
        // À cheval vers le Titan tant qu'aucun ancrage n'est à portée (plaine).
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        s.x += (dx / d) * b.squads.flee_speed * dt;
        s.y += (dy / d) * b.squads.flee_speed * dt;
      } else {
        const a = pickAnchor(s, bt.map, b, nape, t);
        if (a) {
          s.anchor = a;
          s.mode = "crochet";
          s.hookTimer = hookDelay(s, b, panic);
        }
      }
    }
  } else if (s.mode === "crochet") {
    s.hookTimer -= dt;
    if (s.hookTimer <= 0) s.mode = "rail";
  }
  if (s.mode === "rail" && t && s.cutCooldown <= 0 && s.changeTimer <= 0 && s.pairs >= 1) {
    const nape = napeOf(t, b);
    if (Math.hypot(nape.x - s.x, nape.y - s.y, nape.z - s.z) <= b.cut.reach_m) tryCut(bt, s, t, rng);
  }
  const res = stepOdm(s, bt.map, b, st.titans, dt, panic, b.soldiers.panic_gas_waste);
  st.stats.gasUsed += before - s.gas;
  if (before > 0 && s.gas <= 0) s.stress += b.soldiers.stress_gas_empty;
  if (res.fall > b.odm.safe_fall_m) {
    st.stats.falls += 1;
    const k = (res.fall - b.odm.safe_fall_m) / (b.odm.lethal_fall_m - b.odm.safe_fall_m);
    if (rng.next() < Math.min(1, k)) kill(bt, s, "chute", null, rng);
    else if (s.wound === "aucune") s.wound = "legere";
  }
}

/** Un pas de simulation (1/20 s). Les ordres du pas sont appliqués avant. */
export function stepBattle(bt: Battle, orders: readonly TimedOrder[] = []): void {
  const st = bt.state;
  if (st.ended) return;
  const b = bt.world.balance;
  const dt = 1 / b.tick_hz;
  for (const o of orders) if (o.tick === st.tick) applyOrder(bt, o);
  const rng = rngOf(st, bt.setup.seed);
  if (st.rt) stepRealtime(bt, (key, params) => log(st, b, key, params));
  if (st.tick % 4 === 0) updateSquads(bt, rng);
  for (const t of st.titans) if (t.alive) stepTitan(bt, t, rng, dt);
  if (st.shifters) {
    const h = hooks(bt, rng);
    for (const u of st.shifters) stepShifter(bt, u, rng, dt, h);
  }
  for (const s of st.soldiers) if (alive(s)) stepSoldier(bt, s, rng, dt);
  if (st.troops) stepTroops(bt, dt, troopHooksOf(bt, (key, params) => log(st, b, key, params), (s, cause) => kill(bt, s, cause, null, rng)));
  if (st.batteries && bt.artillery) stepBatteries(bt, bt.artillery, dt, { alive, kill: (s) => kill(bt, s, "eclat", null, rng), log: (key, params) => log(st, b, key, params) });
  st.tick += 1;
  st.rng = rng.serialize().state;
  const t = st.tick / b.tick_hz;
  // R2+ : les fantassins de Paradis comptent parmi les hommes debout ; les sections ennemies empêchent la victoire.
  const standing = st.soldiers.filter(alive).length + (st.troops ? alliedTroopsStanding(bt) : 0);
  const limit = bt.setup.timeLimit ?? b.battle.time_limit_s;
  // Victoire : plus aucun Titan hostile debout (un porteur ennemi pas encore transformé compte).
  if (st.titans.every((x) => !x.alive || x.ally) && !enemyShifterStanding(bt) && !enemyBatteriesActive(bt) && !(st.troops && enemyTroopsStanding(bt))) st.ended = { reason: "victoire", t };
  else if (standing === 0) st.ended = { reason: st.soldiers.some((s) => s.mode === "fui") || (st.troops ?? []).some((x) => x.side === "allie" && x.mode === "fui") ? "repli" : "defaite", t };
  else if (t >= limit) st.ended = { reason: "temps", t };
  if (st.ended) log(st, b, `battle.end.${st.ended.reason}`, { dead: st.soldiers.filter((s) => s.mode === "mort").length, total: st.soldiers.length });
}

export interface BattleResult {
  state: BattleState;
  dead: SoldierUnit[];
  survivors: SoldierUnit[];
}

/** Bataille complète, jouée jusqu'au bout avec les ordres donnés (rejeu exact, F-CMB-30). */
export function runBattle(world: World, setup: BattleSetup, orders: readonly TimedOrder[] = []): BattleResult {
  const bt = createBattle(world, setup);
  const byTick = new Map<number, TimedOrder[]>();
  for (const o of orders) byTick.set(o.tick, [...(byTick.get(o.tick) ?? []), o]);
  const limit = Math.ceil((setup.timeLimit ?? bt.world.balance.battle.time_limit_s) * bt.world.balance.tick_hz) + 1;
  for (let i = 0; i < limit && !bt.state.ended; i++) stepBattle(bt, byTick.get(bt.state.tick) ?? []);
  return { state: bt.state, dead: bt.state.soldiers.filter((s) => s.mode === "mort"), survivors: bt.state.soldiers.filter((s) => s.mode !== "mort") };
}

/** Empreinte d'une bataille (déterminisme, AC4-06). */
export function battleHash(st: BattleState): number {
  return fnv1a(JSON.stringify([st.tick, st.rng, st.soldiers.map((s) => [s.mode, Math.round(s.x * 100), Math.round(s.y * 100), Math.round(s.z * 100), Math.round(s.gas * 100)]), st.titans.map((t) => [t.alive, Math.round(t.x * 100), Math.round(t.y * 100)])]));
}
