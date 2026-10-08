import { t } from "../../i18n";
import { RESOURCE_IDS } from "../../sim/strategic/resources";
import { alertIcon, icon } from "../icons";
import { button, el, paramLabel } from "./common";
import type { Panel, PanelContext } from "./common";

/**
 * Journal des alertes avec historique (F-UIX-04, U9) : du plus récent au plus ancien, groupé par jour ; icône par
 * famille d'alerte ; les alertes bloquantes marquées ; filtre « graves seulement ».
 */
export class JournalPanel implements Panel {
  readonly id = "journal" as const;
  private filter: "tout" | "graves" = "tout";

  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement): void {
    const log = this.ctx.state().strategic?.log ?? [];
    if (log.length === 0) {
      root.append(el("p", "registre-note", t("hud.no_alert")));
      return;
    }
    const bar = el("div", "registre-filtres");
    for (const f of ["tout", "graves"] as const) {
      const b = button(t(`journal.filter.${f}`), () => {
        this.filter = f;
        this.ctx.open("journal");
      }, "registre-onglet");
      b.setAttribute("aria-pressed", String(this.filter === f));
      bar.append(b);
    }
    root.append(bar);
    const shown = [...log].reverse().filter((e) => this.filter === "tout" || e.pause);
    if (shown.length === 0) root.append(el("p", "registre-note", t("journal.none_grave")));
    let day = "";
    let list: HTMLOListElement | null = null;
    for (const entry of shown) {
      const date = t("date.format", { year: entry.date.year, day: entry.date.day });
      if (date !== day || !list) {
        day = date;
        root.append(el("h4", "journal-jour", date));
        list = el("ol", "journal-liste");
        root.append(list);
      }
      const params: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(entry.params)) {
        if (typeof v !== "string") params[k] = v;
        else if (k === "resource" && (RESOURCE_IDS as readonly string[]).includes(v)) params[k] = t(`res.${v}`);
        else params[k] = paramLabel(this.ctx.world, v);
      }
      const li = el("li", entry.pause ? "journal-grave" : "");
      const ic = el("span", "journal-icone");
      ic.innerHTML = icon(alertIcon(entry.key));
      li.append(ic, el("span", "journal-texte", t(entry.key, params)));
      list.append(li);
    }
  }
}
