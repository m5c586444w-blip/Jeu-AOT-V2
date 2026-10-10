import { hasKey, t } from "../i18n";
import { stateHash } from "../sim/core/canonical";
import type { GameState } from "../sim/core/state";
import { fromAbsoluteDay, monthOf, seasonOf } from "../sim/core/time";
import { planDay, planMonth, totals, withArmyDraws } from "../sim/strategic/economy";
import type { DayPlan, StrategicState } from "../sim/strategic/economy";
import type { ResourceId } from "../sim/strategic/resources";
import type { World } from "../sim/strategic/world";
import { nationIncome, nationUpkeep } from "../sim/world/nations";
import { emblem, icon, registerIcon, resourceIcon } from "./icons";
import { paramLabel } from "./panels/common";
import { setPlayerFaction } from "./theme";
import { formatNumber, formatSigned, hint } from "./why";
import type { WhyContent, WhyTooltip } from "./why";

/**
 * Ressources clés de la barre supérieure (U2 : 6 à 8) ; les autres (poudre, chevaux, charbon), la population et le
 * rationnement sont dans l'écran « Économie » et dans les infobulles.
 */
export const HUD_RESOURCES: readonly ResourceId[] = ["food", "gas", "steel", "iceburst", "manpower", "gold"];

export interface HudActions {
  setSpeed(speed: number): void;
  /** Ouvre un registre (P2) ; absent si le scénario n'a pas de couche politique. */
  openPanel?(id: string): void;
  /** Libellé de la touche qui ouvre un registre (raccourcis affichés dans les infobulles, U10). */
  keyOf?(id: string): string;
}

/** Menu de gestion (U2) : registres regroupés par domaine, dans l'ordre de lecture. */
export const MANAGEMENT_GROUPS: readonly { id: string; panels: readonly string[] }[] = [
  { id: "gouvernement", panels: ["personnages", "cabinet", "decrets", "organisations", "conseil", "economie", "missions"] },
  { id: "armee", panels: ["armees", "expeditions", "porteurs"] },
  { id: "recherche", panels: ["recherche"] },
  { id: "renseignement", panels: ["renseignement"] },
  { id: "diplomatie", panels: ["diplomatie"] },
  { id: "monde", panels: ["monde", "chronique", "journal", "gazette", "archives", "epilogue"] },
];
/** Registres propres aux institutions de Paradis : masqués quand le joueur mène une autre nation (P7). */
const PARADIS_ONLY = new Set(["personnages", "cabinet", "decrets", "organisations", "conseil", "economie", "expeditions", "renseignement", "recherche"]);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Nom affiché d'une nation (`fac_paradis` → `fac.paradis`). */
export function nationName(faction: string): string {
  const key = faction.replace(/^fac_/, "fac.");
  return hasKey(key) ? t(key) : t("fac.paradis");
}

/**
 * Barre supérieure (U2) : nation, ressources clés avec variation du jour, valeurs nationales, date, vitesse ; barre
 * d'alertes dessous. Menu de gestion (`gestion`) en bas de l'écran. Chaque nombre porte sa fiche « pourquoi ? ».
 */
export class Hud {
  readonly el = el("header", "bandeau");
  readonly gestion = el("nav", "gestion");
  private state: GameState;
  private plan: DayPlan | null = null;
  private readonly values = new Map<string, HTMLElement>();
  private readonly speedButtons: HTMLButtonElement[] = [];
  private readonly panelButtons = new Map<string, HTMLButtonElement>();
  private readonly alert = el("p", "bandeau__alerte");
  private readonly alertText = el("span", "bandeau__alerte-texte");
  private readonly chips = el("div", "bandeau__puces");
  private readonly blason = el("span", "bandeau__blason");
  private readonly nation = el("span", "bandeau__nation-nom");
  private faction = "";

  constructor(private readonly world: World, initial: GameState, private readonly why: WhyTooltip, private readonly actions: HudActions) {
    this.state = initial;
    const head = el("div", "bandeau__tete");
    const id = el("div", "bandeau__identite");
    id.append(el("h1", "bandeau__titre", t("app.title")), this.nation);
    head.append(this.blason, id);

    // Deux groupes (U3 : jamais plus de 7 éléments au même niveau) : les ressources clés, puis l'état du pays.
    const ledger = el("div", "bandeau__registre");
    const resources = el("div", "bandeau__groupe bandeau__groupe--ressources");
    const realm = el("div", "bandeau__groupe bandeau__groupe--etat");
    ledger.append(resources, realm);
    for (const r of HUD_RESOURCES) resources.append(this.resourceCell(r));
    realm.append(this.valueCell("morale", t("hud.morale"), "moral", () => this.moraleWhy()));
    // Autre nation jouée (P7) : ses propres comptes (industrie, hommes, soutien à la guerre, stabilité).
    if (world.nations) {
      const nat = (key: string, label: string, iconId: string, why: () => WhyContent): void => {
        const c = this.valueCell(key, label, iconId, why);
        c.dataset["paradis"] = "0";
        c.dataset["autre"] = "1";
        realm.append(c);
      };
      nat("n_industry", t("world.industry"), "acier", () => this.nationWhy("industry"));
      nat("n_manpower", t("world.manpower"), "hommes", () => this.nationWhy("manpower"));
      nat("n_war", t("world.war_support"), "epees", () => ({ title: t("world.war_support"), sections: [{ text: t("world.war_support_why") }] }));
      nat("n_stability", t("world.stability"), "legitimite", () => ({ title: t("world.stability"), sections: [{ text: t("world.stability_why") }] }));
    }
    if (world.politics) {
      realm.append(this.valueCell("legitimacy", t("hud.legitimacy"), "legitimite", () => ({ title: t("hud.legitimacy"), sections: [{ text: t("hud.legitimacy_why") }] })));
      realm.append(this.valueCell("capital", t("hud.capital"), "sceau", () => ({ title: t("hud.capital"), sections: [{ text: t("hud.capital_why") }] })));
    }

    const time = el("div", "bandeau__temps");
    time.append(this.dateBlock(), this.speedBlock());
    if (world.politics && actions.openPanel) {
      // Retour au menu principal (P8, 04 §5.1) : la partie est sauvegardée automatiquement à intervalles.
      const menu = el("button", "bandeau__menu");
      menu.type = "button";
      menu.innerHTML = icon("menu");
      menu.append(el("span", "lecteur-seul", t("menu.open")));
      hint(menu, t("menu.open"));
      menu.dataset["action"] = "menu";
      menu.addEventListener("click", () => {
        window.location.search = "?menu=1";
      });
      time.append(menu);
    }

    // Barre d'alertes : dernière alerte du journal, ruptures en cours ; graine et empreinte en mode debug (F2) seulement.
    const foot = el("div", "bandeau__pied");
    this.alert.setAttribute("aria-live", "polite");
    this.alert.innerHTML = icon("alerte");
    this.alert.append(this.alertText);
    const seed = this.valueCell("seed", t("app.seed"), "", () => ({ title: t("app.seed"), sections: [{ text: t("hud.seed_why") }] }));
    const hash = this.valueCell("hash", t("app.hash"), "", () => ({ title: t("app.hash"), sections: [{ text: t("hud.hash_why") }] }));
    seed.classList.add("bandeau__champ--debug");
    hash.classList.add("bandeau__champ--debug");
    foot.append(this.alert, this.chips, seed, hash);
    this.el.append(head, ledger, time, foot);

    if ((world.politics || world.endings) && actions.openPanel) this.buildManagement();
    else this.gestion.hidden = true;

    // Hauteurs réelles des barres (selon l'échelle et la définition) : les registres s'ouvrent entre les deux (P8, U2).
    // Mesures hors du rappel de l'observateur (image suivante) : pas de boucle de redimensionnement.
    if (typeof ResizeObserver === "function") {
      let pending = false;
      const measure = (): void => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          this.fitManagement();
          const root = document.documentElement.style;
          root.setProperty("--bandeau-h", `${Math.ceil(this.el.getBoundingClientRect().bottom)}px`);
          root.setProperty("--gestion-h", this.gestion.hidden ? "0px" : `${Math.ceil(window.innerHeight - this.gestion.getBoundingClientRect().top)}px`);
        });
      };
      this.scheduleMeasure = measure;
      const ro = new ResizeObserver(measure);
      ro.observe(this.el);
      ro.observe(this.gestion);
    }
  }

  /** Largeur sous laquelle les étiquettes ne tiennent plus (mesurée une fois ; la largeur ne dépend pas du mode). */
  private compactBelow = 0;
  private scheduleMeasure: (() => void) | null = null;

  /** Menu de gestion : groupes nommés, boutons à icône et étiquette courte ; nom complet et touche au survol. */
  private buildManagement(): void {
    this.gestion.setAttribute("aria-label", t("hud.registers"));
    const pol = !!this.world.politics;
    const present: Record<string, boolean> = { personnages: pol, cabinet: pol, decrets: pol, organisations: pol, conseil: pol, expeditions: !!this.world.military, chronique: !!this.world.chronicle, renseignement: !!this.world.intel, recherche: !!this.world.research, porteurs: !!this.world.shifters, monde: !!this.world.nations, diplomatie: !!this.world.nations, economie: pol || !!this.world.endings, armees: !!this.world.armies, missions: !!this.world.missions };
    for (const g of MANAGEMENT_GROUPS) {
      const ids = g.panels.filter((p) => present[p] ?? true);
      if (ids.length === 0) continue;
      const group = el("div", "gestion__groupe");
      group.dataset["groupe"] = g.id;
      if (ids.every((p) => PARADIS_ONLY.has(p))) group.dataset["paradis"] = "1";
      const row = el("div", "gestion__boutons");
      for (const id of ids) {
        const b = el("button", "bandeau__registre-bouton");
        b.type = "button";
        b.innerHTML = registerIcon(id);
        b.append(el("span", "gestion__etiquette", t(`panel.${id}`)));
        // Nom et raccourci dans l'infobulle (U2, U10), aussi quand l'étiquette est masquée (mode compact).
        hint(b, t(`panel.${id}`), this.actions.keyOf?.(id) ?? "");
        b.dataset["panel"] = id;
        b.setAttribute("aria-pressed", "false");
        if (PARADIS_ONLY.has(id)) b.dataset["paradis"] = "1";
        b.addEventListener("click", () => this.actions.openPanel?.(id));
        this.panelButtons.set(id, b);
        row.append(b);
      }
      group.append(el("span", "gestion__titre", t(`gestion.${g.id}`)), row);
      this.gestion.append(group);
    }
  }

  /** Étiquettes masquées (icônes seules, nom au survol) quand la largeur ne suffit pas (1366 px à 125 %). */
  private fitManagement(): void {
    if (this.gestion.hidden) return;
    const w = this.gestion.clientWidth;
    const compact = this.gestion.dataset["compact"] === "true";
    if (!compact && this.gestion.scrollWidth > w + 1) {
      this.compactBelow = w;
      this.gestion.dataset["compact"] = "true";
    } else if (compact && w > this.compactBelow + 1) {
      this.gestion.dataset["compact"] = "false";
      if (this.gestion.scrollWidth > w + 1) {
        this.compactBelow = w;
        this.gestion.dataset["compact"] = "true";
      }
    } else if (!compact) this.gestion.dataset["compact"] = "false";
  }

  /** Registre ouvert : son bouton est marqué enfoncé. */
  setOpenPanel(id: string | null): void {
    for (const [p, b] of this.panelButtons) b.setAttribute("aria-pressed", String(p === id));
  }

  private dateBlock(): HTMLElement {
    const box = el("div", "bandeau__date");
    const v = el("span", "valeur bandeau__jour");
    const s = el("span", "bandeau__saison");
    this.values.set("date", v);
    this.values.set("season", s);
    this.why.bind(v, () => ({ title: t("hud.calendar"), sections: [{ text: t("hud.calendar_why") }] }));
    box.append(v, s);
    return box;
  }

  private speedBlock(): HTMLElement {
    const box = el("div", "bandeau__vitesses");
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", t("hud.speed"));
    for (let s = 0; s <= 5; s++) {
      const b = el("button", "bandeau__vitesse");
      if (s === 0) b.innerHTML = icon("pause");
      else b.textContent = String(s);
      b.type = "button";
      hint(b, s === 0 ? t("hud.pause") : t("hud.speed_n", { n: s }), this.actions.keyOf?.(s === 0 ? "pause" : `speed_${s}`) ?? "");
      b.addEventListener("click", () => this.actions.setSpeed(s));
      this.speedButtons.push(b);
      box.append(b);
    }
    return box;
  }

  private resourceCell(r: ResourceId): HTMLElement {
    const cell = el("div", "bandeau__ressource");
    cell.dataset["resource"] = r;
    cell.dataset["paradis"] = "1";
    const ic = el("span", "bandeau__icone");
    ic.innerHTML = resourceIcon(r);
    const name = el("span", "bandeau__libelle", t(`res.short.${r}`));
    const stock = el("span", "valeur bandeau__stock");
    const delta = el("span", "valeur bandeau__delta");
    stock.setAttribute("aria-label", t(`res.${r}`));
    this.values.set(`stock:${r}`, stock);
    this.values.set(`delta:${r}`, delta);
    this.why.bind(stock, () => this.stockWhy(r));
    this.why.bind(delta, () => this.deltaWhy(r));
    cell.append(ic, name, stock, delta);
    return cell;
  }

  private valueCell(key: string, label: string, iconId: string, provider: () => WhyContent): HTMLElement {
    const f = el("span", "bandeau__champ");
    if (iconId) {
      f.dataset["paradis"] = "1";
      const ic = el("span", "bandeau__icone");
      ic.innerHTML = icon(iconId);
      f.append(ic);
    }
    const v = el("span", "valeur bandeau__valeur");
    v.dataset["field"] = key;
    this.values.set(key, v);
    this.why.bind(v, provider);
    f.append(v, el("span", "bandeau__libelle", label));
    return f;
  }

  private strat(): StrategicState | null {
    return this.state.strategic;
  }

  update(state: GameState, speed: number): void {
    this.state = state;
    // Nation jouée (P7) : accent de faction (U1) ; les comptes et registres propres à Paradis s'effacent quand on mène Marley.
    const faction = state.nations?.player ?? "fac_paradis";
    this.el.dataset["joueur"] = faction;
    if (faction !== this.faction) {
      this.faction = faction;
      setPlayerFaction(faction);
      this.blason.innerHTML = emblem(faction);
      this.nation.textContent = nationName(faction);
      // Les registres visibles changent : on remesure la place des étiquettes.
      this.compactBelow = 0;
      this.gestion.dataset["compact"] = "false";
      this.scheduleMeasure?.();
    }
    const st = this.strat();
    this.plan = st ? withArmyDraws(planDay(this.world, st, state.date), state.armies?.drawn) : null;
    const d = state.date;
    this.set("date", t("date.format", { year: d.year, day: d.day }));
    this.set("season", `${t(`season.${seasonOf(d)}`)}, ${t("hud.month", { n: monthOf(d) })}`);
    this.set("seed", String(state.seed));
    this.set("hash", stateHash(state));
    this.speedButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(i === speed)));
    if (st && this.plan) {
      for (const r of HUD_RESOURCES) {
        const day = this.plan.resources[r];
        this.set(`stock:${r}`, formatNumber(st.stocks[r]));
        const delta = this.values.get(`delta:${r}`);
        if (delta) {
          const diff = day.next - st.stocks[r];
          delta.textContent = formatSigned(diff);
          delta.dataset["sign"] = day.shortfall > 0 ? "rupture" : diff < 0 ? "baisse" : diff > 0 ? "hausse" : "nul";
        }
      }
      this.set("morale", formatNumber(nationalMorale(st)));
      if (state.politics) {
        this.set("legitimacy", formatNumber(state.politics.legitimacy));
        this.set("capital", formatNumber(state.politics.capital));
      }
    }
    const me = state.nations?.nations[faction];
    if (me) {
      this.set("n_industry", formatNumber(Math.round(me.industry)));
      this.set("n_manpower", formatNumber(Math.round(me.manpower)));
      this.set("n_war", formatNumber(Math.round(me.warSupport)));
      this.set("n_stability", formatNumber(Math.round(me.stability)));
    }
    this.updateAlerts(state, st);
  }

  private nationWhy(kind: "industry" | "manpower"): WhyContent {
    const ns = this.state.nations;
    if (!ns) return { title: t(`world.${kind}`), sections: [] };
    const inc = nationIncome(this.world, ns, ns.player, this.state.strategic);
    return kind === "industry"
      ? { title: t("world.industry_income"), sections: [{ explained: inc.industry }, { explained: nationUpkeep(this.world, ns, ns.player), cost: true }] }
      : { title: t("world.manpower_income"), sections: [{ explained: inc.manpower }] };
  }

  /** Barre d'alertes : dernière entrée du journal (Paradis) ou du journal du monde (autre nation), ruptures en cours. */
  private updateAlerts(state: GameState, st: StrategicState | null): void {
    const ns = state.nations;
    if (ns && ns.player !== "fac_paradis") {
      const w = ns.log.at(-1);
      const wd = w ? fromAbsoluteDay(w.day) : null;
      this.alertText.textContent = w && wd ? `${t("date.format", { year: wd.year, day: wd.day })} — ${t(w.key, Object.fromEntries(Object.entries(w.params).map(([k, v]) => [k, typeof v === "string" && hasKey(v) ? t(v) : v])))}` : t("hud.no_alert");
      this.alert.dataset["pause"] = "false";
      this.chips.replaceChildren();
      return;
    }
    const last = st?.log.at(-1);
    this.alertText.textContent = last ? `${t("date.format", { year: last.date.year, day: last.date.day })} — ${alertText(last, this.world)}` : t("hud.no_alert");
    this.alert.dataset["pause"] = String(last?.pause ?? false);
    const short = st?.shortages ?? [];
    if (this.chips.dataset["etat"] === short.join(",")) return;
    this.chips.dataset["etat"] = short.join(",");
    this.chips.replaceChildren();
    for (const r of short) {
      const c = el("span", "bandeau__puce");
      c.innerHTML = resourceIcon(r);
      c.append(el("span", "", t("alert.shortage", { resource: t(`res.${r}`) })));
      c.tabIndex = 0;
      this.why.bind(c, () => this.deltaWhy(r));
      this.chips.append(c);
    }
  }

  private set(key: string, text: string): void {
    const v = this.values.get(key);
    if (v) v.textContent = text;
  }

  private stockWhy(r: ResourceId): WhyContent {
    const day = this.plan?.resources[r];
    const st = this.strat();
    if (!day || !st) return { title: t(`res.${r}`), sections: [] };
    const key = this.actions.keyOf?.("economie") ?? "";
    return {
      title: t("hud.stock_title", { resource: t(`res.${r}`) }),
      value: `${formatNumber(st.stocks[r])} / ${formatNumber(day.capacity.value)}`,
      sections: [
        { text: t("hud.stock_text", { stock: formatNumber(st.stocks[r]), cap: formatNumber(day.capacity.value) }) },
        { label: t("hud.capacity"), explained: day.capacity },
      ],
      ...(key ? { key, keyLabel: t("hud.economy_hint") } : {}),
    };
  }

  deltaWhy(r: ResourceId): WhyContent {
    return resourceDeltaWhy(this.world, this.plan, this.strat(), r);
  }

  private moraleWhy(): WhyContent {
    const st = this.strat();
    const target = this.plan?.moraleTarget["prov_mitras"];
    const pop = st ? totals(st).population : 0;
    return {
      title: t("hud.morale"),
      ...(st ? { value: formatNumber(nationalMorale(st)) } : {}),
      sections: [{ text: t("hud.morale_why") }, ...(target ? [{ label: t("hud.morale_target"), explained: target }] : []), { text: `${t("hud.population")} : ${formatNumber(pop)}` }],
    };
  }
}

/** Fiche « pourquoi cette variation » d'une ressource (barre supérieure et écran « Économie »). */
export function resourceDeltaWhy(world: World, plan: DayPlan | null, st: StrategicState | null, r: ResourceId): WhyContent {
  const day = plan?.resources[r];
  if (!day || !st) return { title: t(`res.${r}`), sections: [] };
  const sections: WhyContent["sections"] = [
    { label: t("hud.net"), explained: day.net, signed: true },
    { label: t("hud.production"), explained: day.production },
    { label: t("hud.consumption"), explained: day.consumption, cost: true },
    { label: t("hud.losses"), explained: day.losses, cost: true },
  ];
  if (day.overflow > 0) sections.push({ text: t("hud.overflow", { n: formatNumber(day.overflow) }) });
  if (day.shortfall > 0) sections.push({ text: t("hud.shortfall", { n: formatNumber(day.shortfall) }) });
  if (r === "gold" || r === "manpower") {
    const m = planMonth(world, st);
    if (r === "gold") sections.push({ label: t("hud.month_taxes"), explained: m.taxes }, { label: t("hud.month_upkeep"), explained: m.upkeep, cost: true });
    else sections.push({ label: t("hud.month_manpower"), explained: m.manpower });
  }
  return { title: t("hud.delta_title", { resource: t(`res.${r}`) }), value: t("hud.per_day", { n: formatSigned(day.net.value) }), sections };
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
