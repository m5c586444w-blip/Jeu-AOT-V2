import { t } from "../../i18n";
import { placeBubble } from "./placement";
import type { Box } from "./placement";
import { canContinue, enter, isFinished, next, resolveAnchor, settle, TUTORIAL_STEPS } from "./steps";
import type { TutorialCursor, TutorialFacts, TutorialStep } from "./steps";

/** Ce que l'écran de jeu fournit au tutoriel. */
export interface TutorialHost {
  /** Registre ouvert, ou null. */
  panel(): string | null;
  /** Jour absolu de la partie. */
  day(): number;
  /** Referme le registre ouvert. */
  closePanel(): void;
  /** Met le temps en pause. */
  pause(): void;
  /** Libellé de la touche d'un registre ou d'une action. */
  keyOf(id: string): string;
  /** Fin du tutoriel : terminé jusqu'au bout, ou quitté à la demande. */
  finish(how: "done" | "quit"): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const PERIOD_MS = 120;

/**
 * Tutoriel guidé (TUT.1) : une bulle ancrée à l'élément à utiliser, une mise en évidence de cet élément, et une condition
 * de passage par étape. Le temps de jeu est suspendu au départ ; rien n'est écrit dans l'état de partie.
 */
export class Tutorial {
  private readonly bubble = el("aside", "tuto");
  private readonly halo = el("div", "tuto-halo");
  private cursor: TutorialCursor = enter(0);
  private timer: number | null = null;
  private startDay = 0;
  private moved = false;
  private shownKey = "";
  private mapEl: Element | null = null;
  private readonly onMove = (ev: Event): void => {
    if (ev.type === "wheel" || (ev as PointerEvent).buttons > 0) this.moved = true;
  };

  /** Étape et phase affichées : lues par les contrôles automatiques. */
  get state(): { id: string; phase: string; finished: boolean } {
    return { id: TUTORIAL_STEPS[this.cursor.index]?.id ?? "fin", phase: this.cursor.phase, finished: isFinished(this.cursor) };
  }

  get running(): boolean {
    return this.timer !== null;
  }

  constructor(private readonly parent: HTMLElement, private readonly host: TutorialHost) {
    this.bubble.setAttribute("role", "dialog");
    this.bubble.setAttribute("aria-label", t("tuto.title"));
    this.bubble.hidden = true;
    this.halo.hidden = true;
    this.halo.setAttribute("aria-hidden", "true");
    parent.append(this.halo, this.bubble);
  }

  start(): void {
    if (this.timer !== null) return;
    this.cursor = enter(0);
    this.startDay = this.host.day();
    this.moved = false;
    this.shownKey = "";
    this.mapEl = document.querySelector(".carte");
    this.mapEl?.addEventListener("wheel", this.onMove, { passive: true });
    this.mapEl?.addEventListener("pointermove", this.onMove, { passive: true });
    this.host.pause();
    this.timer = window.setInterval(() => this.update(), PERIOD_MS);
    this.update();
  }

  /** Arrête le tutoriel (fin ou départ à la demande) et retire la bulle. */
  stop(how: "done" | "quit"): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.mapEl?.removeEventListener("wheel", this.onMove);
    this.mapEl?.removeEventListener("pointermove", this.onMove);
    this.bubble.hidden = true;
    this.halo.hidden = true;
    this.bubble.replaceChildren();
    this.host.finish(how);
  }

  private facts(): TutorialFacts {
    return {
      panel: this.host.panel(),
      provinceOpen: document.querySelector(".dossier:not([hidden])") !== null,
      mapMoved: this.moved,
      daysPassed: this.host.day() - this.startDay,
      battle: document.body.dataset["tactique"] !== undefined,
    };
  }

  private query = (s: string): Element | null => {
    const found = document.querySelector(s);
    if (!found) return null;
    const r = found.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? found : null;
  };

  private advance(): void {
    const f = this.facts();
    if (!canContinue(this.cursor, f)) return;
    this.leavePanel();
    this.cursor = next(this.cursor, (s) => resolveAnchor(s, this.query) !== null);
    this.shownKey = "";
    if (isFinished(this.cursor)) this.stop("done");
  }

  /** Le registre ouvert pour l'étape qui se termine est refermé : l'étape suivante part d'une carte dégagée. */
  private leavePanel(): void {
    const step = TUTORIAL_STEPS[this.cursor.index];
    if (!step) return;
    const open = this.host.panel();
    // Les expéditions restent ouvertes pour l'étape de la bataille, qui les referme en partant.
    if ((step.panel && step.id !== "expeditions" && open === step.panel) || (step.id === "bataille" && open === "expeditions")) this.host.closePanel();
  }

  private skip(): void {
    this.leavePanel();
    this.cursor = next(this.cursor, (s) => resolveAnchor(s, this.query) !== null);
    this.shownKey = "";
    if (isFinished(this.cursor)) this.stop("done");
    else this.update();
  }

  private update(): void {
    if (!this.running) return;
    const before = this.cursor;
    this.cursor = settle(this.cursor, this.facts());
    const step = TUTORIAL_STEPS[this.cursor.index];
    if (!step) return;
    if (before.phase === "action" && this.cursor.phase === "explain" && step.pause) this.host.pause();
    const f = this.facts();
    const key = `${step.id}:${this.cursor.phase}:${canContinue(this.cursor, f)}`;
    if (key !== this.shownKey) {
      this.shownKey = key;
      this.render(step, f);
    }
    this.position(step);
  }

  private render(step: TutorialStep, f: TutorialFacts): void {
    const total = TUTORIAL_STEPS.length;
    const key = this.host.keyOf(step.panel ?? step.id);
    const params = { key };
    const head = el("header", "tuto__tete");
    head.append(el("span", "tuto__progres", t("tuto.progress", { n: this.cursor.index + 1, total })));
    const quit = el("button", "tuto__quitter", t("tuto.quit"));
    quit.type = "button";
    quit.dataset["tuto"] = "quitter";
    quit.addEventListener("click", () => this.stop("quit"));
    head.append(quit);
    const body = el("div", "tuto__corps");
    body.append(el("h3", "tuto__titre", t(`tuto.${step.id}.titre`)));
    const acting = this.cursor.phase === "action";
    if (acting) body.append(el("p", "tuto__action", t(`tuto.${step.id}.action`, params)));
    else {
      body.append(el("p", "tuto__texte", t(`tuto.${step.id}.corps`, params)));
      if (!canContinue(this.cursor, f)) body.append(el("p", "tuto__attente", t(`tuto.${step.id}.attente`)));
    }
    const foot = el("footer", "tuto__pied");
    if (acting || step.action) {
      const pass = el("button", "tuto__passer", t("tuto.skip"));
      pass.type = "button";
      pass.dataset["tuto"] = "passer";
      pass.addEventListener("click", () => this.skip());
      if (acting) foot.append(pass);
    }
    if (!acting) {
      const last = this.cursor.index === TUTORIAL_STEPS.length - 1;
      const go = el("button", "tuto__suivant registre-bouton principal", last ? t("tuto.finish") : t("tuto.next"));
      go.type = "button";
      go.dataset["tuto"] = "suivant";
      go.disabled = !canContinue(this.cursor, f);
      go.addEventListener("click", () => this.advance());
      foot.append(go);
    }
    this.bubble.replaceChildren(head, body, foot);
    this.bubble.dataset["step"] = step.id;
    this.bubble.dataset["phase"] = this.cursor.phase;
    this.bubble.hidden = false;
  }

  private position(step: TutorialStep): void {
    const acting = this.cursor.phase === "action";
    const anchor = (acting ? resolveAnchor(step.anchor, this.query) : (resolveAnchor(step.after ?? step.anchor, this.query) ?? resolveAnchor(step.anchor, this.query))) ?? null;
    if (!anchor) {
      this.halo.hidden = true;
      // Élément absent un instant (registre refermé) : la bulle reste en bas de l'écran, lisible.
      this.bubble.style.left = `${Math.round((window.innerWidth - this.bubble.offsetWidth) / 2)}px`;
      this.bubble.style.top = `${Math.round(window.innerHeight * 0.55)}px`;
      this.bubble.dataset["cote"] = "dedans";
      return;
    }
    const r = anchor.getBoundingClientRect();
    const box: Box = { left: r.left, top: r.top, width: r.width, height: r.height };
    this.halo.hidden = false;
    this.halo.style.left = `${box.left}px`;
    this.halo.style.top = `${box.top}px`;
    this.halo.style.width = `${box.width}px`;
    this.halo.style.height = `${box.height}px`;
    // Barres à garder lisibles (bandeau du haut, menu de gestion), sauf celle qui contient l'élément montré.
    const avoid: Box[] = [];
    for (const sel of [".bandeau", ".gestion"]) {
      const bar = document.querySelector(sel);
      if (!bar || bar.contains(anchor)) continue;
      const b = bar.getBoundingClientRect();
      if (b.width > 0 && b.height > 0) avoid.push({ left: b.left, top: b.top, width: b.width, height: b.height });
    }
    const placed = placeBubble(box, { width: this.bubble.offsetWidth, height: this.bubble.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }, 14, 8, avoid, acting ? null : (step.dock ?? null));
    this.bubble.style.left = `${placed.left}px`;
    this.bubble.style.top = `${placed.top}px`;
    this.bubble.dataset["cote"] = placed.side;
  }
}
