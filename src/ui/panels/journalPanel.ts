import { t } from "../../i18n";
import { RESOURCE_IDS } from "../../sim/strategic/resources";
import { el, paramLabel } from "./common";
import type { Panel, PanelContext } from "./common";

/** Journal des alertes avec historique (F-UIX-04) : du plus récent au plus ancien, les alertes bloquantes marquées. */
export class JournalPanel implements Panel {
  readonly id = "journal" as const;

  constructor(private readonly ctx: PanelContext) {}

  render(root: HTMLElement): void {
    const log = this.ctx.state().strategic?.log ?? [];
    if (log.length === 0) {
      root.append(el("p", "registre-note", t("hud.no_alert")));
      return;
    }
    const list = el("ol", "journal-liste");
    list.reversed = true;
    for (const entry of [...log].reverse()) {
      const params: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(entry.params)) {
        if (typeof v !== "string") params[k] = v;
        else if (k === "resource" && (RESOURCE_IDS as readonly string[]).includes(v)) params[k] = t(`res.${v}`);
        else params[k] = paramLabel(this.ctx.world, v);
      }
      const li = el("li", entry.pause ? "journal-grave" : "");
      li.append(el("span", "journal-date", t("date.format", { year: entry.date.year, day: entry.date.day })), " ", t(entry.key, params));
      list.append(li);
    }
    root.append(list);
  }
}
