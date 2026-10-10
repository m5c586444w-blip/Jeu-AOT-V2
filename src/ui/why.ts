import type { Explained, Factor } from "../sim/core/explain";
import { RESOURCE_IDS } from "../sim/strategic/resources";
import { hasKey, t } from "../i18n";

/**
 * Contenu d'une infobulle de calcul (U4), sur trois niveaux au plus : (1) titre et valeur ; (2) sections, chacune avec son
 * sous-total ; (3) facteurs (sources, bonus, malus). Une section est une valeur expliquée (facteurs) ou un texte.
 * `cost` : la valeur est une dépense (consommation, pertes) ; une hausse y est un malus (couleur inversée).
 * `key` : touche du raccourci associé (U10), affichée en pied avec `keyLabel` (par défaut « Raccourci »).
 */
export type WhyContent = {
  title: string;
  value?: string;
  sections: { label?: string; explained?: Explained; text?: string; unit?: string; signed?: boolean; cost?: boolean; rows?: WhyRow[] }[];
  key?: string;
  keyLabel?: string;
};

/** Nombre de niveaux d'une infobulle de calcul (U4 : trois au plus). */
export const WHY_LEVELS = 3;

export interface WhyRow {
  label: string;
  value: string;
  sign?: "plus" | "moins";
}
export interface WhySection {
  label?: string;
  subtotal?: string;
  rows: WhyRow[];
  text?: string;
}
/** Modèle d'une infobulle : niveau 1 (titre, valeur), niveau 2 (sections), niveau 3 (lignes de facteurs). */
export interface WhyModel {
  title: string;
  value?: string;
  sections: WhySection[];
  key?: string;
  keyLabel?: string;
}

const nf = (digits: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function formatNumber(n: number): string {
  const a = Math.abs(n);
  return nf(a >= 100 ? 0 : a >= 10 ? 1 : 2).format(n);
}

export function formatSigned(n: number): string {
  const s = formatNumber(n);
  // Une valeur arrondie à zéro ne porte pas de signe (« −0 » relevé sur la capture de fin, P9.7).
  if (Number(s.replace(/\D/g, "")) === 0) return s.replace("-", "");
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

/** Facteurs montrés dans la fiche : une base nulle n'est pas affichée quand d'autres facteurs existent (elle n'apporte rien à la somme). */
export function displayedFactors(x: Explained): Factor[] {
  return x.factors.filter((f) => !(f.op === "base" && f.value === 0 && x.factors.length > 1));
}

/** Ligne d'un facteur : libellé, valeur (base, ajout signé ou coefficient) et sens (bonus ou malus). */
export function factorLine(f: Factor, cost = false): WhyRow {
  const value = f.op === "mul" ? `×${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(f.value)}` : f.op === "base" ? formatNumber(f.value) : formatSigned(f.value);
  // Bonus et malus colorés (U4) : un ajout positif ou un multiplicateur > 1 est un bonus ; la base reste neutre ;
  // pour une dépense (consommation, pertes), le sens est inversé.
  const sign = f.op === "base" ? 0 : f.op === "mul" ? Math.sign(f.value - 1) : Math.sign(f.value);
  const row: WhyRow = { label: t(f.key, resolveParams(f.params)), value };
  if (sign !== 0) row.sign = sign > 0 !== cost ? "plus" : "moins";
  return row;
}

/** Modèle à trois niveaux d'une infobulle (U4), indépendant du DOM. */
export function whyModel(c: WhyContent): WhyModel {
  const sections = c.sections.map((s): WhySection => {
    const out: WhySection = { rows: s.rows ?? (s.explained ? displayedFactors(s.explained).map((f) => factorLine(f, s.cost)) : []) };
    if (s.label) out.label = s.label;
    if (s.explained) out.subtotal = `${s.signed ? formatSigned(s.explained.value) : formatNumber(s.explained.value)}${s.unit ?? ""}`;
    if (s.text) out.text = s.text;
    return out;
  });
  const m: WhyModel = { title: c.title, sections };
  if (c.value) m.value = c.value;
  if (c.key) m.key = c.key;
  if (c.keyLabel) m.keyLabel = c.keyLabel;
  return m;
}

function factorRow(f: Factor, cost = false): HTMLTableRowElement {
  return rowEl(factorLine(f, cost));
}

function rowEl(r: WhyRow): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const label = document.createElement("td");
  label.textContent = r.label;
  const val = document.createElement("td");
  val.className = "pourquoi__valeur";
  val.textContent = r.value;
  if (r.sign) val.dataset["sign"] = r.sign;
  tr.append(label, val);
  return tr;
}

/**
 * Infobulle simple d'une commande (bouton, onglet) : nom, et touche du raccourci s'il y en a un (U10). Remplace l'attribut
 * `title` natif par la même infobulle que les valeurs ; `note` ajoute une ligne (ex. « clic : aller sur le lieu »).
 */
export function hint(el: HTMLElement, text: string, key = "", note = ""): void {
  el.dataset["why"] = text;
  if (key) el.dataset["touche"] = key;
  else delete el.dataset["touche"];
  if (note) el.dataset["whyNote"] = note;
  else delete el.dataset["whyNote"];
  el.removeAttribute("title");
  if (el instanceof HTMLButtonElement && !el.hasAttribute("aria-label")) el.setAttribute("aria-label", text);
}

/** Tableau des facteurs d'une valeur expliquée, avec sa ligne de total (écrans « maître-détail », U4). */
export function explainedTable(x: Explained, opts: { signed?: boolean; cost?: boolean } = {}): HTMLTableElement {
  const signed = opts.signed ?? false;
  const table = document.createElement("table");
  table.className = "facteurs";
  for (const f of displayedFactors(x)) table.append(factorRow(f, opts.cost));
  const tr = document.createElement("tr");
  tr.className = "pourquoi__total";
  const label = document.createElement("td");
  label.textContent = t("why.total");
  const val = document.createElement("td");
  val.className = "pourquoi__valeur";
  val.textContent = signed ? formatSigned(x.value) : formatNumber(x.value);
  tr.append(label, val);
  table.append(tr);
  return table;
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
    const data = (target as HTMLElement).dataset;
    const model: WhyModel = provider ? whyModel(provider()) : { title: data["why"] ?? "", sections: data["whyNote"] ? [{ rows: [], text: data["whyNote"] }] : [] };
    if (!model.key && data["touche"]) model.key = data["touche"];
    this.render(model);
    this.el.hidden = false;
    const r = target.getBoundingClientRect();
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    this.el.style.left = `${Math.max(6, Math.min(window.innerWidth - w - 6, r.left))}px`;
    this.el.style.top = `${r.bottom + h + 8 < window.innerHeight ? r.bottom + 6 : Math.max(6, r.top - h - 6)}px`;
  }

  /** Niveau 1 : titre et valeur ; niveau 2 : sections et sous-totaux ; niveau 3 : facteurs ; pied : raccourci. */
  private render(m: WhyModel): void {
    this.el.replaceChildren();
    const head = document.createElement("div");
    head.className = "pourquoi__tete";
    const title = document.createElement("strong");
    title.className = "pourquoi__titre";
    title.textContent = m.title;
    head.append(title);
    if (m.value) {
      const v = document.createElement("span");
      v.className = "pourquoi__chiffre";
      v.textContent = m.value;
      head.append(v);
    }
    this.el.append(head);
    for (const s of m.sections) this.el.append(this.section(s));
    if (m.key) {
      const foot = document.createElement("p");
      foot.className = "pourquoi__touche";
      const k = document.createElement("kbd");
      k.className = "touche";
      k.textContent = m.key;
      foot.append(`${m.keyLabel ?? t("why.shortcut")} `, k);
      this.el.append(foot);
    }
  }

  private section(s: WhySection): HTMLElement {
    const box = document.createElement("div");
    box.className = "pourquoi__section";
    if (s.label) {
      const h = document.createElement("div");
      h.className = "pourquoi__libelle";
      const name = document.createElement("span");
      name.textContent = s.label;
      h.append(name);
      if (s.subtotal) {
        const v = document.createElement("span");
        v.className = "pourquoi__sous-total";
        v.textContent = s.subtotal;
        h.append(v);
      }
      box.append(h);
    }
    if (s.rows.length) {
      const table = document.createElement("table");
      for (const r of s.rows) table.append(rowEl(r));
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
