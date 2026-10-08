/**
 * Composants de base de l'interface (UI.1) : fabriques DOM pour bouton, onglets, liste, jauge, barre, étiquette,
 * séparateur et panneau. Le style est dans components.css ; la page de contrôle est /ui-kit.html (développement).
 */
export type Tone = "accent" | "danger" | "succes" | "alerte" | "info" | "neutre";

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Bouton : variante principale, discrète ou de danger ; icône SVG en tête ; raccourci affiché dans l'infobulle (U10). */
export function btn(label: string, onClick: () => void, opts: { variant?: "principal" | "discret" | "danger"; small?: boolean; icon?: string; title?: string; key?: string } = {}): HTMLButtonElement {
  const b = h("button", ["btn", opts.variant ? `btn--${opts.variant}` : "", opts.small ? "btn--petit" : ""].filter(Boolean).join(" "));
  b.type = "button";
  if (opts.icon) b.insertAdjacentHTML("afterbegin", opts.icon);
  b.append(label);
  const title = [opts.title, opts.key ? `[${opts.key}]` : ""].filter(Boolean).join(" ");
  if (title) b.title = title;
  b.addEventListener("click", onClick);
  return b;
}

/** Onglets : un seul sélectionné (aria-selected). */
export function tabs<T extends string>(items: readonly { id: T; label: string }[], current: T, onSelect: (id: T) => void): HTMLElement {
  const nav = h("nav", "onglets");
  nav.setAttribute("role", "tablist");
  for (const it of items) {
    const b = h("button", "onglet", it.label);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(it.id === current));
    b.dataset["tab"] = it.id;
    b.addEventListener("click", () => onSelect(it.id));
    nav.append(b);
  }
  return nav;
}

/** Ligne de liste (maître) : vignette, titre, méta, valeur à droite ; sélectionnable. */
export function listItem(opts: { title: string | HTMLElement; meta?: string; lead?: HTMLElement | string; trail?: HTMLElement | string; selected?: boolean; off?: boolean; onSelect?: () => void }): HTMLLIElement {
  const li = h("li", `liste__item${opts.off ? " liste__item--eteint" : ""}`);
  li.setAttribute("aria-selected", String(!!opts.selected));
  const lead = h("span", "liste__tete");
  if (typeof opts.lead === "string") lead.innerHTML = opts.lead;
  else if (opts.lead) lead.append(opts.lead);
  const mid = h("span", "liste__milieu");
  const title = typeof opts.title === "string" ? h("span", "liste__titre", opts.title) : opts.title;
  mid.append(title);
  if (opts.meta) mid.append(h("span", "liste__meta", ` ${opts.meta}`));
  const trail = h("span", "liste__queue");
  if (opts.trail) trail.append(opts.trail);
  li.append(lead, mid, trail);
  if (opts.onSelect) li.addEventListener("click", opts.onSelect);
  return li;
}

/** Jauge : libellé, valeur, piste remplie (0 à max) ; repère optionnel (seuil). */
export function gauge(label: string, value: HTMLElement | string, share: number, opts: { tone?: Tone; mark?: number } = {}): HTMLElement {
  const box = h("div", `jauge${opts.tone && opts.tone !== "accent" ? ` jauge--${opts.tone}` : ""}`);
  const track = h("div", "jauge__piste");
  const fill = h("div", "jauge__remplissage");
  fill.style.width = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`;
  track.append(fill);
  if (opts.mark !== undefined) {
    const m = h("span", "jauge__repere");
    m.style.left = `${Math.round(Math.max(0, Math.min(1, opts.mark)) * 100)}%`;
    track.append(m);
  }
  box.append(h("span", "jauge__libelle", label), typeof value === "string" ? h("span", "valeur", value) : value, track);
  return box;
}

/** Barre de progression simple. */
export function bar(share: number): HTMLElement {
  const b = h("div", "barre");
  b.setAttribute("role", "progressbar");
  b.setAttribute("aria-valuenow", String(Math.round(share * 100)));
  const f = h("div", "barre__remplissage");
  f.style.width = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`;
  b.append(f);
  return b;
}

/** Étiquette (badge) colorée selon le ton. */
export function tag(text: string, tone: Tone = "neutre"): HTMLSpanElement {
  return h("span", `etiquette${tone === "neutre" ? "" : ` etiquette--${tone}`}`, text);
}

/** Séparateur, avec titre de section optionnel. */
export function sep(title?: string): HTMLElement {
  if (!title) return h("hr", "separateur");
  const d = h("div", "separateur separateur--titre", title);
  d.setAttribute("role", "separator");
  return d;
}

/** Panneau : tête (icône, titre), corps. */
export function panel(title: string, icon = ""): { root: HTMLElement; body: HTMLElement } {
  const root = h("section", "panneau");
  const head = h("header", "panneau__tete");
  if (icon) head.insertAdjacentHTML("afterbegin", icon);
  head.append(h("h3", "panneau__titre", title));
  const body = h("div", "panneau__corps");
  root.append(head, body);
  return { root, body };
}

/** Variation colorée : hausse, baisse, rupture, stable (U3). */
export function variation(text: string, sign: "hausse" | "baisse" | "rupture" | "stable"): HTMLSpanElement {
  const s = h("span", "valeur variation", text);
  s.dataset["sign"] = sign;
  return s;
}
