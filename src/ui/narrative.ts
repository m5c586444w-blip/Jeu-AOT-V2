import { hasKey, t } from "../i18n";
import type { GameState } from "../sim/core/state";
import { fromAbsoluteDay } from "../sim/core/time";
import type { World } from "../sim/strategic/world";
import type { BattleState, SoldierUnit } from "../sim/tactical/types";
import { formatNumber } from "./why";

/**
 * Récits tirés de l'état (P8 ; 04 §5.10, §5.12, §5.15) : gazette de la nation jouée, lettres aux familles, épilogue.
 * Textes sobres, par modèles (`narr.*`) et variantes choisies de façon déterministe ; jamais de clé brute.
 */

function pick(seed: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % n;
}

const label = (v: string | number): string | number => (typeof v === "string" && hasKey(v) ? t(v) : v);

export interface Article {
  headline: string;
  body: string;
  date: string;
  kind: "une" | "breve" | "chronique";
}

/** Gazette (04 §5.10) : presse de Paradis, ou propagande de Marley quand le joueur mène Marley. */
export function gazette(world: World, s: GameState): { masthead: string; articles: Article[] } {
  const marley = s.nations?.player === "fac_marley";
  const articles: Article[] = [];
  const cw = world.chronicle;
  // À la une : les derniers événements de la chronique.
  for (const c of [...(s.events?.chronicle ?? [])].reverse().filter((x) => x.status === "survenu").slice(0, 3)) {
    const e = cw?.events.get(c.event);
    if (!e) continue;
    const d = fromAbsoluteDay(c.day);
    const v = pick(e.id, 3);
    articles.push({ kind: articles.length === 0 ? "une" : "chronique", headline: t(e.text_key), body: t(`narr.${marley ? "marley" : "paradis"}.event.${v}`, { title: t(e.text_key) }), date: t("date.format", { year: d.year, day: d.day }) });
  }
  // Brèves : alertes du royaume, ou nouvelles du front pour Marley.
  if (marley) {
    for (const l of [...(s.nations?.log ?? [])].reverse().slice(0, 5)) {
      const d = fromAbsoluteDay(l.day);
      const params = Object.fromEntries(Object.entries(l.params).map(([k, v]) => [k, label(v)]));
      articles.push({ kind: "breve", headline: t(`narr.marley.brief.${pick(l.key + l.day, 3)}`), body: t(l.key, params), date: t("date.format", { year: d.year, day: d.day }) });
    }
  } else {
    for (const l of [...(s.strategic?.log ?? [])].reverse().filter((x) => x.pause).slice(0, 5)) {
      const params = Object.fromEntries(Object.entries(l.params).map(([k, v]) => [k, label(v)]));
      articles.push({ kind: "breve", headline: t(`narr.paradis.brief.${pick(l.key + l.seq, 3)}`), body: t(l.key, params), date: t("date.format", { year: l.date.year, day: l.date.day }) });
    }
  }
  if (articles.length === 0) articles.push({ kind: "une", headline: t(marley ? "narr.marley.quiet_title" : "narr.paradis.quiet_title"), body: t(marley ? "narr.marley.quiet" : "narr.paradis.quiet"), date: t("date.format", { year: s.date.year, day: s.date.day }) });
  return { masthead: t(marley ? "narr.marley.masthead" : "narr.paradis.masthead"), articles };
}

/** Lettre à la famille d'un soldat tombé (04 §5.12) : nom, escouade, cause, ton sobre ; variantes déterministes. */
export function letterFor(world: World, bt: BattleState, s: SoldierUnit, place: string): string {
  const d = s.death;
  if (!d) return "";
  const titan = d.titan !== null ? bt.titans[d.titan] : undefined;
  const titanName = titan ? t(titan.shifter !== undefined ? (world.shifters?.defs.get(bt.shifters?.[titan.shifter]?.shifter ?? "")?.name_key ?? "") : (world.tactical?.titanTypes.get(titan.type)?.name_key ?? "")) : "";
  const v = pick(s.id + s.name, 3);
  return t(`narr.letter.${v}`, { name: s.name, squad: s.squad.replace(/^esc_0?/, ""), cause: t(`narr.cause.${d.cause}`, { titan: titanName }), place });
}

export interface Epilogue {
  title: string;
  lines: string[];
  stats: { key: string; value: number | string }[];
}

/** Épilogue (04 §5.15) : décisions marquantes et chiffres de la partie, tirés de l'état. */
export function epilogue(world: World, s: GameState): Epilogue {
  const start = world.scenario.start;
  const days = (s.date.year - start.year) * 360 + (s.date.day - start.day);
  const pol = s.politics;
  // Morts de la partie seulement : celles d'avant le départ (marquées « death.before_scenario ») ne sont pas du récit joué.
  const dead = Object.entries(pol?.characters ?? {}).filter(([, c]) => !c.alive && c.death && c.death.circumstances !== "death.before_scenario" && (c.death.date.year > start.year || (c.death.date.year === start.year && c.death.date.day >= start.day)));
  const ev = s.events;
  const happened = Object.values(ev?.history ?? {}).filter((r) => r.status === "survenu").length;
  const avoided = Object.values(ev?.history ?? {}).filter((r) => r.status === "evite").length;
  const lines: string[] = [];
  // Aucun « 0 » dans le récit (R0.2g) : rien encore d'arrivé, ou rien d'évité, se dit en toutes lettres.
  const branch = ev?.branch === "divergente" ? "divergent" : "canon";
  if (ev && happened + avoided === 0) lines.push(t(days > 0 ? "narr.epi.no_canon" : "narr.epi.nothing_yet"));
  else if (ev) lines.push(t(avoided === 0 ? `narr.epi.${branch}_none_avoided` : `narr.epi.${branch}`, { n: happened, a: avoided }));
  for (const [id, c] of dead.slice(0, 6)) lines.push(t("narr.epi.death", { name: world.politics?.characters.get(id)?.name ?? id, year: c.death?.date.year ?? "", cause: t(`death.cause.${c.death?.cause ?? "inconnue"}`) }));
  const sh = s.shifters;
  for (const r of (sh?.history ?? []).filter((x) => x.kind === "prepare").slice(-3)) lines.push(t("narr.epi.inherit", { titan: t(world.shifters?.defs.get(r.shifter)?.name_key ?? r.shifter), heir: world.politics?.characters.get(r.to ?? "")?.name ?? "—" }));
  const ns = s.nations;
  if (ns) {
    lines.push(t(`narr.epi.hizuru.${ns.hizuruSide}`));
    for (const w of ns.wars) lines.push(t("narr.epi.war", { a: t(world.nations?.factions.get(w.split("|")[0] ?? "")?.name_key ?? ""), b: t(world.nations?.factions.get(w.split("|")[1] ?? "")?.name_key ?? "") }));
  }
  // Grondement (P9.4) : issue de la crise et posture choisie.
  const rb = s.rumbling;
  if (rb) {
    const part = Math.round(rb.ravaged * 100);
    if (rb.stopped) lines.push(t("narr.epi.rumbling_stopped", { n: rb.attempts, part }));
    else lines.push(part === 0 ? t("narr.epi.rumbling_started") : t("narr.epi.rumbling_running", { part }));
    if (rb.stance) lines.push(t(`narr.epi.rumbling_stance.${rb.stance}`));
  }
  // Aucun « 0 » par défaut (R0.2g) : une donnée dont la couche manque est masquée ; un compte encore nul s'affiche « — ».
  const count = (n: number): number | string => (n === 0 ? "—" : n);
  const stats: Epilogue["stats"] = [{ key: "narr.stat.days", value: count(days) }];
  if (pol) {
    stats.push({ key: "narr.stat.legitimacy", value: Math.round(pol.legitimacy) });
    stats.push({ key: "narr.stat.named_dead", value: count(dead.length) });
  }
  if (ev) {
    stats.push({ key: "narr.stat.events", value: count(happened) });
    stats.push({ key: "narr.stat.divergence", value: count(Math.round(ev.divergence * 100) / 100) });
  }
  if (s.military) stats.push({ key: "narr.stat.expeditions", value: count(s.military.reports.length) });
  if (rb) {
    stats.push({ key: "narr.stat.ravaged", value: count(Math.round(rb.ravaged * 100)) });
    stats.push({ key: "narr.stat.rumbling_dead", value: rb.dead > 0 ? formatNumber(rb.dead) : "—" });
    if (rb.evacuated > 0) stats.push({ key: "narr.stat.evacuated", value: formatNumber(rb.evacuated) });
  }
  return { title: t("narr.epi.title", { year: s.date.year }), lines, stats };
}
