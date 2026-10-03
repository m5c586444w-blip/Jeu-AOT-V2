import type { Character } from "../../data/schemas";
import { t } from "../../i18n";
import type { Command } from "../../sim/core/commands";
import type { GameState } from "../../sim/core/state";
import type { World } from "../../sim/strategic/world";
import type { WhyContent, WhyTooltip } from "../why";

/** Contexte partagé par les registres (P2). */
export interface PanelContext {
  world: World;
  why: WhyTooltip;
  state(): GameState;
  dispatch(cmd: Command): Promise<void>;
  /** Ouvre un autre registre (ex. Décrets → Cabinet avec une motion). */
  open(panel: PanelId, arg?: string): void;
  confirm(message: string): Promise<boolean>;
}

export type PanelId = "personnages" | "cabinet" | "decrets" | "organisations" | "conseil" | "journal";

export interface Panel {
  readonly id: PanelId;
  render(root: HTMLElement, arg?: string): void;
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Valeur chiffrée avec sa fiche « pourquoi ? » (toute valeur affichée est expliquée). */
export function valueEl(ctx: PanelContext, text: string, why: () => WhyContent, cls = ""): HTMLSpanElement {
  const v = el("span", `valeur ${cls}`.trim(), text);
  ctx.why.bind(v, why);
  return v;
}

export function button(label: string, onClick: () => void, cls = "registre-bouton"): HTMLButtonElement {
  const b = el("button", cls, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

/** Nom affiché d'un personnage : identité de couverture si elle existe (les secrets ne sont jamais affichés en P2). */
export function displayName(c: Character | undefined): string {
  return c ? (c.display_name ?? c.name) : "—";
}

export function stamp(canon: string): HTMLSpanElement {
  const s = el("span", `tampon-mini tampon-mini--${canon === "?" ? "incertain" : canon}`, t(`canon.stamp.${canon}`));
  s.dataset["why"] = t("dossier.canon_why", { status: t(`canon.${canon}`) });
  return s;
}

/** Message affiché quand le scénario n'a pas de couche politique. */
export function noPolitics(root: HTMLElement): void {
  root.append(el("p", "registre-ferme", t("panel.no_politics")));
}
