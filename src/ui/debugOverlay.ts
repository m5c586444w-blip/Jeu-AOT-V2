import { t } from "../i18n";
import { runConsoleLine } from "./debugConsole";
import type { ConsoleHost } from "./debugConsole";

/** Surcouche « machine à écrire » ouverte et fermée par F2 (fichier 14, T0.11). */
export function mountDebugOverlay(root: HTMLElement, host: ConsoleHost, onChange: () => void): { toggle(): void; isOpen(): boolean } {
  const panel = document.createElement("section");
  panel.className = "debug-console";
  panel.hidden = true;
  panel.setAttribute("aria-label", t("console.title"));

  const heading = document.createElement("h2");
  heading.className = "debug-console__title";
  heading.textContent = t("console.title");

  const log = document.createElement("pre");
  log.className = "debug-console__log";
  log.setAttribute("aria-live", "polite");

  const form = document.createElement("form");
  form.className = "debug-console__form";
  const prompt = document.createElement("span");
  prompt.className = "debug-console__prompt";
  prompt.textContent = "›";
  const input = document.createElement("input");
  input.className = "debug-console__input";
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = t("console.prompt");
  input.setAttribute("aria-label", t("console.prompt"));
  form.append(prompt, input);
  panel.append(heading, log, form);
  root.append(panel);

  const history: string[] = [];
  let cursor = 0;

  const print = (line: string, kind: "in" | "out" | "err"): void => {
    const row = document.createElement("span");
    row.className = `debug-console__line debug-console__line--${kind}`;
    row.textContent = line;
    log.append(row, "\n");
    log.scrollTop = log.scrollHeight;
  };

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const line = input.value;
    input.value = "";
    if (line.trim() === "") return;
    history.push(line);
    cursor = history.length;
    print(`› ${line}`, "in");
    void runConsoleLine(host, line).then((r) => {
      if (r.text) print(r.text, r.ok ? "out" : "err");
      onChange();
    });
  });

  input.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowUp" && cursor > 0) input.value = history[--cursor] ?? "";
    if (ev.key === "ArrowDown") {
      cursor = Math.min(cursor + 1, history.length);
      input.value = history[cursor] ?? "";
    }
  });

  const toggle = (): void => {
    panel.hidden = !panel.hidden;
    // Mode debug (F2) : les chaînes de développement du bandeau (graine, empreinte d'état) ne s'affichent qu'ici (R0.2b).
    document.documentElement.dataset["debug"] = String(!panel.hidden);
    if (!panel.hidden) input.focus();
    else input.blur();
  };

  return { toggle, isOpen: () => !panel.hidden };
}
