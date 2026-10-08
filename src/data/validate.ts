import type { z } from "zod";
import { COLLECTION_NAMES, COLLECTIONS } from "./schemas";
import type { ArmiesEntry, ArtilleryEntry } from "./armySchemas";
import type { Mission } from "./missionSchemas";
import type { Building, Character, CollectionName, EventDef, Law, NameList, Organisation, Placement, Province, Role, Scenario, Stratum, TacticalMap, Tech, Shifter, WorldProvince, Faction, Formation, TitanClass, TitanType, Trait, Unit } from "./schemas";

/** Une erreur de donnée porte toujours le chemin du fichier et le chemin JSON. */
export interface DataIssue {
  file: string;
  jsonPath: string;
  message: string;
}

export function formatIssue(i: DataIssue): string {
  return `${i.file} : ${i.jsonPath} — ${i.message}`;
}

export interface GameData {
  provinces: Province[];
  characters: Character[];
  techs: Tech[];
  events: EventDef[];
  placements: Placement[];
  buildings: Building[];
  scenarios: Scenario[];
  traits: Trait[];
  strata: Stratum[];
  organisations: Organisation[];
  laws: Law[];
  roles: Role[];
  units: Unit[];
  titans: TitanClass[];
  names: NameList[];
  titan_types: TitanType[];
  shifters: Shifter[];
  world_provinces: WorldProvince[];
  factions: Faction[];
  formations: Formation[];
  tactical_maps: TacticalMap[];
  artillery: ArtilleryEntry[];
  armies: ArmiesEntry[];
  missions: Mission[];
  /** Fichier d'origine de chaque identifiant (pour les messages de canon:check). */
  sources: Map<string, string>;
}

export function emptyData(): GameData {
  return { provinces: [], characters: [], techs: [], events: [], placements: [], buildings: [], scenarios: [], traits: [], strata: [], organisations: [], laws: [], roles: [], units: [], titans: [], names: [], titan_types: [], tactical_maps: [], shifters: [], world_provinces: [], factions: [], formations: [], artillery: [], armies: [], missions: [], sources: new Map() };
}

export function jsonPath(path: readonly PropertyKey[]): string {
  return "$" + path.map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`)).join("");
}

/** Valide le contenu (déjà parsé) d'un fichier de collection ; ajoute les entrées valides à `data`. */
export function validateCollectionFile(collection: CollectionName, file: string, json: unknown, data: GameData): DataIssue[] {
  const issues: DataIssue[] = [];
  if (!Array.isArray(json)) return [{ file, jsonPath: "$", message: "la racine doit être un tableau d'entrées" }];
  const schema = COLLECTIONS[collection] as z.ZodType;
  json.forEach((entry, index) => {
    const res = schema.safeParse(entry);
    if (!res.success) {
      for (const iss of res.error.issues) issues.push({ file, jsonPath: jsonPath([index, ...iss.path]), message: iss.message });
      return;
    }
    const value = res.data as { id: string };
    const previous = data.sources.get(value.id);
    if (previous) {
      issues.push({ file, jsonPath: jsonPath([index, "id"]), message: `identifiant « ${value.id} » déjà défini dans ${previous}` });
      return;
    }
    data.sources.set(value.id, file);
    (data[collection] as unknown[]).push(value);
  });
  return issues;
}

/** Vérifie que chaque référence pointe vers une entrée existante. */
export function checkReferences(data: GameData): DataIssue[] {
  const issues: DataIssue[] = [];
  const has = (id: string): boolean => data.sources.has(id);
  const ref = (owner: string, field: string, target: string | undefined): void => {
    if (target !== undefined && target !== "?" && !has(target)) {
      issues.push({ file: data.sources.get(owner) ?? "?", jsonPath: `${owner}.${field}`, message: `référence inconnue « ${target} »` });
    }
  };
  for (const p of data.provinces) ref(p.id, "destroyed_event", p.destroyed_event);
  for (const c of data.characters) ref(c.id, "death_event", c.death_event);
  for (const t of data.techs) {
    for (const ev of [t.unlock_event ?? []].flat()) ref(t.id, "unlock_event", ev);
    for (const p of t.prereqs) ref(t.id, "prereqs", p);
    ref(t.id, "requires_character", t.requires_character);
  }
  for (const e of data.events) ref(e.id, "location", e.location);
  for (const pl of data.placements) ref(pl.id, "location", pl.location);
  for (const c of data.characters) {
    ref(c.id, "org", c.org);
    for (const tr of c.traits) ref(c.id, "traits", tr);
    for (const r of c.relations) ref(c.id, "relations", r.to);
  }
  for (const tr of data.traits) for (const o of tr.opposes) ref(tr.id, "opposes", o);
  for (const tt of data.titan_types) ref(tt.id, "class", tt.class);
  for (const sh of data.shifters) {
    for (const c of sh.chain) if (c.holder) ref(sh.id, "chain", c.holder);
    if (sh.holder_850.character) ref(sh.id, "holder_850", sh.holder_850.character);
  }
  for (const wp of data.world_provinces) {
    if (wp.faction !== "mer") ref(wp.id, "faction", wp.faction);
    for (const a of wp.adjacent) ref(wp.id, "adjacent", a);
  }
  for (const f of data.factions) {
    ref(f.id, "leader", f.leader);
    for (const o of Object.keys(f.relations)) ref(f.id, "relations", o);
  }
  for (const fo of data.formations) ref(fo.id, "faction", fo.faction);
  for (const r of data.roles) ref(r.id, "proposal", r.proposal);
  // PA : artillerie, régiments, navires, mers, armées et flottes de départ.
  const req = (owner: string, r: { tech?: string | undefined; event?: string | undefined }): void => {
    ref(owner, "requires.tech", r.tech);
    ref(owner, "requires.event", r.event);
  };
  for (const a of data.artillery) {
    ref(a.id, "faction", a.type === "piece" ? a.faction : undefined);
    if (a.type === "piece") for (const m of a.ammo) ref(a.id, "ammo", m);
    else for (const f of a.factions) ref(a.id, "factions", f);
    req(a.id, a.requires);
  }
  for (const a of data.armies) {
    switch (a.type) {
      case "regiment":
        ref(a.id, "faction", a.faction);
        ref(a.id, "pieces", a.pieces?.piece);
        req(a.id, a.requires);
        break;
      case "ship":
        ref(a.id, "faction", a.faction);
        ref(a.id, "guns", a.guns?.piece);
        req(a.id, a.requires);
        break;
      case "sea":
        for (const s of a.adjacent) ref(a.id, "adjacent", s);
        for (const p of a.coasts) ref(a.id, "coasts", p);
        break;
      case "army":
        ref(a.id, "scenario", a.scenario);
        ref(a.id, "faction", a.faction);
        ref(a.id, "general", a.general ?? undefined);
        ref(a.id, "province", a.province ?? undefined);
        for (const r of a.regiments) ref(a.id, "regiments", r.regiment);
        break;
      case "fleet":
        ref(a.id, "scenario", a.scenario);
        ref(a.id, "faction", a.faction);
        ref(a.id, "admiral", a.admiral ?? undefined);
        ref(a.id, "sea", a.sea);
        for (const s of a.ships) ref(a.id, "ships", s.ship);
        for (const e of a.embarked) ref(a.id, "embarked", e);
        break;
    }
  }
  // MIS : prérequis, exclusions, événements déclenchés, scénarios, lois, conditions.
  for (const m of data.missions) {
    for (const x of [...m.prereqs, ...m.any_of, ...m.exclusive_with]) ref(m.id, "prereqs", x);
    for (const e of m.events) ref(m.id, "events", e);
    for (const s of m.scenarios) ref(m.id, "scenarios", s);
    for (const f of m.effects) {
      if ("province" in f && f.province !== "all" && !f.province.endsWith("_subject")) ref(m.id, "effects", f.province);
      if (f.op === "org_loyalty" || f.op === "org_influence") ref(m.id, "effects", f.org);
      if (f.op === "stratum") ref(m.id, "effects", f.stratum);
      if (f.op === "nation") ref(m.id, "effects", f.faction);
    }
    for (const c of m.requires) {
      if ("tech" in c) ref(m.id, "requires", c.tech);
      if ("law" in c) ref(m.id, "requires", c.law);
      if ("fired" in c) ref(m.id, "requires", c.fired);
      if ("not_fired" in c) ref(m.id, "requires", c.not_fired);
      if ("control" in c) ref(m.id, "requires", c.control);
      if ("garrison_at_least" in c) ref(m.id, "requires", c.garrison_at_least);
      if ("army_in" in c) ref(m.id, "requires", c.army_in);
      if ("at_war" in c) ref(m.id, "requires", c.at_war);
      if ("alive" in c) ref(m.id, "requires", c.alive);
      if ("dead" in c) ref(m.id, "requires", c.dead);
    }
  }
  const modifierRefs = (owner: string, target: string): void => {
    const m = /:(str_[a-z_]+|org_[a-z_]+)$/.exec(target);
    if (m) ref(owner, "effects", m[1]);
  };
  for (const law of data.laws) for (const m of [...law.effects, ...law.delayed.flatMap((d) => d.effects)]) modifierRefs(law.id, m.target);
  for (const sc of data.scenarios) {
    const pol = sc.politics;
    if (pol) {
      ref(sc.id, "politics.player", pol.player);
      for (const [role, who] of Object.entries(pol.roles)) {
        ref(sc.id, "politics.roles", role);
        if (who) ref(sc.id, "politics.roles", who);
      }
      for (const [org, who] of Object.entries(pol.org_leaders)) {
        ref(sc.id, "politics.org_leaders", org);
        ref(sc.id, "politics.org_leaders", who);
      }
      for (const org of Object.keys(pol.budget)) ref(sc.id, "politics.budget", org);
      for (const law of pol.laws) ref(sc.id, "politics.laws", law);
      for (const who of pol.cabinet_extra) ref(sc.id, "politics.cabinet_extra", who);
    }
    for (const id of [...Object.keys(sc.control), ...Object.keys(sc.control_canon), ...Object.keys(sc.garrisons), ...Object.keys(sc.buildings), ...Object.keys(sc.titan_density)]) ref(sc.id, "province", id);
    ref(sc.id, "expedition_base", sc.expedition_base);
    for (const d of sc.deceased) ref(sc.id, "deceased", d);
    for (const [sh, h] of Object.entries(sc.shifter_holders)) {
      ref(sc.id, "shifter_holders", sh);
      if (h.character) ref(sc.id, "shifter_holders", h.character);
    }
    if (sc.world) {
      for (const f of sc.world.playable) ref(sc.id, "world.playable", f);
      for (const [p, f] of Object.entries(sc.world.control)) {
        ref(sc.id, "world.control", p);
        ref(sc.id, "world.control", f);
      }
      for (const [p, list] of Object.entries(sc.world.formations)) {
        ref(sc.id, "world.formations", p);
        for (const x of list) ref(sc.id, "world.formations", x.formation);
      }
      for (const [a, b] of sc.world.wars) {
        ref(sc.id, "world.wars", a);
        ref(sc.id, "world.wars", b);
      }
    }
    for (const ids of Object.values(sc.buildings)) for (const b of ids) ref(sc.id, "buildings", b);
  }
  return issues;
}

export { COLLECTION_NAMES };
