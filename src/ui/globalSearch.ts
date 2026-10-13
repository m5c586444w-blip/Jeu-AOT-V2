import { t } from "../i18n";
import type { GameState } from "../sim/core/state";
import { isDomestic } from "../sim/politics/vocabulary";
import type { World } from "../sim/strategic/world";
import type { PanelId } from "./panels/common";
import { displayName, el } from "./panels/common";

/**
 * Recherche globale (F-UIX-06, 09 : « Recherche globale (personnes, lieux, lois) ») : provinces, personnages, décrets et
 * registres, sans accents ni casse. Le modèle (`buildSearchIndex`, `searchEntries`) ne touche pas au DOM ; `GlobalSearch`
 * l'affiche dans une fenêtre ouverte par une touche (Q par défaut) ou par la loupe du bandeau.
 */
export type SearchKind = "province" | "personnage" | "decret" | "registre";

export interface SearchEntry {
  kind: SearchKind;
  id: string;
  label: string;
  /** Précision affichée sous le nom (région, grade, catégorie). */
  detail: string;
  /** Nom normalisé (`normalizeSearch`), avec la précision. */
  key: string;
}

/** Minuscules, sans accents ni ligatures ; apostrophes, tirets et points deviennent des espaces. */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/[’'`´\-_.,;:()/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const KIND_ORDER: Readonly<Record<SearchKind, number>> = { province: 0, personnage: 1, decret: 2, registre: 3 };

function entry(kind: SearchKind, id: string, label: string, detail: string): SearchEntry {
  return { kind, id, label, detail, key: normalizeSearch(label) };
}

/**
 * Index de la partie : toutes les provinces ; les personnages du pays déjà entrés en scène (sous leur nom connu, jamais
 * leur nom caché) et les décrets, si leurs registres existent ; les registres eux-mêmes.
 */
export function buildSearchIndex(world: World, state: GameState, panels: readonly PanelId[]): SearchEntry[] {
  const has = (id: PanelId): boolean => panels.includes(id);
  const out: SearchEntry[] = world.provinces.map((p) => entry("province", p.id, t(p.name_key), t(`region.${p.region}`)));
  const pw = world.politics;
  if (pw && has("personnages")) {
    const year = state.date.year;
    for (const c of pw.characters.values()) {
      if (c.active_from > year || !isDomestic(c)) continue;
      const dead = state.politics?.characters[c.id]?.alive === false;
      const rank = c.rank_key ? t(c.rank_key) : "";
      const detail = [rank === "—" ? "" : rank, dead ? t("search.dead") : ""].filter(Boolean).join(" · ");
      out.push(entry("personnage", c.id, displayName(c), detail));
    }
  }
  if (pw && has("decrets")) for (const law of pw.laws.values()) out.push(entry("decret", law.id, t(law.name_key), ""));
  for (const id of panels) out.push(entry("registre", id, t(`panel.${id}`), ""));
  return out;
}

/**
 * Résultats d'une requête : chaque mot doit se trouver dans le nom ; un mot entier vaut mieux qu'un début de mot, qui vaut
 * mieux qu'un fragment ; le nom exact, puis le nom qui commence par la requête, passent devant. À score égal : provinces,
 * personnages, décrets, registres, puis ordre alphabétique.
 */
export function searchEntries(entries: readonly SearchEntry[], query: string, limit = 10): SearchEntry[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  const tokens = q.split(" ");
  const scored: { e: SearchEntry; score: number }[] = [];
  for (const e of entries) {
    const words = e.key.split(" ");
    let score = 0;
    let ok = true;
    for (const tok of tokens) {
      if (words.includes(tok)) continue;
      if (words.some((w) => w.startsWith(tok))) score += 1;
      else if (e.key.includes(tok)) score += 3;
      else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (e.key === q) score -= 2;
    else if (e.key.startsWith(q)) score -= 1;
    scored.push({ e, score });
  }
  scored.sort((a, b) => a.score - b.score || KIND_ORDER[a.e.kind] - KIND_ORDER[b.e.kind] || (a.e.key < b.e.key ? -1 : a.e.key > b.e.key ? 1 : 0));
  return scored.slice(0, limit).map((s) => s.e);
}

/** Fenêtre de recherche : saisie, flèches pour choisir, Entrée pour ouvrir, Échap ou clic à côté pour fermer. */
export class GlobalSearch {
  private readonly root = el("div", "recherche-globale");
  private readonly box = el("div", "recherche-globale__boite");
  private readonly input = el("input", "recherche-globale__saisie");
  private readonly list = el("ul", "recherche-globale__liste");
  private readonly note = el("p", "recherche-globale__note");
  private entries: SearchEntry[] = [];
  private results: SearchEntry[] = [];
  private active = 0;
  private returnFocus: HTMLElement | null = null;

  constructor(
    parent: HTMLElement,
    private readonly index: () => SearchEntry[],
    private readonly choose: (e: SearchEntry) => void,
  ) {
    this.root.hidden = true;
    this.box.setAttribute("role", "dialog");
    this.box.setAttribute("aria-modal", "true");
    this.box.setAttribute("aria-label", t("search.title"));
    // Champ « text » : les raccourcis globaux restent muets pendant la saisie (gameScreen).
    this.input.type = "text";
    this.input.autocomplete = "off";
    this.input.spellcheck = false;
    this.input.placeholder = t("search.placeholder");
    this.input.setAttribute("aria-label", t("search.title"));
    this.input.setAttribute("role", "combobox");
    this.input.setAttribute("aria-controls", "recherche-globale-liste");
    this.input.setAttribute("aria-expanded", "false");
    this.list.id = "recherche-globale-liste";
    this.list.setAttribute("role", "listbox");
    this.note.setAttribute("aria-live", "polite");
    this.box.append(el("h2", "recherche-globale__titre", t("search.title")), this.input, this.list, this.note);
    this.root.append(this.box);
    parent.append(this.root);
    this.root.addEventListener("pointerdown", (ev) => {
      if (ev.target === this.root) this.close();
    });
    this.input.addEventListener("input", () => this.update());
    this.box.addEventListener("keydown", (ev) => this.key(ev));
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.entries = this.index();
    this.input.value = "";
    this.root.hidden = false;
    this.update();
    this.input.focus();
  }

  close(): void {
    if (this.root.hidden) return;
    this.root.hidden = true;
    this.returnFocus?.focus();
    this.returnFocus = null;
  }

  private update(): void {
    this.results = searchEntries(this.entries, this.input.value);
    this.active = 0;
    this.render();
  }

  private render(): void {
    this.list.replaceChildren(
      ...this.results.map((e, i) => {
        const li = el("li", "recherche-globale__resultat");
        li.id = `recherche-globale-${i}`;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", String(i === this.active));
        li.dataset["kind"] = e.kind;
        li.dataset["id"] = e.id;
        const text = el("span", "recherche-globale__nom", e.label);
        if (e.detail) text.append(el("span", "recherche-globale__detail", e.detail));
        li.append(el("span", "recherche-globale__genre", t(`search.kind.${e.kind}`)), text);
        li.addEventListener("pointerdown", (ev) => ev.preventDefault());
        li.addEventListener("click", () => this.pick(i));
        return li;
      }),
    );
    const q = this.input.value.trim();
    this.input.setAttribute("aria-expanded", String(this.results.length > 0));
    if (this.results.length) this.input.setAttribute("aria-activedescendant", `recherche-globale-${this.active}`);
    else this.input.removeAttribute("aria-activedescendant");
    this.note.textContent = !q ? t("search.hint") : this.results.length ? t("search.count", { n: this.results.length }) : t("search.none", { query: q });
  }

  private key(ev: KeyboardEvent): void {
    const n = this.results.length;
    // Tab reste dans la fenêtre (un seul champ) ; les autres touches non traitées vont au champ.
    if (!["Escape", "ArrowDown", "ArrowUp", "Enter", "Tab"].includes(ev.key)) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.key === "Escape") return this.close();
    if (ev.key === "Enter") return this.pick(this.active);
    if (!n || ev.key === "Tab") return;
    this.active = (this.active + (ev.key === "ArrowDown" ? 1 : n - 1)) % n;
    this.render();
    this.list.children[this.active]?.scrollIntoView({ block: "nearest" });
  }

  private pick(i: number): void {
    const e = this.results[i];
    if (!e) return;
    this.returnFocus = null;
    this.close();
    this.choose(e);
  }
}
