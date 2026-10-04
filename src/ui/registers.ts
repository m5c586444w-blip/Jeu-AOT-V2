import { t } from "../i18n";
import type { Command } from "../sim/core/commands";
import type { GameState } from "../sim/core/state";
import type { BattleSetup, TimedOrder } from "../sim/tactical/types";
import type { World } from "../sim/strategic/world";
import { CabinetPanel } from "./panels/cabinetPanel";
import { CharactersPanel } from "./panels/charactersPanel";
import { button, el } from "./panels/common";
import type { Panel, PanelContext, PanelId } from "./panels/common";
import { CouncilPanel } from "./panels/councilPanel";
import { ExpeditionsPanel } from "./panels/expeditionsPanel";
import { JournalPanel } from "./panels/journalPanel";
import { LawsPanel } from "./panels/lawsPanel";
import { OrgsPanel } from "./panels/orgsPanel";
import { ChroniclePanel } from "./panels/chroniclePanel";
import { IntelPanel } from "./panels/intelPanel";
import { ResearchPanel } from "./panels/researchPanel";
import { ShiftersPanel } from "./panels/shiftersPanel";
import { WorldPanel } from "./panels/worldPanel";
import { DiplomacyPanel } from "./panels/diplomacyPanel";
import type { WhyTooltip } from "./why";

export const PANEL_IDS: readonly PanelId[] = ["personnages", "cabinet", "decrets", "organisations", "conseil", "journal", "expeditions", "chronique", "renseignement", "recherche", "porteurs", "monde", "diplomatie"];

/**
 * Registres de P2 : un seul dossier ouvert à la fois au-dessus de la carte, rafraîchi quand l'état change
 * (la position de lecture est conservée). Les décisions engagées passent par un bordereau de confirmation.
 */
export class Registers {
  private readonly frame = el("section", "registre-panneau");
  private readonly title = el("h2", "registre-titre");
  private readonly body = el("div", "registre-corps");
  private readonly panels: Map<PanelId, Panel>;
  private current: { id: PanelId; arg?: string } | null = null;
  /** Appelé quand l'itinéraire en préparation change (la carte le retrace). */
  onDraft: (() => void) | null = null;
  private readonly dialog = el("div", "bordereau");

  constructor(parent: HTMLElement, world: World, why: WhyTooltip, state: () => GameState, dispatch: (cmd: Command) => Promise<void>, playBattle: (setup: BattleSetup, title: string, linked: boolean) => Promise<TimedOrder[] | null>, openEvent?: (id: string) => void) {
    this.frame.hidden = true;
    this.frame.setAttribute("role", "dialog");
    const close = button("×", () => this.close(), "dossier__fermer");
    close.setAttribute("aria-label", t("dossier.close"));
    const head = el("header", "registre-tete");
    head.append(this.title, close);
    this.frame.append(head, this.body);
    this.dialog.hidden = true;
    this.dialog.setAttribute("role", "alertdialog");
    parent.append(this.frame, this.dialog);
    const ctx: PanelContext = { world, why, state, dispatch, open: (id, arg) => this.open(id, arg), confirm: (m) => this.confirm(m), playBattle, ...(openEvent ? { openEvent } : {}) };
    const list: Panel[] = [new CharactersPanel(ctx), new CabinetPanel(ctx), new LawsPanel(ctx), new OrgsPanel(ctx), new CouncilPanel(ctx), new JournalPanel(ctx)];
    if (world.military)
      list.push(
        new ExpeditionsPanel(ctx, () => {
          this.draw(true);
          this.onDraft?.();
        }),
      );
    if (world.chronicle) list.push(new ChroniclePanel(ctx));
    if (world.intel) list.push(new IntelPanel(ctx));
    if (world.research) list.push(new ResearchPanel(ctx));
    if (world.shifters) list.push(new ShiftersPanel(ctx));
    if (world.nations) list.push(new WorldPanel(ctx), new DiplomacyPanel(ctx));
    this.panels = new Map(list.map((p) => [p.id, p]));
  }

  get openId(): PanelId | null {
    return this.current?.id ?? null;
  }

  open(id: PanelId, arg?: string): void {
    const sameView = this.current?.id === id && this.current.arg === arg;
    this.current = arg === undefined ? { id } : { id, arg };
    this.frame.hidden = false;
    this.frame.dataset["panel"] = id;
    this.title.textContent = t(`panel.${id}`);
    this.draw(sameView);
    this.onDraft?.();
  }

  toggle(id: PanelId): void {
    if (this.current?.id === id && !this.frame.hidden) this.close();
    else this.open(id);
  }

  close(): void {
    this.frame.hidden = true;
    this.current = null;
    this.onDraft?.();
  }

  private get panel(): Panel | null {
    return this.current && !this.frame.hidden ? (this.panels.get(this.current.id) ?? null) : null;
  }

  /** Clic sur la carte : le registre ouvert peut le consommer (planificateur). */
  mapClick(province: string): boolean {
    return this.panel?.mapClick?.(province) ?? false;
  }

  /** Itinéraire en préparation dans le registre ouvert. */
  draftRoute(): readonly string[] | null {
    return this.panel?.draftRoute?.() ?? null;
  }

  /** Redessine le registre ouvert (après une commande ou un jour qui passe), en gardant la position de lecture. */
  refresh(): void {
    if (this.current && !this.frame.hidden && this.dialog.hidden) this.draw(true);
  }

  private draw(keepScroll: boolean): void {
    if (!this.current) return;
    const scroll = keepScroll ? this.body.scrollTop : 0;
    this.body.replaceChildren();
    const panel = this.panels.get(this.current.id);
    panel?.render(this.body, this.current.arg);
    this.frame.classList.toggle("registre-panneau--lateral", panel?.lateral?.() ?? false);
    this.body.scrollTop = scroll;
  }

  /** Bordereau de confirmation (F-UIX-13) : « Signer » engage, « Annuler » ne change rien (F-UIX-12). */
  confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.dialog.replaceChildren();
      const text = el("p", "bordereau-texte", message);
      const done = (v: boolean): void => {
        this.dialog.hidden = true;
        resolve(v);
      };
      const yes = button(t("confirm.sign"), () => done(true), "registre-bouton principal");
      const no = button(t("confirm.cancel"), () => done(false));
      yes.dataset["confirm"] = "oui";
      no.dataset["confirm"] = "non";
      this.dialog.append(el("h3", "bordereau-titre", t("confirm.title")), text, yes, no);
      this.dialog.hidden = false;
      yes.focus();
    });
  }
}
