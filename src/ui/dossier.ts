import type { MapData } from "../data/map";
import type { Province } from "../data/schemas";
import { t } from "../i18n";
import { Explainer } from "../sim/core/explain";
import type { GameState } from "../sim/core/state";
import { capacity, planDay, provinceProduction } from "../sim/strategic/economy";
import { provinceComposition } from "../sim/politics/society";
import type { StrategicState } from "../sim/strategic/economy";
import { RESOURCE_IDS } from "../sim/strategic/resources";
import type { World } from "../sim/strategic/world";
import { resourceIcon } from "./icons";
import { formatNumber } from "./why";
import type { WhyContent, WhyTooltip } from "./why";

/** Dimensions des murs (data/map, avec leur statut de fiabilité). */
export type WallSpec = MapData["walls"];

type Tab = "population" | "economie" | "garnison" | "batiments" | "renseignement" | "mur";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * Dossier de province (04 §5.4) : feuille cadastrale à onglets. Chaque chiffre est relié à sa fiche « pourquoi ? »,
 * calculée avec les mêmes fonctions que le tick ; le statut de fiabilité est rendu comme un tampon.
 */
export class Dossier {
  readonly el = el("aside", "dossier");
  private province: Province | null = null;
  private tab: Tab = "population";
  private state: GameState | null = null;

  constructor(
    parent: HTMLElement,
    private readonly world: World,
    private readonly walls: WallSpec,
    private readonly why: WhyTooltip,
    private readonly onClose: () => void,
  ) {
    this.el.hidden = true;
    this.el.setAttribute("aria-live", "polite");
    parent.append(this.el);
  }

  get openId(): string | null {
    return this.el.hidden ? null : (this.province?.id ?? null);
  }

  open(id: string, state: GameState): void {
    const p = this.world.provinceById.get(id);
    if (!p) return;
    if (this.province?.id !== id) this.tab = p.kind === "segment" ? "mur" : "population";
    this.province = p;
    this.state = state;
    this.el.hidden = false;
    this.render();
  }

  close(): void {
    this.el.hidden = true;
    this.province = null;
  }

  refresh(state: GameState): void {
    this.state = state;
    if (!this.el.hidden) this.render();
  }

  private render(): void {
    const p = this.province;
    const st = this.state?.strategic;
    if (!p || !st || !this.state) return;
    this.el.replaceChildren();
    this.el.setAttribute("aria-label", t("dossier.label", { name: t(p.name_key) }));

    const head = el("header", "dossier__tete");
    const code = el("span", "dossier__cote", p.atlas_code ?? "");
    const title = el("h2", "dossier__titre", t(p.name_key));
    const stamp = el("span", `dossier__tampon dossier__tampon--${p.canon === "?" ? "incertain" : p.canon}`, t(`canon.stamp.${p.canon}`));
    stamp.dataset["why"] = t("dossier.canon_why", { status: t(`canon.${p.canon}`) });
    const close = el("button", "dossier__fermer", "×");
    close.type = "button";
    close.setAttribute("aria-label", t("dossier.close"));
    close.addEventListener("click", () => this.onClose());
    head.append(code, title, stamp, close);
    const sub = el("p", "dossier__sous-titre", [t(`region.${p.region}`), t(`terrain.${p.terrain}`), t(`control.${st.provinces[p.id]?.control ?? "titans"}`)].join(" · "));
    // Statuts distincts de l'existence : position sur la carte et rattachement propre au scénario (D-41, D-49).
    const statuses = el("p", "dossier__statuts");
    if (p.location_canon) {
      const loc = el("span", `tampon-mini tampon-mini--${p.location_canon === "?" ? "incertain" : p.location_canon}`, t("dossier.location_status", { status: t(`canon.stamp.${p.location_canon}`) }));
      loc.dataset["why"] = t("dossier.location_why", { status: t(`canon.${p.location_canon}`) });
      statuses.append(loc);
    }
    const controlCanon = this.world.scenario.control_canon[p.id];
    if (controlCanon) {
      const ctl = el("span", `tampon-mini tampon-mini--${controlCanon === "?" ? "incertain" : controlCanon}`, t("dossier.control_status", { status: t(`canon.stamp.${controlCanon}`) }));
      ctl.dataset["why"] = t("dossier.control_why", { status: t(`canon.${controlCanon}`) });
      statuses.append(" ", ctl);
    }
    const desc = el("p", "dossier__description", p.desc_key ? t(p.desc_key) : "");

    const tabs = el("nav", "dossier__onglets");
    tabs.setAttribute("role", "tablist");
    const list: Tab[] = p.kind === "segment" ? ["mur", "garnison", "renseignement"] : ["population", "economie", "garnison", "batiments", "renseignement"];
    for (const id of list) {
      const b = el("button", "dossier__onglet", t(`dossier.tab.${id}`));
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(id === this.tab));
      b.addEventListener("click", () => {
        this.tab = id;
        this.render();
      });
      tabs.append(b);
    }
    if (!list.includes(this.tab)) this.tab = list[0] ?? "population";
    const body = el("section", "dossier__corps");
    body.setAttribute("role", "tabpanel");
    switch (this.tab) {
      case "population":
        this.population(body, p, st);
        break;
      case "economie":
        this.economy(body, p, st);
        break;
      case "garnison":
        this.garrison(body, p, st);
        break;
      case "batiments":
        this.buildings(body, p, st);
        break;
      case "mur":
        this.wall(body, p, st);
        break;
      case "renseignement":
        body.append(el("p", "dossier__ferme", t("dossier.intel_closed")));
        break;
    }
    const foot = el("footer", "dossier__archives");
    if (p.notes_canon) foot.append(el("p", "", p.notes_canon));
    for (const poi of p.poi ?? []) {
      const line = el("p", "dossier__poi", `${t(poi.name_key)} `);
      line.append(el("span", "dossier__mini-tampon", t(`canon.${poi.canon}`)));
      foot.append(line);
    }
    this.el.append(head, sub, ...(statuses.childElementCount > 0 ? [statuses] : []), desc, tabs, body, foot);
  }

  /** Ligne « libellé : valeur » dont la valeur porte sa fiche « pourquoi ? ». */
  private row(parent: HTMLElement, label: string, value: string, why: () => WhyContent, icon?: string): void {
    const r = el("div", "dossier__ligne");
    const l = el("span", "dossier__libelle");
    if (icon) l.innerHTML = icon;
    l.append(label);
    const v = el("span", "valeur dossier__valeur", value);
    this.why.bind(v, why);
    r.append(l, v);
    parent.append(r);
  }

  private population(body: HTMLElement, p: Province, st: StrategicState): void {
    const ps = st.provinces[p.id];
    if (!ps || !this.state) return;
    const plan = planDay(this.world, st, this.state.date);
    const weights = this.world.economy.population.level_weights;
    this.row(body, t("dossier.population"), formatNumber(ps.population), () => ({
      title: t("dossier.population"),
      sections: [{ text: t("dossier.population_why", { level: p.pop_level, weight: weights[p.pop_level] ?? 0, total: formatNumber(this.world.economy.population.total_start) }) }],
    }));
    const mt = plan.moraleTarget[p.id];
    this.row(body, t("hud.morale"), formatNumber(ps.morale), () => ({
      title: t("hud.morale"),
      sections: [{ text: t("dossier.approach_why", { rate: formatNumber(this.world.economy.morale.approach_per_day * 100) }) }, ...(mt ? [{ label: t("dossier.target"), explained: mt }] : [])],
    }));
    const stt = plan.stabilityTarget[p.id];
    this.row(body, t("dossier.stability"), formatNumber(ps.stability), () => ({
      title: t("dossier.stability"),
      sections: [{ text: t("dossier.approach_why", { rate: formatNumber(this.world.economy.stability.approach_per_day * 100) }) }, ...(stt ? [{ label: t("dossier.target"), explained: stt }] : [])],
    }));
    // Strates sociales (F-POP-01) : effectif local et satisfaction nationale de chaque strate.
    const pw = this.world.politics;
    const pol = this.state?.politics;
    if (pw && pol && ps.population > 0) {
      body.append(el("h4", "dossier__intertitre", t("dossier.strata")));
      const comp = provinceComposition(this.world, pw, p);
      for (const s of pw.strata) {
        const share = comp[s.id] ?? 0;
        if (share <= 0) continue;
        const sat = pol.strata[s.id]?.satisfaction ?? 50;
        this.row(body, t(s.name_key), `${formatNumber(ps.population * share)} · ${formatNumber(sat)}`, () => ({
          title: t(s.name_key),
          sections: [{ text: t("dossier.strata_why", { share: formatNumber(share * 100), sat: formatNumber(sat) }) }],
        }));
      }
    }
  }

  private economy(body: HTMLElement, p: Province, st: StrategicState): void {
    if (!this.state) return;
    const date = this.state.date;
    this.row(body, t("dossier.key_resource"), t(`key.${p.key_resource}`), () => ({ title: t("dossier.key_resource"), sections: [{ text: t("dossier.key_resource_why") }] }));
    let any = false;
    for (const r of RESOURCE_IDS) {
      const x = provinceProduction(this.world, st, date, p.id, r);
      if (x.factors.length === 0) continue;
      any = true;
      this.row(body, t("dossier.production_of", { resource: t(`res.${r}`) }), `${formatNumber(x.value)} ${t("dossier.per_day")}`, () => ({ title: t("dossier.production_of", { resource: t(`res.${r}`) }), sections: [{ explained: x }] }), resourceIcon(r));
    }
    if (!any) body.append(el("p", "dossier__note", t("dossier.no_production")));
    const single = { ...st, provinces: { [p.id]: st.provinces[p.id] as StrategicState["provinces"][string] } };
    const onlyThis = { ...this.world, provinces: this.world.provinces.filter((x) => x.id === p.id) };
    for (const r of ["food", "gas"] as const) {
      const cap = capacity(onlyThis, single, r);
      if (cap.value > 0) this.row(body, t("dossier.storage_of", { resource: t(`res.${r}`) }), formatNumber(cap.value), () => ({ title: t("dossier.storage_of", { resource: t(`res.${r}`) }), sections: [{ explained: cap }] }), resourceIcon(r));
    }
  }

  private garrison(body: HTMLElement, p: Province, st: StrategicState): void {
    const g = st.provinces[p.id]?.garrison;
    if (!g) {
      body.append(el("p", "dossier__note", t("dossier.no_garrison")));
      return;
    }
    const c = this.world.economy.consumption;
    this.row(body, t(`org.${g.org}`), formatNumber(g.soldiers), () => ({ title: t("dossier.tab.garnison"), sections: [{ text: t("dossier.garrison_why") }] }));
    const food = new Explainer().base("why.food_soldiers", g.soldiers * c.food_per_soldier, { soldiers: g.soldiers }).done();
    const gas = new Explainer().base("why.gas_soldiers", g.soldiers * c.gas_per_soldier, { soldiers: g.soldiers }).done();
    this.row(body, t("dossier.garrison_food"), `${formatNumber(food.value)} ${t("dossier.per_day")}`, () => ({ title: t("dossier.garrison_food"), sections: [{ explained: food }] }), resourceIcon("food"));
    this.row(body, t("dossier.garrison_gas"), `${formatNumber(gas.value)} ${t("dossier.per_day")}`, () => ({ title: t("dossier.garrison_gas"), sections: [{ explained: gas }] }), resourceIcon("gas"));
  }

  private buildings(body: HTMLElement, p: Province, st: StrategicState): void {
    const ids = st.provinces[p.id]?.buildings ?? [];
    if (ids.length === 0) {
      body.append(el("p", "dossier__note", t("dossier.no_buildings")));
      return;
    }
    for (const id of ids) {
      const b = this.world.buildings.get(id);
      if (!b) continue;
      const effects: string[] = [];
      for (const [r, v] of Object.entries(b.production_bonus)) effects.push(t("dossier.effect_bonus", { resource: t(`res.${r}`), n: formatNumber((v ?? 0) * 100) }));
      for (const [r, v] of Object.entries(b.storage)) effects.push(t("dossier.effect_storage", { resource: t(`res.${r}`), n: formatNumber(v ?? 0) }));
      if (b.conversion) effects.push(t("dossier.effect_conversion", { from: t(`res.${b.conversion.from}`), to: t(`res.${b.conversion.to}`), n: formatNumber(b.conversion.per_day) }));
      this.row(body, t(b.name_key), t("dossier.upkeep", { n: formatNumber(b.upkeep_gold_month) }), () => ({ title: t(b.name_key), sections: [{ text: effects.join(" · ") }, { text: t("dossier.catalog_why", { status: t(`canon.${b.canon}`) }) }] }));
    }
  }

  private wall(body: HTMLElement, p: Province, st: StrategicState): void {
    const structure = st.provinces[p.id]?.wall_structure ?? 100;
    this.row(body, t("dossier.structure"), `${formatNumber(structure)} / 100`, () => ({ title: t("dossier.structure"), sections: [{ text: t("dossier.structure_why") }] }));
    const spec = this.walls;
    this.row(body, t("dossier.height"), `${spec.height_m.value} m`, () => ({ title: t("dossier.height"), sections: [{ text: `${spec.height_m.note} [${spec.height_m.canon}]` }] }));
    this.row(body, t("dossier.thickness"), `${spec.thickness_m.value} m`, () => ({ title: t("dossier.thickness"), sections: [{ text: `${spec.thickness_m.note} [${spec.thickness_m.canon}]` }] }));
    body.append(wallSection(structure, spec));
  }
}

/** Coupe du mur (élévation stylisée) dessinée en SVG : hauteur et épaisseur à l'échelle relative. */
function wallSection(structure: number, spec: WallSpec): HTMLElement {
  const fig = el("figure", "dossier__coupe");
  const crack = structure < 100 ? `<path d="M64 30 L70 52 L62 74 L71 96" fill="none" stroke="#8a3b2a" stroke-width="2"/>` : "";
  fig.innerHTML =
    `<svg viewBox="0 0 220 130" role="img" aria-label="${t("dossier.section_alt")}">` +
    `<path d="M10 118 L210 118" stroke="#1c1a17" stroke-width="1.4"/>` +
    `<path d="M10 121 L210 121" stroke="#1c1a17" stroke-width="0.6" stroke-dasharray="3 3"/>` +
    `<path d="M52 118 L56 16 L84 16 L88 118 Z" fill="#8a8577" stroke="#1c1a17" stroke-width="1.6"/>` +
    Array.from({ length: 9 }, (_, i) => `<path d="M${55 + i * 0.4} ${28 + i * 10} L${85 - i * 0.4} ${28 + i * 10}" stroke="#1c1a17" stroke-width="0.6" opacity="0.6"/>`).join("") +
    `<path d="M54 16 L54 9 L60 9 L60 13 L66 13 L66 9 L74 9 L74 13 L80 13 L80 9 L86 9 L86 16" fill="none" stroke="#1c1a17" stroke-width="1.2"/>` +
    crack +
    `<path d="M100 16 L100 118" stroke="#1c1a17" stroke-width="0.8"/><path d="M96 16 L104 16 M96 118 L104 118" stroke="#1c1a17" stroke-width="0.8"/>` +
    `<text x="108" y="70" font-family="Special Elite" font-size="11" fill="#1c1a17">≈ ${spec.height_m.value} m${spec.height_m.canon === "?" ? " ?" : ""}</text>` +
    `<path d="M52 126 L88 126" stroke="#1c1a17" stroke-width="0.8"/>` +
    `<text x="40" y="129" font-family="Special Elite" font-size="9" fill="#1c1a17">≈ ${spec.thickness_m.value} m${spec.thickness_m.canon === "?" ? " ?" : ""}</text>` +
    `</svg>`;
  fig.append(el("figcaption", "", t("dossier.section_caption")));
  return fig;
}
