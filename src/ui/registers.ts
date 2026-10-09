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
import { ArmiesPanel } from "./panels/armiesPanel";
import { ExpeditionsPanel } from "./panels/expeditionsPanel";
import { JournalPanel } from "./panels/journalPanel";
import { LawsPanel } from "./panels/lawsPanel";
import { OrgsPanel } from "./panels/orgsPanel";
import { ChroniclePanel } from "./panels/chroniclePanel";
import { IntelPanel } from "./panels/intelPanel";
import { MissionsPanel } from "./panels/missionsPanel";
import { ResearchPanel } from "./panels/researchPanel";
import { ShiftersPanel } from "./panels/shiftersPanel";
import { WorldPanel } from "./panels/worldPanel";
import { DiplomacyPanel } from "./panels/diplomacyPanel";
import { EconomyPanel } from "./panels/economyPanel";
import { registerIcon } from "./icons";
import { ArchivesPanel, EpiloguePanel, GazettePanel } from "./panels/storyPanels";
import { hint } from "./why";
import type { WhyTooltip } from "./why";

export const PANEL_IDS: readonly PanelId[] = ["personnages", "cabinet", "decrets", "organisations", "conseil", "journal", "expeditions", "chronique", "renseignement", "recherche", "porteurs", "monde", "diplomatie", "gazette", "archives", "epilogue", "economie", "armees", "missions"];

/**
 * Registres de P2 : un seul dossier ouvert à la fois au-dessus de la carte, rafraîchi quand l'état change
 * (la position de lecture est conservée). Les décisions engagées passent par un bordereau de confirmation.
 */
export class Registers {
  private readonly frame = el("section", "registre-panneau");
  private readonly title = el("h2", "registre-titre");
  private readonly headIcon = el("span", "registre-icone");
  private readonly shortcut = el("span", "registre-touche");
  private closeButton: HTMLButtonElement | null = null;
  /** Libellé de la touche d'un registre (U10), fourni par l'écran de jeu. */
  keyOf: ((id: string) => string) | null = null;
  /** Appelé à l'ouverture et à la fermeture (bouton enfoncé du menu de gestion, dossier de province refermé). */
  onChange: ((id: PanelId | null) => void) | null = null;
  private readonly body = el("div", "registre-corps");
  private readonly panels: Map<PanelId, Panel>;
  private current: { id: PanelId; arg?: string } | null = null;
  /** Appelé quand l'itinéraire en préparation change (la carte le retrace). */
  onDraft: (() => void) | null = null;
  private readonly dialog = el("div", "bordereau");
  /** Registre des armées (PA.8) : la carte lui passe les clics sur les étendards. */
  armies: ArmiesPanel | null = null;

  private readonly stateOf: () => GameState;

  constructor(parent: HTMLElement, world: World, why: WhyTooltip, state: () => GameState, dispatch: (cmd: Command) => Promise<void>, playBattle: (setup: BattleSetup, title: string, linked: boolean, realtime?: boolean) => Promise<TimedOrder[] | null>, openEvent?: (id: string) => void) {
    this.stateOf = state;
    this.frame.hidden = true;
    this.frame.setAttribute("role", "dialog");
    const close = button("×", () => this.close(), "dossier__fermer");
    close.setAttribute("aria-label", t("dossier.close"));
    this.closeButton = close;
    const head = el("header", "registre-tete");
    this.headIcon.setAttribute("aria-hidden", "true");
    head.append(this.headIcon, this.title, this.shortcut, close);
    this.frame.append(head, this.body);
    this.dialog.hidden = true;
    this.dialog.setAttribute("role", "alertdialog");
    parent.append(this.frame, this.dialog);
    const ctx: PanelContext = { world, why, state, dispatch, open: (id, arg) => this.open(id, arg), confirm: (m) => this.confirm(m), playBattle, ...(openEvent ? { openEvent } : {}) };
    const list: Panel[] = [new CharactersPanel(ctx), new CabinetPanel(ctx), new LawsPanel(ctx), new OrgsPanel(ctx), new CouncilPanel(ctx), new JournalPanel(ctx), new EconomyPanel(ctx)];
    if (world.military)
      list.push(
        new ExpeditionsPanel(ctx, () => {
          this.draw(true);
          this.onDraft?.();
        }),
      );
    if (world.armies) {
      this.armies = new ArmiesPanel(ctx, () => {
        this.draw(true);
        this.onDraft?.();
      });
      list.push(this.armies);
    }
    if (world.chronicle) list.push(new ChroniclePanel(ctx));
    if (world.intel) list.push(new IntelPanel(ctx));
    if (world.research) list.push(new ResearchPanel(ctx));
    if (world.missions) list.push(new MissionsPanel(ctx));
    if (world.shifters) list.push(new ShiftersPanel(ctx));
    if (world.nations) list.push(new WorldPanel(ctx), new DiplomacyPanel(ctx));
    list.push(new GazettePanel(ctx), new ArchivesPanel(ctx), new EpiloguePanel(ctx));
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
    this.headIcon.innerHTML = registerIcon(id);
    const key = this.keyOf?.(id) ?? "";
    // Touche du registre en tête (U10), dessinée comme une touche de clavier ; son rôle dans l'infobulle.
    this.shortcut.replaceChildren();
    if (key) {
      this.shortcut.append(el("kbd", "touche", key));
      hint(this.shortcut, t("register.key", { key }));
    }
    if (this.closeButton) hint(this.closeButton, t("dossier.close"), this.keyOf?.("close") ?? "");
    this.draw(sameView);
    this.onDraft?.();
    this.onChange?.(id);
  }

  toggle(id: PanelId): void {
    if (this.current?.id === id && !this.frame.hidden) this.close();
    else this.open(id);
  }

  close(): void {
    this.frame.hidden = true;
    this.current = null;
    this.onDraft?.();
    this.onChange?.(null);
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
    // Esthétique du bloc (04 §1.1) : les registres du monde prennent celle de la nation jouée.
    const world = this.current.id === "monde" || this.current.id === "diplomatie";
    this.frame.dataset["bloc"] = world && this.stateOf().nations?.player === "fac_marley" ? "marley" : "paradis";
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
