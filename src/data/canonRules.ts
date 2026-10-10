import { COLLECTION_NAMES } from "./collections";
import type { CollectionName } from "./collections";

/**
 * Règles de cohérence canon R1–R12 (fichier 14 §3, fichier 11 §8 ; R7 : D-49 ; R8–R10 : P5, D-64 ; R11 : P6, 11 §4 ; R12 : P7). Fonctions pures sur des données brutes.
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

export type RuleId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8" | "R9" | "R10" | "R11" | "R12" | "R13" | "R14";

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

  // R7 — rattachement d'une province à localisation incertaine : statut obligatoire, jamais « C » (D-49)
  const uncertain = new Set(data.provinces.filter((p) => p.v["location_canon"] === "?").map((p) => p.id));
  for (const s of data.scenarios) {
    const control = (s.v["control"] ?? {}) as Record<string, unknown>;
    const status = (s.v["control_canon"] ?? {}) as Record<string, unknown>;
    for (const id of Object.keys(control)) {
      if (!uncertain.has(id)) continue;
      const c = status[id];
      if (c === undefined) push("R7", s, `rattachement de ${id} (localisation « ? ») sans statut dans control_canon`);
      else if (c === "C") push("R7", s, `rattachement de ${id} (localisation « ? ») présenté comme canon`);
    }
  }

  checkEventEffects(data, push);
  checkShifterChains(data, push);
  checkScenarioStart(data, push);
  checkWeapons(data, eventYear, push);
  checkMissions(data, eventYear, push);
  return out;
}

/**
 * R14 — missions nationales (MIS, 23 §5) : une mission ne force jamais un événement du récit (les événements qu'elle déclenche sont
 * génériques ou de fond ; 12 §3) ; chaque référence existe et appartient au même scénario et à la même nation ; aucun cycle de
 * prérequis ; aucune mission avant l'année de la technologie ou de l'événement qu'elle exige (11 §8) ; une mission `C` ou `?` documente sa source.
 */
function checkMissions(data: RawData, eventYear: (id: string) => number | undefined, push: (rule: RuleId, e: RawEntry, message: string) => void): void {
  const missions = new Map(data.missions.map((m) => [m.id, m]));
  const events = new Map(data.events.map((e) => [e.id, e]));
  const techs = new Map(data.techs.map((t) => [t.id, t]));
  const after = (m: RawEntry): string[] => [...strList(m.v["prereqs"])];
  for (const m of data.missions) {
    const scenarios = strList(m.v["scenarios"]);
    const nation = str(m.v["nation"]);
    const minYear = num(m.v["min_year"]);
    if ((m.v["canon"] === "C" || m.v["canon"] === "?") && !str(m.v["notes_canon"])) push("R14", m, "mission canon C ou ? sans notes_canon (source ou question ouverte)");
    if (nation === "marley" && scenarios.some((s) => s !== "scn_854")) push("R14", m, "mission de Marley hors du scénario 854");
    for (const id of strList(m.v["events"])) {
      const ev = events.get(id);
      if (!ev) push("R14", m, `événement déclenché inconnu : ${id}`);
      else if ((str(ev.v["kind"]) ?? "canon") === "canon") push("R14", m, `déclenche l'événement canon ${id} : une mission ne force jamais le récit (12 §3)`);
    }
    for (const f of objList(m.v["effects"])) {
      if (["control", "kill", "inherit", "schedule", "divergence", "flag", "capture_shifter", "shifter_faction", "world_war", "world_losses", "serum", "captured", "reveal", "stress"].includes(str(f["op"]) ?? "")) push("R14", m, `effet interdit : ${String(f["op"])}`);
    }
    for (const ref of [...strList(m.v["prereqs"]), ...strList(m.v["any_of"]), ...strList(m.v["exclusive_with"])]) {
      const other = missions.get(ref);
      if (!other) {
        push("R14", m, `mission référencée inconnue : ${ref}`);
        continue;
      }
      if (str(other.v["nation"]) !== nation) push("R14", m, `${ref} appartient à une autre nation`);
      const there = strList(other.v["scenarios"]);
      for (const s of scenarios) if (!there.includes(s)) push("R14", m, `${ref} n'est pas offerte dans ${s}, où cette mission l'exige`);
    }
    for (const c of objList(m.v["requires"])) {
      const tech = str(c["tech"]);
      const ty = tech ? num(techs.get(tech)?.v["min_year"]) : undefined;
      if (tech && ty !== undefined && minYear !== undefined && ty > minYear) push("R14", m, `exige ${tech} (année ${ty}) avant ${ty} (min_year ${minYear})`);
      const fired = str(c["fired"]);
      const fy = fired ? eventYear(fired) : undefined;
      if (fired && fy !== undefined && minYear !== undefined && fy > minYear) push("R14", m, `exige l'événement ${fired} (année ${fy}) avant ${fy} (min_year ${minYear})`);
    }
  }
  for (const cycle of findCycles(data.missions, after)) {
    const first = missions.get(cycle[0] as string);
    if (first) push("R14", first, `prérequis cycliques : ${cycle.join(" → ")}`);
  }
}

/** Les lances de foudre n'existent qu'à la fin de 850 (11 §1, E40) : technologies qui les débloquent. */
export const THUNDER_SPEAR_TECHS: readonly string[] = ["tech_thunder_spear_prototype", "tech_thunder_spear_mass", "tech_thunder_spear_improved"];

/**
 * R13 — armes et forces de PA (21 §7, 23 §3.2) : aucune arme avant sa date (année minimale ≥ celle de l'événement ou de la
 * technologie exigée ; lances de foudre verrouillées par T-ANT-08/09) ; aucune armée de départ avec une arme pas encore
 * disponible ni un général hors de sa fenêtre de présence ; aucun navire ni flotte pour Paradis.
 */
function checkWeapons(data: RawData, eventYear: (id: string) => number | undefined, push: (rule: RuleId, e: RawEntry, message: string) => void): void {
  const techs = new Map(data.techs.map((t) => [t.id, t]));
  const chars = new Map(data.characters.map((c) => [c.id, c]));
  const scenarioYear = new Map(data.scenarios.map((sc) => [sc.id, num((sc.v["start"] as Record<string, unknown> | undefined)?.["year"])]));
  const minYearOf = (e: RawEntry): number | undefined => num((e.v["requires"] as Record<string, unknown> | undefined)?.["min_year"]);
  const reqs = new Map<string, number>();
  for (const e of [...data.artillery, ...data.armies]) {
    const r = e.v["requires"] as Record<string, unknown> | undefined;
    if (!r) continue;
    const y = num(r["min_year"]);
    if (y === undefined) {
      push("R13", e, "requires.min_year manquant");
      continue;
    }
    reqs.set(e.id, y);
    const ev = str(r["event"]);
    const ey = ev ? eventYear(ev) : undefined;
    if (ev && ey === undefined) push("R13", e, `événement exigé inconnu : ${ev}`);
    if (ey !== undefined && y < ey) push("R13", e, `disponible en ${y}, avant l'événement ${ev ?? ""} (${ey})`);
    const tech = str(r["tech"]);
    const tt = tech ? techs.get(tech) : undefined;
    if (tech && !tt) push("R13", e, `technologie exigée inconnue : ${tech}`);
    const ty = tt ? num(tt.v["min_year"]) : undefined;
    if (ty !== undefined && y < ty) push("R13", e, `disponible en ${y}, avant la technologie ${tech ?? ""} (${ty})`);
    if (e.v["kind"] === "lances" && (!tech || !THUNDER_SPEAR_TECHS.includes(tech) || y < 850)) push("R13", e, "lances de foudre sans verrou T-ANT-08/09 ou avant 850 (11 §1)");
    if ((e.v["type"] === "ship" || e.v["type"] === "fleet") && e.v["faction"] === "fac_paradis") push("R13", e, "aucune marine pour Paradis (23 §3.2)");
  }
  for (const e of data.armies) {
    if (e.v["type"] === "fleet" && e.v["faction"] === "fac_paradis") push("R13", e, "aucune flotte pour Paradis (23 §3.2)");
    if (e.v["type"] !== "army" && e.v["type"] !== "fleet") continue;
    const y = scenarioYear.get(str(e.v["scenario"]) ?? "");
    if (y === undefined) {
      push("R13", e, `scénario inconnu : ${String(e.v["scenario"])}`);
      continue;
    }
    for (const r of (e.v["regiments"] ?? e.v["ships"] ?? []) as Record<string, unknown>[]) {
      const id = str(r["regiment"] ?? r["ship"]) ?? "";
      const ry = reqs.get(id);
      if (ry !== undefined && ry > y) push("R13", e, `${id} (disponible en ${ry}) au départ de ${y}`);
      const entry = data.armies.find((x) => x.id === id);
      const tech = str((entry?.v["requires"] as Record<string, unknown> | undefined)?.["tech"]);
      const tt = tech ? techs.get(tech) : undefined;
      if (tt && (num(tt.v["min_year"]) ?? 0) > y) push("R13", e, `${id} exige ${tech ?? ""} (${String(tt.v["min_year"])}) au départ de ${y}`);
    }
    const who = str(e.v["general"] ?? e.v["admiral"]);
    const c = who ? chars.get(who) : undefined;
    if (who && !c) push("R13", e, `chef inconnu : ${who}`);
    if (c) {
      const from = num(c.v["active_from"]);
      const until = num(c.v["active_until"]);
      if ((from !== undefined && from > y) || (until !== undefined && until < y)) push("R13", e, `${who} hors de sa fenêtre de présence en ${y} (11 §3)`);
    }
  }
  void minYearOf;
}

/**
 * R12 — départ d'un scénario (P7) : tout personnage dont l'événement de mort est antérieur à l'année du scénario
 * est déclaré mort au départ, et aucun autre canon ne l'est sans raison ; chaque porteur de départ figure dans
 * la chaîne de son Titan (11 §4), à une époque compatible ; aucun mort ne tient le gouvernement de départ.
 */
function checkScenarioStart(data: RawData, push: (rule: RuleId, e: RawEntry, message: string) => void): void {
  const events = new Map(data.events.map((e) => [e.id, e]));
  const chains = new Map(data.shifters.map((x) => [x.id, objList(x.v["chain"])]));
  for (const sc of data.scenarios) {
    const y = num((sc.v["start"] as Obj | undefined)?.["year"]);
    const deceased = new Set(strList(sc.v["deceased"]));
    if (y === undefined || (!sc.v["deceased"] && !sc.v["shifter_holders"])) continue;
    for (const c of data.characters) {
      const ev = str(c.v["death_event"]);
      const ey = ev ? num(events.get(ev)?.v["year_min"]) : undefined;
      if (ey !== undefined && ey < y && !deceased.has(c.id)) push("R12", sc, `${c.id} meurt à ${ev ?? ""} (${ey}) mais n'est pas déclaré mort au départ (${y})`);
    }
    for (const [sh, h] of Object.entries((sc.v["shifter_holders"] ?? {}) as Record<string, Obj>)) {
      const who = str(h["character"]);
      if (!who) continue;
      const link = (chains.get(sh) ?? []).find((c) => c["holder"] === who);
      if (!link) push("R12", sc, `${who} porte ${sh} au départ sans figurer dans sa chaîne (11 §4)`);
      else if ((num(link["to"]) ?? 9999) < y) push("R12", sc, `${who} porte ${sh} au départ alors que sa chaîne l'arrête en ${String(link["to"])}`);
      if (deceased.has(who)) push("R12", sc, `${who} porte ${sh} au départ mais est déclaré mort`);
    }
    // Gouvernement de départ (revue de P9) : ni le joueur, ni un poste, ni un chef d'organisation tenu par un mort.
    const pol = (sc.v["politics"] ?? {}) as Obj;
    const seats: [string, unknown][] = [["joueur", pol["player"]], ...Object.entries((pol["roles"] ?? {}) as Obj), ...Object.entries((pol["org_leaders"] ?? {}) as Obj)];
    for (const [seat, who] of seats) if (typeof who === "string" && deceased.has(who)) push("R12", sc, `${who} tient « ${seat} » au départ mais est déclaré mort`);
  }
}

/**
 * Chaînes de porteurs corrigées (11 §4) : noms dans l'ordre, et années quand 11 les donne (null = non donnée, non vérifiée).
 * Les dates exactes des transferts restent « ? » ailleurs (11 §4, note).
 */
export const CANON_CHAINS: Readonly<Record<string, readonly (readonly [string, number | null, number | null])[]>> = {
  shifter_assaillant: [["Eren Kruger", 819, 832], ["Grisha Yeager", 832, 845], ["Eren Yeager", 845, null]],
  shifter_fondateur: [["Frieda Reiss", 842, 845], ["Grisha Yeager", 845, 845], ["Eren Yeager", 845, null]],
  shifter_bestial: [["Tom Ksaver", 829, 842], ["Zeke", 842, null]],
  shifter_machoire: [["Marcel Galliard", 843, 845], ["Ymir", null, null], ["Porco Galliard", null, null], ["Falco Grice", 854, null]],
  shifter_colossal: [["Bertholdt Hoover", null, null], ["Armin Arlert", 850, null]],
  shifter_cuirasse: [["Reiner Braun", null, null]],
  shifter_feminin: [["Annie Leonhart", null, null]],
  shifter_charrette: [["Pieck", null, null]],
  shifter_marteau: [["Lara Tybur", null, null], ["Eren Yeager", 854, null]],
};

/**
 * R11 — porteurs (P6) : chaque chaîne suit 11 §4 (noms, ordre, années données) ; un personnage marqué d'un Titan caché
 * (`hidden.titan`) est le porteur de ce Titan en 850, et réciproquement ; le porteur de 850 figure dans la chaîne.
 */
function checkShifterChains(data: RawData, push: (rule: RuleId, e: RawEntry, message: string) => void): void {
  const holders = new Map<string, Set<string>>();
  for (const sh of data.shifters) {
    const chain = objList(sh.v["chain"]);
    const expected = CANON_CHAINS[sh.id];
    if (!expected) push("R11", sh, "Titan absent des chaînes de 11 §4");
    else {
      const names = chain.map((c) => str(c["name"]) ?? "?");
      if (names.join(" → ") !== expected.map((x) => x[0]).join(" → ")) push("R11", sh, `chaîne ${names.join(" → ")} ≠ 11 §4 : ${expected.map((x) => x[0]).join(" → ")}`);
      else
        expected.forEach(([name, from, to], i) => {
          const c = chain[i] ?? {};
          if (from !== null && c["from"] !== from) push("R11", sh, `${name} : début ${String(c["from"])} ≠ ${from} (11 §4)`);
          if (to !== null && c["to"] !== to) push("R11", sh, `${name} : fin ${String(c["to"])} ≠ ${to} (11 §4)`);
        });
    }
    const key = sh.id.replace(/^shifter_/, "");
    const h850 = str((sh.v["holder_850"] as Obj | undefined)?.["character"]);
    if (h850) holders.set(h850, new Set([...(holders.get(h850) ?? []), key]));
    if (h850 && !chain.some((c) => c["holder"] === h850)) push("R11", sh, `porteur de 850 ${h850} absent de la chaîne`);
  }
  if (data.shifters.length === 0) return;
  for (const c of data.characters) {
    const hidden = c.v["hidden"] as Obj | undefined;
    const declared = new Set((str(hidden?.["titan"]) ?? "").split("_").filter(Boolean));
    const in850 = holders.get(c.id) ?? new Set<string>();
    for (const t of declared) if (!in850.has(t)) push("R11", c, `Titan caché « ${t} » alors qu'il ne porte pas shifter_${t} en 850`);
    for (const t of in850) if (!declared.has(t)) push("R11", c, `porteur de shifter_${t} en 850 sans hidden.titan correspondant`);
  }
}

type Obj = Record<string, unknown>;
const objList = (x: unknown): Obj[] => (Array.isArray(x) ? x.filter((o): o is Obj => typeof o === "object" && o !== null) : []);

/**
 * R8 — morts canon : sur le chemin historique d'un événement (effets et choix historique), un personnage ne meurt que si
 * son `death_event` est cet événement (un `inherit` tue le porteur de 850 du Titan) ; et tout personnage dont le `death_event` est un événement jouable y meurt.
 * R9 — références des effets et conditions (personnages, provinces, organisations, strates, événements, secrets, technologies).
 * R10 — anachronismes (13 §11, 11 §8) : un événement ne peut exiger ni débloquer une technologie postérieure à son année.
 */
function checkEventEffects(data: RawData, push: (rule: RuleId, e: RawEntry, message: string) => void): void {
  const chars = new Map(data.characters.map((c) => [c.id, c]));
  const ids = {
    char: new Set(chars.keys()),
    prov: new Set([...data.provinces.map((p) => p.id), ...data.world_provinces.map((p) => p.id)]),
    fac: new Set(data.factions.map((f) => f.id)),
    org: new Set(data.organisations.map((o) => o.id)),
    str: new Set(data.strata.map((x) => x.id)),
    evt: new Set(data.events.map((e) => e.id)),
    tech: new Set(data.techs.map((t) => t.id)),
    shifter: new Set(data.shifters.map((x) => x.id)),
    secret: new Set(data.characters.filter((c) => c.v["hidden"] && Object.keys(c.v["hidden"] as Obj).length > 0).map((c) => `secret_${c.id.replace(/^char_/, "")}`)),
  };
  const techYear = new Map(data.techs.map((t) => [t.id, num(t.v["min_year"])]));
  // Un héritage préparé (`inherit`, P6) fait dévorer le porteur de 850 du Titan : c'est une mort.
  const holder850 = new Map(data.shifters.map((sh) => [sh.id, str((sh.v["holder_850"] as Obj | undefined)?.["character"])]));
  const killed = (f: Obj): string | undefined => (f["op"] === "kill" ? str(f["character"]) : f["op"] === "inherit" ? holder850.get(str(f["shifter"]) ?? "") : undefined);
  const placeholders = new Set(["char_subject", "prov_subject"]);
  const check = (e: RawEntry, kind: keyof typeof ids, id: unknown, where: string): void => {
    const s = str(id);
    if (s === undefined || s === "all" || placeholders.has(s)) return;
    if (!ids[kind].has(s)) push("R9", e, `${where} : référence inconnue ${s}`);
  };
  const refs = (e: RawEntry, x: Obj, where: string): void => {
    for (const [k, kind] of [["character", "char"], ["alive", "char"], ["dead", "char"], ["province", "prov"], ["control", "prov"], ["org", "org"], ["stratum", "str"], ["event", "evt"], ["fired", "evt"], ["not_fired", "evt"], ["choice", "evt"], ["secret", "secret"], ["tech", "tech"], ["heir", "char"], ["shifter", "shifter"], ["a", "fac"], ["b", "fac"], ["from", "fac"], ["to", "fac"]] as const) {
      if (k in x) check(e, kind, x[k], where);
    }
    // `faction` désigne une nation (fac_…) dans les effets du monde, un camp de porteurs ailleurs (shifter_faction).
    if (str(x["faction"])?.startsWith("fac_")) check(e, "fac", x["faction"], where);
    const t = str(x["tech"]);
    const y = num(e.v["year_min"]);
    const ty = t ? techYear.get(t) : undefined;
    if (t && y !== undefined && ty !== undefined && ty > y) push("R10", e, `${where} : exige ${t} (année ${ty}) en ${y}`);
  };
  for (const e of data.events) {
    const choices = objList(e.v["choices"]);
    const effects = objList(e.v["effects"]);
    for (const [i, c] of objList(e.v["conditions"]).entries()) refs(e, c, `conditions[${i}]`);
    for (const [i, f] of effects.entries()) refs(e, f, `effects[${i}]`);
    for (const c of choices) {
      for (const [i, f] of objList(c["effects"]).entries()) refs(e, f, `choix ${String(c["id"])} effects[${i}]`);
      for (const [i, r] of objList(c["requires"]).entries()) refs(e, r, `choix ${String(c["id"])} requires[${i}]`);
    }
    if (e.v["playable"] === false || e.v["kind"] === "generic" || e.v["kind"] === "fond") continue;
    const historical = [...effects, ...choices.filter((c) => c["historical"] === true).flatMap((c) => objList(c["effects"]))];
    for (const k of historical.filter((f) => killed(f) !== undefined)) {
      const who = killed(k) ?? "";
      const death = str(chars.get(who)?.v["death_event"]);
      if (death !== e.id) push("R8", e, `mort de ${who} sur le chemin historique alors que son death_event est ${death ?? "absent"}`);
    }
  }
  const playable = new Map(data.events.filter((e) => e.v["playable"] !== false).map((e) => [e.id, e]));
  for (const c of data.characters) {
    const death = str(c.v["death_event"]);
    const ev = death ? playable.get(death) : undefined;
    // Un squelette sans mécanique (ni effets ni choix) ne porte pas encore de mort.
    if (!ev || (objList(ev.v["effects"]).length === 0 && objList(ev.v["choices"]).length === 0)) continue;
    const historical = [...objList(ev.v["effects"]), ...objList(ev.v["choices"]).filter((x) => x["historical"] === true).flatMap((x) => objList(x["effects"]))];
    if (!historical.some((f) => killed(f) === c.id)) push("R8", c, `death_event ${death} : l'événement ne le fait pas mourir sur son chemin historique`);
  }
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
