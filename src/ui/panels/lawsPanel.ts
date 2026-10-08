import type { Law, Modifier } from "../../data/schemas";
import { t } from "../../i18n";
import { absDay } from "../../sim/politics/state";
import { formatNumber, formatSigned } from "../why";
import { listItem, tag } from "../kit";
import { button, el, masterDetail, noPolitics } from "./common";
import type { Panel, PanelContext } from "./common";

const CATEGORIES = ["militaire", "economie", "ordre", "religion", "information", "societe"] as const;

/** Lecture humaine d'un modificateur de décret. */
export function describeModifier(m: Modifier): string {
  const [kind, arg] = m.target.split(":") as [string, string | undefined];
  const pct = (v: number): string => `${formatSigned(v * 100)} %`;
  switch (kind) {
    case "production_mult":
      return t("mod.production", { resource: t(`res.${arg}`), v: pct(m.value) });
    case "consumption_mult":
      return t("mod.consumption", { resource: t(`res.${arg}`), v: pct(m.value) });
    case "losses_mult":
      return t("mod.losses", { resource: t(`res.${arg}`), v: pct(m.value) });
    case "tax_mult":
      return t("mod.tax", { v: pct(m.value) });
    case "manpower_mult":
      return t("mod.manpower", { v: pct(m.value) });
    case "satisfaction":
      return t("mod.satisfaction", { stratum: t(`stratum.${(arg ?? "").replace(/^str_/, "")}`), v: formatSigned(m.value) });
    case "radicalisation":
      return t("mod.radicalisation", { stratum: t(`stratum.${(arg ?? "").replace(/^str_/, "")}`), v: formatSigned(m.value) });
    case "org_loyalty":
      return t("mod.org_loyalty", { org: t(`org.name.${(arg ?? "").replace(/^org_/, "")}`), v: formatSigned(m.value) });
    case "org_influence":
      return t("mod.org_influence", { org: t(`org.name.${(arg ?? "").replace(/^org_/, "")}`), v: formatSigned(m.value) });
    default:
      return t(`mod.${kind}`, { v: formatSigned(m.value) });
  }
}

/** Registre des décrets (F-POL-02) : effets, contre-effets, réactions différées, coût ; décréter, soumettre, abroger. */
export class LawsPanel implements Panel {
  readonly id = "decrets" as const;
  private category: (typeof CATEGORIES)[number] = "militaire";
  private selected: string | null = null;

  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement, arg?: string): void {
    const pw = this.ctx.world.politics;
    const pol = this.ctx.state().politics;
    if (!pw || !pol) return noPolitics(root);
    if (arg && pw.laws.has(arg)) {
      this.selected = arg;
      const cat = pw.laws.get(arg)?.category;
      if (cat && (CATEGORIES as readonly string[]).includes(cat)) this.category = cat as (typeof CATEGORIES)[number];
    }
    const tabs = el("div", "registre-filtres");
    for (const c of CATEGORIES) {
      const b = button(t(`law.category.${c}`), () => {
        this.category = c;
        this.selected = null;
        this.ctx.open("decrets");
      }, "registre-onglet");
      b.setAttribute("aria-pressed", String(c === this.category));
      tabs.append(b);
    }
    root.append(tabs);
    const today = absDay(this.ctx.state().date);
    const laws = [...pw.laws.values()].filter((l) => l.category === this.category);
    if (!laws.some((l) => l.id === this.selected)) this.selected = laws[0]?.id ?? null;
    // Liste des décrets de la catégorie (état, coût) à gauche ; le décret choisi en entier à droite (U5).
    const md = masterDetail(root, "decrets", "decrets-vue");
    const ul = el("ul", "liste");
    ul.setAttribute("aria-label", t("panel.decrets"));
    for (const law of laws) {
      const active = pol.laws.find((a) => a.id === law.id);
      const state = active ? tag(t("laws.in_force_short"), "succes") : law.requires_vote ? tag(t("laws.vote_short"), "alerte") : "";
      const item = listItem({ title: t(law.name_key), meta: t("laws.cost_short", { capital: law.cost.capital }), trail: state, selected: law.id === this.selected, onSelect: () => this.ctx.open("decrets", law.id) });
      item.dataset["law"] = law.id;
      ul.append(item);
    }
    md.master.append(ul);
    const law = this.selected ? pw.laws.get(this.selected) : undefined;
    if (law) md.detail.append(this.card(root, law, pol, today));
    md.done();
  }

  /** Décret en entier : effets, contre-effets, réactions différées, coût, action. */
  private card(root: HTMLElement, law: Law, pol: NonNullable<ReturnType<PanelContext["state"]>["politics"]>, today: number): HTMLElement {
    const active = pol.laws.find((a) => a.id === law.id);
    const card = el("article", `decret${active ? " decret--en-vigueur" : ""}`);
    card.dataset["law"] = law.id;
    const head = el("header", "decret-tete");
    head.append(el("h4", "decret-titre", t(law.name_key)));
    if (active) head.append(el("span", "decret-tampon", t("laws.in_force", { days: today - active.since })));
    if (law.requires_vote) head.append(el("span", "decret-vote", t("laws.needs_vote")));
    card.append(head, el("p", "decret-desc", t(law.desc_key)));
    const effects = el("ul", "decret-effets");
    for (const m of law.effects) effects.append(el("li", m.value >= 0 === !m.target.startsWith("radicalisation") ? "effet-plus" : "effet-moins", describeModifier(m)));
    for (const [i, d] of law.delayed.entries()) {
      const fired = active?.triggered.includes(i) ?? false;
      effects.append(el("li", `effet-differe${fired ? " declenche" : ""}`, t("laws.delayed", { days: d.after_days, text: t(d.log_key), effects: d.effects.map(describeModifier).join(", ") })));
    }
    card.append(effects);
    const foot = el("footer", "decret-pied");
    foot.append(el("span", "", t("laws.cost", { capital: law.cost.capital, gold: formatNumber(law.cost.gold) })));
    if (active) {
      foot.append(button(t("laws.repeal", { capital: Math.ceil(law.cost.capital / 2) }), () => this.act(root, law, "repeal")));
    } else if (law.requires_vote) {
      foot.append(button(t("laws.to_cabinet"), () => this.ctx.open("cabinet", law.id)));
    } else {
      const b = button(t("laws.enact"), () => this.act(root, law, "enact"), "registre-bouton principal");
      b.disabled = pol.capital < law.cost.capital;
      foot.append(b);
    }
    card.append(foot);
    return card;
  }

  /** Décision engagée seulement après confirmation (F-UIX-13) ; « annuler » ne change rien (F-UIX-12). */
  private act(root: HTMLElement, law: Law, kind: "enact" | "repeal"): void {
    const msg = t(kind === "enact" ? "laws.confirm_enact" : "laws.confirm_repeal", { law: t(law.name_key) });
    void this.ctx.confirm(msg).then((ok) => {
      if (!ok) return;
      void this.ctx.dispatch(kind === "enact" ? { type: "EnactLaw", law: law.id } : { type: "RepealLaw", law: law.id }).then(() => {
        root.replaceChildren();
        this.render(root, law.id);
      });
    });
  }
}
