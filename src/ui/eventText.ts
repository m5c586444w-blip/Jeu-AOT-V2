import type { Effect } from "../data/effects";
import type { EventDef } from "../data/schemas";
import { t } from "../i18n";
import type { PendingEvent } from "../sim/events/engine";
import type { World } from "../sim/strategic/world";
import { displayName, provinceName } from "./panels/common";
import { formatNumber, formatSigned } from "./why";

/** Une ligne de coût ou de gain d'un choix d'événement (F-EVT-04 : coûts visibles avant de signer). */
export interface EffectLine {
  text: string;
  tone: "cout" | "gain" | "neutre";
}

const facName = (id: string): string => t(id.replace(/^fac_/, "fac."));
const tone = (v: number, goodIfPositive = true): EffectLine["tone"] => (v === 0 ? "neutre" : v > 0 === goodIfPositive ? "gain" : "cout");

function where(world: World, p: string, subject: PendingEvent["subject"]): string {
  if (p === "all") return t("eff.everywhere");
  if (p === "prov_subject") return subject.province ? provinceName(world, subject.province) : "—";
  return provinceName(world, p);
}

function who(world: World, c: string, subject: PendingEvent["subject"]): string {
  const id = c === "char_subject" ? (subject.character ?? "") : c;
  return displayName(world.politics?.characters.get(id));
}

/**
 * Lignes lisibles des effets. Les morts ne sont jamais nommées d'avance (aucun spoiler de chronique) : un choix
 * qui expose des officiers nommés l'annonce sans dire lesquels. Drapeaux et programmations internes sont omis.
 */
export function effectLines(world: World, effects: readonly Effect[], subject: PendingEvent["subject"] = {}): EffectLine[] {
  const out: EffectLine[] = [];
  let kills = 0;
  for (const f of effects) {
    switch (f.op) {
      case "resource":
        out.push({ text: t("eff.resource", { res: t(`res.${f.resource}`), delta: formatSigned(f.delta) }), tone: tone(f.delta) });
        break;
      case "legitimacy":
      case "capital":
        out.push({ text: t(`eff.${f.op}`, { delta: formatSigned(f.delta) }), tone: tone(f.delta) });
        break;
      case "morale":
      case "stability":
      case "cult":
        out.push({ text: t(`eff.${f.op}`, { where: where(world, f.province, subject), delta: formatSigned(f.delta) }), tone: f.op === "cult" ? "neutre" : tone(f.delta) });
        break;
      case "population":
      case "garrison":
        out.push({ text: t(`eff.${f.op}`, { where: where(world, f.province, subject), pct: formatSigned(Math.round(f.share * 1000) / 10) }), tone: tone(f.share) });
        break;
      case "control":
        out.push({ text: t("eff.control", { where: provinceName(world, f.province), value: t(`control.${f.value}`) }), tone: f.value === "paradis" ? "gain" : "cout" });
        break;
      case "wall":
        out.push({ text: t("eff.wall", { where: provinceName(world, f.province), value: formatNumber(f.value) }), tone: f.value >= 50 ? "gain" : "cout" });
        break;
      case "titans":
        out.push({ text: t(f.delta > 0 ? "eff.titans_up" : "eff.titans_down", { where: where(world, f.province, subject) }), tone: tone(f.delta, false) });
        break;
      case "org_loyalty":
      case "org_influence":
        out.push({ text: t(`eff.${f.op}`, { org: t(world.politics?.organisations.get(f.org)?.name_key ?? f.org), delta: formatSigned(f.delta) }), tone: f.op === "org_loyalty" ? tone(f.delta) : "neutre" });
        break;
      case "stratum": {
        const name = t(world.politics?.strata.find((x) => x.id === f.stratum)?.name_key ?? f.stratum);
        if (f.satisfaction !== 0) out.push({ text: t("eff.stratum_sat", { stratum: name, delta: formatSigned(f.satisfaction) }), tone: tone(f.satisfaction) });
        if (f.radicalisation !== 0) out.push({ text: t("eff.stratum_rad", { stratum: name, delta: formatSigned(f.radicalisation) }), tone: tone(f.radicalisation, false) });
        break;
      }
      case "kill":
        kills += 1;
        break;
      case "stress":
        out.push({ text: t("eff.stress", { name: who(world, f.character, subject), delta: formatSigned(f.delta) }), tone: tone(f.delta, false) });
        break;
      case "reveal":
        out.push({ text: t("eff.reveal"), tone: "neutre" });
        break;
      case "research":
        out.push({ text: t("eff.research", { delta: formatSigned(f.delta) }), tone: tone(f.delta) });
        break;
      case "captured":
        out.push({ text: t("eff.captured", { n: f.delta }), tone: "gain" });
        break;
      case "observe":
        out.push({ text: t("eff.observe", { where: where(world, f.province, subject) }), tone: "neutre" });
        break;
      case "world_relation":
        out.push({ text: t("eff.world_relation", { from: facName(f.from), to: facName(f.to), axis: t(`dip.axis.${f.axis}`), delta: formatSigned(f.delta) }), tone: f.axis === "fear" ? "neutre" : tone(f.delta) });
        break;
      case "world_support":
        out.push({ text: t("eff.world_support", { faction: facName(f.faction), delta: formatSigned(f.delta) }), tone: "neutre" });
        break;
      case "world_hizuru":
        out.push({ text: t(f.delta >= 0 ? "eff.world_hizuru_paradis" : "eff.world_hizuru_marley", { delta: formatSigned(f.delta) }), tone: "neutre" });
        break;
      case "nation":
        out.push({ text: t(`eff.nation_${f.stat}`, { faction: facName(f.faction), delta: formatSigned(f.delta) }), tone: tone(f.delta) });
        break;
      case "flag":
      case "schedule":
      case "divergence":
        break;
    }
  }
  if (kills > 0) out.push({ text: t("eff.officers_exposed"), tone: "cout" });
  return out;
}

/** Corps du dossier, avec le sujet d'un événement générique (personnage, province). */
export function eventBody(world: World, e: EventDef, subject: PendingEvent["subject"]): string {
  return t(`${e.text_key}.body`, { name: subject.character ? displayName(world.politics?.characters.get(subject.character)) : "", province: subject.province ? provinceName(world, subject.province) : "" });
}
