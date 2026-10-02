import { t } from "../i18n";
import { stateHash } from "../sim/core/canonical";
import type { GameState } from "../sim/core/state";

export interface StartPage {
  update(state: GameState): void;
}

function cell(row: HTMLTableRowElement, label: string, field: string): void {
  const th = document.createElement("th");
  th.scope = "row";
  th.textContent = label;
  const td = document.createElement("td");
  td.dataset["field"] = field;
  row.append(th, td);
}

/** Page de démarrage de P0 : un registre papier (titre, version, graine, date, empreinte d'état). */
export function mountStartPage(root: HTMLElement): StartPage {
  const sheet = document.createElement("main");
  sheet.className = "registre";

  const stamp = document.createElement("p");
  stamp.className = "tampon";
  stamp.textContent = t("app.stamp");

  const header = document.createElement("header");
  header.className = "registre__entete";
  const h1 = document.createElement("h1");
  h1.className = "registre__titre";
  h1.textContent = t("app.title");
  const sub = document.createElement("p");
  sub.className = "registre__sous-titre";
  sub.textContent = t("app.subtitle");
  header.append(h1, sub);

  const table = document.createElement("table");
  table.className = "registre__table";
  const rows: [string, string][] = [
    [t("app.version_label"), "version"],
    [t("app.seed"), "seed"],
    [t("app.date"), "date"],
    [t("app.hash"), "hash"],
  ];
  for (const [label, field] of rows) cell(table.insertRow(), label, field);

  const footer = document.createElement("footer");
  footer.className = "registre__pied";
  const hint = document.createElement("p");
  hint.className = "registre__note";
  const key = document.createElement("span");
  key.className = "touche";
  key.textContent = "F2";
  hint.append(key, t("app.console_hint"));
  const notice = document.createElement("p");
  notice.className = "registre__note";
  notice.textContent = t("app.notice");
  footer.append(hint, notice);

  sheet.append(stamp, header, table, footer);
  root.append(sheet);

  const field = (name: string): HTMLElement => table.querySelector(`[data-field="${name}"]`) as HTMLElement;
  field("version").textContent = t("app.version", { version: __APP_VERSION__ });

  return {
    update(state) {
      field("seed").textContent = String(state.seed);
      field("date").textContent = t("date.format", { year: state.date.year, day: state.date.day });
      field("hash").textContent = stateHash(state);
    },
  };
}
