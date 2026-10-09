import type { Character } from "../../data/schemas";
import { hasKey, t } from "../../i18n";
import type { Command } from "../../sim/core/commands";
import type { GameState } from "../../sim/core/state";
import type { BattleSetup, TimedOrder } from "../../sim/tactical/types";
import type { World } from "../../sim/strategic/world";
import type { WhyContent, WhyTooltip } from "../why";
import { authorOnly } from "../authorMode";

/** Contexte partagé par les registres (P2). */
export interface PanelContext {
  world: World;
  why: WhyTooltip;
  state(): GameState;
  dispatch(cmd: Command): Promise<void>;
  /** Ouvre un autre registre (ex. Décrets → Cabinet avec une motion). */
  open(panel: PanelId, arg?: string): void;
  confirm(message: string): Promise<boolean>;
  /** Ouvre l'écran de bataille (P4 ; temps réel R2+ si `realtime`) ; renvoie les ordres d'une bataille liée validée, sinon null. */
  playBattle(setup: BattleSetup, title: string, linked: boolean, realtime?: boolean): Promise<TimedOrder[] | null>;
  /** Rouvre le dossier d'un événement en attente (P5). */
  openEvent?(id: string): void;
}

export type PanelId = "personnages" | "cabinet" | "decrets" | "organisations" | "conseil" | "journal" | "expeditions" | "chronique" | "renseignement" | "recherche" | "porteurs" | "monde" | "diplomatie" | "gazette" | "archives" | "epilogue" | "economie" | "armees" | "missions";

export interface Panel {
  readonly id: PanelId;
  render(root: HTMLElement, arg?: string): void;
  /** Clic sur la carte pendant que le registre est ouvert ; true = consommé (pas de dossier de province). */
  mapClick?(province: string): boolean;
  /** Itinéraire en préparation à tracer sur la carte (planificateur d'expédition). */
  draftRoute?(): readonly string[] | null;
  /** Registre posé sur le côté pour laisser la carte visible (planificateur). */
  lateral?(): boolean;
}

/** Libellé d'un paramètre de message : clé i18n, identifiant de province, sinon la valeur telle quelle. */
export function paramLabel(world: World, v: string | number): string | number {
  if (typeof v !== "string") return v;
  const p = world.provinceById.get(v);
  if (p) return t(p.name_key);
  const c = world.politics?.characters.get(v);
  if (c) return displayName(c);
  return hasKey(v) ? t(v) : v;
}

export function provinceName(world: World, id: string): string {
  const p = world.provinceById.get(id);
  return p ? t(p.name_key) : id;
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

/** Statut canon d'une fiche : visible en mode auteur seulement (E-UX-1). */
export function stamp(canon: string): HTMLSpanElement {
  const s = el("span", `tampon-mini tampon-mini--${canon === "?" ? "incertain" : canon}`, t(`canon.stamp.${canon}`));
  s.dataset["why"] = t("dossier.canon_why", { status: t(`canon.${canon}`) });
  return authorOnly(s);
}

/** Message affiché quand le scénario n'a pas de couche politique. */
export function noPolitics(root: HTMLElement): void {
  root.append(el("p", "registre-ferme", t("panel.no_politics")));
}

/** Positions de lecture des listes « maître » par registre : conservées quand le registre est redessiné. */
const masterScroll = new Map<string, number>();

/**
 * Écran « liste + détail » (U5) : liste à gauche (`.maitre`), fiche à droite (`.detail`). `done()` pose l'écran dans
 * `root` et rend à la liste sa position de lecture.
 */
export function masterDetail(root: HTMLElement, key: string, cls = ""): { master: HTMLElement; detail: HTMLElement; done(): void } {
  const md = el("div", `maitre-detail ${cls}`.trim());
  const master = el("div", "maitre");
  const detail = el("div", "detail");
  // Signe de défilement (CUI-07) : un fondu en bas de la liste tant qu'il reste des lignes cachées dessous.
  const hint = (): void => {
    master.dataset["suite"] = master.scrollTop + master.clientHeight < master.scrollHeight - 2 ? "1" : "0";
  };
  master.addEventListener(
    "scroll",
    () => {
      masterScroll.set(key, master.scrollTop);
      hint();
    },
    { passive: true },
  );
  md.append(master, detail);
  return {
    master,
    detail,
    done(): void {
      root.append(md);
      master.scrollTop = masterScroll.get(key) ?? 0;
      requestAnimationFrame(hint);
    },
  };
}
