import { authorOnly } from "./authorMode";
import { t } from "../i18n";
import type { Command } from "../sim/core/commands";
import type { GameState } from "../sim/core/state";
import { toAbsoluteDay } from "../sim/core/time";
import { choiceAvailable, daysLeft } from "../sim/events/engine";
import type { PendingEvent } from "../sim/events/engine";
import type { World } from "../sim/strategic/world";
import { archetypeOf, archetypeSvg } from "./eventArt";
import { effectLines, eventBody } from "./eventText";
import type { EffectLine } from "./eventText";
import { button, el } from "./panels/common";
import { formatNumber } from "./why";
import type { WhyTooltip } from "./why";

/**
 * Dossier d'événement (04 §5, F-EVT-04) : un document d'époque (rapport, lettre, télégramme, article, procès-verbal)
 * posé sur la carte ; chaque choix montre ses coûts calculés depuis ses effets ; le choix historique porte un tampon.
 * « Différer » referme le dossier : la décision reste due jusqu'à l'échéance.
 */
export class EventDossier {
  private readonly root = el("section", "dossier-evenement");
  /** Événements déjà présentés : un dossier différé ne se rouvre pas tout seul. */
  private readonly presented = new Set<string>();
  private current: string | null = null;

  constructor(
    parent: HTMLElement,
    private readonly world: World,
    private readonly why: WhyTooltip,
    private readonly dispatch: (cmd: Command) => Promise<void>,
    private readonly auto = true,
  ) {
    this.root.hidden = true;
    this.root.setAttribute("role", "dialog");
    parent.append(this.root);
  }

  get openId(): string | null {
    return this.current;
  }

  /** Après chaque rafraîchissement : ouvre le premier dossier en attente jamais présenté (sauf bataille en cours). */
  refresh(state: GameState): void {
    const pending = state.events?.pending ?? [];
    if (this.current && !pending.some((p) => p.id === this.current)) this.close();
    if (!this.auto || this.current || document.body.dataset["tactique"]) return;
    const next = pending.find((p) => !this.presented.has(`${p.id}@${p.day}`));
    if (next) this.open(state, next.id);
  }

  open(state: GameState, id: string): void {
    const p = state.events?.pending.find((x) => x.id === id);
    const e = this.world.chronicle?.events.get(id);
    if (!p || !e) return;
    this.presented.add(`${p.id}@${p.day}`);
    this.current = id;
    this.root.replaceChildren();
    this.root.dataset["event"] = id;
    this.root.dataset["form"] = e.form;
    const paper = el("article", `dossier-evenement__papier forme-${e.form}`);
    const head = el("header", "dossier-evenement__tete");
    head.append(el("span", "dossier-evenement__forme", t(`evt.form.${e.form}`)), el("span", "dossier-evenement__date", t("date.format", { year: state.date.year, day: state.date.day })));
    if (e.kind === "canon" && e.code) head.append(authorOnly(el("span", "tampon-mini tampon-mini--C", t("evt.canon_stamp", { code: e.code }))));
    const art = el("figure", `dossier-evenement__illustration dossier-evenement__illustration--${archetypeOf(e)}`);
    art.innerHTML = archetypeSvg(archetypeOf(e));
    art.setAttribute("role", "presentation");
    paper.append(head, art, el("h2", "dossier-evenement__titre", t(e.text_key)), el("p", "dossier-evenement__corps", eventBody(this.world, e, p.subject)));
    const happened = effectLines(this.world, e.effects, p.subject);
    if (happened.length > 0) {
      paper.append(el("h3", "dossier-evenement__intertitre", t("evt.consequences")));
      paper.append(this.lines(happened));
    }
    paper.append(el("h3", "dossier-evenement__intertitre", t("evt.decision", { n: daysLeft(p, state.date) })));
    const ctx = { world: this.world, date: state.date, st: state.strategic ?? (() => { throw new Error("état"); })(), pol: state.politics, ev: state.events ?? (() => { throw new Error("événements"); })(), intel: state.intel, rs: state.research };
    const weight = e.divergence_weight ?? 0;
    for (const c of e.choices.filter((x) => choiceAvailable(ctx, x))) {
      const box = el("div", "choix");
      box.dataset["choice"] = c.id;
      const label = t(`${e.text_key}.choice.${c.id}`);
      box.append(el("p", "choix__libelle", label));
      const lines = effectLines(this.world, c.effects, p.subject);
      // Clair d'abord : les trois effets principaux sous le libellé ; la liste complète, et ce qu'elle engage, dans l'infobulle.
      box.append(lines.length > 0 ? this.lines(lines.slice(0, INLINE_EFFECTS)) : el("p", "registre-note", t("evt.no_cost")));
      if (lines.length > INLINE_EFFECTS) box.append(el("p", "choix__suite", t("evt.more_effects", { n: lines.length - INLINE_EFFECTS })));
      this.why.bind(box, () => ({
        title: label,
        sections: [
          { label: t("evt.effects_all"), rows: lines.length > 0 ? lines.map(effectRow) : [{ label: t("evt.no_cost"), value: "·" }] },
          { text: e.kind === "canon" ? t(c.historical ? "evt.historical_why" : "evt.diverges_why") : t(daysLeft(p, state.date) > 0 ? "evt.free_choice_why" : "evt.free_choice_why_today", { n: daysLeft(p, state.date) }) },
        ],
      }));
      if (e.kind === "canon") {
        const stamp = c.historical ? el("span", "choix__tampon choix__tampon--histoire", t("evt.historical")) : el("span", "choix__tampon", t("evt.diverges", { d: formatNumber(weight * c.divergence) }));
        stamp.dataset["why"] = t(c.historical ? "evt.historical_why" : "evt.diverges_why");
        box.append(stamp);
      }
      const sign = button(t("evt.sign"), () => {
        // Fermer avant d'envoyer : le rafraîchissement qui suit la commande ouvre le dossier suivant, qui doit rester ouvert.
        this.close();
        void this.dispatch({ type: "ChooseEventOption", event: e.id, choice: c.id });
      }, "registre-bouton principal");
      sign.dataset["action"] = "signer";
      box.append(sign);
      paper.append(box);
    }
    const later = button(t("evt.later"), () => this.close(), "registre-bouton");
    later.dataset["action"] = "differer";
    paper.append(later);
    this.root.append(paper);
    this.root.hidden = false;
    this.why.hide();
  }

  close(): void {
    this.root.hidden = true;
    this.current = null;
  }

  private lines(lines: readonly { text: string; tone: string }[]): HTMLElement {
    const ul = el("ul", "effets");
    for (const l of lines) ul.append(el("li", `effet effet--${l.tone}`, l.text));
    return ul;
  }
}

/** Effets montrés sous le libellé d'un choix ; le reste est dans l'infobulle. */
const INLINE_EFFECTS = 3;

/** Ligne d'infobulle d'un effet : le texte, et un signe coloré (gain, coût ou neutre). */
function effectRow(l: EffectLine): { label: string; value: string; sign?: "plus" | "moins" } {
  return l.tone === "gain" ? { label: l.text, value: "+", sign: "plus" } : l.tone === "cout" ? { label: l.text, value: "−", sign: "moins" } : { label: l.text, value: "·" };
}

/** Jour d'échéance lisible pour la chronique. */
export function pendingLabel(p: PendingEvent, state: GameState): string {
  return t("evt.pending_line", { n: Math.max(0, p.deadline - toAbsoluteDay(state.date)) });
}
