import { t } from "../i18n";
import type { MapFilters } from "../render/strategicMap";
import { isAvailable, OVERLAY_IDS, OVERLAY_PHASE } from "./overlays";
import type { OverlayId, OverlayResult } from "./overlays";

const hex = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;

/** Fiche « Calques » : overlays (F-STR-02), légende, filtres (F-STR-16). Un feuillet papier, pas un panneau flottant. */
export class LayersPanel {
  readonly el = document.createElement("aside");
  private readonly list = document.createElement("ol");
  private readonly closed = document.createElement("ul");
  private readonly legend = document.createElement("div");
  private current: OverlayId | null = null;

  constructor(
    parent: HTMLElement,
    private readonly onOverlay: (id: OverlayId | null) => void,
    private filters: MapFilters,
    private readonly onFilters: (f: MapFilters) => void,
  ) {
    this.el.className = "calques";
    this.el.setAttribute("aria-label", t("layers.title"));
    const title = document.createElement("h2");
    title.className = "calques__titre";
    title.textContent = t("layers.title");
    this.list.className = "calques__liste";
    this.closed.className = "calques__fermes";
    for (const id of OVERLAY_IDS) (isAvailable(id) ? this.list : this.closed).append(this.item(id));
    this.legend.className = "calques__legende";
    const filt = document.createElement("fieldset");
    filt.className = "calques__filtres";
    const lg = document.createElement("legend");
    lg.textContent = t("layers.filters");
    filt.append(lg);
    for (const key of Object.keys(filters) as (keyof MapFilters)[]) {
      const label = document.createElement("label");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = filters[key];
      box.dataset["filter"] = key;
      box.addEventListener("change", () => {
        this.filters = { ...this.filters, [key]: box.checked };
        this.onFilters(this.filters);
      });
      label.append(box, ` ${t(`layers.filter.${key}`)}`);
      filt.append(label);
    }
    this.el.append(title, this.list, this.closed, this.legend, filt);
    parent.append(this.el);
  }

  private item(id: OverlayId): HTMLLIElement {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "calques__calque";
    b.dataset["overlay"] = id;
    b.textContent = t(`overlay.${id}`);
    if (isAvailable(id)) {
      b.addEventListener("click", () => this.select(this.current === id ? null : id));
    } else {
      b.disabled = true;
      b.dataset["why"] = t("layers.closed_why", { phase: OVERLAY_PHASE[id] ?? "?" });
      const stamp = document.createElement("span");
      stamp.className = "calques__tampon";
      stamp.textContent = t("layers.closed", { phase: OVERLAY_PHASE[id] ?? "?" });
      li.append(b, stamp);
      return li;
    }
    li.append(b);
    return li;
  }

  select(id: OverlayId | null): void {
    this.current = id;
    for (const b of this.list.querySelectorAll<HTMLButtonElement>("button[data-overlay]")) b.setAttribute("aria-pressed", String(b.dataset["overlay"] === id));
    this.onOverlay(id);
  }

  /** Calque suivant parmi ceux qui sont ouverts (raccourci). */
  next(): void {
    const open = OVERLAY_IDS.filter(isAvailable);
    const i = this.current ? open.indexOf(this.current) : -1;
    this.select(open[(i + 1) % open.length] ?? null);
  }

  get active(): OverlayId | null {
    return this.current;
  }

  showLegend(result: OverlayResult | null): void {
    this.legend.replaceChildren();
    if (!result || !this.current) return;
    const cap = document.createElement("p");
    cap.className = "calques__explication";
    cap.textContent = t(`overlay.${this.current}.why`);
    const row = document.createElement("div");
    row.className = "calques__echelle";
    for (const step of result.legend) {
      const sw = document.createElement("span");
      sw.className = "calques__case";
      sw.style.backgroundColor = hex(step.color);
      const lab = document.createElement("span");
      lab.className = "calques__case-libelle";
      lab.textContent = step.label;
      const cell = document.createElement("span");
      cell.className = "calques__echelon";
      cell.append(sw, lab);
      row.append(cell);
    }
    this.legend.append(cap, row);
  }
}
