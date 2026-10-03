import type { Explained, Factor } from "../sim/core/explain";
import { RESOURCE_IDS } from "../sim/strategic/resources";
import { hasKey, t } from "../i18n";

/** Une ligne d'explication : soit une valeur expliquée (facteurs), soit un texte. */
export type WhyContent = { title: string; sections: { label?: string; explained?: Explained; text?: string; unit?: string; signed?: boolean }[] };

const nf = (digits: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function formatNumber(n: number): string {
  const a = Math.abs(n);
  return nf(a >= 100 ? 0 : a >= 10 ? 1 : 2).format(n);
}

export function formatSigned(n: number): string {
  const s = formatNumber(n);
  return n > 0 ? `+${s}` : s.replace("-", "−");
}

/** Traduit les paramètres des facteurs (ressources, provinces, saisons, niveaux de rationnement…). */
function resolveParams(params: Factor["params"]): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    if (typeof v === "number" && k === "rate") out[k] = `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(v * 100)} %`;
    else if (typeof v === "number") out[k] = formatNumber(v);
    else if (k === "resource") out[k] = (RESOURCE_IDS as readonly string[]).includes(v) ? t(`res.${v}`) : t(`key.${v}`);
    else if (k === "level" && hasKey(`rationing.${v}`)) out[k] = t(`rationing.${v}`);
    else if (k === "season") out[k] = t(`season.${v}`);
    else out[k] = hasKey(v) ? t(v) : v;
  }
  return out;
}

function factorRow(f: Factor): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const label = document.createElement("td");
  label.textContent = t(f.key, resolveParams(f.params));
  const val = document.createElement("td");
  val.className = "pourquoi__valeur";
  val.textContent = f.op === "mul" ? `×${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(f.value)}` : f.op === "base" ? formatNumber(f.value) : formatSigned(f.value);
  tr.append(label, val);
  return tr;
}

/**
 * Fiche « pourquoi ? » (00 §5, 04 §6) : tout élément portant `data-why` reçoit, au survol ou au focus,
 * la liste des facteurs qui ont produit la valeur. Le contenu est recalculé à chaque ouverture.
 */
export class WhyTooltip {
  private readonly el = document.createElement("div");
  private readonly providers = new WeakMap<Element, () => WhyContent>();

  constructor() {
    this.el.className = "pourquoi";
    this.el.hidden = true;
    this.el.setAttribute("role", "tooltip");
    document.body.append(this.el);
    const open = (ev: Event): void => {
      const target = (ev.target as Element | null)?.closest?.("[data-why]");
      if (target) this.show(target);
    };
    document.addEventListener("pointerover", open);
    document.addEventListener("focusin", open);
    document.addEventListener("pointerout", (ev) => {
      if ((ev.target as Element | null)?.closest?.("[data-why]")) this.hide();
    });
    document.addEventListener("focusout", () => this.hide());
  }

  /** Associe une explication calculée à la demande ; marque l'élément comme explicable. */
  bind(el: HTMLElement, provider: () => WhyContent): void {
    this.providers.set(el, provider);
    el.dataset["why"] = el.dataset["why"] ?? "1";
    if (!el.hasAttribute("tabindex") && !(el instanceof HTMLButtonElement) && !(el instanceof HTMLSelectElement)) el.tabIndex = 0;
  }

  private show(target: Element): void {
    const provider = this.providers.get(target);
    this.el.replaceChildren();
    const title = document.createElement("strong");
    title.className = "pourquoi__titre";
    if (provider) {
      const content = provider();
      title.textContent = content.title;
      this.el.append(title);
      for (const s of content.sections) this.el.append(this.section(s));
    } else {
      // Explication textuelle simple (ex. registre non encore ouvert).
      title.textContent = (target as HTMLElement).dataset["why"] ?? "";
      this.el.append(title);
    }
    this.el.hidden = false;
    const r = target.getBoundingClientRect();
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    this.el.style.left = `${Math.max(6, Math.min(window.innerWidth - w - 6, r.left))}px`;
    this.el.style.top = `${r.bottom + h + 8 < window.innerHeight ? r.bottom + 6 : Math.max(6, r.top - h - 6)}px`;
  }

  private section(s: WhyContent["sections"][number]): HTMLElement {
    const box = document.createElement("div");
    box.className = "pourquoi__section";
    if (s.label) {
      const h = document.createElement("span");
      h.className = "pourquoi__libelle";
      h.textContent = s.explained ? `${s.label} : ${s.signed ? formatSigned(s.explained.value) : formatNumber(s.explained.value)}${s.unit ?? ""}` : s.label;
      box.append(h);
    }
    if (s.explained) {
      const table = document.createElement("table");
      for (const f of s.explained.factors) if (!(f.op === "base" && f.value === 0 && s.explained.factors.length > 1)) table.append(factorRow(f));
      box.append(table);
    }
    if (s.text) {
      const p = document.createElement("p");
      p.textContent = s.text;
      box.append(p);
    }
    return box;
  }

  hide(): void {
    this.el.hidden = true;
  }
}
