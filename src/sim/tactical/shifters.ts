import type { ShiftersBalance } from "../../data/balance";
import type { Shifter, ShifterAbility } from "../../data/schemas";
import type { Rng } from "../core/rng";
import type { Battle } from "./battle";
import type { AbilityStat, ShifterUnit, SoldierUnit, TitanUnit } from "./types";

/**
 * Titans-porteurs en bataille (P6 ; 03 §8) : transformation (délai, endurance, recharge), points de vie par zones,
 * régénération qui consomme l'endurance, durcissement, perte de contrôle, et les capacités des Neuf à effets mesurés.
 * Le corps transformé est une entrée de `titans` (rendu, ciblage et coupes communs) liée à son porteur par `shifter`.
 */

export type ShifterHooks = {
  log: (key: string, params: Record<string, string | number>) => void;
  killSoldier: (s: SoldierUnit, titan: TitanUnit | null) => void;
};

const alive = (s: SoldierUnit): boolean => s.mode !== "mort" && s.mode !== "fui";
const d2 = (ax: number, ay: number, bx: number, by: number): number => (ax - bx) ** 2 + (ay - by) ** 2;

export function shiftersBalance(bt: Battle): ShiftersBalance | null {
  return bt.shiftersWorld?.balance ?? null;
}

function defOf(bt: Battle, u: ShifterUnit): Shifter | undefined {
  return bt.shiftersWorld?.defs.get(u.shifter);
}

function ability(def: Shifter | undefined, effect: ShifterAbility["effect"]): ShifterAbility | undefined {
  return def?.abilities.find((a) => a.effect === effect);
}

function stat(bt: Battle, id: string): AbilityStat {
  const st = bt.state.stats;
  st.abilities ??= {};
  return (st.abilities[id] ??= { uses: 0, effect: 0 });
}

/** Nom affiché d'un corps de Titan (pur ou porteur). */
export function bodyName(bt: Battle, t: TitanUnit): string {
  if (t.shifter !== undefined) return bt.shiftersWorld?.defs.get(bt.state.shifters?.[t.shifter]?.shifter ?? "")?.name_key ?? t.type;
  return bt.world.titanTypes.get(t.type)?.name_key ?? t.type;
}

/** Déploiement : l'allié avec les escouades (sud), l'ennemi au nord ; transformation après 1 à 3 s (03 §8.1). */
export function deployShifters(bt: Battle, rng: Rng): ShifterUnit[] {
  const sb = shiftersBalance(bt);
  const specs = bt.setup.shifters ?? [];
  if (!sb || specs.length === 0) return [];
  const margin = bt.world.balance.battle.deploy_margin_m;
  return specs.map((sp, id) => {
    const def = bt.shiftersWorld?.defs.get(sp.shifter);
    if (!def) throw new Error(`Titan-porteur inconnu : ${sp.shifter}`);
    const endurance = def.endurance;
    const [t0, t1] = sb.transform_delay_s;
    return {
      id,
      shifter: sp.shifter,
      side: sp.side,
      name: sp.name,
      character: sp.character,
      phase: "humain",
      x: bt.map.width * (0.35 + 0.3 * rng.next()),
      y: sp.side === "allie" ? bt.map.height - margin * 0.6 : margin * 0.6,
      body: null,
      timer: t0 + (t1 - t0) * rng.next(),
      cooldown: 0,
      endurance,
      maxEndurance: endurance,
      hp: { nape: def.hp.nape, armL: def.hp.arm, armR: def.hp.arm, legs: def.hp.leg },
      maxHp: { ...def.hp },
      hardened: 0,
      cd: {},
      active: {},
      stress: sp.stress,
      rampage: 0,
      attackCooldown: 1,
      kills: 0,
    };
  });
}

/** Le porteur encore humain (ou en transformation) compte comme un ennemi debout : pas de victoire avant sa défaite. */
export function enemyShifterStanding(bt: Battle): boolean {
  return (bt.state.shifters ?? []).some((u) => u.side === "ennemi" && (u.phase === "humain" || u.phase === "transformation" || u.phase === "titan"));
}

function transform(bt: Battle, u: ShifterUnit, sb: ShiftersBalance): void {
  const def = defOf(bt, u);
  if (!def) return;
  const st = bt.state;
  u.endurance -= sb.transform_cost;
  u.phase = "titan";
  const body: TitanUnit = {
    id: st.titans.length,
    type: u.shifter,
    behavior: "porteur",
    cls: "porteur",
    abnormal: true,
    threat: 3,
    height: (def.height_m[0] + def.height_m[1]) / 2,
    speed: def.speed_m_s * (ability(def, "speed")?.power ?? 1),
    x: u.x,
    y: u.y,
    heading: u.side === "allie" ? -Math.PI / 2 : Math.PI / 2,
    target: null,
    alive: true,
    armL: 0,
    armR: 0,
    legs: 0,
    attackCooldown: 1,
    grabbing: null,
    grabTimer: 0,
    silhouette: 0,
    killedBy: null,
    shifter: u.id,
    ...(u.side === "allie" ? { ally: true } : {}),
  };
  st.titans.push(body);
  u.body = body.id;
  st.stats.transformations = (st.stats.transformations ?? 0) + 1;
}

/** Fin du corps : nuque tranchée (vaincu) ou endurance à zéro (détransformation forcée, épuisé). */
function endBody(bt: Battle, u: ShifterUnit, phase: "vaincu" | "epuise", h: ShifterHooks): void {
  const body = u.body !== null ? bt.state.titans[u.body] : undefined;
  if (body) {
    body.alive = false;
    body.grabbing = null;
    u.x = body.x;
    u.y = body.y;
  }
  u.phase = phase;
  u.cooldown = shiftersBalance(bt)?.transform_cooldown_s ?? 30;
  h.log(phase === "vaincu" ? "battle.shifter.defeated" : "battle.shifter.exhausted", { name: u.name, titan: defOf(bt, u)?.name_key ?? u.shifter });
}

/** Dégâts sur une zone du corps (lames, lances, coups de porteur, purs). Renvoie les dégâts effectifs. */
export function damageShifter(bt: Battle, u: ShifterUnit, zone: "nape" | "armL" | "armR" | "legs", raw: number, opts: { pierce: boolean; source: "lame" | "lance" | "porteur" | "pur" }, h: ShifterHooks): number {
  const def = defOf(bt, u);
  const sb = shiftersBalance(bt);
  if (!def || !sb || u.phase !== "titan") return 0;
  let dmg = raw;
  // Armure durcie (Cuirassé) et durcissement local (Féminin) : les lames y perdent l'essentiel ; les lances de foudre percent (13 T-ANT-08).
  if (!opts.pierce) {
    const armor = ability(def, "armor");
    if (armor) {
      const kept = raw * armor.power;
      stat(bt, armor.id).effect += raw - kept;
      dmg = kept;
    }
    const hard = ability(def, "hardening");
    if (zone === "nape" && u.hardened > 0 && hard) {
      stat(bt, hard.id).effect += dmg * hard.power;
      dmg *= 1 - hard.power;
    }
  }
  // Corps à distance (Marteau de guerre) : le porteur n'est pas dans la nuque ; elle encaisse bien davantage.
  const remote = ability(def, "remote_body");
  if (zone === "nape" && remote) {
    const kept = dmg / remote.power;
    stat(bt, remote.id).effect += dmg - kept;
    dmg = kept;
  }
  u.hp[zone] = Math.max(0, u.hp[zone] - dmg);
  u.stress += dmg * sb.wound_stress_per_hp;
  if (opts.source === "lame") bt.state.stats.bladeDamage = (bt.state.stats.bladeDamage ?? 0) + dmg;
  if (u.hp.nape <= 0) endBody(bt, u, "vaincu", h);
  return dmg;
}

/** Coupe d'un soldat sur un corps de porteur (issue tirée par tryCut) : nuque, membre ou rien. Onde de chaleur : intouchable. */
export function cutShifter(bt: Battle, s: SoldierUnit, body: TitanUnit, outcome: "nape" | "limb" | "miss", rng: Rng, h: ShifterHooks): void {
  const u = body.shifter !== undefined ? bt.state.shifters?.[body.shifter] : undefined;
  const sb = shiftersBalance(bt);
  if (!u || !sb) return;
  const heat = ability(defOf(bt, u), "heat_wave");
  if (heat && (u.active[heat.id] ?? 0) > 0) {
    stat(bt, heat.id).effect += 1;
    s.stress += 5;
    return;
  }
  if (outcome === "miss") return;
  const zone = outcome === "nape" ? "nape" : rng.next() < 0.4 ? "legs" : rng.next() < 0.5 ? "armL" : "armR";
  damageShifter(bt, u, zone, sb.soldiers.cut_damage, { pierce: false, source: "lame" }, h);
}

/** Lance de foudre (T-ANT-08) : tir à portée sur un corps de porteur ; perce l'armure et le durcissement. */
export function throwSpear(bt: Battle, s: SoldierUnit, body: TitanUnit, rng: Rng, h: ShifterHooks): boolean {
  const sb = shiftersBalance(bt);
  const u = body.shifter !== undefined ? bt.state.shifters?.[body.shifter] : undefined;
  if (!sb || !u || !s.spears || s.spears <= 0) return false;
  if (d2(s.x, s.y, body.x, body.y) > sb.soldiers.spear_range_m ** 2) return false;
  s.spears -= 1;
  s.cutCooldown = bt.world.balance.cut.cooldown_s * 2;
  const sp = (bt.state.stats.spears ??= { thrown: 0, hits: 0, damage: 0 });
  sp.thrown += 1;
  if (rng.next() >= sb.soldiers.spear_hit) return true;
  sp.hits += 1;
  const zone = rng.next() < 0.5 ? "nape" : rng.next() < 0.5 ? "legs" : "armL";
  sp.damage += damageShifter(bt, u, zone, sb.soldiers.spear_damage, { pierce: true, source: "lance" }, h);
  return true;
}

type Foe = { kind: "soldat"; s: SoldierUnit } | { kind: "titan"; t: TitanUnit };

/** Ennemis d'un porteur : soldats et corps alliés pour l'ennemi ; purs et corps ennemis pour l'allié. En rage : tout le monde. */
function foes(bt: Battle, u: ShifterUnit): Foe[] {
  const out: Foe[] = [];
  const st = bt.state;
  const rage = u.rampage > 0;
  for (const t of st.titans) {
    if (!t.alive || t.id === u.body) continue;
    if (rage) out.push({ kind: "titan", t });
    else if (u.side === "allie" && !t.ally && (t.commanded ?? 0) <= 0) out.push({ kind: "titan", t });
    else if (u.side === "ennemi" && t.ally) out.push({ kind: "titan", t });
  }
  if (u.side === "ennemi" || rage) for (const s of st.soldiers) if (alive(s) && s.mode !== "saisi") out.push({ kind: "soldat", s });
  return out;
}

const pos = (f: Foe): { x: number; y: number } => (f.kind === "soldat" ? f.s : f.t);

function nearest(list: Foe[], x: number, y: number): { f: Foe; d: number } | null {
  let best: { f: Foe; d: number } | null = null;
  for (const f of list) {
    const p = pos(f);
    const d = Math.sqrt(d2(x, y, p.x, p.y));
    if (!best || d < best.d) best = { f, d };
  }
  return best;
}

/** Frappe un ennemi : un pur meurt (probabilité), un porteur perd des points de vie, un soldat est tué s'il n'esquive pas. */
function strike(bt: Battle, u: ShifterUnit, body: TitanUnit, f: Foe, killProb: number, rng: Rng, h: ShifterHooks): number {
  const sb = shiftersBalance(bt);
  if (!sb) return 0;
  if (f.kind === "soldat") {
    if (rng.next() < killProb * (f.s.ackerman ? 0.3 : 1)) {
      h.killSoldier(f.s, body);
      u.kills += 1;
      return 1;
    }
    bt.state.stats.dodges += 1;
    return 0;
  }
  const t = f.t;
  if (t.shifter !== undefined) {
    const v = bt.state.shifters?.[t.shifter];
    if (!v) return 0;
    const zone = rng.next() < 0.3 ? "nape" : rng.next() < 0.5 ? "armL" : "legs";
    return damageShifter(bt, v, zone, sb.attack.shifter_damage, { pierce: false, source: "porteur" }, h) > 0 ? 1 : 0;
  }
  if (rng.next() < killProb) {
    t.alive = false;
    t.grabbing = null;
    for (const v of bt.state.soldiers) if (v.mode === "saisi" && v.grabbedBy === t.id) {
      v.mode = "vol";
      v.grabbedBy = null;
    }
    bt.state.stats.titansKilled[t.type] = (bt.state.stats.titansKilled[t.type] ?? 0) + 1;
    u.kills += 1;
    h.log("battle.shifter.kills_titan", { name: u.name, titan: bodyName(bt, t) });
    return 1;
  }
  return 0;
}

/** Tue (probabilité `p`) les ennemis dans un disque : projectiles, pieux, onde de chaleur, charge. */
function area(bt: Battle, u: ShifterUnit, body: TitanUnit, x: number, y: number, r: number, p: number, rng: Rng, h: ShifterHooks): number {
  let n = 0;
  for (const f of foes(bt, u)) {
    const q = pos(f);
    if (d2(x, y, q.x, q.y) > r * r) continue;
    n += strike(bt, u, body, f, p, rng, h);
  }
  return n;
}

/** Une capacité active, si son déclencheur tient (IA du porteur). Renvoie vrai si elle a servi. */
function useAbility(bt: Battle, u: ShifterUnit, body: TitanUnit, a: ShifterAbility, target: { f: Foe; d: number } | null): boolean {
  const st = bt.state;
  const reach = body.height * (shiftersBalance(bt)?.attack.reach_ratio ?? 0.6);
  const foesAll = foes(bt, u);
  switch (a.effect) {
    case "heat_wave": {
      // Vapeur brûlante : déclenchée quand des ennemis approchent de la nuque.
      const near = foesAll.filter((f) => d2(pos(f).x, pos(f).y, body.x, body.y) <= a.radius_m ** 2).length;
      return near >= 2;
    }
    case "charge":
      return target !== null && target.d > reach + 10 && target.d <= a.range_m;
    case "hardening":
      return foesAll.some((f) => f.kind === "soldat" && d2(f.s.x, f.s.y, body.x, body.y) <= 15 * 15);
    case "call":
      return u.hp.nape < u.maxHp.nape * 0.7 || foesAll.filter((f) => f.kind === "soldat" && d2(f.s.x, f.s.y, body.x, body.y) <= 30 * 30).length >= 3;
    case "projectiles":
      return target !== null && target.d > reach && target.d <= a.range_m;
    case "bite":
      return target !== null && target.d <= reach + a.range_m;
    case "transport":
      return u.side === "allie" && st.soldiers.some((s) => alive(s) && s.gas < bt.world.balance.odm.tank * 0.5 && d2(s.x, s.y, body.x, body.y) <= a.radius_m ** 2);
    case "spikes":
      return target !== null && target.d <= a.range_m;
    case "melee_titans":
      return target !== null && target.d <= reach + a.range_m && target.f.kind === "titan";
    case "founder_command":
      if (a.requires_flag && !(bt.setup.flags ?? []).includes(a.requires_flag)) return false;
      return st.titans.some((t) => t.alive && t.shifter === undefined && (t.commanded ?? 0) <= 0);
    default:
      return false;
  }
}

/** Effet d'une capacité activée (mesuré dans `stats.abilities[id].effect`). */
function applyAbility(bt: Battle, u: ShifterUnit, body: TitanUnit, a: ShifterAbility, target: { f: Foe; d: number } | null, rng: Rng, h: ShifterHooks): void {
  const st = bt.state;
  const s = stat(bt, a.id);
  s.uses += 1;
  switch (a.effect) {
    case "charge": {
      if (!target) return;
      // Ruée en ligne droite jusqu'à la cible : renverse ce qui se trouve sur le passage.
      const p = pos(target.f);
      const steps = 8;
      for (let i = 1; i <= steps; i++) s.effect += area(bt, u, body, body.x + ((p.x - body.x) * i) / steps, body.y + ((p.y - body.y) * i) / steps, a.radius_m, a.power, rng, h);
      body.x = p.x;
      body.y = p.y;
      return;
    }
    case "hardening":
      u.hardened = a.duration_s;
      return;
    case "call": {
      for (const t of st.titans) {
        if (!t.alive || t.shifter !== undefined || d2(t.x, t.y, body.x, body.y) > a.radius_m ** 2) continue;
        t.lure = { x: body.x, y: body.y, t: 30 };
        s.effect += 1;
      }
      return;
    }
    case "projectiles": {
      if (!target) return;
      const p = pos(target.f);
      s.effect += area(bt, u, body, p.x, p.y, a.radius_m, a.power, rng, h);
      return;
    }
    case "bite": {
      if (!target) return;
      const f = target.f;
      if (f.kind === "titan" && f.t.shifter !== undefined) {
        const v = st.shifters?.[f.t.shifter];
        // La mâchoire brise le durcissement : dégâts directs sur la nuque.
        if (v) s.effect += damageShifter(bt, v, "nape", v.maxHp.nape * a.power * 0.5, { pierce: true, source: "porteur" }, h);
      } else s.effect += strike(bt, u, body, f, a.power, rng, h);
      return;
    }
    case "transport": {
      const tank = bt.world.balance.odm.tank;
      for (const x of st.soldiers) {
        if (!alive(x) || d2(x.x, x.y, body.x, body.y) > a.radius_m ** 2) continue;
        const add = Math.min(a.power, tank - x.gas);
        x.gas += add;
        if (x.pairs < 2) x.pairs = 2;
        s.effect += add;
      }
      return;
    }
    case "spikes": {
      if (!target) return;
      const p = pos(target.f);
      s.effect += area(bt, u, body, p.x, p.y, a.radius_m, a.power, rng, h);
      return;
    }
    case "melee_titans":
      if (target) s.effect += strike(bt, u, body, target.f, a.power, rng, h);
      return;
    case "founder_command":
      for (const t of st.titans) {
        if (!t.alive || t.shifter !== undefined || d2(t.x, t.y, body.x, body.y) > a.radius_m ** 2) continue;
        t.commanded = a.duration_s;
        t.target = null;
        s.effect += 1;
      }
      h.log("battle.shifter.founder", { name: u.name, n: s.effect });
      return;
    default:
      return;
  }
}

/** Un pas d'un porteur. */
export function stepShifter(bt: Battle, u: ShifterUnit, rng: Rng, dt: number, h: ShifterHooks): void {
  const sb = shiftersBalance(bt);
  const def = defOf(bt, u);
  if (!sb || !def) return;
  if (u.phase === "humain") {
    // Le porteur se transforme dès que la recharge est passée et qu'il a l'endurance nécessaire ; délai de 1 à 3 s (03 §8.1).
    u.cooldown = Math.max(0, u.cooldown - dt);
    if (u.cooldown <= 0 && u.endurance >= sb.transform_cost) {
      u.phase = "transformation";
      if (u.timer <= 0) u.timer = sb.transform_delay_s[0] + (sb.transform_delay_s[1] - sb.transform_delay_s[0]) * rng.next();
    }
    return;
  }
  if (u.phase === "transformation") {
    u.timer -= dt;
    if (u.timer <= 0) {
      transform(bt, u, sb);
      h.log("battle.shifter.transformed", { name: u.name, titan: def.name_key });
    }
    return;
  }
  if (u.phase !== "titan") {
    // Épuisé : l'endurance revient lentement ; nouvelle transformation après la recharge.
    if (u.phase === "epuise") {
      u.cooldown -= dt;
      u.endurance = Math.min(u.maxEndurance, u.endurance + dt);
      if (u.cooldown <= 0 && u.endurance >= sb.transform_cost * 2) {
        u.phase = "humain";
        u.timer = 0;
        u.body = null;
      }
    }
    return;
  }
  const body = u.body !== null ? bt.state.titans[u.body] : undefined;
  if (!body?.alive) return;
  const enduranceMult = ability(def, "endurance")?.power ?? 1;
  // Usure du corps : l'endurance baisse avec le temps (moins pour la Charrette).
  u.endurance -= sb.endurance_drain_per_s * enduranceMult * dt;
  for (const [k, v] of Object.entries(u.cd)) if (v > 0) u.cd[k] = Math.max(0, v - dt);
  for (const [k, v] of Object.entries(u.active)) if (v > 0) u.active[k] = Math.max(0, v - dt);
  if (u.hardened > 0) {
    u.hardened = Math.max(0, u.hardened - dt);
    u.endurance -= sb.hardening.cost_per_s * dt;
  }
  // Régénération : chaque point de vie rendu coûte de l'endurance (03 §8.1).
  const regen = ability(def, "regeneration");
  const rate = def.regen_per_s * (regen?.power ?? 1) * dt;
  const zones: [keyof ShifterUnit["hp"], number][] = [["nape", u.maxHp.nape], ["armL", u.maxHp.arm], ["armR", u.maxHp.arm], ["legs", u.maxHp.leg]];
  for (const [z, max] of zones) {
    if (u.hp[z] >= max || u.endurance <= 0) continue;
    const add = Math.min(rate, max - u.hp[z]);
    u.hp[z] += add;
    u.endurance -= add * sb.regen_endurance_per_hp;
    if (regen) stat(bt, regen.id).effect += add - add / regen.power;
  }
  body.armL = u.hp.armL <= 0 ? 1 : 0;
  body.armR = u.hp.armR <= 0 ? 1 : 0;
  body.legs = u.hp.legs <= 0 ? 1 : 0;
  if (u.endurance <= 0) {
    endBody(bt, u, "epuise", h);
    return;
  }
  // Perte de contrôle (F-TIT-14) : stress ou blessures au-delà du seuil → rage, qui frappe sans distinction.
  const total = u.maxHp.nape + 2 * u.maxHp.arm + u.maxHp.leg;
  const lost = 1 - (u.hp.nape + u.hp.armL + u.hp.armR + u.hp.legs) / total;
  u.stress = Math.max(0, u.stress - dt);
  if (u.rampage > 0) u.rampage = Math.max(0, u.rampage - dt);
  else if ((u.stress >= sb.control.stress_threshold || lost >= sb.control.wound_share) && rng.next() < sb.control.chance_per_s * dt) {
    u.rampage = sb.control.rampage_s;
    bt.state.stats.rampages = (bt.state.stats.rampages ?? 0) + 1;
    h.log("battle.shifter.rampage", { name: u.name, titan: def.name_key });
  }
  // Passifs mesurés : Coordonnée de la Bête (purs plus rapides à frapper), vitesse de la Mâchoire.
  const command = ability(def, "command_pures");
  if (command && u.side === "ennemi") {
    for (const t of bt.state.titans) if (t.alive && t.shifter === undefined && t.attackCooldown > 0) {
      t.attackCooldown -= (command.power - 1) * dt;
      stat(bt, command.id).effect += (command.power - 1) * dt;
    }
  }
  const speed = ability(def, "speed");
  if (speed) stat(bt, speed.id).effect += def.speed_m_s * (speed.power - 1) * dt;
  const endur = ability(def, "endurance");
  if (endur) stat(bt, endur.id).effect += sb.endurance_drain_per_s * (1 - endur.power) * dt;
  // Cible : l'ennemi le plus proche ; on s'en approche à portée de bras.
  const target = nearest(foes(bt, u), body.x, body.y);
  const reach = body.height * sb.attack.reach_ratio;
  // Charrette alliée (03 §8.2, transport) : quand le ravitaillement est prêt, elle rejoint le soldat le plus à court de gaz.
  const transport = ability(def, "transport");
  const needy = transport && u.side === "allie" && u.rampage <= 0 && (u.cd[transport.id] ?? 0) <= 0 ? bt.state.soldiers.filter((x) => alive(x) && x.gas < bt.world.balance.odm.tank * 0.5).sort((a, b) => a.gas - b.gas || a.id.localeCompare(b.id))[0] : undefined;
  if (needy) {
    const dn = Math.hypot(needy.x - body.x, needy.y - body.y);
    body.heading = Math.atan2(needy.y - body.y, needy.x - body.x);
    if (dn > (transport?.radius_m ?? 10) * 0.5) {
      const v = Math.min(body.speed * dt, dn);
      body.x += Math.cos(body.heading) * v;
      body.y += Math.sin(body.heading) * v;
    }
  } else if (target) {
    const p = pos(target.f);
    body.heading = Math.atan2(p.y - body.y, p.x - body.x);
    if (target.d > reach * 0.8 && body.legs === 0) {
      const v = Math.min(body.speed * dt, target.d);
      body.x += Math.cos(body.heading) * v;
      body.y += Math.sin(body.heading) * v;
    }
  }
  // Capacités actives (déclencheur, endurance, recharge).
  for (const a of def.abilities) {
    if (a.passive || (u.cd[a.id] ?? 0) > 0 || u.endurance < a.cost) continue;
    if (!useAbility(bt, u, body, a, target)) continue;
    u.cd[a.id] = a.cooldown_s;
    if (a.duration_s > 0) u.active[a.id] = a.duration_s;
    u.endurance -= a.cost;
    applyAbility(bt, u, body, a, target, rng, h);
  }
  // Onde de chaleur active : brûle les ennemis à portée, chaque seconde.
  const heat = ability(def, "heat_wave");
  if (heat && (u.active[heat.id] ?? 0) > 0) stat(bt, heat.id).effect += area(bt, u, body, body.x, body.y, heat.radius_m, heat.power * dt, rng, h);
  // Coup ordinaire.
  u.attackCooldown -= dt;
  if (target && target.d <= reach && u.attackCooldown <= 0 && (body.armL === 0 || body.armR === 0)) {
    const [c0, c1] = sb.attack.cooldown_s;
    u.attackCooldown = c0 + (c1 - c0) * rng.next();
    strike(bt, u, body, target.f, sb.attack.kill_prob, rng, h);
  }
}

/** Un pur attiré par un cri d'appel marche vers l'appel et dévore le porteur le plus proche à portée (03 §8.2, E20). */
export function stepLuredTitan(bt: Battle, t: TitanUnit, dt: number, rng: Rng, h: ShifterHooks): boolean {
  const lure = t.lure;
  const sb = shiftersBalance(bt);
  if (!lure || !sb) return false;
  lure.t -= dt;
  if (lure.t <= 0) {
    delete t.lure;
    return false;
  }
  const reach = t.height * bt.world.balance.titans.reach_ratio + 2;
  const prey = (bt.state.shifters ?? []).filter((u) => u.phase === "titan" && u.body !== null).map((u) => ({ u, b: bt.state.titans[u.body as number] as TitanUnit }));
  let best: { u: ShifterUnit; b: TitanUnit; d: number } | null = null;
  for (const p of prey) {
    const d = Math.hypot(p.b.x - t.x, p.b.y - t.y);
    if (!best || d < best.d) best = { ...p, d };
  }
  const gx = best?.b.x ?? lure.x;
  const gy = best?.b.y ?? lure.y;
  const d = Math.hypot(gx - t.x, gy - t.y) || 1;
  t.heading = Math.atan2(gy - t.y, gx - t.x);
  if (d > reach * 0.8 && t.legs === 0) {
    const v = Math.min(t.speed * sb.call_speed_mult * dt, d);
    t.x += ((gx - t.x) / d) * v;
    t.y += ((gy - t.y) / d) * v;
  }
  t.attackCooldown -= dt;
  if (best && best.d <= reach && t.attackCooldown <= 0) {
    t.attackCooldown = 1 + rng.next();
    damageShifter(bt, best.u, rng.next() < 0.3 ? "nape" : "legs", sb.attack.titan_damage * t.threat, { pierce: false, source: "pur" }, h);
  }
  return true;
}
