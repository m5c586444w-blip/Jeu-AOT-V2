import type { RegistryBalance } from "../../data/balance";
import type { RegistryState } from "./types";

/**
 * Violations des invariants du registre (liste vide = sain) :
 * - un soldat est vivant, mort ou disparu, jamais deux ; un mort a exactement un dossier, un vivant ou disparu aucun ;
 * - conservation : vivants + morts + disparus = engagés, par faction ;
 * - chaque mort a une cause connue, un lieu et des circonstances ;
 * - liens et stèles ne franchissent pas les factions ; une gravure est réciproque (stèle ↔ dossier), sans doublon ni dépassement de capacité ;
 * - jamais plus de nommés vivants ou disparus que le plafond ; un généré n'a pas de nom, un nommé en a un unique dans sa faction.
 */
export function registryViolations(s: RegistryState, b: RegistryBalance): string[] {
  const out: string[] = [];
  const ids = Object.keys(s.soldiers).sort();
  const filesBySoldier = new Map<string, string[]>();
  for (const d of s.deaths) filesBySoldier.set(d.soldier, [...(filesBySoldier.get(d.soldier) ?? []), d.id]);
  const byFaction = new Map<string, { n: number; named: number }>();
  const names = new Set<string>();
  for (const id of ids) {
    const x = s.soldiers[id];
    if (!x) continue;
    const f = byFaction.get(x.faction) ?? { n: 0, named: 0 };
    f.n += 1;
    if (x.named && x.status !== "mort") f.named += 1;
    byFaction.set(x.faction, f);
    const files = filesBySoldier.get(id) ?? [];
    if (x.status === "mort") {
      if (files.length !== 1) out.push(`${id} : mort avec ${files.length} dossier(s)`);
      else if (x.death !== files[0]) out.push(`${id} : dossier non relié`);
    } else {
      if (files.length > 0) out.push(`${id} : ${x.status} mais mort (dossier ${files.join(",")})`);
      if (x.death !== null) out.push(`${id} : ${x.status} avec dossier de mort`);
    }
    if (x.status === "disparu" && (x.missingSince === null || !x.missingReason)) out.push(`${id} : disparu sans date ni raison`);
    if (x.status !== "disparu" && (x.missingSince !== null || x.missingReason !== null)) out.push(`${id} : trace de disparition hors statut disparu`);
    if (x.status !== "vivant" && x.refusingUntil !== null) out.push(`${id} : refus d'ordres hors statut vivant`);
    if (!x.named && x.name !== null) out.push(`${id} : généré mais nommé`);
    if (x.named) {
      if (!x.name) out.push(`${id} : nommé sans nom`);
      else {
        const key = `${x.faction}|${x.name}`;
        if (names.has(key)) out.push(`${id} : nom en double « ${x.name} »`);
        names.add(key);
      }
    }
    if (x.morale < 0 || x.morale > 100 || x.stress < 0 || x.stress > 100) out.push(`${id} : moral ou stress hors [0,100]`);
    if (!b.ranks.list.some((r) => r.id === x.rank)) out.push(`${id} : rang inconnu « ${x.rank} »`);
  }
  for (const [faction, f] of byFaction) {
    if ((s.enlisted[faction] ?? 0) !== f.n) out.push(`${faction} : ${f.n} soldats pour ${s.enlisted[faction] ?? 0} engagés`);
    if (f.named > b.troop.named_cap) out.push(`${faction} : ${f.named} nommés au-delà du plafond ${b.troop.named_cap}`);
  }
  for (const faction of Object.keys(s.enlisted)) if (!byFaction.has(faction) && (s.enlisted[faction] ?? 0) !== 0) out.push(`${faction} : engagés sans soldats`);
  const seen = new Set<string>();
  for (const d of s.deaths) {
    if (seen.has(d.id)) out.push(`${d.id} : dossier en double`);
    seen.add(d.id);
    const x = s.soldiers[d.soldier];
    if (!x) out.push(`${d.id} : soldat inconnu`);
    else if (x.faction !== d.faction) out.push(`${d.id} : faction incohérente`);
    if (!(d.cause in b.causes)) out.push(`${d.id} : cause inconnue « ${d.cause} »`);
    if (!d.place.trim() || !d.circumstances.trim()) out.push(`${d.id} : lieu ou circonstances vides`);
    if (d.inscribed !== null) {
      const st = s.steles.find((t) => t.id === d.inscribed);
      if (!st) out.push(`${d.id} : stèle inconnue`);
      else if (st.faction !== d.faction) out.push(`${d.id} : gravé sur la stèle d'une autre faction`);
      else if (!st.inscribed.includes(d.soldier)) out.push(`${d.id} : gravure absente de la stèle`);
    }
  }
  for (const st of s.steles) {
    if (st.inscribed.length > b.stele.capacity) out.push(`${st.id} : capacité dépassée`);
    if (new Set(st.inscribed).size !== st.inscribed.length) out.push(`${st.id} : nom gravé deux fois`);
    for (const id of st.inscribed) {
      const d = s.deaths.find((f) => f.soldier === id);
      if (!d) out.push(`${st.id} : ${id} gravé sans être mort`);
      else if (d.inscribed !== st.id) out.push(`${st.id} : ${id} gravé ailleurs`);
    }
  }
  const pairs = new Set<string>();
  for (const l of s.bonds) {
    const x = s.soldiers[l.a];
    const y = s.soldiers[l.b];
    if (!x || !y) out.push(`lien ${l.a}/${l.b} : soldat inconnu`);
    else if (x.faction !== y.faction) out.push(`lien ${l.a}/${l.b} : entre factions`);
    if (l.a === l.b) out.push(`lien ${l.a} : sur soi`);
    const k = [l.a, l.b].sort().join("|");
    if (pairs.has(k)) out.push(`lien ${k} : doublon`);
    pairs.add(k);
    if (!(l.kind in b.bonds.kinds)) out.push(`lien ${k} : type inconnu`);
  }
  return out;
}
