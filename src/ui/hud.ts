import { hasKey, t } from "../i18n";
import { stateHash } from "../sim/core/canonical";
import type { GameState } from "../sim/core/state";
import { monthOf, seasonOf } from "../sim/core/time";
import { planDay, planMonth, totals } from "../sim/strategic/economy";
import type { DayPlan, StrategicState } from "../sim/strategic/economy";
import { RATIONING_LEVELS } from "../sim/strategic/resources";
import type { RationingLevel, ResourceId } from "../sim/strategic/resources";
import type { World } from "../sim/strategic/world";
import { resourceIcon } from "./icons";
import { paramLabel } from "./panels/common";
import { formatNumber, formatSigned } from "./why";
import type { WhyContent, WhyTooltip } from "./why";

/** Ressources affichées pour Paradis (le charbon est une dépendance de Marley, 02 §3.1). */
export const HUD_RESOURCES: readonly ResourceId[] = ["food", "gas", "steel", "iceburst", "powder", "horses", "manpower", "gold"];

export interface HudActions {
  setSpeed(speed: number): void;
  setRationing(level: RationingLevel): void;
  /** Ouvre un registre (P2) ; absent si le scénario n'a pas de couche politique. */
  openPanel?(id: string): void;
}

const PANELS = ["personnages", "cabinet", "decrets", "organisations", "conseil", "journal", "expeditions", "chronique", "renseignement", "recherche", "porteurs", "monde", "diplomatie"] as const;
/** Registres propres aux institutions de Paradis : masqués quand le joueur mène une autre nation (P7). */
const PARADIS_ONLY = new Set(["personnages", "cabinet", "decrets", "organisations", "conseil", "expeditions", "renseignement", "recherche"]);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Bandeau-registre (F-UIX-01) : chaque nombre porte sa fiche « pourquoi ? ». */
export class Hud {
  readonly el = el("header", "bandeau");
  private state: GameState;
  private plan: DayPlan | null = null;
  private readonly values = new Map<string, HTMLElement>();
  private readonly speedButtons: HTMLButtonElement[] = [];
  private readonly rationing = el("select", "bandeau__decret");
  private readonly alert = el("p", "bandeau__alerte");

  constructor(private readonly world: World, initial: GameState, private readonly why: WhyTooltip, private readonly actions: HudActions) {
    this.state = initial;
    const head = el("div", "bandeau__tete");
    head.append(el("h1", "bandeau__titre", t("app.title")));
    head.append(this.dateBlock(), this.speedBlock());
    const ledger = el("div", "bandeau__registre");
    for (const r of HUD_RESOURCES) ledger.append(this.resourceCell(r));
    const nation = el("div", "bandeau__nation");
    nation.append(this.valueCell("population", t("hud.population"), () => this.populationWhy()));
    nation.append(this.valueCell("morale", t("hud.morale"), () => this.moraleWhy()));
    nation.append(this.rationingBlock());
    if (world.politics) {
      nation.append(this.valueCell("legitimacy", t("hud.legitimacy"), () => ({ title: t("hud.legitimacy"), sections: [{ text: t("hud.legitimacy_why") }] })));
      nation.append(this.valueCell("capital", t("hud.capital"), () => ({ title: t("hud.capital"), sections: [{ text: t("hud.capital_why") }] })));
    }
    const foot = el("div", "bandeau__pied");
    this.alert.setAttribute("aria-live", "polite");
    foot.append(this.alert, this.valueCell("seed", t("app.seed"), () => ({ title: t("app.seed"), sections: [{ text: t("hud.seed_why") }] })), this.valueCell("hash", t("app.hash"), () => ({ title: t("app.hash"), sections: [{ text: t("hud.hash_why") }] })));
    if (world.politics && actions.openPanel) {
      const nav = el("nav", "bandeau__registres");
      nav.setAttribute("aria-label", t("hud.registers"));
      const present = { expeditions: !!world.military, chronique: !!world.chronicle, renseignement: !!world.intel, recherche: !!world.research, porteurs: !!world.shifters, monde: !!world.nations, diplomatie: !!world.nations } as Record<string, boolean>;
      for (const id of PANELS.filter((p) => present[p] ?? true)) {
        const b = el("button", "bandeau__registre-bouton", t(`panel.${id}`));
        b.type = "button";
        b.dataset["panel"] = id;
        if (PARADIS_ONLY.has(id)) b.dataset["paradis"] = "1";
        b.addEventListener("click", () => actions.openPanel?.(id));
        nav.append(b);
      }
      head.append(nav);
    }
    this.el.append(head, ledger, nation, foot);
  }

  private dateBlock(): HTMLElement {
    const box = el("div", "bandeau__date");
    const v = el("span", "valeur bandeau__jour");
    this.values.set("date", v);
    this.why.bind(v, () => ({ title: t("hud.calendar"), sections: [{ text: t("hud.calendar_why") }] }));
    box.append(v);
    return box;
  }

  private speedBlock(): HTMLElement {
    const box = el("div", "bandeau__vitesses");
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", t("hud.speed"));
    for (let s = 0; s <= 5; s++) {
      const b = el("button", "bandeau__vitesse", s === 0 ? "‖" : "·".repeat(s));
      b.type = "button";
      b.title = s === 0 ? t("hud.pause") : t("hud.speed_n", { n: s });
      b.setAttribute("aria-label", b.title);
      b.addEventListener("click", () => this.actions.setSpeed(s));
      this.speedButtons.push(b);
      box.append(b);
    }
    return box;
  }

  private resourceCell(r: ResourceId): HTMLElement {
    const cell = el("div", "bandeau__ressource");
    cell.dataset["resource"] = r;
    const icon = el("span", "bandeau__icone");
    icon.innerHTML = resourceIcon(r);
    const name = el("span", "bandeau__libelle", t(`res.short.${r}`));
    const stock = el("span", "valeur bandeau__stock");
    const delta = el("span", "valeur bandeau__delta");
    this.values.set(`stock:${r}`, stock);
    this.values.set(`delta:${r}`, delta);
    this.why.bind(stock, () => this.stockWhy(r));
    this.why.bind(delta, () => this.deltaWhy(r));
    cell.append(icon, name, stock, delta);
    return cell;
  }

  private valueCell(key: string, label: string, provider: () => WhyContent): HTMLElement {
    const f = el("span", "bandeau__champ");
    f.append(el("span", "bandeau__libelle", label));
    const v = el("span", "valeur bandeau__valeur");
    v.dataset["field"] = key;
    this.values.set(key, v);
    this.why.bind(v, provider);
    f.append(v);
    return f;
  }

  private rationingBlock(): HTMLElement {
    const label = el("label", "bandeau__champ");
    label.append(el("span", "bandeau__libelle", t("hud.rationing")));
    for (const level of RATIONING_LEVELS) {
      const o = el("option", "", t(`rationing.${level}`));
      o.value = level;
      this.rationing.append(o);
    }
    this.rationing.addEventListener("change", () => this.actions.setRationing(this.rationing.value as RationingLevel));
    this.why.bind(this.rationing, () => ({
      title: t("hud.rationing"),
      sections: RATIONING_LEVELS.map((l) => {
        const e = this.world.economy.rationing[l];
        return { text: t("hud.rationing_effect", { level: t(`rationing.${l}`), cons: formatSigned((e?.consumption ?? 0) * 100), morale: formatSigned(e?.morale ?? 0), prod: formatSigned((e?.productivity ?? 0) * 100) }) };
      }),
    }));
    label.append(this.rationing);
    return label;
  }

  private strat(): StrategicState | null {
    return this.state.strategic;
  }

  update(state: GameState, speed: number): void {
    this.state = state;
    // Nation jouée (P7) : les comptes et registres propres à Paradis s'effacent quand on mène Marley.
    this.el.dataset["joueur"] = state.nations?.player ?? "fac_paradis";
    const st = this.strat();
    this.plan = st ? planDay(this.world, st, state.date) : null;
    const d = state.date;
    this.set("date", `${t("date.format", { year: d.year, day: d.day })} — ${t(`season.${seasonOf(d)}`)}, ${t("hud.month", { n: monthOf(d) })}`);
    this.set("seed", String(state.seed));
    this.set("hash", stateHash(state));
    this.speedButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(i === speed)));
    if (!st || !this.plan) return;
    for (const r of HUD_RESOURCES) {
      const day = this.plan.resources[r];
      this.set(`stock:${r}`, formatNumber(st.stocks[r]));
      const delta = this.values.get(`delta:${r}`);
      if (delta) {
        delta.textContent = formatSigned(day.next - st.stocks[r]);
        delta.dataset["sign"] = day.shortfall > 0 ? "rupture" : day.next < st.stocks[r] ? "baisse" : "hausse";
      }
    }
    const { population } = totals(st);
    this.set("population", formatNumber(population));
    this.set("morale", formatNumber(nationalMorale(st)));
    this.rationing.value = st.rationing;
    if (state.politics) {
      this.set("legitimacy", formatNumber(state.politics.legitimacy));
      this.set("capital", formatNumber(state.politics.capital));
    }
    const last = st.log.at(-1);
    this.alert.textContent = last ? `${t("date.format", { year: last.date.year, day: last.date.day })} — ${alertText(last, this.world)}` : t("hud.no_alert");
    this.alert.dataset["pause"] = String(last?.pause ?? false);
  }

  private set(key: string, text: string): void {
    const v = this.values.get(key);
    if (v) v.textContent = text;
  }

  private stockWhy(r: ResourceId): WhyContent {
    const day = this.plan?.resources[r];
    const st = this.strat();
    if (!day || !st) return { title: t(`res.${r}`), sections: [] };
    return {
      title: t("hud.stock_title", { resource: t(`res.${r}`) }),
      sections: [
        { text: t("hud.stock_text", { stock: formatNumber(st.stocks[r]), cap: formatNumber(day.capacity.value) }) },
        { label: t("hud.capacity"), explained: day.capacity },
      ],
    };
  }

  private deltaWhy(r: ResourceId): WhyContent {
    const day = this.plan?.resources[r];
    const st = this.strat();
    if (!day || !st) return { title: t(`res.${r}`), sections: [] };
    const sections: WhyContent["sections"] = [
      { label: t("hud.net"), explained: day.net, signed: true },
      { label: t("hud.production"), explained: day.production },
      { label: t("hud.consumption"), explained: day.consumption },
      { label: t("hud.losses"), explained: day.losses },
    ];
    if (day.overflow > 0) sections.push({ text: t("hud.overflow", { n: formatNumber(day.overflow) }) });
    if (day.shortfall > 0) sections.push({ text: t("hud.shortfall", { n: formatNumber(day.shortfall) }) });
    if (r === "gold" || r === "manpower") {
      const m = planMonth(this.world, st);
      if (r === "gold") sections.push({ label: t("hud.month_taxes"), explained: m.taxes }, { label: t("hud.month_upkeep"), explained: m.upkeep });
      else sections.push({ label: t("hud.month_manpower"), explained: m.manpower });
    }
    return { title: t("hud.delta_title", { resource: t(`res.${r}`) }), sections };
  }

  private populationWhy(): WhyContent {
    const st = this.strat();
    if (!st) return { title: t("hud.population"), sections: [] };
    const top = Object.entries(st.provinces)
      .filter(([, p]) => p.control === "paradis" && p.population > 0)
      .sort((a, b) => b[1].population - a[1].population)
      .slice(0, 6)
      .map(([id, p]) => `${t(this.world.provinceById.get(id)?.name_key ?? id)} : ${formatNumber(p.population)}`);
    return { title: t("hud.population"), sections: [{ text: t("hud.population_why") }, { text: top.join(" · ") }] };
  }

  private moraleWhy(): WhyContent {
    const target = this.plan?.moraleTarget["prov_mitras"];
    return { title: t("hud.morale"), sections: [{ text: t("hud.morale_why") }, ...(target ? [{ label: t("hud.morale_target"), explained: target }] : [])] };
  }
}

/** Moral national = moyenne des moraux provinciaux pondérée par la population (02 §4). */
export function nationalMorale(st: StrategicState): number {
  let pop = 0;
  let acc = 0;
  for (const p of Object.values(st.provinces)) {
    if (p.control !== "paradis" || p.population <= 0) continue;
    pop += p.population;
    acc += p.population * p.morale;
  }
  return pop > 0 ? acc / pop : 0;
}

/** Texte d'une alerte du journal : les paramètres qui sont des clés de texte sont traduits. */
/** Texte d'une alerte : ressources, clés i18n, provinces et personnages traduits (aucun identifiant brut). */
export function alertText(entry: { key: string; params: Record<string, string | number> }, world?: World): string {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(entry.params)) {
    if (typeof v !== "string") params[k] = v;
    else if (k === "resource") params[k] = t(`res.${v}`);
    else params[k] = world ? paramLabel(world, v) : hasKey(v) ? t(v) : v;
  }
  return t(entry.key, params);
}
