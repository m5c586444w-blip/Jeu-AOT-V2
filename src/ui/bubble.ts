import { isAuthorMode } from "./authorMode";
import type { Province } from "../data/schemas";
import type { GameState } from "../sim/core/state";
import { t } from "../i18n";

/** Bulle de survol (F-STR-03) : courte, textuelle ; les chiffres expliqués sont dans le dossier (clic). */
export class Bubble {
  private readonly el = document.createElement("div");

  constructor(parent: HTMLElement) {
    this.el.className = "bulle";
    this.el.hidden = true;
    this.el.setAttribute("role", "tooltip");
    parent.append(this.el);
  }

  show(p: Province, state: GameState, x: number, y: number): void {
    const ps = state.strategic?.provinces[p.id];
    this.el.replaceChildren();
    const name = document.createElement("strong");
    name.className = "bulle__nom";
    name.textContent = t(p.name_key);
    const meta = document.createElement("span");
    meta.className = "bulle__meta";
    meta.textContent = [t(`region.${p.region}`), ps ? t(`control.${ps.control}`) : null, isAuthorMode() ? t(`canon.${p.canon}`) : null].filter(Boolean).join(" · ");
    const hint = document.createElement("span");
    hint.className = "bulle__aide";
    hint.textContent = t("map.click_hint");
    this.el.append(name, meta, hint);
    this.el.hidden = false;
    const pad = 16;
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    this.el.style.left = `${Math.min(window.innerWidth - w - 8, x + pad)}px`;
    this.el.style.top = `${Math.min(window.innerHeight - h - 8, y + pad)}px`;
  }

  hide(): void {
    this.el.hidden = true;
  }
}
