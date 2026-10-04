import { Explainer } from "../core/explain";
import type { Explained } from "../core/explain";
import { Rng } from "../core/rng";
import type { GameDate } from "../core/time";
import { toAbsoluteDay } from "../core/time";
import { titanDensity } from "../military/routes";
import { characterDies, stressCharacter } from "../politics/characters";
import type { Consequence, PoliticalState } from "../politics/state";
import { WARM_RELATIONS } from "../politics/vocabulary";
import type { IntelState } from "../intel/intel";
import { pushLog } from "../strategic/economy";
import type { StrategicState } from "../strategic/economy";
import type { World } from "../strategic/world";

/**
 * Titans-porteurs (P6 ; 02 §10, 03 §8, 11 §4) : porteurs, horloge des 13 ans, héritage au hasard ou préparé, visions, Fondation.
 * Logique pure ; l'aléa vient de forks nommés de la graine.
 */

/** « perdu » : le pouvoir est passé à un nouveau-né eldien inconnu (mort sans ingestion, 02 §10) [C]. */
export type ShifterFaction = "paradis" | "marley" | "inconnu" | "perdu";

export interface ShifterSlot {
  /** Personnage porteur ; null quand le porteur n'a pas de fiche (Marley jusqu'en P7) ou que le pouvoir est perdu. */
  holder: string | null;
  faction: ShifterFaction;
  /** Année d'héritage : départ de l'horloge des 13 ans. */
  since: number;
  sinceCanon: "C" | "A" | "?";
  /** Porteur aux mains de Paradis (héritage préparé possible). */
  captured: boolean;
  /** Retiré du service (F-TIT-20) : ne combat plus ; l'horloge continue. */
  retired: boolean;
  visions: number;
}

export type InheritanceKind = "prepare" | "hasard" | "relais_marley";

export interface InheritanceRecord {
  shifter: string;
  day: number;
  kind: InheritanceKind;
  from: string | null;
  to: string | null;
  consequences: Consequence[];
}

export interface ShiftersState {
  titans: Record<string, ShifterSlot>;
  /** Doses de sérum de Titan détenues par Paradis (E35 : la boîte de Kenny) [C]. */
  serum: number;
  history: InheritanceRecord[];
}

/** Contexte de travail (copies modifiables). */
export interface ShifterCtx {
  world: World;
  seed: number;
  date: GameDate;
  st: StrategicState;
  pol: PoliticalState | null;
  intel: IntelState | null;
  sh: ShiftersState;
  /** Drapeaux d'événements (contact royal, etc.). */
  flags: Readonly<Record<string, boolean>>;
}

const HISTORY_CAP = 60;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function createShiftersState(world: World): ShiftersState | null {
  const sw = world.shifters;
  if (!sw) return null;
  const titans: Record<string, ShifterSlot> = {};
  for (const d of sw.order) {
    const h = d.holder_850;
    // Porteurs propres au scénario (854) à la place de ceux de 850.
    const sc = world.scenario.shifter_holders[d.id];
    titans[d.id] = sc ? { holder: sc.character, faction: sc.faction, since: sc.since, sinceCanon: sc.since_canon, captured: false, retired: false, visions: 0 } : { holder: h.character, faction: h.faction, since: h.since, sinceCanon: h.since_canon, captured: false, retired: false, visions: 0 };
  }
  return { titans, serum: 0, history: [] };
}

const nameOf = (world: World, id: string | null): string => (id ? (world.politics?.characters.get(id)?.name ?? id) : "—");
const shifterName = (world: World, id: string): string => world.shifters?.defs.get(id)?.name_key ?? id;

/** Années restantes avant la malédiction d'Ymir (02 §10, 11 §4) : 13 − (année − année d'héritage). */
export function yearsLeft(world: World, slot: ShifterSlot, date: GameDate): Explained {
  const curse = world.shifters?.balance.curse_years ?? 13;
  return new Explainer()
    .base("why.shifter_curse", curse)
    .add("why.shifter_elapsed", -(date.year - slot.since), { since: slot.since })
    .done();
}

/** Titans tenus par un personnage. */
export function titansOf(sh: ShiftersState | null, character: string): string[] {
  return Object.entries(sh?.titans ?? {})
    .filter(([, s]) => s.holder === character)
    .map(([id]) => id)
    .sort();
}

/** Verrou du contrôle des purs du Fondateur (02 §10) : sang royal ou contact d'un descendant royal [C]. */
export function founderLock(world: World, flags: Readonly<Record<string, boolean>>): string | null {
  const ab = world.shifters?.defs.get("shifter_fondateur")?.abilities.find((a) => a.effect === "founder_command");
  if (!ab?.requires_flag) return null;
  return flags[ab.requires_flag] ? null : "shifter.lock.royal";
}

/** Raison pour laquelle un héritage préparé est impossible, ou null. */
export function inheritProblem(world: World, sh: ShiftersState, pol: PoliticalState | null, shifter: string, heir: string, needSerum = true): string | null {
  const slot = sh.titans[shifter];
  if (!world.shifters?.defs.has(shifter) || !slot) return "shifter.err.unknown";
  if (!pol) return "shifter.err.no_politics";
  if (!slot.holder || !pol.characters[slot.holder]?.alive) return "shifter.err.no_holder";
  if (slot.faction !== "paradis" && !slot.captured) return "shifter.err.not_held";
  if (needSerum && sh.serum < 1) return "shifter.err.no_serum";
  if (!pol.characters[heir]?.alive || !world.politics?.characters.has(heir)) return "shifter.err.heir_dead";
  if (heir === slot.holder) return "shifter.err.same";
  return null;
}

/**
 * Coûts systémiques d'un héritage préparé (F-TIT-05), prévus avant la décision et appliqués à l'identique :
 * porteur dévoré, sérum consommé, horloge de l'héritier à 13 ans, stress de l'héritier et de ses proches, loyauté de son corps, légitimité.
 */
export function inheritCosts(world: World, sh: ShiftersState, pol: PoliticalState, shifter: string, heir: string): Consequence[] {
  const b = world.shifters?.balance.inheritance;
  const slot = sh.titans[shifter];
  if (!b || !slot) return [];
  const heirDef = world.politics?.characters.get(heir);
  const out: Consequence[] = [];
  if (slot.holder) out.push({ key: "shifter.csq_devoured", params: { who: nameOf(world, slot.holder) } });
  out.push({ key: "shifter.csq_serum", params: { n: 1 } });
  out.push({ key: "shifter.csq_clock", params: { who: heirDef?.name ?? heir, years: world.shifters?.balance.curse_years ?? 13 } });
  out.push({ key: "shifter.csq_heir_stress", params: { who: heirDef?.name ?? heir, n: b.heir_stress } });
  const org = heirDef?.org;
  if (org && pol.orgs[org]) out.push({ key: "shifter.csq_org", params: { org: world.politics?.organisations.get(org)?.name_key ?? org, n: b.org_loyalty } });
  for (const id of closeOnes(world, pol, heir)) out.push({ key: "shifter.csq_close", params: { who: nameOf(world, id), n: b.relation_stress } });
  if (b.legitimacy !== 0) out.push({ key: "shifter.csq_legitimacy", params: { n: b.legitimacy } });
  return out;
}

/** Proches vivants de l'héritier (relation chaleureuse, dans un sens ou l'autre). */
function closeOnes(world: World, pol: PoliticalState, heir: string): string[] {
  const warm = new Set<string>(WARM_RELATIONS);
  const ids = new Set<string>();
  for (const c of world.politics?.characters.values() ?? []) {
    if (c.id === heir || !pol.characters[c.id]?.alive) continue;
    const linked = c.relations.some((r) => r.to === heir && warm.has(r.type) && r.strength > 0) || (world.politics?.characters.get(heir)?.relations ?? []).some((r) => r.to === c.id && warm.has(r.type) && r.strength > 0);
    if (linked) ids.add(c.id);
  }
  return [...ids].sort();
}

/**
 * Héritage préparé (commande InheritTitan, effet d'événement `inherit` ; E42) : l'héritier dévore le porteur.
 * `needSerum` : l'effet d'événement consomme la dose s'il y en a une, la commande l'exige.
 */
export function inherit(ctx: ShifterCtx, shifter: string, heir: string, source: string, canon: "C" | "A" | "?", needSerum = true): string | null {
  const problem = inheritProblem(ctx.world, ctx.sh, ctx.pol, shifter, heir, needSerum);
  if (problem || !ctx.pol) return problem;
  const b = ctx.world.shifters?.balance.inheritance;
  const slot = ctx.sh.titans[shifter] as ShifterSlot;
  const consequences = inheritCosts(ctx.world, ctx.sh, ctx.pol, shifter, heir);
  const from = slot.holder;
  // Le pouvoir passe d'abord : la mort du porteur dévoré n'est pas une mort « sans ingestion ».
  ctx.sh.titans[shifter] = { ...slot, holder: heir, faction: "paradis", since: ctx.date.year, sinceCanon: canon, captured: false, retired: false };
  ctx.sh.serum = Math.max(0, ctx.sh.serum - 1);
  if (from && ctx.pol.characters[from]?.alive) {
    const r = characterDies(ctx.world, ctx.pol, ctx.st, ctx.date, from, "devore", source);
    ctx.pol = r.state;
    ctx.st = r.strategic;
  }
  if (b) {
    stressCharacter(ctx.world, ctx.pol, heir, b.heir_stress);
    for (const id of closeOnes(ctx.world, ctx.pol, heir)) stressCharacter(ctx.world, ctx.pol, id, b.relation_stress);
    const org = ctx.world.politics?.characters.get(heir)?.org;
    const os = org ? ctx.pol.orgs[org] : undefined;
    if (os) os.loyalty = clamp(os.loyalty + b.org_loyalty, 0, 100);
    ctx.pol.legitimacy = clamp(ctx.pol.legitimacy + b.legitimacy, 0, 100);
  }
  record(ctx.sh, { shifter, day: toAbsoluteDay(ctx.date), kind: "prepare", from, to: heir, consequences });
  pushLog(ctx.st, ctx.date, "log.shifter.inherited", { titan: shifterName(ctx.world, shifter), heir: nameOf(ctx.world, heir), from: nameOf(ctx.world, from) }, true);
  return null;
}

function record(sh: ShiftersState, r: InheritanceRecord): void {
  sh.history.push(r);
  if (sh.history.length > HISTORY_CAP) sh.history.splice(0, sh.history.length - HISTORY_CAP);
}

/** Retrait du service ou rappel (F-TIT-20) : pas de combat ; l'horloge n'est pas suspendue. */
export function retireProblem(sh: ShiftersState, pol: PoliticalState | null, shifter: string): string | null {
  const slot = sh.titans[shifter];
  if (!slot) return "shifter.err.unknown";
  if (slot.faction !== "paradis" || !slot.holder || !pol?.characters[slot.holder]?.alive) return "shifter.err.not_ours";
  return null;
}

/**
 * Jour des porteurs : morts sans ingestion (pouvoir perdu), horloge des 13 ans au 1er de l'an, visions mensuelles.
 * Appelé après les événements et la couche militaire, pour saisir les morts du jour.
 */
export function dailyShifters(ctx: ShifterCtx): void {
  const sw = ctx.world.shifters;
  if (!sw) return;
  const day = toAbsoluteDay(ctx.date);
  // Horloge : au 1er jour de l'an, un porteur arrivé au bout de ses 13 ans meurt (malédiction d'Ymir) [C].
  if (ctx.date.day === 1) {
    for (const d of sw.order) {
      const slot = ctx.sh.titans[d.id];
      if (!slot || slot.faction === "perdu" || yearsLeft(ctx.world, slot, ctx.date).value > 0) continue;
      if (slot.holder && ctx.pol?.characters[slot.holder]?.alive) {
        const r = characterDies(ctx.world, ctx.pol, ctx.st, ctx.date, slot.holder, "malediction", "shifter.curse");
        ctx.pol = r.state;
        ctx.st = r.strategic;
      } else if (!slot.holder && slot.faction === "marley") {
        // Marley transmet ses Titans avant l'échéance (relais des guerriers, 11 §4) : nouvel héritier sans nom [A].
        ctx.sh.titans[d.id] = { ...slot, since: ctx.date.year, sinceCanon: "A" };
        record(ctx.sh, { shifter: d.id, day, kind: "relais_marley", from: null, to: null, consequences: [] });
      }
    }
  }
  // Mort sans ingestion : le pouvoir passe à un nouveau-né eldien au hasard et sort du jeu (02 §10) [C].
  for (const d of sw.order) {
    const slot = ctx.sh.titans[d.id];
    if (!slot?.holder || ctx.pol?.characters[slot.holder]?.alive !== false) continue;
    const from = slot.holder;
    ctx.sh.titans[d.id] = { ...slot, holder: null, faction: "perdu", since: ctx.date.year, sinceCanon: "C", captured: false, retired: false };
    record(ctx.sh, { shifter: d.id, day, kind: "hasard", from, to: null, consequences: [{ key: "shifter.csq_newborn", params: {} }] });
    pushLog(ctx.st, ctx.date, "log.shifter.lost", { titan: d.name_key, who: nameOf(ctx.world, from) }, true);
  }
  if (ctx.date.day % 30 === 1) monthlyVisions(ctx, day);
}

/**
 * Mémoire et visions (F-TIT-06) : un porteur de Paradis reçoit parfois une vision d'une province hors des Murs ;
 * elle arrive comme un rapport de renseignement de fiabilité « rumeur », faux dans une part des cas, à recouper.
 */
function monthlyVisions(ctx: ShifterCtx, day: number): void {
  const vb = ctx.world.shifters?.balance.vision;
  const intel = ctx.intel;
  if (!vb || !intel || !ctx.world.intel) return;
  const outside = ctx.world.provinces.filter((p) => ctx.st.provinces[p.id]?.control !== "paradis").map((p) => p.id);
  if (outside.length === 0) return;
  // Un tirage par porteur (Eren tient deux Titans : une seule mémoire) ; le rapport rejoint le registre du renseignement.
  const seen = new Set<string>();
  for (const [, slot] of Object.entries(ctx.sh.titans).sort(([a], [b]) => a.localeCompare(b))) {
    if (slot.faction !== "paradis" || !slot.holder || seen.has(slot.holder) || !ctx.pol?.characters[slot.holder]?.alive) continue;
    seen.add(slot.holder);
    const rng = new Rng(ctx.seed).fork(`vision:${slot.holder}:${day}`);
    if (rng.next() >= vb.chance_per_month) continue;
    const target = outside[Math.floor(rng.next() * outside.length)] as string;
    const truth = titanDensity(ctx.world, target, ctx.st);
    const isFalse = rng.next() < vb.falsehood;
    const claim = isFalse ? (truth > 0.3 ? truth * 0.2 : Math.min(1, truth + 0.5)) : truth;
    slot.visions += 1;
    intel.reports.push({ id: `rap_${++intel.seq}`, day, about: day, agent: slot.holder, op: "vision", target, named: null, claim: Math.round(claim * 100) / 100, truth, false: isFalse, certainty: "rumeur", status: "non_verifie" });
  }
}
