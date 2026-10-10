import { t } from "../i18n";
import { keyLabel, PANEL_ACTION } from "./keymap";
import type { KeyMap } from "./keymap";

/**
 * Manuel en jeu (P10.4 ; 18 §10) : les mécanismes du jeu expliqués en sections courtes, avec les raccourcis du moment (ils
 * suivent les touches reconfigurées dans les options). Ouvert par F1 en partie et par l'entrée « Manuel » du menu principal.
 * Le texte est dans les dictionnaires (`manual.*`) ; l'interface ne lit ni n'écrit l'état de la partie.
 */
export const MANUAL_SECTIONS = [
  "but", "temps", "carte", "registres", "economie", "politique", "armee", "expeditions", "evenements", "monde", "fins", "difficulte", "accessibilite", "sauvegarde",
] as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export class ManualPanel {
  readonly el = el("aside", "options manuel");
  private section: (typeof MANUAL_SECTIONS)[number] = "but";

  constructor(
    parent: HTMLElement,
    private readonly keymap: KeyMap,
  ) {
    this.el.hidden = true;
    this.el.setAttribute("aria-label", t("manual.title"));
    this.el.setAttribute("role", "dialog");
    parent.append(this.el);
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  toggle(): void {
    this.el.hidden = !this.el.hidden;
    if (!this.el.hidden) {
      this.render();
      this.el.querySelector<HTMLButtonElement>(".manuel__onglet[aria-current='true']")?.focus();
    }
  }

  private render(): void {
    this.el.replaceChildren();
    const head = el("header", "options__tete");
    head.append(el("h2", "options__titre", t("manual.title")));
    const close = el("button", "dossier__fermer", "×");
    close.type = "button";
    close.setAttribute("aria-label", t("dossier.close"));
    close.addEventListener("click", () => this.toggle());
    head.append(close);

    const nav = el("nav", "manuel__sommaire");
    nav.setAttribute("aria-label", t("manual.contents"));
    for (const id of MANUAL_SECTIONS) {
      const b = el("button", "manuel__onglet", t(`manual.${id}.title`));
      b.type = "button";
      b.dataset["section"] = id;
      b.setAttribute("aria-current", String(id === this.section));
      b.addEventListener("click", () => {
        this.section = id;
        this.render();
        this.el.querySelector<HTMLButtonElement>(`.manuel__onglet[data-section="${id}"]`)?.focus();
      });
      nav.append(b);
    }

    const body = el("article", "manuel__texte");
    body.dataset["section"] = this.section;
    body.append(el("h3", "manuel__titre", t(`manual.${this.section}.title`)));
    for (const para of t(`manual.${this.section}.body`).split("\n")) body.append(el("p", "", para));
    if (this.section === "registres") body.append(this.registerKeys());
    if (this.section === "temps" || this.section === "carte") body.append(el("p", "manuel__touches", this.keysLine(this.section)));
    this.el.append(head, nav, body);
  }

  /** Touches du temps ou de la carte, telles qu'elles sont réglées. */
  private keysLine(section: "temps" | "carte"): string {
    const k = (a: Parameters<KeyMap["codeOf"]>[0]): string => keyLabel(this.keymap.codeOf(a));
    return section === "temps"
      ? t("manual.temps.keys", { pause: k("pause"), slow: k("speed_1"), fast: k("speed_5") })
      : t("manual.carte.keys", { zin: k("zoom_in"), zout: k("zoom_out"), world: k("lod_monde"), region: k("lod_region"), province: k("lod_province"), fit: k("fit"), layer: k("overlay_next"), off: k("overlay_off") });
  }

  /** Registres et leur touche (une ligne par registre). */
  private registerKeys(): HTMLTableElement {
    const table = el("table", "options__touches");
    table.append(el("caption", "", t("manual.registres.table")));
    for (const [panel, action] of Object.entries(PANEL_ACTION)) {
      const tr = el("tr", "");
      tr.append(el("td", "", t(`panel.${panel}`)), el("td", "", keyLabel(this.keymap.codeOf(action))));
      table.append(tr);
    }
    return table;
  }
}
