import { CERTAINTY_LEVELS } from "../data/effects";
import type { EventDef, EventTheme } from "../data/schemas";
import { EVENT_THEMES } from "../data/schemas";
import { t } from "../i18n";
import type { GameState } from "../sim/core/state";
import { fromAbsoluteDay, toAbsoluteDay } from "../sim/core/time";
import type { IntelState } from "../sim/intel/intel";
import type { World } from "../sim/strategic/world";
import { playerNation, sideOf } from "../sim/missions/missions";
import { predecessorsOf } from "../sim/strategic/world";
import { eventBody } from "./eventText";

/**
 * Modèle de la frise « Chronologie » (CHR.3, E-UX-6) : logique pure, sans DOM, testée sans navigateur.
 * Axe 845 à 854+ ; chaque événement est passé (coché), en cours, annoncé (rumeur ou prévision selon le renseignement du joueur,
 * invisible sinon) ou évité ; l'écart au récit connu est celui que la simulation a inscrit à la chronique.
 */
export { EVENT_THEMES };
export type TimelineStatus = "passe" | "en_cours" | "annonce" | "evite";
/** Ce que le renseignement permet de dire d'un événement à venir. */
export type Foresight = "rumeur" | "prevision" | "certitude";
export type IntelLevel = 0 | 1 | 2 | 3;

export interface TimelineItem {
  id: string;
  /** Code E01–E60 (usage interne : jamais affiché). */
  code: string | null;
  /** « canon » : événements du récit ; « quotidien » : faits de fond et événements génériques ; « mission » : missions nationales (MIS.4). */
  group: "canon" | "quotidien" | "mission";
  theme: EventTheme;
  title: string;
  summary: string;
  status: TimelineStatus;
  foresight: Foresight | null;
  /** Année de placement sur l'axe. */
  year: number;
  /** Fin d'une période (guerre, repli…). */
  yearMax: number | null;
  approx: boolean;
  /** Jour absolu connu (survenu, en attente, programmé et prévu avec certitude), sinon null. */
  day: number | null;
  /** Prévision sans date exacte : jour approximatif, pour le mois affiché. */
  dayApprox: number | null;
  /** Écart ajouté au score de divergence (0 si conforme). */
  gap: number;
  /** Conforme au récit connu ; null si l'événement n'a pas de choix historique. */
  conform: boolean | null;
  choice: string | null;
  playable: boolean;
  pending: boolean;
  def: EventDef;
  subject: { character?: string; province?: string };
  /** Clé de tri. */
  sort: number;
}

const FAMILY_THEME: Readonly<Record<string, EventTheme>> = { civil: "famille", militaire: "militaire", politique: "politique", personnage: "famille", titans: "titans", monde: "monde", etranger: "monde" };

export const themeOf = (e: EventDef): EventTheme => e.theme ?? FAMILY_THEME[e.family ?? ""] ?? "monde";

/** Niveau de renseignement du joueur : le meilleur indice sur un secret, ou le nombre de rapports recoupés. */
export function intelLevel(intel: IntelState | null): IntelLevel {
  if (!intel) return 0;
  const best = Math.max(0, ...Object.values(intel.secrets).map((s) => CERTAINTY_LEVELS.indexOf(s.certainty)));
  const confirmed = intel.reports.filter((r) => r.status === "confirme").length;
  const fromReports = confirmed >= 6 ? 3 : confirmed >= 3 ? 2 : confirmed >= 1 ? 1 : 0;
  return Math.max(best, fromReports) as IntelLevel;
}

/**
 * Ce qu'on sait d'un événement à venir. Daté (programmé) : dans l'horizon du niveau. Sans date : seulement à partir du niveau 2, et
 * selon sa distance dans la chaîne (0 = en attente ou programmé, 1 = le suivant…) : un niveau de prévisions voit le suivant, un
 * niveau de certitudes les trois suivants.
 */
export function foresightFor(level: IntelLevel, daysAhead: number | null, steps: number): Foresight | null {
  if (level <= 0) return null;
  const horizon = level === 1 ? 90 : level === 2 ? 200 : 400;
  const kind: Foresight = level === 1 ? "rumeur" : level === 2 ? "prevision" : "certitude";
  if (daysAhead !== null) return daysAhead <= horizon ? kind : null;
  return level >= 2 && steps <= (level === 2 ? 1 : 3) ? "prevision" : null;
}

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** Texte vague d'une rumeur : le thème, jamais le titre. */
export const rumorText = (theme: EventTheme, id: string): string => t(`chrono.rumor.${theme}.${hash(id) % 2}`);

/**
 * Tous les éléments de la frise pour l'état courant. Les événements à venir ne sont inclus que si le renseignement les annonce ;
 * un événement caché (E03) n'apparaît qu'une fois sa révélation survenue.
 */
export function buildTimeline(world: World, state: GameState): TimelineItem[] {
  const cw = world.chronicle;
  const ev = state.events;
  if (!cw || !ev) return [];
  const today = toAbsoluteDay(state.date);
  const level = intelLevel(state.intel);
  const resolved = (id: string): boolean => ev.history[id]?.status === "survenu" || ev.history[id]?.status === "passe";
  const reached = new Map<string, "passe" | "en_cours" | "futur">();
  /** Squelette sans mécanique : suit son prédécesseur et l'année (le récit continue sans décision du joueur). */
  const derived = (e: EventDef): "passe" | "en_cours" | "futur" => {
    const known = reached.get(e.id);
    if (known) return known;
    reached.set(e.id, "futur");
    let out: "passe" | "en_cours" | "futur" = "futur";
    if (cw.mode === "canon_fidele" && predecessorsOf(e).every((p) => resolved(p) || ((x) => x !== undefined && !x.playable && derived(x) !== "futur")(cw.events.get(p)))) {
      const end = e.year_max ?? e.year_min;
      out = state.date.year > end ? "passe" : state.date.year >= e.year_min ? "en_cours" : "futur";
    }
    reached.set(e.id, out);
    return out;
  };
  /** Distance dans la chaîne : 0 si survenu, en attente, programmé ou atteint par le récit ; sinon 1 + la plus grande des distances des prédécesseurs. */
  const steps = new Map<string, number>();
  const stepsOf = (id: string): number => {
    const known = steps.get(id);
    if (known !== undefined) return known;
    const e = cw.events.get(id);
    steps.set(id, 99);
    let d = 99;
    if (e) d = resolved(id) || ev.pending.some((p) => p.id === id) || ev.scheduled.some((x) => x.id === id) || (!e.playable && derived(e) !== "futur") ? 0 : 1 + Math.max(0, ...predecessorsOf(e).map(stepsOf));
    steps.set(id, d);
    return d;
  };
  const items: TimelineItem[] = [];
  const base = (e: EventDef, group: TimelineItem["group"], subject: TimelineItem["subject"] = {}): Omit<TimelineItem, "status" | "foresight" | "day" | "dayApprox" | "gap" | "conform" | "choice" | "pending" | "sort" | "year"> => ({
    id: e.id,
    code: e.code ?? null,
    group,
    theme: themeOf(e),
    title: t(e.text_key),
    summary: eventBody(world, e, subject),
    yearMax: e.year_max ?? null,
    approx: e.date_approx === true,
    playable: e.playable,
    def: e,
    subject,
  });

  for (const e of cw.events.values()) {
    if (e.kind !== "canon" || !e.code) continue;
    if (e.known_after && !resolved(e.known_after)) continue;
    const hist = ev.history[e.id];
    const pend = ev.pending.find((p) => p.id === e.id);
    const sched = ev.scheduled.find((s) => s.id === e.id);
    const histChoice = e.choices.find((c) => c.historical)?.id ?? null;
    const common = base(e, "canon");
    const at = (day: number | null, year = e.year_min) => ({ year: day === null ? year : fromAbsoluteDay(day).year, sort: day ?? year * 360 + (Number(e.code?.slice(1)) || 0) });
    if (hist?.status === "survenu") {
      items.push({ ...common, ...at(hist.day), status: "passe", foresight: null, day: hist.day, dayApprox: null, gap: hist.divergence, conform: histChoice === null ? null : hist.choice === histChoice, choice: hist.choice, pending: false });
    } else if (hist?.status === "evite") {
      items.push({ ...common, ...at(null), status: "evite", foresight: null, day: null, dayApprox: null, gap: hist.divergence, conform: false, choice: null, pending: false });
    } else if (hist?.status === "passe") {
      items.push({ ...common, ...at(null), status: "passe", foresight: null, day: null, dayApprox: null, gap: 0, conform: true, choice: null, pending: false });
    } else if (pend) {
      items.push({ ...common, ...at(pend.day), status: "en_cours", foresight: null, day: pend.day, dayApprox: null, gap: 0, conform: null, choice: null, pending: true });
    } else {
      // Pas encore survenu : squelette dérivé du récit, programmé, ou simplement à venir.
      const d = e.playable ? "futur" : derived(e);
      if (d === "passe" || d === "en_cours") {
        items.push({ ...common, ...at(null, Math.min(e.year_min, state.date.year)), status: d, foresight: null, day: null, dayApprox: null, gap: 0, conform: null, choice: null, pending: false });
      } else {
        const ahead = sched ? sched.day - today : null;
        const fs = foresightFor(level, ahead, stepsOf(e.id));
        if (!fs) continue;
        const rumor = fs === "rumeur";
        const when = sched?.day ?? null;
        items.push({
          ...common,
          ...(rumor ? { code: null, title: rumorText(common.theme, e.id), summary: t("chrono.rumor_summary") } : {}),
          ...at(fs === "certitude" ? when : null, e.year_min),
          status: "annonce",
          foresight: fs,
          day: fs === "certitude" ? when : null,
          dayApprox: fs === "prevision" ? when : null,
          gap: 0,
          conform: null,
          choice: null,
          pending: false,
        });
      }
    }
  }
  // Faits de fond et événements génériques : ceux de la chronique (un par entrée).
  for (const c of ev.chronicle) {
    const e = cw.events.get(c.event);
    if (!e || e.kind === "canon" || (c.status !== "survenu" && c.status !== "en_attente")) continue;
    const pending = c.status === "en_attente" && ev.pending.some((p) => p.id === e.id && p.day === c.day);
    if (c.status === "en_attente" && !pending) continue;
    items.push({ ...base(e, "quotidien", c.subject), year: fromAbsoluteDay(c.day).year, sort: c.day, status: pending ? "en_cours" : "passe", foresight: null, day: c.day, dayApprox: null, gap: 0, conform: null, choice: c.choice, pending });
  }
  items.push(...missionItems(world, state));
  // Pas de spoiler : tant qu'un événement n'est pas résolu, ni résumé d'issue ni effets (le panneau les masque aussi).
  for (const i of items) if (i.group !== "mission" && (i.status === "en_cours" || (i.status === "annonce" && i.foresight !== "rumeur"))) i.summary = t("chrono.hook_summary");
  return items.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
}

const BRANCH_THEME: Readonly<Record<string, EventTheme>> = { militaire: "militaire", politique: "politique", economique: "politique", religion: "politique", renseignement: "monde", monde: "monde" };

/** Missions de la nation jouée : accomplies (à leur date) et en cours (à leur date d'accomplissement prévue), MIS.4. */
export function missionItems(world: World, state: GameState): TimelineItem[] {
  const mw = world.missions;
  if (!mw || !state.missions) return [];
  const side = sideOf(state.missions, playerNation(state.nations));
  const out: TimelineItem[] = [];
  const make = (id: string, day: number, status: "passe" | "en_cours"): void => {
    const m = mw.byId.get(id);
    if (!m) return;
    const def: EventDef = { id: `evt_${id}`, kind: "fond", theme: BRANCH_THEME[m.branch] ?? "monde", playable: false, year_min: fromAbsoluteDay(day).year, window: { after: null }, conditions: [], effects: m.effects, choices: [], form: "rapport", text_key: `mission.${id}`, canon: m.canon };
    out.push({
      id,
      code: null,
      group: "mission",
      theme: BRANCH_THEME[m.branch] ?? "monde",
      title: t(`mission.${id}`),
      summary: t(`mission.${id}.desc`),
      status,
      foresight: null,
      year: fromAbsoluteDay(day).year,
      yearMax: null,
      approx: false,
      day,
      dayApprox: null,
      gap: 0,
      conform: null,
      choice: null,
      playable: false,
      pending: false,
      def,
      subject: {},
      sort: day,
    });
  };
  for (const id of side.done) make(id, side.doneDay[id] ?? 0, "passe");
  for (const run of side.current) make(run.id, run.end, "en_cours");
  return out;
}

export const filterItems = (items: readonly TimelineItem[], theme: EventTheme | null, group: TimelineItem["group"]): TimelineItem[] => items.filter((i) => i.group === group && (theme === null || i.theme === theme));

export interface AxisYear {
  year: number;
  /** Largeur relative du segment. */
  weight: number;
  items: TimelineItem[];
}

/** Années de l'axe : 845 à 854, plus les années suivantes tant que la partie les atteint (« 854+ »). */
export function axisYears(items: readonly TimelineItem[], currentYear: number): AxisYear[] {
  const last = Math.max(854, currentYear, ...items.map((i) => i.year));
  return Array.from({ length: last - 845 + 1 }, (_, k) => {
    const year = 845 + k;
    const inYear = items.filter((i) => i.year === year);
    return { year, weight: Math.max(2, inYear.length), items: inYear };
  });
}

/** Libellé de date d'un élément (jamais de code ni de statut interne). */
export function dateLabel(i: TimelineItem): string {
  if (i.status === "annonce" && i.foresight === "rumeur") return t("chrono.date.soon");
  if (i.day !== null) {
    const d = fromAbsoluteDay(i.day);
    return t("date.format", { year: d.year, day: d.day });
  }
  if (i.dayApprox !== null) {
    const d = fromAbsoluteDay(i.dayApprox);
    return t("chrono.date.month", { month: Math.floor((d.day - 1) / 30) + 1, year: d.year });
  }
  if (i.yearMax !== null && i.yearMax > i.year) return t("chrono.date.range", { from: i.year, to: i.yearMax });
  return i.approx ? t("chrono.date.about", { year: i.year }) : t("chrono.date.year", { year: i.year });
}
