import { COLLECTION_NAMES } from "./collections";
import type { CollectionName } from "./collections";

/**
 * Règles de cohérence canon R1–R6 (fichier 14 §3, fichier 11 §8). Fonctions pures sur des données brutes.
 * Les années incertaines se comparent par `year_min` (errata utilisateur).
 */
export interface RawEntry {
  file: string;
  id: string;
  v: Record<string, unknown>;
}

export type RawData = Record<CollectionName, RawEntry[]>;

export function emptyRaw(): RawData {
  return Object.fromEntries(COLLECTION_NAMES.map((c) => [c, []])) as unknown as RawData;
}

export type RuleId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";

export interface Violation {
  rule: RuleId;
  file: string;
  id: string;
  message: string;
}

export function formatViolation(v: Violation): string {
  return `${v.rule} ${v.file} ${v.id} : ${v.message}`;
}

const num = (x: unknown): number | undefined => (typeof x === "number" && Number.isFinite(x) ? x : undefined);
const str = (x: unknown): string | undefined => (typeof x === "string" ? x : undefined);
const strList = (x: unknown): string[] => (typeof x === "string" ? [x] : Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);

export function checkCanon(data: RawData): Violation[] {
  const out: Violation[] = [];
  const events = new Map(data.events.map((e) => [e.id, e]));
  const eventYear = (id: string): number | undefined => num(events.get(id)?.v["year_min"]);
  const push = (rule: RuleId, e: RawEntry, message: string): void => {
    out.push({ rule, file: e.file, id: e.id, message });
  };

  // R1 / R2 — technologies
  for (const t of data.techs) {
    const minYear = num(t.v["min_year"]);
    const unlock = strList(t.v["unlock_event"]);
    if (minYear === undefined) push("R1", t, "min_year manquant");
    else if (t.v["canon"] === "C" && minYear >= 850 && unlock.length === 0) {
      push("R1", t, `technologie canon tardive (min_year ${minYear}) sans unlock_event`);
    }
    if (minYear !== undefined && unlock.length > 0) {
      const years = unlock.map((id) => ({ id, y: eventYear(id) }));
      const missing = years.filter((x) => x.y === undefined);
      if (missing.length > 0) push("R2", t, `unlock_event inconnu : ${missing.map((m) => m.id).join(", ")}`);
      else {
        const earliest = Math.min(...years.map((x) => x.y as number));
        if (minYear < earliest) push("R2", t, `min_year ${minYear} antérieur à l'événement de déblocage (année ${earliest})`);
      }
    }
  }

  // R3 — fenêtres de présence
  for (const c of data.characters) {
    const from = num(c.v["active_from"]);
    const until = num(c.v["active_until"]);
    const death = str(c.v["death_event"]);
    if (from === undefined) push("R3", c, "active_from manquant");
    if (from !== undefined && until !== undefined && from > until) push("R3", c, `fenêtre inversée (active_from ${from} > active_until ${until})`);
    if (death !== undefined) {
      const y = eventYear(death);
      if (y === undefined) push("R3", c, `death_event inconnu : ${death}`);
      else if (until === undefined) push("R3", c, `death_event ${death} sans active_until`);
      else if (y > until) push("R3", c, `death_event ${death} (année ${y}) postérieur à active_until ${until}`);
    }
  }

  // R4 — graphe des événements
  const after = (e: RawEntry): string[] => strList((e.v["window"] as Record<string, unknown> | undefined)?.["after"]);
  for (const e of data.events) {
    const y = num(e.v["year_min"]);
    for (const p of after(e)) {
      const pred = events.get(p);
      if (!pred) push("R4", e, `prédécesseur inconnu : ${p}`);
      else {
        const py = num(pred.v["year_min"]);
        if (y !== undefined && py !== undefined && y < py) push("R4", e, `année ${y} antérieure à celle de son prédécesseur ${p} (${py})`);
      }
    }
  }
  for (const cycle of findCycles(data.events, after)) {
    const first = events.get(cycle[0] as string);
    if (first) push("R4", first, `dépendance cyclique : ${cycle.join(" → ")}`);
  }

  // R5 — lieux détruits
  const destroyed = new Map<string, number>();
  for (const p of data.provinces) {
    const y = num(p.v["destroyed_year"]);
    if (y !== undefined) destroyed.set(p.id, y);
  }
  const located: { e: RawEntry; loc: string | undefined; year: number | undefined }[] = [
    ...data.placements.map((e) => ({ e, loc: str(e.v["location"]), year: num(e.v["year"]) })),
    ...data.events.map((e) => ({ e, loc: str(e.v["location"]), year: num(e.v["year_min"]) })),
  ];
  for (const { e, loc, year } of located) {
    if (loc === undefined || year === undefined) continue;
    const d = destroyed.get(loc);
    if (d !== undefined && year > d) push("R5", e, `situé à ${loc} en ${year}, après sa destruction (${d})`);
  }

  // R6 — statut canon
  for (const list of COLLECTION_NAMES.map((c) => data[c])) {
    for (const e of list) {
      const c = e.v["canon"];
      if (c !== "C" && c !== "A" && c !== "?") push("R6", e, `statut canon absent ou invalide (${JSON.stringify(c) ?? "absent"})`);
    }
  }
  return out;
}

/** Détection de cycles par parcours en profondeur (trois couleurs). Renvoie un chemin par cycle trouvé. */
function findCycles(events: RawEntry[], after: (e: RawEntry) => string[]): string[][] {
  const byId = new Map(events.map((e) => [e.id, e]));
  const color = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const visit = (id: string): void => {
    color.set(id, 1);
    stack.push(id);
    const node = byId.get(id);
    for (const p of node ? after(node) : []) {
      if (!byId.has(p)) continue;
      const c = color.get(p) ?? 0;
      if (c === 1) cycles.push([...stack.slice(stack.indexOf(p)), p]);
      else if (c === 0) visit(p);
    }
    stack.pop();
    color.set(id, 2);
  };
  for (const e of events) if ((color.get(e.id) ?? 0) === 0) visit(e.id);
  return cycles;
}
