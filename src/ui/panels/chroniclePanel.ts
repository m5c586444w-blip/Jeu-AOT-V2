import { t } from "../../i18n";
import { dateOfDay, daysLeft } from "../../sim/events/engine";
import { button, el, valueEl } from "./common";
import type { Panel, PanelContext } from "./common";
import { formatNumber } from "../why";

/**
 * Chronique (F-EVT-01, F-EVT-02, F-EVT-12) : jauge de divergence, dossiers en attente, événements survenus ou évités.
 * Seul le passé est montré : la chronique n'annonce jamais un événement à venir.
 */
export class ChroniclePanel implements Panel {
  readonly id = "chronique" as const;

  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement): void {
    const s = this.ctx.state();
    const ev = s.events;
    const cw = this.ctx.world.chronicle;
    if (!ev || !cw) {
      root.append(el("p", "registre-ferme", t("chron.closed")));
      return;
    }
    const threshold = cw.balance.divergence_threshold;
    const gauge = el("div", "chronique-jauge");
    gauge.dataset["branch"] = ev.branch;
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
    gauge.append(line, bar);
    root.append(gauge);

    root.append(el("h3", "registre-intertitre", t("chron.pending")));
    if (ev.pending.length === 0) root.append(el("p", "registre-note", t("chron.no_pending")));
    for (const p of ev.pending) {
      const e = cw.events.get(p.id);
      if (!e) continue;
      const row = el("p", "registre-champ chronique-attente");
      row.dataset["pending"] = p.id;
      row.append(el("strong", "", t(e.text_key)), ` · ${t("evt.pending_line", { n: daysLeft(p, s.date) })} `);
      const open = button(t("chron.open"), () => this.ctx.openEvent?.(p.id), "registre-bouton petit");
      open.dataset["action"] = "ouvrir-dossier";
      row.append(open);
      root.append(row);
    }

    root.append(el("h3", "registre-intertitre", t("chron.history")));
    const list = el("ol", "journal-liste chronique-liste");
    list.reversed = true;
    const entries = ev.chronicle.filter((c) => c.status !== "en_attente");
    if (entries.length === 0) root.append(el("p", "registre-note", t("chron.empty")));
    for (const c of [...entries].reverse()) {
      const d = dateOfDay(c.day);
      const li = el("li", `chronique-${c.status}`);
      const e = cw.events.get(c.event);
      const title = c.status === "bascule" ? t("chron.branch_line") : t(e?.text_key ?? c.event);
      li.append(el("span", "journal-date", t("date.format", { year: d.year, day: d.day })), " ", el("strong", "", title));
      if (c.status !== "bascule") li.append(` — ${t(`chron.status.${c.status}`)}`);
      if (c.choice && e) li.append(` : ${t(`${e.text_key}.choice.${c.choice}`)}`);
      if (c.auto) li.append(` ${t("chron.auto")}`);
      if (c.divergence > 0) li.append(" ", valueEl(this.ctx, `+${formatNumber(c.divergence)}`, () => ({ title: t("chron.divergence"), sections: [{ text: t(c.status === "evite" ? "chron.avoided_why" : "chron.choice_why") }] }), "chronique-ecart"));
      list.append(li);
    }
    root.append(list);
  }
}
