import { t } from "../i18n";
import { ACTIONS, keyLabel } from "./keymap";
import type { Action, KeyMap } from "./keymap";
import { UI_SCALES } from "./settings";
import type { Settings } from "./settings";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Dossier « Options » : langue, échelle, son, raccourcis (F-UIX-03, F-UIX-17, F-UIX-18). */
export class OptionsPanel {
  readonly el = el("aside", "options");
  private capturing: Action | null = null;

  constructor(
    parent: HTMLElement,
    private readonly keymap: KeyMap,
    private settings: Settings,
    private readonly onSettings: (s: Settings) => void,
  ) {
    this.el.hidden = true;
    this.el.setAttribute("aria-label", t("options.title"));
    parent.append(this.el);
    window.addEventListener(
      "keydown",
      (ev) => {
        if (!this.capturing) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (ev.code !== "Escape") this.keymap.rebind(this.capturing, ev.code);
        this.capturing = null;
        this.render();
      },
      { capture: true },
    );
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  toggle(): void {
    this.el.hidden = !this.el.hidden;
    if (!this.el.hidden) this.render();
  }

  private render(): void {
    this.el.replaceChildren();
    const head = el("header", "options__tete");
    head.append(el("h2", "options__titre", t("options.title")));
    const close = el("button", "dossier__fermer", "×");
    close.type = "button";
    close.setAttribute("aria-label", t("dossier.close"));
    close.addEventListener("click", () => this.toggle());
    head.append(close);

    const lang = el("label", "options__ligne");
    lang.append(el("span", "", t("options.language")));
    const sel = el("select", "options__choix");
    for (const [v, label] of [["fr", "Français"], ["en", "English"]] as const) {
      const o = el("option", "", label);
      o.value = v;
      o.selected = this.settings.locale === v;
      sel.append(o);
    }
    sel.dataset["setting"] = "locale";
    sel.addEventListener("change", () => this.change({ ...this.settings, locale: sel.value === "en" ? "en" : "fr" }));
    lang.append(sel);

    const scale = el("label", "options__ligne");
    scale.append(el("span", "", t("options.scale")));
    const sc = el("select", "options__choix");
    for (const v of UI_SCALES) {
      const o = el("option", "", `${v} %`);
      o.value = String(v);
      o.selected = this.settings.uiScale === v;
      sc.append(o);
    }
    sc.dataset["setting"] = "uiScale";
    sc.addEventListener("change", () => this.change({ ...this.settings, uiScale: Number(sc.value) }));
    scale.append(sc);

    // Son (04 §7) : volumes maître, musique, effets ; sous-titres des sons importants.
    const sound = el("fieldset", "options__son");
    sound.append(el("legend", "", t("options.sound")));
    for (const k of ["volMaster", "volMusic", "volSfx"] as const) {
      const row = el("label", "options__ligne");
      row.append(el("span", "", t(`options.${k}`)));
      const r = el("input", "options__curseur");
      r.type = "range";
      r.min = "0";
      r.max = "100";
      r.step = "5";
      r.value = String(this.settings[k]);
      r.dataset["setting"] = k;
      const out = el("output", "options__valeur", `${this.settings[k]} %`);
      r.addEventListener("input", () => {
        out.textContent = `${r.value} %`;
        this.change({ ...this.settings, [k]: Number(r.value) });
      });
      row.append(r, out);
      sound.append(row);
    }
    const sub = el("label", "options__ligne");
    const cb = el("input", "options__case");
    cb.type = "checkbox";
    cb.checked = this.settings.subtitles;
    cb.dataset["setting"] = "subtitles";
    cb.addEventListener("change", () => this.change({ ...this.settings, subtitles: cb.checked }));
    sub.append(el("span", "", t("options.subtitles")), cb);
    sound.append(sub);

    const keys = el("table", "options__touches");
    const caption = el("caption", "", t("options.keys"));
    keys.append(caption);
    for (const a of ACTIONS) {
      const tr = el("tr", "");
      const b = el("button", "options__touche", this.capturing === a ? t("options.press_key") : keyLabel(this.keymap.codeOf(a)));
      b.type = "button";
      b.dataset["action"] = a;
      b.addEventListener("click", () => {
        this.capturing = a;
        this.render();
      });
      const td = el("td", "");
      td.append(b);
      tr.append(el("td", "", t(`action.${a}`)), td);
      keys.append(tr);
    }
    const reset = el("button", "options__remise", t("options.reset_keys"));
    reset.type = "button";
    reset.addEventListener("click", () => {
      this.keymap.reset();
      this.render();
    });
    this.el.append(head, lang, scale, sound, keys, reset);
  }

  private change(s: Settings): void {
    this.settings = s;
    this.onSettings(s);
  }
}
