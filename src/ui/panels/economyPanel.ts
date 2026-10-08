import { t } from "../../i18n";
import { planDay, planMonth, totals } from "../../sim/strategic/economy";
import type { DayPlan, StrategicState } from "../../sim/strategic/economy";
import { RATIONING_LEVELS } from "../../sim/strategic/resources";
import type { RationingLevel, ResourceId } from "../../sim/strategic/resources";
import { resourceDeltaWhy, nationalMorale } from "../hud";
import { icon, resourceIcon } from "../icons";
import { gauge, h, listItem, sep, variation } from "../kit";
import { explainedTable, formatNumber, formatSigned } from "../why";
import { el, noPolitics, provinceName, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";

/** Ressources de Paradis suivies par l'écran (le charbon est une dépendance de Marley, 02 §3.1). */
export const ECONOMY_RESOURCES: readonly ResourceId[] = ["food", "gas", "steel", "iceburst", "powder", "horses", "manpower", "gold"];
type Selection = ResourceId | "population";

/**
 * Écran « Économie » (phase UI, U2 et U5) : liste des ressources et de la population à gauche, détail à droite (réserve,
 * capacité, variation du jour décomposée en production, consommation et pertes) ; niveau de rationnement en tête.
 */
export class EconomyPanel implements Panel {
  readonly id = "economie" as const;
  private selected: Selection = "food";

  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement, arg?: string): void {
    const state = this.ctx.state();
    const st = state.strategic;
    if (!st) return noPolitics(root);
    if (arg && (ECONOMY_RESOURCES as readonly string[]).concat("population").includes(arg)) this.selected = arg as Selection;
    const plan = planDay(this.ctx.world, st, state.date);
    root.append(this.rationing(st));
    const md = h("div", "maitre-detail eco-vue");
    const master = h("div", "maitre");
    const list = h("ul", "liste");
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", t("eco.resources"));
    list.append(h("li", "liste__groupe", t("eco.resources")));
    for (const r of ECONOMY_RESOURCES) {
      const day = plan.resources[r];
      const diff = day.next - st.stocks[r];
      const trail = h("span", "eco-queue");
      trail.append(valueEl(this.ctx, formatNumber(st.stocks[r]), () => ({ title: t("hud.stock_title", { resource: t(`res.${r}`) }), sections: [{ label: t("hud.capacity"), explained: day.capacity }] }), "eco-stock"));
      const v = variation(formatSigned(diff), day.shortfall > 0 ? "rupture" : diff < 0 ? "baisse" : diff > 0 ? "hausse" : "stable");
      this.ctx.why.bind(v, () => resourceDeltaWhy(this.ctx.world, plan, st, r));
      trail.append(v);
      const item = listItem({ title: t(`res.${r}`), lead: resourceIcon(r), trail, selected: this.selected === r, onSelect: () => this.select(r) });
      item.dataset["resource"] = r;
      list.append(item);
    }
    list.append(h("li", "liste__groupe", t("eco.nation")));
    const pop = totals(st).population;
    const popItem = listItem({ title: t("hud.population"), lead: icon("hommes"), trail: valueEl(this.ctx, formatNumber(pop), () => ({ title: t("hud.population"), sections: [{ text: t("hud.population_why") }] })), selected: this.selected === "population", onSelect: () => this.select("population") });
    popItem.dataset["resource"] = "population";
    list.append(popItem);
    master.append(list);
    const detail = h("div", "detail");
    if (this.selected === "population") this.population(detail, st);
    else this.resource(detail, st, plan, this.selected);
    md.append(master, detail);
    root.append(md);
  }

  private select(s: Selection): void {
    this.selected = s;
    this.ctx.open("economie", s);
  }

  /** Rationnement : un niveau à la fois ; l'effet de chaque niveau est écrit sur son bouton. */
  private rationing(st: StrategicState): HTMLElement {
    const box = h("section", "eco-rationnement");
    const head = h("div", "eco-rationnement__tete");
    head.insertAdjacentHTML("afterbegin", icon("rationnement"));
    head.append(h("h3", "titre-section", t("hud.rationing")));
    box.append(head);
    const row = h("div", "eco-rationnement__niveaux");
    row.setAttribute("role", "radiogroup");
    row.setAttribute("aria-label", t("hud.rationing"));
    for (const level of RATIONING_LEVELS) {
      const e = this.ctx.world.economy.rationing[level];
      const b = h("button", "eco-niveau");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(st.rationing === level));
      b.dataset["level"] = level;
      b.append(h("strong", "eco-niveau__nom", t(`rationing.${level}`)), h("span", "eco-niveau__effet", t("eco.rationing_effect", { cons: formatSigned((e?.consumption ?? 0) * 100), morale: formatSigned(e?.morale ?? 0), prod: formatSigned((e?.productivity ?? 0) * 100) })));
      if (st.rationing !== level) b.addEventListener("click", () => void this.ctx.dispatch({ type: "SetRationing", level: level as RationingLevel }));
      row.append(b);
    }
    box.append(row);
    return box;
  }

  private resource(root: HTMLElement, st: StrategicState, plan: DayPlan, r: ResourceId): void {
    const day = plan.resources[r];
    const head = h("div", "eco-detail__tete");
    head.insertAdjacentHTML("afterbegin", resourceIcon(r).replace('class="ico icone"', 'class="ico ico--l"'));
    head.append(h("h3", "eco-detail__titre", t(`res.${r}`)));
    root.append(head);
    const cap = Math.max(1, day.capacity.value);
    const stock = valueEl(this.ctx, `${formatNumber(st.stocks[r])} / ${formatNumber(day.capacity.value)}`, () => ({ title: t("hud.stock_title", { resource: t(`res.${r}`) }), sections: [{ text: t("hud.stock_text", { stock: formatNumber(st.stocks[r]), cap: formatNumber(day.capacity.value) }) }, { label: t("hud.capacity"), explained: day.capacity }] }));
    root.append(gauge(t("eco.stock"), stock, st.stocks[r] / cap, { tone: day.shortfall > 0 ? "danger" : "accent" }));
    const net = valueEl(this.ctx, formatSigned(day.net.value), () => resourceDeltaWhy(this.ctx.world, plan, st, r), "eco-net");
    net.dataset["sign"] = day.shortfall > 0 ? "rupture" : day.net.value < 0 ? "baisse" : day.net.value > 0 ? "hausse" : "stable";
    const line = h("div", "kv");
    line.append(h("span", "kv__cle", t("hud.net")), net);
    root.append(line);
    if (day.shortfall > 0) root.append(h("p", "plan-probleme", t("hud.shortfall", { n: formatNumber(day.shortfall) })));
    if (day.overflow > 0) root.append(h("p", "registre-note", t("hud.overflow", { n: formatNumber(day.overflow) })));
    const parts: [string, typeof day.production, boolean][] = [
      [t("hud.production"), day.production, false],
      [t("hud.consumption"), day.consumption, true],
      [t("hud.losses"), day.losses, true],
    ];
    for (const [label, x, cost] of parts) {
      root.append(sep(label));
      root.append(explainedTable(x, { cost }));
    }
    if (r === "gold" || r === "manpower") {
      const m = planMonth(this.ctx.world, st);
      const monthly: [string, typeof m.taxes, boolean][] = r === "gold" ? [[t("hud.month_taxes"), m.taxes, false], [t("hud.month_upkeep"), m.upkeep, true]] : [[t("hud.month_manpower"), m.manpower, false]];
      for (const [label, x, cost] of monthly) {
        root.append(sep(label));
        root.append(explainedTable(x, { cost }));
      }
    }
  }

  private population(root: HTMLElement, st: StrategicState): void {
    const head = h("div", "eco-detail__tete");
    head.insertAdjacentHTML("afterbegin", icon("hommes", "ico ico--l"));
    head.append(h("h3", "eco-detail__titre", t("hud.population")));
    root.append(head);
    root.append(el("p", "registre-note", t("hud.population_why")));
    const morale = nationalMorale(st);
    root.append(gauge(t("hud.morale"), valueEl(this.ctx, formatNumber(morale), () => ({ title: t("hud.morale"), sections: [{ text: t("hud.morale_why") }] })), morale / 100, { tone: morale < 35 ? "danger" : "accent" }));
    root.append(sep(t("eco.provinces")));
    const table = h("table", "tableau eco-provinces");
    const hr = h("tr");
    for (const c of [t("eco.province"), t("hud.population"), t("hud.morale")]) hr.append(h("th", "", c));
    table.append(hr);
    const rows = Object.entries(st.provinces)
      .filter(([, p]) => p.control === "paradis" && p.population > 0)
      .sort((a, b) => b[1].population - a[1].population);
    for (const [id, p] of rows) {
      const tr = h("tr");
      const name = h("td");
      name.append(h("span", "", provinceName(this.ctx.world, id)));
      const popCell = h("td");
      popCell.append(valueEl(this.ctx, formatNumber(p.population), () => ({ title: provinceName(this.ctx.world, id), sections: [{ text: t("hud.population_why") }] })));
      const morCell = h("td");
      morCell.append(valueEl(this.ctx, formatNumber(p.morale), () => ({ title: t("hud.morale"), sections: [{ text: t("hud.morale_why") }] })));
      tr.append(name, popCell, morCell);
      table.append(tr);
    }
    root.append(table);
  }
}
