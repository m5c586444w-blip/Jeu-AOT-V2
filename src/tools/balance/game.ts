// Partie headless d'une campagne (P9.4) : un « joueur type » (profil tiré par graine) donne des ordres plausibles, la
// simulation avance, la fin de partie est évaluée par les règles des données (src/campaign/outcome.ts). Le journal des
// commandes est gardé pour le contrôle de déterminisme (rejeu direct et Worker).
import type { Campaign, ScenarioMods } from "../../data/campaignSchema";
import { evaluateOutcome, newTracker, observe, scoreOf } from "../../campaign/outcome";
import type { Outcome } from "../../campaign/outcome";
import { armyStrength } from "../../sim/armies/ai";
import { stateHash } from "../../sim/core/canonical";
import { applyCommand } from "../../sim/core/commands";
import type { Command } from "../../sim/core/commands";
import { Rng } from "../../sim/core/rng";
import { createInitialState } from "../../sim/core/state";
import type { GameState } from "../../sim/core/state";
import { toAbsoluteDay } from "../../sim/core/time";
import { choiceAvailable, defaultChoice } from "../../sim/events/engine";
import { standardPlan } from "../../sim/military/plan";
import { RESOURCE_IDS } from "../../sim/strategic/resources";
import type { World } from "../../sim/strategic/world";

export const PROFILES = ["historique", "prudent", "audacieux", "hasardeux"] as const;
export type Profile = (typeof PROFILES)[number];

interface ProfileParams {
  /** Probabilité de signer le choix historique d'un événement canon. */
  historical: number;
  /** Jours entre deux expéditions (tirés dans l'intervalle). */
  expeditionEvery: [number, number];
  /** Escouades engagées. */
  squads: [number, number];
  /** Part des expéditions en colonnes (le reste en éventail). */
  columns: number;
  /** Jours de vivres sous lesquels le rationnement se resserre. */
  rationDays: number;
  /** Rapport de force exigé pour intercepter une armée ennemie sur l'île. */
  interceptRatio: number;
  /** Démarche diplomatique (commerce avec Hizuru) tous les n jours ; 0 = jamais. */
  diplomacyEvery: number;
  /** Probabilité, par décision, d'envoyer une armée trop faible tenir le segment de mur assiégé ou menacé. */
  holdWall: number;
  /** Rencontre d'armées : retraite plutôt que combat quand le rapport de force est sous ce seuil. */
  retreatBelow: number;
  /** Profondeur des expéditions : provinces perdues à [min, max] pas du territoire tenu. */
  depth: [number, number];
}

const PARAMS: Record<Profile, ProfileParams> = {
  historique: { historical: 0.92, expeditionEvery: [80, 120], squads: [16, 22], columns: 0.1, rationDays: 60, interceptRatio: 1.3, diplomacyEvery: 120, holdWall: 0.5, retreatBelow: 0.5, depth: [2, 3] },
  prudent: { historical: 0.75, expeditionEvery: [110, 180], squads: [12, 18], columns: 0.05, rationDays: 120, interceptRatio: 1.8, diplomacyEvery: 90, holdWall: 0.7, retreatBelow: 0.8, depth: [1, 2] },
  audacieux: { historical: 0.5, expeditionEvery: [45, 80], squads: [20, 28], columns: 0.35, rationDays: 30, interceptRatio: 1.0, diplomacyEvery: 0, holdWall: 0.9, retreatBelow: 0.2, depth: [2, 4] },
  hasardeux: { historical: 0.3, expeditionEvery: [30, 160], squads: [8, 30], columns: 0.5, rationDays: 20, interceptRatio: 0.8, diplomacyEvery: 200, holdWall: 0.3, retreatBelow: 0.4, depth: [1, 4] },
};

export interface GameResult {
  campaign: string;
  seed: number;
  profile: Profile;
  outcome: Outcome;
  hash: string;
  /** Journal des commandes acceptées, dans l'ordre (rejeu). */
  commands: Command[];
  ms: number;
  stats: {
    expeditions: number;
    expDeparted: number;
    expDead: number;
    expMortality: number[];
    deathCauses: Record<string, number>;
    characterDeaths: Record<string, number>;
    shortageDays: Record<string, number>;
    foodEmptyMax: number;
    popRatio: number;
    legitimacy: number;
    divergence: number;
    branch: string;
    score: number;
    scoreParts: Record<string, number>;
    ai: Record<string, number>;
    hizuruSwitches: number;
    canonFired: number;
    canonAvoided: number;
  };
}

/** Pas d'avance du temps entre deux décisions (jours). Les événements laissent 5 jours au moins pour décider. */
const STEP_DAYS = 3;

export function profileOf(seed: number): Profile {
  return PROFILES[new Rng(seed).fork("profil").int(0, PROFILES.length - 1)] ?? "historique";
}

export function playGame(world: World, campaign: Campaign, mods: Pick<ScenarioMods, "score_threshold_delta">, seed: number, profile: Profile = profileOf(seed), keepCommands = false): GameResult {
  const t0 = performance.now();
  const p = PARAMS[profile];
  const rng = new Rng(seed).fork(`joueur:${profile}`);
  let s: GameState = createInitialState(seed, world);
  const tracker = newTracker(s);
  const startDay = toAbsoluteDay(s.date);
  const commands: Command[] = [];
  const startStocks = { ...(s.strategic?.stocks ?? {}) } as Record<string, number>;
  const shortageDays: Record<string, number> = {};
  // Matières premières entièrement transformées chaque jour par les fabriques (pierre de glace → gaz) : stock bas par construction.
  const inputs = new Set([...world.buildings.values()].flatMap((b) => (b.conversion ? [b.conversion.from] : [])));
  let nextExpedition = startDay + rng.int(p.expeditionEvery[0], p.expeditionEvery[1]);
  let nextDiplomacy = p.diplomacyEvery > 0 ? startDay + p.diplomacyEvery : Infinity;
  const run = (c: Command): boolean => {
    try {
      s = applyCommand(s, c, undefined, world);
      if (keepCommands) commands.push(c);
      return true;
    } catch {
      return false;
    }
  };
  let outcome: Outcome | null = null;
  for (let guard = 0; guard < 4000 && !outcome; guard++) {
    decide();
    run({ type: "AdvanceDays", n: STEP_DAYS });
    observe(tracker, s);
    for (const r of RESOURCE_IDS) if (!inputs.has(r) && (startStocks[r] ?? 0) > 0 && (s.strategic?.stocks[r] ?? 0) < 0.05 * (startStocks[r] ?? 0)) shortageDays[r] = (shortageDays[r] ?? 0) + STEP_DAYS;
    outcome = evaluateOutcome(world, campaign, mods, s, tracker);
  }
  if (!outcome) throw new Error(`partie sans fin (graine ${seed})`);

  function decide(): void {
    const day = toAbsoluteDay(s.date);
    const ev = s.events;
    // 1. Dossiers en attente : choix historique selon le profil, sinon un autre choix offert.
    if (ev && s.strategic) {
      for (const pend of [...ev.pending]) {
        const e = world.chronicle?.events.get(pend.id);
        if (!e) continue;
        const ctx = { world, date: s.date, st: s.strategic, pol: s.politics, ev, intel: s.intel, rs: s.research };
        const avail = e.choices.filter((c) => choiceAvailable(ctx, c));
        if (avail.length === 0) continue;
        const hist = defaultChoice(ctx, e);
        const pick = hist && rng.next() < p.historical ? hist : (avail[rng.int(0, avail.length - 1)] ?? hist);
        if (pick) run({ type: "ChooseEventOption", event: e.id, choice: pick.id });
      }
    }
    const st = s.strategic;
    if (!st) return;
    // 2. Rationnement : selon les jours de vivres restants (consommation approchée par la population).
    const pop = Object.values(st.provinces).reduce((a, x) => a + x.population, 0);
    const daily = Math.max(1, pop * (world.economy.consumption.food_per_pop ?? 0.01));
    const days = st.stocks.food / daily;
    const want = days < p.rationDays / 2 ? "strict" : days < p.rationDays ? "reduit" : "normal";
    if (st.rationing !== want) run({ type: "SetRationing", level: want });
    // 3. Recherche : une étude toujours en cours (au hasard parmi les premières de l'ordre).
    const rs = s.research;
    if (rs && !rs.current && world.research) {
      const open = world.research.order.filter((t) => !rs.done.includes(t.id));
      for (let k = 0; k < 4 && open.length > 0; k++) if (run({ type: "SetResearch", tech: open[rng.int(0, Math.min(open.length, 6) - 1)]?.id ?? null }) && s.research?.current) break;
    }
    // 4. Expéditions : vers une province perdue voisine, à intervalles réguliers, si gaz et vivres le permettent.
    const mil = s.military;
    if (mil && world.military && day >= nextExpedition && mil.expeditions.length === 0 && st.stocks.gas > 2000 && st.stocks.food > 20000) {
      nextExpedition = day + rng.int(p.expeditionEvery[0], p.expeditionEvery[1]);
      // Cible : une province perdue à la profondeur du profil (pas comptés depuis le territoire tenu), sinon la plus proche.
      const geo = world.military.geo;
      const dist = new Map<string, number>();
      const queue = [...geo.nodes.keys()].filter((id) => st.provinces[id]?.control === "paradis").sort();
      for (const id of queue) dist.set(id, 0);
      for (let i = 0; i < queue.length; i++) {
        const id = queue[i] as string;
        for (const e of geo.adj.get(id) ?? []) {
          if (dist.has(e.to) || !st.provinces[e.to]) continue;
          dist.set(e.to, (dist.get(id) ?? 0) + 1);
          queue.push(e.to);
        }
      }
      const at = (lo: number, hi: number): string[] => [...dist].filter(([, d]) => d >= lo && d <= hi).map(([id]) => id).sort();
      const deep = at(p.depth[0], p.depth[1]);
      const targets = deep.length > 0 ? deep : at(1, 1);
      const target = targets[rng.int(0, Math.max(0, targets.length - 1))];
      if (target) {
        const plan = standardPlan(world, mil, target, rng.next() < p.columns ? "colonnes" : "eventail", rng.int(p.squads[0], p.squads[1]));
        if (plan) run({ type: "LaunchExpedition", plan });
      }
    }
    // 5. Armées de Paradis : intercepter une armée ennemie débarquée quand le rapport de force le permet.
    const ar = s.armies;
    if (ar && world.armies) {
      const enemies = ar.armies.filter((a) => a.faction !== "fac_paradis" && a.province && !a.fleet && st.provinces[a.province]);
      for (const a of ar.armies.filter((x) => x.faction === "fac_paradis" && x.province && !x.engaged && !x.target && x.route.length === 0)) {
        const mine = armyStrength({ aw: world.armies }, a);
        const prey = enemies.map((x) => ({ x, r: mine / Math.max(1, armyStrength({ aw: world.armies as NonNullable<World["armies"]> }, x)) })).filter((y) => y.r >= p.interceptRatio).sort((u, v) => v.r - u.r || u.x.id.localeCompare(v.x.id))[0];
        if (prey) {
          run({ type: "ArmyIntercept", army: a.id, target: prey.x.id });
          continue;
        }
        // Trop faible pour intercepter : tenir le segment de mur assiégé (ou le plus proche d'un ennemi débarqué), selon le profil.
        const geo = world.military?.geo;
        const sieged = ar.sieges.map((x) => x.segment).sort()[0];
        const threat = enemies[0]?.province;
        const wall = sieged ?? (threat && geo ? [...geo.nodes.keys()].filter((q) => (geo.nodes.get(q)?.zone ?? "").startsWith("mur_") && (geo.adj.get(q) ?? []).some((e) => e.to === threat)).sort()[0] : undefined);
        if (wall && wall !== a.province && rng.next() < p.holdWall) run({ type: "ArmyMove", army: a.id, to: wall });
      }
      // Rencontres d'armées : résolues aussitôt (combat automatique, ou retraite si le rapport est trop défavorable).
      for (const enc of ar.encounters.filter((e) => e.status === "attente" && e.sides.some((x) => x.faction === "fac_paradis"))) {
        const side = (f: (x: string) => boolean): number => enc.sides.filter((x) => f(x.faction)).flatMap((x) => x.armies).reduce((n, id) => {
          const a = ar.armies.find((y) => y.id === id);
          return n + (a ? armyStrength({ aw: world.armies as NonNullable<World["armies"]> }, a) : 0);
        }, 0);
        const r = side((f) => f === "fac_paradis") / Math.max(1, side((f) => f !== "fac_paradis"));
        run({ type: "ResolveEncounter", encounter: enc.id, mode: r < p.retreatBelow ? "retraite" : "auto", orders: [] });
      }
    }
    // 6. Diplomatie : commerce avec Hizuru de temps en temps (854).
    if (s.nations && day >= nextDiplomacy) {
      nextDiplomacy = day + p.diplomacyEvery;
      run({ type: "ProposeTreaty", to: "fac_hizuru", kind: "commerce" });
    }
  }

  // Statistiques de la partie.
  const reports = s.military?.reports ?? [];
  const deathCauses: Record<string, number> = {};
  let dep = 0;
  let dead = 0;
  for (const r of reports) {
    dep += r.stats.departed;
    dead += r.dead.length;
    for (const d of r.dead) deathCauses[d.cause] = (deathCauses[d.cause] ?? 0) + 1;
  }
  const characterDeaths: Record<string, number> = {};
  for (const c of Object.values(s.politics?.characters ?? {})) if (!c.alive && c.death) characterDeaths[c.death.cause] = (characterDeaths[c.death.cause] ?? 0) + 1;
  const ai: Record<string, number> = {};
  for (const a of s.armies?.ai ?? []) {
    const k = `armees:${a.faction}:${a.action.split(":")[0] ?? ""}`;
    ai[k] = (ai[k] ?? 0) + 1;
  }
  for (const a of s.nations?.ai ?? []) {
    const k = `monde:${a.faction}:${a.action.split(":")[0] ?? ""}`;
    ai[k] = (ai[k] ?? 0) + 1;
  }
  const hist = Object.values(s.events?.history ?? {});
  const pop0 = tracker.startPopulation;
  const pop = Object.values(s.strategic?.provinces ?? {}).reduce((a, x) => a + x.population, 0);
  return {
    campaign: campaign.id,
    seed,
    profile,
    outcome,
    hash: stateHash(s),
    commands,
    ms: performance.now() - t0,
    stats: {
      expeditions: reports.length,
      expDeparted: dep,
      expDead: dead,
      expMortality: reports.filter((r) => r.stats.departed > 0).map((r) => r.dead.length / r.stats.departed),
      deathCauses,
      characterDeaths,
      shortageDays,
      foodEmptyMax: tracker.foodEmptyMax,
      popRatio: pop0 > 0 ? pop / pop0 : 1,
      legitimacy: s.politics?.legitimacy ?? 0,
      divergence: s.events?.divergence ?? 0,
      branch: s.events?.branch ?? "canon",
      score: outcome.score ?? scoreOf(campaign, s, tracker).score,
      scoreParts: scoreOf(campaign, s, tracker).parts,
      ai,
      hizuruSwitches: (s.nations?.log ?? []).filter((l) => l.key === "world.log.hizuru_side").length,
      canonFired: hist.filter((r) => r.status === "survenu").length,
      canonAvoided: hist.filter((r) => r.status === "evite").length,
    },
  };
}
