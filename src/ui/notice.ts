/** Avis bref (refus d'une commande : capital insuffisant, décret incompatible…), affiché quelques secondes. */
export class Notice {
  private readonly el = document.createElement("p");
  private timer: number | null = null;

  constructor(parent: HTMLElement) {
    this.el.className = "avis-bref";
    this.el.hidden = true;
    this.el.setAttribute("role", "status");
    parent.append(this.el);
  }

  show(text: string): void {
    this.el.textContent = text;
    this.el.hidden = false;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.el.hidden = true;
    }, 4000);
  }
}
