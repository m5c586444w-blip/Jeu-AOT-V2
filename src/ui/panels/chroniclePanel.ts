import { t } from "../../i18n";
import { daysLeft } from "../../sim/events/engine";
import { icon } from "../icons";
import { h, listItem, tabs, tag } from "../kit";
import type { Tone } from "../kit";
import { effectLines } from "../eventText";
import { axisYears, buildTimeline, dateLabel, EVENT_THEMES, filterItems, intelLevel } from "../timeline";
import type { TimelineItem } from "../timeline";
import type { EventTheme } from "../../data/schemas";
import { hint } from "../why";
import { formatNumber } from "../why";
import { button, el, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";

const STATUS_ICON: Readonly<Record<TimelineItem["status"], string>> = { passe: "verifie", en_cours: "horloge", annonce: "renseignement", evite: "fermer" };
const STATUS_TONE: Readonly<Record<TimelineItem["status"], Tone>> = { passe: "succes", en_cours: "accent", annonce: "info", evite: "neutre" };
/** Clé d'un élément : un fait de fond peut revenir d'une année à l'autre. */
const key = (i: TimelineItem): string => `${i.id}@${i.sort}`;
const THEME_ICON: Readonly<Record<EventTheme, string>> = { politique: "politique", militaire: "militaire", titans: "empreinte", famille: "famille", monde: "monde" };

/**
 * Chronologie (CHR.3, E-UX-6) : jauge de divergence, dossiers en attente, frise 845 à 854+ (passés cochés, en cours, annoncés selon
 * le renseignement, évités, écart au récit connu), liste et fiche de l'événement choisi, filtre par thème, faits du quotidien.
 * La rubrique « Chronique » de P5 y est conservée : mêmes classes, mêmes dossiers rouvrables.
 */
export class ChroniclePanel implements Panel {
  readonly id = "chronique" as const;
  private tab: "recit" | "quotidien" = "recit";
  private theme: EventTheme | null = null;
  private selected: string | null = null;

  constructor(private readonly ctx: PanelContext) {}

  private again(): void {
    this.ctx.open("chronique");
  }

  render(root: HTMLElement): void {
    const s = this.ctx.state();
    const ev = s.events;
    const cw = this.ctx.world.chronicle;
    if (!ev || !cw) {
      root.append(el("p", "registre-ferme", t("chron.closed")));
      return;
    }
    const threshold = cw.balance.divergence_threshold;
    const gaugeBox = el("div", "chronique-jauge");
    gaugeBox.dataset["branch"] = ev.branch;
    const share = Math.min(1, ev.divergence / threshold);
    const bar = el("div", "chronique-jauge__barre");
    const fill = el("div", "chronique-jauge__trace");
    fill.style.width = `${Math.round(share * 100)}%`;
    bar.append(fill);
    const line = el("p", "registre-champ");
    line.append(
      t("chron.divergence"),
      " ",
      valueEl(this.ctx, `${formatNumber(ev.divergence)} / ${formatNumber(threshold)}`, () => ({ title: t("chron.divergence"), sections: [{ text: t("chron.divergence_why", { threshold: formatNumber(threshold) }) }] })),
      ` · ${t(`chron.branch.${ev.branch}`)}`,
    );
    gaugeBox.append(line, bar);
    const items = buildTimeline(this.ctx.world, s);
    const level = intelLevel(s.intel);
    const intelLine = h("p", "frise__renseignement");
    intelLine.append(h("span", "frise__renseignement-libelle", t("chrono.intel")), tag(t(`chrono.intel.${level}`), level === 0 ? "neutre" : "info"));
    hint(intelLine, t("chrono.intel_why"));
    const summary = h("div", "frise-resume");
    summary.append(gaugeBox, intelLine);
    root.append(summary);

    if (ev.pending.length > 0) {
      for (const p of ev.pending) {
        const e = cw.events.get(p.id);
        if (!e) continue;
        const row = el("p", "registre-champ chronique-attente");
        row.dataset["pending"] = p.id;
        row.append(el("span", "chronique-attente__libelle", t("chron.pending_short")), el("strong", "", t(e.text_key)), ` · ${(daysLeft(p, s.date) <= 0 ? t("evt.pending_line_today") : t("evt.pending_line", { n: daysLeft(p, s.date) }))} `);
        const open = button(t("chron.open"), () => this.ctx.openEvent?.(p.id), "registre-bouton petit");
        open.dataset["action"] = "ouvrir-dossier";
        row.append(open);
        root.append(row);
      }
    }

    const top = h("div", "frise-tete");
    top.append(
      tabs(
        [
          { id: "recit" as const, label: t("chrono.tab.recit") },
          { id: "quotidien" as const, label: t("chrono.tab.quotidien") },
        ],
        this.tab,
        (id) => {
          this.tab = id;
          this.selected = null;
          this.again();
        },
      ),
      this.themeFilter(),
    );
    root.append(top);
    const shown = filterItems(items, this.theme, this.tab === "recit" ? "canon" : "quotidien");
    if (this.tab === "recit") root.append(this.axis(items, s.date.year, shown));

    const current = shown.find((i) => key(i) === this.selected) ?? this.defaultSelection(shown);
    const md = h("div", "maitre-detail frise-vue");
    const master = h("div", "maitre");
    const detail = h("div", "detail");
    md.append(master, detail);
    this.list(master, shown, current);
    if (current) this.sheet(detail, current);
    else detail.append(el("p", "registre-note", t("chrono.none")));
    root.append(md);
  }

  /** Sélection par défaut : le dernier événement passé ou en cours, sinon le premier. */
  private defaultSelection(shown: readonly TimelineItem[]): TimelineItem | undefined {
    for (let i = shown.length - 1; i >= 0; i--) if (shown[i]?.status !== "annonce") return shown[i];
    return shown[0];
  }

  private themeFilter(): HTMLElement {
    const bar = el("div", "registre-filtres frise__themes");
    const all = button(t("chrono.theme.tous"), () => {
      this.theme = null;
      this.again();
    }, "registre-onglet");
    all.setAttribute("aria-pressed", String(this.theme === null));
    bar.append(all);
    for (const th of EVENT_THEMES) {
      const b = button("", () => {
        this.theme = this.theme === th ? null : th;
        this.again();
      }, "registre-onglet");
      b.insertAdjacentHTML("afterbegin", icon(THEME_ICON[th], "ico ico--s"));
      b.append(t(`chrono.theme.${th}`));
      b.setAttribute("aria-pressed", String(this.theme === th));
      b.dataset["theme"] = th;
      bar.append(b);
    }
    return bar;
  }

  /** Axe 845 à 854+ : un segment par année, un repère par événement du récit (plein = passé, trait = annoncé, barré = évité). */
  private axis(all: readonly TimelineItem[], currentYear: number, shown: readonly TimelineItem[]): HTMLElement {
    const visible = new Set(shown.map(key));
    const wrap = h("div", "frise");
    wrap.setAttribute("role", "list");
    wrap.setAttribute("aria-label", t("chrono.axis"));
    for (const seg of axisYears(all.filter((i) => i.group === "canon"), currentYear)) {
      const box = h("div", `frise__annee${seg.year === currentYear ? " frise__annee--courante" : ""}`);
      box.style.flexGrow = String(seg.weight);
      box.setAttribute("role", "listitem");
      box.dataset["year"] = String(seg.year);
      const marks = h("div", "frise__reperes");
      for (const i of seg.items) {
        const m = h("button", `frise__repere${visible.has(key(i)) ? "" : " frise__repere--eteint"}${key(i) === this.selected ? " frise__repere--choisi" : ""}`);
        m.type = "button";
        m.dataset["statut"] = i.status;
        m.dataset["theme"] = i.theme;
        if (i.gap > 0 && i.status === "passe") m.dataset["ecart"] = "1";
        hint(m, `${i.title} — ${dateLabel(i)}`);
        m.addEventListener("click", () => {
          this.selected = key(i);
          this.again();
        });
        marks.append(m);
      }
      box.append(marks, h("span", "frise__annee-nom", seg.year === 854 && currentYear > 854 ? t("chrono.year_plus", { year: seg.year }) : String(seg.year)));
      wrap.append(box);
    }
    wrap.append(this.legend());
    return wrap;
  }

  private legend(): HTMLElement {
    const l = h("p", "frise__legende");
    for (const st of ["passe", "en_cours", "annonce", "evite"] as const) {
      const k = h("span", "frise__legende-item");
      const dot = h("span", "frise__repere frise__repere--legende");
      dot.dataset["statut"] = st;
      k.append(dot, t(`chrono.status.${st}`));
      l.append(k);
    }
    const gap = h("span", "frise__legende-item");
    const dot = h("span", "frise__repere frise__repere--legende");
    dot.dataset["statut"] = "passe";
    dot.dataset["ecart"] = "1";
    gap.append(dot, t("chrono.status.ecart"));
    l.append(gap);
    return l;
  }

  private list(master: HTMLElement, shown: readonly TimelineItem[], current: TimelineItem | undefined): void {
    if (shown.length === 0) {
      master.append(el("p", "registre-note", t("chrono.none")));
      return;
    }
    const ol = h("ol", "liste chronique-liste");
    let year = 0;
    const mark = (i: TimelineItem): number => (i.day !== null ? Math.floor(i.day / 360) : i.year);
    for (const i of this.tab === "quotidien" ? [...shown].reverse() : shown) {
      if (mark(i) !== year) {
        year = mark(i);
        const head = h("li", "frise__section", t("chrono.year_head", { year }));
        head.setAttribute("role", "presentation");
        ol.append(head);
      }
      let trail: HTMLElement | string = "";
      if (i.status === "passe" && i.gap > 0) trail = valueEl(this.ctx, `+${formatNumber(i.gap)}`, () => ({ title: t("chron.divergence"), sections: [{ text: t("chron.choice_why") }] }), "chronique-ecart");
      else if (i.status === "evite") trail = tag(t("chrono.status.evite"), "neutre");
      else if (i.status === "annonce") trail = tag(t(`chrono.foresight.${i.foresight ?? "rumeur"}`), "info");
      else if (i.status === "en_cours") trail = tag(t("chrono.status.en_cours"), "accent");
      const li = listItem({
        title: i.title,
        meta: dateLabel(i),
        lead: icon(STATUS_ICON[i.status], `ico ico--s frise__etat frise__etat--${i.status}`),
        trail,
        selected: current !== undefined && key(current) === key(i),
        off: i.status === "evite",
        onSelect: () => {
          this.selected = key(i);
          this.again();
        },
      });
      li.classList.add(`chronique-${i.status === "passe" ? "survenu" : i.status}`);
      li.dataset["event"] = i.id;
      li.dataset["theme"] = i.theme;
      ol.append(li);
    }
    master.append(ol);
  }

  /** Fiche de l'événement choisi : date, statut, résumé, écart au récit, ce qui s'est produit. */
  private sheet(box: HTMLElement, i: TimelineItem): void {
    const head = h("header", "frise-fiche__tete");
    const art = h("span", "frise-fiche__theme");
    art.insertAdjacentHTML("afterbegin", icon(THEME_ICON[i.theme], "ico ico--l"));
    head.append(art, h("h3", "frise-fiche__titre", i.title));
    box.append(head);
    const tags = h("p", "frise-fiche__etiquettes");
    tags.append(tag(t(`chrono.status.${i.status}`), STATUS_TONE[i.status]), tag(t(`chrono.theme.${i.theme}`)), h("span", "frise-fiche__date", dateLabel(i)));
    if (i.status === "annonce" && i.foresight) tags.append(tag(t(`chrono.foresight.${i.foresight}`), "info"));
    box.append(tags);
    box.append(h("p", "frise-fiche__resume", i.summary));
    if (i.group === "canon" && i.status === "passe") {
      const ecart = h("p", "frise-fiche__ecart");
      if (i.conform === false || i.gap > 0) ecart.append(t("chrono.ecart_line"), " ", valueEl(this.ctx, `+${formatNumber(i.gap)}`, () => ({ title: t("chron.divergence"), sections: [{ text: t("chron.choice_why") }] }), "chronique-ecart"));
      else ecart.append(t("chrono.conforme_line"));
      box.append(ecart);
    }
    if (i.status === "evite") box.append(h("p", "frise-fiche__ecart", t("chron.avoided_why")));
    if (i.choice) box.append(h("p", "frise-fiche__choix", t("chrono.choice_line", { choice: t(`${i.def.text_key}.choice.${i.choice}`) })));
    if (i.pending) {
      const open = button(t("chron.open"), () => this.ctx.openEvent?.(i.id), "registre-bouton principal");
      open.dataset["action"] = "ouvrir-dossier-fiche";
      box.append(open);
    }
    if (i.status === "passe" && i.def.effects.length > 0) {
      const lines = effectLines(this.ctx.world, i.def.effects, i.subject);
      if (lines.length > 0) {
        box.append(h("h4", "dossier-evenement__intertitre", t("evt.consequences")));
        const ul = h("ul", "effets");
        for (const l of lines) ul.append(h("li", `effet effet--${l.tone}`, l.text));
        box.append(ul);
      }
    }
  }
}
