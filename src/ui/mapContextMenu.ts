import { t } from "../i18n";
import { el } from "./panels/common";

/**
 * Menu contextuel de la carte stratégique (04 §3 : « clic droit = menu contextuel sobre » ; écart E-05 de l'audit P10).
 * Au clic droit sur une province : ouvrir son dossier, centrer la vue, ouvrir la fiche d'une armée du joueur qui s'y trouve,
 * préparer une expédition. Le modèle (`mapContextItems`) ne touche pas au DOM ; `MapContextMenu` l'affiche au curseur.
 */
export type MapContextAction = "dossier" | "centrer" | "armee" | "expedition";

export interface MapContextItem {
  action: MapContextAction;
  label: string;
  run(): void;
}

export interface MapContextDeps {
  openDossier(province: string): void;
  center(province: string): void;
  /** Armées du joueur dans la province (nom affiché). */
  playerArmies(province: string): readonly { id: string; name: string }[];
  /** Fiche d'une armée (registre des armées) ; absent sans registre des armées. */
  openArmy?: (army: string) => void;
  /** Registre des expéditions ; absent sans ce registre (bac à sable économique). */
  openExpeditions?: () => void;
}

/** Entrées du menu pour une province (trois armées au plus, dans l'ordre de l'état). */
export function mapContextItems(province: string, d: MapContextDeps): MapContextItem[] {
  const items: MapContextItem[] = [
    { action: "dossier", label: t("map.ctx.dossier"), run: () => d.openDossier(province) },
    { action: "centrer", label: t("map.ctx.centrer"), run: () => d.center(province) },
  ];
  const openArmy = d.openArmy;
  if (openArmy) for (const a of d.playerArmies(province).slice(0, 3)) items.push({ action: "armee", label: t("map.ctx.armee", { army: a.name }), run: () => openArmy(a.id) });
  const openExp = d.openExpeditions;
  if (openExp) items.push({ action: "expedition", label: t("map.ctx.expedition"), run: () => openExp() });
  return items;
}

/** Affichage du menu au curseur (dans la fenêtre) ; fermé par Échap, un clic ailleurs, la molette ou un choix. */
export class MapContextMenu {
  private readonly root = el("div", "menu-carte");
  private readonly title = el("p", "menu-carte__titre");
  private readonly list = el("div", "menu-carte__liste");

  constructor(parent: HTMLElement) {
    this.root.setAttribute("role", "menu");
    this.root.hidden = true;
    this.root.append(this.title, this.list);
    parent.append(this.root);
    const away = (ev: Event): void => {
      if (!this.root.hidden && !this.root.contains(ev.target as Node)) this.hide();
    };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("wheel", away, true);
    document.addEventListener(
      "keydown",
      (ev) => {
        if (this.root.hidden || ev.key !== "Escape") return;
        ev.stopPropagation();
        ev.preventDefault();
        this.hide();
      },
      true,
    );
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  show(heading: string, items: readonly MapContextItem[], x: number, y: number): void {
    this.title.textContent = heading;
    this.root.setAttribute("aria-label", t("map.ctx.label", { province: heading }));
    this.list.replaceChildren(
      ...items.map((it) => {
        const b = el("button", "menu-carte__choix", it.label);
        b.type = "button";
        b.setAttribute("role", "menuitem");
        b.dataset["ctx"] = it.action;
        b.addEventListener("click", () => {
          this.hide();
          it.run();
        });
        return b;
      }),
    );
    this.root.hidden = false;
    // Dans la fenêtre : le menu se retourne vers la gauche ou le haut s'il déborderait.
    const r = this.root.getBoundingClientRect();
    const left = x + r.width > window.innerWidth - 4 ? Math.max(4, x - r.width) : x;
    const top = y + r.height > window.innerHeight - 4 ? Math.max(4, y - r.height) : y;
    this.root.style.left = `${left}px`;
    this.root.style.top = `${top}px`;
    this.list.querySelector<HTMLButtonElement>("button")?.focus();
  }

  hide(): void {
    this.root.hidden = true;
  }
}
