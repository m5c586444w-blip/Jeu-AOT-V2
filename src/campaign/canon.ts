import { checkCanon } from "../data/canonRules";
import type { RawData, RawEntry, Violation } from "../data/canonRules";
import { deepMerge } from "./campaign";

/**
 * canon:check des campagnes (P9, CP9-03) : chaque campagne est vérifiée comme un jeu de données à part entière (son scénario
 * dérivé et ses événements propres à la place de ceux de la base), par les mêmes règles R1–R14 ; seules les violations
 * nouvelles sont rapportées. S'y ajoute le contrôle des fenêtres de présence au départ (11 §3) : joueur, conseillers, chefs
 * d'organisation et sièges du Cabinet doivent être vivants et dans leur fenêtre l'année du départ.
 */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (x: unknown): number | undefined => (typeof x === "number" ? x : undefined);

export interface RawCampaign {
  file: string;
  v: Record<string, unknown>;
}

/** Données brutes vues par une campagne : scénario dérivé ajouté, événements propres substitués. */
export function campaignRaw(raw: RawData, c: RawCampaign): { raw: RawData; scenarioId: string } {
  const id = String(c.v["id"] ?? "c?");
  const scenarioId = `scn_camp_${id.replace(/^c/, "")}__normal`;
  const base = raw.scenarios.find((s) => s.id === c.v["base"]);
  const patch = isObj(c.v["scenario"]) ? c.v["scenario"] : {};
  const scenarios: RawEntry[] = base ? [...raw.scenarios, { file: c.file, id: scenarioId, v: { ...deepMerge(base.v, patch), id: scenarioId } }] : raw.scenarios;
  const events = new Map(raw.events.map((e) => [e.id, e]));
  for (const e of Array.isArray(c.v["events"]) ? c.v["events"] : []) {
    if (!isObj(e)) continue;
    const eid = typeof e["id"] === "string" ? e["id"] : "(sans id)";
    events.set(eid, { file: c.file, id: eid, v: e });
  }
  return { raw: { ...raw, scenarios, events: [...events.values()] }, scenarioId };
}

/** Fenêtres de présence au départ d'un scénario (11 §3) pour les personnages qu'il nomme dans sa couche politique. */
export function presenceAtStart(raw: RawData, scenarioId: string): Violation[] {
  const sc = raw.scenarios.find((s) => s.id === scenarioId);
  if (!sc) return [];
  const year = num(isObj(sc.v["start"]) ? sc.v["start"]["year"] : undefined) ?? 0;
  const pol = isObj(sc.v["politics"]) ? sc.v["politics"] : null;
  if (!pol) return [];
  const dead = new Set(Array.isArray(sc.v["deceased"]) ? sc.v["deceased"].filter((x): x is string => typeof x === "string") : []);
  const named: [string, string][] = [];
  if (typeof pol["player"] === "string") named.push(["joueur", pol["player"]]);
  for (const key of ["roles", "org_leaders"] as const) {
    const m = pol[key];
    if (isObj(m)) for (const [k, v] of Object.entries(m)) if (typeof v === "string") named.push([k, v]);
  }
  for (const v of Array.isArray(pol["cabinet_extra"]) ? pol["cabinet_extra"] : []) if (typeof v === "string") named.push(["cabinet", v]);
  const chars = new Map(raw.characters.map((c) => [c.id, c]));
  const out: Violation[] = [];
  for (const [where, who] of named) {
    const c = chars.get(who);
    const from = num(c?.v["active_from"]);
    const until = num(c?.v["active_until"]);
    if (!c) out.push({ rule: "R12", file: sc.file, id: sc.id, message: `${where} : personnage inconnu ${who}` });
    else if (dead.has(who)) out.push({ rule: "R12", file: sc.file, id: sc.id, message: `${where} : ${who} est déclaré mort au départ` });
    else if ((from !== undefined && from > year) || (until !== undefined && until < year)) out.push({ rule: "R12", file: sc.file, id: sc.id, message: `${where} : ${who} hors de sa fenêtre de présence en ${year} (11 §3)` });
  }
  return out;
}

/** Violations propres à chaque campagne (absentes du contrôle des données de base). */
export function checkCampaigns(raw: RawData, campaigns: readonly RawCampaign[]): Violation[] {
  const key = (v: Violation): string => `${v.rule}|${v.id}|${v.message}`;
  const baseline = new Set(checkCanon(raw).map(key));
  const out: Violation[] = [];
  for (const c of campaigns) {
    const canon = c.v["canon"];
    if (canon !== "C" && canon !== "A" && canon !== "?") out.push({ rule: "R6", file: c.file, id: String(c.v["id"] ?? "?"), message: "campagne sans statut canon" });
    const { raw: r, scenarioId } = campaignRaw(raw, c);
    if (!r.scenarios.some((s) => s.id === scenarioId)) out.push({ rule: "R12", file: c.file, id: String(c.v["id"] ?? "?"), message: `scénario de base inconnu ${String(c.v["base"])}` });
    for (const v of [...checkCanon(r), ...presenceAtStart(r, scenarioId)]) if (!baseline.has(key(v))) out.push({ ...v, message: `[${String(c.v["id"])}] ${v.message}` });
  }
  return out;
}
